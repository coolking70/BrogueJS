import { afterEach, describe, expect, it, vi } from 'vitest';
import { assembleDropItem, assembleNativeTemplate, FIXED_EQUIPMENT_BASES } from '../engine/Items/FixedItemAssembly';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { Item, ItemCategory } from '../engine/Items/Item';
import { ItemDrops, type DropInput } from '../ext/itemDrops';
import type { DropAcceptance, DropProvider, DropItemSpec, ItemClass } from '../ext/itemSdk';
import { createItemDropFixture, createItemEncounterFixture, descriptor } from '../ext/testing/fixtures/itemFixture';
import { createItemHarness } from '../ext/testing/itemHarness';
import { rng } from '../engine/Random';
import { getNextEntityId } from '../entities/Creature';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import weapons from '../data/weapons.json';
import armors from '../data/armors.json';
import arcana from '../data/arcana.json';
import { markCreatureBirth } from '../ext/birth';
import { auditFullObjectGraph } from './support/fullGenerationCheckpointOracle';
import { forEachItemRoot } from '../engine/Core/WorldItemRoots';
afterEach(()=>vi.restoreAllMocks());
const spec=(kind='dagger',category:ItemClass='weapon'):Extract<DropItemSpec,{kind:'native'}>=>({kind:'native',native:{kind,category,enchantment:0,runicType:null,isCursed:false,identified:false,familiarityRemaining:20},moduleData:{c6fixture:{v:1,known:false,power:3}}});
const input:DropInput={source:'kill',actorId:9,monster:{typeId:'rat',leader:false,champion:false,encounterSubject:false},at:{x:5,y:5},playerId:1,level:{kind:'dungeon',depth:1}};
const harness=(overrides:Partial<DropProvider>={})=>createItemHarness({},[{...descriptor,create:()=>createItemDropFixture(overrides)}]);
function victim(g:ReturnType<ReturnType<typeof createItemHarness>['game']>,reason:Parameters<typeof markCreatureBirth>[1]='natural'){
  const m=new Monster(g.player.x+1,g.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
  markCreatureBirth(m,reason);g.monsters.push(m);g.extensionRuntime!.attachCreature(m);return m;
}
describe('C6 deterministic native assembly',()=>{
  it('copies all 26 base facts with no random draw, quiver ID or extra implicit',()=>{
    expect(Object.values(FIXED_EQUIPMENT_BASES).map(p=>p.length)).toEqual([12,6,8]);
    const before=rng.getState();
    for(const category of ['weapon','armor','ring'] as const)for(const kind of FIXED_EQUIPMENT_BASES[category]){
      const item=assembleDropItem(spec(kind,category));const base=[...weapons,...armors,...arcana.rings].find(b=>b.id===kind)!;
      expect(item.identityId).toBe(kind);expect(item.quantity).toBe(1);expect(item.quiverNumber).toBeUndefined();expect(item.weight).toBe(base.weight);
      for(const key of ['damage','clumping','strengthRequired','armor'] as const)if(key in base)expect(item[key]).toEqual((base as any)[key]);
      expect(item.flags??[]).toEqual('flags' in base?base.flags:[]);expect(item.charges).toBe(20);expect(item.enchantment).toBe(0);
      expect(item.char).toBe(category==='weapon'?')':category==='armor'?']':'=');
    }
    expect(rng.getState()).toEqual(before);
    for(const kind of ['dagger','leather_armor','ration_of_food'])expect(assembleNativeTemplate(kind)).not.toHaveProperty('moduleData');
  });
});
describe('C6 authority and receipts',()=>{
  it('binds actual handle identity/session/token/revision and consumes it once without RNG',()=>{
    const mod=createItemDropFixture(),s=new ItemDrops([mod]),other=new ItemDrops([mod]),token={};let draws=0;
    const plan=s.prepare(input,token,1,mod.initialState(),f=>f(),()=>++draws,()=>0)!;
    const accept=(_p:any,e:any):DropAcceptance=>({v:1,eventId:e.eventId,accepted:[{index:0,itemId:10}],skipped:[],acceptedGold:7,newUniqueIds:[]});
    for(const [session,handle,t,r] of [[s,{contract:'C6-1'},token,1],[other,plan,token,1],[s,plan,{},1],[s,plan,token,2]] as const)expect(()=>session.commit(handle as any,t,r,accept,()=>{})).toThrow();
    expect(draws).toBe(1);s.commit(plan,token,1,accept,()=>{});expect(()=>s.commit(plan,token,1,accept,()=>{})).toThrow();expect(draws).toBe(1);
  });
  it('enforces 64 per bucket, 512 per event, strict false proposals and unique registration',()=>{
    for(const [buckets,perBucket,ok] of [[1,64,true],[1,65,false],[8,64,true],[9,57,false]] as const){
      const m=createItemDropFixture({roll(_e,c){for(let b=0;b<buckets;b++){if(b)c.beginItem(b);for(let n=0;n<perBucket;n++)c.randomInt(0,0);}return {v:1,converted:false,items:[],gold:0,uniqueIds:[]};}}),s=new ItemDrops([m]);
      const run=()=>s.prepare(input,{},1,m.initialState(),f=>f(),()=>0,()=>0);if(ok)expect(run).not.toThrow();else expect(run).toThrow();
    }
    expect(()=>new ItemDrops([createItemDropFixture(),createItemDropFixture()])).toThrow();
    expect(()=>new ItemDrops([createItemDropFixture({uniqueCatalog:Array.from({length:129},(_,i)=>`c6fixture.u${i}`)})])).toThrow();
  });
  it('only accepts landed uniques, allowing a skipped unique on a later event',()=>{
    const m=createItemDropFixture({roll:()=>({v:1,converted:true,items:[spec()],gold:0,uniqueIds:['c6fixture.one']})}),s=new ItemDrops([m]),t={};
    for(const land of [false,true]){
      const p=s.prepare(input,t,1,m.initialState(),f=>f(),()=>0,()=>0)!;
      s.commit(p,t,1,(_p,e)=>({v:1,eventId:e.eventId,accepted:land?[{index:0,itemId:10}]:[],skipped:land?[]:[{index:0,reason:'capacity'}],acceptedGold:0,newUniqueIds:land?['c6fixture.one']:[]}),()=>{});
      expect(s.snapshot().unique.c6fixture).toBe('0'.repeat(31)+(land?'1':'0'));
    }
    expect(()=>s.prepare(input,t,1,m.initialState(),f=>f(),()=>0,()=>0)).toThrow();
  });

});
describe('C6 real Game safe points',()=>{
  it('generates floor equipment, fixed vault equipment and kill items after carried items, before DF',()=>{
    const h=harness(),g=h.game(),rt=g.extensionRuntime!;
    let floor:Item|null=null;
    for(let n=0;n<80&&!floor?.moduleData;n++)floor=(g as any).spawnPopulateItem(1,0);
    expect(floor?.moduleData).toBeDefined();g.items.push(floor!);
    const vault=(g as any).spawnBlueprintItem('WEAPON','sword',1,1,1) as Item;
    expect(vault.identityId).toBe('sword');expect(vault.moduleData).toBeDefined();
    const m=victim(g),carried=assembleNativeTemplate('dagger');m.carriedItem=carried;
    let observed=false;vi.spyOn(g as any,'triggerDeathFeatures').mockImplementation(()=>{observed=true;expect(m.carriedItem).toBeNull();expect(g.items).toContain(carried);expect(g.items.filter(i=>i.moduleData).length).toBeGreaterThan(0);});
    const before=(rt.snapshot().modules.c6fixture as any).settled;g.killMonster(m);expect(observed).toBe(true);expect((rt.snapshot().modules.c6fixture as any).settled).toBe(before+1);
    const random=rng.getState();(g as any).dropMonsterLoot(m);expect(rng.getState()).toEqual(random);g.killMonster(m);expect((rt.snapshot().modules.c6fixture as any).settled).toBe(before+1);
    const saved=g.toSnapshot();g.loadSnapshot(saved);expect(g.extensionRuntime!.snapshot().foundation.itemDrops).toEqual(saved.extensions!.foundation.itemDrops);h.dispose();
  });
  it.each(['summoned','clone','periodic','ally','rewardless','administrative'] as const)('excludes %s before captureDeath',kind=>{
    const h=harness(),g=h.game(),m=victim(g,['summoned','clone','periodic'].includes(kind)?kind as any:'natural');
    if(kind==='ally')m.isAlly=true;if(kind==='clone')m.isClone=true;if(kind==='rewardless')m.bodyTransitionRewardless=true;
    const before=(g.extensionRuntime!.snapshot().modules.c6fixture as any).settled;
    g.killMonster(m,kind==='administrative');expect((g.extensionRuntime!.snapshot().modules.c6fixture as any).settled).toBe(before);h.dispose();
  });
  it('rejects a late DF after carry, allocation, settlement and restores the independent full native graph',()=>{
    const h=harness(),g=h.game(),m=victim(g);m.carriedItem=assembleNativeTemplate('dagger');
    vi.spyOn(g as any,'triggerDeathFeatures').mockImplementation(()=>{throw new Error('C6 late DF');});
    const before=g.extensionRuntime!.snapshot(),id=getNextEntityId(),random=rng.getState(),audit=auditFullObjectGraph([g,rng]);
    expect(()=>g.killMonster(m)).toThrow('C6 late DF');expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);expect(rng.getState()).toEqual(random);expect(g.extensionRuntime!.snapshot()).toEqual(before);h.dispose();
  });
  it('partially accepts one equipment root at the cap and skips the following gold root',()=>{
    const h=harness(),g=h.game();let roots=0;forEachItemRoot(g,()=>roots++);
    for(let n=roots;n<8191;n++)g.items.push(new Item('fixture','?',1,ItemCategory.WEAPON));
    const m=victim(g),before=g.items.length;g.killMonster(m);
    expect(g.items.length).toBe(before+1);expect(g.items[g.items.length-1]?.moduleData).toBeDefined();h.dispose();
  });
  it('all machine qualifiers and duplicate filtering stay on the complete native retry path',()=>{
    const h=harness(),g=h.game();
    for(const q of [[],['MF_REQUIRE_GOOD_RUNIC'],['MF_NO_THROWING_WEAPONS'],['MF_REQUIRE_HEAVY_WEAPON']]){
      const before=g.extensionRuntime!.snapshot().foundation.itemDrops;
      const item=(g as any).spawnBlueprintItem('WEAPON','sword',1,1,1,q,[]);
      expect(item).not.toHaveProperty('moduleData');expect(g.extensionRuntime!.snapshot().foundation.itemDrops).toEqual(before);
    }
    h.dispose();
  });
});

