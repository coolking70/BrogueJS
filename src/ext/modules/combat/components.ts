import { assertCombatJson, assertLoadedCombatPack, cells, id, integer, record } from './schema';
import type { AttackDefinition, CombatAction, CombatPack, CombatResources, CombatSource, CombatSubaction } from './types';

export const FACINGS = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;
export const POSES = ['r0', 'r90', 'r180', 'r270'] as const;
export function attackTiming(attack: AttackDefinition): { releases: number[]; duration: number } {
    let time = attack.windupTicks;
    const releases = attack.segments.map(segment => { time += segment.delayTicks; return time; });
    return { releases, duration: time + attack.recoveryTicks };
}
export function validateCombatSource(value: unknown): CombatSource {
    assertCombatJson(value);
    const source = record(value, ['entityId', 'partId', 'generation', 'footprintId', 'pose', 'sourceFootprintVersion']);
    integer(source.entityId, 1); id(source.partId); integer(source.generation, 1); id(source.footprintId);
    if (!POSES.includes(source.pose as typeof POSES[number])
        || typeof source.sourceFootprintVersion !== 'string'
        || !/^sha256:[a-f0-9]{64}$/.test(source.sourceFootprintVersion)) throw new Error('combat: invalid source');
    return structuredClone(value) as CombatSource;
}
export function initialCombatResources(pack: CombatPack, policyId: string): CombatResources {
    assertLoadedCombatPack(pack);
    const policy = pack.resourcePolicies.find(item => item.id === policyId);
    if (!policy) throw new Error('combat: unknown resource policy');
    return { schema: 1, policyId, stamina: policy.initialStamina, regenRemainder: 0, regenDelayRemaining: 0,
        poise: policy.poiseCapacity, poiseRecoveryRemainder: 0, defenseWindowRemaining: 0 };
}
export function validateCombatResources(value: unknown, pack: CombatPack): CombatResources {
    assertLoadedCombatPack(pack); assertCombatJson(value);
    const resource = record(value, ['schema', 'policyId', 'stamina', 'regenRemainder', 'regenDelayRemaining', 'poise', 'poiseRecoveryRemainder', 'defenseWindowRemaining']);
    const policy = pack.resourcePolicies.find(item => item.id === resource.policyId);
    if (resource.schema !== 1 || !policy) throw new Error('combat: invalid resource schema/policy');
    integer(resource.stamina, 0, policy.staminaCapacity); integer(resource.regenRemainder, 0, policy.regenPerTickDenominator - 1);
    integer(resource.regenDelayRemaining, 0, policy.regenDelayTicks); integer(resource.poise, 0, policy.poiseCapacity);
    integer(resource.poiseRecoveryRemainder, 0, policy.poiseRecoveryDenominator - 1);
    // Defense actions are not defined or executable in 3a1.
    integer(resource.defenseWindowRemaining, 0, 0);
    if ((resource.stamina === policy.staminaCapacity && resource.regenRemainder !== 0)
        || (resource.poise === policy.poiseCapacity && resource.poiseRecoveryRemainder !== 0)) throw new Error('combat: full resource has remainder');
    return structuredClone(value) as CombatResources;
}
export function validateLockedCells(value: unknown): void {
    assertCombatJson(value);
    if (!Array.isArray(value)) throw new Error('combat: invalid locked cells');
    if (value.length) cells(value, 1024);
    for (let i = 1; i < value.length; i++) {
        const a = value[i - 1]!, b = value[i]!;
        if (a.y > b.y || (a.y === b.y && a.x >= b.x)) throw new Error('combat: noncanonical locked cells');
    }
}
function validateSubaction(value: unknown, pack: CombatPack): CombatSubaction {
    const sub = record(value, ['sourceSubactionId', 'source', 'attackId', 'facing', 'phase', 'phaseRemainingTicks', 'elapsedTicks', 'nextSegmentIndex', 'lockedCells']);
    integer(sub.sourceSubactionId, 1, 4); validateCombatSource(sub.source);
    const attack = pack.attacks.find(item => item.id === sub.attackId);
    if (!attack || !FACINGS.includes(sub.facing as typeof FACINGS[number])) throw new Error('combat: invalid attack/facing');
    const { releases, duration } = attackTiming(attack);
    const elapsed = integer(sub.elapsedTicks, 0, duration), index = integer(sub.nextSegmentIndex, 0, attack.segments.length);
    validateLockedCells(sub.lockedCells);
    let remaining: number;
    if (sub.phase === 'windup' && index === 0 && elapsed < releases[0]!) remaining = releases[0]! - elapsed;
    else if (sub.phase === 'inter-segment' && index > 0 && index < releases.length
        && elapsed >= releases[index - 1]! && elapsed < releases[index]!) remaining = releases[index]! - elapsed;
    else if (sub.phase === 'recovery' && index === releases.length && elapsed >= releases[releases.length - 1]! && elapsed < duration) remaining = duration - elapsed;
    else if (sub.phase === 'complete' && index === releases.length && elapsed === duration) remaining = 0;
    else throw new Error('combat: invalid phase/index/elapsed');
    if (sub.phaseRemainingTicks !== remaining || ((sub.phase === 'recovery' || sub.phase === 'complete') && (sub.lockedCells as unknown[]).length)) throw new Error('combat: invalid phase remaining/preview');
    return sub as unknown as CombatSubaction;
}
export function validateCombatAction(value: unknown, pack: CombatPack): CombatAction {
    assertLoadedCombatPack(pack); assertCombatJson(value);
    const action = record(value, ['schema', 'actionId', 'decisionOwnerId', 'timeChargeOwnerId', 'groupId', 'profileId', 'depth', 'paidCost', 'subactions']);
    if (action.schema !== 1) throw new Error('combat: invalid action schema');
    integer(action.actionId, 1); integer(action.decisionOwnerId, 1); integer(action.groupId, 1); integer(action.depth, 1, 40);
    if (action.timeChargeOwnerId !== action.decisionOwnerId) throw new Error('combat: split timing owner');
    const profile = pack.profiles.find(item => item.id === action.profileId);
    if (!profile || !Array.isArray(action.subactions) || action.subactions.length < 1 || action.subactions.length > 4) throw new Error('combat: invalid action profile/budget');
    const subs = action.subactions.map(sub => validateSubaction(sub, pack));
    const keys = subs.map(sub => sub.source.partId);
    if (keys.some((key, i) => i > 0 && key <= keys[i - 1]!)
        || subs.some((sub, i) => sub.sourceSubactionId !== i + 1 || !profile.attackIds.includes(sub.attackId))
        || new Set(subs.map(sub => sub.source.entityId)).size !== subs.length
        || subs.every(sub => sub.phase === 'complete')) throw new Error('combat: invalid bundle members/order');
    const totalCost = subs.reduce((sum, sub) => sum + pack.attacks.find(attack => attack.id === sub.attackId)!.cost, 0);
    const capacity = pack.resourcePolicies.find(policy => policy.id === profile.resourcePolicyId)!.staminaCapacity;
    if (action.paidCost !== totalCost || totalCost > capacity) throw new Error('combat: incorrect bundle cost');
    // Completed shorter subactions freeze at their duration; all ongoing members
    // share one core elapsed delta, never four independent clocks.
    const liveElapsed = subs.filter(sub => sub.phase !== 'complete').map(sub => sub.elapsedTicks);
    if (new Set(liveElapsed).size !== 1 || subs.some(sub => sub.phase === 'complete' && sub.elapsedTicks > liveElapsed[0]!)) throw new Error('combat: inconsistent bundle clock');
    return structuredClone(value) as CombatAction;
}
export function isCombatResources(value: unknown, pack: CombatPack): boolean {
    try { validateCombatResources(value, pack); return true; } catch { return false; }
}
export function isCombatAction(value: unknown, pack: CombatPack): boolean {
    try { validateCombatAction(value, pack); return true; } catch { return false; }
}
