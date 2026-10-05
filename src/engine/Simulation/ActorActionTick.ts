import type { ActorActionSchedulerPort } from '../Core/ActorActionScheduler';

/** Called once per simulation tick. Busy timers are written only by the scheduler.
 * The caller supplies live entity IDs; composite members cannot receive a second turn.
 * Decisions/commits precede this step; all releases finish before publishing a snapshot.
 */
export function advanceActorActionsOneTick(actions: ActorActionSchedulerPort, entityIds: readonly number[]): void {
    const owners = [...new Set(entityIds)].filter(id => actions.isDecisionOwner(id)).sort((a, b) => a - b);
    actions.cancelDeadActions();
    actions.advanceActionTime(1);
    for (const id of owners) {
        if (actions.isBusy(id)) actions.dispatchActorBoundary(id);
    }
}
