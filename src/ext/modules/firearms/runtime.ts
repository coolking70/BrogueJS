import type { RealtimeModuleDescriptor } from '../../../engine/Simulation/RangedRuntime';
import { FIREARMS_RULES, FIREARMS_VERSION } from './definitions';
import { createFirearms } from './module';
import zhCN from './locales/zh_CN.json';
import { WEAPON_LABEL_KEYS } from './ui/labels';
export const runtime: RealtimeModuleDescriptor = {
    id: 'firearms', version: FIREARMS_VERSION, rules: FIREARMS_RULES, foundation: 4, runtime: 'realtime', kind: 'ranged',
    labelKey: 'ext.firearms.module.name', uiKeys: WEAPON_LABEL_KEYS,
    locales: { zh_CN: zhCN }, create: createFirearms,
};
