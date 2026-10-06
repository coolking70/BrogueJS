import { extensionDigest } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { prepareWorldRest, commitWorldRest, settleWorldRest, worldRestUnavailable } from '../../../../engine/Core/WorldRestProduction';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { createActorActionBundle } from '../../../../engine/Core/ActorActionScheduler';
import { initialActorResources } from '../../../../engine/Core/ActorResources';
import { applyActorPoiseDamage, chargeNativeActorAttack } from '../../../../engine/Core/PhasedAttackProduction';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { canDirectlySeeMonster } from '../../../../engine/UI/MonsterVisibility';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { DungeonLayer, TerrainType as T } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { getNextEntityId } from '../../../../entities/Creature';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import * as catalog from '../../../catalog';
import type { WorldInteractable } from '../../../types';
import type { ProductionActorAttackState } from '../../../actorActions';
import { DialogService } from '../../../../ui/dialogService';
import { bindDialogAcknowledgments, presentationTimeline } from '../../../../ui/dialogAcknowledgments';
import { registryFromDescriptors } from '../../../descriptor';
import { loadCombatDefinitionPack } from '../definitions';
import { loadCombatPack } from '../schema';
import { createCombatModuleFromPack } from '../module';
import locale from '../locales/zh_CN.json';

const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const last = <V>(values: readonly V[]): V => values[values.length - 1]!;
const installed = new Set(catalog.getInstalledModuleDescriptors().map(module => module.id));
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const ledger = (game: Game) => state(game).bonfires!;
const resource = (game: Game) => state(game).actors.find(actor => actor.actorId === game.player.id)!;
const command = (bonfireId: number) => JSON.stringify({ module: 'combat', action: 'rest', payload: { bonfireId } });
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
const bonfire = (game: Game) => game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.owner === 'combat' && entity.depth === game.depth)!;
function start(ids = ['combat'], seed = 73073, mode: 'test' | 'normal' = 'test'): Game {
    const game = createHeadlessGame(seed, 'test'), registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false; game.onConfirmRequest = () => true;
    return game;
}
/** Keep the actual placed world identity. Only the native arena is simplified. */
function arena(game: Game): WorldInteractable {
    const target = bonfire(game); expect(target).toBeDefined();
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS])
            game.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON
                ? x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR : T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: target.x, y: target.y });
    game.player.maxHp = 1000; game.player.hp = 300; game.player.regenCarry = 0; game.player.ticksUntilTurn = 0;
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).bindDungeonFeatureEffects(); (game as any).updateVision();
    return target;
}
function scene(ids = ['combat']) { const game = start(ids); const target = arena(game); return { game, target }; }
function npc(game: Game, at: { x: number; y: number }, ally = true, species = 'rat') {
    const source = new Monster(at.x, at.y, monsters.find(monster => monster.id === species)! as MonsterData);
    game.monsters.push(source); game.extensionRuntime!.attachCreature(source);
    source.isAlly = ally; source.state = MonsterState.HUNTING; source.ticksUntilTurn = 100;
    source.hp = source.maxHp = 1000; source.regenTurns = 1000000;
    return source;
}
function facts(game: Game) {
    return { runtime: game.extensionRuntime!.snapshot(), rng: rng.getState(), nextId: getNextEntityId(), tick: timeSystem.currentTick,
        turn: game.absoluteTurnNumber, player: { loc: { ...game.player.loc }, hp: game.player.hp, maxHp: game.player.maxHp,
            ticks: game.player.ticksUntilTurn, nutrition: game.player.nutrition, statuses: json(game.player.statusDurations) } };
}
function mechanical(game: Game) {
    const snapshot = json(game.toSnapshot()); snapshot.savedAt = 0;

    return snapshot;
}
function prepare(game: Game, id = bonfire(game).id) {
    const plan = prepareWorldRest(game, command(id)); expect(plan).not.toBeNull(); return plan!;
}
function begin(game: Game) { const plan = prepare(game); expect(commitWorldRest(game, plan)).toBe(true); return plan; }
function rest(game: Game, id = bonfire(game).id) { acknowledge(); game.executeCommand('ext:command', command(id)); }
function clockToEnd(game: Game, ticks = 500) {
    const scheduler = productionActorActionScheduler(game)!;
    scheduler.advanceActionTime(ticks); scheduler.dispatchActorBoundary(game.player.id); settleWorldRest(game);
}
function partialInitialResources(restoreNone = false) {
    const raw = structuredClone(loadCombatDefinitionPack()); raw.resourcePolicies[0]!.initialStamina = 12;
    if (restoreNone) raw.bonfires.definitions[0]!.restorePolicy = { hp: 'none', stamina: 'none', poise: 'none' };
    const pack = loadCombatPack(raw, locale), combat = createCombatModuleFromPack(pack);
    const descriptors = catalog.getInstalledModuleDescriptors().map(descriptor => descriptor.id === 'combat'
        ? { ...descriptor, rules: combat.rules, create: () => createCombatModuleFromPack(pack) } : descriptor);
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registryFromDescriptors(descriptors));
}
/** Trusted capacity-only ledger fixture: never published as a save or replay. */
function fillResourceBudget(game: Game) {
    const definition = game.extensionRuntime!.actorActionBinding()!.definition;
    const profile = definition.profiles.find(profile => profile.id === definition.playerProfileId)!;
    const policy = definition.resourcePolicies.find(policy => policy.id === profile.resourcePolicyId)!;
    state(game).actors = Array.from({ length: 4096 }, (_, index) => ({ actorId: index + 1000, profileId: profile.id, ...initialActorResources(policy) }));
}
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('3e real bonfire preparation and native command boundary', () => {
    it('prepares the actual placed identity repeatedly without writes, clocks, IDs or either RNG', () => {
        const { game, target } = scene(), before = facts(game);
        for (let index = 0; index < 3; index++) {
            const plan = prepare(game); expect(Object.isFrozen(plan)).toBe(true);
            expect(plan).toMatchObject({ bonfireId: target.id, restTicks: 500 });
            expect(worldRestUnavailable(game, target.id)).toBeNull(); game.extensionRuntime!.readModuleView('combat');
        }
        expect(facts(game)).toEqual(before); expect(ledger(game).placements).toHaveLength(1);
        expect(ledger(game).placements[0]).toMatchObject({ visits: 0, completedRests: 0 });
    });
    it.each([{}, { bonfireId: 0 }, { bonfireId: 1.2 }, { bonfireId: '1' }, { bonfireId: 1, extra: true }])(
        'rejects malformed rest payload %j before mutation', payload => {
            const { game } = scene(), before = facts(game);
            expect(() => prepareWorldRest(game, JSON.stringify({ module: 'combat', action: 'rest', payload }))).toThrow('Invalid rest input');
            expect(facts(game)).toEqual(before);
        });
    it('records asynchronous No once while all preparation remains 0tick and resource-free', () => {
        const { game } = scene(); game.onCommandConfirmRequest = () => {};
        game.onConfirmRequest = () => { throw new Error('Unexpected synchronous confirmation'); };
        const before = facts(game); rest(game); const pending = game.pendingCommandConfirmation!;
        expect(pending).not.toBeNull(); expect(facts(game)).toEqual(before);
        game.resolveCommandDecision(pending.token, false);
        expect(last(game.recordedInputEvents).decisions).toEqual([false]); expect(facts(game)).toEqual(before);
        game.resolveCommandDecision(pending.token, true); expect(facts(game)).toEqual(before); expect(ledger(game).receipts).toEqual([]);
    });
    it('rejects a stale prepared identity and repeated commit without a second visit or scheduler action', () => {
        const { game } = scene(), plan = prepare(game); game.player.hp--;
        const before = facts(game); expect(() => commitWorldRest(game, plan)).toThrow('Stale'); expect(facts(game)).toEqual(before);
        const current = prepare(game); commitWorldRest(game, current); const committed = facts(game);
        expect(() => commitWorldRest(game, current)).toThrow('Stale'); expect(facts(game)).toEqual(committed);
        expect(ledger(game).placements[0]!.visits).toBe(1); expect(state(game).scheduler.bundles).toHaveLength(1);
    });
    it('asynchronous confirmation rejects changed HP without charging or recording an approved rest', () => {
        const { game } = scene(); game.onCommandConfirmRequest = () => {}; rest(game);
        const token = game.pendingCommandConfirmation!.token; game.player.hp--;
        const before = facts(game); expect(game.resolveCommandDecision(token, true)).toBe(true);
        expect(game.pendingCommandConfirmation).toBeNull(); expect(facts(game)).toEqual(before);
        expect(ledger(game).placements[0]!.visits).toBe(0); expect(game.recordedInputEvents).toEqual([]);
        expect(game.resolveCommandDecision(token, true)).toBe(false);
    });
    it('a same-seed replacement run cannot consume the previous runtime session preparation', () => {
        const { game } = scene(), plan = prepare(game);
        game.startNewGame({ seed: 73073, mode: 'test', ruleSet: 'extended', extensions: ['combat'] }); arena(game);
        const before = facts(game); expect(() => commitWorldRest(game, plan)).toThrow('Stale'); expect(facts(game)).toEqual(before);
    });
    it('a scheduler commit fault rolls back the retained ledger graph and identity allocation, then fails closed', () => {
        const { game } = scene(), plan = prepare(game), before = facts(game), retained = state(game), fireState = ledger(game);
        const placement = fireState.placements[0], placements = fireState.placements, bundles = retained.scheduler.bundles;
        vi.spyOn(productionActorActionScheduler(game)!, 'commitBundle').mockImplementation(() => { throw new Error('fixture scheduler commit fault'); });
        expect(() => commitWorldRest(game, plan)).toThrow('fixture scheduler commit fault');
        expect(facts(game)).toEqual(before); expect(state(game)).toBe(retained); expect(ledger(game)).toBe(fireState);
        expect(ledger(game).placements).toBe(placements); expect(ledger(game).placements[0]).toBe(placement);
        expect(state(game).scheduler.bundles).toBe(bundles); expect(ledger(game).active).toBeNull(); expect(game.isInputLocked()).toBe(true);
    });
    it('one accepted command advances 500 native ticks and hunger, then restores current capacities exactly once', () => {
        const { game, target } = scene(); chargeNativeActorAttack(game, game.player.id); applyActorPoiseDamage(game, game.player.id, 3);
        expect(resource(game).stamina).toBeLessThan(24); expect(resource(game).poise).toBeLessThan(12);
        game.player.setStatusDuration('weakened', 20);
        const before = facts(game), world = json(game.extensionRuntime!.snapshot().foundation.world), nextAction = state(game).nextActionId;
        const messageTurn = logger.turn;
        rest(game);
        // The HUD intentionally counts CE player commands, separately from objective blocks.
        expect(logger.turn - messageTurn).toBe(1);
        const afterRest = facts(game), frame = observeDisplayFrame(game, logger);
        expect(frame.messageTurn).toBe(logger.turn); expect(frame.displayTurn).toBe(game.absoluteTurnNumber);
        expect(facts(game)).toEqual(afterRest);
        expect(timeSystem.currentTick - before.tick).toBe(500); expect(game.absoluteTurnNumber - before.turn).toBe(5);
        expect(game.player.nutrition).toBe(before.player.nutrition - 5); expect(game.player.getStatusDuration('weakened')).toBe(15);
        expect(game.player.hp).toBe(game.player.maxHp); expect(resource(game)).toMatchObject({ stamina: 24, poise: 12 });
        expect(game.extensionRuntime!.snapshot().foundation.world).toEqual(world); expect(getNextEntityId()).toBe(before.nextId);
        expect(ledger(game).active).toBeNull(); expect(state(game).scheduler.bundles).toEqual([]); expect(game.isInputLocked()).toBe(false);
        expect(ledger(game).receipts).toEqual([expect.objectContaining({ actionId: nextAction, bonfireId: target.id, visit: 1, result: 'completed', reason: null })]);
        expect(ledger(game).placements[0]).toMatchObject({ visits: 1, completedRests: 1 });
        game.player.hp = 10; const complete = facts(game); settleWorldRest(game); game.update();
        expect(facts(game)).toEqual(complete); expect(game.player.hp).toBe(10);
    });
    it('blocks ordinary input throughout the paid scheduler action, with no partial rest recovery', () => {
        const { game } = scene(); begin(game); const before = facts(game), eventCount = game.recordedInputEvents.length;
        expect(game.isInputLocked()).toBe(true); game.executeCommand('move', { x: 1, y: 0 }); game.executeCommand('wait');
        expect(facts(game)).toEqual(before); expect(game.recordedInputEvents).toHaveLength(eventCount);
        productionActorActionScheduler(game)!.advanceActionTime(499); settleWorldRest(game);
        expect(game.player.hp).toBe(300); expect(ledger(game).active).not.toBeNull(); expect(ledger(game).receipts).toEqual([]);
        game.player.maxHp = 1200; clockToEnd(game, 1); expect(game.player.hp).toBe(1200); expect(ledger(game).receipts).toHaveLength(1);
    });
});

