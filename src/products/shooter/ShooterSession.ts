import {
    createActorActionBundle, createActorActionScheduler, validateActorActionSchedulerState,
    type ActorActionScheduler, type ActorActionSchedulerState,
} from '../../engine/Core/ActorActionScheduler';
import { Random, RNGType, type RandomState } from '../../engine/RandomSource';
import { advanceActorActionsOneTick } from '../../engine/Simulation/ActorActionTick';
import type { SimulationCore } from '../../engine/Simulation/SimulationHost';
import { SHOOTER_PROFILE } from './profile';
import { S0_PULSE_BUTTON, validateInputFrame, type InputFrame } from './input/InputFrame';

export const MAX_S0_TICKS = 108_000;
const FORMAT = 'broguejs-shooter-s0';
interface ProbeActor {
    id: number;
    ticksUntilTurn: number;
    resolved: number;
    lastPulseTick: number;
    pulseValue: number;
}
export interface ShooterSnapshot {
    format: typeof FORMAT;
    version: 1;
    product: string;
    simulation: string;
    ticksPerSecond: number;
    modules: string[];
    seed: number;
    tick: number;
    nextActionId: number;
    actors: ProbeActor[];
    actions: ActorActionSchedulerState;
    rng: RandomState;
}
export interface ShooterReplay {
    format: 'broguejs-shooter-s0-replay';
    version: 1;
    initial: ShooterSnapshot;
    frames: InputFrame[];
    final: ShooterSnapshot;
}

function record(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    return Reflect.ownKeys(value).length === keys.length && keys.every(key => {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        return descriptor?.enumerable && 'value' in descriptor;
    });
}
function integer(value: unknown, min: number, max: number): value is number {
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}

/** Stable comparison of known JSON data; independent of property insertion order. */
export function canonicalState(value: unknown): string {
    const normalize = (item: unknown): unknown => {
        if (Array.isArray(item)) return item.map(normalize);
        if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item)
            .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, child]) => [key, normalize(child)]));
        return item;
    };
    return JSON.stringify(normalize(value));
}

function validateSnapshot(value: unknown): asserts value is ShooterSnapshot {
    if (!record(value, ['format', 'version', 'product', 'simulation', 'ticksPerSecond', 'modules', 'seed', 'tick', 'nextActionId', 'actors', 'actions', 'rng'])
        || value.format !== FORMAT || value.version !== SHOOTER_PROFILE.version
        || value.product !== SHOOTER_PROFILE.id || value.simulation !== SHOOTER_PROFILE.simulation.id
        || value.ticksPerSecond !== SHOOTER_PROFILE.simulation.ticksPerSecond
        || !Array.isArray(value.modules) || value.modules.length !== 0
        || !integer(value.seed, 1, 0xffffffff) || !integer(value.tick, 0, MAX_S0_TICKS)
        || !integer(value.nextActionId, 1, MAX_S0_TICKS * 2 + 1)
        || !Array.isArray(value.actors) || value.actors.length !== 2
        || !Random.isState(value.rng) || value.rng.currentRNG !== RNGType.RNG_SUBSTANTIVE)
        throw new Error('Invalid or incompatible S0 snapshot');
    for (const [index, actor] of value.actors.entries()) {
        if (!record(actor, ['id', 'ticksUntilTurn', 'resolved', 'lastPulseTick', 'pulseValue'])
            || actor.id !== index + 1 || !integer(actor.ticksUntilTurn, 0, 30)
            || !integer(actor.resolved, 0, value.tick * 2) || !integer(actor.lastPulseTick, 0, value.tick)
            || !integer(actor.pulseValue, 0, 255)) throw new Error('Invalid S0 actor');
    }
    validateActorActionSchedulerState(value.actions);
    for (const bundle of value.actions.bundles) {
        if (bundle.actionId >= value.nextActionId || bundle.elapsedActionTicks > value.tick
            || bundle.decisionOwnerId > 2 || bundle.depth !== 1) throw new Error('Invalid S0 action identity');
    }
    for (const actor of value.actors as unknown as ProbeActor[]) {
        if (!value.actions.bundles.some(bundle => bundle.decisionOwnerId === actor.id) && actor.ticksUntilTurn !== 0)
            throw new Error('Idle S0 actor has a nonzero timer');
    }
}

/** S0 deliberately supplies only two stationary diagnostic actors. This consumes
 * the production ActorActionScheduler and instance-local engine RNG. It does not
 * claim to advance Game's terrain, AI, hunger or native subjective turn effects.
 * All input, including diagnostics, goes through this recorded tick transaction.
 */
export class ShooterSession implements SimulationCore<InputFrame, ShooterSnapshot> {
    private state: ShooterSnapshot;
    private readonly random: Random;
    private readonly actions: ActorActionScheduler;
    private readonly origin: ShooterSnapshot;
    private readonly frames: InputFrame[] = [];
    private fault: Error | null = null;
    private advancing = false;

