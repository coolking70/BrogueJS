import { describe, expect, it } from 'vitest';
import { buildEffectiveLootCatalog } from '../catalog';
import { loadLootPack } from '../definitions';
import type { ItemClass, LootAvailability } from '../types';

const combat = { stats: ['combat.stamina-capacity', 'combat.poise-capacity', 'combat.stamina-regen', 'combat.poise-recovery'] };
const growth = { stats: ['growth.focus-capacity', 'growth.attribute', 'growth.xp-gain'], attributes: ['strength', 'dexterity', 'wisdom'] };
const noModules: LootAvailability = { combat: null, growth: null, giants: null };

describe('effective loot catalog', () => {
    it.each([false, true].flatMap(c => [false, true].map(g => [c, g])))('resolves combat=%s growth=%s independently', (c, g) => {
        const pack = loadLootPack();
        const catalog = buildEffectiveLootCatalog(pack, { combat: c ? combat : null, growth: g ? growth : null, giants: null });
        const ids = catalog.affixes.map(affix => affix.id);
        // Every surviving native weight is independently reconstructed; replacement is class-specific.
        const replacements: Record<string, Partial<Record<ItemClass, number>>> = {
            'loot.affix.vital': { armor: c ? 0 : 600 },
            'loot.affix.mending': { ring: (c ? 0 : 400) + (g ? 0 : 400) },
            'loot.affix.titan': { weapon: g ? 0 : 600, armor: g ? 0 : 600, ring: g ? 0 : 600 },
            'loot.affix.warding': { armor: c ? 0 : 300 },
        };
        for (const affix of pack.affixes.affixes) {
            if (affix.rune !== null) { expect(ids).not.toContain(affix.id); continue; }
            const available = affix.requires === null || (affix.requires.module === 'combat' ? c : g);
            if (!available || affix.expand !== null) { expect(ids).not.toContain(affix.id); continue; }
            expect(ids).toContain(affix.id);
            for (const itemClass of ['weapon', 'armor', 'ring'] as const) {
                expect(catalog.effectiveWeight[affix.id]![itemClass]).toBe(affix.itemClasses.includes(itemClass)
                    ? affix.weight + (replacements[affix.id]?.[itemClass] ?? 0) : undefined);
            }
        }
        const adept = catalog.affixes.filter(affix => affix.id.startsWith('loot.affix.adept.'));
        expect(adept.map(affix => affix.id)).toEqual(g ? ['dexterity', 'strength', 'wisdom'].map(id => `loot.affix.adept.${id}`) : []);
        for (const affix of adept) {
            expect(affix.weight).toBe(200);
            expect(affix.group).toBe('attribute');
            expect(affix.nameKey).toBe('ext.loot.affix.adept');
            expect(affix.modifiers[0]!.stat).toBe(`growth.attribute:${affix.id.split('.').slice(-1)[0]}`);
            expect(catalog.effectiveWeight[affix.id]).toEqual({ weapon: 200, armor: 200, ring: 200 });
        }
        expect(Object.isFrozen(catalog)).toBe(true);
        expect(Object.isFrozen(catalog.affixes)).toBe(true);
        expect(catalog.bossUniqueBias).toEqual([]);
    });
    it('keeps the V1/V2 fallback weights at target positions', () => {
        const catalog = buildEffectiveLootCatalog(loadLootPack(), noModules);
        expect(catalog.effectiveWeight['loot.affix.titan']).toEqual({ weapon: 1200, armor: 1200, ring: 1200 });
        expect(catalog.effectiveWeight['loot.affix.mending']).toEqual({ armor: 500, ring: 1300 });
        expect(catalog.effectiveWeight['loot.affix.vital']).toEqual({ armor: 1800, ring: 1200 });
        expect(catalog.effectiveWeight['loot.affix.warding']).toEqual({ armor: 1000, ring: 700 });
        expect(catalog.affixes.find(affix => affix.id === 'loot.affix.vital')!.position).toBe('suffix');
    });
    it('requires the actual declared stats, not only module presence', () => {
        const empty = buildEffectiveLootCatalog(loadLootPack(), { combat: { stats: [] }, growth: { stats: [], attributes: ['strength'] }, giants: null });
        expect(empty.effectiveWeight).toEqual(buildEffectiveLootCatalog(loadLootPack(), noModules).effectiveWeight);
    });
    it.each([[], ['bad_attribute'], ['strength', 'Bad'], ['a..b']].map(attributes => ({ attributes })))('uses adept fallback for unavailable attribute expansion $attributes', ({ attributes }) => {
        const catalog = buildEffectiveLootCatalog(loadLootPack(), { ...noModules, growth: { ...growth, attributes } });
        expect(catalog.effectiveWeight['loot.affix.titan']!.weapon).toBe(1200);
        expect(catalog.affixes.some(affix => affix.id.startsWith('loot.affix.adept.'))).toBe(false);
    });
    it('normalizes availability without mutating it and fingerprints mechanical capability facts', () => {
        const pack = loadLootPack();
        const availability = { combat: { stats: ['z', 'a', 'z'] }, growth: { stats: ['growth.attribute', 'growth.attribute'], attributes: ['wisdom', 'strength', 'wisdom'] }, giants: { formIds: ['unknown', 'giants.abyssal-colossus'] } };
        const before = structuredClone(availability);
        const catalog = buildEffectiveLootCatalog(pack, availability);
        expect(availability).toEqual(before);
        expect(catalog.availability.growth!.attributes).toEqual(['strength', 'wisdom']);
        expect(catalog.bossUniqueBias).toEqual([{ formId: 'giants.abyssal-colossus', uniqueId: 'loot.unique.colossus-maul', multiplierBp: 50000 }]);
        expect(catalog.fingerprint).toBe(buildEffectiveLootCatalog(pack, { combat: { stats: ['a', 'z'] }, growth: { stats: ['growth.attribute'], attributes: ['strength', 'wisdom'] }, giants: { formIds: ['giants.abyssal-colossus', 'unknown'] } }).fingerprint);
        expect(catalog.fingerprint).not.toBe(buildEffectiveLootCatalog(pack, noModules).fingerprint);
        expect(Object.isFrozen(catalog.availability.growth!.attributes)).toBe(true);
        expect(Object.isFrozen(catalog.affixes[0]!.tiers[0]!.ranges)).toBe(true);
    });
    it('uses floor(600/n), minimum one, for each adept variant', () => {
        for (const n of [7, 601]) {
            const attributes = Array.from({ length: n }, (_, i) => `attribute-${i}`);
            const catalog = buildEffectiveLootCatalog(loadLootPack(), { ...noModules, growth: { stats: ['growth.attribute'], attributes } });
            const variants = catalog.affixes.filter(affix => affix.id.startsWith('loot.affix.adept.'));
            expect(variants).toHaveLength(n);
            expect(variants.every(affix => affix.weight === Math.max(1, Math.floor(600 / n)))).toBe(true);
        }
    });
});
