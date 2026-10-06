import { installRecordingScene } from './support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { Game } from '../engine/Core/Game';
import { Monster, MonsterState, generallyValidBoltTarget, monsterBoltContact, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { EnvironmentManager } from '../engine/Environment/Gas';
import { WaypointSystem } from '../engine/Map/WaypointMap';
import { ScentMap } from '../engine/Map/Scent';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { getBoltForItem } from '../engine/Combat/Bolt';
import { traceBolt } from '../engine/Combat/BoltTrajectory';
import { automaticBoltContact } from '../engine/Combat/BoltTargeting';
import { bodySightContact, bodyLightOrigin } from '../engine/Combat/BodyPerception';
import { physicalContactOf } from '../engine/Combat/BodyCombat';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { withSquareContactScope } from '../engine/Movement/SpatialContactScope';
import { canSeeMonster, canDirectlySeeMonster, canDisplayMonsterAt, publicMonsterCells } from '../engine/UI/MonsterVisibility';
import { rng } from '../engine/Random';
import * as features from '../engine/Combat/CreatureFeatures';
import * as ai from '../engine/Combat/MonsterAI';
import { openCreaturePath, closestBlinkEnemy } from '../engine/Combat/MonsterBlink';
import { catalogFeature, spawnDungeonFeature } from '../engine/Map/DungeonFeature';
import { DF } from '../engine/Map/DungeonFeatureCatalog';

const rat = monsters.find(m => m.id === 'rat')! as MonsterData;
function arrange(g: Game) {
    g.animationEnabled = false; g.monsters = []; g.dormantMonsters = []; g.items = [];
    for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) {
        g.grid.setTerrain(x, y, x === 0 || y === 0 || x === g.grid.width - 1 || y === g.grid.height - 1 ? T.WALL : T.FLOOR);
        Object.assign(g.grid.getCell(x, y)!, { machineNumber: 0, isVisible: true, hasMemory: true });
    }
    commitCreatureAnchor(g.player, { x: 4, y: 6 }); g.player.hp = g.player.maxHp = 10000;
    g.environment = new EnvironmentManager(g.grid); g.waypoints = new WaypointSystem(); g.scent = new ScentMap(g.grid.width, g.grid.height);
    (g as any).machineCells = new Set(); (g as any).bindDungeonFeatureEffects();
    return g;
}
function square(g: Game, size: 2 | 3 = 2, at = { x: 8, y: 5 }) {
    const m = g.createSquareMonster(rat, size, at)!;
    Object.assign(m, { hp: 1000, maxHp: 1000, regenTurns: 0, defense: -1000, ticksUntilTurn: 10000, state: MonsterState.HUNTING });
    return m;
}
function scene(size: 2 | 3 = 2) { const g = arrange(createHeadlessGame(402203, 'test')); return { g, m: square(g, size) }; }
function arcana(g: Game, id = 'staff_of_lightning') {
    const item = id.startsWith('staff_') ? ItemLoader.spawnStaff(id, -1, -1)! : ItemLoader.spawnWand(id, -1, -1)!;
    g.player.inventory.addItem(item); ItemLoader.identifyItemKind(item); item.identified = true; item.charges = 20; return item;
}
function ordinary(g: Game, x: number, y = 6, reflector = false) {
    const m = new Monster(x, y, rat); Object.assign(m, { hp: 1000, maxHp: 1000, regenTurns: 0, ticksUntilTurn: 10000, state: MonsterState.HUNTING });
    if (reflector) m.abilityFlags.add('MA_REFLECT_100'); g.monsters.push(m); return m;
}
afterEach(() => vi.restoreAllMocks());

