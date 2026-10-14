import { afterEach, expect, it, vi } from 'vitest';
import { createItemHarness } from '../ext/testing/itemHarness';
import { completeDescriptor, commandDefinitions, createItemCompleteFixture } from '../ext/testing/fixtures/itemFixture';
import { assembleDropItem } from '../engine/Items/FixedItemAssembly';
import { assembleWorldItem } from '../engine/Items/WorldItems';
import { prepareItemCommand, commitItemCommand } from '../engine/Core/ItemCommands';
import { mechanicalDigest } from '../engine/Core/RecordingDigest';
import { nativeStat } from '../engine/Stats/NativeStatSources';
import { timeSystem } from '../engine/Systems/Time';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { canIdentifyChosenItem } from '../engine/Items/ItemUseCoordinator';
import { nativeStatRevision } from '../engine/Stats/NativeStatSources';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
afterEach(()=>vi.restoreAllMocks());
const setup=()=>{const h=createItemHarness({},[completeDescriptor]);return {h,g:h.game(),r:h.game().extensionRuntime!};};
const make=(unique=false)=>assembleDropItem({native:{kind:'dagger',category:'weapon',enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:1},moduleData:{c6fixture:{v:1,power:1,known:false,...(unique?{unique}: {})}}});
const input=(action:string,payload:unknown)=>JSON.stringify({module:'c6fixture',action,payload});
it('creates once from manifest, canonicalizes filter and records a zero-time command',()=>{
 const {h,g,r}=setup();expect(r.itemCommandState('c6fixture')).toMatchObject({revision:1,created:true,presetId:'standard'});
 const tick=timeSystem.currentTick,random=rng.getState(),id=getNextEntityId(),n=g.recordedInputEvents.length;
 h.ext('c6fixture','set-filter',{v:1,revision:1,minRarity:'rare',classes:['weapon','armor','weapon'],autoPickupGold:false});
 expect(r.itemCommandState('c6fixture')).toMatchObject({revision:2,filter:{classes:['armor','weapon']}});expect(timeSystem.currentTick).toBe(tick);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);expect(g.recordedInputEvents.length).toBe(n+1);
 expect(prepareItemCommand(g,input('create',{v:1,presetId:'standard'}))).toBeNull();h.dispose();
});
it.each([{}, {v:2,revision:1,itemIds:[1]}, {v:1,revision:0,itemIds:[1]}, {v:1,revision:1,itemIds:[]}, {v:1,revision:1,itemIds:[1,1]}, {v:1,revision:1,itemIds:Array.from({length:27},(_,i)=>i+1)}, {v:1,revision:1,itemIds:[1],extra:true}])('rejects invalid payload without resources %j',payload=>{
 const {h,r}=setup(),before=r.snapshot(),random=rng.getState(),id=getNextEntityId(),tick=timeSystem.currentTick;h.ext('c6fixture','salvage',payload as import('../ext/types').Json);expect(r.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);expect(timeSystem.currentTick).toBe(tick);h.dispose();
});
it.each([1,26])('salvages %i whole unequipped items atomically, with exact clock and material stacks',n=>{
 const {h,g,r}=setup();for(const i of [...g.player.inventory.items])g.player.unequip(i,true);g.player.inventory.items=[];
 const items=Array.from({length:n},()=>make());items.forEach(i=>g.player.inventory.addItem(i));const tick=timeSystem.currentTick;
 h.ext('c6fixture','salvage',{v:1,revision:1,itemIds:items.map(i=>i.id)});
 expect(r.itemCommandState('c6fixture')).toMatchObject({revision:2});expect(timeSystem.currentTick-tick).toBe(100*n);expect(g.player.inventory.items.map(i=>i.quantity)).toEqual(n===1?[10]:[99,99,62]);h.dispose();
});
it('unique warning No is free, Yes consumes, and equipped input is refused',()=>{
 const {h,g,r}=setup(),item=make(true);g.player.inventory.addItem(item);const p={v:1,revision:1,itemIds:[item.id]},tick=timeSystem.currentTick;
 h.ext('c6fixture','salvage',p,[false]);expect(g.player.inventory.items).toContain(item);expect(timeSystem.currentTick).toBe(tick);expect(r.itemCommandState('c6fixture')).toMatchObject({revision:1});
 g.player.equip(item);expect(prepareItemCommand(g,input('salvage',p))).toBeNull();g.player.unequip(item,true);
 h.ext('c6fixture','salvage',p,[true]);expect(g.player.inventory.items).not.toContain(item);expect(timeSystem.currentTick-tick).toBe(100);h.dispose();
});
it('rejects stale ownership, forged and reused plans; previews allocate no IDs or RNG',()=>{
 const {h,g}=setup(),item=make();g.player.inventory.addItem(item);const before=rng.getState(),id=getNextEntityId();const plan=prepareItemCommand(g,input('salvage',{v:1,revision:1,itemIds:[item.id]}))!;expect(plan).not.toBeNull();expect(rng.getState()).toEqual(before);expect(getNextEntityId()).toBe(id);expect(commitItemCommand(g,{...plan})).toBe(false);
 g.player.inventory.items.splice(g.player.inventory.items.indexOf(item),1);g.items.push(item);expect(commitItemCommand(g,plan)).toBe(false);expect(commitItemCommand(g,plan)).toBe(false);h.dispose();
});
it('identifies exactly one item with ten material units and no mechanical revision change',()=>{
 const {h,g,r}=setup(),item=make();g.player.inventory.addItem(item);g.player.inventory.addItem(assembleWorldItem(commandDefinitions.items[0]!,10));r.bindItemData(item);const rev=nativeStatRevision(g.player),tick=timeSystem.currentTick,turn=(g as any).playerTurnEnded.bind(g);vi.spyOn(g as any,'playerTurnEnded').mockImplementationOnce(()=>{expect(nativeStatRevision(g.player)).toBe(rev);turn();});
 h.ext('c6fixture','identify-shards',{v:1,revision:1,itemId:item.id});expect(item.identified).toBe(true);expect(item.moduleData!.c6fixture).toMatchObject({known:true});expect(g.player.inventory.items.some(i=>i.worldItem)).toBe(false);expect(timeSystem.currentTick-tick).toBe(100);h.dispose();
});
it('native full identification and familiarity synchronize data; provider failure restores native knowledge',()=>{
 const {h,g,r}=setup();for(const use of [(i:ReturnType<typeof make>)=>ItemLoader.identifyInstance(i),(i:ReturnType<typeof make>)=>ItemLoader.decrementWeaponAutoIDTimer(i)]){const i=make();g.player.inventory.addItem(i);r.bindItemData(i);const rev=nativeStatRevision(g.player);use(i);expect(i.moduleData!.c6fixture).toMatchObject({known:true});expect(i.identified).toBe(true);expect(nativeStatRevision(g.player)).toBe(rev);}
 h.dispose();const bad=createItemHarness({},[{...completeDescriptor,create:()=>{const m=createItemCompleteFixture();return {...m,itemKnowledge:{...m.itemKnowledge!,reveal(){throw new Error('injected');}}};}}]),game=bad.game(),i=make();game.player.inventory.addItem(i);game.extensionRuntime!.bindItemData(i);const audit=auditFullObjectGraph([game,rng]);expect(()=>ItemLoader.identifyInstance(i)).toThrow('injected');expect(audit.differences()).toEqual([]);bad.dispose();
});
it('rolls back consume, output allocation and state when late validation fails',()=>{
 const {h,g,r}=setup(),i=make();g.player.inventory.addItem(i);const plan=prepareItemCommand(g,input('salvage',{v:1,revision:1,itemIds:[i.id]}))!,id=getNextEntityId(),snapshot=g.toSnapshot();vi.spyOn(r,'commitItemCommandState').mockImplementation(()=>{throw new Error('injected');});expect(commitItemCommand(g,plan)).toBe(false);expect({...g.toSnapshot(),savedAt:0}).toEqual({...snapshot,savedAt:0});expect(getNextEntityId()).toBe(id);h.dispose();
});
it('preflights post-removal capacity and rejects cross-owner outputs without a partial consume',()=>{
 const {h,g}=setup();for(const i of [...g.player.inventory.items])g.player.unequip(i,true);g.player.inventory.items=[];const i=make();g.player.inventory.addItem(i);g.player.inventory.capacity=1;
 const original=g.extensionRuntime!.prepareItemCommand.bind(g.extensionRuntime!);
 const stub=vi.spyOn(g.extensionRuntime!,'prepareItemCommand').mockImplementation((...args)=>({...original(...args)!,materials:[{definitionId:'c6fixture.shard',quantity:100}]}));
 expect(prepareItemCommand(g,input('salvage',{v:1,revision:1,itemIds:[i.id]}))).toBeNull();expect(g.player.inventory.items).toEqual([i]);stub.mockImplementation((...args)=>({...original(...args)!,materials:[{definitionId:'foreign.shard',quantity:10}]}));expect(prepareItemCommand(g,input('salvage',{v:1,revision:1,itemIds:[i.id]}))).toBeNull();h.dispose();
});
it('has no writable item pointers in prepare and rejects registration conflicts and unknown actions',()=>{
 expect(()=>createItemHarness({},[{...completeDescriptor,create:()=>({...createItemCompleteFixture(),commands:{salvage(){}}})}])).toThrow();
 const h=createItemHarness({},[{...completeDescriptor,create:()=>{const m=createItemCompleteFixture(),p=m.itemCommands!['set-filter']!;return {...m,itemCommands:{...m.itemCommands,'set-filter':{...p,prepare(payload,c){expect(Object.isFrozen(c.inventory)).toBe(true);expect(Object.isFrozen(c.inventory[0])).toBe(true);expect(()=>{(c.inventory[0] as any).quantity=99;}).toThrow();return p.prepare(payload,c);}}}};} }]);
 h.ext('c6fixture','set-filter',{v:1,revision:1,minRarity:'all',classes:['weapon'],autoPickupGold:true});expect(h.game().extensionRuntime!.itemCommandState('c6fixture')).toMatchObject({revision:2});expect((h.game().extensionRuntime as any).hasRegisteredCommand(input('reforge',{}))).toBe(false);h.dispose();
});
it('rejects an injected prepare mutation and restores RNG, IDs and item facts',()=>{
 const {h,g,r}=setup(),i=make();g.player.inventory.addItem(i);const id=getNextEntityId(),random=rng.getState(),old=i.enchantment;
 vi.spyOn(r,'prepareItemCommand').mockImplementation(()=>{i.enchantment=4;rng.randRange(1,2);make();return null;});
 expect(prepareItemCommand(g,input('salvage',{v:1,revision:1,itemIds:[i.id]}))).toBeNull();expect(i.enchantment).toBe(old);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);h.dispose();
});

