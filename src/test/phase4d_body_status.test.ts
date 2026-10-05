import { afterEach, expect, it, vi } from 'vitest';
import { productionBodyScene } from './support/productionComposite';
import { bodyStatusOwner } from '../engine/Status/BodyStatuses';
import { validateNativeBodyStatusRows, SpatialValidationError } from '../engine/Movement/SpatialSchema';
import { monstersAreEnemies, monstersAreTeammates, MonsterState } from '../entities/Monster';
import type { StatusId } from '../entities/Creature';
import { CreatureSpatial, commitCreatureAnchor, distanceBetweenFootprints, footprintOf } from '../engine/Movement/CreatureSpatial';
import { CompositeMovement } from '../engine/Movement/CompositeMovement';
import { creatureStatusRows } from '../engine/Status/statusConfig';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { TerrainType, DungeonLayer } from '../engine/Map/Grid';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

it.each<StatusId>(['paralyzed','confused','entranced','magical_fear','discordant','hasted','slowed','invisible'])
('all members route %s to one core storage and one objective countdown', status => {
  const { game, core, actors } = productionBodyScene();
  if (status !== 'paralyzed') core.applyStatus('paralyzed', 100);
  for (const actor of actors) actor.applyStatus(status, 12, 'stack');
  expect(core.getStatusDuration(status)).toBe(12);
  expect(actors.slice(1).every(a => a.statusDurations[status] === undefined && a.getStatusDuration(status) === 12)).toBe(true);
  expect(creatureStatusRows(actors[1]!).some(s => s.id === status)).toBe(true);
  game.executeCommand('wait');
  expect(core.getStatusDuration(status)).toBe(11);
  expect(actors.slice(1).every(a => a.statusDurations[status] === undefined && a.getStatusDuration(status) === 11)).toBe(true);
});

it('group speed changes refresh every source from its own native speed, and expiration restores it once', () => {
  const { core, actors } = productionBodyScene();
  actors[1]!.applyStatus('hasted', 1);
  expect(core.attackSpeed).toBe(35); expect(actors[1]!.attackSpeed).toBe(65);
  for (const actor of actors) actor.tickStatuses();
  expect(core.attackSpeed).toBe(70); expect(actors[1]!.attackSpeed).toBe(130);
  actors[2]!.applyStatus('slowed', 1);
  expect(actors.every(a => a.movementSpeed === 200)).toBe(true);
  for (const actor of actors) actor.tickStatuses();
  expect(actors.every(a => a.movementSpeed === 100)).toBe(true);
});

it('poison, fire immunity and web remain local, and a stuck leg only has stationary landing candidates', () => {
  const { game, core, group, actors } = productionBodyScene(); const leg = actors[1]!;
  core.applyStatus('paralyzed', 100); leg.addPoison(4, 1); leg.applyStatus('immune_fire', 5);
  expect(actors.slice(2).every(a => !a.hasStatus('poisoned') && !a.hasStatus('immune_fire'))).toBe(true);
  expect(bodyStatusOwner(leg, 'poisoned')).toBe(leg);
  game.executeCommand('wait');
  expect(leg.hp).toBe(19); expect(core.hp).toBe(160); expect(leg.getStatusDuration('poisoned')).toBe(3);
  core.setStatusDuration('paralyzed', 0); leg.applyStatus('stuck', 3);
  const spatial = new CreatureSpatial(game, game.spatialCatalog); spatial.groups.push(group);
  try {
    const result = new CompositeMovement(spatial).planStep(core.id, { x: core.x + 1, y: core.y });
    expect(result.status).toBe('planned');
    if (result.status === 'planned') expect(result.plan.trajectories.find(t => t.entityId === leg.id)?.path).toEqual([{ ...leg.loc }]);
  } finally { spatial.dispose(); }
});

it('ally conversion through a leg changes the whole group; discord never makes two own members enemies', () => {
  const { game, core, actors } = productionBodyScene(); game.becomeAllyWith(actors[1]!);
  expect(actors.every(a => a.isAlly && a.state === MonsterState.WANDERING)).toBe(true);
  expect(monstersAreEnemies(actors[1]!, game.player)).toBe(false);
  actors[2]!.applyStatus('discordant', 12);
  expect(monstersAreEnemies(actors[1]!, game.player)).toBe(true);
  expect(monstersAreEnemies(core, actors[1]!)).toBe(false);
  expect(monstersAreTeammates(actors[1]!, actors[2]!)).toBe(true);
  expect(actors.filter(a => a.statusDurations.discordant !== undefined)).toEqual([core]);
});

