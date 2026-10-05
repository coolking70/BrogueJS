import type { ModuleDescriptor } from '../../descriptor';
import { createGrowthModule } from './index';
import { GROWTH_VERSION, getGrowthPackIdentity } from './definitions';
import zhCN from './locales/zh_CN.json';

export const descriptor: ModuleDescriptor = {
    id: 'growth', version: GROWTH_VERSION, foundation: 5, rules: getGrowthPackIdentity(),
    create: createGrowthModule, defaultEnabled: true,
    labelKey: 'ext.growth.module.name', descriptionKey: 'ext.growth.module.description',
    locales: { zh_CN: zhCN },
};
