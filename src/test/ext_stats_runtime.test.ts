import { edibleState } from '../engine/Core/EdibleState';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { forEachItemRoot } from '../engine/Core/WorldItemRoots';
import { createWorld5 } from '../ext/world5';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import { markCreatureBirth } from '../ext/birth';
import type { ExtensionModule } from '../ext/types';
import type { StatModifierRow, StatSourceProvider } from '../ext/stats';
import { isJson } from '../ext/json';
import { Player } from '../entities/Player';
import { Item, ItemCategory } from '../engine/Items/Item';
import { markStatsDirty, nativeStatRevision, nativeStat, configureNativeStats } from '../engine/Stats/NativeStatSources';
import { createHeadlessGame } from './harness';
import * as catalog from '../ext/catalog';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
const row=(stat='native.max-hp',value=7,extra:Partial<StatModifierRow>={}):StatModifierRow=>({stat,value,layer:'equipment',category:'flat',sourceId:'stats-fixture.item',sourceKind:'fixture',...extra});
function module(provider?:StatSourceProvider):ExtensionModule{return {id:'stats-fixture',version:'1.0.0',initialState:()=>({rows:[],equipped:false}),validateState:isJson,statSources:provider??{collect(actor,c){const s=c.state as unknown as {rows:StatModifierRow[];equipped:boolean};return actor.player&&(!s.equipped||c.equippedItems().length)?s.rows:[];}},commands:{set(payload,c){c.setState(payload);},fail(payload,c){c.setState(payload);throw Error('fixture rollback');}}};}
function direct(provider?:StatSourceProvider){const p=new Player(4,4),registry=new ExtensionRegistry();registry.register('stats-fixture','1.0.0',()=>module(provider));const runtime=new ExtensionRuntime(registry,registry.manifest(['stats-fixture']),{playerId:()=>p.id,depth:()=>1,randomInt:()=>{throw Error('Source RNG');},message:()=>undefined,testMode:()=>true});runtime.attachCreature(p);return {p,runtime,set:(rows:StatModifierRow[],equipped=false,action='set')=>runtime.command(JSON.stringify({module:'stats-fixture',action,payload:{rows,equipped}}))};}
function gameFixture(){vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=>{const r=new ExtensionRegistry();r.register('stats-fixture','1.0.0',()=>module());return r;});const game=createHeadlessGame(51011,'test');game.startNewGame({seed:51011,mode:'test',ruleSet:'extended',extensions:['stats-fixture']});game.animationEnabled=false;const set=(rows:StatModifierRow[])=>game.executeCommand('ext:command',JSON.stringify({module:'stats-fixture',action:'set',payload:{rows,equipped:false}}));return {game,set};}
afterEach(()=>{vi.restoreAllMocks();logger.reset();});
describe('materialized source transactions',()=>{
 it('removes old deltas, clamps reductions, never fills equipment increases and omits empty ledgers',()=>{
  const f=direct(),base=f.p.maxHp;f.p.hp=10;f.set([row()]);expect([f.p.maxHp,f.p.hp]).toEqual([base+7,10]);expect(f.runtime.stats.applied(f.p.id,'native.max-hp')).toBe(7);f.p.hp=base+7;f.set([]);expect([f.p.maxHp,f.p.hp]).toEqual([base,base]);expect(f.runtime.snapshot().foundation.stats).toBeUndefined();f.runtime.assertStats();
 });
 it('invalidates the extensions digest token for native-only equipment ledger changes',()=>{
  const f=direct();f.set([row()],true);const i=new Item('fixture',')',1,ItemCategory.WEAPON);i.damage='1';f.p.inventory.items.push(i);
  const before=f.runtime.recordingDigestToken();f.p.equip(i);const equipped=f.runtime.recordingDigestToken();expect(equipped).not.toEqual(before);
  markStatsDirty(f.p);expect(f.runtime.recordingDigestToken()).toEqual(equipped);
  f.p.unequip(i,true);expect(f.runtime.recordingDigestToken()).not.toEqual(equipped);
 });
 it('invalidates the extensions digest token when GC removes a ledger-only actor',()=>{
  const f=direct({collect(){return [row()];}}),m=new Monster(5,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
  f.runtime.attachCreature(m);const before=f.runtime.recordingDigestToken();expect(f.runtime.snapshot().foundation.stats!.applied.some(r=>r.actorId===m.id)).toBe(true);
  f.runtime.collectComponents([f.p]);expect(f.runtime.snapshot().foundation.stats!.applied.some(r=>r.actorId===m.id)).toBe(false);expect(f.runtime.recordingDigestToken()).not.toEqual(before);
 });
 it('keeps a fieldless NPC strength base separate from its materialized bonus',()=>{
  const f=direct({collect(){return [row('native.strength',4)];}}),m=new Monster(5,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
  f.runtime.attachCreature(m);expect(f.runtime.stats.value(m.id,'native.strength')).toBe(16);markStatsDirty(m);expect(f.runtime.stats.value(m.id,'native.strength')).toBe(16);expect(f.runtime.stats.applied(m.id,'native.strength')).toBe(4);f.runtime.assertStats();
 });
 it('invalidates the digest token when a clone inherits an unchanged HP ledger delta',()=>{
  const f=direct({collect(){return [row()];}}),m=new Monster(5,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
  m.maxHp=f.p.maxHp;m.hp=m.maxHp;markCreatureBirth(m,'clone',f.p.id);const before=f.runtime.recordingDigestToken();
  f.runtime.attachCreature(m);expect(f.runtime.stats.applied(m.id,'native.max-hp')).toBe(7);expect(m.maxHp).toBe(f.p.maxHp);expect(f.runtime.recordingDigestToken()).not.toEqual(before);f.runtime.assertStats();
 });
 it('invalidates the digest token when a native maximum reset removes its old delta',()=>{
  const f=direct({collect(actor){return actor.monsterId==='rat'?[row()]:[];}}),m=new Monster(5,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
  f.runtime.attachCreature(m);expect(f.runtime.stats.applied(m.id,'native.max-hp')).toBe(7);const before=f.runtime.recordingDigestToken();
  m.typeId='ogre';m.maxHp=(monsters as MonsterData[]).find(m=>m.id==='ogre')!.hp;m.hp=m.maxHp;m.extensionHooks!.nativeMaximumReset!(m);
  expect(f.runtime.stats.applied(m.id,'native.max-hp')).toBe(0);expect(f.runtime.recordingDigestToken()).not.toEqual(before);f.runtime.assertStats();
 });
 it('reconciles equipment and rolls a rejected source back before publication',()=>{
  const f=direct();f.set([row()],true);const i=new Item('fixture',')',0xffffff,ItemCategory.WEAPON);i.damage='1';f.p.inventory.items.push(i);const base=f.p.maxHp;f.p.equip(i);expect(f.p.maxHp).toBe(base+7);f.p.unequip(i,true);expect(f.p.maxHp).toBe(base);
  let invalid=false;const second=direct({collect(_a,c){return c.equippedItems().length?(invalid?[...Array.from({length:65},(_,n)=>row('native.max-hp',1,{sourceId:`stats-fixture.s${n}`}))]:[row()]):[];}});second.p.inventory.items.push(i);invalid=true;const before=second.runtime.snapshot(),hp=second.p.hp;expect(()=>second.p.equip(i)).toThrow();expect(second.p.equippedWeapon).toBeNull();expect(second.p.hp).toBe(hp);expect(second.runtime.snapshot()).toEqual(before);second.runtime.assertStats();
 });
 it.each(['inventory-unequipped','container','escrow','refund','remains','ground','monster-carried'])('ignores %s items, contributing only for an inventory item in an equipped slot',location=>{
  const f=direct(),i=new Item(location,')',0xffffff,ItemCategory.WEAPON);i.damage='1';f.set([row()],true);const base=f.p.maxHp;f.p.inventory.items.push(i);markStatsDirty(f.p);expect(f.p.maxHp).toBe(base);f.p.equip(i);expect(f.p.maxHp).toBe(base+7);expect([f.p.equippedWeapon].filter(item=>item&&f.p.inventory.items.includes(item))).toEqual([i]);f.p.unequip(i,true);f.p.inventory.items.splice(f.p.inventory.items.indexOf(i),1);markStatsDirty(f.p);expect(f.p.maxHp).toBe(base);f.runtime.assertStats();
 });
 it('rejects 257 actor rows and 65 same-key sources inside a rollback transaction',()=>{
  const f=direct();for(const rows of [Array.from({length:257},(_,i)=>row(['native.max-hp','native.strength','native.light','native.wisdom'][i%4],1,{sourceId:`stats-fixture.s${i}`})),Array.from({length:65},(_,i)=>row('native.light',1,{sourceId:`stats-fixture.s${i}`}))]){const before=f.runtime.snapshot(),native=[f.p.hp,f.p.maxHp,f.p.strength];expect(()=>f.set(rows)).toThrow();expect(f.runtime.snapshot()).toEqual(before);expect([f.p.hp,f.p.maxHp,f.p.strength]).toEqual(native);}
 });
 it('restores the applied ledger and clears caches on command and generation rollback',()=>{
  const f=direct();f.set([row()]);const before=f.runtime.snapshot(),maximum=f.p.maxHp;expect(()=>f.set([row('native.max-hp',20)],false,'fail')).toThrow('fixture rollback');expect(f.runtime.snapshot()).toEqual(before);expect(f.p.maxHp).toBe(maximum);expect(f.runtime.stats.cacheSize(f.p.id)).toBe(0);
  const token=f.runtime.beginGeneration('fixture');f.set([row('native.max-hp',30)]);f.runtime.rollbackGeneration(token);expect(f.runtime.snapshot()).toEqual(before);expect(f.p.maxHp).toBe(maximum);f.runtime.assertStats();
 });
 it('flags unmarked item edits in debug and accepts explicit dirtiness',()=>{
  const f=direct(),i=new Item('fixture',')',0xffffff,ItemCategory.WEAPON);i.damage='1';i.strengthRequired=12;f.p.inventory.items.push(i);f.p.equip(i);nativeStat(f.p,'native.weapon-enchant');i.enchantment++;expect(()=>nativeStat(f.p,'native.weapon-enchant')).toThrow('Stat cache drift');const old=nativeStatRevision(f.p);markStatsDirty(f.p);expect(nativeStatRevision(f.p)).toBe(old+1);expect(nativeStat(f.p,'native.weapon-enchant')).toBe(4);
 });
 it('provides a frozen read-only module query facade and rejects retained writes during collection',()=>{
  let context:import('../ext/types').ExtensionContext|undefined;const registry=new ExtensionRegistry(),p=new Player(4,4);registry.register('stats-fixture','1.0.0',()=>({...module({collect(){context?.setState({rows:[],equipped:false});return [];}}),onNewGame(c){context=c;}}));const r=new ExtensionRuntime(registry,registry.manifest(['stats-fixture']),{playerId:()=>p.id,depth:()=>1,randomInt:()=>0,message:()=>undefined});r.attachCreature(p);r.newGame();r.stats.clear();expect(()=>r.stats.value(p.id,'native.light')).toThrow('outside');expect(Object.keys(context!.stats).sort()).toEqual(['applied','breakdown','hypothetical','rational','value']);expect(Object.isFrozen(context!.stats)).toBe(true);
 });
 it('preserves save/load/replay/seek/continuation and rejects malformed applied ledgers',()=>{
  const {game,set}=gameFixture();set([row()]);const saved=game.toSaveSnapshot(),recording=game.exportRecording(),expected=game.extensionRuntime!.snapshot(),maximum=game.player.maxHp;
  expect(game.loadSnapshot(saved)).toBe(true);expect(game.player.maxHp).toBe(maximum);expect(game.extensionRuntime!.snapshot()).toEqual(expected);
  const replay=createHeadlessGame(2,'test');expect(replay.loadReplay(recording)).toBe(true);replay.animationEnabled=false;for(const _event of recording.events){replay.replayStep(true);expect(replay.replayError).toBeNull();}expect(replay.extensionRuntime!.snapshot()).toEqual(expected);replay.replaySeek(0);expect(replay.replayError).toBeNull();replay.replaySeek(recording.events.length);expect(replay.extensionRuntime!.snapshot()).toEqual(expected);
  set([row('native.max-hp',9)]);expect(game.recordedInputEvents.length).toBe(recording.events.length+1);
  for(const kind of ['delta','unknown','empty','actor'] as const){const bad=structuredClone(saved),ledger=bad.extensions!.foundation.stats!;if(kind==='delta')ledger.applied[0]!.bonus++;if(kind==='unknown')ledger.applied[0]!.key='foreign.capacity';if(kind==='empty')ledger.applied=[];if(kind==='actor')ledger.applied[0]!.actorId=Number.MAX_SAFE_INTEGER;const live=game.player,random=rng.getState();expect(game.loadSnapshot(bad)).toBe(false);expect(game.player).toBe(live);expect(rng.getState()).toEqual(random);}
 });
});
describe('proposal validation and native ownership',()=>{
 it('keeps the native stealth minimum at two normally and one in native special states',()=>{
  const f=direct();let rested=false;configureNativeStats(f.p,{darkness:()=>false,shadow:()=>false,rested:()=>rested});f.set([row('native.stealth-range',-100)]);
  expect(f.runtime.stats.value(f.p.id,'native.stealth-range')).toBe(2);rested=true;markStatsDirty(f.p);expect(f.runtime.stats.value(f.p.id,'native.stealth-range')).toBe(1);
  rested=false;f.p.applyStatus('invisible',4);expect(f.runtime.stats.value(f.p.id,'native.stealth-range')).toBe(1);
 });
 it('rejects an unrepresentable regeneration fraction before the source is committed',()=>{
  const f=direct(),before=f.runtime.snapshot(),native=[f.p.hp,f.p.maxHp];
  const modifiers=['native','equipment','character','temporary','environment'].map(slot=>row('native.regeneration',1,{category:'more',slot,layer:'temporary',sourceId:`stats-fixture.${slot}`}));
  expect(()=>f.set(modifiers)).toThrow();expect(f.runtime.snapshot()).toEqual(before);expect([f.p.hp,f.p.maxHp]).toEqual(native);
 });
 it('counts native dependency rows in the 256-row admission budget when equipping',()=>{
  // 255 module rows plus the native stealth clamp occupy all 256 slots.
  const f=direct(),rows=Array.from({length:255},(_,n)=>row(['native.max-hp','native.strength','native.light','native.wisdom'][n%4],1,{sourceId:`stats-fixture.s${n}`}));
  f.set(rows);const i=new Item('fixture',')',1,ItemCategory.WEAPON);i.damage='1';i.strengthRequired=12;f.p.inventory.items.push(i);
  const before=f.runtime.snapshot();expect(()=>f.p.equip(i)).toThrow();expect(f.p.equippedWeapon).toBeNull();expect(f.runtime.snapshot()).toEqual(before);
 });
 it('agrees with the sole inventory-root enumerator across actual chest/escrow/refund/remains/floor/carrier graphs',()=>{
  const {game}=gameFixture(),p=game.player,runtime=game.extensionRuntime!,i=new Item('fixture',')',1,ItemCategory.WEAPON);i.damage='1';
  for(const equipped of [p.equippedWeapon,p.equippedArmor,p.ringLeft,p.ringRight])if(equipped)p.unequip(equipped,true);
  runtime.command(JSON.stringify({module:'stats-fixture',action:'set',payload:{rows:[row()],equipped:true}}));const base=p.maxHp;
  p.inventory.items.push(i);p.equip(i);expect(p.maxHp).toBe(base+7);
  const equippedRoots:number[]=[];forEachItemRoot(game,(item,owner)=>{if(owner.kind==='inventory'&&item===p.equippedWeapon)equippedRoots.push(item.id);});expect(equippedRoots).toEqual([i.id]);
  p.inventory.items.splice(p.inventory.items.indexOf(i),1);game.world5=createWorld5();game.worldContainerItems=new Map();
  for(const kind of ['chest','escrow','refund','remains','floor','carrier'] as const){
   game.world5.containers=[];game.worldContainerItems.clear();game.items=game.items.filter(item=>item!==i);for(const actor of game.monsters)if(actor.carriedItem===i)actor.carriedItem=null;
   if(kind==='floor')game.items.push(i);
   else if(kind==='carrier'){if(!game.monsters.length)game.monsters.push(new Monster(5,5,(monsters as MonsterData[]).find(row=>row.id==='rat')!));game.monsters[0]!.carriedItem=i;}
   else{game.world5.containers.push({id:1,owner:'stats-fixture',kind,levelRef:{kind:'dungeon',depth:game.depth},position:null,capacity:1,itemIds:[i.id],revision:0,ticketId:null});game.worldContainerItems.set(i.id,i);}
   const owners:string[]=[];forEachItemRoot(game,(item,owner)=>{if(item===i)owners.push(owner.kind);});expect(owners).toEqual([kind==='floor'?'floor':kind==='carrier'?'carrier':'container']);
   markStatsDirty(p);nativeStat(p,'native.max-hp');expect(p.maxHp).toBe(base);runtime.assertStats();
  }
 });
 it('excludes a dangling equipped slot from native and module sources',()=>{
  const f=direct(),i=new Item('fixture',')',1,ItemCategory.WEAPON);i.damage='4d4';i.enchantment=4;f.p.inventory.items.push(i);f.p.equip(i);expect(nativeStat(f.p,'native.damage-max')).toBeGreaterThan(2);
  f.p.inventory.items.splice(f.p.inventory.items.indexOf(i),1);markStatsDirty(f.p);expect(nativeStat(f.p,'native.damage-max')).toBe(2);
 });
 it('projects a growth component proposal through foreign multipliers without changing the world',()=>{
  // This is a foundation projection fixture. With growth installed, retain its
  // actual provider; without it, use a separate real fixture owner, never a
  // registration pretending that the physically removed growth pack exists.
  const descriptor=catalog.getInstalledModuleDescriptors().find(d=>d.id==='growth')??{
   id:'proposal-fixture',version:'1.0.0',rules:undefined,create:():ExtensionModule=>({
    id:'proposal-fixture',version:'1.0.0',initialState:()=>({}),validateState:isJson,
    componentValidators:{attributes:isJson},
    onNewGame(c){c.setComponent(c.playerId,'attributes',{values:{'growth.attribute.constitution':0}});},
    statSources:{collect(actor,c){const attrs=c.getComponent(actor.id,'attributes') as unknown as {values:Record<string,number>}|undefined;return actor.player&&attrs?[row('native.max-hp',3*attrs.values['growth.attribute.constitution']!,{layer:'character',sourceId:'proposal-fixture.constitution'})]:[];}}
   })
  };
  vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=>{const r=new ExtensionRegistry();r.register(descriptor.id,descriptor.version,descriptor.create,descriptor.rules);r.register('stats-fixture','1.0.0',()=>module({collect:a=>a.player?[row('native.max-hp',10000,{category:'increased',layer:'temporary'})]:[]}));return r;});
  const game=createHeadlessGame(51019,'test');game.startNewGame({seed:51019,mode:'test',ruleSet:'extended',extensions:[descriptor.id,'stats-fixture'],initialCommands:descriptor.id==='growth'?[JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}})]:[]});
  const runtime=game.extensionRuntime!,before=runtime.snapshot(),random=rng.getState(),attrs=structuredClone(before.components[game.player.id]![`${descriptor.id}:attributes`]) as unknown as {values:Record<string,number>};
  attrs.values['growth.attribute.constitution']!++;
  const projected=runtime.hypotheticalComponents(descriptor.id,game.player.id,{attributes:attrs as never});
  expect(projected['native.max-hp']).toBe(game.player.maxHp+6);expect(runtime.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);
 });
});

