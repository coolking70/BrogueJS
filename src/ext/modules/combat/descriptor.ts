import { FOUNDATION_PROTOCOL } from '../../descriptor';
import type { ModuleDescriptor } from '../../descriptor';
import { createCombatModule } from './index';
import { COMBAT_VERSION, getCombatPackIdentity } from './definitions';
import zhCN from './locales/zh_CN.json';
export const descriptor: ModuleDescriptor = {
    id: 'combat', version: COMBAT_VERSION, foundation: FOUNDATION_PROTOCOL,
    rules: getCombatPackIdentity(), create: createCombatModule, defaultEnabled: false,
    labelKey: 'ext.combat.module.name', descriptionKey: 'ext.combat.module.description',
    locales: { zh_CN: zhCN },
};