it('rejects coercible non-string filter classes before provider invocation without resource changes',()=>{
 const {h,g,r}=setup(),prepare=vi.spyOn(r,'prepareItemCommand'),before=r.snapshot(),random=rng.getState(),id=getNextEntityId(),tick=timeSystem.currentTick;
 expect(prepareItemCommand(g,input('set-filter',{v:1,revision:1,minRarity:'rare',classes:[['weapon']],autoPickupGold:false}))).toBeNull();
 expect(prepare).not.toHaveBeenCalled();expect(r.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);expect(timeSystem.currentTick).toBe(tick);h.dispose();
});

it('reveals partial knowledge only at a trusted trigger, changes both digests and restores the remaining knowledge after load',()=>{
 const h=createItemHarness({},[{...completeDescriptor,create:()=>{const m=createItemCompleteFixture();return {...m,
  itemDataValidators:{c6fixture:(data,ctx)=>{const d=data as Record<string,import('../ext/types').ReadonlyJson>;const {step,...base}=d;return (step===undefined||step===1||step===2)&&m.itemDataValidators!.c6fixture!(base,ctx);}},
  itemKnowledge:{...m.itemKnowledge!,reveal(data,ctx){const d=data as Record<string,import('../ext/types').ReadonlyJson>,step=ctx.reason==='trigger'?Math.min(2,Number(d.step??0)+1):2;return {...d,step,known:step===2};}}
 };}}]),g=h.game(),i=make();g.player.inventory.addItem(i);g.player.equip(i);const r=g.extensionRuntime!,value=nativeStat(g.player,'native.damage-min'),rev=nativeStatRevision(g.player);
 const before=mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());r.revealItemKnowledge(i,'trigger');
 expect(i.identified).toBe(false);expect(i.moduleData!.c6fixture).toMatchObject({step:1,known:false});expect(nativeStatRevision(g.player)).toBe(rev);expect(nativeStat(g.player,'native.damage-min')).toBe(value);
 const after=mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());expect(after.domains.native).not.toBe(before.domains.native);expect(after.domains.knowledge).not.toBe(before.domains.knowledge);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);const restored=g.player.inventory.items.find(v=>v.id===i.id)!;g.extensionRuntime!.revealItemKnowledge(restored,'trigger');expect(restored.moduleData!.c6fixture).toMatchObject({step:2,known:true});expect(restored.identified).toBe(true);h.dispose();
});
it('refuses non-integer and exhausted module revisions before preparing an item transaction',()=>{
 const {h,g,r}=setup(),state=r.itemCommandState('c6fixture') as Record<string,import('../ext/types').ReadonlyJson>,prepare=vi.spyOn(r,'prepareItemCommand');
 for(const revision of ['1',-1,1.5,Number.MAX_SAFE_INTEGER]){
  vi.spyOn(r,'itemCommandState').mockReturnValue({...state,revision});
  expect(prepareItemCommand(g,input('set-filter',{v:1,revision,minRarity:'rare',classes:[],autoPickupGold:false}))).toBeNull();
 }
 expect(prepare).not.toHaveBeenCalled();h.dispose();
});

