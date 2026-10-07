/** Controlled observations, never timing assertions. The same zero-structure
 * fixture is also run in the archived 5A2-S baseline. Raw samples stay in /tmp. */
import { it, expect, vi, afterEach } from 'vitest';
import { writeFileSync } from 'node:fs';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { FOVSys } from '../engine/Lighting/FOV';
import { DijkstraMap } from '../engine/Map/Pathfinding';
import { EnvironmentManager, GasType } from '../engine/Environment/Gas';
import { createHeadlessGame } from './harness';
import { installRecordingScene } from './support/recordingV4';
import type { Game } from '../engine/Core/Game';
import { allocateEntityId } from '../entities/Creature';
afterEach(() => vi.restoreAllMocks());
const summary = (samples: number[]) => {
  const a = [...samples].sort((a, b) => a - b);
  return {
    samples: samples.length,
    p50: a[Math.ceil(a.length * 0.5) - 1],
    p95: a[Math.ceil(a.length * 0.95) - 1]
  };
};
function measure(work: () => void, n = 80) {
  for (let i = 0; i < 12; i++) work();
  const times = [];
  for (let i = 0; i < n; i++) {
    const t = performance.now();
    work();
    times.push(performance.now() - t);
  }
  return summary(times);
}
function flatten(g: Game) {
  g.monsters = [];
  g.dormantMonsters = [];
  g.items = [];
  for (let y = 0; y < g.grid.height; y++)
    for (let x = 0; x < g.grid.width; x++) {
      g.grid.setTerrain(
        x,
        y,
        x && y && x < g.grid.width - 1 && y < g.grid.height - 1
          ? TerrainType.FLOOR
          : TerrainType.WALL
      );
      g.grid.getCell(x, y)!.machineNumber = 0;
    }
  g.grid.impregnableCells.clear();
  g.player.loc = { x: 10, y: 10 };
  g.player.maxHp = g.player.hp = 100000;
  g.player.nutrition = 3000;
  g.animationEnabled = false;
}
it.skipIf(process.env.C5_PERF !== '1')(
  'observes zero and 3072-cell/12288-component budget fixture',
  async () => {
    const baseline = process.env.C5_PERF_BASELINE === '1',
      rows: any[] = [];
    const grid = new Grid(79, 29);
    for (let y = 0; y < 29; y++)
      for (let x = 0; x < 79; x++)
        grid.setTerrain(x, y, x && y && x < 78 && y < 28 ? TerrainType.FLOOR : TerrainType.WALL);
    const fov = new FOVSys(grid),
      path = new DijkstraMap(79, 29),
      env = new EnvironmentManager(grid);
    env.addGas(25, 14, GasType.METHANE, 60000);
    rows.push({
      kind: 'zero',
      fov: measure(() => {
        fov.computeFOVMask(20, 14, 100, (c) => c.isOpaque);
      }),
      path: measure(() => {
        path.calculateMap(grid, 20, 14);
      }),
      gas: measure(() => {
        env.updateGases();
      })
    });
    installRecordingScene(flatten);
    const classic = createHeadlessGame(51020001, 'test');
    const commands = [];
    for (let i = 0; i < 2080; i++) {
      const t = performance.now();
      classic.executeCommand('wait');
      if (i >= 32) commands.push(performance.now() - t);
    }
    rows[0].recordingCommands = summary(commands);
    rows[0].events = classic.recordedInputEvents.length;
    expect(rows[0].events).toBe(2080);
    vi.restoreAllMocks();
    if (!baseline) {
      const supportPath = './support/structureFixture';
      const kernelPath = '../engine/Map/StructureWorld',
        schemaPath = '../ext/structureSchema',
        validationPath = '../engine/Map/StructureValidation';
      const { structureHarness } = await import(/* @vite-ignore */ supportPath),
        { bindWorldStructures, computeRooms, planStructureChange } = await import(
          /* @vite-ignore */ kernelPath
        ),
        { validateStructureRoots } = await import(/* @vite-ignore */ schemaPath),
        { validateStructureReferences } = await import(/* @vite-ignore */ validationPath);
      const { g } = structureHarness();
      rows[0].rooms = measure(() => {
        computeRooms(g, { kind: 'dungeon', depth: 1 });
      });
      const allGrids = [];
      g.world5!.campSlotOrdinals = Array(8).fill(1);
      const regions: import('../ext/regions').OwnedRegion[] = [];
      for (let depth = 1; depth <= 8; depth++) {
        const layer = depth === 1 ? g.grid : new Grid(79, 29);
        allGrids.push(layer);
        for (let y = 1; y < 28; y++)
          for (let x = 1; x < 78; x++) layer.setTerrain(x, y, TerrainType.FLOOR);
        if (depth > 1) {
          g.levels.set(depth, { grid: layer, items: [], monsters: [], dormantMonsters: [] } as any);
          g.world5!.levels.push({
            ...structuredClone(g.world5!.levels[0]!),
            levelRef: { kind: 'dungeon', depth }
          });
        }
        const region = {
          owner: 'c5fixture',
          id: allocateEntityId(),
          depth,
          revision: 0,
          campSlotId: (depth - 1) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7,
          instanceKey: `budget.${depth}`,
          bounds: { x: 17, y: 7, width: 24, height: 20 }
        };
        regions.push(region);
        for (let y = 7; y < 23; y++)
          for (let x = 17; x < 41; x++) {
            const part = (name: string, door = false) => ({
              id: g.world5!.nextWorldId++,
              definitionId: `c5fixture.${name}`,
              hp: 100,
              doorOpen: door ? true : null,
              revision: 0
            });
            g.world5!.structures.push({
              owner: 'c5fixture',
              regionId: region.id,
              levelRef: { kind: 'dungeon', depth },
              at: { x, y },
              floor: part('floor'),
              barrier: part('door', true),
              roof: part('roof'),
              fixture: part('fixture')
            });
          }
      }
      g.extensionRuntime!.worldStructureSetRegions(regions as any);
      bindWorldStructures(g);
      expect(g.world5!.structures).toHaveLength(3072);
      validateStructureRoots(g.world5!, ['c5fixture']);
      validateStructureReferences(g);
      const fov = new FOVSys(g.grid),
        path = new DijkstraMap(79, 29),
        env = new EnvironmentManager(g.grid);
      env.addGas(25, 14, GasType.METHANE, 60000);
      const full = {
        kind: 'full',
        cells: 3072,
        components: 12288,
        activeFloorCells: 384,
        fov: measure(() => {
          fov.computeFOVMask(20, 14, 100, (c) => c.isOpaque);
        }),
        path: measure(() => {
          path.calculateMap(g.grid, 20, 14);
        }),
        gas: measure(() => {
          env.updateGases();
        }),
        rooms: measure(() => {
          for (let depth = 1; depth <= 8; depth++) computeRooms(g, { kind: 'dungeon', depth });
        }, 30)
      };
      // All four slots in an existing cell are occupied; adding a 385th active
      // camp cell rejects before material/geometry writes, also at global cap.
      const scopePath = '../engine/Core/WorldWork';
      const { withWorldActorScope } = await import(/* @vite-ignore */ scopePath);
      withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (s: any) =>
        expect(
          planStructureChange(
            {
              kind: 'build',
              regionId: regions[0]!.id,
              levelRef: { kind: 'dungeon', depth: 1 },
              at: { x: 21, y: 23 },
              definitionId: 'c5fixture.floor'
            },
            s
          )
        ).toMatchObject({ ok: false, code: 'C5_BUDGET' })
      );
      rows.push(full);
    }
    writeFileSync(
      `/private/tmp/phase5a3-evidence/performance-${baseline ? 'baseline' : 'current'}.json`,
      JSON.stringify(
        { node: process.version, seed: 51020001, warmup: 12, recordingWarmup: 32, rows },
        null,
        2
      )
    );
  },
  120000
);
