/** Pure C5 identity/shape primitives: no runtime or engine dependency. */
import { validId } from './json';
import type { LevelRef } from './worldSdk';
export class World5Error extends Error {
  constructor(
    readonly code: import('./worldSdk').WorldErrorCode,
    readonly field: string | null = null
  ) {
    super(code + (field ? `: ${field}` : ''));
  }
}
export function uint(value: unknown, field: string, minimum = 0): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum)
    throw new World5Error('C5_BAD_PAYLOAD', field);
}
export function checkedAdd(a: number, b: number): number {
  uint(a, 'add.left');
  uint(b, 'add.right');
  if (b > Number.MAX_SAFE_INTEGER - a) throw new World5Error('C5_OVERFLOW');
  return a + b;
}
export function exact(
  value: unknown,
  keys: string,
  field: string
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).some(
      (k) =>
        typeof k !== 'string' ||
        !Object.getOwnPropertyDescriptor(value, k)?.enumerable ||
        !('value' in Object.getOwnPropertyDescriptor(value, k)!)
    ) ||
    Object.keys(value).sort().join(',') !== keys.split(',').sort().join(',')
  )
    throw new World5Error('C5_BAD_PAYLOAD', field);
}
export function validateLevelRef(value: unknown): asserts value is LevelRef {
  if (!value || typeof value !== 'object') throw new World5Error('C5_BAD_PAYLOAD', 'levelRef');
  const kind = Object.getOwnPropertyDescriptor(value, 'kind');
  if (!kind || !('value' in kind)) throw new World5Error('C5_BAD_PAYLOAD', 'levelRef.kind');
  const ref = value as Record<string, unknown>;
  if (kind.value === 'dungeon') {
    exact(ref, 'kind,depth', 'levelRef');
    uint(ref.depth, 'depth', 1);
    if (ref.depth > 40) throw new World5Error('C5_BAD_PAYLOAD', 'depth');
  } else if (kind.value === 'site') {
    exact(ref, 'kind,id', 'levelRef');
    if (!validId(ref.id) || ref.id.length > 128) throw new World5Error('C5_BAD_PAYLOAD', 'site.id');
  } else throw new World5Error('C5_BAD_PAYLOAD', 'levelRef.kind');
}
export function levelKey(ref: LevelRef): string {
  validateLevelRef(ref);
  return ref.kind === 'dungeon' ? `dungeon.${ref.depth}` : `site.${ref.id}`;
}
export function compareLevelRefs(a: LevelRef, b: LevelRef): number {
  validateLevelRef(a);
  validateLevelRef(b);
  if (a.kind !== b.kind) return a.kind === 'dungeon' ? -1 : 1;
  if (a.kind === 'dungeon' && b.kind === 'dungeon') return a.depth - b.depth;
  const x = levelKey(a),
    y = levelKey(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
export function requireDungeon(ref: LevelRef): number {
  validateLevelRef(ref);
  if (ref.kind !== 'dungeon') throw new World5Error('C5_UNSUPPORTED', 'site');
  return ref.depth;
}
