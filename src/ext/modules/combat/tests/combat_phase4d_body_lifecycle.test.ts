import { afterEach, expect, it, vi } from 'vitest';
import { auditFullObjectGraph, fullGenerationRoots } from '../../../../test/support/fullGenerationCheckpointOracle';
import { installProductionBody, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from '../../../../test/support/productionComposite';

import { Monster, MonsterState } from '../../../../entities/Monster';

import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';

import { TerrainType as T, DungeonLayer as L } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import monsters from '../../../../data/monsters.json';
import type { Game } from '../../../../engine/Core/Game';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import type { ActorAttackDefinitions, ProductionActorAttackState } from '../../../actorActions';
import type { Json } from '../../../types';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

function selectSpecies(game: Game, id: string) {
  const extra = game.extensionRuntime!.nativeForms();
  const ids = [...monsters.map(m => m.id), ...extra.map(f => f.id)], chosen = ids.indexOf(id) + 1;
  expect(chosen).toBeGreaterThan(0);
  const original = rng.randRange.bind(rng);
  return vi.spyOn(rng, 'randRange').mockImplementation((min, max) => min === 1 && max === ids.length ? chosen : original(min, max));
}

function mechanics(game: Game) {
  const s = game.toSaveSnapshot(); return { monsters: s.monsters, spatial: s.run.spatialWorld, extensions: s.extensions, rng: s.rngState };
}

function unsupported(game: Game, actors: readonly Monster[]) {
  for (const actor of actors) for (const p of footprintOf(actor)) game.grid.setTerrainLayer(p.x, p.y, L.LIQUID, T.CHASM);
}

function bodyPhasedScene(coreSource = false) {
  installProductionBody(); const installed = catalog.createExtensionRegistry();
  const descriptors = catalog.getInstalledModuleDescriptors();
  const registry = registryFromDescriptors(descriptors.map(d => {
    const base = installed.create(installed.manifest([d.id]))[0]!;
    if (d.id !== 'combat') return { ...d, rules: base.rules, create: () => base };
    const definitions = structuredClone(base.actorActions!.definitions) as unknown as ActorAttackDefinitions;
    definitions.nativeProfiles.push({ monsterId: 'body-fixture.fixture-leg', profileId: 'combat.follow-thrust' });
    if (coreSource) definitions.nativeProfiles.push({ monsterId: 'body-fixture.fixture-core', profileId: 'combat.follow-thrust' });
    const rules = { ...base.rules!, fingerprint: extensionDataFingerprint({ definitions }) };
    return { ...d, rules, create: () => ({ ...base, rules, actorActions: { ...base.actorActions!, definitions: definitions as unknown as Json } }) };
  }));
  vi.mocked(catalog.createExtensionRegistry).mockReturnValue(registry);
  const game = startProductionGame(['body-fixture','combat']); emptyProductionArena(game);
  const core = game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!;
  core.state = MonsterState.HUNTING; core.behaviorFlags.add('MONST_ALWAYS_HUNTING'); core.givenUpOnScent = true;
  commitCreatureAnchor(game.player, coreSource ? { x: 13, y: 12 } : { x: 14, y: 10 }); game.executeCommand('wait');
  const state = game.extensionRuntime!.actorActionBinding()!.state as ProductionActorAttackState;
  if (!coreSource) expect(game.actorActions!.bundles[0]!.subactions).toHaveLength(2);
  return { game, core, state };
}
it.each(['polymorph','fall'] as const)('whole %s cancels all old member windups and save/load retains the same subsequent state', reason => {
  const { game, core, state } = bodyPhasedScene(), bundle = game.actorActions!.bundles[0]!;
  if (reason === 'polymorph') { selectSpecies(game, 'rat'); expect((game as any).polymorphBoltTarget(game.monsters[1])).toBe(true); }
  else { unsupported(game, game.monsters); game.executeCommand('wait'); }
  expect(bundle.subactions.every(c => c.cancelled || c.phaseIndex === c.phases.length || ['break-recovery','recovery'].includes(c.phases[c.phaseIndex]?.kind ?? ''))).toBe(true);
  if (reason === 'fall') expect(bundle.depth).toBe(2);
  expect(state.actions.flatMap(a => a.subactions).every(s => s.lockedCells.length === 0)).toBe(true);
  const save = game.toSaveSnapshot(); game.executeCommand('wait'); const expected = mechanics(game);
  expect(game.loadSnapshot(save)).toBe(true); game.executeCommand('wait'); expect(mechanics(game)).toEqual(expected);
  expect(core.id).toBe(save.run.spatialWorld?.groups[0]?.coreId ?? core.id);
});
it('cloning during member windup preserves original paid sources and gives the clone no copied action or payment', () => {
  const { game, core, state } = bodyPhasedScene(); const before = structuredClone(state),beforeRoot=structuredClone(game.actorActions!);
  const clone = game.cloneMonster(game.monsters[1]!)!;
  expect(clone).not.toBeNull(); expect(game.actorActions!).toEqual(beforeRoot);
  expect(state.actions).toEqual(before.actions);
  expect(state.actors.filter(a => a.actorId === core.id)).toEqual(before.actors.filter(a => a.actorId === core.id));
  expect(game.actorActions!.bundles.some(b => b.decisionOwnerId === clone.id)).toBe(false);
  expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});


it('failed relocating polymorph restores live source revisions so the already paid core/member action continues like a fresh load', () => {
  const { game, core } = bodyPhasedScene(true);
  expect(game.actorActions!.bundles[0]!.subactions.some(c => c.sourceEntityId === core.id)).toBe(true);
  game.grid.setTerrain(core.x + 3, core.y, T.WALL); // outside old tethers, inside the four-cell replacement
  selectSpecies(game, 'body-fixture.spine-crawler'); const saved = game.toSaveSnapshot(), random = rng.getState();
  const audit = auditFullObjectGraph(fullGenerationRoots(game), [game.extensionRuntime!]);
  const fail = vi.spyOn(game.extensionRuntime!, 'commitGeneration').mockImplementation(() => { throw new Error('relocating commit failed'); });
  expect(() => (game as any).polymorphBoltTarget(core)).toThrow('relocating commit failed'); fail.mockRestore();
  expect(audit.differences()).toEqual([]); expect(rng.getState()).toEqual(random);
  game.executeCommand('wait'); const expected = mechanics(game);
  expect(game.loadSnapshot(saved)).toBe(true); game.executeCommand('wait'); expect(mechanics(game)).toEqual(expected);
});