describe('4a-2 projectile scopes and actual physical contacts', () => {
    it.each([2, 3] as const)('%s-square lightning is one part hit, while 1x1 reflected revisits still hit twice', size => {
        const { g, m } = scene(size), first = ordinary(g, 6), reflector = ordinary(g, 13, 6, true), item = arcana(g);
        const damage = vi.spyOn(m, 'takeDamage'), single = vi.spyOn(first, 'takeDamage'), blood = vi.spyOn(features, 'spawnCreatureBlood');
        const result = g.zapBoltFromPlayer(getBoltForItem(item.identityId!)!, item, { x: 8, y: 6 });
        expect(result.hits.filter(h => h.creature === m)).toEqual([{ creature: m, pos: { x: 8, y: 6 } }]);
        expect(damage).toHaveBeenCalledTimes(1); expect(single).toHaveBeenCalledTimes(2); expect(result.reflections[0]?.creature).toBe(reflector);
        expect(blood.mock.calls.filter(c => c[0] === g.grid && c[1].x === 8 && c[1].y === 6)).toHaveLength(1);
        expect(physicalContactOf(m)).toBe(m.loc);
        g.zapBoltFromPlayer(getBoltForItem(item.identityId!)!, item, { x: 8, y: 6 }); expect(damage).toHaveBeenCalledTimes(2);
    });
    it.each([false, true])('spatial reflection is sampled only on its first collision (reflect=%s); 1x1 reflectors keep revisiting', reflect => {
        const { g, m } = scene(); m.behaviorFlags.add('MONST_REFLECT_50'); const first = ordinary(g, 6);
        ordinary(g, 2, 6, true); ordinary(g, 13, 6, true);
        const roll = vi.spyOn(rng, 'randPercent').mockReturnValue(reflect), state = rng.getState();
        const result = traceBolt(g.grid, { ...getBoltForItem('staff_of_lightning')!, maxRange: 45 }, g.player.loc, { x: 8, y: 6 },
            { caster: g.player, creatureAt: p => p.x === g.player.x && p.y === g.player.y ? g.player : g.getMonsterAt(p.x, p.y) }, { onCell: () => {} });
        expect(roll).toHaveBeenCalledTimes(reflect ? 2 : 1); // CE's second roll chooses the caster, on the FIRST collision only.
        expect(result.reflections.filter(r => r.creature === m)).toHaveLength(reflect ? 1 : 0);
        expect(result.hits.filter(h => h.creature === m)).toHaveLength(reflect ? 0 : 1);
        expect(result.hits.filter(h => h.creature === first).length).toBeGreaterThan(2);
        expect(rng.getState()).toEqual(state);
    });
    it('fire and a thrown weapon stop at the first tail cell and do not attack the creature behind it', () => {
        const { g, m } = scene(), behind = ordinary(g, 12), item = arcana(g, 'staff_of_fire');
        const damage = vi.spyOn(m, 'takeDamage'), blood = vi.spyOn(features, 'spawnCreatureBlood');
        const bolt = g.zapBoltFromPlayer(getBoltForItem(item.identityId!)!, item, { x: 9, y: 6 });
        expect(bolt.landingPos).toEqual({ x: 8, y: 6 }); expect(bolt.hits.map(h => h.creature)).toEqual([m]); expect(behind.hp).toBe(1000);
        const weapon = ItemLoader.spawnWeapon('dart', -1, -1)!; Object.assign(weapon, { quantity: 2, damage: '2-2', strengthRequired: g.player.effectiveStrength });
        g.player.inventory.addItem(weapon); const count = damage.mock.calls.length, bloodCount = blood.mock.calls.length;
        g.executeItemCommand('throw', weapon); g.executeCommand('mouse_travel', { x: 9, y: 6 });
        expect(damage.mock.calls.slice(count).filter(c => c[4] === 'physical')).toHaveLength(1); expect(weapon.quantity).toBe(1); expect(behind.hp).toBe(1000);
        expect(blood.mock.calls.slice(bloodCount).filter(c => c[1].x === 8 && c[1].y === 6)).toHaveLength(1); expect(physicalContactOf(m)).toBe(m.loc);
    });
    it('NPC bolt originates at a legal body edge and hits another square once at its tail', () => {
        const { g, m } = scene(3); commitCreatureAnchor(m, { x: 6, y: 4 }); const target = square(g, 2, { x: 13, y: 6 });
        m.isAlly = true; const damage = vi.spyOn(target, 'takeDamage'); const result = g.castMonsterBolt(m, target, 'LIGHTNING')!;
        expect(result.origin).toMatchObject({ x: 8 }); expect(result.hits.filter(h => h.creature === target)).toHaveLength(1); expect(damage).toHaveBeenCalledTimes(1);
    });
    it('real ITEM_RUNIC force on a thrown stack uses the actual lower tail contact, once, through the complete rune pipeline', () => {
        const { g, m } = scene(3); const w = ItemLoader.spawnWeapon('sword', -1, -1)!;
        Object.assign(w, { quantity: 2, damage: '2-2', enchantment: 50, strengthRequired: g.player.effectiveStrength, flags: ['ITEM_RUNIC'], runicType: 'force' });
        g.player.inventory.addItem(w); g.player.equippedWeapon = w;
        const damage = vi.spyOn(m, 'takeDamage'), rune = vi.spyOn(g as any, 'applyWeaponRunicEffect'), blood = vi.spyOn(features, 'spawnCreatureBlood');
        const from = { ...m.loc }; g.executeItemCommand('throw', w); g.executeCommand('mouse_travel', { x: 10, y: 8 });
        expect(rune).toHaveBeenCalledTimes(1); expect(damage.mock.calls.filter(c => c[4] === 'physical')).toHaveLength(1);
        expect(blood.mock.calls[0]![1]).toMatchObject({ x: 8, y: 7 }); expect(m.x).toBeGreaterThan(from.x); expect(m.y).toBeGreaterThan(from.y);
        expect(w.quantity).toBe(1); expect(physicalContactOf(m)).toBe(m.loc);
    });
});

