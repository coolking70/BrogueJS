import { beforeAll, describe, expect, it, vi } from 'vitest';
import { rng } from '../engine/Random';
import { createHeadlessGame } from './harness';

let cosmeticPercent: (percent: number, owner?: object) => boolean;
let cosmeticPick: <T>(list: readonly T[], owner?: object) => T;

beforeAll(async () => {
    vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {} });
    const canvas = await import('../components/GameCanvas.vue');
    cosmeticPercent = canvas.cosmeticPercent;
    cosmeticPick = canvas.cosmeticPick;
});

describe('UX-1C hallucination presentation RNG', () => {
    it('can vary hallucination appearances without changing either recorded RNG stream', () => {
        rng.seedRandomGenerator(27027);
        const before = rng.getState();
        const owner = {};
        const outcomes = new Set<string>();
        for (let i = 0; i < 200; i++) {
            outcomes.add(`${cosmeticPercent(50, owner)}:${cosmeticPick(['?', '!', '~'], owner)}`);
        }
        expect(outcomes.size).toBeGreaterThan(1);
        expect(rng.getState()).toEqual(before);
    });

    it('keeps durable recording provenance after extra presentation draws', () => {
        const game = createHeadlessGame(27027);
        expect(game.toSaveSnapshot().run.recordingOrigin).toBeDefined();
        const before = rng.getState();
        for (let i = 0; i < 200; i++) {
            cosmeticPercent(35, game.grid);
            cosmeticPick(['?', '!', '~'], game.grid);
        }
        expect(rng.getState()).toEqual(before);
        expect(game.toSaveSnapshot().run.recordingOrigin).toBeDefined();
    });
});
