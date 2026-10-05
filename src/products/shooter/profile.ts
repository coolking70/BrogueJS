import type { ProductProfile } from '../../engine/Simulation/SimulationProfile';
import { getRealtimeModules } from '../../ext/realtimeCatalog';

/** Installed realtime modules are optional. Exact selected rules enter saves. */
export const SHOOTER_PROFILE: ProductProfile = Object.freeze({
    id: 'shooter-s6', version: 6,
    simulation: Object.freeze({ id: 'shooter-realtime-30', ticksPerSecond: 30 }),
    modules: Object.freeze(getRealtimeModules().map(d => d.id)), inputModel: 'input-frame', spatialModel: 'hybrid-kinematic',
});
