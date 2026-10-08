import { ownsWorldWorkDefinitions } from './WorldWorkOwner';
import { edibleDefinition, edibleItemAdapter } from './KindKnowledge';
import { composedCellFlags } from '../Map/CellProperties';
import { markRecordingRoot } from '../../ext/recordingRevisions';
import { bodyDecisionActor } from '../Status/BodyStatuses';
import { monstersAreEnemies } from '../../entities/Monster';
import { generationReserved } from '../Generator/GenerationReservation';
import { previewWorldRecipe, worldWorkLastError } from './WorldWork';
/** Read DTOs, stable placement and inventory simulation. No module owns a Grid or Item. */
import type { Game } from './Game';
import type {
  ItemAmount,
  ItemDefinitionContribution,
  ItemRead,
  ContainerRead,
  StationRead,
  KnownWorkQuery,
  WorkContext,
  WorldResult,
  WorldWorkReadSDK,
  Position,
  ResourceDefinition
} from '../../ext/worldSdk';
import { World5Error, checkedAdd, levelKey, type MutableWorld } from '../../ext/world5';
import { deepFreeze } from '../Movement/SpatialSchema';
import { Item, ItemCategory } from '../Items/Item';
import { Inventory } from '../Items/Inventory';
import { assembleWorldItem, bindWorldItem } from '../Items/WorldItems';
import { inventoryStamp } from './RecordingDigest';
import { countWorldItemRoots } from './WorldItemRoots';
import { sha256 } from '../../ext/fingerprint';
import { c5Canonical } from './WorldCanonical';
import {
  T_OBSTRUCTS_PASSABILITY,
  T_OBSTRUCTS_ITEMS,
  T_AUTO_DESCENT,
  T_LAVA_INSTA_DEATH,
  T_IS_DEEP_WATER,
  T_IS_FIRE,
  T_CAUSES_DAMAGE,
  T_IS_DF_TRAP,
  T_CAUSES_PARALYSIS
} from '../Map/TerrainCatalog';
import { TerrainType } from '../Map/Grid';
import { playerTravelDiagonalBlocked } from '../Movement/PlayerTravel';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { canDirectlySeeMonster } from '../UI/MonsterVisibility';
import type { CommittedWorkFact } from '../../ext/worldSdk';
export function result<T>(work: () => T): WorldResult<T> {
  try {
    return deepFreeze({ ok: true as const, value: structuredClone(work()) }) as WorldResult<T>;
  } catch (error) {
    return deepFreeze({
      ok: false as const,
      code: error instanceof World5Error ? error.code : 'C5_PROVIDER',
      field: error instanceof World5Error ? error.field : null
    });
  }
}
export function worldPack(game: Game, owner: string) {
  const pack = game.extensionRuntime
    ?.worldDefinitionPacks()
    .find(
      (p) =>
        p.edibleItems?.some(d=>d.owner===owner) || p.actorNeeds?.some(d=>d.owner===owner) || p.items.some((d) => d.owner === owner) ||
        p.resourceNodes.some((d) => d.owner === owner) ||
        p.stations.some((d) => d.owner === owner) ||
        p.recipes.some((d) => d.owner === owner) || p.structures?.some(d=>d.owner===owner) || p.restPoints?.some(d=>d.owner===owner)
    );
  if (!game.world5 || !pack) throw new World5Error('C5_DISABLED');
  return pack;
}
export const itemDefinition = (game: Game, id: string): ItemDefinitionContribution => {
  const d = game.extensionRuntime
    ?.worldDefinitionPacks()
    .flatMap((p) => p.items)
    .find((d) => d.id === id);
  if(!d){const edible=edibleDefinition(game,id);if(edible)return edibleItemAdapter(game,edible);}
  if (!d) throw new World5Error('C5_BAD_DEFINITION', 'item');
  return d;
};
type LiveTicket = NonNullable<Game['world5']>['tickets'][number];
const indexes = new WeakMap<
  object,
  {
    tickets: LiveTicket[];
    length: number;
    nextId: number;
    ids: Map<number, LiveTicket>;
    actors: Map<number, LiveTicket>;
  }
