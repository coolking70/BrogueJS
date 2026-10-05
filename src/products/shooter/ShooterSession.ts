import type { MissionDescriptor, MissionRuntime, MissionCommand } from '../../engine/Simulation/MissionRuntime';
import type { Grid } from '../../engine/Map/Grid';
import type { PopulationRuntime, PopulationHost } from '../../engine/Simulation/PopulationRuntime';
import type { SimulationCore } from '../../engine/Simulation/SimulationHost';
import { dataArray, integer, record } from '../../engine/Simulation/Protocol';
import { DamageResolutionAuthority, validateDamageState, type DamageIntent } from '../../engine/Combat/DamageResolution';
import type { RangedRuntime, RealtimeModuleDescriptor, RuntimeManifest, WeaponCommand, ShooterCommand } from '../../engine/Simulation/RangedRuntime';
import { circleIsFree, moveCircle } from '../../engine/Movement/KinematicCollision';
import { SpatialHash } from '../../engine/Movement/SpatialHash';
import { raycast } from '../../engine/Movement/SpatialQuery';
import { gridEnvironmentContacts } from '../../engine/Movement/KinematicSpatial';
import { worldToCell, movementDelta, MOTION_CREDIT } from '../../engine/Movement/WorldUnits';
import { getRealtimeModules } from '../../ext/realtimeCatalog';
import { SHOOTER_PROFILE } from './profile';
import { createScenarioArena, SHOOTER_ARENA_ID } from './ShooterArena';
import { FIRE_BUTTON, validateInputFrame, type InputFrame } from './input/InputFrame';
import { validateShooterCommand } from './input/WeaponCommand';
import { canonicalState, MAX_SHOOTER_TICKS, SHOOTER_BODY_RADIUS, SHOOTER_MOVE_SPEED, SPAWNS,
    type ShooterActor, type ShooterReplay, type ShooterSnapshot } from './ShooterState';
export { canonicalState, MAX_SHOOTER_TICKS, SHOOTER_BODY_RADIUS, SHOOTER_MOVE_SPEED } from './ShooterState';
export type { ShooterActor, ShooterReplay, ShooterSnapshot } from './ShooterState';

