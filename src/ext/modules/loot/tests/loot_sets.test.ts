import {writeFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';
import {loadLootPack} from '../definitions';
import {buildEffectiveLootCatalog} from '../catalog';
import {rollLoot} from '../generator';
import {deriveNativeFacts,validateLootItemData} from '../item';
import {setModifierDrafts,equippedLootSets} from '../sets';
import {lootDrops} from '../drops';
import {initialLootState,stateOf,validLootState} from '../session';
import {triggerLootKnowledge} from '../knowledge';
import {revealLoot} from '../commands';
import {projectLootKnowledge} from '../ui/knowledge';
import {buildLootItemView} from '../ui/viewModel';
import {salvageYield,familiarityThresholds} from '../economy';
import {enhanceLoot,lootEnhancementLimit} from '../enhancement';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {assembleDropItem} from '../../../../engine/Items/FixedItemAssembly';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {nativeStat} from '../../../../engine/Stats/NativeStatSources';
import {readLootGameView} from '../gameView';
import {logger} from '../../../../engine/Systems/Logger';
import {rng} from '../../../../engine/Random';
import {getNextEntityId} from '../../../../entities/Creature';
import {auditFullObjectGraph} from '../../../../test/support/fullGenerationCheckpointOracle';
import {prepareItemCommand,commitItemCommand} from '../../../../engine/Core/ItemCommands';
import type {LootItemDataV1,LootPack} from '../types';
import type {DropEvent} from '../../../itemSdk';
const c=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null});
const noDraw={randomInt:()=>{throw Error('Unexpected random draw');}};
const facts={v:1 as const,location:'pack' as const,ringKindKnown:true,magicPolarity:'unknown' as const,curseRevealed:false,hallucinating:false,familiarity:null};
function piece(id:string,known=false):LootItemDataV1 {
 const {setId,piece:p}=c.piecesById[`loot.piece.${id}`]!;
 return {v: 6,baseId:p.baseId,ilvl:20,rarity:'set',uniqueId:null,setId,pieceId:p.id,identityKnown:known,
  affixes:p.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known})),corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:14}};
}
const wanderer=['blade','coat','lamp','watch'].map(n=>`wanderer.${n}`);
const equipment=(ids= wanderer,known=false)=>ids.map((id,i)=>({id:10+i,data:piece(id,known)}));
it('frozen two by four catalog and cumulative rewards have independent literal expectations',()=>{
 expect(c.pieceIds).toEqual(['loot.piece.bastion.guard','loot.piece.bastion.mace','loot.piece.bastion.mail','loot.piece.bastion.vigor','loot.piece.wanderer.blade','loot.piece.wanderer.coat','loot.piece.wanderer.lamp','loot.piece.wanderer.watch']);
 expect(c.pack.sets.sets.map(s=>s.pieces.map(p=>p.baseId))).toEqual([['sword','leather_armor','ring_of_light','ring_of_awareness'],['mace','chain_mail','ring_of_regeneration','ring_of_transference']]);
 for(const n of [2,3,4,3,2,1])expect(setModifierDrafts(equipment().slice(0,n),c).map(r=>[r.draft.stat,r.draft.value])).toEqual([['native.move-speed',-1000],['native.max-hp',15],['loot.rarity-find',2000]].slice(0,Math.max(0,n-1)));
 const mixed=equipment(['wanderer.blade','wanderer.coat','bastion.vigor','bastion.guard']);
 expect(setModifierDrafts(mixed,c).map(r=>[r.draft.stat,r.draft.value])).toEqual([['native.max-hp',15],['native.move-speed',-1000]]);
 const bastion=equipment(['bastion.mace','bastion.mail','bastion.vigor','bastion.guard']);
 expect(setModifierDrafts(bastion,c).map(r=>[r.draft.stat,r.draft.value])).toEqual([['native.max-hp',15],['native.resist.fire',1500],['native.physical-damage-taken',-1000]]);
});
it('duplicate rings count once; distinct rings count twice; order and unknown anchor are conservative',()=>{
 const dup=equipment(['wanderer.lamp','wanderer.lamp'],true);expect(equippedLootSets(dup,c)[0]!.count).toBe(1);expect(setModifierDrafts(dup,c)).toEqual([]);
 const items=equipment(wanderer,true);items[0]!.data.identityKnown=false;
 expect(equippedLootSets(items,c,true)[0]).toMatchObject({count:3,anchorId:11});expect(equippedLootSets(items,c)[0]).toMatchObject({count:4,anchorId:10});
 expect(setModifierDrafts([...items].reverse(),c,true)).toEqual(setModifierDrafts(items,c,true));
 const pack=structuredClone(c.pack);pack.sets.sets.reverse();pack.sets.sets.forEach(s=>s.pieces.reverse());
 const reordered=buildEffectiveLootCatalog(loadLootPack(pack),c.availability);expect(reordered.pieceIds).toEqual(c.pieceIds);
 expect(setModifierDrafts(items,reordered,true)).toEqual(setModifierDrafts(items,c,true));
});
it.each(['uniqueId','setId','pieceId','baseId','identityKnown','v','sockets','corrupted','affixes','enhancement'])('strict instance rejects invalid %s',key=>{
 const data=piece('wanderer.blade') as unknown as Record<string,unknown>;
 const poison:Record<string,unknown>={uniqueId:'loot.unique.whisper',setId:'loot.set.bastion',pieceId:'loot.piece.wanderer.coat',baseId:'dagger',identityKnown:true,v:2,sockets:1,corrupted:true,affixes:[],enhancement:5};
 data[key]=poison[key];expect(validateLootItemData(data,c)).toBe(false);
});
it('single row reveal never reveals the identity, even when it is the last row',()=>{
 const data=piece('wanderer.coat'),revealed=triggerLootKnowledge(data,c,{kind:'stat-commit',stats:['native.max-hp'],targetTags:[]}) as unknown as LootItemDataV1;
 expect(revealed.affixes[0]!.known).toBe(true);expect(revealed.identityKnown).toBe(false);expect(deriveNativeFacts(revealed,c).identified).toBe(false);
 const dto=projectLootKnowledge(revealed,c,facts);expect(dto.setId).toBeNull();expect(dto.pieceId).toBeNull();expect(buildLootItemView(dto,c,{presetId:'standard'}).set).toBeUndefined();
 const full=revealLoot(revealed) as unknown as LootItemDataV1;expect(validateLootItemData(full,c)).toBe(true);expect(projectLootKnowledge(full,c,facts)).toMatchObject({setId:'loot.set.wanderer',pieceId:'loot.piece.wanderer.coat',identified:true});
});
it('set generation uses one candidate without a draw, and exhausted or wrong bases fall directly to rare',()=>{
 const raw=structuredClone(c.pack);raw.presets.presets.forEach(p=>{p.rarityWeights={normal:0,magic:0,rare:0,unique:0,set:1};p.corruptChanceBp=0;});
 const cat=buildEffectiveLootCatalog(loadLootPack(raw),c.availability),request={v:1 as const,source:'vault' as const,depth:4,presetId:'standard',rarityFindBp:0,claimedUniqueIds:[],itemClass:'weapon' as const,baseId:'sword',highValue:false};
 const result=rollLoot(cat,request,noDraw);expect(result.draws).toBe(0);expect(result.items[0]!.data).toMatchObject({rarity:'set',pieceId:'loot.piece.wanderer.blade',identityKnown:false});
 for(const req of [{...request,claimedUniqueIds:['loot.piece.wanderer.blade']},{...request,baseId:'dagger'},{...request,depth:1}]){
  const fallback=rollLoot(cat,req,{randomInt:lo=>lo});expect(fallback.items[0]!.data.rarity).toBe('rare');expect(fallback.newUniqueIds).toEqual([]);expect(fallback.draws).toBeLessThanOrEqual(64);
 }
});
it('set receipt only settles accepted pieces; invalid masks reject; salvage never refunds it',()=>{
 const provider=lootDrops(()=>c),state=initialLootState('standard',c.fingerprint),event:DropEvent={v:1,eventId:1,source:'floor',level:{kind:'dungeon',depth:4},at:{x:1,y:1},playerId:1,itemClass:'weapon'};
 const accepted={v:1 as const,eventId:1,accepted:[],skipped:[],acceptedGold:0,newUniqueIds:[] as string[]};
 expect(provider.settle(state,event,accepted)).toEqual(state);
 const next=stateOf(provider.settle(state,event,{...accepted,newUniqueIds:['loot.piece.wanderer.blade']}));
 expect(next.setMask).toBe('00000000000000000000000000000010');expect(next.uniqueMask).toBe(0);expect(provider.validateReceipts!(next,['loot.piece.wanderer.blade'],0)).toBe(true);expect(provider.validateReceipts!(next,[],0)).toBe(false);
 expect(validLootState({...state,setMask:'00000000000000000000000000000100'},'standard',c.fingerprint)).toBe(false);
 expect(validLootState({...state,v:1},'standard',c.fingerprint)).toBe(false);
});
it('frozen economy and cap: standard 60, bountiful 45, 150% familiarity, +4 no refinement draw',()=>{
 const data=piece('wanderer.coat'),standard=c.pack.presets.presets.find(p=>p.id==='standard')!,bountiful=c.pack.presets.presets.find(p=>p.id==='bountiful')!;
 expect(salvageYield(data,standard)).toBe(60);expect(salvageYield(data,bountiful)).toBe(45);expect(familiarityThresholds(data,standard).armorTurns).toBe(900);
 const full=enhanceLoot(data,c,4,noDraw);expect(full.enhancement).toBe(4);expect(lootEnhancementLimit(full,c)).toBe(0);expect(()=>enhanceLoot(full,c,1,noDraw)).toThrow();
});
it.each(['duplicate','badBase','badCount','range','unknown','budget','receipts'])('set schema rejects %s before publication',kind=>{
 const p=structuredClone(c.pack) as LootPack,s=p.sets.sets[0]!;
 if(kind==='duplicate')s.pieces[1]!.id=s.pieces[0]!.id;
 if(kind==='badBase')s.pieces[0]!.baseId='missing';
 if(kind==='badCount')s.bonuses[1]!.count=2;
 if(kind==='range')s.bonuses[0]!.rows[0]!.ranges[0]=[-1000,0];
 if(kind==='unknown')Object.assign(s,{extra:1});
 if(kind==='budget')for(const b of s.bonuses)b.rows=Array.from({length:4},(_,i)=>({...structuredClone(b.rows[0]!),rowId:`${s.id}.b${b.count}.r${i}`,modifiers:Array(4).fill(b.rows[0]!.modifiers[0]!)}));
 if(kind==='receipts')p.sets.sets=Array.from({length:32},(_,i)=>({...structuredClone(s),id:`loot.set.s${i}`,pieces:s.pieces.map((piece,j)=>({...piece,id:`loot.piece.s${i}.p${j}`}))}));
 expect(()=>loadLootPack(p)).toThrow();
});
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>{vi.restoreAllMocks();handles.splice(0).forEach(h=>h.dispose());});
function open(){const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']});handles.push(h);return {h,g:worldHarnessGame(h)};}
function add(g:ReturnType<typeof worldHarnessGame>,id:string,known=false){const data=piece(id,known),n=deriveNativeFacts(data,c);const item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:1000},moduleData:{loot:JSON.parse(JSON.stringify(data))}});expect(g.player.inventory.addItem(item)).toBe(true);g.extensionRuntime!.bindItemData(item);return item;}
it('real equipment, whole-set known comparison, materialization, pure UI and strict load',()=>{
 const {g,h}=open(),p=g.player,r=g.extensionRuntime!;
 for(const i of p.inventory.items)p.unequip(i,true);
 const baseHp=p.maxHp,items=wanderer.map(id=>add(g,id));
 for(const item of items)g.executeItemCommand('equip',item);
 expect(nativeStat(p,'native.move-speed')).toBe(90);expect(nativeStat(p,'loot.rarity-find')).toBe(2000);expect(p.maxHp).toBe(baseHp+35);expect(p.hp).toBeLessThan(p.maxHp);
 expect(r.stats.hypothetical(p.id,{},true)['loot.rarity-find']).toBe(0);
 for(const item of items)ItemLoader.identifyInstance(item);
 expect(r.stats.hypothetical(p.id,{unequip:items[3]!.id},true)['loot.rarity-find']).toBe(0);
 expect(r.stats.hypothetical(p.id,{unequip:[items[2]!.id,items[3]!.id]},true)['native.max-hp']).toBe(baseHp+10);
 const replacement=add(g,'bastion.guard',true),view=readLootGameView(g,replacement.id,[]);
 expect(view.compare!.columns).toHaveLength(2);expect(view.compare!.columns[0]!.rows.find(r=>r.key==='loot.set.wanderer')!).toMatchObject({before:'4',after:'3',delta:'-1'});
 expect(view.sourceSets[0]).toMatchObject({count:4});expect(view.sourceSets[0]!.bonuses.map(b=>b.active)).toEqual([true,true,true]);
 // Warm read caches first: subsequent pure reads cannot mutate the graph or RNG/IDs.
 const before=auditFullObjectGraph([g,rng]),id=getNextEntityId();for(let i=0;i<100;i++)readLootGameView(g,replacement.id,[]);expect(before.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
 const save=g.toSnapshot(),digest=h.digest();expect(g.loadSnapshot(save)).toBe(true);expect(h.digest()).toBe(digest);
 const bad=structuredClone(save);const raw=bad.player.inventory.find(i=>i.id===items[0]!.id)!.moduleData!.loot as Record<string,unknown>;raw.identityKnown=false;
 const audit=auditFullObjectGraph([g,rng]);expect(g.loadSnapshot(bad)).toBe(false);expect(audit.differences()).toEqual([]);
});
it('set salvage cancellation/CAS/late rollback preserves all state; accepted salvage gives exact material',()=>{
 const {g,h}=open(),item=add(g,'wanderer.blade'),payload={v:1,revision:1,itemIds:[item.id]},input=JSON.stringify({module:'loot',action:'salvage',payload});
 h.ext('loot','salvage',payload,[false]);expect(g.player.inventory.items).toContain(item);
 const plan=prepareItemCommand(g,input)!;expect(plan).not.toBeNull();vi.spyOn(g.extensionRuntime!,'commitItemCommandState').mockImplementation(()=>{throw Error('late set salvage');});
 const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();expect(commitItemCommand(g,plan)).toBe(false);expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);vi.restoreAllMocks();
 h.ext('loot','salvage',payload,[true]);expect(g.player.inventory.items).not.toContain(item);expect(g.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0)).toBe(60);
 const target=add(g,'wanderer.coat');h.ext('loot','identify-shards',{v:1,revision:2,itemId:target.id});expect(target.isIdentified).toBe(true);expect((target.moduleData!.loot as unknown as LootItemDataV1).identityKnown).toBe(true);
});