describe('3e interruptions and native world continuation', () => {
    it.each([false,true])('logs the settled rest once and never during partial rest (interrupted=%s)', interrupted => {
        const { game } = scene(); begin(game);
        const before = logger.messages.length;
        productionActorActionScheduler(game)!.advanceActionTime(100); settleWorldRest(game);
        expect(logger.messages).toHaveLength(before);
        if (interrupted) { game.player.takeDamage(7, true, game.grid); settleWorldRest(game); }
        else clockToEnd(game, 400);
        const expected = interrupted ? 'Your bonfire rest is interrupted; you receive no bonfire recovery.' : 'Your bonfire rest is complete.';
        expect(logger.messages.slice(before)).toEqual([expect.objectContaining({ text: expected, color: interrupted ? '#ffaa44' : '#88ccff', count: 1 })]);
        settleWorldRest(game); game.update();
        expect(logger.messages).toHaveLength(before + 1);
    });
    it('positive native HP damage interrupts even when another effect heals it before settlement', () => {
        const { game } = scene(); begin(game); game.player.takeDamage(7, true, game.grid); game.player.hp = 300;
        settleWorldRest(game); expect(game.player.hp).toBe(300);
        expect(last(ledger(game).receipts)).toMatchObject({ result: 'interrupted', reason: 'damage' });
        expect(ledger(game).placements[0]!.completedRests).toBe(0); expect(ledger(game).active).toBeNull();
    });
    it('shield absorption with zero HP loss does not invent an interruption', () => {
        const { game } = scene(); game.player.applyShield(1000); begin(game); game.player.takeDamage(7, false, game.grid);
        expect(game.player.hp).toBe(300); expect(ledger(game).active!.interrupted).toBeNull(); clockToEnd(game);
        expect(game.player.hp).toBe(1000); expect(last(ledger(game).receipts).result).toBe('completed');
        expect(game.player.getStatusDuration('shielded')).toBe(930);
    });
    it('forced movement out and back still cancels the original rest without recovery', () => {
        const { game } = scene(), anchor = { ...game.player.loc }; begin(game);
        commitCreatureAnchor(game.player, { x: anchor.x + 1, y: anchor.y }); commitCreatureAnchor(game.player, anchor);
        settleWorldRest(game); expect(game.player.hp).toBe(300);
        expect(last(ledger(game).receipts)).toMatchObject({ result: 'interrupted', reason: 'moved' });
    });
    it('a newly visible hostile cancels the rest without enemy replacement or resource recovery', () => {
        const { game } = scene(); begin(game); const source = npc(game, { x: game.player.x + 1, y: game.player.y }, false);
        (game as any).updateVision(); const nextId = getNextEntityId(); settleWorldRest(game);
        expect(last(ledger(game).receipts)).toMatchObject({ result: 'interrupted', reason: 'threat' });
        expect(game.player.hp).toBe(300); expect(game.monsters).toContain(source); expect(getNextEntityId()).toBe(nextId);
    });
    it('lethal native damage cannot be followed by rest resurrection or a completed receipt', () => {
        const { game } = scene(); begin(game); game.player.takeDamage(1000, true, game.grid); settleWorldRest(game);
        expect(game.player.hp).toBe(0); expect(last(ledger(game).receipts)).toMatchObject({ result: 'interrupted', reason: 'dead' });
        settleWorldRest(game); expect(game.player.hp).toBe(0); expect(ledger(game).receipts).toHaveLength(1);
    });
    it('terminal native starvation kills before bonfire recovery and never resurrects the player', () => {
        const { game } = scene(); game.player.hp = 1; game.player.nutrition = 0; game.player.inventory.items = [];
        rest(game); expect(game.player.hp).toBe(0); expect(game.isGameOver).toBe(true);
        expect(last(ledger(game).receipts)).toMatchObject({ result: 'interrupted', reason: 'dead' });
        expect(ledger(game).placements[0]!.completedRests).toBe(0); expect(ledger(game).active).toBeNull();
    });
    it('native poison/environment damage advances time, interrupts, and leaves poison and hunger intact', () => {
        const { game } = scene(); game.player.poisonAmount = 3; game.player.setStatusDuration('poisoned', 20);
        const nutrition = game.player.nutrition, turn = game.absoluteTurnNumber; rest(game);
        expect(game.player.hp).toBeLessThan(300); expect(game.absoluteTurnNumber).toBeGreaterThan(turn);
        expect(game.player.nutrition).toBeLessThan(nutrition); expect(game.player.hasStatus('poisoned')).toBe(true);
        expect(last(ledger(game).receipts)).toMatchObject({ result: 'interrupted', reason: 'damage' });
    });
    it('ordinary NPC decisions and environment continue during rest without resetting the cohort or RNG', () => {
        const { game } = scene(), source = npc(game, { x: game.player.x + 4, y: game.player.y });
        source.hp = 333; const originalLocation = { ...source.loc }, id = getNextEntityId(), random = rng.getState();
        const decisions = vi.spyOn(source, 'prepareNativeDecision'), environment = vi.spyOn(game as any, 'updateEnvironment');
        rest(game);
        expect(decisions).toHaveBeenCalled(); expect(environment).toHaveBeenCalledTimes(5);
        expect(source.loc).not.toEqual(originalLocation); expect(game.monsters).toEqual([source]); expect(source.hp).toBe(333);
        expect(getNextEntityId()).toBe(id); expect(rng.getState()).not.toEqual(random);
        expect(last(ledger(game).receipts).result).toBe('completed');
    });
    it('an invisible native NPC hit due on the exact terminal tick prevents the terminal heal', () => {
        const { game } = scene(), source = npc(game, { x: game.player.x + 1, y: game.player.y }, false, 'jackal');
        source.ticksUntilTurn = 500; source.accuracy = 10000; source.damageString = '7-7'; source.setStatusDuration('invisible', 50);
        game.player.equippedArmor = null; (game as any).updateVision();
        const attacks = vi.spyOn(CombatSystem, 'attack'), tick = timeSystem.currentTick;
        expect(worldRestUnavailable(game, bonfire(game).id)).toBeNull(); rest(game);
        expect(attacks).toHaveBeenCalledWith(source, game.player, expect.anything());
        expect(attacks.mock.results.some(result => result.type === 'return' && result.value.damage > 0)).toBe(true);
        expect(timeSystem.currentTick - tick).toBe(500); expect(game.player.hp).toBeLessThan(400);
        expect(last(ledger(game).receipts)).toMatchObject({ result: 'interrupted', reason: 'damage' });
        expect(ledger(game).placements[0]!.completedRests).toBe(0);
    });
});