>();
function activeIndex(game: Game) {
  const w = game.world5;
  if (!w) return null;
  let index = indexes.get(w);
  if (
    !index ||
    index.tickets !== w.tickets ||
    index.length !== w.tickets.length ||
    index.nextId !== w.nextWorldId
  ) {
    index = {
      tickets: w.tickets,
      length: w.tickets.length,
      nextId: w.nextWorldId,
      ids: new Map(w.tickets.map((t) => [t.ticketId, t])),
      actors: new Map(w.tickets.map((t) => [t.actorId, t]))
    };
    indexes.set(w, index);
  }
  return index;
}
export const activeTicket = (game: Game, actorId = game.player.id) =>
  activeIndex(game)?.actors.get(actorId) ?? null;
export const activeTicketById = (game: Game, ticketId: number) =>
  activeIndex(game)?.ids.get(ticketId) ?? null;
export const distance = (a: Position, b: Position) =>
  Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const unsafe =
  T_OBSTRUCTS_PASSABILITY |
  T_OBSTRUCTS_ITEMS |
  T_AUTO_DESCENT |
  T_LAVA_INSTA_DEATH |
  T_IS_DEEP_WATER |
  T_IS_FIRE |
  T_CAUSES_DAMAGE |
  T_IS_DF_TRAP |
  T_CAUSES_PARALYSIS;
