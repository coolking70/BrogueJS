import { installedModuleSubsets, installedOptionalModules } from './support/installedExtensions';
import { afterEach, expect, it, vi } from 'vitest';
import { productionBodyScene, installProductionBody, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from './support/productionComposite';
import { auditFullObjectGraph, fullGenerationRoots } from './support/fullGenerationCheckpointOracle';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import { getNextEntityId } from '../entities/Creature';
import { commitCreatureAnchor, footprintOf } from '../engine/Movement/CreatureSpatial';
import { bodyStatusOwner } from '../engine/Status/BodyStatuses';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import monsters from '../data/monsters.json';
import type { Game } from '../engine/Core/Game';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

function selectSpecies(game: Game, id: string) {
  const extra = game.extensionRuntime!.nativeForms();
  const ids = [...monsters.map(m => m.id), ...extra.map(f => f.id)], chosen = ids.indexOf(id) + 1;
  expect(chosen).toBeGreaterThan(0);
  const original = rng.randRange.bind(rng);
  return vi.spyOn(rng, 'randRange').mockImplementation((min, max) => min === 1 && max === ids.length ? chosen : original(min, max));
}
function polymorphWand(game: Game, target: Monster) {
  commitCreatureAnchor(game.player, { x: target.x - 2, y: target.y });
  const wand = ItemLoader.spawnWand('wand_of_polymorphism', -1, -1)!;
  game.player.inventory.addItem(wand); const before = wand.charges!;
  const next = getNextEntityId();
  game.executeItemCommand('use', wand); game.executeCommand('mouse_travel', { ...target.loc });
  expect(wand.charges).toBe(before - 1);
  return next;
}
function mechanics(game: Game) {
  const s = game.toSaveSnapshot(); return { monsters: s.monsters, spatial: s.run.spatialWorld, extensions: s.extensions, rng: s.rngState };
}

it('native polymorph retains the complete catalog range, rejects peripheral species and draws no placement tie', () => {
  const { game, core, actors } = productionBodyScene();
  const forms = game.extensionRuntime!.nativeForms(), max = monsters.length + forms.length;
  const peripheral = monsters.length + forms.findIndex(f => f.id === actors[1]!.typeId) + 1;
  const rat = monsters.findIndex(m => m.id === 'rat') + 1;
  expect(peripheral).toBeGreaterThan(monsters.length);
  expect(game.spatialCatalog.isPeripheralForm(forms[peripheral - monsters.length - 1]!.id)).toBe(true);
  const draw = vi.spyOn(rng, 'randRange').mockReturnValueOnce(peripheral).mockReturnValueOnce(rat);
  expect((game as any).polymorphBoltTarget(actors[1])).toBe(true);
  expect(core.typeId).toBe('rat'); expect(game.monsters).toEqual([core]);
  expect(draw.mock.calls).toEqual([[1, max], [1, max]]);
});

it('a real wand contacting a leg converts the whole group to a rat, retaining core identity and no member death facts', () => {
  const { game, core, actors } = productionBodyScene(); const id = core.id, oldLegs = actors.slice(1);
  core.hp = 80; game.becomeAllyWith(actors[1]!); core.applyStatus('discordant', 10);
  const oldStats = { ...game.stats }, death = vi.spyOn(game.extensionRuntime!, 'captureDeath');
  const sample = selectSpecies(game, 'rat'); polymorphWand(game, actors[1]!);
  expect(core.typeId).toBe('rat'); expect(core.id).toBe(id); expect(core.hp).toBe(3);
  expect(core.isAlly).toBe(false); expect(core.dominated).toBe(false); expect(core.hasStatus('discordant')).toBe(false);
  expect(game.monsters).toEqual([core]); expect(game.bodyGroups).toBeUndefined(); expect(core.spatial).toBeUndefined();
  expect(oldLegs.every(m => m.hp === 0 && m.deathProcessed && m.administrativeDeath && m.carriedItem === null)).toBe(true);
  expect(death).not.toHaveBeenCalled(); expect(game.stats.kills).toBe(oldStats.kills);
  expect(sample.mock.calls.filter(([min]) => min === 1)).toHaveLength(1);
});

it('a real wand converts rat to nine-part body with core ID and native HP policy; new members use core survival ratio', () => {
  installProductionBody(); const game = startProductionGame(); emptyProductionArena(game);
  const rat = new Monster(14, 12, monsters.find(m => m.id === 'rat') as MonsterData); game.monsters.push(rat);
  rat.hp = 1; rat.state = MonsterState.HUNTING; const id = rat.id;
  selectSpecies(game, 'body-fixture.fixture-core'); const next = polymorphWand(game, rat);
  expect(rat.id).toBe(id); expect(rat.typeId).toBe('body-fixture.fixture-core'); expect(rat.hp).toBe(155);
  expect(game.bodyGroups![0]!.coreId).toBe(id); expect(game.monsters).toHaveLength(9);
  const legs = game.monsters.filter(m => m !== rat);
  expect(legs.map(m => m.id)).toEqual(Array.from({ length: 8 }, (_, i) => next + i));
  expect(legs.every(m => m.hp === 19 && bodyStatusOwner(m, 'paralyzed') === rat)).toBe(true);
  expect(getNextEntityId()).toBe(next + 8);
  const save = game.toSaveSnapshot(), expected = mechanics(game);
  expect(game.loadSnapshot(save)).toBe(true); expect(mechanics(game)).toEqual(expected);
});

it('whole polymorph no-fit preserves every old reachable value/identity, relationship, status and allocator', () => {
  const { game, core, actors } = productionBodyScene(); game.becomeAllyWith(core); core.applyStatus('slowed', 5);
  actors[1]!.addPoison(4, 2);
  for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) game.grid.setTerrain(x, y, T.WALL);
  selectSpecies(game, 'rat');
  const audit = auditFullObjectGraph(fullGenerationRoots(game), [game.extensionRuntime!]), next = getNextEntityId();
  expect((game as any).polymorphBoltTarget(actors[1])).toBe(false);
  expect(audit.differences()).toEqual([]); expect(getNextEntityId()).toBe(next);
  expect(core.typeId).toBe('body-fixture.fixture-core'); expect(core.isAlly).toBe(true);
});

