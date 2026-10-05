import { describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import type { Game, GameSnapshot } from '../engine/Core/Game';
import { ItemCategory } from '../engine/Items/Item';
import { rng } from '../engine/Random';

const json = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function world(game: Game) {
    const { savedAt: _savedAt, ...snapshot } = json(game.toSnapshot());
    // The replay reads the command log; it does not record another copy.
    snapshot.run.recordedInputEvents = [];
    snapshot.run.recordedInputIndex = 0;
    return snapshot;
}

function replayTo(game: Game, count: number) {
    while (game.replayCursor < count && !game.replayError) game.replayStep(true);
    expect(game.replayError).toBeNull();
    expect(game.replayCursor).toBe(count);
}

describe('UX-1D persistent complete recordings', () => {
    it.each(['exception', 'expired drain exception'])('keeps collecting accepted inputs after an advancement %s without restoring export provenance', failure => {
        const game = createHeadlessGame(424242);
        game.animationEnabled = true;
        game.executeCommand('wait');
        expect(game.isAdvancing).toBe(true);
        if (failure === 'exception') {
            const iterator = (game as unknown as { advancementIter: Generator<number, void, void> }).advancementIter;
            const next = vi.spyOn(iterator, 'next').mockImplementation(() => { throw new Error('advancement fixture'); });
            try { game.stepAdvancement(); } finally { next.mockRestore(); }
            expect(game.lastAdvancementError).toBeInstanceOf(Error);
        } else {
            // A frame gap alone completes accepted work. Fail the expired drain
            // itself to retain this case's incomplete-recording premise.
            const iterator = (game as unknown as { advancementIter: Generator<number, void, void> }).advancementIter;
            const error = new Error('expired advancement drain fixture');
            const next = vi.spyOn(iterator, 'next').mockImplementation(() => { throw error; });
            const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
            try { game.stepAdvancement(); } finally { now.mockRestore(); next.mockRestore(); }
            expect(game.lastAdvancementError).toBe(error);
        }
        expect(game.isAdvancing).toBe(false);
        expect(game.isInputLocked()).toBe(false);
        expect(game.hasCompleteRecording).toBe(false);
        const count = game.recordedInputEvents.length, turns = game.stats.turns;
        game.animationEnabled = false;
        game.executeCommand('wait');
        expect(game.stats.turns).toBe(turns + 1);
        expect(game.recordedInputEvents).toHaveLength(count + 1);
        expect(game.recordedInputEvents[count]!.turn).toBe(game.absoluteTurnNumber);
        expect(game.canExportRecording).toBe(false);
        expect(() => game.exportRecording()).toThrow('fresh new game');
        const snapshot = json(game.toSaveSnapshot());
        expect(snapshot.run.recordingOrigin).toBeUndefined();
        expect(game.loadSnapshot(snapshot)).toBe(true);
        game.executeCommand('wait');
        expect(game.recordedInputEvents).toHaveLength(count + 1);
        expect(game.hasCompleteRecording).toBe(false);
        expect(game.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
    });

    it('completes accepted work after a normal sixty-second frame gap with a complete recording', () => {
        const game = createHeadlessGame(424242);
        game.animationEnabled = true;
        const count = game.recordedInputEvents.length, turns = game.stats.turns;
        game.executeCommand('wait');
        expect(game.isAdvancing).toBe(true);
        expect(game.hasCompleteRecording).toBe(true);
        expect(game.canExportRecording).toBe(false);
        const now = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_000);
        try { game.stepAdvancement(); } finally { now.mockRestore(); }
        expect(game.lastAdvancementError).toBeNull();
        expect(game.isAdvancing).toBe(false);
        expect(game.isInputLocked()).toBe(false);
        expect(game.stats.turns).toBe(turns + 1);
        expect(game.recordedInputEvents).toHaveLength(count + 1);
        expect(game.recordedInputEvents[count]!.turn).toBe(game.absoluteTurnNumber);
        expect(game.hasCompleteRecording).toBe(true);
        expect(game.canExportRecording).toBe(true);
        const snapshot = json(game.toSaveSnapshot());
        expect(snapshot.run.recordingOrigin).toBeDefined();
        expect(game.loadSnapshot(snapshot)).toBe(true);
        expect(game.hasCompleteRecording).toBe(true);
        game.animationEnabled = false;
        game.executeCommand('wait');
        expect(game.recordedInputEvents).toHaveLength(count + 2);
        const complete = json(game.exportRecording()), expected = world(game), expectedRng = json(rng.getState());
        const independent = createHeadlessGame(3);
        expect(independent.loadReplay(complete)).toBe(true);
        replayTo(independent, complete.events.length);
        expect(world(independent)).toEqual(expected);
        expect(rng.getState()).toEqual(expectedRng);
    });

    it.each(['mouse_travel', 'auto_explore', 'search_long', 'auto_rest'])('resumes queued %s steps with a complete independently replayable world', action => {
        const game = createHeadlessGame(27030);
        if (action === 'mouse_travel') {
            const { x, y } = game.player.loc;
            const destination = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
                .find(([nx, ny]) => game.grid.getCell(nx!, ny!)?.isPassable && !game.getMonsterAt(nx!, ny!));
            expect(destination).toBeDefined();
            game.executeCommand(action, { x: destination![0]!, y: destination![1]! });
        } else game.executeCommand(action);
        expect(game.isAutoTraveling()).toBe(true);
        expect(game.disturbed).toBe(false);
        const saved = json(game.toSaveSnapshot()), prefixWorld = world(game);
        expect(saved.run.recordingOrigin).toBeDefined();
        expect(game.loadSnapshot(saved)).toBe(true);
        expect(world(game)).toEqual(prefixWorld);
        expect(game.isAutoTraveling()).toBe(true);
        expect(game.disturbed).toBe(false);
        for (let step = 0; step < 3 && game.isAutoTraveling(); step++) game.stepAutoPath();
        const complete = json(game.exportRecording()), expected = world(game);
        expect(complete.events.length).toBeGreaterThan(saved.run.recordedInputEvents.length);
        expect(complete.events.slice(saved.run.recordedInputEvents.length).every(event => event.action === 'auto_step')).toBe(true);
        const independent = createHeadlessGame(3);
        expect(independent.loadReplay(complete)).toBe(true);
        replayTo(independent, complete.events.length);
        expect(world(independent)).toEqual(expected);
    });

    it('waits for the final animated checkpoint, and invalidates a discarded command until a new game', () => {
        const game = createHeadlessGame(424242);
        game.animationEnabled = true;
        game.executeCommand('wait');
        expect(game.hasCompleteRecording).toBe(true);
        expect(game.canExportRecording).toBe(false);
        expect(() => game.toSaveSnapshot()).toThrow('advancement');
        expect(() => game.exportRecording()).toThrow('advancing');
        for (let step = 0; step < 100 && game.isAdvancing; step++) game.stepAdvancement();
        expect(game.canExportRecording).toBe(true);
        const saved = json(game.toSaveSnapshot());
        expect(saved.run.recordedInputEvents[0]!.turn).toBe(1);
        expect(game.loadSnapshot(saved)).toBe(true);
        game.executeCommand('wait');
        expect(game.canExportRecording).toBe(false);
        game.discardInFlightAdvancement();
        expect(game.hasCompleteRecording).toBe(false);
        expect(() => game.exportRecording()).toThrow('fresh new game');
        expect(game.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
        game.startNewGame({ seed: 424242 });
        expect(game.canExportRecording).toBe(true);
        expect(game.toSaveSnapshot().run.recordingOrigin).toBeDefined();
        game.clearRecording();
        expect(game.hasCompleteRecording).toBe(false);
    });

    it.each([[false, false], [true, false], [true, true]])('retains the settled terminal checkpoint: won=%s superVictory=%s', (won, superVictory) => {
        const game = createHeadlessGame(27029);
        // Controlled terminal lifecycle fixture, not a claim to have played to D40.
        game.executeCommand('wait', undefined, () => game.triggerGameOver(won, 'fixture', superVictory));
        const recording = json(game.exportRecording());
        expect(recording.events[0]!.end).toEqual({ won, superVictory, score: game.gameOverScore });
        const snapshot = json(game.toSaveSnapshot());
        expect(game.loadSnapshot(snapshot)).toBe(true);
        expect(game.isGameOver).toBe(true);
        expect(game.gameOverSuperVictory).toBe(superVictory);
        expect(game.canExportRecording).toBe(true);
        expect(game.exportRecording().events).toEqual(recording.events);
        const changed = json(snapshot);
        changed.run.recordedInputEvents[0]!.end!.score++;
        expect(game.loadSnapshot(changed)).toBe(true);
        expect(game.canExportRecording).toBe(false);
    });

    it('exports detached data and checkpoints without consuming either RNG stream', () => {
        const game = createHeadlessGame(27030);
        game.executeCommand('move', { x: 1, y: 0 });
        const state = rng.getState();
        const exported = game.exportRecording();
        exported.events[0]!.rng!.streams[0].a ^= 1;
        (exported.events[0]!.data as { x: number }).x = 999;
        expect(game.exportRecording().events[0]!.rng).toEqual(state);
        expect(game.exportRecording().events[0]!.data).toEqual({ x: 1, y: 0 });
        game.toSaveSnapshot();
        expect(rng.getState()).toEqual(state);
    });

    it.each(['help', 'inventory', 'throw'] as const)('preserves command interpretation when saved in %s mode', mode => {
        const game = createHeadlessGame(27031);
        if (mode === 'help') game.executeCommand('help');
        else if (mode === 'inventory') game.executeCommand('toggle_inventory');
        else game.executeItemCommand('throw', game.player.inventory.items.find(item => item.inventoryLetter === 'c')!);
        const inputState = { reference: game.referenceScreen, inventory: game.isInventoryOpen,
            throwing: game.isThrowing, throwId: game.throwItemTarget?.id };
        const saved = json(game.toSaveSnapshot());
        expect(game.loadSnapshot(saved)).toBe(true);
        expect({ reference: game.referenceScreen, inventory: game.isInventoryOpen,
            throwing: game.isThrowing, throwId: game.throwItemTarget?.id }).toEqual(inputState);
        game.executeCommand('wait');
        game.executeCommand('escape');
        game.executeCommand('wait');
        const recording = json(game.exportRecording()), expected = world(game);
        const independent = createHeadlessGame(3);
        expect(independent.loadReplay(recording)).toBe(true);
        replayTo(independent, recording.events.length);
        expect(world(independent)).toEqual(expected);
    });

    it('continues a saved prefix and independently replays the complete world from its seed', () => {
        const live = createHeadlessGame(27031);
        live.executeCommand('wait');
        const food = live.player.inventory.items.find(item => item.category === ItemCategory.FOOD)!;
        live.onConfirmRequest = () => false;
        live.executeItemCommand('eat', food);
        const prefix = json(live.exportRecording());
        const prefixWorld = world(live);
        const snapshot = json(live.toSaveSnapshot());
        expect(snapshot.run.recordingOrigin).toBeDefined();

        const replay = createHeadlessGame(1);
        expect(replay.loadReplay(prefix)).toBe(true);
        replay.onConfirmRequest = () => { throw new Error('replay must consume recorded decisions'); };
        replayTo(replay, prefix.events.length);
        expect(world(replay)).toEqual(prefixWorld);

        const resumed = createHeadlessGame(2);
        expect(resumed.loadSnapshot(snapshot)).toBe(true);
        expect(resumed.hasCompleteRecording).toBe(true);
        expect(world(resumed)).toEqual(prefixWorld);
        resumed.onConfirmRequest = () => true;
        resumed.executeItemCommand('eat', resumed.player.inventory.items.find(item => item.category === ItemCategory.FOOD)!);
        resumed.executeCommand('search');
        const complete = json(resumed.exportRecording());
        const completeWorld = world(resumed);
        expect(complete.events.slice(0, prefix.events.length)).toEqual(prefix.events);
        expect(complete.events.map(event => event.index)).toEqual([0, 1, 2, 3]);
        expect(complete.events.map(event => event.decisions)).toEqual([[], [false], [true], []]);

        const independent = createHeadlessGame(3);
        expect(independent.loadReplay(complete)).toBe(true);
        independent.onConfirmRequest = () => { throw new Error('replay must consume recorded decisions'); };
        replayTo(independent, complete.events.length);
        expect(world(independent)).toEqual(completeWorld);
        independent.replaySeek(prefix.events.length);
        expect(world(independent)).toEqual(prefixWorld);
        independent.replaySeek(complete.events.length);
        expect(independent.replayError).toBeNull();
        expect(world(independent)).toEqual(completeWorld);
    });

    it('keeps world-only and legacy snapshots playable without claiming a complete recording', () => {
        const game = createHeadlessGame(27029);
        game.executeCommand('wait');
        const snapshot = json(game.toSnapshot());
        expect(game.loadSnapshot(snapshot)).toBe(true);
        game.executeCommand('wait');
        expect(game.hasCompleteRecording).toBe(false);
        expect(() => game.exportRecording()).toThrow('fresh new game');
        expect(game.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
    });

    it('checks empty prefixes against the saved new-game checkpoint', () => {
        const game = createHeadlessGame(27029);
        const snapshot = json(game.toSaveSnapshot());
        expect(snapshot.run.recordedInputEvents).toHaveLength(0);
        expect(game.loadSnapshot(snapshot)).toBe(true);
        expect(game.canExportRecording).toBe(true);
        expect(game.exportRecording().events).toHaveLength(0);
        const advanced = json(snapshot);
        advanced.run.absoluteTurnNumber++;
        expect(game.loadSnapshot(advanced)).toBe(true);
        expect(game.hasCompleteRecording).toBe(false);
    });

    it('does not promote malformed, stale or explicitly incomplete prefixes on load', () => {
        const game = createHeadlessGame(27030);
        game.executeCommand('wait');
        game.executeCommand('search');
        const original = json(game.toSaveSnapshot());
        const corruptions: Array<(snapshot: GameSnapshot) => void> = [
            snapshot => { delete snapshot.run.recordingOrigin; },
            snapshot => { (snapshot.run as any).recordingOrigin = false; },
            snapshot => { snapshot.run.recordingOrigin!.seed = '42'; },
            snapshot => { (snapshot.run.recordingOrigin as any).inputState = null; },
            snapshot => { snapshot.run.recordingOrigin!.inputState.throwItemId = 999999; },
            snapshot => { snapshot.run.recordedInputIndex++; },
            snapshot => { snapshot.run.recordedInputEvents[0]!.index = 1; },
            snapshot => { snapshot.run.recordedInputEvents.pop(); },
            snapshot => { snapshot.run.recordedInputEvents[1]!.tick++; },
            snapshot => { snapshot.run.recordedInputEvents[1]!.turn!++; },
            snapshot => { snapshot.run.recordedInputEvents[1]!.depth++; },
            snapshot => { snapshot.run.recordedInputEvents[1]!.player.x++; },
            snapshot => { snapshot.run.recordedInputEvents[1]!.rng!.streams[0].a ^= 1; },
            snapshot => { snapshot.run.recordedInputEvents[1]!.end = { won: false, superVictory: false, score: 0 }; },
        ];
        for (const corrupt of corruptions) {
            const snapshot = json(original);
            corrupt(snapshot);
            expect(game.loadSnapshot(snapshot)).toBe(true);
            expect(game.hasCompleteRecording).toBe(false);
            expect(() => game.exportRecording()).toThrow('fresh new game');
            game.executeCommand('wait');
            expect(game.toSaveSnapshot().run.recordingOrigin).toBeUndefined();
        }
    });
});
