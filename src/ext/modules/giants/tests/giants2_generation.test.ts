import { afterEach, expect, it, vi } from 'vitest';
import { startGiants, walkNaturalToDepth, giantsState, json } from './naturalFixture';
import { LANTERN, COPPER } from './giants2MechanicsFixture';
import { footprintOf, CreatureSpatial } from '../../../../engine/Movement/CreatureSpatial';
import { MonsterState } from '../../../../entities/Monster';
import { readCreatureBirth } from '../../../birth';
import { TerrainType as T, Grid } from '../../../../engine/Map/Grid';
import { Architect } from '../../../../engine/Generator/Architect';
import { loadGiantsDefinitionPack } from '../definitions';
import { logger } from '../../../../engine/Systems/Logger';
afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
});
it.each([
  [1, []],
  [2, ['giants.lantern-chamber']],
  [4, ['giants.lantern-chamber']],
  [5, ['giants.copper-chamber']],
  [8, ['giants.copper-chamber']],
  [9, []]
] as [number, string[]][])('G2-GEN D%s exact new candidate boundaries', (depth, expected) => {
  const game = startGiants(['giants'], 1, 'wizard');
  expect(
    game
      .extensionRuntime!.generationContributions(depth)
      .filter((t) => t.formId === LANTERN || t.formId === COPPER)
      .map((t) => t.id)
  ).toEqual(expected);
});
it.each([
  { seed: 1, depth: 2, form: LANTERN, cells: 7 },
  { seed: 2, depth: 7, form: COPPER, cells: 8 }
])(
  'G2-GEN actual natural public-route seed $seed D$depth complete shape, region and bypass',
  ({ seed, depth, form, cells }) => {
    const game = startGiants(['giants'], seed, 'wizard');
    walkNaturalToDepth(game, depth, true);
    const boss = game.monsters.find((m) => m.typeId === form)!;
    expect(boss).toBeTruthy();
    expect(readCreatureBirth(boss)).toMatchObject({ creationReason: 'natural' });
    const entry = giantsState(game).placements.find(
      (p) =>
        p.depth === depth &&
        p.result === 'placed' &&
        p.templateId === (form === LANTERN ? 'giants.lantern-chamber' : 'giants.copper-chamber')
    )!;
    expect(entry).toBeTruthy();
    const region = game.extensionRuntime!.ownedRegion(entry.regionId!, depth)!;
    expect(region.guard).toBe('return-to-spawn');
    expect(region.bounds).toMatchObject({ width: 16, height: 12 });
    const actors =
      form === LANTERN
        ? [boss]
        : game.monsters.filter((m) => m.spatial?.bodyMember?.groupId === boss.id);
    expect(actors.flatMap((m) => footprintOf(m))).toHaveLength(cells);
    const b = region.bounds;
    for (const p of actors.flatMap((m) => footprintOf(m))) {
      expect(p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height).toBe(true);
      expect(game.grid.getCell(p.x, p.y)!.isPassable).toBe(true);
    }
    const service = new CreatureSpatial(
      {
        grid: game.grid,
        monsters: game.monsters,
        inRegion: (id, p) =>
          id === region.id &&
          p.x >= b.x &&
          p.y >= b.y &&
          p.x < b.x + b.width &&
          p.y < b.y + b.height
      },
      game.spatialCatalog
    );
    try {
      expect(service.canFitTerrainAt(boss, { x: b.x + b.width - 1, y: b.y + b.height - 1 })).toBe(
        false
      );
    } finally {
      service.dispose();
    }
    // Read-only reachability excludes every occupied boss cell; chamber remains optional.
    const key = (p: { x: number; y: number }) => p.y * game.grid.width + p.x;
    const blocked = new Set(actors.flatMap((m) => footprintOf(m)).map(key));
    const layer = game.levelSeeds[depth - 1]!,
      start = layer.upStairsLoc,
      target = layer.downStairsLoc,
      queue = [start],
      seen = new Set([key(start)]);
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ]) {
        const q = { x: p.x + dx!, y: p.y + dy! },
          c = game.grid.getCell(q.x, q.y);
        if (
          c &&
          (c.isPassable || [T.DOOR, T.SECRET_DOOR].includes(c.terrain)) &&
          !blocked.has(key(q)) &&
          !seen.has(key(q))
        ) {
          seen.add(key(q));
          queue.push(q);
        }
      }
    }
    expect(seen.has(key(target))).toBe(true);
    if (form === LANTERN) {
      // Diagnostic phase setup starts here; never classified as natural battle.
      const encounter = json(giantsState(game).bosses.find((e) => e.primaryId === boss.id)),
        id = boss.id;
      boss.hp = 42;
      boss.ticksUntilTurn = 0;
      boss.state = MonsterState.HUNTING;
      game.executeCommand('wait');
      expect(boss.typeId).toBe('giants.blind-lantern-open');
      expect(boss.id).toBe(id);
      expect(boss.spatial!.movementRegionId).toBe(region.id);
      expect(giantsState(game).bosses.find((e) => e.primaryId === id)).toEqual(encounter);
    }
  },
  120000
);
it('G2-GEN diagnostic chance-off and impossible space publish no chamber', () => {
  const template = loadGiantsDefinitionPack().templates.find((t) => t.formId === LANTERN)!;
  const grid = new Grid(79, 29);
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) grid.setTerrain(x, y, T.FLOOR);
  const off = new Architect(grid, undefined, [{ ...template, owner: 'giants', chance: 0 }]);
  (off as any).planSideChambers();
  expect(off.sideChambers).toEqual([]);
  const noSpace = new Architect(grid, undefined, [{ ...template, owner: 'giants', chance: 100 }]);
  (noSpace as any).planSideChambers();
  expect(noSpace.sideChambers).toMatchObject([{ plan: null, reason: 'no-space' }]);
});
it('G2-GEN diagnostic earlier reservation consumes one-chamber budget before later candidate', () => {
  const template = loadGiantsDefinitionPack().templates.find((t) => t.formId === LANTERN)!;
  const architect = new Architect(new Grid(79, 29), undefined, [
    { ...template, owner: 'giants', chance: 100 }
  ]);
  architect.sideChambers.push({
    contribution: { ...template, id: 'giants.diagnostic-earlier', owner: 'giants' },
    plan: {
      bounds: { x: 3, y: 3, width: 16, height: 12 },
      spawn: { x: 8, y: 8 },
      entry: [],
      carve: [],
      reserve: []
    },
    reason: null
  });
  (architect as any).planSideChambers();
  expect(architect.sideChambers).toHaveLength(2);
  expect(architect.sideChambers[1]).toMatchObject({
    contribution: { id: template.id },
    plan: null,
    reason: 'budget'
  });
});
