import { afterEach, describe, expect, it, vi } from 'vitest';
import { EffectCausality, validEffectOrigin } from '../ext/causality';
import { ExtensionRuntime } from '../ext/runtime';
import { ExtensionRegistry } from '../ext/registry';
import type { HookEvents } from '../ext/types';
import { CombatSystem } from '../engine/Combat/Combat';
import { getBoltForItem } from '../engine/Combat/Bolt';
import { setDormantAwakener } from '../engine/Map/DungeonFeature';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { Creature } from '../entities/Creature';
import { Item, ItemCategory } from '../engine/Items/Item';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { DungeonLayer, TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { createHeadlessGame } from './harness';
import monsters from '../data/monsters.json';

function scene() {
    const game = createHeadlessGame(8841, 'test');
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.player.loc = { x: 4, y: 5 }; game.player.hp = game.player.maxHp = 100;
    game.player.statusDurations = {}; game.player.poisonAmount = 0;
    game.player.equippedWeapon = game.player.equippedArmor = game.player.ringLeft = game.player.ringRight = null;
    for (let x = 1; x < 16; x++) for (let y = 1; y < 11; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR);
        game.grid.getCell(x, y)!.isVisible = true;
    }
    const registry = new ExtensionRegistry();
    game.extensionRuntime = new ExtensionRuntime(registry, registry.manifest([]), {
        depth: () => 1, playerId: () => game.player.id, randomInt: (lo, hi) => rng.randRange(lo, hi), message: vi.fn(),
    });
    game.extensionRuntime.attachCreature(game.player, false);
    return game;
}
function mob(game: ReturnType<typeof scene>, x = 5, y = 5, species = 'rat') {
    const monster = new Monster(x, y, (monsters as MonsterData[]).find(entry => entry.id === species)!);
    monster.hp = monster.maxHp = 100; monster.state = MonsterState.HUNTING;
    monster.goldDropChance = monster.itemDropChance = 0; monster.ticksUntilTurn = 100000;
    game.monsters.push(monster); return monster;
}
function events(game: ReturnType<typeof scene>) {
    const emit = vi.spyOn(game.extensionRuntime!, 'emit');
    return {
        damage: () => emit.mock.calls.filter(([kind]) => kind === 'damage').map(([, data]) => data as HookEvents['damage']),
        kill: () => emit.mock.calls.filter(([kind]) => kind === 'kill').map(([, data]) => data as HookEvents['kill']),
    };
}
function lastItem<T>(items: T[]): T | undefined { return items[items.length - 1]; }
function armor(game: ReturnType<typeof scene>, runic: string) {
    const item = new Item('armor', ']', 0xffffff, ItemCategory.ARMOR);
    item.runicType = runic; item.enchantment = 1; game.player.equippedArmor = item;
}
afterEach(() => vi.restoreAllMocks());

