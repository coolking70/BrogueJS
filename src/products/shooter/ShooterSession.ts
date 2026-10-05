import {
    createActorActionBundle, createActorActionScheduler, validateActorActionSchedulerState,
    type ActorActionScheduler, type ActorActionSchedulerState,
} from '../../engine/Core/ActorActionScheduler';
import { Random, RNGType, type RandomState } from '../../engine/RandomSource';
import { advanceActorActionsOneTick } from '../../engine/Simulation/ActorActionTick';
import type { SimulationCore } from '../../engine/Simulation/SimulationHost';
import { SHOOTER_PROFILE } from './profile';
import { createShooterArena, SHOOTER_ARENA_ID } from './ShooterArena';
import { circleIsFree, moveCircle } from '../../engine/Movement/KinematicCollision';
import { SpatialHash } from '../../engine/Movement/SpatialHash';
import { gridEnvironmentContacts, type EnvironmentContact } from '../../engine/Movement/KinematicSpatial';
import { worldToCell, movementDelta, MOTION_CREDIT, type KinematicPose, type WorldPoint } from '../../engine/Movement/WorldUnits';

export const SHOOTER_MOVE_SPEED = 160;
export const SHOOTER_BODY_RADIUS = 280;
import { PULSE_BUTTON, validateInputFrame, type InputFrame } from './input/InputFrame';

export const MAX_SHOOTER_TICKS = 108_000;
const FORMAT = 'broguejs-shooter-s1';
export interface ProbeActor {
    id: number;
    ticksUntilTurn: number;
    resolved: number;
    lastPulseTick: number;
    pulseValue: number;
    pose: KinematicPose;
    loc: WorldPoint;
    radius: number;
    motionCredit: WorldPoint;
    contacts: EnvironmentContact[];
    contactTicks: { water: number; fire: number; gas: number };
}
export interface ShooterSnapshot {
    format: typeof FORMAT;
    version: 2;
    product: string;
    simulation: string;
    ticksPerSecond: number;
    modules: string[];
    arena: typeof SHOOTER_ARENA_ID;
    seed: number;
    tick: number;
    nextActionId: number;
    actors: ProbeActor[];
    actions: ActorActionSchedulerState;
    rng: RandomState;
}
export interface ShooterReplay {
    format: 'broguejs-shooter-s1-replay';
    version: 2;
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
    if (!record(value, ['format', 'version', 'product', 'simulation', 'ticksPerSecond', 'modules', 'arena', 'seed', 'tick', 'nextActionId', 'actors', 'actions', 'rng'])
        || value.format !== FORMAT || value.version !== SHOOTER_PROFILE.version
        || value.product !== SHOOTER_PROFILE.id || value.simulation !== SHOOTER_PROFILE.simulation.id
        || value.ticksPerSecond !== SHOOTER_PROFILE.simulation.ticksPerSecond
        || value.arena !== SHOOTER_ARENA_ID
        || !Array.isArray(value.modules) || value.modules.length !== 0
        || !integer(value.seed, 1, 0xffffffff) || !integer(value.tick, 0, MAX_SHOOTER_TICKS)
        || !integer(value.nextActionId, 1, MAX_SHOOTER_TICKS * 2 + 1)
        || !Array.isArray(value.actors) || value.actors.length !== 2
        || !Random.isState(value.rng) || value.rng.currentRNG !== RNGType.RNG_SUBSTANTIVE)
        throw new Error('Invalid or incompatible S1 snapshot');
    for (const [index, actor] of value.actors.entries()) {
        if (!record(actor, ['id', 'ticksUntilTurn', 'resolved', 'lastPulseTick', 'pulseValue', 'pose', 'loc', 'radius', 'motionCredit', 'contacts', 'contactTicks'])
            || actor.id !== index + 1 || !integer(actor.ticksUntilTurn, 0, 30)
            || !integer(actor.resolved, 0, value.tick * 2) || !integer(actor.lastPulseTick, 0, value.tick)
            || !integer(actor.pulseValue, 0, 255)) throw new Error('Invalid S1 actor');
        if (!record(actor.pose, ['x', 'y', 'facing']) || !integer(actor.pose.x, 0, 40 * 1024)
            || !integer(actor.pose.y, 0, 28 * 1024) || !integer(actor.pose.facing, 0, 4095)
            || actor.radius !== SHOOTER_BODY_RADIUS || !record(actor.loc, ['x', 'y'])
            || actor.loc.x !== Math.floor(actor.pose.x / 1024) || actor.loc.y !== Math.floor(actor.pose.y / 1024)
            || !record(actor.motionCredit, ['x', 'y']) || !integer(actor.motionCredit.x, -MOTION_CREDIT + 1, MOTION_CREDIT - 1)
            || !integer(actor.motionCredit.y, -MOTION_CREDIT + 1, MOTION_CREDIT - 1)
            || !record(actor.contactTicks, ['water', 'fire', 'gas'])
            || !['water', 'fire', 'gas'].every(key => integer((actor.contactTicks as Record<string, unknown>)[key], 0, value.tick as number))
            || !Array.isArray(actor.contacts) || actor.contacts.some(contact => !record(contact, ['x', 'y', 'water', 'fire', 'gas'])
                || !integer(contact.x, 0, 39) || !integer(contact.y, 0, 27)
                || typeof contact.water !== 'boolean' || typeof contact.fire !== 'boolean' || typeof contact.gas !== 'boolean'))
            throw new Error('Invalid S1 position or environment state');
    }
    const grid = createShooterArena(), bodies = new SpatialHash();
    const actors = value.actors as unknown as ProbeActor[];
    for (const actor of actors) bodies.upsert(actor);
    for (const actor of actors) {
        if (!circleIsFree({ grid, bodies }, actor.pose, actor.radius, actor.id)
            || canonicalState(actor.contacts) !== canonicalState(gridEnvironmentContacts(grid, actor.pose, actor.radius)))
            throw new Error('Invalid S1 penetration or contact mirror');
    }
    validateActorActionSchedulerState(value.actions);
    for (const bundle of value.actions.bundles) {
        if (bundle.actionId >= value.nextActionId || bundle.elapsedActionTicks > value.tick
            || bundle.decisionOwnerId > 2 || bundle.depth !== 1) throw new Error('Invalid S1 action identity');
    }
    for (const actor of value.actors as unknown as ProbeActor[]) {
        if (!value.actions.bundles.some(bundle => bundle.decisionOwnerId === actor.id) && actor.ticksUntilTurn !== 0)
            throw new Error('Idle S1 actor has a nonzero timer');
    }
}

