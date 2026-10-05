import type { Json, ExtensionSnapshot, ActorFacts } from '../../types';
import type { WorldInteractionValidation } from '../../world';
import type { GiantsPack, GiantsState } from './types';
import { isGiantsState, isGiantsBossMarker } from './state';
export function validateGiantsBindings(
  pack: GiantsPack,
  state: Json,
  components: ExtensionSnapshot['components'],
  world: Pick<WorldInteractionValidation, 'regions'>
): boolean {
  if (!isGiantsState(state, pack)) return false;
  const s = state as unknown as GiantsState;
  if (
    (world.regions ?? []).filter((r) => r.owner === 'giants').length !==
    s.placements.filter((p) => p.result === 'placed').length
  )
    return false;
  for (const p of s.placements)
    if (p.result === 'placed') {
      const r = world.regions?.find((r) => r.id === p.regionId),
        t = pack.templates.find((t) => t.id === p.templateId)!;
      if (
        !r ||
        r.owner !== 'giants' ||
        r.depth !== p.depth ||
        r.instanceKey !== p.instanceKey ||
        r.guard !== t.guard ||
        r.bounds.width !== t.width ||
        r.bounds.height !== t.height
      )
        return false;
    }
  for (const [actor, row] of Object.entries(components))
    if (row['giants:boss'] !== undefined) {
      const m = row['giants:boss'];
      if (
        !isGiantsBossMarker(m) ||
        !s.bosses.some(
          (b) =>
            b.subjects.some(s => s.groupId === +actor && s.status === 'alive') &&
            b.encounterKey === m.encounterKey &&
            b.spawnDefinitionId === m.spawnDefinitionId
        )
      )
        return false;
    }
  return s.bosses.every(
    b => b.subjects.every(s => s.status !== 'alive' || isGiantsBossMarker(components[String(s.groupId)]?.['giants:boss']))
  );
}
export function validateGiantsWorld(
  pack: GiantsPack,
  state: Json,
  components: ExtensionSnapshot['components'],
  actors: readonly ActorFacts[],
  world: WorldInteractionValidation
): boolean {
  if (!validateGiantsBindings(pack, state, components, world)) return false;
  return (
    (state as unknown as GiantsState).bosses.every(
      b => b.subjects.every(s => s.status !== 'alive' || actors.some(
          (a) =>
            a.id === s.groupId &&
            a.hp > 0 &&
            (b.status === 'alive'
              ? a.movementRegionId === b.regionId
              : a.movementRegionId === undefined || a.movementRegionId === b.regionId)
        ))
    ) && (state as unknown as GiantsState).bosses.every(b => b.subjects.every(s => s.groupId < world.nextEntityId))
  );
}
