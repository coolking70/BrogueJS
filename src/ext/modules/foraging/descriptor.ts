import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../descriptor';
import { FORAGING_VERSION, getForagingPackIdentity } from './definitions';
import { createForagingModule } from './index';
import zhCN from './locales/zh_CN.json';
export const descriptor: ModuleDescriptor = {
  id: 'foraging', version: FORAGING_VERSION, foundation: FOUNDATION_PROTOCOL,
  worldSdk: 1, rules: getForagingPackIdentity(), create: createForagingModule, defaultEnabled: false,
  labelKey: 'ext.foraging.module.name', descriptionKey: 'ext.foraging.module.description', locales: { zh_CN: zhCN }
};
