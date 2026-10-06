import { installRecordingScene } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { DungeonLayer, TerrainType as T } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { logger } from '../../../../engine/Systems/Logger';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { registryFromDescriptors } from '../../../descriptor';
import { createCombatModuleFromPack } from '../module';
import { loadCombatDefinitionPack } from '../definitions';
import { loadCombatPack } from '../schema';
import locale from '../locales/zh_CN.json';
import * as catalog from '../../../catalog';
import { placeCombatTelegraphFixture } from '../ui/diagnostics';
import { readPublicCombatTelegraphs } from '../../../../ui/combatDrawing';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
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
function scene(seed = 73073) { const game = start(seed); arena(game); return game; }

const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const resource = (game: Game, id = game.player.id) => state(game).actors.find(a => a.actorId === id)!;
const parry = (facing = 'e') => JSON.stringify({ module: 'combat', action: 'parry', payload: { facing } });
const attack = () => JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId: 'fixture.slash', facing: 'e' } });
function rat(game: Game) {
    const source = new Monster(21, 15, monsters.find(m => m.id === 'rat')! as MonsterData);
    source.state = MonsterState.HUNTING; source.hp = source.maxHp = 1000; source.regenTurns = 0;
    game.monsters.push(source); (game as any).updateVision();
    // Keep the constructor's native readiness. Never force elapsed or a boundary.
    return source;
}
function configuredSlash(windupTicks: number) {
    const data = structuredClone(loadCombatDefinitionPack());
    data.attacks.find(a => a.id === 'fixture.slash')!.windupTicks = windupTicks;
    const pack = loadCombatPack(data, locale), combat = createCombatModuleFromPack(pack);
    const registry = registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(d => d.id === 'combat'
        ? { ...d, create: () => createCombatModuleFromPack(pack), rules: combat.rules } : d));
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
}
function warning(game: Game, id: number) {
    const result = readPublicCombatTelegraphs(game).find(w => w.sourceEntityId === id)!;
    expect(result).toBeDefined();
    expect(result.cells).toContainEqual({ ...game.player.loc });
    expect(game.isInputLocked()).toBe(false);
    return game.actorActions!.bundles.find(b => b.decisionOwnerId === id)!.subactions[0]!;
}
function mechanical(game: Game) {
    const snapshot = json(game.toSnapshot()); snapshot.savedAt = 0;

    return snapshot;
}
afterEach(() => { vi.restoreAllMocks(); acknowledge(); });
describe('3d visible decisions use ordinary commands and real scheduler time', () => {
    it('parries the first visible default slash warning with no artificial clock advance', () => {
        const game = scene(), source = rat(game);
        acknowledge(); game.executeCommand('wait');
        expect(warning(game, source.id).phaseRemainingTicks).toBe(50);
        const defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried'), hp = game.player.hp, sourceHp = source.hp;
        acknowledge(); game.executeCommand('ext:command', parry());
        expect(defended).toHaveBeenCalledExactlyOnceWith(source.id, game.player.id, game.depth);
        expect(game.player.hp).toBe(hp); expect(source.hp).toBe(sourceHp);
        expect(resource(game).poise).toBe(12); expect(game.isInputLocked()).toBe(false);
    });
    it('normal player slash reveals an ogre-profile windup before any strike, with original fifty-tick readiness', () => {
        const game = scene();
        const source = game.createSquareMonster({ ...monsters.find(m => m.id === 'ogre')!, id: 'rat', hp: 10000 } as MonsterData, 2, { x: 21, y: 15 })!;
        source.state = MonsterState.HUNTING; source.ticksUntilTurn = 50; source.regenTurns = 0;
        (game as any).updateVision();
        const hp = game.player.hp;
        acknowledge(); game.executeCommand('ext:command', attack());
        expect(warning(game, source.id).phaseRemainingTicks).toBe(10);
        expect(game.player.hp).toBe(hp);
        const sourceHp = source.hp, defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried');
        acknowledge(); game.executeCommand('ext:command', parry('e'));
        expect(defended).toHaveBeenCalledExactlyOnceWith(source.id, game.player.id, game.depth);
        expect(game.player.hp).toBe(hp); expect(source.hp).toBe(sourceHp);
    });
    it.each([73073, 73074, 73075])('DEV ogre first visible warning can be parried after a real paid setup attack, seed %s', seed => {
        const game = scene(seed), execute = vi.spyOn(game, 'executeCommand'), fixture = placeCombatTelegraphFixture(game);
        const source = game.monsters.find(m => m.id === fixture.sourceEntityId)!;
        expect(fixture.attack).toBe('parryable'); expect(fixture.sourceInitialTicks).toBe(50);
        expect(fixture.setup).toMatchObject({ action: 'attack', attackId: 'fixture.slash', cost: 4, durationTicks: 90 });
        expect(fixture.setupHpLoss).toBe(0);
        expect(source.typeId).toBe('rat'); // Existing fan-edge binding; ogre stats and native traits retained.
        expect(source.hasAbility('MA_ATTACKS_STAGGER')).toBe(true);
        expect(execute).toHaveBeenNthCalledWith(2, 'ext:command', JSON.stringify({ module: 'combat', action: 'attack',
            payload: { attackId: 'fixture.slash', facing: fixture.setup.facing } }));
        expect(fixture.telegraphs[0]).toMatchObject({ parryable: true, remainingTicks: 10 });
        expect(warning(game, source.id).phaseRemainingTicks).toBe(10);
        const contact = game.meleeContact(source, game.player)!;
        const directions: Record<string, string> = { '0,-1': 'n', '1,-1': 'ne', '1,0': 'e', '1,1': 'se', '0,1': 's', '-1,1': 'sw', '-1,0': 'w', '-1,-1': 'nw' };
        const facing = directions[`${Math.sign(contact.from.x-contact.to.x)},${Math.sign(contact.from.y-contact.to.y)}`];
        const hp = game.player.hp, sourceHp = source.hp, defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried');
        acknowledge(); game.executeCommand('ext:command', parry(facing));
        expect(defended).toHaveBeenCalledExactlyOnceWith(source.id, game.player.id, game.depth);
        expect(game.player.hp).toBe(hp); expect(source.hp).toBe(sourceHp);
        for (const name of ['toSnapshot', 'toSaveSnapshot', 'exportRecording'] as const) expect(() => game[name]()).toThrow('fixture');
    });
    it('DEV setup leaves ordinary friendly-fire confirmation pending without paying or advancing time', () => {
        const game = scene();
        const create = game.createSquareMonster.bind(game);
        vi.spyOn(game, 'createSquareMonster').mockImplementation((...args) => {
            const source = create(...args);
            if (source) { source.isAlly = true; source.setStatusDuration('discordant', 1000); }
            return source;
        });
        game.onCommandConfirmRequest = vi.fn();
        game.onConfirmRequest = () => { throw new Error('Diagnostic must not auto-confirm'); };
        const hp = game.player.hp;
        const fixture = placeCombatTelegraphFixture(game);
        expect(fixture.setupPendingConfirmation).toBe(true);
        expect(game.pendingCommandConfirmation).not.toBeNull();
        expect(fixture.telegraphs).toEqual([]); expect(game.player.hp).toBe(hp);
        expect(game.monsters.find(m => m.id === fixture.sourceEntityId)!.ticksUntilTurn).toBe(50);
        expect(resource(game)?.stamina ?? 24).toBe(24);
        game.resolveCommandDecision(game.pendingCommandConfirmation!.token, false);
        expect(resource(game)?.stamina ?? 24).toBe(24);
        expect(game.monsters.find(m => m.id === fixture.sourceEntityId)!.ticksUntilTurn).toBe(50);
    });
    it('diagnostic ogre stomp remains non-parryable even while protection is still active', () => {
        const game = scene(), fixture = placeCombatTelegraphFixture(game, 'stomp');
        const source = game.monsters.find(m => m.id === fixture.sourceEntityId)!;
        const contact = game.meleeContact(source, game.player)!;
        const directions: Record<string, string> = { '0,-1': 'n', '1,-1': 'ne', '1,0': 'e', '1,1': 'se', '0,1': 's', '-1,1': 'sw', '-1,0': 'w', '-1,-1': 'nw' };
        const facing = directions[`${Math.sign(contact.from.x-contact.to.x)},${Math.sign(contact.from.y-contact.to.y)}`];
        const child = warning(game, source.id); expect(child.phaseRemainingTicks).toBe(50);
        const scheduler = productionActorActionScheduler(game)!, advance = scheduler.advanceActionTime.bind(scheduler);
        const trace: { delta: number; window: number; remaining: number }[] = [];
        vi.spyOn(scheduler, 'advanceActionTime').mockImplementation(delta => {
            advance(delta); trace.push({ delta, window: resource(game).parryRemainingTicks, remaining: child.phaseRemainingTicks });
        });
        const defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried'), hp = game.player.hp;
        acknowledge(); game.executeCommand('ext:command', parry(facing));
        expect(trace[0]).toEqual({ delta: 50, window: 10, remaining: 0 });
        // Initial reproduction deliberately expected success and failed at this
        // exact boundary. Data inspection proved stomp has parryable:false;
        // preserving that rule is the corrected premise, not a timing workaround.
        expect(defended).not.toHaveBeenCalled(); expect(game.player.hp).toBeLessThan(hp);
        expect(resource(game).poise).toBe(7);
    });
    it.each([59, 60, 61])('configured parryable warning remaining %s obeys the exclusive window through real commands', remaining => {
        configuredSlash(remaining);
        const game = scene(), source = rat(game);
        acknowledge(); game.executeCommand('wait');
        expect(warning(game, source.id).phaseRemainingTicks).toBe(remaining);
        const defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried');
        acknowledge(); game.executeCommand('ext:command', parry());
        expect(defended).toHaveBeenCalledTimes(remaining < 60 ? 1 : 0);
        expect(resource(game)).toMatchObject({ parryRemainingTicks: 0, parryFacing: null, parryRecoveryRemainingTicks: 0 });
        expect(() => game.toSaveSnapshot()).not.toThrow();
    });
    it.each([59, 60, 61])('native NPC sees the same configured remaining %s and chooses defense only within the exclusive window', remaining => {
        // Constructor readiness is 100. A data-defined 159/160/161 windup
        // naturally presents 59/60/61 at its native decision; no timer edits.
        configuredSlash(100 + remaining);
        const game = scene(), source = rat(game), defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried');
        acknowledge(); game.executeCommand('ext:command', attack());
        expect(defended).toHaveBeenCalledTimes(remaining < 60 ? 1 : 0);
        if (remaining < 60) expect(defended).toHaveBeenCalledWith(game.player.id, source.id, game.depth);
        expect(() => game.toSaveSnapshot()).not.toThrow();
    });
    it('opposite-facing defense fails against the otherwise parryable first visible slash', () => {
        const game = scene(), source = rat(game); acknowledge(); game.executeCommand('wait'); warning(game, source.id);
        const defended = vi.spyOn(game.extensionRuntime!, 'notifyActorParried');
        acknowledge(); game.executeCommand('ext:command', parry('w'));
        expect(defended).not.toHaveBeenCalled(); expect(resource(game).parryRemainingTicks).toBe(0);
    });
    it('visible-warning command success survives save/load, exact replay checkpoints and bidirectional seek', () => {
        installRecordingScene((game) => {
            if (game.extensionRuntime?.actorActionBinding()) { arena(game); rat(game); }
        });
        const game = start(); acknowledge(); game.executeCommand('wait');
        const first = mechanical(game), saved = json(game.toSaveSnapshot()), random = rng.getState();
        warning(game, game.monsters[0]!.id);
        acknowledge(); game.executeCommand('ext:command', parry());
        const second = mechanical(game), recording = json(game.exportRecording());
        const loaded = createHeadlessGame(771, 'test'); expect(loaded.loadSnapshot(saved)).toBe(true); loaded.animationEnabled = false;
        expect(rng.getState()).toEqual(random);
        acknowledge(); loaded.executeCommand('ext:command', parry()); expect(mechanical(loaded)).toEqual(second);
        expect(loaded.exportRecording().events).toEqual(recording.events);
        const replay = createHeadlessGame(772, 'test'); expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
        for (const expected of [first, second]) { replay.replayStep(true); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(expected); }
        for (const index of [1, 2, 1, 2]) { replay.replaySeek(index); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(index === 1 ? first : second); }
    });
});
