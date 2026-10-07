import type { GrowthCombatCapacityMap } from './types';
const CAPACITY_LIMIT=1_000_000;
const integer=(value:unknown,min=0,max=Number.MAX_SAFE_INTEGER):value is number=>Number.isSafeInteger(value)&&(value as number)>=min&&(value as number)<=max;
export function mapGrowthCombatCapacity(base: number, rank: number, map: Readonly<GrowthCombatCapacityMap>): number {
    if (!integer(base,1,CAPACITY_LIMIT) || !integer(rank) || !integer(map.baseline) || !integer(map.coefficient)
        || !integer(map.denominator,1) || map.rounding !== 'floor' || !integer(map.min,1,CAPACITY_LIMIT)
        || !integer(map.max,map.min,CAPACITY_LIMIT)) throw new RangeError('Invalid growth combat capacity input');
    const investment = BigInt(Math.max(0,rank - map.baseline));
    const value = BigInt(base) + investment * BigInt(map.coefficient) / BigInt(map.denominator);
    return Number(value < BigInt(map.min) ? BigInt(map.min) : value > BigInt(map.max) ? BigInt(map.max) : value);
}
