import { rechain } from './support/recordingV4';
import { describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import type { Game } from '../engine/Core/Game';
import { rng } from '../engine/Random';

const tick = (game: Game, ms: number) =>
    (game.tickReplay as (elapsedMs: number) => void).call(game, ms);
function playing() {
    const game = createHeadlessGame(27030);
    for (let i = 0; i < 30; i++) game.executeCommand('help');
    expect(game.exportRecording().events).toHaveLength(30);
    expect(game.loadReplay(game.exportRecording())).toBe(true);
    game.replayPlay();
    return game;
}

describe('PERF-2 replay uses elapsed display time', () => {
    it.each([30, 60, 144])('plays ten checked commands per second at %i Hz', fps => {
        const game = playing(), random = rng.getState();
        for (let frame = 0; frame < fps; frame++) tick(game, 1000 / fps);
        expect(game.replayCursor).toBe(10);
        expect(game.replayError).toBeNull();
        expect(rng.getState()).toEqual(random);
    });

    it('retains the six nominal frames default for existing display callers', () => {
        const game = playing();
        for (let frame = 0; frame < 5; frame++) game.tickReplay();
        expect(game.replayCursor).toBe(0);
        game.tickReplay();
        expect(game.replayCursor).toBe(1);
    });

    it('discards elapsed and partial time while paused, even without paused ticks', () => {
        const game = playing(); tick(game, 80);
        game.replayPause(); game.replayPlay(); tick(game, 30);
        expect(game.replayCursor).toBe(0);
        tick(game, 70); expect(game.replayCursor).toBe(1);
        game.replayPause(); tick(game, 200); game.replayPlay(); tick(game, 99);
        expect(game.replayCursor).toBe(1);
        tick(game, 1); expect(game.replayCursor).toBe(2);
    });

    it('discards animation lock time instead of queueing it for the next input', () => {
        const game = playing(); tick(game, 80);
        const locked = vi.spyOn(game, 'isInputLocked').mockReturnValue(true);
        tick(game, 100); expect(game.replayCursor).toBe(0);
        locked.mockRestore(); tick(game, 30); expect(game.replayCursor).toBe(0);
        tick(game, 70); expect(game.replayCursor).toBe(1);
    });

    it('bounds catch-up to two commands and discards long background gaps', () => {
        const game = playing(); tick(game, 90); tick(game, 240);
        expect(game.replayCursor).toBe(2);
        tick(game, 1); expect(game.replayCursor).toBe(2);
        tick(game, 5000); tick(game, 99); expect(game.replayCursor).toBe(2);
        tick(game, 1); expect(game.replayCursor).toBe(3);
    });

    it('plays recorded modal closing commands and stops immediately at an OOS', () => {
        const game = createHeadlessGame(27030);
        game.executeCommand('toggle_inventory'); game.executeCommand('escape');
        const recording = game.exportRecording();
        expect(recording.events.map(event => event.action)).toEqual(['toggle_inventory', 'escape']);
        expect(game.loadReplay(recording)).toBe(true); game.replayPlay();
        tick(game, 100); expect(game.isInventoryOpen).toBe(true);
        tick(game, 100); expect(game.isInventoryOpen).toBe(false);
        expect(game.replayCursor).toBe(2); expect(game.replayError).toBeNull();
        recording.events[0]!.tick += 1; rechain(recording);
        expect(game.loadReplay(recording)).toBe(true); game.replayPlay(); tick(game, 200);
        expect(game.replayError).toContain('OOS at command 1');
        expect(game.replayCursor).toBe(0);
    });
});
