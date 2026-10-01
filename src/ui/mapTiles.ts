/** Independent Site renderer preferences. Never part of Game, a save, or RNG. */
import { ref } from 'vue';
export const mapModes = ['original', 'refined', 'hanzi', 'tiles'] as const;
export type MapMode = typeof mapModes[number];
export function isMapMode(value: unknown): value is MapMode { return mapModes.includes(value as MapMode); }
const key = 'brogue-ui-map-style';
function initialMode(): MapMode {
  if (typeof window === 'undefined') return 'refined';
  let selected: string | null = null;
  try { selected = new URLSearchParams(window.location.search).get('map') ?? localStorage.getItem(key); } catch {}
  return mapModes.includes(selected as MapMode) ? selected as MapMode : 'refined';
}
export const mapMode = ref<MapMode>(initialMode());
export function selectMapMode(mode: MapMode) {
  if (!mapModes.includes(mode)) return;
  mapMode.value = mode;
  if (typeof document !== 'undefined') document.documentElement.dataset.mapMode = mode;
  if (typeof window !== 'undefined') {
    try { localStorage.setItem(key, mode); const url = new URL(window.location.href); url.searchParams.set('map', mode); window.history.replaceState({}, '', url); } catch {}
  }
}
if (typeof document !== 'undefined') document.documentElement.dataset.mapMode = mapMode.value;
