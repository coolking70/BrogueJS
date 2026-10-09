/** Optional foundation clock for bounded, persistent actor action bundles.
 * The supplied state owns every countdown. This object only indexes that state;
 * it neither owns a second clock nor installs a gameplay/content provider.
 */
export const MAX_PARALLEL_ACTOR_ACTIONS = 4;
export const MAX_ACTOR_ACTION_PHASES = 64;
export const MAX_ACTOR_ACTION_BUNDLES = 4096;
export const MAX_ACTOR_ACTION_TICKS = 1_000_000;

export type ActorActionPhaseKind = 'windup' | 'inter-segment' | 'recovery' | 'break-recovery';
export interface ActorActionPhase {
    kind: ActorActionPhaseKind;
    durationTicks: number;
    /** Null phases only consume time; non-null phases resolve this segment at their end. */
    segmentIndex: number | null;
}
export interface ActorSubactionDefinition {
    sourceEntityId: number;
    sourcePartId: string;
    /** Present only for a registered composite slot; generation zero is live. */
    sourceGeneration?: number;
    sourceFootprintVersion: string;
    phases: ActorActionPhase[];
}
export interface ActorSubaction extends ActorSubactionDefinition {
    /** Cumulative native surprise delay, included in the terminal phase's
     * duration. A receipt for codec attestation, never another countdown. */
    nativeRecoveryDelayTicks?: number;
    sourceSubactionId: number;
    phaseIndex: number;
    phaseRemainingTicks: number;
    cancelled: boolean;
}
export interface ActorActionBundle {
    owner: 'combat' | 'foundation';
    actionId: number;
    depth: number;
    decisionOwnerId: number;
    timeChargeOwnerId: number;
    elapsedActionTicks: number;
    subactions: ActorSubaction[];
}
export interface ActorActionSchedulerState { schema: 1; bundles: ActorActionBundle[] }
export interface ActorActionBundleDefinition {
    owner: 'combat' | 'foundation';
    actionId: number;
    depth: number;
    decisionOwnerId: number;
    timeChargeOwnerId: number;
    subactions: ActorSubactionDefinition[];
}
export interface ActorActionBoundary {
    readonly actionId: number;
    readonly depth: number;
    readonly decisionOwnerId: number;
    readonly timeChargeOwnerId: number;
    readonly sourceSubactionId: number;
    readonly sourceEntityId: number;
    readonly sourcePartId: string;
    readonly sourceGeneration?: number;
    readonly segmentIndex: number;
    readonly elapsedActionTicks: number;
}
export type ActorActionDispatch = 'handled' | 'blocked' | 'native-fallback';
export interface ActorActionSchedulerPort {
    isDecisionOwner(entityId: number): boolean;
    isBusy(ownerId: number): boolean;
    nextActionBoundary(): number | null;
    advanceActionTime(delta: number): void;
    dispatchActorBoundary(ownerId: number): ActorActionDispatch;
    cancelDeadActions(): void;
}
export interface ActorActionClock { readonly ticksUntilTurn: number; readonly alive: boolean }
export interface ActorActionSchedulerHost {
    /** Optional native outer commit: includes phase transitions and fault state,
     * not only the resolver callback halfway through a segment release. */
    transaction?<T>(work:()=>T):T;
    /** Independent creatures map to themselves; composite members map to their core. */
    decisionOwnerId(entityId: number): number;
    readActor(entityId: number): ActorActionClock | null;
    writeOwnerTicks(ownerId: number, ticks: number): void;
    /** Engine-owned synchronous resolution. Never pass a module a writable world here. */
    resolveSegment(boundary: Readonly<ActorActionBoundary>): void;
    /** One terminal notification, including actual elapsed ticks for the native sweep. */
    finishAction(bundle: ReadonlyActorActionBundle, reason: 'completed' | 'source-invalid'): void;
    /** Read-only layer/generation/mechanical identity validation. False retires a
     * source; active displacement/interrupt recovery is a separate future capability. */
    isSourceValid(source: Readonly<ActorSubaction>, depth: number): boolean;
    /** Production clock advances only the foreground layer; cached countdowns freeze. */
    isDepthActive?(depth: number): boolean;
    /** Trusted production may freeze a registered raid action intact. */
    preserveOnDepthExit?(bundle: ReadonlyActorActionBundle): boolean;
    actorDepth?(entityId: number): number | null;
    /** Source changes may cancel pending segments into bounded positive recovery. */
    sourceInterruption?(source: Readonly<ActorSubaction>, bundle: ReadonlyActorActionBundle): { recoveryTicks: number } | null;
    interrupted?(source: Readonly<ActorSubaction>, bundle: ReadonlyActorActionBundle): void;
    leftDepth?(bundle: ReadonlyActorActionBundle): void;
    abandoned?(bundle: ReadonlyActorActionBundle): void;
    elapsed?(delta: number): void;
    advanced?():void;
    changed?():void;
    /** Must invalidate the enclosing recording/run on an unrolled-back engine exception. */
    onFault(error: Error): void;
}
export type ReadonlyActorActionBundle = Readonly<Omit<ActorActionBundle, 'subactions'>> & {
    readonly subactions: readonly (Readonly<Omit<ActorSubaction, 'phases'>> & {
        readonly phases: readonly Readonly<ActorActionPhase>[];
    })[];
};
export interface ActorActionScheduler extends ActorActionSchedulerPort {
    /** Trusted native hit epilogue; pending releases retain their timing. */
    delayOwnerRecovery(ownerId: number, ticks: number): boolean;
    commitBundle(bundle: ActorActionBundle): void;
    /** Trusted safe-boundary cancellation of an interruptible non-attack action. */
    retireBundle(actionId: number): void;
    snapshot(): ActorActionSchedulerState;
    /** Engine lifecycle transition; callers may not supply a second clock. */
    interruptDepth(depth: number): void;
    refreshMirrors(): void;
    /** Read-only validation precedes replacing the binding; load emits no effects. */
    rebind(state: ActorActionSchedulerState): void;
    /** Internal synchronous native transaction checkpoint; no state codec relaxation. */
    checkpointTransaction(): () => void;
}

