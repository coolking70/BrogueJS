/** One mechanical composition kernel. No Game import, constructors or RNG.
 * Weak bindings are derived session data; Cell's serialized shape is unchanged. */
import type { Cell, Grid } from './Grid';
import type { CellProperties, StructureCell, StructureDefinition } from '../../ext/structureTypes';
import {
  TERRAIN_FLAGS,
  T_OBSTRUCTS_PASSABILITY,
  T_OBSTRUCTS_VISION,
  T_OBSTRUCTS_GAS,
  T_OBSTRUCTS_DIAGONAL_MOVEMENT,
  T_OBSTRUCTS_ITEMS,
  T_OBSTRUCTS_SCENT,
  T_IS_FLAMMABLE,
  T_AUTO_DESCENT,
  T_LAVA_INSTA_DEATH,
  T_IS_DEEP_WATER
} from './TerrainCatalog';
type Binding = {
  row: StructureCell;
  definition: (id: string) => StructureDefinition;
  revision: () => number;
  roof: () => boolean;
};
type Bound = Binding & {
  blocks: StructureDefinition['blocks'];
  addedFlags: number;
  flammable: boolean;
  appearance: { char: string; color: string } | null;
};
export let structureBindingsActive = false,
  structureObserversActive = false;
let bindingCount = 0,
  watchCount = 0;
const bindings = new WeakMap<Cell, Bound>();
const boundCells = new WeakMap<Grid, Set<Cell>>();
const watchers = new WeakMap<
  Cell,
  { observedTypes: readonly number[]; changed: (before: readonly number[]) => void }
