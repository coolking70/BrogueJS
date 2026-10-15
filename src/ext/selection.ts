import type { ModuleDescriptor } from './descriptor';

/** New-draft policy only. Exact manifests and replay never pass through here. */
export interface ModuleSelection {
  readonly selected: readonly string[];
  readonly declined: readonly string[];
  readonly reasons: Readonly<Record<string, readonly string[]>>;
  readonly missing: readonly string[];
}
export function resolveModuleRecommendations(descriptors: readonly ModuleDescriptor[], selected: readonly string[], declined: readonly string[] = []): ModuleSelection {
  const installed = new Map(descriptors.map(d => [d.id, d]));
  const enabled = new Set(selected), rejected = new Set(declined), missing = new Set<string>();
  const reasons: Record<string, string[]> = {};
  if (selected.some(id => !installed.has(id))) throw new Error('Unavailable selected module');
  const visited = new Set<string>();
  const visit = (id: string): void => {
    if (visited.has(id)) return;
    visited.add(id);
    for (const target of [...new Set(installed.get(id)?.recommends ?? [])].sort()) {
      if (!installed.has(target)) { missing.add(target); continue; }
      (reasons[target] ??= []).push(id);
      if (rejected.has(target)) continue;
      enabled.add(target); visit(target);
    }
  };
  [...enabled].sort().forEach(visit);
  return { selected: [...enabled].sort(), declined: [...rejected].sort(), reasons, missing: [...missing].sort() };
}
export function selectModule(descriptors: readonly ModuleDescriptor[], draft: ModuleSelection, id: string, enabled: boolean): ModuleSelection {
  const selected = new Set(draft.selected), declined = new Set(draft.declined);
  if (enabled) { selected.add(id); declined.delete(id); }
  else {
    selected.delete(id);
    // Turning a default off before any recommendation does not reject a later offer.
    if (draft.reasons[id]?.length) declined.add(id);
  }
  return resolveModuleRecommendations(descriptors, [...selected], [...declined]);
}
