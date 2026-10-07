import { describe, expect, it } from 'vitest';
import { TerrainType } from '../../../../engine/Map/Grid';
import { spawnDungeonFeature, catalogFeature } from '../../../../engine/Map/DungeonFeature';
import { Random, rng } from '../../../../engine/Random';
import { DF } from '../../../../engine/Map/DungeonFeatureCatalog';
import { makeHarness, scene, addFood, game, observeFacts, knowledgeState, state, messages, waitTurns } from './mechanicsHelpers';
import type { WorldHarness } from '../../../worldSdk';

function floor(h: WorldHarness, kind: string, quantity = 1, at = { x: 13, y: 10 }) {
  const g = game(h), i = addFood(h, kind, quantity); g.player.inventory.removeItem(i); i.loc = { ...at }; g.items.push(i); return i;
}
describe('foraging T-FIRE real environmental contacts', () => {
  it('spawn-fire uses the real outer DF drain and reveals no hidden kind on transform', () => {
    const o = observeFacts(), h = makeHarness(51020001, ['foraging'], [o.override]), g = scene(h), i = floor(h, 'mend', 2);
    spawnDungeonFeature(g.grid, i.x, i.y, catalogFeature(DF.DF_PLAIN_FIRE), false);
    expect(i.worldItem!.definitionId).toBe('foraging.mend-roasted'); expect(i.quantity).toBe(2);
    expect(o.fire.filter(f => f.itemId === i.id)).toHaveLength(1);
    expect(o.fire[0]).toMatchObject({ cause: 'spawn-fire', result: 'transformed', location: 'floor' });
    expect(knowledgeState(g, 'foraging.mend')).toBe('unknown'); expect(messages()).toContain('被烤熟了。');
  });
  it('floor burning preserves stack identity through cooldown and transforms no faster than ten turns', () => {
    const o = observeFacts(), h = makeHarness(51020001, ['foraging'], [o.override]), g = scene(h), i = floor(h, 'mend', 2), id = i.id;
    g.grid.setTerrain(i.x, i.y, TerrainType.PLAIN_FIRE); h.command('wait');
    expect(i.worldItem!.definitionId).toBe('foraging.mend-roasted'); const cooldown = i.fireContactCooldownUntilTurn!;
    expect(cooldown).toBeGreaterThan(g.absoluteTurnNumber);
    while (g.absoluteTurnNumber < cooldown - 1) { g.grid.setTerrain(i.x, i.y, TerrainType.PLAIN_FIRE); h.command('wait'); }
    expect(i.worldItem!.definitionId).toBe('foraging.mend-roasted');
    for (let n = 0; n < 3 && i.worldItem!.definitionId !== 'foraging.char'; n++) { g.grid.setTerrain(i.x, i.y, TerrainType.PLAIN_FIRE); h.command('wait'); }
    expect(i.id).toBe(id); expect(i.worldItem!.definitionId).toBe('foraging.char'); expect(i.quantity).toBe(2);
    const second = i.fireContactCooldownUntilTurn!;
    while (g.absoluteTurnNumber <= second && g.items.includes(i)) { g.grid.setTerrain(i.x, i.y, TerrainType.PLAIN_FIRE); h.command('wait'); }
    expect(g.items).not.toContain(i); expect(state(h).totals).toMatchObject({ roasted: 1, charred: 1, burned: 1 });
    expect(o.fire.map(f => f.result)).toEqual(['transformed', 'transformed', 'burned-up']);
  });
  it('native throw onto real fire contacts the thrown unit once', () => {
    const o = observeFacts(), h = makeHarness(51020001, ['foraging'], [o.override]), g = scene(h), i = addFood(h, 'mend', 2);
    g.grid.setTerrain(13, 10, TerrainType.PLAIN_FIRE);
    h.command('item:execute', `throw|${i.inventoryLetter}`); h.command('mouse_travel', { x: 13, y: 10 });
    const thrown = g.items.find(v => v.worldItem?.definitionId === 'foraging.mend-roasted')!;
    expect(thrown).toBeDefined(); expect(thrown.quantity).toBe(1); expect(i.quantity).toBe(1);
    expect(o.fire.filter(f => f.itemId === thrown.id)).toHaveLength(1);
  });
  it.each([1, 2, 3])('visible blast stack %i selects its specified DF size and reveals before message rendering', quantity => {
    const o = observeFacts(), h = makeHarness(51020001, ['foraging'], [o.override]), g = scene(h), i = floor(h, 'blast', quantity);
    spawnDungeonFeature(g.grid, i.x, i.y, catalogFeature(DF.DF_PLAIN_FIRE), false);
    expect(g.items).not.toContain(i); expect(o.fire[0]).toMatchObject({ quantity, result: 'exploded', explosion: quantity < 3 ? 'explosion-fire' : 'bloat-explosion' });
    expect(knowledgeState(g, 'foraging.blast')).toBe('known'); expect(messages()).toContain('爆燃菌炸开了！');
  });
  it('unseen floor explosion does not reveal the kind or log its name', () => {
    const o = observeFacts(), h = makeHarness(51020001, ['foraging'], [o.override]), g = scene(h), i = floor(h, 'blast', 1, { x: 60, y: 25 });
    g.grid.setTerrain(i.x, i.y, TerrainType.FLOOR); g.grid.getCell(i.x, i.y)!.isVisible = false;
    spawnDungeonFeature(g.grid, i.x, i.y, catalogFeature(DF.DF_PLAIN_FIRE), false);
    expect(g.items).not.toContain(i); expect(o.fire[0]).toMatchObject({ result: 'exploded', visibleToPlayer: false });
    expect(knowledgeState(g, 'foraging.blast')).toBe('unknown'); expect(messages()).not.toContain('爆燃菌');
  });
  it.each(['mend', 'mend-roasted', 'char'])('lava immediately destroys %s without a transformation loophole', kind => {
    const o = observeFacts(), h = makeHarness(51020001, ['foraging'], [o.override]), g = scene(h), i = floor(h, kind);
    g.grid.setTerrain(i.x, i.y, TerrainType.LAVA); h.command('wait');
    expect(g.items).not.toContain(i); expect(o.fire.find(f => f.itemId === i.id)).toMatchObject({ cause: 'lava', result: 'destroyed' });
    expect(state(h).totals.burned).toBe(1);
  });
  it('same-cell blast chain consumes each physical stack once in deterministic entity order', () => {
    const o = observeFacts(), h = makeHarness(51020001, ['foraging'], [o.override]), g = scene(h), a = floor(h, 'blast', 3), b = floor(h, 'mend', 1, { x: 14, y: 10 }), c = floor(h, 'venom', 1, { x: 14, y: 10 });
    spawnDungeonFeature(g.grid, a.x, a.y, catalogFeature(DF.DF_PLAIN_FIRE), false);
    expect(o.fire.filter(f => f.itemId === a.id)).toHaveLength(1);
    expect(o.fire.filter(f => [b.id, c.id].includes(f.itemId)).map(f => f.itemId)).toEqual([b.id, c.id]);
    expect(new Set(o.fire.map(f => f.itemId)).size).toBe(o.fire.length);
  });
  it('carrier ignition exactly follows one independent 1/3 draw per letter-ordered stack and never repeats while burning', () => {
    const o = observeFacts(), h = makeHarness(19, ['foraging'], [o.override]), g = scene(h);
    g.player.hp = g.player.maxHp = 1000;
    for (const kind of ['mend', 'venom', 'prism', 'astray', 'upheave', 'might']) addFood(h, kind, 2);
    const sorted = g.player.inventory.items.filter(i => i.worldItem?.definitionId.startsWith('foraging.')).sort((a, b) => a.inventoryLetter! < b.inventoryLetter! ? -1 : 1);
    const independent = new Random(0); independent.setState(rng.getState());
    const selected = sorted.filter(() => independent.randRange(1, 3) === 1).map(i => i.id);
    expect(selected.length).toBeGreaterThan(0);
    g.grid.setTerrain(11, 10, TerrainType.PLAIN_FIRE); h.command('move', { x: 1, y: 0 });
    expect(o.fire.filter(f => f.cause === 'carrier-ignited').map(f => f.itemId)).toEqual(selected);
    expect(Number((g.player.statusDurations as unknown as Record<string, number>).burning ?? 0)).toBeGreaterThan(0);
    waitTurns(h, 1); expect(o.fire.filter(f => f.cause === 'carrier-ignited').map(f => f.itemId)).toEqual(selected);
  });
  it('empty edible inventory adds no draws to either stream during the same real ignition command', () => {
    const run = (modules: string[]) => {
      const h = makeHarness(19, modules), g = scene(h);
      const before = rng.getState(); g.grid.setTerrain(11, 10, TerrainType.PLAIN_FIRE); h.command('move', { x: 1, y: 0 });
      expect(Number((g.player.statusDurations as unknown as Record<string, number>).burning ?? 0)).toBeGreaterThan(0);
      return { before, after: rng.getState() };
    };
    expect(run(['foraging'])).toEqual(run([]));
  });
  it('inventory blast is guaranteed by the independent first 1/3 draw and reveals the explosion', () => {
    // Search the prescribed RNG predicate, rather than conditionally accepting a non-explosion.
    let h: WorldHarness | undefined;
    for (let seed = 1; seed <= 64; seed++) {
      const candidate = makeHarness(seed); scene(candidate); addFood(candidate, 'blast');
      const independent = new Random(0); independent.setState(rng.getState());
      if (independent.randRange(1, 3) === 1) { h = candidate; break; }
    }
    expect(h).toBeDefined();
    const g = game(h!), blast = g.player.inventory.items.find(i => i.worldItem?.definitionId === 'foraging.blast')!;
    g.player.hp = g.player.maxHp = 1000; g.grid.setTerrain(11, 10, TerrainType.PLAIN_FIRE);
    h!.command('move', { x: 1, y: 0 });
    expect(g.player.inventory.items).not.toContain(blast); expect(state(h!).totals.exploded).toBe(1);
    expect(knowledgeState(g, 'foraging.blast')).toBe('known'); expect(messages()).toContain('爆燃菌炸开了！');
  });
});
