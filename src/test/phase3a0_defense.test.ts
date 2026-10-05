import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    ACTOR_DEFENSE_LIMITS, ActorCombatResolutionAuthority, selectPartBreakConsequence,
    validateActorCombatResolutionState, validateNativeMeleeResolutionIntent,
    type ActorCombatResolutionState, type ActorDefenseState, type NativeMeleeResolutionIntent,
    type PartBreakConsequenceRequest, type PreparedNativeMelee,
} from '../engine/Combat/ActorCombatResolution';
import { CombatSystem } from '../engine/Combat/Combat';
import { withActorActionScope, type ActorActionScope } from '../engine/Core/ActorActionScope';
import { Item, ItemCategory } from '../engine/Items/Item';
import { Grid, TerrainType } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { EffectCausality } from '../ext/causality';
import type { CreatureExtensionHooks } from '../ext/types';
import monsterData from '../data/monsters.json';
import { createHeadlessGame } from './harness';

const rat = (monsterData as MonsterData[]).find(m => m.id === 'rat')!;
function resources(actorId: number, depth: number): ActorDefenseState {
    return { actorId, depth, poise: 10, poiseCapacity: 10, staggerRemainingTicks: 0, dodgeRemainingTicks: 0,
        parryRemainingTicks: 0, parryFacing: { x: -1, y: 0 }, parryPoiseDamage: 3, parryStaggerTicks: 7 };
}
function scene(npc = false) {
    const game = createHeadlessGame(7301, 'test'); game.animationEnabled = false;
    game.grid = new Grid(12, 12);
    for (let x = 0; x < 12; x++) for (let y = 0; y < 12; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR); game.grid.getCell(x, y)!.isVisible = true;
    }
    game.player.loc = { x: 4, y: 4 }; game.player.hp = game.player.maxHp = 100;
    const monster = new Monster(5, 4, rat); monster.state = MonsterState.HUNTING;
    monster.hp = monster.maxHp = 100; monster.damageString = '2d4'; monster.damageClumping = 1;
    game.monsters = [monster]; game.dormantMonsters = [];
    const attacker = npc ? monster : game.player, defender = npc ? game.player : monster;
    const sourceState = resources(attacker.id, game.depth), defenseState = resources(defender.id, game.depth);
    if (npc) defenseState.parryFacing = { x: 1, y: 0 };
    const state: ActorCombatResolutionState = { schema: 1, nextResolutionId: 1, actors: [sourceState, defenseState] };
    const authority = new ActorCombatResolutionAuthority(game, state);
    const beforeAttack = vi.fn(), afterAttack = vi.fn(), physicalResolved = vi.fn(), damage = vi.fn();
    const hooks: CreatureExtensionHooks = { causality: new EffectCausality(), beforeAttack, afterAttack, physicalResolved, damage,
        partyId: () => null, rule: (_port, input) => input.baseValue };
    attacker.extensionHooks = hooks; defender.extensionHooks = hooks;
    rng.seedRandomGenerator(923456);
    const intent: NativeMeleeResolutionIntent = { kind: 'native-melee', depth: game.depth,
        sourceEntityId: attacker.id, targetEntityId: defender.id, dodgeable: true, parryable: true };
    const commit = (plan = authority.prepareNativeMelee(intent)!) => withActorActionScope(game,
        npc ? 'npc-scheduler' : 'player-command', attacker.id, scope => authority.commitNativeMelee(scope, plan));
    return { game, attacker, defender, monster, authority, state, sourceState, defenseState, hooks,
        beforeAttack, afterAttack, physicalResolved, damage, intent, commit };
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

