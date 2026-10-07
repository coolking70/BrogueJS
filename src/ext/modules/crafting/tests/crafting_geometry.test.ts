import { expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { workPositions } from '../../../../engine/Core/WorldWorkWorld';
import { hasInteractionLine } from '../../../worldSpatial';
import { arena, add, place, descend } from './runtimeHelpers';

/** Captured on 56ad210 (pre-5A3) with only the delivered crafting directory added.
 * Natural D1/D2 nodes plus both real station definitions. Each row retains every
 * grid cell's ray result; comparison never substitutes a digest or a sample. */
it('real crafting work positions and every interaction ray survive the 5A3 migration', () => {
  const scenes = [51020001, 42, 7306].map(seed => {
    const h = createWorldHarness({ seed, modules: ['crafting'] }), g = worldHarnessGame(h);
    try {
      const levels = [1, 2].map(() => {
        arena(g); add(g, 'wood', 20); add(g, 'stone', 20);
        expect(place(h, 'table')).toEqual({ recorded: true, error: null });
        expect(place(h, 'hearth')).toEqual({ recorded: true, error: null });
        const values = g.extensionRuntime!.worldWorkEntities().filter(e => e.depth === g.depth).map(e => {
          const at = { x: e.x, y: e.y };
          return { definitionId: e.contentId, at, distance: e.interactionDistance,
            positions: workPositions(g, at, e.interactionDistance),
            lines: Array.from({ length: g.grid.height }, (_, y) => Array.from({ length: g.grid.width }, (_, x) =>
              hasInteractionLine(g.grid, { x, y }, at) ? '1' : '0').join('')) };
        });
        const depth = g.depth; if (depth === 1) descend(h);
        return { depth, values };
      });
      return { seed, fingerprints: g.extensionRuntime!.worldDefinitionFingerprints(), levels };
    } finally { h.dispose(); }
  });
  const file = 'src/ext/modules/crafting/data/geometry-baseline.json';
  if (process.env.CRAFTING_CAPTURE_GEOMETRY) writeFileSync(process.env.CRAFTING_CAPTURE_GEOMETRY,
    JSON.stringify({ commit: '56ad210542433d942ba8f93c8e059e38b4ba3dbc', scenes }) + '\n');
  else expect(scenes).toEqual(JSON.parse(readFileSync(file, 'utf8')).scenes);
});
