import type { Game } from './Game';
import type { ExtensionRuntime } from '../../ext/runtime';
import { edibleSnapshot } from './EdibleState';
import { exact, uint, World5Error } from '../../ext/world5';
import { c5Canonical } from './WorldCanonical';
import { knowledgeMember, edibleDefinition } from './KindKnowledge';
import { needBand, needDeclarations } from './ActorNeeds';
import { forEachItemRoot } from './WorldItemRoots';
import { NATIVE_STAT_KEYS } from '../Stats/NativeStatKeys';
const shape = (value: any, keys: string, field: string): void => {
  exact(value, keys, field);
};
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_REFERENCE', field);
};
export function validateEdibleSnapshot(runtime: ExtensionRuntime, value: unknown): void {
  c5Canonical(value);
  const s = value as any;
  const packs = runtime.worldDefinitionPacks();
  for (const key of ['kindKnowledge', 'actorNeeds', 'timedStats'])
    if (s[key] !== undefined) {
      shape(s[key], 'schema,rows', key);
      if (s[key].schema !== 1 || !Array.isArray(s[key].rows) || !s[key].rows.length) fail(key);
    }
  let prev = '';
  for (const r of s.kindKnowledge?.rows ?? []) {
    shape(r, 'groupId,definitionId,state,title', 'kindKnowledge');
    const g = packs.flatMap((p) => p.knowledgeGroups ?? []).find((g) => g.id === r.groupId);
    const key = r.groupId + '\0' + r.definitionId;
    if (
      key <= prev ||
      !g ||
      !g.kinds.some((k) => [k.raw, k.roasted, k.node].includes(r.definitionId)) ||
      !['unknown', 'tasted', 'known'].includes(r.state) ||
      (r.state === 'unknown' && r.title === null) ||
      (r.title !== null &&
        (typeof r.title !== 'string' ||
          !r.title.trim() ||
          [...r.title].length > 29 ||
          /[\u0000-\u001f\u007f]/.test(r.title)))
    )
      fail('kindKnowledge.row');
    prev = key;
  }
  let previousActor = 0,
    previousNeed = '';
  for (const r of s.actorNeeds?.rows ?? []) {
    shape(
      r,
      'actorId,needId,value,remainderTicks,lastSettledTick,zeroSinceTick,deadlineFired,band,revision',
      'actorNeeds'
    );
    const d = packs.flatMap((p) => p.actorNeeds ?? []).find((d) => d.id === r.needId);
    uint(r.actorId, 'actorId', 1);
    uint(r.revision, 'revision', 1);
    uint(r.value, 'value');
    uint(r.lastSettledTick, 'lastSettledTick');
    uint(r.remainderTicks, 'remainderTicks');
    if (
      !d ||
      r.value > d.max ||
      r.remainderTicks >= d.ticksPerPoint ||
      r.band !== needBand(d, r.value) ||
      typeof r.deadlineFired !== 'boolean' ||
      (r.value > 0 && (r.zeroSinceTick !== null || r.deadlineFired)) ||
      (r.value === 0 && (r.remainderTicks !== 0 || r.zeroSinceTick === null)) ||
      r.actorId < previousActor ||
      (r.actorId === previousActor && r.needId <= previousNeed)
    )
      fail('actorNeeds.row');
    if (r.zeroSinceTick !== null) {
      uint(r.zeroSinceTick, 'zeroSinceTick');
      if (r.zeroSinceTick > r.lastSettledTick) fail('zeroSinceTick');
    }
    previousActor = r.actorId;
    previousNeed = r.needId;
  }
  let previous = '';
  for (const r of s.timedStats?.rows ?? []) {
    shape(r, 'actorId,owner,key,category,value,untilTick', 'timedStats');
    uint(r.actorId, 'actorId', 1);
    uint(r.untilTick, 'untilTick', 1);
    const key = NATIVE_STAT_KEYS.find((k) => k.id === r.key);
    const signature = String(r.actorId).padStart(16, '0') + '\0' + r.owner + '\0' + r.key;
    if (
      signature <= previous ||
      !key ||
      !runtime.edibleModule(r.owner)?.worldDefinitions?.edibleItems ||
      !Number.isSafeInteger(r.value) ||
      !['flat', 'increased', 'more'].includes(r.category)
    )
      fail('timedStats.row');
    previous = signature;
    if (r.category === 'flat' && key!.kind !== 'materialized') fail('timedStats.key');
    if (r.category !== 'flat' && key!.kind !== 'query') fail('timedStats.key');
    if (
      r.category === 'increased' &&
      (r.value < key!.increased.minimum || r.value > key!.increased.maximum)
    )
      fail('timedStats.budget');
    if (r.category === 'more') {
      const slot = key!.moreSlots.find((s) => s.id === 'temporary')!;
      if (r.value < slot.minimum || r.value > slot.maximum) fail('timedStats.budget');
    }
  }
  if (s.departures !== undefined) {
    const d = s.departures;
    shape(d, 'schema,nextOrdinal,active,receipts', 'departures');
    uint(d.nextOrdinal, 'nextOrdinal', 1);
    if (
      d.schema !== 1 ||
      !Array.isArray(d.active) ||
      !Array.isArray(d.receipts) ||
      d.receipts.length > 128 ||
      (!d.active.length && !d.receipts.length)
    )
      fail('departures');
    let actor = 0,
      ordinal = 0;
    for (const r of d.active) {
      shape(r, 'actorId,owner,reason,startedTick,untilTick', 'departure');
      uint(r.actorId, 'actorId', 1);
      uint(r.startedTick, 'startedTick');
      uint(r.untilTick, 'untilTick');
      if (
        r.actorId <= actor ||
        r.untilTick < r.startedTick ||
        !runtime.edibleModule(r.owner) ||
        typeof r.reason !== 'string' ||
        !r.reason
      )
        fail('departure.row');
      actor = r.actorId;
    }
    for (const r of d.receipts) {
      shape(r, 'ordinal,actorId,owner,reason,tick,result', 'departureReceipt');
      uint(r.ordinal, 'ordinal', 1);
      uint(r.actorId, 'actorId', 1);
      uint(r.tick, 'tick');
      if (
        r.ordinal <= ordinal ||
        r.ordinal >= d.nextOrdinal ||
        r.result !== 'retired' ||
        !runtime.edibleModule(r.owner) ||
        typeof r.reason !== 'string' ||
        !r.reason
      )
        fail('departureReceipt');
      ordinal = r.ordinal;
    }
  }
}
export function validateEdibleReferences(game: Game): void {
  const runtime = game.extensionRuntime;
  if (!runtime) return;
  const s = edibleSnapshot(runtime);
  validateEdibleSnapshot(runtime, s);
  const internal = game as any,
    actors = [
      game.player,
      ...game.monsters,
      ...game.dormantMonsters,
      ...game.purgatory,
      ...[...internal.levels.values()].flatMap((l: any) => [
        ...l.monsters,
        ...(l.dormantMonsters ?? [])
      ]),
      ...[...internal.pendingFallenByDepth.values()].flat()
    ];
  const alive = (id: number) => actors.some((a) => a.id === id && a.hp > 0),
    now = game.world5!.simulationTicks;
  forEachItemRoot(game, (item, owner) => {
    if (Object.prototype.hasOwnProperty.call(item, 'fireContactCooldownUntilTurn')) {
      if (
        owner.kind !== 'floor' ||
        !edibleDefinition(game, item) ||
        !Number.isSafeInteger(item.fireContactCooldownUntilTurn) ||
        item.fireContactCooldownUntilTurn! < 0
      )
        fail('fireContactCooldownUntilTurn');
    }
    if (edibleDefinition(game, item) && item.worldItem?.toolDurability !== null)
      fail('edible.worldItem');
  });
  for (const r of s.actorNeeds?.rows ?? [])
    if (
      r.actorId === game.player.id ||
      !alive(r.actorId) ||
      r.lastSettledTick > now ||
      !needDeclarations(game).some((d) => d.id === r.needId)
    )
      fail('actorNeeds.actor');
  for (const r of s.timedStats?.rows ?? [])
    if (!alive(r.actorId) || (r.actorId === game.player.id) !== (r.category === 'flat'))
      fail('timedStats.actor');
  for (const r of s.departures?.active ?? [])
    if (r.actorId === game.player.id || !alive(r.actorId) || r.startedTick > now)
      fail('departures.actor');
  for (const r of s.kindKnowledge?.rows ?? [])
    if (!knowledgeMember(game, r.definitionId)) fail('knowledge.member');
}