describe('3e eligibility remains a pure world query', () => {
    it.each(['distance', 'line', 'hostile', 'native-clock', 'stagger', 'paralyzed', 'dead'] as const)(
        'rejects %s before confirmation, visit identity or elapsed time', blocker => {
            const { game, target } = scene();
            if (blocker === 'distance') commitCreatureAnchor(game.player, { x: target.x + 3, y: target.y });
            if (blocker === 'line') {
                commitCreatureAnchor(game.player, { x: target.x + 1, y: target.y + 1 });
                game.grid.setTerrain(target.x + 1, target.y, T.WALL); game.grid.setTerrain(target.x, target.y + 1, T.WALL);
                game.grid.getCell(target.x, target.y)!.isVisible = true;
            }
            if (blocker === 'hostile') { npc(game, { x: target.x + 1, y: target.y }, false); (game as any).updateVision(); }
            if (blocker === 'native-clock') game.player.ticksUntilTurn = 1;
            if (blocker === 'stagger') applyActorPoiseDamage(game, game.player.id, 12);
            if (blocker === 'paralyzed') game.player.setStatusDuration('paralyzed', 10);
            if (blocker === 'dead') game.player.hp = 0;
            const before = facts(game); expect(worldRestUnavailable(game, target.id)).not.toBeNull();
            expect(prepareWorldRest(game, command(target.id))).toBeNull(); expect(facts(game)).toEqual(before);
            expect(ledger(game).placements[0]!.visits).toBe(0);
        });
    if (installed.has('narrative')) it('an actual narrative interaction gate blocks rest without creating or replacing a combat gate', () => {
        const { game, target } = scene(['combat', 'narrative']);
        const speaker = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.owner === 'narrative')!;
        expect(speaker).toBeDefined(); commitCreatureAnchor(game.player, { x: speaker.x, y: speaker.y }); (game as any).updateVision();
        const narrative = game.extensionRuntime!.snapshot().modules.narrative as unknown as { revision: number };
        game.executeCommand('ext:command', JSON.stringify({ module: 'narrative', action: 'open', payload: { v: 2, revision: narrative.revision, targetEntityId: speaker.id } }));
        expect(game.interactionActive).toBe(true); const before = facts(game);
        expect(worldRestUnavailable(game, target.id)).toBe('gate');
        expect(prepareWorldRest(game, command(target.id))).toBeNull(); expect(facts(game)).toEqual(before);
        expect(game.extensionRuntime!.snapshot().foundation.world.gate!.owner).toBe('narrative');
    });
});

