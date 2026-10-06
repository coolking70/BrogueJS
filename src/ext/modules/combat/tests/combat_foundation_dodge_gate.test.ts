import { afterEach, describe, expect, it, vi } from 'vitest';
import { installedModuleSubsets } from '../../../../test/support/installedExtensions';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { prepareActorDodge, commitActorDodge, chargeNativeActorAttack,
    isActorDodgeProtected } from '../../../../engine/Core/PhasedAttackProduction';
import { withNativeActorDecisionScope } from '../../../../engine/Core/ActorActionScope';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { DungeonLayer, TerrainType as T } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { RIGID_POSES, type RigidPose } from '../../../../engine/Movement/RigidFootprint';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { getNextEntityId } from '../../../../entities/Creature';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import * as catalog from '../../../catalog';
import { validateProductionActorAttackState } from '../../../actorActionValidation';

const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const resource = (game: Game, actorId: number) => state(game).actors.find(row => row.actorId === actorId)!;
const rat = monsters.find(monster => monster.id === 'rat')! as MonsterData;
const formId = 'giants.spine-crawler';
// Optional composition follows descriptor discovery, without importing another
// module's implementation or changing either installed definition pack.
const installedGiants = catalog.getInstalledModuleDescriptors().filter(module => module.id === 'giants');
const poses = installedGiants.flatMap(() => RIGID_POSES);

/** Narrow diagnostic arena copied from the real 3c dodge fixture. Bodies are
 * created by Game's checked APIs; this does not claim a natural encounter. */
function scene(extensions = ['combat', 'giants']): Game {
    const seed = 73073, game = createHeadlessGame(seed, 'test'), registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(extensions)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed, mode: 'test', ruleSet: 'extended', extensions, initialCommands });
    game.animationEnabled = false; game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        for (const layer of [DungeonLayer.DUNGEON, DungeonLayer.LIQUID, DungeonLayer.SURFACE, DungeonLayer.GAS])
            game.grid.setTerrainLayer(x, y, layer, layer === DungeonLayer.DUNGEON
                ? x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR : T.NOTHING);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 65, y: 14 });
    game.player.hp = game.player.maxHp = 10000; game.player.ticksUntilTurn = 0;
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).bindDungeonFeatureEffects(); (game as any).updateVision();
    return game;
}
function ready(source: Monster) {
    source.state = MonsterState.HUNTING; source.ticksUntilTurn = 0;
    source.behaviorFlags.add('MONST_ALWAYS_HUNTING'); source.givenUpOnScent = true;
    return source;
}
function crawler(game: Game, pose: RigidPose = 'r0') {
    const source = game.createModuleMonster(formId, { x: 12, y: 12 });
    expect(source).not.toBeNull();
    source!.spatial!.pose = pose;
    expect(source!.typeId).toBe(formId);
    expect(footprintOf(source!)).toHaveLength(4);
    return ready(source!);
}
function nativeActor(game: Game, size: 1 | 2 | 3) {
    const source = size === 1 ? new Monster(12, 12, rat) : game.createSquareMonster(rat, size, { x: 12, y: 12 })!;
    if (size === 1) { game.monsters.push(source); game.extensionRuntime!.attachCreature(source); }
    return ready(source);
}
function facts(game: Game) {
    return { extensions: json(game.extensionRuntime!.snapshot()), rng: rng.getState(), nextId: getNextEntityId(),
        tick: timeSystem.currentTick, turn: game.absoluteTurnNumber,
        player: { loc: { ...game.player.loc }, hp: game.player.hp, ticks: game.player.ticksUntilTurn },
        actors: game.monsters.map(source => ({ id: source.id, typeId: source.typeId, loc: { ...source.loc },
            spatial: source.spatial && { ...source.spatial }, body: footprintOf(source), hp: source.hp, ticks: source.ticksUntilTurn })) };
}
function world(game: Game) { const snapshot = json(game.toSnapshot()); snapshot.savedAt = 0; return snapshot; }

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

