import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { Game } from '../../../../engine/Core/Game';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { EnvironmentManager } from '../../../../engine/Environment/Gas';
import { WaypointSystem } from '../../../../engine/Map/WaypointMap';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { physicalContactOf } from '../../../../engine/Combat/BodyCombat';
import { MonsterState, type Monster, type MonsterData } from '../../../../entities/Monster';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import monsters from '../../../../data/monsters.json';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { readCreatureBirth } from '../../../birth';
import type { ProductionActorAttackState } from '../../../actorActions';
import { loadCombatDefinitionPack } from '../definitions';
import { createCombatModuleFromPack } from '../module';
import { loadCombatPack } from '../schema';
import locale from '../locales/zh_CN.json';
import type { CombatPack } from '../types';

const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
const wait = (game: Game) => { acknowledge(); game.executeCommand('wait'); };
const attack = (facing = 'e') => JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId: 'fixture.double-thrust', facing } });
function start(ids = ['combat'], seed = 73063, mode: 'normal' | 'test' = 'test'): Game {
    const game = createHeadlessGame(seed, 'test'), registry = catalog.createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    game.startNewGame({ seed, mode, ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false;
    return game;
}
function mechanical(game: Game) {
    const snapshot = json(game.toSnapshot());
    snapshot.savedAt = 0;
    snapshot.run.recordedInputEvents = [];
    snapshot.run.recordedInputIndex = 0;
    return snapshot;
}
function phase(game: Game, actorId: number) {
    const bundle = state(game).scheduler.bundles.find(value => value.decisionOwnerId === actorId);
    const sub = bundle?.subactions[0];
    return sub?.phases[sub.phaseIndex]?.kind;
}
function arena(game: Game) {
    game.animationEnabled = false;
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x === 0 || y === 0 || x === game.grid.width - 1 || y === game.grid.height - 1 ? T.WALL : T.FLOOR);
        game.grid.getCell(x, y)!.machineNumber = 0;
    }
    commitCreatureAnchor(game.player, { x: 10, y: 12 });
    game.environment = new EnvironmentManager(game.grid); game.waypoints = new WaypointSystem();
    (game as any).machineCells = new Set(); (game as any).bindDungeonFeatureEffects();
}
/** Explicit foundation fixture: each body is born through the checked Game API.
 * It is not claimed as naturally generated giants content. */
function squarePair(game: Game, sourceSize: 2 | 3, targetSize: 2 | 3) {
    arena(game);
    const source = game.createSquareMonster(monsters.find(m => m.id === 'kobold')! as MonsterData, sourceSize, { x: 12, y: 12 })!;
    const target = game.createSquareMonster(monsters.find(m => m.id === 'ogre')! as MonsterData, targetSize, { x: 12 + sourceSize, y: 12 })!;
    source.isAlly = true; source.state = MonsterState.HUNTING; source.ticksUntilTurn = 1;
    source.accuracy = 1000; source.damageString = '2-2';
    target.state = MonsterState.HUNTING; target.ticksUntilTurn = 10000;
    target.hp = target.maxHp = 1000; target.defense = -1000; target.regenTurns = 0;
    (game as any).updateVision();
    return { source, target };
}
/** Generic discovery retains other installed descriptors; the combat factory and
 * its rules fingerprint are overridden together, never another module's data. */
function configuredCombat(change: (pack: CombatPack) => void) {
    const data = structuredClone(loadCombatDefinitionPack()); change(data);
    const pack = loadCombatPack(data, locale), combat = createCombatModuleFromPack(pack);
    const registry = registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(descriptor => descriptor.id === 'combat'
        ? { ...descriptor, create: () => createCombatModuleFromPack(pack), rules: combat.rules }
        : descriptor));
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    return pack;
}