it('single-to-group fit checks the peripheral cells; a core-only cavity rejects without ID or entity mutation', () => {
  installProductionBody(); const game = startProductionGame(); emptyProductionArena(game);
  const rat = new Monster(14, 12, monsters.find(m => m.id === 'rat') as MonsterData); game.monsters.push(rat);
  for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) game.grid.setTerrain(x, y, T.WALL);
  for (let x = 14; x < 16; x++) for (let y = 12; y < 14; y++) game.grid.setTerrain(x, y, T.FLOOR);
  selectSpecies(game, 'body-fixture.fixture-core'); const next = getNextEntityId(), oldLoc = rat.loc;
  expect((game as any).polymorphBoltTarget(rat)).toBe(false);
  expect(rat.typeId).toBe('rat'); expect(rat.loc).toBe(oldLoc); expect(game.monsters).toEqual([rat]);
  expect(game.bodyGroups).toBeUndefined(); expect(getNextEntityId()).toBe(next);
});

it('a damaged whole clone has fresh IDs, deep state and preserved removed slots/cooldowns, with independent leaders', () => {
  const { game, core, actors, group } = productionBodyScene();
  actors[1]!.hp = 0; game.killMonster(actors[1]!);
  const source = game.monsters.filter(m => m.spatial?.bodyMember?.groupId === core.id);
  core.applyStatus('paralyzed', 12); source[1]!.addPoison(4, 2); source[1]!.leader = core;
  group.members.find(s => s.entityId === source[1]!.id)!.readyInTicks = 73;
  core.hp = 81; const originalIds = new Set(source.map(a => a.id)), next = getNextEntityId();
  const clone = game.cloneMonster(source[1]!)!; expect(clone).not.toBeNull();
  const copies = game.monsters.filter(m => m.spatial?.bodyMember?.groupId === clone.id), cg = game.bodyGroups!.find(g => g.coreId === clone.id)!;
  expect(copies).toHaveLength(8); expect(copies.map(m => m.id)).toEqual(Array.from({ length: 8 }, (_, i) => next + i));
  expect(copies.every(m => !originalIds.has(m.id) && m.isClone && m.carriedItem === null && m.goldDropChance === 0 && m.itemDropChance === 0)).toBe(true);
  expect(clone.hp).toBe(81); expect(clone.getStatusDuration('paralyzed')).toBe(12);
  expect(cg.appliedBreaks).toEqual(group.appliedBreaks); expect(cg.appliedBreaks).not.toBe(group.appliedBreaks);
  expect(cg.members.find(s => s.partId === 'leg00')).toEqual(group.members.find(s => s.partId === 'leg00'));
  expect(cg.members.find(s => s.partId === source[1]!.spatial!.bodyMember!.partId)!.readyInTicks).toBe(73);
  expect(copies[1]!.leader).toBe(clone);
  for (const [i, copy] of copies.entries()) {
    expect(copy.spatial).not.toBe(source[i]!.spatial); expect(copy.statusDurations).not.toBe(source[i]!.statusDurations);
    expect(copy.maxStatus).not.toBe(source[i]!.maxStatus); expect(copy.behaviorFlags).not.toBe(source[i]!.behaviorFlags);
  }
  copies[1]!.statusDurations.poisoned = 9; expect(source[1]!.getStatusDuration('poisoned')).toBe(4);
  const sourceCells = new Set(source.flatMap(a => footprintOf(a)).map(p => `${p.x},${p.y}`));
  expect(copies.flatMap(a => footprintOf(a)).every(p => !sourceCells.has(`${p.x},${p.y}`))).toBe(true);
  const save = game.toSaveSnapshot(), expected = mechanics(game); expect(game.loadSnapshot(save)).toBe(true); expect(mechanics(game)).toEqual(expected);
});

