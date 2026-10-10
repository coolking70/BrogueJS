import { afterEach, expect, it, vi } from 'vitest';
import { lanternScene, OPEN } from './giants2MechanicsFixture';
import {
  footprintOf,
  CreatureSpatial,
  commitCreatureAnchor
} from '../../../../engine/Movement/CreatureSpatial';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
const closed = [
  [0, 0],
  [1, 0],
  [2, 0],
  [0, 1],
  [1, 1],
  [2, 1],
  [1, 2]
];
const opened = [
  [0, 0],
  [1, 0],
  [2, 0],
  [3, 0],
  [3, 1]
];
afterEach(() => vi.restoreAllMocks());
it.each([0, 1, 2, 3])(
  'G2-MASK exact cells and zones rotate about original anchor, quarter turns %s',
  (turns) => {
    const { game, boss } = lanternScene(),
      other = game.createModuleMonster(OPEN, { x: 30, y: 12 })!;
    const rotate = (p: number[]) => {
      let x = p[0]!,
        y = p[1]!;
      for (let i = 0; i < turns; i++) [x, y] = [-y, x];
      return { x, y };
    };
    for (const [actor, cells] of [
      [boss, closed],
      [other, opened]
    ] as const) {
      actor.spatial!.pose = (['r0', 'r90', 'r180', 'r270'] as const)[turns]!;
      expect(
        footprintOf(actor)
          .map((p) => `${p.x},${p.y}`)
          .sort()
      ).toEqual(
        cells
          .map(rotate)
          .map((p) => `${p.x + actor.x},${p.y + actor.y}`)
          .sort()
      );
    }
    expect(
      footprintOf(boss)
        .filter((p) => p.zoneId === 'mantle')
        .map((p) => `${p.x},${p.y}`)
        .sort()
    ).toEqual(
      [
        [1, 0],
        [2, 0],
        [2, 1]
      ]
        .map(rotate)
        .map((p) => `${p.x + boss.x},${p.y + boss.y}`)
        .sort()
    );
    const tail = rotate([1, 2]);
    expect(game.creatureAtCell({ x: boss.x + tail.x, y: boss.y + tail.y })).toBe(boss);
    const gap = rotate([0, 2]),
      at = { x: boss.x + gap.x, y: boss.y + gap.y };
    expect(game.creatureAtCell(at)).toBeUndefined();
    expect(game.collectBodyTargets([at], { effect: 'area-damage' })).toEqual([]);
    const from = rotate([-1, 2]),
      step = rotate([1, 0]),
      hp = boss.hp;
    commitCreatureAnchor(game.player, { x: boss.x + from.x, y: boss.y + from.y });
    for (const monster of game.monsters) monster.ticksUntilTurn = 10000;
    game.executeCommand('move', step);
    expect(game.player.loc).toEqual(at);
    expect(boss.hp).toBe(hp);
  }
);
it('G2-MASK fit, corner and rotation sweep reject full mask without spending RNG or IDs', () => {
  const { game, boss } = lanternScene();
  const service = new CreatureSpatial(
    { grid: game.grid, monsters: game.monsters, player: game.player },
    game.spatialCatalog
  );
  try {
    expect(service.canFitAt(boss, { x: 25, y: 12 })).toBe(true);
    game.grid.setTerrain(26, 14, T.WALL);
    const random = rng.getState(),
      id = getNextEntityId();
    expect(service.canFitAt(boss, { x: 25, y: 12 })).toBe(false);
    expect(game.createModuleMonster(boss.typeId, { x: 25, y: 12 })).toBeNull();
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    game.grid.setTerrain(26, 14, T.FLOOR);
    game.grid.setTerrain(boss.x + 3, boss.y, T.WALL);
    expect(service.canStepFootprint(boss, { x: boss.x + 1, y: boss.y + 1 })).toBe(false);
    game.grid.setTerrain(boss.x + 3, boss.y, T.FLOOR);
    expect(service.canRotateBetween(boss, boss.loc, 'r0', 1, {}, true)).toBe(true);
    game.grid.setTerrain(boss.x - 2, boss.y + 1, T.WALL);
    expect(service.canRotateBetween(boss, boss.loc, 'r0', 1, {}, true)).toBe(false);
  } finally {
    service.dispose();
  }
});
