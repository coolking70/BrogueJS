import { describe, expect, it } from 'vitest';
import { buildEffectiveLootCatalog, freezeLootValue } from '../catalog';
import { loadLootPack } from '../definitions';
import { LootContractError } from '../errors';
import { rollLoot, rollLootWithTrace } from '../generator';
import { validateLootItemData } from '../item';
import { CountedLootRandom, weightedPick } from '../random';
import { computeStaticDrawBudget } from '../schema';
import { computeRarityWeights } from '../rarity';
import type { LootAvailability, LootRollRequest } from '../types';

function seeded(seed: number) {
    let state = seed >>> 0;
    let calls = 0;
    return { randomInt(lo: number, hi: number) {
        calls++;
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return lo + Math.floor(state / 0x100000000 * (hi - lo + 1));
    }, get calls() { return calls; } };
}
const none: LootAvailability = { combat: null, growth: null, giants: null };
const complete: LootAvailability = { combat: { stats: ['combat.stamina-capacity', 'combat.stamina-regen', 'combat.poise-capacity', 'combat.poise-recovery'] },
    growth: { stats: ['growth.attribute', 'growth.focus-capacity', 'growth.xp-gain'], attributes: ['strength', 'dexterity', 'wisdom'] },
    giants: { formIds: ['giants.abyssal-colossus'] } };
const floor: LootRollRequest = { v: 1, source: 'floor', depth: 1, presetId: 'standard', rarityFindBp: 0, claimedUniqueIds: [], itemClass: 'weapon' };

function assertFrozen(value: unknown): void {
    if (value !== null && typeof value === 'object') {
        expect(Object.isFrozen(value)).toBe(true);
        for (const child of Object.values(value)) assertFrozen(child);
    }
}

