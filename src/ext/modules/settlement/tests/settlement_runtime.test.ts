import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { Game } from '../../../../engine/Core/Game';
import { describe, it, expect } from 'vitest';
import { setup, establish, current, build, base } from './helpers';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { planMaterialTransfer } from '../../../../engine/Core/WorldMaterialTransfer';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
describe('settlement production commands', () => {
  it('creates a paid camp, transfers real locked food, builds and saves', () => {
    const { h, g } = setup();
    const before = g.world5!.simulationTicks;
    const food = g.player.inventory.items.find((i) => i.consumableId === 'ration_of_food')!;
    expect(h.ext('settlement', 'establish', establish(g))).toEqual({ recorded: true, error: null });
    expect(g.world5!.simulationTicks - before).toBe(300);
    const c = current(g);
    expect(containerItems(g, c.supplyId).reduce((n, i) => n + i.quantity, 0)).toBe(2);
    expect(food.quantity).toBe(2);
    const locked = containerItems(g, c.supplyId)[0]!;
    const req = {
      containerId: c.supplyId,
      containerRevision: g.world5!.containers.find((b) => b.id === c.supplyId)!.revision,
      inventoryStamp: base(g).inventoryStamp,
      direction: 'withdraw' as const,
      items: [{ itemId: locked.id, quantity: 1 }]
    };
    expect(planMaterialTransfer(g, req)).toMatchObject({ ok: false, code: 'C5_RESERVED' });
    expect(h.ext('settlement', 'build', build(g))).toEqual({ recorded: true, error: null });
    expect(g.world5!.simulationTicks - before).toBe(600);
    const snapshot = h.save(),
      digest = h.digest();
    h.load(snapshot);
    expect(h.digest()).toBe(digest);
  });
  it('No and stale leave material/clock/IDs/RNG untouched', () => {
    const { h, g } = setup();
    const p = establish(g),
      random = rng.getState(),
      id = getNextEntityId(),
      world = structuredClone(g.world5),
      items = structuredClone(g.player.inventory.items);
    expect(h.ext('settlement', 'establish', p, [false]).error).toBeNull();
    expect(g.world5).toEqual(world);
    expect(g.player.inventory.items).toEqual(items);
    expect(rng.getState()).toEqual(random);
    expect(getNextEntityId()).toBe(id);
    expect(h.ext('settlement', 'establish', { ...p, stateRevision: 2 }).error).toBe('C5_STALE');
    expect(g.world5).toEqual(world);
  });
  it('replays camp/build/dismantle/retire and refunds the remaining actual food', () => {
    const { h, g } = setup();
    expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
    expect(h.ext('settlement', 'build', build(g)).error).toBeNull();
    const part = g.world5!.structures[0]!.fixture!;
    expect(
      h.ext('settlement', 'dismantle', {
        ...base(g),
        componentId: part.id,
        componentRevision: part.revision
      }).error
    ).toBeNull();
    const c = current(g),
      r = g.extensionRuntime!.worldStructureRegions().find((r) => r.id === c.regionId)!;
    expect(
      h.ext('settlement', 'retire', { ...base(g), regionId: r.id, regionRevision: r.revision })
        .error
    ).toBeNull();
    expect(g.extensionRuntime!.worldCampState('settlement').camps).toHaveLength(0);
    const recording = h.exportRecording(),
      digest = h.digest();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest);
  });
});


it('settlement alone grants the second native ration once and can establish on natural D1', () => {
  const h = createWorldHarness({ seed: 28, mode: 'normal', modules: ['settlement'] });
  const g = worldHarnessGame(h);
  try {
    const food = g.player.inventory.items.find(i => i.consumableId === 'ration_of_food')!;
    expect(food.quantity).toBe(2);
    expect(g.world5!.startupGrants.find(r => r.owner === 'settlement')!.toInventory)
      .toContainEqual({ itemDefinitionId: 'settlement.ration', count: 1 });
    // A single normal move clears the protected entry staircase; no map, food,
    // player position, RNG or recording-origin injection.
    h.command('move', { x: 1, y: 0 });
    expect(g.player.loc).toEqual({ x: 39, y: 26 });
    const at = { x: 40, y: 26 };
    expect(h.ext('settlement', 'establish', {
      ...base(g), ...at, bounds: { x: 36, y: 19, width: 9, height: 9 },
      sourceContainerId: null, sourceRevision: null,
      materials: [{ itemDefinitionId: 'settlement.wood', count: 4 }, { itemDefinitionId: 'settlement.stone', count: 2 }],
      food: [{ itemId: food.id, quantity: 2 }]
    }).error).toBeNull();
    expect(current(g).depth).toBe(1);
    expect(current(g).locked.reduce((n,l) => n+l.quantity,0)).toBe(2);
    const grants = structuredClone(g.world5!.startupGrants), save = h.save(), digest = h.digest();
    h.load(save); expect(h.digest()).toBe(digest); expect(g.world5!.startupGrants).toEqual(grants);
    expect(h.replay(h.exportRecording())).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest); expect(g.world5!.startupGrants).toEqual(grants);
  } finally { h.dispose(); }
});
it.each(['classic', 'extended'] as const)('keeps one ration in %s without settlement', ruleSet => {
  const g = new Game();
  try {
    g.startNewGame({ seed: 28, mode: 'normal', ruleSet, extensions: [] });
    expect(g.player.inventory.items.filter(i => i.consumableId === 'ration_of_food').reduce((n,i) => n+i.quantity,0)).toBe(1);
  } finally { g.disposeRecording(); }
});