export function stableGround(game: Game, at: Position): boolean {
  const cell = game.grid.getCell(at.x, at.y);
  return (
    !!cell &&
    !generationReserved(game.grid, at.x, at.y) &&
    !(composedCellFlags(cell) & unsafe) &&
    cell.machineNumber === 0 &&
    !game.grid.impregnableCells.has(at.y * game.grid.width + at.x) &&
    !cell.layers.some((layer) =>
      [
        TerrainType.SECRET_DOOR,
        TerrainType.LOCKED_DOOR,
        TerrainType.STAIRS_UP,
        TerrainType.STAIRS_DOWN
      ].includes(layer)
    )
  );
}
export function workPositions(game: Game, at: Position, interactionDistance = 1): Position[] {
  const rows: Position[] = [];
  for (let y = at.y - 1; y <= at.y + 1; y++)
    for (let x = at.x - 1; x <= at.x + 1; x++)
      if (
        (x !== at.x || y !== at.y) &&
        distance({ x, y }, at) <= interactionDistance &&
        stableGround(game, { x, y }) &&
        !playerTravelDiagonalBlocked(game.grid, at, { x, y }, false) &&
        hasInteractionLine(game.grid, { x, y }, at)
      )
        rows.push({ x, y });
  return rows;
}
export function clearWorldCell(game: Game, at: Position, ignoreEntityId?:number): boolean {
  return (
    stableGround(game, at) &&
    !game.extensionRuntime?.worldWorkPlacementProtected(at, game.depth) &&
    !game.items.some((i) => i.x === at.x && i.y === at.y) &&
    !game.monsters.some((m) => game.footprintOf(m).some((p) => p.x === at.x && p.y === at.y)) &&
    !(game.player.x === at.x && game.player.y === at.y) &&
    !game.extensionRuntime
      ?.worldWorkEntities()
      .some((e) => e.id!==ignoreEntityId&&e.depth === game.depth && e.x === at.x && e.y === at.y) &&
    workPositions(game, at).length > 0
  );
}
export function nearbyCells(game: Game): Position[] {
  const rows: Position[] = [];
  for (
    let y = Math.max(0, game.player.y - 4);
    y <= Math.min(game.grid.height - 1, game.player.y + 4);
    y++
  )
    for (
      let x = Math.max(0, game.player.x - 4);
      x <= Math.min(game.grid.width - 1, game.player.x + 4);
      x++
    )
      rows.push({ x, y });
  return rows.sort(
    (a, b) => distance(a, game.player.loc) - distance(b, game.player.loc) || a.y - b.y || a.x - b.x
  );
}
export function threat(game: Game, actorId = game.player.id): boolean {
  const actor =
    actorId === game.player.id ? game.player : game.monsters.find((m) => m.id === actorId);
  if (!actor) return true;
  return game.monsters.some(
    (m) =>
      m.id !== actorId &&
      m.hp > 0 &&
      monstersAreEnemies(m, actor) &&
      !m.isDormant &&
      !m.deathProcessed &&
      !bodyDecisionActor(m).isCaged &&
      canDirectlySeeMonster(game.player, game.grid, m)
  );
}
export function itemRead(game: Game, item: Item): ItemRead {
  const d = item.worldItem ? itemDefinition(game, item.worldItem.definitionId) : null;
  const names = [
    'weapon',
    'armor',
    'potion',
    'scroll',
    'food',
    'gold',
    'wand',
    'staff',
    'ring',
    'charm',
    'key',
    'amulet',
    'gem',
    null
  ] as const;
  return {
    id: item.id,
    category: d?.category ?? 'native',
    nativeCategory: d ? null : (names[item.category] ?? null),
    definitionId: d?.id ?? null,
    quantity: item.quantity,
    available: item.quantity,
    packSlots:
      item.category === ItemCategory.MATERIAL ||
      item.category === ItemCategory.WEAPON ||
      item.category === ItemCategory.GEM
        ? 1
        : item.quantity,
    tags: d?.tags ?? [],
    toolDurability: item.worldItem?.toolDurability ?? null
  };
}
export function containerItems(game: Game, id: number): Item[] {
  const c = game.world5?.containers.find((c) => c.id === id);
  if (!c) throw new World5Error('C5_UNKNOWN_TARGET');
  return c.itemIds.map((id) => {
    const i = game.worldContainerItems?.get(id);
    if (!i) throw new World5Error('C5_BAD_REFERENCE');
    return i;
  });
}
export function containerRead(game: Game, id: number): ContainerRead {
  const c = game.world5!.containers.find((c) => c.id === id)!;
  const e =
    c.position?.kind === 'interactable'
      ? game
          .extensionRuntime!.worldWorkEntities()
          .find((e) => e.id === (c.position as { interactableId: number }).interactableId)
      : null;
  return {
    id: c.id,
    levelRef: c.levelRef,
    at: e ? { x: e.x, y: e.y } : null,
    kind: c.kind,
    revision: c.revision,
    capacity: c.capacity,
    occupiedSlots: containerItems(game, id).reduce((n, i) => n + itemRead(game, i).packSlots, 0),
    reservedSlots: reservedContainerSlots(game, id),
    items: containerItems(game, id).map((i) => itemRead(game, i))
  };
}
const publishing = new WeakMap<Game, number>();
export function isPublishingTicket(game: Game, ticketId: number): boolean {
  return publishing.get(game) === ticketId;
}
export function withPublishingTicket<T>(game: Game, ticketId: number, work: () => T): T {
  const previous = publishing.get(game);
  publishing.set(game, ticketId);
  try {
    return work();
  } finally {
    if (previous === undefined) publishing.delete(game);
    else publishing.set(game, previous);
  }
}
export function reservedContainerSlots(game: Game, id: number): number {
  return (game.world5?.residentJobs??[]).reduce((n,j)=>n+(j.destinationId===id?j.reservedSlots:0)+(j.sourceId===id?j.reservedSlots:0),0)+(game.world5?.tickets ?? []).reduce(
    (n, t) =>
      n +
      (publishing.get(game) === t.ticketId
        ? 0
        : [t.outputReservation, t.refundReservation].reduce(
            (v, r) =>
              v +
              (r?.destination.kind === 'container' && r.destination.containerId === id
                ? r.slots
                : 0),
            0
          )),
    0
  );
}
export function reservedInventorySlots(game: Game): number {
  return (game.world5?.tickets ?? []).reduce(
    (n, t) =>
      n +
      (publishing.get(game) === t.ticketId
        ? 0
        : [t.outputReservation, t.refundReservation].reduce(
            (v, r) =>
              v +
              (r?.destination.kind === 'inventory' && r.destination.actorId === game.player.id
                ? r.slots
                : 0),
            0
          )),
    0
  );
}
export function queryStations(game: Game, owner: string): StationRead[] {
  const entities = game.extensionRuntime!.worldWorkEntities();
  return game
    .world5!.stations.filter(
      (s) =>
        levelKey(s.levelRef) === `dungeon.${game.depth}` &&
        (s.owner === owner ||
          !!game.grid.getCell(
            entities.find((e) => e.id === s.interactableId)!.x,
            entities.find((e) => e.id === s.interactableId)!.y
          )?.hasMemory)
    )
    .map((s) => {
      const e = entities.find((e) => e.id === s.interactableId)!,
        d = game
          .extensionRuntime!.worldDefinitionPacks()
          .flatMap((p) => p.stations)
          .find((d) => d.id === s.definitionId)!;
      return {
        interactableId: s.interactableId,
        definitionId: s.definitionId,
        levelRef: s.levelRef,
        at: { x: e.x, y: e.y },
        revision: s.revision,
        tags: d.stationTags,
        workPositions: workPositions(game, e, d.interactionDistance)
      };
    });
}
export function readWorkContext(
  game: Game,
  owner: string,
  query: KnownWorkQuery,
  virtual = false,
  actorId = game.player.id
): WorldResult<WorkContext> {
  return result(() => {
    worldPack(game, owner);
    let node = null;
    if (query.kind === 'node') {
      const n = game.world5!.nodes.find((n) => n.interactableId === query.interactableId);
      if (
        !n ||
        n.owner !== owner ||
        levelKey(n.levelRef) !== `dungeon.${game.depth}` ||
        !game.grid.getCell(n.at.x, n.at.y)?.hasMemory
      )
        throw new World5Error('C5_UNKNOWN_TARGET');
      node = virtual ? materializedNode(game, n) : n;
    } else if (query.kind === 'station') {
      if (!queryStations(game, owner).some((s) => s.interactableId === query.interactableId))
        throw new World5Error('C5_UNKNOWN_TARGET');
    } else if (query.kind !== 'inventory') throw new World5Error('C5_BAD_PAYLOAD');
    const actor =
      actorId === game.player.id ? game.player : game.monsters.find((m) => m.id === actorId);
    if (!actor) throw new World5Error('C5_UNKNOWN_TARGET');
    return {
      contract: 'C5-1' as const,
      owner,
      actorId,
      levelRef: { kind: 'dungeon' as const, depth: game.depth },
      at: { ...actor.loc },
      inventoryStamp: inventoryStamp(
        actorId === game.player.id
          ? game.player.inventory.items
          : [(actor as any).carriedItem].filter(Boolean)
      ),
      available:
        actor.hp > 0 &&
        !game.isGameOver &&
        !activeTicket(game, actorId) &&
        !game.actorActions?.bundles.some((b) => b.decisionOwnerId === actorId),
      node,
      stations: queryStations(game, owner),
      inventory: (actorId === game.player.id
        ? game.player.inventory.items
        : [(actor as any).carriedItem].filter(Boolean)
      ).map((i) => itemRead(game, i)),
      containers: game
        .world5!.containers.filter(
          (c) => c.kind === 'chest' && levelKey(c.levelRef) === `dungeon.${game.depth}`
        )
        .map((c) => {
          const read = containerRead(game, c.id);
          return { ...read, inReach: !!read.at && distance(actor.loc, read.at) <= 1
            && hasInteractionLine(game.grid, actor.loc, read.at) };
        })
        .filter((c) => c.at && game.grid.getCell(c.at.x, c.at.y)?.hasMemory),
      activeTicket: activeTicket(game, actorId)
    };
  });
}
export function materializedNode(
  game: Game,
  node: MutableWorld<import('../../ext/worldSdk').ResourceNodeRecord>
) {
  const next = structuredClone(node),
    d = game
      .extensionRuntime!.worldDefinitionPacks()
      .flatMap((p) => p.resourceNodes)
      .find((d) => d.id === node.definitionId)!;
  const elapsed = game.world5!.simulationTicks - node.lastSettledTick;
  if (elapsed < 0) throw new World5Error('C5_BAD_TIME');
  next.lastSettledTick = game.world5!.simulationTicks;
  if (d.regeneration.kind === 'periodic' && next.remaining < next.capacity) {
    const ticks = checkedAdd(elapsed, next.regenRemainder),
      units = Math.floor(ticks / d.regeneration.intervalTicks) * d.regeneration.units;
    if (!Number.isSafeInteger(units)) throw new World5Error('C5_OVERFLOW');
    next.remaining = Math.min(next.capacity, checkedAdd(next.remaining, units));
    next.regenRemainder =
      next.remaining === next.capacity ? 0 : ticks % d.regeneration.intervalTicks;
  } else next.regenRemainder = 0;
  return next;
}
export function placementDraw(
  seed: string,
  key: string,
  definitionId: string,
  ordinal: number,
  count: number
): { index: number; attempt: number; word: number } {
  if (!Number.isSafeInteger(count) || count < 1 || count > 0x100000000)
    throw new World5Error('C5_BAD_PAYLOAD');
  const limit = 0x100000000 - (0x100000000 % count);
  for (let attempt = 0; ; attempt++) {
    const word = parseInt(
      sha256(c5Canonical(['c5-place-v1', seed, key, definitionId, ordinal, attempt])).slice(0, 8),
      16
    );
    if (word < limit) return { index: word % count, attempt, word };
  }
}
export function placementCandidates(game: Game): Position[] {
  const visited = new Set<string>(),
    queue: Position[] = [{ ...game.player.loc }];
  for (let head = 0; head < queue.length; head++) {
    const from = queue[head]!;
    for (let y = from.y - 1; y <= from.y + 1; y++)
      for (let x = from.x - 1; x <= from.x + 1; x++) {
        const to = { x, y },
          k = `${x},${y}`;
        if (
          visited.has(k) ||
          !stableGround(game, to) ||
          playerTravelDiagonalBlocked(game.grid, from, to, false)
        )
          continue;
        visited.add(k);
        queue.push(to);
      }
  }
  return queue
    .filter((p, i) => i > 0 && clearWorldCell(game, p))
    .filter((p, i, rows) => rows.findIndex((q) => q.x === p.x && q.y === p.y) === i)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}
