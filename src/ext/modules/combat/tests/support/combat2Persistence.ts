import { expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHeadlessGame } from '../../../../../test/harness';
import { continuingPrefix } from '../../../../../test/support/recordingV4';
import { acknowledge, clone, mechanical, play } from './combat2Harness';
import { digest, type captureNatural } from './combat2Natural';

/** Every comparison includes all native/extension/cache/allocator/logger fields
 * and both full RNG states/counts. Only savedAt is normalized. */
export function validateNaturalPersistence(result: ReturnType<typeof captureNatural>) {
    const { trace, recording, keys, zero } = result;
    const final = mechanical(result.game), end = recording.events.length;
    const middle = [...keys].find(([, key]) => key.snapshot.run.actorActions?.bundles.some(bundle => bundle.subactions.some(child => child.phases[child.phaseIndex]?.kind === 'inter-segment')))?.[0]
        ?? trace.keyIndices.filter(index => index > trace.prefix && index < end)[0] ?? trace.prefix;
    const early = trace.inputs.find(input => input.index > trace.prefix && input.index < middle)?.index ?? trace.prefix;
    const sought = [end, 0, middle, early, end];
    const direct = new Map<number, ReturnType<typeof mechanical>>([[0, zero], [end, final]]);
    const replay = createHeadlessGame(902, 'test');
    expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
    expect(mechanical(replay)).toEqual(zero);
    while (replay.replayCursor < end) {
        replay.replayStep(true); expect(replay.replayError).toBeNull();
        const expected = trace.checkpoints[replay.replayCursor]; if (expected) expect(digest(mechanical(replay))).toBe(expected);
        if (sought.includes(replay.replayCursor)) direct.set(replay.replayCursor, mechanical(replay));
    }
    expect(mechanical(replay)).toEqual(final);
    for (const index of sought) {
        replay.replaySeek(index); expect(replay.replayError).toBeNull(); expect(replay.replayCursor).toBe(index);
        const actual = mechanical(replay);
        if (digest(actual) !== trace.checkpoints[index]) {
            mkdirSync('/tmp/combat2-evidence/persistence', { recursive: true });
            writeFileSync(`/tmp/combat2-evidence/persistence/seek-${trace.seed}-${trace.modules.join('+')}-${index}.json`,
                JSON.stringify({ index, wantedHash: trace.checkpoints[index], directHash: digest(direct.get(index)),
                    expected: direct.get(index), actual }));
        }
        expect(digest(actual), `nonmonotonic seek index ${index}`).toBe(trace.checkpoints[index]);
    }
    for (const [index, key] of keys) {
        const loaded = createHeadlessGame(903, 'test'); expect(loaded.loadSnapshot(clone(key.save))).toBe(true);
        loaded.animationEnabled = false; loaded.onConfirmRequest = () => true;
        expect(mechanical(loaded)).toEqual(key.snapshot);
        expect(loaded.exportRecording().events.length).toBe(index);
    }
    const key = keys.get(middle) ?? keys.get(trace.prefix)!;
    const resumed = createHeadlessGame(904, 'test'); expect(resumed.loadSnapshot(clone(key.save))).toBe(true);
    resumed.animationEnabled = false; resumed.onConfirmRequest = () => true;
    for (const input of trace.inputs.filter(input => input.index > key.save.run.recordingOrigin!.events.length)) {
        play(resumed, input.action, input.data); expect(digest(mechanical(resumed))).toBe(trace.checkpoints[input.index]);
    }
    expect(mechanical(resumed)).toEqual(final); expect(resumed.exportRecording().events).toEqual(recording.events);
    acknowledge(); play(resumed, 'wait');
    const continued = clone(resumed.exportRecording()), continuedFinal = mechanical(resumed);
    expect(continued.events.slice(0, end)).toEqual(continuingPrefix(recording));
    const fresh = createHeadlessGame(905, 'test'); expect(fresh.loadReplay(continued)).toBe(true); fresh.animationEnabled = false;
    while (fresh.replayCursor < continued.events.length) { fresh.replayStep(true); expect(fresh.replayError).toBeNull(); }
    expect(mechanical(fresh)).toEqual(continuedFinal);
    return { events: end, saves: keys.size, seek: [end, 0, middle, early, end], continuedEvents: continued.events.length, oos: 0 };
}
