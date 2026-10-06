import { markRecordingRoot } from '../../ext/recordingRevisions';
import { assertNativeActorDecisionScope, type ActorActionScope } from './ActorActionScope';
/** Synchronous foundation authority: detached plans, scoped commits, escrow and batch settlement. */
import type { Game } from './Game';
import type {
  WorldPlanHandle,
  WorldActorScope,
  WorldResult,
  WorldCommit,
  WorldWorkPrepareSDK,
  TimedWorkRequest,
  StationPlacementRequest,
  CancelWorkRequest,
  ItemAmount,
  RecipePreview,
  WorldErrorCode,
  Position,
  JsonValue
} from '../../ext/worldSdk';
import { World5Error, checkedAdd, levelKey, type MutableWorld } from '../../ext/world5';
import { c5Canonical } from './WorldCanonical';
import { inventoryStamp } from './RecordingDigest';
import { Item, ItemCategory } from '../Items/Item';
import { assembleWorldItem } from '../Items/WorldItems';
import { createActorActionBundle, type ReadonlyActorActionBundle } from './ActorActionScheduler';
import { productionActorActionScheduler } from './ActorActionProduction';
import { sourceFootprintVersion } from '../Movement/AttackShape';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { deepFreeze } from '../Movement/SpatialSchema';
import { timeSystem } from '../Systems/Time';
import { logger } from '../Systems/Logger';
import i18next from 'i18next';
import {
  worldPack,
  itemDefinition,
  activeTicket,
  activeTicketById,
  distance,
  clearWorldCell,
  queryStations,
  threat,
  readWorkContext,
  outputSlots,
  containerItems,
  containerRead,
  amountStacks,
  materializedNode,
  allocateWorldId,
  checkItemBudget,
  checkInteractableBudget,
  createOutputs,
  putInventory,
  putContainer,
  withPublishingTicket,
  isPublishingTicket,
  recordWorldFact,
  recordWorldReceipt,
  updateWorldReasons,
  result,
  reservedContainerSlots,
  reservedInventorySlots
} from './WorldWorkWorld';
export interface WorldWorkDetail {
  ticketId: number;
  at: Position | null;
  anchor: Position;
  hp: number;
  toolId: number | null;
  workTicks: number;
  interrupted: string | null;
}
type Request =
  | TimedWorkRequest
  | ({ kind: 'place-station' } & StationPlacementRequest)
  | ({ kind: 'cancel-work' } & CancelWorkRequest);
interface Plan {
  owner: string;
  actorId: number;
  request: Request;
  inputs: ItemAmount[];
  outputs: ItemAmount[];
  workTicks: number;
  toolId: number | null;
  toolCost: number;
  sourceId: number | null;
  destinationId: number | null;
  outputSlots: number;
  refundSlots: number;
  risks: readonly 'tool-break'[];
  canonical: string;
}
const scopes = new WeakMap<
  object,
  { game: Game; owner: string; actorId: number; kind: string; active: boolean }
>();
const handles = new WeakMap<object, { game: Game; plan: Plan; used: boolean; epoch: number }>();
const errors = new WeakMap<Game, WorldErrorCode | null>();
const validErrors = new Set<string>([
  'C5_BAD_PAYLOAD',
  'C5_BAD_DEFINITION',
  'C5_BAD_VERSION',
  'C5_DISABLED',
  'C5_UNSUPPORTED',
  'C5_SCOPE',
  'C5_STALE',
  'C5_PLAN_USED',
  'C5_BUSY',
  'C5_DEAD',
  'C5_GATE',
  'C5_UNKNOWN_TARGET',
  'C5_WRONG_LEVEL',
  'C5_DISTANCE',
  'C5_THREAT',
  'C5_TOOL',
  'C5_INPUT',
  'C5_CAPACITY',
  'C5_RESOURCE_EMPTY',
  'C5_RESERVED',
  'C5_BUDGET',
  'C5_OVERLAP',
  'C5_PROTECTED',
  'C5_BLOCKED',
  'C5_ROOM',
  'C5_NEEDS_RESUPPLY',
  'C5_BAD_TIME',
  'C5_BAD_OWNERSHIP',
  'C5_BAD_REFERENCE',
  'C5_PROVIDER',
  'C5_TRANSACTION',
  'C5_OVERFLOW',
  'C5_TERMINAL'
]);
export const worldWorkLastError = (game: Game) => errors.get(game) ?? null;
export const setWorldWorkError = (game: Game, code: WorldErrorCode | null) =>
  errors.set(game, code);
