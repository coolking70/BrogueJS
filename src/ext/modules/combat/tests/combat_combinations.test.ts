import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { prepareActorDodgeCommand, prepareActorParryCommand, preparePhasedAttackCommand } from '../../../../engine/Core/PhasedAttackProduction';
import { worldRestUnavailable } from '../../../../engine/Core/WorldRestProduction';
import { canDirectlySeeMonster } from '../../../../engine/UI/MonsterVisibility';
import { getNextEntityId } from '../../../../entities/Creature';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { createExtensionRegistry, getInstalledModuleDescriptors } from '../../../catalog';
import { readCreatureBirth } from '../../../birth';
import type { ExtensionManifest } from '../../../types';

const json = <V>(value: V): V => JSON.parse(JSON.stringify(value));
const last = <V>(values: readonly V[]): V => values[values.length - 1]!;
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
const state = (game: Game) => game.extensionRuntime!.actorActionBinding()!.state;
const command = (action: string, payload: object) => JSON.stringify({ module: 'combat', action, payload });
const directions = [
    { facing: 'n', x: 0, y: -1 }, { facing: 'e', x: 1, y: 0 },
    { facing: 's', x: 0, y: 1 }, { facing: 'w', x: -1, y: 0 },
    { facing: 'ne', x: 1, y: -1 }, { facing: 'se', x: 1, y: 1 },
    { facing: 'sw', x: -1, y: 1 }, { facing: 'nw', x: -1, y: -1 },
] as const;

// Discover the powerset so physically removing another module also removes its
// cases. No optional module's implementation, definitions or tests are imported.
const optionalIds = getInstalledModuleDescriptors().map(module => module.id).filter(id => id !== 'combat');
const subsets = optionalIds.reduce<string[][]>((sets, id) => [...sets, ...sets.map(ids => [...ids, id])], [['combat']]);

