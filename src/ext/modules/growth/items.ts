import type { DeepReadonly } from './definitions';
import type { GrowthDefinitionPack } from './types';

export type GrowthItemConfig = DeepReadonly<GrowthDefinitionPack['config']['itemGrowth']>;
export type GrowthItemDestination = GrowthItemConfig['rules'][number]['destination'];
export type GrowthNativeItemDestination = Extract<GrowthItemDestination, 'strengthBonus' | 'maxHpBonus' | 'enchantment'>;
/** Catalog capabilities, supplied by the native item-effect owner rather than inferred from item IDs. */
export interface GrowthItemSource {
    readonly itemId: string;
    readonly nativeDestination: GrowthNativeItemDestination;
    readonly nativeAmount: number;
}
/** Actual integer output per configured consumable kind, per actor, across the whole run. */
export interface GrowthItems { awarded: Record<string, number> }
export type GrowthItemLedger = GrowthItems;
export const initialGrowthItemLedger = (): GrowthItemLedger => ({ awarded: {} });
export interface GrowthItemGain {
    readonly destination: GrowthItemDestination;
    readonly amount: number;
    readonly nativeAmount: number;
    readonly items: GrowthItems;
}

function integer(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function record(value: unknown): value is Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return (prototype === Object.prototype || prototype === null) && Reflect.ownKeys(value).every(key => {
        if (typeof key !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(key)) return false;
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        return descriptor.enumerable && Object.prototype.hasOwnProperty.call(descriptor, 'value');
    });
}

/** A ledger never stores fractional remainders, unconfigured kinds, or zero-output receipts. */
export function isGrowthItems(value: unknown, config: GrowthItemConfig): value is GrowthItems {
    if (!record(value) || Object.keys(value).join(',') !== 'awarded' || !record(value.awarded)) return false;
    return Object.entries(value.awarded).every(([id, amount]) => {
        const rule = config.rules.find(entry => entry.itemId === id);
        return !!rule && rule.conversion > 0 && (rule.nativeEffect !== 'replace' || rule.conversion >= 1)
            && (rule.perItemCap === null || rule.perItemCap >= 1) && integer(amount) && amount > 0
            && (rule.runCap === null || amount <= Math.floor(rule.runCap));
    });
}
export const isGrowthItemLedger = isGrowthItems;

/** The persisted receipts also prove how many extra unspent points items supplied. */
export function growthItemPointGrants(config: GrowthItemConfig, ledger: Readonly<GrowthItemLedger>): { attributePoints: number; skillPoints: number } {
    if (!isGrowthItemLedger(ledger, config)) throw new RangeError('Invalid growth item ledger');
    const result = { attributePoints: 0, skillPoints: 0 };
    for (const rule of config.rules) {
        if (rule.nativeEffect !== 'replace') continue;
        const field = rule.destination === 'attribute-points' ? 'attributePoints' : rule.destination === 'skill-points' ? 'skillPoints' : null;
        if (field) {
            result[field] += ledger.awarded[rule.itemId] ?? 0;
            if (!integer(result[field])) throw new RangeError('Unsafe growth item point total');
        }
    }
    return result;
}

/** Pure one-use conversion. Caps concern permanent output only. Round down once after all
 * caps because all native owners and point pools are integral; no fractions carry to later uses. */
export function resolveGrowthItemGain(config: GrowthItemConfig, itemId: string,
    nativeDestination: GrowthNativeItemDestination, nativeAmount: number, prior: Readonly<GrowthItems>): GrowthItemGain {
    if (!integer(nativeAmount) || !isGrowthItems(prior, config)) throw new RangeError('Invalid growth item input');
    const rule = config.rules.find(entry => entry.itemId === itemId), items = { awarded: { ...prior.awarded } };
    if (!rule) return { destination: nativeDestination, amount: nativeAmount, nativeAmount, items };
    const destination = rule.nativeEffect === 'preserve' ? nativeDestination : rule.destination;
    if (destination === 'enchantment' && nativeDestination !== 'enchantment') throw new RangeError('Growth item requires an enchantment target');
    const awarded = prior.awarded[itemId] ?? 0;
    const converted = rule.nativeEffect === 'preserve' ? nativeAmount * rule.conversion : rule.conversion;
    const amount = Math.floor(Math.min(converted, rule.perItemCap ?? Infinity,
        rule.runCap === null ? Infinity : Math.max(0, rule.runCap - awarded)));
    if (!integer(amount) || !integer(awarded + amount)) throw new RangeError('Unsafe growth item output');
    if (amount) items.awarded[itemId] = awarded + amount;
    return { destination, amount, nativeAmount: destination === nativeDestination ? amount : 0, items };
}

/** Returns the first unsupported rule index, or null. No native catalog import or sample IDs. */
export function invalidGrowthItemSource(config: GrowthItemConfig, sources: readonly GrowthItemSource[]): number | null {
    for (const [index, rule] of config.rules.entries()) {
        const source = sources.find(entry => entry.itemId === rule.itemId);
        if (!source || (rule.nativeEffect === 'preserve' && rule.destination !== source.nativeDestination)
            || (rule.destination === 'enchantment' && source.nativeDestination !== 'enchantment')) return index;
        try {
            const result = resolveGrowthItemGain(config, rule.itemId, source.nativeDestination, source.nativeAmount, { awarded: {} });
            // Native maximum HP and player strength both start at at least one; this output cannot fit.
            if ((result.destination === 'maxHpBonus' || result.destination === 'strengthBonus') && !integer(result.amount + 1)) return index;
        }
        catch { return index; }
    }
    return null;
}