it('converted=false keeps native floor/vault and legacy death RNG; absent service does not split weapon rolls',()=>{
  const h=harness({roll:()=>({v:1,converted:false,items:[],gold:0,uniqueIds:[]})}),g=h.game();
  const vault=(g as any).spawnBlueprintItem('ARMOR','leather_armor',1,1,1);expect(vault).not.toHaveProperty('moduleData');
  const m=victim(g);g.killMonster(m);const state=rng.getState();(g as any).dropMonsterLoot(m);expect(rng.getState()).not.toEqual(state);h.dispose();
  const plain=createItemHarness(),p=plain.game();const native=vi.spyOn(ItemLoader,'spawnWeapon');
  (p as any).spawnBlueprintItem('WEAPON','sword',1,1,1);expect(native).toHaveBeenCalledTimes(1);plain.dispose();
});
it.each(['roll','settle','validator','allocation','placement'] as const)('rolls back the whole death transaction at %s',stage=>{
  let armed=false;
  const base=createItemDropFixture();const provider={...base.itemDrops!};
  if(stage==='roll')provider.roll=(e,c)=>{c.randomInt(1,100);if(armed)throw Error('C6 injection');return base.itemDrops!.roll(e,c);};
  if(stage==='settle')provider.settle=(s,e,a)=>{if(armed)throw Error('C6 injection');return base.itemDrops!.settle(s,e,a);};
  const h=harness(provider),g=h.game(),m=victim(g);m.carriedItem=assembleNativeTemplate('dagger');
  if(stage==='validator')vi.spyOn(g.extensionRuntime!,'validateItemData').mockImplementation(()=>{if(armed)throw Error('C6 injection');});
  if(stage==='allocation')vi.spyOn(g as any,'spawnExtensionDrop').mockImplementation(()=>{new Item('allocated','?',1,ItemCategory.WEAPON);throw Error('C6 injection');});
  if(stage==='placement'){const push=g.items.push;vi.spyOn(g.items,'push').mockImplementation(function(this:Item[],...items:Item[]){const result=push.apply(this,items);if(items.some(i=>i.moduleData))throw Error('C6 injection');return result;});}
  armed=true;const id=getNextEntityId(),state=g.extensionRuntime!.snapshot(),audit=auditFullObjectGraph([g,rng]);
  expect(()=>g.killMonster(m)).toThrow('C6 injection');expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);expect(g.extensionRuntime!.snapshot()).toEqual(state);h.dispose();
});

