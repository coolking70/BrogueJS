/** Trusted production adapter. Content declares data and receives read-only DTOs. */
import type { Game } from './Game';
import type { CampState, CampRecord, StructureAction } from '../../ext/structureSdk';
import { STRUCTURE_ACTIONS } from '../../ext/structureSdk';
import type { WorldResult, WorldCommit, ItemAmount, WorldPlanHandle } from '../../ext/worldSdk';
import { exact as assertExact, uint, checkedAdd, World5Error } from '../../ext/worldBasics';
import { c5Canonical } from './WorldCanonical';
import { inventoryStamp } from './RecordingDigest';
import { withWorldActorScope, worldWorkLastError } from './WorldWork';
import {
  planRegionChange,
  planStructureChange,
  planPaidStructure,
  planRest,
  commitStructureWorld,
  transactStructureWorld,
  structureDefinition,
  computeRooms
} from '../Map/StructureWorld';
import {
  planMaterialTransfer,
  commitMaterialTransfer,
  type MaterialTransferPlan
} from './WorldMaterialTransfer';
import {
  clearWorldCell,
  checkInteractableBudget,
  checkItemBudget,
  allocateWorldId,
  containerItems,
  containerRead,
  additionalItemSlots,
  reservedInventorySlots,
  putInventory,
  recordWorldReceipt,
  result,
  threat,
  updateWorldReasons,
  itemRead,
  distance,
  worldPack,
  materializedNode
} from './WorldWorkWorld';
import { composedCellFlags } from '../Map/CellProperties';
import {
  T_HARMFUL_TERRAIN,
  T_IS_DF_TRAP,
  T_ENTANGLES,
  T_SPONTANEOUSLY_IGNITES,
  T_CAUSES_NAUSEA
} from '../Map/TerrainCatalog';
import { Item, ItemCategory } from '../Items/Item';
import { serializeItem } from './EntitySnapshot';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { offlineSeedKey } from './WorldSettlement';
import { regionContains } from '../../ext/regions';
import { deepFreeze } from '../Movement/SpatialSchema';
import { timeSystem } from '../Systems/Time';
import { logger } from '../Systems/Logger';
import i18next from 'i18next';
function fail(
  code: import('../../ext/worldSdk').WorldErrorCode,
  field: string | null = null
): never {
  throw new World5Error(code, field);
}
const exact = (v: unknown, keys: string, field: string): void => assertExact(v, keys, field);
type Input = { module: string; action: StructureAction; payload: any };
interface Prepared {
  game: Game;
  epoch: number;
  input: Input;
  stamp: string;
  handle?: WorldPlanHandle;
  transfer?: MaterialTransferPlan;
  materials?: ItemAmount[];
  used: boolean;
}
const plans = new WeakMap<object, Prepared>();
function envelope(data: unknown): Input {
  const v = typeof data === 'string' ? JSON.parse(data) : data;
  c5Canonical(v);
  exact(v, 'module,action,payload', 'command');
  return v as unknown as Input;
}
export function isStructureCommand(game: Game, data: unknown): boolean {
  try {
    const v = typeof data === 'string' ? JSON.parse(data) : data;
    return (
      !!v &&
      !!game.extensionRuntime?.worldCampPolicy(v.module) &&
      (STRUCTURE_ACTIONS as readonly string[]).includes(v.action)
    );
  } catch {
    return false;
  }
}
const payloadKeys: Record<StructureAction, string> = {
  establish:
    'v,stateRevision,inventoryStamp,x,y,bounds,food,sourceContainerId,sourceRevision,materials',
  expand:
    'v,stateRevision,inventoryStamp,regionId,regionRevision,bounds,sourceContainerId,sourceRevision,materials',
  retire: 'v,stateRevision,inventoryStamp,regionId,regionRevision',
  build:
    'v,stateRevision,inventoryStamp,regionId,regionRevision,definitionId,x,y,sourceContainerId,sourceRevision,materials',
  dismantle: 'v,stateRevision,inventoryStamp,componentId,componentRevision',
  door: 'v,stateRevision,inventoryStamp,componentId,componentRevision,open',
  transfer: 'v,stateRevision,containerId,containerRevision,inventoryStamp,direction,items',
  rest: 'v,stateRevision,restPointId,restPointRevision'
};
function available(game: Game) {
  if (!game.world5) fail('C5_DISABLED');
  if (game.isGameOver || game.player.hp <= 0) fail('C5_DEAD');
  if (
    (['paralyzed', 'slumber'] as const).some((k) => game.player.hasStatus(k)) ||
    game.interactionActive ||
    game.actorActions?.bundles.some((b) => b.decisionOwnerId === game.player.id) ||
    game.world5!.tickets.some((t) => t.actorId === game.player.id && t.status === 'working')
  )
    fail('C5_BUSY');
}
function camp(game: Game, owner: string, id: number) {
  const c = game.extensionRuntime!.worldCampState(owner).camps.find((c) => c.regionId === id);
  if (!c) fail('C5_UNKNOWN_TARGET');
  if (c!.depth !== game.depth) fail('C5_WRONG_LEVEL');
  return c!;
}
function region(game: Game, id: number, revision: number) {
  uint(id, 'regionId', 1);
  uint(revision, 'regionRevision');
  const r = game.extensionRuntime!.worldStructureRegions().find((r) => r.id === id);
  if (!r) fail('C5_UNKNOWN_TARGET');
  if (r!.revision !== revision) fail('C5_STALE');
  return r!;
}
function near(game: Game, at: { x: number; y: number }) {
  if (!game.grid.getCell(at.x, at.y)?.isVisible) fail('C5_BLOCKED');
  if (distance(game.player.loc, at) > 1 || !hasInteractionLine(game.grid, game.player.loc, at))
    fail('C5_DISTANCE');
}
function source(game: Game, p: any): Item[] {
  if (p.sourceContainerId === null) {
    if (p.sourceRevision !== null) fail('C5_BAD_PAYLOAD');
    return game.player.inventory.items;
  }
  uint(p.sourceContainerId, 'sourceContainerId', 1);
  uint(p.sourceRevision, 'sourceRevision');
  const c = game.world5!.containers.find((c) => c.id === p.sourceContainerId && c.kind === 'chest');
  if (!c) fail('C5_UNKNOWN_TARGET');
  if (c!.revision !== p.sourceRevision) fail('C5_STALE');
  if (c!.levelRef.kind !== 'dungeon' || c!.levelRef.depth !== game.depth) fail('C5_WRONG_LEVEL');
  const read = containerRead(game, c!.id);
  if (!read.at) fail('C5_UNKNOWN_TARGET');
  near(game, read.at!);
  return containerItems(game, c!.id);
}
/** Selection names actual definition IDs; no automatic cross-package conflation or global scan. */
function bill(
  game: Game,
  _owner: string,
  p: any,
  expected: readonly ItemAmount[],
  kitTag?: string
): ItemAmount[] {
  const items = source(game, p);
  if (!Array.isArray(p.materials) || !p.materials.length || p.materials.length > 8)
    fail('C5_BAD_PAYLOAD');
  const definitions = game.extensionRuntime!.worldDefinitionPacks().flatMap((p) => p.items),
    seen = new Set<string>();
  const rows = p.materials as ItemAmount[];
  for (const a of rows) {
    exact(a, 'itemDefinitionId,count', 'materials');
    uint(a.count, 'count', 1);
    if (a.count > 99 || seen.has(a.itemDefinitionId)) fail('C5_BAD_PAYLOAD');
    seen.add(a.itemDefinitionId);
  }
  const kit =
    rows.length === 1 &&
    rows[0]!.count === 1 &&
    kitTag &&
    definitions.find((d) => d.id === rows[0]!.itemDefinitionId)?.tags.includes(kitTag);
  if (!kit) {
    if (rows.length !== expected.length) fail('C5_INPUT');
    for (let i = 0; i < expected.length; i++) {
      const native = definitions.find((d) => d.id === expected[i]!.itemDefinitionId)!,
        selected = definitions.find((d) => d.id === rows[i]!.itemDefinitionId);
      if (
        !selected ||
        selected.category !== 'material' ||
        rows[i]!.count !== expected[i]!.count ||
        !native.tags.some((t) => t.startsWith('basic.') && selected.tags.includes(t))
      )
        fail('C5_INPUT');
    }
  }
  for (const a of rows)
    if (
      items
        .filter((i) => i.worldItem?.definitionId === a.itemDefinitionId)
        .reduce((n, i) => n + i.quantity, 0) < a.count
    )
      fail('C5_INPUT');
  return structuredClone(rows);
}
function foods(game: Game, p: any): void {
  if (!Array.isArray(p.food) || p.food.length < 1 || p.food.length > 2) fail('C5_BAD_PAYLOAD');
  let count = 0;
  const seen = new Set();
  for (const a of p.food) {
    exact(a, 'itemId,quantity', 'food');
    uint(a.itemId, 'itemId', 1);
    uint(a.quantity, 'quantity', 1);
    const i = game.player.inventory.items.find((i) => i.id === a.itemId);
    if (
      !i ||
      i.category !== ItemCategory.FOOD ||
      !['ration_of_food', 'mango'].includes(i.consumableId ?? i.identityId ?? '') ||
      a.quantity > i.quantity ||
      seen.has(i!.id)
    )
      fail('C5_INPUT');
    seen.add(i!.id);
    count += a.quantity;
  }
  if (count !== 2) fail('C5_INPUT');
  checkItemBudget(
    game,
    p.food.filter(
      (a: any) => game.player.inventory.items.find((i) => i.id === a.itemId)!.quantity > a.quantity
    ).length
  );
}
function takeBill(game: Game, p: any, rows: readonly ItemAmount[]) {
  const items = source(game, p);
  for (const a of rows) {
    let n = a.count;
    for (const i of [...items])
      if (i.worldItem?.definitionId === a.itemDefinitionId && n) {
        const k = Math.min(n, i.quantity);
        n -= k;
        i.quantity -= k;
        if (!i.quantity) {
          if (p.sourceContainerId === null) game.player.inventory.removeItem(i);
          else {
            const c = game.world5!.containers.find((c) => c.id === p.sourceContainerId)!;
            c.itemIds.splice(c.itemIds.indexOf(i.id), 1);
            game.worldContainerItems!.delete(i.id);
          }
        }
      }
    if (n) fail('C5_INPUT');
  }
  if (p.sourceContainerId !== null) {
    const c = game.world5!.containers.find((c) => c.id === p.sourceContainerId)!;
    c.revision = checkedAdd(c.revision, 1);
  }
}
export function lockedFoodQuantity(game: Game, itemId: number): number {
  return game.extensionRuntime?.worldCampLockedQuantity(itemId) ?? 0;
}
function validate(
  game: Game,
  input: Input
): Omit<Prepared, 'used' | 'epoch' | 'input' | 'stamp' | 'game'> {
  available(game);
  const runtime = game.extensionRuntime!,
    p = input.payload,
    owner = input.module,
    policy = runtime.worldCampPolicy(owner);
  if (!policy || !STRUCTURE_ACTIONS.includes(input.action)) fail('C5_BAD_PAYLOAD');
  exact(p, payloadKeys[input.action], 'payload');
  if (p.v !== 1) fail('C5_BAD_PAYLOAD');
  uint(p.stateRevision, 'stateRevision');
  if (p.stateRevision !== runtime.worldCampState(owner).revision) fail('C5_STALE');
  if (input.action !== 'rest' && inventoryStamp(game.player.inventory.items) !== p.inventoryStamp)
    fail('C5_STALE');
  const planned = withWorldActorScope(game, owner, game.player.id, 'player-command', (scope) => {
    switch (input.action) {
      case 'establish': {
        uint(p.x, 'x');
        uint(p.y, 'y');
        near(game, p);
        const markerCell = game.grid.getCell(p.x, p.y)!;
        if (!(markerCell.isExplored || markerCell.hasMemory)) fail('C5_BLOCKED');
        if (threat(game)) fail('C5_THREAT');
        if (
          !clearWorldCell(game, p) ||
          game.dormantMonsters.some((a) =>
            game.footprintOf(a).some((q) => q.x === p.x && q.y === p.y)
          )
        )
          fail('C5_PROTECTED');
        const materials = bill(game, owner, p, policy!.createCost);
        foods(game, p);
        checkInteractableBudget(game);
        if (game.world5!.containers.filter((c) => c.kind === 'chest').length >= 112)
          fail('C5_BUDGET');
        const b = p.bounds;
        exact(b, 'x,y,width,height', 'bounds');
        for (const n of Object.values(b)) uint(n, 'bounds');
        if (
          b.width !== 9 ||
          b.height !== 9 ||
          b.x < 1 ||
          b.y < 1 ||
          b.x + b.width >= game.grid.width ||
          b.y + b.height >= game.grid.height
        )
          fail('C5_BLOCKED');
        if (p.x < b.x || p.y < b.y || p.x >= b.x + b.width || p.y >= b.y + b.height)
          fail('C5_BLOCKED');
        const slot = Array.from({ length: 8 }, (_, i) => i).find(
          (i) => !runtime.worldStructureRegions().some((r) => r.campSlotId === i)
        );
        if (slot === undefined) fail('C5_BUDGET');
        const ordinal = checkedAdd(game.world5!.campSlotOrdinals?.[slot!] ?? 0, 1);
        return {
          materials,
          plan: planRegionChange(
            {
              kind: 'create',
              instanceKey: `${owner}.camp.${slot}.${ordinal}`,
              levelRef: { kind: 'dungeon', depth: game.depth },
              bounds: b
            },
            scope
          )
        };
      }
      case 'expand': {
        camp(game, owner, p.regionId);
        const r = region(game, p.regionId, p.regionRevision);
        if (!regionContains(r, game.player.loc)) fail('C5_DISTANCE');
        if (threat(game)) fail('C5_THREAT');
        const materials = bill(game, owner, p, policy!.expandCost);
        return {
          materials,
          plan: planRegionChange(
            { kind: 'expand', regionId: r.id, revision: r.revision, bounds: p.bounds },
            scope
          )
        };
      }
      case 'retire': {
        const c = camp(game, owner, p.regionId),
          r = region(game, c.regionId, p.regionRevision),
          e = runtime.worldWorkEntities().find((e) => e.id === c.markerId);
        if (!e) fail('C5_BAD_REFERENCE');
        near(game, e!);
        if (threat(game)) fail('C5_THREAT');
        if (
          game.world5!.structures.some((s) => s.regionId === r.id) ||
          game.world5!.residents.some((v) => v.campSlotId === c.slot) ||
          game.world5!.orders.some(
            (o) => o.levelRef.kind === 'dungeon' && o.levelRef.depth === c.depth
          )
        )
          fail('C5_RESERVED');
        const items = containerItems(game, c.supplyId);
        if (
          game.player.inventory.packCount() +
            reservedInventorySlots(game) +
            additionalItemSlots(game, game.player.inventory.items, items) >
          game.player.inventory.capacity
        )
          fail('C5_CAPACITY');
        return {};
      }
      case 'build': {
        camp(game, owner, p.regionId);
        const r = region(game, p.regionId, p.regionRevision);
        uint(p.x, 'x');
        uint(p.y, 'y');
        if (threat(game)) fail('C5_THREAT');
        const d = structureDefinition(game, p.definitionId);
        if (d.owner !== owner) fail('C5_BAD_OWNERSHIP');
        const kit = d.tags.includes('bed')
          ? 'kit.bed'
          : d.containerCapacity !== null
            ? 'kit.chest'
            : undefined;
        const cell = game.grid.getCell(p.x, p.y);
        if (!cell || !cell.isVisible) fail('C5_BLOCKED');
        if (
          composedCellFlags(cell) &
          (T_HARMFUL_TERRAIN |
            T_IS_DF_TRAP |
            T_ENTANGLES |
            T_SPONTANEOUSLY_IGNITES |
            T_CAUSES_NAUSEA)
        )
          fail('C5_PROTECTED');
        const materials = bill(game, owner, p, d.constructionCost, kit);
        return {
          materials,
          plan: planPaidStructure(
            {
              kind: 'build',
              regionId: r.id,
              levelRef: { kind: 'dungeon', depth: game.depth },
              at: { x: p.x, y: p.y },
              definitionId: d.id
            },
            materials,
            p.sourceContainerId,
            scope
          )
        };
      }
      case 'dismantle':
      case 'door': {
        uint(p.componentId, 'componentId', 1);
        uint(p.componentRevision, 'componentRevision');
        if (threat(game)) fail('C5_THREAT');
        return {
          plan: planStructureChange(
            input.action === 'door'
              ? {
                  kind: 'door',
                  componentId: p.componentId,
                  revision: p.componentRevision,
                  open: p.open
                }
              : { kind: 'dismantle', componentId: p.componentId, revision: p.componentRevision },
            scope
          )
        };
      }
      case 'rest':
        return {
          plan: planRest({ restPointId: p.restPointId, revision: p.restPointRevision }, scope)
        };
      case 'transfer': {
        const { v: _, stateRevision: __, ...request } = p;
        const box = game.world5!.containers.find((c) => c.id === p.containerId);
        if (!box || box.owner !== owner) fail('C5_BAD_OWNERSHIP');
        const t = planMaterialTransfer(game, request);
        if (!t.ok) fail(t.code);
        return { transfer: t.value };
      }
    }
  });
  if ('plan' in planned) {
    if (!planned.plan!.ok) fail(planned.plan!.code);
    return { handle: planned.plan!.value, materials: planned.materials };
  }
  return planned;
}
export function prepareStructureCommand(game: Game, data: unknown): WorldResult<object> {
  try {
    const input = envelope(data),
      parts = validate(game, input),
      token = {};
    plans.set(token, {
      ...parts,
      game,
      epoch: game.worldWorkCommandEpoch,
      input: structuredClone(input),
      stamp: c5Canonical([
        input,
        game.extensionRuntime!.worldCampState(input.module),
        game.world5!.revision,
        inventoryStamp(game.player.inventory.items)
      ]),
      used: false
    });
    return { ok: true, value: token };
  } catch (e) {
    return { ok: false, code: e instanceof World5Error ? e.code : 'C5_BAD_PAYLOAD', field: null };
  }
}
function report(game: Game, c: CampRecord) {
  const marker = game.extensionRuntime!.worldWorkEntities().find((e) => e.id === c.markerId);
  if (!marker || marker.depth !== game.depth || !game.grid.getCell(marker.x, marker.y)?.isVisible)
    return;
  c.reportTick = game.world5!.simulationTicks;
  c.reportItems = containerItems(game, c.supplyId).map((i) => ({
    itemId: i.id,
    quantity: i.quantity,
    name: i.displayName.slice(0, 256)
  }));
}
function history(state: CampState, c: CampRecord, tick: number, operation: string) {
  state.history.push({ regionId: c.regionId, slot: c.slot, ordinal: c.ordinal, tick, operation });
  state.history = state.history.slice(-128);
}
function installEmptyLedger(game: Game, owner: string, c: CampRecord) {
  const w = game.world5!,
    level = w.levels.find((l) => l.levelRef.kind === 'dungeon' && l.levelRef.depth === game.depth)!;
  level.policy = 'frozen-ecology-economy-v1';
  const fingerprint = game
    .extensionRuntime!.worldDefinitionFingerprints()
    [owner]!.replace(/^sha256:/, '');
  w.offline.push({
    levelRef: { kind: 'dungeon', depth: c.depth },
    campSlotId: c.slot as any,
    lastSettledTick: w.simulationTicks,
    epochRemainder: w.simulationTicks % 1000,
    revision: 0,
    seedKey: offlineSeedKey(
      game.currentSeed,
      c.slot as import('../../ext/world5').CampSlotId,
      'camp',
      fingerprint
    ),
    lastEventOrdinal: 0,
    residentStates: [],
    pendingOutputs: [],
    needsResupply: false,
    frozen: {
      capturedTick: w.simulationTicks,
      rulesFingerprint: fingerprint,
      structureRevision: 0,
      residents: [],
      facilities: [],
      knownThreats: []
    }
  });
}
export function commitStructureCommand(game: Game, token: object): WorldResult<WorldCommit> {
  return result(() => {
    const old = plans.get(token);
    if (!old || old.game !== game || old.epoch !== game.worldWorkCommandEpoch) fail('C5_SCOPE');
    if (old!.used) fail('C5_PLAN_USED');
    old!.used = true;
    const input = old!.input,
      p = input.payload,
      runtime = game.extensionRuntime!,
      owner = input.module,
      policy = runtime.worldCampPolicy(owner)!;
    const fresh = validate(game, input);
    if (
      old!.stamp !==
      c5Canonical([
        input,
        runtime.worldCampState(owner),
        game.world5!.revision,
        inventoryStamp(game.player.inventory.items)
      ])
    )
      fail('C5_STALE');
    return transactStructureWorld(game, () => {
      let state = runtime.worldCampState(owner),
        ticks = 0,
        identity = `camp.${owner}.${state.revision}.${game.world5!.revision}`;
      if (input.action === 'establish') {
        const before = new Set(runtime.worldStructureRegions().map((r) => r.id));
        const outcome = withWorldActorScope(
          game,
          owner,
          game.player.id,
          'player-command',
          (scope) => commitStructureWorld(game, fresh.handle!, scope)
        );
        if (!outcome.ok) fail(outcome.code);
        const r = runtime.worldStructureRegions().find((r) => !before.has(r.id))!;
        takeBill(game, p, fresh.materials!);
        const e = runtime.worldWorkPlace({
          owner,
          depth: game.depth,
          x: p.x,
          y: p.y,
          instanceKey: `${r.instanceKey}.supply`,
          contentId: policy.markerDefinitionId,
          nameKey: policy.nameKey,
          descriptionKey: policy.descriptionKey,
          glyph: policy.glyph,
          color: policy.color,
          interactionDistance: 1,
          priority: 0
        });
        const supplyId = allocateWorldId(game);
        game.world5!.containers.push({
          id: supplyId,
          owner,
          kind: 'chest',
          levelRef: { kind: 'dungeon', depth: game.depth },
          position: { kind: 'interactable', interactableId: e.id },
          capacity: policy.supplyCapacity,
          itemIds: [],
          revision: 0,
          ticketId: null
        });
        const c: CampRecord = {
          regionId: r.id,
          depth: game.depth,
          slot: r.campSlotId!,
          ordinal: game.world5!.campSlotOrdinals![r.campSlotId!]!,
          revision: 0,
          markerId: e.id,
          supplyId,
          locked: [],
          reportTick: game.world5!.simulationTicks,
          reportItems: []
        };
        // Keep distinct FOOD stacks in the supply pile. This preserves references and
        // allows extra food to merge into a locked stack without changing its ID.
        for (const a of p.food) {
          const item = game.player.inventory.items.find((i) => i.id === a.itemId)!;
          let moved = item;
          if (item.quantity > a.quantity) {
            const next = new Item(item.name, item.char, item.color, item.category);
            moved = Object.assign(next, serializeItem(item), { id: next.id, quantity: a.quantity });
            item.quantity -= a.quantity;
          } else game.player.inventory.removeItem(item);
          delete moved.fireContactCooldownUntilTurn;
          game.worldContainerItems!.set(moved.id, moved);
          game.world5!.containers.find((b) => b.id === supplyId)!.itemIds.push(moved.id);
          c.locked.push({ itemId: moved.id, quantity: a.quantity });
        }
        state.camps.push(c);
        installEmptyLedger(game, owner, c);
        report(game, c);
        history(state, c, game.world5!.simulationTicks, 'establish');
        ticks = policy.createTicks;
      } else if (input.action === 'retire') {
        const c = camp(game, owner, p.regionId);
        for (const i of [...containerItems(game, c.supplyId)]) {
          putInventory(game, i);
          game.worldContainerItems!.delete(i.id);
        }
        game.world5!.containers = game.world5!.containers.filter((b) => b.id !== c.supplyId);
        runtime.worldStructureRemoveInteractable(c.markerId);
        game.world5!.offline = game.world5!.offline.filter((l) => l.campSlotId !== c.slot);
        game.world5!.levels.find(
          (l) => l.levelRef.kind === 'dungeon' && l.levelRef.depth === c.depth
        )!.policy = 'native';
        const planned = withWorldActorScope(
          game,
          owner,
          game.player.id,
          'player-command',
          (scope) => {
            const plan = planRegionChange(
              { kind: 'retire', regionId: p.regionId, revision: p.regionRevision },
              scope
            );
            return plan.ok ? commitStructureWorld(game, plan.value, scope) : plan;
          }
        );
        if (!planned.ok) fail(planned.code);
        state.camps = state.camps.filter(
          (r) => r !== state.camps.find((r) => r.regionId === c.regionId)
        );
        history(state, c, game.world5!.simulationTicks, 'retire');
        ticks = policy.retireTicks;
      } else if (input.action === 'transfer') {
        const out = commitMaterialTransfer(game, fresh.transfer!);
        if (!out.ok) fail(out.code);
        ticks = out.value.chargedTicks;
      } else {
        const out = withWorldActorScope(game, owner, game.player.id, 'player-command', (scope) =>
          commitStructureWorld(game, fresh.handle!, scope)
        );
        if (!out.ok) fail(out.code);
        ticks = out.value.chargedTicks;
        // Destruction may have removed an actual-cost receipt inside the same transaction.
        state = runtime.worldCampState(owner);
        if (input.action === 'expand') {
          takeBill(game, p, fresh.materials!);
          const c = state.camps.find((c) => c.regionId === p.regionId)!;
          c.revision = checkedAdd(c.revision, 1);
          history(state, c, game.world5!.simulationTicks, 'expand');
          ticks = policy.expandTicks;
        }
        if (input.action === 'build') {
          const d = structureDefinition(game, p.definitionId),
            row = game.world5!.structures.find(
              (s) => s.regionId === p.regionId && s.at.x === p.x && s.at.y === p.y
            )!;
          state.constructions.push({ componentId: row[d.slot]!.id, materials: fresh.materials! });
        }
        if (input.action === 'door' || input.action === 'dismantle') ticks = policy.dismantleTicks;
      }
      state.revision = checkedAdd(state.revision, 1);
      for (const c of state.camps.filter((c) => c.depth === game.depth)) report(game, c);
      runtime.worldCampReplace(owner, state);
      updateWorldReasons(game);
      recordWorldReceipt(
        game,
        owner,
        input.action === 'transfer' ? 'transfer' : 'structure',
        identity,
        'completed',
        null
      );
      if (input.action !== 'rest')
        logger.log(i18next.t('ext.foundation.structure.completed'), '#c4b78e');
      game.requestEdibleRender();
      if (ticks > 0) {
        game.player.ticksUntilTurn = checkedAdd(game.player.ticksUntilTurn, ticks);
        timeSystem.currentTick = checkedAdd(timeSystem.currentTick, ticks);
      }
      return {
        operation: input.action,
        receiptIdentity: identity,
        ticketId: null,
        chargedTicks: ticks
      };
    });
  });
}
/** Last-known remote reports never read or settle cached world inventory. */
export function structureReadSDK(game: Game, owner: string) {
  return Object.freeze({
    read() {
      const runtime = game.extensionRuntime!,
        state = runtime.worldCampState(owner),
        w = game.world5!,
        policy = runtime.worldCampPolicy(owner)!;
      const regions = runtime.worldStructureRegions();
      const local = state.camps.find((c) => c.depth === game.depth);
      const boxes = w.containers
        .filter(
          (c) =>
            c.owner === owner &&
            c.kind !== 'escrow' &&
            c.levelRef.kind === 'dungeon' &&
            c.levelRef.depth === game.depth
        )
        .map((c) => containerRead(game, c.id))
        .filter((c) => c.at && game.grid.getCell(c.at.x, c.at.y)?.isVisible)
        .map((c) => ({
          ...c,
          items: containerItems(game, c.id).map((i) => ({
            ...itemRead(game, i),
            displayName: i.displayName,
            lockedQuantity: lockedFoodQuantity(game, i.id)
          }))
        }));
      const components = w.structures
        .filter(
          (r) =>
            r.owner === owner &&
            r.levelRef.kind === 'dungeon' &&
            r.levelRef.depth === game.depth &&
            game.grid.getCell(r.at.x, r.at.y)?.isVisible
        )
        .flatMap((r) =>
          (['floor', 'barrier', 'roof', 'fixture'] as const).flatMap((slot) =>
            r[slot]
              ? [
                  {
                    ...r[slot]!,
                    at: { ...r.at },
                    slot,
                    nameKey: structureDefinition(game, r[slot]!.definitionId).nameKey
                  }
                ]
              : []
          )
        );
      const knownRooms = local
        ? computeRooms(game, { kind: 'dungeon', depth: game.depth }).filter((r) =>
            r.cells.every((p) => game.grid.getCell(p.x, p.y)?.isVisible)
          )
        : [];
      return deepFreeze(
        structuredClone({
          v: 1,
          revision: state.revision,
          depth: game.depth,
          at: { ...game.player.loc },
          inventoryStamp: inventoryStamp(game.player.inventory.items),
          available:
            !game.isGameOver &&
            !game.replayRecording &&
            game.player.hp > 0 &&
            !(['paralyzed', 'slumber'] as const).some((k) => game.player.hasStatus(k)),
          inventory: game.player.inventory.items.map((i) => ({
            ...itemRead(game, i),
            displayName: i.displayName,
            food: i.category === ItemCategory.FOOD
          })),
          camps: state.camps.map((c) => ({
            ...c,
            bounds: { ...regions.find((r) => r.id === c.regionId)!.bounds },
            regionRevision: regions.find((r) => r.id === c.regionId)!.revision,
            remote: c.depth !== game.depth,
            ...(c.depth === game.depth && boxes.some((b) => b.id === c.supplyId)
              ? {
                  reportItems: containerItems(game, c.supplyId).map((i) => ({
                    itemId: i.id,
                    quantity: i.quantity,
                    name: i.displayName
                  })),
                  reportTick: w.simulationTicks
                }
              : {})
          })),
          boxes,
          components,
          rooms: knownRooms,
          restPoints: w.restPoints.filter(
            (r) =>
              r.owner === owner &&
              r.levelRef.kind === 'dungeon' &&
              r.levelRef.depth === game.depth &&
              runtime
                .worldWorkEntities()
                .some((e) => e.id === r.interactableId && game.grid.getCell(e.x, e.y)?.isVisible)
          ),
          definitions: worldPack(game, owner).structures,
          policy,
          nodes: w.nodes
            .filter(
              (n) =>
                n.owner === owner &&
                n.levelRef.kind === 'dungeon' &&
                n.levelRef.depth === game.depth &&
                game.grid.getCell(n.at.x, n.at.y)?.isVisible
            )
            .map((n) => ({
              ...materializedNode(game, n),
              nameKey: worldPack(game, owner).resourceNodes.find((d) => d.id === n.definitionId)!
                .nameKey
            })),
          lastError: worldWorkLastError(game)
        })
      );
    }
  });
}
export function validateProductionCampReferences(game: Game): void {
  const runtime = game.extensionRuntime;
  if (!runtime || !game.world5) return;
  for (const owner of runtime.worldCampOwners()) {
    const state = runtime.worldCampState(owner),
      regions = runtime
        .worldStructureRegions()
        .filter((r) => r.owner === owner && r.campSlotId !== undefined);
    if (regions.length !== state.camps.length) fail('C5_BAD_REFERENCE', 'camp.regions');
    for (const c of state.camps) {
      const r = regions.find((r) => r.id === c.regionId),
        box = game.world5.containers.find((b) => b.id === c.supplyId),
        e = runtime.worldWorkEntities().find((e) => e.id === c.markerId),
        ledger = game.world5.offline.find((l) => l.campSlotId === c.slot);
      if (
        !r ||
        r.depth !== c.depth ||
        r.campSlotId !== c.slot ||
        game.world5.campSlotOrdinals?.[c.slot] !== c.ordinal ||
        !e ||
        e.owner !== owner ||
        e.contentId !== runtime.worldCampPolicy(owner)!.markerDefinitionId ||
        e.depth !== c.depth ||
        !regionContains(r, e) ||
        !box ||
        box.owner !== owner ||
        box.kind !== 'chest' ||
        box.levelRef.kind !== 'dungeon' ||
        box.levelRef.depth !== c.depth ||
        box.position?.kind !== 'interactable' ||
        box.position.interactableId !== e.id ||
        box.capacity !== runtime.worldCampPolicy(owner)!.supplyCapacity ||
        !ledger ||
        ledger.levelRef.kind !== 'dungeon' ||
        ledger.levelRef.depth !== c.depth ||
        ledger.residentStates.length ||
        ledger.pendingOutputs.length ||
        ledger.frozen.rulesFingerprint !==
          runtime.worldDefinitionFingerprints()[owner]!.replace(/^sha256:/, '') ||
        c.reportTick > game.world5.simulationTicks
      )
        fail('C5_BAD_REFERENCE', 'camp.references');
      for (const lock of c.locked) {
        const i = game.worldContainerItems!.get(lock.itemId);
        if (
          !box!.itemIds.includes(lock.itemId) ||
          !i ||
          i.category !== ItemCategory.FOOD ||
          i.quantity < lock.quantity
        )
          fail('C5_BAD_REFERENCE', 'camp.lock');
      }
    }
    const ownedComponents = game.world5.structures
      .filter((s) => s.owner === owner)
      .flatMap((s) => [s.floor, s.barrier, s.roof, s.fixture])
      .filter((c) => c !== null);
    if (ownedComponents.length !== state.constructions.length)
      fail('C5_BAD_REFERENCE', 'camp.constructionCount');
    for (const r of state.constructions) {
      const component = ownedComponents.find((c) => c.id === r.componentId);
      if (!component) fail('C5_BAD_REFERENCE', 'camp.construction');
      const defs = runtime.worldDefinitionPacks().flatMap((p) => p.items),
        d = structureDefinition(game, component!.definitionId);
      const kitTag = d.tags.includes('bed')
        ? 'kit.bed'
        : d.containerCapacity !== null
          ? 'kit.chest'
          : null;
      const kit =
        kitTag &&
        r.materials.length === 1 &&
        r.materials[0]!.count === 1 &&
        defs.find((d) => d.id === r.materials[0]!.itemDefinitionId)?.tags.includes(kitTag);
      if (
        !kit &&
        (r.materials.length !== d.constructionCost.length ||
          r.materials.some((a, i) => {
            const selected = defs.find((d) => d.id === a.itemDefinitionId),
              original = defs.find((d) => d.id === dConstruction(i));
            return (
              !selected ||
              selected.category !== 'material' ||
              a.count !== d.constructionCost[i]!.count ||
              !original!.tags.some((t) => t.startsWith('basic.') && selected.tags.includes(t))
            );
          }))
      )
        fail('C5_BAD_REFERENCE', 'camp.bill');
      function dConstruction(i: number) {
        return d.constructionCost[i]!.itemDefinitionId;
      }
    }
  }
}
/** 5C1 has no residents or work orders. 5D must replace this empty-ledger policy
 * with its approved economic kernel; UI/load never invokes this boundary. */
