import { describe, expect, it } from 'vitest';
import { createExtensionRegistry, getInstalledModuleDescriptors } from '../../../catalog';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game, GameRecording } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import type { NarrativeState } from '../state';

const clone = <T>(value: T): T => structuredClone(value);
const combinations = [['narrative'], ...(getInstalledModuleDescriptors().some(module => module.id === 'growth')
    ? [['growth', 'narrative']] : [])];
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
const narrative = (game: Game) => game.extensionRuntime!.snapshot().modules.narrative as unknown as NarrativeState;

/** Whole native world and extension state, not merely the compact recorder checkpoint.
 * Wall-clock save time and recorder/presentation bookkeeping are not world state;
 * the recording is asserted separately with exact structural equality except export wall-clock time. */
function world(game: Game) {
    const { savedAt: _savedAt, run, ...snapshot } = game.toSnapshot();
    const { recordedInputEvents: _events, recordedInputIndex: _index, logger: _logger,
        recordingOrigin: _origin, ...mechanicalRun } = run;
    return clone({ ...snapshot, run: mechanicalRun });
}
function command(game: Game, action: string, fields: object): void {
    acknowledge();
    const count = game.recordedInputEvents.length;
    game.executeCommand('ext:command', JSON.stringify({ module: 'narrative', action,
        payload: { v: 2, revision: narrative(game).revision, ...fields } }));
    expect(game.recordedInputEvents).toHaveLength(count + 1);
}
function executeStep(game: Game, step: number, targetId: number): void {
    if (step === 0 || step === 2) command(game, 'open', { targetEntityId: targetId });
    else if (step === 1) {
        const active = narrative(game).active!;
        command(game, 'choose', { sessionId: active.sessionId, nodeId: active.nodeId, choiceId: 'read-note' });
    } else if (step === 3) command(game, 'close', { sessionId: narrative(game).active!.sessionId });
    else {
        acknowledge(); const turn = game.absoluteTurnNumber;
        game.executeCommand('wait'); expect(game.absoluteTurnNumber).toBeGreaterThan(turn);
    }
}
function verifyReplay(game: Game, recording: GameRecording, endpoint: ReturnType<typeof world>): void {
    expect(game.loadReplay(clone(recording))).toBe(true); game.animationEnabled = false;
    for (const event of recording.events) {
        game.replayStep(true);
        expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(event.index + 1);
        const snapshot = game.toSnapshot();
        expect(snapshot.extensions).toEqual(event.extensions); expect(snapshot.rngState).toEqual(event.rng);
        expect(snapshot.run.currentTick).toBe(event.tick); expect(snapshot.run.absoluteTurnNumber).toBe(event.turn);
    }
    expect(world(game)).toEqual(endpoint);
}

describe.each(combinations)('EXT-2e natural normal-game persistence with %j', (...ids: string[]) => {
    it('continues pre-open, active-node, rewarded and explicit-close saves to exactly the same world and recording', () => {
        // Actual normal generation, default installed packs, public commands only.
        // No teleports, edited snapshots/checkpoints, custom rule packs or mocked providers.
        const seed = 8201, registry = createExtensionRegistry();
        const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
            ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
        const game = createHeadlessGame(seed, 'normal');
        game.startNewGame({ seed, mode: 'normal', ruleSet: 'extended', extensions: ids, initialCommands });
        game.animationEnabled = false; acknowledge();
        const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.owner === 'narrative')!;
        expect(target).toBeDefined();
        expect(Math.max(Math.abs(target.x - game.player.x), Math.abs(target.y - game.player.y))).toBeLessThanOrEqual(target.interactionDistance);
        const origin = clone(game.toSaveSnapshot().run.recordingOrigin!.initial);
        const cuts: { name: string; next: number; save: ReturnType<Game['toSaveSnapshot']>; world: ReturnType<typeof world>; recording: GameRecording }[] = [];
        const capture = (name: string, next: number) => {
            cuts.push({ name, next, save: clone(game.toSaveSnapshot()), world: world(game), recording: clone(game.exportRecording()) });
        };
        capture('before-open', 0);
        for (let step = 0; step < 5; step++) {
            executeStep(game, step, target.id);
            if (step === 0) capture('active-node', 1);
            if (step === 1) capture('rewarded', 2);
            if (step === 3) capture('explicit-close', 4);
        }
        const endpoint = world(game), recording = clone(game.exportRecording());
        expect(narrative(game).rewardReceipts).toHaveLength(1);
        expect(narrative(game).rewardReceipts[0]).toMatchObject({ result: 'skipped', reason: ids.includes('growth') ? 'disabled' : 'absent' });
        expect(narrative(game).journal).toHaveLength(1); expect(narrative(game).active).toBeNull();
        expect(cuts.map(cut => cut.name)).toEqual(['before-open', 'active-node', 'rewarded', 'explicit-close']);
        for (const cut of cuts) {
            expect(cut.save.run.recordingOrigin, cut.name).toBeDefined();
            expect(game.loadSnapshot(clone(cut.save)), cut.name).toBe(true); game.animationEnabled = false;
            expect(game.hasCompleteRecording, cut.name).toBe(true);
            expect(world(game), cut.name).toEqual(cut.world);
            expect(game.exportRecording().events, cut.name).toEqual(cut.recording.events);
            for (let step = cut.next; step < 5; step++) executeStep(game, step, target.id);
            expect(world(game), cut.name).toEqual(endpoint);
            const { recordedAt: _originalExportTime, ...originalRecording } = recording;
            const { recordedAt: _continuedExportTime, ...continuedRecording } = game.exportRecording();
            expect(continuedRecording, cut.name).toEqual(originalRecording);
            verifyReplay(game, clone(game.exportRecording()), endpoint);
        }
        for (const cut of [...cuts].reverse()) {
            const index = cut.recording.events.length;
            game.replaySeek(index); expect(game.replayError, cut.name).toBeNull(); expect(game.replayCursor).toBe(index);
            expect(world(game), cut.name).toEqual(cut.world);
        }
        game.replaySeek(0); expect(game.replayError).toBeNull();
        expect(game.toSnapshot().extensions).toEqual(origin.extensions); expect(game.toSnapshot().rngState).toEqual(origin.rng);
        game.replaySeek(recording.events.length); expect(game.replayError).toBeNull(); expect(world(game)).toEqual(endpoint);
    }, 60000);
});