function fail(message: string): never { throw new Error(`Actor action scheduler: ${message}`); }
function synchronous(value: unknown): void {
    if (value && (typeof value === 'object' || typeof value === 'function') && 'then' in value) fail('asynchronous host callback');
}
function integer(value: unknown, minimum: number, maximum = Number.MAX_SAFE_INTEGER): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}
function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)
        || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const own = Reflect.ownKeys(value);
    return own.length === keys.length && keys.every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return !!descriptor && descriptor.enumerable === true && 'value' in descriptor;
    });
}
function dataArray(value: unknown): value is unknown[] {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
        || Reflect.ownKeys(value).length !== value.length + 1) return false;
    for (let index = 0; index < value.length; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, index);
        if (!descriptor || descriptor.enumerable !== true || !('value' in descriptor)) return false;
    }
    return true;
}
const comparePart = (a: ActorSubactionDefinition, b: ActorSubactionDefinition): number =>
    a.sourcePartId < b.sourcePartId ? -1 : a.sourcePartId > b.sourcePartId ? 1 : a.sourceEntityId - b.sourceEntityId;
function active(child: ActorSubaction): boolean { return child.phaseIndex < child.phases.length; }
export function actorSubactionHasPendingSegments(child: Readonly<ActorSubaction>): boolean {
    return child.phases.slice(child.phaseIndex).some(phase => phase.segmentIndex !== null);
}
/** Zero is transient between clock advancement and each owner's synchronous
 * dispatch, including other owners' new commits in the same tick. */