it('whole clone no-fit consumes no ID or RNG and retains full source object graph', () => {
  const { game, core } = productionBodyScene();
  for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) game.grid.setTerrain(x, y, T.WALL);
  for (const p of game.monsters.flatMap(a => footprintOf(a))) game.grid.setTerrain(p.x, p.y, T.FLOOR);
  const audit = auditFullObjectGraph(fullGenerationRoots(game), [game.extensionRuntime!]), next = getNextEntityId(), random = rng.getState();
  expect(game.cloneMonster(core)).toBeNull(); expect(audit.differences()).toEqual([]);
  expect(getNextEntityId()).toBe(next); expect(rng.getState()).toEqual(random);
});

it.each(['clone','polymorph'] as const)('unexpected %s birth publication failure rolls back full native graph, runtime, allocator and both RNG streams', reason => {
  let fail = false; installProductionBody(8, undefined, () => { if (fail) throw new Error('body publication failure'); });
  const game = startProductionGame(['body-fixture', ...installedOptionalModules(['growth', 'combat'])]); emptyProductionArena(game);
  const core = game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!;
  core.applyStatus('paralyzed', 12); game.monsters[1]!.addPoison(4, 2);
  if (reason === 'polymorph') selectSpecies(game, 'body-fixture.shale-weaver');
  const audit = auditFullObjectGraph(fullGenerationRoots(game), [game.extensionRuntime!]), ext = structuredClone(game.extensionRuntime!.snapshot());
  const random = rng.getState(), next = getNextEntityId(); fail = true;
  expect(() => reason === 'clone' ? game.cloneMonster(core) : (game as any).polymorphBoltTarget(game.monsters[1])).toThrow('body publication failure');
  expect(audit.differences()).toEqual([]); expect(game.extensionRuntime!.snapshot()).toEqual(ext);
  expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(next);
});

