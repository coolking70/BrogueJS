/** Data-only module declaration for the trusted phased native attack executor.
 * This is a foundation protocol, not a module import or writable world API. */
import type { ActorActionSchedulerState } from '../engine/Core/ActorActionScheduler';
import type { ControlledActionRisk } from '../engine/Core/Game';
import type { AttackShapeRequest } from '../engine/Movement/AttackShape';
export type ActorAttackFacing = 'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw';
export interface ActorAttackDefinition {
    id: string; nameKey: string; cost: number; windupTicks: number; recoveryTicks: number;
    segments: { delayTicks: number; shape: {kind:'footprint-offset-union'; offsets:Record<ActorAttackFacing,{x:number;y:number}[]>; selfExclusion:'source-member'|'whole-group';occlusion:'line-of-effect'};
        locationPolicy:'locked-world';targetPolicy:'part';damageProfile:'native-melee';dodgeable:boolean;parryable:boolean }[];
}
export interface ActorAttackDefinitions {
    attacks: ActorAttackDefinition[];
    profiles: {id:string;resourcePolicyId:string;attackIds:string[]}[];
    resourcePolicies: {id:string;initialStamina:number;staminaCapacity:number}[];
    /** Explicit native species/profile binding; no optional module ID dependency. */
    nativeProfiles: {monsterId:string;profileId:string}[];
    playerProfileId:string;
    breakRecoveryTicks:number;
}
export interface ActorAttackMetadata {
    actionId:number; profileId:string; paidCost:number; suppressTerminalSweep?:true;
    subactions: {sourceSubactionId:number;attackId:string;facing:ActorAttackFacing;lockedCells:{x:number;y:number}[];
        shape:AttackShapeRequest;approvedRisks:{targetId:number;risks:ControlledActionRisk[]}[]}[];
}
export interface ProductionActorAttackState {
    schema:1;revision:number;nextActionId:number;
    scheduler:ActorActionSchedulerState;
    actions:ActorAttackMetadata[];
    actors:{actorId:number;profileId:string;stamina:number}[];
}
