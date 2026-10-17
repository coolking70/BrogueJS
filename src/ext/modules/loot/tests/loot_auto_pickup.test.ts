import { afterEach, expect, it } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { Item, ItemCategory } from '../../../../engine/Items/Item';
import { itemAllowsAutoPickup, unbindItemExtension } from '../../../../engine/Items/ItemExtensionBindings';
import { logger } from '../../../../engine/Systems/Logger';
import { getLootUiFixture, type LootUiFixtureId } from '../tools/preview/fixtures';
import { deriveNativeFacts } from '../item';
import { stateOf } from '../session';

const handles: ReturnType<typeof createWorldHarness>[] = [];
afterEach(() => { handles.splice(0).forEach(h => h.dispose()); });
function scene() {
  const h = createWorldHarness({seed:439559475, mode:'normal', modules:['loot']}); handles.push(h);
  const g = worldHarnessGame(h);
  g.monsters=[]; g.dormantMonsters=[]; g.items=[]; g.visibleItems.clear(); g.visibleMonsters.clear();
  g.player.loc={x:10,y:10};
  for(let x=0;x<g.grid.width;x++) for(let y=0;y<g.grid.height;y++) {
    g.grid.setTerrain(x,y,y===10 && x>=9 && x<=14 ? T.FLOOR : T.GRANITE);
    const c=g.grid.getCell(x,y)!;
    Object.assign(c,{hasMemory:true,isExplored:true,autoSearched:true,isVisible:true,rememberedLayers:[...c.layers],rememberedItem:null,machineNumber:0});
  }
  function floor(id:LootUiFixtureId,x=11) {
    const {data,catalog}=getLootUiFixture(id), n=deriveNativeFacts(data,catalog);
    const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:20},moduleData:{loot:JSON.parse(JSON.stringify(data))}});
    item.loc={x,y:10}; g.items.push(item);g.extensionRuntime!.bindItemData(item);
    (g as unknown as {updateVision():void}).updateVision();
    return item;
  }
  function filter(minRarity='normal', classes=['weapon','armor','ring'],autoPickupGold=true) {
    h.ext('loot','set-filter',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,minRarity,classes,autoPickupGold});
  }
  return {h,g,floor,filter};
}
it.each(['R01','R02','R03'] as const)('filtered %s is no exploration goal; changing the filter picks it up in one movement turn',id=>{
  const {g,floor,filter}=scene(),item=floor(id);
  expect(g.extensionRuntime!.itemAutoPickup(item)).toBe(false);
  g.executeCommand('auto_explore');expect(g.autoPath).toEqual([]);
  expect(g.items).toContain(item);expect(item.flags??[]).not.toContain('ITEM_PLAYER_AVOIDS');
  filter();const turn=g.absoluteTurnNumber;
  g.executeCommand('auto_explore');expect(g.autoPath).toEqual([{x:11,y:10}]);
  g.executeCommand('auto_step');expect(g.player.inventory.items).toContain(item);
  expect(g.absoluteTurnNumber).toBe(turn+1);expect(g.items).not.toContain(item);
});
it('crosses filtered equipment en route to eligible loot without stopping or ping-pong',()=>{
  const {g,floor}=scene(),item=floor('R01');
  floor('R05',14);
  g.executeCommand('auto_explore');g.executeCommand('auto_step');
  expect(g.player.loc).toEqual({x:11,y:10});expect(g.items).toContain(item);
  expect(g.isAutoTraveling()).toBe(true);expect(g.autoPath.length).toBeGreaterThan(0);
  g.executeCommand('auto_step');expect(g.player.x).toBe(12);
});
it.each(['R04','R05','R06'] as const)('unknown %s passes rarity/class filtering, even without presentation bindings',id=>{
  const {g,floor}=scene(),item=floor(id);expect(item.identified).toBe(false);
  expect(itemAllowsAutoPickup(item)).toBe(true);unbindItemExtension(item);
  g.executeCommand('auto_explore');g.executeCommand('auto_step');
  expect(g.player.inventory.items).toContain(item);
});
it('class exclusion, manual pickup override and another eligible item on the same cell',()=>{
  const {g,floor,filter}=scene(),blocked=floor('R01'),eligible=floor('R05');
  filter('normal',['ring']);g.executeCommand('move',{x:1,y:0});
  expect(g.items).toContain(blocked);expect(g.player.inventory.items).toContain(eligible);
  g.executeCommand('pickup');expect(g.player.inventory.items).toContain(blocked);
});
it('full pack marks eligible equipment avoided; gold bypasses capacity and still obeys its switch',()=>{
  const {g,floor,filter}=scene(),item=floor('R04');
  g.player.inventory.capacity=g.player.inventory.packCount();
  g.executeCommand('auto_explore');g.executeCommand('auto_step');
  expect(g.items).toContain(item);expect(item.flags).toContain('ITEM_PLAYER_AVOIDS');
  expect(logger.messages.some(m=>m.text.includes('pack is too full'))).toBe(true);
  const gold=new Item('gold','$',0xffff00,ItemCategory.GOLD);gold.loc={x:12,y:10};gold.quantity=17;g.items.push(gold);
  filter('normal',[],false);g.executeCommand('move',{x:1,y:0});expect(g.items).toContain(gold);
  filter('normal',[],true);const before=g.stats.gold;
  g.executeCommand('move',{x:-1,y:0});g.executeCommand('move',{x:1,y:0});
  expect(g.stats.gold).toBe(before+17);expect(g.items).not.toContain(gold);
});
it('rejects the prior loot identity and preserves the active run',()=>{
  const {g,h}=scene();const r=JSON.parse(h.exportRecording());
  r.extensions.modules.find((m:{id:string})=>m.id==='loot').version='0.9.0';
  const player=g.player;let error='';
  expect(g.loadReplay(r,message=>{error=message;})).toBe(false);expect(g.player).toBe(player);
  expect(error).toContain('loot');expect(error).toContain('0.9.0');expect(error).toContain('0.9.1');
});
