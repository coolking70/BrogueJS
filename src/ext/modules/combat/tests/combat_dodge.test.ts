import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { prepareActorDodge, prepareActorDodgeCommand, commitActorDodge, commitActorDodgeCommand,
    isActorDodgeProtected } from '../../../../engine/Core/PhasedAttackProduction';
import { withActorActionScope, withNativeActorDecisionScope } from '../../../../engine/Core/ActorActionScope';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { ActorCombatResolutionAuthority } from '../../../../engine/Combat/ActorCombatResolution';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { DungeonLayer, TerrainType as T } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { sourceFootprintVersion } from '../../../../engine/Movement/AttackShape';
import { bindMovementRegions } from '../../../../engine/Movement/MovementRegions';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { getNextEntityId } from '../../../../entities/Creature';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import * as catalog from '../../../catalog';
import type { ActorAttackFacing } from '../../../actorActions';
import { registryFromDescriptors } from '../../../descriptor';
import { createCombatModuleFromPack } from '../module';
import { loadCombatDefinitionPack } from '../definitions';
import { loadCombatPack } from '../schema';
import type { CombatPack } from '../types';
import locale from '../locales/zh_CN.json';

const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const command = (facing: ActorAttackFacing = 'e') => JSON.stringify({ module: 'combat', action: 'dodge', payload: { facing } });
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const resource = (game: Game, actorId = game.player.id) => state(game).actors.find(actor => actor.actorId === actorId)!;
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
function start(seed = 73073, mode: 'normal' | 'test' = 'test'): Game {
    const game = createHeadlessGame(seed, 'test'), registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(['combat'])).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ['combat'], initialCommands });
    game.animationEnabled = false;
    return game;
}
function arena(game: Game) {
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS])
            game.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON
                ? x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR : T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 20, y: 15 });
    game.player.hp = game.player.maxHp = 1000; game.player.ticksUntilTurn = 0;
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).bindDungeonFeatureEffects(); (game as any).updateVision();
}
function scene() { const game = start(); arena(game); return game; }
function npc(game: Game, size: 1 | 2 | 3 = 1, at = { x: 24, y: 15 }) {
    const data = monsters.find(monster => monster.id === 'rat')! as MonsterData;
    const source = size === 1 ? new Monster(at.x, at.y, data) : game.createSquareMonster(data, size, at)!;
    if (size === 1) { game.monsters.push(source); game.extensionRuntime!.attachCreature(source); }
    source.state = MonsterState.HUNTING; source.ticksUntilTurn = 0; source.hp = source.maxHp = 1000;
    source.regenTurns = 0; source.defense = -10000;
    return source;
}
/** Explicit trusted-engine fixture. No automatic NPC dodge selector is installed. */
function dodgeNpc(game: Game, source: Monster, facing: ActorAttackFacing = 'e') {
    const plan = prepareActorDodge(game, source.id, facing); expect(plan).not.toBeNull();
    expect(withNativeActorDecisionScope(game, source.id, scope => commitActorDodge(game, plan!, scope))).toBe(true);
}
function unchangedFacts(game: Game) {
    return { state: json(state(game)), rng: rng.getState(), nextId: getNextEntityId(), tick: timeSystem.currentTick,
        turn: game.absoluteTurnNumber, player: { loc: { ...game.player.loc }, hp: game.player.hp, ticks: game.player.ticksUntilTurn },
        actors: game.monsters.map(source => ({ id: source.id, loc: { ...source.loc }, hp: source.hp, ticks: source.ticksUntilTurn })) };
}
function mechanical(game: Game) {
    const snapshot = json(game.toSnapshot()); snapshot.savedAt = 0;
    snapshot.run.recordedInputEvents = []; snapshot.run.recordedInputIndex = 0;
    return snapshot;
}
function configuredCombat(change: (pack: CombatPack) => void) {
    const data = structuredClone(loadCombatDefinitionPack()); change(data);
    const pack = loadCombatPack(data, locale), combat = createCombatModuleFromPack(pack);
    const registry = registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(descriptor => descriptor.id === 'combat'
        ? { ...descriptor, create: () => createCombatModuleFromPack(pack), rules: combat.rules } : descriptor));
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
}

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('3c production dodge preflight and shared footprint authority', () => {
    it('prepares immutable eight-direction plans without resources, clocks, IDs or either RNG stream', () => {
        const game = scene(), before = unchangedFacts(game);
        for (const facing of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const) {
            const plan = prepareActorDodgeCommand(game, command(facing));
            expect(plan).not.toBeNull(); expect(Object.isFrozen(plan)).toBe(true); expect(Object.isFrozen(plan!.to)).toBe(true);
        }
        expect(unchangedFacts(game)).toEqual(before);
    });

    it.each([{}, { facing: 'up' }, { facing: 'e', distance: 2 }, { facing: null }])('rejects malformed input %j before mutation', payload => {
        const game = scene(), before = unchangedFacts(game);
        expect(() => prepareActorDodgeCommand(game, JSON.stringify({ module: 'combat', action: 'dodge', payload }))).toThrow('Invalid dodge input');
        expect(unchangedFacts(game)).toEqual(before);
    });

    it.each(['wall', 'occupied', 'stairs-up', 'stairs-down', 'portal', 'altar', 'lava'] as const)('rejects %s before command time, payment, ID or RNG', obstruction => {
        const game = scene();
        if (obstruction === 'occupied') npc(game, 1, { x: 21, y: 15 }).ticksUntilTurn = 10000;
        else game.grid.setTerrain(21, 15, ({ wall: T.WALL, 'stairs-up': T.STAIRS_UP, 'stairs-down': T.STAIRS_DOWN,
            portal: T.DUNGEON_PORTAL, altar: T.ALTAR, lava: T.LAVA } as const)[obstruction]);
        game.grid.getCell(21, 15)!.hasMemory = true;
        const before = unchangedFacts(game), events = json(game.recordedInputEvents);
        expect(prepareActorDodgeCommand(game, command())).toBeNull(); acknowledge(); game.executeCommand('ext:command', command());
        expect(unchangedFacts(game)).toEqual(before); expect(game.recordedInputEvents).toHaveLength(events.length + 1);
        expect(game.recordedInputEvents[events.length]).toMatchObject({ tick: before.tick, turn: before.turn, decisions: [],
            extensions: { modules: { combat: before.state } } });
    });

    it.each(['paralyzed', 'entranced', 'confused', 'stuck', 'nauseous'] as const)('rejects the existing %s eligibility gate purely', status => {
        const game = scene(); game.player.setStatusDuration(status, 10); const before = unchangedFacts(game);
        expect(prepareActorDodgeCommand(game, command())).toBeNull(); expect(unchangedFacts(game)).toEqual(before);
    });

    it('insufficient stamina, seizure and a positive native clock reject without normalizing or charging', () => {
        const game = scene(); state(game).actors.push({ actorId: game.player.id, profileId: 'fixture.profile', stamina: 3,
            regenRemainder: 19, regenDelayRemaining: 4, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        let before = unchangedFacts(game); expect(prepareActorDodgeCommand(game, command())).toBeNull(); expect(unchangedFacts(game)).toEqual(before);
        resource(game).stamina = 20; const holder=npc(game,1,{x:19,y:15});holder.seizing=true;game.player.seized = true; before = unchangedFacts(game);
        expect(prepareActorDodgeCommand(game, command())).toBeNull(); expect(unchangedFacts(game)).toEqual(before);
        game.player.seized = false; game.player.ticksUntilTurn = 1; before = unchangedFacts(game);
        expect(prepareActorDodgeCommand(game, command())).toBeNull(); expect(unchangedFacts(game)).toEqual(before);
    });

    it.each([2, 3] as const)('%s-square NPC preparation uses whole destination and both diagonal sweeps', size => {
        const game = scene(), source = npc(game, size), step = vi.spyOn(game, 'canStepFootprint');
        const edge = { x: source.x + size, y: source.y + size - 1 };
        expect(prepareActorDodge(game, source.id, 'e')).not.toBeNull();
        expect(step).toHaveBeenLastCalledWith(source, { x: source.x + 1, y: source.y });
        game.grid.setTerrain(edge.x, edge.y, T.WALL); const before = unchangedFacts(game);
        expect(prepareActorDodge(game, source.id, 'e')).toBeNull(); expect(unchangedFacts(game)).toEqual(before);
        game.grid.setTerrain(edge.x, edge.y, T.FLOOR);
        game.grid.setTerrain(edge.x, edge.y, T.STAIRS_DOWN);
        expect(prepareActorDodge(game, source.id, 'e')).toBeNull(); game.grid.setTerrain(edge.x, edge.y, T.FLOOR);
        const obstacle = npc(game, 1, edge); obstacle.ticksUntilTurn = 10000;
        expect(prepareActorDodge(game, source.id, 'e')).toBeNull(); game.monsters = game.monsters.filter(value => value !== obstacle);
        game.grid.setTerrain(source.x + size, source.y, T.WALL);
        expect(prepareActorDodge(game, source.id, 'se')).toBeNull();
        game.grid.setTerrain(source.x + size, source.y, T.FLOOR);
        const beforeBody = footprintOf(source).map(cell => ({ ...cell })); dodgeNpc(game, source);
        expect(footprintOf(source)).toEqual(beforeBody.map(cell => ({ ...cell, x: cell.x + 1 })));
        expect(resource(game, source.id)).toMatchObject({ stamina: 20, regenDelayRemaining: 40, dodgeRemainingTicks: 40, dodgeRecoveryRemainingTicks: 80 });
        expect(source.ticksUntilTurn).toBe(80);
    });

    it('refuses movement outside the same foundation region without converting the body or spending', () => {
        const game = scene(), source = npc(game, 2);
        source.spatial!.movementRegionId = 731;
        bindMovementRegions(game.grid, (id, at) => id === 731 && at.x >= 24 && at.x <= 25 && at.y >= 15 && at.y <= 16);
        const before = unchangedFacts(game);
        expect(game.canStepFootprint(source, { x: 25, y: 15 })).toBe(false);
        expect(prepareActorDodge(game, source.id, 'e')).toBeNull(); expect(unchangedFacts(game)).toEqual(before);
        expect(source.spatial!.movementRegionId).toBe(731);
    });

    it.each([{ footprintId: 'fixture:mask', pose: 'r0' }, { footprintId: 'builtin:square-2', pose: 'r90' }])
    ('explicitly rejects unopened mask/rotation capability %j before spatial fallback', component => {
        const game = scene(), source = npc(game, 2);
        source.spatial = { schema: 1, ...component } as typeof source.spatial;
        const before = unchangedFacts(game), step = vi.spyOn(game, 'canStepFootprint');
        expect(prepareActorDodge(game, source.id, 'e')).toBeNull(); expect(step).not.toHaveBeenCalled(); expect(unchangedFacts(game)).toEqual(before);
    });

    it('rejects stale relocation and unprivileged NPC scopes before charging', () => {
        const game = scene(), source = npc(game), plan = prepareActorDodge(game, source.id, 'e')!, before = unchangedFacts(game);
        expect(() => withActorActionScope(game, 'npc-scheduler', source.id, scope => commitActorDodge(game, plan, scope))).toThrow('native decision prelude');
        expect(unchangedFacts(game)).toEqual(before);
        commitCreatureAnchor(source, { x: source.x, y: source.y + 1 }); const changed = unchangedFacts(game);
        expect(() => withNativeActorDecisionScope(game, source.id, scope => commitActorDodge(game, plan, scope))).toThrow('Stale dodge preparation');
        expect(unchangedFacts(game)).toEqual(changed);
    });
});

describe('3c command decisions, recovery and native defense boundaries', () => {
    it.each([false, true])('records the genuine fire confirmation %s exactly once, with no pre-confirmation effects', answer => {
        const game = scene(); game.grid.setTerrain(21, 15, T.PLAIN_FIRE); game.grid.getCell(21, 15)!.isVisible = true;
        game.onCommandConfirmRequest = () => {}; game.onConfirmRequest = () => { throw new Error('Unexpected synchronous confirmation'); };
        const before = unchangedFacts(game); acknowledge(); game.executeCommand('ext:command', command());
        expect(game.pendingCommandConfirmation).not.toBeNull(); expect(unchangedFacts(game)).toEqual(before);
        game.resolveCommandDecision(game.pendingCommandConfirmation!.token, answer);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual([answer]);
        if (!answer) expect(unchangedFacts(game)).toEqual(before);
        else {
            expect(game.player.loc).toEqual({ x: 21, y: 15 }); expect(resource(game).stamina).toBe(22);
            expect(resource(game)).toMatchObject({ dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
            // This eighty-tick action can finish before the next environment block.
            expect(game.pendingCommandConfirmation).toBeNull();
        }
    });

    it('one real command pays four, moves one cell and waits the complete eighty-tick recovery', () => {
        const game = scene(), tick = timeSystem.currentTick;
        acknowledge(); game.executeCommand('ext:command', command());
        expect(game.player.loc).toEqual({ x: 21, y: 15 }); expect(timeSystem.currentTick - tick).toBe(80);
        expect(resource(game)).toMatchObject({ stamina: 22, regenRemainder: 0, regenDelayRemaining: 0,
            dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        expect(state(game).schema).toBe(2); expect(state(game).nextActionId).toBe(1);
        expect(state(game).scheduler.bundles).toEqual([]); expect(game.player.ticksUntilTurn).toBe(0); expect(game.isInputLocked()).toBe(false);
    });

    it('protection includes the last positive tick, expires before contact, and recovery keeps the actor ineligible', () => {
        const game = scene(), source = npc(game); dodgeNpc(game, source);
        const scheduler = productionActorActionScheduler(game)!, random = rng.getState();
        expect(isActorDodgeProtected(game, source.id)).toBe(true); expect(prepareActorDodge(game, source.id, 'e')).toBeNull();
        scheduler.advanceActionTime(39); expect(resource(game, source.id)).toMatchObject({ stamina: 20, regenDelayRemaining: 1,
            dodgeRemainingTicks: 1, dodgeRecoveryRemainingTicks: 41 });
        expect(isActorDodgeProtected(game, source.id)).toBe(true);
        scheduler.advanceActionTime(1); expect(isActorDodgeProtected(game, source.id)).toBe(false);
        expect(resource(game, source.id).dodgeRecoveryRemainingTicks).toBe(40); expect(prepareActorDodge(game, source.id, 'e')).toBeNull();
        expect(rng.getState()).toEqual(random);
    });

    it.each(['idle', 'recovery'] as const)('regeneration limited to %s is identical across a crossed dodge recovery boundary', phase => {
        configuredCombat(pack => {
            pack.resourcePolicies[0]!.regenPhases = [phase]; pack.resourcePolicies[0]!.regenDelayTicks = 0; pack.dodge.cost = 10;
        });
        const first = scene(), source = npc(first); dodgeNpc(first, source);
        productionActorActionScheduler(first)!.advanceActionTime(100);
        const expected = json(resource(first, source.id));
        expect(expected).toMatchObject({ stamina: phase === 'idle' ? 15 : 18, regenRemainder: 0,
            regenDelayRemaining: 0, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        const second = scene(), split = npc(second); dodgeNpc(second, split);
        for (const delta of [30, 49, 21]) productionActorActionScheduler(second)!.advanceActionTime(delta);
        expect(resource(second, split.id)).toEqual({ ...expected, actorId: split.id });
    });

    it.each(['move-away-and-back', 'paralyzed', 'entranced', 'caged', 'dead'] as const)('%s cancels active protection without a refund', change => {
        const game = scene(), source = npc(game); dodgeNpc(game, source);
        if (change === 'move-away-and-back') { const at = { ...source.loc }; commitCreatureAnchor(source, { x: at.x + 1, y: at.y }); commitCreatureAnchor(source, at); }
        else if (change === 'caged') source.isCaged = true;
        else if (change === 'dead') source.hp = 0;
        else source.setStatusDuration(change, 10);
        expect(isActorDodgeProtected(game, source.id)).toBe(false); expect(resource(game, source.id).stamina).toBe(20);
    });

    it('native melee is dodged before hooks and dice; bolt, thrown weapon and direct damage remain native', () => {
        const game = scene(), target = npc(game, 1, { x: 21, y: 14 }); dodgeNpc(game, target, 's');
        const hooks = vi.spyOn(game.player.extensionHooks!, 'beforeAttack'), hp = target.hp, random = rng.getState();
        expect(CombatSystem.attack(game.player, target, { grid: game.grid })).toMatchObject({ hit: false, damage: 0, dodged: true });
        expect(target.hp).toBe(hp); expect(hooks).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random);
        expect(resource(game).stamina).toBe(22);
        expect(CombatSystem.attack(game.player, target, { grid: game.grid, delivery: 'bolt' }).dodged).toBeUndefined();
        expect(target.hp).toBeLessThan(hp); expect(resource(game).stamina).toBe(22);
        const weapon = ItemLoader.spawnWeapon('dagger', -1, -1)!; weapon.damage = '4-4'; weapon.strengthRequired = game.player.effectiveStrength;
        const beforeThrown = target.hp; expect(CombatSystem.resolveThrownWeapon(game.player, target, weapon, game.grid).hit).toBe(true);
        expect(target.hp).toBeLessThan(beforeThrown);
        const beforeDamage = target.hp; target.takeDamage(3, true, game.grid); expect(target.hp).toBe(beforeDamage - 3);
        target.setStatusDuration('poisoned', 4); expect(target.hasStatus('poisoned')).toBe(true); expect(isActorDodgeProtected(game, target.id)).toBe(true);
    });

    it('a genuine NPC dodge applies hazardous entry effects while its melee window is active', () => {
        const game = scene(), source = npc(game); game.grid.setTerrain(source.x + 1, source.y, T.PLAIN_FIRE);
        dodgeNpc(game, source);
        expect(isActorDodgeProtected(game, source.id)).toBe(true);
        expect((source.statusDurations as Record<string, number>).burning).toBeGreaterThan(0);
    });

    it.each([true, false])('a production segment respects its dodgeable=%s flag', dodgeable => {
        const game = scene(), target = npc(game, 1, { x: 22, y: 15 }); dodgeNpc(game, target, 'w');
        const authority = new ActorCombatResolutionAuthority(game, { schema: 1, nextResolutionId: 1, actors: [] },
            { production: true, dodgeProtected: id => isActorDodgeProtected(game, id) });
        const plans = authority.prepareLockedBodySegment({ kind: 'locked-body-segment', depth: game.depth, sourceEntityId: game.player.id,
            sourceFootprintVersion: sourceFootprintVersion(game.spatialOf(game.player)),
            shape: { schema: 1, kind: 'footprint-offset-union', offsets: [{ x: 1, y: 0 }], selfExclusion: 'whole-group' },
            lockedCells: [{ ...target.loc }], approvedRisks: [], dodgeable, parryable: false }); expect(plans).toHaveLength(1);
        const native = vi.spyOn(CombatSystem, 'attack'), random = rng.getState();
        const result = withActorActionScope(game, 'player-command', game.player.id, scope => authority.commitNativeMelee(scope, plans[0]!));
        expect(result?.kind).toBe(dodgeable ? 'defended' : 'native');
        if (dodgeable) { expect(native).not.toHaveBeenCalled(); expect(rng.getState()).toEqual(random); }
        else expect(native).toHaveBeenCalledTimes(1);
    });
});

describe('3c dodge persistence, deterministic continuation and floor lifetime', () => {
    it('saved player recovery resumes on update without an extra command or another payment', () => {
        const game = scene(), plan = prepareActorDodgeCommand(game, command())!;
        expect(commitActorDodgeCommand(game, plan)).toBe(true);
        const saved = game.toSaveSnapshot(), before = json(state(game)), random = rng.getState();
        const loaded = createHeadlessGame(36, 'test'); expect(loaded.loadSnapshot(saved)).toBe(true); loaded.animationEnabled = false;
        expect(state(loaded)).toEqual(before); expect(rng.getState()).toEqual(random); expect(loaded.isInputLocked()).toBe(true);
        const at = { ...loaded.player.loc }; loaded.executeCommand('move', { x: 1, y: 0 }); expect(loaded.player.loc).toEqual(at);
        loaded.update(); expect(loaded.isInputLocked()).toBe(false); expect(loaded.player.ticksUntilTurn).toBe(0);
        expect(resource(loaded)).toMatchObject({ stamina: 22, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        expect(loaded.recordedInputEvents).toEqual(saved.run.recordedInputEvents);
    });

    it('load preserves an active window and recovery without RNG, repayment or entry effects', () => {
        const game = scene(), source = npc(game); dodgeNpc(game, source);
        const before = mechanical(game), saved = game.toSaveSnapshot(), random = rng.getState();
        const loaded = createHeadlessGame(37, 'test'); expect(loaded.loadSnapshot(saved)).toBe(true); loaded.animationEnabled = false;
        expect(mechanical(loaded)).toEqual(before); expect(rng.getState()).toEqual(random);
        expect(isActorDodgeProtected(loaded, source.id)).toBe(true); expect(resource(loaded, source.id).dodgeRecoveryRemainingTicks).toBe(80);
    });

    it('rejects a corrupt active recovery mirror before replacing any part of the old world', () => {
        const game = scene(), source = npc(game); dodgeNpc(game, source);
        const saved = game.toSaveSnapshot(); saved.monsters.find(monster => monster.id === source.id)!.ticksUntilTurn++;
        const before = unchangedFacts(game), player = game.player, runtime = game.extensionRuntime;
        expect(game.loadSnapshot(saved)).toBe(false); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
        expect(unchangedFacts(game)).toEqual(before);
    });

    it('genuine dodge commands replay every checkpoint, seek in both directions and continue the exact saved prefix', () => {
        const original = Game.prototype.startNewGame;
        vi.spyOn(Game.prototype, 'startNewGame').mockImplementation(function (this: Game, ...args) {
            original.apply(this, args); if (this.extensionRuntime?.actorActionBinding()) arena(this);
        });
        const game = start(), expected: ReturnType<typeof mechanical>[] = [], saves: ReturnType<Game['toSaveSnapshot']>[] = [];
        for (const facing of ['e', 's', 'w', 'n'] as const) {
            acknowledge(); game.executeCommand('ext:command', command(facing)); expected.push(mechanical(game)); saves.push(json(game.toSaveSnapshot()));
        }
        const recording = json(game.exportRecording()), replay = createHeadlessGame(38, 'test');
        expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
        for (const checkpoint of expected) { replay.replayStep(true); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(checkpoint); }
        for (const index of [1, 3, 2, 4]) { replay.replaySeek(index); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(expected[index - 1]); }
        const loaded = createHeadlessGame(39, 'test'); expect(loaded.loadSnapshot(saves[1]!)).toBe(true); loaded.animationEnabled = false;
        for (const facing of ['w', 'n'] as const) { acknowledge(); loaded.executeCommand('ext:command', command(facing)); }
        expect(mechanical(loaded)).toEqual(expected[3]); expect(loaded.exportRecording().events).toEqual(recording.events);
        expect(rng.getState()).toEqual(expected[3]!.rngState);
    });

    it('floor departure cancels defense while cached NPC stamina, fraction, delay and recovery freeze until return', () => {
        const game = start(7397, 'normal'); arena(game); const source = npc(game); dodgeNpc(game, source);
        productionActorActionScheduler(game)!.advanceActionTime(7);
        // Native countdown belongs to TimeCoordinator, unlike bundled attack mirrors.
        source.ticksUntilTurn -= 7;
        game.depth = 2; (game as any).generateDepth(false, false);
        expect(game.levels.get(1)!.monsters).toContain(source); expect(resource(game, source.id).dodgeRemainingTicks).toBe(0);
        const frozen = json(resource(game, source.id)); productionActorActionScheduler(game)!.advanceActionTime(19);
        expect(resource(game, source.id)).toEqual(frozen);
        const cached = game.toSaveSnapshot(), ledger = cached.extensions!.modules.combat as unknown as ReturnType<typeof state>;
        ledger.actors.find(actor => actor.actorId === source.id)!.dodgeRemainingTicks = 1;
        const player = game.player, runtime = game.extensionRuntime;
        expect(game.loadSnapshot(cached)).toBe(false); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
        game.depth = 1; (game as any).generateDepth(true, false);
        expect(game.monsters).toContain(source); expect(resource(game, source.id)).toEqual(frozen);
        productionActorActionScheduler(game)!.advanceActionTime(5);
        source.ticksUntilTurn -= 5;
        expect(resource(game, source.id).regenDelayRemaining).toBe(frozen.regenDelayRemaining - 5);
        expect(resource(game, source.id).dodgeRecoveryRemainingTicks).toBe(frozen.dodgeRecoveryRemainingTicks - 5);
        expect(isActorDodgeProtected(game, source.id)).toBe(false); expect(() => game.toSnapshot()).not.toThrow();
    });

    it.each([false, true])('an accepted chasm dodge falls and finishes carried recovery without another input (animated=%s)', animated => {
        const game = scene(); game.animationEnabled = animated; game.grid.setTerrain(21, 15, T.CHASM);
        game.grid.getCell(21, 15)!.isDiscovered = true; game.onCommandConfirmRequest = () => {};
        acknowledge(); game.executeCommand('ext:command', command()); expect(game.pendingCommandConfirmation).not.toBeNull();
        game.resolveCommandDecision(game.pendingCommandConfirmation!.token, true);
        while (game.isAdvancing) game.tickAdvancement(1000);
        expect(game.depth).toBe(2); expect(game.player.hp).toBeLessThan(1000);
        expect({ locked: game.isInputLocked(), ticks: game.player.ticksUntilTurn, resource: resource(game) }).toMatchObject({ locked: false, ticks: 0,
            resource: { dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 } });
        expect(game.player.ticksUntilTurn).toBe(0); expect(resource(game)).toMatchObject({ dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual([true]);
        expect(() => game.toSaveSnapshot()).not.toThrow(); expect(() => game.exportRecording()).not.toThrow();
    });
});


describe('3c intrinsic NPC movement bounds',()=>{
    it.each([1,2,3] as const)('aquatic %s-square dodge requires liquid under every destination cell and rechecks before payment',size=>{
        const game=scene(),source=npc(game,size);source.behaviorFlags.add('MONST_RESTRICTED_TO_LIQUID');
        for(let x=source.x;x<=source.x+size;x++)for(let y=source.y;y<source.y+size;y++)game.grid.setTerrainLayer(x,y,DungeonLayer.LIQUID,T.WATER_DEEP);
        const plan=prepareActorDodge(game,source.id,'e');expect(plan).not.toBeNull();
        game.grid.setTerrainLayer(source.x+size,source.y+size-1,DungeonLayer.LIQUID,T.NOTHING);
        const before=unchangedFacts(game);expect(prepareActorDodge(game,source.id,'e')).toBeNull();
        expect(()=>withNativeActorDecisionScope(game,source.id,scope=>commitActorDodge(game,plan!,scope))).toThrow();
        expect(unchangedFacts(game)).toEqual(before);
    });
    it('a square aquatic diagonal checks both intermediate footprints',()=>{
        const game=scene(),source=npc(game,2);source.behaviorFlags.add('MONST_RESTRICTED_TO_LIQUID');
        for(let x=source.x;x<=source.x+2;x++)for(let y=source.y;y<=source.y+2;y++)game.grid.setTerrainLayer(x,y,DungeonLayer.LIQUID,T.WATER_DEEP);
        expect(prepareActorDodge(game,source.id,'se')).not.toBeNull();
        // This corner belongs to the east intermediate square, not the destination.
        game.grid.setTerrainLayer(source.x+2,source.y,DungeonLayer.LIQUID,T.NOTHING);
        const before=unchangedFacts(game);expect(prepareActorDodge(game,source.id,'se')).toBeNull();expect(unchangedFacts(game)).toEqual(before);
    });
    it.each([1,2] as const)('a seized %s-square NPC cannot dodge a live hostile grip; stale flags release at commit',size=>{
        const game=scene(),source=npc(game,size),holder=npc(game,1,{x:source.x-1,y:source.y});
        source.isAlly=true;source.seized=true;holder.seizing=true;
        const before=unchangedFacts(game);expect(prepareActorDodge(game,source.id,'e')).toBeNull();expect(unchangedFacts(game)).toEqual(before);
        holder.hp=0;expect(prepareActorDodge(game,source.id,'e')).not.toBeNull();dodgeNpc(game,source);
        expect(source.seized).toBe(false);
    });
});
