import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import { CreatureSpatial, conservativeSquareStep, footprintOf, rigidMovementFootprint } from '../Movement/CreatureSpatial';
import { type RigidPose, type CompiledRigidFootprint, turnedPose } from '../Movement/RigidFootprint';
import { integer, SpatialValidationError } from '../Movement/SpatialSchema';
import type { FootprintPathingStats, FootprintTraversalPolicy } from './FootprintPathing';
import { type Grid, TerrainType } from './Grid';
import { cellTerrainFlags, cellTerrainMechFlags } from './DungeonFeature';
import { T_OBSTRUCTS_PASSABILITY, T_OBSTRUCTS_DIAGONAL_MOVEMENT, TM_ALLOWS_SUBMERGING, TERRAIN_FLAGS } from './TerrainCatalog';
import { PathFrontier } from './PathFrontier';

export type RigidPoseGoal =
    | { readonly kind: 'contact' | 'escape'; readonly target: Creature }
    | { readonly kind: 'anchors'; readonly anchors: readonly (Readonly<Pos> & { readonly pose?: RigidPose })[] };
export interface RigidPoseStep {
    readonly kind: 'step' | 'rotate' | 'arrived' | 'blocked' | 'unreachable' | 'unsupported';
    readonly at?: Readonly<Pos>;
    readonly pose?: RigidPose;
    readonly quarterTurns?: -1 | 1;
    readonly actionCost?: number;
    readonly distance?: number;
    readonly distanceAt?: (at: Readonly<Pos>, pose: RigidPose) => number;
    readonly replanned: boolean;
}
type Policy = { forbiddenFlags: number; requiresSubmergible: boolean; allowSecretDoors: boolean; costs: { flags: number; cost: number }[] };
interface Graph {
    grid: Grid; shape: CompiledRigidFootprint; fit: Uint8Array; cost: Float64Array;
    clockwise: Uint8Array; counterclockwise: Uint8Array;
    targetKey?: string; distances?: Float64Array;
}
const DIRS = [[-1,-1], [0,-1], [1,-1], [-1,0], [1,0], [-1,1], [0,1], [1,1]] as const;
const MAX_GRAPHS = 8;

/** 4b-0 fixture pose graph. Every scan visits at most W*H*A nodes (A<=4)
 * and ten edges per node; one bounded dynamic replan per call. LRU eviction
 * recomputes the same complete graph instead of changing routes or dropping
 * poses. Squares' production FootprintPathing remains its unchanged r0 path. */
export class RigidPosePathing {
    private readonly graphs = new Map<string, Graph>();
    private grid?: Grid;
    private revision = -1;
    private terrainBuilds = 0;
    private distanceBuilds = 0;
    private dynamicReplans = 0;
    private cacheHits = 0;
    private visitedNodes = 0;
    constructor(private readonly spatial: CreatureSpatial) {}
    get stats(): Readonly<FootprintPathingStats> {
        return Object.freeze({ terrainBuilds: this.terrainBuilds, distanceBuilds: this.distanceBuilds,
            dynamicReplans: this.dynamicReplans, cacheHits: this.cacheHits, visitedNodes: this.visitedNodes, cachedGraphs: this.graphs.size });
    }
    clear(): void { this.graphs.clear(); this.grid = undefined; this.revision = -1; }

