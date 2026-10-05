import type { Creature } from '../../entities/Creature';
import { bodyAttackAvailable, bodyDecisionActor } from '../Status/BodyStatuses';
import { footprintOf, spatialCatalogFor, type BodyTarget, type CreatureSpatial } from '../Movement/CreatureSpatial';
import { deepFreeze, integer, SpatialValidationError, validateSpatialComponent, type CreatureSpatialComponent,
    type FootprintDefinition, type HitZoneDefinition, type Ratio, type SpatialCatalog } from '../Movement/SpatialSchema';
import { type PartBreakCommitter, type PartBreakNativeCommit, type PartBreakReceipt, type PartBreakRequest } from '../../ext/partBreak';

/** Post-protection commit shared by native attacks and diagnostic fixtures:
 * callers supply a single already resolved actor-level hit/damage. Zone armor
 * (physical damage points), then its multiplier, are applied exactly once.
 * No roll, takeDamage(), extension hook, kill, death DF, drop or XP is called.
 * Native callers retain their original hooks, causality and death ordering. */
export interface FixedZoneHit {
    readonly resolutionId: number;
    readonly sourceId: number | null;
    readonly hit: boolean;
    readonly damage: number;
    readonly kind: 'physical' | 'other';
}
export interface FixedZoneHitResult {
    readonly resolutionId: number;
    readonly entityId: number;
    readonly zoneId: string;
    readonly postProtectionDamage: number;
    readonly localHpLost: number;
    readonly nativeHpLost: number;
    readonly breakReceipt: PartBreakReceipt | null;
    readonly breakHandling: 'handled' | 'fallback' | null;
}
export type LocalZoneState = NonNullable<CreatureSpatialComponent['zoneState']>[number];

function fixedDefinition(catalog: SpatialCatalog, footprintId: string): FootprintDefinition {
    const d = catalog.definition(footprintId);
    if (d.poses.some(p => p.startsWith('m'))) throw new SpatialValidationError('Fixed zone mirrors are not open');
    for (const z of d.zones ?? []) {
        if (z.health.kind === 'local' && z.health.ownerTransfer.numerator !== z.health.ownerTransfer.denominator)
            throw new SpatialValidationError('Fixed local zone transfer must be 1:1');
        const rule = catalog.breakRule(z.breakRuleId);
        if (rule.disposition !== 'keep-zone' || rule.regenerate !== undefined || rule.replacementFootprintId !== undefined)
            throw new SpatialValidationError('Fixed zone topology/regeneration capability is not open');
    }
    return d;
}
export function initialLocalZoneState(catalog: SpatialCatalog, footprintId: string): LocalZoneState[] {
    return (fixedDefinition(catalog, footprintId).zones ?? []).flatMap(z => z.health.kind === 'local'
        ? [{ zoneId: z.id, hp: z.health.maxHp, broken: false, generation: 0 }] : []);
}

/** Broken/generation state IS the unique receipt set; there is no independent
 * persisted ledger or write-on-load modifier. Useful after load/seek/clone. */
export function fixedZoneBreaks(actor: Creature, catalog: SpatialCatalog): readonly PartBreakReceipt[] {
    if (!actor.spatial) return Object.freeze([]);
    fixedDefinition(catalog, actor.spatial.footprintId);
    validateSpatialComponent(actor.spatial, catalog, false);
    return deepFreeze((actor.spatial.zoneState ?? []).filter(z => z.broken).map(z => ({
        groupId: actor.spatial!.bodyMember?.groupId ?? actor.id, partId: actor.spatial!.bodyMember?.partId ?? 'self', zoneId: z.zoneId, generation: 0 as const,
    })));
}
export function fixedZoneAttackAvailable(actor: Creature, attackId: string, catalog: SpatialCatalog): boolean {
    return !fixedZoneBreaks(actor, catalog).some(b => catalog.breakRule(zoneDefinition(actor, b.zoneId, catalog)!.breakRuleId)
        .modifiers.some(m => m.kind === 'disable-attack' && m.attackId === attackId));
}
/** Multiply rational tick costs once from the immutable native base. BigInt
 * keeps products exact even with eight finite declarations; no saved speed
 * is repeatedly multiplied. Positive bounded actor clock is required. */
