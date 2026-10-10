import { continuingPrefix, extensionDigest, checkpointExtensionDigest } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  startGiants,
  GIANTS_COLOSSUS_ACCEPTANCE_SEED,
  giantsState,
  json,
  naturalColossus
} from './naturalFixture';
import { footprintOf, commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { canPlaceCreature } from '../../../../engine/Movement/CreaturePlacement';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { sideChamberValid } from '../../../../engine/Generator/SideChamber';
import { generationReserved } from '../../../../engine/Generator/GenerationReservation';
import { readCreatureBirth } from '../../../birth';
import { MonsterState, Monster, type MonsterData } from '../../../../entities/Monster';
import species from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { selectBossHud } from '../ui/view';
import { logger } from '../../../../engine/Systems/Logger';

afterEach(() => {
  vi.restoreAllMocks();
  logger.presentAcknowledgments(null);
});
const flood = (
  start: { x: number; y: number },
  valid: (p: { x: number; y: number }) => boolean
) => {
  const queue = [start],
    seen = new Set<string>();
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i]!,
      key = `${p.x},${p.y}`;
    if (seen.has(key) || !valid(p)) continue;
    seen.add(key);
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0]
    ])
      queue.push({ x: p.x + dx!, y: p.y + dy! });
  }
  return seen;
};

