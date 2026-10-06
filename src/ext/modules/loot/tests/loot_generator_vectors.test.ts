import { describe, expect, it } from 'vitest';
import { buildEffectiveLootCatalog } from '../catalog';
import { loadLootPack } from '../definitions';
import { rollLoot, rollLootWithTrace } from '../generator';
import type { EffectiveLootCatalog, LootAvailability, LootPack, LootRollRequest } from '../types';

type Draw = [number, number, number];
const unavailable: LootAvailability = { combat: null, growth: null, giants: null };
const common = { v: 1 as const, depth: 1, presetId: 'standard', rarityFindBp: 0, claimedUniqueIds: [] };
const catalog = (availability = unavailable) => buildEffectiveLootCatalog(loadLootPack(), availability);
const changed = (edit: (pack: LootPack) => void, availability = unavailable) => {
    const pack = structuredClone(loadLootPack()); edit(pack); return buildEffectiveLootCatalog(loadLootPack(pack), availability);
};
function tapeRoll(request: LootRollRequest, tape: Draw[], effective = catalog()) {
    let next = 0;
    const traced = rollLootWithTrace(effective, request, { randomInt(lo, hi) {
        const row = tape[next++];
        expect(row, `unexpected draw ${next}: [${lo},${hi}]`).toBeDefined();
        expect([lo, hi], `draw ${next}`).toEqual(row!.slice(0, 2));
        return row![2];
    } });
    expect(next, 'every literal tape row must be consumed').toBe(tape.length);
    expect(traced.result.draws).toBe(tape.length);
    return traced;
}
const kill = (depth = 1, presetId = 'standard', typeId = 'ogre'): LootRollRequest => ({ ...common, source: 'kill', depth, presetId,
    monster: { typeId, leader: false, champion: false, encounterSubject: false } });
const affix = (name: string, tier: number, values: number[]) => ({ id: `loot.affix.${name}`, tier, values, known: false });

