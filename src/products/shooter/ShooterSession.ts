import type { SimulationCore } from '../../engine/Simulation/SimulationHost';
import { dataArray, integer, record } from '../../engine/Simulation/Protocol';
import { DamageResolutionAuthority, validateDamageState, type DamageIntent } from '../../engine/Combat/DamageResolution';
import type { RangedRuntime, RealtimeModuleDescriptor, RuntimeManifest, WeaponCommand } from '../../engine/Simulation/RangedRuntime';
import { circleIsFree, moveCircle } from '../../engine/Movement/KinematicCollision';
import { SpatialHash } from '../../engine/Movement/SpatialHash';
import { raycast } from '../../engine/Movement/SpatialQuery';
import { gridEnvironmentContacts } from '../../engine/Movement/KinematicSpatial';
import { worldToCell, movementDelta, MOTION_CREDIT } from '../../engine/Movement/WorldUnits';
import { getRealtimeModules } from '../../ext/realtimeCatalog';
import { SHOOTER_PROFILE } from './profile';
import { createShooterArena, SHOOTER_ARENA_ID } from './ShooterArena';
import { FIRE_BUTTON, validateInputFrame, type InputFrame } from './input/InputFrame';
import { validateWeaponCommand } from './input/WeaponCommand';
import { canonicalState, MAX_SHOOTER_TICKS, SHOOTER_BODY_RADIUS, SHOOTER_MOVE_SPEED, SPAWNS,
    type ShooterActor, type ShooterReplay, type ShooterSnapshot } from './ShooterState';
export { canonicalState, MAX_SHOOTER_TICKS, SHOOTER_BODY_RADIUS, SHOOTER_MOVE_SPEED } from './ShooterState';
export type { ShooterActor, ShooterReplay, ShooterSnapshot } from './ShooterState';

