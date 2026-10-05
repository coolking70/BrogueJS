import type { MissionReward } from '../../../engine/Simulation/MissionRuntime';
import { MISSION_DATA } from './definitions';
import type { MissionState } from './state';
export function gatheredSamples(state: MissionState): number {
    return MISSION_DATA.pois.filter(p => p.kind === 'sample' && state.collected.includes(p.id)).length * MISSION_DATA.reward.samplesPerCache
        + (MISSION_DATA.nodes.some((def, i) => def.kind === 'rescue' && state.nodes[i]!.completeTick > 0) ? MISSION_DATA.reward.rescueSamples : 0);
}
export function missionReward(state: MissionState, kills: number): MissionReward {
    const optional = MISSION_DATA.nodes.some((def, i) => def.optional && state.nodes[i]!.completeTick > 0);
    const killBonus = Math.min(MISSION_DATA.reward.maxKillBonus, Math.floor(kills / 10));
    return { credits: MISSION_DATA.reward.credits + (optional ? MISSION_DATA.reward.optionalCredits : 0) + killBonus,
        samples: gatheredSamples(state), optional, killBonus };
}
