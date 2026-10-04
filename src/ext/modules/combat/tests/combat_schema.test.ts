import { describe, expect, it } from 'vitest';
import { extensionDataFingerprint } from '../../../fingerprint';
import definitions from '../data/definitions.json';
import locale from '../locales/zh_CN.json';
import { COMBAT_VERSION, getCombatPackIdentity, loadCombatDefinitionPack } from '../definitions';
import { assertCombatJson, assertLoadedCombatPack, cells, COMBAT_ERROR_CODES, COMBAT_LIMITS,
    CombatValidationError, freezeCombat, id, integer, loadCombatPack, record } from '../schema';
import type { CombatPack } from '../types';

const fixture = (): CombatPack => structuredClone(definitions) as CombatPack;
const load = (value: unknown, text: unknown = locale): CombatPack => loadCombatPack(value, text);
const bad = (mutate: (pack: CombatPack) => void): void => {
    const raw = fixture(); mutate(raw); expect(() => load(raw)).toThrow(CombatValidationError);
};
const segment = (pack: CombatPack) => pack.attacks[0]!.segments[0]!;
const facings = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

describe('combat strict inert fixture package', () => {
    it('loads exactly three original fixture attacks, one unbound profile, and part targeting', () => {
        const pack = loadCombatDefinitionPack();
        expect(COMBAT_VERSION).toBe('1.0.0');
        expect(pack.attacks.map(a => a.id)).toEqual(['fixture.slash', 'fixture.stomp', 'fixture.double-thrust']);
        expect(pack.profiles).toEqual([{ id: 'fixture.profile', resourcePolicyId: 'fixture.resources',
            attackIds: ['fixture.slash', 'fixture.stomp', 'fixture.double-thrust'] }]);
        expect(Object.keys(pack).sort()).toEqual(['schema', 'moduleId', 'moduleVersion', 'rulesVersion', 'resourcePolicies', 'attacks', 'profiles'].sort());
        expect(pack.attacks.map(a => a.segments.length)).toEqual([1, 1, 2]);
        for (const attack of pack.attacks) for (const step of attack.segments) {
            expect(step.targetPolicy).toBe('part'); expect(step.locationPolicy).toBe('locked-world');
            expect(Object.keys(step.shape.offsets)).toEqual(facings);
        }
        expect(pack.attacks[0]!.segments[0]!.shape.offsets.n).toEqual([{ x: -1, y: -1 }, { x: 0, y: -1 }, { x: 1, y: -1 }]);
        expect(pack.attacks[1]!.segments[0]!.shape.offsets.n).toHaveLength(8);
        expect(pack.attacks[2]!.segments.map(s => s.delayTicks)).toEqual([0, 30]);
        expect(() => assertLoadedCombatPack(pack)).not.toThrow();
    });
    it('isolates and freezes every nested object and array without freezing the input', () => {
        const raw = fixture(), pack = load(raw);
        const walk = (value: unknown): void => {
            if (value && typeof value === 'object') { expect(Object.isFrozen(value)).toBe(true); Object.values(value).forEach(walk); }
        };
        walk(pack); expect(Object.isFrozen(raw)).toBe(false);
        expect(pack).not.toBe(raw); expect(pack.attacks[0]).not.toBe(raw.attacks[0]);
        raw.attacks[0]!.cost = 999; expect(pack.attacks[0]!.cost).toBe(4);
        expect(() => { pack.attacks[0]!.cost = 999; }).toThrow();
        expect(() => pack.attacks.push(pack.attacks[0]!)).toThrow();
        expect(() => { segment(pack).shape.offsets.n[0]!.x = 999; }).toThrow();
    });
    it('does not accept forged, cloned, or merely frozen provenance', () => {
        expect(() => assertLoadedCombatPack(fixture())).toThrow();
        expect(() => assertLoadedCombatPack(freezeCombat(fixture()))).toThrow();
        expect(() => assertLoadedCombatPack(structuredClone(load(fixture())))).toThrow();
        expect(() => assertLoadedCombatPack(null as unknown as CombatPack)).toThrow();
        const first = load(fixture()), second = load(fixture());
        expect(first).not.toBe(second); expect(() => assertLoadedCombatPack(first)).not.toThrow();
    });
    it('localizes the complete finite diagnostic vocabulary', () => {
        const resource = locale as Record<string, string>;
        for (const code of COMBAT_ERROR_CODES) {
            const error = new CombatValidationError(code, '$.test');
            expect(resource[error.textKey]).toBeTruthy(); expect(error.path).toBe('$.test'); expect(error.code).toBe(code);
        }
    });

    it.each(['schema', 'moduleId', 'moduleVersion', 'rulesVersion'] as const)('pins exact package %s', key => {
        bad(p => Object.assign(p, { [key]: key === 'schema' ? 2 : '1.0.1' }));
        bad(p => { delete (p as unknown as Record<string, unknown>)[key]; });
    });
    it.each([
        ['root', (p: CombatPack) => p], ['resource', (p: CombatPack) => p.resourcePolicies[0]!],
        ['attack', (p: CombatPack) => p.attacks[0]!], ['segment', segment],
        ['shape', (p: CombatPack) => segment(p).shape], ['offsets', (p: CombatPack) => segment(p).shape.offsets],
        ['cell', (p: CombatPack) => segment(p).shape.offsets.n[0]!], ['profile', (p: CombatPack) => p.profiles[0]!],
    ] as const)('rejects undeclared keys and missing required fields at %s', (_name, target) => {
        bad(p => Object.assign(target(p), { unsupported: true }));
        bad(p => { const value = target(p) as unknown as Record<string, unknown>; delete value[Object.keys(value)[0]!]; });
    });
    it.each(['providers', 'optionalProviders', 'growth', 'giants', 'creatureBindings', 'bonfires', 'defenses', 'ai', 'limits'])('rejects unsupported %s integration', field => {
        bad(p => Object.assign(p, { [field]: {} }));
    });
    it.each([
        ['locationPolicy', 'follow-actor'], ['locationPolicy', 'track-target'], ['targetPolicy', 'whole-group'],
        ['damageProfile', 'direct-hp'], ['damageProfile', 'growth.damage'], ['friendlyFire', true],
        ['parryable', 1], ['dodgeable', 'true'],
    ])('rejects unsupported segment %s=%s', (key, value) => { bad(p => Object.assign(segment(p), { [key as string]: value })); });
    it.each([
        ['kind', 'single-ray'], ['kind', 'script'], ['selfExclusion', 'none'], ['occlusion', 'ignore-walls'],
    ])('rejects unsupported shape %s=%s', (key, value) => { bad(p => Object.assign(segment(p).shape, { [key!]: value })); });
    it('rejects missing/fabricated facing templates and allows both explicit self-exclusion policies', () => {
        bad(p => { delete (segment(p).shape.offsets as unknown as Record<string, unknown>).nw; });
        bad(p => Object.assign(segment(p).shape.offsets, { up: [{ x: 0, y: -1 }] }));
        const p = fixture(); segment(p).shape.selfExclusion = 'source-member'; expect(load(p)).toBeDefined();
    });

    it.each(['resourcePolicies', 'attacks', 'profiles'] as const)('requires bounded nonempty %s lists', key => {
        bad(p => Object.assign(p, { [key]: [] })); bad(p => Object.assign(p, { [key]: {} }));
        bad(p => Object.assign(p, { [key]: Array(COMBAT_LIMITS.maxDefinitions + 1).fill(p[key][0]) }));
    });
    it('bounds total definition count across categories and admits exactly the ceiling', () => {
        const p = fixture();
        while (p.resourcePolicies.length + p.attacks.length + p.profiles.length < COMBAT_LIMITS.maxDefinitions) {
            p.attacks.push({ ...structuredClone(p.attacks[0]!), id: `fixture.extra-${p.attacks.length}` });
        }
        expect(load(p).attacks).toHaveLength(COMBAT_LIMITS.maxDefinitions - 2);
        p.attacks.push({ ...structuredClone(p.attacks[0]!), id: 'fixture.too-many' }); expect(() => load(p)).toThrow();
    });
    it('requires globally unique IDs and unique typed references', () => {
        bad(p => { p.attacks[1]!.id = p.attacks[0]!.id; });
        bad(p => { p.profiles[0]!.id = p.resourcePolicies[0]!.id; });
        bad(p => { p.attacks[0]!.id = p.resourcePolicies[0]!.id; });
        bad(p => { p.profiles[0]!.resourcePolicyId = 'fixture.missing'; });
        bad(p => { p.profiles[0]!.resourcePolicyId = p.attacks[0]!.id; });
        bad(p => { p.profiles[0]!.attackIds[0] = p.resourcePolicies[0]!.id; });
        bad(p => { p.profiles[0]!.attackIds.push('fixture.missing'); });
        bad(p => { p.profiles[0]!.attackIds.push(p.profiles[0]!.attackIds[0]!); });
        bad(p => { p.profiles[0]!.attackIds = []; });
    });
    it.each(['', 'Upper', 'with space', 'a_b', 'a..b', 'a-', '__proto__', 'constructor', 'prototype', 'x'.repeat(129)])('rejects malformed ID %s', value => {
        bad(p => { p.attacks[0]!.id = value; }); expect(() => id(value)).toThrow();
    });
    it('accepts bounded safe IDs and rejects malformed references before lookup', () => {
        expect(id('fixture.safe-1')).toBe('fixture.safe-1'); expect(id('x'.repeat(128))).toHaveLength(128);
        bad(p => { p.profiles[0]!.attackIds[0] = 'not valid'; });
    });
    it.each(['initialStamina', 'regenPerTickNumerator', 'regenDelayTicks', 'poiseRecoveryNumerator'] as const)('bounds nonnegative resource field %s', field => {
        bad(p => { p.resourcePolicies[0]![field] = -1; });
        bad(p => { p.resourcePolicies[0]![field] = COMBAT_LIMITS.maxResource + 1; });
        const p = fixture(); p.resourcePolicies[0]![field] = 0; expect(load(p)).toBeDefined();
    });
    it.each(['staminaCapacity', 'regenPerTickDenominator', 'poiseCapacity', 'poiseRecoveryDenominator'] as const)('bounds positive resource field %s', field => {
        bad(p => { p.resourcePolicies[0]![field] = 0; });
        bad(p => { p.resourcePolicies[0]![field] = COMBAT_LIMITS.maxResource + 1; });
        const p = fixture(); p.resourcePolicies[0]![field] = COMBAT_LIMITS.maxResource; expect(load(p)).toBeDefined();
    });
    it('cross-checks initial stamina and profile affordability', () => {
        bad(p => { p.resourcePolicies[0]!.initialStamina = p.resourcePolicies[0]!.staminaCapacity + 1; });
        bad(p => { p.attacks[0]!.cost = p.resourcePolicies[0]!.staminaCapacity + 1; });
        const p = fixture(); p.attacks[0]!.cost = 0; segment(p).poiseDamage = 0; expect(load(p)).toBeDefined();
        bad(p => { p.attacks[0]!.cost = -1; }); bad(p => { segment(p).poiseDamage = -1; });
        bad(p => { segment(p).poiseDamage = COMBAT_LIMITS.maxResource + 1; });
    });
    it('prevents zero-time loops and excessive total duration', () => {
        bad(p => { p.attacks[0]!.windupTicks = 0; }); bad(p => { p.attacks[0]!.recoveryTicks = 0; });
        bad(p => { segment(p).delayTicks = 1; });
        bad(p => { p.attacks[2]!.segments[1]!.delayTicks = 0; });
        bad(p => { p.attacks[2]!.segments[1]!.delayTicks = -1; });
        bad(p => { p.attacks[0]!.windupTicks = COMBAT_LIMITS.maxTicks; });
        bad(p => Object.assign(p.attacks[0]!, { interruptPolicy: 'continue' }));
        const p = fixture(), attack = p.attacks[2]!;
        attack.windupTicks = 1; attack.recoveryTicks = 1; attack.segments[1]!.delayTicks = COMBAT_LIMITS.maxTicks - 2;
        expect(load(p)).toBeDefined(); attack.segments[1]!.delayTicks++; expect(() => load(p)).toThrow();
    });
    it('bounds segments independently and accepts the exact finite maximum', () => {
        bad(p => { p.attacks[0]!.segments = []; });
        const p = fixture(), attack = p.attacks[0]!;
        while (attack.segments.length < COMBAT_LIMITS.maxSegments) attack.segments.push({ ...structuredClone(attack.segments[0]!), delayTicks: 1 });
        expect(load(p).attacks[0]!.segments).toHaveLength(COMBAT_LIMITS.maxSegments);
        attack.segments.push({ ...structuredClone(attack.segments[0]!), delayTicks: 1 }); expect(() => load(p)).toThrow();
    });
    it('bounds every facing by nonempty unique integer offsets and coordinate budget', () => {
        bad(p => { segment(p).shape.offsets.n = []; });
        bad(p => { segment(p).shape.offsets.n.push({ ...segment(p).shape.offsets.n[0]! }); });
        bad(p => { segment(p).shape.offsets.n[0]!.x = COMBAT_LIMITS.maxOffsetCoordinate + 1; });
        bad(p => { segment(p).shape.offsets.n[0]!.y = -COMBAT_LIMITS.maxOffsetCoordinate - 1; });
        bad(p => { segment(p).shape.offsets.n[0]!.x = 0.5; });
        const p = fixture(); segment(p).shape.offsets.n = Array.from({ length: COMBAT_LIMITS.maxOffsets }, (_, x) => ({ x: x - 128, y: 0 }));
        expect(load(p)).toBeDefined(); segment(p).shape.offsets.n.push({ x: 128, y: 0 }); expect(() => load(p)).toThrow();
    });
    it('validates world-cell lists independently without treating them as map queries', () => {
        const valid = Array.from({ length: COMBAT_LIMITS.maxLockedCells }, (_, x) => ({ x, y: -COMBAT_LIMITS.maxCoordinate }));
        expect(cells(valid)).toBe(valid);
        expect(() => cells([...valid, { x: 2000, y: 0 }])).toThrow(); expect(() => cells(valid, 8)).toThrow();
        expect(() => cells([], 0)).toThrow(); expect(() => cells([{ x: 0, y: 0 }, { x: -0, y: 0 }])).toThrow();
        expect(() => cells([{ x: COMBAT_LIMITS.maxCoordinate + 1, y: 0 }])).toThrow();
        expect(() => cells([{ x: 0, y: 0, z: 0 }])).toThrow();
        expect(() => cells([{ x: 0, y: 0 }], COMBAT_LIMITS.maxLockedCells + 1)).toThrow();
    });

    it('requires every name reference in a valid combat-only locale', () => {
        bad(p => { p.attacks[0]!.nameKey = 'ext.growth.attack.name'; });
        bad(p => { p.attacks[0]!.nameKey = 'ext.combat.missing'; });
        const key = definitions.attacks[0]!.nameKey, missing = { ...locale } as Record<string, unknown>; delete missing[key];
        expect(() => load(definitions, missing)).toThrow();
        for (const value of ['', '  ', 1, '<script>x</script>', 'javascript:x', 'eval(x)', 'new Function(x)']) {
            expect(() => load(definitions, { ...locale, [key]: value })).toThrow();
        }
        expect(() => load(definitions, { ...locale, 'foreign.name': '文本' })).toThrow();
        expect(() => load(definitions, [])).toThrow();
    });
});

