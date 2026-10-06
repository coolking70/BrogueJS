import { withNativeActorDecisionScope, type ActorActionScope } from './ActorActionScope';
import type { ActorActionDispatch } from './ActorActionScheduler';
import type { ActorActionSchedulerPort } from './ActorActionScheduler';
/** Derived binding only. Persistent state belongs to the explicitly supplied
 * owner. Production bindings are explicitly installed by the trusted engine. */
const sessions = new WeakMap<object, ActorActionSchedulerPort>();
const selectors = new WeakMap<object, (actorId: number, scope: ActorActionScope) => ActorActionDispatch>();
const invalidFixtures = new WeakSet<object>();
const fixtureGames = new WeakSet<object>();
const productionGames = new WeakSet<object>();
const invalidProductionGames = new WeakSet<object>();
export function isProductionActorActionSession(game: object): boolean { return productionGames.has(game) && !invalidProductionGames.has(game); }
export function bindProductionActorActionSession(game: object, scheduler: ActorActionSchedulerPort,
    select?: (actorId: number, scope: ActorActionScope) => ActorActionDispatch): void {
    if (fixtureGames.has(game) || invalidProductionGames.has(game) || (sessions.has(game) && !productionGames.has(game)))
        throw new Error('Cannot bind production actor actions to a fixture or invalid run');
    sessions.set(game, scheduler); productionGames.add(game);
    if (select) selectors.set(game, select); else selectors.delete(game);
}
export function unbindProductionActorActionSession(game: object): void {
    if (productionGames.has(game)) { sessions.delete(game); selectors.delete(game); }
    productionGames.delete(game); invalidProductionGames.delete(game);
}
export function invalidateProductionActorActionSession(game: object): void { invalidProductionGames.add(game); }
export function isProductionActorActionRunInvalid(game: object): boolean { return invalidProductionGames.has(game); }
export function markActorActionFixture(game: object): void { fixtureGames.add(game); }
/** Only a validated new run may retire the previous run's diagnostic taint.
 * Unbinding a scheduler or loading a snapshot must not make a fixture exportable. */
export function retireActorActionFixtureForNewRun(game: object): void {
    fixtureGames.delete(game); invalidFixtures.delete(game);
    if (!productionGames.has(game)) { sessions.delete(game); selectors.delete(game); }
}
export function actorActionSchedulerFor(game: object): ActorActionSchedulerPort | undefined { return sessions.get(game); }
export function assertNoActorActionFixture(game: object): void {
    if ((sessions.has(game) && !productionGames.has(game)) || fixtureGames.has(game)) throw new Error('Actor action fixture is not a production save/replay capability');
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

/** Used only by the encompassing native transaction's synchronous checkpoint. */
export function restoreProductionActorActionValidity(game:object,invalid:boolean):void {
    if(invalid)invalidProductionGames.add(game);else invalidProductionGames.delete(game);
}
