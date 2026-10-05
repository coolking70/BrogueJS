/** Time units belong to the product. Native Brogue speed values are never milliseconds. */
export interface SimulationProfile {
    readonly id: string;
    readonly ticksPerSecond: number;
}
export interface ProductProfile {
    readonly id: string;
    readonly version: number;
    readonly simulation: SimulationProfile;
    readonly modules: readonly string[];
    readonly inputModel: 'command' | 'input-frame';
    readonly spatialModel: 'grid' | 'hybrid-kinematic';
}

export function assertTick(value: number): void {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid simulation tick');
}

export function assertSimulationProfile(profile: SimulationProfile): void {
    if (!profile.id || !Number.isSafeInteger(profile.ticksPerSecond)
        || profile.ticksPerSecond < 1 || profile.ticksPerSecond > 1000) throw new Error('Invalid simulation profile');
}