describe('effect causality data contract', () => {
    it('nests synchronous scopes, masks with explicit null and restores after exceptions and thenables', () => {
        const cause = new EffectCausality(), root = cause.create('melee', 1, 1, 'player:1');
        cause.withOrigin(root, () => {
            expect(cause.current).toBe(root);
            cause.withOrigin(null, () => expect(cause.current).toBeNull());
            const reflection = cause.create('reflection', 1, 2);
            expect(reflection).toMatchObject({ actorId: 1, creditActorId: 2, rootEffectId: root.effectId, parentEffectId: root.effectId });
            expect(() => cause.withImmediateTerrain(reflection, () => { throw new Error('abort'); })).toThrow('abort');
            expect(cause.current).toBe(root); expect(cause.terrainOrigin).toBeNull();
        });
        expect(() => cause.withOrigin(root, () => Promise.resolve())).toThrow('Async effect');
        expect(cause.current).toBeNull();
    });
    it('stores the fatal transition rather than a previous hit or outer scope, including unowned deaths', () => {
        const cause = new EffectCausality(), root = cause.create('melee', 1);
        cause.withOrigin(root, () => {
            expect(cause.recordDamage(3, 10, 10, 'physical')).toMatchObject({ hpLost: 0 });
            cause.recordDamage(3, 10, 5);
            cause.withOrigin(null, () => cause.recordDamage(3, 5, -12, 'fire'));
            expect(cause.deathOrigin(3)).toBeNull();
        });
        expect(cause.snapshot().fatalOrigins).toEqual({ 3: null });
        expect(cause.recordDamage(4, 3, -8)).toMatchObject({ hpLost: 3 });
    });
    it('roundtrips status, delayed landing, IDs and independent snapshots, without live actors', () => {
        const cause = new EffectCausality(), source = cause.create('bolt', 12, 12, 'player:1');
        cause.withOrigin(source, () => cause.statusChanged(40, 'poisoned', 0, 5));
        cause.markDisplacement(41, source); cause.terminal(42, source);
        const snapshot = JSON.parse(JSON.stringify(cause.snapshot()));
        const restored = new EffectCausality(snapshot);
        expect(restored.snapshot()).toEqual(snapshot);
        snapshot.statusOrigins['40'].poisoned.creditActorId = 99;
        expect(restored.statusOrigin(40, 'poisoned')?.creditActorId).toBe(12);
        expect(restored.consumeDisplacement(41)).toEqual(source);
        expect(restored.consumeDisplacement(41)).toBeNull();
        expect(restored.create('terrain', null).effectId).toBe(source.effectId + 1);
        restored.retainCreatures(new Set([40]));
        expect(restored.snapshot().fatalOrigins).toEqual({});
    });
    it('strictly rejects malformed serialized causal identities and unknown fields', () => {
        const cause = new EffectCausality(), source = cause.create('bolt', 1);
        cause.withOrigin(source, () => cause.statusChanged(2, 'burning', 0, 7));
        for (const patch of [{ effectId: 0 }, { rootEffectId: 3 }, { parentEffectId: 1 }, { creditActorId: null, creditPartyId: 'player:1' }, { actor: new Creature(1, 1, 'actor', 'a', 0) }, { kind: 'made-up' }]) {
            expect(validEffectOrigin({ ...source, ...patch })).toBe(false);
        }
        for (const mutate of [
            (s: any) => { s.nextEffectId = source.effectId; },
            (s: any) => { s.statusOrigins['2'].other = source; },
            (s: any) => { s.pendingDisplacements['-1'] = source; },
            (s: any) => { s.extra = null; },
        ]) {
            const snapshot = cause.snapshot(); mutate(snapshot);
            expect(EffectCausality.validateSnapshot(snapshot)).toBe(false);
            expect(() => new EffectCausality(snapshot)).toThrow('Invalid effect');
        }
    });
});

