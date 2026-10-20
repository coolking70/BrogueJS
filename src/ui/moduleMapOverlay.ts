import { shallowRef } from 'vue';
export interface ModuleMapMark { x: number; y: number; color: number; kind: 'actor' | 'path' | 'draft' | 'target' }
/** Display DTOs only. Registrations are owned by the current game session. */
export const moduleMapOverlay = shallowRef<{ owner: object; marks: readonly ModuleMapMark[] } | null>(null);
export function registerModuleMapOverlay(owner: object, marks: readonly ModuleMapMark[]): () => void {
  const registration = { owner, marks };
  moduleMapOverlay.value = registration;
  return () => { if (moduleMapOverlay.value === registration) moduleMapOverlay.value = null; };
}
