import { describe, expect, it } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import i18next from 'i18next';
import '../../../../i18n';
import locale from '../locales/zh_CN.json';
import type { ModuleUiHost } from '../../../ui/types';
import { worldWorkReadSDK, containerRead, putContainer, itemDefinition } from '../../../../engine/Core/WorldWorkWorld';
import { assembleWorldItem } from '../../../../engine/Items/WorldItems';
import { useCraftingUi } from '../ui/useCraftingUi';
import { readCraftingUiView } from '../ui/view';
import { buildCraftCommand } from '../ui/commands';
import { staged, arena, game, mechanics, read, nearNode, add, node, moveNodeBeside, rejected } from './runtimeHelpers';

function chestScene(g: ReturnType<typeof game>) {
  arena(g);
  const chest = g.world5!.containers.find(c => c.kind === 'chest')!;
  if (chest.position?.kind !== 'interactable') throw new Error('fixture chest');
  const entity = g.extensionRuntime!.worldWorkEntities().find(e => e.id === (chest.position as {interactableId:number}).interactableId)!;
  Object.assign(entity, { x: g.player.x, y: g.player.y - 1 });
  moveNodeBeside(g);
  return chest;
}
function session(g: ReturnType<typeof game>) {
  i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
  const host: ModuleUiHost = { game: () => g, tick: ref(0), immersive: ref(false), canOpenPanel: () => true,
    beforeOpenPanel() {}, afterClosePanel() {} };
  const scope = effectScope(), ui = scope.run(() => useCraftingUi(host, async () => ({ render: () => null })))!;
  return { ui, scope, props: () => ui.panel.value!.props as Record<string, any>,
    open: async () => { ui.commands.value[0]!.invoke(); await nextTick(); await nextTick(); } };
}
function projection(g: ReturnType<typeof game>, sourceContainerId: number | null = null) {
  return readCraftingUiView(g.extensionRuntime!.readModuleView('crafting', { sourceContainerId })!.state)!;
}

