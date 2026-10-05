import { afterEach, describe, expect, it, vi } from 'vitest';
import { ActorCombatResolutionAuthority, validateLockedBodySegmentIntent,
    type ActorCombatResolutionState, type ActorDefenseState, type LockedBodySegmentIntent } from '../engine/Combat/ActorCombatResolution';
import { CombatSystem } from '../engine/Combat/Combat';
import { physicalContactOf } from '../engine/Combat/BodyCombat';
import { withActorActionScope } from '../engine/Core/ActorActionScope';
import { assertNoActorActionFixture, bindProductionActorActionSession, unbindProductionActorActionSession } from '../engine/Core/ActorActionSession';
import { sourceFootprintVersion } from '../engine/Movement/AttackShape';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { Grid, TerrainType as T } from '../engine/Map/Grid';
import { Item, ItemCategory } from '../engine/Items/Item';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { EffectCausality } from '../ext/causality';
import type { CreatureExtensionHooks } from '../ext/types';
import monsterData from '../data/monsters.json';
import { createHeadlessGame } from './harness';

const rat = (monsterData as MonsterData[]).find(m => m.id === 'rat')!;
function defense(actorId: number, depth: number): ActorDefenseState {
    return { actorId, depth, poise: 10, poiseCapacity: 10, staggerRemainingTicks: 0, dodgeRemainingTicks: 0,
        parryRemainingTicks: 0, parryFacing: { x: 1, y: 0 }, parryPoiseDamage: 3, parryStaggerTicks: 7 };
}
function scene(size: 1 | 2 | 3 = 2) {
    const game = createHeadlessGame(73031, 'test'); game.animationEnabled = false;
    game.grid = new Grid(22, 18); game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, T.FLOOR); game.grid.getCell(x, y)!.isVisible = true;
    }
    game.player.loc = { x: 4, y: 5 }; game.player.hp = game.player.maxHp = 100;
    const target = new Monster(7, 4, rat); target.hp = target.maxHp = 100; target.defense = -1000;
    target.state = MonsterState.HUNTING;
    if (size > 1) target.spatial = { schema: 1, footprintId: `builtin:square-${size}`, pose: 'r0' };
    game.monsters.push(target);
    const state: ActorCombatResolutionState = { schema: 1, nextResolutionId: 1,
        actors: [defense(game.player.id, game.depth), defense(target.id, game.depth)] };
    const authority = new ActorCombatResolutionAuthority(game, state);
    const physicalResolved = vi.fn(), beforeAttack = vi.fn(), afterAttack = vi.fn();
    const hooks: CreatureExtensionHooks = { causality: new EffectCausality(), partyId: () => null,
        rule: (_port, input) => input.baseValue, beforeAttack, afterAttack, physicalResolved, damage: vi.fn() };
    game.player.extensionHooks = target.extensionHooks = hooks;
    rng.seedRandomGenerator(33301);
    const intent = (cells = footprintOf(target).map(p => ({ x: p.x, y: p.y }))): LockedBodySegmentIntent => ({
        kind: 'locked-body-segment', depth: game.depth, sourceEntityId: game.player.id,
        sourceFootprintVersion: sourceFootprintVersion(game.spatialOf(game.player)),
        shape: { schema: 1, kind: 'footprint-offset-union', selfExclusion: 'whole-group',
            offsets: cells.map(p => ({ x: p.x - game.player.x, y: p.y - game.player.y })) },
        lockedCells: cells, approvedRisks: [], dodgeable: true, parryable: true,
    });
    const commit = (plans = authority.prepareLockedBodySegment(intent())) => withActorActionScope(game,
        'player-command', game.player.id, scope => plans.map(plan => authority.commitNativeMelee(scope, plan)));
    return { game, target, state, authority, intent, commit, hooks, physicalResolved, beforeAttack, afterAttack };
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('3b body-aware delayed native contact authority', () => {
    it.each([1, 2, 3] as const)('%s-cell body can be struck beyond adjacency exactly once per part and independent segment', size => {
        const s = scene(size), random = rng.getState();
        const plans = s.authority.prepareLockedBodySegment(s.intent());
        expect(plans).toHaveLength(1); expect(rng.getState()).toEqual(random);
        const native = vi.spyOn(CombatSystem, 'attack');
        expect(s.commit(plans)[0]).toMatchObject({ kind: 'native', resolutionId: 1 });
        expect(native).toHaveBeenCalledTimes(1); expect(s.physicalResolved).toHaveBeenCalledTimes(1);
        expect(s.commit()[0]).toMatchObject({ kind: 'native', resolutionId: 2 });
        expect(native).toHaveBeenCalledTimes(2);
    });
    it('adjacent square tail uses a legal contact and body-relative parry facing, without native RNG', () => {
        const s = scene(); s.target.loc = { x: 2, y: 4 }; s.state.actors[1]!.parryRemainingTicks = 5;
        s.game.grid.setTerrain(4, 4, T.WALL);
        const random = rng.getState();
        const plan = s.authority.prepareNativeMelee({ kind: 'native-melee', depth: s.game.depth,
            sourceEntityId: s.game.player.id, targetEntityId: s.target.id, dodgeable: true, parryable: true })!;
        expect(s.commit([plan])[0]).toMatchObject({ kind: 'defended', fact: { defense: 'parry' } });
        expect(s.state.actors[0]!.poise).toBe(7); expect(s.beforeAttack).not.toHaveBeenCalled();
        expect(rng.getState()).toEqual(random);
    });
    it('dodge still precedes parry for ranged shape contact and emits no physical fact', () => {
        const s = scene(); s.state.actors[1]!.dodgeRemainingTicks = s.state.actors[1]!.parryRemainingTicks = 5;
        const random = rng.getState(); expect(s.commit()[0]).toMatchObject({ kind: 'defended', fact: { defense: 'dodge' } });
        expect(s.state.actors[1]!.parryRemainingTicks).toBe(5); expect(s.physicalResolved).not.toHaveBeenCalled();
        expect(rng.getState()).toEqual(random);
    });
    it.each(['diagonal-corner', 'blocked-endpoint'] as const)('skips the first illegal %s body cell before D08 dedup and strikes a later legal cell', obstruction => {
        const s = scene(); let cells: { x: number; y: number }[];
        if (obstruction === 'diagonal-corner') {
            s.target.loc = { x: 2, y: 4 }; s.game.grid.setTerrain(4, 4, T.WALL);
            cells = [{ x: 3, y: 4 }, { x: 3, y: 5 }];
        } else {
            s.game.grid.setTerrain(7, 4, T.WALL); cells = [{ x: 7, y: 4 }, { x: 7, y: 5 }];
        }
        let at: unknown; s.hooks.beforeAttack = () => { at = { ...physicalContactOf(s.target) }; };
        const plans = s.authority.prepareLockedBodySegment(s.intent(cells)); expect(plans).toHaveLength(1);
        expect(s.commit(plans)[0]).toMatchObject({ kind: 'native' });
        expect(at).toMatchObject(cells[1]!); expect(s.physicalResolved).toHaveBeenCalledTimes(1);
    });
    it('full square source footprint projects from an actual tail cell, not its anchor', () => {
        const s = scene(3); s.target.loc = { x: 6, y: 4 }; s.game.player.loc = { x: 11, y: 6 };
        const value: LockedBodySegmentIntent = { ...s.intent([{ x: 11, y: 6 }]), sourceEntityId: s.target.id,
            sourceFootprintVersion: sourceFootprintVersion(s.game.spatialOf(s.target)),
            shape: { schema: 1, kind: 'footprint-offset-union', offsets: [{ x: 3, y: 0 }], selfExclusion: 'whole-group' } };
        const sourceLoc = { ...s.target.loc }; let contact: unknown;
        s.hooks.beforeAttack = () => { contact = { from: { ...physicalContactOf(s.target) }, to: { ...physicalContactOf(s.game.player) } }; };
        const plans = s.authority.prepareLockedBodySegment(value); expect(plans).toHaveLength(1);
        const result = withActorActionScope(s.game, 'npc-scheduler', s.target.id,
            scope => s.authority.commitNativeMelee(scope, plans[0]!));
        expect(result).toMatchObject({ kind: 'native' });
        expect(contact).toMatchObject({ from: { x: 8, y: 6 }, to: { x: 11, y: 6 } });
        expect(s.target.loc).toEqual(sourceLoc); expect(physicalContactOf(s.target)).toBe(s.target.loc);
    });
    it('preserves foundation y/x contact order rather than sorting entity IDs and resolves all independent targets', () => {
        const s = scene(1); s.target.loc = { x: 8, y: 6 };
        const second = new Monster(7, 4, rat); second.hp = second.maxHp = 100; second.state = MonsterState.HUNTING;
        s.game.monsters.push(second); second.extensionHooks = s.hooks;
        const authority = new ActorCombatResolutionAuthority(s.game, s.state);
        const plans = authority.prepareLockedBodySegment(s.intent([{ x: 8, y: 6 }, { x: 7, y: 4 }]));
        expect(plans.map(p => p.intent.targetEntityId)).toEqual([second.id, s.target.id]);
        const results = withActorActionScope(s.game, 'player-command', s.game.player.id,
            scope => plans.map(plan => authority.commitNativeMelee(scope, plan)));
        expect(results.map(r => r?.kind)).toEqual(['native', 'native']); expect(s.physicalResolved).toHaveBeenCalledTimes(2);
    });
    it.each(['source-move', 'target-move', 'target-replaced', 'target-form', 'new-wall', 'source-dead'] as const)
    ('%s after target freeze safely skips contact with no RNG or facts', change => {
        const s = scene(), plans = s.authority.prepareLockedBodySegment(s.intent());
        if (change === 'source-move') s.game.player.loc.x++;
        if (change === 'target-form') s.target.typeId = 'kobold';
        if (change === 'target-move') commitCreatureAnchor(s.target, { x: s.target.x + 1, y: s.target.y });
        if (change === 'target-replaced') {
            const replacement = new Monster(s.target.x, s.target.y, rat); replacement.id = s.target.id;
            s.game.monsters = [replacement];
        }
        if (change === 'new-wall') for (let y = 0; y < 18; y++) s.game.grid.setTerrain(6, y, T.WALL);
        if (change === 'source-dead') s.game.player.hp = 0;
        const random = rng.getState(); expect(s.commit(plans)).toEqual([null]);
        expect(rng.getState()).toEqual(random); expect(s.physicalResolved).not.toHaveBeenCalled();
    });
    it('a native source form change after freezing contacts cancels its strike even with identical geometry', () => {
        const s = scene(1), value: LockedBodySegmentIntent = { ...s.intent([{ x: 4, y: 5 }]), sourceEntityId: s.target.id,
            sourceFootprintVersion: sourceFootprintVersion(s.game.spatialOf(s.target)),
            shape: { schema: 1, kind: 'footprint-offset-union', offsets: [{ x: -3, y: 1 }], selfExclusion: 'whole-group' } };
        const plans = s.authority.prepareLockedBodySegment(value); expect(plans).toHaveLength(1);
        s.target.typeId = 'kobold'; const random = rng.getState();
        const result = withActorActionScope(s.game, 'npc-scheduler', s.target.id,
            scope => s.authority.commitNativeMelee(scope, plans[0]!));
        expect(result).toBeNull(); expect(rng.getState()).toEqual(random); expect(s.beforeAttack).not.toHaveBeenCalled();
    });
    it('wall removal cannot add cells outside the frozen telegraph', () => {
        const s = scene(); const value = s.intent(); value.lockedCells = [];
        const random = rng.getState(); expect(s.authority.prepareLockedBodySegment(value)).toEqual([]);
        expect(rng.getState()).toEqual(random);
    });
    it('a source killed by a completed hit cancels later frozen contacts, without a second roll', () => {
        const s = scene(1), second = new Monster(8, 5, rat); second.state = MonsterState.HUNTING;
        second.hp = second.maxHp = 100; second.extensionHooks = s.hooks; s.game.monsters.push(second);
        const authority = new ActorCombatResolutionAuthority(s.game, s.state);
        const plans = authority.prepareLockedBodySegment(s.intent([{ x: 7, y: 4 }, { x: 8, y: 5 }]));
        s.hooks.afterAttack = () => { s.game.player.hp = 0; };
        const results = withActorActionScope(s.game, 'player-command', s.game.player.id,
            scope => plans.map(plan => authority.commitNativeMelee(scope, plan)));
        expect(results.map(r => r?.kind ?? null)).toEqual(['native', null]);
        expect(s.beforeAttack).toHaveBeenCalledTimes(1); expect(s.physicalResolved).toHaveBeenCalledTimes(1);
    });
    it('approved acid target resolves; a newly risky or different target never inherits that approval', () => {
        const s = scene(); s.game.player.equippedWeapon = new Item('sword', ')', 0xffffff, ItemCategory.WEAPON);
        const clean = s.intent(), plans = s.authority.prepareLockedBodySegment(clean);
        s.target.behaviorFlags.add('MONST_DEFEND_DEGRADE_WEAPON');
        const random = rng.getState(); expect(s.commit(plans)).toEqual([null]); expect(s.commit()).toEqual([]);
        expect(rng.getState()).toEqual(random);
        const allowed = s.intent(); allowed.approvedRisks = [{ targetId: s.target.id,
            risks: s.game.prepareActorAttackRisks(s.game.player.id, footprintOf(s.target)) }];
        expect(allowed.approvedRisks[0]!.risks).toHaveLength(1);
        expect(s.commit(s.authority.prepareLockedBodySegment(allowed))[0]).toMatchObject({ kind: 'native' });
        allowed.approvedRisks = [];
        expect(s.authority.prepareLockedBodySegment(allowed)).toEqual([]);
    });
    it('a bound scope alone cannot claim production access, and forged/reused plans are rejected', () => {
        const s = scene(); expect(() => new ActorCombatResolutionAuthority(s.game, s.state, { production: true })).toThrow('bound engine session');
        const plans = s.authority.prepareLockedBodySegment(s.intent());
        expect(() => s.commit(structuredClone(plans))).toThrow('unrecognized');
        s.commit(plans); expect(() => s.commit(plans)).toThrow('consumed');
    });
    it('a trusted production session runs the full native pipeline and leaves save capability open', () => {
        const s = scene(), scheduler = { isDecisionOwner: () => true, isBusy: () => false,
            nextActionBoundary: () => null, advanceActionTime: () => {}, dispatchActorBoundary: () => 'native-fallback' as const,
            cancelDeadActions: () => {} };
        bindProductionActorActionSession(s.game, scheduler);
        const authority = new ActorCombatResolutionAuthority(s.game, s.state, { production: true });
        const plans = authority.prepareLockedBodySegment(s.intent()), report = vi.spyOn(s.game, 'reportAttack');
        withActorActionScope(s.game, 'player-command', s.game.player.id, scope => authority.commitNativeMelee(scope, plans[0]!));
        expect(report).toHaveBeenCalledTimes(1); expect(() => assertNoActorActionFixture(s.game)).not.toThrow();
        unbindProductionActorActionSession(s.game);
        expect(() => authority.prepareLockedBodySegment(s.intent())).toThrow('session closed');
    });
    it('native exceptions restore body contact and permanently invalidate this authority', () => {
        const s = scene(), original = s.target.loc;
        s.hooks.afterAttack = () => { throw new Error('native-postprocessing-failure'); };
        expect(() => s.commit()).toThrow('native-postprocessing-failure');
        expect(physicalContactOf(s.target)).toBe(original); expect(s.authority.invalidated).toBe(true);
        expect(() => s.authority.prepareLockedBodySegment(s.intent())).toThrow('invalidated');
    });
    it('rotated or composite square components remain unopened', () => {
        const s = scene(); s.target.spatial!.pose = 'r90';
        expect(() => s.authority.prepareLockedBodySegment(s.intent())).toThrow();
    });
    it('strict data validation rejects duplicate cells, injected accessors, and forged risk targets', () => {
        const s = scene(), value = s.intent();
        expect(() => validateLockedBodySegmentIntent({ ...value, lockedCells: [value.lockedCells[0], value.lockedCells[0]] })).toThrow();
        const called = vi.fn(); const malformed = { ...value }; Object.defineProperty(malformed, 'shape', { get: called, enumerable: true });
        expect(() => validateLockedBodySegmentIntent(malformed)).toThrow(); expect(called).not.toHaveBeenCalled();
        expect(() => validateLockedBodySegmentIntent({ ...value, approvedRisks: [{ targetId: s.target.id,
            risks: [{ kind: 'acid', target: { kind: 'creature', id: s.target.id + 1 }, message: 'risk' }] }] })).toThrow();
    });
});

