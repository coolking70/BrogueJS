import { appliedGrowth } from '../../../../test/support/legacyStats';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import { getNextEntityId, type Creature } from '../../../../entities/Creature';
import monsters from '../../../../data/monsters.json';
import { DCOLS, DROWS, TerrainType } from '../../../../engine/Map/Grid';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { rng } from '../../../../engine/Random';
import { markCreatureBirth, readCreatureBirth } from '../../../../ext/birth';
import type { GrowthState } from '../state';
import type { GrowthDerived, GrowthProgression } from '../components';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack } from '../types';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { automaticMaxHpBonus, experienceThreshold } from '../experience';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

afterEach(() => vi.restoreAllMocks());
const species = (id: string): MonsterData => (monsters as MonsterData[]).find(monster => monster.id === id)!;
const state = (game: Game): GrowthState => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const progression = (game: Game, id = game.player.id): GrowthProgression => game.extensionRuntime!.snapshot().components[id]!['growth:progression'] as GrowthProgression;
const derived = (game: Game, id: number): GrowthDerived => appliedGrowth(game.extensionRuntime!,id);
const create = (game: Game): void => game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
function newGame(mode: 'test' | 'normal' = 'test'): Game {
    const game = createHeadlessGame(91013, 'test');
    game.startNewGame({ seed: 91013, mode, ruleSet: 'extended' }); create(game); return game;
}
/** Fixture callbacks are explicitly world-only and never used as replay evidence. */
function scene(): Game {
    const game = newGame(); game.clearRecording();
    game.monsters = []; game.dormantMonsters = []; game.items = []; game.player.loc = { x: 4, y: 5 };
    for (let x = 1; x < DCOLS - 1; x++) for (let y = 1; y < DROWS - 1; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR);
        Object.assign(game.grid.getCell(x, y)!, { isVisible: true, isDiscovered: true });
    }
    flush(game); return game;
}
function flush(game: Game): void { game.executeCommand('growth-lifecycle-fixture', undefined, () => undefined); }
function addMonster(game: Game, id = 'rat', x = 12, y = 5, hp?: number): Monster {
    const monster = new Monster(x, y, species(id));
    if (hp !== undefined) monster.hp = hp;
    markCreatureBirth(monster, 'natural'); game.monsters.push(monster); return monster;
}
function kill(game: Game, target: Monster, source: Creature = game.player): void {
    const runtime = game.extensionRuntime!, origin = runtime.causality.create('melee', source.id, source.id, source.extensionHooks?.partyId(source) ?? null);
    runtime.causality.withOrigin(origin, () => game.killMonster(target));
}
function configured(change: (pack: GrowthDefinitionPack) => void): GrowthDefinitionPack {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack; change(pack);
    const validated = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(validated, identity), identity); return registry;
    });
    return pack;
}
function cheapLevels(): GrowthDefinitionPack {
    return configured(pack => { pack.config.levels.experience = { kind: 'curve', base: 1, linear: 0, quadratic: 0 }; });
}
function levelMonster(game: Game, monster: Monster): void {
    kill(game, addMonster(game, 'rat', 20, 5), monster); flush(game);
    expect(progression(game, monster.id).level).toBeGreaterThan(1);
    expect(derived(game, monster.id).appliedMaxHp).toBeGreaterThan(0);
}
function finishAnimation(game: Game): void {
    for (let step = 0; step < 100 && game.isAdvancing; step++) game.stepAdvancement();
    expect(game.isAdvancing).toBe(false); expect(game.lastAdvancementError).toBeNull();
}
function standOn(game: Game, terrain: TerrainType): void {
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        if (game.grid.getCell(x, y)?.layers.includes(terrain)) { game.player.loc = { x, y }; return; }
    }
    throw new Error('Fixture could not find the generated stairs');
}