    planStep(actor: Creature, goal: RigidPoseGoal, policy: FootprintTraversalPolicy = {}, distanceOnly = false): RigidPoseStep {
        if (!Object.prototype.hasOwnProperty.call(actor, 'spatial')) {
            if (!this.spatial.capabilityUsers) this.clear();
            return { kind: 'unsupported', replanned: false };
        }
        const shape = rigidMovementFootprint(actor, this.spatial.catalog);
        if (!this.spatial.isActive(actor)) throw new SpatialValidationError('Inactive or unowned rigid pathing actor');
        if (!integer(actor.movementSpeed, 1, 1000000)) throw new SpatialValidationError('Rigid action cost must be positive');
        const grid = this.spatial.grid, revision = this.spatial.terrainRevision;
        if (this.grid !== grid || this.revision !== revision) {
            this.clear(); this.grid = grid; this.revision = revision;
        }
        const normalized = this.policy(policy);
        const key = JSON.stringify([this.spatial.catalog.definition(actor.spatial!.footprintId), shape.poses, actor.spatial!.movementRegionId ?? null, normalized]);
        let graph = this.graphs.get(key);
        if (graph) { this.cacheHits++; this.graphs.delete(key); this.graphs.set(key, graph); }
        else {
            graph = this.buildTerrain(actor, shape, normalized); this.graphs.set(key, graph);
            if (this.graphs.size > MAX_GRAPHS) this.graphs.delete(this.graphs.keys().next().value!);
        }
        let goals = this.goals(actor, goal, graph);
        if (goal.kind === 'escape') {
            const threat = this.scan(actor, graph, goals, graph.fit), maximum = Math.max(...threat.filter(Number.isFinite));
            goals = Array.from(threat, (distance, i) => distance === maximum ? i : -1).filter(i => i >= 0);
        }
        const targetKey = JSON.stringify(goals);
        if (graph.targetKey !== targetKey) {
            graph.targetKey = targetKey; graph.distances = this.scan(actor, graph, goals, graph.fit); this.distanceBuilds++;
        }
        const start = this.node(graph, actor.loc, actor.spatial!.pose as RigidPose);
        const capturedDistances = graph.distances!;
        const distanceAt = (at: Readonly<Pos>, pose: RigidPose) => capturedDistances[this.node(graph!, at, pose)] ?? Infinity;
        if (distanceOnly) return { kind: Number.isFinite(graph.distances![start]) ? 'arrived' : 'unreachable',
            distance: graph.distances![start] ?? Infinity, distanceAt, replanned: false };
        if (graph.distances![start] === 0) return { kind: 'arrived', replanned: false };
        const options = { allowsTerrain: (at: Pos) => this.allows(grid, at, normalized) };
        const next = this.next(actor, graph, start, graph.distances!, graph.fit);
        if (next !== undefined && this.liveEdge(actor, graph, start, next, options)) return this.result(actor, graph, start, next, false);
        if (!Number.isFinite(graph.distances![start])) {
            // An environmental change can strand an origin outside its policy.
            // Preserve checked exits, without promoting it into a cached node.
            if (start >= 0 && !graph.fit[start]) {
                const exits = this.neighbors(actor, graph, start, graph.fit)
                    .filter(i => Number.isFinite(graph!.distances![i]))
                    .sort((a, b) => graph!.cost[a]! + graph!.distances![a]! - graph!.cost[b]! - graph!.distances![b]!);
                const exit = exits.find(i => this.liveEdge(actor, graph!, start, i, options));
                if (exit !== undefined) return this.result(actor, graph, start, exit, false);
            }
            return { kind: 'unreachable', replanned: false };
        }
        this.dynamicReplans++;
        const usable = new Uint8Array(graph.fit.length);
        for (let i = 0; i < usable.length; i++) if (graph.fit[i]) usable[i] = +this.spatial.canFitAt(actor, this.at(graph, i), options, this.pose(graph, i));
        const distances = this.scan(actor, graph, goals.filter(i => usable[i]), usable, options);
        const alternative = this.next(actor, graph, start, distances, usable, options);
        if (alternative !== undefined && this.liveEdge(actor, graph, start, alternative, options)) return this.result(actor, graph, start, alternative, true);
        return { kind: 'blocked', replanned: true };
    }

