import { describe, it, expect, afterEach, vi } from 'vitest';
import { Grid, TerrainType as T, DungeonLayer } from '../engine/Map/Grid';
import * as chambers from '../engine/Generator/SideChamber';
import * as generation from '../engine/Core/GenerationCoordinator';
import {
  auditFullObjectGraph,
  checkpointFullGenerationWorld,
  fullGenerationRoots
} from './support/fullGenerationCheckpointOracle';
import { BlueprintEngine } from '../engine/Generator/BlueprintEngine';
import { getNextEntityId } from '../entities/Creature';
import { getNextMachineNumber } from '../engine/Generator/BlueprintEngine';
import { logger } from '../engine/Systems/Logger';
import { nativeFormData } from '../ext/nativeForms';
import { sideChamberCandidates, sideChamberValid } from '../engine/Generator/SideChamber';
import {
  generationReserved,
  bindGenerationReservation
} from '../engine/Generator/GenerationReservation';
import { stairFallbackQualifies, validStairLoc } from '../engine/Generator/Stairs';
import { validGenerationContribution } from '../ext/generation';
import { validNativeForm, bindNativeForms, nativeFormsFor } from '../ext/nativeForms';
import { createHeadlessGame } from './harness';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import { Monster, type MonsterData } from '../entities/Monster';
import species from '../data/monsters.json';
import { rng } from '../engine/Random';
import { knownPolymorphSpecies, polymorphSpecies } from '../engine/Combat/Polymorph';
import { spawnDungeonFeature, catalogFeature } from '../engine/Map/DungeonFeature';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import type { NativeFormDefinition } from '../ext/nativeForms';
import type { Json } from '../ext/types';
const form: NativeFormDefinition = {
  id: 'arena-fixture.beast',
  nameKey: 'ext.arena-fixture.beast',
  descriptionKey: 'ext.arena-fixture.description',
  size: 2,
  char: 'Q',
  color: 0x998877,
  hp: 100,
  accuracy: 90,
  defense: 40,
  damage: '4-9',
  moveSpeed: 100,
  attackSpeed: 100,
  bloodType: 0,
  DFChance: 0,
  DFType: 0
};
const template = {
  id: 'arena-fixture.chamber',
  priority: 0,
  minDepth: 3,
  maxDepth: 8,
  chance: 50,
  width: 12,
  height: 10,
  entranceWidth: 3,
  candidateLimit: 16,
  formId: form.id,
  guard: 'return-to-spawn' as const
};
afterEach(() => {
  vi.restoreAllMocks();
  logger.presentAcknowledgments(null);
});
describe('4a-4 foundation finite generation contributions', () => {
  it('rejects callbacks, foreign forms, bad dimensions and unbounded budgets', () => {
    expect(validGenerationContribution(template, 'arena-fixture')).toBe(true);
    for (const change of [
      { candidateLimit: 17 },
      { entranceWidth: 2 },
      { width: 11 },
      { height: 9 },
      { chance: 101 },
      { minDepth: 0 },
      { formId: 'other.beast' },
      { script: 'dig' }
    ])
      expect(validGenerationContribution({ ...template, ...change }, 'arena-fixture')).toBe(false);
    expect(validNativeForm(form, 'arena-fixture')).toBe(true);
    for (const change of [
      { hp: 0 },
      { size: 4 },
      { behaviorFlags: ['MONST_INVULNERABLE'] },
      { DFChance: 50 },
      { moveSpeed: 0 },
      { damage: '9-4' },
      { nameKey: 'name.rat' }
    ])
      expect(validNativeForm({ ...form, ...change }, 'arena-fixture')).toBe(false);
  });
  it('checks actual square anchors and a continuous player ring in an attached rock chamber', () => {
    const grid = new Grid(60, 30);
    for (let x = 0; x < grid.width; x++)
      for (let y = 0; y < grid.height; y++) grid.setTerrain(x, y, T.GRANITE, ' ', 0x333333);
    for (let x = 10; x <= 12; x++) grid.setTerrain(x, 15, T.FLOOR, '.', 0x888888);
    const plans = sideChamberCandidates(grid, template);
    expect(plans.length).toBeGreaterThan(0);
    const p = plans[0]!;
    for (const at of p.carve) grid.setTerrain(at.x, at.y, T.FLOOR, '.', 0x888888);
    expect(sideChamberValid(grid, p, 2)).toBe(true);
    expect(p.entry).toHaveLength(3);
    grid.setTerrainLayer(p.spawn.x + 1, p.spawn.y + 1, DungeonLayer.DUNGEON, T.WALL);
    expect(sideChamberValid(grid, p, 2)).toBe(false);
  });
  it('reservation rejects native stair and feature placement and disappears when released', () => {
    const grid = new Grid(60, 30);
    grid.setTerrain(10, 10, T.FLOOR, '.', 0x888888);
    bindGenerationReservation(grid, new Set([10 * grid.width + 10]));
    expect(generationReserved(grid, 10, 10)).toBe(true);
    expect(stairFallbackQualifies(grid, 10, 10, new Set())).toBe(false);
    expect(validStairLoc(grid, 10, 10, new Set())).toBe(false);
    const before = JSON.stringify(grid.getCell(10, 10));
    expect(
      spawnDungeonFeature(grid, 10, 10, catalogFeature(DF.DF_RED_BLOOD), false).succeeded
    ).toBe(false);
    expect(JSON.stringify(grid.getCell(10, 10))).toBe(before);
    bindGenerationReservation(grid);
    expect(generationReserved(grid, 10, 10)).toBe(false);
  });
  it('native catalog is opt-in; original polymorph range/order is unchanged without forms', () => {
    const rat = (species as MonsterData[]).find((m) => m.id === 'rat')!;
    const spy = { randRange: vi.fn(() => 1) };
    polymorphSpecies('goblin', spy);
    expect(spy.randRange).toHaveBeenCalledWith(1, species.length);
    expect(knownPolymorphSpecies(form.id)).toBe(false);
    expect(knownPolymorphSpecies(form.id, [{ ...rat, id: form.id }])).toBe(true);
    const actor = new Monster(5, 5, rat);
    expect(nativeFormsFor(actor)).toEqual([]);
    bindNativeForms(actor, [form]);
    expect(nativeFormsFor(actor)).toEqual([form]);
    bindNativeForms(actor);
    expect(nativeFormsFor(actor)).toEqual([]);
  });
  it('runtime validates and freezes declarations and uses stable owner/template order', () => {
    const game = createHeadlessGame(4404, 'test'),
      registry = new ExtensionRegistry();
    const forms = [form],
      templates = [template];
    registry.register('arena-fixture', '1.0.0', () => ({
      id: 'arena-fixture',
      version: '1.0.0',
      ownedRegions: true,
      nativeForms: forms,
      generationContributions: templates,
      initialState: () => ({}),
      validateState: (v): v is Json => !!v && typeof v === 'object'
    }));
    const runtime = new ExtensionRuntime(registry, registry.manifest(['arena-fixture']), {
      depth: () => 3,
      playerId: () => game.player.id,
      randomInt: (a, b) => rng.randRange(a, b),
      message: () => {}
    });
    expect(Object.isFrozen(runtime.nativeForms()[0])).toBe(true);
    expect(runtime.generationContributions(2)).toEqual([]);
    expect(runtime.generationContributions(3)[0]!.owner).toBe('arena-fixture');
    templates[0] = { ...template, chance: 0 };
    expect(runtime.generationContributions(3)[0]!.chance).toBe(50);
  });
});