function longPhases(pack: CombatPack) {
    const definition = pack.attacks.find(value => value.id === 'fixture.double-thrust')!;
    definition.windupTicks = 150; definition.segments[1]!.delayTicks = 130; definition.recoveryTicks = 150;
}

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('3b production square actions, native effects and persistence', () => {
    it.each([[2, 2], [2, 3], [3, 2], [3, 3]] as const)(
        '%s-square source hits a %s-square target once per segment through true native effects', (sourceSize, targetSize) => {
            configuredCombat(longPhases);
            const game = start(), { source, target } = squarePair(game, sourceSize, targetSize);
            // Ask the existing native hook pipeline for facts; attack/damage/effects remain real.
            vi.spyOn(source.extensionHooks!, 'wantsPhysicalResolution').mockReturnValue(true);
            source.abilityFlags.add('MA_POISONS');
            const native = vi.spyOn(CombatSystem, 'attack'), damage = vi.spyOn(target, 'takeDamage');
            const poison = vi.spyOn(target, 'addPoison'), facts = vi.spyOn(source.extensionHooks!, 'physicalResolved');
            const contacts: { from: { x: number; y: number }; to: { x: number; y: number } }[] = [];
            const original = source.extensionHooks!.beforeAttack;
            vi.spyOn(source.extensionHooks!, 'beforeAttack').mockImplementation((...args) => {
                contacts.push({ from: { ...physicalContactOf(source) }, to: { ...physicalContactOf(target) } });
                return original?.(...args);
            });
            const sourceAnchor = { ...source.loc }, targetAnchor = { ...target.loc };
            wait(game);
            expect(phase(game, source.id)).toBe('windup');
            const firstCells = state(game).actions[0]!.subactions[0]!.lockedCells;
            expect(firstCells.filter(cell => footprintOf(target).some(p => p.x === cell.x && p.y === cell.y))).toHaveLength(Math.min(sourceSize, targetSize));
            expect(native).not.toHaveBeenCalled();
            for (let step = 0; step < 4 && phase(game, source.id) === 'windup'; step++) wait(game);
            expect(phase(game, source.id)).toBe('inter-segment');
            expect(native).toHaveBeenCalledTimes(1); expect(facts).toHaveBeenCalledTimes(1);
            expect(damage.mock.calls.filter(call => call[4] === 'physical')).toHaveLength(1); expect(poison).toHaveBeenCalledTimes(1);
            const laterCells = state(game).actions[0]!.subactions[0]!.lockedCells;
            expect(laterCells.filter(cell => footprintOf(target).some(p => p.x === cell.x && p.y === cell.y))).toHaveLength(2 * Math.min(sourceSize, targetSize));
            for (let step = 0; step < 4 && phase(game, source.id) === 'inter-segment'; step++) wait(game);
            expect(phase(game, source.id)).toBe('recovery');
            expect(native).toHaveBeenCalledTimes(2); expect(facts).toHaveBeenCalledTimes(2);
            expect(damage.mock.calls.filter(call => call[4] === 'physical')).toHaveLength(2); expect(poison).toHaveBeenCalledTimes(2);
            expect(poison.mock.calls.every(call => call[0] === 2 && call[1] === 1)).toBe(true);
            expect(contacts).toHaveLength(2);
            expect(contacts).toEqual([
                { from: { x: sourceAnchor.x + sourceSize - 1, y: sourceAnchor.y, zoneId: 'body' }, to: { x: targetAnchor.x, y: targetAnchor.y, zoneId: 'body' } },
                { from: { x: sourceAnchor.x + sourceSize - 2, y: sourceAnchor.y, zoneId: 'body' }, to: { x: targetAnchor.x, y: targetAnchor.y, zoneId: 'body' } },
            ]);
            expect(source.loc).toEqual(sourceAnchor); expect(target.loc).toEqual(targetAnchor);
            expect(state(game).actors.find(a => a.actorId === source.id)!.stamina).toBe(18);
            expect(state(game).nextActionId).toBe(2);
        });

    it.each([2, 3] as const)('real acid degradation and physical facts happen twice across a %s-square target, never per covered cell', size => {
        const game = start(); arena(game);
        const target = game.createSquareMonster(monsters.find(m => m.id === 'rat')! as MonsterData, size, { x: 14, y: 12 })!;
        target.state = MonsterState.HUNTING; target.ticksUntilTurn = 10000; target.hp = target.maxHp = 1000; target.defense = -1000;
        target.behaviorFlags.add('MONST_DEFEND_DEGRADE_WEAPON');
        commitCreatureAnchor(game.player, { x: 13, y: 12 }); (game as any).updateVision();
        const weapon = ItemLoader.spawnWeapon('spear', -1, -1)!;
        weapon.strengthRequired = game.player.effectiveStrength; weapon.damage = '2-2'; weapon.enchantment = 0;
        game.player.inventory.addItem(weapon); game.player.equippedWeapon = weapon;
        vi.spyOn(game.player.extensionHooks!, 'wantsPhysicalResolution').mockReturnValue(true);
        const facts = vi.spyOn(game.player.extensionHooks!, 'physicalResolved'), damage = vi.spyOn(target, 'takeDamage');
        game.onCommandConfirmRequest = () => {};
        acknowledge(); game.executeCommand('ext:command', attack());
        expect(game.pendingCommandConfirmation).not.toBeNull();
        expect(weapon.enchantment).toBe(0); expect(facts).not.toHaveBeenCalled();
        game.resolveCommandDecision(game.pendingCommandConfirmation!.token, true);
        expect(weapon.enchantment).toBe(-2); expect(damage).toHaveBeenCalledTimes(2); expect(facts).toHaveBeenCalledTimes(2);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual([true]);
        expect(state(game).actors.find(a => a.actorId === game.player.id)!.stamina).toBe(21); // 3c recovery restores three points after the single fee
    });

    it.each([2, 3] as const)('%s-square fixture rebinds every phase, replays each command, seeks and continues an identical saved prefix', size => {
        configuredCombat(longPhases);
        const original = Game.prototype.startNewGame;
        vi.spyOn(Game.prototype, 'startNewGame').mockImplementation(function (this: Game, ...args) {
            original.apply(this, args);
            if (this.extensionRuntime?.actorActionBinding()) squarePair(this, size, size);
        });
        const game = start(), sourceId = game.monsters.find(m => m.isAlly)!.id;
        const expected: ReturnType<typeof mechanical>[] = [], checkpoints = new Map<string, { snapshot: ReturnType<Game['toSaveSnapshot']>; index: number }>();
        for (let index = 0; index < 4; index++) {
            wait(game); expected.push(mechanical(game));
            const current = phase(game, sourceId);
            if (current && !checkpoints.has(current)) checkpoints.set(current, { snapshot: json(game.toSaveSnapshot()), index });
        }
        expect([...checkpoints.keys()]).toEqual(['windup', 'inter-segment', 'recovery']);
        const recording = json(game.exportRecording());
        for (const { snapshot, index } of checkpoints.values()) {
            const loaded = createHeadlessGame(8801, 'test');
            expect(loaded.loadSnapshot(snapshot)).toBe(true); loaded.animationEnabled = false;
            expect(mechanical(loaded)).toEqual(expected[index]);
            for (let next = index + 1; next < expected.length; next++) {
                wait(loaded); expect(mechanical(loaded)).toEqual(expected[next]);
            }
            expect(loaded.exportRecording().events).toEqual(recording.events);
        }
        const replay = createHeadlessGame(8802, 'test');
        expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
        for (const snapshot of expected) {
            replay.replayStep(true); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(snapshot);
        }
        for (const index of [1, 3, 2, 4]) {
            replay.replaySeek(index); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(expected[index - 1]);
        }
        expect(rng.getState()).toEqual(expected[expected.length - 1]!.rngState);
    });
});

