import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateMonsterDetail } from '../engine/UI/DetailGenerator';
import { CombatSystem } from '../engine/Combat/Combat';
import { rng } from '../engine/Random';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { Player } from '../entities/Player';
import { Item, ItemCategory } from '../engine/Items/Item';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { ExtensionModule, ExtensionRuleInput, ExtensionRulePolicies, ExtensionRuleContext, Json } from '../ext/types';
import monsters from '../data/monsters.json';
import mutations from '../data/mutations.json';
import { createHeadlessGame } from './harness';
import * as catalog from '../ext/catalog';

afterEach(() => vi.restoreAllMocks());
function monster(id = 'rat'): Monster {
    const actor = new Monster(5, 4, (monsters as MonsterData[]).find(row => row.id === id)!);
    actor.state = MonsterState.HUNTING; actor.hp = actor.maxHp = 100;
    return actor;
}
function factory(rulePolicies: ExtensionRulePolicies, extra: Partial<ExtensionModule> = {}): ExtensionModule {
    return { id: 'policy-test', version: '1.0.0', initialState: () => ({}),
        validateState: (value): value is Json => !!value && typeof value === 'object', rulePolicies, ...extra };
}
function runtime(player: Player, rules: ExtensionRulePolicies, extra: Partial<ExtensionModule> = {}): ExtensionRuntime {
    const registry = new ExtensionRegistry();
    registry.register('policy-test', '1.0.0', () => factory(rules, extra));
    const result = new ExtensionRuntime(registry, registry.manifest(['policy-test']), {
        depth: () => 1, playerId: () => player.id, randomInt: () => { throw new Error('Unexpected policy RNG'); }, message: () => undefined,
    });
    result.attachCreature(player); return result;
}
function weapon(damage = '10'): Item {
    const item = new Item('test', ')', 0xffffff, ItemCategory.WEAPON);
    item.damage = damage; item.strengthRequired = 12; return item;
}
const preserveGuarantees = (input: ExtensionRuleInput): number => input.rollMode === 'roll-probability' ? 5000 : input.baseValue;