it('neutral encounter is registered by real generation, survives save/load and awards exactly once',()=>{
  const h=createItemHarness({seed:7309},[{...descriptor,create:createItemEncounterFixture}]),g=h.game();
  const registry=g.extensionRuntime!.snapshot().foundation.itemDrops!;expect(registry.encounters).toHaveLength(1);
  const id=registry.encounters[0]!.subjects[0]!;const snapshot=g.toSnapshot();g.loadSnapshot(snapshot);
  const boss=g.monsters.find(m=>m.id===id)!;expect(boss).toBeDefined();
  const before=(g.extensionRuntime!.snapshot().modules.c6fixture as any).settled;
  g.killMonster(boss);expect((g.extensionRuntime!.snapshot().modules.c6fixture as any)).toEqual({settled:before+1,watermark:1});
  expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.encounters).toEqual([]);
  g.killMonster(boss);expect((g.extensionRuntime!.snapshot().modules.c6fixture as any).settled).toBe(before+1);h.dispose();
});
it('a blocked placement skips without placement dice or IDs; all skips still consume the event',()=>{
  const accepted:DropAcceptance[]=[];
  const h=harness({sources:['kill'],roll:()=>({v:1,converted:true,items:[spec()],gold:4,uniqueIds:['c6fixture.one']}),settle(s,_e,a){accepted.push(a);return s;}}),g=h.game(),m=victim(g);
  // Occupy every cell with a native item: the normal candidate finder returns none.
  for(let y=0;y<g.grid.height;y++)for(let x=0;x<g.grid.width;x++){const i=new Item('occupied','?',1,ItemCategory.FOOD);i.loc={x,y};g.items.push(i);}
  const id=getNextEntityId(),random=rng.getState(),event=g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId;
  g.killMonster(m);expect(getNextEntityId()).toBe(id);expect(rng.getState()).toEqual(random);
  expect(accepted[accepted.length-1]).toMatchObject({accepted:[],skipped:[{index:0,reason:'placement'}],acceptedGold:0,newUniqueIds:[]});
  expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.nextEventId).toBe(event+1);h.dispose();
});


