import type { ModuleDescriptor } from '../../descriptor';
import { createGiantsModule } from './index';
import { GIANTS_VERSION, getGiantsPackIdentity } from './definitions';
import zhCN from './locales/zh_CN.json';
export const descriptor: ModuleDescriptor = {
  id: 'giants',
  version: GIANTS_VERSION,
  foundation: 5,
  rules: getGiantsPackIdentity(),
  create: createGiantsModule,
  defaultEnabled: false,
  labelKey: 'ext.giants.module.name',
  descriptionKey: 'ext.giants.module.description',
  locales: { zh_CN: zhCN }
};