describe('EXT-1b production rule adapter slots', () => {
    it('keeps classic combat entirely outside runtime/policy dispatch, including bare attack calls', () => {
        const player = new Player(4, 4), target = monster(); player.equippedWeapon = weapon();
        const rule = vi.spyOn(ExtensionRuntime.prototype, 'rule');
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        const attack = CombatSystem.attack; attack(player, target);
        CombatSystem.resolveThrownWeapon(player, target, weapon());
        expect(rule).not.toHaveBeenCalled();
    });
    it('runs one combined physical slot after native roll and before shield, with immutable narrow input', () => {
        const player = new Player(4, 4), target = monster(); player.equippedWeapon = weapon('10');
        const hit = vi.fn(preserveGuarantees), damage = vi.fn((input: ExtensionRuleInput, context: ExtensionRuleContext) => {
            expect(Object.isFrozen(input)).toBe(true); expect(Object.isFrozen(context)).toBe(true);
            expect(Object.keys(context).sort()).toEqual(['getComponent', 'playerId', 'state']);
            expect('actor' in input).toBe(false); expect('randomInt' in context).toBe(false);
            return Math.floor(input.baseValue * 0.9);
        });
        const ext = runtime(player, { hitChance: hit, physicalDamage: damage }); ext.attachCreature(target);
        target.setStatusDuration('shielded', 50); // Five HP shield absorbs the adjusted nine.
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        const result = CombatSystem.attack(player, target);
        expect(damage).toHaveBeenCalledTimes(1); expect(damage.mock.calls[0]![0].baseValue).toBe(10);
        expect(result.damage).toBe(9); expect(target.hp).toBe(96);
    });
    it('preserves skipped guarantees and rolled guarantees at the native RNG positions', () => {
        const player = new Player(4, 4), target = monster(); player.equippedWeapon = weapon();
        const hit = vi.fn(preserveGuarantees), ext = runtime(player, { hitChance: hit }); ext.attachCreature(target);
        const percent = vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        target.setStatusDuration('stuck', 5); CombatSystem.attack(player, target);
        expect(hit.mock.calls[hit.mock.calls.length - 1]![0].rollMode).toBe('skip-guaranteed-hit'); expect(percent).not.toHaveBeenCalled();
        target.setStatusDuration('stuck', 0); target.seized = player.seizing = true; target.hp = 100;
        CombatSystem.attack(player, target);
        expect(hit.mock.calls[hit.mock.calls.length - 1]![0].rollMode).toBe('roll-guaranteed'); expect(percent.mock.calls).toEqual([[100]]);
    });
    it('preserves thrown slaying rolls and skips the same roll for stuck targets', () => {
        const player = new Player(4, 4), target = monster(), missile = weapon();
        missile.runicType = 'slaying'; missile.vorpalEnemy = 'animal'; target.hp = 1;
        const hit = vi.fn(preserveGuarantees), ext = runtime(player, { hitChance: hit }); ext.attachCreature(target);
        const percent = vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        CombatSystem.resolveThrownWeapon(player, target, missile);
        expect(hit.mock.calls[0]![0].rollMode).toBe('roll-guaranteed'); expect(percent.mock.calls).toEqual([[100]]);
        target.hp = 100; target.setStatusDuration('stuck', 3); percent.mockClear(); CombatSystem.resolveThrownWeapon(player, target, weapon());
        expect(hit.mock.calls[1]![0].rollMode).toBe('skip-guaranteed-hit'); expect(percent).not.toHaveBeenCalled();
    });
    it('truncates basis points only at native percent-roll precision for melee and thrown attacks', () => {
        const player = new Player(4, 4), target = monster(); player.equippedWeapon = weapon(); target.defense = 30;
        const hit = vi.fn((_input: ExtensionRuleInput) => 6549), ext = runtime(player, { hitChance: hit }); ext.attachCreature(target);
        const percent = vi.spyOn(rng, 'randPercent').mockReturnValue(false);
        CombatSystem.attack(player, target); CombatSystem.resolveThrownWeapon(player, target, weapon());
        expect(percent.mock.calls).toEqual([[65], [65]]);
        expect(hit.mock.calls.map(call => call[0].attackKind)).toEqual(['melee', 'thrown']);
    });
    it('does not scale poison duration or direct fire/poison/bolt damage through the physical slot', () => {
        const player = new Player(4, 4), snake = monster('pink_jelly');
        snake.damageString = '10'; snake.abilityFlags.add('MA_POISONS');
        const damage = vi.fn((input: ExtensionRuleInput) => input.baseValue * 2), ext = runtime(player, { physicalDamage: damage }); ext.attachCreature(snake);
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        CombatSystem.attack(snake, player);
        expect(damage.mock.calls.map(call => call[0].baseValue)).toEqual([1]); expect(player.getStatusDuration('poisoned')).toBe(10);
        damage.mockClear(); player.takeDamage(2, true, undefined, undefined, 'fire'); player.takeDamage(2, true, undefined, undefined, 'poison');
        ext.causality.withOrigin(ext.causality.create('bolt', snake.id, snake.id, null), () => CombatSystem.attack(snake, player));
        expect(damage).not.toHaveBeenCalled();
    });
    it('rejects async, nonfinite and mutating rule providers deterministically', () => {
        const player = new Player(4, 4), input = { actorId: player.id, targetId: null, baseValue: 1 };
        expect(() => runtime(player, { searchStrength: () => NaN }).rule('searchStrength', input)).toThrow('Invalid extension rule result');
        expect(() => runtime(player, { searchStrength: (() => Promise.resolve(1)) as never }).rule('searchStrength', input)).toThrow('Async');
        expect(() => runtime(player, { searchStrength: input => { (input as { baseValue: number }).baseValue = 9; return 9; } }).rule('searchStrength', input)).toThrow();
    });
    it('uses the same read-only hit forecast in production details and actual resolution without consuming RNG', () => {
        const player = new Player(4, 4), target = monster(); player.equippedWeapon = weapon(); target.defense = 30;
        const ext = runtime(player, { hitChance: input => input.rollMode === 'roll-probability' ? 6549 : input.baseValue }); ext.attachCreature(target);
        const before = rng.getState(), snapshot = ext.snapshot();
        const detail = () => generateMonsterDetail(target, player.hp, player.effectiveStrength, 0, [10, 10], 0, 12,
            0, 0, 0, false, 0, false, direction => direction === 'outgoing'
                ? CombatSystem.previewHitChance(player, target) : CombatSystem.previewHitChance(target, player));
        expect(JSON.stringify(detail())).toContain('65%'); expect(detail()).toEqual(detail());
        expect(rng.getState()).toEqual(before); expect(ext.snapshot()).toEqual(snapshot);
        const percent = vi.spyOn(rng, 'randPercent').mockReturnValue(false); CombatSystem.attack(player, target);
        expect(percent).toHaveBeenCalledWith(65);
        target.state = MonsterState.ASLEEP; expect(CombatSystem.previewHitChance(player, target)).toBe(100);
        percent.mockClear(); CombatSystem.attack(player, target); expect(percent).not.toHaveBeenCalled();
    });
    it('restores native strength and gold when a later settlement hook fails', () => {
        const player = new Player(4, 4), registry = new ExtensionRegistry(); let gold = 20;
        registry.register('a', '1.0.0', () => ({ ...factory({}), id: 'a', resourceCommits: true,
            hooks: { simulationSettled(_event, context) {
                const old = context.characterResources(player.id);
                context.commitCharacterResources(player.id, { expectedStrength: old.strength, strength: old.strength! + 2,
                    expectedGold: old.gold, gold: old.gold! - 7 }); context.setState({ changed: true });
            } } }));
        registry.register('b', '1.0.0', () => ({ ...factory({}), id: 'b', hooks: { simulationSettled() { throw new Error('later failure'); } } }));
        const ext = new ExtensionRuntime(registry, registry.manifest(['a', 'b']), { depth: () => 1, playerId: () => player.id,
            randomInt: () => 0, message: () => undefined, gold: () => gold, setGold: value => { gold = value; } });
        ext.attachCreature(player); const before = ext.snapshot(), strength = player.strength;
        expect(() => ext.settle([player])).toThrow('later failure'); expect(ext.snapshot()).toEqual(before);
        expect(player.strength).toBe(strength); expect(gold).toBe(20);
    });
    it('rolls back all module and native character resource writes when a command capability rejects', () => {
        const player = new Player(4, 4), hp = player.hp, maximum = player.maxHp, strength = player.strength;
        const ext = runtime(player, {}, { resourceCommits: true, commands: { fail(_payload, context) {
            context.setState({ changed: true }); context.setComponent(player.id, 'probe', { changed: true });
            const old = context.characterResources(player.id);
            context.commitCharacterResources(player.id, { expectedStrength: old.strength, strength: old.strength! + 1,
                expectedGold: old.gold, gold: old.gold });
            context.commitResources(player.id, { expectedHp: hp, expectedMaxHp: maximum, hp, maxHp: maximum + 3 });
            context.commitResources(player.id, { expectedHp: -1, expectedMaxHp: maximum + 3, hp, maxHp: maximum + 4 });
        } } });
        const before = ext.snapshot();
        expect(() => ext.command(JSON.stringify({ module: 'policy-test', action: 'fail', payload: null }))).toThrow('Invalid extension resource commit');
        expect(ext.snapshot()).toEqual(before); expect([player.hp, player.maxHp, player.strength]).toEqual([hp, maximum, strength]);
    });
    it('rejects conflicting rule providers rather than choosing the last registration', () => {
        const registry = new ExtensionRegistry();
        for (const id of ['a', 'b']) registry.register(id, '1.0.0', () => ({ ...factory({ hitChance: input => input.baseValue }), id }));
        expect(() => new ExtensionRuntime(registry, registry.manifest(['a', 'b']), { depth: () => 1, playerId: () => 1,
            randomInt: () => 0, message: () => undefined })).toThrow('Conflicting extension rule providers');
    });
});

