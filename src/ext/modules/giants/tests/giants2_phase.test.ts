import { afterEach, expect, it, vi } from 'vitest';
import { lanternScene, hitZone, LANTERN, OPEN } from './giants2MechanicsFixture';
import { json } from './naturalFixture';
import { footprintOf, bindSpatialCatalog } from '../../../../engine/Movement/CreatureSpatial';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { Monster } from '../../../../entities/Monster';
import { nativeFormData, nativeFormSpatial } from '../../../nativeForms';
import { logger } from '../../../../engine/Systems/Logger';
afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
});
it.each([43, 42, 1])(
  'G2-PHASE actual NPC decision threshold hp=%s preserves identity, HP, relationship and statuses',
  (hp) => {
    const { game, boss } = lanternScene();
    boss.hp = hp;
    boss.ticksUntilTurn = 0;
    boss.statusDurations.hasted = 9;
    boss.isAlly = true;
    const id = boss.id,
      items = json(game.items),
      emit = vi.spyOn(game.extensionRuntime!, 'emit');
    game.executeCommand('wait');
    expect(game.lastAdvancementError).toBeNull();
    expect(boss.id).toBe(id);
    expect(boss.hp).toBe(hp);
    expect(boss.isAlly).toBe(true);
    expect(boss.statusDurations.hasted).toBeGreaterThan(0);
    expect(game.items).toEqual(items);
    expect(emit.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(0);
    if (hp === 43) {
      expect(boss.typeId).toBe(LANTERN);
      expect(boss.bodyTransitionHistory).toBeUndefined();
    } else {
      expect(boss.typeId).toBe(OPEN);
      expect(footprintOf(boss)).toHaveLength(5);
      expect(boss.bodyTransitionHistory).toEqual(['giants.lantern-uncoil']);
      expect(boss.spatial!.zoneState).toBeUndefined();
      expect(boss.ticksUntilTurn).toBeGreaterThan(0);
      expect((game as any).tryActiveBodyTransition(boss)).toBe(false);
    }
  }
);
it.each(['r0', 'r90', 'r180', 'r270'] as const)(
  'G2-PHASE diagnostic direct commit costs 200, retains pose %s and discards broken mantle',
  (pose) => {
    const { game, boss } = lanternScene();
    hitZone(game, boss, 100);
    boss.hp = 42;
    boss.spatial!.pose = pose;
    boss.ticksUntilTurn = 0;
    boss.spatial!.actionLockInTicks = 0;
    const id = getNextEntityId(),
      random = rng.getState();
    expect((game as any).tryActiveBodyTransition(boss)).toBe(true);
    expect(boss.typeId).toBe(OPEN);
    expect(boss.hp).toBe(42);
    expect(boss.ticksUntilTurn).toBe(200);
    expect(boss.spatial!.pose).toBe(pose);
    expect(boss.movementSpeed).toBe(100);
    expect(boss.spatial!.zoneState).toBeUndefined();
    expect(getNextEntityId()).toBe(id);
    expect(rng.getState()).toEqual(random);
    hitZone(game, boss, 3, 'wick');
    expect(boss.hp).toBe(39);
    const actorId = boss.id;
    expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    expect(
      (game as any).tryActiveBodyTransition(game.monsters.find((m) => m.id === actorId)!)
    ).toBe(false);
  }
);
it('G2-PHASE diagnostic no-fit pays once without changing form, HP, identity or either RNG; save cannot retry', () => {
  const { game, boss } = lanternScene();
  boss.hp = 42;
  boss.ticksUntilTurn = 0;
  for (let y = 1; y < game.grid.height - 1; y++)
    for (let x = 1; x < game.grid.width - 1; x++) game.grid.setTerrain(x, y, T.WALL);
  for (const p of footprintOf(boss)) game.grid.setTerrain(p.x, p.y, T.FLOOR);
  game.grid.setTerrain(game.player.x, game.player.y, T.FLOOR);
  const before = {
    loc: { ...boss.loc },
    id: boss.id,
    hp: boss.hp,
    random: rng.getState(),
    allocator: getNextEntityId()
  };
  expect((game as any).tryActiveBodyTransition(boss)).toBe(true);
  expect(boss.typeId).toBe(LANTERN);
  expect(boss.loc).toEqual(before.loc);
  expect(boss.id).toBe(before.id);
  expect(boss.hp).toBe(before.hp);
  expect(boss.ticksUntilTurn).toBe(200);
  expect(boss.bodyTransitionHistory).toEqual(['giants.lantern-uncoil']);
  expect(rng.getState()).toEqual(before.random);
  expect(getNextEntityId()).toBe(before.allocator);
  expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
  const restored = game.monsters.find((m) => m.id === before.id)!;
  const random = rng.getState();
  expect((game as any).tryActiveBodyTransition(restored)).toBe(false);
  expect(restored.ticksUntilTurn).toBe(200);
  expect(rng.getState()).toEqual(random);
});
it('G2-PHASE diagnostic budget failure preserves source and charges one positive action with spent receipt', () => {
  const { game, boss } = lanternScene();
  boss.hp = 42;
  boss.ticksUntilTurn = 0;
  // Intentional over-budget diagnostic, never a claimed production birth or save.
  const form = game.extensionRuntime!.nativeForms().find((f) => f.id === OPEN)!,
    extras: Monster[] = [];
  for (let y = 1; y + 1 < game.grid.height - 1 && extras.length < 103; y += 3)
    for (let x = 1; x + 3 < game.grid.width - 1 && extras.length < 103; x += 5) {
      const m = new Monster(x, y, nativeFormData(form));
      m.spatial = nativeFormSpatial(form);
      // Raw diagnostic actors require the installed catalog before any implicit footprint read.
      bindSpatialCatalog(m, game.spatialCatalog);
      if (footprintOf(m).some((p) => game.creatureAtCell(p))) continue;
      game.monsters.push(m);
      extras.push(m);
    }
  expect(extras).toHaveLength(103);
  const emit = vi.spyOn(game.extensionRuntime!, 'emit');
  const random = rng.getState(),
    id = getNextEntityId(),
    actorId = boss.id,
    loc = { ...boss.loc };
  expect((game as any).tryActiveBodyTransition(boss)).toBe(true);
  expect(boss.typeId).toBe(LANTERN);
  expect(boss.hp).toBe(42);
  expect(boss.loc).toEqual(loc);
  expect(boss.ticksUntilTurn).toBe(200);
  expect(boss.bodyTransitionHistory).toEqual(['giants.lantern-uncoil']);
  expect(getNextEntityId()).toBe(id);
  expect(rng.getState()).toEqual(random);
  expect((game as any).tryActiveBodyTransition(boss)).toBe(false);
  expect(
    emit.mock.calls.some((c) => c[0] === 'bodyTransition' && (c[1] as any).outcome === 'budget')
  ).toBe(true);
  game.monsters = game.monsters.filter((m) => !extras.includes(m));
  expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
  expect((game as any).tryActiveBodyTransition(game.monsters.find((m) => m.id === actorId)!)).toBe(
    false
  );
});
