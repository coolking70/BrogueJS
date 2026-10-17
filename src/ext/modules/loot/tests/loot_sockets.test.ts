import {descriptor as craftFixture,createCraftingSkeleton} from '../../../testing/fixtures/craftingSkeleton';
import {registerWorld5WorkFixture} from '../../../world5Fixture';
import {planMaterialTransfer,commitMaterialTransfer} from '../../../../engine/Core/WorldMaterialTransfer';
import {inventoryStamp} from '../../../../engine/Core/RecordingDigest';
import {containerRead} from '../../../../engine/Core/WorldWorkWorld';
import {afterEach,expect,it,vi} from 'vitest';
import {Game} from '../../../../engine/Core/Game';
import {logger} from '../../../../engine/Systems/Logger';
import {descriptor as lootDescriptor} from '../descriptor';
import {createLootModule} from '../index';
import {loadLootPack} from '../definitions';
import {buildEffectiveLootCatalog} from '../catalog';
import {rollLootWithTrace} from '../generator';
import {deriveNativeFacts,projectItemModifiers,validateLootItemData} from '../item';
import {matchRuneword} from '../sockets';
import {triggerLootKnowledge} from '../knowledge';
import {lootEnhancementLimit,enhanceLoot} from '../enhancement';
import {projectLootKnowledge,knownModifierDrafts} from '../ui/knowledge';
import {buildLootItemView} from '../ui/viewModel';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {assembleDropItem} from '../../../../engine/Items/FixedItemAssembly';
import {assembleWorldItem} from '../../../../engine/Items/WorldItems';
import {itemDefinition,checkItemBudget,readWorkContext} from '../../../../engine/Core/WorldWorkWorld';
import {countWorldItemRoots} from '../../../../engine/Core/WorldItemRoots';
import {prepareWorldWorkCommand,commitWorldWork,withWorldActorScope} from '../../../../engine/Core/WorldWork';
import {prepareItemCommand,commitItemCommand} from '../../../../engine/Core/ItemCommands';
import {ItemLoader} from '../../../../engine/Items/ItemLoader';
import {rng} from '../../../../engine/Random';
import {timeSystem} from '../../../../engine/Systems/Time';
import {getNextEntityId} from '../../../../entities/Creature';
import {nativeStat} from '../../../../engine/Stats/NativeStatSources';
import {auditFullObjectGraph} from '../../../../test/support/fullGenerationCheckpointOracle';
import {readLootGameView} from '../gameView';
import {stateOf} from '../session';
import type {LootItemDataV1,LootPack} from '../types';
import type {DropAcceptance,DropItemSpec} from '../../../itemSdk';
import {MonsterState} from '../../../../entities/Monster';
import {TerrainType} from '../../../../engine/Map/Grid';
const c=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null});
const rune=(id:string)=>`loot.rune.${id}`;
function base(sockets=2,baseId='leather_armor',sequence:string[]=[]):LootItemDataV1 {
 return {v:5,baseId,ilvl:20,rarity:matchRuneword(c,baseId==='leather_armor'?'armor':'weapon',sockets,sequence.map(rune))?'runeword':'normal',uniqueId:null,setId:null,pieceId:null,identityKnown:false,affixes:[],corrupted:false,enhancement:0,sockets,socketed:sequence.map(rune),nameParts:null,origin:{source:'floor',depth:14}};
}
const facts={v:1 as const,location:'pack' as const,ringKindKnown:true,magicPolarity:'unknown' as const,curseRevealed:false,hallucinating:false,familiarity:{unit:'turns' as const,remaining:999}};
const noDraw={randomInt:()=>{throw Error('Unexpected draw');}};
it('frozen 18 bases, four materials, two exact words and six independent drop rates',()=>{
 expect(c.pack.sockets.bases).toHaveLength(18);
 for(const b of c.pack.sockets.bases)expect(b.bands).toEqual([{minIlvl:1,maxIlvl:11,weights:[70,20,10,0,0]},{minIlvl:12,maxIlvl:26,weights:[50,20,20,10,0]},{minIlvl:27,maxIlvl:99,weights:[40,15,20,15,10]}]);
 expect(c.pack.runes.runes.map(r=>[r.id,r.minIlvl,r.weight,r.rows[0]!.ranges[0]![0]])).toEqual([['loot.rune.ka',1,100,500],['loot.rune.ul',1,100,5],['loot.rune.tal',1,100,500],['loot.rune.ren',1,100,500]]);
 expect(c.pack.runeDrops.rows.map(r=>[r.presetId,r.source,r.chanceBp,r.count])).toEqual([['scarce','kill',500,[1,1]],['scarce','encounter',2500,[1,1]],['standard','kill',1000,[1,1]],['standard','encounter',5000,[1,1]],['bountiful','kill',1500,[1,1]],['bountiful','encounter',7500,[1,1]]]);
});
it.each([['armor',2,['ka','ul'],'loot.word.ash'],['weapon',2,['tal','ren'],'loot.word.edge'],['weapon',2,['ka','ul'],null],['armor',2,['ul','ka'],null],['armor',4,['ka','ul'],null],['armor',4,['ka','ul','ka','ul'],null],['armor',2,['ka','ka'],null]] as const)('full key %s %i %j', (cls,n,seq,id)=>{
 expect(matchRuneword(c,cls,n,seq.map(rune))?.id??null).toBe(id);
});
it('one/four holes and repeated rune sources, word replacement, and independent knowledge',()=>{
 for(const [data,values] of [[base(1,'leather_armor',['ka']),[500]],[base(4,'leather_armor',['ka','ka','ka','ka']),[500,500,500,500]],[base(2,'leather_armor',['ka','ul']),[2000,20]],[base(2,'dagger',['tal','ren']),[1500,1500]]] as const){
  expect(validateLootItemData(data,c)).toBe(true);const rows=projectItemModifiers(data,c);expect(rows.map(r=>r.value)).toEqual(values);expect(new Set(rows.map(r=>r.sourceId)).size).toBe(rows.length);expect(rows.every(r=>r.known)).toBe(true);
  const dto=projectLootKnowledge(data,c,facts);expect(dto.identified).toBe(false);expect(knownModifierDrafts(dto,c).map(r=>r.value)).toEqual(values);
  expect(triggerLootKnowledge(data,c,{kind:'stat-commit',stats:['native.max-hp','native.resist.fire'],targetTags:[]})).toEqual(data);
  expect(buildLootItemView(dto,c,{presetId:'standard'}).rows.flatMap(r=>r.lines)).toHaveLength(values.length);
 }
});
it.each(['old','over','ring','unknown','wrong-class','normal-word','word-prefix','enhanced','magic-hole','false-word','secret-field'])('strict save validator rejects %s',kind=>{
 const d=base() as unknown as Record<string,unknown>;
 if(kind==='old')d.v=3;if(kind==='over')d.sockets=5;if(kind==='ring')d.baseId='ring_of_light';if(kind==='unknown')d.socketed=['loot.rune.missing'];
 if(kind==='wrong-class'){const pack=structuredClone(c.pack);pack.runes.runes[0]!.itemClasses=['armor'];const cc=buildEffectiveLootCatalog(loadLootPack(pack),c.availability);expect(validateLootItemData({...base(2,'dagger'),socketed:[rune('ka')]},cc)).toBe(false);return;}
 if(kind==='normal-word')d.socketed=['loot.rune.ka','loot.rune.ul'];if(kind==='word-prefix'){d.rarity='runeword';d.sockets=4;d.socketed=['loot.rune.ka','loot.rune.ul'];}
 if(kind==='enhanced'){d.enhancement=1;d.socketed=[rune('ka')];}if(kind==='magic-hole')d.rarity='magic';if(kind==='false-word')d.rarity='runeword';if(kind==='secret-field')d.runewordId='loot.word.ash';expect(validateLootItemData(d,c)).toBe(false);
});
it.each(['ambiguous','reference','gap','duplicate','variable','budget','nine','source','order'])('catalog admission rejects %s',kind=>{
 const p=structuredClone(c.pack) as LootPack;
 if(kind==='ambiguous')p.runewords.words.push({...structuredClone(p.runewords.words[0]!),id:'loot.word.other'});
 if(kind==='reference')p.runewords.words[0]!.sequence[0]='loot.rune.missing';if(kind==='gap')p.sockets.bases[0]!.bands[1]!.minIlvl=13;
 if(kind==='duplicate')p.runes.runes.push(p.runes.runes[0]!);if(kind==='variable')p.runes.runes[0]!.rows[0]!.ranges[0]=[1,2];
 if(kind==='budget'){const r=p.runes.runes[0]!;r.rows=Array.from({length:4},(_,i)=>({...structuredClone(r.rows[0]!),rowId:r.id+'.r'+i,modifiers:Array(4).fill(r.rows[0]!.modifiers[0]!)}));}
 if(kind==='nine')p.presets.presets[0]!.encounter.count=8;if(kind==='source')Object.assign(p.runeDrops.rows[0]!,{source:'floor'});if(kind==='order')p.runeDrops.rows[0]!.runeIds.reverse();expect(()=>loadLootPack(p)).toThrow();
});
it('normal terminal draw at each band; rings and non-normal retain zero socket draws',()=>{
 for(const [depth,weights] of [[1,[70,20,10,0,0]],[8,[50,20,20,10,0]],[18,[40,15,20,15,10]]] as const){
  const p=structuredClone(c.pack);p.presets.presets.forEach(p=>{p.floorConversionBp=10000;p.rarityWeights={normal:1,magic:0,rare:0,unique:0,set:0};p.vault.minRarity='normal';p.vault.highValueMinRarity='normal';p.encounter.firstMinRarity='normal';p.encounter.restMinRarity='normal';});p.dropTables.tables.forEach(t=>t.minRarity=null);
  const cc=buildEffectiveLootCatalog(loadLootPack(p),c.availability);
  for(let draw=1;draw<=100;draw++){
   const tape:number[][]=[];const r=rollLootWithTrace(cc,{v:1,source:'vault',baseId:'dagger',itemClass:'weapon',highValue:false,depth,presetId:'standard',rarityFindBp:0,claimedUniqueIds:[]},{randomInt:(lo,hi)=>{tape.push([lo,hi]);return draw;}});
   const expected=weights.findIndex((_,i)=>draw<=weights.slice(0,i+1).reduce<number>((a,b)=>a+b,0));expect(r.result.items[0]!.data.sockets).toBe(expected);expect(tape).toEqual([[1,100]]);
  }
  const ring=rollLootWithTrace(cc,{v:1,source:'vault',baseId:'ring_of_light',itemClass:'ring',highValue:false,depth,presetId:'standard',rarityFindBp:0,claimedUniqueIds:[]},noDraw);expect(ring.result.draws).toBe(0);expect(ring.result.items[0]!.data.sockets).toBe(0);
 }
});
const handles:ReturnType<typeof createWorldHarness>[]=[];
it.each([0,1,2,3,4])('singleton %i-hole choice consumes zero draws at weights 1 and 100',count=>{
 for(const weight of [1,100]){
  const p=structuredClone(c.pack);
  p.presets.presets.forEach(p=>{p.rarityWeights={normal:1,magic:0,rare:0,unique:0,set:0};p.vault.minRarity='normal';p.vault.highValueMinRarity='normal';p.encounter.firstMinRarity='normal';p.encounter.restMinRarity='normal';});
  p.dropTables.tables.forEach(t=>t.minRarity=null);
  p.sockets.bases.forEach(b=>b.bands.forEach(b=>{b.weights=[0,0,0,0,0];b.weights[count]=weight;}));
  const catalog=buildEffectiveLootCatalog(loadLootPack(p),c.availability);
  const result=rollLootWithTrace(catalog,{v:1,source:'vault',baseId:'dagger',itemClass:'weapon',highValue:false,depth:1,presetId:'standard',rarityFindBp:0,claimedUniqueIds:[]},noDraw);
  expect(result.result.items[0]!.data.sockets).toBe(count);expect(result.result.draws).toBe(0);expect(result.trace.itemDraws).toEqual([0]);
 }
});
afterEach(()=>{vi.restoreAllMocks();handles.splice(0).forEach(h=>h.dispose());});
function open(){const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']});handles.push(h);return {h,g:worldHarnessGame(h)};}
function equipment(g:ReturnType<typeof worldHarnessGame>,data=base()){
 const n=deriveNativeFacts(data,c),item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:999},moduleData:{loot:JSON.parse(JSON.stringify(data))}});expect(g.player.inventory.addItem(item)).toBe(true);g.extensionRuntime!.bindItemData(item);return item;
}
function material(g:ReturnType<typeof worldHarnessGame>,id='ka',n=2){const item=assembleWorldItem(itemDefinition(g,rune(id)),n);expect(g.player.inventory.addItem(item)).toBe(true);return item;}
const input=(itemId:number,runeItemId:number,revision=1)=>JSON.stringify({module:'loot',action:'socket',payload:{v:1,itemId,runeItemId,revision}});
it.each([[0,[]],[2,['ka']],[2,['ka','ul']],[4,['ka','ul']]] as const)('floor %i holes/%j remains public after drop and save/load without base secrets', (count,sequence)=>{
 const {g,h}=open(),item=equipment(g,base(count,'leather_armor',[...sequence]));
 item.enchantment=-2;item.strengthRequired=17;item.isCursed=true;item.charges=999;
 g.executeItemCommand('drop',item);
 const check=()=>{
  const restored=g.items.find(i=>i.id===item.id)!;expect(restored).toBeDefined();
  expect(restored).toMatchObject({identified:false,enchantment:-2,strengthRequired:17,isCursed:true,charges:999});
  expect(g.extensionRuntime!.projectKnownItem(restored,'loot','floor').data).toEqual({rarity:sequence.length===2&&count===2?'runeword':'normal',sockets:{count,sequence:sequence.map(rune)}});
  const view=readLootGameView(g,item.id,[]);expect(view.card!.sockets!.count).toBe(count);expect(view.card!.sockets!.sequence).toHaveLength(sequence.length);
  expect(view.selected!.known).toMatchObject({ilvl:null,affixes:[],corrupted:null,identified:false,polarity:'unknown',familiarity:null});
  const audit=auditFullObjectGraph([g,rng]);for(let n=0;n<20;n++)readLootGameView(g,item.id,[]);expect(audit.differences()).toEqual([]);
 };
 check();const digest=h.digest();h.load(h.save());expect(h.digest()).toBe(digest);check();
});
it('real command No/Yes charges once, preserves native secrets, converts atomically and invalidates stats',()=>{
 const {g,h}=open(),item=equipment(g),ka=material(g),ul=material(g,'ul'),tick=timeSystem.currentTick;
 item.enchantment=-2;item.strengthRequired=17;item.isCursed=true;item.charges=999;
 const payload={v:1,itemId:item.id,runeItemId:ka.id,revision:1};
 h.ext('loot','socket',payload,[false]);expect(timeSystem.currentTick).toBe(tick);expect(ka.quantity).toBe(2);
 h.ext('loot','socket',payload,[true]);expect(timeSystem.currentTick-tick).toBe(100);expect(ka.quantity).toBe(1);expect(item).toMatchObject({enchantment:-2,strengthRequired:17,isCursed:true,identified:false,charges:999});
 expect(lootEnhancementLimit(item.moduleData!.loot as unknown as LootItemDataV1,c)).toBe(0);expect(g.canEnchantTarget(item)).toBe(false);
 h.ext('loot','socket',payload,[true]);expect(timeSystem.currentTick-tick).toBe(100);expect(ka.quantity).toBe(1);
 h.ext('loot','socket',{...payload,runeItemId:ul.id,revision:2},[true]);expect(timeSystem.currentTick-tick).toBe(200);expect(ul.quantity).toBe(1);expect(item.moduleData!.loot).toMatchObject({rarity:'runeword',identityKnown:false,socketed:[rune('ka'),rune('ul')]});
 const hp=g.player.maxHp;item.isCursed=false;g.executeItemCommand('equip',item);expect(g.player.maxHp).toBe(hp+20);expect(nativeStat(g.player,'native.resist.fire')).toBe(2000);expect(g.player.hp).toBeLessThan(g.player.maxHp);
 const view=readLootGameView(g,item.id,[]);expect(view.card!.rows.map(r=>r.lines[0]!.value)).toEqual(['+20%','+20']);
 const graph=auditFullObjectGraph([g,rng]);for(let i=0;i<100;i++)readLootGameView(g,item.id,[]);expect(graph.differences()).toEqual([]);
 const save=g.toSnapshot(),digest=h.digest();expect(g.loadSnapshot(save)).toBe(true);expect(h.digest()).toBe(digest);
 const restored=g.player.inventory.items.find(i=>i.id===item.id)!;expect(restored.identified).toBe(false);expect(g.player.inventory.addItem(assembleWorldItem(itemDefinition(g,'loot.shard'),10))).toBe(true);h.ext('loot','identify-shards',{v:1,revision:stateOf(g.extensionRuntime!.itemCommandState('loot')).revision,itemId:restored.id});expect(restored.identified).toBe(true);expect(g.player.maxHp).toBe(hp+20);
});
it('sealed plan purity, ownership CAS and late rollback preserve graph, ids, random, time and material',()=>{
 const {g}=open(),item=equipment(g),ka=material(g),audit=auditFullObjectGraph([g,rng]),id=getNextEntityId(),tick=timeSystem.currentTick;
 const plan=prepareItemCommand(g,input(item.id,ka.id))!;expect(plan).not.toBeNull();expect(audit.differences()).toEqual([]);
 vi.spyOn(g.extensionRuntime!,'commitItemCommandState').mockImplementation(()=>{throw Error('C2 late');});const rollbackAudit=auditFullObjectGraph([g,rng]);expect(commitItemCommand(g,plan)).toBe(false);expect(rollbackAudit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);expect(timeSystem.currentTick).toBe(tick);vi.restoreAllMocks();
 const next=prepareItemCommand(g,input(item.id,ka.id))!;ka.quantity--;expect(commitItemCommand(g,next)).toBe(false);expect(item.moduleData!.loot).toEqual(base());
});
it.each(['zero','full','enhanced','equipped','missing','stale','extra','self','wrong-owner'])('failure %s has zero cost',kind=>{
 const {g,h}=open(),data=base(kind==='zero'?0:kind==='full'?1:2,'leather_armor',kind==='full'?['ka']:[]);if(kind==='enhanced')data.enhancement=1;
 const item=equipment(g,data),ka=material(g);if(kind==='equipped')g.executeItemCommand('equip',item);
 const payload={v:1,itemId:item.id,runeItemId:kind==='missing'?999999:kind==='self'?item.id:ka.id,revision:kind==='stale'?0:1,...(kind==='extra'?{runewordId:'loot.word.ash'}:{})};
 if(kind==='wrong-owner'){g.player.inventory.items.splice(g.player.inventory.items.indexOf(ka),1);ka.loc={...g.player.loc};g.items.push(ka);}
 const before=g.toSnapshot(),random=rng.getState(),tick=timeSystem.currentTick;
 h.ext('loot','socket',payload);expect(timeSystem.currentTick).toBe(tick);expect(rng.getState()).toEqual(random);expect(g.toSnapshot().player.inventory).toEqual(before.player.inventory);expect(stateOf(g.extensionRuntime!.itemCommandState('loot')).revision).toBe(1);
});
it('empty sockets allow enhancement, inserted runes refuse all enhancement amounts without drawing',()=>{
 const d=base();d.identityKnown=true;expect(enhanceLoot(d,c,10,noDraw).enhancement).toBe(10);
 for(const d of [base(1,'dagger',['ka']),base(2,'leather_armor',['ka','ul'])]){expect(lootEnhancementLimit(d,c)).toBe(0);expect(()=>enhanceLoot(d,c,1,noDraw)).toThrow();}
});
it('salvage warns, No keeps all, Yes destroys runes and returns only 24 shards',()=>{
 const {g,h}=open(),item=equipment(g,base(2,'leather_armor',['ka','ul'])),payload={v:1,revision:1,itemIds:[item.id]},tick=timeSystem.currentTick;
 const plan=prepareItemCommand(g,JSON.stringify({module:'loot',action:'salvage',payload}))!;expect(plan.confirmation).not.toBeNull();h.ext('loot','salvage',payload,[false]);expect(g.player.inventory.items).toContain(item);expect(timeSystem.currentTick).toBe(tick);
 h.ext('loot','salvage',payload,[true]);expect(g.player.inventory.items).not.toContain(item);expect(g.player.inventory.items.filter(i=>i.worldItem?.definitionId==='loot.shard').reduce((n,i)=>n+i.quantity,0)).toBe(24);expect(g.player.inventory.items.some(i=>i.worldItem?.definitionId.startsWith('loot.rune.'))).toBe(false);
});
it('rune side table runs even after failed equipment chance, before gold, without leader/find multipliers',()=>{
 for(const [presetId,threshold] of [['scarce',500],['standard',1000],['bountiful',1500]] as const){
  for(const chance of [threshold,threshold+1]){
   const tape=[10000,chance,...(chance===threshold?[101]:[]),10000],ranges:number[][]=[],buckets:number[]=[];
   const r=rollLootWithTrace(c,{v:1,source:'kill',depth:1,presetId,rarityFindBp:99999,claimedUniqueIds:[],monster:{typeId:'ogre',leader:true,champion:true,encounterSubject:false}},{beginItem:i=>buckets.push(i),randomInt:(lo,hi)=>{ranges.push([lo,hi]);return tape.shift()!;}}).result;
   expect(tape).toEqual([]);expect(r.items).toEqual([]);expect(r.materials).toEqual(chance===threshold?[{definitionId:rune('ren'),quantity:1}]:[]);expect(buckets).toEqual([0,8]);expect(ranges).toEqual([[1,10000],[1,10000],...(chance===threshold?[[1,400]]:[]),[1,10000]]);
  }
 }
 for(const cls of ['none','fodder','splitter']){
  const typeId=c.pack.monsterClasses.members.find(m=>m.class===cls)!.typeId;
  const result=rollLootWithTrace(c,{v:1,source:'kill',depth:20,presetId:'standard',rarityFindBp:0,claimedUniqueIds:[],monster:{typeId,leader:false,champion:false,encounterSubject:false}},{randomInt:(_lo,hi)=>hi}).result;
  expect(result.materials).toEqual([]);
 }
 const suppressed=rollLootWithTrace(c,{v:1,source:'kill',depth:20,presetId:'bountiful',rarityFindBp:0,claimedUniqueIds:[],monster:{typeId:'ogre',leader:true,champion:true,encounterSubject:true}},noDraw).result;expect(suppressed.materials).toEqual([]);expect(suppressed.draws).toBe(0);
});
it('negation preserves sockets, word mechanics and native knowledge; complete identification is separate',()=>{
 const {g}=open(),item=equipment(g,base(2,'leather_armor',['ka','ul']));
 g.player.inventory.items.splice(g.player.inventory.items.indexOf(item),1);item.loc={...g.player.loc};g.items.unshift(item);
 const scroll=ItemLoader.spawnScroll('scroll_of_negation',-1,-1)!;expect(g.player.inventory.addItem(scroll)).toBe(true);g.executeItemCommand('read',scroll);
 expect(item.moduleData!.loot).toMatchObject({rarity:'runeword',sockets:2,socketed:[rune('ka'),rune('ul')]});expect(projectItemModifiers(item.moduleData!.loot as unknown as LootItemDataV1,c).map(r=>r.value)).toEqual([2000,20]);
 expect(validateLootItemData(item.moduleData!.loot,c)).toBe(true);expect(item.identified).toBe((item.moduleData!.loot as unknown as LootItemDataV1).identityKnown);
});
it('99 stack boundary, single-unit consumption, and current save material reconstruction',()=>{
 const {g,h}=open(),item=equipment(g,base(4)),a=material(g,'ka',99);material(g,'ka',1);
 expect(g.player.inventory.items.filter(i=>i.worldItem?.definitionId===rune('ka')).map(i=>i.quantity)).toEqual([99,1]);
 h.ext('loot','socket',{v:1,revision:1,itemId:item.id,runeItemId:a.id},[true]);expect(a.quantity).toBe(98);
 const digest=h.digest();expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(h.digest()).toBe(digest);expect(g.player.inventory.items.filter(i=>i.worldItem?.definitionId===rune('ka')).reduce((n,i)=>n+i.quantity,0)).toBe(99);
});
it('controlled legal birth fixture: zero-draw singleton generation, both words and unmatched four-hole prefix replay across checkpoints and seeks',async()=>{
 const p=structuredClone(c.pack);
 p.presets.presets.forEach(p=>{p.rarityWeights={normal:1,magic:0,rare:0,unique:0,set:0};p.vault.minRarity='normal';p.vault.highValueMinRarity='normal';p.encounter.firstMinRarity='normal';p.encounter.restMinRarity='normal';});
 p.dropTables.tables.forEach(t=>t.minRarity=null);p.sockets.bases.forEach(b=>b.bands.forEach(b=>{b.weights=[0,0,100,0,0];}));
 const singletonCatalog=buildEffectiveLootCatalog(loadLootPack(p),c.availability);
 const prototype=Game.prototype as unknown as {generateDepth(up?:boolean,first?:boolean,fell?:boolean):void},generate=prototype.generateDepth;
 vi.spyOn(prototype,'generateDepth').mockImplementation(function(this:Game,up,first,fell){
  generate.call(this,up,first,fell);if(!first||!this.extensionRuntime)return;
  for(const [baseId,itemClass] of [['leather_armor','armor'],['dagger','weapon']] as const){
   const random=rng.getState();
   const generated=rollLootWithTrace(singletonCatalog,{v:1,source:'vault',baseId,itemClass,highValue:false,depth:1,presetId:'standard',rarityFindBp:0,claimedUniqueIds:[]},{randomInt:(lo,hi)=>rng.randRange(lo,hi)});
   expect(generated.result.draws).toBe(0);expect(rng.getState()).toEqual(random);
   equipment(this,{...generated.result.items[0]!.data,identityKnown:false}); // Controlled unknown native base.
  }
  equipment(this,base(4,'dagger'));
  for(const id of ['ka','ul','tal','ren'])material(this,id,2);
 });
 const {g,h}=open(),items=g.player.inventory.items.filter(i=>i.moduleData?.loot&&!(i.moduleData.loot as unknown as LootItemDataV1).identityKnown&&[2,4].includes((i.moduleData.loot as unknown as LootItemDataV1).sockets));
 expect(items).toHaveLength(3);
 const pad=(n:number)=>{while(g.recordedInputEvents.length<n){while(logger.pendingAcknowledgment)logger.acknowledgeNext();h.command('escape');}};
 pad(254);
 for(const [index,sequence] of [[0,['ka','ul']],[1,['tal','ren']],[2,['ka','ul']]] as const){
  for(const id of sequence){const m=g.player.inventory.items.find(i=>i.worldItem?.definitionId===rune(id))!;h.ext('loot','socket',{v:1,itemId:items[index]!.id,runeItemId:m.id,revision:stateOf(g.extensionRuntime!.itemCommandState('loot')).revision},[true]);}
 }
 expect(items.map(i=>(i.moduleData!.loot as unknown as LootItemDataV1).rarity)).toEqual(['runeword','runeword','normal']);expect(items.every(i=>!i.identified)).toBe(true);
 // The floor adapter must survive real drop commands, save/load and replay of both words.
 for(const item of items){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeItemCommand('drop',item);}
 const checkFloor=()=>{for(const item of items){expect(g.items.some(i=>i.id===item.id)).toBe(true);const view=readLootGameView(g,item.id,[]);expect(view.card!.sockets!.sequence).toHaveLength(2);expect(view.selected!.known!.identified).toBe(false);}};
 checkFloor();
 pad(2049);await g.flushRecording();const save=h.save(),recording=JSON.stringify(await g.exportRecordingAsync()),digest=h.digest();
 h.load(save);expect(h.digest()).toBe(digest);checkFloor();expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);checkFloor();
 for(const cursor of [0,255,256,257,2047,2048,2049]){h.seek(recording,cursor);expect(g.replayCursor).toBe(cursor);expect(g.replayError).toBeNull();}
 expect(h.digest()).toBe(digest);checkFloor();h.load(save);h.command('escape');const continued=h.exportRecording(),final=h.digest();expect(h.replay(continued)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(final);checkFloor();
},60000);
it('host material output accepts only owned C5 definitions and rolls back a failure after placement',()=>{
 // Actual trusted death boundary; deterministic provider isolates the new generic output shape.
 // This is a controlled output test, not the production natural-rune witness.
 const create=(bad=false)=>createWorldHarness({seed:42,mode:'easy',modules:['loot']},[{...lootDescriptor,create:configuration=>{
  const m=createLootModule(configuration),p=m.itemDrops!;return {...m,itemDrops:{...p,roll(e,ctx){return e.source==='kill'?{v:1,converted:true,items:[{kind:'material',definitionId:bad?'crafting.stone':rune('ka'),quantity:1}],gold:0,uniqueIds:[null]}:p.roll(e,ctx);}}};
 }}]);
 for(const bad of [true,false]){
  const h=create(bad);handles.push(h);const g=worldHarnessGame(h),m=g.monsters.find(m=>!m.isAlly&&!m.isClone)!;
  if(!bad){const push=g.items.push;vi.spyOn(g.items,'push').mockImplementation(function(this:typeof g.items,...items:typeof g.items){const n=push.apply(this,items);if(items.some(i=>i.worldItem?.definitionId===rune('ka')))throw Error('C2 material placement');return n;});}
  const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();expect(()=>g.killMonster(m)).toThrow();expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);vi.restoreAllMocks();
 }
 const h=create();handles.push(h);const g=worldHarnessGame(h),m=g.monsters.find(m=>!m.isAlly&&!m.isClone)!;g.killMonster(m);
 const drops=g.items.filter(i=>i.worldItem?.definitionId===rune('ka'));expect(drops).toHaveLength(1);expect(drops[0]!.moduleData).toBeUndefined();expect(drops[0]!.quantity).toBe(1);g.killMonster(m);expect(g.items.filter(i=>i.worldItem?.definitionId===rune('ka'))).toHaveLength(1);
});
function budgetHarness(nativeFirst=false){
 const settlements:DropAcceptance[]=[];
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot'],fixtures:['crafting-skeleton']},[
  {...craftFixture,create:()=>registerWorld5WorkFixture(createCraftingSkeleton())},
  {...lootDescriptor,create:configuration=>{
   const m=createLootModule(configuration),p=m.itemDrops!;
   return {...m,itemDrops:{...p,roll(e,ctx){
    if(e.source!=='kill')return p.roll(e,ctx);
    const items:DropItemSpec[]=[{kind:'material',definitionId:rune('ka'),quantity:1}];
    if(nativeFirst){const data=base(0,'dagger');data.identityKnown=true;items.unshift({kind:'native',native:{kind:'dagger',category:'weapon',enchantment:0,runicType:null,isCursed:false,identified:true,familiarityRemaining:0},moduleData:{loot:JSON.parse(JSON.stringify(data))}});}
    return {v:1,converted:true,items,gold:0,uniqueIds:items.map(()=>null)};
   },settle(state,e,accepted){if(e.source==='kill')settlements.push(accepted);return p.settle(state,e,accepted);}}};
  }}]);
 handles.push(h);return {h,g:worldHarnessGame(h),settlements};
}
function fillRoots(g:Game,total:number){
 for(let n=countWorldItemRoots(g);n<total;n++){const item=assembleWorldItem(itemDefinition(g,rune('ka')),99);item.loc={x:1,y:1};g.items.push(item);}
 expect(countWorldItemRoots(g)).toBe(total);
}
function reserveWorkOutput(g:Game){
 for(const monster of g.monsters)monster.isCaged=true; // Controlled safe worksite; the pending ticket itself is real.
 const context=readWorkContext(g,'craftskel',{kind:'inventory'});if(!context.ok)throw Error(context.code);
 const station=context.value.stations[0]!;g.player.loc={...station.workPositions[0]!};
 const payload={v:1,recipeId:'craftskel.dagger-recipe',batchCount:1,stationId:station.interactableId,stationRevision:station.revision,sourceContainerId:null,sourceRevision:null,inventoryStamp:inventoryStamp(g.player.inventory.items)};
 const plan=prepareWorldWorkCommand(g,JSON.stringify({module:'craftskel',action:'craft',payload}));if(!plan.outcome.ok)throw Error(plan.outcome.code);
 const handle=plan.outcome.value;
 withWorldActorScope(g,'craftskel',g.player.id,'trusted-world',scope=>expect(commitWorldWork(g,handle,scope).ok).toBe(true));
 expect(g.world5!.tickets).toHaveLength(1);expect(g.world5!.tickets[0]!.outputReservation!.slots).toBe(1);
}
it.each([
 {roots:7167,reserve:false,nativeFirst:false,accepted:1,skipped:0},
 {roots:7168,reserve:false,nativeFirst:false,accepted:0,skipped:1},
 {roots:7167,reserve:true,nativeFirst:false,accepted:0,skipped:1},
 {roots:7166,reserve:true,nativeFirst:false,accepted:1,skipped:0},
 {roots:7167,reserve:false,nativeFirst:true,accepted:1,skipped:1},
 {roots:7168,reserve:false,nativeFirst:true,accepted:1,skipped:1}
])('material C5 root budget and work reservation $roots/$reserve/native=$nativeFirst',({roots,reserve,nativeFirst,accepted,skipped})=>{
 const {g,h,settlements}=budgetHarness(nativeFirst);if(reserve)reserveWorkOutput(g);fillRoots(g,roots);
 const victim=g.monsters.find(m=>!m.isAlly&&!m.isClone&&!m.carriedItem)!;expect(victim).toBeDefined();const victimId=victim.id;
 const before=h.save(),beforeDigest=h.digest();h.load(before);expect(h.digest()).toBe(beforeDigest);
 const kill=()=>{
  const m=g.monsters.find(m=>m.id===victimId)!;expect(()=>g.killMonster(m)).not.toThrow();expect(m.deathProcessed).toBe(true);expect(m.hp).toBe(0);
  expect(countWorldItemRoots(g)).toBe(roots+accepted);
  const receipt=settlements[settlements.length-1]!;expect(receipt.accepted).toHaveLength(accepted);expect(receipt.skipped).toEqual(skipped?[{index:nativeFirst?1:0,reason:'capacity'}]:[]);
  if(reserve)expect(g.world5!.tickets[0]!.outputReservation!.slots).toBe(1);
 };
 kill();const digest=h.digest(),random=rng.getState(),nextId=getNextEntityId();h.load(h.save());expect(h.digest()).toBe(digest);
 h.load(before);kill();expect(h.digest()).toBe(digest);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(nextId);
 if(roots+(reserve?1:0)>=7168)expect(()=>checkItemBudget(g,1)).toThrow('C5_BUDGET');
},30000);
it('capacity-skipped rune death via real attack survives save/load, full replay, seek and continuation',()=>{
 // Controlled legal birth with real 7168 distinct roots, not a natural near-capacity claim.
 const prototype=Game.prototype as unknown as {generateDepth(up?:boolean,first?:boolean,fell?:boolean):void},generate=prototype.generateDepth;
 let victimId=0;
 vi.spyOn(prototype,'generateDepth').mockImplementation(function(this:Game,up,first,fell){
  generate.call(this,up,first,fell);if(!first||!this.extensionRuntime)return;
  this.grid.setTerrain(this.player.x+1,this.player.y,TerrainType.FLOOR);
  const victim=this.monsters.find(m=>!m.isAlly&&!m.isClone&&!m.carriedItem&&this.extensionRuntime!.itemDropEligible(m.id))!;
  victim.loc={x:this.player.x+1,y:this.player.y};victim.hp=1;victim.defense=0;victim.state=MonsterState.ASLEEP;victimId=victim.id;fillRoots(this,7168);
 });
 const {g,h,settlements}=budgetHarness();
 for(let n=0;n<10&&g.monsters.some(m=>m.id===victimId);n++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('move',{x:1,y:0});}
 expect(g.monsters.some(m=>m.id===victimId)).toBe(false);expect(settlements[settlements.length-1]!.skipped).toEqual([{index:0,reason:'capacity'}]);expect(countWorldItemRoots(g)).toBe(7168);
 const save=h.save(),recording=h.exportRecording(),digest=h.digest(),end=JSON.parse(recording).events.length;
 h.load(save);expect(h.digest()).toBe(digest);expect(h.replay(recording)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(digest);
 for(const cursor of [0,1,end]){h.seek(recording,cursor);expect(g.replayCursor).toBe(cursor);expect(g.replayError).toBeNull();}
 expect(h.digest()).toBe(digest);h.load(save);h.command('escape');const continued=h.exportRecording(),final=h.digest();expect(h.replay(continued)).toEqual({ok:true,firstMismatch:null});expect(h.digest()).toBe(final);
},30000);
it('full inventory socket needs no output slot; insufficient capacity refuses without material loss',()=>{
 const {g}=open(),item=equipment(g),ka=material(g);g.player.inventory.capacity=g.player.inventory.items.length;
 const plan=prepareItemCommand(g,input(item.id,ka.id))!;expect(plan).not.toBeNull();expect(commitItemCommand(g,plan)).toBe(true);expect(ka.quantity).toBe(1);
 const target=equipmentAfterFree();function equipmentAfterFree(){g.player.inventory.capacity++;return equipment(g);}
 ka.quantity=2;g.player.inventory.capacity=g.player.inventory.items.length-1;const tick=timeSystem.currentTick;
 expect(prepareItemCommand(g,input(target.id,ka.id,2))).toBeNull();expect(timeSystem.currentTick).toBe(tick);expect(ka.quantity).toBe(2);
});
it('runes split into a real C5 chest, save/load, reject remote socket, and withdraw without loss',()=>{
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot'],fixtures:['crafting-skeleton']},[{...craftFixture,create:()=>registerWorld5WorkFixture(createCraftingSkeleton())}]);handles.push(h);const g=worldHarnessGame(h),item=equipment(g),r=material(g,'ka',3);
 const chest=g.world5!.containers.find(c=>c.kind==='chest')!,at=containerRead(g,chest.id).at!;g.player.loc={x:at.x-1,y:at.y};g.grid.getCell(at.x,at.y)!.isExplored=true;
 const transfer=(direction:'deposit'|'withdraw',itemId:number,quantity:number)=>{const c=g.world5!.containers.find(c=>c.id===chest.id)!;const plan=planMaterialTransfer(g,{containerId:c.id,containerRevision:c.revision,inventoryStamp:inventoryStamp(g.player.inventory.items),direction,items:[{itemId,quantity}]});expect(plan.ok,JSON.stringify(plan)).toBe(true);if(plan.ok)expect(commitMaterialTransfer(g,plan.value).ok).toBe(true);};
 transfer('deposit',r.id,2);expect(r.quantity).toBe(1);const boxed=[...g.worldContainerItems!.values()].find(i=>i.worldItem?.definitionId===rune('ka'))!;expect(boxed.quantity).toBe(2);
 expect(prepareItemCommand(g,input(item.id,boxed.id))).toBeNull();const digest=h.digest();expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(h.digest()).toBe(digest);
 expect(g.worldContainerItems!.get(boxed.id)!.quantity).toBe(2);transfer('withdraw',boxed.id,2);expect(g.player.inventory.items.filter(i=>i.worldItem?.definitionId===rune('ka')).reduce((n,i)=>n+i.quantity,0)).toBe(3);expect(g.worldContainerItems!.has(boxed.id)).toBe(false);
});
it('current save rejects old item identity, forged matched rarity, overflow and unknown runes before replacing live state',()=>{
 const {g}=open(),item=equipment(g,base(2,'leather_armor',['ka','ul'])),save=g.toSnapshot();
 for(const patch of [{v:3},{rarity:'normal'},{sockets:1},{socketed:['constructor','loot.rune.ul']},{identityKnown:true}]){
  const bad=structuredClone(save),raw=bad.player.inventory.find(i=>i.id===item.id)!.moduleData!.loot as Record<string,unknown>;Object.assign(raw,patch);
  const graph=auditFullObjectGraph([g,rng]),id=getNextEntityId();expect(g.loadSnapshot(bad)).toBe(false);expect(graph.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
 }
});
