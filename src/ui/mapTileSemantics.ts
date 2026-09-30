/** Knowledge-safe display adapter AFTER the unchanged Appearance pipeline.
 * Only consumes the winning rendered glyph and visible/remembered identities.
 * No discovery, RNG, commands, flags, save writes, or hidden-world lookups.
 */
import mapText from '../locales/zh_CN.map.json';
import { TerrainType, DungeonLayer, DRAW_PRIORITY, type Cell } from '../engine/Map/Grid';
import { TERRAIN_APPEARANCES } from '../engine/UI/TerrainAppearanceCatalog';
import type { TerrainVisual } from '../engine/UI/Appearance';
import type { Item } from '../engine/Items/Item';
import type { Monster } from '../entities/Monster';
export { mapText };
export type TileKind = 'terrain' | 'item' | 'monster' | 'player' | 'effect' | 'marker';
export interface TileSemantic { hanzi: string; kind: TileKind; id: string; original: string }
const bare = (s: string) => s.replace(/[\uFE0E\uFE0F]/g, '');
function semantic(hanzi: string, kind: TileKind, id: string, original: string): TileSemantic { return { hanzi, kind, id, original }; }
/** Visual-only alphabet; unfamiliar glyphs never escape as ASCII in Hanzi mode. */
export function glyphSemantic(original: string, kind: TileKind = 'effect'): TileSemantic {
  const char = bare(original);
  const aliases: Record<string, string> = {
    '@': mapText.special.player, 'x': mapText.special.marker,
    '⧳': mapText.special.goodMagic, '⧲': mapText.special.badMagic, '♀': mapText.special.amuletMagic,
    '#': mapText.terrain.WALL, '·': mapText.terrain.FLOOR, '.': mapText.terrain.FLOOR,
    '<': mapText.terrain.STAIRS_UP, '>': mapText.terrain.STAIRS_DOWN,
    '!': mapText.special.alert, '?': mapText.special.question, '*': mapText.special.projectile,
    '~': mapText.terrain.STEAM,
    '&': mapText.special.hallucination,
  };
  const hanzi = !char.trim() ? '' : aliases[char] ?? (/^\p{Script=Han}$/u.test(char) ? char : mapText.special.unknown);
  return semantic(hanzi, kind, 'glyph:' + char, original);
}
/** Priority follows glyph inheritance (not cell.terrain); gas is a color layer.
 * Every concealment alias is explicit in the localized map catalog.
 */
export function terrainSemantic(cell: Cell, visual: TerrainVisual, hallucinating = false): TileSemantic {
  const char = bare(visual.char);
  if (!char.trim()) {
    const known = cell.isVisible ? cell.layers : cell.rememberedLayers;
    const water = known[DungeonLayer.LIQUID];
    // Water may be background-only above an empty dungeon layer. This is already
    // visible information; blank undiscovered cells still never reach this adapter.
    if (!hallucinating && (water === TerrainType.WATER_SHALLOW || water === TerrainType.FLOOD_WATER_SHALLOW
      || water === TerrainType.MACHINE_FLOOD_WATER_DORMANT || water === TerrainType.MACHINE_FLOOD_WATER_SPREADING))
      return semantic(mapText.terrain.WATER_SHALLOW, 'terrain', 'WATER_SHALLOW', char);
    return semantic('', 'terrain', 'blank', char);
  }
  if (char === '⧳' || char === '⧲' || char === '♀') return glyphSemantic(char, 'marker');
  // Do not reconstruct actual identities while hallucinating; final glyph only.
  if (hallucinating && cell.isVisible) return glyphSemantic(char);
  if (!cell.isVisible && cell.rememberedLayers.length !== DungeonLayer.COUNT) return glyphSemantic(char, 'terrain');
  const layers = !cell.isVisible && cell.rememberedLayers.length === DungeonLayer.COUNT
    ? cell.rememberedLayers : cell.layers;
  let winning: TerrainType | undefined;
  let priority = Infinity;
  for (let i = 0; i < layers.length; i++) {
    if (i === DungeonLayer.GAS) continue;
    const id = layers[i]!;
    const base = TERRAIN_APPEARANCES[id];
    if (id !== TerrainType.NOTHING && base?.char && DRAW_PRIORITY[id] < priority) {
      winning = id; priority = DRAW_PRIORITY[id];
    }
  }
  if (winning !== undefined && bare(TERRAIN_APPEARANCES[winning].char) === char) {
    // Transparent shallow water inherits the floor glyph, but its visible blue
    // background already exposes the water. Preserve grass/web glyphs above it.
    const liquid = layers[DungeonLayer.LIQUID];
    if (winning === TerrainType.FLOOR && (liquid === TerrainType.WATER_SHALLOW || liquid === TerrainType.FLOOD_WATER_SHALLOW))
      return semantic(mapText.terrain.WATER_SHALLOW, 'terrain', 'WATER_SHALLOW', char);
    const id = TerrainType[winning] as keyof typeof mapText.terrain;
    return semantic(mapText.terrain[id] ?? mapText.special.unknown, 'terrain', id, char);
  }
  // Legacy gas overlays and any future effect are converted from displayed data.
  return glyphSemantic(char);
}
export function itemSemantic(item: Pick<Item, 'category' | 'char'>, original: string, hallucinating = false): TileSemantic {
  if (hallucinating) return glyphSemantic(original, 'item');
  const id = String(item.category) as keyof typeof mapText.items;
  return semantic(mapText.items[id] ?? mapText.special.itemUnknown, 'item', id, original);
}
export function rememberedItemSemantic(cell: Cell, original: string): TileSemantic {
  if (cell.rememberedItemCategory === null) return glyphSemantic(original, 'item');
  return itemSemantic({ category: cell.rememberedItemCategory, char: original }, original);
}
export function monsterSemantic(monster: Pick<Monster, 'typeId' | 'char'>, original: string, hallucinating = false, marker = false): TileSemantic {
  if (marker) return semantic(mapText.special.marker, 'marker', 'unidentified', original);
  if (hallucinating) return glyphSemantic(original, 'monster');
  const id = monster.typeId.toLowerCase();
  const hanzi = id === 'player_clone' ? mapText.special.clone : id === 'spectral_image' ? mapText.monsters.spectral_sword : mapText.monsters[id as keyof typeof mapText.monsters] ?? mapText.special.monsterUnknown;
  return semantic(hanzi, 'monster', id, original);
}
export function playerSemantic(original: string): TileSemantic { return semantic(mapText.special.player, 'player', 'player', original); }
export function projectileSemantic(original: string): TileSemantic { return semantic(mapText.special.projectile, 'effect', 'projectile', original); }
/** Floating damage/status labels are UI annotations, not map cells. Keep their
 * amounts and full wording; only symbol-only alerts become one-character labels. */
export function floatingHanzi(text: string): string {
  if (text === '!') return mapText.special.alert;
  if (text === '?') return mapText.special.question;
  return text;
}
