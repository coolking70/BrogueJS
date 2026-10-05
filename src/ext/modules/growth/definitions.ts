import data from './data/definitions.json';
import { extensionDataFingerprint } from '../../fingerprint';
import { GrowthValidationError, validateGrowthDefinitionPack, type GrowthValidationOptions } from './schema';
import { formatGrowthValidationError } from './text';
import type { GrowthDefinitionPack, GrowthPackIdentity } from './types';

export const GROWTH_VERSION = '1.7.0';
/** Local content identity is recorded with the manifest; same-version edits still invalidate old inputs. */
export function getGrowthPackIdentity(): GrowthPackIdentity {
    return Object.freeze({ schema: 1, version: GROWTH_VERSION, fingerprint: extensionDataFingerprint(data) });
}
export type DeepReadonly<T> = T extends readonly (infer U)[] ? readonly DeepReadonly<U>[]
    : T extends object ? { readonly [K in keyof T]: DeepReadonly<T[K]> } : T;
function freeze<T>(value: T): DeepReadonly<T> {
    if (value && typeof value === 'object') { Object.values(value).forEach(child => freeze(child)); Object.freeze(value); }
    return value as DeepReadonly<T>;
}
/** Validate before cloning; never return a mutable alias to caller-provided configuration. */
export function parseGrowthDefinitionPack(value: unknown, options: GrowthValidationOptions): DeepReadonly<GrowthDefinitionPack> {
    try {
        validateGrowthDefinitionPack(value, options);
        return freeze(structuredClone(value));
    } catch (error) {
        // Public loading reports readable text; the pure validator keeps its structured diagnostics.
        if (error instanceof GrowthValidationError) error.message = formatGrowthValidationError(error);
        throw error;
    }
}
export function loadGrowthDefinitionPack(options: Omit<GrowthValidationOptions, 'moduleVersion'>): DeepReadonly<GrowthDefinitionPack> {
    return parseGrowthDefinitionPack(data, { ...options, moduleVersion: GROWTH_VERSION });
}
