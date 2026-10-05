import { assertWorldPoint, circleTouchesAabb, integerSqrt, WORLD_UNITS_PER_TILE as TILE,
    type WorldAabb, type WorldPoint } from './WorldUnits';
import type { SpatialHash } from './SpatialHash';

export interface CollisionGrid {
    readonly width: number; readonly height: number;
    getCell(x: number, y: number): { readonly isPassable: boolean } | null;
}
export interface CollisionWorld { grid: CollisionGrid; bodies?: Pick<SpatialHash, 'queryAabb'> }
export interface SweepHit { time: number; normal: WorldPoint; tile?: WorldPoint; bodyId?: number; plane?: { axis: 'x' | 'y'; coordinate: number } }
export const SWEEP_TIME = 1 << 20;
const TIME = BigInt(SWEEP_TIME);
const MAX_SWEEP = 4096;
type Fraction = { n: bigint; d: bigint };
const fraction = (n: number, d: number): Fraction => ({ n: BigInt(d < 0 ? -n : n), d: BigInt(Math.abs(d)) });
const compare = (a: Fraction, b: Fraction) => a.n * b.d - b.n * a.d;

/** Point versus the OPEN interior of a box. Tangential travel is not blocked. */
function sweepBox(p: WorldPoint, v: WorldPoint, b: WorldAabb): SweepHit | null {
    let enter: Fraction | null = null, leave: Fraction = { n: 1n, d: 1n };
    let normal = { x: 0, y: 0 };
    let plane: SweepHit['plane'];
    for (const axis of ['x', 'y'] as const) {
        const lo = axis === 'x' ? b.minX : b.minY, hi = axis === 'x' ? b.maxX : b.maxY;
        if (v[axis] === 0) { if (p[axis] <= lo || p[axis] >= hi) return null; continue; }
        const a = fraction((v[axis] > 0 ? lo : hi) - p[axis], v[axis]);
        const z = fraction((v[axis] > 0 ? hi : lo) - p[axis], v[axis]);
        if (!enter || compare(a, enter) > 0n) {
            enter = a; normal = { x: 0, y: 0 }; normal[axis] = v[axis] > 0 ? -1 : 1;
            plane = { axis, coordinate: v[axis] > 0 ? lo : hi };
        }
        if (compare(z, leave) < 0n) leave = z;
    }
    if (!enter || enter.n < 0n || leave.n <= 0n || compare(enter, leave) >= 0n) return null;
    return { time: Number(enter.n * TIME / enter.d), normal, plane };
}

/** Exact integer discriminant and conservative, quantized time of impact.
 * No floating square root or floating position enters authoritative state. */
function sweepDisc(p: WorldPoint, v: WorldPoint, center: WorldPoint, radius: number): SweepHit | null {
    const x = BigInt(p.x - center.x), y = BigInt(p.y - center.y), dx = BigInt(v.x), dy = BigInt(v.y);
    const a = dx * dx + dy * dy, b = 2n * (x * dx + y * dy), c = x * x + y * y - BigInt(radius) ** 2n;
    if (a === 0n || b >= 0n || c < 0n) return null;
    const discriminant = b * b - 4n * a * c;
    if (discriminant <= 0n) return null; // A tangent has no penetrating interval.
    const scaled = discriminant * TIME * TIME, root = integerSqrt(scaled);
    const ceilRoot = root * root === scaled ? root : root + 1n;
    const numerator = -b * TIME - ceilRoot;
    if (numerator < 0n || numerator > 2n * a * TIME) return null;
    const time = Number(numerator / (2n * a));
    return { time, normal: { x: Number(x + dx * BigInt(time) / TIME), y: Number(y + dy * BigInt(time) / TIME) } };
}

function bounds(p: WorldPoint, v: WorldPoint, r: number): WorldAabb {
    return { minX: Math.min(p.x, p.x + v.x) - r, minY: Math.min(p.y, p.y + v.y) - r,
        maxX: Math.max(p.x, p.x + v.x) + r, maxY: Math.max(p.y, p.y + v.y) + r };
}
function tileBoxes(grid: CollisionGrid, b: WorldAabb): { tile: WorldPoint; box: WorldAabb }[] {
    const result = [];
    for (let y = Math.max(-1, Math.floor(b.minY / TILE)); y <= Math.min(grid.height, Math.floor(b.maxY / TILE)); y++)
        for (let x = Math.max(-1, Math.floor(b.minX / TILE)); x <= Math.min(grid.width, Math.floor(b.maxX / TILE)); x++)
            if (!grid.getCell(x, y)?.isPassable) result.push({ tile: { x, y },
                box: { minX: x * TILE, minY: y * TILE, maxX: (x + 1) * TILE, maxY: (y + 1) * TILE } });
    return result;
}
export function circleIsFree(world: CollisionWorld, p: WorldPoint, radius: number, exceptId?: number): boolean {
    if (p.x < radius || p.y < radius || p.x > world.grid.width * TILE - radius || p.y > world.grid.height * TILE - radius) return false;
    const area = bounds(p, { x: 0, y: 0 }, radius);
    if (tileBoxes(world.grid, area).some(({ box }) => circleTouchesAabb(p, radius, box, false))) return false;
    return !(world.bodies?.queryAabb(area).some(body => body.id !== exceptId
        && (p.x - body.pose.x) ** 2 + (p.y - body.pose.y) ** 2 < (radius + body.radius) ** 2));
}

