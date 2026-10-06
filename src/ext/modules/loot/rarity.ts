import type { LootPreset, RarityId } from './types';

export const ROLLED_RARITIES = Object.freeze(['normal', 'magic', 'rare', 'unique', 'set'] as const);
export type LootRarityWeights = Record<(typeof ROLLED_RARITIES)[number], number>;

/** Package §7.4: floor after every multiplication; truncation happens last. */
export function computeRarityWeights(preset: LootPreset, ilvl: number, rarityBonusBp: number,
    uniqueWeightBp: number, rarityFindBp: number, minRarity: RarityId | null): LootRarityWeights {
    const R = Math.min(Math.max(rarityFindBp, 0), preset.rarityFind.cap);
    const eff = R === 0 ? 0 : Math.floor(R * preset.rarityFind.k / (R + preset.rarityFind.k));
    const minimum = minRarity === null ? 0 : ROLLED_RARITIES.indexOf(minRarity as (typeof ROLLED_RARITIES)[number]);
    const result = {} as LootRarityWeights;
    for (const [index, rarity] of ROLLED_RARITIES.entries()) {
        let weight = Math.floor(preset.rarityWeights[rarity] * (10000 + preset.rarityIlvlScalingBp[rarity] * ilvl) / 10000);
        if (index > 0) weight = Math.floor(weight * (10000 + rarityBonusBp) / 10000);
        if (rarity === 'unique') weight = Math.floor(weight * uniqueWeightBp / 10000);
        if (index > 0) weight = Math.floor(weight * (10000 + eff) / 10000);
        result[rarity] = index < minimum ? 0 : weight;
    }
    return result;
}
