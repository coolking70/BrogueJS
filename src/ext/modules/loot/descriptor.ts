import type { ModuleDescriptor } from '../../descriptor';
import { LOOT_VERSION, getLootPackIdentity } from './definitions';
import { createLootModule } from './index';
import zhCN from './locales/zh_CN.json';
export const descriptor: ModuleDescriptor = {
  id: 'loot', version: LOOT_VERSION, foundation: 5,
  rules: getLootPackIdentity(), create: createLootModule, defaultEnabled: false,
  labelKey: 'ext.loot.module.name', descriptionKey: 'ext.loot.module.description',
  locales: { zh_CN: zhCN },
};
