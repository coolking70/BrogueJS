import type { MissionDescriptor } from '../../../engine/Simulation/MissionRuntime';
import { MISSION_DATA, MISSION_RULES } from './definitions';
import { createMission } from './missionRuntime';
import zhCN from './locales/zh_CN.json';
export const runtime: MissionDescriptor = { id: 'missions', version: '1.1.0', rules: MISSION_RULES, foundation: 4,
    runtime: 'realtime', kind: 'mission', labelKey: 'ext.missions.module.name', locales: { zh_CN: zhCN },
    uiKeys: Object.keys(zhCN), scenario: MISSION_DATA.scenario, createMission };
