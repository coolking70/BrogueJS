import { creatureView, itemView } from '../../ext/types';
import type { Game } from './Game';
import type { EffectIntent, EffectOutcome, EdibleConsumedFact } from '../../ext/worldEdible';
import { edibleState, peekEdibleState } from './EdibleState';
import { resolveEdibleEffect, edibleDefinition, markKnowledge } from './KindKnowledge';
import type { Item } from '../Items/Item';
import { Player, STOMACH_SIZE } from '../../entities/Player';
import { Monster } from '../../entities/Monster';
import type { Creature } from '../../entities/Creature';
import { transactWorldWork } from './WorldWork';
import { checkedAdd } from '../../ext/world5';
import { feedNeed } from './ActorNeeds';
import { timeSystem } from '../Systems/Time';
export function applyEdibleEffect(
  game: Game,
  target: Creature,
  intent: EffectIntent,
  satiety: number,
  needId?: string
): EffectOutcome {
  const o: EffectOutcome = {
    intent: intent.kind,
    applied: false,
    newlyStarted: false,
    immune: false,
    notApplicable: false,
    hpGained: 0,
    satietyGained: 0,
    satietyLost: 0
  };
  const before = target instanceof Player ? target.nutrition : 0;
  if (target instanceof Player) {
    target.nutrition = Math.min(STOMACH_SIZE, target.nutrition + satiety);
    o.satietyGained = target.nutrition - before;
    target.refreshHungerState();
  } else if (needId) o.satietyGained = feedNeed(game, target.id, needId, satiety);
  if (intent.kind === 'heal-fraction') {
    const hp = target.hp;
    target.healPoints(Math.max(intent.min, Math.floor((target.maxHp * intent.percent) / 100)));
    o.hpGained = target.hp - hp;
    o.applied = o.hpGained > 0;
  }
  if (intent.kind === 'status' || intent.kind === 'status-and-satiety') {
    const status = intent.status;
    if (target !== game.player && ['telepathy', 'hallucinating', 'darkness'].includes(status))
      o.notApplicable = true;
    else {
      const id = status === 'haste' && target !== game.player ? 'hasted' : status,
        previous = target.getStatusDuration(id);
      o.immune = target.hasStatusImmunity(id);
      game.applyEdibleStatus(target as Player | Monster, id, intent.turns);
      o.newlyStarted = previous === 0 && target.getStatusDuration(id) > 0;
      o.applied = target.getStatusDuration(id) > previous;
    }
    if (intent.kind === 'status-and-satiety') {
      if (target instanceof Player) {
        const n = target.nutrition;
        if (n > intent.floor) target.nutrition = Math.max(intent.floor, n - intent.satietyLoss);
        o.satietyLost = n - target.nutrition;
        target.refreshHungerState();
      } else if (needId)
        o.satietyLost = -feedNeed(game, target.id, needId, -intent.satietyLoss, intent.floor);
    }
  }
  if (intent.kind === 'temp-stat') {
    const runtime = game.extensionRuntime!,
      s = edibleState(runtime),
      rows = (s.timedStats ??= { schema: 1, rows: [] }).rows;
    const key = target === game.player ? intent.player.key : intent.other.key,
      owner = edibleDefinition(game, applyingDefinition.get(game) ?? '')?.owner!;
    const untilTick = checkedAdd(game.world5!.simulationTicks, intent.turns * 100);
    let row = rows.find((r) => r.actorId === target.id && r.owner === owner && r.key === key);
    if (row) row.untilTick = Math.max(row.untilTick, untilTick);
    else
      rows.push({
        actorId: target.id,
        owner,
        key,
        category: target === game.player ? 'flat' : intent.other.category,
        value: target === game.player ? intent.player.value : intent.other.valueBp,
        untilTick
      });
    rows.sort(
      (a, b) =>
        a.actorId - b.actorId ||
        (a.owner < b.owner ? -1 : a.owner > b.owner ? 1 : a.key < b.key ? -1 : 1)
    );
    runtime.edibleDirty(target.id);
    o.applied = true;
  }
  return o;
}
const applyingDefinition = new WeakMap<Game, string>();
export function consumeEdible(
  game: Game,
  item: Item,
  target: Creature = game.player,
  owner?: string,
  needId?: string
): boolean {
  return transactWorldWork(game, () => {
    const d = edibleDefinition(game, item),
      nativeFood = item.category === 4 ? (item.consumableId as 'ration_of_food' | 'mango') : null;
    if (!game.player.inventory.items.includes(item) || (!d && !nativeFood)) return false;
    const hpBefore = target.hp,
      maxHp = target.maxHp,
      satiety = d?.satiety ?? (nativeFood === 'mango' ? 1550 : 1800),
      intent = d ? resolveEdibleEffect(game, d) : ({ kind: 'none' } as const);
    if (!game.player.inventory.consumeOne(item)) return false;
    applyingDefinition.set(game, d?.id ?? '');
    let outcome: EffectOutcome;
    try {
      outcome = applyEdibleEffect(game, target, intent, satiety, needId);
    } finally {
      applyingDefinition.delete(game);
    }
    const issuer = d?.owner ?? owner!,
      runtime = game.extensionRuntime!;
    const fact: EdibleConsumedFact = {
      owner: issuer,
      factId: runtime.edibleFactId(),
      operation: target === game.player ? 'eat' : 'feed',
      eaterId: target.id,
      feederId: target === game.player ? null : game.player.id,
      definitionId: d?.id ?? null,
      nativeFood,
      resolvedIntent: intent,
      outcome,
      hpBefore,
      maxHp,
      visibleToPlayer: true,
      tick: game.world5!.simulationTicks
    };
    if (target === game.player)
      runtime.emit('itemUsed', {
        creature: creatureView(target, game.player.id),
        item: itemView(item),
        operation: 'eat'
      });
    runtime.edibleParticipate(issuer, 'onConsumed', fact, {
      markKnowledge: (id: string, state: 'tasted' | 'known') =>
        markKnowledge(game, issuer, id, state)
    });
    timeSystem.currentTick += game.player.movementSpeed;
    game.requestEdibleRender();
    return true;
  });
}
export function settleTimedStats(game: Game, deferred = false): void {
  const runtime = game.extensionRuntime;
  if (!runtime) return;
  const s = peekEdibleState(runtime),
    rows = s.timedStats?.rows;
  if (!rows?.length) return;
  const active = new Set([
      game.player.id,
      ...game.monsters.map((a) => a.id),
      ...game.dormantMonsters.map((a) => a.id)
    ]),
    affected = new Set<number>();
  edibleState(runtime).timedStats!.rows = rows.filter((r) => {
    if (active.has(r.actorId) && r.untilTick <= game.world5!.simulationTicks) {
      affected.add(r.actorId);
      return false;
    }
    return true;
  });
  for (const id of affected) runtime.edibleDirty(id);
  void deferred;
}
