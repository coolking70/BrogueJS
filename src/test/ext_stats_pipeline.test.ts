import { describe, expect, it } from 'vitest';
import {
  evaluateStat,
  roundStatFraction,
  StatPipeline,
  statConditionsMatch,
  validateStatBudget,
  type OwnedStatRow
} from '../engine/Stats/StatPipeline';
import { NATIVE_STAT_KEYS, NATIVE_STAT_DAG } from '../engine/Stats/NativeStatKeys';
import {
  isStatJson,
  validateStatKey,
  validateStatRows,
  type PairFacts,
  type StatActorFacts,
  type StatKeyDeclaration
} from '../ext/stats';

const sample: StatKeyDeclaration = {
  id: 'sample.value',
  owner: 'sample',
  unit: 'integer',
  kind: 'query',
  minimum: -1_000_000,
  maximum: 1_000_000,
  rounding: 'nearest-half-away',
  categories: ['override', 'flat', 'increased', 'more', 'clamp'],
  increased: { minimum: -9000, maximum: 50000 },
  moreSlots: [
    { id: 'one', minimum: 0, maximum: 40000 },
    { id: 'two', minimum: 0, maximum: 40000 }
  ]
};
const actor = (id = 1): StatActorFacts => ({
  id,
  name: 'actor',
  hp: 25,
  maxHp: 100,
  x: id,
  y: 0,
  player: id === 1,
  monsterId: null,
  allied: id === 1,
  hostile: id !== 1,
  statuses: ['weakened'],
  tags: ['body.large', 'animal']
});
const row = (
  category: OwnedStatRow['category'],
  value: number,
  more: Partial<OwnedStatRow> = {}
): OwnedStatRow => ({
  stat: 'sample.value',
  category,
  value,
  owner: 'sample',
  layer: 'character',
  sourceKind: 'attribute',
  sourceId: 'source',
  ...more
});
function setup(
  debug = false,
  keys: readonly StatKeyDeclaration[] = [sample],
  dag: Readonly<Record<string, readonly string[]>> = {}
) {
  const revisions = new Map<number, number>(),
    actors = new Map([
      [1, actor(1)],
      [2, actor(2)]
    ]);
  const rows = new Map<number, OwnedStatRow[]>(),
    bases = new Map<string, number>([['sample.value', 100]]);
  let collects = 0;
  const pipeline = new StatPipeline(
    {
      debug,
      actor: (id) => actors.get(id)!,
      revision: (id) => revisions.get(id) ?? 0,
      collect: (id) => {
        collects++;
        return rows.get(id) ?? [];
      },
      base: (_id, stat, dep, facts, change) =>
        change?.equip === 10
          ? 200
          : stat === 'sample.derived'
            ? dep('sample.value') * 2
            : (facts.baseValue ?? bases.get(stat) ?? 0)
    },
    keys,
    dag
  );
  return { pipeline, revisions, actors, rows, bases, collects: () => collects };
}

