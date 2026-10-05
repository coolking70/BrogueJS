import type { MissionReward } from '../../../engine/Simulation/MissionRuntime';
import { MISSION_DATA, type MissionDefinition } from './definitions';
import type { MissionState } from './state';
export function gatheredSamples(state: MissionState, data: Readonly<MissionDefinition> = MISSION_DATA): number {
    return data.pois.filter(p => p.kind === 'sample' && state.collected.includes(p.id)).length * data.reward.samplesPerCache
        + (data.nodes.some((def, i) => def.kind === 'rescue' && state.nodes[i]!.completeTick > 0) ? data.reward.rescueSamples : 0);
}
export function missionReward(state: MissionState, kills: number, data: Readonly<MissionDefinition> = MISSION_DATA): MissionReward {
    const optional = data.nodes.some((def, i) => def.optional && state.nodes[i]!.completeTick > 0);
    const killBonus = Math.min(data.reward.maxKillBonus, Math.floor(kills / 10));
    return { credits: data.reward.credits + (optional ? data.reward.optionalCredits : 0) + killBonus,
        samples: gatheredSamples(state, data), optional, killBonus };
}
