import { describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import data from '../data/definitions.json';
import monsters from '../../../../data/monsters.json';
import consumables from '../../../../data/consumables.json';
import arcana from '../../../../data/arcana.json';
import weapons from '../../../../data/weapons.json';
import armors from '../../../../data/armors.json';
import baseZhCN from '../../../../locales/zh_CN.json';
import growthZhCN from '../locales/zh_CN.json';
const zhCN = { ...baseZhCN, ...growthZhCN };
import { canonical } from '../../../../ext/json';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { getGrowthPackIdentity, GROWTH_VERSION, loadGrowthDefinitionPack, parseGrowthDefinitionPack } from '../definitions';
import { createGrowthContractModule } from '..';
import { getGrowthSchema, GrowthValidationError, validateGrowthDefinitionPack } from '../schema';
import { formatGrowthValidationError, growthDefinitionText } from '../text';
import type { GrowthDefinitionPack, GrowthEffect, GrowthIdentity, GrowthSkill, GrowthTimedEffect } from '../types';

const itemIds = [...weapons, ...armors, ...Object.values(consumables).flat(), ...Object.values(arcana).flat()].map(item => item.id);
const options = { moduleVersion: GROWTH_VERSION, hasText: (key: string) => Object.prototype.hasOwnProperty.call(zhCN, key),
    monsterIds: monsters.map(monster => monster.id), itemIds,
    categoryIds: ['weapon', 'armor', 'potion', 'scroll', 'food', 'gold', 'wand', 'staff', 'ring', 'charm', 'key', 'amulet', 'gem'] };
const fresh = (): GrowthDefinitionPack => structuredClone(data) as unknown as GrowthDefinitionPack;
const validate = (value: unknown): void => validateGrowthDefinitionPack(value, options);
const skill = (pack: GrowthDefinitionPack, slug: string): GrowthSkill => pack.definitions.find(def => def.id === `growth.skill.${slug}`) as GrowthSkill;
const identity = (pack: GrowthDefinitionPack, kind: string, slug: string): GrowthIdentity => pack.definitions.find(def => def.id === `growth.${kind}.${slug}`) as GrowthIdentity;
const timed = (pack: GrowthDefinitionPack, slug: string): GrowthTimedEffect => skill(pack, slug).effects[0] as GrowthTimedEffect;

describe('EXT-1a0 growth data contract, isolated from gameplay', () => {
    it('strictly validates all original 12 skills + 4 professions + 4 lineages + 4 faiths and the complete native monster catalog', () => {
        expect(() => validate(data)).not.toThrow();
        expect(data.definitions.filter(def => def.kind === 'skill')).toHaveLength(12);
        for (const kind of ['profession', 'lineage', 'faith']) expect(data.definitions.filter(def => def.kind === kind)).toHaveLength(4);
        expect(data.config.experience.kills.monsterQuotes.map(quote => quote.monsterId)).toEqual(monsters.map(monster => monster.id));
        const names = data.definitions.map(def => (zhCN as Record<string, string>)[def.nameKey]);
        expect(names).toEqual(['稳手','近身防御','轻步','细察','沉着','武器熟练','稳击','架势','撤步','屏息','勘察','牵制',
            '卫士','斥候','探索者','游斗者','人类','岩裔','暮裔','苇民','无信仰 / 自行之道','守望誓约','寻路誓约','克己誓约']);
    });
    it('ships a strictly empty opt-in module with no experience, commands, hooks or character runtime', () => {
        const module = createGrowthContractModule();
        expect(module.version).toBe(GROWTH_VERSION); expect(module.rules).toEqual(getGrowthPackIdentity());
        expect(module.initialState()).toEqual({}); expect(module.validateState({})).toBe(true);
        for (const state of [null, [], 1, { level: 1 }, { xp: 0 }]) expect(module.validateState(state)).toBe(false);
        expect(module.hooks).toBeUndefined(); expect(module.commands).toBeUndefined(); expect(module.onNewGame).toBeUndefined();
    });
    it('returns recursively frozen copies while preserving the caller data', () => {
        const input = fresh(), before = canonical(input), parsed = parseGrowthDefinitionPack(input, options);
        expect(canonical(input)).toBe(before); expect(Object.isFrozen(input)).toBe(false);
        expect(Object.isFrozen(parsed)).toBe(true); expect(Object.isFrozen(parsed.config.attributes)).toBe(true);
        expect(Object.isFrozen(parsed.definitions[0]!.effects[0])).toBe(true);
        input.config.levels.cap = 99; expect(parsed.config.levels.cap).toBe(data.config.levels.cap);
        expect(loadGrowthDefinitionPack(options)).toEqual(parsed);
    });
    it('exports a finite machine-readable schema rather than executable rules', () => {
        const json = JSON.stringify(getGrowthSchema());
        expect(JSON.parse(json)).toEqual(getGrowthSchema()); expect(json).toContain('additionalProperties');
        expect(json).toContain('taggedProperties'); expect(json).toContain('attributeTotalCap');
        expect(JSON.stringify(data)).not.toMatch(/"(?:script|eval|code|callback)"\s*:/);
    });
    it('keeps all localized names, descriptions and validation messages present', () => {
        const text = growthDefinitionText();
        for (const key of Object.keys(text)) expect(options.hasText(key), key).toBe(true);
        const error = new GrowthValidationError('reference', '$.definitions[0].prerequisites', 'growth.skill.unknown');
        const message = formatGrowthValidationError(error);
        expect(message).toContain(error.path); expect(message).toContain('growth.skill.unknown'); expect(message).not.toContain('ext.growth.error.reference');
        expect(error.key).toBe('ext.growth.error.reference');
        expect(() => validateGrowthDefinitionPack(data, { ...options, hasText: () => false })).toThrow(GrowthValidationError);
    });
    it.each([
        ['module mismatch', (pack: GrowthDefinitionPack) => { pack.moduleVersion = '1.0.1'; }],
        ['rules mismatch', (pack: GrowthDefinitionPack) => { pack.rulesVersion = '1.0.1'; }],
        ['invalid version', (pack: GrowthDefinitionPack) => { pack.moduleVersion = '01.0.0'; }],
        ['duplicate definition', (pack: GrowthDefinitionPack) => { pack.definitions.push(pack.definitions[0]!); }],
        ['duplicate attribute', (pack: GrowthDefinitionPack) => { pack.config.attributes.push(pack.config.attributes[0]!); }],
        ['duplicate quote', (pack: GrowthDefinitionPack) => { pack.config.experience.kills.monsterQuotes.push(pack.config.experience.kills.monsterQuotes[0]!); }],
        ['missing quote', (pack: GrowthDefinitionPack) => { pack.config.experience.kills.monsterQuotes.pop(); }],
        ['unknown quote', (pack: GrowthDefinitionPack) => { pack.config.experience.kills.monsterQuotes[0]!.monsterId = 'unlisted_monster'; }],
        ['fractional cap', (pack: GrowthDefinitionPack) => { pack.config.levels.cap = 2.5; }],
        ['negative focus', (pack: GrowthDefinitionPack) => { pack.config.focus.base = -1; }],
        ['invalid probability split', (pack: GrowthDefinitionPack) => { pack.config.experience.allySplit.playerBasisPoints = 10001; }],
        ['invalid attribute cap', (pack: GrowthDefinitionPack) => { pack.config.attributes[0]!.initial = 999; }],
        ['total cap exceeded', (pack: GrowthDefinitionPack) => { pack.config.attributeTotalCap = 1; }],
        ['unbound enabled training', (pack: GrowthDefinitionPack) => { pack.config.strengthTraining.attributeId = null; }],
        ['unknown item', (pack: GrowthDefinitionPack) => { pack.config.itemGrowth.rules[0]!.itemId = 'fake_item'; }],
        ['unknown category', (pack: GrowthDefinitionPack) => { pack.config.experience.identification.categories = ['fake_category']; }],
        ['invalid lock', (pack: GrowthDefinitionPack) => { skill(pack, 'steady-hand').lock = { mode: 'hard', professionIds: [], lineageIds: [], faithIds: [] }; }],
        ['wrong-kind reference', (pack: GrowthDefinitionPack) => { skill(pack, 'steady-hand').prerequisites = [{ kind: 'skill', skillId: 'growth.lineage.human' }]; }],
        ['unknown prerequisite', (pack: GrowthDefinitionPack) => { skill(pack, 'steady-hand').prerequisites = [{ kind: 'attribute', attributeId: 'growth.attribute.unknown', min: 1 }]; }],
        ['invalid slot kind', (pack: GrowthDefinitionPack) => { const effect = timed(pack, 'brace').modifiers[0]!; effect.slot = 'growth.slot.final'; }],
        ['unknown multiplier slot', (pack: GrowthDefinitionPack) => { const effect = timed(pack, 'brace').modifiers[0]!; effect.operation = 'multiply'; effect.slot = 'growth.slot.unknown'; }],
        ['invalid consume count', (pack: GrowthDefinitionPack) => { timed(pack, 'brace').consume.count = 0; }],
        ['invalid duration', (pack: GrowthDefinitionPack) => { timed(pack, 'brace').duration = { kind: 'objective-blocks', blocks: 4, cap: 3 }; }],
        ['invalid interval', (pack: GrowthDefinitionPack) => { pack.config.focus.recoveryInterval = 0; }],
        ['ambiguous depth templates', (pack: GrowthDefinitionPack) => { pack.config.monsters.depthTemplates = [1,2].map(() => ({ minDepth: 1, maxDepth: 3, templateId: 'growth.template.neutral', priority: 0 })); }],
        ['unfunded template', (pack: GrowthDefinitionPack) => { pack.config.monsters.templates[0]!.attributes = [{ attributeId: 'growth.attribute.agility', amount: 1 }]; }],
        ['impossible default identity', (pack: GrowthDefinitionPack) => { pack.config.attributes.find(attr => attr.id === 'growth.attribute.constitution')!.cap = 2; pack.config.identities.defaults.lineageId = 'growth.lineage.stoneborn'; }],
    ] as const)('rejects %s', (_name, mutate) => { const pack = fresh(); mutate(pack); expect(() => validate(pack)).toThrow(GrowthValidationError); });
    it('rejects unknown fields at every nesting level visited by the sample, including nested effects', () => {
        const paths: (string | number)[][] = [];
        const walk = (value: unknown, path: (string | number)[]): void => {
            if (!value || typeof value !== 'object') return;
            if (!Array.isArray(value)) paths.push(path);
            Object.entries(value).forEach(([key, child]) => walk(child, [...path, Array.isArray(value) ? Number(key) : key]));
        };
        walk(data, []);
        expect(paths.length).toBeGreaterThan(250);
        for (const path of paths) {
            const copy = fresh(); let target: any = copy;
            for (const key of path) target = target[key];
            target.unrecognized = 1;
            expect(() => validate(copy), path.join('.')).toThrow(GrowthValidationError);
        }
    });
    it('rejects missing fields, non-JSON values, unsafe integers, prototypes, aliases that cycle and executable functions', () => {
        const cases: unknown[] = [undefined, null, [], new Date(), { ...data, config: () => {} }];
        for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
            const pack = fresh(); pack.config.levels.cap = value; cases.push(pack);
        }
        const missing = fresh() as any; delete missing.config.focus.cap; cases.push(missing);
        const cyclic = fresh() as any; cyclic.config.recur = cyclic; cases.push(cyclic);
        const pollution = fresh() as any; pollution.config = JSON.parse('{"__proto__":{}}'); cases.push(pollution);
        const sparse = fresh(); sparse.definitions = new Array(2); cases.push(sparse);
        for (const value of cases) expect(() => validate(value)).toThrow(GrowthValidationError);
    });
    it('validates prerequisite graphs in a second pass, allowing forward references but rejecting all cycles', () => {
        const pack = fresh(), first = skill(pack, 'steady-hand'), last = skill(pack, 'pressure');
        first.prerequisites.push({ kind: 'skill', skillId: last.id }); expect(() => validate(pack)).not.toThrow();
        last.prerequisites.push({ kind: 'skill', skillId: first.id }); expect(() => validate(pack)).toThrow(/cycle/);
        last.prerequisites.pop(); first.prerequisites = [{ kind: 'skill', skillId: first.id }]; expect(() => validate(pack)).toThrow(/cycle/);
    });
    it('rejects duplicate prerequisites and conditions regardless of JSON key insertion order', () => {
        const pack = fresh(), steady = skill(pack, 'steady-hand');
        steady.prerequisites = [{ kind: 'skill', skillId: 'growth.skill.careful-step' }, { skillId: 'growth.skill.careful-step', kind: 'skill' }];
        expect(() => validate(pack)).toThrow(GrowthValidationError);
        steady.prerequisites = [{ kind: 'attribute', attributeId: 'growth.attribute.agility', min: 1 },
            { min: 2, attributeId: 'growth.attribute.agility', kind: 'attribute' }];
        expect(() => validate(pack)).toThrow(/duplicate/);
        steady.prerequisites = [];
        const effect = steady.effects[0]!; if (effect.kind !== 'modifier') throw new Error('Expected modifier');
        effect.conditions = [{ kind: 'role', value: 'actor' }, { value: 'actor', kind: 'role' }];
        expect(() => validate(pack)).toThrow(GrowthValidationError);
        effect.conditions.pop(); expect(() => validate(pack)).not.toThrow();
        const reversed = JSON.parse(JSON.stringify(pack), (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
            ? Object.fromEntries(Object.entries(value).reverse()) : value);
        expect(() => validate(reversed)).not.toThrow();
    });
    it('validates source-based finite coefficients and prevents arithmetic overflow before a clamp can conceal it', () => {
        const pack = fresh(), magnitude = pack.config.attributes[1]!.effects[0]!.magnitude;
        magnitude.divisor = 0; expect(() => validate(pack)).toThrow();
        magnitude.divisor = 1; magnitude.coefficient = Number.MAX_SAFE_INTEGER; expect(() => validate(pack)).toThrow(/overflow/);
        magnitude.coefficient = 100; magnitude.min = 10; magnitude.max = 1; expect(() => validate(pack)).toThrow(/range/);
    });
    it('supports configured tables and curves, points/recovery/caps/slots/costs and arbitrary new attributes without original-balance guards', () => {
        const pack = fresh(); pack.config.levels.cap = 30;
        pack.config.levels.experience = { kind: 'table', cumulative: Array.from({ length: 30 }, (_, i) => i * i * 7) };
        pack.config.levels.attributePoints = { kind: 'table', grants: Array.from({ length: 30 }, (_, i) => i ? 3 : 0) };
        pack.config.levels.recovery.levelHp = 'full'; pack.config.levels.recovery.clearCooldownOnLevel = true;
        pack.config.skills.activeSlots = 9; pack.config.skills.passiveSlots = 12;
        pack.config.experience.allySplit.playerBasisPoints = 2500; pack.config.respec.enabled = true;
        pack.config.respec.cost.amount = 17; pack.config.attributeTotalCap = null;
        const extra = structuredClone(pack.config.attributes[1]!); extra.id = 'growth.attribute.memory'; extra.cap = 70; extra.effects = [];
        pack.config.attributes.push(extra); expect(() => validate(pack)).not.toThrow();
        pack.config.levels.experience.cumulative[2] = 0; expect(() => validate(pack)).toThrow(/range/);
        pack.config.levels.experience = { kind: 'curve', base: 1, linear: 0, quadratic: 0 }; expect(() => validate(pack)).not.toThrow();
        pack.config.levels.experience.base = 0; expect(() => validate(pack)).toThrow(/positive costs/);
    });
    it('uses the referenced strength attribute magnitude as the sole training conversion', () => {
        const pack = fresh(), training = pack.config.attributes.find(attr => attr.id === pack.config.strengthTraining.attributeId)!;
        expect(training.effects).toHaveLength(1); expect(training.effects[0]!.port).toBe('strengthBonus');
        training.effects[0]!.magnitude.coefficient = 2; training.effects[0]!.magnitude.max = 8;
        pack.config.rules.ports.strengthBonus.globalClamp.max = 8;
        expect(() => validate(pack)).not.toThrow(); expect(pack.config.strengthTraining).not.toHaveProperty('strengthPerPoint');
        expect(pack.config.focus).not.toHaveProperty('floorCooldownRatio');
        expect(pack.config.itemGrowth.rules.find(rule => rule.itemId === 'potion_of_life')!.conversion).toBe(1);
    });
    it('permits removing every attribute when data references and disabled training are removed consistently', () => {
        const pack = fresh(); pack.config.attributes = []; pack.config.combatStats = null; pack.config.strengthTraining.enabled = false; pack.config.strengthTraining.attributeId = null;
        const clearSources = (effects: GrowthEffect[]): GrowthEffect[] => effects.filter(effect => !('magnitude' in effect) || effect.magnitude.source.kind !== 'attribute');
        for (const def of pack.definitions) {
            def.effects = clearSources(def.effects);
            if (def.kind === 'skill') def.prerequisites = def.prerequisites.filter(requirement => requirement.kind !== 'attribute');
            else { def.attributes = []; def.choices = []; def.recommendedAttributes = []; }
        }
        expect(() => validate(pack)).not.toThrow();
    });
    it('expresses all special identity/faith/active interactions using generic tags/results/receipts only', () => {
        const pack = fresh();
        expect(timed(pack, 'brace').duration).toEqual({ kind: 'objective-blocks', blocks: 2, cap: 3 });
        expect(timed(pack, 'brace').consume).toEqual({ event: 'positive-direct-physical', count: 1, phase: 'per-resolution-commit', includesShieldAbsorbed: true });
        expect(timed(pack, 'hold-breath').interruptions).toEqual(['attack','projectile','cast']);
        expect(timed(pack, 'hold-breath').duration).toEqual({ kind: 'objective-blocks', blocks: 3, cap: 4 });
        const pressure = skill(pack, 'pressure').effects[1] as GrowthTimedEffect;
        expect(pressure.recipient).toBe('target'); expect(pressure.conditions).toEqual([{ kind: 'hit', value: true }, { kind: 'positive-hp-damage', value: true }]);
        expect(pressure.consume.event).toBe('physical-probability-roll');
        const path = identity(pack, 'faith', 'path').oaths[0]!.effects[0]!;
        expect(path.kind).toBe('resource'); if (path.kind !== 'resource') throw new Error('Expected resource');
        expect(path.trigger).toEqual({ kind: 'first-visit', minDepth: 2, maxDepth: 26, receipt: 'depth' });
        path.amount = -2; expect(() => validate(pack)).not.toThrow();
        expect(identity(pack, 'lineage', 'reedfolk').effects[0]).toMatchObject({ kind: 'modifier', conditions: [{ kind: 'tag', tag: 'growth.tag.survey' }, { kind: 'search-mode', value: 'manual' }] });
    });
    it('validates tag existence and property applicability, plus declared tagged multiplier slots', () => {
        const pack = fresh(), stone = identity(pack, 'lineage', 'stoneborn').effects[0]!;
        if (stone.kind !== 'tagged-modifier') throw new Error('Expected tagged modifier');
        stone.tag = 'growth.tag.missing'; expect(() => validate(pack)).toThrow(/reference/);
        stone.tag = 'growth.tag.steady-hand'; expect(() => validate(pack)).toThrow(/reference/);
        stone.tag = 'growth.tag.brace'; stone.operation = 'multiply'; stone.slot = null; expect(() => validate(pack)).toThrow(/reference/);
        stone.slot = 'growth.slot.final'; expect(() => validate(pack)).not.toThrow();
        stone.slot = 'growth.slot.unknown'; expect(() => validate(pack)).toThrow(/reference/);
    });
    it('requires one shared physical additive budget and preserves native guarantee precedence in sample policies', () => {
        const rules = data.config.rules;
        expect(rules.ports.physicalDamage.budgetId).toBe(rules.ports.receivedPhysicalDamage.budgetId);
        expect(rules.order).toEqual(['add','multiply','global-clamp','round']);
        expect(rules.hitPrecedence).toEqual({ guaranteedHit: 'preserve', guaranteedMiss: 'preserve', guaranteedRoll: 'preserve-roll' });
        expect(rules.ports.physicalDamage.preserveZero).toBe(true);
        for (const port of ['searchStrength', 'strengthBonus', 'maxHpBonus'] as const) expect(rules.ports[port].preserveZero).toBe(false);
        expect(rules.ports.cooldownDuration.minimumBaseRatio).toBe(.75);
        const pack = fresh(); (pack.config.rules.order as string[]).reverse(); expect(() => validate(pack)).toThrow();
    });
    it('rejects templates that bypass earned-skill prerequisites even when their budget is large enough', () => {
        const pack = fresh(), template = pack.config.monsters.templates[0]!;
        pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 5 };
        template.skills = ['growth.skill.steady-hand']; expect(() => validate(pack)).toThrow(/prerequisite/);
        template.professionId = 'growth.profession.skirmisher'; expect(() => validate(pack)).not.toThrow();
    });
});