describe('combat hostile JSON boundary', () => {
    it.each([undefined, () => 1, Symbol('x'), BigInt(1), Number.NaN, Infinity, -Infinity,
        Number.MAX_SAFE_INTEGER + 1, Number.MIN_SAFE_INTEGER - 1, 1.5, '1'])('rejects unsafe integer input %s', value => {
        expect(() => integer(value)).toThrow(); bad(p => Object.assign(p.attacks[0]!, { cost: value }));
    });
    it('rejects non-JSON scalar types and unsafe numbers before schema traversal', () => {
        for (const value of [undefined, () => 1, Symbol('x'), BigInt(1), NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, 0.5]) {
            expect(() => assertCombatJson({ unexpected: value })).toThrow();
        }
        expect(integer(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
        expect(integer(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER)).toBe(Number.MIN_SAFE_INTEGER);
        expect(() => integer(-1)).toThrow(); expect(() => integer(11, 0, 10)).toThrow();
    });
    it.each(['__proto__', 'constructor', 'prototype'])('rejects dangerous own key %s without prototype pollution', key => {
        const raw = fixture(); Object.defineProperty(raw, key, { value: 1, enumerable: true });
        expect(() => load(raw)).toThrow(); expect(() => record(raw, Object.keys(raw))).toThrow();
    });
    it('rejects cycles, exotic prototypes, array subclasses, sparse or augmented arrays', () => {
        const cycle: unknown[] = []; cycle.push(cycle);
        const inherited = Object.create({ inherited: true }); inherited.value = 1;
        class NotJsonArray extends Array<number> {}
        const sparse = Array(2); sparse[1] = 1;
        const extra = [1]; Object.assign(extra, { extra: 1 });
        const nullArray = [1]; Object.setPrototypeOf(nullArray, null);
        for (const value of [cycle, inherited, new NotJsonArray(1), sparse, extra, nullArray, new Date(), new Map(), new Set()]) {
            expect(() => assertCombatJson(value)).toThrow();
        }
        const json = fixture(); Object.assign(json, { cycle: json }); expect(() => load(json)).toThrow();
    });
    it('never executes object or array getters, including at helper boundaries', () => {
        let calls = 0; const get = (): number => { calls++; return 1; };
        const object = {}; Object.defineProperty(object, 'value', { get, enumerable: true });
        const array: unknown[] = [0]; Object.defineProperty(array, '0', { get, enumerable: true });
        const raw = fixture(); Object.defineProperty(raw, 'attacks', { get, enumerable: true });
        expect(() => assertCombatJson(object)).toThrow(); expect(() => assertCombatJson(array)).toThrow();
        expect(() => record(object, ['value'])).toThrow(); expect(() => load(raw)).toThrow();
        expect(() => freezeCombat(object)).toThrow(); expect(() => cells(array)).toThrow(); expect(calls).toBe(0);
    });
    it('rejects hidden and symbol keys that JSON.stringify would silently erase', () => {
        const hidden = { value: 1 }; Object.defineProperty(hidden, 'hidden', { value: 2 });
        const symbol = { [Symbol('hidden')]: 1 }, hiddenArray = [1]; Object.defineProperty(hiddenArray, 'hidden', { value: 2 });
        for (const value of [hidden, symbol, hiddenArray]) expect(() => assertCombatJson(value)).toThrow();
    });
    it('supports null-prototype records, harmless aliases, and explicit deep freezing', () => {
        const child = { nested: [1, true, null] }, value = Object.assign(Object.create(null), { a: child, b: child });
        expect(() => assertCombatJson(value)).not.toThrow(); expect(record(value, ['a', 'b'])).toBe(value);
        expect(freezeCombat(value)).toBe(value); expect(Object.isFrozen(child.nested)).toBe(true);
        const raw = fixture(); Object.setPrototypeOf(raw, null); expect(load(raw)).toEqual(definitions);
    });
    it('bounds depth, per-string length, key length, aggregate strings and JSON values', () => {
        let value: unknown = null;
        for (let i = 0; i < COMBAT_LIMITS.maxJsonDepth; i++) value = [value];
        expect(() => assertCombatJson(value)).not.toThrow(); expect(() => assertCombatJson([value])).toThrow();
        expect(() => assertCombatJson('x'.repeat(COMBAT_LIMITS.maxStringLength + 1))).toThrow();
        expect(() => assertCombatJson({ ['x'.repeat(COMBAT_LIMITS.maxStringLength + 1)]: 0 })).toThrow();
        const text = 'x'.repeat(COMBAT_LIMITS.maxStringLength);
        expect(() => assertCombatJson(Array(Math.ceil(COMBAT_LIMITS.maxJsonStringUnits / text.length) + 1).fill(text))).toThrow();
        expect(() => assertCombatJson(Array(COMBAT_LIMITS.maxJsonValues + 1).fill(null))).toThrow();
        const half = Array(COMBAT_LIMITS.maxJsonValues / 2).fill(null);
        expect(() => assertCombatJson([half, half])).toThrow();
    });
    it('charges repeated aliases rather than allowing exponentially expanded serialization', () => {
        let alias: unknown = 0;
        for (let i = 0; i < 20; i++) alias = [alias, alias];
        expect(() => assertCombatJson(alias)).toThrow();
    });
    it('requires exact local records even outside the pack loader', () => {
        expect(() => record([], [])).toThrow(); expect(() => record(null, [])).toThrow();
        expect(() => record(Object.create({ value: 1 }), ['value'])).toThrow();
        expect(() => record({ a: 1 }, ['a', 'b'])).toThrow(); expect(() => record({ a: 1, b: 2 }, ['a'])).toThrow();
    });
});

describe('combat canonical mechanical identity', () => {
    it('uses the foundation SHA-256 canonical helper and pins version/schema', () => {
        const identity = getCombatPackIdentity();
        expect(identity).toEqual({ schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(definitions) });
        expect(identity.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/); expect(Object.isFrozen(identity)).toBe(true);
    });
    it('ignores object insertion order but retains mechanical arrays and values', () => {
        const reverseKeys = (value: unknown): unknown => Array.isArray(value) ? value.map(reverseKeys)
            : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverseKeys(child)])) : value;
        const fingerprint = getCombatPackIdentity().fingerprint;
        expect(extensionDataFingerprint(load(reverseKeys(definitions)))).toBe(fingerprint);
        const changed = fixture(); changed.attacks[0]!.windupTicks++; expect(extensionDataFingerprint(load(changed))).not.toBe(fingerprint);
        const ordered = fixture(); ordered.attacks.reverse(); expect(extensionDataFingerprint(load(ordered))).not.toBe(fingerprint);
        const cellsChanged = fixture(); segment(cellsChanged).shape.offsets.n.reverse(); expect(extensionDataFingerprint(load(cellsChanged))).not.toBe(fingerprint);
    });
    it('keeps localized presentation text outside mechanical identity', () => {
        const translated = { ...locale, [definitions.attacks[0]!.nameKey]: '另一个显示名称' };
        expect(extensionDataFingerprint(load(definitions, translated))).toBe(getCombatPackIdentity().fingerprint);
    });
});