export function withWorldActorScope<T>(
  game: Game,
  owner: string,
  actorId: number,
  kind: 'player-command' | 'npc-decision' | 'trusted-world',
  work: (scope: WorldActorScope) => T,
  nativeScope?: ActorActionScope
): T {
  if (kind === 'npc-decision') {
    if (!nativeScope) throw new World5Error('C5_SCOPE');
    try {
      assertNativeActorDecisionScope(nativeScope, game, actorId);
    } catch {
      throw new World5Error('C5_SCOPE');
    }
  }
  if (
    (kind === 'player-command' &&
      (!game.isExecutingRecordedCommand() || actorId !== game.player.id)) ||
    (kind === 'trusted-world' && !import.meta.env.DEV)
  )
    throw new World5Error('C5_SCOPE');
  const scope = Object.freeze({ owner, actorId, kind }) as WorldActorScope,
    entry = { game, owner, actorId, kind, active: true };
  scopes.set(scope, entry);
  try {
    return work(scope);
  } finally {
    entry.active = false;
  }
}
function reject(code: WorldErrorCode, field: string | null = null): never {
  throw new World5Error(code, field);
}
function strict(value: unknown, keys: string[]): void {
  try {
    c5Canonical(value);
  } catch {
    reject('C5_BAD_PAYLOAD');
  }
  if (
    !value ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== keys.sort().join(',')
  )
    reject('C5_BAD_PAYLOAD');
}
const int = (value: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) reject('C5_BAD_PAYLOAD');
};
function commandEnvelope(data: unknown): { module: string; action: string; payload: JsonValue } {
  const v = typeof data === 'string' ? JSON.parse(data) : data;
  strict(v, ['module', 'action', 'payload']);
  if (typeof v.module !== 'string' || typeof v.action !== 'string') reject('C5_BAD_PAYLOAD');
  return v;
}
export function isWorldWorkCommand(game: Game, data: unknown): boolean {
  try {
    const v = commandEnvelope(data);
    return !!game.extensionRuntime?.worldWorkCommand(v.module, v.action);
  } catch {
    return false;
  }
}
export function isCancelWorkCommand(game: Game, data: unknown): boolean {
  try {
    return isWorldWorkCommand(game, data) && commandEnvelope(data).action === 'cancel-work';
  } catch {
    return false;
  }
}
function actor(game: Game, id: number) {
  return id === game.player.id ? game.player : game.monsters.find((m) => m.id === id);
}
function tool(
  game: Game,
  tag: string | null,
  actorId: number
): { id: number | null; cost: number; durability: number } {
  if (tag === null) return { id: null, cost: 0, durability: 0 };
  const held =
    actorId === game.player.id
      ? game.player.inventory.items
      : ([(actor(game, actorId) as any)?.carriedItem].filter(Boolean) as Item[]);
  const i = held.find(
    (i) =>
      i.worldItem &&
      itemDefinition(game, i.worldItem.definitionId).tool?.tag === tag &&
      (i.worldItem.toolDurability ?? 0) > 0
  );
  if (!i) reject('C5_TOOL');
  const d = itemDefinition(game, i.worldItem!.definitionId);
  return { id: i.id, cost: d.tool!.durabilityPerBatch, durability: i.worldItem!.toolDurability! };
}
function common(game: Game, owner: string, actorId: number, cancel = false): void {
  worldPack(game, owner);
  const a = actor(game, actorId);
  if (!a) reject('C5_UNKNOWN_TARGET');
  if (a.hp <= 0) reject('C5_DEAD');
  if (game.isGameOver) reject('C5_TERMINAL');
  if (game.interactionActive) reject('C5_GATE');
  if (game.actorActions?.bundles.some((b) => b.decisionOwnerId === actorId) || a.ticksUntilTurn > 0)
    reject('C5_BUSY');
  if (!cancel && activeTicket(game, actorId)) reject('C5_BUSY');
  if (a.hasStatus('paralyzed') || a.hasStatus('entranced')) reject('C5_BUSY');
  if (!cancel && threat(game, actorId)) reject('C5_THREAT');
}
function accessContainer(game: Game, id: number, revision: number | null, actorId: number): void {
  const c = game.world5!.containers.find((c) => c.id === id);
  if (!c || c.kind !== 'chest') reject('C5_UNKNOWN_TARGET');
  if (levelKey(c.levelRef) !== `dungeon.${game.depth}`) reject('C5_WRONG_LEVEL');
  if (c.revision !== revision) reject('C5_STALE');
  const read = containerRead(game, id),
    a = actor(game, actorId)!;
  if (!read.at || !game.grid.getCell(read.at.x, read.at.y)?.hasMemory) reject('C5_UNKNOWN_TARGET');
  if (distance(a.loc, read.at) > 1 || !hasInteractionLine(game.grid, a.loc, read.at))
    reject('C5_DISTANCE');
}
function amountsEnough(
  _game: Game,
  items: readonly Item[],
  amounts: readonly ItemAmount[],
  batches: number
): void {
  for (const row of amounts)
    if (
      items.reduce(
        (n, i) => n + (i.worldItem?.definitionId === row.itemDefinitionId ? i.quantity : 0),
        0
      ) <
      row.count * batches
    )
      reject('C5_INPUT');
}
function afterEscrow(
  items: readonly Item[],
  inputs: readonly ItemAmount[],
  batches: number
): Item[] {
  const remaining = new Map(inputs.map((a) => [a.itemDefinitionId, a.count * batches]));
  return items.flatMap((i) => {
    const rest = remaining.get(i.worldItem?.definitionId ?? '') ?? 0,
      taken = Math.min(rest, i.quantity);
    if (taken) remaining.set(i.worldItem!.definitionId, rest - taken);
    return i.quantity > taken
      ? [
          Object.assign(Object.create(Item.prototype), structuredClone(i), {
            quantity: i.quantity - taken
          })
        ]
      : [];
  });
}
function preparePlan(
  game: Game,
  owner: string,
  actorId: number,
  request: Request,
  continuing = false
): Plan {
  const pack = worldPack(game, owner);
  if (!continuing && request.kind !== 'cancel-work' && game.world5!.tickets.length >= 8192)
    reject('C5_BUDGET');
  if (!continuing) common(game, owner, actorId, request.kind === 'cancel-work');
  else if (threat(game, actorId)) reject('C5_THREAT');
  const a = actor(game, actorId)!;
  let inputs: ItemAmount[] = [],
    outputs: ItemAmount[] = [],
    workTicks = 0,
    sourceId: number | null = null,
    destinationId: number | null = null,
    batches = 1,
    tag: string | null = null,
    casKeys: WorldPlanHandle['casKeys'] = [];
  if (request.kind === 'cancel-work') {
    strict(request, ['kind', 'ticketId', 'ticketRevision']);
    int(request.ticketId, 1);
    int(request.ticketRevision);
    const t = activeTicketById(game, request.ticketId);
    if (!t || t.owner !== owner || t.actorId !== actorId || actorId !== game.player.id)
      reject('C5_UNKNOWN_TARGET');
    if (t.revision !== request.ticketRevision) reject('C5_STALE');
    if (t.status !== 'working' || t.bundleActionId !== null) reject('C5_BUSY');
    casKeys = [{ kind: 'ticket', ticketId: t.ticketId, revision: t.revision }];
  } else {
    if (
      request.inventoryStamp !==
      inventoryStamp(
        actorId === game.player.id
          ? game.player.inventory.items
          : [(a as any).carriedItem].filter(Boolean)
      )
    )
      reject('C5_STALE');
    casKeys = [{ kind: 'inventory', actorId, stamp: request.inventoryStamp }];
    if (
      actorId !== game.player.id &&
      (request.kind !== 'harvest' || request.destinationId === null)
    )
      reject('C5_UNSUPPORTED');
    if (request.kind === 'harvest') {
      strict(request, [
        'kind',
        'nodeId',
        'nodeRevision',
        'inventoryStamp',
        'destinationId',
        'destinationRevision'
      ]);
      int(request.nodeId, 1);
      int(request.nodeRevision);
      if (request.destinationId !== null) int(request.destinationId, 1);
      if (request.destinationRevision !== null) int(request.destinationRevision);
      const n = game.world5!.nodes.find((n) => n.interactableId === request.nodeId);
      if (!n || n.owner !== owner) reject('C5_UNKNOWN_TARGET');
      if (levelKey(n.levelRef) !== `dungeon.${game.depth}`) reject('C5_WRONG_LEVEL');
      if (!game.grid.getCell(n.at.x, n.at.y)?.hasMemory) reject('C5_UNKNOWN_TARGET');
      if (n.revision !== request.nodeRevision) reject('C5_STALE');
      if (distance(a.loc, n.at) > 1 || !hasInteractionLine(game.grid, a.loc, n.at))
        reject('C5_DISTANCE');
      const v = materializedNode(game, n);
      const d = pack.resourceNodes.find((d) => d.id === n.definitionId)!;
      if (v.remaining < d.unitsPerHarvest) reject('C5_RESOURCE_EMPTY');
      if (v.remaining - v.reservedUnits < d.unitsPerHarvest) reject('C5_RESERVED');
      outputs = structuredClone(d.yield) as ItemAmount[];
      workTicks = d.harvestTicks;
      tag = d.requiredToolTag;
      casKeys = [
        ...casKeys,
        { kind: 'node', interactableId: n.interactableId, revision: n.revision }
      ];
      destinationId = request.destinationId;
      if (destinationId !== null) {
        accessContainer(game, destinationId, request.destinationRevision, actorId);
        casKeys = [
          ...casKeys,
          { kind: 'container', containerId: destinationId, revision: request.destinationRevision! }
        ];
      } else if (request.destinationRevision !== null) reject('C5_BAD_PAYLOAD');
    } else if (request.kind === 'craft') {
      strict(request, [
        'kind',
        'recipeId',
        'batchCount',
        'stationId',
        'stationRevision',
        'sourceContainerId',
        'sourceRevision',
        'inventoryStamp'
      ]);
      int(request.batchCount, 1, 16);
      batches = request.batchCount;
      const d = pack.recipes.find((d) => d.id === request.recipeId);
      if (!d) reject('C5_BAD_DEFINITION');
      inputs = structuredClone(d.inputs) as ItemAmount[];
      outputs = structuredClone(d.outputs) as ItemAmount[];
      workTicks = d.workTicks;
      tag = d.toolTag;
      sourceId = request.sourceContainerId;
      if (request.stationId !== null) {
        int(request.stationId, 1);
        int(request.stationRevision!);
        const s = game.world5!.stations.find((s) => s.interactableId === request.stationId);
        if (!s) reject('C5_UNKNOWN_TARGET');
        if (levelKey(s.levelRef) !== `dungeon.${game.depth}`) reject('C5_WRONG_LEVEL');
        if (s.revision !== request.stationRevision) reject('C5_STALE');
        const read = queryStations(game, owner).find((s) => s.interactableId === request.stationId);
        if (!read) reject('C5_UNKNOWN_TARGET');
        if (!read.workPositions.some((p) => p.x === a.x && p.y === a.y)) reject('C5_DISTANCE');
        if (!d.stationTags.every((t) => read.tags.includes(t))) reject('C5_INPUT');
        casKeys = [
          ...casKeys,
          { kind: 'station', interactableId: s.interactableId, revision: s.revision }
        ];
      } else if (request.stationRevision !== null) reject('C5_BAD_PAYLOAD');
      else if (d.stationTags.length) reject('C5_INPUT');
      if (sourceId !== null) {
        int(sourceId, 1);
        int(request.sourceRevision!);
        accessContainer(game, sourceId, request.sourceRevision, actorId);
        casKeys = [
          ...casKeys,
          { kind: 'container', containerId: sourceId, revision: request.sourceRevision! }
        ];
      } else if (request.sourceRevision !== null) reject('C5_BAD_PAYLOAD');
    } else {
      strict(request, ['kind', 'definitionId', 'at', 'inventoryStamp']);
      strict(request.at, ['x', 'y']);
      int(request.at.x);
      int(request.at.y);
      const d = pack.stations.find((d) => d.id === request.definitionId);
      if (!d) reject('C5_BAD_DEFINITION');
      if (distance(a.loc, request.at) > 1 || !hasInteractionLine(game.grid, a.loc, request.at))
        reject('C5_DISTANCE');
      if (!game.grid.getCell(request.at.x, request.at.y)?.hasMemory) reject('C5_UNKNOWN_TARGET');
      if (!clearWorldCell(game, request.at)) reject('C5_BLOCKED');
      if (game.world5!.stations.length >= 128) reject('C5_BUDGET');
      checkInteractableBudget(game);
      const kit =
        d.kitDefinitionId &&
        game.player.inventory.items.find(
          (i) => i.worldItem?.definitionId === d.kitDefinitionId && i.quantity >= 1
        );
      inputs = kit
        ? [{ itemDefinitionId: d.kitDefinitionId!, count: 1 }]
        : (structuredClone(d.placementCost) as ItemAmount[]);
      workTicks = d.placementTicks;
    }
  }
  const selectedTool = tool(game, tag, actorId),
    source = sourceId === null ? game.player.inventory.items : containerItems(game, sourceId);
  if (!continuing) amountsEnough(game, source, inputs, batches);
  const after = afterEscrow(source, inputs, batches),
    outputBase = sourceId === null ? after : game.player.inventory.items;
  // Reserve a standalone fallback for each material stack, even when it can merge.
  const output = outputSlots(game, [], outputs, batches);
  const refund = inputs.length ? outputSlots(game, [], inputs, batches) : 0;
  if (!continuing) {
    if (
      destinationId === null &&
      game.player.inventory.capacity <
        outputBase.reduce(
          (n, i) =>
            n +
            (i.category === ItemCategory.MATERIAL ||
            i.category === ItemCategory.WEAPON ||
            i.category === ItemCategory.GEM
              ? 1
              : i.quantity),
          0
        ) +
          output +
          (sourceId === null ? refund : 0) +
          reservedInventorySlots(game)
    )
      reject('C5_CAPACITY');
    if (destinationId !== null) {
      const c = game.world5!.containers.find((c) => c.id === destinationId)!;
      if (
        containerRead(game, c.id).occupiedSlots + output + reservedContainerSlots(game, c.id) >
        c.capacity
      )
        reject('C5_CAPACITY');
    }
    if (amountStacks(game, inputs, batches).length > 64) reject('C5_CAPACITY');
    checkItemBudget(
      game,
      amountStacks(game, outputs, batches).length + amountStacks(game, inputs, batches).length
    );
  }
  const risks: readonly 'tool-break'[] =
    selectedTool.id !== null && selectedTool.durability <= selectedTool.cost * batches
      ? ['tool-break']
      : [];
  const plan = {
    owner,
    actorId,
    request: structuredClone(request),
    inputs,
    outputs,
    workTicks,
    sourceId,
    destinationId,
    toolId: selectedTool.id,
    toolCost: selectedTool.cost,
    outputSlots: output,
    refundSlots: refund,
    risks,
    canonical: ''
  };
  const { canonical: _canonical, ...mechanics } = plan;
  plan.canonical = c5Canonical({ ...mechanics, casKeys }, true);
  return plan;
}
function issue(game: Game, plan: Plan): WorldPlanHandle {
  const handle = deepFreeze({
    contract: 'C5-1',
    sessionId: String(game.worldWorkCommandEpoch),
    owner: plan.owner,
    actorId: plan.actorId,
    operation: plan.request.kind,
    casKeys: casFor(plan)
  }) as unknown as WorldPlanHandle;
  handles.set(handle, { game, plan, used: false, epoch: game.worldWorkCommandEpoch });
  return handle;
}
function casFor(p: Plan): WorldPlanHandle['casKeys'] {
  const r = p.request;
  if (r.kind === 'cancel-work')
    return [{ kind: 'ticket', ticketId: r.ticketId, revision: r.ticketRevision }];
  const keys: MutableWorld<WorldPlanHandle['casKeys']> = [
    { kind: 'inventory', actorId: p.actorId, stamp: r.inventoryStamp }
  ];
  if (r.kind === 'harvest') {
    keys.push({ kind: 'node', interactableId: r.nodeId, revision: r.nodeRevision });
    if (r.destinationId !== null)
      keys.push({
        kind: 'container',
        containerId: r.destinationId,
        revision: r.destinationRevision!
      });
  }
  if (r.kind === 'craft') {
    if (r.stationId !== null)
      keys.push({ kind: 'station', interactableId: r.stationId, revision: r.stationRevision! });
    if (r.sourceContainerId !== null)
      keys.push({
        kind: 'container',
        containerId: r.sourceContainerId,
        revision: r.sourceRevision!
      });
  }
  return keys;
}
export function prepareWorldWorkCommand(
  game: Game,
  data: unknown
): {
  outcome: WorldResult<WorldPlanHandle>;
  canonical: string | null;
  risks: readonly 'tool-break'[];
} {
  let active = true;
  let owner = '';
  try {
    const e = commandEnvelope(data);
    owner = e.module;
    const command = game.extensionRuntime?.worldWorkCommand(owner, e.action);
    if (!command) reject('C5_DISABLED');
    const attempt = (request: Request): WorldResult<WorldPlanHandle> => {
      if (!active) return { ok: false, code: 'C5_SCOPE', field: null };
      try {
        return { ok: true, value: issue(game, preparePlan(game, owner, game.player.id, request)) };
      } catch (error) {
        return {
          ok: false,
          code: error instanceof World5Error ? error.code : 'C5_PROVIDER',
          field: error instanceof World5Error ? error.field : null
        };
      }
    };
    const sdk: WorldWorkPrepareSDK = {
      owner,
      actorId: game.player.id,
      readWorkContext: (q) =>
        active
          ? readWorkContext(game, owner, q, true)
          : { ok: false, code: 'C5_SCOPE', field: null },
      planTimedWork: (r) => attempt(r),
      planStationPlacement: (r) => attempt({ kind: 'place-station', ...r }),
      planCancelWork: (r) => attempt({ kind: 'cancel-work', ...r })
    };
    Object.freeze(sdk);
    const outcome = command.prepare(deepFreeze(structuredClone(e.payload)), sdk);
    if (outcome && typeof (outcome as any).then === 'function') {
      void Promise.resolve(outcome).catch(() => undefined);
      reject('C5_PROVIDER');
    }
    if (!outcome || typeof outcome.ok !== 'boolean') reject('C5_PROVIDER');
    if (!outcome.ok) {
      if (
        !validErrors.has(outcome.code) ||
        (outcome.field !== undefined && outcome.field !== null && typeof outcome.field !== 'string')
      )
        reject('C5_PROVIDER');
      return { outcome, canonical: null, risks: [] };
    }
    const row = handles.get(outcome.value);
    if (!row || row.game !== game || row.plan.owner !== owner) reject('C5_SCOPE');
    if (row.plan.request.kind !== e.action) reject('C5_BAD_PAYLOAD');
    return { outcome, canonical: row.plan.canonical, risks: row.plan.risks };
  } catch (error) {
    return {
      outcome: {
        ok: false,
        code: error instanceof World5Error ? error.code : 'C5_PROVIDER',
        field: error instanceof World5Error ? error.field : null
      },
      canonical: null,
      risks: []
    };
  } finally {
    active = false;
  }
}
const transactions = new WeakSet<Game>();
export function transactWorldWork<T>(game: Game, work: () => T): T {
  if (transactions.has(game)) return work();
  const restore = game.checkpointWorldWork();
  transactions.add(game);
  try {
    return game.extensionRuntime!.worldWorkTransaction(work);
  } catch (error) {
    restore();
    throw error;
  } finally {
    transactions.delete(game);
    markRecordingRoot(game.world5!);
  }
}
function escrowInputs(game: Game, plan: Plan, batches: number, ticketId: number): number | null {
  if (!plan.inputs.length) return null;
  const w = game.world5!,
    id = allocateWorldId(game),
    source =
      plan.sourceId === null ? game.player.inventory.items : containerItems(game, plan.sourceId),
    ids: number[] = [];
  for (const row of plan.inputs) {
    let remaining = row.count * batches;
    for (const item of [...source]) {
      if (item.worldItem?.definitionId !== row.itemDefinitionId || !remaining) continue;
      const count = Math.min(remaining, item.quantity);
      let detached: Item;
      if (count === item.quantity) {
        detached = item;
        if (plan.sourceId === null) game.player.inventory.removeItem(item);
        else {
          const c = w.containers.find((c) => c.id === plan.sourceId)!;
          c.itemIds.splice(c.itemIds.indexOf(item.id), 1);
          c.revision = checkedAdd(c.revision, 1);
        }
      } else {
        checkItemBudget(game, 1);
        detached = assembleWorldItem(itemDefinition(game, row.itemDefinitionId), count);
        detached.inventoryLetter = item.inventoryLetter;
        item.quantity -= count;
        if (plan.sourceId !== null) {
          const c = w.containers.find((c) => c.id === plan.sourceId)!;
          c.revision = checkedAdd(c.revision, 1);
        }
      }
      ids.push(detached.id);
      game.worldContainerItems!.set(detached.id, detached);
      remaining -= count;
    }
    if (remaining) reject('C5_INPUT');
  }
  w.containers.push({
    id,
    owner: plan.owner,
    kind: 'escrow',
    levelRef: { kind: 'dungeon', depth: game.depth },
    position: null,
    capacity: 64,
    itemIds: ids,
    revision: 0,
    ticketId
  });
  return id;
}
export function commitWorldWork(
  game: Game,
  handle: WorldPlanHandle,
  scope: WorldActorScope
): WorldResult<WorldCommit> {
  const entry = handles.get(handle),
    authority = scopes.get(scope);
  if (
    !authority ||
    !authority.active ||
    authority.game !== game ||
    authority.owner !== handle.owner ||
    authority.actorId !== handle.actorId
  )
    return { ok: false, code: 'C5_SCOPE', field: null };
  if (!entry || entry.game !== game || entry.epoch !== game.worldWorkCommandEpoch)
    return { ok: false, code: 'C5_STALE', field: null };
  if (entry.used) return { ok: false, code: 'C5_PLAN_USED', field: null };
  entry.used = true;
  return result(() => {
    const plan = preparePlan(game, entry.plan.owner, entry.plan.actorId, entry.plan.request);
    if (plan.canonical !== entry.plan.canonical) reject('C5_STALE');
    return transactWorldWork(game, () => {
      const request = plan.request;
      if (request.kind === 'cancel-work') {
        cancelWorldWork(game, request.ticketId, 'cancelled');
        return {
          operation: request.kind,
          receiptIdentity: `cancel.${request.ticketId}`,
          ticketId: request.ticketId,
          chargedTicks: 0
        };
      }
      const w = game.world5!,
        batches = request.kind === 'craft' ? request.batchCount : 1,
        ticketId = allocateWorldId(game),
        inputEscrowId = escrowInputs(game, plan, batches, ticketId);
      w.nextPlanId = checkedAdd(w.nextPlanId, 1);
      if (request.kind === 'harvest') {
        const node = w.nodes.find((n) => n.interactableId === request.nodeId)!;
        Object.assign(node, materializedNode(game, node));
        node.reservedUnits = checkedAdd(
          node.reservedUnits,
          worldPack(game, plan.owner).resourceNodes.find((d) => d.id === node.definitionId)!
            .unitsPerHarvest
        );
        node.revision = checkedAdd(node.revision, 1);
      }
      const inventory = { kind: 'inventory' as const, actorId: plan.actorId },
        source =
          plan.sourceId === null
            ? inventory
            : { kind: 'container' as const, containerId: plan.sourceId };
      const counts = (amounts: ItemAmount[]) =>
        amounts.map((a) => ({ ...a, count: a.count * batches }));
      const ticket: MutableWorld<import('../../ext/worldSdk').WorkTicket> = {
        ticketId,
        owner: plan.owner,
        actorId: plan.actorId,
        levelRef: { kind: 'dungeon', depth: game.depth },
        kind: request.kind === 'place-station' ? 'station' : request.kind,
        nodeId: request.kind === 'harvest' ? request.nodeId : null,
        stationId: request.kind === 'craft' ? request.stationId : null,
        sourceContainerId: plan.sourceId,
        definitionId:
          request.kind === 'harvest'
            ? w.nodes.find((n) => n.interactableId === request.nodeId)!.definitionId
            : request.kind === 'craft'
              ? request.recipeId
              : request.definitionId,
        inputEscrowId,
        outputReservation: plan.outputs.length
          ? {
              destination:
                plan.destinationId === null
                  ? inventory
                  : { kind: 'container', containerId: plan.destinationId },
              slots: plan.outputSlots,
              mergeTargets: [],
              counts: counts(plan.outputs)
            }
          : null,
        refundReservation: plan.inputs.length
          ? {
              destination: source,
              slots: plan.refundSlots,
              mergeTargets: [],
              counts: counts(plan.inputs)
            }
          : null,
        resourceReservation:
          request.kind === 'harvest'
            ? {
                nodeId: request.nodeId,
                units: worldPack(game, plan.owner).resourceNodes.find(
                  (d) =>
                    d.id === w.nodes.find((n) => n.interactableId === request.nodeId)!.definitionId
                )!.unitsPerHarvest
              }
            : null,
        totalBatches: batches,
        completedBatches: 0,
        remainingTicks: plan.workTicks,
        laborCreditTicks: 0,
        bundleActionId: null,
        revision: 0,
        status: 'working',
        stopReason: null,
        lastCompletionOrdinal: 0
      };
      w.tickets.push(ticket);
      game.worldWorkDetails!.push({
        ticketId,
        at: request.kind === 'place-station' ? request.at : null,
        anchor: { ...actor(game, plan.actorId)!.loc },
        hp: actor(game, plan.actorId)!.hp,
        toolId: plan.toolId,
        workTicks: plan.workTicks,
        interrupted: null
      });
      recordWorldFact(game, {
        owner: plan.owner,
        ticketId,
        completionOrdinal: 0,
        operation: request.kind === 'craft' ? 'craft-batch' : request.kind,
        definitionId: ticket.definitionId,
        actorId: plan.actorId,
        completedBatches: 0,
        result: 'accepted',
        reason: null,
        tick: w.simulationTicks
      });
      if (batches > 1 && plan.actorId === game.player.id) game.beginWorldAutoWork(ticketId);
      updateWorldReasons(game);
      if (plan.actorId === game.player.id) startWorldWorkBatch(game, ticketId);
      return {
        operation: request.kind,
        receiptIdentity: `accept.${ticketId}`,
        ticketId,
        chargedTicks: plan.actorId === game.player.id ? plan.workTicks : 0
      };
    });
  });
}
export function startWorldWorkBatch(game: Game, ticketId: number): void {
  const w = game.world5!,
    t = activeTicketById(game, ticketId)!,
    d = game.worldWorkDetails!.find((d) => d.ticketId === ticketId)!,
    a = actor(game, t.actorId);
  if (!a || t.status !== 'working' || t.bundleActionId !== null) reject('C5_BUSY');
  if (a.hp <= 0) reject('C5_DEAD');
  if (levelKey(t.levelRef) !== `dungeon.${game.depth}`) reject('C5_WRONG_LEVEL');
  if (threat(game, t.actorId)) reject('C5_THREAT');
  if (
    t.stationId !== null &&
    !queryStations(game, t.owner)
      .find((s) => s.interactableId === t.stationId)
      ?.workPositions.some((p) => p.x === a.x && p.y === a.y)
  )
    reject('C5_DISTANCE');
  if (d.toolId !== null) {
    const held =
        t.actorId === game.player.id
          ? game.player.inventory.items
          : ([(a as any).carriedItem].filter(Boolean) as Item[]),
      item = held.find((i) => i.id === d.toolId);
    if (
      !item ||
      !item.worldItem ||
      (item.worldItem.toolDurability ?? 0) <
        itemDefinition(game, item.worldItem.definitionId).tool!.durabilityPerBatch
    )
      reject('C5_TOOL');
  }
  if (t.nodeId !== null) {
    const n = w.nodes.find((n) => n.interactableId === t.nodeId),
      units = t.resourceReservation!.units;
    if (!n || n.reservedUnits < units || n.remaining < units) reject('C5_RESOURCE_EMPTY');
    if (distance(a.loc, n.at) > 1 || !hasInteractionLine(game.grid, a.loc, n.at))
      reject('C5_DISTANCE');
  }
  for (const id of [
    t.sourceContainerId,
    t.outputReservation?.destination.kind === 'container'
      ? t.outputReservation.destination.containerId
      : null
  ]) {
    if (id !== null) {
      const c = w.containers.find((c) => c.id === id);
      if (!c) reject('C5_UNKNOWN_TARGET');
      accessContainer(game, id, c.revision, t.actorId);
    }
  }
  const root = game.actorActions!,
    actionId = root.nextActionId;
  root.nextActionId = checkedAdd(actionId, 1);
  d.anchor = { ...a.loc };
  d.hp = a.hp;
  t.remainingTicks = d.workTicks;
  t.bundleActionId = actionId;
  productionActorActionScheduler(game)!.commitBundle(
    createActorActionBundle({
      owner: 'foundation',
      actionId,
      depth: game.depth,
      decisionOwnerId: a.id,
      timeChargeOwnerId: a.id,
      subactions: [
        {
          sourceEntityId: a.id,
          sourcePartId: game.spatialOf(a).partId ?? 'body',
          sourceFootprintVersion: sourceFootprintVersion(game.spatialOf(a)),
          phases: [{ kind: 'recovery', durationTicks: d.workTicks, segmentIndex: null }]
        }
      ]
    })
  );
  game.disturbed = false;
}
export function worldWorkClockFinished(
  game: Game,
  bundle: ReadonlyActorActionBundle,
  reason: 'completed' | 'source-invalid'
): void {
  const t = game.world5?.tickets.find((t) => t.bundleActionId === bundle.actionId);
  // Explicit retirement is already inside this ticket's cancellation transaction.
  // Its finish callback must not re-enter NPC settlement or publish a second fact.
  if (!t || isPublishingTicket(game, t.ticketId)) return;
  const d = game.worldWorkDetails!.find((d) => d.ticketId === t.ticketId)!;
  if (reason !== 'completed') d.interrupted ??= 'invalid';
  markRecordingRoot(game.world5!);
  t.bundleActionId = null;
  t.remainingTicks = 0;
  t.laborCreditTicks = bundle.elapsedActionTicks;
  if (t.actorId !== game.player.id) {
    const why = interruptReason(game, t, d);
    if (why) cancelWorldWork(game, t.ticketId, why);
    else
      try {
        completeBatch(game, t, d);
      } catch (error) {
        cancelFailedBatch(game, t.ticketId, error);
      }
  }
}
export function mirrorWorldWorkTicks(game: Game, delta: number): void {
  if (!game.world5) return;
  if (game.world5.tickets.length) markRecordingRoot(game.world5);
  for (const t of game.world5.tickets) {
    if (t.bundleActionId !== null) {
      const b = game.actorActions!.bundles.find((b) => b.actionId === t.bundleActionId);
      if (b) t.remainingTicks = b.subactions[0]!.phaseRemainingTicks;
    }
  }
  if (
    game.actorActions?.bundles.some(
      (b) => b.owner === 'foundation' && b.decisionOwnerId === game.player.id
    )
  )
    timeSystem.currentTick += delta;
}
export function interruptWorldWork(game: Game, actorId: number, reason: string): void {
  const t = activeTicket(game, actorId);
  if (t) {
    const d = game.worldWorkDetails?.find((d) => d.ticketId === t.ticketId);
    if (d) {
      d.interrupted ??= reason;
      markRecordingRoot(game.world5!);
    }
  }
}
function interruptReason(
  game: Game,
  t: MutableWorld<import('../../ext/worldSdk').WorkTicket>,
  d: WorldWorkDetail
): string | null {
  const a = actor(game, t.actorId);
  if (!a || a.hp <= 0 || game.isGameOver) return 'dead';
  if (d.interrupted) return d.interrupted;
  if (levelKey(t.levelRef) !== `dungeon.${game.depth}`) return 'level-exit';
  if (a.x !== d.anchor.x || a.y !== d.anchor.y) return 'moved';
  if (a.hp < d.hp) return 'damage';
  if (
    (a as any).seized ||
    ['paralyzed', 'entranced', 'confused', 'stuck', 'nauseous'].some((status) =>
      a.hasStatus(status as 'paralyzed')
    ) ||
    (a.spatial?.actionLockInTicks ?? 0) > 0
  )
    return 'incapacitated';
  if (threat(game, t.actorId)) return 'threat';
  if (
    (t.nodeId !== null && !game.world5!.nodes.some((n) => n.interactableId === t.nodeId)) ||
    (t.stationId !== null && !game.world5!.stations.some((s) => s.interactableId === t.stationId))
  )
    return 'target-removed';
  return null;
}
/** Read the same interruption predicates before the generic disturbance flag
 * cancels an auto_work command, preserving the specific mechanical source. */
