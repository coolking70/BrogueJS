import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import type { MissionMarker, MissionScenario, PopulationLimits } from '../../../engine/Simulation/MissionRuntime';
import { extensionDataFingerprint } from '../../fingerprint';
import { canonical, validId } from '../../json';
import data from './data/definitions.json';
export interface ObjectiveDefinition {
    id: string; kind: MissionMarker['kind']; pose: { x: number; y: number }; radius: number; ticks: number;
    depends: readonly string[]; optional: boolean; labelKey: string;
}
export interface MissionDefinition {
    schema: 1; id: string; titleKey: string;
    reinforcements: { cycleTicks: number; activeTicks: number; stages: readonly { after: readonly string[]; limits: PopulationLimits; batch: number }[] }; deadlineTicks: number; deathLimit: number; extractionDelayTicks: number; boardingMode: 'continuous' | 'cumulative'; demolitionTicks: number;
    reward: { credits: number; optionalCredits: number; samplesPerCache: number; rescueSamples: number; maxKillBonus: number };
    scenario: MissionScenario; nodes: readonly ObjectiveDefinition[]; pois: readonly ObjectiveDefinition[];
}
export function loadMission(value: unknown): Readonly<MissionDefinition> {
    const bad = () => { throw new Error('Invalid mission data'); };
    if (!record(value, ['schema','id','titleKey','reinforcements','deadlineTicks','deathLimit','extractionDelayTicks','boardingMode','demolitionTicks','reward','scenario','nodes','pois'])
        || value.schema !== 1 || !validId(value.id) || value.titleKey !== 'ext.missions.title' || !integer(value.deadlineTicks, 18000, 27000) || !integer(value.deathLimit, 1, 20)
        || !integer(value.extractionDelayTicks, 30, 9000) || !['continuous', 'cumulative'].includes(value.boardingMode as string) || !integer(value.demolitionTicks, 1, 300)
        || !record(value.reward, ['credits','optionalCredits','samplesPerCache','rescueSamples','maxKillBonus'])
        || !Object.values(value.reward).every(n => integer(n, 0, 10000)) || !dataArray(value.nodes, 32) || !dataArray(value.pois, 32)) return bad();
    const s = value.scenario;
    if (!record(s, ['id','width','height','spawn','initialPopulation','walls','terrain','targets']) || !validId(s.id) || !integer(s.width, 32, 128) || !integer(s.height, 28, 128)
        || !dataArray(s.walls, 128) || !dataArray(s.terrain, 128) || !dataArray(s.targets, 16)) return bad();
    const point = (p: unknown) => record(p, ['x','y']) && integer(p.x, 1024, (s.width as number - 1) * 1024) && integer(p.y, 1024, (s.height as number - 1) * 1024);
    if (!point(s.spawn) || !record(s.initialPopulation, ['swarm','elite','boss']) || !Object.values(s.initialPopulation).every(n => integer(n, 0, 200))) return bad();
    for (const [entries, terrain] of [[s.walls, false], [s.terrain, true]] as const) for (const r of entries) {
        if (!record(r, terrain ? ['x','y','width','height','kind'] : ['x','y','width','height']) || !integer(r.x, 1, s.width - 2)
            || !integer(r.y, 1, s.height - 2) || !integer(r.width, 1, s.width - r.x - 1) || !integer(r.height, 1, s.height - r.y - 1)
            || terrain && !['water','fire','gas'].includes(r.kind as string)) return bad();
    }
    const ids: string[] = [];
    for (const [entries, poi] of [[value.nodes, false], [value.pois, true]] as const) for (const n of entries) {
        if (!record(n, ['id','kind','pose','radius','ticks','depends','optional','labelKey']) || !validId(n.id) || ids.includes(n.id)
            || !(poi ? ['supply','sample'] : ['scan','nest','uplink','extraction','rescue']).includes(n.kind as string)
            || !point(n.pose) || !integer(n.radius, 880, 8192) || !integer(n.ticks, 1, 9000) || !dataArray(n.depends, 32)
            || !n.depends.every(d => typeof d === 'string' && ids.includes(d)) || new Set(n.depends).size !== n.depends.length
            || typeof n.optional !== 'boolean' || n.labelKey !== 'ext.missions.site.' + n.id || poi && n.depends.length) return bad();
        ids.push(n.id);
    }
    const nodes = value.nodes as unknown as ObjectiveDefinition[];
    if (nodes.filter(n => n.kind === 'extraction').length !== 1 || nodes.filter(n => n.optional).length !== 1
        || nodes.some(n => n.depends.some(id => nodes.find(d => d.id === id)!.optional))) return bad();
    for (const t of s.targets) if (!record(t, ['key','pose','radius','maxHp']) || !nodes.some(n => n.id === t.key && n.kind === 'nest')
        || !point(t.pose) || canonical(t.pose) !== canonical(nodes.find(n => n.id === t.key)!.pose) || !integer(t.radius, 1, 1024) || !integer(t.maxHp, 1, 10000)) return bad();
    if (s.targets.length !== nodes.filter(n => n.kind === 'nest').length || new Set(s.targets.map(t => (t as any).key)).size !== s.targets.length) return bad();
    const r = value.reinforcements;
    if (!record(r, ['cycleTicks','activeTicks','stages']) || !integer(r.cycleTicks, 30, 9000) || !integer(r.activeTicks, 1, r.cycleTicks)
        || !dataArray(r.stages, 16) || !r.stages.length) return bad();
    for (const [i, stage] of r.stages.entries()) if (!record(stage, ['after','limits','batch']) || !dataArray(stage.after, 32)
        || !stage.after.every(id => nodes.some(n => n.id === id && !n.optional)) || i === 0 && stage.after.length !== 0
        || !record(stage.limits, ['swarm','elite','boss']) || !integer(stage.limits.swarm, 0, 200)
        || !integer(stage.limits.elite, 0, 8) || !integer(stage.limits.boss, 0, 1) || !integer(stage.batch, 1, 8)) return bad();
    const freeze = (v: any): any => { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; };
    return freeze(structuredClone(value)) as unknown as Readonly<MissionDefinition>;
}
export const MISSION_DATA = loadMission(data);
export const MISSION_RULES = Object.freeze({ schema: 1, version: '1.1.0', fingerprint: extensionDataFingerprint(data) });