it('restores converted-drop guards for a nested successful death when the outer DF fails',()=>{
  const h=harness(),g=h.game(),outer=victim(g),inner=victim(g);
  vi.spyOn(g as any,'triggerDeathFeatures').mockImplementation((m:unknown)=>{if(m===outer){g.killMonster(inner);throw Error('nested DF failure');}});
  const audit=auditFullObjectGraph([g,rng]),random=rng.getState(),id=getNextEntityId();
  expect(()=>g.killMonster(outer)).toThrow('nested DF failure');expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);
  (g as any).dropMonsterLoot(inner);expect(rng.getState()).not.toEqual(random);h.dispose();
});
it('rejects gold counter overflow with the stable localized budget code and restores the complete death',()=>{
 const h=harness(),g=h.game(),m=victim(g);(g as any).goldGenerated=Number.MAX_SAFE_INTEGER-3;
 const audit=auditFullObjectGraph([g,rng]),id=getNextEntityId();expect(()=>g.killMonster(m)).toThrowError(expect.objectContaining({code:'C6_BUDGET'}));
 expect(audit.differences()).toEqual([]);expect(getNextEntityId()).toBe(id);h.dispose();
});

it.each(['ally','clone','rewardless','administrative'] as const)('review: encounter-only provider rejects %s deaths without a kill birth registry',kind=>{
 const h=createItemHarness({seed:7309},[{...descriptor,create:()=>{const m=createItemEncounterFixture();return {...m,itemDrops:{...m.itemDrops!,sources:['encounter']}};}}]),g=h.game(),r=g.extensionRuntime!,registry=r.snapshot().foundation.itemDrops!,boss=g.monsters.find(m=>m.id===registry.encounters[0]!.subjects[0])!;
 expect(r.hasItemDrops('kill')).toBe(false);expect(r.itemDropEligible(boss.id)).toBe(false);
 if(kind==='ally')boss.isAlly=true;if(kind==='clone')boss.isClone=true;if(kind==='rewardless')boss.bodyTransitionRewardless=true;
 const before=r.snapshot().modules.c6fixture;g.killMonster(boss,kind==='administrative');expect(r.snapshot().modules.c6fixture).toEqual(before);expect(r.snapshot().foundation.itemDrops!.nextEncounterOrdinal).toBe(registry.nextEncounterOrdinal);expect(r.snapshot().foundation.itemDrops!.encounters).toEqual([]);h.dispose();
});
it('review: a disqualified split subject loses the remaining encounter across reload',()=>{
 const h=createItemHarness({seed:7309},[{...descriptor,create:()=>{const m=createItemEncounterFixture();return {...m,itemDrops:{...m.itemDrops!,sources:['encounter']}};}}]),g=h.game(),r=g.extensionRuntime!,row=r.snapshot().foundation.itemDrops!.encounters[0]!,boss=g.monsters.find(m=>m.id===row.subjects[0])!,child=victim(g);
 r.emit('bodyTransition',{sourceGroupId:boss.id,reason:'split',moveId:null,outcome:'applied',resultGroupIds:[boss.id,child.id],retiredIds:[]});
 boss.isAlly=true;const before=r.snapshot().modules.c6fixture;g.killMonster(boss);expect(r.snapshot().foundation.itemDrops!.encounters[0]!.lost).toBe(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);g.killMonster(g.monsters.find(m=>m.id===child.id)!);expect(g.extensionRuntime!.snapshot().modules.c6fixture).toEqual(before);h.dispose();
});
it('review: vault decline preserves each native weighted roll and throwing draw order',()=>{
 const h=harness({roll:()=>({v:1,converted:false,items:[],gold:0,uniqueIds:[]})}),g=h.game();
 const pool=ItemLoader.genWeapons,total=pool.reduce((n,w)=>n+(w.frequency??0),0),spawn=vi.spyOn(ItemLoader,'spawnWeapon').mockImplementation(id=>{const i=new Item(id,')',1,ItemCategory.WEAPON);i.identityId=id;return i;});
 // Exhaust every closed-interval chooseKind roll. Spawning is stubbed to isolate category/kind dice.
 for(let roll=1;roll<=total;roll++){
  let cumulative=0;const expected=pool.find(w=>(cumulative+=w.frequency??0)>=roll)!.id;
  const draws=vi.spyOn(rng,'randRange').mockReturnValueOnce(1).mockReturnValue(roll);
  (g as any).spawnBlueprintItem('WEAPON',undefined,1,1,1);
  expect(spawn.mock.calls[spawn.mock.calls.length-1]![0],`roll ${roll}`).toBe(expected);
  expect(draws.mock.calls,`roll ${roll}`).toEqual([[1,ItemLoader.CE_ITEM_GENERATION_PROBABILITIES.find(s=>s.category===ItemCategory.WEAPON)!.weight],[1,total]]);draws.mockRestore();
 }
 h.dispose();
});

