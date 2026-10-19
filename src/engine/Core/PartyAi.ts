import { boltPath } from '../Combat/Bolt';
import { footprintOf } from '../Movement/CreatureSpatial';
import { canActorSeeCell } from '../UI/PartyPerception';
/** Foundation bridge: projects lawful knowledge and owns control transitions. */
import type { Game } from './Game';
import type { Creature } from '../../entities/Creature';
import { Monster } from '../../entities/Monster';
import { PartyFailure, type MemberState } from '../../ext/party';
import {
  defaultPartyAi,
  type PartyAiInput,
  type PartyAiState,
  type PartyAiView,
  type PartyAiDecision
} from '../../ext/partyAi';
import { canSeeMonster, publicMonsterCells } from '../UI/MonsterVisibility';
import { knownCellFlags } from '../Map/CellProperties';
import {
  T_OBSTRUCTS_DIAGONAL_MOVEMENT,
  T_HARMFUL_TERRAIN,
  T_IS_DF_TRAP,
  T_LAVA_INSTA_DEATH,
  T_AUTO_DESCENT,
  T_IS_DEEP_WATER
} from '../Map/TerrainCatalog';
import { ItemLoader } from '../Items/ItemLoader';
import { ItemCategory } from '../Items/Item';
import { actorActionSchedulerFor } from './ActorActionSession';
import { c5Canonical } from '../../ext/worldJson';
import type { Json } from '../../ext/types';
export function isPartyAi(m: MemberState, seq: number): boolean {
  return m.controller.kind === 'ai' || m.temporaryAiSeq === seq;
}
export function applyIdleControllers(g: Game): void {
  const s = g.party?.state;
  if (!s) return;
  s.companionOrders = s.companionOrders.filter(
    (r) => r.level === g.depth && !!eligiblePartyCompanion(g, r.actorId)
  );
  if (s.window.decision) return;
  for (const m of s.members) {
    const a = g.controlledActors.find((a) => a.id === m.actorId)!;
    if (m.life === 'dead') {
      m.temporaryAiSeq = null;
      continue;
    }
    if (
      !m.pendingController ||
      m.life !== 'active' ||
      g.party!.native[m.actorId]?.modal ||
      a.ticksUntilTurn > 0 ||
      actorActionSchedulerFor(g)?.isBusy(a.id) ||
      a.hasStatus('paralyzed') ||
      a.hasStatus('slumber') ||
      a.hasStatus('entranced')
    )
      continue;
    m.controller = m.pendingController;
    m.pendingController = null;
    if (m.controller.kind === 'human') m.temporaryAiSeq = null;
  }
}
export function eligiblePartyCompanion(g: Game, id: number): Monster | undefined {
  const a = g.monsters.find((m) => m.id === id);
  if (
    !a ||
    a.hp <= 0 ||
    !a.isAlly ||
    a.isCaged ||
    a.isDormant ||
    a.hasStatus('discordant') ||
    a.hasStatus('confused') ||
    !g.isBodyDecisionOwner(id) ||
    g.party?.state.members.some((m) => m.actorId === id) ||
    g.world5?.residents.some((r) => r.actorId === id) ||
    g.world5?.raidCamps.some((c) => c.event?.actorIds.includes(id))
  )
    return;
  return a;
}
export function validatePartyAiInput(g: Game, input: PartyAiInput): boolean {
  const s = g.party?.state;
  if (!s) throw new PartyFailure('PARTY_DISABLED');
  if (s.revision !== input.expectedRevision) throw new PartyFailure('STALE_REVISION');
  if (input.issuerSlot !== 'local:0') throw new PartyFailure('NOT_CONTROLLER');
  if (s.window.phase === 'failed' || s.window.phase === 'running')
    throw new PartyFailure('ACTOR_BUSY');
  const c = input.change;
  if (c.kind === 'order') {
    if (s.window.decision) throw new PartyFailure('DECISION_REQUIRED');
    for (const id of c.actorIds) {
      const m = s.members.find((m) => m.actorId === id);
      if (m) {
        if (m.life !== 'active') throw new PartyFailure('BAD_ACTOR');
        if (!isPartyAi(m, s.window.seq) && m.pendingController?.kind !== 'ai')
          throw new PartyFailure('NOT_CONTROLLER');
      } else if (!eligiblePartyCompanion(g, id)) throw new PartyFailure('BAD_ACTOR');
    }
    if (c.order?.kind === 'attack') {
      const targetId = c.order.targetId;
      const target = g.monsters.find((a) => a.id === targetId);
      if (
        !target ||
        target.hp <= 0 ||
        target.isAlly ||
        !g.activeControlledActors.some((a) => canSeeMonster(a, g.grid, target))
      )
        throw new PartyFailure('INVALID_TARGET');
    } else if (c.order) {
      if (c.order.level !== g.depth) throw new PartyFailure('INVALID_TARGET');
      if (c.order.kind !== 'explore') {
        const cell = g.grid.getCell(c.order.x, c.order.y);
        if (!cell || (!cell.isVisible && !cell.hasMemory)) throw new PartyFailure('INVALID_TARGET');
      }
    }
    const extra = c.actorIds.filter(
      (id) =>
        !s.members.some((m) => m.actorId === id) && !s.companionOrders.some((r) => r.actorId === id)
    );
    if (s.companionOrders.length + extra.length > 64) throw new PartyFailure('PLAN_LIMIT');
    return true;
  }
  const m = s.members.find((m) => m.actorId === c.actorId);
  if (!m || m.life === 'dead') throw new PartyFailure('BAD_ACTOR');
  if (c.kind === 'controller' && m.controlEpoch >= Number.MAX_SAFE_INTEGER)
    throw new PartyFailure('BUDGET_EXCEEDED');
  if (c.expectedEpoch !== m.controlEpoch) throw new PartyFailure('STALE_REVISION');
  if (c.kind === 'settings') {
    if (s.window.decision) throw new PartyFailure('DECISION_REQUIRED');
    return c5Canonical(m.ai.settings) !== c5Canonical(c.settings);
  }
  return (
    c5Canonical(m.pendingController ?? m.controller) !== c5Canonical(c.controller) ||
    (c.controller.kind === 'human' && m.temporaryAiSeq !== null && !m.pendingController)
  );
}
export function commitPartyAiInput(g: Game, input: PartyAiInput): void {
  if (!validatePartyAiInput(g, input)) return;
  const s = g.party!.state,
    c = input.change;
  if (c.kind === 'order') {
    for (const id of [...c.actorIds].sort((a, b) => a - b)) {
      const m = s.members.find((m) => m.actorId === id);
      if (m) m.ai.order = structuredClone(c.order);
      else {
        let row = s.companionOrders.find((r) => r.actorId === id);
        if (c.order === null) {
          s.companionOrders = s.companionOrders.filter((r) => r.actorId !== id);
          continue;
        }
        if (!row) {
          row = { actorId: id, level: g.depth, ai: defaultPartyAi() };
          s.companionOrders.push(row);
        }
        row.ai.order = structuredClone(c.order);
      }
    }
    s.companionOrders.sort((a, b) => a.actorId - b.actorId);
  } else {
    const m = s.members.find((m) => m.actorId === c.actorId)!;
    if (c.kind === 'settings') m.ai.settings = structuredClone(c.settings);
    else {
      m.pendingController = structuredClone(c.controller);
      m.controlEpoch++;
      const w = s.window.members.find((w) => w.actorId === m.actorId)!;
      w.plan = null;
      w.cursor = 0;
    }
  }
  s.revision++;
  if (s.window.decision) s.window.decision.worldRevision = s.revision;
  applyIdleControllers(g);
}
export function partyAiView(g: Game, actor: Creature, ai: PartyAiState): PartyAiView {
  const s = g.party!.state,
    cells: PartyAiView['cells'][number][] = [];
  const stair = g.levelSeeds[g.depth - 1];
  for (let y = 0; y < g.grid.height; y++)
    for (let x = 0; x < g.grid.width; x++) {
      const c = g.grid.getCell(x, y)!;
      if (!c.isVisible && !c.hasMemory && !c.isMagicMapped) continue;
      const flags = knownCellFlags(c);
      cells.push({
        x,
        y,
        passable: c.isVisible ? c.isPassable : c.rememberedFlags?.passable === true,
        blocksDiagonal: !!(flags & T_OBSTRUCTS_DIAGONAL_MOVEMENT),
        danger: !!(
          flags &
          (T_HARMFUL_TERRAIN | T_IS_DF_TRAP | T_LAVA_INSTA_DEATH | T_AUTO_DESCENT | T_IS_DEEP_WATER)
        ),
        downStairs: stair?.downStairsLoc?.x === x && stair?.downStairsLoc?.y === y,
        stairs: !![stair?.upStairsLoc, stair?.downStairsLoc].some((p) => p?.x === x && p.y === y)
      });
    }
  const actors = g.activeControlledActors,
    leader = actors.find((a) => a.id === s.leaderActorId);
  const seen = g.monsters.filter(
    (m) => m.hp > 0 && actors.some((a) => canSeeMonster(a, g.grid, m))
  );
  const ownGroup=g.bodyGroups?.find(b=>b.coreId===actor.id), ownIds=new Set(ownGroup?.members.map(m=>m.entityId)??[actor.id]);
  const occupied = [...new Map([
    ...actors.filter(a=>a!==actor).map(a=>({...a.loc})),
    ...seen.filter(a=>!ownIds.has(a.id)&&a.isAlly).flatMap(m=>actors.flatMap(a=>publicMonsterCells(a,g.grid,m)))
  ].map(p=>[`${p.x},${p.y}`,p])).values()].sort((a,b)=>a.y-b.y||a.x-b.x);
  const controlled = g.controlledActors.find((a) => a.id === actor.id),
    inventory = controlled?.inventory;
  const recovery =
    inventory?.items
      .filter(
        (i) =>
          (i.category === ItemCategory.POTION &&
            ['potion_of_life', 'potion_of_healing'].includes(
              i.consumableId ?? i.identityId ?? ''
            ) &&
            ItemLoader.identifiedItems.has(i.consumableId ?? i.identityId ?? '') &&
            actor.hp * 100 <= actor.maxHp * 25) ||
          (i.category === ItemCategory.FOOD &&
            ['ration_of_food', 'mango'].includes(i.consumableId ?? i.identityId ?? '') &&
            (controlled?.nutrition ?? Infinity) <= 500)
      )
      .map((i) => i.id) ?? [];
  const ranged = inventory?.items.find(
    (i) =>
      i.category === ItemCategory.WEAPON &&
      i.identityId === 'dart' &&
      i.isIdentified &&
      i.quantity > 0
  );
  const enemies = seen
    .filter((m) => !m.isAlly)
    .map((m) => {
      const visible = actors
          .flatMap((a) => publicMonsterCells(a, g.grid, m))
          .sort(
            (a, b) =>
              Math.max(Math.abs(a.x - actor.x), Math.abs(a.y - actor.y)) -
                Math.max(Math.abs(b.x - actor.x), Math.abs(b.y - actor.y)) ||
              a.y - b.y ||
              a.x - b.x
          ),
        at = visible[0]!;
      const ownCells = visible.filter((p) =>
        controlled
          ? canActorSeeCell(controlled, g.grid, p.x, p.y)
          : g.hasLineOfSight(actor.x, actor.y, p.x, p.y)
      );
      const own = ownCells.length > 0;
      const ray = boltPath(actor.loc, at);
      const clear =
        ownCells.some((p) => p.x === at.x && p.y === at.y) &&
        ray.every((p) => cells.some((c) => c.x === p.x && c.y === p.y && c.passable)) &&
        !occupied.some((a) => ray.some((p) => p.x === a.x && p.y === a.y));
      const group = g.bodyGroups?.find((b) => b.coreId === actor.id),
        sources = group
          ? g.monsters.filter((a) =>
              group.members.some((m) => m.entityId === a.id && m.life === 'active')
            )
          : [actor];
      return {
        id: m.id,
        x: at.x,
        y: at.y,
        attackable: own,
        adjacent: sources.some((a) =>
          footprintOf(a).some((from) =>
            ownCells.some(
              (to) =>
                Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y)) === 1 &&
                (from.x === to.x ||
                  from.y === to.y ||
                  (cells.some((c) => c.x === from.x && c.y === to.y && c.passable) &&
                    cells.some((c) => c.x === to.x && c.y === from.y && c.passable)))
            )
          )
        ),
        ranged: clear && Math.max(Math.abs(at.x - actor.x), Math.abs(at.y - actor.y)) <= 5
      };
    });
  const pickups = g.items
    .filter(
      (i) =>
        g.grid.getCell(i.x, i.y)?.isVisible &&
        !i.flags?.includes('ITEM_PLAYER_AVOIDS') && (!g.extensionRuntime || g.extensionRuntime.itemAutoPickup(i)) &&
        inventory?.hasSpace(i) &&
        [ItemCategory.FOOD, ItemCategory.GOLD].includes(i.category)
    )
    .map((i) => ({ id: i.id, x: i.x, y: i.y }));
  return {
    seed: g.currentSeed,
    fingerprint: g.extensionRuntime!.manifest.modules.find((m) => m.id === 'party')!.rules!
      .fingerprint,
    actorId: actor.id,
    ordinal: ai.ordinal,
    level: g.depth,
    at: { ...actor.loc },
    hp: actor.hp,
    maxHp: actor.maxHp,
    leader: leader ? { ...leader.loc } : null,
    cells,
    occupied,
    enemies,
    recovery,
    rangedItem: ranged?.id ?? null,
    pickups,
    settings: structuredClone(ai.settings),
    order: structuredClone(ai.order)
  };
}
export function decidePartyAi(g: Game, id: number): PartyAiDecision {
  const m = g.party!.state.members.find((m) => m.actorId === id)!,
    actor = g.controlledActors.find((a) => a.id === id)!;
  if (m.ai.ordinal >= Number.MAX_SAFE_INTEGER) throw new PartyFailure('BUDGET_EXCEEDED');
  const result = g.extensionRuntime!.queryOptional(
    'party.ai.v1',
    partyAiView(g, actor, m.ai) as unknown as Json
  );
  if (result.status !== 'available') throw new PartyFailure('INTERNAL_FAILURE');
  return structuredClone(result.value) as unknown as PartyAiDecision;
}