describe('3b complete native action effect seam', () => {
    it('player seam retains acid degradation, one report and no attack-speed charge', () => {
        const s = scene(); s.target.loc = { x: 5, y: 5 };
        const weapon = new Item('sword', ')', 0xffffff, ItemCategory.WEAPON);
        weapon.damage = '2-2'; weapon.enchantment = 0; s.game.player.equippedWeapon = weapon;
        s.target.behaviorFlags.add('MONST_DEFEND_DEGRADE_WEAPON');
        const beforeTicks = s.game.player.ticksUntilTurn, report = vi.spyOn(s.game, 'reportAttack');
        const result = withActorActionScope(s.game, 'player-command', s.game.player.id,
            scope => s.game.resolveActorNativeMelee(scope, s.game.player, s.target));
        expect(result.hit).toBe(true); expect(weapon.enchantment).toBe(-1); expect(report).toHaveBeenCalledTimes(1);
        expect(s.game.player.ticksUntilTurn).toBe(beforeTicks); expect(s.physicalResolved).toHaveBeenCalledTimes(1);
    });
    it.each([false, true])('ranged native seizers deal ordinary damage and surface without remote grabbing (extensions=%s)', extended => {
        const s = scene(1); s.target.loc = { x: 7, y: 5 }; s.target.accuracy = 1000; s.target.damageString = '2-2';
        s.target.abilityFlags.add('MA_SEIZES'); s.target.submerged = true;
        if (!extended) s.target.extensionHooks = s.game.player.extensionHooks = undefined;
        const intent: LockedBodySegmentIntent = { ...s.intent([{ x: 4, y: 5 }]), sourceEntityId: s.target.id,
            sourceFootprintVersion: sourceFootprintVersion(s.game.spatialOf(s.target)),
            shape: { schema: 1, kind: 'footprint-offset-union', offsets: [{ x: -3, y: 0 }], selfExclusion: 'whole-group' } };
        const plans = s.authority.prepareLockedBodySegment(intent); expect(plans).toHaveLength(1);
        expect(CombatSystem.previewHitChance(s.target, s.game.player, { grid: s.game.grid })).toBe(100);
        const result = withActorActionScope(s.game, 'npc-scheduler', s.target.id,
            scope => s.authority.commitNativeMelee(scope, plans[0]!));
        expect(result).toMatchObject({ kind: 'native', attack: { hit: true, damage: 2 } });
        expect(s.target.seizing).toBe(false); expect(s.game.player.seized).toBe(false); expect(s.target.submerged).toBe(false);
    });
    it('NPC seam retains armor adjustment and native on-hit status without an extra turn', () => {
        const s = scene(); s.target.accuracy = 1000; s.target.damageString = '2-2'; s.target.abilityFlags.add('MA_HIT_HALLUCINATE');
        const armor = vi.spyOn(s.game, 'tryTriggerArmorRunic'), status = vi.spyOn(s.game, 'applyMonsterOnHitStatus');
        const beforeTicks = s.target.ticksUntilTurn;
        const result = withActorActionScope(s.game, 'npc-scheduler', s.target.id,
            scope => s.game.resolveActorNativeMelee(scope, s.target, s.game.player));
        expect(result.hit).toBe(true); expect(armor).toHaveBeenCalledTimes(1); expect(status).toHaveBeenCalledTimes(1);
        expect(s.target.ticksUntilTurn).toBe(beforeTicks); expect(s.physicalResolved).toHaveBeenCalledTimes(1);
    });
});
