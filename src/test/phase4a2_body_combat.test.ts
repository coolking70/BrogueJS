import { installRecordingScene } from './support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Game } from '../engine/Core/Game';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { TerrainType as T } from '../engine/Map/Grid';
import { EnvironmentManager } from '../engine/Environment/Gas';
import { WaypointSystem } from '../engine/Map/WaypointMap';
import { CombatSystem } from '../engine/Combat/Combat';
import { nearestLegalMeleeContact, physicalContactOf, withBodyAttackContact } from '../engine/Combat/BodyCombat';
import * as features from '../engine/Combat/CreatureFeatures';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { Item, ItemCategory } from '../engine/Items/Item';
import { rng } from '../engine/Random';

const rat = monsters.find(m => m.id === 'rat')! as MonsterData;
function arrange(g: Game) {
    g.animationEnabled = false; g.monsters = []; g.dormantMonsters = []; g.items = [];
    for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) {
        g.grid.setTerrain(x, y, x === 0 || y === 0 || x === g.grid.width - 1 || y === g.grid.height - 1 ? T.WALL : T.FLOOR);
        Object.assign(g.grid.getCell(x, y)!, { machineNumber: 0, isVisible: true, hasMemory: true });
    }
    commitCreatureAnchor(g.player, { x: 60, y: 14 }); g.player.hp = g.player.maxHp = 10000;
    g.environment = new EnvironmentManager(g.grid); g.waypoints = new WaypointSystem();
    (g as any).machineCells = new Set(); (g as any).bindDungeonFeatureEffects();
    return g;
}
function scene(size: 2 | 3 = 2, at = { x: 12, y: 12 }) {
    const g = arrange(createHeadlessGame(402202, 'test'));
    const m = g.createSquareMonster(rat, size, at)!;
    m.hp = m.maxHp = 10000; m.defense = -1000; m.state = MonsterState.HUNTING; m.regenTurns = 0; m.ticksUntilTurn = 10000;
    commitCreatureAnchor(g.player, { x: 12 + size, y: 11 + size });
    return { g, m };
}
function weapon(g: Game, flag?: string, runic?: string) {
    const w = ItemLoader.spawnWeapon('sword', -1, -1)!;
    Object.assign(w, { damage: '2-2', enchantment: 0, strengthRequired: g.player.effectiveStrength,
        flags: [...(flag ? [flag] : []), ...(runic ? ['ITEM_RUNIC'] : [])], runicType: runic });
    g.player.inventory.addItem(w); g.player.equippedWeapon = w; return w;
}
const json = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const projection = (g: Game) => {
    const s = json(g.toSnapshot()); s.savedAt = 0;   return s;
};
afterEach(() => vi.restoreAllMocks());

