import { expect, it } from 'vitest';

it('native generated arena remains protected for C5 placement after load', async () => {
  const { createWorldHarness, worldHarnessGame } = await import('../../../testing/worldHarness');
  const { walkNaturalToDepth, GIANTS_ACCEPTANCE_SEED } = await import('./naturalFixture');
  const { regionContains } = await import('../../../regions');
  const { clearWorldCell } = await import('../../../../engine/Core/WorldWorkWorld');
  const h = createWorldHarness({
      seed: GIANTS_ACCEPTANCE_SEED,
      modules: ['giants'],
      fixtures: ['crafting-skeleton']
    }),
    g = worldHarnessGame(h);
  walkNaturalToDepth(g, 3);
  expect(g.depth).toBe(3);
  const r = g.extensionRuntime!.snapshot().foundation.world.regions!.find((r) => r.depth === 3)!;
  expect(r).toBeDefined();
  for (const n of g.world5!.nodes.filter(
    (n) => n.levelRef.kind === 'dungeon' && n.levelRef.depth === 3
  ))
    expect(regionContains(r, n.at)).toBe(false);
  const at = { x: r.bounds.x + 1, y: r.bounds.y + 1 };
  expect(g.grid.getCell(at.x, at.y)!.isPassable).toBe(true);
  expect(clearWorldCell(g, at)).toBe(false);
  h.load(h.save());
  expect(clearWorldCell(worldHarnessGame(h), at)).toBe(false);
  h.dispose();
}, 60000);