describe('foundation stat scalar and source boundary', () => {
  it.each([
    [[], 100],
    [[row('flat', 5)], 105],
    [[row('increased', -2500)], 75],
    [[row('more', 10000, { slot: 'one' })], 200],
    [[row('clamp', 20, { maximum: 30 })], 30],
    [[row('override', 40)], 40]
  ] as [OwnedStatRow[], number][])(
    'evaluates a category without an intermediate round (%j)',
    (rows, value) => {
      expect(evaluateStat(sample, 100, rows).value).toBe(value);
    }
  );
  it('adds one increased pool, sums each slot and rounds after all factors', () => {
    const rows = [
      row('flat', 1),
      row('increased', -1000),
      row('increased', 2000),
      row('more', 10000, { slot: 'one' }),
      row('more', 5000, { slot: 'one' }),
      row('more', 1000, { slot: 'two' })
    ];
    expect(evaluateStat(sample, 2, rows).value).toBe(9); // 3 * 1.1 * 2.5 * 1.1 = 9.075
    expect(evaluateStat(sample, 2, [...rows].reverse()).value).toBe(9);
  });
  it.each(['floor', 'ceil', 'nearest-half-away'] as const)(
    'rounds signed exact fractions with %s',
    (mode) => {
      expect(roundStatFraction({ numerator: 5n, denominator: 2n }, mode)).toBe(
        mode === 'floor' ? 2 : 3
      );
      expect(roundStatFraction({ numerator: -5n, denominator: 2n }, mode)).toBe(
        mode === 'ceil' ? -2 : -3
      );
    }
  );
  it('chooses only a distinct explicit highest override priority', () => {
    expect(
      evaluateStat(sample, 1, [
        row('override', 10, { priority: 1 }),
        row('override', 20, { priority: 2 })
      ]).value
    ).toBe(20);
    for (const rows of [
      [row('override', 10), row('override', 20)],
      [row('override', 10, { priority: 1 }), row('override', 20, { priority: 1 })]
    ])
      expect(() => evaluateStat(sample, 1, rows)).toThrow();
  });
  it('uses exact BigInt intermediates for extreme legal rows, then the hard bound', () => {
    const rows = [
      row('flat', Number.MAX_SAFE_INTEGER),
      row('increased', 50000),
      ...sample.moreSlots.map((s) => row('more', 40000, { slot: s.id }))
    ];
    expect(evaluateStat(sample, 1_000_000, rows).value).toBe(1_000_000);
    expect(evaluateStat(sample, 100, [row('increased', -Number.MAX_SAFE_INTEGER)]).value).toBe(10);
    expect(evaluateStat(sample, 100, [row('increased', Number.MAX_SAFE_INTEGER)]).value).toBe(600);
  });
  it('source clamps only tighten hard limits and incompatible bounds reject', () => {
    expect(
      evaluateStat(sample, 2_000_000, [row('clamp', -2_000_000, { maximum: 2_000_000 })]).value
    ).toBe(1_000_000);
    expect(() =>
      evaluateStat(sample, 100, [
        row('clamp', 200, { maximum: 300 }),
        row('clamp', 0, { maximum: 100 })
      ])
    ).toThrow();
  });
  it('accepts exactly 256 rows and rejects 257', () => {
    const rows = Array.from({ length: 256 }, () => row('flat', 1));
    expect(() => validateStatBudget(rows)).not.toThrow();
    expect(() => validateStatBudget([...rows, row('flat', 1)])).toThrow();
  });
  it('accepts exactly 64 distinct sources per key and rejects 65', () => {
    const rows = Array.from({ length: 64 }, (_, i) => row('flat', 1, { sourceId: `source.s${i}` }));
    expect(() => validateStatBudget(rows)).not.toThrow();
    expect(() =>
      validateStatBudget([...rows, row('flat', 1, { sourceId: 'source.s64' })])
    ).toThrow();
  });
  it('atomically registers up to 128 owner keys and refuses the next one', () => {
    const { pipeline } = setup();
    const keys = Array.from({ length: 127 }, (_, i) => ({ ...sample, id: `sample.k${i}` }));
    pipeline.registerProviderKeys(keys, 'sample');
    expect(pipeline.keys.size).toBe(128);
    expect(() =>
      pipeline.registerProviderKeys([{ ...sample, id: 'sample.extra' }], 'sample')
    ).toThrow();
    expect(pipeline.keys.size).toBe(128);
    const second = setup().pipeline;
    expect(() =>
      second.registerProviderKeys([...keys, { ...sample, id: 'sample.extra' }], 'sample')
    ).toThrow();
    expect(second.keys.size).toBe(1);
  });
  it('validates owner prefixes, materialized allowlist, finite slots and safe integers', () => {
    for (const key of [
      { ...sample, id: 'other.value' },
      { ...sample, kind: 'materialized' },
      { ...sample, minimum: 0.1 },
      { ...sample, moreSlots: [{ id: 'one', minimum: -10001, maximum: 10000 }] }
    ])
      expect(() => validateStatKey(key, 'sample')).toThrow();
    expect(() => validateStatKey(sample, 'sample')).not.toThrow();
  });
  it('rejects Promise, getters, hidden/symbol fields, exotic prototypes, cycles and holes without executing getters', () => {
    let getters = 0;
    const getter = Object.defineProperty({}, 'secret', {
      enumerable: true,
      get() {
        getters++;
        return 0;
      }
    });
    const cycle: unknown[] = [];
    cycle.push(cycle);
    for (const value of [
      Promise.resolve([]),
      getter,
      Object.defineProperty({}, 'secret', { value: 0 }),
      { [Symbol('secret')]: 0 },
      new Date(),
      cycle,
      new Array(1),
      [undefined],
      NaN,
      0.5
    ])
      expect(isStatJson(value)).toBe(false);
    expect(getters).toBe(0);
    expect(isStatJson([{ ...row('flat', 1) }])).toBe(true);
  });
  it('validates each category shape, conditions, source identity and grant authorization', () => {
    const keys = new Map([[sample.id, sample]]),
      clean = ({ owner: _, ...r }: OwnedStatRow) => r;
    expect(() => validateStatRows([clean(row('increased', -5000))], 'sample', keys)).not.toThrow();
    for (const r of [
      row('more', 1),
      row('flat', 1, { slot: 'one' }),
      row('flat', 1, { priority: 1 }),
      row('clamp', 3, { maximum: 2 }),
      row('flat', 1, { grantPolicy: 'refill-delta' }),
      row('flat', 1, { conditions: [{ kind: 'target-tag', value: 'private.hidden' }] })
    ])
      expect(() => validateStatRows([clean(r)], 'sample', keys)).toThrow();
  });
});

