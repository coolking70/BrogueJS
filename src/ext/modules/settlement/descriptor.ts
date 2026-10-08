import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '../../descriptor';
import { createSettlementModule } from './module';
import { getSettlementIdentity } from './definitions';
import zhCN from './locales/zh_CN.json';
export const descriptor: ModuleDescriptor = {
  id: 'settlement',
  version: '1.2.0',
  foundation: FOUNDATION_PROTOCOL,
  worldSdk: 1,
  rules: getSettlementIdentity(),
  create: createSettlementModule,
  defaultEnabled: false,
  labelKey: 'ext.settlement.module.name',
  descriptionKey: 'ext.settlement.module.description',
  locales: { zh_CN: zhCN }
};
