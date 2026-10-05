import { isJson, validId } from '../../json';
import type { GiantsPack, GiantsState, GiantsBossMarker } from './types';
const keys = (v: unknown, n: string[]): boolean =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).sort().join(',') === n.sort().join(',');
const id = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
export function initialGiantsState(): GiantsState {
  return { schema: 1, revision: 0, placements: [], bosses: [] };
}
export function isGiantsBossMarker(v: unknown): v is GiantsBossMarker {
  return (
    isJson(v) &&
    keys(v, ['schema', 'encounterKey', 'spawnDefinitionId']) &&
    (v as unknown as GiantsBossMarker).schema === 1 &&
    validId((v as unknown as GiantsBossMarker).encounterKey) &&
    validId((v as unknown as GiantsBossMarker).spawnDefinitionId)
  );
}
export function isGiantsState(value: unknown, pack: GiantsPack): value is GiantsState {
  if (!isJson(value) || !keys(value, ['schema', 'revision', 'placements', 'bosses'])) return false;
  const v = value as unknown as GiantsState;
  if (
    v.schema !== 1 ||
    !Number.isSafeInteger(v.revision) ||
    v.revision < 0 ||
    !Array.isArray(v.placements) ||
    v.placements.length > 128 ||
    !Array.isArray(v.bosses) ||
    v.bosses.length > 128
  )
    return false;
  const instances = new Set<string>(),
    regions = new Set<number>(),
    encounters = new Set<string>(),
    subjects = new Set<number>();
  for (const p of v.placements) {
    const t = pack.templates.find((t) => t.id === p?.templateId);
    if (
      !keys(p, ['instanceKey', 'templateId', 'depth', 'result', 'regionId', 'reason']) ||
      !t ||
      !validId(p.instanceKey) ||
      instances.has(p.instanceKey) ||
      !Number.isSafeInteger(p.depth) ||
      p.depth < t.minDepth ||
      p.depth > t.maxDepth ||
      p.instanceKey !== `${t.id}.depth-${p.depth}` ||
      !['placed', 'skipped'].includes(p.result) ||
      (p.result === 'placed'
        ? !id(p.regionId) || p.reason !== null || regions.has(p.regionId)
        : p.regionId !== null || !['no-space', 'budget'].includes(p.reason!))
    )
      return false;
    instances.add(p.instanceKey);
    if (p.regionId !== null) regions.add(p.regionId);
  }
  for (const b of v.bosses) {
    const p = v.placements.find((p) => p.instanceKey === b?.instanceKey && p.result === 'placed');
    if (
      !keys(b, [
        'encounterKey',
        'primaryId',
        'spawnDefinitionId',
        'instanceKey',
        'regionId',
        'subjects',
        'status'
      ]) ||
      !p ||
      !id(b.primaryId) ||
      b.regionId !== p.regionId ||
      !pack.forms.some((f) => f.id === b.spawnDefinitionId) ||
      b.spawnDefinitionId !== pack.templates.find((t) => t.id === p.templateId)!.formId ||
      b.encounterKey !== `${b.instanceKey}.encounter` ||
      encounters.has(b.encounterKey) ||
      !['alive', 'defeated', 'escaped', 'lost'].includes(b.status) ||
      !Array.isArray(b.subjects) ||
      !b.subjects.length || b.subjects.length > 64 ||
      b.subjects[0]?.groupId !== b.primaryId
    )
      return false;
    for (const s of b.subjects) {
      if (
        !keys(s, ['groupId', 'status']) ||
        !id(s.groupId) ||
        subjects.has(s.groupId) ||
        !['alive', 'dead', 'lost'].includes(s.status)
      )
        return false;
      subjects.add(s.groupId);
    }
    if (
      (b.status === 'defeated') !== b.subjects.every((s) => s.status === 'dead') ||
      (b.status === 'lost' && (b.subjects.some(s => s.status === 'alive') || !b.subjects.some((s) => s.status === 'lost'))) ||
      (['alive', 'escaped'].includes(b.status) && !b.subjects.some((s) => s.status === 'alive'))
    )
      return false;
    encounters.add(b.encounterKey);
  }
  return v.placements
    .filter((p) => p.result === 'placed')
    .every((p) => v.bosses.some((b) => b.instanceKey === p.instanceKey));
}
