import type { Creature, StatusId } from '../../entities/Creature';
import type { SpatialStatusProfileDefinition } from '../Movement/SpatialSchema';

export interface BodyStatusContext {
  core: Creature;
  profile: SpatialStatusProfileDefinition;
  members(): readonly Creature[];
}
// Bound only after owned-list validation; serialized bodyMember is not authority.
const contexts = new WeakMap<Creature, () => BodyStatusContext | undefined>();
export function bindBodyStatuses(actor: Creature, resolve: () => BodyStatusContext | undefined): void { contexts.set(actor, resolve); }
export function bodyDecisionActor<T extends Creature>(actor: T): T {
  return (contexts.get(actor)?.()?.core ?? actor) as T;
}
export function bodyStatusOwner(actor: Creature, statusId: string): Creature {
  const context = contexts.get(actor)?.();
  if (!context) return actor;
  const row = context.profile.rows.find(r => r.statusId === statusId);
  if (!row) throw new Error(`Unclassified body status: ${statusId}`);
  return row.owner === 'group' ? context.core : actor;
}
export function bodyStatusStackMode(actor: Creature, statusId: StatusId, native: 'refresh' | 'stack'): 'refresh' | 'stack' {
  const row = contexts.get(actor)?.()?.profile.rows.find(r => r.statusId === statusId);
  return row?.owner === 'group' ? row.merge === 'stack' ? 'stack' : 'refresh' : native;
}
export function refreshBodyMemberSpeeds(actor: Creature): void {
  const context = contexts.get(actor)?.();
  if (context?.core === actor) for (const member of context.members()) if (member !== actor) member.refreshSpeeds();
}
/** Display inherited group effects without copying/ticking their storage. */
export function bodyStatusEntries(actor: Creature): [string, number][] {
  const context = contexts.get(actor)?.();
  if (!context || context.core === actor) return Object.entries(actor.statusDurations) as [string, number][];
  return [...Object.entries(actor.statusDurations), ...Object.entries(context.core.statusDurations)
    .filter(([id]) => context.profile.rows.find(r => r.statusId === id)?.owner === 'group')] as [string, number][];
}