it('natural set pickup/equip/identify/salvage preserves current save, full replay, seek and continuation',async()=>{
 const {g,h}=open();
 g.startNewGame({seed:110,mode:'wizard',ruleSet:'extended',extensions:['loot'],extensionConfigurations:{loot:{presetId:'bountiful'}},initialCommands:[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId:'bountiful'}})]});g.animationEnabled=false;
 const {TerrainType}=await import('../../../../engine/Map/Grid');
 const {isAutoDescent}=await import('../../../../engine/Map/TerrainCatalog');
 async function walk(target:{x:number;y:number}){
  const score=(i:typeof g.player.equippedWeapon)=>i?.damage?Number(i.damage.match(/d(\d+)/)?.[1]??0)+(i.enchantment??0)*2:0;
  const upgrade=g.player.inventory.items.filter(i=>i.category===0&&i.identityId!=='dart'&&!i.isCursed&&(i.strengthRequired??0)<=g.player.strength).sort((a,b)=>score(b)-score(a))[0];
  if(upgrade&&!g.player.equippedWeapon?.isCursed&&score(upgrade)>score(g.player.equippedWeapon))g.executeItemCommand('equip',upgrade);
  const depth=g.depth,key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
  for(let attempt=0;attempt<500;attempt++){
   if(g.recordingInputBlocked)await g.flushRecording();
   while(logger.pendingAcknowledgment)logger.acknowledgeNext();
   if(g.depth!==depth||key(g.player.loc)===key(target))return;
   const seizer=g.player.seized?g.monsters.find(m=>m.hp>0&&m.seizing&&!m.isAlly&&!m.hasStatus('entranced')&&Math.max(Math.abs(m.x-g.player.x),Math.abs(m.y-g.player.y))===1):null;if(seizer){g.executeCommand('move',{x:Math.sign(seizer.x-g.player.x),y:Math.sign(seizer.y-g.player.y)});continue;}
   const queue=[{...g.player.loc}],parents=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);
   for(let n=0;n<queue.length&&!parents.has(key(target));n++)for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1],[1,-1],[1,1],[-1,1],[-1,-1]]){
    const p=queue[n]!,at={x:p.x+dx!,y:p.y+dy!},cell=g.grid.getCell(at.x,at.y);
    if(dx&&dy&&(!g.grid.getCell(p.x+dx,p.y)?.isPassable||!g.grid.getCell(p.x,p.y+dy)?.isPassable))continue;
    if(cell&&(cell.isPassable||cell.layers.includes(TerrainType.DOOR)||cell.layers.includes(TerrainType.SECRET_DOOR))&&!cell.layers.some(t=>isAutoDescent(t)||t===TerrainType.LAVA)&&!parents.has(key(at))){parents.set(key(at),p);queue.push(at);}
   }
   if(!parents.has(key(target))){if(attempt%8!==7)continue;throw Error('No safe natural set path');}
   let at=target,next=at;while(parents.get(key(at))){next=at;at=parents.get(key(at))!;}
   g.executeCommand(g.grid.getCell(next.x,next.y)!.layers.includes(TerrainType.SECRET_DOOR)?'search':'move',{x:next.x-g.player.x,y:next.y-g.player.y});
   while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
  }
  throw Error(`Natural set path budget D${g.depth} ${JSON.stringify(g.player.loc)} -> ${JSON.stringify(target)} locked=${g.isInputLocked()} inventory=${g.isInventoryOpen} ack=${logger.pendingAcknowledgment} monster=${g.monsters.filter(m=>Math.max(Math.abs(m.x-g.player.x),Math.abs(m.y-g.player.y))<2).map(m=>m.name+':'+m.hp).join(',')}`);
 }
 const all=()=>[...g.items,...g.player.inventory.items];
 const shards=()=>g.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0);
 let target:ReturnType<typeof all>[number]|undefined;
 while(g.depth<=12){
  target=all().find(i=>(i.moduleData?.loot as unknown as LootItemDataV1)?.rarity==='set');if(target)break;
  const spare=shards()<10?all().find(i=>i.moduleData?.loot&&![g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight].includes(i)):undefined;
  if(spare){if(!g.player.inventory.items.includes(spare)){await walk(spare.loc);g.executeCommand('pickup');}h.ext('loot','salvage',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,itemIds:[spare.id]},[true]);continue;}
  const d=g.depth;await walk(g.levelSeeds[d-1]!.downStairsLoc);if(g.depth===d)g.executeCommand('stairs_down');
 }
 // C2 draws stretch seed110 funding to D7; funding below also uses natural melee drops. Original lifecycle and timeout stay fixed.
 expect(target).toBeDefined();expect(target!.moduleData!.loot).toMatchObject({pieceId:'loot.piece.wanderer.lamp',origin:{source:'floor',depth:4}});const id=target!.id;
 if(!g.player.inventory.items.includes(target!)){await walk(target!.loc);g.executeCommand('pickup');}
 expect(g.player.inventory.items).toContain(target);
 const birthReceipt=stateOf(g.extensionRuntime!.snapshot().modules.loot!).setMask;expect(BigInt('0x'+birthReceipt)).toBeGreaterThan(0n);
 g.executeItemCommand('equip',target!);expect([g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight]).toContain(target);
 g.executeItemCommand('unequip',target!);
 // Finance with real floor/kill drops. C2 draws otherwise make the old floor-only fixture walk to D7.
 for(let n=0;n<20&&shards()<10;n++){
  const spare=all().find(i=>i!==target&&i.moduleData?.loot&&![g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight].includes(i));if(!spare){const victim=g.monsters.filter(m=>m.hp>0&&!m.isAlly&&!m.isClone&&['goblin','ogre'].includes(m.typeId)).sort((a,b)=>Math.abs(a.x-g.player.x)+Math.abs(a.y-g.player.y)-Math.abs(b.x-g.player.x)-Math.abs(b.y-g.player.y))[0];if(victim){await walk(victim.loc);continue;}expect(g.depth).toBeLessThan(10);const depth=g.depth;await walk(g.levelSeeds[depth-1]!.downStairsLoc);if(g.depth===depth)g.executeCommand('stairs_down');continue;}
  if(!g.player.inventory.items.includes(spare!)){await walk(spare!.loc);g.executeCommand('pickup');}
  h.ext('loot','salvage',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,itemIds:[spare!.id]},[true]);
 }
 // Natural funding can itself accept a second set; capture the ledger immediately before the operations that must preserve it.
 const receipt=stateOf(g.extensionRuntime!.snapshot().modules.loot!).setMask;
 h.ext('loot','identify-shards',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,itemId:id});expect(target!.isIdentified).toBe(true);
 const before=h.save();if(process.env.PHASE6C1_NATURAL_EXPORT)writeFileSync(process.env.PHASE6C1_NATURAL_EXPORT+'-save.json',before);h.load(before);target=g.player.inventory.items.find(i=>i.id===id)!;expect((target.moduleData!.loot as unknown as LootItemDataV1).identityKnown).toBe(true);
 h.ext('loot','salvage',{v:1,revision:stateOf(g.extensionRuntime!.snapshot().modules.loot!).revision,itemIds:[id]},[true]);expect(g.player.inventory.items.some(i=>i.id===id)).toBe(false);expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).setMask).toBe(receipt);
 const save=h.save(),recording=h.exportRecording(),digest=h.digest();h.load(save);expect(h.digest()).toBe(digest);expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
 h.seek(recording,Math.floor(JSON.parse(recording).events.length/2));h.seek(recording,JSON.parse(recording).events.length);expect(h.digest()).toBe(digest);
 h.load(save);h.command('escape');const continued=h.exportRecording();expect(h.replay(continued).ok).toBe(true);if(process.env.PHASE6C1_NATURAL_EXPORT){writeFileSync(process.env.PHASE6C1_NATURAL_EXPORT+'-recording.json',continued);writeFileSync(process.env.PHASE6C1_NATURAL_EXPORT+'-witness.json',JSON.stringify({seed:110,preset:'bountiful',pieceId:'loot.piece.wanderer.lamp',birthDepth:4,endDepth:g.depth,events:JSON.parse(continued).events.length,receipt}));}
},60000);
