import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { computeCheckpoint, type CheckpointJob, type CheckpointResult } from '../engine/Core/RecordingCheckpoint';
import { InlineRecordingBackend, WorkerRecordingBackend, type RecordingBackend } from '../engine/Core/RecordingBackend';
import { mechanicalDigest, digestRoot } from '../engine/Core/RecordingDigest';
import { DIGEST_DOMAINS } from '../engine/Core/RecordingV4';
import { rng } from '../engine/Random';
import { createExtensionRegistry } from '../ext/catalog';
import { timeSystem } from '../engine/Systems/Time';
import { getNextEntityId } from '../entities/Creature';
class DeferredBackend implements RecordingBackend {
  kind = 'deferred';
  jobs: { job: CheckpointJob; resolve(r: CheckpointResult): void; reject(e: Error): void }[] = [];
  enqueue(job: CheckpointJob): Promise<CheckpointResult> { return new Promise((resolve, reject) => this.jobs.push({ job, resolve, reject })); }
  complete(n: number, mutate?: (r: CheckpointResult) => void) { const p = this.jobs[n]!; const r = computeCheckpoint(p.job); mutate?.(r); p.resolve(r); }
  dispose() { for (const p of this.jobs) p.reject(new Error('cancelled')); }
}
const live: ReturnType<typeof createHeadlessGame>[] = [];
const game = () => { const g = createHeadlessGame(517); g.animationEnabled = false; live.push(g); return g; };
const command = (g: ReturnType<typeof game>, n: number) => { for (let i = 0; i < n; i++) g.executeCommand('escape'); };
const settle = async () => { for (let n = 0; n < 5; n++) await Promise.resolve(); };
afterEach(() => { live.splice(0).forEach(g => g.disposeRecording()); vi.restoreAllMocks(); });
describe('5Y complete frozen checkpoint pipeline', () => {
  it('keeps bytes and two 2048 snapshots identical at every specified boundary and repeated save/export/continuation', async () => {
    const run = async (asyncBackend: boolean) => {
      const g = game(); if (asyncBackend) g.configureRecordingBackend(() => new InlineRecordingBackend());
      const cuts = [0, 1, 255, 256, 257, 511, 512, 2047, 2048, 2049, 4096, 4097];
      const output = [];
      for (const cut of cuts) {
        while (g.recordedInputEvents.length < cut) { g.executeCommand('escape'); if (g.recordingInputBlocked) await g.flushRecording(); }
        const recording = asyncBackend ? await g.exportRecordingAsync() : g.exportRecording(); recording.recordedAt = 0;
        const again = asyncBackend ? await g.exportRecordingAsync() : g.exportRecording(); again.recordedAt = 0;
        expect(again).toEqual(recording);
        const without = asyncBackend ? await g.exportRecordingAsync({ includeSnapshots: false }) : g.exportRecording({ includeSnapshots: false });
        expect(without.events).toEqual(recording.events); expect(without.snapshots).toEqual([]);
        const save = asyncBackend ? await g.toSaveSnapshotAsync() : g.toSaveSnapshot();
        expect(save.run.recordingOrigin!.events).toEqual(recording.events);
        output.push(recording);
      }
      const recording = output[output.length - 1]!;
      expect(recording.snapshots.map(s => s.afterCommand)).toEqual([2048, 4096]);
      const random = rng.getState();
      expect(g.loadReplay(recording)).toBe(true);
      for (const cut of [4097, 2048, 1, 4096]) { await g.replaySeekAsync(cut); expect(g.replayError).toBeNull(); }
      g.replaySeek(4097); expect(rng.getState()).toEqual(random);
      return output;
    };
    expect(await run(true)).toEqual(await run(false));
  });
  it.each([['settlement'], ['settlement', 'combat'], ['growth', 'narrative', 'combat', 'giants', 'settlement', 'foraging', 'crafting']])('round trips real Game module composition %j through async save, continuation, replay and seek', async (...modules) => {
    const g = game(), registry = createExtensionRegistry();
    const initialCommands = registry.create(registry.manifest(modules)).flatMap(m => m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []);
    g.startNewGame({ seed: 27028, mode: 'wizard', ruleSet: 'extended', extensions: modules, initialCommands });
    g.configureRecordingBackend(() => new InlineRecordingBackend());
    while (g.recordedInputEvents.length < 257) { g.executeCommand('escape'); if (g.recordingInputBlocked) await g.flushRecording(); }
    const saved = await g.toSaveSnapshotAsync(); const a = await g.exportRecordingAsync();
    expect(g.loadSnapshot(saved)).toBe(true);
    command(g, 255); await g.flushRecording();
    const b = await g.exportRecordingAsync(), expected = mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState());
    expect(b.events[255]!.fullCheckpoint).toEqual(a.events[255]!.fullCheckpoint);
    expect(await g.loadReplayAsync(b)).toBe(true);
    for (const cut of [256, b.events.length, 0, 257, b.events.length]) { await g.replaySeekAsync(cut); expect(g.replayError).toBeNull(); }
    expect(mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState())).toEqual(expected);
  });
  it('freezes before live mutations, defers chains, accepts exactly once and gates before any tick/RNG/command', async () => {
    const g = game(), backend = new DeferredBackend(); g.configureRecordingBackend(() => backend);
    command(g, 256); const frozen = g.recordedInputEvents[255]!, expected = computeCheckpoint(backend.jobs[0]!.job);
    expect(frozen.fullCheckpoint).toBeNull(); expect(frozen.chainDigest).toBe('');
    expect(() => g.exportRecording()).toThrow('pending'); expect(() => g.toSaveSnapshot()).toThrow('pending');
    command(g, 256); const random = rng.getState(), tick = timeSystem.currentTick, index = g.recordedInputEvents.length;
    g.executeCommand('wait'); expect(g.recordedInputEvents.length).toBe(index); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    g.player.hp--; backend.complete(1); await settle(); expect(frozen.fullCheckpoint).toBeNull();
    backend.complete(0); await g.flushRecording(); expect(frozen.fullCheckpoint).toEqual(expected.full);
    expect(g.recordedInputEvents.every(e => e.chainDigest.length === 64)).toBe(true);
    expect(g.recordingMetrics.peakJobs).toBe(2); expect(g.recordingMetrics.peakBytes).toBeGreaterThan(0);
    expect(g.recordingInputBlocked).toBe(false);
    g.executeCommand('escape'); expect(g.recordedInputEvents.length).toBe(index + 1);
  });
  it('serializes multiple consumers at one cut and rejects a request cancelled by a new generation', async () => {
    const g = game(), backend = new DeferredBackend(); g.configureRecordingBackend(() => backend); command(g, 256);
    const save = g.toSaveSnapshotAsync(), first = g.exportRecordingAsync(), second = g.exportRecordingAsync();
    g.executeCommand('wait'); expect(g.recordedInputEvents.length).toBe(256);
    backend.complete(0);
    const [s, a, b] = await Promise.all([save, first, second]);
    expect(a.events).toEqual(b.events); expect(s.run.recordingOrigin!.events).toEqual(a.events);
    command(g, 256); const pending = g.exportRecordingAsync();
    const rejected = expect(pending).rejects.toThrow('generation replaced');
    g.startNewGame({ seed: 518 }); await rejected;
    backend.complete(1); await settle(); expect(g.recordedInputEvents.length).toBe(0); expect(g.recordingFailure).toBeNull();
  });
  it.each(['identity', 'full', 'event'] as const)('fails closed for %s rather than publishing/refreshing an invalid chunk', async kind => {
    const g = game(), backend = new DeferredBackend(); g.configureRecordingBackend(() => backend); command(g, 256);
    if (kind === 'event') g.recordedInputEvents[255]!.checkpoint = { root: '0'.repeat(64), domains: { extensions: '0'.repeat(64), world5: '0'.repeat(64), actorActions: '0'.repeat(64) } };
    backend.complete(0, r => { if (kind === 'identity') r.manifestFingerprint = 'bad'; if (kind === 'full') r.full.root = '0'.repeat(64); });
    await expect(g.flushRecording()).rejects.toThrow('integrity');
    expect(g.recordingFailure).toMatchObject({ fromCommand: 1, toCommand: 256 });
    expect(g.recordingAbortSignal.aborted).toBe(true);
    expect(g.recordedInputEvents[255]!.fullCheckpoint).toBeNull(); expect(g.recordedInputEvents[255]!.chainDigest).toBe('');
    expect(() => g.exportRecording()).toThrow('integrity'); await expect(g.toSaveSnapshotAsync()).rejects.toThrow('integrity');
    const random = rng.getState(); g.executeCommand('wait'); expect(g.recordedInputEvents.length).toBe(256); expect(rng.getState()).toEqual(random);
  });
  it('refuses a damaged 2048 snapshot result before snapshot publication and retains the verified 1792 frontier', async () => {
    const g = game(), backend = new DeferredBackend(); g.configureRecordingBackend(() => backend);
    for (let cut = 0; cut < 7; cut++) { command(g, 256); backend.complete(cut); await g.flushRecording(); }
    command(g, 256); backend.complete(7, r => { r.snapshotDigest = 'damaged'; });
    await expect(g.flushRecording()).rejects.toThrow('integrity');
    expect(g.recordingFailure).toMatchObject({ fromCommand: 1793, toCommand: 2048 });
    expect(g.recordedInputEvents[2047]!.fullCheckpoint).toBeNull();
    expect(() => g.exportRecording()).toThrow('integrity');
  });
  it('holds playback cadence during an async consumer fence without consuming an event, tick or RNG', async () => {
    const g = game(); command(g, 4); const recording = g.exportRecording(); expect(g.loadReplay(recording)).toBe(true);
    g.replayPlay(); const random = rng.getState(), tick = timeSystem.currentTick;
    const pending = g.flushRecording(); g.tickReplay(1000);
    expect(g.replayCursor).toBe(0); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    await pending; g.tickReplay(100); expect(g.replayCursor).toBe(1); expect(g.replayError).toBeNull();
  });
  it('fails closed on synchronous freeze failure before a backend job exists', () => {
    const g = game(); g.configureRecordingBackend(() => new InlineRecordingBackend()); command(g, 255);
    vi.spyOn(g as any, 'projectWholeRun').mockImplementation(() => { throw new Error('freeze failure'); });
    expect(() => g.executeCommand('escape')).toThrow('freeze failure');
    expect(g.recordingFailure).toMatchObject({ fromCommand: 1, toCommand: 256, domain: 'projection' });
    g.executeCommand('wait'); expect(g.recordedInputEvents).toHaveLength(256);
    expect(() => g.toSaveSnapshot()).toThrow('integrity');
  });
  it('preserves a pending live session on bad load and refuses root tampering despite valid-looking domains', async () => {
    const g = game(), backend = new DeferredBackend(), saved = g.toSaveSnapshot(), recording = g.exportRecording();
    g.configureRecordingBackend(() => backend); command(g, 256);
    const player = g.player, generation = g.recordingGeneration, bad = g.toSnapshot(); bad.schema = 'bad' as any;
    const allocator = getNextEntityId(), random = rng.getState(), tick = timeSystem.currentTick;
    expect(() => g.loadSnapshot(saved)).toThrow('pending'); expect(() => g.loadReplay(recording)).toThrow('pending');
    expect(getNextEntityId()).toBe(allocator); expect(rng.getState()).toEqual(random); expect(timeSystem.currentTick).toBe(tick);
    expect(g.loadSnapshot(bad)).toBe(false); expect(g.loadReplay({})).toBe(false);
    expect(g.player).toBe(player); expect(g.recordingGeneration).toBe(generation);
    backend.complete(0); await g.flushRecording(); expect(g.recordingFailure).toBeNull();
  });
  it('keeps no-Worker public synchronous path and the pure independent full oracle', () => {
    const g = game(); command(g, 256);
    const r = g.exportRecording();
    expect(r.events[255]!.fullCheckpoint).toEqual(mechanicalDigest(g.toSnapshot(), (g as any).recordingInputState()));
    expect(r.events[255]!.fullCheckpoint!.root).toBe(digestRoot(r.events[255]!.fullCheckpoint!.domains, r.extensions, DIGEST_DOMAINS));
  });
  it.each(['construction', 'post', 'crash', 'timeout'] as const)('downgrades only transport %s once from retained bytes', async mode => {
    const g = game(); let worker: any, terminated = 0;
    const backend = new WorkerRecordingBackend(5, () => {
      if (mode === 'construction') throw new Error('unsupported');
      worker = { postMessage() { if (mode === 'post') throw new Error('post'); }, terminate() { terminated++; } }; return worker;
    });
    g.configureRecordingBackend(() => backend); command(g, 256);
    if (mode === 'crash') worker.onerror();
    await g.flushRecording(); expect(backend.kind).toBe('inline-fallback');
    expect(g.recordingFailure).toBeNull(); expect(g.recordedInputEvents[255]!.fullCheckpoint).not.toBeNull();
    expect(terminated).toBe(mode === 'construction' ? 0 : 1);
  });

  it('R1-F1 ignores completed messages across 128 to 129, including repeated boundaries and out-of-order completion', async () => {
    const g = game();
    const template: CheckpointJob = { generation: 17, boundaryCommand: 256, previousVerifiedBoundary: 0,
      codecIdentity: 'protocol-test', manifestFingerprint: 'protocol-test', snapshot: false,
      bytes: new TextEncoder().encode(JSON.stringify(g.toSnapshot())), inputState: (g as any).recordingInputState(), checkpoint: null };
    const full = computeCheckpoint(template);
    type WireJob = CheckpointJob & { requestId: number };
    let worker: any, sent!: WireJob, terminated = 0;
    const backend = new WorkerRecordingBackend(30000, () => worker = {
      postMessage(job: WireJob) { sent = job; }, terminate() { terminated++; }
    } as any);
    const response = (job: WireJob) => ({ requestId: job.requestId, result: { ...full,
      generation: job.generation, boundaryCommand: job.boundaryCommand,
      previousVerifiedBoundary: job.previousVerifiedBoundary, codecIdentity: job.codecIdentity,
      manifestFingerprint: job.manifestFingerprint, snapshot: job.snapshot } });
    let first!: ReturnType<typeof response>, last!: ReturnType<typeof response>;
    try {
      for (let n = 1; n <= 130; n++) {
        const result = backend.enqueue({ ...template, boundaryCommand: n * 256 });
        if (n === 129 || n === 130) worker.onmessage({ data: first });
        last = response(sent); if (n === 1) first = last;
        worker.onmessage({ data: last });
        await expect(result).resolves.toMatchObject({ full: full.full, boundaryCommand: n * 256 });
      }
      // The same mechanical boundary can be submitted again; stale messages
      // must not satisfy either of the two distinct current requests.
      const left = backend.enqueue({ ...template, boundaryCommand: 130 * 256 }), leftMessage = response(sent);
      const right = backend.enqueue({ ...template, boundaryCommand: 130 * 256 }), rightMessage = response(sent);
      let leftDone = false, rightDone = false;
      void left.then(() => { leftDone = true; }); void right.then(() => { rightDone = true; });
      worker.onmessage({ data: last }); worker.onmessage({ data: first }); await settle();
      expect(leftDone).toBe(false); expect(rightDone).toBe(false);
      worker.onmessage({ data: rightMessage }); await right;
      expect(leftDone).toBe(false);
      worker.onmessage({ data: rightMessage }); worker.onmessage({ data: leftMessage }); await left;
      expect(terminated).toBe(0); expect(backend.fallbackReason).toBeNull();
    } finally { backend.dispose(); }
  });
  it('R1-F1 preserves real Game frequent non-periodic exports beyond 129 jobs and ignores late repeats', async () => {
    type WireJob = CheckpointJob & { requestId: number };
    const g = game(); let worker: any, sent!: WireJob, count = 0, terminated = 0;
    const backend = new WorkerRecordingBackend(30000, () => worker = {
      postMessage(job: WireJob) { sent = job; count++; }, terminate() { terminated++; }
    } as any);
    g.configureRecordingBackend(() => backend);
    let first!: { requestId: number; result: CheckpointResult }, latest!: ReturnType<typeof g.exportRecording>;
    for (let cut = 1; cut <= 131; cut++) {
      g.executeCommand('escape'); const pending = g.exportRecordingAsync(); await settle();
      expect(count).toBe(cut); expect(sent.boundaryCommand).toBe(cut);
      const message = { requestId: sent.requestId, result: computeCheckpoint(sent) };
      if (cut === 1) first = message;
      if (cut >= 129) worker.onmessage({ data: first });
      worker.onmessage({ data: message }); latest = await pending;
      const again = await g.exportRecordingAsync();
      latest.recordedAt = 0; again.recordedAt = 0;
      expect(again).toEqual(latest); expect(count).toBe(cut);
      expect(g.recordingFailure).toBeNull(); expect(g.recordingInputBlocked).toBe(false);
    }
    expect(terminated).toBe(0); expect(backend.fallbackReason).toBeNull();
    expect(g.recordingMetrics.peakJobs).toBe(1);
    const random = rng.getState(); g.disposeRecording();
    const reference = game(); command(reference, 131);
    const expected = reference.exportRecording(); expected.recordedAt = 0;
    expect(latest).toEqual(expected); expect(rng.getState()).toEqual(random);
  });
  it.each(['unissued request', 'missing request', 'codec', 'future generation'] as const)('R1-F1 keeps current %s failures closed after request routing', async kind => {
    const g = game(); let worker: any, sent!: CheckpointJob & { requestId: number };
    const backend = new WorkerRecordingBackend(30000, () => worker = {
      postMessage(job: typeof sent) { sent = job; }, terminate() {}
    } as any);
    g.configureRecordingBackend(() => backend); command(g, 256);
    const result = computeCheckpoint(sent);
    if (kind === 'codec') result.codecIdentity = 'bad';
    if (kind === 'future generation') result.generation++;
    worker.onmessage({ data: { requestId: kind === 'missing request' ? undefined
      : kind === 'unissued request' ? sent.requestId + 1 : sent.requestId, result } });
    await expect(g.flushRecording()).rejects.toThrow('integrity');
    expect(g.recordingFailure).toMatchObject({ fromCommand: 1, toCommand: 256 });
    expect(g.recordedInputEvents[255]!.fullCheckpoint).toBeNull();
    expect(g.recordedInputEvents[255]!.chainDigest).toBe('');
    expect(backend.fallbackReason).toBeNull();
  });
  it('ignores duplicate and old-generation worker messages, fails an unknown current identity without inline recovery', async () => {
    const g = game(); let worker: any; const sent: (CheckpointJob & { requestId: number })[] = [];
    const backend = new WorkerRecordingBackend(30000, () => worker = { postMessage(job: CheckpointJob & { requestId: number }) { sent.push(job); }, terminate() {} } as any);
    g.configureRecordingBackend(() => backend); command(g, 512);
    const r = computeCheckpoint(sent[0]!); worker.onmessage({ data: { requestId: sent[0]!.requestId, result: { ...r, generation: r.generation - 1 } } });
    expect(g.recordedInputEvents[255]!.fullCheckpoint).toBeNull();
    worker.onmessage({ data: { requestId: sent[0]!.requestId, result: r } }); await settle();
    worker.onmessage({ data: { requestId: sent[0]!.requestId, result: r } });
    worker.onmessage({ data: { requestId: sent[1]!.requestId, result: { ...r, boundaryCommand: 900 } } });
    await expect(g.flushRecording()).rejects.toThrow('integrity'); expect(backend.fallbackReason).toBeNull();
  });
});
