import { describe, it, expect, vi, afterEach } from 'vitest';
import { getInstalledModuleDescriptors, createExtensionRegistry } from '../../../catalog';
import * as catalog from '../../../catalog';
import { loadGiantsDefinitionPack } from '../definitions';
import {
  naturalGiants,
  startGiants,
  walkNaturalToDepth,
  giantsState,
  json
} from './naturalFixture';
import { footprintOf, commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { canPlaceCreature } from '../../../../engine/Movement/CreaturePlacement';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { MonsterState } from '../../../../entities/Monster';
import { logger } from '../../../../engine/Systems/Logger';
import { generationReserved } from '../../../../engine/Generator/GenerationReservation';
import { readCreatureBirth } from '../../../birth';
import { ExtensionRegistry } from '../../../registry';
import { registryFromDescriptors } from '../../../descriptor';
import { DungeonLayer, TerrainType as T } from '../../../../engine/Map/Grid';
import { scheduleLevelFollowers } from '../../../../engine/Movement/LevelTravel';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import species from '../../../../data/monsters.json';
import { sideChamberValid } from '../../../../engine/Generator/SideChamber';
const mechanical = (game: import('../../../../engine/Core/Game').Game) => {
  const s = json(game.toSnapshot());
  s.savedAt = 0;
  return s;
};
const combinations = [
  ['giants'],
  ...getInstalledModuleDescriptors()
    .filter((d) => d.id !== 'giants')
    .map((d) => ['giants', d.id])
];
afterEach(() => {
  vi.restoreAllMocks();
  logger.presentAcknowledgments(null);
});
describe('giants natural run and original encounter', () => {
  it('natural D3 has a clear 12x10 scene, open 3-wide connection and one trusted newborn', () => {
    const { game, boss, state } = naturalGiants(),
      p = state.placements[0]!,
      region = game.extensionRuntime!.ownedRegion(p.regionId!, 3)!;
    expect(p.result).toBe('placed');
    expect(region.bounds).toMatchObject({ width: 12, height: 10 });
    expect(region.guard).toBe('return-to-spawn');
    expect(boss.typeId).toBe('giants.ridgeback');
    expect(boss.name).toBe('岩脊兽');
    expect(boss.hp).toBe(120);
    expect(boss.maxHp).toBe(120);
    expect(boss.spatial?.footprintId).toBe('builtin:square-2');
    expect(readCreatureBirth(boss)).toMatchObject({
      creationReason: 'natural',
      initiallyHostile: true,
      originalMonsterType: 'giants.ridgeback'
    });
    const b = region.bounds;
    expect(boss.x - b.x).toBeGreaterThanOrEqual(2);
    expect(boss.y - b.y).toBeGreaterThanOrEqual(2);
    for (let x = b.x; x < b.x + b.width; x++)
      for (let y = b.y; y < b.y + b.height; y++) {
        const c = game.grid.getCell(x, y)!;
        expect(c.layers).toEqual([2, 0, 0, 0]);
        expect(c.machineNumber).toBe(0);
        expect(generationReserved(game.grid, x, y)).toBe(false);
        expect(game.items.some((item) => item.x === x && item.y === y)).toBe(false);
        expect(
          game.monsters.some(
            (m) => m !== boss && footprintOf(m).some((p) => p.x === x && p.y === y)
          )
        ).toBe(false);
      }
    expect(footprintOf(boss)).toHaveLength(4);
    expect(game.monsters.filter((m) => m.typeId === 'giants.ridgeback')).toHaveLength(1);
    const carve = Array.from({ length: b.width * b.height }, (_, i) => ({
      x: b.x + (i % b.width),
      y: b.y + Math.floor(i / b.width)
    }));
    const edges = [
      Array.from({ length: b.width }, (_, i) => ({ x: b.x + i, y: b.y - 1 })),
      Array.from({ length: b.width }, (_, i) => ({ x: b.x + i, y: b.y + b.height })),
      Array.from({ length: b.height }, (_, i) => ({ x: b.x - 1, y: b.y + i })),
      Array.from({ length: b.height }, (_, i) => ({ x: b.x + b.width, y: b.y + i }))
    ];
    const entry = edges
      .flatMap((row) => row.slice(0, -2).map((_, i) => row.slice(i, i + 3)))
      .find((row) =>
        row.every((p) =>
          game.grid.getCell(p.x, p.y)?.layers.every((t, i) => t === (i === 0 ? T.FLOOR : T.NOTHING))
        )
      );
    expect(entry).toHaveLength(3);
    expect(
      sideChamberValid(
        game.grid,
        { bounds: b, carve: [...carve, ...entry!], entry: entry!, reserve: [], spawn: boss.loc },
        2
      )
    ).toBe(true);
  }, 60000);
  it.each(combinations.map((ids) => ({ ids })))(
    'natural startup, commands, save/load, replay, seek and continuation: $ids',
    ({ ids }) => {
      const { game } = naturalGiants(ids);
      const snapshot = json(game.toSaveSnapshot()),
        recording = json(game.exportRecording()),
        expected = mechanical(game);
      expect(snapshot.run.recordingOrigin).toBeTruthy();
      expect(game.loadSnapshot(snapshot)).toBe(true);
      game.animationEnabled = false;
      expect(mechanical(game)).toEqual(expected);
      game.executeCommand('wait');
      const continuation = json(game.exportRecording()),
        continued = mechanical(game);
      expect(continuation.events.slice(0, recording.events.length)).toEqual(recording.events);
      expect(game.loadReplay(recording)).toBe(true);
      game.animationEnabled = false;
      while (game.replayCursor < recording.events.length) {
        game.replayStep(true);
        expect(game.replayError).toBeNull();
      }
      expect(game.toSnapshot().extensions).toEqual(expected.extensions);
      expect(rng.getState()).toEqual(expected.rngState);
      for (const index of [0, Math.floor(recording.events.length / 2), recording.events.length]) {
        game.replaySeek(index);
        expect(game.replayCursor).toBe(index);
        expect(game.replayError).toBeNull();
      }
      expect(game.loadReplay(continuation)).toBe(true);
      game.animationEnabled = false;
      while (game.replayCursor < continuation.events.length) {
        game.replayStep(true);
        expect(game.replayError).toBeNull();
      }
      expect(game.toSnapshot().extensions).toEqual(continued.extensions);
      expect(rng.getState()).toEqual(continued.rngState);
    },
    120000
  );
  it('bad live bindings, native form and missing package reject before retiring the old run', () => {
    const { game, boss } = naturalGiants(),
      saved = json(game.toSaveSnapshot()),
      player = game.player,
      runtime = game.extensionRuntime!,
      before = rng.getState();
    const variants = [
      (s: typeof saved) => {
        (s.extensions!.modules.giants as any).bosses[0].primaryId++;
      },
      (s: typeof saved) => {
        const m = s.monsters.find((m) => m.id === boss.id)!;
        m.spatial = { ...m.spatial!, movementRegionId: m.spatial!.movementRegionId! + 1 };
      },
      (s: typeof saved) => {
        s.monsters.find((m) => m.id === boss.id)!.typeId = 'unknown.ridgeback';
      },
      (s: typeof saved) => {
        s.extensions!.foundation.world.regions![0] = {
          ...s.extensions!.foundation.world.regions![0]!,
          guard: undefined
        };
      }
    ];
    for (const corrupt of variants) {
      const bad = json(saved);
      corrupt(bad);
      expect(game.loadSnapshot(bad)).toBe(false);
      expect(game.player).toBe(player);
      expect(game.extensionRuntime).toBe(runtime);
      expect(rng.getState()).toEqual(before);
    }
    const without = registryFromDescriptors(
      getInstalledModuleDescriptors().filter((d) => d.id !== 'giants')
    );
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(without);
    expect(game.loadSnapshot(saved)).toBe(false);
    expect(game.player).toBe(player);
    expect(game.extensionRuntime).toBe(runtime);
    expect(without).toBeInstanceOf(ExtensionRegistry);
    expect(createExtensionRegistry()).toBe(without);
  }, 60000);
  it('guard returns to its spawn outside the scene, pursues inside and preserves domination/clone/polymorph eligibility', () => {
    const { game, boss } = naturalGiants(),
      region = game.extensionRuntime!.ownedRegion(boss.spatial!.movementRegionId!, 3)!,
      b = region.bounds;
    // Diagnostic behavior scene derived from a natural birth; never used as a recording/trace.
    game.monsters = [boss];
    game.dormantMonsters = [];
    game.items = [];
    game.player.hp = game.player.maxHp = 10000;
    boss.state = MonsterState.HUNTING;
    boss.behaviorFlags.add('MONST_ALWAYS_HUNTING');
    const home = { ...boss.spawnLoc };
    commitCreatureAnchor(boss, { x: b.x + 1, y: b.y + 1 });
    for (let i = 0; i < 20; i++) game.executeCommand('wait');
    expect(boss.loc).toEqual(home);
    commitCreatureAnchor(game.player, { x: b.x + 2, y: b.y + 2 });
    const away = { ...boss.loc };
    game.executeCommand('wait');
    expect(boss.loc).not.toEqual(away);
    expect(
      footprintOf(boss).every(
        (p) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height
      )
    ).toBe(true);
    (game as any).becomeAllyWith(boss);
    expect(boss.isAlly).toBe(true);
    expect(boss.spatial?.movementRegionId).toBe(region.id);
    const clone = game.cloneMonster(boss);
    expect(clone).toBeTruthy();
    expect(clone!.spatial?.movementRegionId).toBe(region.id);
    expect(game.extensionRuntime!.publicActorTags(clone!.id)).toEqual([]);
    scheduleLevelFollowers(game.grid, [boss, clone!], game.player.loc, 1, (m) =>
      game.extensionRuntime!.reportRegionFollowBlocked(m, 3)
    );
    expect(boss.approaching).toBe(0);
    expect(logger.messages.some((m) => m.text.includes('留在原层'))).toBe(true);
    expect((game as any).polymorphBoltTarget(boss)).toBeTypeOf('boolean');
    expect(boss.typeId).not.toBe('giants.ridgeback');
    expect(boss.spatial?.movementRegionId).toBe(region.id);
    expect(giantsState(game).bosses[0]!.status).toBe('alive');
    expect(canPlaceCreature(game, boss, { x: b.x - 1, y: b.y })).toBe(false);
  }, 60000);
  it('death is once, revisit never respawns; administrative retirement is lost and fall is escaped', () => {
    const { game, boss, state } = naturalGiants(),
      id = boss.id;
    boss.takeDamage(10000);
    (game as any).cleanupDeadMonsters?.();
    expect(giantsState(game).bosses[0]!.status).toBe('defeated');
    game.depth = 2;
    (game as any).generateDepth(true);
    game.depth = 3;
    (game as any).generateDepth();
    expect(game.monsters.some((m) => m.id === id && m.hp > 0)).toBe(false);
    expect(giantsState(game).placements).toEqual(state.placements);
    expect(giantsState(game).bosses).toHaveLength(1);
    const next = naturalGiants();
    for (const p of footprintOf(next.boss))
      next.game.grid.setTerrainLayer(p.x, p.y, DungeonLayer.LIQUID, T.CHASM);
    (next.game as any).monstersFall();
    expect(next.game.monsters).not.toContain(next.boss);
    expect(next.game['pendingFallenByDepth'].get(4)).toContain(next.boss);
    expect(next.boss.spatial?.movementRegionId).toBeUndefined();
    expect(giantsState(next.game).bosses[0]!.status).toBe('escaped');
    const fallen = json(next.game.toSaveSnapshot());
    expect(next.game.loadSnapshot(fallen)).toBe(true);
    expect(giantsState(next.game).bosses[0]!.status).toBe('escaped');
    next.game.extensionRuntime!.captureDeath(next.boss, true, null);
    expect(giantsState(next.game).bosses[0]!.status).toBe('lost');
  }, 60000);
  it('native polymorph can select an enabled original form; no-fit keeps identity, body, statuses and IDs', () => {
    const { game, boss } = naturalGiants(),
      b = game.extensionRuntime!.ownedRegion(boss.spatial!.movementRegionId!, 3)!.bounds;
    game.monsters = [];
    game.dormantMonsters = [];
    game.items = [];
    const rat = new Monster(
      b.x + 3,
      b.y + 3,
      (species as MonsterData[]).find((m) => m.id === 'rat')!
    );
    game.monsters.push(rat);
    const draw = vi.spyOn(rng, 'randRange').mockReturnValue(species.length + 1),
      id = getNextEntityId();
    expect((game as any).polymorphBoltTarget(rat)).toBe(true);
    expect(rat.typeId).toBe('giants.ridgeback');
    expect(rat.spatial?.footprintId).toBe('builtin:square-2');
    expect(getNextEntityId()).toBe(id);
    expect(draw).toHaveBeenCalledWith(1, species.length + loadGiantsDefinitionPack().forms.length);
    draw.mockRestore();
    const target = new Monster(
      b.x + 3,
      b.y + 3,
      (species as MonsterData[]).find((m) => m.id === 'rat')!
    );
    target.setStatusDuration('confused', 8);
    game.monsters = [target];
    for (let x = 0; x < game.grid.width; x++)
      for (let y = 0; y < game.grid.height; y++)
        game.grid.setTerrain(x, y, T.GRANITE, ' ', 0x333333);
    game.grid.setTerrain(target.x, target.y, T.FLOOR, '.', 0x888888);
    game.grid.setTerrain(game.player.x, game.player.y, T.FLOOR, '.', 0x888888);
    const before = json(target.snapshotForm()),
      location = { ...target.loc },
      ids = getNextEntityId();
    const noFit = vi.spyOn(rng, 'randRange').mockReturnValue(species.length + 1);
    expect((game as any).polymorphBoltTarget(target)).toBe(false);
    expect(target.snapshotForm()).toEqual(before);
    expect(target.loc).toEqual(location);
    expect(target.getStatusDuration('confused')).toBe(8);
    expect(target.spatial).toBeUndefined();
    expect(getNextEntityId()).toBe(ids);
    expect(noFit).toHaveBeenCalledTimes(1);
  }, 60000);
  it('generation publication exception restores the native graph, IDs, ledger, state and both streams', () => {
    const game = startGiants();
    walkNaturalToDepth(game, 2);
    const before = mechanical(game),
      runtime = game.extensionRuntime!,
      player = game.player,
      grid = game.grid,
      ids = getNextEntityId(),
      random = rng.getState();
    const emit = runtime.emit.bind(runtime);
    vi.spyOn(runtime, 'emit').mockImplementation((name, event) => {
      if (name === 'afterLevelGeneration') throw new Error('giants-publish-fault');
      return emit(name, event as never);
    });
    game.depth = 3;
    expect(() => (game as any).generateDepth()).toThrow('giants-publish-fault');
    expect(game.player).toBe(player);
    expect(game.grid).toBe(grid);
    expect(game.depth).toBe(2);
    const actual = mechanical(game);
    expect(actual).toEqual(before);
    expect(getNextEntityId()).toBe(ids);
    expect(rng.getState()).toEqual(random);
  }, 60000);
});
