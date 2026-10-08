import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Game, GameRecording } from '../../../../engine/Core/Game';
import { createHeadlessGame } from '../../../../test/harness';
import { logger } from '../../../../engine/Systems/Logger';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { selectBossHud } from '../ui/view';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { json, startGiants, giantsState } from './naturalFixture';
import { bodyMoveTicks } from '../../../../engine/Movement/BodyGroups';
import { world, digest, settle, routeCommand } from './giants2NaturalFixture';

afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
  logger.onDisturb = null;
});
type Species = 'lantern' | 'copper';
type Command = Pick<GameRecording['events'][number], 'action' | 'data' | 'decisions'>;
type Trace = {
  seed: number;
  mode: 'wizard';
  modules: string[];
  commands: Command[];
  checkpoints: { index: number; label: string; worldHash: string }[];
  finalHash: string;
  birth: { id: number };
};
const trace = (species: Species): Trace =>
  JSON.parse(
    readFileSync(new URL(`../data/giants2-${species}-trace.json`, import.meta.url), 'utf8')
  );
function execute(game: Game, event: Command) {
  game.executeCommand(event.action, event.data);
  // Headless confirmation may synchronously consume the recorded answer.
  // Resolve only suspended decisions, then verify the actual committed answers.
  for (const decision of event.decisions ?? []) {
    if (game.pendingCommandConfirmation)
      game.resolveCommandDecision(game.pendingCommandConfirmation.token, decision);
  }
  expect(game.pendingCommandConfirmation).toBeNull();
  settle(game);
  expect(game.exportRecording().events.slice(-1)[0]!.decisions).toEqual(event.decisions ?? []);
}
function capture(species: Species) {
  const input = trace(species),
    game = startGiants(input.modules, input.seed, input.mode);
  const points = new Map<
    number,
    {
      save: ReturnType<Game['toSaveSnapshot']>;
      world: ReturnType<typeof world>;
      hud: ReturnType<typeof selectBossHud>;
    }
  >();
  const observe = () => {
    const index = game.exportRecording().events.length;
    if (input.checkpoints.some((p) => p.index === index))
      points.set(index, {
        save: json(game.toSaveSnapshot()),
        world: world(game),
        hud: json(selectBossHud(observeDisplayFrame(game, logger)))
      });
  };
  observe();
  for (const command of input.commands) {
    execute(game, command);
    observe();
  }
  for (const point of input.checkpoints)
    expect(digest(points.get(point.index)!.world), point.label).toBe(point.worldHash);
  expect(digest(world(game))).toBe(input.finalHash);
  return {
    input,
    points,
    recording: json(game.exportRecording()),
    final: world(game),
    save: json(game.toSaveSnapshot())
  };
}
const cache = new Map<Species, ReturnType<typeof capture>>();
const captured = (species: Species) => {
  if (!cache.has(species)) cache.set(species, capture(species));
  return cache.get(species)!;
};
function replay(game: Game, recording: GameRecording) {
  expect(game.loadReplay(json(recording))).toBe(true);
  game.animationEnabled = false;
  for (let index = 0; index < recording.events.length; index++) {
    game.replayStep(true);
    expect(game.replayError).toBeNull();
    expect(game.replayCursor).toBe(index + 1);
  }
}
for (const species of ['lantern', 'copper'] as const)
  describe(`giants2 ${species} natural persistence`, () => {
    it('continues damaged/phase checkpoints with exact complete world and recording prefix/suffix', () => {
      const data = captured(species);
      const cuts = data.input.checkpoints.filter((p) =>
        (species === 'lantern' ? ['break', 'phase'] : ['limb-1', 'immobile']).includes(p.label)
      );
      expect(cuts.length).toBeGreaterThanOrEqual(2);
      for (const cut of cuts) {
        const game = createHeadlessGame(901, 'test'),
          saved = data.points.get(cut.index)!;
        expect(game.loadSnapshot(json(saved.save))).toBe(true);
        game.animationEnabled = false;
        expect(game.hasCompleteRecording).toBe(true);
        expect(world(game)).toEqual(saved.world);
        expect(game.toSaveSnapshot().run.recordingOrigin).toEqual(saved.save.run.recordingOrigin);
        for (const event of data.recording.events.slice(cut.index)) execute(game, event);
        expect(world(game)).toEqual(data.final);
        expect(game.exportRecording().events).toEqual(data.recording.events);
        const continuation = json(game.exportRecording());
        replay(game, continuation);
        expect(world(game)).toEqual(data.final);
      }
    }, 480000);
    it('replays every real event and nonmonotonically seeks full snapshots and historical HUD including zero', () => {
      const data = captured(species),
        game = createHeadlessGame(902, 'test');
      replay(game, data.recording);
      expect(world(game)).toEqual(data.final);
      const arrival = data.input.checkpoints.find((p) => p.label === 'arrival')!;
      const middle = data.input.checkpoints.find((p) => p.label === (species === 'lantern' ? 'phase' : 'immobile'))!;
      for (const index of [
        data.recording.events.length,
        0,
        middle.index,
        arrival.index,
        ...data.input.checkpoints.map((p) => p.index).reverse(),
        data.recording.events.length
      ]) {
        game.replaySeek(index);
        expect(game.replayError).toBeNull();
        expect(game.replayCursor).toBe(index);
        const point = data.points.get(index)!;
        expect(point).toBeDefined();
        expect(world(game)).toEqual(point.world);
        expect(selectBossHud(observeDisplayFrame(game, logger))).toEqual(point.hud);
      }
    }, 480000);
    it('rejects corrupt spatial closure and manifest, or actually missing module, without retiring or changing the current run', () => {
      const data = captured(species),
        arrival = data.input.checkpoints.find((p) => p.label === 'arrival')!;
      const saved = data.points.get(arrival.index)!.save,
        game = createHeadlessGame(903, 'test');
      expect(game.loadSnapshot(json(saved))).toBe(true);
      const player = game.player,
        runtime = game.extensionRuntime,
        before = world(game),
        events = json(game.exportRecording());
      const mutations: ((s: typeof saved) => void)[] = [
        (s) => {
          s.monsters.find((m) => m.id === data.input.birth.id)!.spatial!.movementRegionId = -1;
        },
        (s) => {
          const r = s.extensions!.foundation.world.regions![0]!;
          s.extensions!.foundation.world.regions![0] = { ...r, bounds: { ...r.bounds, width: 0 } };
        },
        (s) => {
          s.extensions!.manifest.modules.find((m) => m.id === 'giants')!.rules!.fingerprint =
            'sha256:' + '0'.repeat(64);
        }
      ];
      if (species === 'lantern')
        mutations.push((s) => {
          s.monsters.find((m) => m.id === data.input.birth.id)!.spatial!.zoneState![0]!.hp = 19;
        });
      else
        mutations.push((s) => {
          s.run.spatialWorld!.groups.find(
            (g) => g.coreId === data.input.birth.id
          )!.members[1]!.entityId = -1;
        });
      const unchanged = () => {
        expect(game.player).toBe(player);
        expect(game.extensionRuntime).toBe(runtime);
        expect(world(game)).toEqual(before);
        expect({ ...game.exportRecording(), recordedAt: 0 }).toEqual({ ...events, recordedAt: 0 });
      };
      for (const mutate of mutations) {
        const bad = json(saved);
        mutate(bad);
        expect(game.loadSnapshot(bad)).toBe(false);
        unchanged();
      }
      const badReplay = json(data.recording);
      badReplay.extensions!.modules.find((m) => m.id === 'giants')!.rules!.fingerprint =
        'sha256:' + '0'.repeat(64);
      expect(game.loadReplay(badReplay)).toBe(false);
      unchanged();
      vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(
        registryFromDescriptors(
          catalog.getInstalledModuleDescriptors().filter((d) => d.id !== 'giants')
        )
      );
      expect(game.loadSnapshot(json(saved))).toBe(false);
      unchanged();
      expect(game.loadReplay(json(data.recording))).toBe(false);
      unchanged();
    }, 480000);
    it('retains damage, broken slots and phase spent through real stairs, and defeated encounters never respawn', () => {
      const data = captured(species);
      const cuts = data.input.checkpoints.filter((p) =>
        (species === 'lantern' ? ['break', 'phase'] : ['immobile']).includes(p.label)
      );
      const roundTrip = (save: ReturnType<Game['toSaveSnapshot']>, defeated: boolean) => {
        const game = createHeadlessGame(904, 'test');
        expect(game.loadSnapshot(json(save))).toBe(true);
        game.animationEnabled = false;
        const depth = game.depth,
          id = data.input.birth.id,
          boss = game.monsters.find((m) => m.id === id);
        const zones = json(boss?.spatial?.zoneState ?? null),
          history = json(boss?.bodyTransitionHistory ?? []);
        const group = json(game.bodyGroups?.find((g) => g.coreId === id) ?? null);
        const moveTicks = boss ? (group ? bodyMoveTicks(game.spatialCatalog.body(group.bodyDefinitionId), group, game.spatialCatalog, boss.movementSpeed) : boss.movementSpeed) : null;
        const encounter = json(giantsState(game).bosses.find((b) => b.primaryId === id)!);
        for (let n = 0; n < 1200 && game.depth === depth; n++) {
          routeCommand(game, game.levelSeeds[depth - 1]!.upStairsLoc, undefined, 'stairs_up');
          settle(game);
        }
        expect(game.depth).toBe(depth - 1);
        for (let n = 0; n < 1200 && game.depth !== depth; n++) {
          routeCommand(game, game.levelSeeds[game.depth - 1]!.downStairsLoc);
          settle(game);
        }
        expect(game.depth).toBe(depth);
        expect(giantsState(game).bosses.find((b) => b.primaryId === id)).toEqual(encounter);
        if (defeated) {
          expect(
            game.monsters.some((m) => m.id === id || m.spatial?.bodyMember?.groupId === id)
          ).toBe(false);
        } else {
          const restored = game.monsters.find((m) => m.id === id)!;
          expect(restored).toBeDefined();
          expect(restored.spatial?.zoneState ?? null).toEqual(zones);
          expect(restored.bodyTransitionHistory ?? []).toEqual(history);
          const restoredGroup = game.bodyGroups?.find((g) => g.coreId === id) ?? null;
          expect(restoredGroup ? bodyMoveTicks(game.spatialCatalog.body(restoredGroup.bodyDefinitionId), restoredGroup, game.spatialCatalog, restored.movementSpeed) : restored.movementSpeed).toBe(moveTicks);
          if (group) {
            expect(restoredGroup!.appliedBreaks).toEqual(group.appliedBreaks);
            expect(restoredGroup!.members.filter((m) => m.life !== 'active')).toEqual(
              group.members.filter((m) => m.life !== 'active')
            );
          }
        }
        expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
      };
      for (const cut of cuts) roundTrip(data.points.get(cut.index)!.save, false);
      roundTrip(data.save, true);
    }, 480000);
  });
