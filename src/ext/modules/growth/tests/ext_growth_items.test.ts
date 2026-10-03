import { describe, expect, it } from 'vitest';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack } from '../types';
import { parseGrowthDefinitionPack } from '../definitions';
import { growthItemPointGrants, initialGrowthItemLedger, invalidGrowthItemSource, isGrowthItemLedger,
    resolveGrowthItemGain, type GrowthItemSource } from '../items';

const fresh = (): GrowthDefinitionPack => structuredClone(data) as unknown as GrowthDefinitionPack;
const sources: GrowthItemSource[] = [
    { itemId: 'potion_of_strength', nativeDestination: 'strengthBonus', nativeAmount: 1 },
    { itemId: 'potion_of_life', nativeDestination: 'maxHpBonus', nativeAmount: 10 },
    { itemId: 'scroll_of_enchantment', nativeDestination: 'enchantment', nativeAmount: 1 },
];

describe('EXT-1b permanent item conversion', () => {
    it('preserves +1 STR, +10 life and one native enchant magnitude at default conversion', () => {
        const config = fresh().config.itemGrowth;
        for (const source of sources) {
            const prior = initialGrowthItemLedger(), before = structuredClone(prior);
            expect(resolveGrowthItemGain(config, source.itemId, source.nativeDestination, source.nativeAmount, prior)).toEqual({
                destination: source.nativeDestination, amount: source.nativeAmount, nativeAmount: source.nativeAmount,
                items: { awarded: { [source.itemId]: source.nativeAmount } },
            });
            expect(prior).toEqual(before);
        }
    });

    it('scales native units in preserve, applies per-use/run caps, then floors once without fractional carry', () => {
        const config = fresh().config.itemGrowth, rule = config.rules[1]!;
        Object.assign(rule, { conversion: 0.375, perItemCap: 3.5, runCap: 7.75 });
        let ledger = initialGrowthItemLedger();
        const grants: number[] = [];
        for (let use = 0; use < 5; use++) {
            const result = resolveGrowthItemGain(config, rule.itemId, 'maxHpBonus', 10, ledger);
            ledger = result.items; grants.push(result.amount);
        }
        expect(grants).toEqual([3, 3, 1, 0, 0]);
        expect(ledger).toEqual({ awarded: { potion_of_life: 7 } });
    });

    it('replace grants conversion per use rather than multiplying the old life amount', () => {
        const config = fresh().config.itemGrowth, rule = config.rules[1]!;
        Object.assign(rule, { nativeEffect: 'replace', destination: 'attribute-points', conversion: 2.9, perItemCap: null, runCap: 5 });
        const result = resolveGrowthItemGain(config, rule.itemId, 'maxHpBonus', 10, initialGrowthItemLedger());
        expect(result).toEqual({ destination: 'attribute-points', amount: 2, nativeAmount: 0, items: { awarded: { potion_of_life: 2 } } });
        expect(growthItemPointGrants(config, result.items)).toEqual({ attributePoints: 2, skillPoints: 0 });
        Object.assign(config.rules[0]!, { nativeEffect: 'replace', destination: 'skill-points', conversion: 3 });
        const other = resolveGrowthItemGain(config, 'potion_of_strength', 'strengthBonus', 1, result.items);
        expect(growthItemPointGrants(config, other.items)).toEqual({ attributePoints: 2, skillPoints: 3 });
    });

    it('handles native-stat replacement and enchant replacement without adding a hidden original +1', () => {
        const config = fresh().config.itemGrowth;
        Object.assign(config.rules[0]!, { nativeEffect: 'replace', destination: 'maxHpBonus', conversion: 4 });
        expect(resolveGrowthItemGain(config, 'potion_of_strength', 'strengthBonus', 1, initialGrowthItemLedger()))
            .toMatchObject({ destination: 'maxHpBonus', amount: 4, nativeAmount: 0 });
        Object.assign(config.rules[2]!, { nativeEffect: 'replace', conversion: 3 });
        expect(resolveGrowthItemGain(config, 'scroll_of_enchantment', 'enchantment', 1, initialGrowthItemLedger()))
            .toMatchObject({ destination: 'enchantment', amount: 3, nativeAmount: 3 });
    });

    it('zero caps and no matching rule do not produce phantom ledger receipts', () => {
        const config = fresh().config.itemGrowth;
        config.rules[2]!.perItemCap = 0;
        expect(resolveGrowthItemGain(config, 'scroll_of_enchantment', 'enchantment', 1, initialGrowthItemLedger()))
            .toMatchObject({ amount: 0, nativeAmount: 0, items: { awarded: {} } });
        expect(resolveGrowthItemGain(config, 'Other.Mod.Potion', 'maxHpBonus', 10, initialGrowthItemLedger()))
            .toMatchObject({ amount: 10, nativeAmount: 10, items: { awarded: {} } });
    });

    it('keeps unrelated rules and independent actor run limits separate', () => {
        const config = fresh().config.itemGrowth;
        config.rules.forEach(rule => { rule.runCap = 1; });
        const first = resolveGrowthItemGain(config, 'potion_of_strength', 'strengthBonus', 1, initialGrowthItemLedger());
        expect(resolveGrowthItemGain(config, 'potion_of_strength', 'strengthBonus', 1, first.items).amount).toBe(0);
        expect(resolveGrowthItemGain(config, 'scroll_of_enchantment', 'enchantment', 1, first.items).amount).toBe(1);
        expect(resolveGrowthItemGain(config, 'potion_of_strength', 'strengthBonus', 1, initialGrowthItemLedger()).amount).toBe(1);
    });

    it('validates exact, data-only ledger shape, safe positive totals and caps', () => {
        const config = fresh().config.itemGrowth; config.rules[0]!.runCap = 2;
        expect(isGrowthItemLedger({ awarded: { potion_of_strength: 2 } }, config)).toBe(true);
        for (const bad of [null, [], {}, { awarded: {}, extra: 1 }, { awarded: { absent: 1 } },
            { awarded: { potion_of_strength: 0 } }, { awarded: { potion_of_strength: -1 } },
            { awarded: { potion_of_strength: 0.5 } }, { awarded: { potion_of_strength: 3 } },
            { awarded: { potion_of_strength: Infinity } }, { awarded: Object.create({ potion_of_strength: 1 }) },
            { awarded: { get potion_of_strength() { throw new Error('Accessor must not be called'); } } }]) {
            expect(isGrowthItemLedger(bad, config)).toBe(false);
        }
    });

    it('uses catalog capabilities rather than sample-ID dispatch and rejects impossible destinations before play', () => {
        const pack = fresh();
        pack.config.itemGrowth.rules[0]!.itemId = 'Different.Native.Power';
        const renamed = [{ ...sources[0]!, itemId: 'Different.Native.Power' }, ...sources.slice(1)];
        expect(invalidGrowthItemSource(pack.config.itemGrowth, renamed)).toBeNull();
        const options = { moduleVersion: pack.moduleVersion, hasText: () => true, itemGrowthSources: renamed };
        expect(() => parseGrowthDefinitionPack(pack, options)).not.toThrow();
        Object.assign(pack.config.itemGrowth.rules[0]!, { nativeEffect: 'replace', destination: 'enchantment' });
        expect(() => parseGrowthDefinitionPack(pack, options)).toThrow();
        Object.assign(pack.config.itemGrowth.rules[0]!, { nativeEffect: 'preserve', destination: 'maxHpBonus' });
        expect(() => parseGrowthDefinitionPack(pack, options)).toThrow();
        pack.config.itemGrowth.rules[0]!.itemId = 'missing_effect';
        expect(() => parseGrowthDefinitionPack(pack, options)).toThrow();
    });

    it('rejects unsafe uncapped multiplication but allows an explicitly bounded large conversion', () => {
        const config = fresh().config.itemGrowth; config.rules[1]!.conversion = Number.MAX_SAFE_INTEGER;
        expect(() => resolveGrowthItemGain(config, 'potion_of_life', 'maxHpBonus', 10, initialGrowthItemLedger())).toThrow();
        config.rules[1]!.perItemCap = 2;
        expect(resolveGrowthItemGain(config, 'potion_of_life', 'maxHpBonus', 10, initialGrowthItemLedger()).amount).toBe(2);
        config.rules[1]!.perItemCap = Number.MAX_SAFE_INTEGER;
        expect(invalidGrowthItemSource(config, sources)).toBe(1);
    });

    it('rejects receipts for rules that cannot possibly grant one integer unit', () => {
        const config = fresh().config.itemGrowth;
        config.rules[0]!.perItemCap = 0;
        expect(isGrowthItemLedger({ awarded: { potion_of_strength: 1 } }, config)).toBe(false);
        Object.assign(config.rules[1]!, { nativeEffect: 'replace', destination: 'skill-points', conversion: 0.5 });
        expect(isGrowthItemLedger({ awarded: { potion_of_life: 1 } }, config)).toBe(false);
    });
});
