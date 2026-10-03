import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { applyChosenEnchantmentGain, checkpointEnchantmentGain, enchantChosenItem } from '../../../../engine/Items/ItemUseCoordinator';
import { WAND_INITIAL_RANGES } from '../../../../engine/Items/ArcanaInstance';
import { rng } from '../../../../engine/Random';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack } from '../types';
import type { GrowthItemLedger } from '../items';
import type { GrowthProgression } from '../components';
import { parseGrowthDefinitionPack } from '../definitions';
import { createGrowthGameplay } from '../module';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

function configured(change: (pack: GrowthDefinitionPack) => void = () => {}): void {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.experience.sources.identification = false; pack.config.experience.sources.firstVisits = false;
    change(pack);
    const validated = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(validated, identity), identity);
        return registry;
    });
}
function game(): Game {
    const game = createHeadlessGame(81431, 'test'); game.startNewGame({ seed: 81431, mode: 'test', ruleSet: 'extended' });
    game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
    game.monsters = [];
    // Keep native item effects isolated from unrelated objective-time status/regen changes.
    vi.spyOn(game as unknown as { playerTurnEnded(): void }, 'playerTurnEnded').mockImplementation(() => {});
    return game;
}
const ledger = (g: Game): GrowthItemLedger => g.extensionRuntime!.snapshot().components[g.player.id]!['growth:items'] as unknown as GrowthItemLedger;
const points = (g: Game): GrowthProgression => g.extensionRuntime!.snapshot().components[g.player.id]!['growth:progression'] as GrowthProgression;
function quaff(g: Game, id: string): void {
    const potion = ItemLoader.spawnPotion(id, -1, -1)!;
    expect(g.player.inventory.addItem(potion)).toBe(true);
    const pack = g.player.inventory.stackFor(potion)!;
    g.executeItemCommand('quaff', pack);
}
function enchant(g: Game, target: Item): void {
    const scroll = ItemLoader.spawnScroll('scroll_of_enchantment', -1, -1)!;
    expect(g.player.inventory.addItem(scroll)).toBe(true);
    g.executeItemCommand('read', g.player.inventory.stackFor(scroll)!);
    expect(g.pendingEnchantment).toBe(true);
    g.executeItemCommand('enchant', target);
    expect(g.pendingEnchantment).toBe(false);
}
afterEach(() => vi.restoreAllMocks());

