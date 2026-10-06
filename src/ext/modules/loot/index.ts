import type { ExtensionModule, Json } from '../../types';
import { LOOT_VERSION, getLootPackIdentity } from './definitions';
function isPlainEmptyObject(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    && Reflect.ownKeys(value).length === 0;
}
/** Installed for data identity only. Runtime integration belongs to the later 6B step. */
export function createLootModule(): ExtensionModule {
  return { id: 'loot', version: LOOT_VERSION, rules: getLootPackIdentity(),
    initialState: () => ({}), validateState: (v): v is Json => isPlainEmptyObject(v) };
}