function start(ids: string[]): Game {
    const game = createHeadlessGame(7397, 'test'), registry = createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
        ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
    // Untouched production map, entities, resources, catalogs, placement and RNG.
    // The shipped attack IDs happen to be named fixture.*; no fixture pack or
    // arena, teleport, injected monster, HP edit or startNewGame override is used.
    game.startNewGame({ seed: 7397, mode: 'normal', ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false; game.onConfirmRequest = () => true;
    return game;
}
function mechanical(game: Game) {
    const snapshot = json(game.toSnapshot()); snapshot.savedAt = 0;
    // Replay intentionally owns a different input buffer. All world, extension,
    // time, logger, allocation and both full RNG states/counts remain compared.

    return snapshot;
}
function pathToBonfire(game: Game, target: { x: number; y: number }) {
    const key = (point: { x: number; y: number }) => `${point.x},${point.y}`;
    const origin = { ...game.player.loc }, seen = new Set([key(origin)]);
    const queue = [{ ...origin, path: [] as { x: number; y: number }[] }];
    for (let index = 0; index < queue.length; index++) {
        const point = queue[index]!;
        if (Math.max(Math.abs(point.x - target.x), Math.abs(point.y - target.y)) <= 1) return point.path;
        for (const { x: dx, y: dy } of directions.slice(0, 4)) {
            const next = { x: point.x + dx, y: point.y + dy }, cell = game.grid.getCell(next.x, next.y);
            if (seen.has(key(next)) || !cell?.isPassable || cell.isOpaque || !cell.isVisible
                || game.monsters.some(monster => monster.hp > 0 && monster.x === next.x && monster.y === next.y)) continue;
            seen.add(key(next)); queue.push({ ...next, path: [...point.path, { x: dx, y: dy }] });
        }
    }
    throw new Error('The natural seed must expose a short walk to its bonfire');
}

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('3f independently installed combat combinations on a natural normal run', () => {
    it.each(subsets.map(ids => ({ ids, label: ids.join('+') })))(
        '$label: real commands, every checkpoint, seek, continuation and corrupt-manifest preservation', ({ ids }) => {
            const game = start(ids), initial = mechanical(game), prefixLength = game.recordedInputEvents.length;
            expect(game.extensionRuntime!.manifest.modules.map(module => module.id)).toEqual([...ids].sort());
            expect(Object.keys(game.extensionRuntime!.snapshot().modules).sort()).toEqual([...ids].sort());
            const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.owner === 'combat' && entity.depth === game.depth)!;
            expect(target).toBeDefined();
            const inputs: { action: string; data?: unknown }[] = [];
            const expected: ReturnType<typeof mechanical>[] = [];
            const saves: ReturnType<Game['toSaveSnapshot']>[] = [];
            const nativeMelee = vi.spyOn(game, 'resolveActorNativeMelee');
            const play = (action: string, data?: unknown) => {
                acknowledge(); const count = game.recordedInputEvents.length;
                game.executeCommand(action, data);
                expect(game.lastAdvancementError).toBeNull(); expect(game.isGameOver).toBe(false);
                expect(game.recordedInputEvents).toHaveLength(count + 1);
                inputs.push({ action, data }); expected.push(mechanical(game)); saves.push(json(game.toSaveSnapshot()));
            };
            const walk = pathToBonfire(game, target); expect(walk.length).toBeLessThan(10);
            for (const direction of walk) play('move', direction);
            let encounters = 0;
            const clearThreats = () => {
                while (worldRestUnavailable(game, target.id) === 'threatened') {
                    expect(++encounters).toBeLessThan(30);
                    const adjacent = game.monsters.find(monster => monster.hp > 0 && !monster.isAlly
                        && canDirectlySeeMonster(game.player, game.grid, monster) && game.meleeContact(game.player, monster));
                    if (adjacent) {
                        const facing = directions.find(direction => direction.x === Math.sign(adjacent.x - game.player.x)
                            && direction.y === Math.sign(adjacent.y - game.player.y))!.facing;
                        const attack = command('attack', { attackId: 'fixture.double-thrust', facing });
                        expect(preparePhasedAttackCommand(game, attack)).not.toBeNull(); play('ext:command', attack);
                    } else play('wait');
                }
            };
            clearThreats();
            expect(worldRestUnavailable(game, target.id)).toBeNull();
            const restAt = expected.length;
            play('ext:command', command('rest', { bonfireId: target.id }));
            expect(last(state(game).bonfires!.receipts)).toMatchObject({ bonfireId: target.id, visit: 1, result: 'completed' });
            expect(game.player.hp).toBe(game.player.maxHp);
            if(ids.includes('narrative')){
                const narrative=game.extensionRuntime!.snapshot().modules.narrative as unknown as {
                    flags:Record<string,boolean>;triggerReceipts:{triggerId:string;receiptId:string;firings:number}[];active:unknown};
                expect(narrative.flags['bonfire.rested']).toBe(true);
                expect(narrative.triggerReceipts.filter(receipt=>receipt.triggerId==='bonfire.first-rest'))
                    .toMatchObject([{triggerId:'bonfire.first-rest',receiptId:'bonfire.first-rest.receipt',firings:1}]);
                expect(narrative.active).toBeNull();
            }
            // Exercise all three shipped attacks. Natural positive damage is
            // required below; successful parry/dodge avoidance remains a separate
            // claim covered by the dedicated defense runtime tests.
            for (const attackId of ['fixture.slash', 'fixture.stomp', 'fixture.double-thrust']) {
                const data = command('attack', { attackId, facing: 'e' });
                expect(preparePhasedAttackCommand(game, data)).not.toBeNull();
                const before = game.actorActions!.nextActionId; play('ext:command', data);
                expect(game.actorActions!.nextActionId).toBeGreaterThan(before);
            }
            const parry = command('parry', { facing: 'e' });
            expect(prepareActorParryCommand(game, parry)).not.toBeNull();
            const beforeParry = game.toSnapshot().run.currentTick; play('ext:command', parry);
            expect(game.toSnapshot().run.currentTick).toBeGreaterThan(beforeParry);
            const origin = { ...game.player.loc };
            const dodge = directions.map(direction => ({ direction, data: command('dodge', { facing: direction.facing }) }))
                .find(candidate => prepareActorDodgeCommand(game, candidate.data));
            expect(dodge).toBeDefined();
            play('ext:command', dodge!.data);
            expect(game.player.loc).toEqual({ x: origin.x + dodge!.direction.x, y: origin.y + dodge!.direction.y });
            play('move', { x: -dodge!.direction.x || 0, y: -dodge!.direction.y || 0 });
            expect(game.player.loc).toEqual(origin);
            clearThreats();
            expect(worldRestUnavailable(game, target.id)).toBeNull();
            play('wait');
            expect(state(game).bonfires!.receipts).toHaveLength(1);
            expect(game.actorActions!.bundles.some(bundle => bundle.decisionOwnerId === game.player.id)).toBe(false);
            const recording = json(game.exportRecording());
            expect(game.hasCompleteRecording).toBe(true);
            expect(recording.events).toHaveLength(prefixLength + expected.length);
            expect(recording.events.some(event => event.action === 'ext:command' && typeof event.data === 'string'
                && JSON.parse(event.data).action === 'parry')).toBe(true);
            const playerResolutions = nativeMelee.mock.calls.flatMap((call, index) => call[1].id === game.player.id ? [index] : []);
            expect(playerResolutions.length).toBeGreaterThan(0);
            for (const index of playerResolutions) expect(readCreatureBirth(nativeMelee.mock.calls[index]![2])).toMatchObject({ creationReason: 'natural', initiallyHostile: true });
            expect(playerResolutions.some(index => nativeMelee.mock.results[index]!.value.damage > 0)).toBe(true);
            nativeMelee.mockRestore();

            const replay = createHeadlessGame(901, 'test');
            expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
            for (let index = 0; index < prefixLength; index++) replay.replayStep(true);
            expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(initial);
            for (const checkpoint of expected) {
                replay.replayStep(true); expect(replay.replayError).toBeNull();
                expect(mechanical(replay)).toEqual(checkpoint); expect(rng.getState()).toEqual(checkpoint.rngState);
            }
            for (const index of [prefixLength + 1, recording.events.length - 1, prefixLength, recording.events.length]) {
                replay.replaySeek(index); expect(replay.replayError).toBeNull(); expect(replay.replayCursor).toBe(index);
                expect(mechanical(replay)).toEqual(index === prefixLength ? initial : expected[index - prefixLength - 1]);
            }
            // Resume after the completed rest, execute the remaining inputs, and retain
            // the complete original recording rather than starting a new origin.
            const resumeAt = restAt, loaded = createHeadlessGame(902, 'test');
            expect(loaded.loadSnapshot(saves[resumeAt]!)).toBe(true); loaded.animationEnabled = false; loaded.onConfirmRequest = () => true;
            const resumeState = expected[resumeAt]!;
            expect(mechanical(loaded)).toEqual(resumeState); expect(rng.getState()).toEqual(resumeState.rngState);
            for (const input of inputs.slice(resumeAt + 1)) { acknowledge(); loaded.executeCommand(input.action, input.data); }
            expect(mechanical(loaded)).toEqual(last(expected)); expect(loaded.exportRecording().events).toEqual(recording.events);

            const saved = json(loaded.toSaveSnapshot()), retainedPlayer = loaded.player, retainedRuntime = loaded.extensionRuntime!;
            const unload = vi.spyOn(retainedRuntime, 'unload'), nextId = getNextEntityId(), random = rng.getState();
            const reject = (manifest: ExtensionManifest) => {
                const corruptSave = json(saved), corruptReplay = json(recording);
                corruptSave.extensions!.manifest = json(manifest); corruptReplay.extensions = json(manifest);
                const before = mechanical(loaded), errors: string[] = [];
                expect(loaded.loadSnapshot(corruptSave, message => errors.push(message))).toBe(false);
                expect(loaded.loadReplay(corruptReplay, message => errors.push(message))).toBe(false);
                expect(errors).toHaveLength(2);
                const after = mechanical(loaded);
                // Rejection visibly reports the error; it must not replace any
                // live world, recorder, runtime, allocator or random stream.
                expect(last(logger.displayMessages)?.text).toBe(errors[1]);
                expect(after.run.logger).toEqual(before.run.logger);
                expect(after).toEqual(before); expect(loaded.recordedInputEvents).toEqual(saved.run.recordingOrigin!.events);
                expect(loaded.player).toBe(retainedPlayer); expect(loaded.extensionRuntime).toBe(retainedRuntime);
                expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(nextId); expect(unload).not.toHaveBeenCalled();
            };
            for (const id of ids) {
                const version = json(saved.extensions!.manifest); version.modules.find(module => module.id === id)!.version = '999.0.0'; reject(version);
                const rules = json(saved.extensions!.manifest); rules.modules.find(module => module.id === id)!.rules!.fingerprint = `sha256:${'0'.repeat(64)}`; reject(rules);
            }
            const duplicate = json(saved.extensions!.manifest); duplicate.modules.push(json(duplicate.modules[0]!)); reject(duplicate);
            const missing = json(saved.extensions!.manifest); missing.modules.push({ id: 'missing-combat-combination', version: '1.0.0' }); reject(missing);
            if(ids.includes('narrative')){
                for(let repeat=0;repeat<2;repeat++)expect(loaded.loadSnapshot(json(saved))).toBe(true);
                acknowledge();loaded.executeCommand('ext:command',command('rest',{bonfireId:target.id}));
                expect(last(state(loaded).bonfires!.receipts)).toMatchObject({visit:2,result:'completed'});
                const narrative=loaded.extensionRuntime!.snapshot().modules.narrative as unknown as {
                    flags:Record<string,boolean>;triggerReceipts:{triggerId:string;receiptId:string;firings:number}[];active:unknown};
                const receipts=narrative.triggerReceipts.filter(receipt=>receipt.triggerId==='bonfire.first-rest');
                expect(receipts).toHaveLength(1);expect(receipts[0]).toMatchObject({receiptId:'bonfire.first-rest.receipt',firings:1});
                expect(narrative.flags['bonfire.rested']).toBe(true);expect(narrative.active).toBeNull();
            }
        }, 60000);
});
