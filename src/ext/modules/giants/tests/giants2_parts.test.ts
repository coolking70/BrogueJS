import { afterEach, expect, it, vi } from 'vitest';
import { lanternScene, copperScene, hitZone } from './giants2MechanicsFixture';
import { json } from './naturalFixture';
import { footprintOf, commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import { bodyMoveTicks, validateBodyGroup } from '../../../../engine/Movement/BodyGroups';
import { fixedZoneBreaks } from '../../../../engine/Combat/FixedZoneHealth';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { withBodyAttackContact } from '../../../../engine/Combat/BodyCombat';
import { nativeFormData } from '../../../nativeForms';
import { loadGiantsDefinitionPack } from '../definitions';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { logger } from '../../../../engine/Systems/Logger';
import { TerrainType as T } from '../../../../engine/Map/Grid';
afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
});
it.each([{ ids: ['giants'] }, { ids: ['giants', 'combat'] }])(
  'G2-ZONE diagnostic real melee: capped transfer, unique break, exposed wick and exclusive provider $ids',
  ({ ids }) => {
    const { game, boss } = lanternScene(ids);
    boss.defense = -1000;
    const weapon = ItemLoader.spawnWeapon('sword', -1, -1)!;
    Object.assign(weapon, {
      damage: '60-60',
      enchantment: 0,
      strengthRequired: game.player.effectiveStrength,
      flags: []
    });
    game.player.inventory.addItem(weapon);
    game.player.equippedWeapon = weapon;
    commitCreatureAnchor(game.player, { x: 15, y: 11 });
    const mantle = footprintOf(boss).find((p) => p.zoneId === 'mantle')!,
      emit = vi.spyOn(game.extensionRuntime!, 'emit'),
      items = json(game.items),
      kills = game.stats.kills;
    const result = withBodyAttackContact(
      game.player,
      boss,
      { from: { ...game.player.loc, zoneId: 'body' }, to: mantle, distance: 1 },
      () => CombatSystem.attack(game.player, boss, { grid: game.grid })
    );
    expect(result.hit).toBe(true);
    expect(boss.hp).toBe(66);
    expect(boss.spatial!.zoneState).toEqual([
      { zoneId: 'mantle', hp: 0, broken: true, generation: 0 }
    ]);
    expect(boss.movementSpeed).toBe(200);
    expect(footprintOf(boss)).toHaveLength(7);
    expect(game.creatureAtCell(mantle)).toBe(boss);
    expect(fixedZoneBreaks(boss, game.spatialCatalog)).toHaveLength(1);
    expect(boss.spatial!.actionLockInTicks).toBe(ids.includes('combat') ? undefined : 40);
    // Actual melee also applies the frozen native-hit loss2: capacity12 - hit2 - mantle5.
    if (ids.includes('combat'))
      expect(
        game.extensionRuntime!.actorActionBinding()!.state.actors.find((a) => a.actorId === boss.id)
          ?.poise
      ).toBe(12 - 2 - 5);
    hitZone(game, boss, 100);
    expect(boss.hp).toBe(66);
    expect(fixedZoneBreaks(boss, game.spatialCatalog)).toHaveLength(1);
    hitZone(game, boss, 3, 'wick');
    expect(boss.hp).toBe(60);
    expect(game.stats.kills).toBe(kills);
    expect(game.items).toEqual(items);
    expect(emit.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(0);
    const id = boss.id;
    for (let i = 0; i < 2; i++) {
      expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
      const restored = game.monsters.find((m) => m.id === id)!;
      expect(restored.movementSpeed).toBe(200);
      expect(fixedZoneBreaks(restored, game.spatialCatalog)).toHaveLength(1);
    }
  }
);
it('G2-BODY diagnostic five entities/eight cells/four direct edges, core-only schedule, legal movement and positive blocked cost', () => {
  const { game, core, group, limbs } = copperScene();
  expect(game.spatialCatalog.fixture).toBe(false);
  expect(game.monsters).toHaveLength(5);
  expect(game.monsters.flatMap((m) => footprintOf(m))).toHaveLength(8);
  const definition = game.spatialCatalog.body(group.bodyDefinitionId);
  expect(definition.constraints).toHaveLength(4);
  expect(definition.constraints.every((e) => e.parentPartId === 'core')).toBe(true);
  expect([core, ...limbs].map((m) => game.isBodyDecisionOwner(m.id))).toEqual([
    true,
    false,
    false,
    false,
    false
  ]);
  const timers = limbs.map((m) => m.ticksUntilTurn),
    before = { ...core.loc };
  core.ticksUntilTurn = 0;
  for (let i = 0; i < 4; i++) game.executeCommand('wait');
  expect(core.loc).not.toEqual(before);
  expect(limbs.map((m) => m.ticksUntilTurn)).toEqual(timers);
  expect(core.ticksUntilTurn).toBeGreaterThan(0);
  validateBodyGroup(group, game.spatialCatalog, (id) => game.monsters.find((m) => m.id === id));
  const occupied = new Set(
    game.monsters.flatMap((m) => footprintOf(m)).map((p) => `${p.x},${p.y}`)
  );
  for (let y = 1; y < game.grid.height - 1; y++)
    for (let x = 1; x < game.grid.width - 1; x++)
      game.grid.setTerrain(
        x,
        y,
        occupied.has(`${x},${y}`) || (x === game.player.x && y === game.player.y) ? T.FLOOR : T.WALL
      );
  const blocked = { ...core.loc };
  core.ticksUntilTurn = 0;
  game.executeCommand('wait');
  expect(core.loc).toEqual(blocked);
  expect(core.ticksUntilTurn).toBeGreaterThan(0);
});
it('G2-BODY diagnostic positive-HP cap /4, released cells, tombstone and once-only movement multiplier across reload', () => {
  const { game, core, group, limbs } = copperScene(),
    a = limbs[0]!,
    b = limbs[1]!,
    where = { ...a.loc };
  const deaths = vi.spyOn(game.extensionRuntime!, 'emit');
  a.takeDamage(7, true);
  expect(a.hp).toBe(11);
  expect(core.hp).toBe(107);
  expect(b.hp).toBe(18);
  a.takeDamage(1000, true);
  expect(core.hp).toBe(105);
  expect(game.monsters).not.toContain(a);
  expect(game.creatureAtCell(where)).toBeUndefined();
  expect(group.members.find((m) => m.partId === 'limb00')).toMatchObject({
    life: 'removed',
    entityId: null
  });
  expect(group.appliedBreaks).toEqual([{ partId: 'limb00', zoneId: 'body', generation: 0 }]);
  expect(
    bodyMoveTicks(game.spatialCatalog.body(group.bodyDefinitionId), group, game.spatialCatalog, 160)
  ).toBe(200);
  expect(core.spatial!.actionLockInTicks).toBe(30);
  expect(deaths.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(0);
  for (let i = 0; i < 2; i++) {
    expect(game.loadSnapshot(json(game.toSaveSnapshot()))).toBe(true);
    const g = game.bodyGroups![0]!;
    expect(g.appliedBreaks).toHaveLength(1);
    expect(
      bodyMoveTicks(game.spatialCatalog.body(g.bodyDefinitionId), g, game.spatialCatalog, 160)
    ).toBe(200);
  }
});
it('G2-BODY diagnostic two supports move, one support stays but retains native adjacent attack', () => {
  const { game, core, limbs } = copperScene();
  limbs[0]!.takeDamage(100, true);
  limbs[1]!.takeDamage(100, true);
  const before = { ...core.loc };
  core.ticksUntilTurn = 0;
  for (let i = 0; i < 8; i++) game.executeCommand('wait');
  expect(core.loc).not.toEqual(before);
  limbs[2]!.takeDamage(100, true);
  const immobile = { ...core.loc };
  core.ticksUntilTurn = 0;
  for (let i = 0; i < 8; i++) game.executeCommand('wait');
  expect(core.loc).toEqual(immobile);
  expect(core.ticksUntilTurn).toBeGreaterThan(0);
  commitCreatureAnchor(game.player, { x: core.x - 1, y: core.y });
  core.accuracy = 10000;
  const attack = vi.spyOn(CombatSystem, 'attack');
  for (let i = 0; i < 8; i++) game.executeCommand('wait');
  expect(attack.mock.calls.some((c) => c[0] === core && c[1] === game.player)).toBe(true);
  expect(core.loc).toEqual(immobile);
});
it.each([{ ids: ['giants'] }, { ids: ['giants', 'growth'] }])(
  'G2-REWARD diagnostic zero native drops and one core terminal without member rewards $ids',
  ({ ids }) => {
    const { game, core, limbs } = copperScene(ids);
    for (const form of loadGiantsDefinitionPack().forms.slice(-4))
      expect(nativeFormData(form)).toMatchObject({ goldDropChance: 0, itemDropChance: 0 });
    expect([core, ...limbs].every((m) => !m.carriedItem)).toBe(true);
    const items = json(game.items),
      emit = vi.spyOn(game.extensionRuntime!, 'emit'),
      origin = game.extensionRuntime!.causality.create('melee', game.player.id);
    game.extensionRuntime!.causality.withOrigin(origin, () => limbs[0]!.takeDamage(1000, true));
    expect(emit.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(0);
    game.extensionRuntime!.causality.withOrigin(origin, () => core.takeDamage(1000, true));
    game.killMonster(core);
    expect(emit.mock.calls.filter((c) => c[0] === 'kill')).toHaveLength(1);
    expect(game.bodyGroups).toBeUndefined();
    expect(game.monsters.filter((m) => m !== core)).toHaveLength(0);
    expect(game.items).toEqual(items);
  }
);