describe('4a-2 D08 area and identity scopes', () => {
    it('area intersects actual body cells with radius/LOS, uses part for damage and group for identity; independent segments repeat', () => {
        const { g, m } = scene(3); const origin = { x: 11, y: 7 }, scope = new Set<string>();
        const hits = g.collectAreaBodyTargets(origin, 1, 'area-damage', scope);
        expect(hits).toHaveLength(1); expect(hits[0]).toMatchObject({ entity: m, dedupKey: `part:${m.id}:body`, contact: { x: 10, y: 7 } });
        expect(g.collectAreaBodyTargets(origin, 1, 'area-damage', scope)).toHaveLength(0);
        expect(g.collectAreaBodyTargets(origin, 1, 'area-damage', new Set())).toHaveLength(1);
        expect(g.collectAreaBodyTargets(origin, 1, 'mental')[0]?.dedupKey).toBe(`group:${m.id}`);
        expect(g.collectAreaBodyTargets(origin, 0, 'identity')).toHaveLength(0);
        g.grid.setTerrain(11, 6, T.WALL); g.grid.setTerrain(11, 7, T.WALL); g.grid.setTerrain(10, 7, T.WALL); g.grid.setTerrain(10, 6, T.WALL);
        expect(g.collectAreaBodyTargets({ x: 12, y: 7 }, 2, 'area-damage').some(h => h.entity === m)).toBe(false);
    });
    it.each([2, 3] as const)('%s-square real explosive DF deals one damage roll and one blood contact', size => {
        const { g, m } = scene(size); const damage = vi.spyOn(m, 'takeDamage'), roll = vi.spyOn(rng, 'randRange');
        spawnDungeonFeature(g.grid, m.x + size - 1, m.y + size - 1, catalogFeature(DF.DF_BLOAT_EXPLOSION), false);
        const explosionRolls = roll.mock.calls.filter(c => c[0] === 15 && c[1] === 20);
        expect(explosionRolls).toHaveLength(1); expect(damage.mock.calls.filter(c => c[0] === 500)).toHaveLength(1); expect(m.hp).toBe(500);
    });
    it('one synchronous explosion scope cannot damage a body twice even if the immunity timer is cleared between cells', () => {
        const { g, m } = scene(); for (const p of footprintOf(m)) g.grid.setTerrainLayer(p.x, p.y, L.SURFACE, T.GAS_EXPLOSION);
        const scope = new Set<string>(), damage = vi.spyOn(m, 'takeDamage');
        withSquareContactScope(g.grid, scope, () => {
            expect((g as any).resolveExplosionDamage(m)).toBe(true); (g as any).setExplosionImmunityDuration(m, 0);
            expect((g as any).resolveExplosionDamage(m)).toBe(false);
        });
        expect(damage).toHaveBeenCalledTimes(1);
        expect((g as any).resolveExplosionDamage(m)).toBe(true); expect(damage).toHaveBeenCalledTimes(2);
    });
    it('negation and discord include an exposed tail across a wall, and resolve each identity once', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 11, y: 7 }); g.grid.setTerrain(9, 6, T.WALL);
        expect(g.hasLineOfSight(g.player.x, g.player.y, m.x, m.y)).toBe(false);
        const negate = vi.spyOn(g as any, 'negateCreatureMagic'), status = vi.spyOn(g as any, 'applyStatusToMonster');
        (g as any).negationBlastFromPlayer('fixture', 1); expect(negate.mock.calls.filter(c => c[0] === m)).toHaveLength(1);
        (g as any).discordBlastFromPlayer('fixture'); expect(status.mock.calls.filter(c => c[0] === m && c[1] === 'discordant')).toHaveLength(1);
        expect(m.hasStatus('discordant')).toBe(true);
    });
    it('incineration thrown at a tail ignites one creature status while covering multiple body cells', () => {
        const { g, m } = scene(); const item = ItemLoader.spawnPotion('potion_of_incineration', -1, -1)!;
        g.player.inventory.addItem(item); const status = vi.spyOn(g as any, 'setBurningDuration');
        // Isolate this area subsegment; mixed recording below retains the real scheduler.
        vi.spyOn(g as any, 'playerTurnEnded').mockImplementation(() => {});
        g.executeItemCommand('throw', item); g.executeCommand('mouse_travel', { x: 9, y: 6 });
        expect((g as any).burningDuration(m)).toBeGreaterThan(0); expect(status.mock.calls.filter(c => c[0] === m && c[1] === 7)).toHaveLength(1);
    });
    it('drinking incineration shares one body contact scope across its original three DF origins', () => {
        const { g, m } = scene(); commitCreatureAnchor(m, { x: 5, y: 5 });
        const item = ItemLoader.spawnPotion('potion_of_incineration', -1, -1)!; g.player.inventory.addItem(item);
        const status = vi.spyOn(g as any, 'setBurningDuration');
        vi.spyOn(g as any, 'playerTurnEnded').mockImplementation(() => {});
        g.executeItemCommand('quaff', item);
        expect((g as any).burningDuration(m)).toBeGreaterThan(0);
        expect(status.mock.calls.filter(c => c[0] === m && c[1] === 7)).toHaveLength(1);
    });
});

