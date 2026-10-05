import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { TerrainType } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { timeSystem } from '../../../../engine/Systems/Time';
import { bindPhasedAttackProduction, chargeNativeActorAttack, isActorDodgeProtected } from '../../../../engine/Core/PhasedAttackProduction';
import { withNativeAttackAction, withPrepaidNativeAttack } from '../../../../engine/Core/NativeAttackTransaction';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { withActorActionScope } from '../../../../engine/Core/ActorActionScope';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import type { Json } from '../../../types';
import { createCombatModuleFromPack } from '../module';
import { loadCombatPack } from '../schema';
import data from '../data/definitions.json';
import locale from '../locales/zh_CN.json';

const skillId = 'growth.skill.measured-strike';
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const stamina = (game: Game, actorId = game.player.id) => state(game).actors.find(row => row.actorId === actorId)?.stamina ?? 24;
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function configured(throwAfterFocus = false, change?: (pack: typeof data) => void) {
    const pack = structuredClone(data); pack.resourcePolicies[0]!.regenPerTickNumerator = 0;
    change?.(pack);
    const combat = createCombatModuleFromPack(loadCombatPack(pack, locale));
    const descriptors = catalog.getInstalledModuleDescriptors().map(descriptor => descriptor.id === 'combat'
        ? { ...descriptor, version: combat.version, rules: combat.rules, create: () => combat }
        : descriptor.id === 'growth' ? { ...descriptor, create: () => {
            const module = descriptor.create();
            return { ...module, commands: { ...module.commands,
                'fixture-focus': (payload: Json, context: Parameters<NonNullable<typeof module.commands>[string]>[1]) => context.setComponent(context.playerId, 'focus', payload),
            }, hooks: { ...module.hooks, beforeAttack: (...args: Parameters<NonNullable<NonNullable<typeof module.hooks>['beforeAttack']>>) => {
                module.hooks?.beforeAttack?.(...args);
                if (throwAfterFocus) throw new Error('fixture after both resource commits');
            } } };
        } } : descriptor);
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => registryFromDescriptors(descriptors));
}
function scene(growth = false) {
    const game = createHeadlessGame(923401, 'test');
    const initialCommands = growth ? [JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0,
        professionId: 'growth.profession.skirmisher', lineageId: 'growth.lineage.human', faithId: 'growth.faith.unaffiliated',
        choices: [{ identityId: 'growth.lineage.human', choiceIndex: 0, attributes: { 'growth.attribute.agility': 1 } }],
    } })] : [];
    game.startNewGame({ seed: 923401, mode: 'test', ruleSet: 'extended', extensions: growth ? ['combat', 'growth'] : ['combat'], initialCommands });
    game.animationEnabled = false; game.monsters = []; game.items = [];
    commitCreatureAnchor(game.player, { x: 20, y: 15 });
    for (let x = 15; x <= 27; x++) for (let y = 10; y <= 20; y++) game.grid.setTerrain(x, y, TerrainType.FLOOR);
    const target = add(game, 21, 15);
    if (growth) growthCommand(game, 'equip-skills', { active: [skillId], passive: [] });
    (game as any).updateVision(); acknowledge();
    return { game, target };
}
function add(game: Game, x: number, y: number, type = 'jackal') {
    const target = new Monster(x, y, monsters.find(value => value.id === type)! as unknown as MonsterData);
    target.state = MonsterState.HUNTING; target.ticksUntilTurn = 10000; target.hp = target.maxHp = 1000; target.defense = -10000;
    game.monsters.push(target); return target;
}
function equip(game: Game, name: string) {
    const weapon = ItemLoader.spawnWeapon(name, game.player.x, game.player.y)!;
    game.player.inventory.addItem(weapon); game.player.equippedWeapon = weapon;
}
function growthCommand(game: Game, action: string, payload: Record<string, unknown>) {
    const growth = game.extensionRuntime!.snapshot().modules.growth as unknown as { revision: number };
    acknowledge(); game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action, payload: { revision: growth.revision, ...payload } }));
}
function focus(game: Game): number { return (game.extensionRuntime!.snapshot().components[game.player.id]!['growth:focus'] as { current: number }).current; }
function exhaust(game: Game, actorId: number) { while (chargeNativeActorAttack(game, actorId)) { /* finite paid native budget */ } }
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