it.each(['ring','runic'] as const)('review: shard identification completes native %s knowledge and invalidates real ring points',kind=>{
 const {h,g,r}=setup(),item=kind==='ring'?assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:4,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power:1,known:false}}}):make();
 if(kind==='runic')item.runicType='multiplicity';
 g.player.inventory.addItem(item);g.player.equip(item);r.bindItemData(item);
 g.player.inventory.addItem(assembleWorldItem(commandDefinitions.items[0]!,10));
 const before=nativeStatRevision(g.player);if(kind==='ring')expect(nativeStat(g.player,'native.regeneration-bonus')).toBe(2);
 const plan=prepareItemCommand(g,input('identify-shards',{v:1,revision:1,itemId:item.id}))!;expect(plan).not.toBeNull();expect(commitItemCommand(g,plan)).toBe(true);
 expect(item.moduleData!.c6fixture).toMatchObject({known:true});expect(item.identified).toBe(true);
 if(kind==='ring'){expect(ItemLoader.identifiedItems.has(item.identityId!)).toBe(true);expect(nativeStat(g.player,'native.regeneration-bonus')).toBe(5);expect(nativeStatRevision(g.player)).toBeGreaterThan(before);}
 else {expect(item.runicKnown).toBe(true);expect(item.nativeUninscribedName).not.toContain('unknown runic');expect(nativeStatRevision(g.player)).toBe(before);}
 expect(()=>g.toSnapshot()).not.toThrow();h.dispose();
});
it('review: negation synchronizes instance knowledge without learning ring kind',()=>{
 const {h,g,r}=setup(),i=assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:4,runicType:null,isCursed:true,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power:1,known:false}}});
 i.loc={...g.player.loc};g.items.push(i);r.bindItemData(i);
 (g as any).negationBlastFromPlayer('fixture');expect(i.identified).toBe(true);expect(i.moduleData!.c6fixture).toMatchObject({known:true});expect(i.enchantment).toBe(0);expect(ItemLoader.identifiedItems.has(i.identityId!)).toBe(false);expect(()=>g.toSnapshot()).not.toThrow();h.dispose();
});
it.each([false,true])('review2: negated C6 rings remain scroll targets like native rings (reload=%s)',reload=>{
 const {h,g,r}=setup(),kind='ring_of_regeneration';
 const item=assembleDropItem({native:{kind,category:'ring',enchantment:4,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power:1,known:false}}});
 const control=ItemLoader.spawnRing(kind,g.player.x,g.player.y)!;control.enchantment=4;
 item.loc={...g.player.loc};g.items.unshift(item,control);r.bindItemData(item);
 const negation=ItemLoader.spawnScroll('scroll_of_negation',-1,-1)!;g.player.inventory.addItem(negation);
 g.executeItemCommand('read',negation);
 expect(item.identified).toBe(true);expect(item.moduleData!.c6fixture).toMatchObject({known:true});
 expect(item.enchantment).toBe(0);expect(control.enchantment).toBe(0);
 g.executeCommand('pickup');g.executeCommand('pickup');
 expect(g.player.inventory.items).toContain(item);expect(g.player.inventory.items).toContain(control);
 if(reload)expect(g.loadSnapshot(JSON.parse(JSON.stringify(g.toSnapshot())))).toBe(true);
 const target=g.player.inventory.items.find(i=>i.id===item.id)!,native=g.player.inventory.items.find(i=>i.id===control.id)!;
 expect(ItemLoader.identifiedItems.has(kind)).toBe(false);
 expect(canIdentifyChosenItem(g.player,native)).toBe(true);
 expect(target.canBeIdentified).toBe(true); // Inventory UI filters this flag directly.
 expect(canIdentifyChosenItem(g.player,target)).toBe(true);
 const scroll=ItemLoader.spawnScroll('scroll_of_identify',-1,-1)!;g.player.inventory.addItem(scroll);
 g.executeItemCommand('read',scroll);expect(g.pendingIdentify).toBe(true);
 g.executeItemCommand('identify',target);
 expect(g.pendingIdentify).toBe(false);expect(ItemLoader.identifiedItems.has(kind)).toBe(true);
 expect(target.moduleData!.c6fixture).toMatchObject({known:true});expect(target.canBeIdentified).toBe(false);
 expect(canIdentifyChosenItem(g.player,target)).toBe(false);expect(()=>g.toSnapshot()).not.toThrow();h.dispose();
});
it('review: failed negation reveal restores the complete world and native knowledge',()=>{
 const h=createItemHarness({},[{...completeDescriptor,create:()=>{const m=createItemCompleteFixture();return {...m,itemKnowledge:{...m.itemKnowledge!,reveal(){make();rng.randRange(1,100);throw Error('review reveal');}}};}}]),g=h.game(),i=assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:4,runicType:null,isCursed:true,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power:1,known:false}}});
 i.loc={...g.player.loc};g.items.push(i);g.extensionRuntime!.bindItemData(i);const audit=auditFullObjectGraph([g,rng]),allocator=getNextEntityId();
 expect(()=>(g as any).negationBlastFromPlayer('fixture')).toThrow('review reveal');expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(allocator);expect(ItemLoader.identifiedItems.has(i.identityId!)).toBe(false);h.dispose();
});
it('review: familiarity no-op and countdown avoid checkpoints; reveal takes one and rolls back',()=>{
 const {h,g,r}=setup(),armor=assembleDropItem({native:{kind:'leather_armor',category:'armor',enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:3},moduleData:{c6fixture:{v:1,power:1,known:false}}});
 g.player.inventory.addItem(armor);r.bindItemData(armor);const capture=vi.spyOn(g as any,'checkpointCombatFactWorld');
 expect(ItemLoader.decrementWornFamiliarity(armor)).toBeNull();expect(armor.charges).toBe(2);expect(capture).not.toHaveBeenCalled();
 expect(ItemLoader.decrementWornFamiliarity(armor)).toBeNull();expect(capture).not.toHaveBeenCalled();
 expect(ItemLoader.decrementWornFamiliarity(armor)).toBe('armor');expect(capture).toHaveBeenCalledTimes(1);capture.mockClear();
 armor.charges=30;expect(ItemLoader.decrementWornFamiliarity(armor)).toBeNull();expect(capture).not.toHaveBeenCalled();
 const ring=assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:4,runicType:null,isCursed:false,identified:false,familiarityRemaining:1},moduleData:{c6fixture:{v:1,power:1,known:false}}});g.player.inventory.addItem(ring);r.bindItemData(ring);
 expect(ItemLoader.decrementWornFamiliarity(ring)).toBe('ring');expect(capture).toHaveBeenCalledTimes(1);capture.mockClear();
 const weapon=make();weapon.charges=2;g.player.inventory.addItem(weapon);r.bindItemData(weapon);expect(ItemLoader.decrementWeaponAutoIDTimer(weapon)).toBe(false);expect(capture).not.toHaveBeenCalled();
 vi.spyOn(r,'revealItemKnowledge').mockImplementation(()=>{throw Error('review reveal');});const audit=auditFullObjectGraph([g,rng]);expect(()=>ItemLoader.decrementWeaponAutoIDTimer(weapon)).toThrow('review reveal');expect(audit.differences()).toEqual([]);h.dispose();
});

it('review: a late shard-identification failure restores materials, rune, kind knowledge and mechanics',()=>{
 const {h,g,r}=setup(),item=assembleDropItem({native:{kind:'ring_of_regeneration',category:'ring',enchantment:4,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,power:1,known:false}}});
 g.player.inventory.addItem(item);g.player.equip(item);r.bindItemData(item);g.player.inventory.addItem(assembleWorldItem(commandDefinitions.items[0]!,10));
 const plan=prepareItemCommand(g,input('identify-shards',{v:1,revision:1,itemId:item.id}))!;
 vi.spyOn(r,'commitItemCommandState').mockImplementation(()=>{throw Error('late knowledge commit');});
 const audit=auditFullObjectGraph([g,rng]),revision=nativeStatRevision(g.player);expect(commitItemCommand(g,plan)).toBe(false);expect(audit.differences()).toEqual([]);expect(ItemLoader.identifiedItems.has(item.identityId!)).toBe(false);expect(nativeStatRevision(g.player)).toBe(revision);h.dispose();
});
