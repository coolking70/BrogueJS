import type { ProductProfile } from '../../engine/Simulation/SimulationProfile';

/** S1 adds hybrid kinematics. S0 snapshots intentionally do not migrate. */
export const SHOOTER_PROFILE: ProductProfile = Object.freeze({
    id: 'shooter-s1', version: 2,
    simulation: Object.freeze({ id: 'shooter-realtime-30', ticksPerSecond: 30 }),
    modules: Object.freeze([]), inputModel: 'input-frame', spatialModel: 'hybrid-kinematic',
});