/** Read-only cardinal route choice; state changes use real move/search/stairs
 * commands only. This is local test code, with no imports from another module. */
function naturalStep(game: Game, goal: (x: number, y: number) => boolean, exclude?: Monster) {
    const key = (x: number, y: number) => y * game.grid.width + x;
    const start = { ...game.player.loc }, queue = [start];
    const previous = new Map<number, { x: number; y: number } | null>([[key(start.x, start.y), null]]);
    let target: { x: number; y: number } | undefined;
    for (let index = 0; index < queue.length; index++) {
        const at = queue[index]!;
        if (goal(at.x, at.y)) { target = at; break; }
        for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
            const next = { x: at.x + dx, y: at.y + dy }, cell = game.grid.getCell(next.x, next.y);
            if (!cell || previous.has(key(next.x, next.y)) || !(cell.isPassable || [T.DOOR, T.SECRET_DOOR].includes(cell.terrain))
                || cell.layers.some(layer => [T.LAVA, T.WATER_DEEP, T.CHASM].includes(layer))
                || (exclude && footprintOf(exclude).some(p => p.x === next.x && p.y === next.y))) continue;
            previous.set(key(next.x, next.y), at); queue.push(next);
        }
    }
    if (!target) throw new Error('No safe route in natural combat acceptance fixture');
    let at = target, next = target;
    while (previous.get(key(at.x, at.y))) { next = at; at = previous.get(key(at.x, at.y))!; }
    acknowledge();
    if (game.grid.getCell(next.x, next.y)!.terrain === T.SECRET_DOOR) game.executeCommand('search');
    else if (next.x === start.x && next.y === start.y) game.executeCommand('stairs_down');
    else game.executeCommand('move', { x: next.x - start.x, y: next.y - start.y });
    if (game.pendingCommandConfirmation) game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
}

