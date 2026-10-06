/** Data-only module declaration for the trusted phased native attack executor.
 * This is a foundation protocol, not a module import or writable world API. */
import type { ControlledActionRisk } from '../engine/Core/Game';
import type { AttackShapeRequest } from '../engine/Movement/AttackShape';
export type ActorAttackFacing = 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw';
export type ActorResourcePhase = 'idle' | 'windup' | 'inter-segment' | 'recovery' | 'break-recovery';
export interface ActorResourcePolicy {
    id: string; initialStamina: number; staminaCapacity: number;
    regenPerTickNumerator: number; regenPerTickDenominator: number; regenDelayTicks: number;
    nativeAttackCost: number; regenPhases: ActorResourcePhase[];
    poiseCapacity: number; poiseRecoveryNumerator: number; poiseRecoveryDenominator: number;
    poiseRecoveryDelayTicks: number; poiseBreakRecoveryValue: number; nativePoiseDamage: number; poiseImmune: boolean;
}
/** Remaining values advance only through the foreground foundation elapsed delta.
 * Native defense/stagger recovery mirrors the native action timer, never an
 * attack bundle. Scheduler-owned break recovery keeps staggerRemainingTicks=0. */
export interface ActorCombatStats { staminaCapacity: number; poiseCapacity: number; revision: string }
export interface ActorResourceState {
    stamina: number; regenRemainder: number; regenDelayRemaining: number;
    dodgeRemainingTicks: number; dodgeRecoveryRemainingTicks: number;
    poise: number; poiseRecoveryRemainder: number; poiseRecoveryDelayRemaining: number;
    parryRemainingTicks: number; parryRecoveryRemainingTicks: number; parryFacing: ActorAttackFacing | null;
    staggerRemainingTicks: number;
}
export interface ActorDodgeDefinition { cost: number; windowTicks: number; recoveryTicks: number }
export interface ActorParryDefinition {
    cost: number; windowTicks: number; recoveryTicks: number; poiseDamage: number; contactRange: number;
}
export interface ActorAttackDefinition {
    id: string; nameKey: string; cost: number; windupTicks: number; recoveryTicks: number;
    segments: { delayTicks: number; shape: {kind:'footprint-offset-union'; offsets:Record<ActorAttackFacing,{x:number;y:number}[]>; selfExclusion:'source-member'|'whole-group';occlusion:'line-of-effect'};
        locationPolicy:'locked-world';targetPolicy:'part';damageProfile:'native-melee';poiseDamage:number;dodgeable:boolean;parryable:boolean }[];
}
export interface ActorAttackDefinitions {
    bonfires?: import('./worldRest').BonfireConfig;
    attacks: ActorAttackDefinition[];
    profiles: {id:string;resourcePolicyId:string;attackIds:string[]}[];
    resourcePolicies: ActorResourcePolicy[];
    /** Explicit native species/profile binding; other native attacks use the player default resource profile. */
    nativeProfiles: {monsterId:string;profileId:string}[];
    playerProfileId:string;
    breakRecoveryTicks:number;
    dodge: ActorDodgeDefinition;
    parry: ActorParryDefinition;
}
export interface ActorAttackMetadata {
    actionId:number; profileId:string; paidCost:number; suppressTerminalSweep?:true;
    subactions: {sourceSubactionId:number;profileId?:string;attackId:string;facing:ActorAttackFacing;lockedCells:{x:number;y:number}[];
        shape:AttackShapeRequest;approvedRisks:{targetId:number;risks:ControlledActionRisk[]}[]}[];
}
export interface ProductionActorAttackState {
    schema:4;revision:number;
    bonfires?: import('./worldRest').BonfireState;
    actions:ActorAttackMetadata[];
    actors:(ActorResourceState & {actorId:number;profileId:string;combatStats?:ActorCombatStats})[];
}