describe('EXT-1b native permanent-item bridge', () => {
    it('retains original potion gains by default and never applies them twice on settlement', () => {
        configured(); const g = game(), strength = g.player.strength, maxHp = g.player.maxHp;
        quaff(g, 'potion_of_strength'); quaff(g, 'potion_of_life');
        expect([g.player.strength, g.player.maxHp, g.player.hp]).toEqual([strength + 1, maxHp + 10, maxHp + 10]);
        expect(ledger(g)).toEqual({ awarded: { potion_of_strength: 1, potion_of_life: 10 } });
        g.executeCommand('growth-item-settle', undefined, () => {});
        expect([g.player.strength, g.player.maxHp]).toEqual([strength + 1, maxHp + 10]);
    });

    it('limits only life permanent output while preserving full healing and all original cleanup', () => {
        configured(pack => { Object.assign(pack.config.itemGrowth.rules[1]!, { conversion: 2, perItemCap: 3, runCap: 5 }); });
        const g = game(), maxHp = g.player.maxHp;
        for (const expected of [3, 5, 5]) {
            g.player.hp = 1;
            for (const status of ['hallucinating', 'confused', 'nauseous', 'slowed', 'weakened', 'poisoned', 'darkness'] as const)
                g.player.setStatusDuration(status, 9);
            quaff(g, 'potion_of_life');
            expect([g.player.maxHp, g.player.hp]).toEqual([maxHp + expected, maxHp + expected]);
            for (const status of ['hallucinating', 'confused', 'nauseous', 'slowed'] as const) expect(g.player.getStatusDuration(status)).toBe(1);
            for (const status of ['weakened', 'poisoned', 'darkness'] as const) expect(g.player.getStatusDuration(status)).toBe(0);
        }
        expect(ledger(g)).toEqual({ awarded: { potion_of_life: 5 } });
    });

    it('replaces potions with point grants without the original permanent stat and still removes weakness', () => {
        configured(pack => {
            Object.assign(pack.config.itemGrowth.rules[0]!, { nativeEffect: 'replace', destination: 'skill-points', conversion: 3, runCap: 4 });
            Object.assign(pack.config.itemGrowth.rules[1]!, { nativeEffect: 'replace', destination: 'attribute-points', conversion: 2 });
        });
        const g = game(), strength = g.player.strength, maxHp = g.player.maxHp, initial = points(g);
        g.player.setStatusDuration('weakened', 8); g.player.weaknessAmount = 5;
        quaff(g, 'potion_of_strength'); quaff(g, 'potion_of_strength'); quaff(g, 'potion_of_life');
        expect([g.player.strength, g.player.maxHp]).toEqual([strength, maxHp]);
        expect([g.player.getStatusDuration('weakened'), g.player.weaknessAmount]).toEqual([1, 0]);
        expect(points(g)).toMatchObject({ skillPoints: initial.skillPoints + 4, attributePoints: initial.attributePoints + 2 });
        expect(ledger(g)).toEqual({ awarded: { potion_of_strength: 4, potion_of_life: 2 } });
        const saved = g.toSnapshot(), restored = createHeadlessGame(144, 'test');
        expect(restored.loadSnapshot(saved)).toBe(true);
        expect(ledger(restored)).toEqual(ledger(g)); expect(points(restored)).toEqual(points(g));
        vi.spyOn(restored as unknown as { playerTurnEnded(): void }, 'playerTurnEnded').mockImplementation(() => {});
        quaff(restored, 'potion_of_strength'); expect(points(restored).skillPoints).toBe(initial.skillPoints + 4);
        expect(restored.player.strength).toBe(strength);
    });

    it('routes alternate native-stat replacements once and saves the resulting native totals', () => {
        configured(pack => {
            Object.assign(pack.config.itemGrowth.rules[0]!, { nativeEffect: 'replace', destination: 'maxHpBonus', conversion: 4 });
            Object.assign(pack.config.itemGrowth.rules[1]!, { nativeEffect: 'replace', destination: 'strengthBonus', conversion: 2 });
        });
        const g = game(), strength = g.player.strength, maxHp = g.player.maxHp;
        quaff(g, 'potion_of_strength'); quaff(g, 'potion_of_life');
        expect([g.player.strength, g.player.maxHp]).toEqual([strength + 2, maxHp + 4]);
        const saved = g.toSnapshot(), restored = createHeadlessGame(144, 'test');
        expect(restored.loadSnapshot(saved)).toBe(true);
        restored.executeCommand('growth-item-settle', undefined, () => {});
        expect([restored.player.strength, restored.player.maxHp]).toEqual([strength + 2, maxHp + 4]);
    });

    it('scales the full native enchant bundle and caps across different target items', () => {
        configured(pack => { Object.assign(pack.config.itemGrowth.rules[2]!, { conversion: 3, perItemCap: 2, runCap: 3 }); });
        const g = game(), weapon = g.player.equippedWeapon!;
        Object.assign(weapon, { enchantment: 0, timesEnchanted: 0, strengthRequired: 12 });
        const staff = ItemLoader.spawnStaff('staff_of_lightning', -1, -1)!;
        Object.assign(staff, { enchantment: 3, maxCharges: 3, charges: 1, staffRechargeRemaining: 2000, timesEnchanted: 0 });
        expect(g.player.inventory.addItem(staff)).toBe(true);
        enchant(g, weapon); enchant(g, staff); enchant(g, weapon);
        expect([weapon.enchantment, weapon.strengthRequired, weapon.timesEnchanted]).toEqual([2, 10, 2]);
        expect([staff.enchantment, staff.maxCharges, staff.charges, staff.timesEnchanted, staff.staffRechargeRemaining]).toEqual([4, 4, 2, 1, 125]);
        expect(ledger(g)).toEqual({ awarded: { scroll_of_enchantment: 3 } });
    });

    it('does not grant or record enchanting until an eligible live target is selected', () => {
        configured(); const g = game(), scroll = ItemLoader.spawnScroll('scroll_of_enchantment', -1, -1)!;
        g.player.inventory.addItem(scroll); g.executeItemCommand('read', scroll);
        const before = ledger(g), target = g.player.equippedWeapon!, enchantment = target.enchantment;
        g.executeItemCommand('cancel');
        expect(g.pendingEnchantment).toBe(true); expect(ledger(g)).toEqual(before);
        const bad = ItemLoader.spawnPotion('potion_of_life', -1, -1)!;
        g.player.inventory.addItem(bad); g.executeItemCommand('enchant', bad);
        expect(g.pendingEnchantment).toBe(true); expect(ledger(g)).toEqual(before);
        g.executeItemCommand('enchant', target);
        expect(target.enchantment).toBe(enchantment + 1); expect(ledger(g)).toEqual({ awarded: { scroll_of_enchantment: 1 } });
        g.executeItemCommand('enchant', target); expect(target.enchantment).toBe(enchantment + 1);
        expect(ledger(g)).toEqual({ awarded: { scroll_of_enchantment: 1 } });
    });

    it('replaces enchanting with points only after target acceptance and preserves target cleanup', () => {
        configured(pack => {
            Object.assign(pack.config.itemGrowth.rules[2]!, { nativeEffect: 'replace', destination: 'skill-points', conversion: 4, runCap: 5 });
        });
        const g = game(), initial = points(g).skillPoints, target = g.player.equippedWeapon!;
        target.isCursed = true; const before = [target.enchantment, target.strengthRequired, target.timesEnchanted];
        enchant(g, target); enchant(g, target);
        expect([target.enchantment, target.strengthRequired, target.timesEnchanted]).toEqual(before);
        expect(target.isCursed).toBe(false); expect(points(g).skillPoints).toBe(initial + 5);
        expect(ledger(g)).toEqual({ awarded: { scroll_of_enchantment: 5 } });
        const saved = g.toSnapshot(), restored = createHeadlessGame(141, 'test');
        expect(restored.loadSnapshot(saved)).toBe(true);
        vi.spyOn(restored as unknown as { playerTurnEnded(): void }, 'playerTurnEnded').mockImplementation(() => {});
        enchant(restored, restored.player.equippedWeapon!);
        expect(points(restored).skillPoints).toBe(initial + 5); expect(ledger(restored)).toEqual(ledger(g));
    });

    it('persists pending selection without paying a receipt early and rejects tampered cap totals', () => {
        configured(pack => { pack.config.itemGrowth.rules[2]!.runCap = 2; });
        const g = game(), scroll = ItemLoader.spawnScroll('scroll_of_enchantment', -1, -1)!;
        g.player.inventory.addItem(scroll); g.executeItemCommand('read', scroll);
        const saved = g.toSnapshot(), restored = createHeadlessGame(142, 'test');
        expect(restored.loadSnapshot(saved)).toBe(true); expect(restored.pendingEnchantment).toBe(true);
        expect(ledger(restored)).toEqual({ awarded: {} });
        vi.spyOn(restored as unknown as { playerTurnEnded(): void }, 'playerTurnEnded').mockImplementation(() => {});
        restored.executeItemCommand('enchant', restored.player.equippedWeapon!);
        expect(ledger(restored)).toEqual({ awarded: { scroll_of_enchantment: 1 } });
        const bad = structuredClone(restored.toSnapshot());
        bad.extensions!.components[restored.player.id]!['growth:items'] = { awarded: { scroll_of_enchantment: 3 } };
        expect(restored.loadSnapshot(bad)).toBe(false); expect(ledger(restored)).toEqual({ awarded: { scroll_of_enchantment: 1 } });
    });

    it('zero native enchant output still performs uncurse, cooldown and worn-armor cleanup', () => {
        configured(pack => { pack.config.itemGrowth.rules[2]!.perItemCap = 0; });
        const g = game(), armor = g.player.equippedArmor!, enchantment = armor.enchantment, required = armor.strengthRequired;
        armor.isCursed = true; armor.timesEnchanted = 2; g.player.setStatusDuration('donning', 10);
        enchant(g, armor);
        expect([armor.enchantment, armor.strengthRequired, armor.timesEnchanted]).toEqual([enchantment, required, 2]);
        expect(armor.isCursed).toBe(false); expect(g.player.getStatusDuration('donning')).toBe(0);
        const charm = ItemLoader.spawnCharm('charm_of_health', -1, -1)!;
        charm.cooldownRemaining = 99; charm.isCursed = true; const charmEnchantment = charm.enchantment;
        g.player.inventory.addItem(charm); enchant(g, charm);
        expect(charm.enchantment).toBe(charmEnchantment); expect(charm.cooldownRemaining).toBe(0); expect(charm.isCursed).toBe(false);
        expect(ledger(g)).toEqual({ awarded: {} });
    });

    it('preserves wand charge semantics at multiplied magnitude and zero gives no hidden charge', () => {
        const g = createHeadlessGame(4823, 'test'), wand = ItemLoader.spawnWand('wand_of_teleportation', -1, -1)!;
        wand.charges = 0; wand.maxCharges = 1; wand.timesEnchanted = 0; const initialEnchantment = wand.enchantment;
        const ports = { updateVision: () => {}, logEnchanted: () => {}, logUncursed: () => {} }, before = rng.getState();
        enchantChosenItem(g.player, wand, ports, 3);
        expect([wand.charges, wand.maxCharges, wand.enchantment, wand.timesEnchanted])
            .toEqual([3 * WAND_INITIAL_RANGES.wand_of_teleportation![0], 1, initialEnchantment, 3]);
        enchantChosenItem(g.player, wand, ports, 0);
        expect(wand.charges).toBe(3 * WAND_INITIAL_RANGES.wand_of_teleportation![0]); expect(rng.getState()).toEqual(before);
    });

    it('classic use never creates or invokes an extension module and retains native gains', () => {
        const factory = vi.spyOn(catalog, 'createExtensionRegistry'), g = createHeadlessGame(321, 'test');
        vi.spyOn(g as unknown as { playerTurnEnded(): void }, 'playerTurnEnded').mockImplementation(() => {});
        const strength = g.player.strength, maxHp = g.player.maxHp;
        quaff(g, 'potion_of_strength'); quaff(g, 'potion_of_life'); enchant(g, g.player.equippedWeapon!);
        expect([g.player.strength, g.player.maxHp]).toEqual([strength + 1, maxHp + 10]);
        expect(factory).not.toHaveBeenCalled(); expect(g.extensionRuntime).toBeNull(); expect(g.toSnapshot().extensions).toBeUndefined();
        const invalid = new Item('invalid', '?', 0, ItemCategory.FOOD);
        expect(() => enchantChosenItem(g.player, invalid, { updateVision: () => {}, logEnchanted: () => {}, logUncursed: () => {} }, -1)).toThrow();
    });

    it.each(['potion_of_strength', 'potion_of_life'])('rejects unsafe %s output before consuming it or recording a gain', id => {
        configured(pack => { pack.config.itemGrowth.rules.forEach(rule => { rule.conversion = 2; }); });
        const g = game(), field = id === 'potion_of_life' ? 'maxHp' : 'strength';
        g.player[field] = Number.MAX_SAFE_INTEGER - 1;
        const potion = ItemLoader.spawnPotion(id, -1, -1)!; g.player.inventory.addItem(potion);
        const resources = [g.player.strength, g.player.maxHp, g.player.hp], extensions = g.extensionRuntime!.snapshot(), random = rng.getState();
        expect(() => g.executeItemCommand('quaff', potion)).toThrow();
        expect(g.player.inventory.items).toContain(potion); expect(potion.quantity).toBe(1);
        expect([g.player.strength, g.player.maxHp, g.player.hp]).toEqual(resources);
        expect(g.extensionRuntime!.snapshot()).toEqual(extensions); expect(rng.getState()).toEqual(random);
    });

    it('prevalidates the entire enchant bundle and leaves the accepted target and ledger untouched on overflow', () => {
        configured(pack => { pack.config.itemGrowth.rules[2]!.conversion = 3; });
        const g = game(), target = g.player.equippedWeapon!, scroll = ItemLoader.spawnScroll('scroll_of_enchantment', -1, -1)!;
        target.enchantment = Number.MAX_SAFE_INTEGER - 1; target.timesEnchanted = 0; target.isCursed = true;
        g.player.inventory.addItem(scroll); g.executeItemCommand('read', scroll);
        const before = Object.getOwnPropertyDescriptors(target), extensions = g.extensionRuntime!.snapshot(), random = rng.getState();
        expect(() => g.executeItemCommand('enchant', target)).toThrow();
        expect(Object.getOwnPropertyDescriptors(target)).toEqual(before);
        expect(g.extensionRuntime!.snapshot()).toEqual(extensions); expect(rng.getState()).toEqual(random);
        expect(g.pendingEnchantment).toBe(true);
    });

    it('rolls back target native descriptors and module state if the native transaction callback fails', () => {
        configured(); const g = game(), target = g.player.equippedWeapon!;
        const before = Object.getOwnPropertyDescriptors(target), extensions = g.extensionRuntime!.snapshot();
        expect(() => g.extensionRuntime!.commitItemGrowth(g.player, 'scroll_of_enchantment', 'enchantment', 1, {
            apply: amount => { applyChosenEnchantmentGain(target, amount); throw new Error('Forced native commit failure'); },
            rollback: checkpointEnchantmentGain(target),
        })).toThrow('Forced native commit failure');
        expect(Object.getOwnPropertyDescriptors(target)).toEqual(before); expect(g.extensionRuntime!.snapshot()).toEqual(extensions);
    });

    it('default extended item use keeps the classic native mutation and RNG footprint', () => {
        const exercise = (g: Game) => {
            const darts = ItemLoader.spawnWeapon('dart', -1, -1)!;
            Object.assign(darts, { enchantment: 0, strengthRequired: 10, timesEnchanted: 0, quiverNumber: 123 });
            g.player.inventory.addItem(darts);
            rng.seedRandomGenerator(912341); rng.resetCounters();
            quaff(g, 'potion_of_strength'); quaff(g, 'potion_of_life'); enchant(g, darts);
            return { strength: g.player.strength, maxHp: g.player.maxHp, hp: g.player.hp,
                enchantment: darts.enchantment, required: darts.strengthRequired, quiver: darts.quiverNumber,
                timesEnchanted: darts.timesEnchanted, rng: rng.getState(), generated: rng.randomNumbersGenerated };
        };
        const classic = createHeadlessGame(81431, 'test');
        vi.spyOn(classic as unknown as { playerTurnEnded(): void }, 'playerTurnEnded').mockImplementation(() => {});
        const expected = exercise(classic);
        configured(); const extended = game();
        expect(exercise(extended)).toEqual(expected);
    });
});