describe('SDK1 supported crafting error and container display paths', () => {
  it('reads the exact refusal without mutation, then resets it on a successful command and new session', () => {
    const h = staged(), g = game(h), n = nearNode(h), sdk = worldWorkReadSDK(g, 'crafting')!;
    expect(typeof sdk.lastCommandError).toBe('function');
    rejected(h, 'harvest', {v:1,nodeId:n.interactableId,nodeRevision:n.revision,inventoryStamp:'stale',destinationId:null,destinationRevision:null}, 'C5_STALE');
    const before = mechanics(h);
    expect(sdk.lastCommandError!()).toBe('C5_STALE'); expect(projection(g).lastError).toBe('C5_STALE');
    expect(mechanics(h)).toEqual(before);
    h.ext('crafting', 'harvest', {v:1,nodeId:n.interactableId,nodeRevision:n.revision,inventoryStamp:read(h).inventoryStamp,destinationId:null,destinationRevision:null});
    expect(sdk.lastCommandError!()).toBeNull();
    rejected(h, 'harvest', {v:1,nodeId:n.interactableId,nodeRevision:n.revision,inventoryStamp:'stale',destinationId:null,destinationRevision:null}, 'C5_STALE');
    h.load(h.save()); expect(worldWorkReadSDK(g, 'crafting')!.lastCommandError!()).toBeNull();
  });
  it('shows the precise stale reason after a suspended tool confirmation, through the public UI', async () => {
    const h = staged(), g = game(h);
    // Staged D2 mining eligibility, not a natural navigation trace.
    const n = node(h); n.definitionId = 'crafting.metal-node';
    const entity = g.extensionRuntime!.worldWorkEntities().find(e => e.id === n.interactableId)!;
    Object.assign(entity, { contentId: n.definitionId, x: g.player.x - 1, y: g.player.y }); n.at = {x:entity.x,y:entity.y};
    add(g, 'pick', 1); g.player.inventory.items.find(i => i.worldItem?.definitionId === 'crafting.pick')!.worldItem!.toolDurability = 1;
    g.onCommandConfirmRequest = () => {};
    const f = session(g);
    try {
      await f.open(); await f.props().onHarvest(n.interactableId);
      expect(g.pendingCommandConfirmation).not.toBeNull();
      g.player.inventory.items.find(i => i.worldItem?.definitionId === 'crafting.wood')!.quantity++;
      g.resolveCommandDecision(g.pendingCommandConfirmation!.token, true); f.ui.refresh();
      expect(f.props().error).toBe('ext.crafting.error.stale'); expect(f.props().submitting).toBe(false);
    } finally { f.scope.stop(); }
  });
  it('projects known boxes and only the selected source, with at most 7x16 previews and no writes', () => {
    const h = staged(chestScene, { fixtures: ['world-work-basic'] }), g = game(h), chest = g.world5!.containers.find(c => c.kind === 'chest')!;
    for (const id of ['crafting.wood', 'crafting.stone']) putContainer(g, chest.id, assembleWorldItem(itemDefinition(g,id),20));
    g.player.inventory.items = g.player.inventory.items.filter(i => !['crafting.wood','crafting.stone'].includes(i.worldItem?.definitionId ?? ''));
    // Count a forwarding port; every preview still runs the real frozen SDK.
    const port = (g.extensionRuntime as any).ports;
    const original = port.worldWorkRead;
    let calls = 0;
    port.worldWorkRead = (owner: string) => { const real = original(owner); return real ? {...real,
      previewRecipe: (...args: Parameters<typeof real.previewRecipe>) => { calls++; return real.previewRecipe(...args); }} : real; };
    try {
      const before = mechanics(h), inventory = projection(g), selected = projection(g,chest.id);
      expect(inventory.recipes[0]!.maxBatch).toBe(0);
      expect(selected.containers).toContainEqual({id:chest.id,revision:chest.revision,at:containerRead(g,chest.id).at,capacity:16,occupiedSlots:2,reservedSlots:0,inReach:true});
      expect(selected.sourceContainerId).toBe(chest.id); expect(selected.recipes[0]!.maxBatch).toBeGreaterThan(0);
      expect(selected.recipes[0]!.inputs.map(i => i.have)).toEqual([20,20]);
      expect(calls).toBeLessThanOrEqual(2*7*16); expect(mechanics(h)).toEqual(before);
      expect(JSON.parse(buildCraftCommand(selected,'crafting.make-pick',1)!).payload).toMatchObject({sourceContainerId:chest.id,sourceRevision:chest.revision});
      expect(projection(g,999999)).toBeNull();
    } finally { port.worldWorkRead = original; }
  });
  it('uses real UI source and destination selections for crafting and harvest commands', async () => {
    const h = staged(chestScene, {fixtures:['world-work-basic']}), g = game(h), chest = g.world5!.containers.find(c => c.kind==='chest')!;
    for (const id of ['crafting.wood','crafting.stone']) putContainer(g,chest.id,assembleWorldItem(itemDefinition(g,id),20));
    const f = session(g);
    try {
      await f.open(); const before = mechanics(h);
      f.props().onContainer('source',chest.id); expect(mechanics(h)).toEqual(before);
      expect(f.props().model.sourceContainerId).toBe(chest.id);
      await f.props().onCraft('crafting.make-pick');
      expect(read(h).inventory.some(i => i.definitionId==='crafting.pick')).toBe(true);
      expect(JSON.parse(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.data as string).payload).toMatchObject({sourceContainerId:chest.id});
      f.ui.refresh(); f.props().onContainer('destination',chest.id);
      const n = node(h), quantity = containerRead(g,chest.id).items.find(i=>i.definitionId==='crafting.wood')!.quantity;
      await f.props().onHarvest(n.interactableId);
      expect(containerRead(g,chest.id).items.find(i=>i.definitionId==='crafting.wood')!.quantity).toBe(quantity+1);
      expect(JSON.parse(g.recordedInputEvents[g.recordedInputEvents.length - 1]!.data as string).payload).toMatchObject({destinationId:chest.id});
    } finally { f.scope.stop(); }
  });
});