describe('literal deterministic loot tapes', () => {
    it('V1: D10 standard elite weapon, three affixes, 23 exact draws', () => {
        const { result } = tapeRoll(kill(10), [
            [1, 10000, 1874], [1, 2, 1], [1, 100, 17], [1, 100, 97], [1, 1276, 1200], [1, 100, 30],
            [0, 1, 0], [1, 3100, 500], [1, 100, 90], [4100, 6000, 5200],
            [0, 1, 1], [1, 3500, 450], [1, 100, 50], [1300, 1800, 1500],
            [0, 1, 0], [1, 2100, 300], [1, 100, 60], [1, 2, 2], [3, 5, 4],
            [1, 10000, 9000], [0, 31, 5], [0, 31, 17], [1, 10000, 7000],
        ]);
        expect(result).toEqual({ v: 1, converted: true, items: [{ data: {
            v: 1, baseId: 'war_axe', ilvl: 16, rarity: 'rare', uniqueId: null, setId: null,
            affixes: [affix('keen', 3, [5200]), affix('precise', 2, [1500]), affix('brutal', 2, [2, 4])],
            corrupted: false, enhancement: 0, sockets: 0, socketed: [], nameParts: [5, 17], origin: { source: 'kill', depth: 10 },
        }, native: { kind: 'war_axe', category: 'weapon', enchantment: 0, runicType: null, runicStrength: null, isCursed: false, identified: false } }],
        gold: 0, newUniqueIds: [], draws: 23 });
    });
    it('V2: D1 floor ring uses merged suffix weights, seven exact draws', () => {
        const { result } = tapeRoll({ ...common, source: 'floor', itemClass: 'ring' }, [
            [1, 80, 25], [1, 1004, 800], [1, 100, 20], [0, 1, 1], [1, 7750, 2000], [5, 9, 7], [1, 10000, 10000],
        ]);
        expect(result.items[0]!.data).toEqual({ v: 1, baseId: 'ring_of_regeneration', ilvl: 1, rarity: 'magic', uniqueId: null, setId: null,
            affixes: [affix('vital', 1, [7])], corrupted: false, enhancement: 0, sockets: 0, socketed: [], nameParts: null, origin: { source: 'floor', depth: 1 } });
        expect(result.items[0]!.native.enchantment).toBe(1);
        expect(result.converted).toBe(true); expect(result.gold).toBe(0);
    });
    it('V3: elite two items; G follows both completed items', () => {
        // D1 elite ilvl2: [700, floor(226*1.5)=339, floor(73*1.5)=109,15] =>1163; base band1 total84.
        const { result, trace } = tapeRoll(kill(), [[1, 10000, 3000], [1, 2, 2],
            [1, 100, 1], [1, 84, 1], [1, 1163, 1], [1, 100, 1], [1, 84, 84], [1, 1163, 700], [1, 10000, 4001]]);
        expect(result.items.map(item => item.data.baseId)).toEqual(['dagger', 'war_axe']);
        expect(trace.itemDraws).toEqual([3, 3]);
    });
    it('V4: leader/champion add drop chance, ilvl and rarity, but not gold chance', () => {
        // K1=3000+500+1000=4500; ilvl15+1+2=18; [700,279*2,101*2,14*2] =>1488.
        const request = kill(10) as Extract<LootRollRequest, { source: 'kill' }>;
        request.monster.leader = request.monster.champion = true;
        const { result } = tapeRoll(request, [[1, 10000, 4500], [1, 2, 1], [1, 100, 1], [1, 100, 1], [1, 1488, 700], [1, 10000, 4001]]);
        expect(result.items[0]!.data.ilvl).toBe(18); expect(result.gold).toBe(0);
    });
    it('V5: bountiful elite permits exactly three items', () => {
        // D1 ilvl2: [480, floor(339*1.5)=508, floor(169*1.5)=253, floor(31*1.5)=46] =>1287.
        const { result } = tapeRoll(kill(1, 'bountiful'), [[1, 10000, 6000], [1, 3, 3],
            [1, 100, 1], [1, 84, 1], [1, 1287, 1], [1, 100, 1], [1, 84, 1], [1, 1287, 1],
            [1, 100, 1], [1, 84, 1], [1, 1287, 1], [1, 10000, 10000]]);
        expect(result.items).toHaveLength(3);
    });
    it('V6: scarce elite clamps count to one without a count draw', () => {
        // K1=floor(3000*.6)=1800; ilvl2 rarity [850,183,40,4] =>1077.
        const { result } = tapeRoll(kill(1, 'scarce'), [[1, 10000, 1800], [1, 100, 1], [1, 84, 1], [1, 1077, 850], [1, 10000, 10000]]);
        expect(result.items).toHaveLength(1);
    });
    for (const giants of [null, { formIds: ['giants.abyssal-colossus'] }]) {
        it(`V${giants ? 7 : 8}: encounter truncation, unique x3, boss bias ${giants ? 'retained' : 'ignored'}, singleton unique draws nothing`, () => {
            // D20 encounter ilvl35: magic335/rare131/unique18*3=54. First rare minimum total185; rest magic total520.
            // Band3 weapon total102, war_hammer interval79..90. Each native base has a single unique, so bias cannot change selection.
            const effective = catalog({ ...unavailable, giants });
            const { result, trace } = tapeRoll({ ...common, source: 'encounter', depth: 20, formId: 'giants.abyssal-colossus' }, [
                [1, 100, 1], [1, 102, 90], [1, 185, 185], [10000, 13000, 12345],
                [1, 100, 1], [1, 102, 1], [1, 520, 520], [2000, 3000, 2500], [65, 135, 100],
            ], effective);
            expect(result.newUniqueIds).toEqual(['loot.unique.colossus-maul', 'loot.unique.whisper']);
            expect(trace.uniqueOpportunities).toBe(2);
            expect(result.gold).toBe(1000);
            expect(effective.bossUniqueBias).toHaveLength(giants ? 1 : 0);
        });
    }
    it('V9: no eligible unique downgrades once to rare without rerolling rarity', () => {
        // D1 dagger cannot produce minIlvl5 whisper. Rarity unique interval995..1004; then ordinary 3-affix rare sequence.
        const { result, trace } = tapeRoll({ ...common, source: 'floor', itemClass: 'weapon' }, [
            [1, 84, 1], [1, 1004, 1004], [1, 100, 1], [0, 1, 0], [1, 3100, 1], [1500, 2500, 1500],
            [0, 1, 0], [1, 2100, 1001], [0, 1, 0], [1, 1500, 1500], [2000, 3000, 2000],
            [1, 10000, 10000], [0, 31, 0], [0, 31, 0],
        ]);
        expect(result.items[0]!.data.rarity).toBe('rare'); expect(trace.uniqueOpportunities).toBe(1);
        expect(result.newUniqueIds).toEqual([]);
    });
    it('V10: claimed unique is excluded and two-tier weights align [40,25]', () => {
        // Vault D2 => ilvl6; magic239/rare80/unique11 =>330. Fixed dagger skips base. Three T1 draws each use total65.
        const { result } = tapeRoll({ ...common, source: 'vault', depth: 2, itemClass: 'weapon', baseId: 'dagger', highValue: false,
            claimedUniqueIds: ['loot.unique.whisper'] }, [
            [1, 330, 330], [1, 100, 1], [0, 1, 0], [1, 3100, 1], [1, 65, 40], [1500, 2500, 1500],
            [0, 1, 0], [1, 2100, 1001], [1, 65, 40], [0, 1, 0], [1, 1500, 1500], [1, 65, 40], [2000, 3000, 2000],
            [1, 10000, 10000], [0, 31, 0], [0, 31, 0],
        ]);
        expect(result.items[0]!.data.rarity).toBe('rare'); expect(result.newUniqueIds).toEqual([]);
    });
    it('V11: fixed vault base and unique rows only draw the nonconstant range', () => {
        // Vault D2 ilvl6 min magic =>239+80+11=330. Whisper has only accuracy [2000,3000] nonconstant.
        const { result } = tapeRoll({ ...common, source: 'vault', depth: 2, itemClass: 'weapon', baseId: 'dagger', highValue: false },
            [[1, 330, 330], [2000, 3000, 2456]]);
        expect(result.items[0]!.data.affixes.map(row => [row.id, row.tier, row.values])).toEqual([
            ['loot.unique.whisper.r0', 0, [3]], ['loot.unique.whisper.r1', 0, [2456]], ['loot.unique.whisper.r2', 0, [2]], ['loot.unique.whisper.r3', 0, [4]],
        ]);
        expect(result.items[0]!.native.runicType).toBe('quietus');
    });
    it('V12: high-value vault removes magic weight before selecting rarity', () => {
        // Same D2 fixed dagger but highValue min rare =>80+11=91.
        const { result } = tapeRoll({ ...common, source: 'vault', depth: 2, itemClass: 'weapon', baseId: 'dagger', highValue: true },
            [[1, 91, 91], [2000, 3000, 2000]]);
        expect(result.items[0]!.data.uniqueId).toBe('loot.unique.whisper');
    });
    it('V13: failed floor conversion consumes one decision and preserves native item', () => {
        // Temporary valid probability4000, first draw4001 fails; no class/base/rarity draws.
        const effective = changed(pack => { pack.presets.presets.find(preset => preset.id === 'standard')!.floorConversionBp = 4000; });
        expect(tapeRoll({ ...common, source: 'floor', itemClass: 'weapon' }, [[1, 10000, 4001]], effective).result)
            .toEqual({ v: 1, converted: false, items: [], gold: 0, newUniqueIds: [], draws: 1 });
    });
    it('V14: ilvl40 rare uses high-ilvl count table and T4/T5/T6 window', () => {
        // Floor D27 =>ilvl40. Rarity700+352+140+20=1212; rareHigh count first45=>4 (ordinary table would give3).
        const { result } = tapeRoll({ ...common, source: 'floor', depth: 27, itemClass: 'weapon' }, [
            [1, 102, 1], [1, 1212, 1190], [1, 100, 1],
            [0, 1, 0], [1, 3100, 2600], [1, 100, 100], [4, 5, 4],
            [0, 1, 0], [1, 2500, 1], [1, 100, 1], [6100, 8500, 6100],
            [0, 1, 0], [1, 1500, 1500], [1, 100, 100], [12100, 16000, 12100],
            [1, 3500, 2100], [1, 100, 100], [3, 4, 3], [1, 10000, 10000], [0, 31, 0], [0, 31, 0],
        ]);
        expect(result.items[0]!.data.affixes).toEqual([affix('honed', 6, [4]), affix('keen', 4, [6100]), affix('giantsbane', 6, [12100]), affix('titan', 6, [3])]);
    });
    it('V15: corruption appends a negative outside position quota and compensates m=1 without choice draw', () => {
        // V2 vital occupies life; negative ring candidates clumsy800/noisy600 =>1400. Noisy T1=-1 constant. Only vital upgrades T1→T2 [10,16].
        const { result } = tapeRoll({ ...common, source: 'floor', itemClass: 'ring' }, [
            [1, 80, 25], [1, 1004, 800], [1, 100, 20], [0, 1, 1], [1, 7750, 2000], [5, 9, 7], [1, 10000, 1], [1, 1400, 1400], [10, 16, 16],
        ]);
        expect(result.items[0]!.data.affixes).toEqual([affix('vital', 2, [16]), affix('noisy', 1, [-1])]);
        expect(result.items[0]!.data.corrupted).toBe(true); expect(result.items[0]!.native.isCursed).toBe(true);
    });
    it('V16: successful C1 with all negative groups occupied consumes no C2 and stays uncorrupted', () => {
        // Weapon negatives use dmg-pct/accuracy/speed, all occupied by keen/precise/swift. Rune family disabled, so no fallback.
        const { result } = tapeRoll({ ...common, source: 'floor', itemClass: 'weapon' }, [
            [1, 84, 1], [1, 1004, 994], [1, 100, 1], [0, 1, 0], [1, 3100, 1], [1500, 2500, 1500],
            [0, 1, 1], [1, 3500, 1], [800, 1200, 800], [0, 1, 1], [1, 2600, 1], [-600, -400, -600],
            [1, 10000, 1], [0, 31, 0], [0, 31, 0],
        ]);
        expect(result.items[0]!.data.corrupted).toBe(false); expect(result.items[0]!.data.affixes).toHaveLength(3);
    });
    it('V17: combat enduring and concrete growth adept enter the live pool', () => {
        // Armor prefixes1000+800+700+300+600+300=3700; suffixes total5200 with two adept weights300 at slots4601..4900/4901..5200.
        const availability: LootAvailability = { combat: { stats: ['combat.stamina-capacity', 'combat.poise-capacity', 'combat.stamina-regen', 'combat.poise-recovery'] },
            growth: { stats: ['growth.attribute', 'growth.focus-capacity', 'growth.xp-gain'], attributes: ['strength', 'dexterity'] }, giants: null };
        const { result } = tapeRoll({ ...common, source: 'floor', itemClass: 'armor' }, [
            [1, 40, 1], [1, 1004, 800], [1, 100, 100], [0, 1, 0], [1, 3700, 3000], [2, 3, 3], [1, 5200, 4900], [1, 10000, 10000],
        ], catalog(availability));
        expect(result.items[0]!.data.affixes).toEqual([affix('enduring', 1, [3]), affix('adept.dexterity', 1, [1])]);
    });
    it.each([{ id: 'V18', typeId: 'goblin_totem', subject: false }, { id: 'V19', typeId: 'ogre', subject: true }])('$id: suppressed kill has zero item and gold draws', ({ typeId, subject }) => {
        // K0 suppression precedes K1 and G, independently of generous preset/champion flags.
        const request = kill(99, 'bountiful', typeId) as Extract<LootRollRequest, { source: 'kill' }>;
        request.monster.encounterSubject = subject; request.monster.leader = request.monster.champion = true;
        expect(tapeRoll(request, []).result).toEqual({ v: 1, converted: true, items: [], gold: 0, newUniqueIds: [], draws: 0 });
    });
    it('V20: excessive rarity find clamps before arithmetic and preserves exact totals', () => {
        // Standard cap20000: eff=floor(20000*25000/45000)=11111. D1 [700,470,149,21] =>1340.
        const request: LootRollRequest = { ...common, source: 'floor', itemClass: 'ring', rarityFindBp: Number.MAX_SAFE_INTEGER };
        const { result } = tapeRoll(request, [[1, 80, 1], [1, 1340, 1]]);
        expect(result.items[0]!.data.rarity).toBe('normal');
    });
    it('V21: failed item drop still reaches gold, with depth range and no leader multiplier', () => {
        // Fodder K1=300 fails301; gold1500 hits boundary; D10 range[35,75], standard multiplier1.
        const { result } = tapeRoll(kill(10, 'standard', 'rat'), [[1, 10000, 301], [1, 10000, 1500], [35, 75, 75]]);
        expect(result.items).toEqual([]); expect(result.gold).toBe(75);
    });
    it.each([false, true])('V22/V23: synthetic competing unique makes boss bias observable, giants=%s', giants => {
        // Real v1 has one unique per base: a second maul fixture exposes the declared ×5 weight (300+60 vs60+60).
        const effective: EffectiveLootCatalog = changed(pack => {
            pack.presets.presets.find(preset => preset.id === 'standard')!.encounter.count = 1;
            const unique = structuredClone(pack.uniques.uniques.find(unique => unique.id === 'loot.unique.colossus-maul')!);
            unique.id = 'loot.unique.test-maul'; unique.rows = unique.rows.map((row, index) => ({ ...row, rowId: `loot.unique.test-maul.r${index}` }));
            pack.uniques.uniques.push(unique);
        }, { ...unavailable, giants: giants ? { formIds: ['giants.abyssal-colossus'] } : null });
        const { result } = tapeRoll({ ...common, source: 'encounter', depth: 20, formId: 'giants.abyssal-colossus' }, [
            [1, 100, 1], [1, 102, 90], [1, 185, 185], [1, giants ? 360 : 120, 100], [10000, 13000, 10000], [65, 135, 65],
        ], effective);
        expect(result.newUniqueIds).toEqual([giants ? 'loot.unique.colossus-maul' : 'loot.unique.test-maul']);
    });
    it('V24: same-event receipt prevents a duplicate unique on the next item', () => {
        // Make subsequent rarity singleton unique and rare count singleton1 only in this branch-isolation fixture.
        // First dagger whisper draws accuracy; second hits unique, sees receipt, downgrades and draws one keen, then name.
        const effective = changed(pack => {
            const preset = pack.presets.presets.find(preset => preset.id === 'standard')!;
            preset.rarityWeights = { normal: 0, magic: 0, rare: 0, unique: 10, set: 0 };
            preset.affixCount.rare = [{ n: 1, w: 1 }]; preset.corruptChanceBp = 0;
        });
        const { result, trace } = tapeRoll({ ...common, source: 'encounter', depth: 1, formId: null }, [
            [1, 100, 1], [1, 84, 1], [2000, 3000, 2000],
            [1, 100, 1], [1, 84, 1], [0, 1, 0], [1, 3100, 1], [1, 65, 40], [1500, 2500, 1500], [0, 31, 0], [0, 31, 0], [8, 21, 8],
        ], effective);
        expect(trace.uniqueOpportunities).toBe(2); expect(result.newUniqueIds).toEqual(['loot.unique.whisper']);
        expect(result.items.map(item => item.data.rarity)).toEqual(['unique', 'rare']);
    });
    it('V25: matching priority, stable ties and unknown-monster fallback preserve singleton skips', () => {
        // Unknown monster defaults standard. Winning table is first equal priority, depth1 only, fixed one ring,
        // chance10000 and +7 ilvl: ilvl8 rarity700+246+84+12=1042. Singleton class/count and certain chance do not draw.
        const effective = changed(pack => {
            const base = structuredClone(pack.dropTables.tables.find(table => table.id === 'loot.drop.kill-standard')!);
            const winner = { ...base, id: 'loot.drop.test-priority-first', priority: 500,
                match: { source: 'kill' as const, monsterClass: 'standard' as const, monsterId: 'future-monster', depth: [1, 1] as [number, number] },
                chanceBp: 10000, count: [1, 1] as [number, number], classWeights: { weapon: 0, armor: 0, ring: 100 }, ilvlBonus: 7 };
            pack.dropTables.tables.push(winner, { ...structuredClone(winner), id: 'loot.drop.test-priority-second', ilvlBonus: 8 });
            pack.dropTables.tables.unshift({ ...structuredClone(winner), id: 'loot.drop.test-unmatched', priority: 1000,
                match: { source: 'kill', monsterId: 'other-monster' }, ilvlBonus: 20 });
        });
        const { result } = tapeRoll(kill(1, 'standard', 'future-monster'), [[1, 80, 1], [1, 1042, 1], [1, 10000, 10000]], effective);
        expect(result.items[0]!.data.ilvl).toBe(8); expect(result.items[0]!.native.category).toBe('ring');
    });
    it('V26: no kill table skips item decisions but still evaluates gold', () => {
        // Remove standard table: K0 standard remains eligible, K1/K2 absent, G standard20% remains.
        const effective = changed(pack => { pack.dropTables.tables = pack.dropTables.tables.filter(table => table.id !== 'loot.drop.kill-standard'); });
        const { result } = tapeRoll(kill(1, 'standard', 'goblin'), [[1, 10000, 2000], [8, 21, 8]], effective);
        expect(result.items).toEqual([]); expect(result.gold).toBe(8);
    });
    it('diagnostic entry point and public API remain identical', () => {
        const request: LootRollRequest = { ...common, source: 'floor', itemClass: 'weapon' };
        expect(rollLoot(catalog(), request, { randomInt: lo => lo })).toEqual(rollLootWithTrace(catalog(), request, { randomInt: lo => lo }).result);
    });
});
