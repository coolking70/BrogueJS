import type { Creature } from '../../entities/Creature';
import type { Pos } from '../../types';
import { CreatureSpatial, conservativeSquareStep, footprintOf, squareMovementSize } from '../Movement/CreatureSpatial';
import { SpatialValidationError, integer } from '../Movement/SpatialSchema';
import type { Grid } from './Grid';
import { PathFrontier } from './PathFrontier';
import { T_OBSTRUCTS_PASSABILITY, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from './TerrainCatalog';
import { cellTerrainFlags } from './DungeonFeature';

/** Immutable value policy. Immunity/status changes are represented by different
 * forbidden flags/costs, not by a closure whose behavior can change behind the
 * cache key. Occupancy never participates in the shared terrain table. */
export interface FootprintTraversalPolicy {
    readonly forbiddenFlags?: number;
    readonly costs?: readonly { readonly flags: number; readonly cost: number }[];
}
export type FootprintGoal =
    | { readonly kind: 'contact'; readonly target: Creature }
    | { readonly kind: 'anchors'; readonly anchors: readonly Readonly<Pos>[] };
export type FootprintStep = Readonly<{
    kind: 'step' | 'arrived' | 'blocked' | 'unreachable' | 'unsupported';
    at?: Readonly<Pos>;
    replanned: boolean;
}>;
export interface FootprintPathingStats {
    terrainBuilds: number; distanceBuilds: number; dynamicReplans: number;
    cacheHits: number; visitedNodes: number; cachedGraphs: number;
}
interface TerrainGraph {
    grid: Grid; fit: Uint8Array; cost: Float64Array;
    targetKey?: string; distances?: Float64Array;
}
// Stable y/x ties. Every move costs one action before optional terrain costs;
// diagonals do not silently cost sqrt(2) turns for a rigid square body.
const DIRS = [
    [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
] as const;
const MAX_GRAPHS = 8;

/** 4a-1 native square pathing submilestone. Explicit session service, derived
 * only; never installed on an ordinary Game, never saved, no RNG. NPC selection
 * and displacement/environment entrances remain gated until their own migration.
 * At most eight shape/policy groups, each with ONE current target distance map. */
export class FootprintPathing {
    private readonly graphs = new Map<string, TerrainGraph>();
    private grid?: Grid;
    private terrainRevision = -1;
    private terrainBuilds = 0;
    private distanceBuilds = 0;
    private dynamicReplans = 0;
    private cacheHits = 0;
    private visitedNodes = 0;
    constructor(private readonly spatial: CreatureSpatial) {}

    get stats(): Readonly<FootprintPathingStats> {
        return Object.freeze({ terrainBuilds: this.terrainBuilds, distanceBuilds: this.distanceBuilds,
            dynamicReplans: this.dynamicReplans, cacheHits: this.cacheHits, visitedNodes: this.visitedNodes,
            cachedGraphs: this.graphs.size });
    }
    clear(): void { this.graphs.clear(); this.grid = undefined; this.terrainRevision = -1; }

    planStep(actor: Creature, goal: FootprintGoal, policy: FootprintTraversalPolicy = {}): FootprintStep {
        // No cell scan, terrain subscription, arrays or counters for 1x1. Their
        // native AI still owns its original path and exact tie/RNG contract.
        if (!Object.prototype.hasOwnProperty.call(actor, 'spatial')) {
            if (!this.spatial.capabilityUsers && this.graphs.size) this.clear();
            return { kind: 'unsupported', replanned: false };
        }
        squareMovementSize(actor, this.spatial.catalog);
        if (!this.spatial.isActive(actor)) throw new SpatialValidationError('Inactive or unowned square pathing actor');
        const grid = this.spatial.grid;
        const revision = this.spatial.terrainRevision;
        if (this.grid !== grid || this.terrainRevision !== revision) {
            this.graphs.clear(); this.grid = grid; this.terrainRevision = revision;
        }
        const normalized = this.policy(policy);
        const key = JSON.stringify([actor.spatial!.footprintId, actor.spatial!.pose, normalized]);
        let graph = this.graphs.get(key);
        if (graph) {
            this.cacheHits++; this.graphs.delete(key); this.graphs.set(key, graph);
        } else {
            graph = this.buildTerrain(actor, normalized);
            this.graphs.set(key, graph);
            if (this.graphs.size > MAX_GRAPHS) this.graphs.delete(this.graphs.keys().next().value!);
        }
        const goals = this.goals(actor, goal, graph);
        const targetKey = JSON.stringify(goals);
        if (graph.targetKey !== targetKey) {
            graph.targetKey = targetKey;
            graph.distances = this.scan(graph, goals, graph.fit);
            this.distanceBuilds++;
        }
        const start = actor.y * grid.width + actor.x;
        if (!grid.isValidPos(actor.x, actor.y) || !Number.isFinite(graph.distances![start])) return { kind: 'unreachable', replanned: false };
        const options = { allowsTerrain: (p: Pos) => !(cellTerrainFlags(grid, p.x, p.y) & normalized.forbiddenFlags) };
        if (graph.distances![start] === 0) return { kind: 'arrived', replanned: false };
        const next = this.next(graph, actor.loc, graph.distances!, graph.fit);
        if (next && this.spatial.canStepFootprint(actor, next, options)) return { kind: 'step', at: Object.freeze(next), replanned: false };

        // A blocked optimistic step gets exactly ONE finite, map-sized replan.
        // Recheck full live occupancy/eligibility even when it changed without a
        // location write (death/dormancy); no dynamic map survives this call.
        this.dynamicReplans++;
        const usable = new Uint8Array(graph.fit.length);
        for (let i = 0; i < usable.length; i++) if (graph.fit[i]) {
            usable[i] = +this.spatial.canFitAt(actor, this.pos(grid, i), options);
        }
        const distances = this.scan(graph, goals.filter(i => usable[i]), usable);
        const alternative = this.next(graph, actor.loc, distances, usable);
        if (alternative && this.spatial.canStepFootprint(actor, alternative, options)) {
            return { kind: 'step', at: Object.freeze(alternative), replanned: true };
        }
        return { kind: 'blocked', replanned: true };
    }

    private policy(policy: FootprintTraversalPolicy): { forbiddenFlags: number; costs: { flags: number; cost: number }[] } {
        if (Object.keys(policy).some(k => !['forbiddenFlags', 'costs'].includes(k))
            || !integer(policy.forbiddenFlags ?? 0, 0, 0x7fffffff)
            || (policy.costs !== undefined && (!Array.isArray(policy.costs) || policy.costs.length > 32))) {
            throw new SpatialValidationError('Invalid square traversal policy');
        }
        const costs = (policy.costs ?? []).map(c => {
            if (Object.keys(c).some(k => !['flags', 'cost'].includes(k)) || !integer(c.flags, 0, 0x7fffffff)
                || !integer(c.cost, 1, 1000000)) throw new SpatialValidationError('Invalid square traversal cost');
            return { flags: c.flags, cost: c.cost };
        }).sort((a, b) => a.flags - b.flags || a.cost - b.cost);
        return { forbiddenFlags: T_OBSTRUCTS_PASSABILITY | (policy.forbiddenFlags ?? 0), costs };
    }
    private buildTerrain(actor: Creature, policy: ReturnType<FootprintPathing['policy']>): TerrainGraph {
        const grid = this.spatial.grid, length = grid.width * grid.height;
        const fit = new Uint8Array(length), cost = new Float64Array(length);
        const offsets = this.spatial.catalog.cells(actor.spatial!.footprintId, 'r0');
        const options = { allowsTerrain: (p: Pos) => !(cellTerrainFlags(grid, p.x, p.y) & policy.forbiddenFlags) };
        for (let i = 0; i < length; i++) {
            const at = this.pos(grid, i);
            if (!this.spatial.canFitTerrainAt(actor, at, options)) continue;
            fit[i] = 1; cost[i] = 1;
            for (const p of offsets) {
                const flags = cellTerrainFlags(grid, at.x + p.x, at.y + p.y);
                for (const entry of policy.costs) if (flags & entry.flags) cost[i] = Math.max(cost[i]!, entry.cost);
            }
        }
        this.terrainBuilds++;
        return { grid, fit, cost };
    }
    private goals(actor: Creature, goal: FootprintGoal, graph: TerrainGraph): number[] {
        const { grid, fit } = graph;
        const result = new Set<number>();
        if (goal.kind === 'anchors') {
            if (goal.anchors.length > fit.length) throw new SpatialValidationError('Square target budget exceeded');
            for (const p of goal.anchors) {
                if (!integer(p.x, -32768, 32767) || !integer(p.y, -32768, 32767)) throw new SpatialValidationError('Invalid square target anchor');
                if (grid.isValidPos(p.x, p.y) && fit[p.y * grid.width + p.x]) result.add(p.y * grid.width + p.x);
            }
        } else if (goal.kind === 'contact') {
            if (!this.spatial.isActive(goal.target) || goal.target === actor) return [];
            squareMovementSize(goal.target, this.spatial.catalog);
            const targets = footprintOf(goal.target, this.spatial.catalog);
            const targetCells = new Set(targets.map(p => `${p.x},${p.y}`));
            const offsets = this.spatial.catalog.cells(actor.spatial!.footprintId, 'r0');
            for (const target of targets) for (const offset of offsets) for (const [dx, dy] of DIRS) {
                const p = { x: target.x - offset.x + dx, y: target.y - offset.y + dy };
                const i = p.y * grid.width + p.x;
                if (!grid.isValidPos(p.x, p.y) || !fit[i] || result.has(i)) continue;
                if (offsets.some(o => targetCells.has(`${p.x + o.x},${p.y + o.y}`))) continue;
                const contact = offsets.some(o => targets.some(t => {
                    const from = { x: p.x + o.x, y: p.y + o.y };
                    const tx = t.x - from.x, ty = t.y - from.y;
                    return Math.max(Math.abs(tx), Math.abs(ty)) === 1 && (!(tx && ty)
                        || !((cellTerrainFlags(grid, from.x + tx, from.y) | cellTerrainFlags(grid, from.x, from.y + ty)) & T_OBSTRUCTS_DIAGONAL_MOVEMENT));
                }));
                if (contact) result.add(i);
            }
        } else throw new SpatialValidationError('Unknown square target kind');
        return [...result].sort((a, b) => a - b);
    }
    private pos(grid: Grid, i: number): Pos { return { x: i % grid.width, y: Math.floor(i / grid.width) }; }
    /** The same conservative square edge as CreatureSpatial.canStepBetween:
     * destination AND both orthogonal intermediate anchors in the given graph. */
    private edge(grid: Grid, from: Pos, to: Pos, usable: Uint8Array): boolean {
        return conservativeSquareStep(from, to, p => grid.isValidPos(p.x, p.y) && !!usable[p.y * grid.width + p.x]);
    }
    private scan(graph: TerrainGraph, goals: readonly number[], usable: Uint8Array): Float64Array {
        const { grid, cost } = graph, distances = new Float64Array(usable.length).fill(Infinity);
        const queue = new PathFrontier();
        for (const i of goals) if (usable[i]) { distances[i] = 0; queue.improve(String(i), this.pos(grid, i), 0); }
        while (queue.length) {
            const current = queue.pop(), i = current.y * grid.width + current.x;
            this.visitedNodes++;
            for (const [dx, dy] of DIRS) {
                const next = { x: current.x + dx, y: current.y + dy };
                if (!this.edge(grid, current, next, usable)) continue;
                const j = next.y * grid.width + next.x;
                // Reverse Dijkstra: edge next -> current pays current's cost.
                const distance = distances[i]! + cost[i]!;
                if (distance < distances[j]!) { distances[j] = distance; queue.improve(String(j), next, distance); }
            }
        }
        return distances;
    }
    private next(graph: TerrainGraph, from: Pos, distances: Float64Array, usable: Uint8Array): Pos | undefined {
        const current = distances[from.y * graph.grid.width + from.x]!;
        if (!Number.isFinite(current) || current === 0) return undefined;
        for (const [dx, dy] of DIRS) {
            const to = { x: from.x + dx, y: from.y + dy }, i = to.y * graph.grid.width + to.x;
            if (this.edge(graph.grid, from, to, usable) && graph.cost[i]! + distances[i]! === current) return to;
        }
        return undefined;
    }
}
