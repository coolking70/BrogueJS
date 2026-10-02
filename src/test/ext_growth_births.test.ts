import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game, type HordeEntry } from '../engine/Core/Game';
import { buildHordeMachine } from '../engine/Core/GenerationCoordinator';
import { BlueprintEngine, type BlueprintDef, type MachineEntityRuntime, type MachineResult } from '../engine/Generator/BlueprintEngine';
import { TerrainType, DCOLS, DROWS } from '../engine/Map/Grid';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { getBoltForItem, BoltEffect } from '../engine/Combat/Bolt';
import { CEBoltType } from '../engine/Combat/BoltCatalog';
import { rng } from '../engine/Random';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import * as births from '../ext/birth';
import { ExtensionRuntime } from '../ext/runtime';
import { createHeadlessGame } from './harness';

afterEach(() => vi.restoreAllMocks());
const data = (id: string) => (monsters as MonsterData[]).find(row => row.id === id)!;
const fact = (monster: Monster) => births.readCreatureBirth(monster);

function gameScene(extended = true): Game {
    const game = createHeadlessGame(8173, 'test');
    if (extended) game.startNewGame({ seed: 8173, mode: 'test', ruleSet: 'extended', extensions: ['example'] });
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.player.loc = { x: 4, y: 5 };
    for (let x = 1; x < DCOLS - 1; x++) for (let y = 1; y < DROWS - 1; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR);
        Object.assign(game.grid.getCell(x, y)!, { isVisible: true, isDiscovered: true });
    }
    return game;
}

function horde(flags: string[] = [], machine = 0): HordeEntry {
    return { leader: 'RAT', minLevel: 1, maxLevel: 26, spawnsIn: null, frequency: 1, machine, flags,
        members: [{ type: 'KOBOLD', minCount: 1, maxCount: 1, clumpFactor: 1 }] };
}

function addMonster(game: Game, id: string, x = 9, y = 5): Monster {
    const monster = new Monster(x, y, data(id));
    game.monsters.push(monster);
    return monster;
}

function machineFixture(features?: BlueprintDef['features']) {
    const cells = [];
    for (let x = 10; x < 20; x++) for (let y = 8; y < 16; y++) cells.push({ x, y });
    const bp: BlueprintDef = { id: 'birth-fixture', name: 'birth-fixture', category: 'thematic',
        depthRange: [1, 26], roomSize: [1, 900], frequency: 1, flags: ['BP_NO_INTERIOR_FLAG'],
        features: features ?? [{ instanceCount: [1, 1], flags: [], monsterId: 'goblin' }] };
    const room = { cells, center: { x: 15, y: 12 }, door: null };
    vi.spyOn(BlueprintEngine.prototype, 'buildAMachine').mockImplementation(function (this: BlueprintEngine) {
        let nextX = 13;
        vi.spyOn(this as any, 'findFeaturePosition').mockImplementation(() => ({ x: nextX++, y: 12 }));
        return (this as any).applyBlueprint(bp, room);
    });
    return room;
}

