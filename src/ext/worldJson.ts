import { sha256 } from './fingerprint';
/** ECMAScript compact JSON, keys in code-point order, original Unicode UTF-8.
 * Does not evaluate getters; snapshots must explicitly project optional fields. */
export function c5Canonical(value: unknown, nativeNumbers = false): string {
  const seen = new Set<object>();
  const text = (v: unknown): string => {
    if (v === null || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'string') {
      for (let i = 0; i < v.length; i++) {
        const c = v.charCodeAt(i);
        if (c >= 0xd800 && c <= 0xdbff) {
          const n = v.charCodeAt(++i);
          if (!(n >= 0xdc00 && n <= 0xdfff)) throw new Error('Invalid C5 Unicode');
        } else if (c >= 0xdc00 && c <= 0xdfff) throw new Error('Invalid C5 Unicode');
      }
      return JSON.stringify(v);
    }
    if (typeof v === 'number' && (Number.isSafeInteger(v) || (nativeNumbers && Number.isFinite(v))))
      return JSON.stringify(v);
    if (
      !v ||
      typeof v !== 'object' ||
      seen.has(v) ||
      (!Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v)))
    )
      throw new Error('Invalid C5 JSON');
    seen.add(v);
    try {
      const keys = Reflect.ownKeys(v).filter((k) => k !== 'length' || !Array.isArray(v));
      for (const k of keys) {
        const d = Object.getOwnPropertyDescriptor(v, k)!;
        if (
          typeof k !== 'string' ||
          !d.enumerable ||
          !('value' in d) ||
          ['__proto__', 'constructor', 'prototype'].includes(k)
        )
          throw new Error('Invalid C5 key');
      }
      if (Array.isArray(v)) {
        if (keys.length !== v.length || keys.some((k, i) => k !== String(i)))
          throw new Error('Sparse C5 array');
        return '[' + v.map(text).join(',') + ']';
      }
      return (
        '{' +
        (keys as string[])
          .sort(compareCodePoints)
          .map((k) => text(k) + ':' + text(Object.getOwnPropertyDescriptor(v, k)!.value))
          .join(',') +
        '}'
      );
    } finally {
      seen.delete(v);
    }
  };
  return text(value);
}
export function compareCodePoints(a: string, b: string): number {
  if (a === b) return 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const x = a.charCodeAt(i),
      y = b.charCodeAt(i);
    if (x === y) continue;
    if ((x < 0xd800 || x > 0xdfff) && (y < 0xd800 || y > 0xdfff)) return x - y;
    let left = 0,
      right = 0;
    while (left < a.length && right < b.length) {
      const l = a.codePointAt(left)!,
        r = b.codePointAt(right)!;
      if (l !== r) return l - r;
      left += l > 0xffff ? 2 : 1;
      right += r > 0xffff ? 2 : 1;
    }
    return a.length - left - (b.length - right);
  }
  return a.length - b.length;
}
export const c5Hash = (v: unknown): string => sha256(c5Canonical(v));