function unsupported(game: Game, actors: readonly Monster[]) {
  for (const actor of actors) for (const p of footprintOf(actor)) game.grid.setTerrainLayer(p.x, p.y, L.LIQUID, T.CHASM);
}
it('one live support prevents the entire group falling even when core and all other feet are unsupported', () => {
  const { game, core, actors } = productionBodyScene(); core.applyStatus('paralyzed', 100);
  unsupported(game, actors); const foot = actors[1]!;
  game.grid.setTerrainLayer(foot.x, foot.y, L.LIQUID, T.NOTHING);
  const damage = vi.spyOn(rng, 'randClumpedRange'); game.executeCommand('wait');
  expect(game.monsters).toEqual(actors); expect(core.hp).toBe(160);
  expect(damage.mock.calls.filter(c => c[0] === 6 && c[1] === 12 && c[2] === 2)).toHaveLength(0);
});

it('one real wait falls the whole group to pending with one core injury; load and more waits retain clocks and receipt', () => {
  const { game, core, group, actors } = productionBodyScene(); core.applyStatus('paralyzed', 100); unsupported(game, actors);
  group.members[1]!.readyInTicks = 400;
  const damage = vi.spyOn(rng, 'randClumpedRange'); game.executeCommand('wait');
  const pending = (game as any).pendingFallenByDepth.get(2) as Monster[];
  expect(game.monsters).toHaveLength(0); expect(pending.map(m => m.id)).toEqual(actors.map(m => m.id));
  expect(core.hp).toBeGreaterThanOrEqual(148); expect(core.hp).toBeLessThanOrEqual(154);
  expect(actors.slice(1).every(m => m.hp === 20)).toBe(true);
  expect(pending.every(m => m.preplaced && !m.falling && !m.entersLevelIn && !m.approaching)).toBe(true);
  expect(damage.mock.calls.filter(c => c[0] === 6 && c[1] === 12 && c[2] === 2)).toHaveLength(1);
  const hp = core.hp, cooldown = group.members[1]!.readyInTicks, mental = core.getStatusDuration('paralyzed');
  const save = game.toSaveSnapshot(); expect(game.loadSnapshot(save)).toBe(true);
  game.executeCommand('wait'); game.executeCommand('wait');
  const restored = (game as any).pendingFallenByDepth.get(2) as Monster[], restoredCore = restored.find(m => m.id === core.id)!;
  expect(restoredCore.hp).toBe(hp); expect(restoredCore.getStatusDuration('paralyzed')).toBe(mental);
  expect(game.bodyGroups![0]!.members[1]!.readyInTicks).toBe(cooldown);
  expect(damage.mock.calls.filter(c => c[0] === 6 && c[1] === 12 && c[2] === 2)).toHaveLength(1);
  const bad = structuredClone(game.toSaveSnapshot()); bad.pendingFallenByDepth[0]!.monsters.pop();
  const before = mechanics(game); expect(game.loadSnapshot(bad)).toBe(false); expect(mechanics(game)).toEqual(before);
});

it('cached no-fit landing publishes no member; entry and space-change retry publish all together without another injury', () => {
  const { game, core, actors } = productionBodyScene(); core.applyStatus('paralyzed', 1000);
  game.depth = 2; (game as any).generateDepth(false);
  const lower = game.grid;
  for (let x = 0; x < lower.width; x++) for (let y = 0; y < lower.height; y++) lower.setTerrain(x, y, T.WALL);
  lower.setTerrain(2, 2, T.FLOOR); // single-player fit, no whole-body fit
  game.depth = 1; (game as any).generateDepth(true);
  unsupported(game, actors); game.executeCommand('wait');
  const hp = core.hp;
  expect((game as any).pendingFallenByDepth.get(2)).toHaveLength(9);
  expect(game.levels.get(2)!.monsters.some(m => actors.includes(m))).toBe(false);
  game.depth = 2; (game as any).generateDepth(false);
  expect(game.monsters.some(m => m.spatial?.bodyMember?.groupId === core.id)).toBe(false);
  game.executeCommand('wait'); expect(core.hp).toBe(hp);
  for (let x = 10; x < 20; x++) for (let y = 8; y < 18; y++) lower.setTerrain(x, y, T.FLOOR);
  game.executeCommand('wait');
  expect(game.monsters.filter(m => m.spatial?.bodyMember?.groupId === core.id)).toHaveLength(9);
  expect((game as any).pendingFallenByDepth.has(2)).toBe(false); expect(core.hp).toBe(hp);
  expect(actors.every(a => !a.preplaced && !a.falling)).toBe(true);
  const save = game.toSaveSnapshot(); expect(game.loadSnapshot(save)).toBe(true);
});

