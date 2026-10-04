/** Engine-owned synchronous authority. Never included in an extension context,
 * a prepared DTO, a save, or a yielded confirmation. */
export type ActorActionOrigin = 'player-command' | 'npc-scheduler';
declare const authority: unique symbol;
export interface ActorActionScope { readonly [authority]: true }
const active = new WeakMap<object, { owner: object; origin: ActorActionOrigin; actorId: number; nativeDecision: boolean }>();
export function assertActorActionScope(scope: ActorActionScope, owner: object, actorId: number,
    origin?: ActorActionOrigin): void {
    const value = active.get(scope);
    if (!value || value.owner !== owner || value.actorId !== actorId || (origin && value.origin !== origin))
        throw new Error('Closed or unauthorized actor action scope');
}
/** Only trusted engine coordinators call this; modules receive finite DTOs only. */
export function withActorActionScope<T>(owner: object, origin: ActorActionOrigin, actorId: number,
    perform: (scope: ActorActionScope) => T): T {
    if (!Number.isSafeInteger(actorId) || actorId <= 0 || !['player-command', 'npc-scheduler'].includes(origin))
        throw new Error('Invalid actor action authority');
    const scope = Object.freeze({}) as ActorActionScope;
    active.set(scope, { owner, origin, actorId, nativeDecision: false });
    try {
        const result = perform(scope);
        if (result && typeof (result as { then?: unknown }).then === 'function')
            throw new Error('Actor action authority cannot cross await');
        return result;
    } finally { active.delete(scope); }
}

/** Called only by the scheduler's post-prelude free-decision bridge. */
export function withNativeActorDecisionScope<T>(owner: object, actorId: number, perform: (scope: ActorActionScope) => T): T {
    return withActorActionScope(owner, 'npc-scheduler', actorId, scope => {
        active.get(scope)!.nativeDecision = true;
        return perform(scope);
    });
}
export function assertNativeActorDecisionScope(scope: ActorActionScope, owner: object, actorId: number): void {
    assertActorActionScope(scope, owner, actorId, 'npc-scheduler');
    if (!active.get(scope)!.nativeDecision) throw new Error('NPC actor action requires the native decision prelude');
}
