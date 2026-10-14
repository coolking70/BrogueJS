import { descriptor as craftDescriptor, createCraftingSkeleton } from '../ext/testing/fixtures/craftingSkeleton';
import { registerWorld5WorkFixture } from '../ext/world5Fixture';
import { expect,it } from 'vitest';
import { createItemHarness } from '../ext/testing/itemHarness';
import { completeDescriptor } from '../ext/testing/fixtures/itemFixture';
import { assembleDropItem } from '../engine/Items/FixedItemAssembly';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { forEachItemRoot } from '../engine/Core/WorldItemRoots';
import { planMaterialTransfer,commitMaterialTransfer } from '../engine/Core/WorldMaterialTransfer';
import { inventoryStamp } from '../engine/Core/RecordingDigest';
import { containerRead } from '../engine/Core/WorldWorkWorld';
import { Item } from '../engine/Items/Item';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { rng } from '../engine/Random';
const make=()=>assembleDropItem({native:{kind:'dagger',category:'weapon',enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,known:false,power:1}}});
it.each(['floor','inventory','carrier','passenger','purgatory','fallen-item','fallen-actor','cached','history'] as const)('round trips valid data at %s and rejects corrupted raw row before publication',route=>{
 const h=createItemHarness({seed:42},[completeDescriptor]),g=h.game(),item=make();item.loc={...g.player.loc};
 const carrier=()=>new Monster(g.player.x,g.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
 if(route==='floor')g.items.push(item);
 if(route==='inventory'){g.player.inventory.addItem(item);g.player.equip(item);}
 if(route==='carrier'){const m=carrier();m.carriedItem=item;g.monsters.push(m);}
 if(route==='passenger'){const m=carrier(),p=carrier();p.carriedItem=item;m.carriedMonster=p;g.monsters.push(m);}
 if(route==='purgatory'){const m=carrier();m.carriedItem=item;g.purgatory.push(m);}
 if(route==='fallen-item')(g as any).pendingFallenItemsByDepth.set(2,[item]);
 if(route==='fallen-actor'){const m=carrier();m.carriedItem=item;(g as any).pendingFallenByDepth.set(2,[m]);}
 if(route==='cached'){g.items.push(item);g.depth=2;(g as any).generateDepth(false,false);}
 if(route==='history')(g as any).everSeenItems.add(item);
 const saved=g.toSnapshot();expect(g.loadSnapshot(saved)).toBe(true);
 const rows=[...saved.items,...saved.player.inventory,...saved.levels.flatMap(l=>l.items),...saved.pendingFallenItemsByDepth.flatMap(l=>l.items),...saved.entityGraph.items];expect(rows.filter(i=>i.id===item.id)).toHaveLength(1);
 const found:Item[]=[];forEachItemRoot(g,i=>{if(i.id===item.id)found.push(i);});expect(found.length).toBe(route==='history'?0:1);if(found.length)expect(found[0]!.moduleData).toEqual(item.moduleData);
 const bad=structuredClone(saved),raw=[...bad.items,...bad.player.inventory,...bad.levels.flatMap(l=>l.items),...bad.pendingFallenItemsByDepth.flatMap(l=>l.items),...bad.entityGraph.items].find(i=>i.id===item.id)!;raw.moduleData!.c6fixture={v:99,known:false,power:1};const audit=auditFullObjectGraph([g,rng]);expect(g.loadSnapshot(bad)).toBe(false);expect(audit.differences()).toEqual([]);h.dispose();
});
it('moves the same data instance through an actual C5 chest, saves, restores and withdraws without splitting',()=>{
 const h=createItemHarness({seed:42,fixtures:['crafting-skeleton']},[completeDescriptor,{...craftDescriptor,create:()=>registerWorld5WorkFixture(createCraftingSkeleton())}]),g=h.game(),item=make();g.player.inventory.addItem(item);
 const chest=g.world5!.containers.find(c=>c.kind==='chest')!;expect(chest).toBeDefined();
 const at=containerRead(g,chest.id).at!;g.player.loc={x:at.x-1,y:at.y};g.grid.getCell(at.x,at.y)!.isExplored=true;
 const transfer=(direction:'deposit'|'withdraw')=>{const c=g.world5!.containers.find(c=>c.id===chest.id)!;const plan=planMaterialTransfer(g,{containerId:c.id,containerRevision:c.revision,inventoryStamp:inventoryStamp(g.player.inventory.items),direction,items:[{itemId:item.id,quantity:1}]});expect(plan.ok,JSON.stringify(plan)).toBe(true);if(plan.ok)expect(commitMaterialTransfer(g,plan.value).ok).toBe(true);};
 transfer('deposit');expect(g.worldContainerItems!.get(item.id)).toBe(item);expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(g.worldContainerItems!.get(item.id)!.moduleData).toEqual(item.moduleData);transfer('withdraw');expect(g.player.inventory.items.find(i=>i.id===item.id)!.moduleData).toEqual(item.moduleData);h.dispose();
});