it('classification is complete and frozen; unknown/duplicate/partial rows and forged member status storage are rejected', () => {
  const { game, core, actors } = productionBodyScene();
  const rows = game.spatialCatalog.statusProfile('foundation:native').rows;
  expect(Object.isFrozen(rows)).toBe(true);
  for (const bad of [rows.slice(1), [...rows.slice(1), rows[1]], [...rows.slice(1), { ...rows[0], statusId: 'future' }],
    [...rows.slice(1), { ...rows[0], disables: ['script'] }]]) expect(() => validateNativeBodyStatusRows(bad)).toThrow(SpatialValidationError);
  expect(() => bodyStatusOwner(actors[1]!, 'future')).toThrow('Unclassified');
  const snapshot = game.toSaveSnapshot();
  const bad = JSON.parse(JSON.stringify(snapshot));
  bad.monsters.find((m: { id: number }) => m.id === actors[1]!.id).statusDurations.paralyzed = 9;
  const before = JSON.stringify({ ...game.toSaveSnapshot(), savedAt: 0 }), random = rng.getState();
  expect(game.loadSnapshot(bad)).toBe(false);
  expect(JSON.stringify({ ...game.toSaveSnapshot(), savedAt: 0 })).toBe(before); expect(rng.getState()).toEqual(random);
  expect(core.hp).toBe(160);
});

it('save/load rebuilds trusted routing and continues the same objective/local status result', () => {
  const { game, core, actors } = productionBodyScene();
  core.applyStatus('paralyzed', 100); actors[1]!.applyStatus('confused', 10); actors[2]!.addPoison(6, 1);
  const save = game.toSaveSnapshot();
  game.executeCommand('wait');
  const expected = game.toSaveSnapshot();
  expect(game.loadSnapshot(save)).toBe(true);
  const leg = game.monsters.find(m => m.id === actors[1]!.id)!;
  expect(bodyStatusOwner(leg, 'confused').id).toBe(core.id);
  game.executeCommand('wait');
  const actual = game.toSaveSnapshot();
  expect(actual.monsters).toEqual(expected.monsters);
  expect(actual.run.spatialWorld).toEqual(expected.run.spatialWorld);
  expect(actual.rngState).toEqual(expected.rngState);
});

it('a real domination wand aimed at one leg rolls against core HP once and converts all nine actors', () => {
  const { game, core, actors } = productionBodyScene(); core.hp = 1;
  const leg = actors[1]!; commitCreatureAnchor(game.player, { x: leg.x - 2, y: leg.y });
  const item = ItemLoader.spawnWand('wand_of_domination', -1, -1)!; game.player.inventory.addItem(item);
  const charges = item.charges!, roll = vi.spyOn(rng, 'randPercent');
  game.executeItemCommand('use', item); game.executeCommand('mouse_travel', { ...leg.loc });
  expect(item.charges).toBe(charges - 1);
  expect(roll.mock.calls.filter(([chance]) => chance === 100)).toHaveLength(1);
  expect(actors.every(a => a.isAlly && a.dominated)).toBe(true);
});

it('entrancement through one leg applies one inverse whole-group movement during a real player move', () => {
  const { game, core, actors, group } = productionBodyScene(); actors[1]!.applyStatus('entranced', 10);
  const from = { ...core.loc }; game.executeCommand('move', { x: 1, y: 0 });
  expect(core.loc).toEqual({ x: from.x - 1, y: from.y });
  expect(actors.slice(1).every(a => a.statusDurations.entranced === undefined)).toBe(true);
  expect(game.bodyGroups).toContain(group); expect(game.monsters).toHaveLength(9);
});

it('fear applied to a leg sends the core away from the threat with positive time and no foot attacks', () => {
  const { game, core, actors } = productionBodyScene();
  actors[1]!.applyStatus('magical_fear', 10); const distance = distanceBetweenFootprints(core, game.player);
  game.executeCommand('wait');
  expect(distanceBetweenFootprints(core, game.player)).toBeGreaterThan(distance);
  expect(game.bodyGroups![0]!.members.every(s => s.readyInTicks === 0)).toBe(true);
  expect(core.ticksUntilTurn).toBeGreaterThanOrEqual(0);
});

it('paralysis gas across all body cells merges one core effect and decrements it only once in real objective time', () => {
  const { game, core, actors } = productionBodyScene(); core.ticksUntilTurn = 200;
  for (const actor of actors) for (const p of footprintOf(actor)) game.grid.setTerrainLayer(p.x, p.y, DungeonLayer.GAS, TerrainType.PARALYSIS_GAS);
  const apply = vi.spyOn(core, 'applyStatus'); game.executeCommand('wait');
  expect(apply.mock.results.filter(r => r.type === 'return' && r.value === true)).toHaveLength(1);
  expect(core.getStatusDuration('paralyzed')).toBe(19);
  expect(actors.slice(1).every(a => a.statusDurations.paralyzed === undefined && a.hasStatus('paralyzed'))).toBe(true);
});

it('one burning leg takes one native fire tick and one quarter transfer without igniting other legs', () => {
  const { game, core, actors } = productionBodyScene(); core.applyStatus('paralyzed', 100);
  const leg = actors[1]!; leg.setStatusDuration('burning' as StatusId, 4);
  game.executeCommand('wait');
  expect(leg.hp).toBeLessThan(20); expect(leg.getStatusDuration('burning' as StatusId)).toBe(3);
  expect(core.hp).toBe(160 - Math.floor((20 - leg.hp) / 4));
  expect(actors.slice(2).every(a => a.hp === 20 && !a.hasStatus('burning' as StatusId))).toBe(true);
  expect(core.hasStatus('burning' as StatusId)).toBe(false);
});