export function fixedZoneMoveTicks(actor: Creature, nativeTicks: number, catalog: SpatialCatalog): number {
    if (!integer(nativeTicks, 1, 1000000)) throw new SpatialValidationError('Invalid native movement cost');
    let numerator = BigInt(nativeTicks), denominator = 1n;
    for (const b of fixedZoneBreaks(actor, catalog)) for (const m of catalog.breakRule(zoneDefinition(actor, b.zoneId, catalog)!.breakRuleId).modifiers)
        if (m.kind === 'move-ticks-multiplier') { numerator *= BigInt(m.numerator); denominator *= BigInt(m.denominator); }
    const ticks = (numerator + denominator - 1n) / denominator;
    if (ticks < 1n || ticks > 1000000n) throw new SpatialValidationError('Broken zone movement cost budget exceeded');
    return Number(ticks);
}
export function nativeZoneMoveTicks(actor: Creature, ticks: number): number {
    return actor.spatial?.zoneState ? fixedZoneMoveTicks(actor, ticks, spatialCatalogFor(actor)) : ticks;
}
export function nativeZoneAttackAvailable(actor: Creature, attackId: string): boolean {
    return bodyAttackAvailable(actor, attackId) && (!actor.spatial?.zoneState || fixedZoneAttackAvailable(actor, attackId, spatialCatalogFor(actor)));
}
function zoneDefinition(actor: Creature, zoneId: string, catalog: SpatialCatalog): HitZoneDefinition | undefined {
    return actor.spatial ? catalog.definition(actor.spatial.footprintId).zones?.find(z => z.id === zoneId) : undefined;
}
/** Exposures replace the zone's multiplier, taking the largest declared ratio
 * when several broken zones expose the same target. They do not multiply one
 * another; canonical tie/order is irrelevant. This is a pure mechanical read,
 * NOT a public/UI query of hidden zone knowledge. */
export function fixedZoneDamageMultiplier(actor: Creature, zoneId: string, catalog: SpatialCatalog): Readonly<Ratio> {
    const zone = zoneDefinition(actor, zoneId, catalog);
    let result = zone?.damageMultiplier ?? { numerator: 1, denominator: 1 };
    for (const b of fixedZoneBreaks(actor, catalog)) for (const m of catalog.breakRule(zoneDefinition(actor, b.zoneId, catalog)!.breakRuleId).modifiers)
        if (m.kind === 'expose-zone' && m.zoneId === zoneId
            && m.damageMultiplier.numerator * result.denominator > result.numerator * m.damageMultiplier.denominator) result = m.damageMultiplier;
    return Object.freeze({ ...result });
}

