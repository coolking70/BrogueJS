import type { ExtensionModule } from '../../types';
import { isJson } from '../../json';
import { getGrowthPackIdentity, GROWTH_VERSION, loadGrowthDefinitionPack } from './definitions';
import zhCN from './locales/zh_CN.json';
import monsters from '../../../data/monsters.json';
import consumables from '../../../data/consumables.json';
import arcana from '../../../data/arcana.json';
import weapons from '../../../data/weapons.json';
import armors from '../../../data/armors.json';
import type { GrowthItemSource } from './items';
/** Explicit opt-in contract module only. XP, character creation and gameplay hooks arrive in later steps. */
export function createGrowthContractModule(): ExtensionModule {
    // The localization resource is data, not the sample text helper's fixed vocabulary.
    // New definitions need only their JSON content and localized resource entries.
    const text: Readonly<Record<string, string>> = zhCN;
    const itemIds = [...weapons, ...armors, ...Object.values(consumables).flat(), ...Object.values(arcana).flat()].map(item => item.id);
    const itemGrowthSources = Object.values(consumables).flat().flatMap((item): GrowthItemSource[] => {
        switch (item.effect) {
            case 'gain_strength': return [{ itemId: item.id, nativeDestination: 'strengthBonus', nativeAmount: 1 }];
            case 'heal_full': return [{ itemId: item.id, nativeDestination: 'maxHpBonus', nativeAmount: 10 }];
            case 'enchant_item': return [{ itemId: item.id, nativeDestination: 'enchantment', nativeAmount: 1 }];
            default: return [];
        }
    });
    loadGrowthDefinitionPack({ hasText: key => Object.prototype.hasOwnProperty.call(text, key) && typeof text[key] === 'string' && text[key]!.trim().length > 0,
        monsterIds: monsters.map(monster => monster.id), itemIds, itemGrowthSources,
        categoryIds: ['weapon', 'armor', 'potion', 'scroll', 'food', 'gold', 'wand', 'staff', 'ring', 'charm', 'key', 'amulet', 'gem'] });
    return { id: 'growth', version: GROWTH_VERSION, rules: getGrowthPackIdentity(), initialState: () => ({}),
        validateState: (value): value is Record<string, never> => isJson(value) && value !== null
            && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0 };
}

import { createGrowthGameplay } from './module';
/** Active growth runtime; the original contract-only factory remains available to explicit probes. */
export function createGrowthModule(): ExtensionModule {
    const contract = createGrowthContractModule();
    const text: Readonly<Record<string,string>> = zhCN;
    const pack = loadGrowthDefinitionPack({hasText: key => typeof text[key] === 'string' && text[key]!.trim().length > 0});
    return createGrowthGameplay(pack,contract.rules);
}
