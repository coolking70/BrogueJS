import { isJson, validId } from './json';

/** Foundation-owned geometry. Creatures only retain its ID, never a second
 * copy of the bounds. The first executable region capability is rectangular. */
export interface OwnedRegionPlacement {
    readonly guard?: 'return-to-spawn';
    readonly instanceKey: string;
    readonly bounds: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}
export interface OwnedRegion extends OwnedRegionPlacement {
    readonly id: number; readonly owner: string; readonly depth: number;
}
export const OWNED_REGION_LIMIT = 128;
const integer = (v: unknown, min: number, max: number): v is number => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
const keys = (v: unknown, names: readonly string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
    && Object.keys(v).sort().join(',') === [...names].sort().join(',');
export function validRegionPlacement(v: unknown): v is OwnedRegionPlacement {
    if (!isJson(v) || !v || typeof v !== 'object' || !keys(v, ['instanceKey', 'bounds', ...(Object.prototype.hasOwnProperty.call(v, 'guard') ? ['guard'] : [])]) || ('guard' in v && v.guard !== 'return-to-spawn') || !validId(v.instanceKey) || !keys(v.bounds, ['x', 'y', 'width', 'height'])) return false;
    const b = v.bounds;
    return integer(b.x, 0, 1023) && integer(b.y, 0, 1023) && integer(b.width, 1, 1024) && integer(b.height, 1, 1024)
        && b.x + b.width <= 1024 && b.y + b.height <= 1024;
}
export function regionContains(region: OwnedRegion, at: { readonly x: number; readonly y: number }): boolean {
    const b = region.bounds;
    return Number.isInteger(at.x) && Number.isInteger(at.y) && at.x >= b.x && at.y >= b.y && at.x < b.x + b.width && at.y < b.y + b.height;
}
export function regionsOverlap(a: OwnedRegionPlacement, b: OwnedRegionPlacement): boolean {
    return a.bounds.x < b.bounds.x + b.bounds.width && b.bounds.x < a.bounds.x + a.bounds.width
        && a.bounds.y < b.bounds.y + b.bounds.height && b.bounds.y < a.bounds.y + a.bounds.height;
}
export function validOwnedRegions(value: unknown, owners: readonly string[]): value is OwnedRegion[] {
    if (!isJson(value) || !Array.isArray(value) || value.length === 0 || value.length > OWNED_REGION_LIMIT) return false;
    let previous = 0;
    const instances = new Set<string>();
    const seen: OwnedRegion[] = [];
    for (const row of value) {
        if (!row || typeof row !== 'object' || !keys(row, ['id', 'owner', 'depth', 'instanceKey', 'bounds', ...(Object.prototype.hasOwnProperty.call(row, 'guard') ? ['guard'] : [])]) || ('guard' in row && row.guard !== 'return-to-spawn') || !integer(row.id, previous + 1, Number.MAX_SAFE_INTEGER)
            || typeof row.owner !== 'string' || !owners.includes(row.owner) || !integer(row.depth, 1, 40)
            || !validRegionPlacement({ instanceKey: row.instanceKey, bounds: row.bounds })) return false;
        const region = row as unknown as OwnedRegion, instance = `${region.owner}:${region.instanceKey}`;
        if (instances.has(instance) || seen.some(other => other.depth === region.depth && regionsOverlap(other, region))) return false;
        instances.add(instance); seen.push(region); previous = region.id;
    }
    return true;
}
