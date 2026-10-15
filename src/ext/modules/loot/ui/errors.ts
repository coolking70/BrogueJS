export type LootUiErrorCode = 'INVALID_ITEM' | 'INVALID_INPUT' | 'INCONSISTENT_FACTS'
  | 'UNKNOWN_PRESET' | 'UNKNOWN_AFFIX' | 'UNKNOWN_BASE' | 'CLASS_MISMATCH';

export class LootUiError extends Error {
  constructor(readonly code: LootUiErrorCode, readonly path: string) {
    super(`${code}: ${path}`);
    this.name = 'LootUiError';
  }
}

/** Freeze newly constructed output, never a caller-owned object. */
export function freezeLootUi<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeLootUi(child);
    Object.freeze(value);
  }
  return value;
}

export function isPlainLootObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
    && Reflect.ownKeys(value).every(key => typeof key === 'string'
      && Object.getOwnPropertyDescriptor(value, key)?.get === undefined
      && Object.getOwnPropertyDescriptor(value, key)?.set === undefined);
}

export function exactLootKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const own = Reflect.ownKeys(value);
  return own.length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

export function isLootInteger(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
}
