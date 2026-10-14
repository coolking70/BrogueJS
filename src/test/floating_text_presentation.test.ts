import { describe, expect, it, vi } from 'vitest';
import { FloatingText } from '../engine/Visuals/FloatingText';
import { FloatingTextPresentation, observeFloatingText } from '../ui/floatingTextPresentation';
import { observeDisplayFrame } from '../ui/displayProjection';
import { PresentationTimeline, displayedFrame } from '../ui/presentationTimeline';
import { createHeadlessGame } from './harness';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';

describe('floating text display lifetime', () => {
    it.each([30, 60, 144])('expires after 500ms at %s FPS, without mutating the captured frame or random streams', fps => {
        const source = new FloatingText('Miss', 10, 10), clock = new FloatingTextPresentation();
        const captured = Object.freeze(observeFloatingText(source)), before = { ...source }, random = rng.getState();
        clock.project([captured]);
        for (let i = 0; i < fps / 2 - 1; i++) clock.tick(1000 / fps);
        const text = clock.project([captured])[0]!;
        expect(text.life).toBeGreaterThan(0); expect(text.life).toBeLessThan(30); expect(text.y).toBeLessThan(10);
        clock.tick(1000 / fps);
        expect(clock.project([captured])).toEqual([]); expect(clock.expired(source)).toBe(true);
        expect(source).toEqual(before); expect(rng.getState()).toEqual(random);
        // A newer snapshot and the live view cannot resurrect the same effect.
        expect(clock.project([observeFloatingText(source)])).toEqual([]);
    });
    it('honors custom lifetime and independent identities even when random IDs collide; queued effects start on display', () => {
        const first = new FloatingText('Miss', 1, 2, '#fff', 60), second = new FloatingText('Miss', 1, 2);
        second.id = first.id;
        const clock = new FloatingTextPresentation(), a = observeFloatingText(first), b = observeFloatingText(second);
        clock.project([a]); clock.tick(750);
        expect(clock.project([a])[0]!.life).toBeCloseTo(15);
        expect(clock.project([b])[0]!.life).toBe(30);
        clock.tick(250); expect(clock.project([a])).toEqual([]);
        expect(clock.project([b])[0]!.life).toBeCloseTo(15);
    });
    it('fades across held ACKs and repeated immutable timeline captures, without changing the world', () => {
        const now = vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
        const g = createHeadlessGame(7306), clock = new FloatingTextPresentation(), timeline = new PresentationTimeline(g, logger);
        logger.presentAcknowledgments(() => true);
        try {
            g.spawnFloatingText('Miss', g.player.x, g.player.y);
            logger.log('first', '#fff', { acknowledge: true });
            logger.log('second', '#fff', { acknowledge: true });
            const frame = displayedFrame(g)!, before = g.toSnapshot(), random = rng.getState();
            expect(clock.project(frame.floatingTexts)).toHaveLength(1);
            clock.tick(501); timeline.tick(501);
            expect(clock.project(displayedFrame(g)!.floatingTexts)).toEqual([]);
            expect(displayedFrame(g)).toBe(frame); expect(frame.floatingTexts[0]!.life).toBe(30);
            timeline.acknowledge(timeline.acknowledgment!);
            expect(clock.project(displayedFrame(g)!.floatingTexts)).toEqual([]);
            expect(g.toSnapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        } finally { timeline.dispose(); logger.presentAcknowledgments(null); g.disposeRecording(); now.mockRestore(); }
    });
    it('load, replay step, seek and new run discard old effects with a mounted timeline', () => {
        const g = createHeadlessGame(7306);
        g.executeCommand('wait'); g.executeCommand('wait');
        const saved = g.toSnapshot(), recording = g.exportRecording(), timeline = new PresentationTimeline(g, logger);
        const dirty = () => { g.spawnFloatingText('Miss', g.player.x, g.player.y); logger.log('old', '#fff', { acknowledge: true }); };
        const clean = () => {
            expect(g.floatingTexts).toEqual([]);
            expect(displayedFrame(g)?.floatingTexts ?? []).toEqual([]);
        };
        try {
            dirty(); expect(g.loadSnapshot(saved)).toBe(true); clean();
            dirty(); expect(g.loadReplay(recording)).toBe(true); clean();
            g.replayStep(); expect(g.replayError).toBeNull();
            dirty(); g.replaySeek(0); clean();
            dirty(); g.replaySeek(2); clean(); expect(g.replayError).toBeNull();
            dirty(); g.startNewGame({ seed: 7306 }); clean();
            expect(observeDisplayFrame(g, logger).floatingTexts).toEqual([]);
        } finally { timeline.dispose(); g.disposeRecording(); }
    });
});
