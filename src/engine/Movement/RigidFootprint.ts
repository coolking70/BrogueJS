import type { Pos } from '../../types';
import { compileFootprint, deepFreeze, SpatialValidationError, SPATIAL_LIMITS,
    transform, type FootprintCell, type FootprintDefinition, type Pose, type SpatialCatalog } from './SpatialSchema';

export type RigidPose = 'r0' | 'r90' | 'r180' | 'r270';
export const RIGID_POSES: readonly RigidPose[] = Object.freeze(['r0', 'r90', 'r180', 'r270']);
export type QuarterTurns = -2 | -1 | 1 | 2;
export interface CompiledRigidFootprint {
    readonly poses: readonly RigidPose[];
    readonly cells: ReadonlyMap<RigidPose, readonly FootprintCell[]>;
    /** Key = from:to. Only adjacent quarter turns have an edge. */
    readonly sweeps: ReadonlyMap<string, readonly Readonly<Pos>[]>;
}

export function turnedPose(pose: RigidPose, turns: number): RigidPose {
    return RIGID_POSES[(RIGID_POSES.indexOf(pose) + turns + 4) % 4]!;
}
export function rotationStages(from: Pose, turns: QuarterTurns): readonly RigidPose[] {
    if (!RIGID_POSES.includes(from as RigidPose) || ![-2, -1, 1, 2].includes(turns))
        throw new SpatialValidationError('Invalid rigid rotation or mirror request');
    return Object.freeze(Array.from({ length: Math.abs(turns) }, (_, i) => turnedPose(from as RigidPose, Math.sign(turns) * (i + 1))));
}
function readonlyMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
    const view: ReadonlyMap<K, V> = Object.freeze({
        get size() { return map.size; },
        get: (key: K) => map.get(key), has: (key: K) => map.has(key),
        entries: () => map.entries(), keys: () => map.keys(), values: () => map.values(),
        [Symbol.iterator]: () => map[Symbol.iterator](),
        forEach: (callback: (value: V, key: K, map: ReadonlyMap<K, V>) => void, thisArg?: unknown) =>
            map.forEach((value, key) => callback.call(thisArg, value, key, view)),
    });
    return view;
}

const HALF_PI = Math.PI / 2;
const EPS = 1e-10;
/** All roots of a*cos(theta)+b*sin(theta)=c in a quarter turn. These are
 * vertex/edge contact events, NOT samples of an animation. */
function roots(a: number, b: number, c: number): number[] {
    const radius = Math.hypot(a, b);
    if (!radius || Math.abs(c) > radius + EPS) return [];
    const phase = Math.atan2(b, a), angle = Math.acos(Math.max(-1, Math.min(1, c / radius)));
    const result: number[] = [];
    for (const sign of [-1, 1]) for (let n = -1; n <= 1; n++) {
        const theta = phase + sign * angle + n * Math.PI * 2;
        if (theta > 0 && theta < HALF_PI) result.push(theta);
    }
    return result;
}

/** SAT for a rotating unit square and an axis-aligned unit tile. Coordinates
 * denote tile CENTERS, so the integer anchor is the center of its origin tile.
 * Open overlap excludes the adjacent tiles merely sharing an endpoint edge.
 * Interior tangencies are conservatively included by the event check below. */
function overlaps(cell: Readonly<Pos>, tile: Readonly<Pos>, theta: number, closed = false): boolean {
    const c = Math.cos(theta), s = Math.sin(theta);
    const dx = cell.x * c - cell.y * s - tile.x, dy = cell.x * s + cell.y * c - tile.y;
    const reach = (1 + c + s) / 2;
    const projections = [Math.abs(dx), Math.abs(dy), Math.abs(dx * c + dy * s), Math.abs(-dx * s + dy * c)];
    return projections.every(distance => closed ? distance <= reach + EPS : distance < reach - EPS);
}

function sweptCellTouches(cell: Readonly<Pos>, tile: Readonly<Pos>): boolean {
    if (overlaps(cell, tile, 0) || overlaps(cell, tile, HALF_PI)) return true;
    const events = [0, HALF_PI];
    for (const dx of [-.5, .5]) for (const dy of [-.5, .5]) {
        const x = cell.x + dx, y = cell.y + dy;
        // Rotating vertex contacts a fixed tile edge.
        for (const side of [-.5, .5]) {
            events.push(...roots(x, -y, tile.x + side), ...roots(y, x, tile.y + side));
        }
        // Fixed vertex contacts a rotating cell edge (inverse rotation).
        const tx = tile.x + dx, ty = tile.y + dy;
        for (const side of [-.5, .5]) {
            events.push(...roots(tx, ty, cell.x + side), ...roots(ty, -tx, cell.y + side));
        }
    }
    events.sort((a, b) => a - b);
    for (let i = 1; i < events.length; i++) {
        if (overlaps(cell, tile, (events[i - 1]! + events[i]!) / 2)) return true;
        if (events[i]! < HALF_PI && overlaps(cell, tile, events[i]!, true)) return true;
    }
    return false;
}