describe('EXT-1b native maximum transformation boundaries', () => {
    function built() {
        const player = new Player(4, 4), actor = monster(); actor.maxHp = 107; actor.hp = 100;
        const ext = runtime(player, { nativeBonuses: () => ({ maxHp: 7, strength: 0 }) }, {
            resourceCommits: true, hooks: { nativeMaximumReset: ({ actor, preserveOverhealth }, context) => context.commitResources(actor.id, {
                expectedHp: actor.hp, expectedMaxHp: actor.maxHp, hp: preserveOverhealth ? actor.hp : Math.min(actor.hp, actor.maxHp + 7), maxHp: actor.maxHp + 7,
            }) },
        });
        ext.attachCreature(actor); return { actor, ext };
    }
    it('empower preserves one growth bonus and heals only native transformed HP', () => {
        const { actor } = built(); actor.hp = 50;
        expect(actor.empower()).toBe(true); expect(actor.maxHp).toBe(119); expect(actor.hp).toBe(112);
        actor.empower(); expect(actor.maxHp).toBe(131); expect(actor.hp).toBe(124);
    });
    it('mutation multiplies native maximum only and reapplies the same bonus once', () => {
        const { actor } = built(); const mutation = { ...mutations[0]!, healthFactor: 2 };
        actor.mutate(mutation); expect(actor.maxHp).toBe(207); expect(actor.hp).toBe(200);
    });
    it('polymorph uses the exact native HP transform and random stream before one bonus reapplication', () => {
        const { actor } = built(), native = monster(); actor.hp = native.hp = 40;
        const state = rng.getState(); native.polymorph(() => undefined); const after = rng.getState();
        rng.setState(state); actor.polymorph(() => undefined);
        expect(actor.typeId).toBe(native.typeId); expect(actor.maxHp).toBe(native.maxHp + 7);
        expect(actor.hp).toBe(native.hp); expect(rng.getState()).toEqual(after);
    });
    it.each([0, 7])('preserves native overhealth through polymorph with %i growth maximum', bonus => {
        const player = new Player(4, 4), actor = monster(), native = monster();
        actor.hp = 120 + bonus; actor.maxHp = 100 + bonus; native.hp = 120;
        const ext = runtime(player, { nativeBonuses: () => ({ maxHp: bonus, strength: 0 }) }, { resourceCommits: true,
            hooks: { nativeMaximumReset: ({ actor, preserveOverhealth }, context) => context.commitResources(actor.id, {
                expectedHp: actor.hp, expectedMaxHp: actor.maxHp, hp: preserveOverhealth ? actor.hp : Math.min(actor.hp, actor.maxHp + bonus), maxHp: actor.maxHp + bonus,
            }) } }); ext.attachCreature(actor);
        const state = rng.getState(); native.polymorph(() => undefined); const after = rng.getState();
        rng.setState(state); actor.polymorph(() => undefined);
        expect(actor.hp).toBe(native.hp); expect(actor.maxHp).toBe(native.maxHp + bonus); expect(rng.getState()).toEqual(after);
    });
    it('retains the accepted extended restored-form health cap independently of polymorph overhealth', () => {
        const { actor } = built(); actor.hp = 120;
        const form = (monsters as MonsterData[]).find(row => row.id === 'vampire')!;
        actor.restoreSummonerForm(form); expect(actor.maxHp).toBe(form.hp + 7); expect(actor.hp).toBe(actor.maxHp);
    });
    it('summoner restoration reapplies once and never grants extra current HP', () => {
        const { actor } = built(); actor.hp = 15;
        const form = (monsters as MonsterData[]).find(row => row.id === 'vampire')!;
        actor.restoreSummonerForm(form); expect(actor.maxHp).toBe(form.hp + 7); expect(actor.hp).toBe(15);
    });
});

