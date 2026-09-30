import type { Text, TextStyle } from 'pixi.js';
import type { Concept } from './concept';
import type { MapMode } from './mapTiles';
import type { TileSemantic } from './mapTileSemantics';
import { normalizeMapGlyph } from './mapGlyph';
export const HANZI_FONT = 'Brogue Hanzi';
export const MAP_INK = { classic: 0xc7ac76, tactical: 0x77b8a0, immersive: 0xc4b18b };
const numberColor = (color: string | number): number => typeof color === 'number' ? color : parseInt(color.replace('#', ''), 16);
/** A slight neutral tint; retain engine lighting luminance and saturated hazards. */
export function mapInk(color: string | number, theme: Concept, mode: MapMode, kind: TileSemantic['kind']): string | number {
  if (mode === 'original' || kind !== 'terrain') return color;
  const c = numberColor(color), parts = [c >> 16 & 255, c >> 8 & 255, c & 255];
  if (Math.max(...parts) - Math.min(...parts) > 28) return color;
  const tint = MAP_INK[theme];
  return parts.reduce((out, n, i) => out | Math.min(255, Math.round(n * (0.84 + 0.16 * ((tint >> (16 - i * 8)) & 255) / 190))) << (16 - i * 8), 0);
}
/** Square cell fitting, anchored by ink bounds rather than Latin baselines. */
export function paintMapText(sprite: Text, value: TileSemantic, color: string | number, mode: MapMode, theme: Concept, x: number, y: number, tile: number): void {
  // Vector mode never asks the text atlas for any cell, including projectiles.
  if (mode === 'tiles') { sprite.text = ''; sprite.visible = false; return; }
  const hanzi = mode === 'hanzi';
  const text = hanzi ? value.hanzi : normalizeMapGlyph(value.original);
  const style = sprite.style as TextStyle;
  const family = hanzi ? HANZI_FONT : mode === 'original' ? 'Courier New' : 'Noto Sans Mono, Consolas, monospace';
  if (style.fontFamily !== family) style.fontFamily = family;
  const size = hanzi ? 13.5 : tile;
  if (style.fontSize !== size) style.fontSize = size;
  let fill = mapInk(color, theme, mode, value.kind);
  // Background-only water needs readable lettering. Scale its existing color,
  // including darkness/memory, rather than applying a flat full-bright ink.
  if (hanzi && value.kind === 'terrain' && value.hanzi === '水') {
    const c = numberColor(fill);
    fill = [16, 8, 0].reduce((out, shift) => out | Math.min(255, Math.round(((c >> shift) & 255) * 1.8)) << shift, 0);
  }
  if (style.fill !== fill) style.fill = fill;
  if (sprite.text !== text) sprite.text = text;
  sprite.anchor.set(mode === 'original' ? 0 : 0.5);
  sprite.x = (x + (mode === 'original' ? 0 : 0.5)) * tile;
  sprite.y = (y + (mode === 'original' ? 0 : 0.5)) * tile;
  sprite.visible = !!text.trim();
}
export { paintVectorTile } from './vectorAtlas';