describe('4a-2 public targeting and native body perception', () => {
    it('automatic exploration attacks a public adjacent tail rather than attempting a long movement toward its anchor', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 11, y: 7 });
        const w = ItemLoader.spawnWeapon('sword', -1, -1)!; Object.assign(w, { damage: '2-2', strengthRequired: g.player.effectiveStrength, enchantment: 0, flags: [] });
        g.player.inventory.addItem(w); g.player.equippedWeapon = w;
        g.executeCommand('auto_explore'); expect(m.hp).toBe(998); expect(g.player.loc).toEqual({ x: 11, y: 7 });
    });
    it('an exposed tail does not reveal hidden body cells through hover or inspect, and tail inspection resolves the same entity', () => {
        const { g, m } = scene(3);
        for (const p of footprintOf(m)) Object.assign(g.grid.getCell(p.x, p.y)!, { isVisible: false, hasMemory: false, isMagicMapped: false });
        g.grid.getCell(10, 7)!.isVisible = true; const before = rng.getState();
        g.updateHover(8, 5); expect(g.hoveredText).not.toContain(m.name);
        g.handleInspectAt(8, 5); expect(g.inspectTarget).toBeNull();
        g.handleInspectAt(10, 7); expect(g.inspectTarget?.name).toBe(m.name);
        expect(g.grid.getCell(8, 5)!.hasMemory).toBe(false); expect(rng.getState()).toEqual(before);
    });
    it('automatic targeting sorts by a legal public contact, cycles one entity and never aims at its hidden anchor or nearer hidden tail', () => {
        const { g, m } = scene(3), item = arcana(g); const other = ordinary(g, 7, 7);
        for (const p of footprintOf(m)) { const c = g.grid.getCell(p.x, p.y)!; c.isVisible = false; c.hasMemory = false; }
        g.grid.getCell(10, 7)!.isVisible = true;
        const before = rng.getState(), knowledge = JSON.stringify(g.grid.getCell(8, 5));
        expect(automaticBoltContact(g.player, g.grid, g.monsters, m)).toEqual({ x: 10, y: 7 });
        expect(g.getArcanaCandidates(item)).toEqual([other, m]);
        g.useArcanaItem(item); g.cycleArcanaTarget(); expect(g.pendingArcana?.cursor).toEqual({ x: 10, y: 7 });
        g.cycleArcanaTarget(); expect(g.pendingArcana?.cursor).toEqual(other.loc); expect(rng.getState()).toEqual(before);
        expect(JSON.stringify(g.grid.getCell(8, 5))).toBe(knowledge);
    });
    it('finds another public ray when the nearest body cell is blocked; a completely blocked corner has no automatic candidate', () => {
        const { g, m } = scene();
        g.grid.setTerrain(7, 5, T.WALL); const contact = automaticBoltContact(g.player, g.grid, g.monsters, m);
        expect(contact).not.toBeNull(); expect(contact).not.toEqual(m.loc);
        for (let y = 1; y < g.grid.height - 1; y++) g.grid.setTerrain(7, y, T.WALL);
        expect(automaticBoltContact(g.player, g.grid, g.monsters, m)).toBeNull();
    });
    it('gas outlines only the visible gas cell: hidden gas and a separately visible dry tail do not reveal identity', () => {
        const { g, m } = scene(); m.applyStatus('invisible', 100);
        for (const p of footprintOf(m)) g.grid.getCell(p.x, p.y)!.isVisible = false;
        g.grid.setTerrainLayer(8, 5, L.GAS, T.POISON_GAS); g.grid.getCell(9, 6)!.isVisible = true;
        expect(canSeeMonster(g.player, g.grid, m)).toBe(false); expect(publicMonsterCells(g.player, g.grid, m)).toEqual([]);
        g.grid.setTerrainLayer(9, 6, L.GAS, T.POISON_GAS);
        expect(canSeeMonster(g.player, g.grid, m)).toBe(true); expect(canDirectlySeeMonster(g.player, g.grid, m)).toBe(true);
        expect(publicMonsterCells(g.player, g.grid, m)).toMatchObject([{ x: 9, y: 6 }]); expect(g.grid.getCell(8, 5)!.hasMemory).toBe(true);
        const npc = ordinary(g, 12, 6); const contact = monsterBoltContact(npc, m, g)!;
        expect(contact.to).toMatchObject({ x: 9, y: 6 });
    });
    it('telepathy and entrancement retain one location marker without revealing the unobserved body topology', () => {
        const { g, m } = scene(3);
        for (const p of footprintOf(m)) Object.assign(g.grid.getCell(p.x, p.y)!, { isVisible: false, hasMemory: false });
        const before = rng.getState(); g.player.applyStatus('telepathy', 100);
        expect(publicMonsterCells(g.player, g.grid, m)).toEqual([m.loc]);
        expect(canDirectlySeeMonster(g.player, g.grid, m)).toBe(false);
        expect(canDisplayMonsterAt(g.player, g.grid, m, { x: 10, y: 7 })).toBe(false);
        m.applyStatus('invisible', 100); expect(publicMonsterCells(g.player, g.grid, m)).toEqual([]);
        expect(canDisplayMonsterAt(g.player, g.grid, m, m.loc)).toBe(true);
        expect(canDisplayMonsterAt(g.player, g.grid, m, { x: 10, y: 7 })).toBe(false);
        g.player.setStatusDuration('telepathy', 0); m.applyStatus('entranced', 100);
        expect(canDisplayMonsterAt(g.player, g.grid, m, m.loc)).toBe(true);
        expect(canDisplayMonsterAt(g.player, g.grid, m, { x: 10, y: 7 })).toBe(false);
        expect(rng.getState()).toEqual(before);
        for (const p of footprintOf(m)) expect(g.grid.getCell(p.x, p.y)!.hasMemory).toBe(false);
    });
    it('any observer body cell may see a target; blocked anchor and diagonals do not manufacture LOS or player knowledge', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 12, y: 7 });
        g.grid.setTerrain(10, 6, T.WALL); expect(g.hasLineOfSight(m.x, m.y, g.player.x, g.player.y)).toBe(false);
        const before = rng.getState(); expect(bodySightContact(g.grid, m, g.player, g.hasLineOfSight.bind(g))).toMatchObject({ from: { x: 10, y: 7 } });
        expect(generallyValidBoltTarget(m, g.player, g)).toBe(true); expect(rng.getState()).toEqual(before);
        commitCreatureAnchor(g.player, { x: 11, y: 8 }); g.grid.setTerrain(11, 7, T.WALL); g.grid.setTerrain(10, 8, T.WALL);
        expect(bodySightContact(g.grid, m, g.player, g.hasLineOfSight.bind(g))).toBeNull();
    });
    it('native fear/open-path and ally target selection use body contact rather than a blocked target anchor', () => {
        const { g, m } = scene(3); commitCreatureAnchor(g.player, { x: 60, y: 14 });
        const ally = ordinary(g, 12, 7); ally.isAlly = true; g.grid.setTerrain(10, 6, T.WALL);
        expect(g.hasLineOfSight(ally.x, ally.y, m.x, m.y)).toBe(false);
        expect(openCreaturePath(g, ally, m)).toBe(true); expect(closestBlinkEnemy(g, ally)).toBe(m);
        g.grid.setTerrain(11, 7, T.WALL); g.grid.setTerrain(11, 6, T.WALL); g.grid.setTerrain(11, 8, T.WALL);
        expect(openCreaturePath(g, ally, m)).toBe(false);
    });
    it.each([2, 3] as const)('%s-square awareness takes the nearest scent/visibility summary and exactly one native die', size => {
        const { g, m } = scene(size); m.state = MonsterState.WANDERING;
        const roll = vi.spyOn(rng, 'randPercent'), count = rng.randomNumbersGenerated;
        ai.updateMonsterState(g, m, 100); expect(roll).toHaveBeenCalledExactlyOnceWith(25); expect(rng.randomNumbersGenerated - count).toBe(1);
        roll.mockClear(); for (const p of footprintOf(m)) g.grid.getCell(p.x, p.y)!.isVisible = false;
        g.scent.addScent(g.grid, m.x + size - 1, m.y + size - 1, 8); const next = rng.randomNumbersGenerated;
        expect(typeof g.scent.awareOfBodyTarget(g.grid, m, g.player, { alwaysHunting: false, immobile: false, tracking: true, stealthRange: 2 })).toBe('boolean');
        expect(roll).toHaveBeenCalledExactlyOnceWith(97); expect(rng.randomNumbersGenerated - next).toBe(1);
        roll.mockClear(); g.scent.awareOfBodyTarget(g.grid, m, g.player, { alwaysHunting: false, immobile: true, tracking: false, stealthRange: 2 }); expect(roll).not.toHaveBeenCalled();
    });
    it('alarm path-distance uses the closest body cell and wakes the entity once', () => {
        const { g, m } = scene(3); commitCreatureAnchor(m, { x: 12, y: 11 }); m.state = MonsterState.ASLEEP;
        const wake = vi.spyOn(ai, 'wakeMonster'); (g as any).aggravateMonsters(1, { x: 15, y: 13 });
        expect(wake.mock.calls.filter(c => c[1] === m)).toHaveLength(1); expect(m.state).toBe(MonsterState.HUNTING);
    });
    it.each([2, 3] as const)('%s-square light has one stable central source and its whole footprint blocks light', size => {
        const { g, m } = scene(size); (g as any).setBurningDuration(m, 10); const paint = vi.spyOn(g.lightMap, 'paintLight');
        const before = rng.getState(); (g as any).updateVision(false);
        expect(bodyLightOrigin(m)).toMatchObject(size === 2 ? { x: 8, y: 5 } : { x: 9, y: 6 });
        const atBody = paint.mock.calls.filter(c => c[0].x === bodyLightOrigin(m).x && c[0].y === bodyLightOrigin(m).y);
        expect(atBody).toHaveLength(1); expect(rng.getState()).toEqual(before);
        for (const p of footprintOf(m)) expect((g as any).hasCreatureAtForLight(p.x, p.y)).toBe(true);
    });
});