    constructor(seed = 7301, restored?: ShooterSnapshot) {
        if (!integer(seed, 1, 0xffffffff)) throw new Error('S0 requires an explicit nonzero uint32 seed');
        this.random = new Random(seed);
        if (restored) validateSnapshot(restored);
        this.state = restored ? structuredClone(restored) : {
            format: FORMAT, version: 1, product: SHOOTER_PROFILE.id, simulation: SHOOTER_PROFILE.simulation.id,
            ticksPerSecond: SHOOTER_PROFILE.simulation.ticksPerSecond, modules: [], seed, tick: 0, nextActionId: 1,
            actors: [1, 2].map(id => ({ id, ticksUntilTurn: 0, resolved: 0, lastPulseTick: 0, pulseValue: 0 })),
            actions: { schema: 1, bundles: [] }, rng: this.random.getState(),
        };
        this.random.setState(this.state.rng);
        const actor = (id: number) => this.state.actors.find(candidate => candidate.id === id);
        this.actions = createActorActionScheduler(this.state.actions, {
            decisionOwnerId: id => id,
            readActor: id => { const a = actor(id); return a ? { alive: true, ticksUntilTurn: a.ticksUntilTurn } : null; },
            writeOwnerTicks: (id, ticks) => { actor(id)!.ticksUntilTurn = ticks; },
            isSourceValid: (source, depth) => depth === 1 && !!actor(source.sourceEntityId)
                && source.sourcePartId === 'body' && source.sourceFootprintVersion === 's0-stationary-v1',
            resolveSegment: boundary => {
                const target = actor(boundary.decisionOwnerId)!;
                target.resolved++;
                target.lastPulseTick = this.state.tick;
                target.pulseValue = this.random.randRange(1, 255);
            },
            finishAction: () => { /* Scheduler already cleared the sole timer mirror. */ },
            onFault: error => { this.fault = error; },
        });
        this.origin = this.snapshot();
    }

    static fromSnapshot(value: unknown): ShooterSession {
        validateSnapshot(value);
        return new ShooterSession(value.seed, value);
    }
    get tick(): number { return this.state.tick; }
    private check(): void { if (this.fault) throw this.fault; }

    private startAction(owner: number): void {
        if (this.actions.isBusy(owner)) return; // Busy input is consumed once, never deferred.
        this.actions.commitBundle(createActorActionBundle({
            actionId: this.state.nextActionId++, depth: 1, decisionOwnerId: owner, timeChargeOwnerId: owner,
            subactions: [{ sourceEntityId: owner, sourcePartId: 'body', sourceFootprintVersion: 's0-stationary-v1', phases: [
                { kind: 'windup', durationTicks: owner === 1 ? 6 : 9, segmentIndex: 0 },
                { kind: 'inter-segment', durationTicks: 3, segmentIndex: 1 },
                { kind: 'recovery', durationTicks: 18, segmentIndex: null },
            ] }],
        }));
    }

    advanceTick(input: InputFrame): void {
        this.check();
        if (this.advancing) throw new Error('Reentrant S0 tick');
        if (this.tick >= MAX_S0_TICKS) throw new Error('S0 recording duration budget exhausted');
        validateInputFrame(input, this.tick + 1);
        const accepted = { ...input };
        this.advancing = true;
        try {
            this.state.tick++;
            // Decision ordering is explicit and stable, before the one-tick decrement.
            if (accepted.buttons & S0_PULSE_BUTTON) this.startAction(1);
            if ((this.tick - 1) % 60 === 0) this.startAction(2);
            advanceActorActionsOneTick(this.actions, this.state.actors.map(actor => actor.id));
            this.state.rng = this.random.getState();
            this.frames.push(accepted);
        } catch (error) {
            this.fault = error instanceof Error ? error : new Error(String(error));
            throw this.fault;
        } finally { this.advancing = false; }
    }

    snapshot(): ShooterSnapshot {
        this.check();
        if (this.advancing) throw new Error('Snapshot during S0 tick');
        return { ...structuredClone(this.state), actions: this.actions.snapshot(), rng: this.random.getState() };
    }
    exportReplay(): ShooterReplay {
        return { format: 'broguejs-shooter-s0-replay', version: 1,
            initial: structuredClone(this.origin), frames: structuredClone(this.frames), final: this.snapshot() };
    }
}

/** Replay constructs a fresh session. Rejected data never retires a running session. */
export function replayShooter(value: unknown): ShooterSession {
    if (!record(value, ['format', 'version', 'initial', 'frames', 'final'])
        || value.format !== 'broguejs-shooter-s0-replay' || value.version !== 1
        || !Array.isArray(value.frames) || value.frames.length > MAX_S0_TICKS) throw new Error('Invalid S0 replay');
    validateSnapshot(value.initial);
    validateSnapshot(value.final);
    if (value.initial.tick + value.frames.length !== value.final.tick) throw new Error('Incomplete S0 replay');
    const initialTick = value.initial.tick;
    value.frames.forEach((frame, index) => validateInputFrame(frame, initialTick + index + 1));
    const session = ShooterSession.fromSnapshot(value.initial);
    for (const frame of value.frames as InputFrame[]) session.advanceTick(frame);
    if (canonicalState(session.snapshot()) !== canonicalState(value.final)) throw new Error('S0 replay state mismatch');
    return session;
}