describe('candidate stat world scope', () => {
 it('inherits and restores nested clocks/actors and discards cached candidate reads even on throw', () => {
  const f=direct(),candidate=new Player(4,4);candidate.id=f.p.id;candidate.strength=20;
  edibleState(f.runtime).timedStats={schema:1,rows:[{actorId:f.p.id,owner:'stats-fixture',key:'native.strength',category:'flat',value:2,untilTick:100}]};
  const live=()=>f.runtime.stats.value(f.p.id,'native.strength');
  expect(live()).toBe(14);
  expect(()=>f.runtime.withStatWorld([candidate],()=>{
    expect(live()).toBe(22);
    f.runtime.withStatWorld([candidate],()=>expect(live()).toBe(22));
    f.runtime.withStatWorld([candidate],()=>expect(live()).toBe(20),100);
    expect(live()).toBe(22);
    throw Error('candidate preflight rejected');
  },99)).toThrow('candidate preflight rejected');
  expect(f.runtime.stats.cacheSize(f.p.id)).toBe(0);
  expect(live()).toBe(14);
  expect([f.p.strength,candidate.strength]).toEqual([12,20]);
  f.runtime.withStatWorld([f.p],()=>expect(live()).toBe(12),100);
  expect(f.runtime.stats.cacheSize(f.p.id)).toBe(0);
  expect(live()).toBe(14);
 });
});