/** A foundation-owned fixture; no optional module imports or dependencies. */
function contributedGame(failPublication = false, two = false) {
  const game = createHeadlessGame(7306, 'normal'),
    registry = new ExtensionRegistry();
  const templates = [
    { ...template, minDepth: 2, chance: 100 },
    ...(two ? [{ ...template, id: 'arena-fixture.second', minDepth: 2, chance: 100 }] : [])
  ];
  registry.register('arena-fixture', '1.0.0', () => ({
    id: 'arena-fixture',
    version: '1.0.0',
    ownedRegions: true,
    nativeForms: [form],
    generationContributions: templates,
    initialState: () => ({ placements: [] }),
    validateState: (v): v is Json => !!v && typeof v === 'object',
    hooks: {
      generationPlacement(event, context) {
        const state = context.state as { placements: Json[] };
        context.setState({ placements: [...state.placements, event as unknown as Json] });
        if (failPublication) {
          context.setComponent(game.player.id, 'sentinel', { draw: context.randomInt(1, 100) });
          context.message('fixture rollback sentinel');
          throw new Error('contribution publication fault');
        }
      }
    }
  }));
  const runtime = new ExtensionRuntime(registry, registry.manifest(['arena-fixture']), {
    depth: () => game.depth,
    playerId: () => game.player.id,
    randomInt: (a, b) => rng.randRange(a, b),
    message: (m) => logger.log(m)
  });
  game.extensionRuntime = runtime;
  runtime.attachCreature(game.player, false);
  return { game, runtime };
}
const snapshot = (game: import('../engine/Core/Game').Game) => {
  const s = JSON.parse(JSON.stringify(game.toSnapshot()));
  s.savedAt = 0;
  return s;
};
describe('4a-4 foundation publication and independent rollback oracle', () => {
  it.each(['narrow', 'full-oracle'])(
    'contributed generation failure restores the complete old object graph: %s',
    (mode) => {
      const { game, runtime } = contributedGame(true);
      if (mode === 'full-oracle')
        vi.spyOn(generation, 'checkpointGenerationWorld').mockImplementation(() =>
          checkpointFullGenerationWorld(game)
        );
      const before = snapshot(game),
        graph = auditFullObjectGraph(fullGenerationRoots(game), [runtime]),
        ids = getNextEntityId(),
        machines = getNextMachineNumber(),
        random = rng.getState();
      game.depth = 3;
      expect(() => (game as any).generateDepth()).toThrow('contribution publication fault');
      expect(graph.differences()).toEqual([]);
      expect(snapshot(game)).toEqual(before);
      expect(getNextEntityId()).toBe(ids);
      expect(getNextMachineNumber()).toBe(machines);
      expect(rng.getState()).toEqual(random);
    }
  );
  it('exhausted native candidates write one no-space receipt without installing regions or retrying the floor', () => {
    const { game, runtime } = contributedGame();
    const candidates = vi.spyOn(chambers, 'sideChamberCandidates').mockReturnValue([]);
    game.depth = 3;
    (game as any).generateDepth();
    const state = runtime.snapshot().modules['arena-fixture'] as { placements: Json[] };
    expect(state.placements).toHaveLength(1);
    expect(state.placements[0]).toMatchObject({
      result: 'skipped',
      reason: 'no-space',
      actorId: null,
      regionId: null
    });
    expect(runtime.snapshot().foundation.world.regions).toBeUndefined();
    expect(candidates).toHaveBeenCalledTimes(1);
  });
  it('per-floor success budget is one, with a receipt for the remaining eligible template', () => {
    const { game, runtime } = contributedGame(false, true);
    game.depth = 3;
    (game as any).generateDepth();
    const state = runtime.snapshot().modules['arena-fixture'] as { placements: Json[] };
    expect(state.placements).toHaveLength(2);
    expect(state.placements).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ result: 'placed' }),
        expect.objectContaining({ result: 'skipped', reason: 'budget' })
      ])
    );
    expect(runtime.snapshot().foundation.world.regions).toHaveLength(1);
  });
  it('final occupied birth exhausts a finite preflight and skips without allocating a region or actor', () => {
    const { game, runtime } = contributedGame();
    const birth = vi.spyOn(game, 'canCreateSquareMonster').mockReturnValue(false),
      create = vi.spyOn(game, 'createModuleMonster');
    game.depth = 3;
    (game as any).generateDepth();
    expect(birth.mock.calls.length).toBeGreaterThan(0);
    expect(birth.mock.calls.length).toBeLessThanOrEqual(template.candidateLimit);
    expect(create).not.toHaveBeenCalled();
    expect(runtime.snapshot().foundation.world.regions).toBeUndefined();
    expect(
      (runtime.snapshot().modules['arena-fixture'] as { placements: Json[] }).placements
    ).toEqual([expect.objectContaining({ result: 'skipped', reason: 'no-space' })]);
  });
  it('machine writes reaching a reserved cell roll back even without a native entity runtime', () => {
    const grid = new Grid(79, 29);
    bindGenerationReservation(grid, new Set([10 * grid.width + 10]));
    const before = JSON.stringify(grid.getCell(10, 10));
    const engine = new BlueprintEngine(grid, 3);
    vi.spyOn(engine as any, 'applyBlueprintContents').mockImplementation(() => {
      grid.setTerrain(10, 10, T.WALL, '#', 0x333333);
      return { blueprintId: 'fixture' };
    });
    expect((engine as any).applyBlueprint({}, {})).toBeNull();
    expect(JSON.stringify(grid.getCell(10, 10))).toBe(before);
  });
  it('failed native creation preflight consumes no ID or random value', () => {
    const { game } = contributedGame(),
      ids = getNextEntityId(),
      random = rng.getState();
    expect(game.createModuleMonster(form.id, { x: 0, y: 0 })).toBeNull();
    expect(getNextEntityId()).toBe(ids);
    expect(rng.getState()).toEqual(random);
    expect(game.canCreateSquareMonster(nativeFormData(form), 2, { x: 0, y: 0 })).toBe(false);
  });
});
