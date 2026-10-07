/** Frozen pre-5A2-S numerical oracle; never imported by production. */
import type { ExtensionRuntime } from '../../ext/runtime';
import type { ExtensionRuleInput, ExtensionRuleContext } from '../../ext/types';
import { netEnchant, playerDefense, enchantedDamage, hitProbability } from '../../engine/Combat/CombatFormulas';
import { ringBonus, turnsForFullRegenInThousandths } from '../../engine/Items/RingBonuses';
import type { Player } from '../../entities/Player';
export { netEnchant, playerDefense, enchantedDamage, hitProbability };
export function legacyRegeneration(player:Player):number {
 const full=turnsForFullRegenInThousandths(ringBonus(player.rings(),'ring_of_regeneration'));let hp=player.maxHp,per=0;const whole=Math.floor(full/1000);if(whole>0)while(hp>whole){per++;hp-=whole;}const interval=Math.floor(full/hp),rate=per+(interval>0?1000/interval:0);return player.hasStatus('regenerating')?rate/0.6:rate;
}
export function appliedGrowth(runtime:ExtensionRuntime,actorId:number):{appliedStrength:number;appliedMaxHp:number}{return {appliedStrength:runtime.stats.applied(actorId,'native.strength'),appliedMaxHp:runtime.stats.applied(actorId,'native.max-hp')};}
/** Old callback vocabulary is confined to test fixtures while their mechanics
 * are installed through the new declarative source boundary. */
export interface LegacyRulePolicies {
 [key:string]:((input:Readonly<ExtensionRuleInput>,context:ExtensionRuleContext)=>number)|((id:number,context:ExtensionRuleContext)=>{maxHp:number;strength:number})|undefined;
}
export function statRule(runtime:ExtensionRuntime,port:string,input:ExtensionRuleInput):number{
 const keys:Record<string,string>={stealthRange:'native.stealth-range',searchStrength:'native.search-strength',focusCapacity:'growth.focus-capacity'};
 return runtime.stats.value(input.actorId,keys[port]!,{baseValue:input.baseValue});
}

