import { MISSION_DATA } from './definitions';
import type { MissionState } from './state';
import type { MissionView } from '../../../engine/Simulation/MissionRuntime';
export function extractionView(state: MissionState, tick: number, ready: boolean): Pick<MissionView, 'extraction' | 'extractionRemaining'> {
    return state.status === 'success' ? { extraction: 'complete', extractionRemaining: 0 }
        : !state.extractionCallTick ? { extraction: ready ? 'ready' : 'locked', extractionRemaining: 0 }
        : tick < state.extractionCallTick + MISSION_DATA.extractionDelayTicks
            ? { extraction: 'inbound', extractionRemaining: state.extractionCallTick + MISSION_DATA.extractionDelayTicks - tick }
            : { extraction: 'boarding', extractionRemaining: MISSION_DATA.nodes.find(n => n.kind === 'extraction')!.ticks - state.boardingProgress };
}