/** Compile the conservative continuous r0 -> r90 sweep once per definition.
 * Between consecutive vertex/edge events intersection topology is constant;
 * testing that interval and its contact events covers the entire trajectory.
 * The disk bounds only enumerate candidate tiles; they are never the sweep.
 * No random stream, per-edge floating sampling or bounding-box body is used. */
export function compileQuarterSweep(cells: readonly Readonly<Pos>[], limit: number = SPATIAL_LIMITS.sweep): readonly Readonly<Pos>[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > SPATIAL_LIMITS.sweep || !cells.length
        || cells.length > SPATIAL_LIMITS.cells || cells.some(p => !Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y)
            || Math.abs(p.x) >= SPATIAL_LIMITS.span || Math.abs(p.y) >= SPATIAL_LIMITS.span))
        throw new SpatialValidationError('Invalid rotation sweep input or budget');
    const found = new Map<string, Readonly<Pos>>();
    for (const cell of cells) {
        const radius = Math.hypot(Math.abs(cell.x) + .5, Math.abs(cell.y) + .5);
        const bound = Math.floor(radius + .5);
        for (let y = -bound; y <= bound; y++) for (let x = -bound; x <= bound; x++) {
            const key = `${x},${y}`;
            if (!found.has(key) && sweptCellTouches(cell, { x, y })) {
                found.set(key, { x, y });
                if (found.size > limit) throw new SpatialValidationError('Rotation sweep budget exceeded');
            }
        }
    }
    return deepFreeze([...found.values()].sort((a, b) => a.y - b.y || a.x - b.x));
}

/** Executable 4b rigid geometry. Schema still models later mirrors/zone HP;
 * this narrower capability compiler refuses those unopened actions. Fixed
 * shapes have one declared rotation and allocate no sweep tables. */
export function compileRigidFootprint(definition: FootprintDefinition): CompiledRigidFootprint {
    const cells = compileFootprint(definition);
    if (definition.poses.some(p => !RIGID_POSES.includes(p as RigidPose))
        || (definition.poses.length !== 1 && (definition.poses.length !== 4 || RIGID_POSES.some(p => !cells.has(p)))))
        throw new SpatialValidationError('Rigid poses require a fixed orientation or four rotations; mirrors are not open');
    if (definition.zones?.some(z => z.health.kind !== 'native'))
        throw new SpatialValidationError('Rigid local zone health capability is not open');
    const poses = RIGID_POSES.filter(p => cells.has(p));
    const sweeps = new Map<string, readonly Readonly<Pos>[]>();
    if (poses.length > 1) {
        const base = compileQuarterSweep(cells.get('r0')!);
        for (const from of poses) {
            const to = turnedPose(from, 1);
            const sweep = deepFreeze(base.map(p => transform(p, from)).sort((a, b) => a.y - b.y || a.x - b.x));
            sweeps.set(`${from}:${to}`, sweep);
            sweeps.set(`${to}:${from}`, sweep); // The reverse traverses the same volume.
        }
    }
    return Object.freeze({ poses: Object.freeze(poses), cells: readonlyMap(new Map(cells) as Map<RigidPose, readonly FootprintCell[]>), sweeps: readonlyMap(sweeps) });
}

// Pure derived data, keyed by immutable catalog definitions; no world identity
// or serialized geometry is accepted as authority. Unused catalogs allocate 0.
const compiled = new WeakMap<SpatialCatalog, Map<FootprintDefinition, CompiledRigidFootprint>>();
export function rigidFootprint(catalog: SpatialCatalog, id: string): CompiledRigidFootprint {
    const definition = catalog.definition(id);
    let cache = compiled.get(catalog);
    if (!cache) { cache = new Map(); compiled.set(catalog, cache); }
    let result = cache.get(definition);
    if (!result) { result = compileRigidFootprint(definition); cache.set(definition, result); }
    return result;
}