describe('3b configured combat with the installed 3x3 form',()=>{
    it.each(catalog.getInstalledModuleDescriptors().filter(module=>module.id==='giants'))('publishes the declared 3x3 species and persists its real phased native attack',descriptor=>{
        const form=descriptor.create().nativeForms!.find(value=>value.size===3)!;
        expect(form).toBeDefined();
        const rules=json(descriptor.rules);
        configuredCombat(pack=>{
            pack.nativeProfiles=[{monsterId:form.id,profileId:'combat.follow-thrust'}];
            const definition=pack.attacks.find(value=>value.id==='fixture.double-thrust')!;
            definition.windupTicks=150;definition.segments[1]!.delayTicks=130;definition.recoveryTicks=150;
        });
        const game=start(['combat','giants']);arena(game);game.player.hp=game.player.maxHp=1000;
        const source=game.createModuleMonster(form.id,{x:11,y:12})!;
        expect(source).not.toBeNull();expect(footprintOf(source)).toHaveLength(9);expect(source.maxHp).toBe(form.hp);
        expect(readCreatureBirth(source)?.creationReason).toBe('scripted');
        source.state=MonsterState.HUNTING;source.ticksUntilTurn=1;(game as any).updateVision();
        const native=vi.spyOn(CombatSystem,'attack');const hp=game.player.hp;
        wait(game);expect(phase(game,source.id)).toBe('windup');
        const saved=json(game.toSaveSnapshot());const expected=mechanical(game);
        const restored=createHeadlessGame(729,'test');expect(restored.loadSnapshot(saved)).toBe(true);restored.animationEnabled=false;
        expect(mechanical(restored)).toEqual(expected);
        wait(restored);expect(phase(restored,source.id)).toBe('inter-segment');
        wait(restored);expect(phase(restored,source.id)).toBe('recovery');
        expect(native.mock.calls.filter(call=>call[0].id===source.id)).toHaveLength(2);
        expect(restored.player.hp).toBeLessThan(hp);
        expect(state(restored).actors.find(actor=>actor.actorId===source.id)!.stamina).toBe(18);
        expect(catalog.getInstalledModuleDescriptors().find(module=>module.id===descriptor.id)!.rules).toEqual(rules);
    });
});

