import { it, expect } from 'vitest';
import { setup, establish, build } from './helpers';
import { cellAppearance } from '../../../../engine/UI/Appearance';
import { TerrainType } from '../../../../engine/Map/Grid';
import { terrainSemantic } from '../../../../ui/mapTileSemantics';
import { paintMapText, paintVectorTile } from '../../../../ui/mapTileDrawing';
import { normalizeMapGlyph } from '../../../../ui/mapGlyph';
import { resolveVectorIcon } from '../../../../ui/vectorAtlas';
import { rng } from '../../../../engine/Random';
const context = {
  gas: undefined,
  lightChannels: { r: 100, g: 100, b: 100 },
  groundItem: null,
  carriedItem: null,
  hallucinating: false,
  cosmetic: { percent: () => false, pick: <T>(a: readonly T[]) => a[0]! }
};
it.each([
  ['wood-floor', '地'],
  ['stone-floor', '地'],
  ['wood-wall', '墙'],
  ['stone-wall', '墙'],
  ['door', '门'],
  ['window', '窗'],
  ['roof', '顶'],
  ['bed', '床'],
  ['chest', '箱']
])('%s has recognizable original/refined/hanzi/vector presentations', (name, label) => {
  const { h, g } = setup();
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  expect(h.ext('settlement', 'build', build(g, name!)).error).toBeNull();
  const c = g.grid.getCell(20, 13)!,
    before = rng.getState(),
    world = structuredClone(g.world5);
  const visual = cellAppearance(c, context)!,
    semantic = terrainSemantic(c, visual);
  expect(semantic.hanzi).toBe(label);
  const sprite = { style: {}, text: '', anchor: { set() {} }, x: 0, y: 0, visible: false };
  const graphics = new Proxy(
    {},
    {
      get: (_t, k) =>
        k === 'then'
          ? undefined
          : (...args: unknown[]) => {
              for (const n of args)
                if (typeof n === 'number') expect(Number.isFinite(n)).toBe(true);
              return graphics;
            }
    }
  );
  for (const mode of ['original', 'refined', 'hanzi', 'tiles'] as const) {
    paintMapText(sprite as never, semantic, visual.color, mode, 20, 13, 16);
    expect(sprite.text).toBe(
      mode === 'original' || mode === 'refined'
        ? normalizeMapGlyph(visual.char)
        : mode === 'tiles'
          ? ''
          : label
    );
    if (mode === 'tiles') {
      expect(resolveVectorIcon(semantic).family).not.toBe('unknown');
      expect(paintVectorTile(graphics as never, semantic, visual.color, 20, 13, 16)).toBe(false);
    }
  }
  expect(rng.getState()).toEqual(before);
  expect(g.world5).toEqual(world);
});
it('roofed floors retain their distinct visible and remembered label without reading hidden live bindings', () => {
  const { h, g } = setup();
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  for (const name of ['wood-floor', 'roof'])
    expect(h.ext('settlement', 'build', build(g, name)).error).toBeNull();
  const c = g.grid.getCell(20, 13)!,
    visual = cellAppearance(c, context)!;
  expect(terrainSemantic(c, visual).hanzi).toBe('覆');
  c.rememberedAppearance = visual;
  c.rememberedLayers = [...c.layers];
  c.hasMemory = true;
  c.isVisible = false;
  expect(terrainSemantic(c, cellAppearance(c, context)!).hanzi).toBe('覆');
});
it.each([TerrainType.PLAIN_FIRE, TerrainType.STAIRS_UP, TerrainType.STAIRS_DOWN])(
  'native hazard/stair %s retains display priority over a previously built roof',
  (type) => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g, 'roof')).error).toBeNull();
    g.grid.setTerrain(20, 13, type);
    const cell = g.grid.getCell(20, 13)!,
      semantic = terrainSemantic(cell, cellAppearance(cell, context)!);
    expect(semantic.hanzi).toBe(
      type === TerrainType.PLAIN_FIRE ? '火' : type === TerrainType.STAIRS_UP ? '上' : '下'
    );
  }
);