/** Called after the one native prelude and only for the body's decision owner. */
export function takePartyCompanionOrder(g: Game, actor: Monster): boolean {
  const s = g.party?.state,
    row = s?.companionOrders.find((r) => r.actorId === actor.id);
  if (!s || !row) return false;
  if (row.level !== g.depth || !eligiblePartyCompanion(g, actor.id)) {
    s.companionOrders = s.companionOrders.filter((r) => r !== row);
    return false;
  }
  // Orders do not grant movement/melee capabilities. Keep the native remainder
  // (including magic and composite per-source gates), without a second prelude.
  // hasCEBehavior expands the composite MONST_TURRET flag as well.
  if (actor.hasCEBehavior('MONST_IMMOBILE')) return false;
  if (row.ai.ordinal >= Number.MAX_SAFE_INTEGER) throw new PartyFailure('BUDGET_EXCEEDED');
  const decision = g.extensionRuntime!.queryOptional(
    'party.ai.v1',
    partyAiView(g, actor, row.ai) as unknown as Json
  );
  if (decision.status !== 'available') throw new PartyFailure('INTERNAL_FAILURE');
  const result = decision.value as unknown as PartyAiDecision,
    intent = result.intent;
  g.commitPartyCompanionIntent(actor, intent);
  row.ai.ordinal++;
  row.ai.diagnostic = result.diagnostic;
  return true;
}
