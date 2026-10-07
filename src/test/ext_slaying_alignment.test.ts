import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { CombatSystem } from '../engine/Combat/Combat';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Random, RNGType, rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { resetEntityIds } from '../entities/Creature';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { Player } from '../entities/Player';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { ExtensionRuleInput, Json } from '../ext/types';
import monsters from '../data/monsters.json';
import { createHeadlessGame } from './harness';
import { TerrainType } from '../engine/Map/Grid';
import { nearbyDetail } from '../ui/nearbyInspection';
import { sidebarEntityRows } from '../engine/UI/MonsterSidebar';

// Supplemental insurance for actual ITEM_RUNIC weapons. The accepted neutral
// differential file is intentionally unchanged, including its historical fixtures.
const data = (monsters as MonsterData[]).find(monster => monster.id === 'rat')!;
function graph(root: unknown): unknown {
    const seen = new Map<object, number>();
    const visit = (value: unknown): unknown => {
        if (value === null || typeof value !== 'object') return value;
        if (seen.has(value)) return { ref: seen.get(value) };
        const id = seen.size; seen.set(value, id);
        if (value instanceof Set) return { id, type: 'Set', values: [...value].map(visit) };
        if (value instanceof Map) return { id, type: 'Map', entries: [...value].map(([key, entry]) => [visit(key), visit(entry)]) };
        return { id, type: Object.getPrototypeOf(value)?.constructor?.name ?? null,
            fields: Reflect.ownKeys(value).map(key => {
                const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
                return [key, { enumerable: descriptor.enumerable, configurable: descriptor.configurable, writable: descriptor.writable,
                    value: visit(descriptor.value), get: descriptor.get, set: descriptor.set }];
            }) };
    };
    return visit(root);
}
function scene(extended: boolean, variant = 'matching', seed = 1901) {
    resetEntityIds(); rng.seedRandomGenerator(seed); logger.reset(); logger.onDisturb = null;
    const player = new Player(4, 4), monster = new Monster(5, 4, data);
    monster.state = MonsterState.HUNTING; monster.defense = 80; monster.hp = monster.maxHp = 100;
    const weapon = new Item('slaying fixture', ')', 0xffffff, ItemCategory.WEAPON);
    weapon.damage = '1d2'; weapon.strengthRequired = 12; weapon.flags = ['ITEM_RUNIC'];
    weapon.runicType = 'slaying'; weapon.vorpalEnemy = 'animal'; weapon.identified = false; weapon.runicKnown = false;
    player.equippedWeapon = weapon; player.inventory.items.push(weapon);
    if (variant === 'nonmatching') weapon.vorpalEnemy = 'undead';
    if (variant === 'missing-flag') weapon.flags = [];
    if (variant === 'backpack') player.equippedWeapon = null;
    if (variant === 'sleep') monster.state = MonsterState.ASLEEP;
    if (variant === 'web') monster.setStatusDuration('stuck', 4);
    if (variant === 'seizing') { monster.seized = true; player.seizing = true; }
    const calls: ExtensionRuleInput[] = [];
    if (extended) {
        const registry = new ExtensionRegistry();
        registry.register('neutral-slaying', '1.0.0', () => ({ id: 'neutral-slaying', version: '1.0.0', initialState: () => ({}),
            validateState: (value): value is Json => !!value && typeof value === 'object',
            statSources:{collect:()=>[]} }));
        const runtime = new ExtensionRuntime(registry, registry.manifest(['neutral-slaying']), {
            depth: () => 1, playerId: () => player.id, randomInt: () => { throw Error('Pure neutral policy'); }, message: () => { throw Error('No module messages'); },
        });
        runtime.attachCreature(player); runtime.attachCreature(monster);
    }
    const random = new Random(seed); random.randRange(0, 100);
    random.setRNG(RNGType.RNG_COSMETIC); random.randRange(0, 100); random.setRNG(RNGType.RNG_SUBSTANTIVE);
    rng.setState(random.getState());
    return { player, monster, weapon, calls };
}
beforeAll(() => { if (!i18next.isInitialized) void i18next.init({ lng: 'en', fallbackLng: false, resources: {}, initImmediate: false }); });
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('EXT-1d real-flag slaying synchronization with main', () => {
    it.each(['matching', 'nonmatching', 'missing-flag', 'backpack', 'sleep', 'web', 'seizing'])('%s keeps complete actors/results/messages/both RNG streams equal to the independent classic solver', variant => {
        for (let seed = 1901; seed < 1933; seed++) {
            const classic = scene(false, variant, seed), beforeClassic = graph([classic.player, classic.monster, classic.weapon]);
            const result = CombatSystem.attack(classic.player, classic.monster);
            const expected = { result, actors: graph([classic.player, classic.monster, classic.weapon]), rng: rng.getState(), messages: structuredClone(logger.messages) };
            const extended = scene(true, variant, seed);
            expect(graph([extended.player, extended.monster, extended.weapon])).toEqual(beforeClassic);
            const actual = CombatSystem.attack(extended.player, extended.monster);
            expect({ result: actual, actors: graph([extended.player, extended.monster, extended.weapon]), rng: rng.getState(), messages: structuredClone(logger.messages) }).toEqual(expected);
            if (variant === 'matching') {
                expect(actual.hit).toBe(true);
                expect(CombatSystem.previewHitChance(extended.player,extended.monster)).toBe(100);
            }
        }
    });
    it('enumerates the actual classic 100 hit dice and checks extended hit/draw order and pure preview', () => {
        for (let die = 0; die < 100; die++) {
            let oracle: ReturnType<typeof CombatSystem.attack> | undefined;
            for (const extended of [false, true]) {
                const current = scene(extended), before = graph([current.player, current.monster, current.weapon]), random = rng.getState();
                if (extended) {
                    expect(CombatSystem.previewHitChance(current.player, current.monster)).toBe(100);
                    expect(graph([current.player, current.monster, current.weapon])).toEqual(before); expect(rng.getState()).toEqual(random);
                }
                const ranges: number[][] = [], percentages: number[] = [];
                const range = vi.spyOn(rng, 'randRange').mockImplementation((min, max) => { ranges.push([min, max]); return max === 99 ? die : min; });
                const originalPercent = rng.randPercent.bind(rng);
                const percent = vi.spyOn(rng, 'randPercent').mockImplementation(chance => { percentages.push(chance); return originalPercent(chance); });
                const result = CombatSystem.attack(current.player, current.monster);
                expect(result.hit, `native die ${die}, extended=${extended}`).toBe(true);
                expect(percentages).toEqual([100, 100]); expect(ranges).toEqual([[0, 99], [1, 2], [0, 99]]);
                if (!extended) oracle = result; else expect(result).toEqual(oracle);
                percent.mockRestore(); range.mockRestore();
            }
        }
    });
});