describe('giants original 3x3 colossus', () => {
  it.each(['normal', 'easy'] as const)(
    'native D7 generation also creates the colossus in %s mode',
    (mode) => {
      const game = startGiants(['giants'], GIANTS_COLOSSUS_ACCEPTANCE_SEED, mode);
      // Generation-only diagnostic: the native generator owns the entire arena/birth.
      // This direct depth selection is not used to capture a recording or natural route.
      game.depth = 7;
      (game as any).generateDepth(true);
      const boss = game.monsters.find((m) => m.typeId === 'giants.abyssal-colossus')!;
      expect(boss).toBeTruthy();
      expect(boss.hp).toBe(260);
      expect(footprintOf(boss)).toHaveLength(9);
      expect(readCreatureBirth(boss)).toMatchObject({ creationReason: 'natural' });
      const region = game.extensionRuntime!.ownedRegion(boss.spatial!.movementRegionId!, 7)!;
      expect(region.bounds).toEqual({ x: 16, y: 5, width: 16, height: 12 });
      expect(
        giantsState(game).placements.filter((p) => p.depth === 7 && p.result === 'placed')
      ).toHaveLength(1);
    },
    60000
  );
  it('naturally creates clear 16x12 terrain, a >=4-wide attachment, 140 reachable anchors and a complete player ring', () => {
    const { game, boss, state } = naturalColossus(),
      region = game.extensionRuntime!.ownedRegion(boss.spatial!.movementRegionId!, 7)!,
      b = region.bounds;
    expect(b).toMatchObject({ width: 16, height: 12 });
    expect(boss).toMatchObject({
      typeId: 'giants.abyssal-colossus',
      name: '沉渊巨像',
      hp: 260,
      maxHp: 260,
      accuracy: 95,
      defense: 60,
      movementSpeed: 200,
      attackSpeed: 100,
      damageString: '8-16'
    });
    expect(footprintOf(boss)).toHaveLength(9);
    expect(readCreatureBirth(boss)).toMatchObject({
      creationReason: 'natural',
      initiallyHostile: true,
      originalMonsterType: boss.typeId
    });
    const inside = (p: { x: number; y: number }) =>
      p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height;
    const clear = (p: { x: number; y: number }) =>
      game.grid.getCell(p.x, p.y)?.layers.every((t, i) => t === (i === 0 ? T.FLOOR : T.NOTHING)) ===
      true;
    const carve = Array.from({ length: b.width * b.height }, (_, i) => ({
      x: b.x + (i % b.width),
      y: b.y + Math.floor(i / b.width)
    }));
    for (const p of carve) {
      expect(clear(p)).toBe(true);
      expect(game.grid.getCell(p.x, p.y)!.machineNumber).toBe(0);
      expect(generationReserved(game.grid, p.x, p.y)).toBe(false);
      expect(game.items.some((item) => item.x === p.x && item.y === p.y)).toBe(false);
      expect(
        game.monsters.some(
          (m) => m !== boss && footprintOf(m).some((q) => q.x === p.x && q.y === p.y)
        )
      ).toBe(false);
    }
    for (const gap of [
      boss.x - b.x,
      boss.y - b.y,
      b.x + b.width - boss.x - 3,
      b.y + b.height - boss.y - 3
    ])
      expect(gap).toBeGreaterThanOrEqual(2);
    const edges = [
      Array.from({ length: b.width }, (_, i) => ({ x: b.x + i, y: b.y - 1 })),
      Array.from({ length: b.width }, (_, i) => ({ x: b.x + i, y: b.y + b.height })),
      Array.from({ length: b.height }, (_, i) => ({ x: b.x - 1, y: b.y + i })),
      Array.from({ length: b.height }, (_, i) => ({ x: b.x + b.width, y: b.y + i }))
    ];
    const entry = edges
      .flatMap((row) => row.slice(0, -3).map((_, i) => row.slice(i, i + 4)))
      .find((row) => row.every(clear));
    expect(entry).toHaveLength(4);
    expect(
      sideChamberValid(
        game.grid,
        { bounds: b, carve: [...carve, ...entry!], entry: entry!, reserve: [], spawn: boss.loc },
        3
      )
    ).toBe(true);
    // Independent enumeration uses actual full-body fit rather than the production area check.
    expect(flood(boss.loc, (p) => canPlaceCreature(game, boss, p)).size).toBe(140);
    const body = new Set(footprintOf(boss).map((p) => `${p.x},${p.y}`));
    expect(
      flood({ x: b.x, y: b.y }, (p) => inside(p) && clear(p) && !body.has(`${p.x},${p.y}`)).size
    ).toBe(183);
    // The connection reaches the original floor network and both stairs with the boss avoided.
    const reachable = flood(entry![0]!, (p) => {
      const c = game.grid.getCell(p.x, p.y);
      return (
        !!c &&
        (c.isPassable || [T.DOOR, T.SECRET_DOOR].includes(c.terrain)) &&
        !body.has(`${p.x},${p.y}`)
      );
    });
    for (const p of [game.levelSeeds[6]!.upStairsLoc, game.levelSeeds[6]!.downStairsLoc])
      expect(reachable.has(`${p.x},${p.y}`)).toBe(true);
    expect(state.bosses.filter((v) => v.instanceKey.endsWith('depth-7'))).toHaveLength(1);
  }, 60000);

  it('uses stable competition at D7/8 and at most one successful arena per floor', () => {
    const { game, state } = naturalColossus();
    for (const depth of [7, 8])
      expect(game.extensionRuntime!.generationContributions(depth).map((t) => t.id)).toEqual([
        'giants.abyssal-chamber',
        'giants.stone-chamber',
        'giants.copper-chamber'
      ]);
    expect(game.extensionRuntime!.generationContributions(6).map((t) => t.id)).toEqual([
      'giants.stone-chamber',
        'giants.copper-chamber'
    ]);
    expect(game.extensionRuntime!.generationContributions(9).map((t) => t.id)).toEqual([
      'giants.abyssal-chamber',
      'giants.spine-chamber'
    ]);
    expect(game.extensionRuntime!.generationContributions(14)).toHaveLength(2);
    expect(game.extensionRuntime!.generationContributions(15).map((t) => t.id)).toEqual([
      'giants.shale-chamber'
    ]);
    expect(game.extensionRuntime!.generationContributions(21)).toEqual([]);
    for (const depth of new Set(state.placements.map((p) => p.depth)))
      expect(
        state.placements.filter((p) => p.depth === depth && p.result === 'placed').length
      ).toBeLessThanOrEqual(1);
    const overlapping = state.placements.filter((p) => p.depth === 7);
    expect(overlapping).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ templateId: 'giants.abyssal-chamber', result: 'placed' }),
        expect.objectContaining({
          templateId: 'giants.stone-chamber',
          result: 'skipped',
          reason: 'budget'
        })
      ])
    );
    // Direct generation of a second overlapping depth exercises the same native budget.
    game.depth = 8;
    (game as any).generateDepth(true);
    const current = giantsState(game).placements.filter((p) => p.depth === 8);
    expect(current.filter((p) => p.result === 'placed').length).toBeLessThanOrEqual(1);
    expect(
      game.extensionRuntime!.snapshot().foundation.world.regions!.filter((r) => r.depth === 8)
        .length
    ).toBeLessThanOrEqual(1);
  }, 60000);

  it('guard returns outside, pursues inside, and rejects tail overflow and displacement outside its region', () => {
    const { game, boss } = naturalColossus(),
      region = game.extensionRuntime!.ownedRegion(boss.spatial!.movementRegionId!, 7)!,
      b = region.bounds;
    // Diagnostic behavior scene, derived from a trusted natural birth. Not a trace/replay fixture.
    game.monsters = [boss];
    game.dormantMonsters = [];
    game.items = [];
    game.player.hp = game.player.maxHp = 10000;
    boss.state = MonsterState.HUNTING;
    boss.behaviorFlags.add('MONST_ALWAYS_HUNTING');
    const home = { ...boss.spawnLoc };
    commitCreatureAnchor(boss, { x: b.x + 1, y: b.y + 1 });
    for (let i = 0; i < 40; i++) game.executeCommand('wait');
    expect(boss.loc).toEqual(home);
    commitCreatureAnchor(game.player, { x: b.x + 2, y: b.y + 2 });
    const away = { ...boss.loc };
    for (let i = 0; i < 2; i++) game.executeCommand('wait');
    expect(boss.loc).not.toEqual(away);
    expect(
      footprintOf(boss).every(
        (p) => p.x >= b.x && p.y >= b.y && p.x < b.x + b.width && p.y < b.y + b.height
      )
    ).toBe(true);
    for (const at of [
      { x: b.x - 1, y: b.y },
      { x: b.x + b.width - 2, y: b.y },
      { x: b.x, y: b.y + b.height - 2 }
    ]) {
      const before = { ...boss.loc };
      expect(canPlaceCreature(game, boss, at)).toBe(false);
      expect(game.placeCreature(boss, at)).toBe(false);
      expect(boss.loc).toEqual(before);
    }
  }, 60000);

  it('defeat removes the HUD marker once and a true stair revisit never respawns the giant', () => {
    const { game, boss } = naturalColossus();
    // Diagnostic kill only; both level transitions use real commands.
    const id = boss.id;
    boss.takeDamage(10000);
    (game as any).cleanupDeadMonsters?.();
    const defeated = giantsState(game),
      receipt = defeated.bosses.find((b) => b.primaryId === id)!;
    expect(receipt.status).toBe('defeated');
    expect(receipt.subjects).toEqual([{ groupId: id, status: 'dead' }]);
    expect(game.extensionRuntime!.publicActorTags(id)).toEqual([]);
    expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    game.animationEnabled = false;
    const up = game.levelSeeds[6]!.upStairsLoc;
    commitCreatureAnchor(game.player, up);
    game.executeCommand('stairs_up');
    if (game.pendingCommandConfirmation)
      game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
    expect(game.depth).toBe(6);
    // Travel may place the player beside an occupied stair; this behavior fixture
    // positions it on the actual cached down stair before the real return command.
    commitCreatureAnchor(game.player, game.levelSeeds[5]!.downStairsLoc);
    game.executeCommand('stairs_down');
    if (game.pendingCommandConfirmation)
      game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
    expect(game.depth).toBe(7);
    expect(game.monsters.some((m) => m.id === id && m.hp > 0)).toBe(false);
    expect(giantsState(game)).toEqual(defeated);
  }, 60000);

  it('real save/load, every replay checkpoint, seeks, and loaded-save continuation preserve the natural 3x3 encounter', () => {
    const { game } = naturalColossus(),
      saved = json(game.toSaveSnapshot()),
      recording = json(game.exportRecording());
    expect(saved.run.recordingOrigin).toBeTruthy();
    expect(game.loadSnapshot(saved)).toBe(true);
    game.animationEnabled = false;
    expect(extensionDigest(game.toSnapshot().extensions ?? null)).toBe(checkpointExtensionDigest(saved));
    expect(game.toSnapshot().monsters).toEqual(saved.monsters);
    expect(rng.getState()).toEqual(saved.rngState);
    game.executeCommand('wait');
    const continued = json(game.exportRecording()),
      after = game.toSnapshot();
    expect(continued.events.slice(0, recording.events.length)).toEqual(continuingPrefix(recording));
    for (const rec of [recording, continued]) {
      expect(game.loadReplay(rec)).toBe(true);
      game.animationEnabled = false;
      for (const event of rec.events) {
        game.replayStep(true);
        expect(game.replayError).toBeNull();
        expect(game.replayCursor).toBe(event.index + 1);
        expect(rng.getState()).toEqual(event.rng);
        expect(extensionDigest(game.toSnapshot().extensions ?? null)).toBe(checkpointExtensionDigest(event));
      }
      for (const index of [0, Math.floor(rec.events.length / 2), rec.events.length]) {
        game.replaySeek(index);
        expect(game.replayCursor).toBe(index);
        expect(game.replayError).toBeNull();
      }
    }
    expect(game.toSnapshot().monsters).toEqual(after.monsters);
    expect(game.toSnapshot().entityGraph).toEqual(after.entityGraph);
    expect(extensionDigest(game.toSnapshot().extensions ?? null)).toBe(checkpointExtensionDigest(after));
    expect(rng.getState()).toEqual(after.rngState);
  }, 120000);

  it('3x3 boss HUD uses public historical HP and hides unseen actors without RNG consumption', () => {
    const { game, boss } = naturalColossus();
    commitCreatureAnchor(game.player, { x: boss.x - 2, y: boss.y });
    (game as any).updateVision();
    const before = rng.getState(),
      frame = observeDisplayFrame(game, logger);
    expect(selectBossHud(frame)).toMatchObject({
      id: boss.id,
      name: '沉渊巨像',
      hp: 260,
      maxHp: 260
    });
    boss.hp = 80;
    expect(selectBossHud(observeDisplayFrame(game, logger))?.hp).toBe(80);
    expect(selectBossHud(frame)?.hp).toBe(260);
    for (let x = 0; x < game.grid.width; x++)
      for (let y = 0; y < game.grid.height; y++) {
        const c = game.grid.getCell(x, y)!;
        c.isVisible = false;
        c.isClairvoyantVisible = false;
      }
    expect(selectBossHud(observeDisplayFrame(game, logger))).toBeNull();
    expect(rng.getState()).toEqual(before);
  }, 60000);

  it('enabled native polymorph samples the 3x3 form with its data and allocates no new identity', () => {
    const { game, boss } = naturalColossus(),
      at = { ...boss.loc };
    game.monsters = [];
    game.dormantMonsters = [];
    const rat = new Monster(at.x, at.y, (species as MonsterData[]).find((m) => m.id === 'rat')!);
    game.monsters.push(rat);
    const id = getNextEntityId(),
      forms = game.extensionRuntime!.nativeForms(),
      index = forms.findIndex((f) => f.id === 'giants.abyssal-colossus');
    const draw = vi.spyOn(rng, 'randRange').mockReturnValue(species.length + index + 1);
    expect((game as any).polymorphBoltTarget(rat)).toBe(true);
    expect(draw).toHaveBeenCalledWith(1, species.length + forms.length);
    expect(rat.typeId).toBe('giants.abyssal-colossus');
    expect(rat.spatial?.footprintId).toBe('builtin:square-3');
    expect(rat.maxHp).toBe(260);
    expect(getNextEntityId()).toBe(id);
  }, 60000);
});