const json = <V>(v: V): V => JSON.parse(JSON.stringify(v));
function world(g: Game) {
    const s = json(g.toSnapshot()); s.savedAt = 0;   return s;
}
describe('4a-2 real mixed commands, targeting, perception, DF and recording', () => {
    it.each([2, 3] as const)('%s-square plus the other size and ordinary reflectors: save modal, load, continue recording, replay every event and seek', size => {
        installRecordingScene((game) => {
            arrange(game); square(game, size);
            const npc = square(game, size === 2 ? 3 : 2, { x: 14, y: 6 }); npc.state = MonsterState.WANDERING; npc.ticksUntilTurn = 0; npc.bolts = ['SPARK'];
            ordinary(game, 6); ordinary(game, 20, 6, true);
            const bloat = new Monster(18, 6, monsters.find(m => m.id === 'explosive_bloat')! as MonsterData); bloat.hp = 1; bloat.ticksUntilTurn = 10000; game.monsters.push(bloat);
            arcana(game); const dart = ItemLoader.spawnWeapon('dart', -1, -1)!; dart.quantity = 3; game.player.inventory.addItem(dart);
            game.player.inventory.addItem(ItemLoader.spawnPotion('potion_of_incineration', -1, -1)!);
            game.player.inventory.addItem(ItemLoader.spawnScroll('scroll_of_discord', -1, -1)!);
            game.player.inventory.addItem(ItemLoader.spawnScroll('scroll_of_negation', -1, -1)!);
        });
        const g = createHeadlessGame(402203, 'test');
        const letter = (id: string) => g.player.inventory.items.find(i => i.identityId === id || (i as unknown as { consumableId: string }).consumableId === id)!.inventoryLetter;
        const commands = [
            ['item:command', `use|${letter('staff_of_lightning')}|`], ['cycle_target', undefined],
            ['mouse_travel', { x: 9, y: 6 }], ['item:command', `throw|${letter('dart')}|`], ['mouse_travel', { x: 9, y: 6 }],
            ['item:command', `throw|${letter('potion_of_incineration')}|`], ['mouse_travel', { x: 9, y: 6 }],
            ['item:command', `read|${letter('scroll_of_discord')}|`], ['wait', undefined],
            ['item:command', `read|${letter('scroll_of_negation')}|`], ['wait', undefined],
        ] as const;
        const states: ReturnType<typeof world>[] = [];
        for (const [action, data] of commands.slice(0, 2)) { g.executeCommand(action, data); states.push(world(g)); }
        expect(g.pendingArcana).not.toBeNull(); const cursor = { ...g.pendingArcana!.cursor }; const checkpoint = json(g.toSaveSnapshot());
        for (const [action, data] of commands.slice(2)) { g.executeCommand(action, data); states.push(world(g)); }
        expect(g.monsters.some(m => m.spatial?.footprintId === 'builtin:square-2')).toBe(true);
        expect(g.monsters.some(m => m.spatial?.footprintId === 'builtin:square-3')).toBe(true);
        expect(g.monsters.find(m => m.typeId === 'explosive_bloat')).toBeUndefined();
        expect(g.monsters.filter(m => m.spatial).every(m => m.hp < 1000)).toBe(true);
        const recording = g.exportRecording(); expect(recording.events[2]?.data).toEqual({ x: 9, y: 6 });
        const loaded = createHeadlessGame(99, 'test'); expect(loaded.loadSnapshot(checkpoint)).toBe(true);
        expect(loaded.pendingArcana?.cursor).toEqual(cursor);
        for (let i = 2; i < commands.length; i++) { const [action, data] = commands[i]!; loaded.executeCommand(action, data); expect(world(loaded)).toEqual(states[i]); }
        expect(loaded.exportRecording().events).toEqual(recording.events);
        expect(loaded.loadReplay(recording)).toBe(true);
        for (let i = 0; i < commands.length; i++) { loaded.replayStep(true); expect(loaded.replayError).toBeNull(); expect(world(loaded)).toEqual(states[i]); }
        for (const index of [1, 3, 7, 5, commands.length]) { loaded.replaySeek(index); expect(loaded.replayError).toBeNull(); expect(world(loaded)).toEqual(states[index - 1]); }
    });
});