describe('EXT-1a native growth lifecycle regressions', () => {
    it('a leveled summoner keeps its own bonus while fresh summoned bodies receive their native HP', () => {
        cheapLevels(); const game = scene(), summoner = addMonster(game, 'goblin_conjurer'); levelMonster(game, summoner);
        const maxHp = summoner.maxHp, bonus = derived(game, summoner.id).appliedMaxHp;
        expect(maxHp).toBe(species('goblin_conjurer').hp + bonus);
        expect(game.summonMinionsFor(summoner)).toBe(true);
        const children = game.monsters.filter(monster => readCreatureBirth(monster)?.creationReason === 'summoned');
        expect(children.length).toBeGreaterThan(0);
        for (const child of children) {
            expect(readCreatureBirth(child)?.sourceId).toBe(summoner.id);
            expect(child.maxHp).toBe(species(child.typeId).hp);
            expect(derived(game, child.id).appliedMaxHp).toBe(0);
            expect(progression(game, child.id).level).toBe(1);
        }
        expect(summoner.maxHp).toBe(maxHp); expect(derived(game, summoner.id).appliedMaxHp).toBe(bonus);
    });
    it('cloning removes copied automatic HP exactly once and never creation-heals an injured NPC', () => {
        cheapLevels(); const game = scene(), source = addMonster(game, 'goblin_conjurer'); levelMonster(game, source);
        source.hp = 3; const sourceMaximum = source.maxHp;
        const clone = game.cloneMonster(source)!; expect(clone).not.toBeNull();
        expect(clone.maxHp).toBe(species('goblin_conjurer').hp); expect(clone.hp).toBe(3);
        expect(progression(game, clone.id)).toMatchObject({ level: 1, experience: 0, attributePoints: 0, skillPoints: 0 });
        expect(derived(game, clone.id)).toEqual({ appliedStrength: 0, appliedMaxHp: 0 });
        const injuredBirth = addMonster(game, 'rat', 24, 5, 2); expect(injuredBirth.hp).toBe(2);
        flush(game); flush(game);
        expect(clone.maxHp).toBe(species('goblin_conjurer').hp); expect(clone.hp).toBe(3); expect(source.maxHp).toBe(sourceMaximum);
    });
    it('genuine jelly splitting preserves the source bonus while the new body sheds copied growth once', () => {
        cheapLevels(); const game = scene(), source = addMonster(game, 'pink_jelly'); levelMonster(game, source);
        source.hp = 17; const sourceMaximum = source.maxHp;
        (game as any).trySplitMonster(source, game.player);
        const clone = game.monsters.find(monster => readCreatureBirth(monster)?.creationReason === 'split')!;
        expect(clone).toBeDefined(); expect(readCreatureBirth(clone)?.sourceId).toBe(source.id);
        expect(source.hp).toBe(9); expect(clone.hp).toBe(9);
        expect(source.maxHp).toBe(sourceMaximum); expect(clone.maxHp).toBe(species('pink_jelly').hp);
        expect(derived(game, clone.id).appliedMaxHp).toBe(0);
        flush(game); expect(clone.maxHp).toBe(species('pink_jelly').hp);
    });
    it('polymorph reapplies earned auto-HP once, then further leveling and repeated world loads retain the native base', () => {
        const pack = cheapLevels(), game = scene(), source = addMonster(game, 'goblin_conjurer'); levelMonster(game, source);
        const id = source.id, earned = derived(game, id).appliedMaxHp;
        source.hp = 3; expect(source.polymorph(() => undefined)).toBe(true);
        const transformedBase = species(source.typeId).hp;
        expect(source.maxHp).toBe(transformedBase + earned); expect(source.hp).toBeLessThan(source.maxHp);
        kill(game, addMonster(game, 'rat', 25, 5), source); flush(game);
        const expectedBonus = automaticMaxHpBonus(pack.config.levels, progression(game, id).level);
        expect(source.maxHp).toBe(transformedBase + expectedBonus);
        const expectedHp = source.hp, expectedState = game.extensionRuntime!.snapshot();
        for (let index = 0; index < 3; index++) {
            const saved = game.toSaveSnapshot(); expect(saved.run.recordingOrigin).toBeUndefined();
            expect(game.loadSnapshot(saved)).toBe(true);
            const restored = game.monsters.find(monster => monster.id === id)!;
            expect(restored.maxHp).toBe(transformedBase + expectedBonus); expect(restored.hp).toBe(expectedHp);
            expect(game.extensionRuntime!.snapshot()).toEqual(expectedState);
        }
    });
    it('actual ally resurrection restores an entering-summons form with its earned bonus and bounded native health', () => {
        const pack = cheapLevels(), game = scene(), source = addMonster(game, 'vampire'); levelMonster(game, source);
        game.becomeAllyWith(source);
        const earned = derived(game, source.id).appliedMaxHp, before = progression(game, source.id);
        // Native empowerment makes pre-reset healing exceed the form's catalog maximum.
        expect(source.empower()).toBe(true);
        expect(source.maxHp).toBe(species('vampire').hp + earned + 12);
        kill(game, source); (game as any).removeDeadMonsters(); flush(game);
        expect(game.purgatory).toContain(source); expect(source.hp).toBe(0);
        expect(game.resurrectAlly(game.player.loc)).toBe(true); flush(game);
        expect(game.monsters).toContain(source); expect(game.purgatory).not.toContain(source);
        expect(source.maxHp).toBe(species('vampire').hp + earned); expect(source.hp).toBe(source.maxHp);
        expect(progression(game, source.id)).toEqual(before); expect(derived(game, source.id).appliedMaxHp).toBe(earned);
        kill(game, addMonster(game, 'rat', 25, 5), source); flush(game);
        const finalMaximum = species('vampire').hp + automaticMaxHpBonus(pack.config.levels, progression(game, source.id).level);
        expect(source.maxHp).toBe(finalMaximum);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.monsters.find(monster => monster.id === source.id)!.maxHp).toBe(finalMaximum);
    });
    it('rejects fractional or over-maximum loaded native HP without retiring the current growth run', () => {
        const game = scene(), saved = game.toSaveSnapshot(), player = game.player, runtime = game.extensionRuntime;
        const before = runtime!.snapshot(), random = rng.getState(), nextId = getNextEntityId();
        for (const change of [(snapshot: typeof saved) => { snapshot.player.hp = 0.5; },
            (snapshot: typeof saved) => { snapshot.player.maxHp += 0.5; },
            (snapshot: typeof saved) => { snapshot.player.hp = snapshot.player.maxHp + 1; }]) {
            const malformed = structuredClone(saved); change(malformed);
            expect(game.loadSnapshot(malformed)).toBe(false); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
            expect(runtime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(nextId);
        }
    });
    it.each(['cleared', 'world-only-loaded'] as const)('settles an animated native melee kill before saving with %s recording provenance', provenance => {
        const game = scene(), target = addMonster(game, 'rat', 5, 5, 1);
        target.state = MonsterState.ASLEEP; flush(game);
        if (provenance === 'world-only-loaded') expect(game.loadSnapshot(game.toSnapshot())).toBe(true);
        else game.clearRecording();
        const victim = game.monsters.find(monster => monster.id === target.id)!;
        const quote = (game.extensionRuntime!.snapshot().components[victim.id]!['growth:reward'] as { amount: number }).amount;
        const before = progression(game).experience;
        game.animationEnabled = true; game.executeCommand('move', { x: 1, y: 0 });
        expect(victim.hp).toBe(0); expect(game.isAdvancing).toBe(true);
        expect(progression(game).experience).toBe(before); expect(state(game).pending).toHaveLength(1);
        finishAnimation(game);
        expect(progression(game).experience).toBe(before + quote); expect(state(game).pending).toEqual([]);
        expect(game.hasCompleteRecording).toBe(false); expect(game.recordedInputEvents).toEqual([]);
        const saved = game.toSaveSnapshot(); expect(saved.run.recordingOrigin).toBeUndefined();
        expect(saved.extensions).toEqual(game.extensionRuntime!.snapshot()); expect(game.loadSnapshot(saved)).toBe(true);
        expect(progression(game).experience).toBe(before + quote);
    });
    it('rejects malformed or unavailable extension input after creation before touching recording, RNG, or automation', () => {
        const game = newGame(); game.autoPath = [{ x: game.player.x + 1, y: game.player.y }]; game.isMouseTraveling = true;
        const path = structuredClone(game.autoPath), before = game.extensionRuntime!.snapshot(), random = rng.getState();
        const events = structuredClone(game.recordedInputEvents), player = { ...game.player.loc };
        for (const input of [undefined, {}, '', '{', 'null', '[]', '{}',
            JSON.stringify({ module: 'missing', action: 'noop', payload: {} }),
            JSON.stringify({ module: 'growth', action: 'allocate', payload: {} }),
            JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 }, extra: true }),
            JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } })]) {
            expect(() => game.executeCommand('ext:command', input)).not.toThrow();
            expect(game.extensionRuntime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
            expect(game.recordedInputEvents).toEqual(events); expect(game.hasCompleteRecording).toBe(true);
            expect(game.autoPath).toEqual(path); expect(game.isMouseTraveling).toBe(true); expect(game.player.loc).toEqual(player);
        }
    });
    it('uses actual generated D2 stairs and never pays another first-visit award on revisit or load', () => {
        const game = newGame('normal'); game.clearRecording();
        expect(state(game).visitedDepths).toContain(1); expect(progression(game).experience).toBe(0);
        standOn(game, TerrainType.STAIRS_DOWN); game.executeCommand('stairs_down');
        expect(game.depth).toBe(2); expect(progression(game).experience).toBe(30);
        expect(state(game).visitedDepths).toEqual([1, 2]);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(progression(game).experience).toBe(30);
        standOn(game, TerrainType.STAIRS_UP); game.executeCommand('stairs_up'); expect(game.depth).toBe(1);
        standOn(game, TerrainType.STAIRS_DOWN); game.executeCommand('stairs_down'); expect(game.depth).toBe(2);
        expect(progression(game).experience).toBe(30); expect(state(game).visitedDepths).toEqual([1, 2]);
    });
});