describe('foundation stat facts, DAG, pair and derived cache', () => {
  it.each([
    { kind: 'attack-kind', value: 'melee' },
    { kind: 'target-tag', value: 'animal' },
    { kind: 'self-status', value: 'weakened' },
    { kind: 'adjacent', value: true },
    { kind: 'hp-ratio', comparison: 'at-most', value: 2500 },
    { kind: 'hp-ratio', comparison: 'at-least', value: 2500 }
  ] as const)('matches a finite condition (%j)', (condition) => {
    const r = row('flat', 1, { conditions: [condition] });
    expect(statConditionsMatch(r, actor(), actor(2), { attackKind: 'melee', adjacent: true })).toBe(
      true
    );
  });
  it('missing facts never satisfy attack, adjacent or target conditions', () => {
    for (const condition of [
      { kind: 'attack-kind', value: 'melee' },
      { kind: 'adjacent', value: false },
      { kind: 'target-tag', value: 'animal' }
    ] as const)
      expect(
        statConditionsMatch(row('flat', 1, { conditions: [condition] }), actor(), undefined, {})
      ).toBe(false);
  });
  it('calculates native dependency nodes in topological order and refuses cycles or undeclared edges', () => {
    const keys = [sample, { ...sample, id: 'sample.derived' }],
      s = setup(false, keys, { 'sample.derived': ['sample.value'] });
    s.rows.set(1, [row('flat', 10)]);
    expect(s.pipeline.value(1, 'sample.derived')).toBe(220);
    expect(() =>
      setup(false, keys, { 'sample.derived': ['sample.value'], 'sample.value': ['sample.derived'] })
    ).toThrow();
    expect(() => setup(false, keys, { 'sample.derived': ['sample.unknown'] })).toThrow();
    expect(() => setup(false, keys).pipeline.value(1, 'sample.derived')).toThrow();
    expect(
      () =>
        new StatPipeline(
          { actor, revision: () => 0, collect: () => [], base: () => 1 },
          NATIVE_STAT_KEYS,
          NATIVE_STAT_DAG
        )
    ).not.toThrow();
  });
  it.each(['physical-damage', 'hit'] as const)(
    'merges attacker and defender pools once (%s)',
    (kind) => {
      const key = kind === 'hit' ? 'native.hit-chance' : 'native.physical-damage-dealt',
        other = kind === 'hit' ? 'native.evasion' : 'native.physical-damage-taken';
      const s = setup(false, [...NATIVE_STAT_KEYS]);
      s.rows.set(1, [row('increased', 2000, { stat: key })]);
      s.rows.set(2, [row('increased', -1000, { stat: other })]);
      const facts: PairFacts = { baseValue: kind === 'hit' ? 5000 : 100, attackKind: 'melee' };
      expect(s.pipeline.evaluatePair(1, 2, kind, facts)).toBe(kind === 'hit' ? 5500 : 110);
    }
  );
  it('admits 64 sources per participant in a pair and still rejects a 65th actor source', () => {
    const s=setup(false,[...NATIVE_STAT_KEYS]);
    const sources=(stat:string,side:string,count:number,value:number)=>Array.from({length:count},(_,i)=>row('increased',value,{stat,sourceId:`sample.${side}.${i}`}));
    s.rows.set(1,sources('native.physical-damage-dealt','attack',64,1));
    s.rows.set(2,sources('native.physical-damage-taken','defense',64,-1));
    expect(s.pipeline.evaluatePair(1,2,'physical-damage',{baseValue:100})).toBe(100);
    s.rows.set(1,sources('native.physical-damage-dealt','attack',65,1));s.pipeline.clear();
    expect(()=>s.pipeline.evaluatePair(1,2,'physical-damage',{baseValue:100})).toThrow();
  });
  it('foraging accuracy and damage penalties are representable as increased rows down to -50%', () => {
    const damage = NATIVE_STAT_KEYS.find((k) => k.id === 'native.physical-damage-dealt')!,
      accuracy = NATIVE_STAT_KEYS.find((k) => k.id === 'native.accuracy')!;
    for (const [hit, damageBp, hitOut, damageOut] of [
      [-2000, -2500, 80, 75],
      [-4000, -5000, 60, 50]
    ]) {
      expect(
        evaluateStat(accuracy, 100, [row('increased', hit!, { stat: accuracy.id })]).value
      ).toBe(hitOut);
      expect(
        evaluateStat(damage, 100, [row('increased', damageBp!, { stat: damage.id })]).value
      ).toBe(damageOut);
    }
  });
  it('uses actor revision and target facts, hits cache and removes the oldest LRU entry at 128', () => {
    const s = setup();
    expect(s.pipeline.value(1, 'sample.value')).toBe(100);
    expect(s.collects()).toBe(1);
    s.pipeline.value(1, 'sample.value');
    expect(s.pipeline.diagnostics.hits).toBe(1);
    expect(s.collects()).toBe(1);
    s.rows.set(1, [row('flat', 1)]);
    s.revisions.set(1, 1);
    expect(s.pipeline.value(1, 'sample.value')).toBe(101);
    for (let i = 0; i < 129; i++) s.pipeline.value(1, 'sample.value', { baseValue: i });
    expect(s.pipeline.cacheSize(1)).toBe(128);
    s.pipeline.clear();
    expect(s.pipeline.cacheSize(1)).toBe(0);
  });
  it('debug full recomputation detects an unmarked source write', () => {
    const s = setup(true);
    s.pipeline.value(1, 'sample.value');
    s.rows.set(1, [row('flat', 1)]);
    expect(() => s.pipeline.value(1, 'sample.value')).toThrow('Stat cache drift');
  });
  it('HP conditions update under the same revision and target revision invalidates pair facts', () => {
    const s = setup();
    s.rows.set(1, [
      row('flat', 1, { conditions: [{ kind: 'hp-ratio', comparison: 'at-most', value: 1000 }] })
    ]);
    expect(s.pipeline.value(1, 'sample.value')).toBe(100);
    s.actors.set(1, { ...actor(), hp: 1 });
    expect(s.pipeline.value(1, 'sample.value')).toBe(101);
    s.pipeline.value(1, 'sample.value', { targetId: 2 });
    const old = s.collects();
    s.revisions.set(2, 1);
    s.pipeline.value(1, 'sample.value', { targetId: 2 });
    expect(s.collects()).toBe(old + 1);
  });
  it('hypothetical and known projections leave revisions/cache/counters unchanged', () => {
    const s = setup();
    s.rows.set(1, [row('flat', 10, { known: false })]);
    s.pipeline.value(1, 'sample.value');
    const counters = { ...s.pipeline.diagnostics },
      revision = [...s.revisions],
      size = s.pipeline.cacheSize(1);
    expect(s.pipeline.hypothetical(1, { equip: 10 }, true)['sample.value']).toBe(200);
    expect(s.pipeline.hypothetical(1, { equip: 10 }, false)['sample.value']).toBe(210);
    expect(s.pipeline.breakdown(1, 'sample.value', {}, true).value).toBe(100);
    expect(s.pipeline.diagnostics).toEqual(counters);
    expect([...s.revisions]).toEqual(revision);
    expect(s.pipeline.cacheSize(1)).toBe(size);
  });
  it('rejects malformed hypothetical changes and pair facts before host access', () => {
    const s = setup();
    for (const change of [
      { equip: 0 },
      { unequip: [1, 1] },
      { unequip: [1, 2, 3, 4, 5] },
      { equip: 1, random: 1 }
    ])
      expect(() => s.pipeline.hypothetical(1, change, true)).toThrow();
    for (const facts of [
      { targetId: 0 },
      { attackKind: 'bolt' },
      { baseValue: 0.5 },
      { random: 1 },
      { adjacent: 1 }
    ])
      expect(() => s.pipeline.value(1, 'sample.value', facts as PairFacts)).toThrow();
    expect(s.collects()).toBe(0);
  });
});