describe('4a-2 native body melee contact and complete strike', () => {
    it.each([2, 3] as const)('%s-square tail bump resolves a single creature and one physical strike', size => {
        const { g, m } = scene(size); commitCreatureAnchor(g.player, { x: m.x + size, y: m.y + size - 1 }); weapon(g);
        const attack = vi.spyOn(CombatSystem, 'attack'), damage = vi.spyOn(m, 'takeDamage'), report = vi.spyOn(g, 'reportAttack');
        const anchor = { ...m.loc }; g.executeCommand('move', { x: -1, y: 0 });
        expect(g.getMonsterAt(anchor.x + size - 1, anchor.y + size - 1)).toBe(m);
        expect(attack.mock.calls.filter(c => c[1] === m)).toHaveLength(1);
        expect(damage).toHaveBeenCalledTimes(1); expect(report.mock.calls.filter(c => c[1] === m)).toHaveLength(1);
        expect(m.hp).toBe(9998); expect(m.loc).toEqual(anchor);
    });
    it('tries another equal-distance pair after the first pair is diagonally blocked, without RNG', () => {
        const { g, m } = scene(); g.grid.setTerrain(14, 12, T.WALL);
        const random = rng.getState(), explored = g.grid.getCell(13, 13)!.hasMemory;
        expect(nearestLegalMeleeContact(g.grid, g.player, m)).toMatchObject({ from: { x: 14, y: 13 }, to: { x: 13, y: 13 } });
        expect(rng.getState()).toEqual(random); expect(g.grid.getCell(13, 13)!.hasMemory).toBe(explored);
    });
    it('a square behind an illegal corner cannot hit or be hit; through-wall defender permission is preserved', () => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, { x: 14, y: 14 });
        g.grid.setTerrain(14, 13, T.WALL); g.grid.setTerrain(13, 14, T.WALL);
        weapon(g); const state = rng.getState(), turns = g.stats.turns;
        expect(g.meleeContact(g.player, m)).toBeNull();
        g.executeCommand('move', { x: -1, y: -1 }); expect(m.hp).toBe(10000); expect(g.stats.turns).toBe(turns); expect(rng.getState()).toEqual(state);
        const hp = g.player.hp; m.takeTurn(g, 100); expect(g.player.hp).toBe(hp);
        commitCreatureAnchor(m, { x: 12, y: 12 }); m.behaviorFlags.add('MONST_ATTACKABLE_THRU_WALLS');
        expect(g.meleeContact(g.player, m)).not.toBeNull(); expect(g.meleeContact(m, g.player)).toBeNull();
    });
    it('single-target square native attack strikes only one adjacent enemy once', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 15, y: 14 });
        m.accuracy = 1000; m.damageString = '2-2'; m.ticksUntilTurn = 0; m.behaviorFlags.add('MONST_ALWAYS_HUNTING');
        const other = new Monster(15, 13, rat); other.hp = 1000; g.monsters.push(other);
        const hit = vi.spyOn(CombatSystem, 'attack'); m.takeTurn(g, 100);
        expect(hit).toHaveBeenCalledTimes(1); expect(hit.mock.calls[0]![1]).toBe(g.player); expect(other.hp).toBe(1000);
        expect(m.ticksUntilTurn).toBe(m.attackSpeed);
    });
    it('first square grab consumes no hit/damage RNG, second native strike deals damage once', () => {
        const { g, m } = scene(); m.abilityFlags.add('MA_SEIZES'); m.accuracy = 1000; m.damageString = '2-2';
        const before = rng.randomNumbersGenerated, hp = g.player.hp;
        (m as any).resolveBodyMeleeAdjacent(g, g.player, 'hostile');
        expect([m.seizing, g.player.seized]).toEqual([true, true]); expect(g.player.hp).toBe(hp); expect(rng.randomNumbersGenerated).toBe(before);
        const damage = vi.spyOn(g.player, 'takeCombatDamage'); (m as any).resolveBodyMeleeAdjacent(g, g.player, 'hostile');
        expect(damage).toHaveBeenCalledTimes(1); expect(g.player.hp).toBe(hp - 2);
        const origin = { ...g.player.loc }; g.executeCommand('move', { x: 1, y: 0 }); expect(g.player.loc).toEqual(origin);
    });
    it('through-wall melee permission does not grant a square grab across an illegal diagonal', () => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, { x: 14, y: 14 });
        g.grid.setTerrain(14, 13, T.WALL); g.grid.setTerrain(13, 14, T.WALL); m.behaviorFlags.add('MONST_ATTACKABLE_THRU_WALLS');
        const attacker = new Monster(14, 14, rat); attacker.abilityFlags.add('MA_SEIZES'); attacker.accuracy = 1000; attacker.damageString = '2-2';
        const result = CombatSystem.attack(attacker, m, { grid: g.grid });
        expect(result.seized).toBeUndefined(); expect(attacker.seizing).toBe(false); expect(m.seized).toBe(false); expect(result.hit).toBe(true);
        expect(CombatSystem.previewHitChance(attacker, m, { grid: g.grid })).toBe(100);
    });
    it('through-wall square defender may still be seized orthogonally: CE seize checks distance/corner, not endpoint passability', () => {
        const { g, m } = scene(); m.behaviorFlags.add('MONST_ATTACKABLE_THRU_WALLS');
        for (const cell of footprintOf(m)) g.grid.setTerrain(cell.x, cell.y, T.WALL);
        const attacker = new Monster(14, 13, rat); attacker.abilityFlags.add('MA_SEIZES');
        const before = rng.getState(), result = CombatSystem.attack(attacker, m, { grid: g.grid });
        expect(result.seized).toBe(true); expect(attacker.seizing).toBe(true); expect(m.seized).toBe(true); expect(rng.getState()).toEqual(before);
        expect(CombatSystem.previewHitChance(new Monster(14, 13, { ...rat, abilityFlags: ['MA_SEIZES'] }), m, { grid: g.grid })).toBe(0);
    });
    it('blood, damage float, force direction and reprisal use the actual contact, leaving loc intact', () => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, { x: 11, y: 13 });
        weapon(g, 'ITEM_ATTACKS_PENETRATE', 'force'); g.player.equippedWeapon!.enchantment = 50;
        const blood = vi.spyOn(features, 'spawnCreatureBlood'), floats = vi.spyOn(g, 'spawnFloatingText');
        g.executeCommand('move', { x: 1, y: 0 });
        expect(blood.mock.calls.some(c => c[1].x === 12 && c[1].y === 13)).toBe(true);
        expect(floats.mock.calls.some(c => c[1] === 12 && c[2] === 13)).toBe(true);
        expect(m.x).toBeGreaterThan(12); expect(m.y).toBe(12); expect(physicalContactOf(m)).toBe(m.loc);
    });
    it('square reprisal returns damage once at the attack source contact', () => {
        const { g, m } = scene(); g.grid.setTerrain(14, 12, T.WALL); m.accuracy = 1000; m.damageString = '10-10';
        const armor = new Item('armor', ']', 0xffffff, ItemCategory.ARMOR); armor.runicType = 'reprisal'; armor.enchantment = 3;
        armor.strengthRequired = g.player.effectiveStrength; g.player.equippedArmor = armor;
        const damage = vi.spyOn(m, 'takeDamage'), blood = vi.spyOn(features, 'spawnCreatureBlood');
        (m as any).resolveBodyMeleeAdjacent(g, g.player, 'hostile');
        expect(damage).toHaveBeenCalledTimes(1); expect(m.hp).toBeLessThan(10000);
        expect(blood.mock.calls[0]![1]).toMatchObject({ x: 13, y: 13 }); expect(physicalContactOf(m)).toBe(m.loc);
    });
    it('contact scope restores on exceptions and nested targets without changing anchor objects', () => {
        const { g, m } = scene(); const loc = m.loc, pair = g.meleeContact(g.player, m)!;
        expect(() => withBodyAttackContact(g.player, m, pair, () => { expect(physicalContactOf(m)).toEqual(pair.to); throw Error('fixture'); })).toThrow('fixture');
        expect(physicalContactOf(m)).toBe(loc); expect(m.loc).toBe(loc);
        withBodyAttackContact(g.player, m, pair, () => withBodyAttackContact(m, g.player,
            { from: pair.to, to: pair.from, distance: 1 }, () => expect(physicalContactOf(m)).toEqual(pair.to)));
        expect(physicalContactOf(m)).toBe(loc);
    });
});