it.each(installedModuleSubsets(['giants']).flatMap(ids => ([1, 2, 3] as const).map(size => ({ ids: ['combat', ...ids], size }))))
('still commits a native $size-cell-side r0 dodge with $ids', ({ ids, size }) => {
    const game = scene(ids), source = nativeActor(game, size), body = footprintOf(source), plan = prepareActorDodge(game, source.id, 'e');
    expect(plan).not.toBeNull();
    const random = rng.getState(), id = getNextEntityId(), tick = timeSystem.currentTick;
    expect(withNativeActorDecisionScope(game, source.id, scope => commitActorDodge(game, plan!, scope))).toBe(true);
    expect(footprintOf(source)).toEqual(body.map(cell => ({ ...cell, x: cell.x + 1 })));
    expect(resource(game, source.id)).toMatchObject({ stamina: 20, regenDelayRemaining: 40,
        dodgeRemainingTicks: 40, dodgeRecoveryRemainingTicks: 80 });
    expect(source.ticksUntilTurn).toBe(80); expect(isActorDodgeProtected(game, source.id)).toBe(true);
    expect(timeSystem.currentTick).toBe(tick); expect(getNextEntityId()).toBe(id); expect(rng.getState()).toEqual(random);
});

describe.each(installedGiants)('3c explicit dodge capability on the installed 4b foundation', () => {
    it.each(poses)('rejects the valid registered %s mask before spatial fallback, resource allocation, time, IDs or RNG', pose => {
        const game = scene(), source = crawler(game, pose);
        expect(game.canStepFootprint(source, { x: source.x + 1, y: source.y })).toBe(true);
        const before = facts(game), step = vi.spyOn(game, 'canStepFootprint'), dodgeStep = vi.spyOn(game, 'canActorDodgeStep');
        for (const facing of ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const)
            expect(prepareActorDodge(game, source.id, facing)).toBeNull();
        expect(step).not.toHaveBeenCalled(); expect(dodgeStep).not.toHaveBeenCalled();
        expect(isActorDodgeProtected(game, source.id)).toBe(false);
        expect(resource(game, source.id)).toBeUndefined(); expect(facts(game)).toEqual(before);
    });

    it.each(installedGiants.flatMap(() => ['transform', 'transform-and-move', 'transform-and-rotate'] as const))
    ('rejects a prepared r0 square after native %s to a registered mask, before payment', change => {
        const game = scene(), source = nativeActor(game, 2), plan = prepareActorDodge(game, source.id, 'e');
        expect(plan).not.toBeNull();
        const formIndex = game.extensionRuntime!.nativeForms().findIndex(form => form.id === formId);
        expect(formIndex).toBeGreaterThanOrEqual(0);
        // Select the installed native form through the actual polymorph path.
        const draw = vi.spyOn(rng, 'randRange').mockReturnValue(monsters.length + formIndex + 1);
        expect((game as any).polymorphBoltTarget(source)).toBe(true); draw.mockRestore();
        expect(source.spatial).toMatchObject({ footprintId: formId, pose: 'r0' });
        if (change === 'transform-and-move') expect(game.placeCreature(source, { x: source.x + 1, y: source.y })).toBe(true);
        if (change === 'transform-and-rotate') {
            expect(game.planSquareStep(source, { kind: 'anchors', anchors: [{ ...source.loc, pose: 'r90' }] }).kind).toBe('rotate');
            expect(game.rotateSpatialActor(source, 1)).toBe(true); expect(source.spatial!.pose).toBe('r90');
        }
        // Remove incidental action delay so the live body gate is independently
        // required even when the changed source could otherwise take a turn.
        source.ticksUntilTurn = 0;
        expect(game.canStepFootprint(source, { x: source.x + 1, y: source.y })).toBe(true);
        const before = facts(game), step = vi.spyOn(game, 'canActorDodgeStep');
        expect(() => withNativeActorDecisionScope(game, source.id, scope => commitActorDodge(game, plan!, scope)))
            .toThrow('Stale dodge preparation');
        expect(step).not.toHaveBeenCalled(); expect(facts(game)).toEqual(before);
        expect(resource(game, source.id)).toBeUndefined();
    });

    it.each(poses.flatMap(pose => [false, true].map(window => ({ pose, window }))))
    ('rejects a schema-valid forged recovery/window $window on $pose and retains the entire old world', ({ pose, window }) => {
        const game = scene(), source = crawler(game, pose);
        expect(chargeNativeActorAttack(game, source.id)).toBe(true);
        const saved = json(game.toSaveSnapshot());
        // The same registered body and native stamina row load successfully
        // before adding the unsupported dodge capability.
        expect(game.loadSnapshot(saved)).toBe(true);
        const forged = json(saved), binding = game.extensionRuntime!.actorActionBinding()!;
        const ledger = forged.extensions!.modules.combat as unknown as ReturnType<typeof state>;
        const row = ledger.actors.find(actor => actor.actorId === source.id)!;
        row.dodgeRemainingTicks = window ? binding.definition.dodge.windowTicks : 0;
        row.dodgeRecoveryRemainingTicks = binding.definition.dodge.recoveryTicks;
        forged.monsters.find(actor => actor.id === source.id)!.ticksUntilTurn = row.dodgeRecoveryRemainingTicks;
        expect(() => validateProductionActorAttackState(ledger, binding.definition)).not.toThrow();
        const before = facts(game), snapshot = world(game), player = game.player, runtime = game.extensionRuntime,
            grid = game.grid, actors = game.monsters, restored = game.monsters.find(actor => actor.id === source.id)!;
        expect(game.loadSnapshot(forged)).toBe(false);
        expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); expect(game.grid).toBe(grid);
        expect(game.monsters).toBe(actors); expect(game.monsters.find(actor => actor.id === source.id)).toBe(restored);
        expect(facts(game)).toEqual(before); expect(world(game)).toEqual(snapshot);
        expect(isActorDodgeProtected(game, source.id)).toBe(false);
    });

    it.each(poses)('keeps full-mask native translation and rotation available at %s with combat installed', pose => {
        const game = scene(), source = crawler(game, pose), oldBody = footprintOf(source), at = { x: source.x + 1, y: source.y };
        expect(game.canStepFootprint(source, at)).toBe(true);
        (source as any).tryMoveTo(at.x, at.y, game);
        expect(source.loc).toEqual(at); expect(source.spatial!.pose).toBe(pose);
        expect(footprintOf(source)).toEqual(oldBody.map(cell => ({ ...cell, x: cell.x + 1 })));
        const turned = RIGID_POSES[(RIGID_POSES.indexOf(pose) + 1) % 4]!;
        expect(game.planSquareStep(source, { kind: 'anchors', anchors: [{ ...at, pose: turned }] }).kind).toBe('rotate');
        expect(game.rotateSpatialActor(source, 1)).toBe(true); expect(source.loc).toEqual(at);
        expect(source.spatial!.pose).toBe(turned); expect(source.ticksUntilTurn).toBe(source.movementSpeed);
        const vectors = { r0: [1, 0], r90: [0, 1], r180: [-1, 0], r270: [0, -1] } as const;
        const [dx, dy] = vectors[turned];
        expect(footprintOf(source)).toEqual(expect.arrayContaining(Array.from({ length: 4 }, (_, i) =>
            expect.objectContaining({ x: at.x + dx * i, y: at.y + dy * i }))));
        expect(footprintOf(source)).toHaveLength(4); expect(resource(game, source.id)).toBeUndefined();
        source.ticksUntilTurn = 0; expect(prepareActorDodge(game, source.id, 'e')).toBeNull();
    });

    it.each(installedGiants)('executes a real native NPC quarter-turn through a wait command without granting dodge', () => {
        const game = scene(), source = crawler(game, 'r90');
        for (let y = 0; y < game.grid.height; y++) for (let x = 0; x < game.grid.width; x++) game.grid.setTerrain(x, y, T.WALL);
        for (let y = 3; y <= 12; y++) for (let x = 3; x <= 12; x++) game.grid.setTerrain(x, y, T.FLOOR);
        for (let x = 13; x <= 22; x++) game.grid.setTerrain(x, 7, T.FLOOR);
        commitCreatureAnchor(source, { x: 7, y: 7 }); commitCreatureAnchor(game.player, { x: 21, y: 7 });
        const nativeRotate = game.rotateSpatialActor.bind(game), turns: { before: { x: number; y: number }; after: { x: number; y: number }; cost: number }[] = [];
        const rotate = vi.spyOn(game, 'rotateSpatialActor').mockImplementation((actor, direction) => {
            const before = { ...actor.loc }, result = nativeRotate(actor, direction);
            if (result) turns.push({ before, after: { ...actor.loc }, cost: actor.ticksUntilTurn });
            return result;
        });
        while (logger.pendingAcknowledgment) logger.acknowledgeNext();
        game.executeCommand('wait');
        expect(rotate).toHaveBeenCalledTimes(1); expect(rotate.mock.calls[0]![0]).toBe(source);
        expect(turns).toHaveLength(1); expect(turns[0]!.before).toEqual(turns[0]!.after);
        expect(turns[0]!.cost).toBe(source.movementSpeed); expect(source.spatial!.pose).toBe('r0');
        expect(state(game).scheduler.bundles).toEqual([]); expect(resource(game, source.id)).toBeUndefined();
        expect(isActorDodgeProtected(game, source.id)).toBe(false);
    });

    it.each(poses)('charges and regenerates the default all-actor native stamina policy for %s without granting dodge', pose => {
        const game = scene(), source = crawler(game, pose), binding = game.extensionRuntime!.actorActionBinding()!;
        expect(binding.definition.nativeProfiles.some(profile => profile.monsterId === source.typeId)).toBe(false);
        const profile = binding.definition.profiles.find(value => value.id === binding.definition.playerProfileId)!;
        const policy = binding.definition.resourcePolicies.find(value => value.id === profile.resourcePolicyId)!;
        commitCreatureAnchor(game.player, { x: Math.max(...footprintOf(source).map(cell => cell.x)) + 1, y: source.y });
        source.accuracy = 10000; (game as any).updateVision();
        const attack = vi.spyOn(CombatSystem, 'attack'), hp = game.player.hp;
        source.takeNativeDecision(game);
        expect(attack.mock.calls.filter(call => call[0] === source)).toHaveLength(1); expect(game.player.hp).toBeLessThan(hp);
        expect(resource(game, source.id)).toMatchObject({ profileId: profile.id, stamina: policy.initialStamina - policy.nativeAttackCost,
            regenDelayRemaining: policy.regenDelayTicks, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        const scheduler = productionActorActionScheduler(game)!, random = rng.getState(), id = getNextEntityId();
        scheduler.advanceActionTime(policy.regenDelayTicks - 1);
        expect(resource(game, source.id)).toMatchObject({ stamina: 22, regenDelayRemaining: 1, regenRemainder: 0 });
        scheduler.advanceActionTime(1 + policy.regenPerTickDenominator - 1);
        expect(resource(game, source.id)).toMatchObject({ stamina: 22, regenDelayRemaining: 0, regenRemainder: 19 });
        scheduler.advanceActionTime(1);
        expect(resource(game, source.id)).toMatchObject({ stamina: 23, regenRemainder: 0, dodgeRemainingTicks: 0, dodgeRecoveryRemainingTicks: 0 });
        scheduler.advanceActionTime(policy.regenPerTickDenominator);
        expect(resource(game, source.id).stamina).toBe(policy.staminaCapacity);
        expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
        source.ticksUntilTurn = 0;
        expect(prepareActorDodge(game, source.id, 'e')).toBeNull(); expect(isActorDodgeProtected(game, source.id)).toBe(false);
        expect(state(game).scheduler.bundles).toEqual([]);
    });
});
