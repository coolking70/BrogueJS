import {afterEach,expect,it,vi} from 'vitest';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {getLootUiFixture} from '../tools/preview/fixtures';
import {deriveNativeFacts} from '../item';
import {assembleDropItem} from '../../../../engine/Items/FixedItemAssembly';
import {resolveLootCatalog,stateOf} from '../session';
import {timeSystem} from '../../../../engine/Systems/Time';
import {rng} from '../../../../engine/Random';
import {getNextEntityId} from '../../../../entities/Creature';
import {auditFullObjectGraph} from '../../../../test/support/fullGenerationCheckpointOracle';
import {prepareItemCommand,commitItemCommand} from '../../../../engine/Core/ItemCommands';
import {descriptor} from '../descriptor';
import {createLootModule} from '../index';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {canIdentifyChosenItem} from '../../../../engine/Items/ItemUseCoordinator';
import type {LootItemDataV1} from '../types';
const handles:ReturnType<typeof createWorldHarness>[]=[];
function open(){const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']});handles.push(h);return {h,g:worldHarnessGame(h)};}
function add(g:ReturnType<typeof worldHarnessGame>,id:Parameters<typeof getLootUiFixture>[0]){
 const data=getLootUiFixture(id).data,c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),n=deriveNativeFacts(data,c);
 const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:20},moduleData:{loot:JSON.parse(JSON.stringify(data))}});
 expect(g.player.inventory.addItem(item)).toBe(true);g.extensionRuntime!.bindItemData(item);return item;
}
const input=(action:string,payload:unknown)=>JSON.stringify({module:'loot',action,payload});
afterEach(()=>{vi.restoreAllMocks();handles.splice(0).forEach(h=>h.dispose());});
it('real unique No/Yes, multi-stack shards and native ring identification are atomic and charged exactly',()=>{
 const {h,g}=open(),a=add(g,'R12'),b=add(g,'R12'),ring=add(g,'R05'),tick=timeSystem.currentTick;
 const payload={v:1,revision:1,itemIds:[a.id,b.id]};
 h.ext('loot','salvage',payload,[false]);expect(g.player.inventory.items).toContain(a);expect(timeSystem.currentTick).toBe(tick);
 h.ext('loot','salvage',payload,[true]);expect(g.player.inventory.items).not.toContain(a);expect(g.player.inventory.items).not.toContain(b);expect(timeSystem.currentTick-tick).toBe(200);
 const shards=g.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard');expect(shards.map(i=>i.quantity)).toEqual([99,61]);
 const before=shards.reduce((n,i)=>n+i.quantity,0);h.ext('loot','identify-shards',{v:1,revision:2,itemId:ring.id});expect(ring.isIdentified).toBe(true);expect(ItemLoader.identifiedItems.has(ring.identityId!)).toBe(true);expect((ring.moduleData!.loot as unknown as LootItemDataV1).affixes.every(a=>a.known)).toBe(true);
 expect(g.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0)).toBe(before-10);expect(timeSystem.currentTick-tick).toBe(300);
 expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).uniqueMask).toBe(0); // Fixture insertion did not create an accepted drop receipt.
});
it('equipped/cursed, stale/duplicate/extra/short-funds commands and ownership CAS refuse without costs',()=>{
 const {h,g}=open(),item=add(g,'R07');g.executeItemCommand('equip',item);const before=timeSystem.currentTick;
 for(const [action,payload] of [['salvage',{v:1,revision:1,itemIds:[item.id]}],['salvage',{v:1,revision:0,itemIds:[item.id]}],['salvage',{v:1,revision:1,itemIds:[item.id,item.id]}],['set-filter',{v:1,revision:1,minRarity:'normal',classes:['weapon'],autoPickupGold:true,extra:true}],['identify-shards',{v:1,revision:1,itemId:item.id}]] as const){h.ext('loot',action,payload);expect(g.player.inventory.items).toContain(item);expect(timeSystem.currentTick).toBe(before);expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision).toBe(1);}
 g.executeItemCommand('unequip',item);const plan=prepareItemCommand(g,input('salvage',{v:1,revision:1,itemIds:[item.id]}))!;expect(plan).not.toBeNull();g.executeItemCommand('equip',item);expect(commitItemCommand(g,plan)).toBe(false);expect(g.player.inventory.items).toContain(item);
});
it('late command failure restores full object graph, materials, time and ids',()=>{
 const {g}=open(),item=add(g,'R07'),plan=prepareItemCommand(g,input('salvage',{v:1,revision:1,itemIds:[item.id]}))!;
 vi.spyOn(g.extensionRuntime!,'commitItemCommandState').mockImplementation(()=>{throw Error('loot late');});
 const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId(),tick=timeSystem.currentTick;
 expect(commitItemCommand(g,plan)).toBe(false);expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);expect(timeSystem.currentTick).toBe(tick);
});
it('real loot death settle exception rolls back the complete native transaction',()=>{
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']},[{...descriptor,create:configuration=>{const m=createLootModule(configuration),p=m.itemDrops!;return {...m,itemDrops:{...p,settle(s,e,a){if(e.source==='kill')throw Error('loot settle');return p.settle(s,e,a);}}};}}]);handles.push(h);const g=worldHarnessGame(h),victim=g.monsters.find(m=>!m.isAlly&&!m.isClone)!;
 const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();expect(()=>g.killMonster(victim)).toThrow('loot settle');expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
});

