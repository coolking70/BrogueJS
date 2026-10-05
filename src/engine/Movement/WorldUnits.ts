/** Integer authoritative positions. Fractional velocity credit is also saved. */
export const WORLD_UNITS_PER_TILE = 1024;
export const MOTION_CREDIT = 65536;
export const MAX_WORLD_UNIT = 1 << 22;
export interface WorldPoint { x: number; y: number }
export interface KinematicPose extends WorldPoint { facing: number }
export interface CircleBody { id: number; pose: KinematicPose; radius: number }
export interface WorldAabb { minX: number; minY: number; maxX: number; maxY: number }

export function integerSqrt(value: bigint): bigint {
    if (value < 0n) throw new Error('Negative square root');
    if (value < 2n) return value;
    let x = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
    for (;;) { const next = (x + value / x) / 2n; if (next >= x) return x; x = next; }
}
export function worldToCell(p: WorldPoint): WorldPoint {
    return { x: Math.floor(p.x / WORLD_UNITS_PER_TILE), y: Math.floor(p.y / WORLD_UNITS_PER_TILE) };
}
export function assertWorldPoint(p: WorldPoint): void {
    if (!p || !Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y)
        || Math.abs(p.x) > MAX_WORLD_UNIT || Math.abs(p.y) > MAX_WORLD_UNIT) throw new Error('Invalid world point');
}
export function circleTouchesAabb(p: WorldPoint, radius: number, b: WorldAabb, inclusive = true): boolean {
    const x = p.x - Math.max(b.minX, Math.min(b.maxX, p.x));
    const y = p.y - Math.max(b.minY, Math.min(b.maxY, p.y));
    return inclusive ? x * x + y * y <= radius * radius : x * x + y * y < radius * radius;
}

/** Normalize diagonal input without floating authority; retain sub-unit speed.
 * A changing direction cannot release a stale residual on a released axis. */
export function movementDelta(moveX: number, moveY: number, speed: number, credit: WorldPoint): WorldPoint {
    const square = BigInt(moveX * moveX + moveY * moveY);
    const root = integerSqrt(square);
    const length = Math.max(127, Number(root * root === square ? root : root + 1n));
    const axis = (input: number, key: 'x' | 'y') => {
        if (input === 0) { credit[key] = 0; return 0; }
        const total = credit[key] + Math.trunc(input * speed * MOTION_CREDIT / length);
        const delta = Math.trunc(total / MOTION_CREDIT);
        credit[key] = total - delta * MOTION_CREDIT;
        return delta;
    };
    return { x: axis(moveX, 'x'), y: axis(moveY, 'y') };
}
