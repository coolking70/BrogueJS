import { afterEach, describe, expect, it } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { worldWorkReadSDK, clearWorldCell } from '../../../../engine/Core/WorldWorkWorld';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { loadCraftingPack } from '../definitions';
import { projectCraftingView, type CraftingAvailableView } from '../view';
import { initialCraftingState } from '../state';
import type { WorldHarness } from '../../../worldSdk';
import type { ExtensionProjectionContext } from '../../../world';
const handles: WorldHarness[] = [];
const open = (modules = ['crafting']) => {
  const h = createWorldHarness({ seed: 51020001, modules }); handles.push(h); return h;
};
afterEach(() => handles.splice(0).forEach(h => h.dispose()));
function view(h: WorldHarness): CraftingAvailableView {
  const value = worldHarnessGame(h).extensionRuntime!.readModuleView('crafting')!.state as unknown as CraftingAvailableView;
  expect(value.available).toBe(true); return value;
}
function context(h: WorldHarness): ExtensionProjectionContext {
  const game = worldHarnessGame(h);
  return {
    worldWork: worldWorkReadSDK(game, 'crafting'), state: initialCraftingState() as any,
    queryOptional: () => ({ status: 'missing' }) as any,
    depth: game.depth, turn: 0,
    visibleInteractables: game.extensionRuntime?.visibleInteractables('crafting') ?? [],
    nearbyInteractables: game.extensionRuntime?.nearbyInteractables('crafting') ?? []
  };
}
describe('crafting deterministic real-world projection', () => {
  it('fails closed when the real game has no crafting SDK or inventory scope', () => {
    const h = open([]), c = context(h);
    expect(projectCraftingView(c)).toEqual({ v: 1, available: false });
    const enabled = open(); const live = context(enabled);
    // Removing the foundation world root makes this real SDK read unavailable.
    worldHarnessGame(enabled).world5 = undefined;
    expect(projectCraftingView(live)).toEqual({ v: 1, available: false });
  });
  it('uses available backpack amounts, deterministic order and authoritative batch previews without writes', () => {
    const h = open(), game = worldHarnessGame(h), first = view(h);
    expect(first.recipes.map(r => r.recipeId)).toEqual(loadCraftingPack().recipes.map(r => r.id));
    expect(first.recipes[0]!.inputs.map(i => i.have)).toEqual([6, 4]);
    expect(first.recipes[0]!.maxBatch).toBe(2);
    expect(first.recipes[1]!.maxBatch).toBe(1);
    expect(first.recipes.find(r => r.recipeId === 'crafting.make-dagger')).toMatchObject({
      stationId: null, stationRevision: null, maxBatch: 0, reason: 'C5_GATE'
    });
    expect(first.placements.map(p => p.source)).toEqual(['materials', null]);
    const before = { world: h.world5(), digest: h.digest(), rng: rng.getState(), id: getNextEntityId() };
    for (let n = 0; n < 20; n++) expect(view(h)).toEqual(first);
    expect({ world: h.world5(), digest: h.digest(), rng: rng.getState(), id: getNextEntityId() }).toEqual(before);
    expect(game.world5!.tickets).toHaveLength(0);
  });
  it('forecasts kit priority and picks the smallest reachable matching station', () => {
    const h = open(), g = worldHarnessGame(h);
    g.monsters.length = 0;
    const craft = (recipeId: string) => {
      const read = h.readWorkContext('crafting', {kind:'inventory'}); if (!read.ok) throw new Error(read.code);
      return h.ext('crafting', 'craft', {v:1,recipeId,batchCount:1,stationId:null,stationRevision:null,
        sourceContainerId:null,sourceRevision:null,inventoryStamp:read.value.inventoryStamp});
    };
    expect(craft('crafting.make-table-kit').error).toBeNull();
    expect(view(h).placements[0]).toMatchObject({source:'kit',kitHave:1});
    // Staging replenishes materials only; both stations themselves are publicly placed.
    for (const item of g.player.inventory.items) if (item.worldItem?.definitionId === 'crafting.wood' || item.worldItem?.definitionId === 'crafting.stone') item.quantity = 20;
    for (let i = 0; i < 2; i++) {
      const read = h.readWorkContext('crafting',{kind:'inventory'}); if (!read.ok) throw new Error(read.code);
      const at = [-1,0,1].flatMap(dy => [-1,0,1].map(dx => ({x:g.player.x+dx,y:g.player.y+dy})))
        .find(p => (p.x !== g.player.x || p.y !== g.player.y) && clearWorldCell(g,p));
      expect(at).toBeDefined();
      expect(h.ext('crafting','place-station',{v:1,definitionId:'crafting.table',x:at!.x,y:at!.y,inventoryStamp:read.value.inventoryStamp}).error).toBeNull();
    }
    const result = view(h), read = h.readWorkContext('crafting',{kind:'inventory'}); if (!read.ok) throw new Error(read.code);
    const candidates = read.value.stations.filter(s => s.tags.includes('station.table') && s.workPositions.some(p => p.x===g.player.x && p.y===g.player.y)).sort((a,b)=>a.interactableId-b.interactableId);
    expect(candidates).toHaveLength(2);
    expect(result.recipes.find(r => r.recipeId === 'crafting.make-bed-kit')!.stationId).toBe(candidates[0]!.interactableId);
    expect(result.stations.every(s => s.inReach)).toBe(true);
    expect(result.placements[0]!.source).toBe('materials');
    const selected = candidates[0]!;
    g.player.loc.x=selected.at.x; g.player.loc.y=selected.at.y;
    expect(view(h).stations.find(s => s.interactableId===selected.interactableId)!.inReach).toBe(false);
  });
  it('projects nearby owned node availability and never virtually regenerates it', () => {
    const h = open(), g=worldHarnessGame(h), node=g.world5!.nodes.find(n=>n.definitionId==='crafting.wood-node')!;
    g.monsters.length=0;
    g.player.loc.x=node.at.x; g.player.loc.y=node.at.y;
    g.grid.getCell(node.at.x,node.at.y)!.hasMemory=true;
    node.remaining=3; node.reservedUnits=2; node.lastSettledTick=0; g.world5!.simulationTicks=8000;
    const ctx=context(h); const entity=g.extensionRuntime!.worldWorkEntities().find(e=>e.id===node.interactableId)!;
    const before=structuredClone(node);
    const result=projectCraftingView({...ctx,nearbyInteractables:[entity]});
    expect(result.available).toBe(true);
    if (!result.available) throw new Error('unavailable');
    expect(result.nodes[0]).toMatchObject({remaining:3,available:1,canHarvest:true,reason:null});
    expect(node).toEqual(before);
    node.reservedUnits=3;
    const reserved=projectCraftingView({...ctx,nearbyInteractables:[entity]}) as CraftingAvailableView;
    expect(reserved.nodes[0]).toMatchObject({canHarvest:false,reason:'C5_RESERVED'});
    node.remaining=0;node.reservedUnits=0;
    expect((projectCraftingView({...ctx,nearbyInteractables:[entity]}) as CraftingAvailableView).nodes[0]!.reason).toBe('C5_RESOURCE_EMPTY');
  });
});