export function allocateWorldId(game: Game): number {
  const w = game.world5!,
    id = w.nextWorldId;
  w.nextWorldId = checkedAdd(id, 1);
  return id;
}
export function updateWorldReasons(game: Game): void {
  const w = game.world5!;
  for (const l of w.levels) {
    const key = levelKey(l.levelRef);
    l.persistenceReasons = [
      ...(w.offline.some((o) => levelKey(o.levelRef) === key) || game.extensionRuntime?.worldStructureRegions().some(r=>'campSlotId' in r && `dungeon.${r.depth}`===key) ? ['camp' as const] : []),
      ...(w.containers.some((c) => levelKey(c.levelRef) === key) ? ['container' as const] : []),
      ...(w.residents.some((r) => levelKey(r.levelRef) === key) ? ['resident' as const] : []),
      ...(w.residentJobs.some(j=>`dungeon.${j.depth}`===key) || w.orders.some((o) => levelKey(o.levelRef) === key) ||
      w.tickets.some(
        (t) => levelKey(t.levelRef) === key && ['working', 'suspended'].includes(t.status)
      )
        ? ['work' as const]
        : [])
    ];
  }
  w.revision = checkedAdd(w.revision, 1);
}
export function recordWorldFact(
  game: Game,
  fact: Omit<CommittedWorkFact, 'factId'>,
  participant = true
): void {
  const committed = game.extensionRuntime!.worldWorkFact(fact, participant);
  markRecordingRoot(game.world5!);
  game.worldWorkFacts!.push(committed);
  const owned = game.worldWorkFacts!.filter((f) => f.owner === fact.owner);
  const retire = new Set(owned.slice(0, Math.max(0, owned.length - 128)));
  game.worldWorkFacts = game.worldWorkFacts!.filter((f) => !retire.has(f));
}
export function recordWorldReceipt(
  game: Game,
  owner: string,
  kind: 'work' | 'startup' | 'placement' | 'transfer' | 'region' | 'structure' | 'rest',
  identity: string,
  result: 'completed' | 'interrupted' | 'skipped',
  reason: string | null
): void {
  const w = game.world5!;
  w.revision = checkedAdd(w.revision, 1);
  w.receipts.push({
    owner,
    kind,
    ordinal: checkedAdd(w.receipts[w.receipts.length - 1]?.ordinal ?? 0, 1),
    identity,
    levelRef: { kind: 'dungeon', depth: game.depth },
    tick: w.simulationTicks,
    result,
    reason
  });
  w.receipts.splice(0, Math.max(0, w.receipts.length - 128));
}
export function placeNode(
  game: Game,
  d: ResourceDefinition,
  at: Position,
  instanceKey: string
): void {
  const w = game.world5!;
  if (
    w.nodes.length >= 512 ||
    w.nodes.filter((n) => levelKey(n.levelRef) === `dungeon.${game.depth}`).length >= 32
  )
    throw new World5Error('C5_BUDGET');
  checkInteractableBudget(game);
  const entity = game.extensionRuntime!.worldWorkPlace({
    owner: d.owner,
    depth: game.depth,
    x: at.x,
    y: at.y,
    instanceKey,
    contentId: d.id,
    nameKey: d.nameKey,
    descriptionKey: d.descriptionKey,
    glyph: d.glyph,
    color: d.color,
    interactionDistance: 1,
    priority: 0
  });
  w.nodes.push({
    interactableId: entity.id,
    owner: d.owner,
    definitionId: d.id,
    instanceKey,
    levelRef: { kind: 'dungeon', depth: game.depth },
    at: { ...at },
    capacity: d.capacity,
    remaining: d.capacity,
    reservedUnits: 0,
    regenRemainder: 0,
    lastSettledTick: w.simulationTicks,
    revision: 0
  });
  updateWorldReasons(game);
}
export function checkInteractableBudget(game: Game, extra = 1): void {
  const w = game.world5!;
  if (
    w.nodes.length + w.stations.length + w.restPoints.length + w.containers.filter((c) => c.position).length + extra >
      832 ||
    game.extensionRuntime!.worldWorkEntities().length + extra > 1024
  )
    throw new World5Error('C5_BUDGET');
}
export function checkItemBudget(game: Game, extra: number): void {
  const reserved = (game.world5?.tickets ?? []).reduce(
    (n, t) => n + (t.outputReservation?.slots ?? 0),
    0
  );
  if (countWorldItemRoots(game) + reserved + extra > 7168 && extra > 0)
    throw new World5Error('C5_BUDGET');
}
export function previewItem(d: ItemDefinitionContribution, quantity: number): Item {
  const item = Object.assign(Object.create(Item.prototype), {
    id: -1,
    category:
      d.category === 'native'
        ? d.nativeTemplate === 'dagger'
          ? ItemCategory.WEAPON
          : d.nativeTemplate === 'leather_armor'
            ? ItemCategory.ARMOR
            : ItemCategory.FOOD
        : ItemCategory.MATERIAL,
    name: d.nameKey,
    quantity,
    loc: { x: -1, y: -1 },
    enchantment: 0
  });
  if (d.category === 'native') {
    if (d.nativeTemplate === 'ration_of_food') item.consumableId = d.nativeTemplate;
    else item.identityId = d.nativeTemplate;
  } else {
    item.worldItem = {
      definitionId: d.id,
      quality: 'basic',
      toolDurability: d.tool?.maxDurability ?? null
    };
    bindWorldItem(item, d);
  }
  return item;
}
export function amountStacks(game: Game, amounts: readonly ItemAmount[], factor = 1): Item[] {
  return amounts.flatMap((a) => {
    const d = itemDefinition(game, a.itemDefinitionId),
      count = a.count * factor;
    if (!Number.isSafeInteger(count)) throw new World5Error('C5_OVERFLOW');
    const rows: Item[] = [];
    for (let rest = count; rest > 0; rest -= d.maxStack)
      rows.push(previewItem(d, Math.min(rest, d.maxStack)));
    return rows;
  });
}
/** Native pack/stack simulation, with no constructors, IDs or random draws. */
export function additionalItemSlots(
  game: Game,
  items: readonly Item[],
  incoming: readonly Item[]
): number {
  const clone = (i: Item) => {
    const next = Object.assign(Object.create(Item.prototype), structuredClone(i));
    if (next.worldItem) bindWorldItem(next, itemDefinition(game, next.worldItem.definitionId));
    return next;
  };
  const inv = new Inventory();
  inv.capacity = Number.MAX_SAFE_INTEGER;
  inv.items = items.map(clone);
  const before = inv.packCount();
  for (const item of incoming) inv.addItem(clone(item));
  return inv.packCount() - before;
}
export function outputSlots(
  game: Game,
  items: readonly Item[],
  amounts: readonly ItemAmount[],
  factor = 1
): number {
  return additionalItemSlots(game, items, amountStacks(game, amounts, factor));
}