    private policy(value: FootprintTraversalPolicy): Policy {
        if (Object.keys(value).some(k => !['forbiddenFlags', 'requiresSubmergible', 'allowSecretDoors', 'costs'].includes(k))
            || !integer(value.forbiddenFlags ?? 0, 0, 0x7fffffff)
            || ['requiresSubmergible', 'allowSecretDoors'].some(k => (value as any)[k] !== undefined && typeof (value as any)[k] !== 'boolean')
            || value.costs !== undefined && (!Array.isArray(value.costs) || value.costs.length > 32)) throw new SpatialValidationError('Invalid rigid traversal policy');
        const costs = (value.costs ?? []).map(v => {
            if (Object.keys(v).sort().join(',') !== 'cost,flags' || !integer(v.flags, 0, 0x7fffffff) || !integer(v.cost, 1, 1000000))
                throw new SpatialValidationError('Invalid rigid traversal cost');
            return { flags: v.flags, cost: v.cost };
        }).sort((a,b) => a.flags-b.flags || a.cost-b.cost);
        return { forbiddenFlags: T_OBSTRUCTS_PASSABILITY | (value.forbiddenFlags ?? 0),
            requiresSubmergible: value.requiresSubmergible ?? false, allowSecretDoors: value.allowSecretDoors ?? false, costs };
    }
    private allows(grid: Grid, at: Pos, policy: Policy): boolean {
        const cell = grid.getCell(at.x, at.y);
        if (!cell) return false;
        const flags = policy.allowSecretDoors ? cell.layers.reduce((f, t) => f | (t === TerrainType.SECRET_DOOR ? 0 : TERRAIN_FLAGS[t].flags), 0) : cellTerrainFlags(grid, at.x, at.y);
        return !(flags & policy.forbiddenFlags) && (!policy.requiresSubmergible || !!(cellTerrainMechFlags(grid, at.x, at.y) & TM_ALLOWS_SUBMERGING));
    }
    private area(graph: Graph): number { return graph.grid.width * graph.grid.height; }
    private node(graph: Graph, at: Readonly<Pos>, pose: RigidPose): number {
        const p = graph.shape.poses.indexOf(pose);
        return p < 0 || !integer(at.x) || !integer(at.y) || !graph.grid.isValidPos(at.x, at.y) ? -1 : p * this.area(graph) + at.y * graph.grid.width + at.x;
    }
    private at(graph: Graph, node: number): Pos { const i = node % this.area(graph); return { x: i % graph.grid.width, y: Math.floor(i / graph.grid.width) }; }
    private pose(graph: Graph, node: number): RigidPose { return graph.shape.poses[Math.floor(node / this.area(graph))]!; }
    private buildTerrain(actor: Creature, shape: CompiledRigidFootprint, policy: Policy): Graph {
        const grid = this.spatial.grid, length = grid.width * grid.height * shape.poses.length;
        const graph: Graph = { grid, shape, fit: new Uint8Array(length), cost: new Float64Array(length), clockwise: new Uint8Array(length), counterclockwise: new Uint8Array(length) };
        const options = { allowsTerrain: (at: Pos) => this.allows(grid, at, policy) };
        for (let i = 0; i < length; i++) {
            const at = this.at(graph, i), pose = this.pose(graph, i);
            if (!this.spatial.canFitTerrainAt(actor, at, options, pose)) continue;
            graph.fit[i] = 1; graph.cost[i] = 1;
            for (const offset of shape.cells.get(pose)!) {
                const flags = cellTerrainFlags(grid, at.x + offset.x, at.y + offset.y);
                for (const entry of policy.costs) if (flags & entry.flags) graph.cost[i] = Math.max(graph.cost[i]!, entry.cost);
            }
            if (shape.poses.length > 1) {
                graph.clockwise[i] = +this.spatial.canRotateBetween(actor, at, pose, 1, options, true);
                graph.counterclockwise[i] = +this.spatial.canRotateBetween(actor, at, pose, -1, options, true);
            }
        }
        this.terrainBuilds++;
        return graph;
    }
    private goals(actor: Creature, goal: RigidPoseGoal, graph: Graph): number[] {
        const result = new Set<number>();
        if (goal.kind === 'anchors') {
            if (goal.anchors.length > graph.fit.length) throw new SpatialValidationError('Rigid target budget exceeded');
            for (const at of goal.anchors) {
                if (!integer(at.x, -32768, 32767) || !integer(at.y, -32768, 32767) || at.pose !== undefined && !graph.shape.poses.includes(at.pose))
                    throw new SpatialValidationError('Invalid rigid target pose or anchor');
                for (const pose of at.pose ? [at.pose] : graph.shape.poses) {
                    const i = this.node(graph, at, pose);
                    if (i >= 0 && graph.fit[i]) result.add(i);
                }
            }
        } else if (goal.kind === 'contact' || goal.kind === 'escape') {
            if (!this.spatial.isActive(goal.target) || goal.target === actor) return [];
            const targets = footprintOf(goal.target, this.spatial.catalog), occupied = new Set(targets.map(p => `${p.x},${p.y}`));
            for (const pose of graph.shape.poses) {
                const offsets = graph.shape.cells.get(pose)!;
                for (const target of targets) for (const offset of offsets) for (const [dx, dy] of DIRS) {
                    const at = { x: target.x - offset.x + dx, y: target.y - offset.y + dy }, i = this.node(graph, at, pose);
                    if (i < 0 || !graph.fit[i] || result.has(i) || offsets.some(o => occupied.has(`${at.x+o.x},${at.y+o.y}`))) continue;
                    if (offsets.some(o => targets.some(t => {
                        const x = at.x+o.x, y = at.y+o.y, tx=t.x-x, ty=t.y-y;
                        return Math.max(Math.abs(tx), Math.abs(ty)) === 1 && (!(tx && ty)
                            || !((cellTerrainFlags(graph.grid, x+tx, y) | cellTerrainFlags(graph.grid, x, y+ty)) & T_OBSTRUCTS_DIAGONAL_MOVEMENT));
                    }))) result.add(i);
                }
            }
        } else throw new SpatialValidationError('Unknown rigid target kind');
        return [...result].sort((a,b) => a-b);
    }
    private neighbors(actor: Creature, graph: Graph, from: number, usable: Uint8Array, options?: { allowsTerrain: (at: Pos) => boolean }): number[] {
        if (from < 0) return [];
        const at = this.at(graph, from), pose = this.pose(graph, from), result: number[] = [];
        const fits = (p: Pos) => !!usable[this.node(graph, p, pose)];
        for (const [dx, dy] of DIRS) {
            const to = { x: at.x+dx, y: at.y+dy };
            const edge = graph.shape.cells.get(pose)!.length > 1 ? conservativeSquareStep(at, to, fits)
                : fits(to) && (!(dx && dy) || !((cellTerrainFlags(graph.grid, at.x+dx, at.y) | cellTerrainFlags(graph.grid, at.x, at.y+dy)) & T_OBSTRUCTS_DIAGONAL_MOVEMENT));
            if (edge) result.push(this.node(graph, to, pose));
        }
        for (const turn of [1, -1] as const) {
            const to = this.node(graph, at, turnedPose(pose, turn));
            if (usable[to] && (turn === 1 ? graph.clockwise[from] : graph.counterclockwise[from])
                && (!options || this.spatial.canRotateBetween(actor, at, pose, turn, options))) result.push(to);
        }
        return result;
    }
    private scan(actor: Creature, graph: Graph, goals: readonly number[], usable: Uint8Array, options?: { allowsTerrain: (at: Pos) => boolean }): Float64Array {
        const distances = new Float64Array(usable.length).fill(Infinity), queue = new PathFrontier();
        for (const i of goals) if (usable[i]) { distances[i] = 0; queue.improve(String(i), { x: i, y: 0 }, 0); }
        while (queue.length) {
            const i = queue.pop().x;
            this.visitedNodes++;
            for (const j of this.neighbors(actor, graph, i, usable, options)) {
                // Reverse edges have the same swept geometry. Rotations cost
                // one positive action; translation pays the entered terrain.
                const rotation = this.pose(graph, i) !== this.pose(graph, j);
                const distance = distances[i]! + (rotation ? 1 : graph.cost[i]!);
                if (distance < distances[j]!) { distances[j] = distance; queue.improve(String(j), { x: j, y: 0 }, distance); }
            }
        }
        return distances;
    }
    private next(actor: Creature, graph: Graph, from: number, distances: Float64Array, usable: Uint8Array, options?: { allowsTerrain: (at: Pos) => boolean }): number | undefined {
        const current = distances[from];
        if (!Number.isFinite(current) || current === 0) return undefined;
        return this.neighbors(actor, graph, from, usable, options).find(i => (this.pose(graph, i) !== this.pose(graph, from) ? 1 : graph.cost[i]!) + distances[i]! === current);
    }
    private liveEdge(actor: Creature, graph: Graph, from: number, to: number, options: { allowsTerrain: (at: Pos) => boolean }): boolean {
        const a = this.pose(graph, from), b = this.pose(graph, to);
        return a === b ? this.spatial.canStepBetween(actor, this.at(graph, from), this.at(graph, to), options, a)
            : this.spatial.canRotateBetween(actor, this.at(graph, from), a, turnedPose(a, 1) === b ? 1 : -1, options);
    }
    private result(actor: Creature, graph: Graph, from: number, to: number, replanned: boolean): RigidPoseStep {
        const a = this.pose(graph, from), b = this.pose(graph, to);
        return a === b ? { kind: 'step', at: Object.freeze(this.at(graph, to)), pose: b, replanned }
            : { kind: 'rotate', at: Object.freeze(this.at(graph, from)), pose: b, quarterTurns: turnedPose(a, 1) === b ? 1 : -1,
                actionCost: actor.movementSpeed, replanned };
    }
}
