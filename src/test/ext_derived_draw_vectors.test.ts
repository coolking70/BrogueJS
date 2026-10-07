import { describe, it, expect } from 'vitest';
import { derivedSeedKey, derivedDraw, derivedRange } from '../engine/Core/DerivedDraw';
describe('5A4 c5-derive-v1 frozen vectors', () => {
  it('independent seed/draw/rejection/shuffle vectors', () => {
    const a = derivedSeedKey('51005000', 'fgfixture', '0'.repeat(64)),
      b = derivedSeedKey('1', 'foraging', 'f'.repeat(64));
    expect(a).toBe('8c10e2b890bbc28b47cff53059cea1f694cb20231560996d4393977f148eed80');
    expect(b).toBe('a004cac75de63d19bc5b26395d7f0375594be437264efc7dc4652cbabcdacb61');
    expect(derivedDraw(a, 'fgfixture.kinds.appearance', 0, 0)).toBe(1692360874);
    expect(derivedDraw(a, 'fgfixture.kinds.appearance', 1, 0)).toBe(1906428524);
    expect(derivedDraw(b, 'foraging.roast-policy', Number.MAX_SAFE_INTEGER, 0)).toBe(479313020);
    expect(derivedDraw(a, 'fgfixture.reject', 0, 0)).toBe(4090733778);
    expect(derivedDraw(a, 'fgfixture.reject', 0, 1)).toBe(1916848773);
    expect(derivedRange(a, 'fgfixture.reject', 0, 2 ** 31 + 1)).toBe(1916848773);
    const pool = Array.from({ length: 6 }, (_, i) => 'a' + i);
    for (let i = 5; i > 0; i--) {
      const j = derivedRange(a, 'fgfixture.kinds.appearance', 5 - i, i + 1);
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    expect(pool.join(',')).toBe('a0,a2,a1,a3,a5,a4');
  });
  it.each(['', 'x'.repeat(64), '0'.repeat(65)])('rejects invalid seed %s', (s) =>
    expect(() => derivedDraw(s, 'domain', 0, 0)).toThrow()
  );
  it.each([
    ['bad domain', 0, 0, 1],
    ['domain', -1, 0, 1],
    ['domain', 0.5, 0, 1],
    ['domain', 0, -1, 1],
    ['domain', 0, 0, 0],
    ['domain', 0, 0, 2 ** 32 + 1]
  ] as const)('rejects malformed domain/ordinal/attempt/range', (d, o, a, n) => {
    expect(() => {
      derivedDraw('0'.repeat(64), d, o, a);
      derivedRange('0'.repeat(64), d, o, n);
    }).toThrow();
  });
});
