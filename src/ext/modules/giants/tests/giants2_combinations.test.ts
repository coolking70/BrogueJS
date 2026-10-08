import { afterEach, expect, it, vi } from 'vitest';
import type { Game, GameRecording } from '../../../../engine/Core/Game';
import { createHeadlessGame } from '../../../../test/harness';
import { continuingPrefix } from '../../../../test/support/recordingV4';
import { logger } from '../../../../engine/Systems/Logger';
import { readCreatureBirth } from '../../../birth';
import { regionContains } from '../../../regions';
import { footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { startGiants, json } from './naturalFixture';
import { arriveNatural, attackNatural, settle, world } from './giants2NaturalFixture';
import { lanternScene, BODY, hitZone } from './giants2MechanicsFixture';
const optional = ['combat', 'growth', 'narrative', 'crafting', 'foraging', 'settlement'];
const rows = [[], ['giants'], ...optional.map((id) => ['giants', id]), ['giants', ...optional]];
afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
  logger.onDisturb = null;
});
function play(game: Game) {
  game.executeCommand('wait');
  settle(game);
}
function replay(game: Game, recording: GameRecording) {
  expect(game.loadReplay(json(recording))).toBe(true);
  game.animationEnabled = false;
  for (let i = 0; i < recording.events.length; i++) {
    game.replayStep(true);
    expect(game.replayError).toBeNull();
    expect(game.replayCursor).toBe(i + 1);
  }
}
it.each(rows.map((ids) => ({ ids, label: ids.join('+') || 'foundation' })))(
  'G2-COMBO natural contact/save/continuation/replay/nonmonotonic seek: $label',
  ({ ids }) => {
    let game: Game;
    if (ids.includes('giants')) {
      const arrived = arriveNatural('lantern', 1, ids);
      game = arrived.game;
      const { boss, placement } = arrived;
      expect(readCreatureBirth(boss)).toMatchObject({ creationReason: 'natural' });
      expect(placement.result).toBe('placed');
      expect(boss.typeId).toBe('giants.blind-lantern');
      const hp = boss.hp;
      for (let n = 0; n < 800 && boss.hp === hp && !game.isGameOver; n++)
        attackNatural(game, 'lantern', boss.id);
      expect(boss.hp).toBeLessThan(hp);
      expect(game.isGameOver).toBe(false);
    } else {
      game = startGiants([], 1, 'wizard');
      expect(game.toSnapshot().extensions!.modules.giants).toBeUndefined();
      expect(
        game
          .extensionRuntime!.snapshot()
          .foundation.world.regions?.some((r) => r.owner === 'giants') ?? false
      ).toBe(false);
      expect(game.monsters.some((m) => String(m.typeId).startsWith('giants.'))).toBe(false);
      expect(game.extensionRuntime!.manifest.modules.some((m) => m.id === 'giants')).toBe(false);
      play(game);
    }
    const saved = json(game.toSaveSnapshot()),
      middle = world(game),
      prefix = json(game.exportRecording()),
      midIndex = prefix.events.length;
    expect(Object.keys(saved.extensions!.modules).sort()).toEqual([...ids].sort());
    expect(saved.run.recordingOrigin).toBeDefined();
    const loaded = createHeadlessGame(812, 'test');
    expect(loaded.loadSnapshot(saved)).toBe(true);
    loaded.animationEnabled = false;
    expect(world(loaded)).toBe(middle);
    expect(loaded.hasCompleteRecording).toBe(true);
    expect(loaded.exportRecording().events).toEqual(prefix.events);
    play(loaded);
    play(loaded);
    const final = world(loaded),
      recording = json(loaded.exportRecording()),
      continuedSave = json(loaded.toSaveSnapshot());
    expect(recording.events.slice(0, midIndex)).toEqual(continuingPrefix(prefix));
    expect(recording.events.length).toBe(midIndex + 2);
    const zero = createHeadlessGame(813, 'test');
    zero.startNewGame({ seed: 1, mode: 'wizard', ruleSet: 'extended', extensions: ids });
    zero.animationEnabled = false;
    settle(zero);
    const initial = world(zero);
    const player = createHeadlessGame(814, 'test');
    replay(player, recording);
    expect(world(player)).toBe(final);
    for (const [index, expected] of [
      [recording.events.length, final],
      [0, initial],
      [midIndex, middle],
      [recording.events.length, final]
    ] as const) {
      player.replaySeek(index);
      expect(player.replayError).toBeNull();
      expect(player.replayCursor).toBe(index);
      expect(world(player)).toBe(expected);
    }
    expect(player.loadSnapshot(json(continuedSave))).toBe(true);
  },
  480000
);

it.each([{ ids: ['giants'] }, { ids: ['giants', 'combat'] }, { ids: ['giants', ...optional] }])(
  'G2-COMBO diagnostic actual break chooses exclusive provider or fallback $ids',
  ({ ids }) => {
    const { game, boss } = lanternScene(ids),
      runtime = game.extensionRuntime!;
    const commit = vi.spyOn(runtime, 'commitPartBreak');
    hitZone(game, boss, 100);
    expect(boss.hp).toBe(66);
    expect(boss.spatial!.zoneState![0]).toMatchObject({ hp: 0, broken: true });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0]![0]).toMatchObject({ balanceLoss: 5, fallbackStunTicks: 40 });
    expect(boss.spatial!.actionLockInTicks).toBe(ids.includes('combat') ? undefined : 40);
    if (ids.includes('combat'))
      expect(
        runtime.actorActionBinding()!.state.actors.find((a) => a.actorId === boss.id)?.poise
      ).toBe(7);
    hitZone(game, boss, 100);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(boss.hp).toBe(66);
  }
);

