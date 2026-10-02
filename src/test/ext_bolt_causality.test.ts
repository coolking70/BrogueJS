import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as creatureFeatures from '../engine/Combat/CreatureFeatures';
import { Game } from '../engine/Core/Game';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { EnvironmentManager } from '../engine/Environment/Gas';
import { Player } from '../entities/Player';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { Item, ItemCategory } from '../engine/Items/Item';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { getBoltForItem, type BoltResult } from '../engine/Combat/Bolt';
import { rng } from '../engine/Random';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import { EffectCausality, type EffectOrigin } from '../ext/causality';
import type { HookEvents } from '../ext/types';

// This is the existing W-4 arena: real trajectory, reflection decisions,
// contacts and terrain execute, without unrelated level generation/turns.
function scene(extended = true): Game {
    const game = Object.create(Game.prototype) as Game;
    game.grid = new Grid(18, 12);
    for (let x = 0; x < 18; x++) for (let y = 0; y < 12; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR);
        game.grid.getCell(x, y)!.isVisible = true;
        game.grid.getCell(x, y)!.hasMemory = true;
    }
    game.player = new Player(4, 5);
    game.player.hp = game.player.maxHp = 100;
    game.monsters = []; game.dormantMonsters = []; game.items = []; game.levels = new Map();
    game.recordedInputEvents = []; game.stats = { kills: 0, gold: 0, maxDepth: 1, turns: 0 };
    game.visibleMonsters = new Set();
    game.environment = new EnvironmentManager(game.grid);
    game.spawnFloatingText = vi.fn();
    (game as unknown as { updateVision(): void }).updateVision = vi.fn();
    vi.spyOn(creatureFeatures, 'spawnCreatureBlood').mockReturnValue(null);
    game.extensionRuntime = null;
    if (extended) {
        const registry = new ExtensionRegistry();
        game.extensionRuntime = new ExtensionRuntime(registry, registry.manifest([]), {
            playerId: () => game.player.id, depth: () => 1, randomInt: (min, max) => rng.randRange(min, max), message: vi.fn(),
        });
        game.extensionRuntime.attachCreature(game.player, false);
    }
    return game;
}
function monster(game: Game, x = 8, y = 5, species = 'rat'): Monster {
    const creature = new Monster(x, y, (monsters as MonsterData[]).find(entry => entry.id === species)!);
    creature.hp = creature.maxHp = 100;
    game.monsters.push(creature);
    return creature;
}
function zap(game: Game, identity = 'staff_of_fire', aim = { x: 8, y: 5 }): BoltResult {
    const item = new Item(identity, '/', 0xff6600, ItemCategory.STAFF);
    Object.assign(item, { identityId: identity, enchantment: 2, maxCharges: 2, charges: 2, arcanaInstanceVersion: 1 });
    return game.zapBoltFromPlayer(getBoltForItem(identity)!, item, aim);
}
function damageEvents(game: Game) {
    const emit = vi.spyOn(game.extensionRuntime!, 'emit');
    return () => emit.mock.calls.filter(([name]) => name === 'damage').map(([, event]) => event as HookEvents['damage']);
}
function reflectionArmor(game: Game): void {
    const armor = new Item('reflection armor', ']', 0xffffff, ItemCategory.ARMOR);
    armor.runicType = 'reflection'; armor.enchantment = 50; armor.strengthRequired = game.player.strength;
    game.player.equippedArmor = armor;
}
beforeEach(() => {
    ItemLoader.identifiedItems.clear();
    rng.seedRandomGenerator(4404);
});
afterEach(() => vi.restoreAllMocks());