describe('3c common native stamina action ownership', () => {
    it.each(['sword', 'axe', 'spear', 'whip'])('charges player %s once, including every sweep/spear target', weapon => {
        configured(); const { game, target } = scene(); equip(game, weapon);
        const second = add(game, weapon === 'spear' ? 22 : 20, weapon === 'spear' ? 15 : 16);
        (game as any).updateVision();
        const firstHp = target.hp, secondHp = second.hp;
        acknowledge(); game.executeCommand('move', { x: 1, y: 0 });
        expect(target.hp).toBeLessThan(firstHp); expect(stamina(game)).toBe(22);
        if (weapon === 'axe' || weapon === 'spear') expect(second.hp).toBeLessThan(secondHp);
    });
    it('charges one lunge movement attack and rejects an exhausted lunge before movement', () => {
        configured(); const { game, target } = scene(); equip(game, 'rapier');
        commitCreatureAnchor(target, { x: 22, y: 15 }); (game as any).updateVision();
        game.executeCommand('move', { x: 1, y: 0 }); expect(stamina(game)).toBe(22); expect(game.player.x).toBe(21);
        commitCreatureAnchor(target, { x: 23, y: 15 }); exhaust(game, game.player.id);
        const hp = target.hp, random = rng.getState(), tick = timeSystem.currentTick;
        acknowledge(); game.executeCommand('move', { x: 1, y: 0 });
        expect(game.player.x).toBe(21); expect(target.hp).toBe(hp); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    });
    it('charges one NPC sweep for player plus ally and makes exhausted NPC melee wait', () => {
        configured(); const { game, target } = scene(); const ally = add(game, 22, 15); ally.isAlly = true;
        target.abilityFlags.add('MA_ATTACKS_ALL_ADJACENT'); target.accuracy = 10000; target.damageString = '1'; target.ticksUntilTurn = 0;
        const hp = game.player.hp, allyHp = ally.hp;
        target.takeNativeDecision(game);
        expect(game.player.hp).toBeLessThan(hp); expect(ally.hp).toBeLessThan(allyHp); expect(stamina(game, target.id)).toBe(22);
        exhaust(game, target.id); target.ticksUntilTurn = 0;
        const health = game.player.hp;
        target.takeNativeDecision(game);
        expect(game.player.hp).toBe(health); expect(target.ticksUntilTurn).toBe(target.movementSpeed); expect(stamina(game, target.id)).toBe(0);
        // AI perception may roll independently; the rejected common physical path does not.
        const before = rng.getState(); expect(CombatSystem.attack(target, game.player, { grid: game.grid }).staminaBlocked).toBe(true);
        expect(rng.getState()).toEqual(before);
    });
    it.each(['player', 'npc'] as const)('charges the accepted %s melee before nausea replaces it with vomiting', who => {
        configured(); const { game, target } = scene();
        const source = who === 'player' ? game.player : target;
        source.setStatusDuration('nauseous', 10);
        const victim = who === 'player' ? target : game.player, hp = victim.hp;
        vi.spyOn(game, 'tryVomit').mockReturnValue(true);
        if (who === 'player') game.executeCommand('move', { x: 1, y: 0 }); else target.takeNativeDecision(game);
        expect(stamina(game, source.id)).toBe(22); expect(victim.hp).toBe(hp);
        expect(game.tryVomit).toHaveBeenCalledOnce();
    });
    it.each(['payment', 'elapsed'] as const)('normalizes a changed resource profile before %s, without settlement or refill', boundary => {
        configured(false, pack => {
            const original = pack.resourcePolicies[0]!;
            pack.resourcePolicies.push({ ...original, id: 'fixture.small-resources', staminaCapacity: 8, initialStamina: 8,
                nativeAttackCost: 3, regenPerTickNumerator: 1, regenPerTickDenominator: 3, regenDelayTicks: 10 });
            pack.profiles.push({ id: 'fixture.small-profile', resourcePolicyId: 'fixture.small-resources', attackIds: ['fixture.slash'] });
            pack.nativeProfiles.find(binding => binding.monsterId === 'ogre')!.profileId = 'fixture.small-profile';
        });
        const { game, target } = scene(); expect(chargeNativeActorAttack(game, target.id)).toBe(true);
        const row = state(game).actors.find(value => value.actorId === target.id)!;
        row.stamina = 5; row.regenRemainder = 19; row.regenDelayRemaining = 39;
        target.typeId = 'ogre';
        if (boundary === 'payment') {
            expect(chargeNativeActorAttack(game, target.id)).toBe(true);
            expect(row).toMatchObject({ profileId: 'fixture.small-profile', stamina: 2, regenRemainder: 0, regenDelayRemaining: 10 });
        } else {
            expect(() => productionActorActionScheduler(game)!.advanceActionTime(5)).not.toThrow();
            expect(row).toMatchObject({ profileId: 'fixture.small-profile', stamina: 5, regenRemainder: 0, regenDelayRemaining: 5 });
            productionActorActionScheduler(game)!.advanceActionTime(8);
            expect(row).toMatchObject({ stamina: 6, regenRemainder: 0, regenDelayRemaining: 0 });
        }
    });
    it('starts a cloned actor with its own initial stamina and no inherited protection', () => {
        configured(); const { game, target } = scene(); exhaust(game, target.id);
        const row = state(game).actors.find(value => value.actorId === target.id)!;
        row.dodgeRemainingTicks = 1; row.dodgeRecoveryRemainingTicks = 1;
        const clone = game.cloneMonster(target)!; expect(clone).toBeTruthy(); expect(clone.id).not.toBe(target.id);
        expect(isActorDodgeProtected(game, clone.id)).toBe(false); expect(state(game).actors.find(value => value.actorId === clone.id)).toBeUndefined();
        expect(chargeNativeActorAttack(game, clone.id)).toBe(true); expect(stamina(game, clone.id)).toBe(22); expect(stamina(game, target.id)).toBe(0);
    });
    it('keeps ordinary wait/move, magic delivery and classic melee outside declared native cost', () => {
        configured(); const { game, target } = scene();
        game.executeCommand('wait'); game.executeCommand('move', { x: -1, y: 0 }); expect(state(game).actors).toEqual([]);
        CombatSystem.attack(target, game.player, { grid: game.grid, delivery: 'bolt' }); expect(state(game).actors).toEqual([]);
        const classic = createHeadlessGame(92, 'test'), enemy = add(classic, classic.player.x + 1, classic.player.y);
        bindPhasedAttackProduction(classic); expect(CombatSystem.attack(classic.player, enemy, { grid: classic.grid }).staminaBlocked).toBeUndefined();
    });
    it('uses an authority-validated prepaid segment without recharging and closes its scope', () => {
        configured(); const { game, target } = scene(); exhaust(game, game.player.id);
        expect(() => withPrepaidNativeAttack({} as never, game, game.player, () => undefined)).toThrow(/authority|scope/);
        withActorActionScope(game, 'player-command', game.player.id, scope => withPrepaidNativeAttack(scope, game, game.player, () => {
            expect(CombatSystem.attack(game.player, target, { grid: game.grid }).staminaBlocked).toBeUndefined();
            expect(CombatSystem.attack(game.player, target, { grid: game.grid }).staminaBlocked).toBeUndefined();
        }));
        const before = rng.getState(); expect(CombatSystem.attack(game.player, target, { grid: game.grid }).staminaBlocked).toBe(true);
        expect(stamina(game)).toBe(0); expect(rng.getState()).toEqual(before);
        expect(() => withNativeAttackAction(game, game.player, () => Promise.resolve())).toThrow(/await/);
    });
    it('charges a multi-segment production attack only its declared bundle cost', () => {
        configured(); const { game, target } = scene(); const hp = target.hp;
        const attack = data.attacks.find(value => value.id === 'fixture.double-thrust')!;
        game.executeCommand('ext:command', JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId: attack.id, facing: 'e' } }));
        expect(target.hp).toBeLessThan(hp); expect(stamina(game)).toBe(24 - attack.cost);
    });
    it('commits real growth focus and exactly one native stamina charge across sweep hits', () => {
        configured(); const { game, target } = scene(true); equip(game, 'axe'); add(game, 20, 16); (game as any).updateVision();
        const before = focus(game); growthCommand(game, 'use-skill', { skillId, target: { kind: 'creature', id: target.id } });
        expect(focus(game)).toBe(before - 2); expect(stamina(game)).toBe(22);
    });
    it.each(['stamina', 'focus'])('rejects insufficient %s without charging the other resource or taking RNG', resource => {
        configured(); const { game, target } = scene(true);
        if (resource === 'stamina') exhaust(game, game.player.id);
        else game.extensionRuntime!.command(JSON.stringify({ module: 'growth', action: 'fixture-focus', payload: { current: 0, remainder: 0 } }));
        const before = game.extensionRuntime!.snapshot(), random = rng.getState(), hp = target.hp, tick = timeSystem.currentTick;
        growthCommand(game, 'use-skill', { skillId, target: { kind: 'creature', id: target.id } });
        expect(game.extensionRuntime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random); expect(target.hp).toBe(hp); expect(timeSystem.currentTick).toBe(tick);
    });
    it('rolls back both resources when a growth hook throws after focus and stamina commit', () => {
        configured(true); const { game, target } = scene(true);
        const before = game.extensionRuntime!.snapshot(), random = rng.getState();
        expect(() => growthCommand(game, 'use-skill', { skillId, target: { kind: 'creature', id: target.id } })).toThrow('fixture after both resource commits');
        const after = game.extensionRuntime!.snapshot();
        expect(after.modules).toEqual(before.modules); expect(after.components).toEqual(before.components); expect(rng.getState()).toEqual(random);
        // The existing runtime intentionally does not rewind causal IDs after a native action begins.
        expect(after.foundation.causality.nextEffectId).toBe(before.foundation.causality.nextEffectId + 1);
        // A fresh common charge must rebind the rolled-back ledger rather than the abandoned session object.
        expect(chargeNativeActorAttack(game, game.player.id)).toBe(true); expect(stamina(game)).toBe(22);
    });
});
