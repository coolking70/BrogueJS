import { expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
import { ItemCategory } from '../../../../engine/Items/Item';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { prepareResidentPerformance } from './residentPerformanceScene';
import {
  residentPerformanceOrigin,
  sampleResidentPerformance
} from './residentPerformanceActivity';
let control: ReturnType<typeof residentPerformanceOrigin> | undefined;
// Untimed proofs only. Timing runs in the parent's quiet window.
it.each([false, true])(
  'prepares matched native/economic 16-worker origins and real ordinary-window work, registered=%s',
  (registered) => {
    vi.restoreAllMocks();
    const { h, g } = prepareResidentPerformance(registered);
    try {
      const origin = residentPerformanceOrigin(g);
      if (!registered) control = origin;
      else expect(origin).toEqual(control);
      const report = sampleResidentPerformance(h, g, registered, false);
      if (process.env.RESIDENT_PREP_OUT)
        writeFileSync(
          process.env.RESIDENT_PREP_OUT +
            '/16-' +
            (registered ? 'residents' : 'control') +
            '-preparation.json',
          JSON.stringify({
            origin,
            ...report,
            recording: JSON.parse(h.exportRecording()),
            save: JSON.parse(h.save())
          })
        );
    } finally {
      h.dispose();
      vi.restoreAllMocks();
    }
  }
);
it('prepares four legal camps with 64 living workers and bounded real FOOD roots', () => {
  vi.restoreAllMocks();
  const { h, g } = prepareResidentPerformance(true, 4);
  try {
    expect(g.world5!.residents).toHaveLength(64);
    expect(g.extensionRuntime!.worldCampState('settlement').camps).toHaveLength(4);
    const foods = g.extensionRuntime!.worldCampState('settlement').camps.map((c) => ({
      slot: c.slot,
      quantity: containerItems(g, c.supplyId)
        .filter((i) => i.category === ItemCategory.FOOD)
        .reduce((n, i) => n + i.quantity, 0),
      population: g.world5!.residents.filter((r) => r.campSlotId === c.slot).length
    }));
    expect(foods.every((f) => f.population === 16 && f.quantity > 0 && f.quantity <= 64)).toBe(
      true
    );
    if (process.env.RESIDENT_PREP_OUT)
      writeFileSync(
        process.env.RESIDENT_PREP_OUT + '/64-preparation.json',
        JSON.stringify({
          foods,
          save: JSON.parse(h.save()),
          worldBytes: Buffer.byteLength(JSON.stringify(g.world5)),
          saveBytes: Buffer.byteLength(h.save())
        })
      );
  } finally {
    h.dispose();
    vi.restoreAllMocks();
  }
});
