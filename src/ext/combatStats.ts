/** Template adaptation reads capacities from foundation; nothing is persisted here. */
import type { ActorResourcePolicy } from './actorActions';
export interface CombatCapacities {staminaCapacity:number;poiseCapacity:number}
export function combatCapacityPolicy(base:ActorResourcePolicy,stats?:CombatCapacities):ActorResourcePolicy{
 if(!stats)return base;
 return {...base,...stats,initialStamina:Math.min(base.initialStamina,stats.staminaCapacity),poiseBreakRecoveryValue:Math.min(base.poiseBreakRecoveryValue,stats.poiseCapacity)};
}
