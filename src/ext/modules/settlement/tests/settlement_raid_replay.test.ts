import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { createConfiguredWorldHarness } from '../../../testing/configuredWorldHarness';
import { it, expect, vi, afterEach } from 'vitest';
import { Game } from '../../../../engine/Core/Game';
import { installRecordingScene } from '../../../../test/support/recordingV4';
import { worldHarnessGame } from '../../../testing/worldHarness';
import { scene, establish, build, base, current, walk, stairs, travelScenes } from './helpers';
import { campRaid } from '../../../../engine/Core/SettlementRaids';
import { createExtensionRegistry } from '../../../catalog';
import type { WorldHarness } from '../../../worldSdk';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
const live: WorldHarness[] = [];
afterEach(() => {
  live.splice(0).forEach((h) => h.dispose());
  vi.restoreAllMocks();
});
function publicCamp(h: WorldHarness, g: Game) {
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  const nearby = (at: { x: number; y: number }) => {
    const spots = [
      { x: at.x - 1, y: at.y },
      { x: at.x + 1, y: at.y },
      { x: at.x, y: at.y - 1 },
      { x: at.x, y: at.y + 1 }
    ]
      .filter((p) => g.grid.getCell(p.x, p.y)?.isPassable && !g.getMonsterAt(p.x, p.y))
      .sort(
        (a, b) =>
          Math.abs(a.x - g.player.x) +
          Math.abs(a.y - g.player.y) -
          Math.abs(b.x - g.player.x) -
          Math.abs(b.y - g.player.y)
      );
    expect(spots.length).toBeGreaterThan(0);
    walk(h, g, spots[0]!);
  };
  nearby({ x: 19, y: 12 });
  expect(h.ext('settlement', 'build', build(g, 'door', { x: 19, y: 12 })).error).toBeNull();
  const door = g.world5!.structures.find(
    (s) => s.barrier?.definitionId === 'settlement.door'
  )!.barrier!;
  expect(
    h.ext('settlement', 'door', {
      ...base(g),
      componentId: door.id,
      componentRevision: door.revision,
      open: true
    }).error
  ).toBeNull();
  for (let y = 12; y <= 16; y++)
    for (let x = 17; x <= 21; x++) {
      const edge = x === 17 || x === 21 || y === 12 || y === 16;
      if (edge && (((x === 17 || x === 21) && (y === 12 || y === 16)) || (x === 19 && y === 12)))
        continue;
      nearby({ x, y });
      expect(
        h.ext('settlement', 'build', build(g, edge ? 'wood-wall' : 'roof', { x, y })).error
      ).toBeNull();
    }
  nearby({ x: 18, y: 13 });
  expect(h.ext('settlement', 'build', build(g, 'bed', { x: 18, y: 13 })).error).toBeNull();
  const a = g.monsters.find(
    (a) => a.id === g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId
  )!;
  nearby(a.loc);
  const c = current(g);
  expect(
    h.ext('settlement', 'recruit', {
      v: 1,
      stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
      campId: c.regionId,
      campRevision: c.revision,
      targetId: a.id,
      targetRevision: 0
    }).error
  ).toBeNull();
  const food = g.player.inventory.items.find((i) => i.consumableId === 'ration_of_food')!;
  nearby({ x: 21, y: 12 });
  expect(
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: c.supplyId,
      containerRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
      direction: 'deposit',
      items: [{ itemId: food.id, quantity: 8 }]
    }).error
  ).toBeNull();
  return a;
}
it.each([{ modules: ['settlement'] }, { modules: ['settlement', 'combat'] }])(
  'S4 public controlled-origin raid, fixed enabled rules and actual freeze/close/recovery save/replay/seek with $modules',
  ({ modules }) => {
    vi.restoreAllMocks();
    installRecordingScene((g) => {
      if (!g.extensionRuntime?.residentOwners().includes('settlement')) return;
      scene(g);
      g.player.inventory.items.find((i) => i.consumableId === 'ration_of_food')!.quantity = 12;
      g.player.hp = g.player.maxHp = 1000;
      if (g.player.equippedWeapon) g.player.equippedWeapon.damage = '40-40';
      const a = g.monsters.find(
        (a) => a.id === g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId
      )!;
      a.loc = { x: 22, y: 13 };
      a.ticksUntilTurn = 100000;
    });
    travelScenes();
    const h = createConfiguredWorldHarness(
      { seed: 51020001, mode: 'easy', modules },
      {
        settlement: { raids: true }
      }
    );
    live.push(h);
    const g = worldHarnessGame(h),
      a = publicCamp(h, g);
    walk(h, g, { x: 29, y: 9 });
    for (
      let n = 0;
      n < 800 && campRaid(g, current(g).slot)!.event?.phase !== 'active' && !g.isGameOver;
      n++
    )
      h.command('wait');
    expect(g.isGameOver).toBe(false);
    expect(campRaid(g, current(g).slot)!.event?.phase).toBe('active');
    const activeIndex = g.recordedInputEvents.length,
      activeDigest = h.digest();
    stairs(h, g, true);
    expect(g.depth).toBe(2);
    expect(campRaid(g, current(g).slot)!.pauseFrom).not.toBeNull();
    for (let n = 0; n < 30; n++) h.command('wait');
    const pausedIndex = g.recordedInputEvents.length,
      pausedDigest = h.digest();
    h.load(h.save());
    expect(h.digest()).toBe(pausedDigest);
    stairs(h, g, false);
    expect(g.depth).toBe(1);
    expect(campRaid(g, current(g).slot)!.event?.phase).toBe('active');
    const returnedIndex = g.recordedInputEvents.length,
      returnedDigest = h.digest();
    for (let n = 0; n < 120 && campRaid(g, current(g).slot)!.event!.phase === 'active'; n++) {
      const id = campRaid(g, current(g).slot)!.event!.actorIds.find((id) =>
        g.monsters.some((m) => m.id === id && m.hp > 0 && !m.isAlly)
      );
      const enemy = g.monsters.find((m) => m.id === id);
      if (!enemy) {
        h.command('wait');
        continue;
      }
      const dx = enemy.x - g.player.x,
        dy = enemy.y - g.player.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) <= 1) {
        h.command('move', { x: Math.sign(dx), y: Math.sign(dy) });
        continue;
      }
      const spots = [
        { x: enemy.x - 1, y: enemy.y },
        { x: enemy.x + 1, y: enemy.y },
        { x: enemy.x, y: enemy.y - 1 },
        { x: enemy.x, y: enemy.y + 1 }
      ]
        .filter((p) => g.grid.getCell(p.x, p.y)?.isPassable && !g.getMonsterAt(p.x, p.y))
        .sort(
          (a, b) =>
            Math.abs(a.x - g.player.x) +
            Math.abs(a.y - g.player.y) -
            Math.abs(b.x - g.player.x) -
            Math.abs(b.y - g.player.y)
        );
      expect(spots.length).toBeGreaterThan(0);
      walk(h, g, spots[0]!);
    }
    expect(g.isGameOver).toBe(false);
    expect(campRaid(g, current(g).slot)!.event!.phase).toBe('closed');
    const closedIndex = g.recordedInputEvents.length,
      closedDigest = h.digest();
    for (let n = 0; n < 12; n++) h.command('wait');
    const final = h.digest(),
      recording = h.exportRecording(),
      end = g.recordedInputEvents.length;
    expect(
      JSON.parse(recording).extensions.modules.find((m: any) => m.id === 'settlement').configuration
    ).toEqual({ raids: true });
    h.load(h.save());
    expect(h.digest()).toBe(final);
    h.command('wait');
    expect(h.replay(h.exportRecording())).toEqual({ ok: true, firstMismatch: null });
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(final);
    for (const [cursor, digest] of [
      [activeIndex, activeDigest],
      [pausedIndex, pausedDigest],
      [returnedIndex, returnedDigest],
      [closedIndex, closedDigest],
      [end, final]
    ] as const) {
      h.seek(recording, cursor);
      expect(h.digest()).toBe(digest);
      h.load(h.save());
      expect(h.digest()).toBe(digest);
    }
    expect(residentComponent(g, a.id)).toBeDefined();
  }
);
it('fixed manifest defaults off and rejects malformed configs, absent owners, and changed rule identity before retiring live Game', () => {
  const registry = createExtensionRegistry(),
    off = registry.manifest(['settlement']),
    on = registry.manifest(['settlement'], { settlement: { raids: true } });
  expect(off.modules[0]!.configuration).toEqual({ raids: false });
  expect(on.modules[0]!.rules).not.toEqual(off.modules[0]!.rules);
  for (const configuration of [null, {}, { raids: 1 }, { raids: true, extra: true }])
    expect(() => registry.manifest(['settlement'], { settlement: configuration as any })).toThrow();
  expect(() => registry.manifest([], { settlement: { raids: true } })).toThrow();
  const bad = structuredClone(on);
  bad.modules[0]!.configuration = { raids: false };
  expect(() => registry.create(bad)).toThrow();
  const g = new Game({ seed: 7 }),
    before = g.toSnapshot();
  expect(() =>
    g.startNewGame({
      seed: 8,
      ruleSet: 'extended',
      extensions: ['settlement'],
      extensionConfigurations: { settlement: { raids: 'yes' } }
    })
  ).toThrow();
  expect({ ...g.toSnapshot(), savedAt: before.savedAt }).toEqual(before);
  g.extensionRuntime?.unload();
});