describe('engine damage origin integration', () => {
    it('melee reports real HP loss, all-shielded hits produce no fatal evidence, later unowned deaths stay unowned', () => {
        const game = scene(), target = mob(game), seen = events(game);
        target.applyStatus('paralyzed', 10); target.applyShield(10000);
        CombatSystem.attack(game.player, target, { grid: game.grid });
        expect(seen.damage()[0]).toMatchObject({ hpLost: 0, damageKind: 'physical', origin: { kind: 'melee', actorId: game.player.id } });
        expect(seen.kill()).toHaveLength(0);
        target.takeDamage(100, true);
        expect(seen.kill()).toHaveLength(1); expect(seen.kill()[0]!.origin).toBeNull();
    });
    it('standalone thrown weapons carry a projectile source without an attack event', () => {
        const game = scene(), target = mob(game), seen = events(game);
        target.applyStatus('paralyzed', 10); target.hp = 1;
        const weapon = ItemLoader.spawnWeapon('dagger', 1, 1, 1)!;
        CombatSystem.resolveThrownWeapon(game.player, target, weapon, game.grid);
        expect(seen.kill()[0]).toMatchObject({ origin: { kind: 'projectile', creditActorId: game.player.id } });
        expect(game.extensionRuntime!.sourceId).toBeNull();
    });
    it('the real item throw entry keeps projectile evidence until its lethal contact', () => {
        const game = scene(), target = mob(game), seen = events(game);
        target.applyStatus('paralyzed', 10); target.hp = 1;
        const weapon = ItemLoader.spawnWeapon('dagger', 1, 1, 1)!;
        weapon.quantity = 2; game.player.inventory.addItem(weapon);
        game.throwItemAt(weapon, target.x, target.y);
        expect(seen.kill().find(event => event.creature.id === target.id)!.origin).toMatchObject({ kind: 'projectile', creditActorId: game.player.id });
        expect(game.extensionRuntime!.causality.current).toBeNull();
    });
    it('administrative removal always masks the effect that happened to surround it', () => {
        const game = scene(), target = mob(game), seen = events(game), cause = game.extensionRuntime!.causality;
        cause.withOrigin(cause.create('melee', game.player.id), () => game.killMonster(target, true));
        expect(seen.kill()[0]).toMatchObject({ administrative: true, origin: null });
    });
    it.each([false, true])('direct tunneling retains the actual reflected=%s responsibility only for its turret kill', reflected => {
        const game = scene(), cause = game.extensionRuntime!.causality, seen = events(game);
        const turret = mob(game, reflected ? 2 : 6, 5, 'arrow_turret');
        const reflector = reflected ? mob(game, 8, 5, 'stone_guardian') : null;
        game.grid.setTerrain(turret.x, turret.y, TerrainType.WALL);
        const terrainOrigins: unknown[] = [];
        setDormantAwakener(game.grid, () => terrainOrigins.push(cause.current));
        const item = ItemLoader.spawnStaff('staff_of_tunneling', -1, -1)!;
        item.enchantment = 4;
        const result = game.zapBoltFromPlayer(getBoltForItem('staff_of_tunneling')!, item, { x: 8, y: 5 });
        expect(result.caster).toBe(game.player);
        expect(seen.kill().find(event => event.creature.id === turret.id)!.origin).toMatchObject({
            kind: reflected ? 'reflection' : 'bolt', actorId: game.player.id,
            creditActorId: reflector?.id ?? game.player.id,
        });
        expect(terrainOrigins.length).toBeGreaterThan(0);
        expect(terrainOrigins.every(origin => origin === null)).toBe(true);
        expect(cause.current).toBeNull(); expect(cause.terrainOrigin).toBeNull();
    });
    it('a generic tunnel without explicit direct evidence cannot borrow an outer attacker', () => {
        const game = scene(), cause = game.extensionRuntime!.causality, turret = mob(game, 6, 5, 'arrow_turret'), seen = events(game);
        game.grid.setTerrain(turret.x, turret.y, TerrainType.WALL);
        cause.withOrigin(cause.create('melee', game.player.id), () => (game as any).tunnelAt(turret.loc));
        expect(seen.kill()[0]!.origin).toBeNull();
    });
    it('shattering shares one player source among direct turret kills while its terrain callbacks stay unowned', () => {
        const game = scene(), cause = game.extensionRuntime!.causality, seen = events(game);
        const one = mob(game, 6, 5, 'arrow_turret'), two = mob(game, 7, 6, 'arrow_turret');
        for (const target of [one, two]) game.grid.setTerrain(target.x, target.y, TerrainType.WALL);
        const terrainOrigins: unknown[] = [];
        setDormantAwakener(game.grid, () => terrainOrigins.push(cause.current));
        const unrelated = cause.create('melee', 9000);
        cause.withOrigin(unrelated, () => (game as any).crystalizeFromPlayer(4));
        const kills = seen.kill().filter(event => event.creature.id === one.id || event.creature.id === two.id);
        expect(kills).toHaveLength(2);
        expect(kills[0]!.origin).toMatchObject({ kind: 'bolt', actorId: game.player.id, creditActorId: game.player.id });
        expect(kills[1]!.origin).toEqual(kills[0]!.origin);
        expect(terrainOrigins.length).toBeGreaterThan(0);
        expect(terrainOrigins.every(origin => origin === null)).toBe(true);
        expect(cause.current).toBeNull(); expect(cause.terrainOrigin).toBeNull();
    });
    it('uses the last effective poison source after the source leaves or dies, and stores unowned refreshes', () => {
        const game = scene(), victim = mob(game), actor = mob(game, 7), seen = events(game);
        const cause = game.extensionRuntime!.causality;
        const first = cause.create('bolt', game.player.id), last = cause.create('melee', actor.id);
        cause.withOrigin(first, () => victim.addPoison(3));
        cause.withOrigin(last, () => victim.addPoison(0));
        expect(cause.statusOrigin(victim.id, 'poisoned')).toEqual(first);
        cause.withOrigin(last, () => victim.addPoison(2));
        actor.hp = 0; game.monsters = [victim]; victim.hp = 1;
        (game as any).resolvePoisonDamage(victim);
        expect(lastItem(seen.damage())).toMatchObject({ damageKind: 'poison', origin: last });
        expect(lastItem(seen.kill())).toMatchObject({ origin: last });
        const other = mob(game, 9);
        cause.withOrigin(first, () => other.addPoison(3)); other.addPoison(1);
        expect(cause.statusOrigin(other.id, 'poisoned')).toBeNull();
        other.setStatusDuration('poisoned', 0);
        expect(cause.snapshot().statusOrigins[String(other.id)]).toBeUndefined();
    });
    it('keeps burn ownership on ineffective refresh, updates a true refresh, and clears natural fire ownership', () => {
        const game = scene(), target = mob(game), cause = game.extensionRuntime!.causality;
        const a = cause.create('bolt', game.player.id), b = cause.create('bolt', 500);
        cause.withOrigin(a, () => game.exposeCreatureToFire(target));
        cause.withOrigin(b, () => game.exposeCreatureToFire(target));
        expect(cause.statusOrigin(target.id, 'burning')).toEqual(a);
        target.tickStatuses();
        cause.withOrigin(b, () => game.exposeCreatureToFire(target));
        expect(cause.statusOrigin(target.id, 'burning')).toEqual(b);
        target.tickStatuses(); game.grid.setTerrainLayer(target.x, target.y, DungeonLayer.SURFACE, TerrainType.PLAIN_FIRE);
        cause.withOrigin(a, () => (game as any).applyEnvironmentalEffects(target));
        expect(cause.statusOrigin(target.id, 'burning')).toBeNull();
        game.grid.setTerrainLayer(target.x, target.y, DungeonLayer.SURFACE, TerrainType.NOTHING);
        target.tickStatuses(); cause.withOrigin(a, () => game.exposeCreatureToFire(target));
        target.applyStatus('immune_fire', 8);
        expect(cause.snapshot().statusOrigins[String(target.id)]).toBeUndefined();
    });
    it.each(['reprisal', 'mutuality'])('%s responsibility belongs to the armor wearer, not the surrounding attacker', runic => {
        const game = scene(), attacker = mob(game), other = mob(game, 4, 6), seen = events(game);
        armor(game, runic);
        const cause = game.extensionRuntime!.causality, incoming = cause.create('melee', attacker.id);
        cause.withOrigin(incoming, () => game.tryTriggerArmorRunic(attacker, 12, true));
        const event = seen.damage().find(event => event.creature.id === (runic === 'reprisal' ? attacker.id : other.id))!;
        expect(event.origin).toMatchObject({ kind: 'reprisal', actorId: game.player.id, creditActorId: game.player.id,
            parentEffectId: incoming.effectId });
    });
    it('negative transference is a separate self-owned cost and restores the incoming origin', () => {
        const game = scene(), target = mob(game), seen = events(game);
        const ring = ItemLoader.spawnRing('ring_of_transference', -1, -1)!; ring.enchantment = -2;
        game.player.inventory.addItem(ring); game.player.ringLeft = ring; // S7: equipped items belong to the inventory root.
        const cause = game.extensionRuntime!.causality, incoming = cause.create('reflection', game.player.id, target.id);
        cause.withOrigin(incoming, () => {
            CombatSystem.transferMonsterHealth(game.player, target, 20);
            expect(cause.current).toBe(incoming);
        });
        expect(seen.damage()[0]!.origin).toMatchObject({ kind: 'transference', actorId: game.player.id, creditActorId: game.player.id });
    });
    it('explicit stagger into lava has bounded credit; natural lava during an attack is explicitly unowned', () => {
        const game = scene(), target = mob(game), seen = events(game);
        game.grid.setTerrainLayer(6, 5, DungeonLayer.LIQUID, TerrainType.LAVA);
        game.processStaggerHit(game.player, target);
        expect(seen.kill()[0]!.origin).toMatchObject({ kind: 'displacement', creditActorId: game.player.id });
        const next = mob(game, 8); game.grid.setTerrainLayer(8, 5, DungeonLayer.LIQUID, TerrainType.LAVA);
        const cause = game.extensionRuntime!.causality;
        cause.withOrigin(cause.create('melee', game.player.id), () => (game as any).applyEnvironmentalEffects(next));
        expect(lastItem(seen.kill())!.origin).toBeNull(); expect(cause.terrainOrigin).toBeNull();
    });
    it('retains explicit push evidence until exactly the next falling damage', () => {
        const game = scene(), target = mob(game), seen = events(game);
        target.hp = 1; game.grid.setTerrainLayer(6, 5, DungeonLayer.LIQUID, TerrainType.CHASM);
        game.processStaggerHit(game.player, target);
        expect(target.falling).toBe(true);
        expect(seen.kill()).toHaveLength(0);
        const before = game.extensionRuntime!.causality.snapshot();
        expect(before.pendingDisplacements[String(target.id)]?.creditActorId).toBe(game.player.id);
        (game as any).monstersFall();
        expect(seen.kill()[0]!.origin).toMatchObject({ kind: 'displacement', creditActorId: game.player.id });
        expect(game.extensionRuntime!.causality.snapshot().pendingDisplacements).toEqual({});
    });
    it('nested immediate death explosions belong to each actual dead source, with no persistent terrain ownership', () => {
        const game = scene(), first = mob(game, 8, 5, 'explosive_bloat'), second = mob(game, 9, 5, 'explosive_bloat');
        const victim = mob(game, 10, 5), seen = events(game), cause = game.extensionRuntime!.causality;
        first.hp = second.hp = victim.hp = 1;
        game.player.loc = { x: 2, y: 2 };
        const attack = cause.create('melee', game.player.id);
        cause.withOrigin(attack, () => first.takeDamage(1, true));
        expect(seen.kill().find(event => event.creature.id === first.id)!.origin).toEqual(attack);
        expect(seen.kill().find(event => event.creature.id === second.id)!.origin).toMatchObject({ kind: 'death-effect', creditActorId: first.id });
        expect(seen.kill().find(event => event.creature.id === victim.id)!.origin).toMatchObject({ kind: 'death-effect', creditActorId: second.id });
        const late = mob(game, 8, 5); late.hp = 1;
        (game as any).applyEnvironmentalEffects(late);
        expect(seen.kill().find(event => event.creature.id === late.id)!.origin).toBeNull();
        expect(cause.current).toBeNull(); expect(cause.terrainOrigin).toBeNull();
    });
    it('whole-run snapshot restores delayed status attribution even when the original actor is absent', () => {
        const game = scene(), target = mob(game), cause = game.extensionRuntime!.causality;
        const origin = cause.create('projectile', 9000, 9000, 'player:1');
        cause.withOrigin(origin, () => target.addPoison(5));
        const snapshot = game.toSnapshot(), resumed = createHeadlessGame(8842, 'test');
        resumed.loadSnapshot(snapshot);
        const restored = resumed.monsters.find(monster => monster.id === target.id)!;
        expect(resumed.extensionRuntime!.causality.statusOrigin(target.id, 'poisoned')).toEqual(origin);
        expect(resumed.extensionRuntime!.causality.snapshot()).toEqual(cause.snapshot());
        restored.hp = 1;
        const seen = events(resumed);
        (resumed as any).resolvePoisonDamage(restored);
        expect(seen.kill()[0]!.origin).toEqual(origin);
    });
    it('negation and lifespan have explicit terminal causes, and starvation never inherits a surrounding attack', () => {
        const game = scene(), target = mob(game), seen = events(game), cause = game.extensionRuntime!.causality;
        target.behaviorFlags.add('MONST_DIES_IF_NEGATED');
        cause.withOrigin(cause.create('bolt', game.player.id), () => (game as any).negateCreatureMagic(target));
        expect(seen.kill()[0]!.origin).toMatchObject({ kind: 'negation', creditActorId: game.player.id });
        const expired = mob(game, 9); expired.setStatusDuration('lifespan_remaining', 1); expired.tickStatuses();
        expect(lastItem(seen.kill())!.origin).toMatchObject({ kind: 'lifespan', creditActorId: null });
        game.player.nutrition = 0;
        cause.withOrigin(cause.create('melee', 99), () => game.player.recoverPerTurn());
        expect(lastItem(seen.damage())!.origin).toBeNull();
    });
});
