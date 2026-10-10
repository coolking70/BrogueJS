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
// Schema spellings are immutable call-site data, not world state. Bound the
// cache for arbitrary SDK callers; every actual value still gets all guards.
const exactKeys = new Map<string, { sorted: string; names: Set<string>; count: number }>();
function exactKeyShape(keys: string) {
  let shape = exactKeys.get(keys);
  if (shape === undefined) {
    const names = keys.split(',');
    shape = { sorted: names.sort().join(','), names: new Set(names), count: names.length };
    if (exactKeys.size >= 64) exactKeys.clear();
    exactKeys.set(keys, shape);
  }
  return shape;
}
export function exact(
  value: unknown,
  keys: string,
  field: string
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    throw new World5Error('C5_BAD_PAYLOAD', field);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null)
    throw new World5Error('C5_BAD_PAYLOAD', field);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== 'string') throw new World5Error('C5_BAD_PAYLOAD', field);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !('value' in descriptor))
      throw new World5Error('C5_BAD_PAYLOAD', field);
  }
  // Keep the second enumerable-key read, including its descriptor checks on
  // proxies. A valid schema permutation needs no per-object sort or join.
  const actual = Object.keys(value), shape = exactKeyShape(keys);
  if (actual.length === shape.count && actual.every(key => shape.names.has(key))) return;
  // Preserve the original joined-key contract even for unusual comma keys or
  // duplicate/empty schema spellings supplied by generic SDK callers.
  if (actual.sort().join(',') !== shape.sorted)
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
