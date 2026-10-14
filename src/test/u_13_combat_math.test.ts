import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from '../engine/Combat/Combat';
import { rng } from '../engine/Random';
import { Player } from '../entities/Player';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import weapons from '../data/weapons.json';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { deserializeItem, serializeItem, serializeMonster, restoreEntityGraph } from '../engine/Core/EntitySnapshot';
import { createHeadlessGame } from './harness';
import { TerrainType } from '../engine/Map/Grid';

const data = (id: string) => (monsters as MonsterData[]).find(m => m.id === id)!;
function mob(id = 'rat') {
    const m = new Monster(5, 5, data(id));
    m.hp = m.maxHp = 10000; m.state = MonsterState.HUNTING;
    return m;
}
function player(weapon?: string) {
    const p = new Player(4, 5); p.hp = p.maxHp = 10000;
    if (weapon) {
        p.equippedWeapon = ItemLoader.spawnWeapon(weapon, -1, -1)!;
        p.equippedWeapon.enchantment = 0; p.equippedWeapon.runicType = undefined;
        p.strength = p.equippedWeapon.strengthRequired!;
    }
    return p;
}
afterEach(() => vi.restoreAllMocks());

describe('U13 complete damage ranges through actual actors', () => {

    it('javelin clump survives loading and melee; enchanted endpoints scale before rolling', () => {
        const p = player('javelin'), m = mob(); m.defense = 0;
        expect(p.equippedWeapon!.clumping).toBe(3);
        p.equippedWeapon!.enchantment = 10; // CE floor({3,11}*123020/65536)={5,20}
        const roll = vi.spyOn(rng, 'randRange').mockImplementation(lo => lo);
        expect(CombatSystem.attack(p, m).damage).toBe(5);
        expect(roll.mock.calls).toEqual([[0, 99], [0, 5], [0, 5], [0, 5]]);
        // This range can roll 6; scaling an already rolled base die cannot.
        roll.mockClear(); let first = true;
        roll.mockImplementation((_lo, hi) => hi === 99 ? 0 : first ? (first = false, 1) : 0);
        expect(CombatSystem.attack(p, m).damage).toBe(6);
    });
    it('unarmed is CE {1,2,1}; zero ranges have no minimum-one damage or random draw', () => {
        const p = player(), m = mob(); m.defense = 0;
        const roll = vi.spyOn(rng, 'randRange').mockImplementation((_lo, hi) => hi === 99 ? 0 : hi);
        expect(CombatSystem.attack(p, m).damage).toBe(2);
        expect(roll.mock.calls).toEqual([[0, 99], [1, 2]]);
        m.damageString = '0d1'; m.damageClumping = 0; m.accuracy = 100; roll.mockClear();
        expect(CombatSystem.attack(m, p).damage).toBe(0);
        expect(roll.mock.calls).toEqual([[0, 99]]);
        expect(CombatSystem.parseDamageString('0').min).toBe(0);
    });
    it('all catalog clumps survive constructor/form/empower/clone/JSON restore without new draws', () => {
        for (const row of monsters) {
            const m = mob(row.id); expect(m.damageClumping).toBe(row.clumping);
            const before = rng.randomNumbersGenerated; m.empower();
            expect(m.damageClumping).toBe(row.clumping); expect(m.snapshotForm().clumping).toBe(row.clumping);
            const saved = JSON.parse(JSON.stringify(serializeMonster(m)));
            const restored = restoreEntityGraph([saved]).monsters.get(m.id)!;
            expect(restored.damageClumping).toBe(row.clumping);
            expect(rng.randomNumbersGenerated).toBe(before);
            expect(m.copyForClone().damageClumping).toBe(row.clumping);
        }
        for (const row of weapons.filter(w => w.id !== 'halberd')) {
            const w = ItemLoader.spawnWeapon(row.id, 0, 0)!;
            expect(w.clumping).toBe(row.clumping);
            expect(deserializeItem(JSON.parse(JSON.stringify(serializeItem(w)))).clumping).toBe(row.clumping);
        }
    });
    it('polymorph installs the new species clump', () => {
        const m = mob('ogre'); m.polymorph(() => {});
        expect(m.damageClumping).toBe(data(m.typeId).clumping);
    });
});