function boundaryOf(bundle: ActorActionBundle): number {
    return Math.min(...bundle.subactions.filter(active).map(child => child.phaseRemainingTicks));
}
function detached(bundle: ActorActionBundle): ActorActionBundle {
    return { ...bundle, subactions: bundle.subactions.map(child => ({ ...child, phases: child.phases.map(phase => ({ ...phase })) })) };
}
function frozen(bundle: ActorActionBundle): ReadonlyActorActionBundle {
    const copy = detached(bundle);
    for (const child of copy.subactions) {
        child.phases.forEach(Object.freeze);
        Object.freeze(child.phases);
        Object.freeze(child);
    }
    Object.freeze(copy.subactions);
    return Object.freeze(copy);
}

/** Pure codec validation. It does not repair mirrors, invoke providers or consume RNG. */
export function validateActorActionSchedulerState(value: unknown, dueBoundaries: ReadonlySet<string> = new Set()): asserts value is ActorActionSchedulerState {
    if (!record(value, ['schema', 'bundles', ...(Object.prototype.hasOwnProperty.call(value, 'nextActionId') ? ['nextActionId'] : [])]) || value.schema !== 1 || !dataArray(value.bundles)
        || value.bundles.length > MAX_ACTOR_ACTION_BUNDLES) fail('invalid state');
    const actionIds = new Set<number>();
    const owners = new Set<number>();
    for (const bundle of value.bundles) {
        if (!record(bundle, ['owner', 'actionId', 'depth', 'decisionOwnerId', 'timeChargeOwnerId', 'elapsedActionTicks', 'subactions'])
            || !['combat', 'foundation'].includes(bundle.owner as string) || !integer(bundle.actionId, 1) || !integer(bundle.depth, 1, 40) || !integer(bundle.decisionOwnerId, 1)
            || bundle.timeChargeOwnerId !== bundle.decisionOwnerId || !integer(bundle.elapsedActionTicks, 0, MAX_ACTOR_ACTION_TICKS)
            || !dataArray(bundle.subactions) || bundle.subactions.length < 1
            || bundle.subactions.length > MAX_PARALLEL_ACTOR_ACTIONS
            || actionIds.has(bundle.actionId) || owners.has(bundle.decisionOwnerId)) fail('invalid or duplicate bundle');
        actionIds.add(bundle.actionId);
        owners.add(bundle.decisionOwnerId);
        const parts = new Set<string>();
        let unfinished = false;
        let previous: ActorSubactionDefinition | undefined;
        for (const [index, child] of bundle.subactions.entries()) {
            if (!record(child, ['sourceEntityId', 'sourcePartId', 'sourceFootprintVersion', 'phases', 'sourceSubactionId', 'phaseIndex', 'phaseRemainingTicks', 'cancelled',
                ...(Object.prototype.hasOwnProperty.call(child, 'nativeRecoveryDelayTicks') ? ['nativeRecoveryDelayTicks'] : []),
                ...(Object.prototype.hasOwnProperty.call(child, 'sourceGeneration') ? ['sourceGeneration'] : [])])
                || !integer(child.sourceEntityId, 1) || typeof child.sourcePartId !== 'string'
                || (Object.prototype.hasOwnProperty.call(child, 'sourceGeneration') && child.sourceGeneration !== 0)
                || typeof child.sourceFootprintVersion !== 'string' || child.sourceFootprintVersion.length < 1 || child.sourceFootprintVersion.length > 65536
                || child.sourcePartId.length < 1 || child.sourcePartId.length > 128
                || parts.has(child.sourcePartId) || child.sourceSubactionId !== index + 1
                || !dataArray(child.phases) || child.phases.length < 1 || child.phases.length > MAX_ACTOR_ACTION_PHASES
                || typeof child.cancelled !== 'boolean' || !integer(child.phaseIndex, 0, child.phases.length) || !integer(child.phaseRemainingTicks, 0, MAX_ACTOR_ACTION_TICKS)) fail('invalid subaction');
            if (Object.prototype.hasOwnProperty.call(child, 'nativeRecoveryDelayTicks')
                && (!integer(child.nativeRecoveryDelayTicks, 1, MAX_ACTOR_ACTION_TICKS)
                    || (child.phases[child.phases.length - 1] as ActorActionPhase).durationTicks <= child.nativeRecoveryDelayTicks)) fail('invalid native recovery delay');
            parts.add(child.sourcePartId);
            let duration = 0;
            let nextSegment = 0;
            for (const [phaseIndex, phase] of child.phases.entries()) {
                if (!record(phase, ['kind', 'durationTicks', 'segmentIndex'])
                    || !integer(phase.durationTicks, 1, MAX_ACTOR_ACTION_TICKS)
                    || !['windup', 'inter-segment', 'recovery', 'break-recovery'].includes(phase.kind as string)) fail('invalid phase');
                const resolves = phase.kind === 'windup' || phase.kind === 'inter-segment';
                if (resolves ? phase.segmentIndex !== nextSegment++ : phase.segmentIndex !== null) fail('invalid segment index');
                if (phaseIndex === child.phases.length - 1 ? resolves : !resolves) fail('action must end with recovery');
                if (phaseIndex > 0 && phase.kind === 'windup') fail('repeated windup');
                duration += phase.durationTicks;
            }
            if (duration > MAX_ACTOR_ACTION_TICKS) fail('action duration budget exceeded');
            const typed = child as unknown as ActorSubaction;
            if (previous && comparePart(previous, typed) >= 0) fail('noncanonical subaction order');
            previous = typed;
            if (typed.phaseIndex === typed.phases.length) {
                if (typed.phaseRemainingTicks !== 0 || (!typed.cancelled && duration > bundle.elapsedActionTicks)) fail('invalid finished subaction');
            } else {
                unfinished = true;
                if (typed.cancelled) fail('cancelled subaction still active');
                const consumed = typed.phases.slice(0, typed.phaseIndex).reduce((sum, phase) => sum + phase.durationTicks, 0)
                    + typed.phases[typed.phaseIndex]!.durationTicks - typed.phaseRemainingTicks;
                if ((typed.phaseRemainingTicks < 1 && !dueBoundaries.has(`${bundle.actionId}:${typed.sourceSubactionId}:${typed.phaseIndex}`)) || typed.phaseRemainingTicks > typed.phases[typed.phaseIndex]!.durationTicks
                    || consumed !== bundle.elapsedActionTicks) fail('inconsistent phase clock');
            }
        }
        if (!unfinished) fail('completed bundle must be retired');
    }
}

