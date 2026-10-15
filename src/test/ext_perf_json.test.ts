import { describe, expect, it } from 'vitest';
import { canonical, cloneJson, checkpointJson, immutableJson, isJson, readonlyJson } from '../ext/json';

describe('immutable extension JSON certificates', () => {
  it('reuses an owned read-only graph but keeps mutable readers detached', () => {
    const child = { value: -0 };
    const input = { z: child, a: child, rows: [1, 2] };
    const stored = immutableJson(input);
    expect(stored).not.toBe(input);
    expect(stored.z).toBe(stored.a);
    expect(Object.isFrozen(stored.z)).toBe(true);
    expect(readonlyJson(stored)).toBe(stored);
    expect(canonical(stored)).toBe(canonical(input));
    const copy = cloneJson(stored);
    copy.z.value = 4;
    copy.rows.push(3);
    expect(copy.z).toBe(copy.a);
    expect(Object.is(stored.z.value, -0)).toBe(true);
    expect(stored.rows).toEqual([1, 2]);
    expect(canonical(stored)).toBe(canonical(input));
  });
  it('does not treat a foreign shallow freeze or revision as a certificate', () => {
    const foreign = Object.freeze({ revision: 4, child: { value: 1 } });
    expect(isJson(foreign)).toBe(true);
    const stored = readonlyJson(foreign);
    foreign.child.value = Infinity;
    expect(isJson(foreign)).toBe(false);
    expect(() => readonlyJson(foreign)).toThrow();
    expect(stored.child.value).toBe(1);
    const cycle: any = {}; cycle.self = cycle; Object.freeze(cycle);
    expect(() => immutableJson(cycle)).toThrow();
  });
  it('checks the detached result before certification when foreign accessors change', () => {
    let reads = 0;
    const foreign = { get value() { return ++reads === 1 ? 1 : Infinity; } };
    expect(() => immutableJson(foreign)).toThrow();
    expect(reads).toBe(2);
  });
  it('retains validation for banned keys and nonfinite external input', () => {
    for (const value of [JSON.parse('{"__proto__":1}'), { x: NaN }, new Date(), [undefined]]) {
      expect(() => immutableJson(value as any)).toThrow();
    }
  });
});

describe('nested JSON write-domain savepoints', () => {
  it('shares only certified immutable branches and keeps every mutable savepoint independent', () => {
    const fixed = immutableJson({ rows: [{ value: 2 }] });
    const mutable = { focus: 4 };
    let live = { fixed, mutable, alias: mutable, order: ['b', 'a'] };
    const outer = checkpointJson(live);
    expect(outer.fixed).toBe(fixed);
    expect(outer.mutable).not.toBe(mutable);
    expect(outer.mutable).toBe(outer.alias);
    live.mutable.focus = 7;
    live.fixed = immutableJson({ rows: [{ value: 9 }] });
    const inner = checkpointJson(live);
    live.mutable.focus = 11;
    live.order.reverse();
    live = inner;
    expect(live.mutable.focus).toBe(7);
    expect(live.fixed.rows[0]!.value).toBe(9);
    live = outer;
    expect(live.mutable.focus).toBe(4);
    expect(live.fixed).toBe(fixed);
    expect(live.order).toEqual(['b', 'a']);
    expect(Object.keys(live)).toEqual(['fixed', 'mutable', 'alias', 'order']);
  });
});