/** S1 owns continuous poses and consumes the real Grid, production action
 * scheduler and instance RNG. It does not run the full Game AI/environment.
 * All mechanical input, including movement, enters this recorded transaction. */
export class ShooterSession implements SimulationCore<InputFrame, ShooterSnapshot> {
    private state: ShooterSnapshot;
    private readonly grid = createShooterArena();
    private readonly bodies = new SpatialHash();
    private readonly random: Random;
    private readonly actions: ActorActionScheduler;
    private readonly origin: ShooterSnapshot;
    private readonly frames: InputFrame[] = [];
    private fault: Error | null = null;
    private advancing = false;

    constructor(seed = 7301, restored?: ShooterSnapshot) {
        if (!integer(seed, 1, 0xffffffff)) throw new Error('S1 requires an explicit nonzero uint32 seed');
        this.random = new Random(seed);
        if (restored) validateSnapshot(restored);
        this.state = restored ? structuredClone(restored) : {
            format: FORMAT, version: 2, product: SHOOTER_PROFILE.id, simulation: SHOOTER_PROFILE.simulation.id,
            ticksPerSecond: SHOOTER_PROFILE.simulation.ticksPerSecond, modules: [], arena: SHOOTER_ARENA_ID, seed, tick: 0, nextActionId: 1,
            actors: [1, 2].map(id => {
                const pose = { x: (id === 1 ? 5.5 : 10.5) * 1024, y: (id === 1 ? 10.5 : 11.5) * 1024, facing: 0 };
                return { id, ticksUntilTurn: 0, resolved: 0, lastPulseTick: 0, pulseValue: 0, pose, loc: worldToCell(pose),
                    radius: SHOOTER_BODY_RADIUS, motionCredit: { x: 0, y: 0 },
                    contacts: gridEnvironmentContacts(this.grid, pose, SHOOTER_BODY_RADIUS), contactTicks: { water: 0, fire: 0, gas: 0 } };
            }),
            actions: { schema: 1, bundles: [] }, rng: this.random.getState(),
        };
        this.random.setState(this.state.rng);
        const actor = (id: number) => this.state.actors.find(candidate => candidate.id === id);
        this.actions = createActorActionScheduler(this.state.actions, {
            decisionOwnerId: id => id,
            readActor: id => { const a = actor(id); return a ? { alive: true, ticksUntilTurn: a.ticksUntilTurn } : null; },
            writeOwnerTicks: (id, ticks) => { actor(id)!.ticksUntilTurn = ticks; },
            isSourceValid: (source, depth) => depth === 1 && !!actor(source.sourceEntityId)
                && source.sourcePartId === 'body' && source.sourceFootprintVersion === 's1-circle-v1',
            resolveSegment: boundary => {
                const target = actor(boundary.decisionOwnerId)!;
                target.resolved++;
                target.lastPulseTick = this.state.tick;
                target.pulseValue = this.random.randRange(1, 255);
            },
            finishAction: () => { /* Scheduler already cleared the sole timer mirror. */ },
            onFault: error => { this.fault = error; },
        });
        for (const actor of this.state.actors) this.bodies.upsert(actor);
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
            subactions: [{ sourceEntityId: owner, sourcePartId: 'body', sourceFootprintVersion: 's1-circle-v1', phases: [
                { kind: 'windup', durationTicks: owner === 1 ? 6 : 9, segmentIndex: 0 },
                { kind: 'inter-segment', durationTicks: 3, segmentIndex: 1 },
                { kind: 'recovery', durationTicks: 18, segmentIndex: null },
            ] }],
        }));
    }

    advanceTick(input: InputFrame): void {
        this.check();
        if (this.advancing) throw new Error('Reentrant S1 tick');
        if (this.tick >= MAX_SHOOTER_TICKS) throw new Error('S1 recording duration budget exhausted');
        validateInputFrame(input, this.tick + 1);
        const accepted = { ...input };
        this.advancing = true;
        try {
            this.state.tick++;
            const player = this.state.actors[0]!;
            const speed = player.contacts.some(contact => contact.water) ? SHOOTER_MOVE_SPEED / 2 : SHOOTER_MOVE_SPEED;
            const delta = movementDelta(accepted.moveX, accepted.moveY, speed, player.motionCredit);
            const moved = moveCircle({ grid: this.grid, bodies: this.bodies }, player.pose, player.radius, delta, player.id);
            if (moved.x - player.pose.x !== delta.x) player.motionCredit.x = 0;
            if (moved.y - player.pose.y !== delta.y) player.motionCredit.y = 0;
            player.pose.x = moved.x; player.pose.y = moved.y;
            if (accepted.moveX || accepted.moveY) player.pose.facing =
                [2560, 3072, 3584, 2048, 0, 0, 1536, 1024, 512][(Math.sign(accepted.moveY) + 1) * 3 + Math.sign(accepted.moveX) + 1]!;
            player.loc = worldToCell(player.pose);
            this.bodies.upsert(player);
            // Objective 30 Hz contact clock: one exposure tick per category,
            // regardless of movement, render cadence or how many cells overlap.
            for (const actor of this.state.actors) {
                actor.contacts = gridEnvironmentContacts(this.grid, actor.pose, actor.radius);
                for (const kind of ['water', 'fire', 'gas'] as const)
                    if (actor.contacts.some(contact => contact[kind])) actor.contactTicks[kind]++;
            }
            // Decision ordering is explicit and stable, before the one-tick decrement.
            if (accepted.buttons & PULSE_BUTTON) this.startAction(1);
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
        if (this.advancing) throw new Error('Snapshot during S1 tick');
        return { ...structuredClone(this.state), actions: this.actions.snapshot(), rng: this.random.getState() };
    }
    exportReplay(): ShooterReplay {
        return { format: 'broguejs-shooter-s1-replay', version: 2,
            initial: structuredClone(this.origin), frames: structuredClone(this.frames), final: this.snapshot() };
    }
}

/** Replay constructs a fresh session. Rejected data never retires a running session. */
export function replayShooter(value: unknown): ShooterSession {
    if (!record(value, ['format', 'version', 'initial', 'frames', 'final'])
        || value.format !== 'broguejs-shooter-s1-replay' || value.version !== 2
        || !Array.isArray(value.frames) || value.frames.length > MAX_SHOOTER_TICKS) throw new Error('Invalid S1 replay');
    validateSnapshot(value.initial);
    validateSnapshot(value.final);
    if (value.initial.tick + value.frames.length !== value.final.tick) throw new Error('Incomplete S1 replay');
    const initialTick = value.initial.tick;
    value.frames.forEach((frame, index) => validateInputFrame(frame, initialTick + index + 1));
    const session = ShooterSession.fromSnapshot(value.initial);
    for (const frame of value.frames as InputFrame[]) session.advanceTick(frame);
    if (canonicalState(session.snapshot()) !== canonicalState(value.final)) throw new Error('S1 replay state mismatch');
    return session;
}