describe('bounded root-attribute derivation',()=>{
 const key={id:'stats-fixture.attribute:stats-fixture.rank',attributeId:'stats-fixture.rank',owner:'stats-fixture',unit:'rank',kind:'query' as const,minimum:0,maximum:4,rounding:'floor' as const,categories:['flat','clamp'] as const,increased:{minimum:-9000,maximum:50000},moreSlots:[],base:0};
 function provider():StatSourceProvider{return {keys:[key],collect:()=>[row(key.id,9,{known:false})],derived:{inputs:[key.id],outputs:['native.max-hp'],collect:(_a,c)=>[row('native.max-hp',c.input(key.id)*3)]}};}
 it('clamps roots before deriving; unknown upstream is removed before any downstream evaluation',()=>{
  const f=direct(provider());expect(f.runtime.stats.value(f.p.id,key.id)).toBe(4);
  expect(f.runtime.stats.hypotheticalValue(f.p.id,{},key.id,true,{baseValue:100})).toBe(0);
  const actual=f.runtime.stats.value(f.p.id,'native.max-hp');expect(f.runtime.stats.breakdown(f.p.id,'native.max-hp',{},true).value).toBe(actual-12);
  expect(f.runtime.stats.hypothetical(f.p.id,{},true)['native.max-hp']).toBe(actual-12);f.runtime.assertStats();
 });
 it('rejects missing roots, native backedges, attribute outputs and undeclared writes',()=>{
  for(const input of ['missing.rank','native.strength']){const p=provider();expect(()=>direct({...p,derived:{...p.derived!,inputs:[input]}})).toThrow();}
  const p=provider();expect(()=>direct({...p,derived:{...p.derived!,outputs:[key.id]}})).toThrow();
  expect(()=>direct({...p,derived:{...p.derived!,collect:()=>[row('native.strength',1)]}})).toThrow();
  expect(()=>direct({...p,collect:()=>[row(key.id,1,{conditions:[]})]})).toThrow();
 });
 it('is independent of provider installation order and retains collect reentry guard',()=>{
  const make=(reverse:boolean)=>{const p=new Player(4,4),r=new ExtensionRegistry(),first=module(provider()),second:ExtensionModule={id:'other-fixture',version:'1.0.0',initialState:()=>({}),validateState:isJson,statSources:{collect:()=>[row(key.id,-6,{sourceId:'other-fixture.rank',known:true})]}};
   for(const m of reverse?[second,first]:[first,second])r.register(m.id,m.version,()=>m);
   const runtime=new ExtensionRuntime(r,r.manifest([first.id,second.id]),{playerId:()=>p.id,depth:()=>1,randomInt:()=>{throw Error();},message:()=>undefined});runtime.attachCreature(p);return runtime.stats.value(p.id,'native.max-hp');};
  expect(make(false)).toBe(make(true));
 });
});

