import { describe, expect, it } from 'vitest';
import { TerrainType } from '../../../../engine/Map/Grid';
import { rng } from '../../../../engine/Random';
import { getInstalledModuleDescriptors } from '../../../catalog';
import { ascend, descend, game, harness } from './runtimeHelpers';

function nativeFloor(h: ReturnType<typeof harness>) {
  const g = game(h);
  return {
    grid: g.toSnapshot().grid,
    rng: rng.getState(),
    monsters: g.monsters.map(m => [m.name, m.x, m.y, m.maxHp]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    dormant: g.dormantMonsters.map(m => [m.name, m.x, m.y, m.maxHp]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    items: g.items.filter(i => !i.worldItem).map(i => [i.category, i.identityId ?? null, i.consumableId ?? null, i.x, i.y, i.quantity]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
  };
}

describe('crafting T8 deterministic placement', () => {
  it('D1 counts obey every cap, has all gatherable types and contains no ore or fungi', () => {
    const h = harness(), nodes = h.world5()!.nodes;
    for (const [definition, max] of [['wood-node', 2], ['stone-node', 2], ['fiber-node', 2], ['hide-cache', 1]] as const) {
      const selected = nodes.filter(n => n.definitionId === `crafting.${definition}`);
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.length).toBeLessThanOrEqual(max);
    }
    expect(nodes.some(n => n.definitionId === 'crafting.metal-node')).toBe(false);
    expect(nodes.some(n => /fungus|mushroom|ration/.test(n.definitionId))).toBe(false);
    expect(nodes).toHaveLength(7);
  });

  it('D2 gains one metal node; D21 has no hide-cache', () => {
    const h = harness(), g = game(h);
    descend(h);
    expect(g.depth).toBe(2);
    expect(h.world5()!.nodes.filter(n => n.definitionId === 'crafting.metal-node')).toHaveLength(1);
    // Only level eligibility is under test; stage the pre-descent depth instead of walking twenty floors.
    g.depth = 20;
    descend(h);
    expect(g.depth).toBe(21);
    const at21 = h.world5()!.nodes.filter(n => n.levelRef.kind === 'dungeon' && n.levelRef.depth === 21);
    expect(at21.some(n => n.definitionId === 'crafting.metal-node')).toBe(true);
    expect(at21.some(n => n.definitionId === 'crafting.hide-cache')).toBe(false);
  });

  it('wood stops at its 32-node run cap while other eligible definitions still place', () => {
    const h = harness(), g = game(h), w = g.world5!;
    const template = w.nodes.find(n => n.definitionId === 'crafting.wood-node')!;
    // Existing off-level nodes are scene state, not player-created resources.
    for (let i = w.nodes.filter(n => n.definitionId === template.definitionId).length; i < 32; i++)
      w.nodes.push({ ...structuredClone(template), interactableId: 1_000_000 + i, instanceKey: `fixture.wood.${i}`, levelRef: { kind: 'dungeon', depth: 40 } });
    descend(h);
    expect(w.nodes.filter(n => n.definitionId === 'crafting.wood-node')).toHaveLength(32);
    expect(w.nodes.some(n => n.definitionId === 'crafting.wood-node' && n.levelRef.kind === 'dungeon' && n.levelRef.depth === 2)).toBe(false);
    expect(w.nodes.some(n => n.definitionId === 'crafting.metal-node' && n.levelRef.kind === 'dungeon' && n.levelRef.depth === 2)).toBe(true);
  });

  it.each([false, true])('stairs re-entry retries staged deferred nodes once (still blocked=%s), with unique skip/defer receipts', blocked => {
    const h = harness(), g = game(h), w = g.world5!;
    // Stage a faithful no-space D1 outcome. The action tested is public level re-entry,
    // not a private placement call or a mocked generation predicate.
    const original = w.nodes.filter(n => n.owner === 'crafting' && n.levelRef.kind === 'dungeon' && n.levelRef.depth === 1);
    const ids = new Set(original.map(n => n.interactableId));
    w.nodes = w.nodes.filter(n => !ids.has(n.interactableId));
    const entities = g.extensionRuntime!.worldWorkEntities();
    for (let i = entities.length - 1; i >= 0; i--) if (ids.has(entities[i]!.id))
      (entities as unknown as { splice(start: number, count: number): unknown }).splice(i, 1);
    for (const receipt of w.receipts.filter(r => r.kind === 'placement')) {
      receipt.result = 'skipped';
      receipt.reason = receipt.identity.includes('wood-node') ? 'defer' : 'no-space';
    }
    w.pendingPlacements.push(...[0, 1].map(ordinal => ({ owner: 'crafting', definitionId: 'crafting.wood-node', levelRef: { kind: 'dungeon' as const, depth: 1 }, ordinal, retriesLeft: 1 as const })));
    if (blocked) for (let y = 0; y < g.grid.height; y++) for (let x = 0; x < g.grid.width; x++) {
      const cell = g.grid.getCell(x, y)!;
      if (!cell.layers.includes(TerrainType.STAIRS_UP) && !cell.layers.includes(TerrainType.STAIRS_DOWN))
        g.grid.setTerrain(x, y, TerrainType.WALL);
    }
    descend(h);
    const beforeReturn = structuredClone(g.world5!.receipts);
    ascend(h);
    expect(g.world5!.pendingPlacements).toEqual([]);
    const retries = g.world5!.receipts.slice(beforeReturn.length);
    expect(retries).toHaveLength(2);
    expect(retries.every(r => r.result === (blocked ? 'skipped' : 'completed'))).toBe(true);
    expect(retries.every(r => r.identity.startsWith('retry.crafting.wood-node.dungeon.1.'))).toBe(true);
    expect(g.world5!.nodes.filter(n => n.levelRef.kind === 'dungeon' && n.levelRef.depth === 1)).toHaveLength(blocked ? 0 : 2);
    const receipts = structuredClone(g.world5!.receipts);
    descend(h); ascend(h);
    expect(g.world5!.receipts).toEqual(receipts);
    expect(new Set(receipts.map(r => r.ordinal)).size).toBe(receipts.length);
    expect(new Set(receipts.map(r => `${r.owner}:${r.identity}`)).size).toBe(receipts.length);
  });

  it('nodes never overlap stairs, protected giant rooms, or another interactable', () => {
    const hasGiants = getInstalledModuleDescriptors().some(d => d.id === 'giants');
    const h = harness({ seed: 7306, modules: ['crafting', ...(hasGiants ? ['giants'] : [])] }), g = game(h);
    for (let floor = 1; floor <= 3; floor++) {
      const nodes = h.world5()!.nodes.filter(n => n.levelRef.kind === 'dungeon' && n.levelRef.depth === floor);
      const entities = g.extensionRuntime!.worldWorkEntities().filter(e => e.depth === floor);
      if (floor === 3 && hasGiants)
        expect(g.extensionRuntime!.snapshot().foundation.world.regions!.filter(r => r.depth === 3).length).toBeGreaterThan(0);
      for (const n of nodes) {
        const cell = g.grid.getCell(n.at.x, n.at.y)!;
        expect(cell.layers).not.toContain(TerrainType.STAIRS_UP);
        expect(cell.layers).not.toContain(TerrainType.STAIRS_DOWN);
        expect(g.extensionRuntime!.worldWorkPlacementProtected(n.at, floor)).toBe(false);
        expect(entities.filter(e => e.x === n.at.x && e.y === n.at.y)).toHaveLength(1);
      }
      if (floor !== 3) descend(h);
    }
  });

  it('D1–D3 native terrain, monsters, items and both RNG streams match the same seed without modules', () => {
    const collect = (modules: string[]) => {
      const h = harness({ modules }), floors = [];
      for (let depth = 1; depth <= 3; depth++) {
        floors.push(nativeFloor(h));
        if (depth !== 3) descend(h);
      }
      return floors;
    };
    expect(collect(['crafting'])).toEqual(collect([]));
  });
});
