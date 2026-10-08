import { describe, expect, it } from 'vitest';
import { descriptor } from '../descriptor';
import { TerrainType } from '../../../../engine/Map/Grid';
import { makeHarness, scene, game, addFood, edible, roast, mechanics, observeFacts, knowledgeState, state, hearth, hasPeerCapability } from './mechanicsHelpers';
import type { ModuleDescriptor } from '../../../descriptor';

describe('foraging T-ROAST real sources and transactional rejection', () => {
  it('independent test hearth transforms the entire stack through roasted, charcoal and ash', () => {
    const h = makeHarness(51020001, ['fgheat', 'foraging']); scene(h); const source = hearth(h), i = addFood(h, 'mend', 3);
    for (const id of ['foraging.mend-roasted', 'foraging.char', null]) {
      const before = game(h).world5!.simulationTicks;
      expect(roast(h, i, source.interactableId)).toEqual({ recorded: true, error: null });
      expect(game(h).world5!.simulationTicks - before).toBe(100);
      if (id) { expect(i.worldItem!.definitionId).toBe(id); expect(i.quantity).toBe(3); }
      else expect(game(h).player.inventory.items).not.toContain(i);
    }
    expect(state(h).totals).toMatchObject({ roasted: 1, charred: 1, burned: 1 });
  });
  if (hasPeerCapability('combat', 'bonfire')) it('a production combat bonfire is a valid cooking source', () => {
    const h = makeHarness(51020001, ['combat', 'foraging']), g = scene(h);
    const bindings = g.extensionRuntime!.actorActionBinding()!.state.bonfires!.bindings;
    const source = g.extensionRuntime!.worldWorkEntities().find(e => bindings[String(e.id)] && e.depth === g.depth)!;
    expect(source).toBeDefined();
    // Move the player beside the genuinely generated and bound bonfire.
    g.player.loc = { x: source.x + 1, y: source.y }; g.grid.setTerrain(g.player.x, g.player.y, TerrainType.FLOOR);
    g.grid.getCell(source.x, source.y)!.isVisible = true;
    expect(edible(h).heatSources).toContainEqual(expect.objectContaining({ interactableId: source.id, kind: 'bonfire' }));
    const i = addFood(h, 'mend'); expect(roast(h, i, source.id)).toEqual({ recorded: true, error: null });
    expect(i.worldItem!.definitionId).toBe('foraging.mend-roasted');
  });
  it('blast explodes at the heat-source position, is removed and reveals the observed kind', () => {
    const observed = observeFacts(), h = makeHarness(51020001, ['fgheat', 'foraging'], [observed.override]); scene(h);
    const source = hearth(h), i = addFood(h, 'blast', 3);
    expect(roast(h, i, source.interactableId)).toEqual({ recorded: true, error: null });
    expect(observed.fire).toContainEqual(expect.objectContaining({ itemId: i.id, at: source.at, result: 'exploded', explosion: 'bloat-explosion' }));
    expect(game(h).player.inventory.items).not.toContain(i); expect(knowledgeState(game(h), 'foraging.blast')).toBe('known');
  });
  it('no provider exposes no heat and rejects an invented source with zero mechanical cost', () => {
    const h = makeHarness(); scene(h); const i = addFood(h, 'mend'), before = mechanics(h);
    expect(edible(h).heatSources).toEqual([]);
    expect(roast(h, i, 999999)).toEqual({ recorded: true, error: 'C5_UNKNOWN_TARGET' });
    expect(mechanics(h)).toEqual(before);
  });
  it.each(['distance', 'line', 'stamp'] as const)('%s failure is recorded but costs no time, food, knowledge or RNG', mode => {
    const h = makeHarness(51020001, ['fgheat', 'foraging']), g = scene(h), source = hearth(h), i = addFood(h, 'mend');
    const stamp = edible(h).inventoryStamp;
    if (mode === 'distance') g.player.loc = { x: 13, y: 10 };
    if (mode === 'line') { g.player.loc = { x: 10, y: 9 }; g.grid.setTerrain(11, 9, TerrainType.WALL); g.grid.setTerrain(10, 10, TerrainType.WALL); }
    const before = mechanics(h), n = g.recordedInputEvents.length;
    expect(h.ext('foraging', 'roast', { v: 1, heatSourceId: source.interactableId, itemId: i.id, inventoryStamp: mode === 'stamp' ? stamp + 'stale' : stamp })).toEqual({ recorded: true, error: mode === 'stamp' ? 'C5_STALE' : 'C5_DISTANCE' });
    expect(g.recordedInputEvents).toHaveLength(n + 1); expect(mechanics(h)).toEqual(before);
  });
  it('throwing onto a heat-source tile contacts exactly once', () => {
    const observed = observeFacts(), h = makeHarness(51020001, ['fgheat', 'foraging'], [observed.override]), g = scene(h), source = hearth(h), food = addFood(h, 'mend', 2);
    h.command('item:execute', `throw|${food.inventoryLetter}`); h.command('mouse_travel', source.at);
    const thrown = g.items.find(i => i.worldItem?.definitionId === 'foraging.mend-roasted')!;
    expect(thrown).toBeDefined(); expect(food.quantity).toBe(1); expect(thrown.quantity).toBe(1);
    expect(observed.fire.filter(f => f.itemId === thrown.id)).toHaveLength(1);
  });
  it('baseline strict rollback covers an already-applied blast and downstream contact when a later participant fails', () => {
    const attempted: string[] = [];
    const bad: ModuleDescriptor = { ...descriptor, create: () => {
      const m = descriptor.create(), original = m.edibleParticipant!;
      return { ...m, edibleParticipant: { ...original, onFireContact(f, tx) {
        attempted.push(f.definitionId); original.onFireContact?.(f, tx);
        if (f.definitionId === 'foraging.mend') { tx.markKnowledge(f.definitionId, 'known'); throw Error('deliberate downstream participant failure'); }
      } } };
    } };
    const h = makeHarness(51020001, ['fgheat', 'foraging'], [bad]), g = scene(h), source = hearth(h), blast = addFood(h, 'blast', 3), other = addFood(h, 'mend', 2);
    g.player.inventory.removeItem(other); other.loc = { x: 12, y: 10 }; g.items.push(other);
    const before = mechanics(h), n = g.recordedInputEvents.length, grid = Array.from({ length: g.grid.height }, (_, y) => Array.from({ length: g.grid.width }, (_, x) => [...g.grid.getCell(x, y)!.layers]));
    expect(roast(h, blast, source.interactableId)).toEqual({ recorded: true, error: 'C5_PROVIDER' });
    expect(attempted).toEqual(['foraging.blast', 'foraging.mend']);
    expect(g.recordedInputEvents).toHaveLength(n + 1); expect(mechanics(h)).toEqual(before);
    expect(Array.from({ length: g.grid.height }, (_, y) => Array.from({ length: g.grid.width }, (_, x) => [...g.grid.getCell(x, y)!.layers]))).toEqual(grid);
    expect(g.player.inventory.items).toContain(blast); expect(g.items).toContain(other); expect(other.worldItem!.definitionId).toBe('foraging.mend');
    expect(knowledgeState(g, 'foraging.blast')).toBe('unknown'); expect(knowledgeState(g, 'foraging.mend')).toBe('unknown');
  });
});