export function putInventory(game: Game, item: Item): void {
  if (!game.player.inventory.addItem(item)) throw new World5Error('C5_CAPACITY');
}
/** Uses native stack conflation while retiring a merged source ID in the same transaction. */
export function putContainer(game: Game, id: number, item: Item): void {
  const c = game.world5!.containers.find((c) => c.id === id)!;
  const existing = containerItems(game, id),
    inv = new Inventory();
  inv.items = existing;
  inv.capacity = Number.MAX_SAFE_INTEGER;
  const slots = additionalItemSlots(game, existing, [item]);
  if (containerRead(game, id).occupiedSlots + reservedContainerSlots(game, id) + slots > c.capacity)
    throw new World5Error('C5_CAPACITY');
  if (!inv.addItem(item)) throw new World5Error('C5_CAPACITY');
  if (inv.items.includes(item)) {
    c.itemIds.push(item.id);
    game.worldContainerItems!.set(item.id, item);
  } else game.worldContainerItems!.delete(item.id);
  c.revision = checkedAdd(c.revision, 1);
}
export function createOutputs(
  game: Game,
  amounts: readonly ItemAmount[],
  destinationId: number | null,
  reserved = false
): void {
  for (const fake of amountStacks(game, amounts)) {
    if (!reserved) checkItemBudget(game, 1);
    const item = assembleWorldItem(
      itemDefinition(
        game,
        fake.worldItem?.definitionId ??
          game
            .extensionRuntime!.worldDefinitionPacks()
            .flatMap((p) => p.items)
            .find((d) => d.nativeTemplate === (fake.consumableId ?? fake.identityId))!.id
      ),
      fake.quantity
    );
    if (destinationId === null) putInventory(game, item);
    else putContainer(game, destinationId, item);
  }
}

export function worldWorkReadSDK(game: Game, owner: string): WorldWorkReadSDK | undefined {
  if (
    !game.world5 ||
    !game.extensionRuntime
      ?.worldDefinitionPacks()
      .some((p) => ownsWorldWorkDefinitions(p, owner))
  )
    return;
  return deepFreeze({
    contractVersion: '1.0.0' as const,
    worldSdk: 1 as const,
    owner,
    lastCommandError: () => worldWorkLastError(game),
    readWorkContext: (query: KnownWorkQuery) => readWorkContext(game, owner, query),
    queryStations: () => result(() => queryStations(game, owner)),
    queryContainers: () =>
      result(() => {
        const c = readWorkContext(game, owner, { kind: 'inventory' });
        if (!c.ok) throw new World5Error(c.code, c.field);
        return c.value.containers;
      }),
    previewRecipe: (r: string, b: number, s: number | null, c: number | null) =>
      previewWorldRecipe(game, owner, r, b, s, c),
    recentFacts: (after: number) =>
      result(() => {
        if (!Number.isSafeInteger(after) || after < 0) throw new World5Error('C5_BAD_PAYLOAD');
        return game.worldWorkFacts!.filter((f) => f.owner === owner && f.factId > after);
      })
  });
}
