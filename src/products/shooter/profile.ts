import type { ProductProfile } from '../../engine/Simulation/SimulationProfile';

/** S0 is a versioned clock/action laboratory, not a firearm or spatial capability. */
export const SHOOTER_PROFILE: ProductProfile = Object.freeze({
    id: 'shooter-s0', version: 1,
    simulation: Object.freeze({ id: 'shooter-realtime-30', ticksPerSecond: 30 }),
    modules: Object.freeze([]), inputModel: 'input-frame', spatialModel: 'grid',
});