export function createActorActionBundle(definition: ActorActionBundleDefinition): ActorActionBundle {
    if (!['combat','foundation'].includes(definition.owner) || !record(definition, ['owner', 'actionId', 'depth', 'decisionOwnerId', 'timeChargeOwnerId', 'subactions'])
        || !dataArray(definition.subactions) || definition.subactions.length > MAX_PARALLEL_ACTOR_ACTIONS) fail('invalid action definition');
    for (const child of definition.subactions) {
        if (!record(child, ['sourceEntityId', 'sourcePartId', 'sourceFootprintVersion', 'phases',
            ...(Object.prototype.hasOwnProperty.call(child, 'sourceGeneration') ? ['sourceGeneration'] : [])])
            || !integer(child.sourceEntityId, 1) || typeof child.sourcePartId !== 'string'
            || (Object.prototype.hasOwnProperty.call(child, 'sourceGeneration') && child.sourceGeneration !== 0)
            || !dataArray(child.phases) || child.phases.length > MAX_ACTOR_ACTION_PHASES
            || child.phases.some(phase => !record(phase, ['kind', 'durationTicks', 'segmentIndex']))) fail('invalid subaction definition');
    }
    const bundle: ActorActionBundle = {
        owner: definition.owner, actionId: definition.actionId, depth: definition.depth, decisionOwnerId: definition.decisionOwnerId,
        timeChargeOwnerId: definition.timeChargeOwnerId, elapsedActionTicks: 0,
        subactions: [...definition.subactions].sort(comparePart).map((child, index) => ({
            sourceEntityId: child.sourceEntityId, sourcePartId: child.sourcePartId,
            ...(child.sourceGeneration !== undefined ? { sourceGeneration: child.sourceGeneration } : {}),
            sourceFootprintVersion: child.sourceFootprintVersion, phases: child.phases.map(phase => ({ ...phase })), sourceSubactionId: index + 1,
            phaseIndex: 0, phaseRemainingTicks: child.phases[0]?.durationTicks ?? 0, cancelled: false,
        })),
    };
    validateActorActionSchedulerState({ schema: 1, bundles: [bundle] });
    return bundle;
}

