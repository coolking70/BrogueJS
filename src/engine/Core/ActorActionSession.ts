import { withNativeActorDecisionScope, type ActorActionScope } from './ActorActionScope';
import type { ActorActionDispatch } from './ActorActionScheduler';
import type { ActorActionSchedulerPort } from './ActorActionScheduler';
/** Derived binding only. Persistent state belongs to the explicitly supplied
 * fixture owner. Production combat is inert until its complete lifecycle exists. */
const sessions = new WeakMap<object, ActorActionSchedulerPort>();
const selectors = new WeakMap<object, (actorId: number, scope: ActorActionScope) => ActorActionDispatch>();
const invalidFixtures = new WeakSet<object>();
const fixtureGames = new WeakSet<object>();
export function markActorActionFixture(game: object): void { fixtureGames.add(game); }
export function actorActionSchedulerFor(game: object): ActorActionSchedulerPort | undefined { return sessions.get(game); }
export function assertNoActorActionFixture(game: object): void {
    if (sessions.has(game) || fixtureGames.has(game)) throw new Error('Actor action fixture is not a production save/replay capability');
}
export function withActorActionScheduler<T>(game: object, scheduler: ActorActionSchedulerPort, perform: () => T, select?: (actorId: number, scope: ActorActionScope) => ActorActionDispatch): T {
    if (sessions.has(game) || invalidFixtures.has(game)) throw new Error('Actor action scheduler already bound or fixture invalidated');
    fixtureGames.add(game);
    sessions.set(game, scheduler);
    if (select) selectors.set(game, select);
    try {
        const result = perform();
        if (result && typeof (result as { then?: unknown }).then === 'function')
            throw new Error('Actor action fixture cannot cross await');
        if (scheduler.nextActionBoundary() !== null) throw new Error('Actor action fixture closed with unfinished actions');
        return result;
    } catch (error) { invalidFixtures.add(game); throw error; }
    finally { sessions.delete(game); selectors.delete(game); }
}

/** Game invokes this only after an unconsumed native prelude, under the scheduler's gates. */
export function selectNativeActorAction(game: object, actorId: number): ActorActionDispatch {
    const select = selectors.get(game);
    return select ? withNativeActorDecisionScope(game, actorId, scope => select(actorId, scope)) : 'native-fallback';
}