describe('loot generator properties', () => {
    it.each(['scarce', 'standard', 'bountiful'].flatMap(presetId => ['floor', 'kill', 'vault', 'encounter'].map(source => ({ presetId, source }))))
   ('$presetId / $source: 2000 deterministic seeds, full structural and range invariants', ({ presetId, source }) => {
        const pack = loadLootPack();
        const catalogs = [buildEffectiveLootCatalog(pack, none), buildEffectiveLootCatalog(pack, complete)];
        const budget = computeStaticDrawBudget(pack);
        let maxItem = 0;
        let maxEvent = 0;
        for (let seed = 1; seed <= 2000; seed++) {
            const common = { v: 1 as const, depth: 1 + seed % 99, presetId, rarityFindBp: seed % 5 === 0 ? Number.MAX_SAFE_INTEGER : seed * 17,
                claimedUniqueIds: seed % 7 === 0 ? [pack.uniques.uniques[seed % pack.uniques.uniques.length]!.id] : [] };
            const request: LootRollRequest = source === 'floor' ? { ...common, source, itemClass: (['weapon', 'armor', 'ring'] as const)[seed % 3]! }
                : source === 'vault' ? { ...common, source, itemClass: 'weapon', baseId: seed % 2 ? 'war_hammer' : null, highValue: seed % 3 === 0 }
                    : source === 'kill' ? { ...common, source, monster: { typeId: ['ogre', 'rat', 'goblin', 'pink_jelly', 'future-monster'][seed % 5]!, leader: seed % 2 === 0, champion: seed % 3 === 0, encounterSubject: false } }
                        : { ...common, source: 'encounter', formId: seed % 2 ? 'giants.abyssal-colossus' : null };
            freezeLootValue(request);
            const before = JSON.stringify(request);
            const catalog = catalogs[seed % 2]!;
            const random = seeded(seed);
            const { result, trace } = rollLootWithTrace(catalog, request, random);
            expect(result).toEqual(rollLoot(catalog, request, seeded(seed)));
            expect(JSON.stringify(request)).toBe(before);
            expect(result.draws).toBe(random.calls);
            expect(result.draws).toBeLessThanOrEqual(budget.perEvent);
            expect(result.draws).toBeLessThanOrEqual(512);
            expect(result.items.length).toBeLessThanOrEqual(8);
            expect(trace.itemDraws).toHaveLength(result.items.length);
            expect(trace.uniqueOpportunities).toBeGreaterThanOrEqual(result.newUniqueIds.length);
            expect(new Set(result.newUniqueIds).size).toBe(result.newUniqueIds.length);
            expect(result.newUniqueIds.every(id => !request.claimedUniqueIds.includes(id))).toBe(true);
            expect(structuredClone(result)).toEqual(result);
            assertFrozen(result);
            maxEvent = Math.max(maxEvent, result.draws);
            for (const drawCount of trace.itemDraws) {
                maxItem = Math.max(maxItem, drawCount);
                expect(drawCount).toBeLessThanOrEqual(budget.perItem);
                expect(drawCount).toBeLessThanOrEqual(64);
            }
            for (const { data } of result.items) {
                expect(validateLootItemData(data, catalog)).toBe(true);
                expect(data.enhancement).toBe(0);
                expect(data.affixes.every(affix => affix.known === false)).toBe(true);
                if (data.rarity === 'normal' || data.rarity === 'unique') continue;
                const definitions = data.affixes.map(roll => catalog.affixes.find(affix => affix.id === roll.id)!);
                expect(new Set(definitions.map(affix => affix.group)).size).toBe(definitions.length);
                expect(definitions.filter(affix => affix.polarity === -1)).toHaveLength(data.corrupted ? 1 : 0);
                const limits = pack.rarities.rarities.find(rarity => rarity.id === data.rarity)!.affixes!;
                for (const position of ['prefix', 'suffix'] as const) expect(definitions.filter(affix => affix.polarity === 1 && affix.position === position).length)
                    .toBeLessThanOrEqual(position === 'prefix' ? limits.prefixMax : limits.suffixMax);
                let aboveUnlocked = 0;
                data.affixes.forEach((roll, index) => {
                    const affix = definitions[index]!;
                    const unlocked = pack.tiers.tiers.filter(tier => tier.enabled && tier.minIlvl <= data.ilvl && tier.tier <= affix.maxTier).map(tier => tier.tier);
                    const window = unlocked.slice(-3);
                    const maxUnlocked = unlocked[unlocked.length - 1]!;
                    if (roll.tier > maxUnlocked) aboveUnlocked++;
                    expect(roll.tier).toBeGreaterThanOrEqual(window[0]!);
                    expect(roll.tier).toBeLessThanOrEqual(Math.min(affix.maxTier, maxUnlocked + (data.corrupted && affix.polarity === 1 ? 1 : 0)));
                    const ranges = affix.tiers.find(tier => tier.tier === roll.tier)!.ranges;
                    expect(roll.values).toHaveLength(ranges.length);
                    roll.values.forEach((value, i) => { expect(value).toBeGreaterThanOrEqual(ranges[i]![0]); expect(value).toBeLessThanOrEqual(ranges[i]![1]); });
                });
                expect(aboveUnlocked).toBeLessThanOrEqual(data.corrupted ? 1 : 0);
            }
        }
        console.info(`loot properties ${presetId}/${source}: seeds=2000 maxItem=${maxItem} maxEvent=${maxEvent}`);
    }, 120000);
    it('never draws for zero/one candidates, constant intervals, or certain/impossible chances', () => {
        const source = { randomInt: () => { throw new Error('Must not draw'); } };
        const random = new CountedLootRandom(source);
        expect(weightedPick([], () => 1, random)).toBeUndefined();
        expect(weightedPick(['a', 'b'], value => value === 'a' ? 0 : 10, random)).toBe('b');
        expect(random.randomInt(-2, -2)).toBe(-2);
        expect(random.chance(-1)).toBe(false);
        expect(random.chance(0)).toBe(false);
        expect(random.chance(10000)).toBe(true);
        expect(random.chance(10001)).toBe(true);
        expect(random.draws).toBe(0);
        const pack = structuredClone(loadLootPack());
        pack.bases.rings.forEach((base, index) => { base.weight = index === 0 ? 1 : 0; });
        const preset = pack.presets.presets.find(preset => preset.id === 'standard')!;
        preset.rarityWeights = { normal: 1, magic: 0, rare: 0, unique: 0, set: 0 };
        preset.encounter.firstMinRarity = preset.encounter.restMinRarity = preset.vault.minRarity = preset.vault.highValueMinRarity = 'normal';
        const result = rollLoot(buildEffectiveLootCatalog(loadLootPack(pack), none), { ...floor, itemClass: 'ring' }, source);
        expect(result.draws).toBe(0);
        expect(result.items[0]!.native.identified).toBe(true);
    });
    it.each([0, 101, 1.5, NaN, Infinity])('rejects callback result %s', returned => {
        const catalog = buildEffectiveLootCatalog(loadLootPack(), none);
        expect(() => rollLoot(catalog, floor, { randomInt: () => returned })).toThrowError(expect.objectContaining({ code: 'RANDOM_OUT_OF_RANGE' }));
    });
    it('enforces both runtime draw budgets before making an excess call', () => {
        const source = seeded(1);
        const event = new CountedLootRandom(source);
        for (let i = 0; i < 512; i++) event.randomInt(0, 1);
        expect(() => event.randomInt(0, 1)).toThrowError(expect.objectContaining({ code: 'DRAW_BUDGET' }));
        expect(source.calls).toBe(512);
        const item = new CountedLootRandom(seeded(1));
        item.beginItem();
        for (let i = 0; i < 64; i++) item.randomInt(0, 1);
        expect(() => item.randomInt(0, 1)).toThrowError(expect.objectContaining({ code: 'DRAW_BUDGET' }));
    });
    it('calculates floored rarity weights and clamps excessive rarity find', () => {
        const preset = loadLootPack().presets.presets.find(preset => preset.id === 'standard')!;
        expect(computeRarityWeights(preset, 16, 5000, 10000, 0, null)).toEqual({ normal: 700, magic: 408, rare: 147, unique: 21, set: 0 });
        expect(computeRarityWeights(preset, 39, 5000, 30000, Number.MAX_SAFE_INTEGER, 'rare')).toEqual(computeRarityWeights(preset, 39, 5000, 30000, preset.rarityFind.cap, 'rare'));
    });
    const hiddenExtra = Object.defineProperty({ ...floor }, 'hidden', { value: true });
    const symbolExtra = { ...floor, [Symbol('unknown')]: true };
    const getterField = Object.defineProperty({ ...floor }, 'depth', { enumerable: true, get: () => { throw new Error('Getter must never run'); } });
    const cyclic: Record<string, unknown> = { ...floor }; cyclic.self = cyclic;
    const invalidRequests = [
        hiddenExtra, symbolExtra, getterField, cyclic,
        { ...floor, v: 2 }, { ...floor, extra: 1 }, { ...floor, depth: 0 }, { ...floor, depth: 100 }, { ...floor, depth: 1.5 },
        { ...floor, depth: NaN }, { ...floor, rarityFindBp: -1 }, { ...floor, rarityFindBp: Number.MAX_SAFE_INTEGER + 1 },
        { ...floor, rarityFindBp: 0.5 }, { ...floor, source: 'part' }, { ...floor, presetId: 'missing' }, { ...floor, itemClass: 'staff' },
        { ...floor, claimedUniqueIds: ['missing'] }, { ...floor, claimedUniqueIds: ['loot.unique.whisper', 'loot.unique.whisper'] },
        { ...floor, claimedUniqueIds: null }, { ...floor, claimedUniqueIds: [4] }, { ...floor, claimedUniqueIds: Array(1) },
        { ...floor, source: 'vault', baseId: 'missing', highValue: false },
        { ...floor, source: 'vault', baseId: 'ring_of_light', highValue: false },
        { ...floor, source: 'vault', baseId: null, highValue: 1 },
        { ...floor, source: 'kill', itemClass: undefined, monster: { typeId: 'ogre', leader: false, champion: false, encounterSubject: false } },
        { v: 1, depth: 1, presetId: 'standard', rarityFindBp: 0, claimedUniqueIds: [], source: 'kill', monster: { typeId: 'ogre', leader: false, champion: false } },
        { v: 1, depth: 1, presetId: 'standard', rarityFindBp: 0, claimedUniqueIds: [], source: 'kill', monster: { typeId: '', leader: false, champion: false, encounterSubject: true } },
        { v: 1, depth: 1, presetId: 'standard', rarityFindBp: 0, claimedUniqueIds: [], source: 'kill', monster: { typeId: 'rat', leader: 1, champion: false, encounterSubject: true } },
        { v: 1, depth: 1, presetId: 'standard', rarityFindBp: 0, claimedUniqueIds: [], source: 'encounter', formId: 7 },
        { v: 1, depth: 1, presetId: 'standard', rarityFindBp: 0, claimedUniqueIds: [], source: 'encounter' },
        null, [], Object.create({ ...floor }),
    ];
    it.each(invalidRequests.map((request, index) => ({ request, index })))('invalid request $index rejects before any RNG', ({ request }) => {
        const random = seeded(1);
        try { rollLoot(buildEffectiveLootCatalog(loadLootPack(), none), request as LootRollRequest, random); expect.fail('Accepted invalid request'); }
        catch (error) {
            expect(error).toBeInstanceOf(LootContractError);
            const candidate = request as Record<string, unknown> | null;
            const expectedCode = candidate?.presetId === 'missing' ? 'UNKNOWN_PRESET'
                : candidate?.source === 'vault' && (candidate.baseId === 'missing' || candidate.baseId === 'ring_of_light') ? 'UNKNOWN_BASE' : 'INVALID_REQUEST';
            expect((error as LootContractError).code).toBe(expectedCode);
            expect((error as LootContractError).path.length).toBeGreaterThan(0);
        }
        expect(random.calls).toBe(0);
    });
});
