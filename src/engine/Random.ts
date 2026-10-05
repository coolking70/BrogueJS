/** Native Brogue singleton. Realtime sessions import RandomSource directly. */
import { Random } from './RandomSource';
export { Random, RNGType } from './RandomSource';
export type { RandomState } from './RandomSource';

// Export a robust singleton RNG that replicates Math.c's global RNG state
export const rng = new Random();
