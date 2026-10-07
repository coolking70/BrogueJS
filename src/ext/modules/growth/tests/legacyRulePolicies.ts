/** Retired callback adapter: test oracle only. */
import type { GrowthRulePolicies } from '../types';
import { evaluateGrowthPort, evaluateGrowthPhysicalDamage, type GrowthEvaluationPack } from '../evaluator';
export function createGrowthRulePolicies(pack: GrowthEvaluationPack): GrowthRulePolicies {
    return Object.freeze({
        hitChance: input => evaluateGrowthPort(pack, 'hitChance', input),
        physicalDamage: input => evaluateGrowthPhysicalDamage(pack, input),
        receivedPhysicalDamage: input => evaluateGrowthPort(pack, 'receivedPhysicalDamage', input),
        stealthRange: input => evaluateGrowthPort(pack, 'stealthRange', input),
        searchStrength: input => evaluateGrowthPort(pack, 'searchStrength', input),
        strengthBonus: input => evaluateGrowthPort(pack, 'strengthBonus', input),
        maxHpBonus: input => evaluateGrowthPort(pack, 'maxHpBonus', input),
        focusCapacity: input => evaluateGrowthPort(pack, 'focusCapacity', input),
        focusRecoveryInterval: input => evaluateGrowthPort(pack, 'focusRecoveryInterval', input),
        cooldownDuration: input => evaluateGrowthPort(pack, 'cooldownDuration', input),
        staminaCapacity: input => evaluateGrowthPort(pack, 'staminaCapacity', input),
        poiseCapacity: input => evaluateGrowthPort(pack, 'poiseCapacity', input),
    } satisfies GrowthRulePolicies);
}