describe('EXT-1b Game adapter assembly', () => {
    it('rejects an impossible native strength base before retiring the currently live world', () => {
        const registry = new ExtensionRegistry(); registry.register('policy-test', '1.0.0', () => factory({
            nativeBonuses: () => ({ maxHp: 0, strength: 5 }),
        }));
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        const game = createHeadlessGame(9304, 'test');
        game.startNewGame({ seed: 9304, mode: 'test', ruleSet: 'extended', extensions: ['policy-test'] });
        const forged = game.toSnapshot(); forged.player.strength = 5;
        const previousPlayer = game.player, previousRuntime = game.extensionRuntime, before = rng.getState();
        expect(game.loadSnapshot(forged)).toBe(false);
        expect(game.player).toBe(previousPlayer); expect(game.extensionRuntime).toBe(previousRuntime); expect(rng.getState()).toEqual(before);
    });
    it('binds adapters on extended load and removes them when loading a classic snapshot', () => {
        const search = vi.fn((input: ExtensionRuleInput) => input.baseValue);
        const registry = new ExtensionRegistry(); registry.register('policy-test', '1.0.0', () => factory({ searchStrength: search }));
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        const game = createHeadlessGame(9302, 'test'), classic = game.toSnapshot();
        game.startNewGame({ seed: 9302, mode: 'test', ruleSet: 'extended', extensions: ['policy-test'] });
        const snapshot = game.toSnapshot(), other = createHeadlessGame(9303, 'test');
        expect(other.loadSnapshot(snapshot)).toBe(true); search.mockClear();
        (other as unknown as { searchForSecrets(n: number): void }).searchForSecrets(30); expect(search).toHaveBeenCalledTimes(1);
        expect(other.loadSnapshot(classic)).toBe(true); search.mockClear();
        (other as unknown as { searchForSecrets(n: number): void }).searchForSecrets(30); expect(search).not.toHaveBeenCalled();
    });
    it('shares manual/automatic search input, preserves invisible stealth and removes adapters on classic restart', () => {
        const search = vi.fn((input: ExtensionRuleInput) => input.baseValue + 16), stealth = vi.fn((input: ExtensionRuleInput) => Math.max(1, input.baseValue - 2));
        const registry = new ExtensionRegistry(); registry.register('policy-test', '1.0.0', () => factory({ searchStrength: search, stealthRange: stealth }));
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        const game = createHeadlessGame(9301, 'test'); game.startNewGame({ seed: 9301, mode: 'test', ruleSet: 'extended', extensions: ['policy-test'] });
        const view = game as unknown as { searchForSecrets(n: number): boolean; manualSearch(): void; calculateStealthRange(): number };
        search.mockClear(); view.searchForSecrets(30);
        game.grid.getCell(game.player.x, game.player.y)!.autoSearched = false;
        view.manualSearch();
        expect(search.mock.calls[0]![0]).toMatchObject({ mode: 'automatic', baseValue: 30 });
        expect(search.mock.calls.slice(1).map(call => ({ mode: call[0].mode, base: call[0].baseValue }))).toEqual([
            { mode: 'manual', base: 60 }, { mode: 'automatic', base: 30 },
        ]);
        game.player.setStatusDuration('invisible', 5); stealth.mockClear(); expect(view.calculateStealthRange()).toBe(1); expect(stealth).not.toHaveBeenCalled();
        game.startNewGame({ seed: 9301, mode: 'test', ruleSet: 'classic' }); search.mockClear(); stealth.mockClear();
        view.searchForSecrets(30); view.calculateStealthRange(); expect(search).not.toHaveBeenCalled(); expect(stealth).not.toHaveBeenCalled();
    });
});