export function freezeProductionCamps(game: Game, depth: number): void {
  const runtime = game.extensionRuntime;
  if (!runtime || !game.world5) return;
  for (const owner of runtime.worldCampOwners()) {
    const state = runtime.worldCampState(owner),
      c = state.camps.find((c) => c.depth === depth);
    if (!c) continue;
    report(game, c);
    runtime.worldCampReplace(owner, state);
    const ledger = game.world5.offline.find((l) => l.campSlotId === c.slot)!;
    ledger.lastSettledTick = game.world5.simulationTicks;
    ledger.epochRemainder = game.world5.simulationTicks % 1000;
    ledger.frozen.capturedTick = game.world5.simulationTicks;
    ledger.revision = checkedAdd(ledger.revision, 1);
  }
}
export function settleProductionCamps(game: Game): void {
  const runtime = game.extensionRuntime;
  if (!runtime || !game.world5 || game.isGameOver) return;
  for (const owner of runtime.worldCampOwners()) {
    const state = runtime.worldCampState(owner),
      c = state.camps.find((c) => c.depth === game.depth);
    if (!c) continue;
    const ledger = game.world5.offline.find((l) => l.campSlotId === c.slot)!;
    if (ledger.lastSettledTick > game.world5.simulationTicks) fail('C5_BAD_TIME');
    ledger.lastSettledTick = game.world5.simulationTicks;
    ledger.epochRemainder = game.world5.simulationTicks % 1000;
    ledger.frozen.capturedTick = game.world5.simulationTicks;
    ledger.revision = checkedAdd(ledger.revision, 1);
    report(game, c);
    runtime.worldCampReplace(owner, state);
  }
}