const manifest = (d: RealtimeModuleDescriptor): RuntimeManifest => ({ id: d.id, version: d.version, rules: { ...d.rules } });
function scenarioDescriptor(ids: readonly string[], installed: readonly RealtimeModuleDescriptor[]): MissionDescriptor | undefined {
    return ids.map(id => installed.find(d => d.id === id)!).find((d): d is MissionDescriptor => d.kind === 'mission');
}
function actorDefinitions(ids: readonly string[], installed: readonly RealtimeModuleDescriptor[]) {
    const population = ids.map(id => installed.find(d => d.id === id)!).find(d => d.kind === 'population');
    const mission = scenarioDescriptor(ids, installed);
    const player = { id: 1, kind: 'player' as const, radius: SHOOTER_BODY_RADIUS, maxHp: 100 };
    if (population && (population.actors.length > 500 || !population.actors.length || population.actors.some((a, i) => a.id !== i + 2
        || !['swarm', 'elite', 'boss'].includes(a.kind) || !integer(a.radius, 1, 1024) || !integer(a.maxHp, 1, 1_000_000)))) throw new Error('Invalid population definitions');
    const actors = population ? [player, ...population.actors] : mission ? [player] : [player, ...SPAWNS.slice(1).map((_, i) => ({
        id: i + 2, kind: 'target' as const, radius: SHOOTER_BODY_RADIUS, maxHp: 70 }))];
    if (actors.length + (mission?.scenario.targets.length ?? 0) > 512) throw new Error('Invalid actor cohort size');
    return [...actors, ...(mission?.scenario.targets ?? []).map((t, i) => ({ id: actors.length + i + 1, kind: 'objective' as const, radius: t.radius, maxHp: t.maxHp }))];
}
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
        'seed', 'tick', 'actors', 'damage', 'effects', 'ranged', 'population', 'mission', 'stats'])
        || value.format !== 'broguejs-shooter-s4' || value.version !== 5 || value.product !== SHOOTER_PROFILE.id
        || value.simulation !== SHOOTER_PROFILE.simulation.id || value.ticksPerSecond !== 30
        || !integer(value.seed, 1, 0xffffffff) || !integer(value.tick, 0, MAX_SHOOTER_TICKS)
        || !dataArray(value.modules, 3) || !dataArray(value.actors, 512)
        || !dataArray(value.effects, 512) || !record(value.stats, ['kills', 'deaths', 'damageDealt', 'damageTaken'])
        || !Object.values(value.stats).every(n => integer(n, 0, MAX_SHOOTER_TICKS * 10000))) throw new Error('Invalid or incompatible S4 snapshot');
    const ids: string[] = [];
    for (const m of value.modules) {
        if (!record(m, ['id', 'version', 'rules']) || typeof m.id !== 'string' || ids.includes(m.id)) throw new Error('Invalid realtime manifest');
        const d = installed.find(d => d.id === m.id);
        if (!d || canonicalState(m) !== canonicalState(manifest(d))) throw new Error('Missing or incompatible realtime module');
        ids.push(m.id);
    }
    const missionDescriptor = scenarioDescriptor(ids, installed), scenario = missionDescriptor?.scenario;
    if (value.arena !== (scenario?.id ?? SHOOTER_ARENA_ID)) throw new Error('Invalid arena');
    const definitions = actorDefinitions(ids, installed);
    if (value.actors.length !== definitions.length) throw new Error('Invalid actor cohort');
    if (!record(value.moduleStates, ids)) throw new Error('Invalid module namespaces');
    validateDamageState(value.damage);
    if (value.damage.actors.length !== definitions.length) throw new Error('Invalid health cohort');
    for (const [i, a] of value.actors.entries()) {
        const hp = value.damage.actors[i]!;
        const fixedTarget = scenario?.targets.find((_, n) => definitions.length - scenario.targets.length + n === i);
        if (!record(a, ['id', 'kind', 'pose', 'loc', 'radius', 'motionCredit', 'contacts', 'contactTicks', 'respawnTick', 'attackReadyTick', 'lastHitTick'])
            || a.id !== i + 1 || a.kind !== definitions[i]!.kind || !record(a.pose, ['x', 'y', 'facing']) || !integer(a.pose.x, 0, (scenario?.width ?? 40) * 1024)
            || !integer(a.pose.y, 0, (scenario?.height ?? 28) * 1024) || !integer(a.pose.facing, 0, 4095)
            || !record(a.loc, ['x', 'y']) || a.loc.x !== Math.floor(a.pose.x / 1024) || a.loc.y !== Math.floor(a.pose.y / 1024)
            || fixedTarget && (a.pose.x !== fixedTarget.pose.x || a.pose.y !== fixedTarget.pose.y || a.pose.facing !== 0)
            || a.radius !== definitions[i]!.radius || !record(a.motionCredit, ['x', 'y'])
            || !Object.values(a.motionCredit).every(n => integer(n, -MOTION_CREDIT + 1, MOTION_CREDIT - 1))
            || !record(a.contactTicks, ['water', 'fire', 'gas']) || !Object.values(a.contactTicks).every(n => integer(n, 0, value.tick as number))
            || !integer(a.respawnTick, 0, value.tick + 90) || !integer(a.attackReadyTick, 0, value.tick + 30)
            || !integer(a.lastHitTick, 0, value.tick) || (hp.hp > 0 ? a.respawnTick !== 0 : a.respawnTick === 0)
            || hp.id !== a.id || hp.team !== (i === 0 ? 0 : 1) || hp.maxHp !== definitions[i]!.maxHp) throw new Error('Invalid S4 actor');
    }
    for (const e of value.effects) {
        if (!record(e, ['tick', 'kind', 'from', 'to', 'radius', 'hit']) || !integer(e.tick, Math.max(0, value.tick - 11), value.tick)
            || !['tracer', 'impact', 'explosion'].includes(e.kind as string) || !integer(e.radius, 0, 8192) || typeof e.hit !== 'boolean'
            || ![e.from, e.to].every(p => record(p, ['x', 'y']) && integer(p.x, -65536, 1 << 22) && integer(p.y, -65536, 1 << 22)))
            throw new Error('Invalid combat effect');
    }
    const grid = createScenarioArena(scenario), bodies = new SpatialHash();
    const actors = value.actors as unknown as ShooterActor[], healthState = value.damage;
    actors.filter((_, i) => healthState.actors[i]!.hp > 0).forEach(a => bodies.upsert(a));
    for (const a of actors) if ((value.damage.actors[a.id - 1]!.hp > 0 && !circleIsFree({ grid, bodies }, a.pose, a.radius, a.id))
        || canonicalState(a.contacts) !== canonicalState(gridEnvironmentContacts(grid, a.pose, a.radius))) throw new Error('Invalid penetration or contact mirror');
}

