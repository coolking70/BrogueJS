/** Module-owned data only. Spatial identities/geometry are supplied by the future
 * foundation adapter; these DTOs do not grant world or scheduling authority. */
export type Facing = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export interface Cell { x: number; y: number }
export interface AttackShape {
    kind: 'footprint-offset-union';
    offsets: Record<Facing, Cell[]>;
    selfExclusion: 'source-member' | 'whole-group';
    occlusion: 'line-of-effect';
}
export interface AttackSegment {
    delayTicks: number;
    shape: AttackShape;
    locationPolicy: 'locked-world';
    targetPolicy: 'part';
    damageProfile: 'native-melee';
    poiseDamage: number;
    parryable: boolean;
    dodgeable: boolean;
    friendlyFire: false;
}
export interface AttackDefinition {
    id: string; nameKey: string; cost: number; windupTicks: number; recoveryTicks: number;
    interruptPolicy: 'cancel-pending'; segments: AttackSegment[];
}
export interface ResourcePolicy {
    id: string; staminaCapacity: number; initialStamina: number;
    regenPerTickNumerator: number; regenPerTickDenominator: number; regenDelayTicks: number;
    poiseCapacity: number; poiseRecoveryNumerator: number; poiseRecoveryDenominator: number;
}
export interface CombatProfile { id: string; resourcePolicyId: string; attackIds: string[] }
export interface CombatPack {
    schema: 1; moduleId: 'combat'; moduleVersion: '1.0.0'; rulesVersion: '1.0.0';
    resourcePolicies: ResourcePolicy[]; attacks: AttackDefinition[]; profiles: CombatProfile[];
}
export interface CombatState { schema: 1; revision: number; nextActionId: number }
export interface CombatResources {
    schema: 1; policyId: string; stamina: number; regenRemainder: number;
    regenDelayRemaining: number; poise: number; poiseRecoveryRemainder: number;
    defenseWindowRemaining: number;
}
/** All source version fields are mechanical and persisted. sessionRevision is
 * deliberately absent; it belongs only to the transient preparation envelope. */
export interface CombatSource {
    entityId: number; partId: string; generation: number; footprintId: string; pose: 'r0' | 'r90' | 'r180' | 'r270';
    sourceFootprintVersion: string;
}
export interface CombatSubaction {
    sourceSubactionId: number; source: CombatSource; attackId: string; facing: Facing;
    phase: 'windup' | 'inter-segment' | 'recovery' | 'complete'; phaseRemainingTicks: number;
    elapsedTicks: number; nextSegmentIndex: number; lockedCells: Cell[];
}
export interface CombatAction {
    schema: 1; actionId: number; decisionOwnerId: number; timeChargeOwnerId: number;
    groupId: number; profileId: string; depth: number; paidCost: number;
    subactions: CombatSubaction[];
}
