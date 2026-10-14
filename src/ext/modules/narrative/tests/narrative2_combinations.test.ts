import { rng } from '../../../../engine/Random';
import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { logger } from '../../../../engine/Systems/Logger';
import { installedRelatedCombinations, missingPackages, verifyInstalledPackageFallback, verifyGameLifecycle } from '../../../../test/support/optionalPackageLifecycle';
import { N2_CASES, startDiagnostic, decide, choose, narrative as diagnosticNarrative } from './narrative2_rewardFixture';
import {
  continuingPrefix,
  checkpointExtensionDigest,
  extensionDigest,
  initialRecordingCheckpoint
} from '../../../../test/support/recordingV4';
import {
  captureNatural,
  EVIDENCE,
  json,
  lastAttempt,
  messages,
  narrative,
  newBudget,
  NPCS,
  readTrace,
  reconstruct,
  RouteFailure,
  routeStep,
  settle,
  world,
  writeEvidence
} from './narrative2_naturalFixture';
const optional = ['growth', 'combat', 'giants', 'crafting', 'foraging', 'settlement'];
// The normal tree still has the original nine rows/fixtures. A deleted tree
// retains each legal pair and one deduplicated all-remaining installation.
const rows = installedRelatedCombinations('narrative', optional)
  .map((ids) => ({ ids, name: 'combo-' + (ids.join('-') || 'empty') }));
afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
  logger.onDisturb = null;
});
if (missingPackages(['narrative', ...optional]).length) {
  it('N2-COMBO deletion layout rejects genuine original seven-pack save/replay and preserves the complete remaining-world lifecycle', () => {
    verifyInstalledPackageFallback(['narrative', ...optional]);
  }, 180000);
}
it.each(rows)(
  'N2-COMBO $name installed NPC/persistence lifecycle',
  async ({ ids, name }) => {
    if (ids.length > 2 && missingPackages(['narrative', ...optional]).length) {
      // The original seven-pack natural route cannot identify a different
      // generation tree. Refuse its genuine data; separately exercise all
      // installed packages and each unchanged NPC's complete dialogue/lifecycle
      // through the existing, explicitly named D1 diagnostic placement fixture.
      verifyInstalledPackageFallback(['narrative', ...optional]);
      for (const row of N2_CASES) {
        const { game } = startDiagnostic({ npcs: [row.npc], extensions: ids });
        expect(Object.keys(game.extensionRuntime!.snapshot().modules).sort()).toEqual([...ids].sort());
        const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.contentId === row.npc)!;
        const budget = newBudget();
        while (!game.extensionRuntime!.nearbyInteractables('narrative').some(entity => entity.id === target.id)) routeStep(game, budget, target);
        decide(game, row.npc, 'a'); choose(game, 'leave-a');
        expect(diagnosticNarrative(game).journal).toEqual([{ entryId: `${row.npc}.${row.a}.note`, order: 1 }]);
        expect(diagnosticNarrative(game).rewardReceipts).toContainEqual(expect.objectContaining({
          result: 'skipped', reason: ids.includes('growth') ? 'disabled' : 'absent'
        }));
        expect(diagnosticNarrative(game).active).toBeNull();
        verifyGameLifecycle(game);
      }
      return;
    }
    if (process.env.BROGUE_CAPTURE_NARRATIVE2_COMBOS === '1' && ids.length === 1) {
      // Exact same installed pack, seed, mode and commands already captured by N2-TRACE.
      writeFileSync(
        new URL(`../data/narrative2-${name}.trace.json`, import.meta.url),
        JSON.stringify(readTrace('five-wizard'), null, 2) + '\n'
      );
    } else if (process.env.BROGUE_CAPTURE_NARRATIVE2_COMBOS === '1') {
      mkdirSync(EVIDENCE, { recursive: true });
      const attempts: unknown[] = [];
      const targets = !ids.length
        ? []
        : ids.length === 1 || ids.length === 7
          ? NPCS.map((n) => n.id)
          : ['cord.mender'];
      let result: ReturnType<typeof captureNatural> | undefined;
      for (let seed = 1; seed <= 256; seed++) {
        try {
          result = captureNatural(seed, ids, 'wizard', targets);
          attempts.push({
            seed,
            ...(lastAttempt as object),
            events: result.trace.events,
            routeCommands: result.trace.routeCommands,
            dialogueCommands: result.trace.commands.filter(
              (c) => c.action === 'ext:command' && JSON.parse(String(c.data)).module === 'narrative'
            ).length,
            result: 'complete'
          });
          break;
        } catch (error) {
          if (!(error instanceof RouteFailure)) throw error;
          attempts.push({ seed, ...(lastAttempt as object), result: error.message });
          writeFileSync(`${EVIDENCE}/${name}-search.json`, JSON.stringify(attempts, null, 2));
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      writeFileSync(`${EVIDENCE}/${name}-search.json`, JSON.stringify(attempts, null, 2));
      expect(result).toBeDefined();
      writeEvidence(name, result!);
      writeFileSync(
        new URL(`../data/narrative2-${name}.trace.json`, import.meta.url),
        JSON.stringify(result!.trace, null, 2) + '\n'
      );
    }
    const data = reconstruct(readTrace(name)),
      game = data.game;
    const assertWorld = (expected: ReturnType<typeof world>, phase: string) => {
      const actual = world(game);
      if (
        process.env.BROGUE_CAPTURE_NARRATIVE2_COMBOS === '1' &&
        JSON.stringify(actual) !== JSON.stringify(expected)
      )
        writeFileSync(
          `${EVIDENCE}/${name}-${phase}-world.json`,
          JSON.stringify({ expected, actual })
        );
      expect(actual, `${name} ${phase}`).toEqual(expected);
    };
    expect([...data.input.modules].sort()).toEqual([...ids].sort());
    expect(Object.keys(game.extensionRuntime!.snapshot().modules).sort()).toEqual([...ids].sort());
    if (ids.includes('narrative')) {
      expect(narrative(game).journal).toHaveLength(ids.length === 1 || ids.length === 7 ? 5 : 1);
      expect(
        narrative(game).rewardReceipts.every(
          (r) =>
            r.result === 'skipped' && r.reason === (ids.includes('growth') ? 'disabled' : 'absent')
        )
      ).toBe(true);
      expect(narrative(game).active).toBeNull();
    } else expect(game.extensionRuntime!.snapshot().modules.narrative).toBeUndefined();
    const save = json(game.toSaveSnapshot()),
      middle = world(game),
      middleMessages = messages(game),
      prefix = json(game.exportRecording()),
      mid = prefix.events.length;
    expect(save.run.recordingOrigin).toBeDefined();
    expect(game.loadSnapshot(json(save))).toBe(true);
    game.animationEnabled = false;
    expect(game.hasCompleteRecording).toBe(true);
    assertWorld(middle, 'loaded');
    expect(messages(game)).toEqual(middleMessages);
    expect(game.exportRecording().events).toEqual(prefix.events);
    const before = { ...game.player.loc };
    if (ids.length) {
      const budget = newBudget();
      while (game.player.x === before.x && game.player.y === before.y)
        routeStep(game, budget, game.levelSeeds[game.depth - 1]!.downStairsLoc, 'stairs_down');
    } else {
      game.executeCommand('wait');
      settle(game);
    }
    game.executeCommand('wait');
    settle(game);
    const final = world(game),
      finalMessages = messages(game),
      recording = json(game.exportRecording()),
      continued = json(game.toSaveSnapshot());
    if (process.env.BROGUE_CAPTURE_NARRATIVE2_COMBOS === '1') {
      writeFileSync(`${EVIDENCE}/${name}-continued-recording.json`, JSON.stringify(recording));
      writeFileSync(`${EVIDENCE}/${name}-continued-save.json`, JSON.stringify(continued));
    }
    expect(recording.events.slice(0, mid)).toEqual(continuingPrefix(prefix));
    expect(recording.events.length).toBeGreaterThan(mid);
    const origin = initialRecordingCheckpoint(game);
    expect(game.loadReplay(recording)).toBe(true);
    game.animationEnabled = false;
    const initial = world(game),
      initialMessages = messages(game);
    expect(game.toSnapshot().rngState).toEqual(origin.rng);
    expect(extensionDigest(game.toSnapshot().extensions ?? null)).toBe(
      checkpointExtensionDigest(origin)
    );
    expect(game.absoluteTurnNumber).toBe(origin.turn);
    expect(game.toSnapshot().run.currentTick).toBe(origin.tick);
    for (const event of recording.events) {
      game.replayStep(true);
      expect(game.replayError).toBeNull();
      expect(game.replayCursor).toBe(event.index + 1);
      // Read-only observation: toSnapshot finalizes transient visibility and can mask replay drift.
      // Game.completeReplayEvent (Core/Game.ts:4530-4552) checks exact tick/depth/player,
      // inventory/decisions, full RNG and every protocol checkpoint before cursor advancement.
      expect(rng.getState()).toEqual(event.rng);
      expect(game.absoluteTurnNumber).toBe(event.turn);
      expect(extensionDigest(game.extensionRuntime?.snapshot() ?? null)).toBe(
        checkpointExtensionDigest(event)
      );
    }
    assertWorld(final, 'replayed');
    expect(messages(game).mechanical).toEqual(finalMessages.mechanical);
    for (const [index, expected, msg] of [
      [recording.events.length, final, finalMessages],
      [0, initial, initialMessages],
      [mid, middle, middleMessages],
      [recording.events.length, final, finalMessages]
    ] as const) {
      game.replaySeek(index);
      expect(game.replayError).toBeNull();
      expect(game.replayCursor).toBe(index);
      assertWorld(expected, `seek-${index}`);
      expect(messages(game).mechanical).toEqual(msg.mechanical);
    }
    expect(game.loadSnapshot(continued)).toBe(true);
    assertWorld(final, 'continued-loaded');
    const output = {
      name,
      seed: data.input.seed,
      modules: ids,
      targets: data.input.targets,
      births: data.input.births,
      events: recording.events.length,
      recordingBytes: Buffer.byteLength(JSON.stringify(recording)),
      oos: 0
    };
    if (process.env.BROGUE_CAPTURE_NARRATIVE2_COMBOS === '1')
      writeFileSync(`${EVIDENCE}/${name}-lifecycle.json`, JSON.stringify(output, null, 2));
  },
  900000
);
