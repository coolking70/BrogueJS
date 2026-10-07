import type { Game } from '../Core/Game';
import { World5Error, requireDungeon, levelKey } from '../../ext/world5';
import { regionContains } from '../../ext/regions';
import { STRUCTURE_SLOTS } from '../../ext/structureSchema';
import { structureDefinition, restPointDefinition } from './StructureWorld';
import { isStableBaseFloor } from './CellProperties';
const fail = (field: string): never => {
  throw new World5Error('C5_BAD_REFERENCE', field);
};
export function validateStructureReferences(game: Game): void {
  const w = game.world5;
  if (!w) return;
  const runtime = game.extensionRuntime!,
    regions = runtime.worldStructureRegions(),
    entities = runtime.worldWorkEntities(),
    components = new Map<
      number,
      { row: (typeof w.structures)[number]; slot: (typeof STRUCTURE_SLOTS)[number] }
    >();
  for (const r of regions)
    if (r.campSlotId !== undefined && (!w.campSlotOrdinals || !w.campSlotOrdinals[r.campSlotId]))
      fail('campSlotOrdinals');
  for (const r of regions)
    if (
      r.campSlotId !== undefined &&
      w.containers.filter(
        (v) =>
          v.kind === 'chest' &&
          v.position?.kind === 'interactable' &&
          entities.some(
            (e) =>
              e.id === (v.position as { interactableId: number }).interactableId &&
              e.depth === r.depth &&
              regionContains(r, e)
          )
      ).length > 16
    )
      fail('camp.containerBudget');
  for (const row of w.structures) {
    const region = regions.find((r) => r.id === row.regionId),
      depth = requireDungeon(row.levelRef),
      grid = depth === game.depth ? game.grid : game.levels.get(depth)?.grid;
    if (
      !region ||
      region.campSlotId === undefined ||
      region.depth !== depth ||
      region.owner !== row.owner ||
      !regionContains(region, row.at) ||
      !grid?.getCell(row.at.x, row.at.y) ||
      !isStableBaseFloor(grid.getCell(row.at.x, row.at.y)!)
    )
      fail('structure.region/foundation');
    for (const slot of STRUCTURE_SLOTS) {
      const c = row[slot];
      if (!c) continue;
      const d = structureDefinition(game, c.definitionId);
      if (
        d.slot !== slot ||
        d.owner !== row.owner ||
        c.hp > d.maxHp ||
        (d.barrierKind === 'door' ? typeof c.doorOpen !== 'boolean' : c.doorOpen !== null)
      )
        fail('structure.component');
      components.set(c.id, { row, slot });
      const expected = d.containerCapacity !== null ? 1 : 0,
        chests = w.containers.filter(
          (ch) =>
            ch.position?.kind === 'interactable' &&
            entities.some(
              (e) =>
                e.id === (ch.position as any).interactableId &&
                e.contentId === d.id &&
                e.depth === depth &&
                e.x === row.at.x &&
                e.y === row.at.y
            )
        );
      if (chests.length !== expected || chests.some((ch) => ch.capacity !== d.containerCapacity))
        fail('structure.container');
      if (
        w.stations.filter((s) => s.boundComponentId === c.id).length !==
          (d.stationDefinitionId ? 1 : 0) ||
        w.restPoints.filter((s) => s.boundComponentId === c.id).length !==
          (d.restPointDefinitionId ? 1 : 0)
      )
        fail('structure.facility');
    }
  }
  for (const s of [...w.stations, ...w.restPoints]) {
    const e = entities.find((e) => e.id === s.interactableId);
    if (
      !e ||
      e.owner !== s.owner ||
      e.contentId !== s.definitionId ||
      e.depth !== requireDungeon(s.levelRef)
    )
      fail('facility.entity');
    if (s.boundComponentId !== null) {
      const c = components.get(s.boundComponentId);
      if (
        !c ||
        c.slot !== 'fixture' ||
        c.row.owner !== s.owner ||
        levelKey(c.row.levelRef) !== levelKey(s.levelRef) ||
        c.row.at.x !== e!.x ||
        c.row.at.y !== e!.y
      )
        fail('facility.geometry');
      const d = structureDefinition(game, c!.row.fixture!.definitionId);
      if (![d.stationDefinitionId, d.restPointDefinitionId].includes(s.definitionId))
        fail('facility.definition');
    }
  }
  for (const r of w.restPoints) {
    const d = restPointDefinition(game, r.definitionId);
    if (d.owner !== r.owner) fail('restPoint.owner');
  }
  const auto = (game as any).autoAction;
  if (auto?.kind === 'rest_point') {
    const r = w.restPoints.find((r) => r.interactableId === auto.restPointId);
    if (
      !r ||
      r.revision !== auto.revision ||
      r.lastUseOrdinal !== auto.ordinal ||
      auto.ordinal < 1 ||
      auto.remaining > restPointDefinition(game, r.definitionId).maxRestTicks / 100 ||
      w.receipts.some((v) => v.identity === `rest.${r.interactableId}.${auto.ordinal}`)
    )
      fail('autoRestPoint');
  }
}