describe('EXT content fingerprint: exact local package binding', () => {
    it('detects a same-version numeric edit in the actual growth package', () => {
        const before = getGrowthPackIdentity(), changed = fresh(); changed.config.skills.activeSlots++;
        expect(before).toEqual({ schema: 1, version: GROWTH_VERSION, fingerprint: extensionDataFingerprint(data) });
        expect(before.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
        expect(extensionDataFingerprint(changed)).not.toBe(before.fingerprint);
    });
});


describe('EXT growth public loader diagnostics and production validation wiring', () => {
    it.each([false, true])('localizes actual parse/load/factory failures (Chinese initialized: %s)', async initialized => {
        const translation = i18next.createInstance();
        if (initialized) await translation.init({ lng: 'zh_CN', fallbackLng: 'zh_CN',
            resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
        expect(!!translation.isInitialized).toBe(initialized);
        // Use a real independent i18next instance, with real uninitialized fallback rather than stubbing t().
        vi.resetModules();
        vi.doMock('i18next', () => ({ default: translation }));
        try {
            const { default: productionData } = await import('../data/definitions.json');
            const { default: resourceCatalog } = await import('../locales/zh_CN.json');
            const loader = await import('../definitions');
            const factory = await import('..');
            const schema = await import('../schema');
            const invalid = structuredClone(productionData) as unknown as GrowthDefinitionPack;
            skill(invalid, 'steady-hand').prerequisites = [{ kind: 'skill', skillId: 'growth.skill.missing' }];
            const capture = (call: () => unknown): InstanceType<typeof schema.GrowthValidationError> => {
                try { call(); } catch (error) {
                    expect(error).toBeInstanceOf(schema.GrowthValidationError);
                    return error as InstanceType<typeof schema.GrowthValidationError>;
                }
                throw new Error('Expected a public loader failure');
            };
            const assertReadable = (error: InstanceType<typeof schema.GrowthValidationError>): void => {
                expect(error.message).toContain(error.path);
                expect(error.message).not.toContain('ext.growth.error.');
                if (initialized) expect(error.message).toMatch(/[\u4e00-\u9fff]/);
                else expect(error.message).toMatch(/growth/i);
            };
            const parseError = capture(() => loader.parseGrowthDefinitionPack(invalid, options));
            expect(parseError.code).toBe('reference');
            expect(parseError.key).toBe('ext.growth.error.reference');
            expect(parseError.detail).toBe('growth.skill.missing');
            expect(parseError.message).toContain(parseError.detail); assertReadable(parseError);
            const pureError = capture(() => schema.validateGrowthDefinitionPack(invalid, options));
            expect(pureError.message).toContain('ext.growth.error.reference');
            const oldCap = productionData.config.levels.cap;
            try {
                productionData.config.levels.cap = -1;
                const loadError = capture(() => loader.loadGrowthDefinitionPack(options));
                expect(loadError.path).toBe('$.config.levels.cap'); assertReadable(loadError);
            } finally { productionData.config.levels.cap = oldCap; }
            const mutations: { mutate: () => () => void; code: string; detail?: string }[] = [
                { mutate: () => { const old = productionData.config.itemGrowth.rules[0]!.itemId;
                    productionData.config.itemGrowth.rules[0]!.itemId = 'unknown_item';
                    return () => { productionData.config.itemGrowth.rules[0]!.itemId = old; }; }, code: 'reference', detail: 'unknown_item' },
                { mutate: () => { const old = productionData.config.experience.kills.monsterQuotes[0]!.monsterId;
                    productionData.config.experience.kills.monsterQuotes[0]!.monsterId = 'unknown_monster';
                    return () => { productionData.config.experience.kills.monsterQuotes[0]!.monsterId = old; }; }, code: 'reference' },
                { mutate: () => { const old = productionData.config.experience.identification.categories;
                    productionData.config.experience.identification.categories = ['unknown_category'];
                    return () => { productionData.config.experience.identification.categories = old; }; }, code: 'reference', detail: 'unknown_category' },
                { mutate: () => { const old = productionData.moduleVersion; productionData.moduleVersion = '999.0.0';
                    return () => { productionData.moduleVersion = old; }; }, code: 'version' },
                { mutate: () => { const old = productionData.rulesVersion; productionData.rulesVersion = '999.0.0';
                    return () => { productionData.rulesVersion = old; }; }, code: 'version' },
            ];
            for (const test of mutations) {
                const restore = test.mutate();
                try {
                    const error = capture(() => factory.createGrowthContractModule());
                    expect(error.code).toBe(test.code); assertReadable(error);
                    if (test.detail) { expect(error.detail).toBe(test.detail); expect(error.message).toContain(test.detail); }
                    expect(error.message).not.toContain('exact monster catalog');
                } finally { restore(); }
            }
            const mutablePack = productionData as unknown as GrowthDefinitionPack;
            const mutableText = resourceCatalog as Record<string, string>;
            const extraSkill = structuredClone(skill(mutablePack, 'steady-hand'));
            extraSkill.id = 'growth.skill.data-only'; extraSkill.tags = ['growth.tag.data-only'];
            extraSkill.nameKey = 'ext.growth.skill.data-only.name'; extraSkill.descriptionKey = 'ext.growth.skill.data-only.description';
            extraSkill.prerequisites = []; extraSkill.effects = [];
            const extraAttribute = structuredClone(mutablePack.config.attributes[0]!);
            extraAttribute.id = 'growth.attribute.data-only'; extraAttribute.nameKey = 'ext.growth.attribute.data-only.name';
            extraAttribute.descriptionKey = 'ext.growth.attribute.data-only.description'; extraAttribute.effects = [];
            const newKeys = [extraSkill.nameKey, extraSkill.descriptionKey, extraAttribute.nameKey, extraAttribute.descriptionKey];
            mutablePack.definitions.push(extraSkill); mutablePack.config.attributes.push(extraAttribute);
            try {
                const missing = capture(() => factory.createGrowthContractModule());
                expect(missing.code).toBe('text'); expect(newKeys).toContain(missing.detail); assertReadable(missing);
                for (const key of newKeys) mutableText[key] = '测试新增数据文本';
                // No text.ts registration change: production accepts new skill AND attribute from data/resources alone.
                expect(() => factory.createGrowthContractModule()).not.toThrow();
                delete mutableText[extraSkill.descriptionKey];
                const removed = capture(() => factory.createGrowthContractModule());
                expect(removed.code).toBe('text'); expect(removed.detail).toBe(extraSkill.descriptionKey);
                expect(removed.message).toContain(extraSkill.descriptionKey); assertReadable(removed);
                mutableText[extraSkill.descriptionKey] = '   ';
                expect(capture(() => factory.createGrowthContractModule()).code).toBe('text');
            } finally {
                mutablePack.definitions.pop(); mutablePack.config.attributes.pop();
                for (const key of newKeys) delete mutableText[key];
            }
            expect(() => factory.createGrowthContractModule()).not.toThrow();
            const providerError = new Error('provider failure');
            expect(() => loader.parseGrowthDefinitionPack(productionData, { ...options, hasText: () => { throw providerError; } })).toThrow(providerError);
        } finally {
            vi.doUnmock('i18next');
            vi.resetModules();
        }
    });
});
