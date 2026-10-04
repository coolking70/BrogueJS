import { actorActionRecord, actorActionArray } from '../Core/ActorActionData';
import { extensionDataFingerprint } from '../../ext/fingerprint';
import type { Pos } from '../../types';
import type { CreatureSpatialView } from './SpatialSchema';
import { deepFreeze } from './SpatialSchema';

/** Bounded geometry primitive shared by content planners. The source is ONE
 * initiating member, never the union of all members. Geometry comes from 4a0. */
export interface AttackShapeRequest {
    schema: 1; kind: 'footprint-offset-union'; offsets: readonly Pos[];
    selfExclusion: 'source-member' | 'whole-group';
}
export interface AttackShapeWorld {
    contains(at: Readonly<Pos>): boolean;
    lineOfEffect(from: Readonly<Pos>, to: Readonly<Pos>): boolean;
}
const key = (p: Readonly<Pos>) => `${p.x},${p.y}`;
export function validateAttackShapeRequest(value: unknown): asserts value is AttackShapeRequest {
    actorActionRecord(value, ['schema', 'kind', 'offsets', 'selfExclusion']);
    if (value.schema !== 1 || value.kind !== 'footprint-offset-union'
        || !['source-member', 'whole-group'].includes(value.selfExclusion as string)) throw new Error('Invalid bounded attack shape');
    actorActionArray(value.offsets, 1, 256);
    const offsets = new Set<string>();
    for (const p of value.offsets) {
        actorActionRecord(p, ['x', 'y']);
        if (!Number.isSafeInteger(p.x) || !Number.isSafeInteger(p.y)
            || Math.abs(p.x as number) > 32 || Math.abs(p.y as number) > 32 || offsets.has(key(p as unknown as Pos)))
            throw new Error('Invalid attack offset');
        offsets.add(key(p as unknown as Pos));
    }
}
export function projectAttackShape(source: CreatureSpatialView, groupCells: readonly Pos[],
    shape: AttackShapeRequest, world: AttackShapeWorld): readonly Readonly<Pos>[] {
    validateAttackShapeRequest(shape);
    if (!source.cells.length || source.cells.length > 256 || groupCells.length > 1024) throw new Error('Invalid attack footprint budget');
    const group = new Set(groupCells.map(key));
    if (source.cells.some(p => !group.has(key(p)))) throw new Error('Source is outside group footprint');
    const excluded = shape.selfExclusion === 'whole-group' ? group : new Set(source.cells.map(key));
    const result = new Map<string, Pos>();
    for (const from of source.cells) for (const offset of shape.offsets) {
        const to = { x: from.x + offset.x, y: from.y + offset.y };
        if (!excluded.has(key(to)) && world.contains(to) && world.lineOfEffect(from, to)) result.set(key(to), to);
        if (result.size > 1024) throw new Error('Projected attack cell budget exceeded');
    }
    return deepFreeze([...result.values()].sort((a, b) => a.y - b.y || a.x - b.x));
}
/** Mechanical, canonical source identity. This is persistent data, unlike a
 * session token. Binding a loaded source never compares old session numbers. */
export function sourceFootprintVersion(view: CreatureSpatialView, generation = 1): string {
    if (!Number.isSafeInteger(generation) || generation < 1) throw new Error('Invalid source generation');
    return extensionDataFingerprint({ schema: 1, entityId: view.entityId, groupId: view.groupId,
        partId: view.partId, generation, footprintId: view.footprintId, pose: view.pose,
        anchor: view.anchor, cells: view.cells.map(p => ({ x: p.x, y: p.y, zoneId: p.zoneId })) });
}
