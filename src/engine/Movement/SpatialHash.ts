import { assertWorldPoint, circleTouchesAabb, WORLD_UNITS_PER_TILE, type CircleBody, type WorldAabb } from './WorldUnits';

/** Derived broad phase, rebuilt/updated by the simulation owner. Never serialized.
 * Query results are sorted by ID, independent of insertion and bucket order. */
export class SpatialHash {
    private readonly buckets = new Map<string, Set<number>>();
    private readonly bodies = new Map<number, CircleBody>();
    constructor(private readonly bucketSize = WORLD_UNITS_PER_TILE) {
        if (!Number.isSafeInteger(bucketSize) || bucketSize < 1) throw new Error('Invalid spatial bucket');
    }
    private keys(bounds: WorldAabb): string[] {
        assertWorldPoint({ x: bounds.minX, y: bounds.minY }); assertWorldPoint({ x: bounds.maxX, y: bounds.maxY });
        if (bounds.minX > bounds.maxX || bounds.minY > bounds.maxY) throw new Error('Invalid spatial bounds');
        const keys: string[] = [];
        for (let y = Math.floor(bounds.minY / this.bucketSize); y <= Math.floor(bounds.maxY / this.bucketSize); y++)
            for (let x = Math.floor(bounds.minX / this.bucketSize); x <= Math.floor(bounds.maxX / this.bucketSize); x++) keys.push(`${x},${y}`);
        return keys;
    }
    private bounds(body: CircleBody): WorldAabb {
        return { minX: body.pose.x - body.radius, minY: body.pose.y - body.radius,
            maxX: body.pose.x + body.radius, maxY: body.pose.y + body.radius };
    }
    upsert(body: CircleBody): void {
        assertWorldPoint(body.pose);
        if (!Number.isSafeInteger(body.id) || body.id < 1 || !Number.isSafeInteger(body.radius)
            || body.radius < 1 || body.radius > WORLD_UNITS_PER_TILE) throw new Error('Invalid circle body');
        const copy = structuredClone(body);
        const keys = this.keys(this.bounds(copy));
        this.remove(body.id);
        this.bodies.set(body.id, copy);
        for (const key of keys) {
            const bucket = this.buckets.get(key) ?? new Set<number>(); bucket.add(body.id); this.buckets.set(key, bucket);
        }
    }
    remove(id: number): void {
        const old = this.bodies.get(id); if (!old) return;
        for (const key of this.keys(this.bounds(old))) {
            const bucket = this.buckets.get(key)!; bucket.delete(id); if (!bucket.size) this.buckets.delete(key);
        }
        this.bodies.delete(id);
    }
    queryAabb(bounds: WorldAabb): CircleBody[] {
        const ids = new Set<number>();
        for (const key of this.keys(bounds)) for (const id of this.buckets.get(key) ?? []) ids.add(id);
        return [...ids].sort((a, b) => a - b).map(id => this.bodies.get(id)!)
            .filter(body => circleTouchesAabb(body.pose, body.radius, bounds)).map(body => structuredClone(body));
    }
}
