import { MISSION_DATA, type MissionDefinition } from './definitions';
import type { MissionState } from './state';
export function objectiveReady(state: MissionState, id: string, data: Readonly<MissionDefinition> = MISSION_DATA): boolean {
    const def = data.nodes.find(n => n.id === id);
    return !!def && def.depends.every(key => state.nodes.find(n => n.id === key)!.completeTick > 0);
}
export function completeObjective(state: MissionState, id: string, tick: number, data: Readonly<MissionDefinition> = MISSION_DATA): void {
    const index = data.nodes.findIndex(n => n.id === id), n = state.nodes[index]!;
    n.started = true; n.progress = data.nodes[index]!.ticks; n.completeTick = tick;
}
