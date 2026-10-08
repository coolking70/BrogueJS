import { it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { prepareResidentPerformance } from './residentPerformanceScene';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { verifyResidentScale } from './residentScaleReference';
it('real legal 4-camp/64 population consumes finite FOOD at MAX_SAFE, preserves canonical facts and exact whole/2/17 final roots', () => {
  vi.restoreAllMocks();
  // Optional diagnostic reuse loads an untouched legal controlled origin, not
  // an injected natural prefix. Normal suite builds that same legal origin.
  const input = process.env.RESIDENT_SCALE_INPUT;
  const state = input
    ? (() => {
        const h = createWorldHarness({ seed: 51020001, mode: 'normal', modules: ['settlement'] });
        h.load(JSON.stringify(JSON.parse(readFileSync(input, 'utf8')).save));
        return { h, g: worldHarnessGame(h) };
      })()
    : prepareResidentPerformance(true, 4);
  try {
    verifyResidentScale(state.h, state.g);
  } finally {
    state.h.dispose();
    vi.restoreAllMocks();
  }
});