>();
const watchedCells = new WeakMap<Grid, Set<Cell>>();
const watchHandlers = new WeakMap<Grid, (cell: Cell, before: readonly number[]) => void>();
export function baseCellFlags(cell: Cell): number {
  let flags = 0;
  for (let l = 0; l < 4; l++) flags |= TERRAIN_FLAGS[cell.layers[l]!]!.flags;
  return flags;
}
export function baseCellMechFlags(cell: Cell): number {
  let flags = 0;
  for (let l = 0; l < 4; l++) flags |= TERRAIN_FLAGS[cell.layers[l]!]!.mechFlags;
  return flags;
}
export function structureBlocking(cell: Cell): StructureDefinition['blocks'] | null {
  return bindingCount ? (bindings.get(cell)?.blocks ?? null) : null;
}
export function composedCellFlags(cell: Cell, base = baseCellFlags(cell)): number {
  if (!bindingCount) return base;
  const binding = bindings.get(cell);
  return binding ? base | binding.addedFlags : base;
}
/** Known geometry uses saved composed movement bits, never hidden live bindings. */
export function knownCellFlags(cell: Cell): number {
  if (!cell.isVisible && !cell.hasMemory && !cell.isMagicMapped && !cell.isExplored) return 0;
  const layers = cell.isVisible ? cell.layers : cell.rememberedLayers;
  const base = layers.reduce((flags, tile) => flags | TERRAIN_FLAGS[tile].flags, 0);
  return cell.isVisible
    ? composedCellFlags(cell, base)
    : base |
        (cell.rememberedTerrainFlags & (T_OBSTRUCTS_PASSABILITY | T_OBSTRUCTS_DIAGONAL_MOVEMENT));
}
/** Foundation support depends on native ground, not room/roof qualification. */
export function isStableBaseFloor(cell: Cell): boolean {
  return !(
    baseCellFlags(cell) &
    (T_OBSTRUCTS_PASSABILITY | T_AUTO_DESCENT | T_LAVA_INSTA_DEATH | T_IS_DEEP_WATER)
  );
}
export function readCellProperties(cell: Cell, revision = 0): CellProperties {
  const base = baseCellFlags(cell),
    mech = baseCellMechFlags(cell),
    flags = composedCellFlags(cell, base),
    b = bindingCount ? bindings.get(cell) : undefined,
    blocks = structureBlocking(cell);
  const nativeProjectile = !!(base & (T_OBSTRUCTS_PASSABILITY | T_OBSTRUCTS_VISION));
  const roof = !!b?.row.roof && b.roof();
  return {
    baseTerrainFlags: base,
    baseMechFlags: mech,
    blocksMovement: !!(flags & T_OBSTRUCTS_PASSABILITY),
    blocksVision: !!(flags & T_OBSTRUCTS_VISION),
    blocksScent: !!(flags & T_OBSTRUCTS_SCENT),
    blocksPhysicalProjectile: nativeProjectile || !!blocks?.physicalProjectile,
    blocksMagicProjectile: nativeProjectile || !!blocks?.magicProjectile,
    blocksGas: !!(flags & T_OBSTRUCTS_GAS),
    blocksLiquid: !!(base & T_OBSTRUCTS_PASSABILITY) || !!blocks?.liquid,
    stableFloor: !(
      base &
      (T_OBSTRUCTS_PASSABILITY | T_AUTO_DESCENT | T_LAVA_INSTA_DEATH | T_IS_DEEP_WATER)
    ),
    usableRoof: roof,
    roofBlocksSunlight: roof,
    flammable: !!(flags & T_IS_FLAMMABLE),
    terrainRevision: b?.revision() ?? revision
  };
}
export function cellProjectileBlocked(cell: Cell, magic = true): boolean {
  const blocks = structureBlocking(cell);
  return (
    !!(baseCellFlags(cell) & (T_OBSTRUCTS_PASSABILITY | T_OBSTRUCTS_VISION)) ||
    !!blocks?.[magic ? 'magicProjectile' : 'physicalProjectile']
  );
}
export function cellProjectileFlags(cell: Cell, magic = true): number {
  const base = baseCellFlags(cell),
    blocks = structureBlocking(cell);
  let flags = base;
  if (blocks?.[magic ? 'magicProjectile' : 'physicalProjectile'])
    flags |= T_OBSTRUCTS_PASSABILITY | T_OBSTRUCTS_VISION;
  return flags | (composedCellFlags(cell, base) & T_IS_FLAMMABLE);
}
export function cellLiquidBlocked(cell: Cell, includeNative = true): boolean {
  return (
    (includeNative && !!(baseCellFlags(cell) & T_OBSTRUCTS_PASSABILITY)) ||
    !!structureBlocking(cell)?.liquid
  );
}
export function structureCellChanged(cell: Cell): void {
  if (!watchCount) return;
  const watch = watchers.get(cell);
  if (!watch || watch.observedTypes.every((t, i) => t === cell.layers[i])) return;
  const before = watch.observedTypes;
  watch.observedTypes = [...cell.layers];
  // Observers only enqueue work. Never run economic effects in a native loop.
  watch.changed(before);
}
export function watchStructureTerrain(
  grid: Grid,
  changed: (cell: Cell, before: readonly number[]) => void
): void {
  watchHandlers.set(grid, changed);
  if (watchedCells.has(grid)) return;
  const set = new Set<Cell>();
  for (let y = 0; y < grid.height; y++)
    for (let x = 0; x < grid.width; x++) {
      const cell = grid.getCell(x, y)!;
      set.add(cell);
      watchCount++;
      structureObserversActive = true;
      watchers.set(cell, {
        observedTypes: [...cell.layers],
        changed: (before) => watchHandlers.get(grid)?.(cell, before)
      });
    }
  watchedCells.set(grid, set);
}
export function clearStructureBindings(grid: Grid): void {
  for (const cell of watchedCells.get(grid) ?? []) {
    watchers.delete(cell);
    watchCount--;
    structureObserversActive = watchCount > 0;
  }
  watchedCells.delete(grid);
  watchHandlers.delete(grid);
  const previous = boundCells.get(grid);
  if (!previous) return;
  for (const cell of previous) {
    bindings.delete(cell);
    bindingCount--;
    structureBindingsActive = bindingCount > 0;
    cell.refreshTerrainProperties();
  }
  boundCells.delete(grid);
}
export function hasStructureCellBinding(cell: Cell, row: StructureCell): boolean {
  return bindingCount > 0 && bindings.get(cell)?.row === row;
}
export function unbindStructureCell(grid: Grid, cell: Cell): void {
  if (bindings.delete(cell)) bindingCount--;
  structureBindingsActive = bindingCount > 0;
  boundCells.get(grid)?.delete(cell);
  cell.refreshTerrainProperties();
}
export function structureFlammable(cell: Cell): boolean {
  return bindingCount ? (bindings.get(cell)?.flammable ?? false) : false;
}
export function bindStructureCell(grid: Grid, cell: Cell, binding: Binding): void {
  const blocks = {
    movement: false,
    vision: false,
    physicalProjectile: false,
    magicProjectile: false,
    gas: false,
    liquid: false
  };
  let flammable = false;
  // Definitions and components are immutable between trusted transaction
  // boundaries. Compile once on publication, never in FOV/path/gas hot loops.
  for (const slot of ['floor', 'barrier', 'roof', 'fixture'] as const) {
    const component = binding.row[slot];
    if (!component || component.hp <= 0) continue;
    const definition = binding.definition(component.definitionId);
    flammable ||= definition.flammable;
    if ((slot === 'barrier' || slot === 'fixture') && component.doorOpen !== true)
      for (const key of Object.keys(blocks) as (keyof typeof blocks)[])
        blocks[key] ||= definition.blocks[key];
  }
  let addedFlags = flammable ? T_IS_FLAMMABLE : 0;
  if (blocks.movement)
    addedFlags |= T_OBSTRUCTS_PASSABILITY | T_OBSTRUCTS_DIAGONAL_MOVEMENT | T_OBSTRUCTS_ITEMS;
  if (blocks.vision) addedFlags |= T_OBSTRUCTS_VISION;
  if (blocks.gas) addedFlags |= T_OBSTRUCTS_GAS;
  const c = binding.row.barrier ?? binding.row.fixture ?? binding.row.floor ?? binding.row.roof;
  const d = c ? binding.definition(c.definitionId) : null;
  const appearance = d
    ? {
        char:
          d.barrierKind === 'wall'
            ? '#'
            : d.barrierKind === 'window'
              ? '▤'
              : d.barrierKind === 'door'
                ? c!.doorOpen
                  ? '/'
                  : '+'
                : d.tags.includes('bed')
                  ? '='
                  : d.containerCapacity
                    ? '□'
                    : d.stationDefinitionId
                      ? 'T'
                      : d.restPointDefinitionId
                        ? '='
                        : d.slot === 'roof' ? '^' : binding.row.roof ? ':' : '.',
        color: '#bbbbbb'
      }
    : null;
  if (!bindings.has(cell)) bindingCount++;
  structureBindingsActive = true;
  bindings.set(cell, { ...binding, blocks, addedFlags, flammable, appearance });
  let set = boundCells.get(grid);
  if (!set) boundCells.set(grid, (set = new Set()));
  set.add(cell);
  cell.refreshTerrainProperties();
}
export function structureAppearance(cell: Cell): { char: string; color: string } | null {
  return bindingCount ? (bindings.get(cell)?.appearance ?? null) : null;
}
/** Player/resident escape checks may open an intact door; AI never calls this. */
export function isOpenableStructureDoor(cell: Cell): boolean {
  const c = bindingCount ? bindings.get(cell)?.row.barrier : null;
  return !!c && c.hp > 0 && c.doorOpen !== null;
}