describe('extension bolt causal contacts', () => {
    it('credits a direct player fire hit and its burning rider, but no terrain exposure', () => {
        const game = scene(), target = monster(game), events = damageEvents(game);
        const causality = game.extensionRuntime!.causality, terrain: Array<EffectOrigin | null> = [];
        const ignite = game.environment.ignite.bind(game.environment);
        vi.spyOn(game.environment, 'ignite').mockImplementation((...args) => {
            terrain.push(causality.current); return ignite(...args);
        });
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        zap(game);
        expect(events()).toHaveLength(1);
        expect(events()[0]).toMatchObject({ hpBefore: 100, hpLost: 3, damageKind: 'fire', origin: {
            kind: 'bolt', actorId: game.player.id, creditActorId: game.player.id,
            creditPartyId: `player:${game.player.id}`, parentEffectId: null,
        } });
        expect(causality.statusOrigin(target.id, 'burning')).toEqual(events()[0]!.origin);
        expect(terrain.length).toBeGreaterThan(0); expect(terrain.every(origin => origin === null)).toBe(true);
        expect(causality.current).toBeNull();
    });

    it('keeps poison application under the bolt origin without inventing an immediate damage fact', () => {
        const game = scene(), target = monster(game), events = damageEvents(game);
        zap(game, 'staff_of_poison');
        expect(target.getStatusDuration('poisoned')).toBeGreaterThan(0);
        expect(events()).toEqual([]);
        expect(game.extensionRuntime!.causality.statusOrigin(target.id, 'poisoned')).toMatchObject({
            kind: 'bolt', actorId: game.player.id, creditActorId: game.player.id, creditPartyId: `player:${game.player.id}`,
        });
    });

    it.each([false, true])('records the allied=%s monster caster and fire damage kind', allied => {
        const game = scene(), caster = monster(game), events = damageEvents(game);
        caster.isAlly = allied;
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        game.castMonsterBolt(caster, game.player, 'FIRE');
        expect(events()).toHaveLength(1);
        expect(events()[0]).toMatchObject({ damageKind: 'fire', origin: {
            kind: 'bolt', actorId: caster.id, creditActorId: caster.id,
            creditPartyId: allied ? `player:${game.player.id}` : null,
        } });
        expect(game.extensionRuntime!.causality.statusOrigin(game.player.id, 'burning')).toEqual(events()[0]!.origin);
    });

    it.each([false, true])('takes responsibility from the real allied=%s creature reflector without changing caster', allied => {
        const game = scene(), reflector = monster(game, 8, 5, 'stone_guardian'), events = damageEvents(game);
        reflector.isAlly = allied;
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        const result = zap(game);
        expect(result.caster).toBe(game.player);
        expect(result.reflections.map(reflection => reflection.creature)).toEqual([reflector]);
        expect(result.hits.map(hit => hit.creature)).toEqual([game.player]);
        const origin = events()[0]!.origin!;
        expect(origin).toMatchObject({ kind: 'reflection', actorId: game.player.id,
            creditActorId: reflector.id, creditPartyId: allied ? `player:${game.player.id}` : null,
            rootEffectId: origin.parentEffectId,
        });
        expect(origin.effectId).toBeGreaterThan(origin.rootEffectId);
        expect(game.extensionRuntime!.causality.statusOrigin(game.player.id, 'burning')).toEqual(origin);
    });

    it('a player reflection credits the player while a monster bolt keeps its mechanical caster', () => {
        const game = scene(), caster = monster(game), events = damageEvents(game);
        reflectionArmor(game);
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        const result = game.castMonsterBolt(caster, game.player, 'SPARK')!;
        expect(result.caster).toBe(caster);
        expect(result.reflections.map(reflection => reflection.creature)).toEqual([game.player]);
        expect(result.hits.map(hit => hit.creature)).toEqual([caster]);
        expect(events()[0]).toMatchObject({ damageKind: 'other', origin: { kind: 'reflection',
            actorId: caster.id, creditActorId: game.player.id, creditPartyId: `player:${game.player.id}` } });
    });

    it('piercing contacts before and after reflection retain their distinct current origin', () => {
        const game = scene(), first = monster(game, 6), reflector = monster(game, 10, 5, 'stone_guardian');
        const events = damageEvents(game);
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        const result = zap(game, 'staff_of_lightning', first.loc);
        expect(result.hits.map(hit => hit.creature)).toEqual([first, first, game.player]);
        const origins = events().map(event => event.origin!);
        expect(origins[0]).toMatchObject({ kind: 'bolt', actorId: game.player.id, creditActorId: game.player.id });
        expect(origins[1]).toMatchObject({ kind: 'reflection', actorId: game.player.id, creditActorId: reflector.id,
            parentEffectId: origins[0]!.effectId, rootEffectId: origins[0]!.effectId });
        expect(origins[2]).toEqual(origins[1]);
    });

    it('wall reflection clears credit instead of assigning the eventual bystander as reflector', () => {
        const game = scene(), bystander = monster(game, 7, 8), events = damageEvents(game);
        game.grid.setTerrain(8, 5, TerrainType.CRYSTAL_WALL);
        vi.spyOn(rng, 'randRange').mockImplementation((min, max) => max === 39 ? 16 : min);
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        const result = zap(game);
        expect(result.reflections.map(reflection => reflection.creature)).toEqual([null]);
        expect(result.hits.map(hit => hit.creature)).toEqual([bystander]);
        expect(events()[0]!.origin).toMatchObject({ kind: 'reflection', actorId: game.player.id,
            creditActorId: null, creditPartyId: null });
    });

    it('a wall after a creature reflection clears that earlier creature responsibility', () => {
        const game = scene(), reflector = monster(game, 8, 5, 'golem'), bystander = monster(game, 5, 6);
        const events = damageEvents(game);
        game.grid.setTerrain(8, 7, TerrainType.CRYSTAL_WALL);
        vi.spyOn(rng, 'randPercent').mockReturnValueOnce(true).mockReturnValue(false);
        let direction = 0;
        vi.spyOn(rng, 'randRange').mockImplementation((min, max) => max === 39 ? (direction++ === 0 ? 16 : 26) : min);
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        const result = zap(game);
        expect(result.reflections.map(reflection => reflection.creature)).toEqual([reflector, null]);
        expect(result.hits.map(hit => hit.creature)).toEqual([bystander]);
        expect(events()[0]!.origin).toMatchObject({ kind: 'reflection', actorId: game.player.id,
            creditActorId: null, creditPartyId: null });
        expect(events()[0]!.origin!.parentEffectId).toBeGreaterThan(events()[0]!.origin!.rootEffectId);
    });

    it('each actual creature reflection supersedes the previous responsibility', () => {
        const game = scene(), reflector = monster(game, 8, 5, 'stone_guardian'), bystander = monster(game, 4, 8);
        const events = damageEvents(game);
        reflectionArmor(game);
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        vi.spyOn(rng, 'randRange').mockImplementation((min, max) => max === 39 ? 16 : min);
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        const result = zap(game);
        expect(result.reflections.map(reflection => reflection.creature)).toEqual([reflector, game.player]);
        expect(result.hits.map(hit => hit.creature)).toEqual([bystander]);
        expect(events()[0]!.origin).toMatchObject({ kind: 'reflection', actorId: game.player.id,
            creditActorId: game.player.id, creditPartyId: `player:${game.player.id}` });
        expect(events()[0]!.origin!.parentEffectId).toBeGreaterThan(events()[0]!.origin!.rootEffectId);
    });

    it('BE_ATTACK preserves the bolt context through its physical hit and poison rider', () => {
        const game = scene(), caster = monster(game, 8, 5, 'dart_turret'), events = damageEvents(game);
        caster.damageString = '6'; caster.abilityFlags.add('MA_POISONS');
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        game.castMonsterBolt(caster, game.player, 'POISON_DART');
        expect(events()).toHaveLength(1);
        expect(events()[0]).toMatchObject({ damageKind: 'physical', origin: {
            kind: 'bolt', actorId: caster.id, creditActorId: caster.id, creditPartyId: null,
        } });
        expect(game.extensionRuntime!.causality.statusOrigin(game.player.id, 'poisoned')).toEqual(events()[0]!.origin);
    });

    it.each(['player', 'monster'])('%s blink carries a bounded bolt source into actual landing placement', actor => {
        const game = scene(), caster = actor === 'player' ? game.player : monster(game, 4, 7);
        const causality = game.extensionRuntime!.causality, origins: Array<EffectOrigin | null> = [];
        const place = game.placeCreature.bind(game);
        vi.spyOn(game, 'placeCreature').mockImplementation((...args) => {
            origins.push(causality.current); return place(...args);
        });
        const before = { ...caster.loc };
        const result = actor === 'player' ? zap(game, 'staff_of_blinking', { x: 6, y: 5 })
            : game.castMonsterBlink(caster as Monster, { x: 6, y: 7 });
        expect(result.hits).toEqual([]);
        expect(caster.loc).not.toEqual(before);
        expect(origins).toHaveLength(1);
        expect(origins[0]).toMatchObject({ kind: 'bolt', actorId: caster.id, creditActorId: caster.id,
            creditPartyId: actor === 'player' ? `player:${game.player.id}` : null });
        expect(causality.current).toBeNull(); expect(causality.terrainOrigin).toBeNull();
    });

    it('masks an unrelated outer scope for terrain and restores it after a contact exception', () => {
        const game = scene(), target = monster(game), causality = game.extensionRuntime!.causality;
        const outer = causality.create('melee', target.id), terrain: Array<EffectOrigin | null> = [];
        vi.spyOn(game.environment, 'ignite').mockImplementation(() => { terrain.push(causality.current); });
        vi.spyOn(target, 'takeDamage').mockImplementation(() => { throw new Error('contact failure'); });
        causality.withOrigin(outer, () => {
            expect(() => zap(game)).toThrow('contact failure');
            expect(causality.current).toBe(outer);
        });
        expect(terrain.length).toBeGreaterThan(0); expect(terrain.every(origin => origin === null)).toBe(true);
        expect(causality.current).toBeNull();
    });

    it('classic bolts invoke no effect creation or extension scope', () => {
        const game = scene(false); monster(game, 8, 5, 'stone_guardian');
        const create = vi.spyOn(EffectCausality.prototype, 'create'), scope = vi.spyOn(EffectCausality.prototype, 'withOrigin');
        vi.spyOn(rng, 'randClumpedRange').mockReturnValue(3);
        expect(zap(game).hits.map(hit => hit.creature)).toEqual([game.player]);
        expect(game.player.hp).toBe(97);
        expect(create).not.toHaveBeenCalled(); expect(scope).not.toHaveBeenCalled();
    });
});
