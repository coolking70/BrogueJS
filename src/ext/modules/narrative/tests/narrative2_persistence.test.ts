import { rng } from '../../../../engine/Random';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { Game, GameRecording } from '../../../../engine/Core/Game';
import { createHeadlessGame } from '../../../../test/harness';
import {
  continuingPrefix,
  checkpointExtensionDigest,
  extensionDigest
} from '../../../../test/support/recordingV4';
import { logger } from '../../../../engine/Systems/Logger';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import {
  approach,
  command,
  descend,
  EVIDENCE,
  execute,
  json,
  messages,
  narrative,
  newBudget,
  NPCS,
  playDialogue,
  readTrace,
  reconstruct,
  routeStep,
  settle,
  startNarrative,
  target,
  world,
  type SavedPoint
} from './narrative2_naturalFixture';
afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
  logger.onDisturb = null;
});
const cache = new Map<string, ReturnType<typeof reconstruct>>();
const captured = () => {
  if (!cache.has('five')) cache.set('five', reconstruct(readTrace('five-wizard')));
  return cache.get('five')!;
};
export function replay(game: Game, recording: GameRecording) {
  expect(game.loadReplay(json(recording))).toBe(true);
  game.animationEnabled = false;
  for (const event of recording.events) {
    game.replayStep(true);
    expect(game.replayError, `event ${event.index}`).toBeNull();
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
}
function assertPoint(game: Game, point: SavedPoint) {
  expect(world(game)).toEqual(point.world);
  // Replay presents a transport notice separately; compare the genuine mechanical message archive.
  expect(messages(game).mechanical).toEqual(point.messages.mechanical);
}
function loaded(point: SavedPoint) {
  const game = createHeadlessGame(201, 'test');
  expect(game.loadSnapshot(json(point.save))).toBe(true);
  game.animationEnabled = false;
  expect(game.hasCompleteRecording).toBe(true);
  assertPoint(game, point);
  expect(game.toSaveSnapshot().run.recordingOrigin).toEqual(point.save.run.recordingOrigin);
  return game;
}
it('N2-PERSIST genuine zero save resumes the full five-NPC route and recording', () => {
  const data = captured(),
    point = data.points.get(0)!,
    game = loaded(point);
  expect(game.exportRecording().events).toEqual([]);
  for (const event of data.recording.events) execute(game, event);
  assertPoint(game, data.points.get(data.input.events)!);
  expect({ ...game.exportRecording(), recordedAt: 0 }).toEqual({
    ...data.recording,
    recordedAt: 0
  });
  const recording = json(game.exportRecording());
  replay(game, recording);
  assertPoint(game, data.points.get(data.input.events)!);
}, 240000);
for (const npc of NPCS)
  describe(`N2-PERSIST ${npc.id}`, () => {
    it('continues arrival/open/decision/ending/close/recall saves and keeps recording origin and prefix', () => {
      const data = captured(),
        cuts = data.input.checkpoints.filter((p) => p.label.startsWith(npc.id + ':'));
      const end = cuts.find((p) => p.label.endsWith(':finished'))!;
      for (const cut of cuts) {
        const point = data.points.get(cut.index)!,
          game = loaded(point);
        expect(messages(game)).toEqual(point.messages);
        const prefix = json(game.exportRecording());
        for (const event of data.recording.events.slice(cut.index, end.index)) execute(game, event);
        assertPoint(game, data.points.get(end.index)!);
        const recording = json(game.exportRecording());
        expect(recording.events.slice(0, cut.index)).toEqual(
          cut.index === end.index ? prefix.events : continuingPrefix(prefix)
        );
        expect(
          recording.events.map(({ action, data, decisions }) => ({ action, data, decisions }))
        ).toEqual(data.input.commands.slice(0, end.index));
      }
      // Each NPC's real continued save is replayed from the original fresh game.
      const decision = cuts.find((p) => p.label.endsWith(':decision'))!,
        game = loaded(data.points.get(decision.index)!);
      for (const event of data.recording.events.slice(decision.index, end.index))
        execute(game, event);
      const continued = json(game.exportRecording());
      replay(game, continued);
      assertPoint(game, data.points.get(end.index)!);
    }, 240000);
    it('replays and nonmonotonically seeks every full checkpoint including initial zero', () => {
      const data = captured(),
        cuts = data.input.checkpoints.filter((p) => p.label.startsWith(npc.id + ':'));
      const end = cuts.find((p) => p.label.endsWith(':finished'))!,
        game = loaded(data.points.get(end.index)!);
      const recording = json(game.exportRecording());
      replay(game, recording);
      assertPoint(game, data.points.get(end.index)!);
      const by = (s: string) => cuts.find((p) => p.label.endsWith(':' + s))!.index;
      for (const index of [
        end.index,
        0,
        by('decision'),
        by('open'),
        by('ending'),
        by('recall'),
        end.index
      ]) {
        game.replaySeek(index);
        expect(game.replayError).toBeNull();
        expect(game.replayCursor).toBe(index);
        assertPoint(game, data.points.get(index)!);
      }
    }, 240000);
    it('branches B from the genuine decision save, closes and recalls without duplicate rewards', () => {
      const data = captured(),
        decision = data.input.checkpoints.find((p) => p.label === `${npc.id}:decision`)!,
        game = loaded(data.points.get(decision.index)!);
      const id = narrative(game).active!.targetEntityId;
      command(game, 'choose', 'choose-b');
      command(game, 'choose', 'leave-b');
      command(game, 'open', id);
      command(game, 'choose', 'recall-b');
      command(game, 'choose', 'leave-recall-b');
      expect(narrative(game).flags[`${npc.id}.verdict`]).toBe(npc.b);
      expect(
        narrative(game)
          .journal.filter((j) => j.entryId.startsWith(npc.id + '.'))
          .map((j) => j.entryId)
      ).toEqual([`${npc.id}.${npc.b}.note`]);
      expect(
        narrative(game).rewardReceipts.filter((r) => r.id === `${npc.id}.reward.receipt`)
      ).toHaveLength(1);
      const endpoint = world(game),
        m = messages(game),
        recording = json(game.exportRecording());
      if (process.env.NARRATIVE2_WRITE_EVIDENCE === '1') {
        mkdirSync(EVIDENCE, { recursive: true });
        writeFileSync(`${EVIDENCE}/${npc.id}-ending-b-recording.json`, JSON.stringify(recording));
      }
      replay(game, recording);
      expect(world(game)).toEqual(endpoint);
      expect(messages(game).mechanical).toEqual(m.mechanical);
    }, 240000);
  });
it.each(NPCS)(
  'N2-PERSIST $id cross-floor revisit preserves stationary bindings, outcomes and all reward receipts',
  (npc) => {
    const data = captured(),
      end = data.input.checkpoints.find((p) => p.label === `${npc.id}:finished`)!,
      game = loaded(data.points.get(end.index)!);
    const entity = json(target(game, npc.id)!),
      state = json(narrative(game)),
      budget = newBudget(),
      depth = game.depth;
    while (game.depth === depth)
      routeStep(game, budget, game.levelSeeds[depth - 1]!.upStairsLoc, 'stairs_up');
    expect(game.depth).toBe(depth - 1);
    descend(game, depth, budget);
    expect(target(game, npc.id)).toEqual(entity);
    expect(narrative(game).npcBindings).toEqual(state.npcBindings);
    expect(narrative(game).placementReceipts).toEqual(state.placementReceipts);
    expect(narrative(game).flags).toEqual(state.flags);
    expect(narrative(game).journal).toEqual(state.journal);
    expect(narrative(game).rewardReceipts).toEqual(state.rewardReceipts);
    approach(game, npc.id, budget);
    command(game, 'open', entity.id);
    const open = narrative(game).active!;
    expect(open.nodeId).toBe('hello');
    command(game, 'choose', 'recall-a');
    command(game, 'choose', 'leave-recall-a');
    expect(narrative(game).flags).toEqual(state.flags);
    expect(narrative(game).journal).toEqual(state.journal);
    expect(narrative(game).rewardReceipts).toEqual(state.rewardReceipts);
    const point = {
      save: json(game.toSaveSnapshot()),
      world: world(game),
      messages: messages(game)
    };
    const continued = loaded(point),
      recording = json(continued.exportRecording());
    replay(continued, recording);
    assertPoint(continued, point);
  },
  240000
);
it('N2-PERSIST rejects genuine old1.4 save/replay, tampered identity/state and absent module atomically', () => {
  const data = captured(),
    game = loaded(data.points.get(data.input.events)!),
    before = world(game),
    origin = json(game.exportRecording()),
    player = game.player,
    runtime = game.extensionRuntime;
  const unchanged = () => {
    expect(game.player).toBe(player);
    expect(game.extensionRuntime).toBe(runtime);
    expect(world(game)).toEqual(before);
    expect({ ...game.exportRecording(), recordedAt: 0 }).toEqual({ ...origin, recordedAt: 0 });
  };
  const oldRecording = JSON.parse(
    readFileSync(new URL('../data/narrative2-old14.trace.json', import.meta.url), 'utf8')
  ).recording;
  expect(game.loadReplay(oldRecording)).toBe(false);
  unchanged();
  // The genuine 1.97 MB old save is deliberately kept outside the repository.
  // Development acceptance supplies its explicit path; ordinary regression uses the genuine old recording above.
  if (process.env.NARRATIVE2_OLD_SAVE) {
    expect(existsSync(process.env.NARRATIVE2_OLD_SAVE)).toBe(true);
    expect(
      game.loadSnapshot(JSON.parse(readFileSync(process.env.NARRATIVE2_OLD_SAVE, 'utf8')))
    ).toBe(false);
    unchanged();
  }
  const good = json(game.toSaveSnapshot());
  const mutations = [
    (s: typeof good) => {
      (s.extensions!.modules.narrative as unknown as ReturnType<typeof narrative>).flags[
        'cord.mender.verdict'
      ] = 'invalid';
    },
    (s: typeof good) => {
      (
        s.extensions!.modules.narrative as unknown as ReturnType<typeof narrative>
      ).journal[0]!.entryId = 'missing';
    },
    (s: typeof good) => {
      (
        s.extensions!.modules.narrative as unknown as ReturnType<typeof narrative>
      ).rewardReceipts[0]!.instanceKey = 'missing';
    },
    (s: typeof good) => {
      const bindings = (s.extensions!.modules.narrative as unknown as ReturnType<typeof narrative>)
        .npcBindings;
      bindings[Object.keys(bindings)[0]!]!.npcId = 'missing';
    },
    (s: typeof good) => {
      s.extensions!.manifest.modules.find((m) => m.id === 'narrative')!.rules!.fingerprint =
        'sha256:' + '0'.repeat(64);
    }
  ];
  for (const mutate of mutations) {
    const bad = json(good);
    mutate(bad);
    expect(game.loadSnapshot(bad)).toBe(false);
    unchanged();
  }
  const badReplay = json(origin);
  badReplay.extensions!.modules.find((m) => m.id === 'narrative')!.rules!.fingerprint =
    'sha256:' + '0'.repeat(64);
  expect(game.loadReplay(badReplay)).toBe(false);
  unchanged();
  vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(
    registryFromDescriptors(
      catalog.getInstalledModuleDescriptors().filter((d) => d.id !== 'narrative')
    )
  );
  expect(game.loadSnapshot(good)).toBe(false);
  unchanged();
  expect(game.loadReplay(origin)).toBe(false);
  unchanged();
}, 240000);

it('N2-A01 retains full cached visibility through seed1 A+recall/save/replay/continue cycles', () => {
  // Keep the reported sequence and each strict full-world assertion. Route choice
  // is documented by captured actions; no alternate seed can turn this case green.
  const game = startNarrative(['narrative'], 1),
    budget = newBudget(),
    zero = world(game),
    cuts: unknown[] = [];
  mkdirSync(EVIDENCE, { recursive: true });
  for (const npc of NPCS.slice(0, 4)) {
    descend(game, npc.min, budget);
    while (!target(game, npc.id) && game.depth < npc.max) descend(game, game.depth + 1, budget);
    approach(game, npc.id, budget);
    playDialogue(game, npc.id);
    const save = json(game.toSaveSnapshot()),
      expected = world(game),
      recording = json(game.exportRecording());
    cuts.push({
      npc: npc.id,
      depth: game.depth,
      index: recording.events.length,
      rng: json(game.toSnapshot().rngState),
      player: { x: game.player.x, y: game.player.y, hp: game.player.hp },
      turn: game.absoluteTurnNumber,
      tick: game.toSnapshot().run.currentTick
    });
    writeFileSync(
      `${EVIDENCE}/N2-A01-route.json`,
      JSON.stringify(
        {
          seed: 1,
          cuts,
          commands: recording.events.map(({ action, data, decisions }) => ({
            action,
            data,
            decisions
          }))
        },
        null,
        2
      )
    );
    expect(game.loadSnapshot(json(save))).toBe(true);
    expect(world(game)).toEqual(expected);
    replay(game, recording);
    if (JSON.stringify(world(game)) !== JSON.stringify(expected))
      writeFileSync(
        `${EVIDENCE}/N2-A01-${npc.id}.json`,
        JSON.stringify({ expected, actual: world(game), recording })
      );
    expect(world(game), `N2-A01 ${npc.id} D${game.depth}`).toEqual(expected);
    for (const [index, truth] of [
      [0, zero],
      [recording.events.length, expected]
    ] as const) {
      game.replaySeek(index);
      expect(game.replayError).toBeNull();
      expect(game.replayCursor).toBe(index);
      const actual = world(game);
      if (JSON.stringify(actual) !== JSON.stringify(truth))
        writeFileSync(
          `${EVIDENCE}/N2-A01-${npc.id}-seek-${index}.json`,
          JSON.stringify({ expected: truth, actual, recording })
        );
      expect(actual, `N2-A01 ${npc.id} seek ${index}`).toEqual(truth);
    }
    expect(game.loadSnapshot(json(save))).toBe(true);
    game.animationEnabled = false;
    settle(game);
  }
}, 240000);
