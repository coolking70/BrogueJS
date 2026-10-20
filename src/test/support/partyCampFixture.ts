import { expect } from 'vitest';
import type { Game } from '../../engine/Core/Game';
import { inventoryStamp } from '../../engine/Core/RecordingDigest';
import { residentBedIds } from '../../engine/Core/ResidentWorld';
import { itemDefinition } from '../../engine/Core/WorldWorkWorld';
import { ItemCategory } from '../../engine/Items/Item';
import { assembleWorldItem } from '../../engine/Items/WorldItems';
import { TerrainType } from '../../engine/Map/Grid';
import { bindWorldStructures } from '../../engine/Map/StructureWorld';
import type { WorldHarness } from '../../ext/worldSdk';

// Diagnostic geometry and paid room construction adapted from settlement's
// tests/helpers.ts and tests/residentHelpers.ts. This foundation test support
// imports no removable module: callers must declare settlement as required and
// use an existing Game/harness. It does not establish a seed recording origin.
export function campScene(g: Game) {
  for (let y = 1; y < 28; y++)
    for (let x = 1; x < 78; x++) {
      g.grid.setTerrain(x, y, TerrainType.FLOOR);
      const c = g.grid.getCell(x, y)!;
      c.machineNumber = 0;
      c.hasMemory = c.isExplored = true;
      c.isVisible = Math.max(Math.abs(x - 20), Math.abs(y - 12)) <= 8;
    }
  for (let y = 1; y < 28; y++) g.grid.setTerrain(35, y, TerrainType.WALL);
  g.grid.impregnableCells.clear();
  g.grid.setTerrain(2, 2, TerrainType.STAIRS_UP);
  g.grid.setTerrain(30, 25, TerrainType.STAIRS_DOWN);
  (g as any).levelSeeds[g.depth - 1].upStairsLoc = { x: 2, y: 2 };
  (g as any).levelSeeds[g.depth - 1].downStairsLoc = { x: 30, y: 25 };
  g.player.loc = { x: 20, y: 12 };
  g.monsters.forEach((m, i) => {
    if (m.spatial?.movementRegionId === undefined) m.loc = { x: 60 + (i % 10), y: 20 };
    m.ticksUntilTurn = 100000;
  });
  g.dormantMonsters.forEach((m) => {
    if (m.spatial?.movementRegionId === undefined) m.loc = { x: 60, y: 22 };
  });
  g.items.forEach((i) => (i.loc = { x: 65, y: 24 }));
  for (const e of g.extensionRuntime!.worldWorkEntities().filter((e) => e.depth === g.depth)) {
    Object.assign(e, { x: 4 + (e.id % 6), y: 4 });
    const n = g.world5!.nodes.find((n) => n.interactableId === e.id);
    if (n) n.at = { x: e.x, y: e.y };
  }
  (g as any).updateVision(false);
  g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!.quantity = 4;
  for (const name of ['wood', 'stone', 'fiber']) {
    const i = g.player.inventory.items.find(
      (i) => i.worldItem?.definitionId === 'settlement.' + name
    );
    if (i) i.quantity = 99;
  }
}

function base(g: Game) {
  return {
    v: 1,
    stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    inventoryStamp: inventoryStamp(g.player.inventory.items)
  };
}

function payment(g: Game, cost: { itemDefinitionId: string; count: number }[]) {
  return { ...base(g), sourceContainerId: null, sourceRevision: null, materials: cost };
}

function establish(g: Game) {
  const food = g.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)!;
  return {
    ...payment(g, [
      { itemDefinitionId: 'settlement.wood', count: 4 },
      { itemDefinitionId: 'settlement.stone', count: 2 }
    ]),
    x: 21,
    y: 12,
    bounds: { x: 17, y: 8, width: 9, height: 9 },
    food: [{ itemId: food.id, quantity: 2 }]
  };
}

export const currentCamp = (g: Game) =>
  g.extensionRuntime!.worldCampState('settlement').camps[0]!;

function build(g: Game, name: string, at: { x: number; y: number }) {
  const c = currentCamp(g),
    r = g.extensionRuntime!.worldStructureRegions().find((r) => r.id === c.regionId)!,
    d = g.extensionRuntime!.worldDefinitionPacks()
      .find((p) => p.items[0]?.owner === 'settlement')!
      .structures!.find((d) => d.id === 'settlement.' + name)!;
  return {
    ...payment(g, d.constructionCost as any),
    regionId: r.id,
    regionRevision: r.revision,
    definitionId: d.id,
    ...at
  };
}

export function addCampMaterial(g: Game, id: string, count: number) {
  g.player.inventory.addItem(assembleWorldItem(itemDefinition(g, id), count));
}

// Every camp/structure is paid through the caller's public command adapter.
// Player placement is diagnostic setup, not a claim of a natural route.
export function bedroom(h: Pick<WorldHarness, 'ext'>, g: Game) {
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const home = g.extensionRuntime!.worldCampState('settlement').camps.find(c => c.depth === g.depth)!;
  const localBuild = (name: string, at: { x: number; y: number }) => {
    const payload = build(g, name, at),
      region = g.extensionRuntime!.worldStructureRegions().find(r => r.id === home.regionId)!;
    return { ...payload, regionId: region.id, regionRevision: region.revision };
  };
  for (let y = 12; y <= 16; y++) for (let x = 17; x <= 21; x++) {
    const edge = x === 17 || x === 21 || y === 12 || y === 16;
    // Room detection uses cardinal enclosure; corners need no fake marker roof.
    if (edge && (x === 17 || x === 21) && (y === 12 || y === 16)) continue;
    g.player.loc = edge ? y === 12 ? { x, y: 13 } : y === 16 ? { x, y: 15 }
      : x === 17 ? { x: 18, y } : { x: 20, y } : { x: x === 19 ? 18 : 19, y };
    g.refreshStructureDerivedState();
    expect(h.ext('settlement', 'build', localBuild(
      edge ? x === 19 && y === 12 ? 'door' : 'wood-wall' : 'roof', { x, y }
    )).error).toBeNull();
  }
  g.player.loc = { x: 19, y: 13 };
  expect(h.ext('settlement', 'build', localBuild('bed', { x: 18, y: 13 })).error).toBeNull();
  const door = g.world5!.structures.find(s => s.levelRef.kind === 'dungeon' &&
    s.levelRef.depth === g.depth && s.at.x === 19 && s.at.y === 12)!.barrier!;
  const state = g.extensionRuntime!.worldCampState('settlement');
  expect(h.ext('settlement', 'door', {
    v: 1, stateRevision: state.revision, inventoryStamp: base(g).inventoryStamp,
    componentId: door.id, componentRevision: door.revision, open: true
  }).error).toBeNull();
  bindWorldStructures(g);
  expect(residentBedIds(g, home)).toHaveLength(1);
}