describe('3e bounded capacity preflight', () => {
    it('refuses a full scheduler before allocating a rest identity or changing clocks or RNG', () => {
        const { game } = scene();
        // Only occupancy is under test. These detached bundles are deliberately
        // not executed or serialized as a complete production attack world.
        state(game).scheduler.bundles = Array.from({ length: 4096 }, (_, index) => createActorActionBundle({
            actionId: index + 1, depth: game.depth, decisionOwnerId: index + 1000, timeChargeOwnerId: index + 1000,
            subactions: [{ sourceEntityId: index + 1000, sourcePartId: 'body', sourceFootprintVersion: 'capacity-fixture',
                phases: [{ kind: 'recovery', durationTicks: 100, segmentIndex: null }] }],
        }));
        const before = { state: json(state(game)), rng: rng.getState(), tick: timeSystem.currentTick, clock: game.player.ticksUntilTurn };
        expect(prepareWorldRest(game, command(bonfire(game).id))).toBeNull();
        expect({ state: json(state(game)), rng: rng.getState(), tick: timeSystem.currentTick, clock: game.player.ticksUntilTurn }).toEqual(before);
    });
    it('leaves an already-full implicit player pool unmaterialized when the resource ledger is full', () => {
        const { game } = scene(); fillResourceBudget(game); const rows = json(state(game).actors);
        begin(game); clockToEnd(game);
        expect(game.player.hp).toBe(1000); expect(last(ledger(game).receipts).result).toBe('completed');
        expect(state(game).actors).toEqual(rows); expect(state(game).actors.some(row => row.actorId === game.player.id)).toBe(false);
    });
    it('refuses an implicit partial player pool with no resource slot before confirmation or time', () => {
        partialInitialResources(); const { game } = scene(); fillResourceBudget(game);
        const before = { state: json(state(game)), rng: rng.getState(), tick: timeSystem.currentTick, hp: game.player.hp };
        expect(prepareWorldRest(game, command(bonfire(game).id))).toBeNull();
        expect({ state: json(state(game)), rng: rng.getState(), tick: timeSystem.currentTick, hp: game.player.hp }).toEqual(before);
    });
    it('reserves partial NPC pools needed by elapsed recovery even when bonfire restore policies are none', () => {
        partialInitialResources(true); const { game } = scene(); fillResourceBudget(game);
        state(game).actors[0]!.actorId = game.player.id; npc(game, { x: game.player.x + 4, y: game.player.y });
        const before = { state: json(state(game)), rng: rng.getState(), tick: timeSystem.currentTick };
        expect(prepareWorldRest(game, command(bonfire(game).id))).toBeNull();
        expect({ state: json(state(game)), rng: rng.getState(), tick: timeSystem.currentTick }).toEqual(before);
    });
});

