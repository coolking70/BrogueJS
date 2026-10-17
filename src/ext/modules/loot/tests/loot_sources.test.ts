import {afterEach,expect,it,vi} from 'vitest';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {getInstalledModuleDescriptors} from '../../../catalog';
import {emptyProductionArena} from '../../../../test/support/productionComposite';
import {rng} from '../../../../engine/Random';
import {getNextEntityId} from '../../../../entities/Creature';
import {auditFullObjectGraph} from '../../../../test/support/fullGenerationCheckpointOracle';
import {loadLootPack} from '../definitions';
import {buildEffectiveLootCatalog} from '../catalog';
import {rollLoot} from '../generator';
import {validateLootItemData} from '../item';
import {resolveLootCatalog} from '../session';
import {projectLootKnowledge} from '../ui/knowledge';
import {computeEquipmentRowBudget} from '../schema';
import type {PartBrokenFact} from '../../../itemSdk';
import type {CreationReason} from '../../../birth';
import type {Monster} from '../../../../entities/Monster';
import {Item,ItemCategory} from '../../../../engine/Items/Item';
import {requireDungeon} from '../../../worldBasics';
const BODY='giants.copper-tendril-body', SHALE='giants.shale-weaver-body';
const bodies=[{id:BODY,partIds:['limb00','limb01','limb02','limb03']},{id:SHALE,partIds:Array.from({length:8},(_,i)=>`leg0${i}`)}];
const c=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null,bodies});
const request={v:1 as const,source:'part' as const,depth:10,presetId:'standard',rarityFindBp:0,claimedUniqueIds:[],bodyDefinitionId:BODY,partId:'limb00',monster:{typeId:'ogre',champion:true}};
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>{handles.splice(0).forEach(h=>h.dispose());vi.restoreAllMocks();});
function scene(body=BODY,reason:CreationReason='natural',fault?:'roll'|'settle'|'observer'){
 const facts:PartBrokenFact[]=[],observers:PartBrokenFact[]=[];let armed=false;
 const descriptors=getInstalledModuleDescriptors(),descriptor=descriptors.find(d=>d.id==='loot')!,giants=descriptors.find(d=>d.id==='giants')!;
 const h=createWorldHarness({seed:42,mode:'easy',modules:['loot','giants']},[{...descriptor,create:()=>{
  const m=descriptor.create(),p=m.itemDrops!;
  return {...m,hooks:{...m.hooks,partBroken:(fact,context)=>{facts.push(fact);if(armed&&fault==='observer'){expect(()=>context.randomInt(1,2)).toThrow();throw Error('part fault');}}},
   itemDrops:{...p,roll:(event,context)=>{if(armed&&event.source==='part'&&fault==='roll'){context.randomInt(1,10000);throw Error('part fault');}return p.roll(event,context);},
    settle:(state,event,accepted)=>{if(armed&&event.source==='part'&&fault==='settle')throw Error('part fault');return p.settle(state,event,accepted);}}};
 }},{...giants,create:()=>{const m=giants.create();return {...m,hooks:{...m.hooks,partBroken:(fact,context)=>{observers.push(fact);expect(()=>context.setState({})).toThrow();expect(()=>context.randomInt(1,2)).toThrow();}}};}}]);handles.push(h);const g=worldHarnessGame(h);const hp=g.player.hp,maxHp=g.player.maxHp;emptyProductionArena(g);g.player.hp=hp;g.player.maxHp=maxHp;
 const core=g.createCompositeMonster(body,{x:14,y:12},undefined,reason)!;expect(core).toBeTruthy();
 const group=g.bodyGroups!.find(row=>row.coreId===core.id)!;
 for(const m of g.monsters)m.ticksUntilTurn=100000;
 const limb=(id=group.members.find(s=>s.entityId!==core.id)!.partId)=>g.monsters.find(m=>m.spatial?.bodyMember?.groupId===core.id&&m.spatial.bodyMember.partId===id)!;
 armed=true;return {h,g,core,group,limb,facts,observers};
}
function hit(g:ReturnType<typeof worldHarnessGame>,m:Monster,administrative=false){
 const cause=g.extensionRuntime!.causality,origin=cause.create(administrative?'administrative':'melee',g.player.id);
 return cause.withOrigin(origin,()=>m.takeDamage(1000,true,g.grid,undefined,'physical'));
}
function minimum(){return vi.spyOn(rng,'randRange').mockImplementation((lo)=>lo);}
it('frozen two body tables, capability omission/fingerprint and unchanged worst row bounds',()=>{
 expect(c.partTables.map(t=>[t.match.bodyDefinitionId,t.match.partIds!.length,t.chanceBp,t.count,t.classWeights,t.ilvlBonus,t.rarityBonusBp,t.minRarity]))
 .toEqual([[SHALE,8,2500,[1,1],{weapon:40,armor:35,ring:25},0,0,null],[BODY,4,2500,[1,1],{weapon:40,armor:35,ring:25},0,0,null]]);
 const no=buildEffectiveLootCatalog(loadLootPack(),{combat:null,growth:null,giants:null});
 expect(no.partTables).toEqual([]);expect(no.fingerprint).not.toBe(c.fingerprint);
 expect(computeEquipmentRowBudget(c.pack)).toEqual({perSlot:{weapon:11,armor:8,ring:6},provider:35});
 const random=vi.fn(()=>1);expect(rollLoot(no,request,{randomInt:random}).items).toEqual([]);expect(random).not.toHaveBeenCalled();
});
it('part literal tape: probability, class, base, rarity, normal sockets; no count/leader/gold/material draws',()=>{
 const tape=[[1,10000,2500],[1,100,1],[1,100,1],[1,1121,1],[1,100,1]],seen:number[][]=[];
 const result=rollLoot(c,request,{randomInt:(lo,hi)=>{seen.push([lo,hi]);return tape[seen.length-1]![2]!;}});
 expect(seen).toEqual(tape.map(r=>r.slice(0,2)));expect(result.draws).toBe(5);
 expect(result.items).toHaveLength(1);expect(result.items[0]!.data).toMatchObject({v:6,ilvl:20,origin:{source:'part',depth:10,bodyDefinitionId:BODY,partId:'limb00'}});
 expect(result.gold).toBe(0);expect(result.materials).toEqual([]);expect(validateLootItemData(result.items[0]!.data,c)).toBe(true);
});
it.each(['scarce','standard','bountiful'])('chance threshold is exactly 2500 for %s without kill multipliers',presetId=>{
 const draw=vi.fn(()=>2501);expect(rollLoot(c,{...request,presetId},{randomInt:draw}).items).toEqual([]);expect(draw.mock.calls).toEqual([[1,10000]]);
});
it.each([{}, {depth:1}, {siteId:'x',siteKind:'x'}, {siteId:'x',siteKind:'x',depth:1}])('site has no entry and cannot smuggle dungeon depth %j',extra=>{
 const random=vi.fn(()=>1);expect(()=>rollLoot(c,{...request,source:'site',...extra} as never,{randomInt:random})).toThrow();expect(random).not.toHaveBeenCalled();
 const data=rollLoot(c,request,{randomInt:lo=>lo}).items[0]!.data;
 expect(validateLootItemData({...data,origin:{source:'site',...extra}},c)).toBe(false);
 expect(()=>requireDungeon({kind:'site',id:'site.test'})).toThrow();
});
it.each([BODY,SHALE])('real direct damage %s consumes only direct slots and publishes read-only detached fact',body=>{
 const {g,core,group,limb,facts,observers}=scene(body);minimum();const initial=g.items.length,before=g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId;
 const part=limb(),id=part.spatial!.bodyMember!.partId;hit(g,part);
 expect(facts).toHaveLength(1);expect(observers).toEqual(facts);expect(facts[0]).toMatchObject({actorId:core.id,groupId:core.id,partId:id,generation:0,birthEligible:true,causalEligible:true});expect(Object.isFrozen(facts[0])).toBe(true);
 expect(g.items.length).toBe(initial+1);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBe(before+1);
 expect(group.appliedBreaks).toHaveLength(1);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.parts![core.id]!.remaining).not.toContain(id);
 hit(g,part);expect(facts).toHaveLength(1);
});
it.each(['summoned','clone','split','periodic','scripted'] as const)('%s birth cannot acquire part eligibility',reason=>{
 const {g,core,limb,facts}=scene(BODY,reason);const before=g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId;hit(g,limb());
 expect(facts[0]!.birthEligible).toBe(false);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.parts![core.id]).toBeUndefined();expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBe(before);
});
it.each(['ally','member-ally','clone','rewardless','encounter-lost','administrative'] as const)('%s cannot roll at the break safe point',mode=>{
 const {g,core,limb,facts}=scene();if(mode==='ally')core.isAlly=true;if(mode==='member-ally')limb().isAlly=true;if(mode==='clone')core.isClone=true;if(mode==='rewardless')core.bodyTransitionRewardless=true;if(mode==='encounter-lost')g.extensionRuntime!.loseItemEncounter(core.id);
 const before=g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId;hit(g,limb(),mode==='administrative');expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBe(before);
 expect(facts[0]!.birthEligible&&facts[0]!.causalEligible).toBe(false);
});
it('chance failure consumes eligibility and load does not reroll; invalid ledger and old identity reject preserving live game',()=>{
 const {g,core,limb}=scene();const draw=vi.spyOn(rng,'randRange').mockImplementation((_lo,hi)=>hi);hit(g,limb());draw.mockRestore();g.executeCommand('wait');
 const saved=JSON.parse(JSON.stringify(g.toSnapshot())),state=saved.extensions.foundation.itemDrops;
 expect(g.loadSnapshot(saved)).toBe(true);expect(g.extensionRuntime!.snapshot().foundation.itemDrops).toEqual(state);
 for(const mutate of [(s:any)=>s.extensions.foundation.version=19,(s:any)=>s.extensions.foundation.itemDrops.parts[core.id].remaining.push('forged'),(s:any)=>s.extensions.foundation.itemDrops.parts[core.id].remaining.push(s.extensions.foundation.itemDrops.parts[core.id].remaining[0])]){
  const bad=structuredClone(saved);mutate(bad);const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();expect(g.loadSnapshot(bad)).toBe(false);expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
 }
});
it('polymorph away/back with fresh member IDs preserves consumed original slots and grants no new body',()=>{
 const {g,core,limb}=scene();minimum();const first=limb(),partId=first.spatial!.bodyMember!.partId;hit(g,first);g.executeCommand('wait');
 const transform=(formId:string)=>g.transitionBody({sourceGroupId:core.id,reason:'phase',results:[{formId,memberMap:[]}],hp:'ratio',statuses:'preserve',relationships:'preserve',placement:'nearest'});
 expect(transform('giants.shale-weaver').outcome).toBe('applied');const before=g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId;
 hit(g,g.monsters.find(m=>m.spatial?.bodyMember?.groupId===core.id&&m.id!==core.id)!);g.executeCommand('wait');expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBe(before);
 expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.parts![core.id]!.remaining).toEqual([]);
 expect(transform('giants.copper-tendril').outcome).toBe('applied');const newPart=limb(partId);expect(newPart.id).not.toBe(first.id);hit(g,newPart);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBe(before);
});
it.each(['roll','settle','observer'] as const)('fault after %s restores full graph, dual RNG, allocator and receipts',fault=>{
 const {g,limb}=scene(BODY,'natural',fault);minimum();const part=limb(),cause=g.extensionRuntime!.causality,origin=cause.create('melee',g.player.id);
 cause.withOrigin(origin,()=>{const audit=auditFullObjectGraph([g,rng]),snapshot=g.extensionRuntime!.snapshot(),id=getNextEntityId();
  expect(()=>part.takeDamage(1000,true,g.grid,undefined,'physical')).toThrow('part fault');expect(audit.differences()).toEqual([]);expect(g.extensionRuntime!.snapshot()).toEqual(snapshot);expect(getNextEntityId()).toBe(id);
 });
});
it('origin knowledge is generic, identified-only, hidden on floor/hallucination and pure',()=>{
 const data=rollLoot(c,request,{randomInt:lo=>lo}).items[0]!.data;
 const facts={v:1 as const,location:'pack' as const,ringKindKnown:true,magicPolarity:'unknown' as const,curseRevealed:false,hallucinating:false,familiarity:null};
 const unknown={...data,identityKnown:false};expect(projectLootKnowledge(unknown,c,facts)).not.toHaveProperty('partSource');
 const known={...data,identityKnown:true};const audit=auditFullObjectGraph([known,rng]);
 for(let i=0;i<100;i++)expect(projectLootKnowledge(known,c,facts)).toHaveProperty('partSource',true);
 expect(audit.differences()).toEqual([]);for(const edit of [{location:'floor' as const},{hallucinating:true}])expect(projectLootKnowledge(known,c,{...facts,...edit})).not.toHaveProperty('partSource');
});
it('capability and untrusted direct part event cannot mint rewards',()=>{
 const {g}=scene();const runtime=g.extensionRuntime!,catalog=resolveLootCatalog(runtime.queryOptional.bind(runtime));expect(catalog.partTables).toHaveLength(2);
 const audit=auditFullObjectGraph([g,rng]);expect(()=>runtime.resolveItemDrop({source:'part'} as never,()=>{throw Error('must not accept');})).toThrow();expect(audit.differences()).toEqual([]);
});

