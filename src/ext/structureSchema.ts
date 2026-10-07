/** JSON-only foundation codec validation, before live indexes are published. */
import type { World5Snapshot } from './world5';
import { exact, uint, requireDungeon, levelKey, World5Error } from './worldBasics';
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_REFERENCE', field);
};
export const STRUCTURE_SLOTS = ['floor', 'barrier', 'roof', 'fixture'] as const;
export function validateStructureRoots(w: World5Snapshot, owners: readonly string[]): void {
  if (
    !Array.isArray(w.structures) ||
    w.structures.length > 3072 ||
    !Array.isArray(w.restPoints) ||
    w.restPoints.length > 64
  )
    fail('structures/restPoints');
  if (w.campSlotOrdinals !== undefined) {
    if (!Array.isArray(w.campSlotOrdinals) || w.campSlotOrdinals.length !== 8)
      fail('campSlotOrdinals');
    w.campSlotOrdinals.forEach((n) => uint(n, 'campSlotOrdinals'));
  }
  const ids = new Set([
      ...w.containers.map((c) => c.id),
      ...w.orders.map((o) => o.id),
      ...w.tickets.map((t) => t.ticketId),
      ...w.terminalTickets.map((t) => t.ticketId)
    ]),
    cells = new Set<string>(),
    regions = new Map<number, number>();
  let previous = '';
  let count = 0;
  const identity = (row: { owner: string; levelRef: any }) => {
    if (
      !owners.includes(row.owner) ||
      !w.levels.some((l) => levelKey(l.levelRef) === levelKey(row.levelRef))
    )
      fail('structure.owner/level');
    requireDungeon(row.levelRef);
  };
  for (const row of w.structures) {
    exact(row, 'owner,regionId,levelRef,at,floor,barrier,roof,fixture', 'structure');
    identity(row);
    uint(row.regionId, 'regionId', 1);
    exact(row.at, 'x,y', 'at');
    uint(row.at.x, 'x');
    uint(row.at.y, 'y');
    if (row.at.x >= 79 || row.at.y >= 29) fail('structure.at');
    const key = `${requireDungeon(row.levelRef).toString().padStart(2, '0')}.${row.at.y.toString().padStart(2, '0')}.${row.at.x.toString().padStart(2, '0')}`;
    if (cells.has(key) || key <= previous) fail('structure.order');
    cells.add(key);
    previous = key;
    regions.set(row.regionId, (regions.get(row.regionId) ?? 0) + 1);
    if (regions.get(row.regionId)! > 384) fail('structure.regionBudget');
    let nonempty = false;
    for (const slot of STRUCTURE_SLOTS) {
      const c = row[slot];
      if (c === null) continue;
      nonempty = true;
      count++;
      exact(c, 'id,definitionId,hp,doorOpen,revision', 'component');
      uint(c.id, 'id', 1);
      uint(c.hp, 'hp', 1);
      uint(c.revision, 'revision');
      if (
        c.hp > 1000000 ||
        ids.has(c.id) ||
        c.id >= w.nextWorldId ||
        typeof c.definitionId !== 'string' ||
        !c.definitionId.startsWith(row.owner + '.') ||
        (c.doorOpen !== null && typeof c.doorOpen !== 'boolean')
      )
        fail('component');
      ids.add(c.id);
    }
    if (!nonempty) fail('emptyStructure');
  }
  if (count > 12288) fail('components.budget');
  const entities = new Set([
    ...w.nodes.map((n) => n.interactableId),
    ...w.stations.map((s) => s.interactableId),
    ...w.containers.flatMap((c) =>
      c.position?.kind === 'interactable' ? [c.position.interactableId] : []
    )
  ]);
  for (const r of w.restPoints) {
    exact(
      r,
      'interactableId,owner,definitionId,levelRef,boundComponentId,revision,lastUseOrdinal',
      'restPoint'
    );
    identity(r);
    uint(r.interactableId, 'restPoint.id', 1);
    uint(r.revision, 'revision');
    uint(r.lastUseOrdinal, 'lastUseOrdinal');
    if (
      entities.has(r.interactableId) ||
      typeof r.definitionId !== 'string' ||
      !r.definitionId.startsWith(r.owner + '.')
    )
      fail('restPoint');
    entities.add(r.interactableId);
    if (r.boundComponentId !== null && !ids.has(r.boundComponentId)) fail('restPoint.bound');
  }
}

export const FOUNDATION_STRUCTURE_RULES = {
  fireDamage: 'max(1,floor(maxHp*(100-fireResistance)/1000))',
  ignition: 'native.WOODEN_BARRICADE',
  foundationFailure:
    'environment-end-batch-delete;transaction-failure-retain-stable-foundation-and-receipt',
  surfacePropagation: 'movement-barrier-blocks-except-source',
  escapeDoors: 'player-resident-can-open;monster-blocked',
  excavation: 'native-shatter-tunnel-destroy-blocking-components',
  remains: 'reachable-known-outside-camp;upstairs-first;overflow-native-floor',
  roomNeighbors: 4,
  refund: 'floor(originalCount*hp/maxHp/2)'
} as const;
