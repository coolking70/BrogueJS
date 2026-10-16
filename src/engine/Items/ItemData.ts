import i18next from 'i18next';
import type { ItemFacts, ItemDataPhase, ItemDataValidator } from '../../ext/itemSdk';
import type { Json } from '../../ext/types';
import { validId } from '../../ext/json';
export type ItemDataCode = 'C6_DATA' | 'C6_BUDGET' | 'C6_OWNER' | 'C6_VALIDATOR' | 'C6_OWNERSHIP';
export class ItemDataError extends Error {
  constructor(readonly code: ItemDataCode) {
    super(i18next.t('ext.foundation.item.invalid', { code, defaultValue: 'Invalid item extension data ({{code}}).' }));
  }
}
export const hasItemData = (row: object): boolean => Object.prototype.hasOwnProperty.call(row, 'moduleData');
function fail(code: ItemDataCode): never { throw new ItemDataError(code); }
/** No value reads before descriptors are checked. Root map is depth 0; its
 * owner value is depth 1. Every child edge counts, including primitive leaves. */
export function assertItemJson(value: unknown, depth = 0, active = new Set<object>()): asserts value is Json {
  if (depth > 16) fail('C6_BUDGET');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || active.has(value)) fail('C6_DATA');
  const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
  if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) fail('C6_DATA');
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(value);
  const length = array ? descriptors.length?.value : 0;
  if (array && (!Number.isSafeInteger(length) || length < 0 || keys.length !== length + 1)) fail('C6_DATA');
  // A dense array has exactly length canonical index descriptors plus length.
  // Never read an element (including via Array helpers) before rejecting accessors.
  active.add(value);
  for (const key of keys) {
    if (typeof key !== 'string' || ['__proto__', 'prototype', 'constructor'].includes(key)) fail('C6_DATA');
    const d = descriptors[key]!;
    if (!('value' in d) || (!d.enumerable && !(array && key === 'length'))) fail('C6_DATA');
    if (array && key === 'length') continue;
    if (array && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= length)) fail('C6_DATA');
    assertItemJson(d.value, depth + 1, active);
  }
  active.delete(value);
}
export function copyItemValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(copyItemValue) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, copyItemValue(child)])) as T;
  return value;
}
export function freezeItemValue<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeItemValue); Object.freeze(value); }
  return value;
}
/** Called by the codecs as well as the host; absence remains absence. */
export function assertItemDataShape(row: object): void {
  if (!hasItemData(row)) return;
  const d = Object.getOwnPropertyDescriptor(row, 'moduleData')!;
  if (!('value' in d) || !d.enumerable) fail('C6_DATA');
  const data: unknown = d.value;
  assertItemJson(data);
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('C6_DATA');
  const owners = Object.keys(data);
  if (!owners.length || owners.length > 4) fail('C6_BUDGET');
  const encoder = new TextEncoder();
  if (encoder.encode(JSON.stringify(data)).byteLength > 8192) fail('C6_BUDGET');
  for (const owner of owners) {
    if (!validId(owner)) fail('C6_OWNER');
    const value = data[owner];
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('C6_DATA');
    if (encoder.encode(JSON.stringify(value)).byteLength > 4096) fail('C6_BUDGET');
  }
  if (Object.getOwnPropertyDescriptor(row, 'quantity')?.value !== 1) fail('C6_DATA');
}
export function itemFacts(row: object): ItemFacts {
  assertItemDataShape(row);
  const read = (key: string): unknown => {
    const d = Object.getOwnPropertyDescriptor(row, key);
    if (d && !('value' in d)) fail('C6_DATA');
    return d?.value;
  };
  const data = hasItemData(row) ? copyItemValue(read('moduleData')) : undefined;
  return freezeItemValue({ id: read('id') as number, category: read('category') as number,
    kindKey: (read('identityId') ?? read('consumableId') ?? read('name')) as string,
    ...(read('worldItem')?{materialDefinitionId:(read('worldItem') as {definitionId:string}).definitionId}:{}),
    quantity: read('quantity') as number, identified: read('identified') === true,
    enchantment: read('enchantment') as number,runicType:(read('runicType')??null) as string|null,vorpalEnemy:(read('vorpalEnemy')??null) as string|null, isCursed: read('isCursed') === true,
    ...(data === undefined ? {} : { moduleData: data as Record<string, Json> }) });
}
export function validateItemData(row: object, enabledModules: readonly string[], validators: ReadonlyMap<string, ItemDataValidator>, phase: ItemDataPhase): void {
  assertItemDataShape(row);
  if (!hasItemData(row)) return;
  const item = itemFacts(row);
  if (!Number.isSafeInteger(item.id) || item.id < 1 || !Number.isInteger(item.category) || typeof item.kindKey !== 'string' || !Number.isSafeInteger(item.enchantment)) fail('C6_DATA');
  for (const [owner, value] of Object.entries(item.moduleData!)) {
    const validator = validators.get(owner);
    if (!enabledModules.includes(owner) || !validator) fail('C6_OWNER');
    try {
      if (validator(value, freezeItemValue({ owner, enabledModules: [...enabledModules], item, phase })) !== true) fail('C6_VALIDATOR');
    } catch { fail('C6_VALIDATOR'); }
  }
}
