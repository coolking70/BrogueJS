import { MISSION_DATA } from './definitions';
import type { MissionState } from './state';
export function objectiveReady(state: MissionState, id: string): boolean {
    const def = MISSION_DATA.nodes.find(n => n.id === id);
    return !!def && def.depends.every(key => state.nodes.find(n => n.id === key)!.completeTick > 0);
}
export function completeObjective(state: MissionState, id: string, tick: number): void {
    const index = MISSION_DATA.nodes.findIndex(n => n.id === id), n = state.nodes[index]!;
    n.started = true; n.progress = MISSION_DATA.nodes[index]!.ticks; n.completeTick = tick;
}
