import type { Creature } from '../../entities/Creature';
import type { BodyGroupState, SpatialCatalog } from '../Movement/SpatialSchema';
import { deepFreeze, integer, SpatialValidationError } from '../Movement/SpatialSchema';
import type { PartBreakCommitter, PartBreakNativeCommit, PartBreakReceipt, PartBreakRequest } from '../../ext/partBreak';

export interface BodyMemberHitResult {
    readonly memberHpLost: number;
    readonly coreHpLost: number;
    readonly breakReceipt: PartBreakReceipt | null;
    readonly breakHandling: 'handled' | 'fallback' | null;
}
/** One post-shield/protection hit. Transfer uses only this member's positive
 * pre-hit HP, never a second attack/takeDamage/hook, armor roll or RNG stream.
 * Retirement and source cancellation run only after the provider commits. */
export function resolveBodyMemberHit(catalog: SpatialCatalog, group: BodyGroupState, member: Creature, core: Creature,
    damage: number, resolutionId: number, sourceId: number | null, commitBreak: PartBreakCommitter): Readonly<BodyMemberHitResult> {
    const identity = member.spatial?.bodyMember, slot = group.members.find(s => s.entityId === member.id), definition = catalog.body(group.bodyDefinitionId);
    const part = definition.parts.find(p => p.partId === identity?.partId);
    if (!integer(damage, 0, 1000000) || !integer(resolutionId, 1) || !part || part.role === 'core'
        || identity?.groupId !== group.groupId || !slot || slot.life !== 'active' || slot.generation !== 0
        || core.id !== group.coreId || member.hp <= 0 || core.hp <= 0) throw new SpatialValidationError('Invalid body member hit');
    const memberHpLost = Math.min(damage, member.hp);
    const coreHpLost = Math.min(core.hp, Math.floor(memberHpLost * part.coreTransfer.numerator / part.coreTransfer.denominator));
    const breaking = memberHpLost > 0 && memberHpLost === member.hp;
    const receipt: PartBreakReceipt | null = breaking ? { groupId: group.groupId, partId: part.partId, zoneId: 'body', generation: slot.generation } : null;
    const result = (handling: BodyMemberHitResult['breakHandling']) => deepFreeze({ memberHpLost, coreHpLost, breakReceipt: receipt, breakHandling: handling });
    if (!breaking) { member.hp -= memberHpLost; core.hp -= coreHpLost; return result(null); }
    if (group.appliedBreaks.some(b => b.partId === part.partId && b.generation === slot.generation)) throw new SpatialValidationError('Duplicate member break');
    const balance = catalog.breakRule(part.breakRuleId).modifiers.find(m => m.kind === 'balance-loss');
    const request: PartBreakRequest = deepFreeze({ ...receipt!, schema: 1, resolutionId, actorId: core.id, sourceId,
        balanceLoss: balance?.amount ?? 0, fallbackStunTicks: balance?.fallbackStunTicks ?? 0 });
    const hp = member.hp, coreHp = core.hp, receipts = group.appliedBreaks.slice(), spatial = core.spatial!;
    const hadLock = Object.prototype.hasOwnProperty.call(spatial, 'actionLockInTicks'), lock = spatial.actionLockInTicks;
    let applied = false;
    const native: PartBreakNativeCommit<Readonly<BodyMemberHitResult>> = {
        apply(choice) {
            if (applied || member.hp !== hp || core.hp !== coreHp || !group.members.includes(slot)
                || slot.life !== 'active' || group.appliedBreaks.length !== receipts.length || core.spatial !== spatial)
                throw new SpatialValidationError('Stale member break');
            applied = true;
            member.hp -= memberHpLost; core.hp -= coreHpLost;
            group.appliedBreaks.push({ partId: part.partId, zoneId: 'body', generation: slot.generation });
            if (choice.status === 'fallback' && request.fallbackStunTicks > 0)
                spatial.actionLockInTicks = Math.max(spatial.actionLockInTicks ?? 0, request.fallbackStunTicks);
            return result(choice.status);
        },
        rollback() {
            if (!applied) return;
            member.hp = hp; core.hp = coreHp;
            group.appliedBreaks.splice(0, group.appliedBreaks.length, ...receipts);
            if (hadLock) spatial.actionLockInTicks = lock!; else delete spatial.actionLockInTicks;
            applied = false;
        },
    };
    try { return commitBreak(request, native); } catch (error) { native.rollback(); throw error; }
}
