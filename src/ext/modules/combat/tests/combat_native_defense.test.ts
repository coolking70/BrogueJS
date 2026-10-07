import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { ActorCombatResolutionAuthority, type ActorCombatResolutionState } from '../../../../engine/Combat/ActorCombatResolution';
import { bindNativeAttackWorld, withNativeAttackAction, withPrepaidNativeAttack } from '../../../../engine/Core/NativeAttackTransaction';
import { bindProductionActorActionSession } from '../../../../engine/Core/ActorActionSession';
import { withActorActionScope } from '../../../../engine/Core/ActorActionScope';
import * as production from '../../../../engine/Core/PhasedAttackProduction';
import { Grid, TerrainType } from '../../../../engine/Map/Grid';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { EffectCausality } from '../../../causality';
import type { CreatureExtensionHooks } from '../../../types';

function scene() {
    const game = createHeadlessGame(946731, 'test');
    game.animationEnabled = false; game.grid = new Grid(10, 10); game.monsters = []; game.items = [];
    for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR); game.grid.getCell(x, y)!.isVisible = true;
    }
    game.player.loc = { x: 4, y: 4 }; game.player.hp = game.player.maxHp = 100;
    const target = new Monster(5, 4, monsters.find(value => value.id === 'rat')! as unknown as MonsterData);
    target.state = MonsterState.HUNTING; target.hp = target.maxHp = 100; target.defense = -1000;
    game.monsters.push(target);
    const weapon = new Item('sword', ')', 0xffffff, ItemCategory.WEAPON); weapon.damage = '2-2';
    game.player.equippedWeapon = weapon;
    bindNativeAttackWorld(game);
    const charge = vi.spyOn(production, 'chargeNativeActorAttack').mockReturnValue(true);
    const dodge = vi.spyOn(production, 'isActorDodgeProtected').mockReturnValue(false);
    const stagger = vi.spyOn(production, 'isActorStaggered').mockReturnValue(false);
    const parry = vi.spyOn(production, 'tryActorParry').mockReturnValue(false);
    vi.spyOn(production, 'nativeActorPoiseDamage').mockReturnValue(4);
    const poise = vi.spyOn(production, 'applyActorPoiseDamage').mockImplementation(() => {});
    const recovery = vi.spyOn(production, 'reconcileActorNativeRecovery').mockImplementation(() => {});
    const attack = (opts: Parameters<typeof CombatSystem.attack>[2] = {}) =>
        CombatSystem.attack(game.player, target, { grid: game.grid, lungeAttack: true, ...opts });
    return { game, target, charge, dodge, stagger, parry, poise, recovery, attack };
}
function hooks(): CreatureExtensionHooks {
    return { causality: new EffectCausality(), partyId: () => null,
        beforeAttack: vi.fn(), afterAttack: vi.fn(), physicalResolved: vi.fn(), damage: vi.fn() };
}
function productionAuthority(s: ReturnType<typeof scene>, options: {
    tryParry?: (attackerId: number, defenderId: number, contact: { from: Readonly<{ x: number; y: number }>; to: Readonly<{ x: number; y: number }> }) => boolean;
    dodgeProtected?: (actorId: number) => boolean;
    poiseDamage?: number;
}) {
    bindProductionActorActionSession(s.game, { isDecisionOwner: () => true, isBusy: () => false,
        nextActionBoundary: () => null, advanceActionTime: () => {}, dispatchActorBoundary: () => 'native-fallback', cancelDeadActions: () => {} });
    const state: ActorCombatResolutionState = { schema: 1, nextResolutionId: 1, actors: [] };
    const authority = new ActorCombatResolutionAuthority(s.game, state, { production: true, ...options });
    const plan = authority.prepareNativeMelee({ kind: 'native-melee', depth: s.game.depth,
        sourceEntityId: s.game.player.id, targetEntityId: s.target.id, dodgeable: true, parryable: true })!;
    return { state, authority, commit: () => withActorActionScope(s.game, 'player-command', s.game.player.id,
        scope => authority.commitNativeMelee(scope, plan)) };
}

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('3d native defense plumbing', () => {
    it('parries a no-hooks native attack before RNG, hooks and physical facts, while paying once', () => {
        const s = scene(); s.parry.mockReturnValue(true);
        const random = rng.getState(), hp = s.target.hp;
        expect(s.attack()).toEqual({ damage: 0, hit: false, backstab: false, parried: true });
        expect(s.charge).toHaveBeenCalledOnce(); expect(s.parry).toHaveBeenCalledOnce();
        expect(s.target.hp).toBe(hp); expect(s.poise).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
    });
    it('resolves dodge before trying native parry', () => {
        const s = scene(); s.dodge.mockReturnValue(true); s.parry.mockReturnValue(true);
        expect(s.attack()).toMatchObject({ dodged: true, hit: false });
        expect(s.parry).not.toHaveBeenCalled(); expect(s.poise).not.toHaveBeenCalled();
    });
    it('does not fabricate physical facts or consume attack hooks for native parry', () => {
        const s = scene(), h = hooks(); s.game.player.extensionHooks = h; s.parry.mockReturnValue(true);
        const random = rng.getState(); expect(s.attack()).toMatchObject({ parried: true, hit: false });
        expect(h.beforeAttack).not.toHaveBeenCalled(); expect(h.afterAttack).not.toHaveBeenCalled();
        expect(h.physicalResolved).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
    });
    it('blocks a staggered source before payment, defenses and RNG even with a prepaid fanout', () => {
        const s = scene(); s.stagger.mockReturnValue(true); const random = rng.getState();
        withActorActionScope(s.game, 'player-command', s.game.player.id,
            scope => withPrepaidNativeAttack(scope, s.game, s.game.player, () =>
                expect(s.attack()).toMatchObject({ hit: false, staggerBlocked: true }), 7));
        expect(s.charge).not.toHaveBeenCalled(); expect(s.parry).not.toHaveBeenCalled();
        expect(s.poise).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
    });
    it.each(['none', 'plain', 'rules', 'rules-without-facts'] as const)('settles one native poise debit with %s hooks', mode => {
        const s = scene(), events: string[] = [];
        if (mode !== 'none') {
            const h = hooks();
            if (mode === 'plain') h.wantsPhysicalResolution = () => false;
            if (mode === 'rules-without-facts') h.wantsPhysicalResolution = () => false;
            h.physicalResolved = () => events.push('physical'); s.game.player.extensionHooks = h;
        }
        s.poise.mockImplementation(() => events.push('poise'));
        const result = s.attack(); expect(result.hit).toBe(true); expect(result.damage).toBeGreaterThan(0);
        expect(s.poise).toHaveBeenCalledExactlyOnceWith(s.game, s.target.id, 4);
        expect(events).toEqual(mode === 'rules' ? ['poise', 'physical'] : ['poise']);
    });
    it.each([false, true])('keeps fully shielded hits poise-neutral with extended=%s', extended => {
        const s = scene(); if (extended) s.game.player.extensionHooks = hooks(); s.target.applyShield(1000);
        const hp = s.target.hp, result = s.attack();
        expect(result.hit).toBe(true); expect(result.damage).toBeGreaterThan(0); expect(s.target.hp).toBe(hp);
        expect(s.poise).not.toHaveBeenCalled();
    });
    it('settles a partial shield hit once after shield absorption', () => {
        const s = scene(); s.target.applyShield(10);
        s.poise.mockImplementation(() => { expect(s.target.getStatusDuration('shielded')).toBe(0); expect(s.target.hp).toBeLessThan(100); });
        s.attack(); expect(s.poise).toHaveBeenCalledOnce();
    });
    it.each(['miss', 'immune'] as const)('does not settle poise for a native %s', result => {
        const s = scene();
        if (result === 'miss') vi.spyOn(rng, 'randPercent').mockReturnValue(false);
        else s.target.behaviorFlags.add('MONST_INVULNERABLE');
        expect(s.attack({ lungeAttack: false }).damage).toBe(0); expect(s.poise).not.toHaveBeenCalled();
    });
    it('uses the prepaid segment poise amount and does not re-run its defense or payment', () => {
        const s = scene(); s.parry.mockReturnValue(true);
        withActorActionScope(s.game, 'player-command', s.game.player.id,
            scope => withPrepaidNativeAttack(scope, s.game, s.game.player, () => s.attack(), 7));
        expect(s.poise).toHaveBeenCalledExactlyOnceWith(s.game, s.target.id, 7);
        expect(s.parry).not.toHaveBeenCalled(); expect(s.charge).not.toHaveBeenCalled();
    });
    it('reconciles only a successful outer native action after its native epilogue', () => {
        const s = scene(), order: string[] = [];
        s.recovery.mockImplementation(() => { expect(s.game.player.ticksUntilTurn).toBe(17); order.push('reconcile'); });
        const result = withNativeAttackAction(s.game, s.game.player, () => {
            withNativeAttackAction(s.game, s.game.player, () => order.push('nested'));
            expect(s.recovery).not.toHaveBeenCalled(); s.game.player.ticksUntilTurn = 17; order.push('epilogue');
            return 'complete';
        });
        expect(result).toBe('complete'); expect(order).toEqual(['nested', 'epilogue', 'reconcile']);
        expect(s.recovery).toHaveBeenCalledExactlyOnceWith(s.game, s.game.player.id);
        s.recovery.mockClear();
        withActorActionScope(s.game, 'player-command', s.game.player.id, scope =>
            withPrepaidNativeAttack(scope, s.game, s.game.player, () =>
                withNativeAttackAction(s.game, s.game.player, () => undefined)));
        expect(s.recovery).not.toHaveBeenCalled();
        expect(() => withNativeAttackAction(s.game, s.game.player, () => { throw new Error('native failure'); })).toThrow('native failure');
        expect(() => withNativeAttackAction(s.game, s.game.player, () => Promise.resolve())).toThrow('await');
        expect(s.recovery).not.toHaveBeenCalled();
    });
    it.each(['bolt', 'nonweapon', 'reflection'] as const)('does not apply melee defenses or poise to %s delivery', delivery => {
        const s = scene();
        if (delivery === 'reflection') {
            const h = hooks(); s.game.player.extensionHooks = h;
            h.causality.withOrigin(h.causality.create('reflection', s.game.player.id), () => s.attack());
        } else s.attack(delivery === 'bolt' ? { delivery: 'bolt' } : { isWeaponAttack: false });
        expect(s.charge).not.toHaveBeenCalled(); expect(s.parry).not.toHaveBeenCalled(); expect(s.poise).not.toHaveBeenCalled();
    });
    it('returns a production parry fact without fixture resource writes or a native counterattack', () => {
        const s = scene(), parry = vi.fn(() => true), a = productionAuthority(s, { tryParry: parry });
        const native = vi.spyOn(s.game, 'resolveActorNativeMelee'), random = rng.getState();
        expect(a.commit()).toEqual({ kind: 'defended', fact: { kind: 'defended', resolutionId: 1, depth: s.game.depth,
            sourceEntityId: s.game.player.id, targetEntityId: s.target.id, defense: 'parry' } });
        expect(parry).toHaveBeenCalledExactlyOnceWith(s.game.player.id, s.target.id, expect.objectContaining({
            from: expect.objectContaining({ x: 4, y: 4 }), to: expect.objectContaining({ x: 5, y: 4 }) }));
        expect(a.state).toEqual({ schema: 1, nextResolutionId: 2, actors: [] });
        expect(native).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
    });
    it('checks production dodge before its parry callback', () => {
        const s = scene(), parry = vi.fn(() => true), a = productionAuthority(s, { tryParry: parry, dodgeProtected: () => true });
        expect(a.commit()).toMatchObject({ kind: 'defended', fact: { defense: 'dodge' } }); expect(parry).not.toHaveBeenCalled();
    });
    it('forwards declared segment poise damage to the native authority', () => {
        const s = scene(), a = productionAuthority(s, { poiseDamage: 9 });
        const native = vi.spyOn(s.game, 'resolveActorNativeMelee').mockReturnValue({ hit: false, damage: 0, backstab: false });
        expect(a.commit()).toMatchObject({ kind: 'native' });
        expect(native).toHaveBeenCalledWith(expect.anything(), s.game.player, s.target, 9);
    });
});