export function worldWorkInterruptionReason(game: Game): string | null {
  const ticket = activeTicket(game, game.player.id);
  const detail = ticket && game.worldWorkDetails?.find((d) => d.ticketId === ticket.ticketId);
  return ticket && detail ? interruptReason(game, ticket, detail) : null;
}
function consumeEscrow(
  game: Game,
  t: MutableWorld<import('../../ext/worldSdk').WorkTicket>,
  amounts: readonly ItemAmount[]
): void {
  if (t.inputEscrowId === null) return;
  const c = game.world5!.containers.find((c) => c.id === t.inputEscrowId)!;
  for (const row of amounts) {
    let rest = row.count;
    for (const id of [...c.itemIds]) {
      const i = game.worldContainerItems!.get(id)!;
      if (i.worldItem?.definitionId !== row.itemDefinitionId) continue;
      const n = Math.min(i.quantity, rest);
      i.quantity -= n;
      rest -= n;
      if (!i.quantity) {
        c.itemIds.splice(c.itemIds.indexOf(id), 1);
        game.worldContainerItems!.delete(id);
      }
      if (!rest) break;
    }
    if (rest) reject('C5_INPUT');
  }
  c.revision = checkedAdd(c.revision, 1);
}
function releaseTicket(game: Game, t: MutableWorld<import('../../ext/worldSdk').WorkTicket>): void {
  if (t.inputEscrowId !== null) {
    const index = game.world5!.containers.findIndex((c) => c.id === t.inputEscrowId);
    if (index >= 0) game.world5!.containers.splice(index, 1);
  }
  t.inputEscrowId = null;
  t.outputReservation = null;
  t.refundReservation = null;
  t.resourceReservation = null;
  markRecordingRoot(game.world5!);
  t.bundleActionId = null;
  t.remainingTicks = 0;
  t.laborCreditTicks = 0;
  game.worldWorkDetails = game.worldWorkDetails!.filter((d) => d.ticketId !== t.ticketId);
  game.clearWorldAutoWork(t.ticketId);
  const w = game.world5!,
    index = w.tickets.indexOf(t);
  if (index >= 0) w.tickets.splice(index, 1);
  w.terminalTickets.push({
    ticketId: t.ticketId,
    owner: t.owner,
    actorId: t.actorId,
    kind: t.kind,
    definitionId: t.definitionId,
    totalBatches: t.totalBatches,
    completedBatches: t.completedBatches,
    status: t.status as 'completed' | 'cancelled',
    stopReason: t.stopReason,
    lastCompletionOrdinal: t.lastCompletionOrdinal
  });
  w.terminalTickets.splice(0, Math.max(0, w.terminalTickets.length - 64));
  updateWorldReasons(game);
}
export function cancelWorldWork(
  game: Game,
  ticketId: number,
  reason: string,
  participant = true
): void {
  const t = activeTicketById(game, ticketId);
  if (!t || t.status === 'cancelled' || t.status === 'completed') return;
  transactWorldWork(game, () =>
    withPublishingTicket(game, ticketId, () => {
      if (t.bundleActionId !== null)
        productionActorActionScheduler(game)!.retireBundle(t.bundleActionId);
      if (t.inputEscrowId !== null) {
        const c = game.world5!.containers.find((c) => c.id === t.inputEscrowId)!;
        for (const id of [...c.itemIds]) {
          const item = game.worldContainerItems!.get(id)!;
          if (t.sourceContainerId === null) putInventory(game, item);
          else putContainer(game, t.sourceContainerId, item);
          c.itemIds.splice(c.itemIds.indexOf(id), 1);
          if (t.sourceContainerId === null) game.worldContainerItems!.delete(id);
        }
      }
      if (t.resourceReservation) {
        const node = game.world5!.nodes.find(
          (n) => n.interactableId === t.resourceReservation!.nodeId
        )!;
        node.reservedUnits -= t.resourceReservation.units;
        node.revision = checkedAdd(node.revision, 1);
      }
      t.status = 'cancelled';
      t.stopReason = reason;
      t.revision = checkedAdd(t.revision, 1);
      t.lastCompletionOrdinal = checkedAdd(t.lastCompletionOrdinal, 1);
      recordWorldReceipt(game, t.owner, 'work', `cancel.${t.ticketId}`, 'interrupted', reason);
      recordWorldFact(
        game,
        {
          owner: t.owner,
          ticketId: t.ticketId,
          completionOrdinal: t.lastCompletionOrdinal,
          operation: 'cancel',
          definitionId: t.definitionId,
          actorId: t.actorId,
          completedBatches: t.completedBatches,
          result: 'interrupted',
          reason,
          tick: game.world5!.simulationTicks
        },
        participant
      );
      releaseTicket(game, t);
      worldMessage(game, t.definitionId, 'interrupted');
    })
  );
}
export function worldMessage(
  game: Game,
  id: string,
  kind: 'completed' | 'interrupted' | 'startup'
): void {
  const d = game
    .extensionRuntime!.worldDefinitionPacks()
    .flatMap((p) => [...p.items, ...p.resourceNodes, ...p.stations, ...p.recipes])
    .find((d) => d.id === id);
  if (!d) return;
  const disturbed = game.disturbed;
  logger.log(
    i18next.t(`ext.foundation.world.message.${kind}`, { name: i18next.t(d.nameKey) }),
    '#bbbbbb'
  );
  game.disturbed = disturbed;
}
function completeBatch(
  game: Game,
  t: MutableWorld<import('../../ext/worldSdk').WorkTicket>,
  d: WorldWorkDetail
): void {
  transactWorldWork(game, () =>
    withPublishingTicket(game, t.ticketId, () => {
      const pack = worldPack(game, t.owner);
      let inputs: readonly ItemAmount[] = [],
        outputs: readonly ItemAmount[] = [];
      if (t.kind === 'craft') {
        const r = pack.recipes.find((r) => r.id === t.definitionId)!;
        inputs = r.inputs;
        outputs = r.outputs;
      } else if (t.kind === 'harvest') {
        const n = game.world5!.nodes.find((n) => n.interactableId === t.nodeId)!;
        const units = t.resourceReservation!.units;
        n.remaining -= units;
        n.reservedUnits -= units;
        n.revision = checkedAdd(n.revision, 1);
        outputs = pack.resourceNodes.find((r) => r.id === t.definitionId)!.yield;
        t.resourceReservation = null;
      } else if (t.kind === 'station') {
        const station = pack.stations.find((s) => s.id === t.definitionId)!;
        if (!d.at || !clearWorldCell(game, d.at)) reject('C5_BLOCKED');
        checkInteractableBudget(game);
        const entity = game.extensionRuntime!.worldWorkPlace({
          owner: t.owner,
          depth: game.depth,
          x: d.at.x,
          y: d.at.y,
          instanceKey: `${station.id}.station.${t.ticketId}`,
          contentId: station.id,
          nameKey: station.nameKey,
          descriptionKey: station.descriptionKey,
          glyph: station.glyph,
          color: station.color,
          interactionDistance: station.interactionDistance,
          priority: 0
        });
        game.world5!.stations.push({
          interactableId: entity.id,
          owner: t.owner,
          definitionId: station.id,
          levelRef: t.levelRef,
          boundComponentId: null,
          revision: 0
        });
        inputs = t.refundReservation!.counts;
      }
      consumeEscrow(game, t, inputs);
      createOutputs(
        game,
        outputs,
        t.outputReservation?.destination.kind === 'container'
          ? t.outputReservation.destination.containerId
          : null,
        true
      );
      if (d.toolId !== null) {
        const item =
          game.player.inventory.items.find((i) => i.id === d.toolId) ??
          (actor(game, t.actorId) as any)?.carriedItem;
        if (!item?.worldItem) reject('C5_TOOL');
        item.worldItem.toolDurability -= itemDefinition(
          game,
          item.worldItem.definitionId
        ).tool!.durabilityPerBatch;
      }
      t.completedBatches++;
      t.lastCompletionOrdinal = checkedAdd(t.lastCompletionOrdinal, 1);
      t.revision = checkedAdd(t.revision, 1);
      t.laborCreditTicks = 0;
      recordWorldReceipt(
        game,
        t.owner,
        'work',
        `work.${t.ticketId}.${t.completedBatches}`,
        'completed',
        null
      );
      recordWorldFact(game, {
        owner: t.owner,
        ticketId: t.ticketId,
        completionOrdinal: t.lastCompletionOrdinal,
        operation:
          t.kind === 'craft' ? 'craft-batch' : t.kind === 'harvest' ? 'harvest' : 'place-station',
        definitionId: t.definitionId,
        actorId: t.actorId,
        completedBatches: t.completedBatches,
        result: 'completed',
        reason: null,
        tick: game.world5!.simulationTicks
      });
      for (const reservation of [t.outputReservation, t.refundReservation])
        if (reservation) {
          const amounts = reservation === t.outputReservation ? outputs : inputs;
          for (const a of amounts) {
            const row = reservation.counts.find((r) => r.itemDefinitionId === a.itemDefinitionId);
            if (row) row.count -= a.count;
          }
          reservation.counts = reservation.counts.filter((r) => r.count > 0);
          reservation.slots = outputSlots(game, [], reservation.counts);
        }
      if (t.completedBatches === t.totalBatches) {
        t.status = 'completed';
        releaseTicket(game, t);
      } else {
        t.remainingTicks = d.workTicks;
        d.hp = actor(game, t.actorId)!.hp;
        updateWorldReasons(game);
      }
      worldMessage(game, t.definitionId, 'completed');
    })
  );
}
function cancelFailedBatch(game: Game, ticketId: number, error: unknown): void {
  const reason = error instanceof World5Error ? error.code.slice(3).toLowerCase() : 'transaction';
  try {
    cancelWorldWork(game, ticketId, reason, true);
  } catch (failure) {
    if (!(failure instanceof World5Error) || failure.code !== 'C5_PROVIDER') throw failure;
    cancelWorldWork(game, ticketId, reason, false);
  }
}
export function interruptWorldWorkAtDepth(game: Game): void {
  const ids = new Set(game.world5?.tickets.map((t) => t.ticketId));
  for (const d of game.worldWorkDetails ?? [])
    if (ids.has(d.ticketId)) d.interrupted ??= 'level-exit';
  settleWorldWork(game, false);
}
export function settleWorldWork(game: Game, allowCompletion = true): void {
  if (!game.world5) return;
  for (const t of [...game.world5.tickets]) {
    if (t.status !== 'working') continue;
    const d = game.worldWorkDetails?.find((d) => d.ticketId === t.ticketId);
    if (!d) reject('C5_BAD_REFERENCE');
    const reason = interruptReason(game, t, d);
    if (reason) {
      cancelWorldWork(game, t.ticketId, reason);
      continue;
    }
    if (t.bundleActionId === null && t.remainingTicks === 0 && allowCompletion) {
      try {
        completeBatch(game, t, d);
      } catch (error) {
        cancelFailedBatch(game, t.ticketId, error);
      }
    }
  }
}
export function continueWorldWork(game: Game, ticketId: number): boolean {
  try {
    transactWorldWork(game, () => startWorldWorkBatch(game, ticketId));
    return true;
  } catch (error) {
    cancelFailedBatch(game, ticketId, error);
    return false;
  }
}
export function selectWorldWorkDecision(
  game: Game,
  actorId: number,
  scope: ActorActionScope
): boolean {
  const t = activeTicket(game, actorId);
  if (!t || actorId === game.player.id || t.bundleActionId !== null) return false;
  assertNativeActorDecisionScope(scope, game, actorId);
  return withWorldActorScope(
    game,
    t.owner,
    actorId,
    'npc-decision',
    () => continueWorldWork(game, t.ticketId),
    scope
  );
}
export function previewWorldRecipe(
  game: Game,
  owner: string,
  id: string,
  batchCount: number,
  stationId: number | null,
  sourceContainerId: number | null
): WorldResult<RecipePreview> {
  return result(() => {
    const pack = worldPack(game, owner),
      r = pack.recipes.find((r) => r.id === id);
    if (!r) reject('C5_BAD_DEFINITION');
    const station = game.world5!.stations.find((s) => s.interactableId === stationId),
      source = game.world5!.containers.find((c) => c.id === sourceContainerId);
    let plan: Plan | undefined,
      reason: WorldErrorCode | null = null;
    try {
      plan = preparePlan(game, owner, game.player.id, {
        kind: 'craft',
        recipeId: id,
        batchCount,
        stationId,
        stationRevision: station?.revision ?? null,
        sourceContainerId,
        sourceRevision: source?.revision ?? null,
        inventoryStamp: inventoryStamp(game.player.inventory.items)
      });
    } catch (e) {
      reason = e instanceof World5Error ? e.code : 'C5_PROVIDER';
    }
    return {
      recipeId: id,
      batchCount,
      ok: !!plan,
      reason,
      inputs: r.inputs.map((a) => ({ ...a, count: a.count * batchCount })),
      outputs: r.outputs.map((a) => ({ ...a, count: a.count * batchCount })),
      totalTicks: r.workTicks * batchCount,
      outputSlots: plan?.outputSlots ?? 0,
      refundSlots: plan?.refundSlots ?? 0,
      stationTags: r.stationTags,
      toolTag: r.toolTag
    } satisfies RecipePreview;
  });
}
/** Test/trusted-world adapter. A real NPC starts its batch at the next native decision. */
export function prepareTrustedWorldWork(
  game: Game,
  owner: string,
  actorId: number,
  request: TimedWorkRequest
): WorldResult<WorldPlanHandle> {
  if (!import.meta.env.DEV || !game.extensionRuntime?.isWorldWorkFixture(owner))
    return { ok: false, code: 'C5_SCOPE', field: null };
  try {
    return { ok: true, value: issue(game, preparePlan(game, owner, actorId, request)) };
  } catch (e) {
    return { ok: false, code: e instanceof World5Error ? e.code : 'C5_PROVIDER', field: null };
  }
}