it('a fatal whole fall terminates the core once and retires every peripheral without its own death fact', () => {
  const { game, core, actors } = productionBodyScene(); core.hp = 1; core.applyStatus('paralyzed', 100); unsupported(game, actors);
  const death = vi.spyOn(game.extensionRuntime!, 'captureDeath'); game.executeCommand('wait');
  expect(core.hp).toBe(0); expect(game.bodyGroups).toBeUndefined();
  expect(death.mock.calls.map(([m]) => m.id)).toEqual([core.id]);
  expect(actors.slice(1).every(m => m.hp === 0 && m.deathProcessed)).toBe(true);
  expect((game as any).pendingFallenByDepth.has(2)).toBe(false);
});

it.each(installedModuleSubsets(['growth', 'combat']).map(subset => ({ ids: ['body-fixture', ...subset] })))
('whole plenty wand clone and real core kill keep copied rewards at zero: $ids', ({ ids }) => {
  installProductionBody(); const game = startProductionGame(ids); emptyProductionArena(game);
  const core = game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!;
  core.applyStatus('paralyzed', 1000); const leg = game.monsters[1]!;
  commitCreatureAnchor(game.player, { x: leg.x - 2, y: leg.y });
  const wand = ItemLoader.spawnWand('wand_of_plenty', -1, -1)!; game.player.inventory.addItem(wand);
  const charges = wand.charges!, hp = core.hp, legHp = leg.hp;
  game.executeItemCommand('use', wand); game.executeCommand('mouse_travel', { ...leg.loc });
  expect(wand.charges).toBe(charges - 1); expect(game.bodyGroups).toHaveLength(2);
  const clone = game.monsters.find(m => m.isClone && m.id === m.spatial?.bodyMember?.groupId)!;
  expect(clone).toBeDefined(); const copied = game.monsters.filter(m => m.spatial?.bodyMember?.groupId === clone.id);
  expect(core.hp).toBe(Math.ceil(hp / 2)); expect(clone.hp).toBe(Math.ceil(hp / 2)); expect(leg.hp).toBe(legHp);
  expect(copied).toHaveLength(9);
  const xp = () => ids.includes('growth') ? (game.extensionRuntime!.snapshot().components[game.player.id]!['growth:progression'] as {experience:number}).experience : 0;
  const before = xp();
  if (ids.includes('growth')) {
    for (const actor of copied) {
      const reward = game.extensionRuntime!.snapshot().components[actor.id]!['growth:reward'] as { creationReason: string; nativeStatsCopied: boolean };
      expect(reward.creationReason).toBe('clone'); expect(reward.nativeStatsCopied).toBe(true);
    }
  }
  clone.hp = 1; clone.defense = 0; commitCreatureAnchor(game.player, { x: clone.x - 1, y: clone.y });
  for (let i = 0; i < 12 && clone.hp > 0; i++) game.executeCommand('move', { x: 1, y: 0 });
  expect(clone.hp).toBe(0); expect(xp()).toBe(before);
  expect(copied.slice(1).every(m => m.deathProcessed && m.administrativeDeath)).toBe(true);
  expect(game.bodyGroups).toHaveLength(1); expect(core.hp).toBeGreaterThan(0);
});
