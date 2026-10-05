import { MISSION_DATA, type MissionDefinition } from './definitions';
import type { MissionState } from './state';
import type { MissionView } from '../../../engine/Simulation/MissionRuntime';
export function extractionView(state: MissionState, tick: number, ready: boolean, data: Readonly<MissionDefinition> = MISSION_DATA): Pick<MissionView, 'extraction' | 'extractionRemaining'> {
    return state.status === 'success' ? { extraction: 'complete', extractionRemaining: 0 }
        : !state.extractionCallTick ? { extraction: ready ? 'ready' : 'locked', extractionRemaining: 0 }
        : tick < state.extractionCallTick + data.extractionDelayTicks
            ? { extraction: 'inbound', extractionRemaining: state.extractionCallTick + data.extractionDelayTicks - tick }
            : { extraction: 'boarding', extractionRemaining: data.nodes.find(n => n.kind === 'extraction')!.ticks - state.boardingProgress };
}