describe('3b configured combat with an actual naturally generated optional square actor', () => {
    it.each(catalog.getInstalledModuleDescriptors().filter(module => module.id === 'giants'))('seed 7306 D3 ridgeback uses telegraphed native segments, each phase survives save/load, and the natural command recording replays', giantDescriptor => {
        expect(giantDescriptor).toBeDefined();
        const form = giantDescriptor.create().nativeForms!.find(value => value.size === 2)!;
        expect(form).toBeDefined();
        const originalGiantRules = json(giantDescriptor.rules);
        configuredCombat(pack => {
            pack.nativeProfiles = [{ monsterId: form.id, profileId: 'combat.follow-thrust' }];
            const definition = pack.attacks.find(value => value.id === 'fixture.double-thrust')!;
            definition.windupTicks = 150; definition.segments[1]!.delayTicks = 130; definition.recoveryTicks = 150;
        });
        const game = start(['combat', 'giants'], 7306, 'normal');
        for (let command = 0; command < 600 && game.depth < 3 && !game.isGameOver; command++) {
            const stairs = game.levelSeeds[game.depth - 1]!.downStairsLoc;
            naturalStep(game, (x, y) => x === stairs.x && y === stairs.y);
        }
        expect(game.depth).toBe(3); expect(game.isGameOver).toBe(false);
        const boss = game.monsters.find(monster => monster.typeId === form.id)!;
        expect(boss).toBeDefined(); expect(footprintOf(boss)).toHaveLength(4);
        expect(readCreatureBirth(boss)).toMatchObject({ creationReason: 'natural', initiallyHostile: true, originalMonsterType: form.id });
        expect(boss.maxHp).toBe(form.hp);
        expect(state(game).actions).toEqual([]);
        // The encounter and approach remain natural. Only the explicitly supplied
        // combat definition/binding differs from the installed defaults.
        for (let command = 0; command < 200 && !phase(game, boss.id) && !game.isGameOver; command++) {
            const body = footprintOf(boss);
            naturalStep(game, (x, y) => body.some(p => Math.abs(p.x - x) + Math.abs(p.y - y) === 1), boss);
        }
        expect(game.isGameOver).toBe(false); expect(phase(game, boss.id)).toBe('windup');
        const first = state(game).actions.find(action => state(game).scheduler.bundles.some(bundle => bundle.actionId === action.actionId && bundle.decisionOwnerId === boss.id))!;
        expect(first.subactions[0]!.attackId).toBe('fixture.double-thrust');
        expect(first.subactions[0]!.lockedCells).toContainEqual({ ...game.player.loc });
        const native = vi.spyOn(game, 'resolveActorNativeMelee');
        const hpBefore = game.player.hp;
        const snapshots: { phase: string; snapshot: ReturnType<Game['toSaveSnapshot']> }[] = [];
        for (let commands = 0; commands < 8; commands++) {
            const current = phase(game, boss.id);
            if (!current) break;
            if (!snapshots.some(snapshot => snapshot.phase === current)) snapshots.push({ phase: current, snapshot: json(game.toSaveSnapshot()) });
            if (current === 'recovery') break;
            wait(game);
        }
        expect(snapshots.map(snapshot => snapshot.phase)).toEqual(['windup', 'inter-segment', 'recovery']);
        expect(phase(game, boss.id)).toBe('recovery'); expect(game.isGameOver).toBe(false);
        expect(native.mock.calls.filter(call => call[1].id === boss.id && call[2].id === game.player.id)).toHaveLength(2);
        expect(game.player.hp).toBeLessThan(hpBefore);
        expect(state(game).actors.find(actor => actor.actorId === boss.id)!.stamina).toBe(19); // 20 ticks of 3c recovery have elapsed
        const final = mechanical(game), recording = json(game.exportRecording());
        for (const checkpoint of snapshots) {
            const loaded = createHeadlessGame(9017, 'test');
            expect(loaded.loadSnapshot(checkpoint.snapshot)).toBe(true); loaded.animationEnabled = false;
            expect(phase(loaded, boss.id)).toBe(checkpoint.phase);
            expect(state(loaded)).toEqual(checkpoint.snapshot.extensions!.modules.combat as unknown as ProductionActorAttackState);
            expect(rng.getState()).toEqual(checkpoint.snapshot.rngState);
            for (let index = checkpoint.snapshot.run.recordedInputEvents.length; index < recording.events.length; index++) wait(loaded);
            expect(mechanical(loaded)).toEqual(final);
            expect(loaded.exportRecording().events).toEqual(recording.events);
        }
        const replay = createHeadlessGame(9018, 'test');
        expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
        while (replay.replayCursor < recording.events.length) {
            replay.replayStep(true); expect(replay.replayError).toBeNull();
        }
        expect(mechanical(replay)).toEqual(final); expect(rng.getState()).toEqual(final.rngState);
        const windupIndex = snapshots[0]!.snapshot.run.recordedInputEvents.length;
        replay.replaySeek(windupIndex); expect(replay.replayError).toBeNull(); expect(phase(replay, boss.id)).toBe('windup');
        replay.replaySeek(recording.events.length); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(final);
        expect(giantDescriptor.rules).toEqual(originalGiantRules);
        expect(loadCombatDefinitionPack().nativeProfiles.some(binding => binding.monsterId === form.id)).toBe(false);
    }, 120000);
});