describe('4a-2 physical geometry scopes', () => {
    it.each(['ITEM_ATTACKS_EXTEND', 'ITEM_ATTACKS_PENETRATE', 'ITEM_ATTACKS_ALL_ADJACENT'] as const)('%s hits intersected 2-square once', flag => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, flag === 'ITEM_ATTACKS_ALL_ADJACENT' ? { x: 14, y: 13 } : { x: 11, y: 12 });
        weapon(g, flag); const hit = vi.spyOn(CombatSystem, 'attack'); g.executeCommand('move', { x: flag === 'ITEM_ATTACKS_ALL_ADJACENT' ? -1 : 1, y: 0 });
        expect(hit.mock.calls.filter(c => c[1] === m)).toHaveLength(1); expect(m.hp).toBe(9998);
    });
    it.each(['MA_ATTACKS_EXTEND', 'MA_ATTACKS_PENETRATE', 'MA_ATTACKS_ALL_ADJACENT'] as const)('%s NPC hits a square target once', ability => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, { x: 60, y: 14 });
        const attacker = new Monster(11, 12, rat); attacker.isAlly = true; attacker.accuracy = 1000; attacker.damageString = '2-2';
        attacker.abilityFlags.add(ability); g.monsters.push(attacker);
        const hit = vi.spyOn(CombatSystem, 'attack'); (attacker as any).tryGeometryMeleeAdjacent(g, m, 'ally');
        expect(hit.mock.calls.filter(c => c[1] === m)).toHaveLength(1); expect(m.hp).toBe(9998);
    });
    it.each(['ITEM_LUNGE_ATTACKS', 'ITEM_PASS_ATTACKS'] as const)('%s keeps a square movement attack singular', flag => {
        const { g, m } = scene(2, flag === 'ITEM_LUNGE_ATTACKS' ? { x: 13, y: 12 } : { x: 12, y: 12 });
        commitCreatureAnchor(g.player, { x: 11, y: 13 }); weapon(g, flag);
        const hit = vi.spyOn(CombatSystem, 'attack'); g.executeCommand('move', flag === 'ITEM_LUNGE_ATTACKS' ? { x: 1, y: 0 } : { x: 0, y: -1 });
        expect(hit.mock.calls.filter(c => c[1] === m)).toHaveLength(1); expect(m.hp).toBe(flag === 'ITEM_LUNGE_ATTACKS' ? 9994 : 9998);
        expect(g.player.loc).toEqual(flag === 'ITEM_LUNGE_ATTACKS' ? { x: 12, y: 13 } : { x: 11, y: 12 });
    });
    it('square sweep covers its outer body perimeter and hits each independent target once', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 60, y: 14 }); m.isAlly = true; m.accuracy = 1000; m.damageString = '2-2';
        m.abilityFlags.add('MA_ATTACKS_ALL_ADJACENT');
        const a = new Monster(15, 14, rat), b = new Monster(11, 13, rat); a.hp = b.hp = 1000; a.state = b.state = MonsterState.HUNTING; a.defense = b.defense = -1000;
        g.monsters.push(a, b); const hit = vi.spyOn(CombatSystem, 'attack'); (m as any).tryGeometryMeleeAdjacent(g, a, 'ally');
        expect(hit.mock.calls.map(c => c[1])).toHaveLength(2); expect(hit.mock.calls.map(c => c[1])).toContain(a); expect(hit.mock.calls.map(c => c[1])).toContain(b);
        expect(a.hp).toBe(998); expect(b.hp).toBe(998);
    });
    it('square spear starts at the leading edge, keeps far-before-near order and distinct strikes', () => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, { x: 60, y: 14 }); m.isAlly = true; m.accuracy = 1000; m.damageString = '2-2';
        m.abilityFlags.add('MA_ATTACKS_PENETRATE');
        const a = new Monster(14, 12, rat), b = new Monster(15, 12, rat); a.hp = b.hp = 1000; a.state = b.state = MonsterState.HUNTING; a.defense = b.defense = -1000;
        g.monsters.push(a, b); const hit = vi.spyOn(CombatSystem, 'attack'); (m as any).performSpearAttack(g, 1, 0, 'ally');
        expect(hit.mock.calls.map(c => c[1])).toEqual([b, a]); expect(a.hp).toBe(998); expect(b.hp).toBe(998);
    });
    it('square ranged spear chooses the target-facing boundary, including the bottom edge', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 60, y: 14 }); m.isAlly = true;
        m.accuracy = 1000; m.damageString = '2-2'; m.abilityFlags.add('MA_ATTACKS_PENETRATE');
        const enemy = new Monster(16, 14, rat); enemy.hp = 1000; enemy.defense = -1000; enemy.state = MonsterState.HUNTING; g.monsters.push(enemy);
        const hit = vi.spyOn(CombatSystem, 'attack'); expect((m as any).tryGeometryRayTo(g, enemy, 'ally')).toBe(true);
        expect(hit).toHaveBeenCalledTimes(1); expect(enemy.hp).toBe(998);
    });
    it('ranged square seizing geometry and its hit preview preserve contact-qualified grab semantics', () => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, { x: 17, y: 12 });
        m.abilityFlags.add('MA_SEIZES'); m.accuracy = 1000; m.damageString = '2-2';
        expect(CombatSystem.previewHitChance(m, g.player, { grid: g.grid })).toBe(100);
        const result = CombatSystem.attack(m, g.player, { grid: g.grid }); expect(result.seized).toBeUndefined(); expect(result.hit).toBe(true);
        expect(m.seizing).toBe(false); expect(g.player.seized).toBe(false);
    });
    it('entranced square contact can attack once without translating its anchor into the target', () => {
        const { g, m } = scene(); m.setStatusDuration('entranced', 10); m.accuracy = 1000; m.damageString = '2-2';
        const from = { ...m.loc }, hit = vi.spyOn(CombatSystem, 'attack'); m.moveEntranced(g, 1, 0);
        expect(hit).toHaveBeenCalledTimes(1); expect(m.loc).toEqual(from); expect(g.player.hp).toBe(9998);
    });
    it('domination converts a square and its ally movement uses the existing whole-body plan without swapping', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 60, y: 14 }); m.hp = 1;
        const roll = vi.spyOn(rng, 'randPercent').mockReturnValue(true); (g as any).dominateBoltTarget(m); roll.mockRestore();
        expect(m.isAlly).toBe(true); expect(m.dominated).toBe(true); expect(m.leader).toBeNull();
        const from = { ...m.loc }; m.takeTurn(g, 100); expect(m.loc).not.toEqual(from); expect(footprintOf(m)).toHaveLength(9);
        const player = { ...g.player.loc }; expect((g as any).movePlayerPastAlly(m.x, m.y, m)).toBe(false); expect(g.player.loc).toEqual(player);
    });
    it('new independent geometry actions may hit the same body again; killing produces one kill and loot pipeline', () => {
        const { g, m } = scene(); commitCreatureAnchor(g.player, { x: 11, y: 12 }); weapon(g, 'ITEM_ATTACKS_PENETRATE');
        const kill = vi.spyOn(g as any, 'triggerDeathFeatures'), loot = vi.spyOn(g as any, 'dropMonsterLoot');
        g.executeCommand('move', { x: 1, y: 0 }); expect(m.hp).toBe(9998);
        m.hp = 1; g.executeCommand('move', { x: 1, y: 0 });
        expect(m.hp).toBe(0); expect(g.stats.kills).toBe(1); expect(kill.mock.calls.filter(c => c[1] === true)).toHaveLength(1); expect(loot).toHaveBeenCalledTimes(1);
    });
});