export class ShooterSession implements SimulationCore<InputFrame, ShooterSnapshot> {
    private readonly state: ShooterSnapshot;
    private readonly grid: Grid;
    private readonly bodies = new SpatialHash();
    private readonly damage: DamageResolutionAuthority;
    private readonly runtimes = new Map<string, RangedRuntime>();
    private population: PopulationRuntime | null = null;
    private populationId: string | null = null;
    private mission: MissionRuntime | null = null;
    private missionId: string | null = null;
    private readonly targetIds = new Map<string, number>();
    private readonly spawn: {x: number; y: number};
    private readonly origin: ShooterSnapshot;
    private readonly frames: InputFrame[] = [];
    private readonly commands: ShooterCommand[] = [];
    private fault: Error | null = null;
    private advancing = false;

    constructor(seed = 7301, options: { snapshot?: ShooterSnapshot; modules?: readonly string[]; installed?: readonly RealtimeModuleDescriptor[] } = {}) {
        if (!integer(seed, 1, 0xffffffff)) throw new Error('S4 requires a nonzero uint32 seed');
        const installed = options.installed ?? getRealtimeModules(), restored = options.snapshot;
        if (restored) validateSnapshot(restored, installed);
        const ids = restored?.modules.map(m => m.id) ?? options.modules ?? installed.map(d => d.id);
        if (ids.length > 3 || new Set(ids).size !== ids.length || ids.some(id => !installed.some(d => d.id === id))
            || new Set(ids.map(id => installed.find(d => d.id === id)!.kind)).size !== ids.length) throw new Error('Unavailable realtime module');
        const missionDescriptor = scenarioDescriptor(ids, installed), scenario = missionDescriptor?.scenario;
        this.grid = createScenarioArena(scenario); this.spawn = scenario?.spawn ?? { x: 5632, y: 10752 };
        const definitions = actorDefinitions(ids, installed);
        const initialKinds = { swarm: 0, elite: 0, boss: 0 };
        const initialAlive = definitions.map(d => !scenario || !['swarm','elite','boss'].includes(d.kind)
            || ++initialKinds[d.kind as keyof typeof initialKinds] <= scenario.initialPopulation[d.kind as keyof typeof initialKinds]);
        for (const [i, t] of (scenario?.targets ?? []).entries()) this.targetIds.set(t.key, definitions.length - scenario!.targets.length + i + 1);
        this.state = restored ? structuredClone(restored) : {
            format: 'broguejs-shooter-s4', version: 5, product: SHOOTER_PROFILE.id, simulation: SHOOTER_PROFILE.simulation.id,
            ticksPerSecond: 30, arena: scenario?.id ?? SHOOTER_ARENA_ID, modules: ids.map(id => manifest(installed.find(d => d.id === id)!)), moduleStates: {}, seed, tick: 0,
            actors: definitions.map((definition, i) => {
                const [x, y] = SPAWNS[Math.min(i, SPAWNS.length - 1)]!;
                const target = scenario?.targets.find(t => this.targetIds.get(t.key) === definition.id);
                const at = target?.pose ?? (definition.id === 1 ? this.spawn : { x: x * 1024, y: y * 1024 });
                const pose = { ...at, facing: 0 };
                return { id: i + 1, kind: definition.kind, pose, loc: worldToCell(pose), radius: definition.radius, motionCredit: { x: 0, y: 0 },
                    contacts: gridEnvironmentContacts(this.grid, pose, definition.radius), contactTicks: { water: 0, fire: 0, gas: 0 },
                    respawnTick: initialAlive[i] ? 0 : 90, attackReadyTick: 0, lastHitTick: 0 };
            }),
            damage: { schema: 1, nextResolutionId: 1, actors: definitions.map((definition, i) => ({ id: i + 1, team: i === 0 ? 0 : 1,
                hp: initialAlive[i] ? definition.maxHp : 0, maxHp: definition.maxHp, revision: 0 })) },
            effects: [], ranged: null, population: null, mission: null, stats: { kills: 0, deaths: 0, damageDealt: 0, damageTaken: 0 },
        };
        if (!restored && ids.some(id => installed.find(d => d.id === id)?.kind === 'population')) {
            const player = this.state.actors[0]!; this.bodies.upsert(player);
            this.state.actors.filter(a => a.kind === 'objective').forEach(a => this.bodies.upsert(a));
            for (const a of this.state.actors.slice(1).filter(a => a.kind !== 'objective' && initialAlive[a.id - 1]).sort((a, b) => b.radius - a.radius || a.id - b.id)) {
                const count = (this.grid.width - 2) * (this.grid.height - 2), offset = (Math.imul(seed, 1664525) ^ Math.imul(a.id, 1013904223)) >>> 0;
                let found = false;
                for (let n = 0; n < count; n++) {
                    const cell = (n + offset % count) % count, pose = { x: (cell % (this.grid.width - 2) + 1.5) * 1024,
                        y: (Math.floor(cell / (this.grid.width - 2)) + 1.5) * 1024, facing: 0 };
                    if ((pose.x - player.pose.x) ** 2 + (pose.y - player.pose.y) ** 2 < 8192 ** 2 || !circleIsFree({ grid: this.grid, bodies: this.bodies }, pose, a.radius)) continue;
                    a.pose = pose; a.loc = worldToCell(pose); a.contacts = gridEnvironmentContacts(this.grid, pose, a.radius); this.bodies.upsert(a); found = true; break;
                }
                if (!found) throw new Error('Insufficient population spawn space');
            }
        }
        this.damage = new DamageResolutionAuthority(this.state.damage);
        this.state.actors.filter(a => this.damage.read(a.id)!.hp > 0).forEach(a => this.bodies.upsert(a));
        const host: PopulationHost = { seed: this.state.seed, ownerId: 1, world: {
            grid: { width: this.grid.width, height: this.grid.height, getCell: (x, y) => {
                const cell = this.grid.getCell(x, y); return cell ? Object.freeze({ isPassable: cell.isPassable }) : null;
            } }, bodies: { queryAabb: bounds => this.bodies.queryAabb(bounds) },
        }, tick: () => this.tick, health: id => this.damage.read(id),
            body: id => this.body(id), bodies: () => this.state.actors.map(a => this.body(a.id)!),
            damage: intent => this.applyDamage(intent), emit: effect => { this.state.effects.push(structuredClone(effect)); },
            initialPopulation: () => scenario?.initialPopulation,
            reinforcementPolicy: () => this.mission?.view().reinforcements ?? { enabled: true, batch: 8 },
            move: (id, x, y, speed) => {
                const a = this.state.actors[id - 1];
                if (!a || a.id === 1 || a.kind === 'objective' || !this.damage.read(id)?.hp || !integer(x, -127, 127) || !integer(y, -127, 127) || !integer(speed, 1, 256)) throw new Error('Invalid population movement');
                this.move(a, x, y, speed);
            },
            revive: (id, at) => {
                const a = this.state.actors[id - 1];
                if (!a || id === 1 || a.kind === 'objective' || this.damage.read(id)?.hp || !integer(at.x, 0, this.grid.width * 1024) || !integer(at.y, 0, this.grid.height * 1024)) throw new Error('Invalid population revival');
                if (!circleIsFree(host.world, at, a.radius)) return false;
                a.pose = { ...at, facing: 0 }; a.loc = worldToCell(at); a.motionCredit = { x: 0, y: 0 }; a.respawnTick = 0;
                a.contacts = gridEnvironmentContacts(this.grid, at, a.radius); this.damage.restoreHealth(id); this.bodies.upsert(a); return true;
            },
        };
        for (const id of ids) {
            const d = installed.find(d => d.id === id)!;
            if (d.kind === 'ranged') this.runtimes.set(id, d.create(host, restored?.moduleStates[id]));
            else if (d.kind === 'population') { this.population = d.createPopulation(host, restored?.moduleStates[id]); this.populationId = id; }
        }
        if (missionDescriptor) {
            this.missionId = missionDescriptor.id;
            this.mission = missionDescriptor.createMission({ tick: () => this.tick, player: () => this.body(1)!, playerMaxHp: 100,
                target: key => { const id = this.targetIds.get(key); if (!id) throw new Error('Unknown mission target'); return this.body(id)!; },
                stats: () => ({ kills: this.state.stats.kills, deaths: this.state.stats.deaths }), rangedAvailable: this.runtimes.size > 0,
                heal: () => { if (!this.advancing || !this.damage.read(1)!.hp || this.damage.read(1)!.hp === 100) return false; this.damage.restoreHealth(1); return true; },
                demolish: key => {
                    const id = this.targetIds.get(key), p = this.body(1)!, t = id && this.body(id);
                    if (!this.advancing || this.runtimes.size || !t || !p.hp || !this.mission?.targetActive(key)
                        || (p.pose.x - t.pose.x) ** 2 + (p.pose.y - t.pose.y) ** 2 > 1600 ** 2) return false;
                    return !!this.applyDamage({ sourceId: 1, targetId: t.id, amount: t.hp, kind: 'explosive', friendlyFire: 'none' });
                },
            }, restored?.moduleStates[missionDescriptor.id]);
        }
        if (restored && canonicalState(this.mission?.view() ?? null) !== canonicalState(restored.mission)) throw new Error('Invalid mission view mirror');
        if (restored && canonicalState(this.rangedView()) !== canonicalState(restored.ranged)) throw new Error('Invalid weapon view mirror');
        if (restored && canonicalState(this.population?.view() ?? null) !== canonicalState(restored.population)) throw new Error('Invalid population view mirror');
        this.origin = this.snapshot();
    }
    static fromSnapshot(value: unknown, installed = getRealtimeModules()): ShooterSession {
        validateSnapshot(value, installed); return new ShooterSession(value.seed, { snapshot: value, installed });
    }
    get finished(): boolean { return this.mission?.isFinished() ?? false; }
    get tick(): number { return this.state.tick; }
    private body(id: number) {
        const a = this.state.actors[id - 1], hp = this.damage.read(id);
        return a && hp ? { id: a.id, pose: { ...a.pose }, radius: a.radius, hp: hp.hp, team: hp.team } : undefined;
    }
    private check(): void { if (this.fault) throw this.fault; }
    private rangedView() { return this.runtimes.values().next().value?.view() ?? null; }
    private applyDamage(intent: DamageIntent) {
        const targetKey = [...this.targetIds].find(([, id]) => id === intent.targetId)?.[0];
        if (targetKey && !this.mission?.targetActive(targetKey)) return null;
        const plan = this.damage.prepareDamageResolution(intent), receipt = plan && this.damage.commitDamageResolution(plan);
        if (receipt) {
            const a = this.state.actors[receipt.targetId - 1]!; a.lastHitTick = this.tick;
            if (receipt.sourceId === 1 && receipt.targetId !== 1) this.state.stats.damageDealt += receipt.applied;
            if (receipt.targetId === 1) this.state.stats.damageTaken += receipt.applied;
            if (receipt.killed) {
                a.respawnTick = this.tick + 90; this.bodies.remove(a.id);
                if (a.id === 1) this.state.stats.deaths++; else if (a.kind !== 'objective') this.state.stats.kills++;
            }
        }
        return receipt;
    }
    private move(a: ShooterActor, x: number, y: number, speed: number): void {
        const delta = movementDelta(x, y, a.contacts.some(c => c.water) ? Math.floor(speed / 2) : speed, a.motionCredit);
        const p = moveCircle({ grid: this.grid, bodies: this.bodies }, a.pose, a.radius, delta, a.id);
        if (p.x - a.pose.x !== delta.x) a.motionCredit.x = 0;
        if (p.y - a.pose.y !== delta.y) a.motionCredit.y = 0;
        a.pose.x = p.x; a.pose.y = p.y; a.loc = worldToCell(a.pose); this.bodies.upsert(a);
    }
    private enemies(): void {
        const player = this.state.actors[0]!;
        for (const a of this.state.actors) {
            if (a.kind === 'objective' || this.population && a.id !== 1) continue;
            if (this.damage.read(a.id)!.hp === 0) {
                if (this.tick >= a.respawnTick) {
                    const spawn = a.id === 1 ? [this.spawn.x / 1024, this.spawn.y / 1024] : SPAWNS[a.id - 1]!;
                    // Frozen enemies can occupy the primary player spawn while
                    // the player is dead. Search a stable nearby order to avoid
                    // an unrecoverable training-room softlock.
                    const offsets = a.id === 1 ? Array.from({ length: this.grid.width * this.grid.height }, (_, i) => ({ x: i % this.grid.width + .5 - spawn[0], y: Math.floor(i / this.grid.width) + .5 - spawn[1] }))
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
    advanceTick(input: InputFrame, commands: readonly ShooterCommand[] = []): void {
        this.check();
        if (this.finished) throw new Error('Mission already finished');
        if (this.advancing) throw new Error('Reentrant S4 tick');
        if (this.tick >= MAX_SHOOTER_TICKS) throw new Error('S4 recording duration budget exhausted');
        validateInputFrame(input, this.tick + 1);
        if (!dataArray(commands, 8)) throw new Error('Invalid command batch');
        commands.forEach(c => validateShooterCommand(c, input.tick));
        if (commands.some(c => c.kind === 'reload' || c.kind === 'equip') && !this.runtimes.size) throw new Error('Weapon commands require a ranged module');
        if (commands.some(c => c.kind === 'interact' || c.kind === 'abort') && !this.mission) throw new Error('Mission commands require a mission module');
        const accepted = { ...input }, acceptedCommands = structuredClone(commands);
        this.advancing = true;
        try {
            this.state.tick++;
            this.state.effects = this.state.effects.filter(e => this.tick - e.tick < 12);
            const player = this.state.actors[0]!;
            if (this.damage.read(1)!.hp) { this.move(player, input.moveX, input.moveY, SHOOTER_MOVE_SPEED); player.pose.facing = input.aimAngle; }
            this.enemies();
            this.population?.advance();
            for (const a of this.state.actors) {
                a.contacts = gridEnvironmentContacts(this.grid, a.pose, a.radius);
                if (this.damage.read(a.id)!.hp) for (const kind of ['water', 'fire', 'gas'] as const)
                    if (a.contacts.some(c => c[kind])) a.contactTicks[kind]++;
            }
            for (const runtime of this.runtimes.values()) runtime.advance({ tick: this.tick, actorId: 1, aimAngle: input.aimAngle,
                fire: !!(input.buttons & FIRE_BUTTON), moving: !!(input.moveX || input.moveY) }, acceptedCommands.filter((c): c is WeaponCommand => c.kind === 'reload' || c.kind === 'equip'));
            this.population?.afterCombat();
            this.mission?.advance(acceptedCommands.filter((c): c is MissionCommand => c.kind === 'interact' || c.kind === 'abort'));
            this.frames.push(accepted); this.commands.push(...acceptedCommands);
        } catch (error) { this.fault = error instanceof Error ? error : new Error(String(error)); throw this.fault; }
        finally { this.advancing = false; }
    }
    snapshot(): ShooterSnapshot {
        this.check(); if (this.advancing) throw new Error('Snapshot during S4 tick');
        const { moduleStates: _modules, damage: _damage, ranged: _ranged, population: _population, mission: _mission, ...core } = this.state;
        const moduleStates = Object.fromEntries([...this.runtimes].map(([id, runtime]) => [id, runtime.snapshot()]));
        if (this.population && this.populationId) moduleStates[this.populationId] = this.population.snapshot();
        if (this.mission && this.missionId) moduleStates[this.missionId] = this.mission.snapshot();
        return { ...structuredClone(core), damage: this.damage.snapshot(), moduleStates, ranged: this.rangedView(), population: this.population?.view() ?? null, mission: this.mission?.view() ?? null };
    }
    exportReplay(): ShooterReplay {
        return { format: 'broguejs-shooter-s4-replay', version: 5, initial: structuredClone(this.origin),
            frames: structuredClone(this.frames), commands: structuredClone(this.commands), final: this.snapshot() };
    }
}
export function replayShooter(value: unknown, installed = getRealtimeModules()): ShooterSession {
    if (!record(value, ['format', 'version', 'initial', 'frames', 'commands', 'final']) || value.format !== 'broguejs-shooter-s4-replay'
        || value.version !== 5 || !dataArray(value.frames, MAX_SHOOTER_TICKS) || !dataArray(value.commands, MAX_SHOOTER_TICKS * 8)) throw new Error('Invalid S4 replay');
    validateSnapshot(value.initial, installed); validateSnapshot(value.final, installed);
    if (value.initial.tick + value.frames.length !== value.final.tick) throw new Error('Incomplete S4 replay');
    const initialTick = value.initial.tick;
    value.frames.forEach((f, i) => validateInputFrame(f, initialTick + i + 1));
    let priorTick = initialTick + 1, count = 0;
    for (const c of value.commands) {
        if (!finiteData(c) || !c || typeof c !== 'object' || !('tick' in c) || !integer(c.tick, priorTick, value.final.tick)) throw new Error('Invalid command order');
        validateShooterCommand(c, c.tick); count = c.tick === priorTick ? count + 1 : 1; priorTick = c.tick;
        if (count > 8) throw new Error('Command batch budget exceeded');
    }
    const session = ShooterSession.fromSnapshot(value.initial, installed), commands = value.commands as ShooterCommand[];
    let cursor = 0;
    for (const frame of value.frames as InputFrame[]) {
        const batch: ShooterCommand[] = [];
        while (commands[cursor]?.tick === frame.tick) batch.push(commands[cursor++]!);
        session.advanceTick(frame, batch);
    }
    if (canonicalState(session.snapshot()) !== canonicalState(value.final)) throw new Error('S4 replay state mismatch');
    return session;
}