const manifest = (d: RealtimeModuleDescriptor): RuntimeManifest => ({ id: d.id, version: d.version, rules: { ...d.rules } });
/** Reject executable/sparse/cyclic input before cloning or visiting values. */
function finiteData(value: unknown, depth = 0, seen = new Set<object>()): boolean {
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
    if (typeof value === 'number') return Number.isFinite(value);
    if (!value || typeof value !== 'object' || depth > 24 || seen.has(value)) return false;
    seen.add(value);
    const array = Array.isArray(value);
    if (array ? !dataArray(value, 10000) : ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    const keys = Reflect.ownKeys(value).filter(k => !(array && k === 'length'));
    const valid = keys.length <= 10000 && keys.every(k => {
        const d = Object.getOwnPropertyDescriptor(value, k)!;
        return typeof k === 'string' && d.enumerable && 'value' in d && finiteData(d.value, depth + 1, seen);
    });
    seen.delete(value); return valid;
}
function validateSnapshot(value: unknown, installed: readonly RealtimeModuleDescriptor[]): asserts value is ShooterSnapshot {
    if (!finiteData(value) || !record(value, ['format', 'version', 'product', 'simulation', 'ticksPerSecond', 'arena', 'modules', 'moduleStates',
        'seed', 'tick', 'actors', 'damage', 'effects', 'ranged', 'stats'])
        || value.format !== 'broguejs-shooter-s2' || value.version !== 3 || value.product !== SHOOTER_PROFILE.id
        || value.simulation !== SHOOTER_PROFILE.simulation.id || value.ticksPerSecond !== 30 || value.arena !== SHOOTER_ARENA_ID
        || !integer(value.seed, 1, 0xffffffff) || !integer(value.tick, 0, MAX_SHOOTER_TICKS)
        || !dataArray(value.modules, 1) || !dataArray(value.actors, SPAWNS.length) || value.actors.length !== SPAWNS.length
        || !dataArray(value.effects, 512) || !record(value.stats, ['kills', 'deaths', 'damageDealt', 'damageTaken'])
        || !Object.values(value.stats).every(n => integer(n, 0, MAX_SHOOTER_TICKS * 10000))) throw new Error('Invalid or incompatible S2 snapshot');
    const ids: string[] = [];
    for (const m of value.modules) {
        if (!record(m, ['id', 'version', 'rules']) || typeof m.id !== 'string' || ids.includes(m.id)) throw new Error('Invalid realtime manifest');
        const d = installed.find(d => d.id === m.id);
        if (!d || canonicalState(m) !== canonicalState(manifest(d))) throw new Error('Missing or incompatible realtime module');
        ids.push(m.id);
    }
    if (!record(value.moduleStates, ids)) throw new Error('Invalid module namespaces');
    validateDamageState(value.damage);
    if (value.damage.actors.length !== SPAWNS.length) throw new Error('Invalid health cohort');
    for (const [i, a] of value.actors.entries()) {
        const hp = value.damage.actors[i]!;
        if (!record(a, ['id', 'pose', 'loc', 'radius', 'motionCredit', 'contacts', 'contactTicks', 'respawnTick', 'attackReadyTick', 'lastHitTick'])
            || a.id !== i + 1 || !record(a.pose, ['x', 'y', 'facing']) || !integer(a.pose.x, 0, 40 * 1024)
            || !integer(a.pose.y, 0, 28 * 1024) || !integer(a.pose.facing, 0, 4095)
            || !record(a.loc, ['x', 'y']) || a.loc.x !== Math.floor(a.pose.x / 1024) || a.loc.y !== Math.floor(a.pose.y / 1024)
            || a.radius !== SHOOTER_BODY_RADIUS || !record(a.motionCredit, ['x', 'y'])
            || !Object.values(a.motionCredit).every(n => integer(n, -MOTION_CREDIT + 1, MOTION_CREDIT - 1))
            || !record(a.contactTicks, ['water', 'fire', 'gas']) || !Object.values(a.contactTicks).every(n => integer(n, 0, value.tick as number))
            || !integer(a.respawnTick, 0, value.tick + 90) || !integer(a.attackReadyTick, 0, value.tick + 30)
            || !integer(a.lastHitTick, 0, value.tick) || (hp.hp > 0 ? a.respawnTick !== 0 : a.respawnTick === 0)
            || hp.id !== a.id || hp.team !== (i === 0 ? 0 : 1) || hp.maxHp !== (i === 0 ? 100 : 70)) throw new Error('Invalid S2 actor');
    }
    for (const e of value.effects) {
        if (!record(e, ['tick', 'kind', 'from', 'to', 'radius', 'hit']) || !integer(e.tick, Math.max(0, value.tick - 11), value.tick)
            || !['tracer', 'impact', 'explosion'].includes(e.kind as string) || !integer(e.radius, 0, 8192) || typeof e.hit !== 'boolean'
            || ![e.from, e.to].every(p => record(p, ['x', 'y']) && integer(p.x, -65536, 1 << 22) && integer(p.y, -65536, 1 << 22)))
            throw new Error('Invalid combat effect');
    }
    const grid = createShooterArena(), bodies = new SpatialHash();
    const actors = value.actors as unknown as ShooterActor[], healthState = value.damage;
    actors.filter((_, i) => healthState.actors[i]!.hp > 0).forEach(a => bodies.upsert(a));
    for (const a of actors) if ((value.damage.actors[a.id - 1]!.hp > 0 && !circleIsFree({ grid, bodies }, a.pose, a.radius, a.id))
        || canonicalState(a.contacts) !== canonicalState(gridEnvironmentContacts(grid, a.pose, a.radius))) throw new Error('Invalid penetration or contact mirror');
}

export class ShooterSession implements SimulationCore<InputFrame, ShooterSnapshot> {
    private readonly state: ShooterSnapshot;
    private readonly grid = createShooterArena();
    private readonly bodies = new SpatialHash();
    private readonly damage: DamageResolutionAuthority;
    private readonly runtimes = new Map<string, RangedRuntime>();
    private readonly origin: ShooterSnapshot;
    private readonly frames: InputFrame[] = [];
    private readonly commands: WeaponCommand[] = [];
    private fault: Error | null = null;
    private advancing = false;

    constructor(seed = 7301, options: { snapshot?: ShooterSnapshot; modules?: readonly string[]; installed?: readonly RealtimeModuleDescriptor[] } = {}) {
        if (!integer(seed, 1, 0xffffffff)) throw new Error('S2 requires a nonzero uint32 seed');
        const installed = options.installed ?? getRealtimeModules(), restored = options.snapshot;
        if (restored) validateSnapshot(restored, installed);
        const ids = restored?.modules.map(m => m.id) ?? options.modules ?? installed.map(d => d.id);
        if (ids.length > 1 || new Set(ids).size !== ids.length || ids.some(id => !installed.some(d => d.id === id))) throw new Error('Unavailable realtime module');
        this.state = restored ? structuredClone(restored) : {
            format: 'broguejs-shooter-s2', version: 3, product: SHOOTER_PROFILE.id, simulation: SHOOTER_PROFILE.simulation.id,
            ticksPerSecond: 30, arena: SHOOTER_ARENA_ID, modules: ids.map(id => manifest(installed.find(d => d.id === id)!)), moduleStates: {}, seed, tick: 0,
            actors: SPAWNS.map(([x, y], i) => {
                const pose = { x: x * 1024, y: y * 1024, facing: 0 };
                return { id: i + 1, pose, loc: worldToCell(pose), radius: SHOOTER_BODY_RADIUS, motionCredit: { x: 0, y: 0 },
                    contacts: gridEnvironmentContacts(this.grid, pose, SHOOTER_BODY_RADIUS), contactTicks: { water: 0, fire: 0, gas: 0 },
                    respawnTick: 0, attackReadyTick: 0, lastHitTick: 0 };
            }),
            damage: { schema: 1, nextResolutionId: 1, actors: SPAWNS.map((_, i) => ({ id: i + 1, team: i === 0 ? 0 : 1,
                hp: i === 0 ? 100 : 70, maxHp: i === 0 ? 100 : 70, revision: 0 })) },
            effects: [], ranged: null, stats: { kills: 0, deaths: 0, damageDealt: 0, damageTaken: 0 },
        };
        this.damage = new DamageResolutionAuthority(this.state.damage);
        this.state.actors.filter(a => this.damage.read(a.id)!.hp > 0).forEach(a => this.bodies.upsert(a));
        for (const id of ids) {
            const d = installed.find(d => d.id === id)!;
            this.runtimes.set(id, d.create({ seed: this.state.seed, ownerId: 1, world: {
                grid: { width: this.grid.width, height: this.grid.height, getCell: (x, y) => {
                    const cell = this.grid.getCell(x, y); return cell ? Object.freeze({ isPassable: cell.isPassable }) : null;
                } }, bodies: { queryAabb: bounds => this.bodies.queryAabb(bounds) },
            }, tick: () => this.tick,
                health: id => this.damage.read(id), bodies: () => this.state.actors.map(a => ({ id: a.id, pose: { ...a.pose }, radius: a.radius,
                    hp: this.damage.read(a.id)!.hp, team: this.damage.read(a.id)!.team })),
                damage: intent => this.applyDamage(intent), emit: effect => { this.state.effects.push(structuredClone(effect)); },
            }, restored?.moduleStates[id]));
        }
        if (restored && canonicalState(this.rangedView()) !== canonicalState(restored.ranged)) throw new Error('Invalid weapon view mirror');
        this.origin = this.snapshot();
    }
    static fromSnapshot(value: unknown, installed = getRealtimeModules()): ShooterSession {
        validateSnapshot(value, installed); return new ShooterSession(value.seed, { snapshot: value, installed });
    }
    get tick(): number { return this.state.tick; }
    private check(): void { if (this.fault) throw this.fault; }
    private rangedView() { return this.runtimes.values().next().value?.view() ?? null; }
    private applyDamage(intent: DamageIntent) {
        const plan = this.damage.prepareDamageResolution(intent), receipt = plan && this.damage.commitDamageResolution(plan);
        if (receipt) {
            const a = this.state.actors[receipt.targetId - 1]!; a.lastHitTick = this.tick;
            if (receipt.sourceId === 1 && receipt.targetId !== 1) this.state.stats.damageDealt += receipt.applied;
            if (receipt.targetId === 1) this.state.stats.damageTaken += receipt.applied;
            if (receipt.killed) {
                a.respawnTick = this.tick + 90; this.bodies.remove(a.id);
                if (a.id === 1) this.state.stats.deaths++; else this.state.stats.kills++;
            }
        }
        return receipt;
    }
    private move(a: ShooterActor, x: number, y: number, speed: number): void {
        const delta = movementDelta(x, y, a.contacts.some(c => c.water) ? speed / 2 : speed, a.motionCredit);
        const p = moveCircle({ grid: this.grid, bodies: this.bodies }, a.pose, a.radius, delta, a.id);
        if (p.x - a.pose.x !== delta.x) a.motionCredit.x = 0;
        if (p.y - a.pose.y !== delta.y) a.motionCredit.y = 0;
        a.pose.x = p.x; a.pose.y = p.y; a.loc = worldToCell(a.pose); this.bodies.upsert(a);
    }
    private enemies(): void {
        const player = this.state.actors[0]!;
        for (const a of this.state.actors) {
            if (this.damage.read(a.id)!.hp === 0) {
                if (this.tick >= a.respawnTick) {
                    const spawn = SPAWNS[a.id - 1]!;
                    // Frozen enemies can occupy the primary player spawn while
                    // the player is dead. Search a stable nearby order to avoid
                    // an unrecoverable training-room softlock.
                    const offsets = a.id === 1 ? Array.from({ length: 81 }, (_, i) => ({ x: i % 9 - 4, y: Math.floor(i / 9) - 4 }))
                        .sort((p, q) => p.x * p.x + p.y * p.y - q.x * q.x - q.y * q.y || p.y - q.y || p.x - q.x) : [{ x: 0, y: 0 }];
                    const pose = offsets.map(o => ({ x: (spawn[0] + o.x) * 1024, y: (spawn[1] + o.y) * 1024, facing: 0 }))
                        .find(p => circleIsFree({ grid: this.grid, bodies: this.bodies }, p, a.radius));
                    if (pose) {
                        this.damage.restoreHealth(a.id); a.pose = pose; a.loc = worldToCell(pose); a.motionCredit = { x: 0, y: 0 };
                        a.respawnTick = 0; a.attackReadyTick = this.tick + 30; this.bodies.upsert(a);
                    }
                }
                continue;
            }
            if (a.id === 1 || !this.runtimes.size || !this.damage.read(1)!.hp) continue;
            const dx = player.pose.x - a.pose.x, dy = player.pose.y - a.pose.y, longest = Math.max(1, Math.abs(dx), Math.abs(dy));
            this.move(a, Math.trunc(dx * 127 / longest), Math.trunc(dy * 127 / longest), 48);
            const delta = { x: player.pose.x - a.pose.x, y: player.pose.y - a.pose.y };
            if (delta.x ** 2 + delta.y ** 2 <= (a.radius + player.radius + 120) ** 2 && this.tick >= a.attackReadyTick
                && !raycast({ grid: this.grid }, a.pose, delta)) {
                this.applyDamage({ sourceId: a.id, targetId: 1, amount: 8, kind: 'kinetic', friendlyFire: 'none' }); a.attackReadyTick = this.tick + 30;
            }
        }
    }
    advanceTick(input: InputFrame, commands: readonly WeaponCommand[] = []): void {
        this.check();
        if (this.advancing) throw new Error('Reentrant S2 tick');
        if (this.tick >= MAX_SHOOTER_TICKS) throw new Error('S2 recording duration budget exhausted');
        validateInputFrame(input, this.tick + 1);
        if (!dataArray(commands, 8)) throw new Error('Invalid command batch');
        commands.forEach(c => validateWeaponCommand(c, input.tick));
        if (commands.length && !this.runtimes.size) throw new Error('Weapon commands require a ranged module');
        const accepted = { ...input }, acceptedCommands = structuredClone(commands);
        this.advancing = true;
        try {
            this.state.tick++;
            this.state.effects = this.state.effects.filter(e => this.tick - e.tick < 12);
            const player = this.state.actors[0]!;
            if (this.damage.read(1)!.hp) { this.move(player, input.moveX, input.moveY, SHOOTER_MOVE_SPEED); player.pose.facing = input.aimAngle; }
            this.enemies();
            for (const a of this.state.actors) {
                a.contacts = gridEnvironmentContacts(this.grid, a.pose, a.radius);
                if (this.damage.read(a.id)!.hp) for (const kind of ['water', 'fire', 'gas'] as const)
                    if (a.contacts.some(c => c[kind])) a.contactTicks[kind]++;
            }
            for (const runtime of this.runtimes.values()) runtime.advance({ tick: this.tick, actorId: 1, aimAngle: input.aimAngle,
                fire: !!(input.buttons & FIRE_BUTTON), moving: !!(input.moveX || input.moveY) }, acceptedCommands);
            this.frames.push(accepted); this.commands.push(...acceptedCommands);
        } catch (error) { this.fault = error instanceof Error ? error : new Error(String(error)); throw this.fault; }
        finally { this.advancing = false; }
    }
    snapshot(): ShooterSnapshot {
        this.check(); if (this.advancing) throw new Error('Snapshot during S2 tick');
        return { ...structuredClone(this.state), damage: this.damage.snapshot(), moduleStates: Object.fromEntries(
            [...this.runtimes].map(([id, runtime]) => [id, runtime.snapshot()])), ranged: this.rangedView() };
    }
    exportReplay(): ShooterReplay {
        return { format: 'broguejs-shooter-s2-replay', version: 3, initial: structuredClone(this.origin),
            frames: structuredClone(this.frames), commands: structuredClone(this.commands), final: this.snapshot() };
    }
}
export function replayShooter(value: unknown, installed = getRealtimeModules()): ShooterSession {
    if (!record(value, ['format', 'version', 'initial', 'frames', 'commands', 'final']) || value.format !== 'broguejs-shooter-s2-replay'
        || value.version !== 3 || !dataArray(value.frames, MAX_SHOOTER_TICKS) || !dataArray(value.commands, MAX_SHOOTER_TICKS * 8)) throw new Error('Invalid S2 replay');
    validateSnapshot(value.initial, installed); validateSnapshot(value.final, installed);
    if (value.initial.tick + value.frames.length !== value.final.tick) throw new Error('Incomplete S2 replay');
    const initialTick = value.initial.tick;
    value.frames.forEach((f, i) => validateInputFrame(f, initialTick + i + 1));
    let priorTick = initialTick + 1, count = 0;
    for (const c of value.commands) {
        if (!finiteData(c) || !c || typeof c !== 'object' || !('tick' in c) || !integer(c.tick, priorTick, value.final.tick)) throw new Error('Invalid command order');
        validateWeaponCommand(c, c.tick); count = c.tick === priorTick ? count + 1 : 1; priorTick = c.tick;
        if (count > 8) throw new Error('Command batch budget exceeded');
    }
    const session = ShooterSession.fromSnapshot(value.initial, installed), commands = value.commands as WeaponCommand[];
    let cursor = 0;
    for (const frame of value.frames as InputFrame[]) {
        const batch: WeaponCommand[] = [];
        while (commands[cursor]?.tick === frame.tick) batch.push(commands[cursor++]!);
        session.advanceTick(frame, batch);
    }
    if (canonicalState(session.snapshot()) !== canonicalState(value.final)) throw new Error('S2 replay state mismatch');
    return session;
}