export function resolveFixedZoneHit(spatial: CreatureSpatial, target: BodyTarget, hit: FixedZoneHit,
    commitBreak?: PartBreakCommitter): Readonly<FixedZoneHitResult> {
    if (!spatial.catalog.fixture && target.entity.spatial) {
        try { spatial.catalog.definition(target.entity.spatial.footprintId); }
        catch { throw new SpatialValidationError('Fixed zone production catalog contact unavailable'); }
    }
    const current = spatial.occupantsAtCell(target.contact).find(t => t.entity === target.entity);
    if (!current || current.zoneId !== target.zoneId) throw new SpatialValidationError('Stale or invalid fixed zone contact');
    return resolveFixedZoneContact(spatial.catalog, target, hit, commitBreak);
}
/** Production and fixture share the same post-protection, no-roll commit. */
export function resolveFixedZoneContact(catalog: SpatialCatalog, target: BodyTarget, hit: FixedZoneHit,
    commitBreak?: PartBreakCommitter): Readonly<FixedZoneHitResult> {
    if (!integer(hit.resolutionId, 1) || !integer(hit.damage, 0, 1000000) || typeof hit.hit !== 'boolean'
        || (hit.sourceId !== null && !integer(hit.sourceId, 1)) || !['physical', 'other'].includes(hit.kind)
        || (!hit.hit && hit.damage !== 0)) throw new SpatialValidationError('Invalid fixed zone hit');
    const actor = target.entity, current = footprintOf(actor, catalog).find(p => p.x === target.contact.x && p.y === target.contact.y);
    if (!current || actor.id !== target.entityId || target.groupId !== (actor.spatial?.bodyMember?.groupId ?? actor.id)
        || target.partId !== (actor.spatial?.bodyMember?.partId ?? null) || current.zoneId !== target.zoneId || target.dedupKey !== `part:${actor.id}:${target.zoneId}`)
        throw new SpatialValidationError('Stale or invalid fixed zone contact');
    if (!integer(actor.hp, 1)) throw new SpatialValidationError('Invalid native HP');
    if (actor.spatial) {
        fixedDefinition(catalog, actor.spatial.footprintId);
        validateSpatialComponent(actor.spatial, catalog, false);
        }
    const zone = zoneDefinition(actor, target.zoneId, catalog);
    const state = zone?.health.kind === 'local' ? actor.spatial!.zoneState!.find(z => z.zoneId === zone.id)! : undefined;
    const multiplier = fixedZoneDamageMultiplier(actor, target.zoneId, catalog);
    const damage = !hit.hit || state?.broken ? 0 : Math.floor(Math.max(0, hit.damage - (hit.kind === 'physical' ? zone?.armor ?? 0 : 0))
        * multiplier.numerator / multiplier.denominator);
    const localHpLost = state ? Math.min(damage, state.hp) : 0;
    const nativeHpLost = Math.min(actor.hp, state ? localHpLost : damage);
    const breaking = !!state && !state.broken && localHpLost > 0 && localHpLost === state.hp;
    const receipt: PartBreakReceipt | null = breaking ? { groupId: actor.spatial?.bodyMember?.groupId ?? actor.id, partId: actor.spatial?.bodyMember?.partId ?? 'self', zoneId: state!.zoneId, generation: 0 } : null;
    const result = (handling: FixedZoneHitResult['breakHandling']) => deepFreeze({ resolutionId: hit.resolutionId,
        entityId: actor.id, zoneId: target.zoneId, postProtectionDamage: damage, localHpLost, nativeHpLost,
        breakReceipt: receipt, breakHandling: handling });
    if (!breaking) {
        if (state) state.hp -= localHpLost;
        actor.hp -= nativeHpLost;
        return result(null);
    }
    const balance = catalog.breakRule(zone!.breakRuleId).modifiers.find(m => m.kind === 'balance-loss');
    const request: PartBreakRequest = deepFreeze({ ...receipt!, schema: 1, resolutionId: hit.resolutionId,
        actorId: actor.spatial?.bodyMember?.groupId ?? actor.id, sourceId: hit.sourceId, balanceLoss: balance?.amount ?? 0, fallbackStunTicks: balance?.fallbackStunTicks ?? 0 });
    const s = actor.spatial!, hp = actor.hp, zoneHp = state!.hp, broken = state!.broken;
    const lockOwner = bodyDecisionActor(actor).spatial ?? s;
    const hadLock = Object.prototype.hasOwnProperty.call(lockOwner, 'actionLockInTicks'), lock = lockOwner.actionLockInTicks;
    let applied = false;
    const native: PartBreakNativeCommit<Readonly<FixedZoneHitResult>> = {
        apply(choice) {
            if (applied || actor.spatial !== s || actor.hp !== hp || state!.hp !== zoneHp || state!.broken !== broken
                || !s.zoneState?.includes(state!)) throw new SpatialValidationError('Stale or duplicate fixed zone break commit');
            applied = true;
            actor.hp -= nativeHpLost; state!.hp = 0; state!.broken = true;
            if (choice.status === 'fallback' && request.fallbackStunTicks > 0)
                lockOwner.actionLockInTicks = Math.max(lockOwner.actionLockInTicks ?? 0, request.fallbackStunTicks);
            return result(choice.status);
        },
        rollback() {
            if (!applied) return;
            actor.hp = hp; state!.hp = zoneHp; state!.broken = broken;
            if (hadLock) lockOwner.actionLockInTicks = lock!; else delete lockOwner.actionLockInTicks;
            applied = false;
        },
    };
    try { return commitBreak ? commitBreak(request, native) : native.apply({ status: 'fallback', reason: 'absent' }); }
    catch (error) { native.rollback(); throw error; }
}

/** Diagnostic clock helper. Production uses TimeCoordinator's elapsed native
 * ticks; this helper never changes native speed/ticks. */
export function advanceFixedZoneLock(actor: Creature, elapsedTicks: number, catalog: SpatialCatalog): void {
    if (!integer(elapsedTicks, 0, 1000000)) throw new SpatialValidationError('Invalid fixed zone clock');
    fixedZoneBreaks(actor, catalog);
    if (actor.spatial?.actionLockInTicks !== undefined) {
        const remaining = Math.max(0, actor.spatial.actionLockInTicks - elapsedTicks);
        if (remaining) actor.spatial.actionLockInTicks = remaining; else delete actor.spatial.actionLockInTicks;
    }
}
