import { describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import { Creature, getNextEntityId, restoreNextEntityId, allocateEntityId } from '../entities/Creature';
import { rng, RNGType } from '../engine/Random';
import type { CombatEventPayload, ExtensionContext, ExtensionModule, Json, OptionalActorQueryContext } from '../ext/types';
import { resolveActorQueryScope } from '../ext/actorQuery';
import { Monster } from '../entities/Monster';
import { checkpointOwnedMonsterLists, ownedMonsterList, squareListUsers } from '../engine/Core/MonsterLifecycle';
import { checkpointGenerationWorld } from '../engine/Core/GenerationCoordinator';
import { CreatureSpatial, checkpointSpatialActorRevisions, commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { checkpointSpatialTerrain } from '../engine/Movement/SpatialRevision';
import { Grid, TerrainType } from '../engine/Map/Grid';
import type { PartBreakPrepareContext, PartBreakRequest } from '../ext/partBreak';
const payload:CombatEventPayload={eventKind:'rest-completed',actionId:1,sourceSubactionId:null,segmentIndex:null,resolutionId:null,bonfireId:9,visit:1,hitCount:0,hpLost:0};
const module=(id:string,extra:Partial<ExtensionModule>={}):ExtensionModule=>({id,version:'1.0.0',initialState:()=>({count:0}),validateState:(v):v is Json=>!!v&&typeof v==='object',...extra});
function setup(modules:ExtensionModule[],overrides:Partial<ExtensionPorts>={}) {
 const actor=new Creature(1,1,'fixture','r',1),registry=new ExtensionRegistry(),native={value:0},message=vi.fn();
 for(const entry of modules)registry.register(entry.id,entry.version,()=>entry);
 const ports:ExtensionPorts={depth:()=>1,turn:()=>4,playerId:()=>actor.id,randomInt:(a,b)=>rng.randRange(a,b),message,
 actorQueryScope:c=>c===actor?{depth:1,partId:null,generation:null}:null,
 checkpointRandom:()=>{const state=rng.getState();return()=>rng.setState(state);},
 checkpointCommittedFacts:()=>{const value=native.value;return()=>{native.value=value;};},...overrides};
 const runtime=new ExtensionRuntime(registry,registry.manifest(modules.map(m=>m.id)),ports);runtime.attachCreature(actor,false);
 return {actor,registry,runtime,native,message};
}
describe('3g trusted actor query and committed fact transaction',()=>{
 it('has no provider fallback writes, rejects forged same-id references, and revokes component scope',()=>{
  let held:OptionalActorQueryContext|undefined;
  const provider=module('provider',{componentValidators:{value:()=>true},onNewGame:ctx=>ctx.setComponent(ctx.playerId,'value',{amount:3}),optionalActorQueries:{'growth.combat-stats.v1':{
   accepts:input=>input===null,query:(_input,ctx)=>{held=ctx;expect(Object.isFrozen(ctx.actor)).toBe(true);expect(ctx.getActorComponent('value')).toEqual({amount:3});return {nested:{value:3}};},validate:(v):v is Json=>!!v}}});
  const {runtime,actor}=setup([provider]);runtime.newGame();const before=runtime.snapshot();
  expect(runtime.queryOptionalActor('missing.stats.v1',actor,null)).toEqual({status:'unavailable',reason:'absent'});
  expect(runtime.queryOptionalActor('growth.combat-stats.v1',actor,'no')).toEqual({status:'unavailable',reason:'unsupported-input'});
  const result=runtime.queryOptionalActor('growth.combat-stats.v1',actor,null);
  expect(Object.isFrozen(result)).toBe(true);if(result.status==='available')expect(Object.isFrozen((result.value as any).nested)).toBe(true);
  expect(()=>held!.getActorComponent('value')).toThrow('Closed');
  const forged=Object.create(Object.getPrototypeOf(actor));Object.assign(forged,actor);
  expect(()=>runtime.queryOptionalActor('growth.combat-stats.v1',forged,null)).toThrow('Untrusted');
  expect(runtime.snapshot()).toEqual(before);
 });
 it.each([Infinity,NaN,undefined])('rejects illegal provider result %s instead of masking absence',bad=>{
  const {runtime,actor}=setup([module('provider',{optionalActorQueries:{'growth.combat-stats.v1':{accepts:()=>true,query:()=>({bad}) as any,validate:(_v):_v is Json=>true}}})]);
  expect(()=>runtime.queryOptionalActor('growth.combat-stats.v1',actor,null)).toThrow('Invalid actor query result');
 });
 it('sorts multiple consumers by stable module ID and reserves disjoint ranges under one root',()=>{
  const run=(reverse:boolean)=>{
   const seen:unknown[]=[];
   const modules=['zeta','alpha'].map(id=>module(id,{committedFacts:{'combat.event.v1':{maxDerivedFacts:2,
    prepare:(fact,allocation)=>{seen.push([id,fact.factId,allocation.firstDerivedFactId]);return fact.factId;},
    commit:(_plan,ctx)=>ctx.setState({count:1})}}}));
   const {runtime,actor}=setup(reverse?modules.reverse():modules);runtime.withCommittedFacts(()=>runtime.commitCombatEvent(actor,payload));
   return {seen,snapshot:runtime.snapshot()};
  };
  const a=run(false),b=run(true);expect(a.seen).toEqual([['alpha',1,2],['zeta',1,4]]);expect(a.seen).toEqual(b.seen);
  expect(a.snapshot.foundation.nextFactId).toBe(6);expect(a.snapshot.modules).toEqual(b.snapshot.modules);
 });
 it('rolls back native values, states, root/ranges, buffered messages, IDs and both RNG streams after later consumer failure',()=>{
  const {runtime,actor,native,message}=setup([
   module('alpha',{committedFacts:{'combat.event.v1':{maxDerivedFacts:2,prepare:()=>null,commit:(_p,c)=>{c.setState({count:1});c.message('not committed');c.randomInt(1,50);}}}}),
   module('zeta',{committedFacts:{'combat.event.v1':{maxDerivedFacts:1,prepare:()=>null,commit:()=>{throw new Error('injected');}}}}),
  ]);
  const before=runtime.snapshot(),random=rng.getState(),next=getNextEntityId();
  expect(()=>runtime.withCommittedFacts(()=>{native.value=8;allocateEntityId();rng.setRNG(RNGType.RNG_SUBSTANTIVE);rng.randRange(1,20);
   rng.setRNG(RNGType.RNG_COSMETIC);rng.randRange(1,20);runtime.commitCombatEvent(actor,payload);})).toThrow('injected');
  expect(native.value).toBe(0);expect(runtime.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(next);expect(message).not.toHaveBeenCalled();
 });
 it('bounds shared root allocation before invoking any consumer and rejects publication outside transaction',()=>{
  const prepare=vi.fn();const {runtime,actor}=setup(['alpha','zeta'].map(id=>module(id,{committedFacts:{'combat.event.v1':{maxDerivedFacts:2048,prepare,commit:()=>{}}}})));
  const before=runtime.snapshot();expect(()=>runtime.commitCombatEvent(actor,payload)).toThrow('outside');
  expect(()=>runtime.withCommittedFacts(()=>runtime.commitCombatEvent(actor,payload))).toThrow('budget');expect(prepare).not.toHaveBeenCalled();expect(runtime.snapshot()).toEqual(before);
 });
 it('does not allocate IDs without a subscribed consumer or after snapshot reload',()=>{
  const {runtime,actor}=setup([]);runtime.withCommittedFacts(()=>runtime.commitCombatEvent(actor,payload));expect(runtime.snapshot().foundation.nextFactId).toBe(1);
  const commit=vi.fn();const other=setup([module('consumer',{committedFacts:{'combat.event.v1':{maxDerivedFacts:0,prepare:()=>null,commit}}})]);
  other.runtime.withCommittedFacts(()=>other.runtime.commitCombatEvent(other.actor,payload));const snapshot=other.runtime.snapshot();
  new ExtensionRuntime(other.registry,snapshot.manifest,{depth:()=>1,playerId:()=>other.actor.id,randomInt:()=>1,message:()=>{}},snapshot);
  expect(commit).toHaveBeenCalledTimes(1);
 });
 it('candidate scope verifies cached depth and group ownership rather than trusting matching numeric IDs',()=>{
  const core=new Creature(1,1,'core','c',1),leg=new Creature(2,1,'leg','l',1);
  const world={depth:1,player:core,levels:[{depth:2,actors:[leg]}]};
  expect(resolveActorQueryScope(world,leg)).toEqual({depth:2,partId:null,generation:null});
  leg.spatial={schema:1,footprintId:'native.single',pose:'r0',bodyMember:{groupId:core.id,partId:'leg'}};
  expect(resolveActorQueryScope(world,leg)).toBeNull();
  restoreNextEntityId(getNextEntityId());
 });
 it('detaches transaction-born actors and allows a fresh spawn notification after rollback',()=>{
  const spawned=vi.fn();
  const {runtime,actor}=setup([module('consumer',{hooks:{creatureSpawned:spawned},committedFacts:{'combat.event.v1':{
   maxDerivedFacts:0,prepare:()=>null,commit:()=>{throw new Error('consumer failed');}}}})]);
  const before=runtime.snapshot(),next=getNextEntityId();let newborn:Creature|undefined;
  expect(()=>runtime.withCommittedFacts(()=>{
   newborn=new Creature(2,1,'born','b',1);runtime.attachCreature(newborn);runtime.commitCombatEvent(actor,payload);
  })).toThrow('consumer failed');
  expect(newborn!.extensionHooks).toBeUndefined();expect(getNextEntityId()).toBe(next);expect(runtime.snapshot()).toEqual(before);
  expect(spawned).toHaveBeenCalledTimes(1);
  runtime.attachCreature(newborn!);expect(newborn!.extensionHooks).toBeDefined();expect(spawned).toHaveBeenCalledTimes(2);
 });
 it('retains trusted source part and generation when native resolution retires the actor',()=>{
  const prepare=vi.fn((fact:unknown)=>fact);
  const {runtime,actor}=setup([module('consumer',{committedFacts:{'combat.event.v1':{maxDerivedFacts:0,prepare,commit:()=>{}}}})],{
   actorQueryScope:source=>source.hp>0?{depth:3,partId:'leg',generation:7}:null,
  });
  runtime.withCommittedFacts(()=>{actor.hp=0;runtime.commitCombatEvent(actor,{...payload,eventKind:'attack-resolved',sourceSubactionId:1,segmentIndex:0});});
  expect(prepare).toHaveBeenCalledTimes(1);expect(prepare.mock.calls[0]![0]).toMatchObject({depth:3,
   actor:{entityId:actor.id,partId:'leg',generation:7},eventKind:'attack-resolved'});
 });
 it('bounds the sum of derived ranges across every event in one native transaction',()=>{
  const {runtime,actor,native}=setup([module('consumer',{committedFacts:{'combat.event.v1':{maxDerivedFacts:2047,
   prepare:()=>null,commit:(_p,context)=>context.setState({count:1})}}})]);
  const before=runtime.snapshot();
  expect(()=>runtime.withCommittedFacts(()=>{native.value=9;for(let n=0;n<3;n++)runtime.commitCombatEvent(actor,{...payload,actionId:n+1});})).toThrow('budget');
  expect(native.value).toBe(0);expect(runtime.snapshot()).toEqual(before);
 });
 it('resolves carried actors through native ownership while preferring direct cached-level placement',()=>{
  const player=new Creature(1,1,'player','p',1),carrier=Object.assign(Object.create(Monster.prototype),new Creature(2,1,'carrier','c',1)) as Monster;
  const passenger=Object.assign(Object.create(Monster.prototype),new Creature(3,1,'passenger','p',1)) as Monster;
  carrier.carriedMonster=passenger;passenger.leader=carrier;
  const world={depth:1,player,levels:[{depth:2,actors:[carrier]}]};
  expect(resolveActorQueryScope(world,passenger)).toEqual({depth:2,partId:null,generation:null});
  expect(resolveActorQueryScope({...world,levels:[...world.levels,{depth:3,actors:[passenger]}]},passenger)).toEqual({depth:3,partId:null,generation:null});
  const forged=Object.assign(Object.create(Monster.prototype),passenger) as Monster;
  expect(resolveActorQueryScope(world,forged)).toBeNull();
 });
 it('restores owned-list square counters and their future mutation closure after graph rollback',()=>{
  const square=Object.assign(Object.create(Monster.prototype),new Creature(2,1,'square','s',1)) as Monster;
  square.spatial={schema:1,footprintId:'builtin:square-2',pose:'r0'};
  const owner={monsters:[] as Monster[],dormantMonsters:[] as Monster[],killMonster:()=>{}};
  owner.monsters=ownedMonsterList([square],owner);const list=owner.monsters;
  const restoreLists=checkpointOwnedMonsterLists([list]),restoreGraph=checkpointGenerationWorld(()=>({shallow:[],deep:[list],references:[square]}));
  list.splice(0,1);expect(squareListUsers(list)).toBe(0);
  restoreGraph();restoreLists();expect(list).toEqual([square]);expect(squareListUsers(list)).toBe(1);
  list.splice(0,1);expect(squareListUsers(list)).toBe(0);
  list.push(square);expect(squareListUsers(list)).toBe(1);
 });
 it('restores disposed spatial listeners, terrain subscriptions and live invalidation after rollback',()=>{
  const actor=new Creature(1,1,'square','s',1);actor.spatial={schema:1,footprintId:'builtin:square-2',pose:'r0'};
  const grid=new Grid(8,8),spatial=new CreatureSpatial({grid,monsters:[actor]});
  expect(spatial.creatureAtCell({x:1,y:1})).toBe(actor);const terrain=spatial.terrainRevision;
  const restoreActors=checkpointSpatialActorRevisions([actor]),restoreTerrain=checkpointSpatialTerrain([grid]);
  const restoreGraph=checkpointGenerationWorld(()=>({shallow:[],deep:[actor,grid,spatial]}));
  spatial.dispose();grid.getCell(0,0)!.layers[0]=TerrainType.FLOOR;grid.getCell(0,0)!.refreshTerrainProperties();
  restoreGraph();restoreTerrain();restoreActors();expect(spatial.terrainRevision).toBe(terrain);
  commitCreatureAnchor(actor,{x:2,y:2});
  expect(spatial.creatureAtCell({x:1,y:1})).toBeUndefined();expect(spatial.creatureAtCell({x:3,y:3})).toBe(actor);
  grid.getCell(0,0)!.layers[0]=TerrainType.FLOOR;grid.getCell(0,0)!.refreshTerrainProperties();
  expect(spatial.terrainRevision).toBe(terrain+1);spatial.dispose();
 });
 it('keeps registered consumer ranges and handlers immutable during another preparation',()=>{
  const seen:number[]=[];const commit=vi.fn();
  const victim={maxDerivedFacts:2,prepare:(_fact:unknown,allocation:{firstDerivedFactId:number})=>{seen.push(allocation.firstDerivedFactId);return null;},commit};
  const {runtime,actor}=setup([
   module('zeta',{committedFacts:{'combat.event.v1':victim}}),
   module('alpha',{committedFacts:{'combat.event.v1':{maxDerivedFacts:2,prepare:()=>{victim.maxDerivedFacts=4000;victim.commit=vi.fn();return null;},commit:()=>{}}}}),
  ]);
  runtime.withCommittedFacts(()=>runtime.commitCombatEvent(actor,payload));
  expect(seen).toEqual([4]);expect(commit).toHaveBeenCalledTimes(1);expect(runtime.snapshot().foundation.nextFactId).toBe(6);
 });
 it('prevents a consumer preparation from using a still-open enclosing command mutation context',()=>{
  let context:ExtensionContext|undefined;let run:()=>void;
  const {runtime,actor}=setup([module('consumer',{
   commands:{emit:(_payload,current)=>{context=current;run();}},
   committedFacts:{'combat.event.v1':{maxDerivedFacts:0,prepare:()=>{context!.setState({count:99});return null;},commit:()=>{}}},
  })]);
  run=()=>runtime.withCommittedFacts(()=>runtime.commitCombatEvent(actor,payload));const before=runtime.snapshot();
  expect(()=>runtime.command(JSON.stringify({module:'consumer',action:'emit',payload:null}))).toThrow('mutation outside');
  expect(runtime.snapshot()).toEqual(before);
 });
 it.each(['prepare','commit'] as const)('rejects async consumer %s and revokes continuation capabilities',async phase=>{
  let lateError:unknown;
  const {runtime,actor,native}=setup([module('consumer',{committedFacts:{'combat.event.v1':{
   maxDerivedFacts:1,
   prepare:phase==='prepare'?async(_fact,_allocation,context)=>{await Promise.resolve();try{context.queryOptional('missing.v1',null);}catch(error){lateError=error;}return null;}:()=>null,
   commit:phase==='commit'?async(_plan,context)=>{context.setState({count:1});await Promise.resolve();try{context.setState({count:2});}catch(error){lateError=error;}}:()=>{},
  }}})]);
  const before=runtime.snapshot();
  expect(()=>runtime.withCommittedFacts(()=>{native.value=4;runtime.commitCombatEvent(actor,payload);})).toThrow('Async extension handlers');
  await Promise.resolve();await Promise.resolve();
  expect(lateError).toBeInstanceOf(Error);expect(native.value).toBe(0);expect(runtime.snapshot()).toEqual(before);
 });
 it('binds part-break actor queries to the attested source and revokes them after preparation',()=>{
  let held:PartBreakPrepareContext|undefined;let queried:number|undefined;
  const {runtime,actor}=setup([
   module('growth',{optionalActorQueries:{'growth.combat-stats.v1':{accepts:()=>true,query:(_input,context)=>{
    queried=context.actor.id;return {actorId:context.actor.id};},validate:(value):value is Json=>!!value}}}),
   module('breaker',{optionalPartBreaks:{'combat.part-break.v1':{prepare:(request,context)=>{
    held=context;expect(context.queryActor!('growth.combat-stats.v1',{actorId:request.actorId+999})).toEqual({status:'available',value:{actorId:request.actorId}});
    return {status:'unsupported',reason:'disabled'};},commit:()=>{}}}}),
  ]);
  const request:PartBreakRequest={schema:1,resolutionId:1,actorId:actor.id,sourceId:null,groupId:actor.id,partId:'self',zoneId:'shell',generation:0,balanceLoss:1,fallbackStunTicks:1};
  runtime.commitPartBreak(request,{apply:()=>1,rollback:()=>{}});
  expect(queried).toBe(actor.id);expect(()=>held!.queryActor!('growth.combat-stats.v1',null)).toThrow('Expired');
 });
 it.each(['absent','nested'] as const)('enforces synchronous native work on the %s transaction fast path',mode=>{
  const {runtime,actor}=setup(mode==='absent'?[]:[module('consumer',{committedFacts:{'combat.event.v1':{
   maxDerivedFacts:0,prepare:()=>null,commit:()=>{},
  }}})]);
  const before=runtime.snapshot();
  const work=mode==='absent'?()=>runtime.withCommittedFacts(()=>Promise.resolve(null)):()=>runtime.withCommittedFacts(()=>{
   runtime.withCommittedFacts(()=>Promise.resolve(null));runtime.commitCombatEvent(actor,payload);
  });
  expect(work).toThrow('Async extension handlers');expect(runtime.snapshot()).toEqual(before);
 });
 it('filters declared event kinds before allocating queues, ranges or native checkpoints',()=>{
  const prepare=vi.fn(()=>null),checkpoint=vi.fn(()=>()=>{});
  const {runtime,actor}=setup([module('consumer',{committedFacts:{'combat.event.v1':{eventKinds:['rest-completed'],maxDerivedFacts:0,prepare,commit:()=>{}}}})]);
  const original=(runtime as any).ports.checkpointCommittedFacts;(runtime as any).ports.checkpointCommittedFacts=checkpoint;
  const before=runtime.snapshot();
  runtime.withCommittedFacts(()=>runtime.commitCombatEvent(actor,{...payload,eventKind:'staggered',actionId:0,bonfireId:null,visit:null}),['staggered']);
  expect(checkpoint).not.toHaveBeenCalled();expect(prepare).not.toHaveBeenCalled();expect(runtime.snapshot()).toEqual(before);
  (runtime as any).ports.checkpointCommittedFacts=original;
  runtime.withCommittedFacts(()=>runtime.commitCombatEvent(actor,payload),['rest-completed']);expect(prepare).toHaveBeenCalledTimes(1);
 });

 it('rejects prior foundation manifest and snapshot versions without migration',()=>{
  const {runtime,registry,actor}=setup([]),snapshot=runtime.snapshot();
  expect(()=>registry.create({...snapshot.manifest,foundation:4} as any)).toThrow('mismatch');
  const stale=structuredClone(snapshot);(stale.foundation as any).version=4;
  expect(()=>new ExtensionRuntime(registry,snapshot.manifest,{depth:()=>1,playerId:()=>actor.id,randomInt:()=>1,message:()=>{}},stale)).toThrow();
  expect(runtime.snapshot()).toEqual(snapshot);
 });

});