export function snapshotActorActionSchedulerState(state: ActorActionSchedulerState): ActorActionSchedulerState {
    validateActorActionSchedulerState(state);
    return { schema: 1, bundles: [...state.bundles].sort((a, b) => a.decisionOwnerId - b.decisionOwnerId).map(detached) };
}

/** Binding is deliberately side-effect free, including strict native mirror validation. */
export function validateActorActionSchedulerBinding(state: ActorActionSchedulerState, host: ActorActionSchedulerHost): void {
    validateActorActionSchedulerState(state);
    for (const bundle of state.bundles) {
        const actor = host.readActor(bundle.decisionOwnerId);
        if (!actor?.alive || host.decisionOwnerId(bundle.decisionOwnerId) !== bundle.decisionOwnerId
            || actor.ticksUntilTurn !== boundaryOf(bundle)) fail('invalid owner or native timer mirror');
        for (const child of bundle.subactions) {
            if (!active(child)) continue;
            if (host.decisionOwnerId(child.sourceEntityId) !== bundle.decisionOwnerId
                || !host.readActor(child.sourceEntityId)?.alive || (actorSubactionHasPendingSegments(child) && host.isSourceValid(child, bundle.depth) !== true)) fail('invalid source binding');
        }
    }
}

export function createActorActionScheduler(initialState: ActorActionSchedulerState, host: ActorActionSchedulerHost): ActorActionScheduler {
    validateActorActionSchedulerBinding(initialState, host);
    let state = initialState;
    let fault: Error | null = null;
    let executing = false;
    function check(): void { if (fault) throw fault; }
    function run<T>(operation: () => T, publishes = false): T {
        return publishes && host.transaction ? host.transaction(()=>runOperation(operation)) : runOperation(operation);
    }
    function runOperation<T>(operation: () => T): T {
        check();
        if (executing) fail('reentrant scheduler mutation');
        executing = true;
        try { return operation(); }
        catch (error) {
            fault = error instanceof Error ? error : new Error(String(error));
            host.onFault(fault);
            throw fault;
        } finally { executing = false; host.changed?.(); }
    }
    function foreground(bundle: ActorActionBundle): boolean { return host.isDepthActive?.(bundle.depth) ?? true; }
    function bundleOf(ownerId: number): ActorActionBundle | undefined {
        return state.bundles.find(bundle => bundle.decisionOwnerId === ownerId);
    }
    function remove(bundle: ActorActionBundle): void { state.bundles.splice(state.bundles.indexOf(bundle), 1); }
    function sourceValid(child: ActorSubaction, depth: number): boolean {
        return !!host.readActor(child.sourceEntityId)?.alive && host.isSourceValid(child, depth) === true;
    }
    function mirror(bundle: ActorActionBundle): void { synchronous(host.writeOwnerTicks(bundle.timeChargeOwnerId, boundaryOf(bundle))); }
    function finish(bundle: ActorActionBundle, reason: 'completed' | 'source-invalid'): void {
        remove(bundle);
        synchronous(host.writeOwnerTicks(bundle.timeChargeOwnerId, 0));
        synchronous(host.finishAction(frozen(bundle), reason));
    }
    function abandon(bundle: ActorActionBundle): void {
        remove(bundle);
        synchronous(host.abandoned?.(frozen(bundle)));
    }
    function interrupt(child: ActorSubaction, bundle: ActorActionBundle, recoveryTicks: number): void {
        interruptActorSubaction(child,bundle,recoveryTicks);
        synchronous(host.interrupted?.(Object.freeze({ ...child, phases: child.phases.map(phase => ({ ...phase })) }), frozen(bundle)));
    }
    function cancelDead(): void {
        for (const bundle of [...state.bundles].sort((a, b) => a.decisionOwnerId - b.decisionOwnerId)) {
            if (!host.readActor(bundle.decisionOwnerId)?.alive) { abandon(bundle); continue; }
            const ownerDepth = host.actorDepth?.(bundle.decisionOwnerId);
            if (ownerDepth != null && ownerDepth !== bundle.depth) {
                synchronous(host.leftDepth?.(frozen(bundle)));
                for (const child of bundle.subactions) if (active(child) && actorSubactionHasPendingSegments(child)) {
                    const interruption = host.sourceInterruption?.(child, frozen(bundle));
                    if (!interruption) fail('missing displaced-layer interruption policy');
                    interrupt(child, bundle, interruption.recoveryTicks);
                }
                bundle.depth = ownerDepth;
            }
            let cancelled = false;
            // An invalid source is retired without a delayed release or a native member turn.
            for (const child of bundle.subactions) {
                if (!active(child)) continue;
                if (!host.readActor(child.sourceEntityId)?.alive) {
                    child.phaseIndex = child.phases.length;
                    child.phaseRemainingTicks = 0;
                    child.cancelled = true;
                    cancelled = true;
                    continue;
                }
                if (!foreground(bundle)) continue;
                const interruption = host.sourceInterruption?.(child, frozen(bundle));
                if (interruption) interrupt(child, bundle, interruption.recoveryTicks);
                else if (actorSubactionHasPendingSegments(child) && !sourceValid(child, bundle.depth)) {
                    child.phaseIndex = child.phases.length;
                    child.phaseRemainingTicks = 0;
                    child.cancelled = true;
                    cancelled = true;
                }
            }
            if (bundle.subactions.every(child => !active(child))) {
                if (cancelled) finish(bundle, 'source-invalid');
            } else mirror(bundle);
        }
    }
    return {
        delayOwnerRecovery(ownerId, ticks) {
            check();
            const bundle = bundleOf(ownerId);
            if (!bundle || !foreground(bundle)) return false;
            const children = bundle.subactions.filter(active);
            // Validate the whole batch before changing the first child.
            if (!integer(ticks, 1, MAX_ACTOR_ACTION_TICKS) || !children.length
                || children.some(child => child.phases.reduce((sum, phase) => sum + phase.durationTicks, 0) + ticks > MAX_ACTOR_ACTION_TICKS))
                fail('native recovery delay budget exceeded');
            const delay = () => {
                for (const child of children) {
                    child.nativeRecoveryDelayTicks = (child.nativeRecoveryDelayTicks ?? 0) + ticks;
                    child.phases[child.phases.length - 1]!.durationTicks += ticks;
                    if (child.phaseIndex === child.phases.length - 1) child.phaseRemainingTicks += ticks;
                }
                mirror(bundle);
                return true;
            };
            // Native damage may occur inside this scheduler's segment resolver.
            // That outer dispatch already owns the transaction/fault boundary.
            return executing ? delay() : run(delay, true);
        },
        isDecisionOwner(entityId) { check(); return host.decisionOwnerId(entityId) === entityId; },
        isBusy(ownerId) { check(); const bundle = bundleOf(ownerId); return !!bundle && foreground(bundle); },
        nextActionBoundary() {
            check();
            const boundaries = state.bundles.filter(foreground).map(boundaryOf);
            return boundaries.length ? Math.min(...boundaries) : null;
        },
        advanceActionTime(delta) {
            run(() => {
                if (!integer(delta, 1, MAX_ACTOR_ACTION_TICKS)) fail('elapsed delta must be a positive integer');
                if (state.bundles.some(bundle => foreground(bundle) && boundaryOf(bundle) < delta)) fail('elapsed delta crosses an action boundary');
                synchronous(host.elapsed?.(delta));
                for (const bundle of state.bundles.filter(foreground)) {
                    bundle.elapsedActionTicks += delta;
                    for (const child of bundle.subactions) if (active(child)) child.phaseRemainingTicks -= delta;
                    mirror(bundle);
                }
                synchronous(host.advanced?.());
            });
        },
        checkpointTransaction() { const previousFault=fault; return () => { fault=previousFault; }; },
        cancelDeadActions() { run(cancelDead); },
        retireBundle(actionId) { run(() => { const bundle = state.bundles.find(bundle => bundle.actionId === actionId); if (bundle) finish(bundle, 'source-invalid'); }); },
        dispatchActorBoundary(ownerId) {
            return run(() => {
                cancelDead();
                const bundle = bundleOf(ownerId);
                if (!bundle || !foreground(bundle)) return 'native-fallback';
                if (boundaryOf(bundle) > 0) return 'blocked';
                for (const child of bundle.subactions) {
                    if (!active(child) || child.phaseRemainingTicks !== 0) continue;
                    if (!host.readActor(ownerId)?.alive) { abandon(bundle); return 'handled'; }
                    if (actorSubactionHasPendingSegments(child) && !sourceValid(child, bundle.depth)) { child.phaseIndex = child.phases.length; child.phaseRemainingTicks = 0; child.cancelled = true; continue; }
                    const phase = child.phases[child.phaseIndex]!, releasingSegment = phase.segmentIndex;
                    if (releasingSegment !== null) synchronous(host.resolveSegment(Object.freeze({
                        actionId: bundle.actionId, depth: bundle.depth, decisionOwnerId: ownerId, timeChargeOwnerId: bundle.timeChargeOwnerId,
                        sourceSubactionId: child.sourceSubactionId, sourceEntityId: child.sourceEntityId,
                        sourcePartId: child.sourcePartId, segmentIndex: releasingSegment,
                        ...(child.sourceGeneration !== undefined ? { sourceGeneration: child.sourceGeneration } : {}),
                        elapsedActionTicks: bundle.elapsedActionTicks,
                    })));
                    if (!host.readActor(ownerId)?.alive) { abandon(bundle); return 'handled'; }
                    // A committed part-break provider may replace this release tail in
                    // the shared scheduler graph. Do not consume its new recovery.
                    if (releasingSegment !== null && child.phases[child.phaseIndex]?.kind === 'break-recovery') continue;
                    // Resolution may move/disable its own source. Observe that fact
                    // before selecting the next delayed segment, without retrying damage.
                    const interruption = host.sourceInterruption?.(child, frozen(bundle));
                    if (interruption) interrupt(child, bundle, interruption.recoveryTicks);
                    else {
                        child.phaseIndex++;
                        child.phaseRemainingTicks = child.phases[child.phaseIndex]?.durationTicks ?? 0;
                    }
                }
                cancelDead();
                if (!bundleOf(ownerId)) return 'native-fallback';
                if (bundle.subactions.every(child => !active(child))) {
                    finish(bundle, 'completed');
                    return 'native-fallback';
                }
                mirror(bundle);
                return 'handled';
            }, true);
        },
        commitBundle(bundle) {
            // Reject an invalid plan before invoking any world writes.
            check();
            validateActorActionSchedulerState({ schema: 1, bundles: [bundle] });
            const copy = detached(bundle);
            const candidate: ActorActionSchedulerState = { schema: 1, bundles: [...state.bundles, copy] };
            // An earlier owner in the same native sweep may start an action
            // before a later owner's already-due phase is dispatched. Attest
            // only existing foreground identities; the new plan and codecs
            // retain strict positive-clock validation.
            const due = new Set(state.bundles.filter(foreground).flatMap(existing => existing.subactions
                .filter(child => active(child) && !child.cancelled && child.phaseRemainingTicks === 0)
                .map(child => `${existing.actionId}:${child.sourceSubactionId}:${child.phaseIndex}`)));
            validateActorActionSchedulerState(candidate, due);
            if (copy.elapsedActionTicks !== 0 || copy.subactions.some(child => child.phaseIndex !== 0 || child.nativeRecoveryDelayTicks !== undefined)) fail('commit requires a fresh action');
            if (!host.readActor(copy.decisionOwnerId)?.alive || host.decisionOwnerId(copy.decisionOwnerId) !== copy.decisionOwnerId
                || copy.subactions.some(child => host.decisionOwnerId(child.sourceEntityId) !== copy.decisionOwnerId || !sourceValid(child, copy.depth))) fail('invalid action owner/source');
            const previousTicks = host.readActor(copy.decisionOwnerId)!.ticksUntilTurn;
            run(() => {
                state.bundles.push(copy);
                try { mirror(copy); }
                catch (error) {
                    remove(copy);
                    // A setter may have mutated before throwing. Restore the bounded
                    // mirror where possible, then invalidate this scheduler regardless.
                    try { host.writeOwnerTicks(copy.timeChargeOwnerId, previousTicks); } catch { /* original failure remains authoritative */ }
                    throw error;
                }
            });
        },
        interruptDepth(depth) {
            run(() => {
                for (const bundle of state.bundles.filter(bundle => bundle.depth === depth)) {
                    const preserve=host.preserveOnDepthExit?.(frozen(bundle));synchronous(preserve);
                    if(preserve===true)continue;
                    synchronous(host.leftDepth?.(frozen(bundle)));
                    for (const child of bundle.subactions) if (active(child) && actorSubactionHasPendingSegments(child)) {
                        const interruption = host.sourceInterruption?.(child, frozen(bundle));
                        if (!interruption) fail('missing layer interruption policy');
                        interrupt(child, bundle, interruption.recoveryTicks);
                    }
                    mirror(bundle);
                }
            });
        },
        refreshMirrors() { run(() => { cancelDead(); for (const bundle of state.bundles) mirror(bundle); }); },
        snapshot() { check(); validateActorActionSchedulerBinding(state, host); return snapshotActorActionSchedulerState(state); },
        rebind(candidate) {
            check();
            if (executing) fail('cannot rebind during dispatch');
            validateActorActionSchedulerBinding(candidate, host);
            state = candidate;
        },
    };
}

/** Trusted scheduler formula, also used by detached codec test adapters. */
export function interruptActorSubaction(child:ActorSubaction,_bundle:ActorActionBundle,recoveryTicks:number):void {
        if (!integer(recoveryTicks, 1, MAX_ACTOR_ACTION_TICKS)) fail('invalid break recovery');
        const phase = child.phases[child.phaseIndex]!;
        const consumed = phase.durationTicks - child.phaseRemainingTicks;
        const delay = child.nativeRecoveryDelayTicks ?? 0;
        const remaining = phase.segmentIndex === null ? Math.max(child.phaseRemainingTicks, recoveryTicks) : recoveryTicks + delay;
        const duration = consumed + remaining;
        const prefixDuration = child.phases.slice(0, child.phaseIndex).reduce((sum, item) => sum + item.durationTicks, 0);
        if (prefixDuration + duration > MAX_ACTOR_ACTION_TICKS) fail('break recovery budget exceeded');
        child.phases.splice(child.phaseIndex, child.phases.length - child.phaseIndex,
            { kind: 'break-recovery', durationTicks: duration, segmentIndex: null });
        child.phaseRemainingTicks = remaining;
}
