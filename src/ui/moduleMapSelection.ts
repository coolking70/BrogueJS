import { shallowRef } from 'vue';
export const MODULE_MAP_SELECTION_COLOR = 0xd4bd79;
/** Display ownership only: selection does not move actors or consume time. */
export const moduleMapSelection = shallowRef<{
  owner: object;
  cells: readonly { x: number; y: number }[];
  select(at: { x: number; y: number }): void;
} | null>(null);
export function selectModuleMapCell(at: { x: number; y: number }): boolean {
  const active = moduleMapSelection.value;
  if (!active) return false;
  active.select(at);
  return true;
}
export function registerModuleMapSelection(
  owner: object,
  select: (at: { x: number; y: number }) => void,
  cells: readonly { x: number; y: number }[]
): () => void {
  moduleMapSelection.value = { owner, select, cells };
  return () => {
    if (moduleMapSelection.value?.owner === owner) moduleMapSelection.value = null;
  };
}