/** Sweep a circle against Grid cells and circle bodies. Rounded corners are
 * the union of two rectangles and four discs, never an inflated square. */
export function sweepCircle(world: CollisionWorld, p: WorldPoint, radius: number, delta: WorldPoint, exceptId?: number): SweepHit | null {
    assertWorldPoint(p); assertWorldPoint(delta);
    if (!Number.isSafeInteger(radius) || radius < 0 || radius > TILE || Math.abs(delta.x) > MAX_SWEEP || Math.abs(delta.y) > MAX_SWEEP)
        throw new Error('Invalid kinematic sweep budget');
    let first: SweepHit | null = null;
    const accept = (hit: SweepHit | null, identity: { tile?: WorldPoint; bodyId?: number }) => {
        if (hit && hit.time >= 0 && hit.time <= SWEEP_TIME && (!first || hit.time < first.time)) first = { ...hit, ...identity };
    };
    const area = bounds(p, delta, radius);
    for (const { tile, box } of tileBoxes(world.grid, area)) {
        accept(sweepBox(p, delta, { ...box, minX: box.minX - radius, maxX: box.maxX + radius }), { tile });
        accept(sweepBox(p, delta, { ...box, minY: box.minY - radius, maxY: box.maxY + radius }), { tile });
        if (radius > 0) for (const x of [box.minX, box.maxX]) for (const y of [box.minY, box.maxY])
            accept(sweepDisc(p, delta, { x, y }, radius), { tile });
    }
    for (const body of world.bodies?.queryAabb(area) ?? []) if (body.id !== exceptId)
        accept(sweepDisc(p, delta, body.pose, radius + body.radius), { bodyId: body.id });
    return first;
}

/** Kinematic slide, bounded to four contacts. Unspent displacement is discarded
 * at a blocked corner, not accumulated as teleport debt. */
export function moveCircle(world: CollisionWorld, start: WorldPoint, radius: number, delta: WorldPoint, exceptId?: number): WorldPoint {
    if (!circleIsFree(world, start, radius, exceptId)) throw new Error('Kinematic body begins in penetration');
    let p = { ...start }, remaining = { ...delta };
    for (let contact = 0; contact < 4 && (remaining.x || remaining.y); contact++) {
        const hit = sweepCircle(world, p, radius, remaining, exceptId);
        let time = hit?.time ?? SWEEP_TIME;
        const positionAt = (t: number) => ({ x: p.x + Math.trunc(remaining.x * t / SWEEP_TIME), y: p.y + Math.trunc(remaining.y * t / SWEEP_TIME) });
        let next = positionAt(time);
        // Axis planes have an exact integer boundary. Reach that boundary rather
        // than retaining a one-WU gap from time quantization; still validate it.
        if (hit?.plane) next[hit.plane.axis] = hit.plane.coordinate;
        // Component rounding near a curved corner can enter by < 2 WU. Back off
        // at least one WU along the path and verify the integer destination.
        const retreat = Math.ceil(SWEEP_TIME / Math.max(1, Math.abs(remaining.x), Math.abs(remaining.y)));
        for (let i = 0; i < 4 && !circleIsFree(world, next, radius, exceptId); i++) {
            time = Math.max(0, time - retreat); next = positionAt(time);
        }
        if (!circleIsFree(world, next, radius, exceptId)) break;
        const rest = { x: remaining.x - (next.x - p.x), y: remaining.y - (next.y - p.y) };
        p = next;
        if (!hit) break;
        const n = hit.normal, dot = rest.x * n.x + rest.y * n.y, square = n.x * n.x + n.y * n.y;
        if (dot >= 0 || square === 0) break;
        remaining = { x: Math.trunc(rest.x - n.x * dot / square), y: Math.trunc(rest.y - n.y * dot / square) };
    }
    return p;
}