describe('EXT-1d actual inspection entry synchronization', () => {
    it.each(['classic', 'extended'] as const)('%s nearby and location inspection agree for real runes and remain pure', ruleSet => {
        const game = createHeadlessGame(901, 'test');
        game.startNewGame({ seed: 901, mode: 'test', ruleSet });
        for (const command of game.extensionRuntime?.initialCommands() ?? []) game.executeCommand('ext:command', command);
        game.monsters = []; game.items = []; game.player.loc = { x: 4, y: 4 };
        for (let x = 2; x < 8; x++) for (let y = 2; y < 8; y++) {
            game.grid.setTerrain(x, y, TerrainType.FLOOR); game.grid.getCell(x, y)!.isVisible = true;
        }
        const monster = new Monster(5, 4, data); monster.state = MonsterState.HUNTING;
        monster.defense = 80; monster.hp = monster.maxHp = 100; game.monsters.push(monster);
        const weapon = new Item('slaying fixture', ')', 0xffffff, ItemCategory.WEAPON);
        weapon.damage = '1d2'; weapon.strengthRequired = 12; weapon.flags = ['ITEM_RUNIC'];
        weapon.runicType = 'slaying'; weapon.vorpalEnemy = 'animal'; weapon.identified = false; weapon.runicKnown = false;
        game.player.equippedWeapon = weapon; game.player.inventory.items.push(weapon);
        const row = sidebarEntityRows(game.player, game.grid, game.monsters, game.items, null, game.depth).find(row => row.kind === 'monster' && row.id === monster.id)!;
        expect(row).toBeDefined();
        const line = (detail: ReturnType<typeof nearbyDetail>) => detail!.sections.flatMap(section => section.lines).find(line => line.text.startsWith('你有 '))!.text;
        const random = rng.getState(), state = game.extensionRuntime?.snapshot();
        for (const [enemyClass, expected] of [['animal', '你有 100% 的概率命中该怪物。'], ['undead', '你有 35% 的概率命中该怪物。']]) {
            weapon.vorpalEnemy = enemyClass;
            game.handleInspectAt(monster.x, monster.y);
            const originalDetail = game.inspectTarget;
            expect(line(originalDetail)).toBe(expected);
            for (let i = 0; i < 3; i++) expect(line(nearbyDetail(game, row))).toBe(expected);
            expect(game.inspectTarget).toBe(originalDetail); expect(rng.getState()).toEqual(random);
            expect(game.extensionRuntime?.snapshot()).toEqual(state);
        }
    });
});
