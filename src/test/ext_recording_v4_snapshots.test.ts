import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from './harness';
import { boundedSnapshots } from '../engine/Core/RecordingFormat';
import { DIGEST_DOMAINS, SNAPSHOT_BYTES, type ReplaySnapshotV4 } from '../engine/Core/RecordingV4';
import { digestRoot, mechanicalDigest } from '../engine/Core/RecordingDigest';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { logger } from '../engine/Systems/Logger';
import { rechain, continuingPrefix } from './support/recordingV4';
const input = {
  inventoryOpen: false,
  inventoryAction: null,
  referenceScreen: null,
  arcana: null,
  throwItemId: null,
  pendingUseConfirmId: null
};
afterEach(() => vi.restoreAllMocks());
describe('C5 recording periodic snapshots and prefix boundaries', () => {
  it('review L5: a throwing seed candidate leaves the current graph intact and reports a localized warning', () => {
    const g = createHeadlessGame(517); g.executeCommand('wait');
    expect(g.loadReplay(g.exportRecording())).toBe(true);
    const player = g.player, grid = g.grid, before = g.toSnapshot();
    vi.spyOn(g as any, 'withReplayCandidate').mockImplementation(() => { throw new Error('internal detail'); });
    expect(() => g.replaySeek(1)).not.toThrow();
    expect(g.player).toBe(player); expect(g.grid).toBe(grid);
    const after = g.toSnapshot(); after.savedAt = before.savedAt;
    expect(after).toEqual(before);
    expect(g.replayWarnings).toHaveLength(1);
    expect(g.replayWarnings[0]).not.toContain('internal detail');
    expect(logger.displayMessages[logger.displayMessages.length - 1]?.text).toBe(g.replayWarnings[0]);
  });
  it('keeps classic events cheap and captures safe world-only snapshots at exact 256/2048 boundaries', () => {
    const g = createHeadlessGame(517);
    const capture = [0, 1, 255, 256, 257, 2047, 2048, 2049, 4096],
      rows = new Map<number, ReturnType<typeof g.exportRecording>>();
    rows.set(0, g.exportRecording());
    for (let count = 1; count <= 4096; count++) {
      g.executeCommand('escape');
      if (capture.includes(count)) rows.set(count, g.exportRecording());
    }
    for (const count of capture) {
      const r = rows.get(count)!;
      expect(r.events).toHaveLength(count);
      expect(r.events.every((e) => e.checkpoint === null)).toBe(true);
      expect(r.snapshots.map((s) => s.afterCommand)).toEqual(
        count < 2048 ? [] : count < 4096 ? [2048] : [2048, 4096]
      );
      for (let index = 255; index < count; index += 256)
        expect(r.events[index]!.fullCheckpoint).not.toBeNull();
      if (count) expect(r.events[count - 1]!.fullCheckpoint).not.toBeNull();
      for (const snapshot of r.snapshots) {
        expect(snapshot.world.run).not.toHaveProperty('recordingOrigin');
        expect(snapshot.world.run).not.toHaveProperty('recordedInputEvents');
        expect(snapshot.world).not.toHaveProperty('snapshots');
      }
    }
    const recording = rows.get(2049)!;
    expect(g.loadReplay(recording)).toBe(true);
    const observed = vi.spyOn(g as any, 'startReplayUnchecked');
    g.replaySeek(2049);
    expect(g.replayError).toBeNull();
    const expected = mechanicalDigest(g.toSnapshot(), input);
    expect(g.replayCursor).toBe(2049);
    expect(observed).not.toHaveBeenCalled(); // Seed verification happens inside a candidate, before publishing its recovered world.
    g.replaySeek(2048);
    expect(g.replayError).toBeNull();
    expect(g.replayCursor).toBe(2048);
    g.replaySeek(0); // A seed-only seek must retain already verified acceleration entries.
    const seedStarts = vi.spyOn(Object.getPrototypeOf(g), 'startReplayUnchecked');
    g.replaySeek(2048);
    expect(seedStarts).not.toHaveBeenCalled();
    seedStarts.mockRestore();
    const bad = structuredClone(recording);
    bad.snapshots[0]!.world.player.hp--;
    expect(g.loadReplay(bad)).toBe(true);
    observed.mockClear();
    g.replaySeek(2049);
    expect(g.replayError).toBeNull();
    expect(mechanicalDigest(g.toSnapshot(), input)).toEqual(expected);
    expect(observed).not.toHaveBeenCalled();
    expect(g.replayWarnings).toHaveLength(1);
    for (const domain of ['native', 'knowledge'] as const) {
      const altered = structuredClone(recording), event = altered.events[2048]!;
      event.fullCheckpoint!.domains[domain] = '0'.repeat(64);
      event.fullCheckpoint!.root = digestRoot(event.fullCheckpoint!.domains, altered.extensions, DIGEST_DOMAINS);
      rechain(altered);
      expect(g.loadReplay(altered)).toBe(true);
      g.replaySeek(2048); // External snapshot is verified from seed before publication.
      expect(g.replayError).toBeNull();
      g.replayStep(true);
      const diagnostic = { command: 2049, domain, tick: event.tick, player: event.player,
        precision: 'interval', previousVerifiedBoundary: 2048, interval: { fromCommand: 2049, toCommand: 2049 } };
      expect(g.replayDiagnostic).toEqual(diagnostic);
      g.replaySeek(2048); // Now using a trusted cache; the verified boundary must survive publication.
      expect(g.replayDiagnostic).toBeNull();
      g.replayStep(true);
      expect(g.replayDiagnostic).toEqual(diagnostic);
      g.replaySeek(2049); // Tail OOS in the candidate also survives seed fallback and publication.
      expect(g.replayCursor).toBe(2048);
      expect(g.replayDiagnostic).toEqual(diagnostic);
      const damaged = structuredClone(altered);
      damaged.snapshots[0]!.world.player.hp--;
      expect(g.loadReplay(damaged)).toBe(true);
      g.replaySeek(2049);
      expect(g.replayWarnings).toHaveLength(1);
      expect(g.replayDiagnostic).toEqual(diagnostic);
    }
  });
  it('evicts oldest acceleration entries by count and encoded bytes, leaving inputs untouched', () => {
    const row = (afterCommand: number, padding = '') =>
      ({ afterCommand, world: { padding } }) as unknown as ReplaySnapshotV4;
    const count = boundedSnapshots(Array.from({ length: 129 }, (_, i) => row((i + 1) * 2048)));
    expect(count).toHaveLength(128);
    expect(count[0]!.afterCommand).toBe(4096);
    const large = 'x'.repeat(1024 * 1024);
    const bytes = boundedSnapshots(
      Array.from({ length: 66 }, (_, i) => row((i + 1) * 2048, large))
    );
    expect(bytes.length).toBeLessThan(66);
    expect(bytes[bytes.length - 1]!.afterCommand).toBe(66 * 2048);
    expect(boundedSnapshots([row(2048, 'x'.repeat(SNAPSHOT_BYTES + 1))])).toEqual([]);
  });
  it('branches a replay save at its verified prefix and continues without the old suffix', () => {
    const g = createHeadlessGame(517);
    for (let i = 0; i < 5; i++) g.executeCommand('escape');
    const original = g.exportRecording();
    expect(g.loadReplay(original)).toBe(true);
    g.replaySeek(2);
    const save = g.toSaveSnapshot();
    expect(save.run.recordingOrigin!.events).toHaveLength(2);
    expect(save.run).not.toHaveProperty('recordedInputEvents');
    expect(g.loadSnapshot(save)).toBe(true);
    g.executeCommand('wait');
    const branch = g.exportRecording();
    expect(branch.events.map((e) => e.action)).toEqual(['escape', 'escape', 'wait']);
    expect(branch.snapshots).toEqual([]);
    expect(g.loadReplay(branch)).toBe(true);
    while (g.replayCursor < branch.events.length && !g.replayError) g.replayStep(true);
    expect(g.replayError).toBeNull();
    const wrong = structuredClone(branch);
    wrong.events[2]!.fullCheckpoint!.domains.native = '0'.repeat(64);
    rechain(wrong);
    expect(g.loadReplay(wrong)).toBe(false);
  });
  it.each(['arcana', 'pendingUseConfirm'] as const)(
    'preserves an active %s modal through save/load and branch continuation in a controlled native-item fixture',
    (modal) => {
      const setup = (g: ReturnType<typeof createHeadlessGame>) => {
        const item =
          modal === 'arcana'
            ? ItemLoader.spawnWand('wand_of_slowness', -1, -1)!
            : ItemLoader.spawnPotion('potion_of_darkness', -1, -1)!;
        ItemLoader.identifyItemKind(item);
        item.identified = true;
        g.player.inventory.addItem(item);
        return item;
      };
      const g = createHeadlessGame(517),
        item = setup(g);
      g.executeItemCommand(modal === 'arcana' ? 'use' : 'quaff', item);
      if (modal === 'arcana') expect(g.pendingArcana?.item.id).toBe(item.id);
      else expect(g.pendingUseConfirm?.id).toBe(item.id);
      const save = g.toSaveSnapshot(),
        prefix = g.exportRecording();
      expect(save.run.recordingOrigin).toBeDefined();
      expect(g.loadSnapshot(save)).toBe(true);
      if (modal === 'arcana') expect(g.pendingArcana?.item.id).toBe(item.id);
      else expect(g.pendingUseConfirm?.id).toBe(item.id);
      g.executeCommand('escape');
      const continued = g.exportRecording(),
        expected = mechanicalDigest(g.toSnapshot(), input);
      expect(continued.events.slice(0, prefix.events.length)).toEqual(continuingPrefix(prefix));
      expect(g.loadReplay(continued)).toBe(true);
      setup(g);
      while (g.replayCursor < continued.events.length && !g.replayError) g.replayStep(true);
      expect(g.replayError).toBeNull();
      expect(mechanicalDigest(g.toSnapshot(), input)).toEqual(expected);
    }
  );
  it('keeps every event and chain independent of intervening saves and exports', () => {
    const run = (saveOften: boolean) => {
      const g = createHeadlessGame(517);
      for (let i = 0; i < 7; i++) {
        g.executeCommand('wait');
        if (saveOften && i < 6) { g.toSaveSnapshot(); g.exportRecording(); }
      }
      const r = g.exportRecording(); r.recordedAt = 0; return r;
    };
    expect(run(true)).toEqual(run(false));
  });
  it.each(['native', 'knowledge'] as const)('reports an interval for indistinguishable hidden %s changes at different commands', (domain) => {
    const record = (changedAt: number) => {
      const g = createHeadlessGame(517);
      for (let index = 0; index < 2; index++)
        g.executeCommand('escape', undefined, () => {
          if (index === changedAt) {
            if (domain === 'native') (g as any).foodSpawned = 30;
            else ItemLoader.identifiedItems.add('potion_of_darkness');
          }
        });
      const r = g.exportRecording();
      r.recordedAt = 0;
      return r;
    };
    // The same file can describe a hidden change at command 1 or command 2.
    const a = record(0), b = record(1);
    expect(a).toEqual(b);
    const g = createHeadlessGame(517);
    for (const recording of [a, b]) {
      expect(g.loadReplay(recording)).toBe(true);
      while (g.replayCursor < recording.events.length && !g.replayError) g.replayStep(true);
      expect(g.replayCursor).toBe(1);
      expect(g.replayDiagnostic).toEqual({ command: 2, domain, tick: recording.events[1]!.tick,
        player: recording.events[1]!.player, precision: 'interval', previousVerifiedBoundary: 0,
        interval: { fromCommand: 1, toCommand: 2 } });
    }
  });
  it.each(['native', 'knowledge'] as const)('retains the preceding verified chunk for hidden %s OOS and resets it on restart', (domain) => {
    const g = createHeadlessGame(517);
    for (let index = 0; index < 258; index++) g.executeCommand('escape', undefined, () => {
      if (index === 256) {
        if (domain === 'native') (g as any).foodSpawned = 30;
        else ItemLoader.identifiedItems.add('potion_of_darkness');
      }
    });
    const recording = g.exportRecording(), event = recording.events[257]!;
    expect(g.loadReplay(recording)).toBe(true);
    while (g.replayCursor < recording.events.length && !g.replayError) g.replayStep(true);
    const diagnostic = { command: 258, domain, tick: event.tick, player: event.player,
      precision: 'interval', previousVerifiedBoundary: 256, interval: { fromCommand: 257, toCommand: 258 } };
    expect(g.replayDiagnostic).toEqual(diagnostic);
    expect(g.replayError).toContain('previous verified boundary 256');
    expect(g.replayError).toContain('possible divergence commands 257..258');
    g.replaySeek(257);
    expect(g.replayError).toBeNull();
    expect(g.replayDiagnostic).toBeNull();
    g.replayStep(true);
    expect(g.replayDiagnostic).toEqual(diagnostic);
    g.replayRestart();
    expect(g.replayCursor).toBe(0);
    expect(g.replayDiagnostic).toBeNull();
    // Add a legal extra full boundary at command 2 to distinguish the new run's
    // verified initial boundary from the previous playback's command 256.
    const short = structuredClone(recording);
    short.events = short.events.slice(0, 2);
    short.events[1]!.fullCheckpoint = structuredClone(recording.initialDigest);
    short.events[1]!.fullCheckpoint!.domains[domain] = '0'.repeat(64);
    short.events[1]!.fullCheckpoint!.root = digestRoot(short.events[1]!.fullCheckpoint!.domains, short.extensions, DIGEST_DOMAINS);
    rechain(short);
    expect(g.loadReplay(short)).toBe(true);
    g.replayStep(true); g.replayStep(true);
    expect(g.replayDiagnostic?.previousVerifiedBoundary).toBe(0);
    expect(g.replayDiagnostic?.interval).toEqual({ fromCommand: 1, toCommand: 2 });
    g.clearReplay();
    expect(g.replayDiagnostic).toBeNull();
  });
});