// The fixtures exercise the engine entry directly. There is deliberately no
// descriptor, command, AI strategy, gameplay profile, or automatic installation.
describe('3a0 bounded defense authority before native melee', () => {
    it('dodge precedes parry and bypasses every native hook, probability roll and physical fact', () => {
        const s = scene(); s.defenseState.dodgeRemainingTicks = s.defenseState.parryRemainingTicks = 5;
        const native = vi.spyOn(CombatSystem, 'attack'), random = rng.getState(), causal = s.hooks.causality.snapshot();
        const hp = [s.attacker.hp, s.defender.hp], source = structuredClone(s.sourceState);
        const result = s.commit();
        expect(result).toEqual({ kind: 'defended', fact: { kind: 'defended', resolutionId: 1, depth: s.game.depth,
            sourceEntityId: s.attacker.id, targetEntityId: s.defender.id, defense: 'dodge' } });
        expect(s.defenseState.parryRemainingTicks).toBe(5); expect(s.defenseState.dodgeRemainingTicks).toBe(5);
        expect(s.sourceState).toEqual(source); expect([s.attacker.hp, s.defender.hp]).toEqual(hp);
        for (const spy of [native, s.beforeAttack, s.afterAttack, s.physicalResolved, s.damage]) expect(spy).not.toHaveBeenCalled();
        expect(rng.getState()).toEqual(random); expect(s.hooks.causality.snapshot()).toEqual(causal);
        expect(Object.isFrozen(result)).toBe(true); if (result?.kind !== 'defended') throw Error('Expected defense');
        expect(Object.isFrozen(result.fact)).toBe(true);
    });
    it.each([false, true])('player/NPC share deterministic single-use parry, zero ordinary RNG (NPC=%s)', npc => {
        const s = scene(npc); s.defenseState.parryRemainingTicks = 5;
        const random = rng.getState(), hp = s.defender.hp, native = vi.spyOn(CombatSystem, 'attack');
        expect(s.commit()).toMatchObject({ kind: 'defended', fact: { defense: 'parry' },
            sourceInterruption: { kind: 'cancel-pending-source', sourceEntityId: s.attacker.id, breakRecoveryTicks: 7 } });
        expect(s.defenseState.parryRemainingTicks).toBe(0); expect(s.sourceState.poise).toBe(7);
        expect(s.sourceState.staggerRemainingTicks).toBe(7); expect(s.defender.hp).toBe(hp);
        expect(s.physicalResolved).not.toHaveBeenCalled(); expect(native).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
        expect(s.authority.prepareNativeMelee(s.intent)).toBeNull();
    });
    it('a consumed parry leaves a later same-tick segment to native resolution', () => {
        const s = scene(); s.defenseState.parryRemainingTicks = 3; s.defenseState.parryStaggerTicks = 0;
        expect(s.commit()).toMatchObject({ kind: 'defended' });
        expect(s.commit()).toMatchObject({ kind: 'native', resolutionId: 2 });
        expect(s.beforeAttack).toHaveBeenCalledTimes(1); expect(s.physicalResolved).toHaveBeenCalledTimes(1);
    });
    it('parry end boundary is exclusive after elapsed is applied before contact', () => {
        const s = scene(); s.defenseState.parryRemainingTicks = 5;
        const random = rng.getState();
        withActorActionScope(s.game, 'npc-scheduler', s.defender.id, scope => s.authority.advanceDefenseTime(scope, s.defender.id, 5));
        expect(s.defenseState.parryRemainingTicks).toBe(0); expect(rng.getState()).toEqual(random);
        expect(s.commit()).toMatchObject({ kind: 'native' }); expect(s.physicalResolved).toHaveBeenCalledTimes(1);
    });
    it('window includes its first/last positive tick and advancing cannot increase or underflow', () => {
        const s = scene(); s.defenseState.parryRemainingTicks = 5; s.defenseState.dodgeRemainingTicks = 2;
        withActorActionScope(s.game, 'npc-scheduler', s.defender.id, scope => s.authority.advanceDefenseTime(scope, s.defender.id, 4));
        expect(s.defenseState.parryRemainingTicks).toBe(1); expect(s.defenseState.dodgeRemainingTicks).toBe(0);
        expect(s.commit()).toMatchObject({ kind: 'defended', fact: { defense: 'parry' } });
    });
    it.each(['unparryable', 'wrong-facing', 'disabled-defender'] as const)('%s does not consume the parry window', variant => {
        const s = scene(); s.defenseState.parryRemainingTicks = 9;
        if (variant === 'unparryable') s.intent.parryable = false;
        if (variant === 'wrong-facing') s.defenseState.parryFacing = { x: 1, y: 0 };
        if (variant === 'disabled-defender') s.defender.setStatusDuration('paralyzed', 4);
        expect(s.commit()).toMatchObject({ kind: 'native' }); expect(s.defenseState.parryRemainingTicks).toBe(9);
        expect(s.physicalResolved).toHaveBeenCalledTimes(1);
    });
    it('non-dodgeable physical hits and unsupported environmental intents cannot gain dodge immunity', () => {
        const s = scene(); s.defenseState.dodgeRemainingTicks = 10; s.intent.dodgeable = false;
        expect(s.commit()).toMatchObject({ kind: 'native' });
        const before = s.authority.snapshot(), random = rng.getState();
        for (const kind of ['fire', 'poison', 'fall', 'projectile', 'dot'])
            expect(() => s.authority.prepareNativeMelee({ ...s.intent, kind })).toThrow('unsupported');
        expect(s.authority.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
    });
    it('native fallthrough preserves native result, shield/HP, causality facts and both random streams', () => {
        const direct = scene(); direct.defender.applyShield(11);
        const expected = CombatSystem.attack(direct.attacker, direct.defender, { grid: direct.game.grid, itemGenerationDepth: direct.game.depth });
        const random = rng.getState(), hp = direct.defender.hp, shield = direct.defender.getStatusDuration('shielded');
        const facts = direct.physicalResolved.mock.calls.map(call => call[2]);
        const wrapped = scene(); wrapped.defender.applyShield(11);
        const result = wrapped.commit(); expect(result?.kind).toBe('native');
        if (result?.kind !== 'native') throw Error('Expected native fallthrough');
        expect(result.attack).toEqual(expected); expect(wrapped.defender.hp).toBe(hp);
        expect(wrapped.defender.getStatusDuration('shielded')).toBe(shield); expect(rng.getState()).toEqual(random);
        expect(wrapped.physicalResolved.mock.calls.map(call => call[2])).toEqual(facts);
        expect(wrapped.beforeAttack).toHaveBeenCalledTimes(1); expect(wrapped.afterAttack).toHaveBeenCalledTimes(1);
    });
    it('parry requires an engine-owned source resource row for configured consequences', () => {
        const s = scene(); s.defenseState.parryRemainingTicks = 5; s.state.actors.shift();
        const before = s.authority.snapshot(), random = rng.getState();
        expect(() => s.commit()).toThrow('resource owner'); expect(s.authority.snapshot()).toEqual(before);
        expect(s.defenseState.parryRemainingTicks).toBe(5); expect(rng.getState()).toEqual(random);
    });
});

describe('3a0 eligibility, stale preparation and synchronous scope', () => {
    it.each(['dead', 'paralyzed', 'entranced', 'confused', 'caged', 'dormant', 'sleeping', 'immobile', 'turret', 'activation'] as const)
    ('%s source is rejected before a defense window or RNG is consumed', gate => {
        const s = scene(true); s.defenseState.parryRemainingTicks = 7;
        switch (gate) {
            case 'dead': s.monster.hp = 0; break;
            case 'paralyzed': case 'entranced': case 'confused': s.monster.setStatusDuration(gate, 3); break;
            case 'caged': s.monster.isCaged = true; break;
            case 'dormant': s.monster.isDormant = true; break;
            case 'sleeping': s.monster.state = MonsterState.ASLEEP; break;
            case 'immobile': s.monster.behaviorFlags.add('MONST_IMMOBILE'); break;
            case 'turret': s.monster.behaviorFlags.add('MONST_TURRET'); break;
            case 'activation': s.monster.behaviorFlags.add('MONST_GETS_TURN_ON_ACTIVATION'); break;
        }
        const before = s.authority.snapshot(), random = rng.getState();
        expect(s.authority.prepareNativeMelee(s.intent)).toBeNull(); expect(s.authority.snapshot()).toEqual(before);
        expect(s.physicalResolved).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
    });
    it.each(['dead-target', 'captive-target', 'friendly-target', 'off-depth', 'out-of-contact', 'invisible-target', 'wall', 'diagonal-wall'] as const)
    ('%s fails spatial/native eligibility before defense', gate => {
        const s = scene(); s.defenseState.parryRemainingTicks = 5;
        switch (gate) {
            case 'dead-target': s.defender.hp = 0; break;
            case 'captive-target': s.monster.isCaged = true; break;
            case 'friendly-target': s.monster.isAlly = true; break;
            case 'off-depth': s.intent.depth++; break;
            case 'out-of-contact': s.monster.loc.x += 3; break;
            case 'invisible-target': s.monster.setStatusDuration('invisible', 4); break;
            case 'wall': s.game.grid.setTerrain(s.monster.x, s.monster.y, TerrainType.WALL); break;
            case 'diagonal-wall': s.monster.loc.y++; s.game.grid.setTerrain(5, 4, TerrainType.WALL); break;
        }
        const random = rng.getState(); expect(s.authority.prepareNativeMelee(s.intent)).toBeNull();
        expect(s.defenseState.parryRemainingTicks).toBe(5); expect(rng.getState()).toEqual(random);
    });
    it('player risk targets cannot bypass native approval with a synchronous scope', () => {
        const s = scene(); s.game.player.equippedWeapon = new Item('fixture sword', ')', 0xffffff, ItemCategory.WEAPON);
        s.defenseState.parryRemainingTicks = 5;
        const plan = s.authority.prepareNativeMelee(s.intent)!;
        s.monster.behaviorFlags.add('MONST_DEFEND_DEGRADE_WEAPON');
        const random = rng.getState(), before = s.authority.snapshot();
        expect(s.game.prepareActorAttackRisks(s.attacker.id, [...s.game.footprintOf(s.defender)])).toHaveLength(1);
        expect(s.authority.prepareNativeMelee(s.intent)).toBeNull(); expect(s.commit(plan)).toBeNull();
        expect(s.authority.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        expect(s.beforeAttack).not.toHaveBeenCalled();
    });
    it('unopened spatial/body state remains explicitly rejected instead of using point fallback', () => {
        const s = scene(); s.monster.spatial = { schema: 1, footprintId: 'builtin:square-2', pose: 'r90' };
        expect(() => s.authority.prepareNativeMelee(s.intent)).toThrow('not open');
    });
    it.each(['position', 'death', 'defense', 'depth'] as const)('commit revalidates %s and consumes no defense or random on stale plan', change => {
        const s = scene(); s.defenseState.parryRemainingTicks = 6; const plan = s.authority.prepareNativeMelee(s.intent)!;
        if (change === 'position') s.monster.loc.y++;
        if (change === 'death') s.monster.hp = 0;
        if (change === 'defense') s.defenseState.parryRemainingTicks--;
        if (change === 'depth') s.game.depth++;
        const before = structuredClone(s.state), random = rng.getState();
        expect(s.commit(plan)).toBeNull(); expect(s.state).toEqual(before); expect(rng.getState()).toEqual(random);
        expect(() => s.commit(plan)).toThrow('consumed');
    });
    it('forged, cross-owner, wrong-actor, wrong-origin and expired scopes cannot commit', () => {
        const s = scene(); s.defenseState.parryRemainingTicks = 5; const plan = s.authority.prepareNativeMelee(s.intent)!;
        expect(() => s.authority.commitNativeMelee({} as ActorActionScope, plan)).toThrow('scope');
        expect(() => withActorActionScope({}, 'player-command', s.attacker.id, scope => s.authority.commitNativeMelee(scope, plan))).toThrow('scope');
        expect(() => withActorActionScope(s.game, 'player-command', s.defender.id, scope => s.authority.commitNativeMelee(scope, plan))).toThrow('scope');
        expect(() => withActorActionScope(s.game, 'npc-scheduler', s.attacker.id, scope => s.authority.commitNativeMelee(scope, plan))).toThrow('scope');
        let stale!: ActorActionScope;
        withActorActionScope(s.game, 'player-command', s.attacker.id, scope => { stale = scope; });
        expect(() => s.authority.commitNativeMelee(stale, plan)).toThrow('scope');
        expect(s.state.nextResolutionId).toBe(1); expect(s.commit(plan)).toMatchObject({ kind: 'defended' });
        expect(() => s.commit(plan)).toThrow('consumed');
    });
    it('copied plans have no engine capability and newly rebound sessions invalidate old plans', () => {
        const s = scene(); const plan = s.authority.prepareNativeMelee(s.intent)!;
        expect(() => s.commit(structuredClone(plan) as PreparedNativeMelee)).toThrow('unrecognized');
        const rebound = new ActorCombatResolutionAuthority(s.game, s.authority.snapshot());
        expect(() => withActorActionScope(s.game, 'player-command', s.attacker.id,
            scope => rebound.commitNativeMelee(scope, plan))).toThrow('unrecognized');
    });
    it('elapsed/cancellation are scoped and positive integer bounded; displacement clears both windows explicitly', () => {
        const s = scene(); s.defenseState.parryRemainingTicks = s.defenseState.dodgeRemainingTicks = 9;
        for (const delta of [0, -1, .5, NaN, Infinity, ACTOR_DEFENSE_LIMITS.quantity + 1])
            expect(() => withActorActionScope(s.game, 'npc-scheduler', s.defender.id,
                scope => s.authority.advanceDefenseTime(scope, s.defender.id, delta))).toThrow('positive');
        expect(() => withActorActionScope(s.game, 'player-command', s.attacker.id,
            scope => s.authority.cancelDefense(scope, s.defender.id))).toThrow('scope');
        const random = rng.getState();
        withActorActionScope(s.game, 'npc-scheduler', s.defender.id, scope => s.authority.cancelDefense(scope, s.defender.id));
        expect(s.defenseState.parryRemainingTicks).toBe(0); expect(s.defenseState.dodgeRemainingTicks).toBe(0);
        expect(rng.getState()).toEqual(random);
    });
    it('old lifecycle bindings cannot advance or cancel a new layer defense state', () => {
        const s = scene(); s.game.depth++; const before = structuredClone(s.state);
        withActorActionScope(s.game, 'npc-scheduler', s.defender.id, scope => {
            expect(() => s.authority.advanceDefenseTime(scope, s.defender.id, 1)).toThrow('stale defense world');
            expect(() => s.authority.cancelDefense(scope, s.defender.id)).toThrow('stale defense world');
        });
        expect(s.state).toEqual(before);
    });
    it('native hook failure poisons this authority, does not retry or claim transactional rollback', () => {
        const s = scene(); s.hooks.afterAttack = () => { throw Error('injected native post-hit failure'); };
        expect(() => s.commit()).toThrow('injected'); expect(s.authority.invalidated).toBe(true);
        expect(() => s.authority.prepareNativeMelee(s.intent)).toThrow('invalidated');
        expect(() => s.authority.snapshot()).toThrow('invalidated');
        expect(s.state.nextResolutionId).toBe(1); expect(s.beforeAttack).toHaveBeenCalledTimes(1);
    });
});

describe('3a0 strict finite data, persistence and exclusive part-break intent', () => {
    it('save/rebind does not consume windows/poise/RNG/facts and owns an independent clone', () => {
        const s = scene(); s.defenseState.parryRemainingTicks = 7; const random = rng.getState();
        const saved = JSON.parse(JSON.stringify(s.authority.snapshot())) as ActorCombatResolutionState;
        const rebound = new ActorCombatResolutionAuthority(s.game, saved);
        expect(rebound.snapshot()).toEqual(s.state); expect(rng.getState()).toEqual(random); expect(s.physicalResolved).not.toHaveBeenCalled();
        saved.actors[1]!.parryRemainingTicks = 4; expect(s.defenseState.parryRemainingTicks).toBe(7);
        const snapshot = rebound.snapshot(); snapshot.actors[1]!.poise = 0; expect(rebound.snapshot().actors[1]!.poise).toBe(10);
    });
    it.each(['hit', 'defense', 'elapsed', 'cancel'] as const)('standalone %s mutation cannot export a misleading native save or recording', mutation => {
        const s = scene();
        s.authority.prepareNativeMelee(s.intent);
        expect(() => s.game.exportRecording()).not.toThrow();
        if (mutation === 'defense') { s.defenseState.dodgeRemainingTicks = 3; s.commit(); }
        else if (mutation === 'hit') s.commit();
        else withActorActionScope(s.game, 'npc-scheduler', s.defender.id, scope => {
            if (mutation === 'elapsed') s.authority.advanceDefenseTime(scope, s.defender.id, 1);
            else s.authority.cancelDefense(scope, s.defender.id);
        });
        expect(() => s.game.toSnapshot()).toThrow('not a production save/replay');
        expect(() => s.game.exportRecording()).toThrow('not a production save/replay');
    });
    it('unknown fields, callbacks, damage overrides, nonfinite values, aliases and malformed arrays are rejected', () => {
        const s = scene(), initial = structuredClone(s.state);
        const malformed = [
            { ...s.intent, beforeDamage: () => 100 }, { ...s.intent, damage: 100 }, { ...s.intent, kind: 'bolt' },
            { ...s.intent, sourceEntityId: Infinity }, { ...s.intent, depth: NaN }, { ...s.intent, parryable: 1 },
        ];
        for (const intent of malformed) expect(() => validateNativeMeleeResolutionIntent(intent)).toThrow();
        for (const alter of [
            (v: ActorCombatResolutionState) => { (v as unknown as Record<string, unknown>).unknown = 1; },
            (v: ActorCombatResolutionState) => { v.nextResolutionId = Infinity; },
            (v: ActorCombatResolutionState) => { v.actors[0]!.poise = -1; },
            (v: ActorCombatResolutionState) => { v.actors[0]!.poise = 11; },
            (v: ActorCombatResolutionState) => { v.actors[0]!.parryRemainingTicks = .5; },
            (v: ActorCombatResolutionState) => { v.actors[0]!.parryFacing = { x: 0, y: 0 }; },
            (v: ActorCombatResolutionState) => { v.actors.push(v.actors[0]!); },
            (v: ActorCombatResolutionState) => { delete v.actors[0]; },
        ]) { const value = structuredClone(initial); alter(value); expect(() => validateActorCombatResolutionState(value)).toThrow(); }
        const callback = { ...s.intent }; Object.defineProperty(callback, 'dodgeable', { get: () => true, enumerable: true });
        expect(() => validateNativeMeleeResolutionIntent(callback)).toThrow('DTO fields');
        expect(s.state).toEqual(initial);
    });
    const request: PartBreakConsequenceRequest = { resolutionId: 1, breakReceipt: 'break:1', groupId: 7,
        sourcePartId: 'left-leg', generation: 1, balanceLoss: 3, fallbackStunTicks: 17 };
    it('handled response returns only combat poise/stagger, never native fallback stun', () => {
        const result = selectPartBreakConsequence(request, { status: 'handled', poiseLoss: 9, staggerTicks: 12 });
        expect(result).toEqual({ kind: 'combat-handled', groupId: 7, sourcePartId: 'left-leg', generation: 1, poiseLoss: 9, staggerTicks: 12 });
        expect('actionLockInTicks' in result).toBe(false); expect(Object.isFrozen(result)).toBe(true);
    });
    it('absent/explicit unavailable response chooses native fallback only; no balance-loss has no provider response', () => {
        for (const response of [undefined, { status: 'unavailable' }]) {
            const result = selectPartBreakConsequence(request, response);
            expect(result).toEqual({ kind: 'native-fallback', groupId: 7, sourcePartId: 'left-leg', generation: 1, actionLockInTicks: 17 });
            expect('poiseLoss' in result).toBe(false); expect('staggerTicks' in result).toBe(false);
        }
        expect(selectPartBreakConsequence({ ...request, balanceLoss: 0 })).toEqual({ kind: 'source-cancel', sourcePartId: 'left-leg', generation: 1 });
        expect(() => selectPartBreakConsequence({ ...request, balanceLoss: 0 }, { status: 'handled', poiseLoss: 3, staggerTicks: 7 })).toThrow('without balance loss');
    });
    it('invalid provider response fails closed rather than silently falling back or adding a second stun', () => {
        const random = rng.getState();
        const callback = vi.fn(() => 'handled');
        const accessor = Object.defineProperty({}, 'status', { get: callback, enumerable: true });
        expect(() => selectPartBreakConsequence(request, accessor)).toThrow(); expect(callback).not.toHaveBeenCalled();
        for (const response of [null, false, {}, { status: 'failed' }, { status: 'unavailable', poiseLoss: 1 },
            { status: 'handled', poiseLoss: Infinity, staggerTicks: 1 }, { status: 'handled', poiseLoss: 1, staggerTicks: -1 },
            { status: 'handled', poiseLoss: 1, staggerTicks: 1, actionLockInTicks: 10 }, Promise.resolve({ status: 'unavailable' })])
            expect(() => selectPartBreakConsequence(request, response)).toThrow();
        for (const bad of [{ ...request, generation: 0 }, { ...request, fallbackStunTicks: NaN },
            { ...request, groupId: -1 }, { ...request, callback: () => undefined }])
            expect(() => selectPartBreakConsequence(bad)).toThrow();
        expect(rng.getState()).toEqual(random);
    });
});
