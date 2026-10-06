import { describe, expect, it } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../ext/testing/worldHarness';
import { clearWorldCell } from '../engine/Core/WorldWorkWorld';
const cases = [
  [],
  ['growth'],
  ['narrative'],
  ['combat'],
  ['giants'],
  ['growth', 'narrative', 'combat', 'giants'],
  ['craftskel'],
  ['craftskel', 'combat'],
  ['craftskel', 'combat', 'giants'],
  ['craftskel', 'growth', 'narrative', 'combat', 'giants'],
  ['c5fixture']
];
describe('C5 real lifecycle combination smoke', () => {
  it.each(cases.map((modules) => ({ modules })))(
    '$modules new/play/save/load/replay/seek/continuation',
    ({ modules }) => {
      const h = createWorldHarness({ seed: 51020001, modules, mode: 'normal', fixtures: [] }),
        g = worldHarnessGame(h);
      if (modules.includes('craftskel')) {
        const read = () => {
          const r = h.readWorkContext('craftskel', { kind: 'inventory' });
          if (!r.ok) throw new Error(r.code);
          return r.value;
        };
        const before = read(),
          at = [-1, 0, 1]
            .flatMap((dy) => [-1, 0, 1].map((dx) => ({ x: before.at.x + dx, y: before.at.y + dy })))
            .find((p) => clearWorldCell(g, p))!;
        expect(
          h.ext('craftskel', 'place-station', {
            v: 1,
            definitionId: 'craftskel.table',
            x: at.x,
            y: at.y,
            inventoryStamp: before.inventoryStamp
          }).error
        ).toBeNull();
        const context = read(),
          station = context.stations.find((s) =>
            s.workPositions.some((p) => p.x === context.at.x && p.y === context.at.y)
          )!;
        expect(
          h.ext(
            'craftskel',
            'craft',
            {
              v: 1,
              recipeId: 'craftskel.dagger-recipe',
              batchCount: 2,
              stationId: station.interactableId,
              stationRevision: station.revision,
              sourceContainerId: null,
              sourceRevision: null,
              inventoryStamp: context.inventoryStamp
            },
            [true]
          ).error
        ).toBeNull();
        expect(h.runAutoUntilIdle(3)).toBe(1);
        expect(h.world5()!.terminalTickets[h.world5()!.terminalTickets.length - 1]!.completedBatches).toBe(2);
      } else h.command('wait');
      h.command('escape');
      const digest = h.digest(),
        save = h.save();
      h.load(save);
      expect(h.digest()).toBe(digest);
      const recording = h.exportRecording();
      expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
      expect(h.digest()).toBe(digest);
      const count = JSON.parse(recording).events.length;
      h.seek(recording, count);
      expect(h.digest()).toBe(digest);
      h.load(h.save());
      h.command('escape');
      expect(JSON.parse(h.exportRecording()).events).toHaveLength(count + 1);
      h.dispose();
    }
  );
});