describe('EXT-1a native kind-knowledge callback and exact configuration limits', () => {
    it('does not report equipment instance identification, pickup, or detection as a newly known kind', () => {
        const game = scene(), emit = vi.spyOn(game.extensionRuntime!, 'emit');
        const weapon = ItemLoader.spawnWeapon('dagger', -1, -1)!, armor = ItemLoader.spawnArmor('leather_armor', -1, -1)!;
        const potion = ItemLoader.spawnPotion('potion_of_strength', -1, -1)!;
        ItemLoader.identifyInstance(weapon); ItemLoader.identifyInstance(armor); ItemLoader.detectMagicOnItem(potion);
        game.player.inventory.addItem(potion); flush(game);
        expect(emit.mock.calls.filter(([name]) => name === 'itemKnowledgeChanged')).toEqual([]);
        expect(progression(game).experience).toBe(0);
        ItemLoader.identifyItemKind(potion); flush(game);
        expect(emit.mock.calls.filter(([name]) => name === 'itemKnowledgeChanged')).toHaveLength(1);
        expect(progression(game).experience).toBe(10);
        ItemLoader.identifyInstance(potion); ItemLoader.identifyItemKind(potion); flush(game);
        expect(emit.mock.calls.filter(([name]) => name === 'itemKnowledgeChanged')).toHaveLength(1);
        expect(progression(game).experience).toBe(10);
    });
    it('pays an actually deduced final kind through the native knowledge callback exactly once', () => {
        configured(pack => { pack.config.experience.identification.perKind = 3; pack.config.experience.identification.totalCap = 100; });
        const game = scene(), emit = vi.spyOn(game.extensionRuntime!, 'emit');
        const positive = ItemLoader.potions.filter(potion => ItemLoader.kindPolarity(potion.id) === 1).map(potion => potion.id);
        const last = 'potion_of_life'; expect(positive).toContain(last);
        ItemLoader.detectMagicOnItem(ItemLoader.spawnPotion(last, -1, -1)!);
        expect(ItemLoader.identifiedItems.has(last)).toBe(false);
        for (const id of positive.filter(id => id !== last)) ItemLoader.identifyItemKind(ItemLoader.spawnPotion(id, -1, -1)!);
        expect(ItemLoader.identifiedItems.has(last)).toBe(true);
        const facts = emit.mock.calls.filter(([name]) => name === 'itemKnowledgeChanged');
        expect(facts.filter(([, event]) => (event as { kindId?: string }).kindId === last)).toHaveLength(1);
        flush(game); expect(progression(game).experience).toBe(positive.length * 3);
        ItemLoader.identifyItemKind(ItemLoader.spawnPotion(last, -1, -1)!); flush(game);
        expect(progression(game).experience).toBe(positive.length * 3);
    });
    it.each(['disabled', 'category-excluded', 'capped'] as const)('honors %s identification configuration while retaining first-kind receipts', rule => {
        configured(pack => {
            pack.config.experience.identification.perKind = 7; pack.config.experience.identification.totalCap = 10;
            if (rule === 'disabled') pack.config.experience.sources.identification = false;
            if (rule === 'category-excluded') pack.config.experience.identification.categories = ['scroll'];
        });
        const game = scene();
        for (const id of ['potion_of_strength', 'potion_of_life', 'potion_of_telepathy', 'potion_of_strength']) {
            ItemLoader.identifyItemKind(ItemLoader.spawnPotion(id, -1, -1)!); flush(game);
        }
        const expected = rule === 'capped' ? 10 : 0;
        expect(progression(game).experience).toBe(expected); expect(state(game).identificationAwarded).toBe(expected);
        expect(state(game).identifiedKinds).toContain('potion_of_telepathy');
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        ItemLoader.identifyItemKind(ItemLoader.spawnPotion('potion_of_strength', -1, -1)!); flush(game);
        expect(progression(game).experience).toBe(expected);
    });
    it('accepts the exact safe curve boundary and rejects cumulative curve or point overflow at pack loading', () => {
        const pack = structuredClone(data) as unknown as GrowthDefinitionPack, options = { moduleVersion: pack.moduleVersion, hasText: () => true };
        const n = BigInt(pack.config.levels.cap - 1), squares = n * (n + 1n) * (2n * n + 1n) / 6n;
        const coefficient = Number(BigInt(Number.MAX_SAFE_INTEGER) / squares);
        pack.config.levels.experience = { kind: 'curve', base: 0, linear: 0, quadratic: coefficient };
        expect(() => parseGrowthDefinitionPack(pack, options)).not.toThrow();
        expect(experienceThreshold(pack.config.levels, pack.config.levels.cap)).toBe(Number(BigInt(coefficient) * squares));
        pack.config.levels.experience.quadratic++;
        expect(() => parseGrowthDefinitionPack(pack, options)).toThrow();
        pack.config.levels.experience = { kind: 'curve', base: 1, linear: 0, quadratic: 0 };
        pack.config.levels.attributePoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: Number.MAX_SAFE_INTEGER };
        expect(() => parseGrowthDefinitionPack(pack, options)).toThrow();
    });
});
