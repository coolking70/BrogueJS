import sineQuarter from './sineQuarter.json';
import type { WorldPoint } from './WorldUnits';
/** A checked-in Q16 quarter-wave table fixes mechanics across JS engines.
 * Browser atan2/trigonometry may quantize input or draw; simulation uses this. */
function sine(angle: number): number {
    const a = ((angle % 4096) + 4096) % 4096, quadrant = Math.floor(a / 1024), step = a % 1024;
    return (quadrant >= 2 ? -1 : 1) * sineQuarter[quadrant % 2 ? 1024 - step : step]!;
}
export function angleVector(angle: number, distance: number): WorldPoint {
    if (!Number.isInteger(angle) || !Number.isSafeInteger(distance) || distance < 0 || distance > 65536) throw new Error('Invalid angle vector');
    return { x: (Math.trunc(sine(angle + 1024) * distance / 65536) || 0), y: (Math.trunc(sine(angle) * distance / 65536) || 0) };
}
