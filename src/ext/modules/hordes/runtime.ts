import type { PopulationDescriptor } from '../../../engine/Simulation/PopulationRuntime';
import { HORDE_ACTORS, HORDE_RULES } from './definitions';
import { createHordes } from './module';
import zhCN from './locales/zh_CN.json';
export const runtime: PopulationDescriptor = { id: 'hordes', version: '1.0.0', rules: HORDE_RULES, foundation: 4,
    runtime: 'realtime', kind: 'population', labelKey: 'ext.hordes.module.name',
    uiKeys: ['ext.hordes.swarm', 'ext.hordes.elite', 'ext.hordes.boss'], locales: { zh_CN: zhCN },
    actors: HORDE_ACTORS, createPopulation: createHordes };
