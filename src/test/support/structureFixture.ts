import { createWorldHarness, worldHarnessGame } from '../../ext/testing/worldHarness';
import { descriptor } from '../../ext/testing/fixtures/structureBasic';
import { installRecordingScene } from './recordingV4';
import { TerrainType } from '../../engine/Map/Grid';
import { bindWorldStructures } from '../../engine/Map/StructureWorld';
import type { Game } from '../../engine/Core/Game';
export function structureScene(g: Game): void {
  if (!g.extensionRuntime?.isWorldStructureFixture('c5fixture')) return;
  for (let y = 1; y < g.grid.height - 1; y++)
    for (let x = 1; x < g.grid.width - 1; x++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
  for (let y = 1; y < g.grid.height - 1; y++) g.grid.setTerrain(35, y, TerrainType.WALL);
  g.grid.setTerrain(2, 2, TerrainType.STAIRS_UP);
  g.grid.setTerrain(g.grid.width - 3, g.grid.height - 3, TerrainType.STAIRS_DOWN);
  g.player.loc = { x: 20, y: 10 };
  g.player.hp = g.player.maxHp - 5;
  // The native actors stay alive with unchanged ownership, beyond known sight.
  g.monsters.forEach((m, i) => {
    m.loc = { x: 50 + (i % 20), y: 18 + (Math.floor(i / 20) % 5) };
    m.ticksUntilTurn = 100000;
  });
  g.dormantMonsters.forEach((m, i) => {
    m.loc = { x: 50 + (i % 20), y: 24 };
  });
  g.items.forEach((i, n) => (i.loc = { x: 40 + (n % 10), y: 20 }));
  let x = 4;
  for (const e of g.extensionRuntime.worldWorkEntities())
    if (e.depth === g.depth) {
      Object.assign(e, { x: x++, y: 4 });
      const n = g.world5!.nodes.find((n) => n.interactableId === e.id);
      if (n) n.at = { x: e.x, y: e.y };
    }
  for (let y = 0; y < g.grid.height; y++)
    for (let x = 0; x < g.grid.width; x++) {
      const c = g.grid.getCell(x, y)!;
      c.isVisible = Math.max(Math.abs(x - g.player.x), Math.abs(y - g.player.y)) <= 8;
      c.isExplored = true;
      c.hasMemory = true;
      c.machineNumber = 0;
    }
  g.grid.impregnableCells.clear();
  bindWorldStructures(g);
}
export function structureHarness(modules: string[] = []) {
  installRecordingScene(structureScene);
  const h = createWorldHarness(
    { seed: 51020001, mode: 'normal', modules, fixtures: ['world-work-basic'] },
    [descriptor]
  );
  return { h, g: worldHarnessGame(h) };
}
export function fixture(g: Game, action: string, payload: unknown): void {
  g.executeCommand(
    'ext:command',
    JSON.stringify({ module: 'c5fixture', action: `fixture-${action}`, payload })
  );
}
export const createCamp = (g: Game) => {
  fixture(g, 'region', {
    kind: 'create',
    instanceKey: 'camp',
    levelRef: { kind: 'dungeon', depth: g.depth },
    bounds: { x: 17, y: 7, width: 9, height: 9 }
  });
  return g.extensionRuntime!.worldStructureRegions().find((r) => r.campSlotId !== undefined)!;
};
export const build = (g: Game, name: string, at = { x: 21, y: 10 }) => {
  const r = g.extensionRuntime!.worldStructureRegions().find((r) => r.campSlotId !== undefined)!;
  fixture(g, 'structure', {
    kind: 'build',
    regionId: r.id,
    levelRef: { kind: 'dungeon', depth: g.depth },
    at,
    definitionId: `c5fixture.${name}`
  });
  return g.world5!.structures.find((s) => s.at.x === at.x && s.at.y === at.y);
};