it.each([{ modules: ['settlement'] }, { modules: ['settlement', 'combat'] }])(
  'R1-F1 public native polymorph, pause/return save/load/replay/seek with $modules', ({ modules }) => {
    vi.restoreAllMocks();
    installRecordingScene(g => {
      if (!g.extensionRuntime?.residentOwners().includes('settlement')) return;
      scene(g); g.player.hp = g.player.maxHp = 1000;
      g.player.inventory.items.find(i => i.consumableId === 'ration_of_food')!.quantity = 12;
      const wand = ItemLoader.spawnWand('wand_of_polymorphism', -1, -1)!;
      wand.charges = 10; g.player.inventory.addItem(wand);
      const resident = g.monsters.find(a => a.id === g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId)!;
      resident.loc = { x: 22, y: 13 }; resident.ticksUntilTurn = 100000;
    });
    travelScenes();
    const h = createConfiguredWorldHarness({ seed: 51020001, mode: 'easy', modules }, { settlement: { raids: true } });
    live.push(h); const g = worldHarnessGame(h); publicCamp(h, g); walk(h, g, { x: 29, y: 9 });
    for (let n = 0; n < 800 && campRaid(g, current(g).slot)!.event?.phase !== 'active' && !g.isGameOver; n++) h.command('wait');
    expect(g.isGameOver).toBe(false); expect(campRaid(g, current(g).slot)!.event!.phase).toBe('active');
    const enemy = g.monsters.filter(m => campRaid(g, current(g).slot)!.event!.actorIds.includes(m.id))
      .sort((a, b) => Math.hypot(a.x - g.player.x, a.y - g.player.y) - Math.hypot(b.x - g.player.x, b.y - g.player.y))[0]!;
    const id = enemy.id, beforeType = enemy.typeId, eventId = campRaid(g, current(g).slot)!.event!.id;
    const wand = g.player.inventory.items.find(i => i.identityId === 'wand_of_polymorphism')!;
    expect(wand).toBeDefined(); g.executeItemCommand('use', wand); h.command('mouse_travel', { ...enemy.loc });
    expect(enemy.typeId).not.toBe(beforeType); expect(enemy.hp).toBeGreaterThan(0);
    expect(campRaid(g, current(g).slot)!.event!.actors.find(a => a.actorId === id)!.currentTypeId).toBe(enemy.typeId);
    const checkpoints: [number, ReturnType<typeof h.digest>][] = [[g.recordedInputEvents.length, h.digest()]];
    h.load(h.save()); expect(h.digest()).toBe(checkpoints[0]![1]);
    stairs(h, g, true); expect(g.depth).toBe(2);
    expect(campRaid(g, current(g).slot)!.pauseFrom).not.toBeNull();
    for (let n = 0; n < 30; n++) h.command('wait');
    checkpoints.push([g.recordedInputEvents.length, h.digest()]);
    h.load(h.save()); expect(h.digest()).toBe(checkpoints[1]![1]);
    stairs(h, g, false); expect(g.depth).toBe(1);
    expect(campRaid(g, current(g).slot)!.event!.id).toBe(eventId);
    expect(campRaid(g, current(g).slot)!.event!.phase).toBe('active');
    checkpoints.push([g.recordedInputEvents.length, h.digest()]);
    const recording = h.exportRecording(); expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(checkpoints[2]![1]);
    for (const [cursor, digest] of checkpoints) {
      h.seek(recording, cursor); expect(h.digest()).toBe(digest);
      h.load(h.save()); expect(h.digest()).toBe(digest);
    }
  }
);