describe('U13 short circuits, multipliers, order, and real substantive counts', () => {
    it.each([['rat', 2], ['eel', 3], ['spider', 2], ['troll', 4], ['dragon', 5]] as const)('%s substantive count=%s (a 0..0 clump call consumes no random number)', (id, count) => {
        const a = mob(id), p = player(); a.accuracy = 100;
        rng.seedRandomGenerator(13); const before = rng.randomNumbersGenerated;
        expect(CombatSystem.attack(a, p).hit).toBe(true);
        expect(rng.randomNumbersGenerated - before).toBe(count);
    });
    it.each(['sleep', 'wander', 'paralyzed', 'lunge', 'captive', 'inanimate-paralyzed'] as const)('%s has no hit die and only the CE multiplier', mode => {
        const p = player('dagger'), m = mob(); m.defense = 32767;
        const beforeTicks = m.ticksUntilTurn;
        if (mode === 'sleep') m.state = MonsterState.ASLEEP;
        if (mode === 'wander') m.state = MonsterState.WANDERING;
        if (mode.includes('paralyzed')) m.statusDurations.paralyzed = 5;
        if (mode === 'inanimate-paralyzed') m.behaviorFlags.add('MONST_INANIMATE');
        if (mode === 'captive') m.isCaged = true;
        rng.seedRandomGenerator(13); const before = rng.randomNumbersGenerated;
        const roll = vi.spyOn(rng, 'randRange');
        const result = CombatSystem.attack(p, m, { lungeAttack: mode === 'lunge' });
        const backstab = ['sleep', 'wander', 'paralyzed'].includes(mode);
        expect(result.hit).toBe(true); expect(result.backstab).toBe(backstab);
        expect([3, 4].map(n => n * (backstab || mode === 'lunge' ? 5 : 1))).toContain(result.damage);
        expect(roll.mock.calls).toEqual([[3, 4]]); expect(rng.randomNumbersGenerated - before).toBe(1);
        expect(m.ticksUntilTurn).toBe(beforeTicks + (backstab ? 100 : 0));
        if (backstab) expect(m.state).toBe(MonsterState.HUNTING);
    });
    it('sleep/paralysis/lunge overlap multiplies only once; ally wandering and inanimate sleep have no bonus', () => {
        const p = player('dagger'), m = mob(); m.state = MonsterState.ASLEEP; m.statusDurations.paralyzed = 5;
        vi.spyOn(rng, 'randRange').mockImplementation(lo => lo);
        expect(CombatSystem.attack(p, m, { lungeAttack: true }).damage).toBe(15);
        m.statusDurations = {}; m.state = MonsterState.WANDERING; m.isAlly = true;
        expect(CombatSystem.attack(p, m).backstab).toBe(false);
        m.isAlly = false; m.state = MonsterState.ASLEEP; m.behaviorFlags.add('MONST_INANIMATE');
        expect(CombatSystem.attack(p, m).backstab).toBe(false);
    });
    it('monster→sleeping monster / paralyzed player uses generic ×3 and no hit roll', () => {
        const a = mob('ogre'), d = mob(), p = player(); d.state = MonsterState.ASLEEP; p.statusDurations.paralyzed = 4;
        const roll = vi.spyOn(rng, 'randRange').mockImplementation(lo => lo);
        expect(CombatSystem.attack(a, d).damage).toBe(27); expect(CombatSystem.attack(a, p).damage).toBe(27);
        expect(roll.mock.calls).toEqual([[0, 2], [0, 2], [0, 2], [0, 2]]);
    });
    it('ordinary 100% and seized 100% still consume a hit die; first seizure/kamikaze/aquatic rejection consume none', () => {
        const a = mob('bog_monster'), p = player(); a.accuracy = 0;
        rng.seedRandomGenerator(13); const roll = vi.spyOn(rng, 'randRange'), before = rng.randomNumbersGenerated;
        expect(CombatSystem.attack(a, p).seized).toBe(true); expect(roll).not.toHaveBeenCalled();
        expect(CombatSystem.attack(a, p).hit).toBe(true); expect(roll.mock.calls).toEqual([[0, 99], [3, 4]]);
        expect(rng.randomNumbersGenerated - before).toBe(2);
        const b = mob('bloat'); roll.mockClear(); CombatSystem.attack(b, p); expect(roll).not.toHaveBeenCalled();
        p.statusDurations.levitating = 4; roll.mockClear(); CombatSystem.attack(a, p); expect(roll).not.toHaveBeenCalled();
    });
    it('miss/immune skip damage dice; immune sneak still wakes and delays; zero damage never calls armor callback', () => {
        const a = mob('ogre'), d = mob(); a.accuracy = 0;
        const roll = vi.spyOn(rng, 'randRange').mockImplementation(lo => lo), armor = vi.fn(n => n);
        expect(CombatSystem.attack(a, d).hit).toBe(false); expect(roll.mock.calls).toEqual([[0, 99]]);
        a.accuracy = 100; d.behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS'); d.state = MonsterState.ASLEEP;
        const ticks = d.ticksUntilTurn; roll.mockClear();
        expect(CombatSystem.attack(a, d, { beforeDamage: armor }).damage).toBe(0);
        expect(roll).not.toHaveBeenCalled(); expect(armor).not.toHaveBeenCalled(); expect(d.ticksUntilTurn).toBe(ticks + 100);
        expect(d.state).toBe(MonsterState.HUNTING);
    });
    it('invisibility has no extra multiplier and weakened duration cannot substitute for U14 weaknessAmount', () => {
        const p = player('sword'), m = mob('ogre'); m.defense = 0;
        vi.spyOn(rng, 'randRange').mockImplementation(lo => lo);
        const normal = CombatSystem.attack(p, m).damage;
        p.statusDurations.invisible = p.statusDurations.weakened = 10;
        expect(CombatSystem.attack(p, m).damage).toBe(normal);
        m.accuracy = 100; const monsterNormal = CombatSystem.attack(m, p).damage;
        m.statusDurations.weakened = 10; expect(CombatSystem.attack(m, p).damage).toBe(monsterNormal);
    });
    it('real BE_ATTACK entry consumes full clump with its normal hit roll', () => {
        const g = createHeadlessGame(13, 'test'); g.monsters = []; g.items = [];
        for (let x = 3; x < 10; x++) g.grid.setTerrain(x, 5, TerrainType.FLOOR);
        g.player = player(); const a = mob('centaur'); a.loc = { x: 8, y: 5 }; a.accuracy = 100; g.monsters.push(a);
        const roll = vi.spyOn(rng, 'randRange').mockImplementation(lo => lo);
        g.castMonsterBolt(a, g.player, 'DISTANCE_ATTACK');
        expect(g.player.hp).toBe(9996);
        // R6 / CE: hit + clump, blood DF four-neighbor first wave, then FloatingText ID.
        expect(roll.mock.calls).toEqual([[0, 99], [0, 2], [0, 2], [0, 99], [0, 99], [0, 99], [0, 99], [1, 1000000]]);
    });
});
