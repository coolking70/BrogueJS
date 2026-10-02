import type { ExtensionModule } from '../../types';
import { isJson } from '../../json';
import { getGrowthPackIdentity, GROWTH_VERSION, loadGrowthDefinitionPack } from './definitions';
import { growthDefinitionText } from './text';
import monsters from '../../../data/monsters.json';
import consumables from '../../../data/consumables.json';
import arcana from '../../../data/arcana.json';
import weapons from '../../../data/weapons.json';
import armors from '../../../data/armors.json';
/** Explicit opt-in contract module only. XP, character creation and gameplay hooks arrive in later steps. */
export function createGrowthContractModule(): ExtensionModule {
    const text = growthDefinitionText();
    const itemIds = [...weapons, ...armors, ...Object.values(consumables).flat(), ...Object.values(arcana).flat()].map(item => item.id);
    loadGrowthDefinitionPack({ hasText: key => Object.prototype.hasOwnProperty.call(text, key),
        monsterIds: monsters.map(monster => monster.id), itemIds,
        categoryIds: ['weapon', 'armor', 'potion', 'scroll', 'food', 'gold', 'wand', 'staff', 'ring', 'charm', 'key', 'amulet', 'gem'] });
    return { id: 'growth', version: GROWTH_VERSION, rules: getGrowthPackIdentity(), initialState: () => ({}),
        validateState: (value): value is Record<string, never> => isJson(value) && value !== null
            && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0 };
}