describe('EXT-1a immutable engine birth metadata', () => {
    it('captures original species and initial hostility once, without adding serialized creature fields', () => {
        const game = gameScene();
        (game as any).spawnHordeAt(horde(), { x: 15, y: 12 }, 1, false);
        const monster = game.monsters[0]!;
        const keys = Object.keys(monster);
        expect(fact(monster)).toEqual({ creationReason: 'natural', originalMonsterType: 'rat', initiallyHostile: true, sourceId: null, nativeStatsCopied: false });
        expect(Object.isFrozen(fact(monster))).toBe(true);
        monster.typeId = 'dragon'; monster.hp = 1; monster.isAlly = true;
        births.markCreatureBirth(monster, 'summoned', game.player.id);
        expect(fact(monster)).toEqual({ creationReason: 'natural', originalMonsterType: 'rat', initiallyHostile: true, sourceId: null, nativeStatsCopied: false });
        expect(Object.keys(monster)).toEqual(keys);
        expect(JSON.stringify((game as any).serializeMonster(monster))).not.toContain('creationReason');
    });

    it('marks every first-floor natural creation and does not create another birth when revisiting', () => {
        const game = gameScene();
        game.startNewGame({ seed: 4101, mode: 'normal', ruleSet: 'extended', extensions: ['example'] });
        const floor = [...game.monsters, ...game.dormantMonsters];
        expect(floor.length).toBeGreaterThan(0);
        expect(floor.every(monster => fact(monster)?.creationReason === 'natural')).toBe(true);
        const original = new Map(floor.map(monster => [monster.id, fact(monster)]));
        game.depth = 2; (game as any).generateDepth(false, false);
        const emit = vi.spyOn(game.extensionRuntime!, 'emit');
        game.depth = 1; (game as any).generateDepth(true, false);
        expect(emit.mock.calls.filter(([name]) => name === 'creatureSpawned')).toEqual([]);
        for (const monster of [...game.monsters, ...game.dormantMonsters]) {
            if (original.has(monster.id)) expect(fact(monster)).toBe(original.get(monster.id));
        }
    });

    it('captures allied and captive horde allegiance before the initial attach', () => {
        const game = gameScene();
        (game as any).spawnHordeAt(horde(['HORDE_ALLIED_WITH_PLAYER']), { x: 15, y: 12 }, 1, false);
        expect(game.monsters).toHaveLength(2);
        expect(game.monsters.every(monster => fact(monster)?.initiallyHostile === false)).toBe(true);
        game.monsters = [];
        (game as any).spawnHordeAt(horde(['HORDE_LEADER_CAPTIVE']), { x: 25, y: 12 }, 1, false);
        expect(fact(game.monsters[0]!)).toMatchObject({ creationReason: 'natural', initiallyHostile: false });
        expect(fact(game.monsters[1]!)).toMatchObject({ creationReason: 'natural', initiallyHostile: true });
    });

    it('buffers the initial birth DTO until outer commit, without observing later transformation or alliance', () => {
        const game = gameScene(), runtime = game.extensionRuntime!;
        const dispatch = vi.spyOn(runtime as any, 'dispatch');
        const outer = runtime.beginGeneration('birth-outer');
        const inner = runtime.beginGeneration('birth-inner');
        (game as any).spawnHordeAt(horde(), { x: 15, y: 12 }, 1, false);
        const monster = game.monsters[0]!;
        monster.typeId = 'dragon'; monster.isAlly = true;
        runtime.commitGeneration(inner);
        expect(dispatch).not.toHaveBeenCalled();
        runtime.commitGeneration(outer);
        const events = dispatch.mock.calls.filter(([name]) => name === 'creatureSpawned');
        expect(events).toHaveLength(2);
        expect(events[0]![1]).toMatchObject({ creature: { id: monster.id }, birth: {
            creationReason: 'natural', originalMonsterType: 'rat', initiallyHostile: true, sourceId: null, nativeStatsCopied: false } });
    });

    it('periodic horde leaders, members and actual nested machine products all retain periodic reason', () => {
        const game = gameScene(); game.mode = 'normal';
        machineFixture([{ instanceCount: [1, 1], flags: [], monsterId: 'goblin' },
            { instanceCount: [1, 1], flags: ['MF_GENERATE_HORDE'], hordeFlags: [] }]);
        vi.spyOn(game as any, 'findPeriodicSpawnLocation').mockReturnValue({ x: 25, y: 12 });
        vi.spyOn(game, 'pickHordeType').mockReturnValueOnce(horde([], 900)).mockReturnValue(horde());
        expect(game.spawnPeriodicHorde()).toBe(true);
        expect(game.monsters.map(monster => monster.typeId).sort()).toEqual(['goblin', 'kobold', 'kobold', 'rat', 'rat']);
        expect(game.monsters.every(monster => fact(monster)?.creationReason === 'periodic')).toBe(true);
    });

    it('standalone machine creation is scripted, while explicit natural machine scope stays natural', () => {
        const game = gameScene();
        const room = machineFixture();
        const built = buildHordeMachine((game as any).makeGenerationPorts(), 900, room.center, 1);
        expect(built).not.toBeNull();
        expect(fact(game.monsters[0]!)).toMatchObject({ creationReason: 'scripted', originalMonsterType: 'goblin' });
        const runtime = (game as any).createMachineRuntime(1, 'natural') as MachineEntityRuntime;
        const allied = runtime.spawn({ monsterId: 'rat', pos: { x: 30, y: 12 }, isAlly: true }, 901)[0]!;
        expect(fact(allied)).toMatchObject({ creationReason: 'natural', initiallyHostile: false });
        const captive = runtime.spawn({ monsterId: 'rat', pos: { x: 32, y: 12 }, isCaged: true }, 901)[0]!;
        expect(fact(captive)).toMatchObject({ creationReason: 'natural', initiallyHostile: false });
    });

    it('deferred blueprint products use natural population scope before first attach', () => {
        const game = gameScene();
        const result: MachineResult = { blueprintId: 'deferred-birth', category: 'thematic', machineNumber: 901,
            cells: [], center: { x: 30, y: 12 }, door: null, itemSpawns: [], featureSpawns: [],
            monsterSpawns: [{ monsterId: 'goblin', pos: { x: 30, y: 12 }, isAlly: true }],
            needsKey: false, subMachines: [] };
        (game as any).populateLevel(1, false, false, [result]);
        const monster = game.monsters.find(monster => monster.x === 30 && monster.y === 12)!;
        expect(monster).toBeDefined();
        expect(fact(monster)).toMatchObject({ creationReason: 'natural', originalMonsterType: 'goblin', initiallyHostile: false });
    });

    it('monster summons record the actual summoner and initial alliance', () => {
        const game = gameScene();
        const summoner = addMonster(game, 'goblin_conjurer'); summoner.isAlly = true;
        expect(game.summonMinionsFor(summoner)).toBe(true);
        const children = game.monsters.filter(monster => monster !== summoner);
        expect(children.length).toBeGreaterThan(0);
        for (const child of children) expect(fact(child)).toMatchObject({ creationReason: 'summoned', sourceId: summoner.id, initiallyHostile: false, nativeStatsCopied: false });
    });

    it.each(['blades', 'guardian', 'multiplicity', 'scroll'] as const)('%s creation is summoned through the real item-effect entry', kind => {
        const game = gameScene();
        if (kind === 'blades') (game as any).conjureBladesAt({ x: 9, y: 5 }, 3);
        else if (kind === 'guardian') (game as any).summonCharmGuardian(10);
        else if (kind === 'multiplicity') {
            const target = addMonster(game, 'rat');
            game.player.equippedWeapon = ItemLoader.spawnWeapon('dagger', -1, -1)!;
            game.player.equippedWeapon.enchantment = 5;
            (game as any).applyWeaponRunicEffect(target, 1, 'multiplicity');
            game.monsters = game.monsters.filter(monster => monster !== target);
        } else (game as any).summonMonstersAroundPlayer();
        expect(game.monsters.length).toBeGreaterThan(0);
        for (const monster of game.monsters) expect(fact(monster)).toMatchObject({ creationReason: 'summoned', sourceId: game.player.id,
            initiallyHostile: kind === 'scroll', nativeStatsCopied: false });
    });

    it('plenty cloning records clone/source while genuine jelly splitting records split/source', () => {
        const game = gameScene();
        const original = addMonster(game, 'rat');
        const bolt = { ...getBoltForItem('wand_of_slowness')!, id: 'birth-plenty', ceType: CEBoltType.PLENTY, effect: BoltEffect.PLENTY };
        game.zapBoltFromPlayer(bolt, ItemLoader.spawnWand('wand_of_slowness', -1, -1)!, original.loc);
        expect(fact(game.monsters[1]!)).toMatchObject({ creationReason: 'clone', sourceId: original.id, nativeStatsCopied: true });
        game.monsters = [];
        const jelly = addMonster(game, 'pink_jelly');
        (game as any).trySplitMonster(jelly, game.player);
        expect(game.monsters).toHaveLength(2);
        expect(fact(game.monsters[1]!)).toMatchObject({ creationReason: 'split', sourceId: jelly.id, nativeStatsCopied: true });
        const playerClone = game.cloneMonster(game.player)!;
        expect(fact(playerClone)).toMatchObject({ creationReason: 'clone', sourceId: game.player.id, initiallyHostile: false, nativeStatsCopied: true });
    });

    it('armor multiplicity creates allied summoned phantoms before their first birth fact', () => {
        const game = gameScene(), attacker = addMonster(game, 'rat');
        game.player.equippedArmor = ItemLoader.spawnArmor('leather_armor', -1, -1)!;
        game.player.equippedArmor.runicType = 'multiplicity';
        game.player.equippedArmor.enchantment = 5;
        vi.spyOn(rng, 'randPercent').mockReturnValue(true);
        const emit = vi.spyOn(game.extensionRuntime!, 'emit');
        game.tryTriggerArmorRunic(attacker, 1, true);
        const phantoms = game.monsters.filter(monster => monster !== attacker);
        expect(phantoms.length).toBeGreaterThan(0);
        for (const phantom of phantoms) expect(fact(phantom)).toMatchObject({ creationReason: 'summoned', sourceId: attacker.id, initiallyHostile: false, nativeStatsCopied: true });
        const events = emit.mock.calls.filter(([name]) => name === 'creatureSpawned');
        for (const [, event] of events) expect(event).toMatchObject({ birth: { creationReason: 'summoned', initiallyHostile: false, nativeStatsCopied: true } });
    });

    it('test-room generation and reset both explicitly mark test births', () => {
        const game = gameScene(); game.depth = 7;
        (game as any).generateDepth(false, false);
        expect(game.monsters.length).toBeGreaterThan(0);
        expect(game.monsters.every(monster => fact(monster)?.creationReason === 'test')).toBe(true);
        const room = [...game.testRooms.values()].find(room => room.baselineMonsters.length)!;
        const old = game.monsters.find(monster => monster.id === room.baselineMonsters[0]!.id)!;
        (game as any).resetTestRoom(room.id);
        const replacement = game.monsters.find(monster => monster.id === old.id)!;
        expect(replacement).not.toBe(old);
        expect(fact(replacement)).toMatchObject({ creationReason: 'test' });
    });

    it('decoding an existing run never fabricates new birth facts or creatureSpawned events', () => {
        const game = gameScene();
        (game as any).spawnHordeAt(horde(), { x: 15, y: 12 }, 1, false);
        const snapshot = JSON.parse(JSON.stringify(game.toSnapshot()));
        const emit = vi.spyOn(ExtensionRuntime.prototype, 'emit');
        game.loadSnapshot(snapshot);
        expect(game.monsters).toHaveLength(2);
        expect(game.monsters.every(monster => fact(monster) === undefined)).toBe(true);
        expect(emit.mock.calls.filter(([name]) => name === 'creatureSpawned')).toEqual([]);
    });

    it('classic generation, summoning, machine creation and cloning never call the bridge', () => {
        const mark = vi.spyOn(births, 'markCreatureBirth'), game = gameScene(false);
        (game as any).spawnHordeAt(horde(), { x: 15, y: 12 }, 1, false);
        game.cloneMonster(game.monsters[0]!);
        (game as any).conjureBladesAt({ x: 9, y: 5 }, 2);
        const adapter = (game as any).createMachineRuntime(1) as MachineEntityRuntime;
        adapter.spawn({ monsterId: 'goblin', pos: { x: 30, y: 12 } }, 901);
        expect(mark).not.toHaveBeenCalled();
        expect(game.monsters.every(monster => fact(monster) === undefined)).toBe(true);
    });
});