it('review: reward-enabled encounters reject missing or forged split provenance on load',()=>{
 const h=createItemHarness({seed:7309},[{...descriptor,create:createItemEncounterFixture}]),g=h.game(),saved=g.toSnapshot();
 expect(saved.extensions!.foundation.itemDrops!.encounters[0]!.splitSubjects).toEqual([]);
 for(const value of [undefined,[999999],[saved.extensions!.foundation.itemDrops!.encounters[0]!.subjects[0]!,saved.extensions!.foundation.itemDrops!.encounters[0]!.subjects[0]!]]){
  const bad=structuredClone(saved),row=bad.extensions!.foundation.itemDrops!.encounters[0]!;
  if(value===undefined)delete row.splitSubjects;else row.splitSubjects=value;
  const audit=auditFullObjectGraph([g,rng]);expect(g.loadSnapshot(bad)).toBe(false);expect(audit.differences()).toEqual([]);
 }
 expect(g.loadSnapshot(saved)).toBe(true);h.dispose();
});
it('review: a disqualified parent stays lost when a real split clears allegiance',()=>{
 const h=createItemHarness({seed:7309},[{...descriptor,create:()=>{const m=createItemEncounterFixture();return {...m,itemDrops:{...m.itemDrops!,sources:['encounter']}};}}]),g=h.game(),r=g.extensionRuntime!,row=r.snapshot().foundation.itemDrops!.encounters[0]!,boss=g.monsters.find(m=>m.id===row.subjects[0])!;
 boss.isAlly=true;const before=r.snapshot().modules.c6fixture;
 const result=g.transitionBody({sourceGroupId:boss.id,reason:'split',results:[{formId:boss.typeId,memberMap:[]},{formId:boss.typeId,memberMap:[]}],hp:'conserve',statuses:'preserve',relationships:'clear',placement:'nearest'});
 expect(result.outcome).toBe('applied');expect(r.snapshot().foundation.itemDrops!.encounters[0]!.lost).toBe(true);
 expect(r.snapshot().foundation.itemDrops!.encounters[0]!.splitSubjects).toEqual(result.resultGroupIds.filter(id=>id!==boss.id));
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
 for(const id of result.resultGroupIds){const child=g.monsters.find(m=>m.id===id)!;expect(child.isAlly).toBe(false);g.killMonster(child);}
 expect(g.extensionRuntime!.snapshot().modules.c6fixture).toEqual(before);h.dispose();
});