describe('P2 source dependency invalidation',()=>{
 it('invalidates cross-actor and absent component readers without flushing unrelated actors',()=>{
  const p=new Player(4,4),m=new Monster(5,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
  const calls=new Map<number,number>(),registry=new ExtensionRegistry();
  registry.register('stats-fixture','1.0.0',()=>({...module({collect(actor,c){
   calls.set(actor.id,(calls.get(actor.id)??0)+1);
   const source=c.getComponent(actor.player?m.id:actor.id,'bonus') as {value:number}|undefined;
   return source?[row('native.max-hp',source.value)]:[];
  }}),commands:{component(payload,c){const v=payload as {id:number;name:string;value:number};c.setComponent(v.id,v.name,{value:v.value});},remove(payload,c){c.removeComponent((payload as {id:number}).id,'bonus');},fail(payload,c){c.setComponent((payload as {id:number}).id,'bonus',{value:99});throw Error('component rollback');}}}));
  const runtime=new ExtensionRuntime(registry,registry.manifest(['stats-fixture']),{playerId:()=>p.id,depth:()=>1,randomInt:()=>0,message:()=>undefined});
  runtime.attachCreature(p);runtime.attachCreature(m);
  const command=(action:string,payload:object)=>runtime.command(JSON.stringify({module:'stats-fixture',action,payload}));
  const base=[p.maxHp,m.maxHp];calls.clear();
  runtime.collectComponents([p,m]);expect(calls.size).toBe(0);
  command('component',{id:p.id,name:'unread',value:8});
  expect(calls.size).toBe(0);
  command('component',{id:m.id,name:'bonus',value:3});
  expect([p.maxHp,m.maxHp]).toEqual(base.map(n=>n+3));
  expect(calls.has(p.id)&&calls.has(m.id)).toBe(true);
  const before=runtime.snapshot();
  expect(()=>command('fail',{id:m.id})).toThrow('component rollback');
  expect(runtime.snapshot()).toEqual(before);runtime.assertStats();
  command('remove',{id:m.id});expect([p.maxHp,m.maxHp]).toEqual(base);
 });
});

it('falls back to conservative invalidation when the component dependency table reaches its bound',()=>{
 const p=new Player(4,4),registry=new ExtensionRegistry();
 registry.register('stats-fixture','1.0.0',()=>({...module({collect(actor,c){
  for(let i=0;i<4100;i++)c.getComponent(actor.id,`probe${i}`);
  const bonus=c.getComponent(actor.id,'bonus') as {value:number}|undefined;
  return bonus?[row('native.max-hp',bonus.value)]:[];
 }}),commands:{component(_payload,c){c.setComponent(p.id,'bonus',{value:3});}}}));
 const runtime=new ExtensionRuntime(registry,registry.manifest(['stats-fixture']),{playerId:()=>p.id,depth:()=>1,randomInt:()=>0,message:()=>undefined});
 runtime.attachCreature(p);const base=p.maxHp;
 runtime.command(JSON.stringify({module:'stats-fixture',action:'component',payload:{}}));
 expect(p.maxHp).toBe(base+3);runtime.assertStats();
});

describe('P2 nested runtime captures',()=>{
 it('restores independent inner and outer savepoints while sharing immutable namespace facts',()=>{
  const f=direct();f.set([row('native.max-hp',2)]);
  const before=f.runtime.snapshot(),hp=f.p.maxHp;
  const outerState=(f.runtime as any).states['stats-fixture'];
  expect(()=>f.runtime.worldWorkTransaction(()=>{
   f.set([row('native.max-hp',5)]);
   const inner=f.runtime.snapshot(),innerState=(f.runtime as any).states['stats-fixture'];
   expect(()=>f.runtime.worldWorkTransaction(()=>{f.set([row('native.max-hp',9)]);throw Error('inner');})).toThrow('inner');
   expect(f.runtime.snapshot()).toEqual(inner);
   expect((f.runtime as any).states['stats-fixture']).toBe(innerState);
   f.runtime.assertStats();
   throw Error('outer');
  })).toThrow('outer');
  expect(f.runtime.snapshot()).toEqual(before);expect(f.p.maxHp).toBe(hp);
  expect((f.runtime as any).states['stats-fixture']).toBe(outerState);
  f.runtime.assertStats();
 });
});


describe('P2 component lifetime dependency regression',()=>{
 function fixture(derived=false){
  const p=new Player(4,4),m=new Monster(5,4,(monsters as MonsterData[]).find(m=>m.id==='rat')!);
  const registry=new ExtensionRegistry();let runtime:ExtensionRuntime;
  const collect:StatSourceProvider['collect']=(actor,c)=>{
   if(!actor.player)return [];
   const branch=c.getComponent(p.id,'branch') as {value:number}|undefined;
   const source=c.getComponent(m.id,branch?.value?'alternate':'bonus') as {value:number}|undefined;
   return source?[row('native.light',source.value),row('native.max-hp',source.value)]:[];
  };
  const provider:StatSourceProvider=derived?{collect:()=>[],derived:{inputs:[],outputs:['native.light','native.max-hp'],collect}}:{collect};
  registry.register('stats-fixture','1.0.0',()=>({...module(provider),commands:{write(payload,c){
   const v=payload as {id:number;name:string;value?:number;fail?:boolean};
   if(v.value===undefined)c.removeComponent(v.id,v.name);else c.setComponent(v.id,v.name,{value:v.value});
   // Populate both query and materialized caches inside the transaction before failure.
   if(v.fail){c.stats.value(p.id,'native.light');throw Error('dependency rollback');}
  }}}));
  runtime=new ExtensionRuntime(registry,registry.manifest(['stats-fixture']),{playerId:()=>p.id,depth:()=>1,randomInt:()=>0,message:()=>undefined});
  runtime.attachCreature(p);runtime.attachCreature(m);
  const base=p.maxHp;
  const write=(id:number,name:string,value?:number,fail=false)=>runtime.command(JSON.stringify({module:'stats-fixture',action:'write',payload:{id,name,value,fail}}));
  const check=(bonus:number)=>{expect(runtime.stats.value(p.id,'native.light')).toBe(1+bonus);expect(p.maxHp).toBe(base+bonus);runtime.assertStats();};
  return {p,m,runtime,write,check};
 }
 it.each([[false,false],[false,true],[true,false],[true,true]])('invalidates a surviving cross-actor reader after GC (unrelated write: %s, derived: %s)',(unrelated,derived)=>{
  const f=fixture(derived);f.write(f.m.id,'bonus',6);f.check(6);
  f.runtime.collectComponents([f.p]);expect(f.runtime.snapshot().components[f.m.id]).toBeUndefined();
  if(unrelated)f.write(f.p.id,'unread',1);
  f.check(0);
  // A later component at the same ID must not reuse the pre-GC module view.
  f.write(f.m.id,'bonus',4);f.check(4);f.write(f.m.id,'bonus');f.check(0);
  f.write(f.m.id,'bonus',2);f.runtime.collectComponents([f.p]);f.check(0);
 });
 it('retains absent and conditional cross-actor reads through create/delete/recreate and failed writes',()=>{
  const f=fixture();f.check(0);f.write(f.m.id,'bonus',6);f.check(6);
  f.write(f.p.id,'branch',1);f.check(0);f.write(f.m.id,'alternate',3);f.check(3);
  const before=f.runtime.snapshot();expect(()=>f.write(f.m.id,'alternate',9,true)).toThrow('dependency rollback');
  expect(f.runtime.snapshot()).toEqual(before);f.check(3);
  f.write(f.m.id,'alternate');f.check(0);f.write(f.m.id,'alternate',5);f.check(5);
  f.write(f.p.id,'branch',0);f.check(6);f.write(f.m.id,'bonus',2);f.check(2);
 });
 it('rebuilds cross-actor reads after nested and generation rollback',()=>{
  const f=fixture();f.write(f.m.id,'bonus',6);const before=f.runtime.snapshot();
  expect(()=>f.runtime.worldWorkTransaction(()=>{
   f.write(f.m.id,'bonus');f.check(0);
   expect(()=>f.runtime.worldWorkTransaction(()=>{f.write(f.m.id,'bonus',9);f.check(9);throw Error('inner');})).toThrow('inner');
   f.check(0);f.write(f.m.id,'bonus',3);f.check(3);throw Error('outer');
  })).toThrow('outer');
  expect(f.runtime.snapshot()).toEqual(before);f.check(6);
  const generation=f.runtime.beginGeneration('dependency rollback');f.write(f.m.id,'bonus',8);f.check(8);
  f.runtime.rollbackGeneration(generation);expect(f.runtime.snapshot()).toEqual(before);f.check(6);
  f.write(f.m.id,'bonus',4);f.check(4);
 });
 it.each(['collect','edible'])('restores retired reader bindings and dependency edges with the native transaction receipt (%s)',retirement=>{
  const f=fixture();f.write(f.m.id,'bonus',6);const before=f.runtime.snapshot(),hooks=f.p.extensionHooks;
  expect(()=>f.runtime.itemCommandTransaction(()=>{
   f.runtime.collectComponents([f.m]);throw Error('retired reader');
  })).toThrow('retired reader');
  expect(f.runtime.snapshot()).toEqual(before);expect(f.p.extensionHooks).toBe(hooks);
  f.write(f.m.id,'bonus',3);f.check(3);
  expect(()=>f.runtime.itemCommandTransaction(()=>{
   if(retirement==='collect')f.runtime.collectComponents([f.p]);else f.runtime.retireEdibleActor(f.m);
   f.check(0);throw Error('retired source');
  })).toThrow('retired source');
  f.check(3);f.write(f.m.id,'bonus',2);f.check(2);
 });
});
