import type { SupportDescriptor } from '../../../engine/Simulation/SupportRuntime';
import { SUPPORT_RULES } from './definitions';
import { createSupport } from './module';
import zhCN from './locales/zh_CN.json';
export const runtime: SupportDescriptor = { id: 'support', version: '1.1.0', rules: SUPPORT_RULES, foundation: 4,
    runtime: 'realtime', kind: 'support', labelKey: 'ext.support.module.name', locales: { zh_CN: zhCN },
    uiKeys: Object.keys(zhCN), createSupport };
