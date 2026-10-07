import { it, expect, afterEach, vi } from 'vitest';
import { createWorldHarness } from '../ext/testing/worldHarness';
import { createForageHarness } from '../ext/testing/forageHarness';
import type { WorldHarness } from '../ext/worldSdk';
const hs: WorldHarness[] = [];
afterEach(() => {
  hs.splice(0).forEach((h) => h.dispose());
  vi.restoreAllMocks();
});
const rows = [
  [],
  ['growth'],
  ['narrative'],
  ['combat'],
  ['giants'],
  ['growth', 'narrative', 'combat', 'giants'],
  ['craftskel'],
  ['crafting'],
  ['fgfixture'],
  ['fgfixture', 'combat'],
  ['fgfixture', 'craftskel'],
  ['fgfixture', 'crafting'],
  ['fgfixture', 'combat', 'giants'],
  ['fgfixture', 'growth', 'narrative', 'combat', 'giants']
];
it.each(rows.map((modules) => ({ modules })))(
  'real combination $modules new/play/save/load/replay/seek/resume',
  ({ modules }) => {
    const h = modules.includes('fgfixture')
      ? createForageHarness({ seed: 51020001, modules: modules.filter((m) => m !== 'fgfixture') })
      : createWorldHarness({ seed: 51020001, modules });
    hs.push(h);
    h.command('wait');
    h.command('escape');
    const save = h.save(),
      digest = h.digest();
    h.load(save);
    expect(h.digest()).toBe(digest);
    const rec = h.exportRecording(),
      n = JSON.parse(rec).events.length;
    expect(h.replay(rec)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest);
    h.seek(rec, n);
    expect(h.digest()).toBe(digest);
    h.load(save);
    h.command('escape');
    expect(h.replay(h.exportRecording()).ok).toBe(true);
  }
);
