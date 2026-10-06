/** The single persistent action clock and ID space shared by all owners. */
import {
  validateActorActionSchedulerState,
  type ActorActionSchedulerState
} from './ActorActionScheduler';
export interface ActorActionsRoot extends ActorActionSchedulerState {
  nextActionId: number;
}
export const createActorActionsRoot = (): ActorActionsRoot => ({
  schema: 1,
  nextActionId: 1,
  bundles: []
});
export function validateActorActionsRoot(
  value: unknown,
  combat: boolean,
  world: boolean
): asserts value is ActorActionsRoot {
  validateActorActionSchedulerState(value);
  const root = value as ActorActionsRoot;
  if (
    Object.keys(root).sort().join(',') !== 'bundles,nextActionId,schema' ||
    !Number.isSafeInteger(root.nextActionId) ||
    root.nextActionId < 1 ||
    root.bundles.some(
      (b) =>
        b.actionId >= root.nextActionId ||
        (b.owner === 'combat' && !combat) ||
        (b.owner === 'foundation' && !world)
    )
  )
    throw new Error('Invalid actorActions root identity or owner');
}
