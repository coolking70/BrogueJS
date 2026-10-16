import { expect, it, vi } from 'vitest';
import { createItemHarness } from '../ext/testing/itemHarness';
import { completeDescriptor, createItemCompleteFixture } from '../ext/testing/fixtures/itemFixture';
import { assembleDropItem } from '../engine/Items/FixedItemAssembly';
import { itemDisplayName } from '../engine/Items/ItemExtensionBindings';
import { itemAppearance } from '../engine/UI/Appearance';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { rng } from '../engine/Random';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import type { KnownItemFacts } from '../ext/itemSdk';
import { redactItemProjection } from '../engine/Items/ItemPresentation';
it('floor whitelist retains bounded public sockets and strips nested secrets',()=>{
 const sockets={count:2,sequence:['fixture.ka','fixture.ul'],values:[999],isCursed:true,sourceId:'secret'};
 expect(redactItemProjection({rarity:'runeword',sockets,ilvl:99,baseId:'secret',affixes:[{known:true,values:[999]}]},'floor',true,false))
  .toEqual({rarity:'runeword',sockets:{count:2,sequence:['fixture.ka','fixture.ul']}});
 for(const invalid of [{count:5,sequence:[]},{count:1,sequence:['a','b']},{count:1,sequence:[{id:'secret'}]},{count:1,sequence:['x'.repeat(129)]},{count:-1,sequence:[]}])
  expect(redactItemProjection({rarity:'normal',sockets:invalid},'floor',false,false)).toEqual({rarity:'normal'});
});
it('passes only location-safe known facts to formatters; inscription stays outermost and reads are pure',()=>{
 const seen:KnownItemFacts[]=[],m=createItemCompleteFixture(),project=vi.fn(m.itemPresentation!.project);
 const h=createItemHarness({},[{...completeDescriptor,create:()=>({...m,itemPresentation:{...m.itemPresentation!,project,name(f){seen.push(f);return m.itemPresentation!.name(f);}}})}]),g=h.game();
 const i=assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:0,runicType:null,isCursed:true,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power:3,known:false}}});g.player.inventory.addItem(i);g.extensionRuntime!.bindItemData(i);i.inscription='铭文';
 const audit=auditFullObjectGraph([g,rng]);for(const location of ['floor','pack','equipped','container'] as const){expect(itemDisplayName(i,location).endsWith('"铭文"')).toBe(true);const f=seen[seen.length-1]!;expect(Object.isFrozen(f.data)).toBe(true);const text=JSON.stringify(f.data);expect(text).not.toContain('isCursed');expect(text).not.toContain('baseId');expect(text).not.toContain('sourceId');expect(text).not.toContain('values');if(location==='floor')expect(f.data).toEqual({rarity:'rare'});}
 expect(audit.differences()).toEqual([]);project.mockClear();const base=i.nativeUninscribedName;expect(itemDisplayName(i,'pack',true)).toBe(`${base} "铭文"`);expect(project).not.toHaveBeenCalled();
 const ctx={cellVisible:true,cellHasMemory:false,hallucinating:true,cosmetic:{percent:()=>false,pick:()=> '#fff'}};expect(itemAppearance(i,ctx as any)?.color).toBe(i.color);expect(project).not.toHaveBeenCalled();expect(itemAppearance(i,{...ctx,hallucinating:false} as any)?.color).toBe('#66aaff');
 ItemLoader.identifyInstance(i);itemDisplayName(i,'pack');expect(JSON.stringify(seen[seen.length-1]!.data)).toContain('values');project.mockClear();itemAppearance(i,{...ctx,cellVisible:false,cellHasMemory:true} as any);expect(project).not.toHaveBeenCalled();h.dispose();expect(i.uninscribedName).toBe(i.nativeUninscribedName);
});
it('recorded filters affect automatic pickup only and explicit pickup remains available',()=>{
 const h=createItemHarness({},[completeDescriptor]),g=h.game();h.ext('c6fixture','set-filter',{v:1,revision:1,minRarity:'rare',classes:['weapon'],autoPickupGold:false});
 const item=assembleDropItem({native:{kind:'dagger',category:'weapon',enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power:1,known:false}}});item.loc={...g.player.loc};g.items.push(item);expect(g.extensionRuntime!.itemAutoPickup(item)).toBe(false);h.command('pickup');expect(g.player.inventory.items).toContain(item);h.dispose();
});
