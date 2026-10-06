import { LootContractError } from './errors';
import type { LootRandom } from './types';

export const MAX_ITEM_DRAWS = 64;
export const MAX_EVENT_DRAWS = 512;

/** All generator draws flow through this event-local counter; constants never consume RNG. */
export class CountedLootRandom implements LootRandom {
    draws = 0;
    private itemStart: number | null = null;
    constructor(private readonly source: LootRandom) {}
    beginItem(): void { this.itemStart = this.draws; }
    endItem(): number {
        const count = this.itemStart === null ? 0 : this.draws - this.itemStart;
        this.itemStart = null;
        return count;
    }
    randomInt(lo: number, hi: number): number {
        if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hi) || lo > hi) {
            throw new LootContractError('RANDOM_OUT_OF_RANGE', 'random.range', 'Invalid closed integer interval');
        }
        if (lo === hi) return lo;
        if (this.draws >= MAX_EVENT_DRAWS || (this.itemStart !== null && this.draws - this.itemStart >= MAX_ITEM_DRAWS)) {
            throw new LootContractError('DRAW_BUDGET', 'random.draws', 'Random draw budget exceeded');
        }
        this.draws += 1;
        const result = this.source.randomInt(lo, hi);
        if (!Number.isSafeInteger(result) || result < lo || result > hi) {
            throw new LootContractError('RANDOM_OUT_OF_RANGE', 'random.result', 'Random callback returned an invalid integer');
        }
        return result;
    }
    chance(chanceBp: number): boolean {
        return chanceBp >= 10000 || (chanceBp > 0 && this.randomInt(1, 10000) <= chanceBp);
    }
}

/** Order is semantically significant. Zero weights and singleton results draw nothing. */
export function weightedPick<T>(values: readonly T[], weight: (value: T) => number, random: LootRandom): T | undefined {
    for (const value of values) if (!Number.isSafeInteger(weight(value)) || weight(value) < 0) {
        throw new LootContractError('RANDOM_OUT_OF_RANGE', 'random.weight', 'Weights must be nonnegative safe integers');
    }
    const candidates = values.filter(value => weight(value) > 0);
    if (candidates.length < 2) return candidates[0];
    const total = candidates.reduce((sum, value) => sum + weight(value), 0);
    if (!Number.isSafeInteger(total) || total < 1) {
        throw new LootContractError('RANDOM_OUT_OF_RANGE', 'random.weight', 'Invalid weighted choice total');
    }
    const draw = random.randomInt(1, total);
    if (!Number.isSafeInteger(draw) || draw < 1 || draw > total) {
        throw new LootContractError('RANDOM_OUT_OF_RANGE', 'random.result', 'Random callback returned an invalid weighted integer');
    }
    let accumulated = 0;
    for (const candidate of candidates) {
        accumulated += weight(candidate);
        if (draw <= accumulated) return candidate;
    }
    throw new LootContractError('RANDOM_OUT_OF_RANGE', 'random.result', 'Random callback exceeded weighted choice total');
}