describe('3e optional modules and durable rest identity', () => {
    it.each([
        ['combat'],
        ['combat', 'growth'], ['combat', 'narrative'], ['combat', 'giants'],
        ['combat', 'growth', 'narrative'], ['combat', 'growth', 'giants'], ['combat', 'narrative', 'giants'],
        ['combat', 'growth', 'narrative', 'giants'],
    ].filter(ids => ids.every(id => installed.has(id))))('completes with the independent subset %j without resetting other module receipts', (...ids: string[]) => {
        const { game } = scene(ids), before = game.extensionRuntime!.snapshot(); rest(game);
        const after = game.extensionRuntime!.snapshot(); expect(game.player.hp).toBe(game.player.maxHp);
        expect(last(ledger(game).receipts).result).toBe('completed'); expect(after.foundation.world).toEqual(before.foundation.world);
        if (ids.includes('growth')) {
            const a = after.modules.growth as unknown as { objectiveClock: number; rewardReceipts: string[]; resourceReceipts: string[]; storyReceipts: string[] }, b = before.modules.growth as unknown as { objectiveClock: number; rewardReceipts: string[]; resourceReceipts: string[]; storyReceipts: string[] };
            expect(a.objectiveClock - b.objectiveClock).toBe(5); expect(a.rewardReceipts).toEqual(b.rewardReceipts);
            expect(a.resourceReceipts).toEqual(b.resourceReceipts); expect(a.storyReceipts).toEqual(b.storyReceipts);
            expect(after.components[game.player.id]!['growth:skills']).toEqual(before.components[game.player.id]!['growth:skills']);
        }
        if (ids.includes('narrative')) {
            // 3g adds exactly one declared first-rest flag/receipt. The prior
            // ledger-preservation assertion still covers every other field.
            const expected = json(before.modules.narrative) as unknown as { revision: number; lastFactId: number;
                flags: Record<string, unknown>; triggerReceipts: { triggerId: string; receiptId: string; scopeKey: string; firings: number; lastTurn: number; lastFactId: number }[] };
            expected.revision++; expected.lastFactId = before.foundation.nextFactId;
            expected.flags['bonfire.rested'] = true;
            expected.triggerReceipts.push({ triggerId: 'bonfire.first-rest', receiptId: 'bonfire.first-rest.receipt', scopeKey: 'run',
                firings: 1, lastTurn: game.absoluteTurnNumber, lastFactId: before.foundation.nextFactId });
            expect(after.modules.narrative).toEqual(expected);
        }
        if (ids.includes('giants')) expect(after.modules.giants).toEqual(before.modules.giants);
    });
    it('saves an in-flight scheduler rest, resumes only on update and never applies recovery twice after load', () => {
        const { game } = scene(); begin(game); productionActorActionScheduler(game)!.advanceActionTime(123);
        const save = json(game.toSaveSnapshot()), random = rng.getState(), active = json(ledger(game).active);
        expect(state(game).scheduler.bundles[0]!.elapsedActionTicks).toBe(123); expect(game.player.ticksUntilTurn).toBe(377);
        const loaded = createHeadlessGame(913, 'test'); expect(loaded.loadSnapshot(save)).toBe(true); loaded.animationEnabled = false;
        expect(rng.getState()).toEqual(random); expect(ledger(loaded).active).toEqual(active); expect(loaded.player.hp).toBe(300);
        expect(loaded.isInputLocked()).toBe(true); loaded.update();
        expect(ledger(loaded).active).toBeNull(); expect(ledger(loaded).receipts).toHaveLength(1); expect(loaded.player.hp).toBe(1000);
        const complete = json(loaded.toSaveSnapshot()); complete.player.hp = 17;
        expect(loaded.loadSnapshot(complete)).toBe(true); const afterLoad = facts(loaded); loaded.update(); settleWorldRest(loaded);
        expect(facts(loaded)).toEqual(afterLoad); expect(loaded.player.hp).toBe(17);
    });
    it('rejects corrupt active action identity and duplicate terminal receipt before retiring the live game', () => {
        const { game } = scene(); begin(game); const save = json(game.toSaveSnapshot()), player = game.player, before = facts(game);
        const wrongId = json(save), serialized = wrongId.extensions!.modules.combat as unknown as ProductionActorAttackState;
        serialized.bonfires!.active!.actionId++;
        expect(game.loadSnapshot(wrongId)).toBe(false); expect(game.player).toBe(player); expect(facts(game)).toEqual(before);
        for (const field of ['sourceFootprintVersion', 'sourcePartId'] as const) {
            const corrupt = json(save), combat = corrupt.extensions!.modules.combat as unknown as ProductionActorAttackState;
            combat.scheduler.bundles[0]!.subactions[0]![field] = 'forged-source';
            expect(game.loadSnapshot(corrupt)).toBe(false); expect(game.player).toBe(player); expect(facts(game)).toEqual(before);
        }
        clockToEnd(game); const completed = json(game.toSaveSnapshot()), duplicate = completed.extensions!.modules.combat as unknown as ProductionActorAttackState;
        duplicate.bonfires!.receipts.push({ ...duplicate.bonfires!.receipts[0]! }); const terminal = facts(game);
        expect(game.loadSnapshot(completed)).toBe(false); expect(game.player).toBe(player); expect(facts(game)).toEqual(terminal);
    });
    it.each([false, true])('animated=%s advances through the real frame driver and commits exactly one final checkpoint', animated => {
        const { game } = scene(); game.animationEnabled = animated;
        const dialogs = new DialogService(), unbind = bindDialogAcknowledgments(dialogs, game, logger), timeline = presentationTimeline(game)!;
        const tick = timeSystem.currentTick, events = game.recordedInputEvents.length;
        try {
            rest(game);
            if (animated) { expect(game.isAdvancing).toBe(true); expect(game.isInputLocked()).toBe(true); expect(game.player.hp).toBeLessThan(1000); }
            let frames = 0;
            while (game.isAdvancing || timeline.busy) {
                expect(++frames).toBeLessThan(1000); game.tickAdvancement(16); timeline.tick(16);
                if (timeline.acknowledgment) { dialogs.sync(); expect(dialogs.answer(dialogs.current!.token, 'more')).toBe(true); }
            }
            expect(game.lastAdvancementError).toBeNull(); expect(game.isInputLocked()).toBe(false);
            expect(timeSystem.currentTick - tick).toBe(500); expect(game.player.hp).toBe(1000); expect(ledger(game).receipts).toHaveLength(1);
            expect(game.recordedInputEvents).toHaveLength(events + 1);
            expect(last(game.recordedInputEvents).checkpoint!.domains.extensions).toBe(extensionDigest(game.extensionRuntime!.snapshot() ?? null));
            const complete = facts(game); for (let frame = 0; frame < 10; frame++) { game.tickAdvancement(16); timeline.tick(16); }
            expect(facts(game)).toEqual(complete);
        } finally { unbind(); dialogs.dispose(); }
    });
    it('natural generated commands reproduce RNG, checkpoints, bidirectional seek and saved continuation', () => {
        // This seed's normal first floor is small; use untouched production generation
        // and real movement rather than replacing startNewGame with an arena fixture.
        const game = start(['combat'], 7397, 'normal'), target = bonfire(game);
        expect(target).toBeDefined();
        const expected: ReturnType<typeof mechanical>[] = [], saves: ReturnType<Game['toSaveSnapshot']>[] = [];
        const inputs: { action: string; data?: unknown }[] = [];
        const play = (action: string, data?: unknown) => {
            acknowledge(); game.executeCommand(action, data); expect(game.lastAdvancementError).toBeNull();
            inputs.push({ action, data }); expected.push(mechanical(game)); saves.push(json(game.toSaveSnapshot()));
        };
        const origin = { ...game.player.loc }, key = (point: { x: number; y: number }) => `${point.x},${point.y}`;
        const queue: { x: number; y: number; path: { x: number; y: number }[] }[] = [{ ...origin, path: [] }], seen = new Set([key(origin)]);
        let path: { x: number; y: number }[] | undefined;
        for (let index = 0; index < queue.length; index++) {
            const point = queue[index]!;
            if (Math.max(Math.abs(point.x - target.x), Math.abs(point.y - target.y)) <= 1) { path = point.path; break; }
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
                const next = { x: point.x + dx!, y: point.y + dy! }, cell = game.grid.getCell(next.x, next.y);
                if (seen.has(key(next)) || !cell?.isPassable || cell.isOpaque || !cell.isVisible
                    || game.monsters.some(monster => monster.x === next.x && monster.y === next.y)) continue;
                seen.add(key(next)); queue.push({ ...next, path: [...point.path, { x: dx!, y: dy! }] });
            }
        }
        expect(path).toBeDefined(); expect(path!.length).toBeLessThan(10);
        for (const direction of path!) play('move', direction);
        // Let nearby naturally born enemies approach, then defeat them with the
        // native move/attack command. The recording must retain their deaths.
        let encounters = 0;
        while (worldRestUnavailable(game, target.id) === 'threatened') {
            expect(++encounters).toBeLessThan(30); expect(game.isGameOver).toBe(false);
            const adjacent = game.monsters.find(monster => monster.hp > 0 && !monster.isAlly
                && canDirectlySeeMonster(game.player, game.grid, monster) && game.meleeContact(game.player, monster));
            if (adjacent) play('move', { x: Math.sign(adjacent.x - game.player.x), y: Math.sign(adjacent.y - game.player.y) });
            else play('wait');
        }
        expect(worldRestUnavailable(game, target.id)).toBeNull();
        for (let visit = 1; visit <= 3; visit++) {
            play('ext:command', command(target.id));
            expect(last(ledger(game).receipts)).toMatchObject({ visit, result: visit < 3 ? 'completed' : 'interrupted', reason: visit < 3 ? null : 'threat' });
        }
        const recording = json(game.exportRecording()); expect(game.hasCompleteRecording).toBe(true); expect(recording.events).toHaveLength(expected.length);
        const replay = createHeadlessGame(814, 'test'); expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
        for (const checkpoint of expected) { replay.replayStep(true); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(checkpoint); }
        for (const index of [1, expected.length - 1, 2, expected.length]) {
            replay.replaySeek(index); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(expected[index - 1]);
        }
        const resumeAt = Math.max(0, expected.length - 3), loaded = createHeadlessGame(815, 'test');
        expect(loaded.loadSnapshot(saves[resumeAt]!)).toBe(true); loaded.animationEnabled = false; loaded.onConfirmRequest = () => true;
        for (const input of inputs.slice(resumeAt + 1)) { acknowledge(); loaded.executeCommand(input.action, input.data); }
        expect(mechanical(loaded)).toEqual(last(expected)); expect(loaded.exportRecording().events).toEqual(recording.events);
    }, 60000);
});
