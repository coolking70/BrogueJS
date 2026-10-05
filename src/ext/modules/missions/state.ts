import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import type { MissionReward, MissionView } from '../../../engine/Simulation/MissionRuntime';
import { MISSION_DATA } from './definitions';
export interface MissionState {
    schema: 1; status: MissionView['status']; reason: MissionView['reason']; terminalTick: number;
    nodes: { id: string; started: boolean; progress: number; completeTick: number }[];
    collected: string[]; extractionCallTick: number; boardingProgress: number;
    demolition: { id: string; remaining: number } | null; reward: MissionReward | null;
}
export function validateMissionState(v: unknown, tick: number): asserts v is MissionState {
    const d = MISSION_DATA, bad = () => { throw new Error('Invalid mission state'); };
    if (!record(v, ['schema','status','reason','terminalTick','nodes','collected','extractionCallTick','boardingProgress','demolition','reward']) || v.schema !== 1
        || !['active','success','failed'].includes(v.status as string) || !integer(v.terminalTick, 0, tick)
        || !dataArray(v.nodes, d.nodes.length) || v.nodes.length !== d.nodes.length || !dataArray(v.collected, d.pois.length)
        || !v.collected.every(id => d.pois.some(p => p.id === id)) || new Set(v.collected).size !== v.collected.length
        || !integer(v.extractionCallTick, 0, tick) || !integer(v.boardingProgress, 0, d.nodes.find(n => n.kind === 'extraction')!.ticks)) return bad();
    const done = new Set<string>();
    for (const [i, n] of v.nodes.entries()) {
        const def = d.nodes[i]!;
        if (!record(n, ['id','started','progress','completeTick']) || n.id !== def.id || typeof n.started !== 'boolean'
            || !integer(n.progress, 0, Math.min(def.ticks, tick)) || !integer(n.completeTick, 0, tick)
            || (n.completeTick > 0) !== (n.progress === def.ticks) || n.completeTick > 0 && n.completeTick < n.progress
            || (n.started || n.progress > 0) && !def.depends.every(id => done.has(id))
            || !n.started && n.progress > 0 || def.kind === 'extraction' && n.progress !== v.boardingProgress) return bad();
        if (n.completeTick) done.add(def.id);
    }
    const extraction = d.nodes.find(n => n.kind === 'extraction')!, e = v.nodes[d.nodes.indexOf(extraction)] as any;
    if (!!v.extractionCallTick !== !!e.started || v.boardingProgress > 0 && tick < v.extractionCallTick + d.extractionDelayTicks) return bad();
    if (v.demolition !== null && (!record(v.demolition, ['id','remaining']) || !d.nodes.some(n => n.id === (v.demolition as {id: string}).id && n.kind === 'nest'
        && n.depends.every(id => done.has(id)) && !done.has(n.id)) || !integer(v.demolition.remaining, 1, d.demolitionTicks))) return bad();
    if (v.status === 'active') {
        if (v.reason !== null || v.terminalTick !== 0 || v.reward !== null || done.has(extraction.id)) return bad();
    } else {
        if (v.terminalTick !== tick || (v.status === 'success' ? v.reason !== 'extracted' || !done.has(extraction.id)
            : !['timeout','lives','aborted'].includes(v.reason as string) || done.has(extraction.id))) return bad();
    }
    if (v.status === 'success') {
        if (!record(v.reward, ['credits','samples','optional','killBonus']) || !integer(v.reward.credits, 0, 10000)
            || !integer(v.reward.samples, 0, 1000) || typeof v.reward.optional !== 'boolean' || !integer(v.reward.killBonus, 0, d.reward.maxKillBonus)) return bad();
    } else if (v.reward !== null) return bad();
}