it('full root capacity consumes the attempt and allocates no drop ID',()=>{
 const {g,limb}=scene();minimum();
 for(let n=0;n<8192;n++)g.items.push(new Item('fixture','?',1,ItemCategory.WEAPON));
 const id=getNextEntityId(),before=g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId,part=limb();
 hit(g,part);expect(getNextEntityId()).toBe(id);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBe(before+1);
 expect(g.items).toHaveLength(8192);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.parts![part.spatial!.bodyMember!.groupId]!.remaining).not.toContain(part.spatial!.bodyMember!.partId);
});
it('lethal transfer commits part before the independent terminal kill',()=>{
 const {g,core,limb}=scene();minimum();core.hp=1;
 const resolve=vi.spyOn(g.extensionRuntime!,'resolveItemDrop');hit(g,limb());
 expect(resolve.mock.calls.map(row=>row[0].source)).toEqual(['part','kill']);expect(core.hp).toBe(0);
});

it('strict part table and origin reject mixed sources, duplicates and event-history fields',()=>{
 for(const change of [(t:any)=>t.match.partIds.push(t.match.partIds[0]),(t:any)=>t.match.monsterId='ogre',(t:any)=>t.match.source='kill',(t:any)=>delete t.match.bodyDefinitionId]){
  const pack=structuredClone(loadLootPack());change(pack.dropTables.tables.find(t=>t.match.source==='part'));expect(()=>loadLootPack(pack)).toThrow();
 }
 const data=rollLoot(c,request,{randomInt:lo=>lo}).items[0]!.data;
 for(const change of [(o:any)=>o.eventId=1,(o:any)=>o.generation=0,(o:any)=>delete o.bodyDefinitionId,(o:any)=>o.partId='core',(o:any)=>o.depth=0]){
  const bad=structuredClone(data);change(bad.origin);expect(validateLootItemData(bad,c)).toBe(false);
 }
});
