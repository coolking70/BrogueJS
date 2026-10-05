import type { MissionDescriptor } from '../../../engine/Simulation/MissionRuntime';
import { MISSION_DATA, MISSION_RULES, loadMission } from './definitions';
import { createMission } from './missionRuntime';
import zhCN from './locales/zh_CN.json';
export const runtime: MissionDescriptor = { id: 'missions', version: '1.2.0', rules: MISSION_RULES, foundation: 4,
    runtime: 'realtime', kind: 'mission', labelKey: 'ext.missions.module.name', locales: { zh_CN: zhCN },
    uiKeys: Object.keys(zhCN), scenario: MISSION_DATA.scenario, createMission,
    configure(setup) {
        const d=structuredClone(MISSION_DATA) as any, sx=d.scenario.width*1024, sy=d.scenario.height*1024;
        const point=(p: {x:number;y:number})=>{if(setup.variant===1)p.x=sx-p.x;if(setup.variant===2)p.y=sy-p.y;};
        point(d.scenario.spawn);d.scenario.targets.forEach((v:any)=>point(v.pose));[...d.nodes,...d.pois].forEach((v:any)=>point(v.pose));
        for(const r of [...d.scenario.walls,...d.scenario.terrain]){if(setup.variant===1)r.x=d.scenario.width-r.x-r.width;if(setup.variant===2)r.y=d.scenario.height-r.y-r.height;}
        d.scenario.id+='-v'+setup.variant+'-d'+setup.difficulty;
        // Easy preserves S5; higher difficulties increase spawn pressure and reduce lives, never shorten objectives.
        const scale=100+setup.difficulty*25;
        for(const limits of [d.scenario.initialPopulation,...d.reinforcements.stages.map((s:any)=>s.limits)]) {
            limits.swarm=Math.min(200,Math.floor(limits.swarm*scale/100));limits.elite=Math.min(8,limits.elite+setup.difficulty);
        }
        d.deathLimit-=setup.difficulty;d.reward.credits=Math.floor(d.reward.credits*scale/100);
        const definition=loadMission(d);
        return {...runtime,scenario:definition.scenario,createMission:(host,restored)=>createMission(host,restored,definition)};
    } };
