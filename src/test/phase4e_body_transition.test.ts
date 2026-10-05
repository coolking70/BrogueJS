import { readCreatureBirth } from '../ext/birth';
import { afterEach, expect, it, vi } from 'vitest';
import { productionBodyScene, installProductionBody, startProductionGame, emptyProductionArena, PRODUCTION_BODY_ID } from './support/productionComposite';
import { auditFullObjectGraph, fullGenerationRoots } from './support/fullGenerationCheckpointOracle';
import * as catalog from '../ext/catalog';
import { registryFromDescriptors } from '../ext/descriptor';
import { extensionDataFingerprint } from '../ext/fingerprint';
import { validActiveBodyTransitions, type ActiveBodyTransition, type BodyTransitionRequest } from '../ext/bodyTransitions';
import { bodyTransitionHp } from '../engine/Movement/BodyTransition';
import { getNextEntityId } from '../entities/Creature';
import { Monster, MonsterState } from '../entities/Monster';
import { commitCompositeAnchors, footprintOf } from '../engine/Movement/CreatureSpatial';
import { TerrainType as T } from '../engine/Map/Grid';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import type { ExtensionModule } from '../ext/types';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });
const request = (sourceGroupId: number, reason: BodyTransitionRequest['reason'], formId = 'giants.fixture-core', count = reason === 'split' ? 2 : 1): BodyTransitionRequest => ({
  sourceGroupId, reason, results: Array.from({length:count},()=>({formId,memberMap:[]})), hp: reason === 'split' ? 'conserve' : ['clone','summon'].includes(reason) ? 'current' : 'ratio',
  statuses:'preserve',relationships:'preserve',placement:'nearest'
});
function installActive(reason: 'phase'|'split'|'clone'|'summon' = 'split', hook?: (module: ExtensionModule) => void) {
  installProductionBody();
  const installed = catalog.createExtensionRegistry(), descriptors = catalog.getInstalledModuleDescriptors();
  const base = installed.create(installed.manifest(['giants']))[0]!;
  const move: ActiveBodyTransition = { id:'giants.fixture-once',sourceFormId:'giants.fixture-core',condition:{kind:'hp-at-most',numerator:1,denominator:2},ticks:175,hpCost:3,
    transition:{...request(1,reason), results:request(1,reason).results} as ActiveBodyTransition['transition'] };
  // sourceGroupId belongs to the runtime request, never the module declaration.
  delete (move.transition as unknown as Record<string,unknown>).sourceGroupId;
  const module: ExtensionModule = {...base,bodyTransitions:[move]};
  hook?.(module);
  const rules={...base.rules!,fingerprint:extensionDataFingerprint({base:base.rules,transitions:module.bodyTransitions,forms:module.nativeForms,bodies:module.nativeBodies})};
  const registry=registryFromDescriptors(descriptors.map(d=>d.id==='giants'?{...d,rules,create:()=>({...module,rules})}:d));
  vi.mocked(catalog.createExtensionRegistry).mockReturnValue(registry);
  return {module,move};
}
function activeScene(reason: 'phase'|'split'|'clone'|'summon'='split', hook?: (module: ExtensionModule) => void, combat=false) {
  const installed=installActive(reason,hook),game=startProductionGame(combat?['giants','combat']:['giants']);emptyProductionArena(game);
  const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;core.state=MonsterState.HUNTING;core.hp=79;
  return {...installed,game,core};
}
it('finite active declarations reject scripts, regrow, invalid costs, quantity, HP policy, cross-owner and duplicate slot maps',()=>{
  const {module,move}=installActive();
  const valid=(v:unknown)=>validActiveBodyTransitions(v,'giants',module.nativeForms!,module.nativeBodies!.definitions);
  expect(valid([move])).toBe(true);
  for(const bad of [{...move,script:'run()'},{...move,ticks:0},{...move,hpCost:-1},{...move,id:'other.move'},
    {...move,condition:{...move.condition,denominator:0}}, {...move,transition:{...move.transition,reason:'regrow'}},
    {...move,transition:{...move.transition,hp:'ratio'}},{...move,transition:{...move.transition,results:[]}},
    {...move,transition:{...move.transition,results:[{formId:'rat',memberMap:[]}]}},
    {...move,transition:{...move.transition,results:[{formId:move.sourceFormId,memberMap:[{from:'leg00',to:'leg00'},{from:'leg00',to:'leg01'}]},{formId:move.sourceFormId,memberMap:[]}]}}]) expect(valid([bad])).toBe(false);
});
it('split HP is an exact positive partition including remainder and refuses healing/cap overflow',()=>{
  const r=request(1,'split');expect(bodyTransitionHp(r,79,160,[160,160])).toEqual([40,39]);
  expect(bodyTransitionHp(r,1,160,[160,160])).toBeNull();expect(bodyTransitionHp(r,79,160,[20,20])).toBeNull();
});
it.each(['clone','summon'] as const)('%s uses all fresh IDs, deeply detached local containers and remapped group/leader pointers without source rewards or spent moves',reason=>{
  const {game,core,actors,group}=productionBodyScene();core.hp=79;core.bodyTransitionHistory=['giants.colossus-fracture'];
  actors[1]!.leader=core;actors[1]!.addPoison(3,2);group.members[1]!.readyInTicks=37;
  const before=rng.getState(),next=getNextEntityId(),fact=game.transitionBody(request(core.id,reason));expect(fact.outcome).toBe('applied');
  const clone=game.monsters.find(m=>m.id===fact.resultGroupIds[0])!, copies=game.monsters.filter(m=>m.spatial?.bodyMember?.groupId===clone.id);
  expect(copies.map(m=>m.id)).toEqual(Array.from({length:9},(_,i)=>next+i));expect(core.hp).toBe(79);expect(clone.hp).toBe(79);expect(rng.getState()).toEqual(before);
  expect(copies.every(m=>m.bodyTransitionRewardless&&m.carriedItem===null&&m.goldDropChance===0&&m.itemDropChance===0)).toBe(true);
  for(const [i,copy] of copies.entries()){expect(copy.spatial).not.toBe(actors[i]!.spatial);expect(copy.statusDurations).not.toBe(actors[i]!.statusDurations);expect(copy.behaviorFlags).not.toBe(actors[i]!.behaviorFlags);expect(copy.bodyTransitionHistory).not.toBe(core.bodyTransitionHistory);}
  expect(copies[1]!.leader).toBe(clone);
  for (const [i,actor] of copies.entries()) expect(readCreatureBirth(actor)).toMatchObject({sourceId:actors[i]!.id,nativeStatsCopied:true});
  expect(game.bodyGroups!.find(g=>g.coreId===clone.id)!.members[1]!.readyInTicks).toBe(37);
  expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it.each((['phase','split','clone','summon'] as const).flatMap(reason=>(['hasted','slowed'] as const).map(status=>[reason,status] as const)))('%s clearing %s restores native speeds and preserves only the declared source state',(reason,status)=>{
  const {game,core,actors}=productionBodyScene(),speeds=actors.map(a=>[a.movementSpeed,a.attackSpeed]);core.hp=80;
  core.applyStatus(status,9);const altered=status==='hasted'?Math.floor(speeds[0]![0]!/2):speeds[0]![0]!*2;
  expect(core.movementSpeed).toBe(altered);
  const copy=reason==='clone'||reason==='summon',fact=game.transitionBody({...request(core.id,reason,copy?'giants.fixture-core':'giants.ridgeback'),statuses:'clear'});
  expect(fact.outcome).toBe('applied');
  const results=copy?game.monsters.filter(m=>m.spatial?.bodyMember?.groupId===fact.resultGroupIds[0]):fact.resultGroupIds.map(id=>game.monsters.find(m=>m.id===id)!);
  expect(results.map(a=>[a.movementSpeed,a.attackSpeed])).toEqual(copy?speeds:fact.resultGroupIds.map(()=>[100,100]));
  expect(results.every(a=>!a.hasStatus(status))).toBe(true);expect(core.hasStatus(status)).toBe(copy);
  if(copy)expect(core.movementSpeed).toBe(altered);expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('active clear publishes retained-actor status causality and relationship cleanup after structural replacement',()=>{
  const {game,core}=productionBodyScene();core.isAlly=true;core.dominated=true;core.addPoison(3,2);
  const status=vi.spyOn(core.extensionHooks!.causality,'clearStatus'),relation=vi.spyOn(core.extensionHooks!,'relationshipChanged');
  const fact=game.transitionBody({...request(core.id,'phase','giants.ridgeback'),statuses:'clear',relationships:'clear'});
  expect(fact.outcome).toBe('applied');expect(core.isAlly).toBe(false);expect(core.dominated).toBe(false);expect(core.hasStatus('poisoned')).toBe(false);
  expect(status).toHaveBeenCalledWith(core.id,'poisoned');expect(status).toHaveBeenCalledWith(core.id,'burning');
  expect(relation).toHaveBeenCalledTimes(1);expect(relation).toHaveBeenCalledWith(core);expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('one-to-three split keeps only the original core entitlement, exact total HP and reserves complete non-overlapping bodies',()=>{
  const {game,core}=productionBodyScene();core.hp=83;const id=core.id,next=getNextEntityId();
  const fact=game.transitionBody(request(id,'split','giants.fixture-core',3));expect(fact.outcome).toBe('applied');
  const cores=fact.resultGroupIds.map(id=>game.monsters.find(m=>m.id===id)!);expect(cores.map(m=>m.hp)).toEqual([28,28,27]);expect(cores[0]).toBe(core);
  expect(cores.slice(1).every(m=>m.bodyTransitionRewardless&&m.isClone)).toBe(true);
  expect(readCreatureBirth(cores[1]!)).toMatchObject({sourceId:id,nativeStatsCopied:false});expect(core.bodyTransitionRewardless).toBeUndefined();
  expect(getNextEntityId()).toBe(next+26);const cells=game.monsters.flatMap(a=>footprintOf(a)).map(p=>`${p.x},${p.y}`);expect(new Set(cells).size).toBe(cells.length);
  expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('a member map preserves explicit IDs across a reduced body, retires every omitted part without kill and cleans external incoming references',()=>{
  const {module}=installActive('phase',module=>{
    const body=structuredClone(module.nativeBodies!.definitions.find(b=>b.id===PRODUCTION_BODY_ID)!);
    body.id='giants.fixture-reduced';body.parts=[{...body.parts[0]!,formId:'giants.fixture-reduced-core'},body.parts[1]!,body.parts[2]!];body.constraints=body.constraints.slice(0,2);
    Object.assign(module,{nativeForms:[...module.nativeForms!,{...module.nativeForms!.find(f=>f.id==='giants.fixture-core')!,id:'giants.fixture-reduced-core',hp:80}]});
    Object.assign(module,{nativeBodies:{...module.nativeBodies!,definitions:[...module.nativeBodies!.definitions,body]}});
  });
  const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!,old=[...game.monsters],next=getNextEntityId();core.hp=80;
  const external=new Monster(30,10,{...core.snapshotForm(),id:'rat'});external.leader=old[3]!;external.carriedMonster=old[3]!;game.monsters.push(external);
  const death=vi.spyOn(game.extensionRuntime!,'captureDeath');const r=request(core.id,'phase','giants.fixture-reduced-core');
  (r.results[0] as unknown as {memberMap:{from:string;to:string}[]}).memberMap=[{from:'leg00',to:'leg00'},{from:'leg01',to:'leg01'}];
  expect(game.transitionBody(r).outcome).toBe('applied');expect(core.hp).toBe(40);expect(core.id).toBe(old[0]!.id);expect(game.monsters).toEqual([core,old[1],old[2],external]);
  expect(game.bodyGroups![0]!.members.map(m=>m.entityId)).toEqual(old.slice(0,3).map(m=>m.id));expect(getNextEntityId()).toBe(next+1);
  expect(external.carriedMonster).toBeNull();expect(external.leader).not.toBe(old[3]);expect(death).not.toHaveBeenCalled();
  expect(old.slice(3).every(m=>m.hp===0&&m.deathProcessed)).toBe(true);expect(module.nativeForms).toHaveLength(8);
  expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('group to rigid and rigid to group retain the principal ID and never revive retired members',()=>{
  const {game,core,actors}=productionBodyScene();const id=core.id;
  expect(game.transitionBody(request(id,'phase','giants.ridgeback')).outcome).toBe('applied');expect(core.id).toBe(id);expect(game.bodyGroups).toBeUndefined();
  expect(game.transitionBody(request(id,'phase','giants.fixture-core')).outcome).toBe('applied');expect(core.id).toBe(id);
  expect(game.monsters.slice(1).every(a=>!actors.includes(a))).toBe(true);expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
it('when any one result lacks space the entire batch preserves ID/HP/group/list/relations/RNG',()=>{
  const {game,core}=productionBodyScene();core.hp=80;
  for(let x=0;x<game.grid.width;x++)for(let y=0;y<game.grid.height;y++)game.grid.setTerrain(x,y,T.WALL);
  for(const p of game.monsters.flatMap(a=>footprintOf(a)))game.grid.setTerrain(p.x,p.y,T.FLOOR);
  const audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]),random=rng.getState(),next=getNextEntityId();
  expect(game.transitionBody(request(core.id,'split')).outcome).toBe('no-space');expect(audit.differences()).toEqual([]);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(next);
});
it.each(['entities','cells'] as const)('the activity-layer %s budget rejects all results before allocating IDs',kind=>{
  const {game,core}=productionBodyScene();core.hp=80;
  const form=game.extensionRuntime!.nativeForms().find(f=>f.id==='giants.abyssal-colossus')!;
  // Budget-only stress fixture: off-map diagnostic entities are not published
  // through the production constructor, and cannot masquerade as a valid save.
  const extra=kind==='entities'?120:56;
  for(let i=0;i<extra;i++){const m=new Monster(40+i%20,15+Math.floor(i/20),{...core.snapshotForm(),id:kind==='entities'?'giants.fixture-leg':form.id});m.spatial={schema:1,footprintId:kind==='entities'?'giants.fixture-leg':'builtin:square-3',pose:'r0'};game.monsters.push(m);}
  const before=getNextEntityId();expect(game.transitionBody(request(core.id,'split')).outcome).toBe('budget');expect(getNextEntityId()).toBe(before);expect(core.hp).toBe(80);
});
it.each(['phase','split','clone','summon'] as const)('active %s pays once on failure, establishes positive ticks and never retries on another tick',reason=>{
  const {game,core}=activeScene(reason);
  for(let x=0;x<game.grid.width;x++)for(let y=0;y<game.grid.height;y++)game.grid.setTerrain(x,y,T.WALL);
  const next=getNextEntityId();expect((game as any).tryActiveBodyTransition(core)).toBe(true);expect(core.hp).toBe(76);expect(core.ticksUntilTurn).toBeGreaterThanOrEqual(175);
  expect(core.bodyTransitionHistory).toEqual(['giants.fixture-once']);expect((game as any).tryActiveBodyTransition(core)).toBe(false);expect(getNextEntityId()).toBe(next);
});
it.each(['birth','fact','environment','message'] as const)('active transaction restores fees, full graph, source revisions, IDs, groups, facts, messages and both RNG on %s fault',fault=>{
  let fail=false;const {game,core}=activeScene('split',m=>{
    const old=m.hooks;m.hooks={...old,creatureSpawned(event,c){old?.creatureSpawned?.(event,c);if(fail&&fault==='birth')throw new Error('injected transition fault');},bodyTransition(event,c){old?.bodyTransition?.(event,c);if(fail&&fault==='fact'){c.message('buffered');rng.randRange(0,9);throw new Error('injected transition fault');}}};
  });
  if(fault==='environment')vi.spyOn(game as any,'applyEnvironmentalEffects').mockImplementation(()=>{game.grid.setTerrain(3,3,T.WALL);rng.randRange(0,9);throw new Error('injected transition fault');});
  if(fault==='message')vi.spyOn(logger,'log').mockImplementation(()=>{throw new Error('injected transition fault');});
  if(fault==='message') {const runtime=game.extensionRuntime!;const emit=runtime.emit.bind(runtime);vi.spyOn(runtime,'emit').mockImplementation((name,event)=>{emit(name,event);if(name==='bodyTransition')logger.log('buffered');});}
  const originalKeys=Reflect.ownKeys(game);const audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]),ext=game.extensionRuntime!.snapshot(),random=rng.getState(),next=getNextEntityId();fail=true;
  expect(()=>(game as any).tryActiveBodyTransition(core)).toThrow('injected transition fault');expect(Reflect.ownKeys(game)).toEqual(originalKeys);expect(audit.differences()).toEqual([]);expect(game.extensionRuntime!.snapshot()).toEqual(ext);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(next);expect(core.bodyTransitionHistory).toBeUndefined();
});
it('spent declaration and reward-right bad saves are rejected without replacing the running world',()=>{
  const {game,core}=activeScene('clone');expect((game as any).tryActiveBodyTransition(core)).toBe(true);
  const save=game.toSaveSnapshot();expect(game.loadSnapshot(save)).toBe(true);
  for(const history of [[],['giants.fixture-once','giants.fixture-once'],['giants.uninstalled']]){const bad=structuredClone(save);bad.monsters[0]!.bodyTransitionHistory=history;expect(game.loadSnapshot(bad)).toBe(false);}
  const bad=structuredClone(save);(bad.monsters[0] as unknown as Record<string,unknown>).bodyTransitionRewardless=false;expect(game.loadSnapshot(bad)).toBe(false);
});
it('all descendants inherit the once-only receipt and cannot repeat their source summon',()=>{
  const {game,core}=activeScene('summon');expect((game as any).tryActiveBodyTransition(core)).toBe(true);
  const roots=game.bodyGroups!.map(g=>game.monsters.find(m=>m.id===g.coreId)!);expect(roots).toHaveLength(2);
  for(const actor of roots){expect(actor.bodyTransitionHistory).toEqual(['giants.fixture-once']);expect((game as any).tryActiveBodyTransition(actor)).toBe(false);}
});
it('repeated whole copies stop at the activity-layer budget without a partial group or duplicated ID',()=>{
  const {game,core}=productionBodyScene();let outcome='applied',attempts=0;
  for(;attempts<20&&outcome==='applied';attempts++)outcome=game.transitionBody(request(core.id,'clone')).outcome;
  expect(outcome).toBe('budget');expect(game.monsters.length).toBeLessThanOrEqual(128);expect(new Set(game.monsters.map(m=>m.id)).size).toBe(game.monsters.length);
  expect(game.bodyGroups!.every(g=>g.members.every(m=>game.monsters.some(actor=>actor.id===m.entityId)))).toBe(true);
});
it('dynamic terrain changes during required sampling fail revision verification and roll back the complete graph/RNG',()=>{
  const {game,core}=productionBodyScene(),random=rng.getState(),next=getNextEntityId(),audit=auditFullObjectGraph(fullGenerationRoots(game),[game.extensionRuntime!]);
  const original=rng.randRange.bind(rng);vi.spyOn(rng,'randRange').mockImplementation((min,max)=>{game.grid.setTerrain(3,3,T.WALL);return original(min,max);});
  expect(()=>game.transitionBody({...request(core.id,'clone'),placement:'random-nearest'})).toThrow('Stale body transition revision');
  expect(audit.differences()).toEqual([]);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(next);
});
it('same-body phases cannot regenerate broken parts while a copy retains the removed-slot history',()=>{
  const {game,core,actors}=productionBodyScene();actors[1]!.hp=0;game.killMonster(actors[1]!);
  expect(()=>game.transitionBody(request(core.id,'phase'))).toThrow('Same-body regeneration is not open');
  const fact=game.transitionBody(request(core.id,'clone'));expect(fact.outcome).toBe('applied');
  const group=game.bodyGroups!.find(g=>g.coreId===fact.resultGroupIds[0])!;expect(group.members[1]).toMatchObject({life:'removed',entityId:null});
});
it('innate active shape replacement can change an inanimate form without weakening incoming CE polymorph qualification',()=>{
  const {game,core}=productionBodyScene();core.behaviorFlags.add('MONST_INANIMATE');core.behaviorFlags.add('MONST_TURRET');core.behaviorFlags.add('MONST_INVULNERABLE');
  expect((game as any).polymorphBoltTarget(core)).toBe(false);
  expect(game.transitionBody(request(core.id,'phase','giants.ridgeback')).outcome).toBe('applied');expect(core.typeId).toBe('giants.ridgeback');
});

it('copy placement uses real part labels after a removed slot, including heterogeneous tether constraints',()=>{
  const data=installProductionBody();Object.assign(data.definition.constraints.find(edge=>edge.childPartId==='leg06')!,{maxDistance:1});
  const game=startProductionGame();emptyProductionArena(game);const core=game.createCompositeMonster(PRODUCTION_BODY_ID,{x:14,y:12})!;
  const group=game.bodyGroups![0]!,last=game.monsters.find(m=>m.spatial?.bodyMember?.partId==='leg07')!,removed=game.monsters.find(m=>m.spatial?.bodyMember?.partId==='leg06')!;
  commitCompositeAnchors(game.monsters.map(creature=>({creature,at:creature===last?{x:core.x-3,y:core.y}:{...creature.loc}})));
  removed.hp=0;game.killMonster(removed);const clone=game.cloneMonster(core)!;expect(clone).not.toBeNull();
  const cg=game.bodyGroups!.find(g=>g.coreId===clone.id)!;expect(cg.members.find(s=>s.partId==='leg06')).toMatchObject({life:'removed',entityId:null});
  const tail=game.monsters.find(m=>m.id===cg.members.find(s=>s.partId==='leg07')!.entityId)!;
  expect({x:tail.x-clone.x,y:tail.y-clone.y}).toEqual({x:last.x-core.x,y:last.y-core.y});expect(cg.appliedBreaks).toEqual(group.appliedBreaks);
  expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
});