it.each([false,true])('F1: shard identification completes a negated ring kind (reload=%s)',reload=>{
 const {h,g}=open(),spare=add(g,'R12');
 h.ext('loot','salvage',{v:1,revision:1,itemIds:[spare.id]},[true]);
 const ring=add(g,'R05');g.player.inventory.items.splice(g.player.inventory.items.indexOf(ring),1);ring.loc={...g.player.loc};g.items.unshift(ring);
 const scroll=ItemLoader.spawnScroll('scroll_of_negation',-1,-1)!;expect(g.player.inventory.addItem(scroll)).toBe(true);
 g.executeItemCommand('read',scroll);g.executeCommand('pickup');
 if(reload)h.load(h.save());
 const target=g.player.inventory.items.find(i=>i.id===ring.id)!;
 expect(target.isIdentified).toBe(true);expect((target.moduleData!.loot as unknown as LootItemDataV1).affixes.every(a=>a.known)).toBe(true);
 expect(ItemLoader.identifiedItems.has(target.identityId!)).toBe(false);expect(canIdentifyChosenItem(g.player,target)).toBe(true);
 const shards=()=>g.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0);
 const revision=stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,payload={v:1,revision,itemId:target.id};
 const before=JSON.parse(JSON.stringify(g.toSnapshot())),tick=timeSystem.currentTick,quantity=shards();
 const audit=auditFullObjectGraph([g,rng]);expect(prepareItemCommand(g,input('identify-shards',payload))).not.toBeNull();expect(audit.differences()).toEqual([]);
 h.ext('loot','identify-shards',payload);
 expect(ItemLoader.identifiedItems.has(target.identityId!)).toBe(true);expect(canIdentifyChosenItem(g.player,target)).toBe(false);
 expect(shards()).toBe(quantity-10);expect(timeSystem.currentTick-tick).toBe(100);expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision).toBe(revision+1);
 const afterRandom=rng.getState(),afterAllocator=getNextEntityId();
 const digest=h.digest(),event=g.recordedInputEvents[g.recordedInputEvents.length-1]!;expect(event.action).toBe('ext:command');expect(event.data).toBe(input('identify-shards',payload));
 // Replay the recorded input from the actual pre-command snapshot. Fixture insertion is not a new-game recording.
 expect(g.loadSnapshot(before)).toBe(true);g.executeCommand(event.action,event.data);expect(h.digest()).toBe(digest);expect(rng.getState()).toEqual(afterRandom);expect(getNextEntityId()).toBe(afterAllocator);
 const restored=g.player.inventory.items.find(i=>i.id===target.id)!;
 expect(ItemLoader.identifiedItems.has(restored.identityId!)).toBe(true);expect(canIdentifyChosenItem(g.player,restored)).toBe(false);
 const current={v:1,revision:revision+1,itemId:restored.id},rejectTick=timeSystem.currentTick,rejectRandom=rng.getState();
 const prepare=vi.spyOn(g.extensionRuntime!,'prepareItemCommand');
 expect(prepareItemCommand(g,input('identify-shards',current))).toBeNull();expect(prepare.mock.results[0]!.value).toBeNull();h.ext('loot','identify-shards',current);
 expect(shards()).toBe(quantity-10);expect(timeSystem.currentTick).toBe(rejectTick);expect(rng.getState()).toEqual(rejectRandom);
 expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision).toBe(revision+1);
});
