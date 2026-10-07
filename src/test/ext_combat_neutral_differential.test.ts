import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { CombatSystem, type AttackResult } from '../engine/Combat/Combat';
import { Game } from '../engine/Core/Game';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { Random, RNGType, rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { Creature, resetEntityIds } from '../entities/Creature';
import { Monster, MonsterMode, MonsterState, type MonsterData } from '../entities/Monster';
import { Player } from '../entities/Player';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { ExtensionRuleInput, Json } from '../ext/types';
import monsters from '../data/monsters.json';
import { createHeadlessGame } from './harness';

// Deliberately call the TWO independent native implementations. A common wrapper,
// mocked CombatFormulas, or an expected-value function shared with production
// would allow a classic-only edit to slip through this differential guard.
type Options = NonNullable<Parameters<typeof CombatSystem.attack>[2]>;
type ThrownResult = ReturnType<typeof CombatSystem.resolveThrownWeapon>;
const solvers = CombatSystem as unknown as {
    resolveAttack(a: Creature, d: Creature, opts?: Options): AttackResult;
    resolveAttackExtended(a: Creature, d: Creature, opts?: Options): AttackResult;
    resolveThrownWeaponClassic(a: Player, d: Monster, item: Item, grid?: Grid): ThrownResult;
    resolveThrownWeaponExtended(a: Player, d: Monster, item: Item, grid?: Grid): ThrownResult;
};
type Direction = 'player-monster' | 'monster-player' | 'ally-enemy' | 'enemy-ally';
type Scene = { attacker: Creature; defender: Creature; player: Player; missile: Item; grid: Grid; opts: Options };
type Profile = { name: string; directions?: Direction[]; apply(scene: Scene): void };
const directions: Direction[] = ['player-monster', 'monster-player', 'ally-enemy', 'enemy-ally'];
const seeds = Array.from({ length: 32 }, (_, n) => (0x1c000000001n + BigInt(n) * 0x9e3779b9n).toString());
const data = (monsters as MonsterData[]).find(m => m.id === 'rat')!;

beforeAll(() => {
    if (!i18next.isInitialized) void i18next.init({ lng: 'en', fallbackLng: false, resources: {}, initImmediate: false });
});
afterEach(() => { vi.restoreAllMocks(); logger.onDisturb = null; logger.reset(); });

/** Capture the entire own-property object graph, not EntitySnapshot's allowlist.
 * This includes Sets, Maps, undefined, non-enumerable fields, reference aliasing,
 * inventory/equipment and ally leader links. extensionHooks live in a WeakMap:
 * the sole non-state difference is the explicitly installed session adapter. */
function fullGraph(root: unknown): unknown {
    const seen = new Map<object, number>();
    const visit = (value: unknown): unknown => {
        if (value === null || typeof value !== 'object') return value;
        if (seen.has(value)) return { ref: seen.get(value) };
        const id = seen.size; seen.set(value, id);
        if (value instanceof Set) return { id, type: 'Set', values: [...value].map(visit) };
        if (value instanceof Map) return { id, type: 'Map', entries: [...value].map(([k, v]) => [visit(k), visit(v)]) };
        return { id, type: Object.getPrototypeOf(value)?.constructor?.name ?? null,
            fields: Reflect.ownKeys(value).map(key => {
                const d = Object.getOwnPropertyDescriptor(value, key)!;
                return [key, { enumerable: d.enumerable, configurable: d.configurable, writable: d.writable,
                    value: visit(d.value), get: d.get, set: d.set }];
            }) };
    };
    return visit(root);
}

function initialRandom(seed: string): void {
    const random = new Random(seed);
    // Start with nonzero counts and DIFFERENT states, so accidental resets or
    // cosmetic/substantive swaps cannot be hidden by identical fresh streams.
    for (let i = 0; i < 7; i++) random.randRange(0, 10000);
    random.setRNG(RNGType.RNG_COSMETIC);
    for (let i = 0; i < 3; i++) random.randRange(0, 10000);
    random.setRNG(RNGType.RNG_SUBSTANTIVE);
    rng.setState(random.getState());
}
function item(category: ItemCategory, name = 'parity fixture'): Item {
    return new Item(name, ')', 0xffffff, category);
}
function ring(player: Player, identityId: string, enchantment: number): void {
    const value = item(ItemCategory.RING); value.identityId = identityId; value.enchantment = enchantment;
    player.ringLeft = value; player.inventory.items.push(value);
}
function makeScene(seed: string, direction: Direction): Scene {
    resetEntityIds(); initialRandom(seed);
    const gen = new Random(BigInt(seed) ^ 0xd1ff3e71n);
    const player = new Player(4, 4);
    const first = new Monster(5, 4, data), second = new Monster(4, 4, data);
    const [attacker, defender] = direction === 'player-monster' ? [player, first]
        : direction === 'monster-player' ? [first, player] : [second, first];
    if (direction === 'ally-enemy') second.isAlly = true;
    if (direction === 'enemy-ally') first.isAlly = true;
    for (const actor of [player, first, second]) {
        actor.hp = gen.randRange(1, 90); actor.maxHp = 100;
        actor.weaknessAmount = gen.randRange(0, 4);
        actor.ticksUntilTurn = gen.randRange(-30, 120);
        if (actor instanceof Monster) {
            actor.state = MonsterState.HUNTING; actor.accuracy = gen.randRange(0, 140);
            actor.defense = gen.randRange(0, 130); actor.submerged = true;
            actor.damageString = `${gen.randRange(1, 4)}d${gen.randRange(2, 9)}`;
            actor.damageClumping = gen.randRange(1, 4);
        }
    }
    player.strength = gen.randRange(8, 22);
    const missile = item(ItemCategory.WEAPON);
    missile.damage = `${gen.randRange(1, 4)}d${gen.randRange(2, 9)}`;
    missile.clumping = gen.randRange(1, 4); missile.enchantment = gen.randRange(-3, 6);
    missile.strengthRequired = gen.randRange(10, 18);
    missile.flags = [gen.randRange(0, 1) ? 'ITEM_ATTACKS_QUICKLY' : 'ITEM_ATTACKS_STAGGER'];
    if (gen.randRange(0, 3)) { player.equippedWeapon = missile; player.inventory.items.push(missile); }
    const armor = item(ItemCategory.ARMOR); armor.armor = gen.randRange(1, 8);
    armor.enchantment = gen.randRange(-2, 5); armor.strengthRequired = gen.randRange(10, 18);
    if (gen.randRange(0, 3)) { player.equippedArmor = armor; player.inventory.items.push(armor); }
    player.setStatusDuration('donning', gen.randRange(0, 4));
    defender.setStatusDuration('entranced', gen.randRange(1, 8));
    defender.setStatusDuration('magical_fear', gen.randRange(1, 12));
    const grid = new Grid(12, 9);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
        grid.setTerrain(x, y, TerrainType.FLOOR, '.', 0x888888);
        grid.getCell(x, y)!.isVisible = true;
    }
    return { attacker, defender, player, missile, grid,
        opts: gen.randRange(0, 3) === 0 ? { grid } : {} };
}
function ownEquipment(scene: Scene):void {
    for(const item of [scene.player.equippedWeapon,scene.player.equippedArmor,scene.player.ringLeft,scene.player.ringRight])
        if(item&&!scene.player.inventory.items.includes(item))scene.player.inventory.items.push(item);
}
function neutral(scene: Scene) {
    ownEquipment(scene);
    const calls: { port: string; input: ExtensionRuleInput }[] = [];
    const registry = new ExtensionRegistry();
    registry.register('neutral-parity', '1.0.0', () => ({ id: 'neutral-parity', version: '1.0.0',
        initialState: () => ({}), validateState: (value): value is Json => !!value && typeof value === 'object',
        statSources:{collect:()=>[]} }));
    const runtime = new ExtensionRuntime(registry, registry.manifest(['neutral-parity']), {
        playerId: () => scene.player.id, depth: () => 1,
        randomInt: () => { throw new Error('Neutral policy must not consume RNG'); },
        message: () => { throw new Error('Neutral policy must not emit messages'); },
    });
    for (const actor of new Set([scene.player, scene.attacker, scene.defender])) runtime.attachCreature(actor);
    const evaluatePair=runtime.stats.evaluatePair.bind(runtime.stats);
    runtime.stats.evaluatePair=(actorId,targetId,kind,facts)=>{
        calls.push({port:kind==='hit'?'hitChance':'physicalDamage',input:{actorId,targetId,baseValue:facts.baseValue!,rollMode:facts.probabilityRoll===false?'skip-guaranteed-hit':'roll-probability'} as ExtensionRuleInput});
        return evaluatePair(actorId,targetId,kind,facts);
    };
    return { runtime, calls };
}
const mon = (actor: Creature) => actor as Monster;
const defenderMonster: Direction[] = ['player-monster', 'ally-enemy', 'enemy-ally'];
const attackerMonster: Direction[] = ['monster-player', 'ally-enemy', 'enemy-ally'];
const profiles: Profile[] = [
    { name: 'ordinary', apply: () => {} },
    { name: 'sleep', directions: defenderMonster, apply: s => { mon(s.defender).state = MonsterState.ASLEEP; } },
    { name: 'paralysis', apply: s => s.defender.setStatusDuration('paralyzed', 7) },
    { name: 'web-stuck', apply: s => s.defender.setStatusDuration('stuck', 7) },
    { name: 'captive', directions: defenderMonster, apply: s => { mon(s.defender).isCaged = true; } },
    { name: 'sneak-dagger', directions: ['player-monster'], apply: s => {
        mon(s.defender).state = MonsterState.WANDERING; s.player.equippedWeapon = s.missile;
        s.missile.flags = ['ITEM_SNEAK_ATTACK_BONUS'];
    } },
    { name: 'wandering-ally-no-sneak', directions: defenderMonster, apply: s => {
        mon(s.defender).isAlly = true; mon(s.defender).state = MonsterState.WANDERING;
    } },
    { name: 'inanimate-sleep', directions: defenderMonster, apply: s => {
        mon(s.defender).behaviorFlags.add('MONST_INANIMATE'); mon(s.defender).state = MonsterState.ASLEEP;
    } },
    { name: 'inanimate-paralysis', directions: defenderMonster, apply: s => {
        mon(s.defender).behaviorFlags.add('MONST_INANIMATE'); s.defender.setStatusDuration('paralyzed', 7);
    } },
    { name: 'weapon-immune', directions: defenderMonster, apply: s => mon(s.defender).behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS') },
    { name: 'invulnerable', directions: defenderMonster, apply: s => mon(s.defender).behaviorFlags.add('MONST_INVULNERABLE') },
    { name: 'partial-shield', apply: s => s.defender.applyShield(15) },
    { name: 'full-shield', apply: s => s.defender.applyShield(10000) },
    { name: 'initial-grab', directions: attackerMonster, apply: s => mon(s.attacker).abilityFlags.add('MA_SEIZES') },
    { name: 'existing-grab', directions: attackerMonster, apply: s => {
        mon(s.attacker).abilityFlags.add('MA_SEIZES'); s.attacker.seizing = s.defender.seized = true;
    } },
    { name: 'aquatic-vs-flight', directions: attackerMonster, apply: s => {
        mon(s.attacker).behaviorFlags.add('MONST_RESTRICTED_TO_LIQUID'); s.defender.setStatusDuration('flying', 4);
    } },
    { name: 'kamikaze', directions: attackerMonster, apply: s => mon(s.attacker).abilityFlags.add('MA_KAMIKAZE') },
    { name: 'poison-touch', directions: attackerMonster, apply: s => mon(s.attacker).abilityFlags.add('MA_POISONS') },
    { name: 'poison-through-shield', directions: attackerMonster, apply: s => {
        mon(s.attacker).abilityFlags.add('MA_POISONS'); s.defender.applyShield(10000);
    } },
    { name: 'poison-armor-zero', directions: attackerMonster, apply: s => {
        mon(s.attacker).abilityFlags.add('MA_POISONS'); s.opts.beforeDamage = () => 0;
    } },
    { name: 'weakness-touch', directions: attackerMonster, apply: s => mon(s.attacker).abilityFlags.add('MA_CAUSES_WEAKNESS') },
    { name: 'monster-transference', directions: attackerMonster, apply: s => mon(s.attacker).abilityFlags.add('MA_TRANSFERENCE') },
    { name: 'positive-transference', directions: ['player-monster'], apply: s => ring(s.player, 'ring_of_transference', 3) },
    { name: 'cursed-transference', directions: ['player-monster'], apply: s => ring(s.player, 'ring_of_transference', -3) },
    { name: 'reaping-recharge-message', directions: ['player-monster'], apply: s => {
        ring(s.player, 'ring_of_reaping', 3); mon(s.defender).state = MonsterState.ASLEEP;
        const charm = item(ItemCategory.CHARM); charm.identityId = 'charm_of_health';
        charm.enchantment = 2; charm.cooldownRemaining = 1; s.player.inventory.items.push(charm);
        const staff = item(ItemCategory.STAFF); staff.identityId = 'staff_of_fire'; staff.enchantment = 2;
        staff.charges = 0; staff.maxCharges = 2; staff.staffRechargeRemaining = 1; s.player.inventory.items.push(staff);
    } },
    { name: 'theft-message', directions: ['monster-player'], apply: s => {
        mon(s.attacker).abilityFlags.add('MA_HIT_STEAL_FLEE'); s.defender.setStatusDuration('paralyzed', 8);
        const food = item(ItemCategory.FOOD, 'ration'); s.player.inventory.items.push(food);
    } },
    { name: 'lunge', directions: ['player-monster'], apply: s => { s.opts.lungeAttack = true; } },
    { name: 'armor-zero', apply: s => { s.opts.beforeDamage = () => 0; } },
    { name: 'armor-reduction', apply: s => { s.opts.beforeDamage = amount => Math.max(0, amount - 3); } },
    ...['speed', 'quietus', 'paralyzing', 'multiplicity', 'slowing', 'confusion', 'force', 'mercy', 'plenty', 'slaying'].map(kind => ({
        name: `rune-${kind}`, directions: ['player-monster'] as Direction[], apply: (s: Scene) => {
            s.player.equippedWeapon = s.missile; s.missile.runicType = kind;
            s.missile.vorpalEnemy = 'animal'; // rat belongs to the real animal class
        },
    })),
    { name: 'rune-slaying-nonmatching', directions: ['player-monster'], apply: s => {
        s.player.equippedWeapon = s.missile; s.missile.runicType = 'slaying'; s.missile.vorpalEnemy = 'undead';
    } },
    { name: 'permanent-fleeing-fear', directions: defenderMonster, apply: s => {
        mon(s.defender).creatureMode = MonsterMode.PERM_FLEEING; mon(s.defender).state = MonsterState.FLEEING;
        s.defender.setStatusDuration('magical_fear', 20);
    } },
    { name: 'sneak-immune-shielded', directions: ['player-monster'], apply: s => {
        mon(s.defender).state = MonsterState.WANDERING; mon(s.defender).behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS');
        s.defender.applyShield(70); s.opts.lungeAttack = true;
    } },
    { name: 'poison-grab-paralyzed-shielded', directions: attackerMonster, apply: s => {
        mon(s.attacker).abilityFlags.add('MA_POISONS'); mon(s.attacker).abilityFlags.add('MA_SEIZES');
        s.attacker.seizing = s.defender.seized = true; s.defender.setStatusDuration('paralyzed', 4); s.defender.applyShield(10000);
    } },
];

function execute(scene: Scene, extended: boolean, thrown = false, publicEntry = false) {
    ownEquipment(scene);
    const extension = extended ? neutral(scene) : undefined;
    const beforeActors = fullGraph([scene.attacker, scene.defender, scene.player, scene.missile]);
    const beforeRng = rng.getState();
    let disturbances = 0; logger.reset(); logger.turn = 17; logger.onDisturb = () => { disturbances++; };
    const result = thrown
        ? publicEntry ? CombatSystem.resolveThrownWeapon(scene.player, mon(scene.defender), scene.missile, scene.opts.grid)
            : extended ? solvers.resolveThrownWeaponExtended(scene.player, mon(scene.defender), scene.missile, scene.opts.grid)
                : solvers.resolveThrownWeaponClassic(scene.player, mon(scene.defender), scene.missile, scene.opts.grid)
        : publicEntry ? CombatSystem.attack(scene.attacker, scene.defender, scene.opts)
            : extended ? solvers.resolveAttackExtended(scene.attacker, scene.defender, scene.opts)
                : solvers.resolveAttack(scene.attacker, scene.defender, scene.opts);
    // Exercise the actual production presentation entry, including names,
    // circumstances, lethality, ally wording and buffering. It only needs these ports.
    Game.prototype.reportAttack.call({ player: scene.player, grid: scene.grid } as Game,
        scene.attacker, scene.defender, thrown ? { ...result, backstab: false } : result as AttackResult);
    const messages = logger.getState();
    return { result, beforeActors, actors: fullGraph([scene.attacker, scene.defender, scene.player, scene.missile]),
        messages, disturbances, beforeRng, rng: rng.getState(),
        draws: { substantive: rng.randomNumbersGenerated - beforeRng.randomNumbersGenerated,
            cosmetic: rng.cosmeticNumbersGenerated - beforeRng.cosmeticNumbersGenerated },
        // The complete grid catches blood/features as well as actor mutations.
        grid: fullGraph(scene.grid), calls: extension?.calls ?? [] };
}
function expectParity(classic: ReturnType<typeof execute>, extended: ReturnType<typeof execute>) {
    // Explicit fields keep failure diagnostics local; no projections/tolerances.
    expect(extended.beforeActors).toStrictEqual(classic.beforeActors);
    expect(extended.beforeRng).toStrictEqual(classic.beforeRng);
    expect(extended.result).toStrictEqual(classic.result);
    expect(extended.actors).toStrictEqual(classic.actors);
    expect(extended.messages).toStrictEqual(classic.messages);
    expect(extended.disturbances).toBe(classic.disturbances);
    expect(extended.rng).toStrictEqual(classic.rng);
    expect(extended.draws).toStrictEqual(classic.draws);
    expect(extended.grid).toStrictEqual(classic.grid);
}

describe('EXT-1c neutral combat differential insurance', () => {
    for (const direction of directions) for (const profile of profiles.filter(p => !p.directions || p.directions.includes(direction))) {
        it(`${direction}: ${profile.name}; 32 independently rebuilt fixed seeds`, () => {
            for (const seed of seeds) {
                const run = (extended: boolean) => { const scene = makeScene(seed, direction); profile.apply(scene); return execute(scene, extended); };
                expectParity(run(false), run(true));
            }
        });
    }
    const thrownProfiles = profiles.filter(p => !p.directions || p.directions.includes('player-monster'));
    for (const profile of thrownProfiles) it(`thrown: ${profile.name}; 32 independently rebuilt fixed seeds`, () => {
        for (const seed of seeds) {
            const run = (extended: boolean) => { const scene = makeScene(seed, 'player-monster'); profile.apply(scene); return execute(scene, extended, true); };
            expectParity(run(false), run(true));
        }
    });
    it('also reaches the independent adapters through public dispatch with a real neutral runtime', () => {
        for (const direction of directions) for (const seed of seeds.slice(0, 8)) {
            expectParity(execute(makeScene(seed, direction), false, false, true), execute(makeScene(seed, direction), true, false, true));
        }
        for (const seed of seeds.slice(0, 8)) expectParity(execute(makeScene(seed, 'player-monster'), false, true, true),
            execute(makeScene(seed, 'player-monster'), true, true, true));
    });
    it('really calls the identity policy, without consuming policy RNG or silently taking the classic branch', () => {
        const s = makeScene(seeds[0]!, 'player-monster'); s.defender.setStatusDuration('paralyzed', 3);
        const out = execute(s, true);
        expect(out.calls.map(call => call.port)).toEqual(['physicalDamage']);
        expect(out.result.hit).toBe(true);
        expect(out.result.damage).toBeGreaterThanOrEqual(0);
    });
    it('detects a classic-only result regression, actor mutation, message, and either RNG stream draw', () => {
        // Deliberate test-local mutants are restored after each independent run.
        // Production source remains untouched, and the real equality assertions
        // must reject each mutant, rather than merely snapshotting identical code.
        const original = solvers.resolveAttack;
        const mutants: Array<(s: Scene, result: AttackResult) => AttackResult> = [
            (_s, result) => ({ ...result, damage: result.damage + 1 }),
            (s, result) => { s.attacker.ticksUntilTurn++; return result; },
            (s, result) => { s.defender.maxStatus.confused = 123; return result; },
            (_s, result) => { logger.log('classic-only regression'); return result; },
            (_s, result) => { rng.randRange(0, 99); return result; },
            (_s, result) => { rng.setRNG(RNGType.RNG_COSMETIC); rng.randRange(0, 99); rng.setRNG(RNGType.RNG_SUBSTANTIVE); return result; },
        ];
        for (const mutate of mutants) {
            const classicScene = makeScene(seeds[0]!, 'player-monster');
            const spy = vi.spyOn(solvers, 'resolveAttack').mockImplementation((a, d, opts) => mutate(classicScene, original(a, d, opts)));
            const classic = execute(classicScene, false); spy.mockRestore();
            const extended = execute(makeScene(seeds[0]!, 'player-monster'), true);
            expect(() => expectParity(classic, extended)).toThrow();
        }
    });
});

type PreviewCase = { name: string; direction: Direction; apply?(s: Scene): void; probability?: number; hitDraws: 0 | 1; damageDrawsOnHit?: number };
const previewCases: PreviewCase[] = [
    { name: 'ordinary 37%', direction: 'monster-player', probability: 37, hitDraws: 1 },
    { name: 'ally attacks enemy 37%', direction: 'ally-enemy', probability: 37, hitDraws: 1 },
    { name: 'enemy attacks ally 37%', direction: 'enemy-ally', probability: 37, hitDraws: 1 },
    { name: 'ordinary 0% still rolls', direction: 'monster-player', apply: s => { mon(s.attacker).accuracy = 0; }, probability: 0, hitDraws: 1 },
    { name: 'ordinary 100% still rolls', direction: 'monster-player', apply: s => { mon(s.attacker).accuracy = 100; }, probability: 100, hitDraws: 1 },
    { name: 'fractional enchant and strength deficit', direction: 'player-monster', apply: s => {
        s.player.strength = 9; s.missile.strengthRequired = 13; s.missile.enchantment = 2.25; mon(s.defender).defense = 37;
    }, hitDraws: 1 },
    { name: 'unarmed weakness', direction: 'player-monster', apply: s => {
        s.player.equippedWeapon = null; s.player.weaknessAmount = 3; mon(s.defender).defense = 75;
    }, hitDraws: 1, damageDrawsOnHit: 1 },
    { name: 'armor donning and weakness', direction: 'monster-player', apply: s => {
        const armor = item(ItemCategory.ARMOR); armor.armor = 7; armor.enchantment = 2;
        armor.strengthRequired = 12; s.player.equippedArmor = armor; s.player.strength = 15;
        s.player.weaknessAmount = 1; s.player.setStatusDuration('donning', 2);
    }, hitDraws: 1 },
    { name: 'sleep skips hit RNG', direction: 'player-monster', apply: s => { mon(s.defender).state = MonsterState.ASLEEP; }, probability: 100, hitDraws: 0 },
    { name: 'paralysis skips hit RNG', direction: 'monster-player', apply: s => s.defender.setStatusDuration('paralyzed', 2), probability: 100, hitDraws: 0 },
    { name: 'web skips hit RNG', direction: 'monster-player', apply: s => s.defender.setStatusDuration('stuck', 2), probability: 100, hitDraws: 0 },
    { name: 'captive skips hit RNG', direction: 'player-monster', apply: s => { mon(s.defender).isCaged = true; }, probability: 100, hitDraws: 0 },
    { name: 'sneak skips hit RNG', direction: 'player-monster', apply: s => { mon(s.defender).state = MonsterState.WANDERING; }, probability: 100, hitDraws: 0 },
    { name: 'wandering ally is not sneak', direction: 'player-monster', apply: s => {
        mon(s.defender).state = MonsterState.WANDERING; mon(s.defender).isAlly = true; mon(s.defender).defense = 80;
    }, hitDraws: 1 },
    { name: 'inanimate sleep is not guaranteed', direction: 'player-monster', apply: s => {
        mon(s.defender).state = MonsterState.ASLEEP; mon(s.defender).behaviorFlags.add('MONST_INANIMATE'); mon(s.defender).defense = 80;
    }, hitDraws: 1 },
    { name: 'inanimate paralysis still skips hit RNG', direction: 'player-monster', apply: s => {
        mon(s.defender).behaviorFlags.add('MONST_INANIMATE'); s.defender.setStatusDuration('paralyzed', 2);
    }, probability: 100, hitDraws: 0 },
    { name: 'lunge skips hit RNG', direction: 'player-monster', apply: s => {
        s.opts.lungeAttack = true; mon(s.defender).defense = 80;
    }, probability: 100, hitDraws: 0 },
    { name: 'first grab is not a hit', direction: 'monster-player', apply: s => mon(s.attacker).abilityFlags.add('MA_SEIZES'), probability: 0, hitDraws: 0 },
    { name: 'one-sided attacker grab is not a hit', direction: 'monster-player', apply: s => {
        mon(s.attacker).abilityFlags.add('MA_SEIZES'); s.attacker.seizing = true;
    }, probability: 0, hitDraws: 0 },
    { name: 'one-sided defender grab is not a hit', direction: 'monster-player', apply: s => {
        mon(s.attacker).abilityFlags.add('MA_SEIZES'); s.defender.seized = true;
    }, probability: 0, hitDraws: 0 },
    { name: 'completed grab guarantees but still rolls', direction: 'monster-player', apply: s => {
        mon(s.attacker).abilityFlags.add('MA_SEIZES'); s.attacker.seizing = s.defender.seized = true;
    }, probability: 100, hitDraws: 1 },
    { name: 'paralysis outranks completed-grab roll', direction: 'monster-player', apply: s => {
        mon(s.attacker).abilityFlags.add('MA_SEIZES'); s.attacker.seizing = s.defender.seized = true;
        s.defender.setStatusDuration('paralyzed', 2);
    }, probability: 100, hitDraws: 0 },
    { name: 'first grab outranks paralysis', direction: 'monster-player', apply: s => {
        mon(s.attacker).abilityFlags.add('MA_SEIZES'); s.defender.setStatusDuration('paralyzed', 2);
    }, probability: 0, hitDraws: 0 },
    { name: 'aquatic rejection outranks paralysis and grab', direction: 'monster-player', apply: s => {
        mon(s.attacker).behaviorFlags.add('MONST_RESTRICTED_TO_LIQUID'); mon(s.attacker).abilityFlags.add('MA_SEIZES');
        s.defender.setStatusDuration('levitating', 2); s.defender.setStatusDuration('paralyzed', 2);
    }, probability: 0, hitDraws: 0 },
    { name: 'aquatic non-weapon attack is not rejected', direction: 'monster-player', apply: s => {
        mon(s.attacker).behaviorFlags.add('MONST_RESTRICTED_TO_LIQUID'); s.defender.setStatusDuration('flying', 2);
        s.opts.isWeaponAttack = false;
    }, probability: 37, hitDraws: 1 },
    { name: 'kamikaze outranks aquatic rejection and grab', direction: 'monster-player', apply: s => {
        mon(s.attacker).behaviorFlags.add('MONST_RESTRICTED_TO_LIQUID');
        mon(s.attacker).abilityFlags.add('MA_KAMIKAZE'); mon(s.attacker).abilityFlags.add('MA_SEIZES'); s.defender.setStatusDuration('flying', 2);
    }, probability: 100, hitDraws: 0 },
    { name: 'weapon immunity does not change hit chance', direction: 'player-monster', apply: s => {
        mon(s.defender).behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS'); mon(s.defender).defense = 80;
    }, hitDraws: 1 },
    { name: 'invulnerability does not change hit chance', direction: 'player-monster', apply: s => {
        mon(s.defender).behaviorFlags.add('MONST_INVULNERABLE'); mon(s.defender).defense = 80;
    }, hitDraws: 1 },
];
function previewScene(spec: PreviewCase): Scene {
    const s = makeScene(seeds[0]!, spec.direction); s.opts = {};
    for (const actor of [s.attacker, s.defender, s.player]) {
        actor.hp = actor.maxHp = 1000; actor.weaknessAmount = 0;
        actor.statusDurations = {}; actor.maxStatus = {}; actor.seized = actor.seizing = false;
        if (actor instanceof Monster) { actor.accuracy = 37; actor.defense = 0; actor.damageString = '0'; actor.damageClumping = 1; }
    }
    s.player.strength = 12; s.player.equippedArmor = null; s.player.equippedWeapon = s.missile;
    s.missile.damage = '0'; s.missile.strengthRequired = 12; s.missile.enchantment = 0; s.missile.runicType = undefined;
    spec.apply?.(s); ownEquipment(s); return s;
}

describe('EXT-1c exact preview probability and RNG boundaries', () => {
    for (const spec of previewCases) it(spec.name, () => {
        const pure = previewScene(spec);
        // The empty-dispatch assertion below describes the classic non-weapon
        // preview. Extended non-weapon pairs now share the melee stat domain;
        // ext_stats_review tests its modifiers and zero-source RNG equivalence.
        const ext = neutral(pure.opts.isWeaponAttack === false ? previewScene(spec) : pure);
        const before = fullGraph([pure.attacker, pure.defender, pure.player]), beforeRng = rng.getState(), beforeRuntime = ext.runtime.snapshot();
        const preview = CombatSystem.previewHitChance(pure.attacker, pure.defender, pure.opts);
        expect(fullGraph([pure.attacker, pure.defender, pure.player])).toStrictEqual(before);
        expect(rng.getState()).toStrictEqual(beforeRng); expect(ext.runtime.snapshot()).toStrictEqual(beforeRuntime);
        if (pure.opts.isWeaponAttack === false) expect(ext.calls).toEqual([]);
        if (spec.probability !== undefined) expect(preview).toBe(spec.probability);
        let successes = 0;
        // Exact support enumeration, NOT Monte Carlo and NOT CombatFormulas as
        // oracle. Feed every possible 0..99 value through the REAL classic
        // resolver + randPercent. Consume its underlying draw as normal, then
        // substitute only that draw's result; post-hit RNG is untouched.
        for (let bucket = 0; bucket < 100; bucket++) {
            const scene = previewScene(spec), initial = rng.getState();
            const range = rng.randRange.bind(rng); let hitDraws = 0;
            const draw = vi.spyOn(rng, 'randRange').mockImplementation((lo, hi) => {
                const value = range(lo, hi);
                if (lo === 0 && hi === 99 && hitDraws++ === 0) return bucket;
                return value;
            });
            const result = solvers.resolveAttack(scene.attacker, scene.defender, scene.opts);
            draw.mockRestore();
            successes += Number(result.hit);
            expect(result.hit, `bucket ${bucket}`).toBe(bucket < preview);
            expect(hitDraws, `bucket ${bucket}`).toBe(spec.hitDraws);
            expect(rng.randomNumbersGenerated - initial.randomNumbersGenerated).toBe(spec.hitDraws + (result.hit ? spec.damageDrawsOnHit ?? 0 : 0));
            expect(rng.cosmeticNumbersGenerated).toBe(initial.cosmeticNumbersGenerated);
            expect(rng.getState().streams[1]).toStrictEqual(initial.streams[1]);
            if (!spec.hitDraws) expect(rng.getState()).toStrictEqual(initial);
        }
        expect(preview).toBe(successes);
    });
    it('tests thrown guaranteed rolls, skipped rolls, immunity, and post-kill rune boundaries explicitly', () => {
        for (const extended of [false, true]) for (const setup of [
            { name: 'ordinary zero', accuracy: 0, expected: 1 },
            { name: 'slaying rolled guarantee', rune: 'slaying', expected: 2 },
            { name: 'web skips hit but not slaying rune', rune: 'slaying', stuck: true, expected: 1 },
            { name: 'paralysis skips hit', paralyzed: true, expected: 0 },
            { name: 'captive skips hit', captive: true, expected: 0 },
            { name: 'sleep does not skip thrown hit', sleep: true, expected: 1 },
            { name: 'sneak does not skip thrown hit', wandering: true, expected: 1 },
            { name: 'slaying kill skips rune roll', rune: 'slaying', lethal: true, expected: 1 },
            { name: 'inanimate suppresses ordinary rune', rune: 'force', inanimate: true, expected: 1 },
        ]) {
            const scene = previewScene({ name: setup.name, direction: 'player-monster', hitDraws: 1 });
            scene.missile.damage = '1'; scene.missile.runicType = setup.rune; scene.missile.vorpalEnemy = 'animal';
            if (setup.accuracy === 0) { scene.missile.enchantment = -20; mon(scene.defender).defense = 500; }
            if (setup.stuck) scene.defender.setStatusDuration('stuck', 2);
            if (setup.paralyzed) scene.defender.setStatusDuration('paralyzed', 2);
            if (setup.captive) mon(scene.defender).isCaged = true;
            if (setup.sleep) mon(scene.defender).state = MonsterState.ASLEEP;
            if (setup.wandering) mon(scene.defender).state = MonsterState.WANDERING;
            if (setup.lethal) scene.defender.hp = 1;
            if (setup.inanimate) mon(scene.defender).behaviorFlags.add('MONST_INANIMATE');
            const out = execute(scene, extended, true);
            expect(out.draws.substantive, `${setup.name}/${extended}`).toBe(setup.expected);
            expect(out.draws.cosmetic).toBe(0);
        }
        for (const extended of [false, true]) {
            const scene = previewScene({ name: 'immune thrown hit', direction: 'player-monster', hitDraws: 1 });
            scene.missile.damage = '10d20'; mon(scene.defender).behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS');
            const out = execute(scene, extended, true);
            expect(out.result).toStrictEqual({ hit: true, damage: 0, killed: false, triggeredRunic: undefined });
            expect(out.draws.substantive).toBe(1);
        }
    });
});

describe('EXT-1c reached branch witnesses', () => {
    it('actually reaches hit/miss, sneak, immune-zero, poisoned shield, seizure, theft and recharge messages', () => {
        const observed = new Set<string>();
        for (const [name, direction] of [
            ['ordinary', 'monster-player'], ['sneak-dagger', 'player-monster'], ['weapon-immune', 'player-monster'],
            ['poison-grab-paralyzed-shielded', 'monster-player'], ['initial-grab', 'monster-player'],
            ['theft-message', 'monster-player'], ['reaping-recharge-message', 'player-monster'],
            ['rune-slaying', 'player-monster'], ['rune-slaying-nonmatching', 'player-monster'],
        ] as const) {
            const profile = profiles.find(p => p.name === name)!;
            for (const seed of seeds) {
                const scene = makeScene(seed, direction); profile.apply(scene);
                const hp = scene.defender.hp, shield = scene.defender.getStatusDuration('shielded');
                const out = execute(scene, true), result = out.result as AttackResult;
                if (name === 'ordinary') observed.add(result.hit ? 'ordinary-hit' : 'ordinary-miss');
                if (name === 'sneak-dagger' && result.backstab && result.damage > 0) observed.add('sneak');
                if (name === 'weapon-immune' && result.hit) {
                    expect(result.damage).toBe(0); expect(scene.defender.hp).toBe(hp); observed.add('immune-zero');
                }
                if (name === 'poison-grab-paralyzed-shielded' && result.damage > 0) {
                    expect(result.damage).toBe(1); expect(scene.defender.hp).toBe(hp);
                    expect(scene.defender.getStatusDuration('shielded')).toBe(shield - 10);
                    expect(scene.defender.getStatusDuration('poisoned')).toBeGreaterThan(0); observed.add('shielded-poison');
                }
                if (name === 'initial-grab') {
                    expect(result).toMatchObject({ hit: false, damage: 0, seized: true });
                    expect(scene.attacker.seizing && scene.defender.seized).toBe(true);
                    expect(out.draws).toStrictEqual({ substantive: 0, cosmetic: 0 }); observed.add('grab');
                }
                if (name === 'theft-message' && mon(scene.attacker).carriedItem) {
                    expect(out.messages.messages.some(m => m.text.includes('stole'))).toBe(true); observed.add('theft');
                }
                if (name === 'reaping-recharge-message' && out.messages.messages.some(m => m.text.includes('recharged'))) observed.add('recharge');
                if (name === 'rune-slaying' && result.triggeredRunic === 'slaying') observed.add('matching-slaying');
                if (name === 'rune-slaying-nonmatching' && result.hit) {
                    expect(result.triggeredRunic).toBeUndefined(); observed.add('nonmatching-slaying-hit');
                }
            }
        }
        expect([...observed].sort()).toStrictEqual(['ordinary-hit', 'ordinary-miss', 'sneak', 'immune-zero', 'shielded-poison',
            'grab', 'theft', 'recharge', 'matching-slaying', 'nonmatching-slaying-hit'].sort());
    });
});

describe('EXT-1c force rune downstream knockback parity', () => {
    for (const thrown of [false, true]) for (const obstacle of ['none', 'wall', 'monster', 'immune-collision'] as const) {
        it(`${thrown ? 'thrown' : 'melee'} force: ${obstacle}; full native displacement/impact/message/RNG equality`, () => {
            let triggered = 0;
            for (const seed of seeds.slice(0, 4)) {
                const run = (extended: boolean) => {
                    // Use real Game runic, vision, terrain, blood and collision
                    // paths, not a hand-written displacement port or mock effect.
                    const game = createHeadlessGame(16831, 'test');
                    const s = previewScene({ name: 'force integration', direction: 'player-monster', hitDraws: 0 });
                    initialRandom(seed);
                    s.grid = game.grid; s.opts = {};
                    for (let y = 1; y < 9; y++) for (let x = 1; x < 24; x++) {
                        s.grid.setTerrain(x, y, TerrainType.FLOOR); s.grid.getCell(x, y)!.isVisible = true;
                    }
                    s.player.loc = { x: 4, y: 4 }; s.defender.loc = { x: 5, y: 4 };
                    mon(s.defender).state = MonsterState.ASLEEP; mon(s.defender).submerged = false;
                    s.missile.damage = '1'; s.missile.enchantment = 3; s.missile.runicType = 'force'; s.missile.flags = [];
                    const blocker = new Monster(9, 4, data); blocker.hp = blocker.maxHp = 1000;
                    blocker.state = MonsterState.HUNTING;
                    if (obstacle === 'wall' || obstacle === 'immune-collision') s.grid.setTerrain(9, 4, TerrainType.WALL);
                    if (obstacle === 'immune-collision') mon(s.defender).behaviorFlags.add('MONST_IMMUNE_TO_WEAPONS');
                    game.player = s.player; game.monsters = obstacle === 'monster' ? [mon(s.defender), blocker] : [mon(s.defender)];
                    game.dormantMonsters = []; game.items = [];
                    const ext = extended ? neutral(s) : undefined;
                    game.extensionRuntime = ext?.runtime ?? null;
                    if (ext) ext.runtime.attachCreature(blocker);
                    const beforeActors = fullGraph([s.player, s.defender, blocker]), before = rng.getState();
                    logger.reset(); logger.onDisturb = null;
                    const result = thrown ? CombatSystem.resolveThrownWeapon(s.player, mon(s.defender), s.missile)
                        : CombatSystem.attack(s.player, s.defender);
                    const hpBeforeRune = s.defender.hp;
                    game.reportAttack(s.player, s.defender, { ...result, backstab: 'backstab' in result ? result.backstab : false });
                    if (result.triggeredRunic) (game as unknown as {
                        applyWeaponRunicEffect(target: Monster, damage: number, kind: string): void;
                    }).applyWeaponRunicEffect(mon(s.defender), result.damage, result.triggeredRunic);
                    if (result.triggeredRunic === 'force') {
                        expect(s.defender.x).toBe(obstacle === 'none' ? 13 : 8);
                        expect(s.defender.y).toBe(4);
                        expect(hpBeforeRune - s.defender.hp).toBe(obstacle === 'wall' || obstacle === 'monster' ? 3 : 0);
                        expect(blocker.hp).toBe(obstacle === 'monster' ? 997 : 1000);
                        expect(logger.getState().messages.some(m => m.text.includes('backward 8 tiles'))).toBe(true);
                    }
                    return { result, beforeActors, actors: fullGraph([s.player, s.defender, blocker]), messages: logger.getState(),
                        before, after: rng.getState(), draws: [rng.randomNumbersGenerated - before.randomNumbersGenerated,
                            rng.cosmeticNumbersGenerated - before.cosmeticNumbersGenerated] };
                };
                const classic = run(false), extended = run(true);
                expect(extended).toStrictEqual(classic);
                if (classic.result.triggeredRunic === 'force') triggered++;
            }
            expect(triggered).toBeGreaterThan(0); // A named force case must actually displace a target.
        });
    }
});
