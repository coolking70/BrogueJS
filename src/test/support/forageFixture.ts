import { afterEach, vi } from 'vitest';
import { createForageHarness } from '../../ext/testing/forageHarness';
import { installRecordingScene } from './recordingV4';
import { TerrainType, DungeonLayer } from '../../engine/Map/Grid';
import type { ModuleDescriptor } from '../../ext/descriptor';
const active: ReturnType<typeof createForageHarness>[] = [];
afterEach(() => {
  for (const h of active.splice(0)) h.dispose();
  vi.restoreAllMocks();
});
export function forage(modules: string[] = [], overrides: readonly ModuleDescriptor[] = []) {
  installRecordingScene((g) => {
    if (!g.extensionRuntime?.edibleModule('fgfixture')) return;
    g.monsters = [];
    g.dormantMonsters = [];
    (g as any).monsterSpawnFuse = 1000000;
    g.player.loc = { x: 10, y: 10 };
    g.items = g.items.filter((i) => Math.max(Math.abs(i.x - 10), Math.abs(i.y - 10)) > 5);
    for (let y = 5; y <= 15; y++)
      for (let x = 5; x <= 15; x++) {
        g.grid.setTerrain(x, y, TerrainType.FLOOR);
        const layers = g.grid.getCell(x, y)!.layers;
        layers[DungeonLayer.LIQUID] =
          layers[DungeonLayer.SURFACE] =
          layers[DungeonLayer.GAS] =
            TerrainType.NOTHING;
        const c = g.grid.getCell(x, y)!;
        c.isVisible = c.hasMemory = true;
        c.machineNumber = 0;
        g.grid.impregnableCells.delete(y * g.grid.width + x);
      }
    (g as any).updateVision();
  });
  const h = createForageHarness({ seed: 51020001, modules }, overrides);
  active.push(h);
  return h;
}
export function grant(
  h: ReturnType<typeof forage>,
  name = 'raw',
  quantity = 1,
  floor = false,
  at = { x: 11, y: 10 }
) {
  h.fixture({ kind: 'grant', definitionId: 'fgfixture.' + name, quantity, floor, at });
  return [...h.game().items, ...h.game().player.inventory.items]
    .filter((i) => i.worldItem?.definitionId === 'fgfixture.' + name)
    .slice(-1)[0]!;
}
export function ally(h: ReturnType<typeof forage>) {
  h.fixture({ kind: 'ally', at: { x: 11, y: 10 } });
  return h.game().monsters.slice(-1)[0]!;
}
export function read(h: ReturnType<typeof forage>) {
  const r = h.readEdibleContext();
  if (!r.ok) throw Error(r.code);
  return r.value;
}
export function history(h: ReturnType<typeof forage>): any[] {
  return (h.game().extensionRuntime!.snapshot().modules.fgfixture as any).history;
}
export function closedLoop(h: ReturnType<typeof forage>) {
  const save = h.save(),
    digest = h.digest(),
    n = h.game().recordedInputEvents.length;
  h.load(save);
  if (h.digest() !== digest) throw Error('load mismatch');
  const rec = h.exportRecording(),
    result = h.replay(rec);
  if (!result.ok) throw Error('replay ' + JSON.stringify(result));
  h.seek(rec, n);
  if (h.digest() !== digest) throw Error('seek mismatch');
  h.load(save);
  h.command('escape');
  const continuationSave = h.save();
  if (!h.replay(h.exportRecording()).ok) throw Error('continuation mismatch');
  h.load(continuationSave);
}
