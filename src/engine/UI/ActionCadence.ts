/** Display-only scheduling. Callbacks still own their existing command boundary. */
export const DISPLAY_FRAME_MS = 1000 / 60;
export const AUTO_ACTION_INTERVAL_MS = 5 * DISPLAY_FRAME_MS;
const MAX_STEPS_PER_FRAME = 2;
const MAX_CONTINUOUS_FRAME_MS = 250;

/** Bound catch-up; paused/blocked/background time must never become queued input. */
export function stepCadence(
    accumulatorMs: number,
    deltaMs: number,
    intervalMs: number,
    allowed: () => boolean,
    step: () => void,
): number {
    if (!allowed() || !Number.isFinite(deltaMs) || deltaMs <= 0
        || deltaMs > MAX_CONTINUOUS_FRAME_MS) return 0;
    let pending = Math.min(accumulatorMs + deltaMs, intervalMs * MAX_STEPS_PER_FRAME);
    for (let count = 0; count < MAX_STEPS_PER_FRAME && pending + 1e-7 >= intervalMs; count++) {
        if (!allowed()) return 0;
        pending = Math.max(0, pending - intervalMs);
        step();
    }
    return allowed() ? pending : 0;
}