/** Diagnostic birth on an unchanged native floor. Preserve every unrelated
 * actor, including settlement resident provenance, and all world reservations. */
function intactCopperScene(ids: string[]) {
  const game = startGiants(ids, 1, 'wizard');
  const occupied = new Set([
    ...game.monsters.flatMap(m => footprintOf(m)), game.player.loc,
    ...game.items.map(i => i.loc),
    ...(game.world5?.nodes ?? []).filter(n => n.levelRef.kind === 'dungeon' && n.levelRef.depth === game.depth).map(n => n.at),
    ...(game.world5?.structures ?? []).filter(n => n.levelRef.kind === 'dungeon' && n.levelRef.depth === game.depth).map(n => n.at)
  ].map(p => `${p.x},${p.y}`));
  for (let y = 1; y < game.grid.height - 3; y++) for (let x = 2; x < game.grid.width - 3; x++) {
    const clear = Array.from({ length: 12 }, (_, i) => ({ x: x - 1 + i % 4, y: y + Math.floor(i / 4) }))
      .every(p => game.grid.getCell(p.x, p.y)?.isPassable && !occupied.has(`${p.x},${p.y}`));
    if (!clear) continue;
    const core = game.createCompositeMonster(BODY, { x, y });
    if (!core) continue;
    const limbs = game.monsters.filter(m => m !== core && m.spatial?.bodyMember?.groupId === core.id);
    expect(limbs).toHaveLength(4);
    // Isolate a zero-time damage diagnostic from unrelated native NPC turns.
    for (const monster of game.monsters) monster.ticksUntilTurn = 10000;
    return { game, core, limbs };
  }
  throw Error('No intact diagnostic copper body location');
}

it.each([{ ids: ['giants', 'growth'] }, { ids: ['giants', ...optional] }])(
  'G2-COMBO diagnostic growth zero quote cannot duplicate member/core terminal rewards $ids',
  ({ ids }) => {
    const { game, core, limbs } = intactCopperScene(ids),
      runtime = game.extensionRuntime!;
    const progression = () =>
      game.toSnapshot().extensions!.components[String(game.player.id)]!['growth:progression'];
    const growth = json(progression()),
      items = json(game.items),
      emit = vi.spyOn(runtime, 'emit');
    for (const actor of [core, ...limbs])
      expect(
        game.toSnapshot().extensions!.components[String(actor.id)]!['growth:reward']
      ).toMatchObject({ amount: 0 });
    const origin = runtime.causality.create('melee', game.player.id);
    for (const limb of limbs)
      runtime.causality.withOrigin(origin, () => limb.takeDamage(1000, true));
    expect(emit.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(0);
    expect(progression()).toEqual(growth);
    runtime.causality.withOrigin(origin, () => core.takeDamage(1000, true));
    game.killMonster(core);
    game.killMonster(core);
    expect(emit.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(1);
    expect(game.items).toEqual(items);
    play(game);
    expect(progression()).toEqual(growth);
    expect(emit.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(1);
    expect(game.monsters.some((m) => m.spatial?.bodyMember?.groupId === core.id)).toBe(false);
  }
);

it('G2-COMBO all seven naturally place complete copper body outside world nodes and structure reservations', () => {
  const { game, boss, placement } = arriveNatural('copper', 2, ['giants', ...optional]);
  const group = game.bodyGroups!.find((g) => g.coreId === boss.id)!;
  expect(group.members.filter((m) => m.life === 'active')).toHaveLength(5);
  const members = game.monsters.filter((m) => m.spatial?.bodyMember?.groupId === boss.id);
  expect(members).toHaveLength(5);
  expect(members.flatMap((m) => footprintOf(m))).toHaveLength(8);
  const region = game.extensionRuntime!.ownedRegion(placement.regionId!, game.depth)!;
  const cells = members.flatMap((m) => footprintOf(m));
  const reservations = [...game.world5!.nodes, ...game.world5!.structures].filter(
    (r) => r.levelRef.kind === 'dungeon' && r.levelRef.depth === game.depth
  );
  for (const reservation of reservations) {
    expect(regionContains(region, reservation.at)).toBe(false);
    expect(cells.some((c) => c.x === reservation.at.x && c.y === reservation.at.y)).toBe(false);
  }
  for (const member of members) {
    expect(readCreatureBirth(member)).toMatchObject({ creationReason: 'natural' });
    for (const cell of footprintOf(member)) expect(regionContains(region, cell)).toBe(true);
  }
  expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
}, 480000);

it('G2-COMBO normal mode starts naturally and reaches actual new-boss contact without diagnostic state', () => {
  const { game, boss } = arriveNatural('lantern', 1, ['giants'], 'normal');
  expect(readCreatureBirth(boss)).toMatchObject({ creationReason: 'natural' });
  expect(game.mode).toBe('normal');
  const hp = boss.hp;
  for (let n = 0; n < 800 && boss.hp === hp && !game.isGameOver; n++)
    attackNatural(game, 'lantern', boss.id);
  expect(boss.hp).toBeLessThan(hp);
}, 480000);
