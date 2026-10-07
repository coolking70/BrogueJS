import { it, expect } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { createWorldHarness, worldHarnessGame } from '../ext/testing/worldHarness';
import { workPositions } from '../engine/Core/WorldWorkWorld';
import { hasInteractionLine } from '../ext/worldSpatial';
it('C5 work positions and every interaction ray match the pre-migration baseline', () => {
  const scenes = [51020001, 42, 7306].map((seed) => {
    const h = createWorldHarness({
      seed,
      modules: [],
      fixtures: ['crafting-skeleton', 'world-work-basic']
    });
    const g = worldHarnessGame(h);
    const entities = [...g.extensionRuntime!.worldWorkEntities()];
    // 5A2 has no RestPoint root: exercise its frozen interaction geometry with
    // a standalone rest-position anchor, without adding any world record.
    const targets = [
      ...entities.map((e) => ({
        kind: e.contentId,
        at: { x: e.x, y: e.y },
        distance: e.interactionDistance
      })),
      { kind: 'rest-anchor', at: { ...g.player.loc }, distance: 1 }
    ];
    const values = targets.map((t) => ({
      ...t,
      positions: workPositions(g, t.at, t.distance),
      lines: Array.from({ length: g.grid.height }, (_, y) =>
        Array.from({ length: g.grid.width }, (_, x) => hasInteractionLine(g.grid, { x, y }, t.at))
      )
    }));
    const fingerprints = g.extensionRuntime!.worldDefinitionFingerprints();
    h.dispose();
    return { seed, fingerprints, values };
  });
  expect(scenes[0]!.values.length).toBeGreaterThan(3);
  if (process.env.C5_CAPTURE_GEOMETRY === '1')
    writeFileSync(
      'src/test/fixtures/structure-geometry-baseline.json',
      JSON.stringify({ commit: '56ad210', scenes }) + '\n'
    );
  else
    expect(scenes).toEqual(
      JSON.parse(readFileSync('src/test/fixtures/structure-geometry-baseline.json', 'utf8')).scenes
    );
});