describe('4a-2 real native combat recording closure', () => {
    it.each([2, 3] as const)('%s-square tail attacks save/load, replay every event, seek and resume the exact prefix', size => {
        installRecordingScene((game) => {
            arrange(game);
            const m = game.createSquareMonster(rat, size, { x: 12, y: 12 })!;
            m.hp = m.maxHp = 10000; m.defense = -1000; m.regenTurns = 0; m.state = MonsterState.HUNTING; m.ticksUntilTurn = 10000;
            commitCreatureAnchor(game.player, { x: 12 + size, y: 11 + size }); weapon(game, 'ITEM_ATTACKS_ALL_ADJACENT');
        });
        const g = createHeadlessGame(402202, 'test'), states = [];
        for (let i = 0; i < 2; i++) { g.executeCommand('move', { x: -1, y: 0 }); states.push(projection(g)); }
        const checkpoint = json(g.toSaveSnapshot());
        for (let i = 0; i < 3; i++) { g.executeCommand('move', { x: -1, y: 0 }); states.push(projection(g)); }
        expect(footprintOf(g.monsters[0]!)).toHaveLength(size * size);
        const recording = g.exportRecording(), loaded = createHeadlessGame(99, 'test'); expect(loaded.loadSnapshot(checkpoint)).toBe(true);
        for (let i = 2; i < 5; i++) { loaded.executeCommand('move', { x: -1, y: 0 }); expect(projection(loaded)).toEqual(states[i]); }
        expect(loaded.exportRecording().events).toEqual(recording.events); expect(loaded.loadReplay(recording)).toBe(true);
        for (let i = 0; i < 5; i++) { loaded.replayStep(true); expect(loaded.replayError).toBeNull(); expect(projection(loaded)).toEqual(states[i]); }
        for (const i of [1, 4, 2, 5]) { loaded.replaySeek(i); expect(loaded.replayError).toBeNull(); expect(projection(loaded)).toEqual(states[i - 1]); }
    });
});
