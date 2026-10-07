import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../descriptor';
import { CRAFTING_VERSION, getCraftingPackIdentity } from './definitions';
import { createCraftingModule } from './index';
import zhCN from './locales/zh_CN.json';

export const descriptor: ModuleDescriptor = {
  id: 'crafting',
  version: CRAFTING_VERSION,
  foundation: FOUNDATION_PROTOCOL,
  worldSdk: 1,
  rules: getCraftingPackIdentity(),
  create: createCraftingModule,
  defaultEnabled: false,
  labelKey: 'ext.crafting.module.name',
  descriptionKey: 'ext.crafting.module.description',
  locales: { zh_CN: zhCN }
};
