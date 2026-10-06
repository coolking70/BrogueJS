import { describe, expect, it } from 'vitest';
import { AUTO_ACTION_INTERVAL_MS, stepCadence } from '../engine/UI/ActionCadence';
import { createHeadlessGame } from './harness';
import type { Game } from '../engine/Core/Game';
import { rng } from '../engine/Random';

function world(game: Game) {
    const { savedAt: _savedAt, ...snapshot } = JSON.parse(JSON.stringify(game.toSnapshot()));

    return snapshot;
}

describe('PERF-2 automatic display clock', () => {
    it.each([30, 60, 144])('schedules twelve autonomous steps per second at %i Hz without RNG', fps => {
        const before = rng.getState(); let count = 0, pending = 0;
        for (let frame = 0; frame < fps; frame++)
            pending = stepCadence(pending, 1000 / fps, AUTO_ACTION_INTERVAL_MS, () => true, () => count++);
        expect(count).toBe(12); expect(rng.getState()).toEqual(before);
    });

    it('stops within a catch-up frame, resets a blocked remainder, and discards invalid/background time', () => {
        let active = true, count = 0;
        let pending = stepCadence(0, 200, AUTO_ACTION_INTERVAL_MS, () => active, () => { count++; active = false; });
        expect(count).toBe(1); expect(pending).toBe(0);
        active = true; pending = stepCadence(pending, 50, AUTO_ACTION_INTERVAL_MS, () => active, () => count++);
        expect(count).toBe(1);
        active = false; pending = stepCadence(pending, 50, AUTO_ACTION_INTERVAL_MS, () => active, () => count++);
        expect(pending).toBe(0);
        active = true;
        for (const delta of [NaN, Infinity, -1, 0, 5000]) {
            pending = stepCadence(50, delta, AUTO_ACTION_INTERVAL_MS, () => active, () => count++);
            expect(pending).toBe(0); expect(count).toBe(1);
        }
    });

    it.each([30, 60, 144])('keeps the same command checkpoints, world and independent replay at %i Hz', fps => {
        const reference = createHeadlessGame(27030); reference.executeCommand('search_long');
        for (let step = 0; step < 3; step++) reference.stepAutoPath();
        const expectedWorld = world(reference), expected = reference.exportRecording();
        expect(expected.events.map(event => event.action)).toEqual(['search_long', 'auto_step', 'auto_step', 'auto_step']);
        const game = createHeadlessGame(27030); game.executeCommand('search_long');
        let pending = 0;
        for (let frame = 0; frame < Math.round(fps / 3); frame++)
            pending = stepCadence(pending, 1000 / fps, AUTO_ACTION_INTERVAL_MS,
                () => game.isAutoTraveling() && game.recordedInputEvents.length < 4,
                () => game.stepAutoPath());
        const recording = game.exportRecording();
        const { recordedAt: _actualAt, ...actualPayload } = recording;
        const { recordedAt: _expectedAt, ...expectedPayload } = expected;
        expect(actualPayload).toEqual(expectedPayload); expect(world(game)).toEqual(expectedWorld);
        expect(game.loadReplay(recording)).toBe(true);
        while (game.replayCursor < recording.events.length && !game.replayError) game.replayStep(true);
        expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(4);
        expect(world(game)).toEqual(expectedWorld);
    });
});
