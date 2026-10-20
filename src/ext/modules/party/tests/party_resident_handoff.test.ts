import { expect, it, vi } from 'vitest';
import { createConfiguredWorldHarness } from '../../../testing/configuredWorldHarness';
import { residentScene } from '../../settlement/tests/residentHelpers';
import { residentRecord, residentComponent, candidateSource, transactResidentWorld } from '../../../../engine/Core/ResidentWorld';
import { commitPartyResidentRelease, preparePartyResidentRelease, applyPartyResidentNutrition } from '../../../../engine/Core/PartyResident';
import { ControlledActor } from '../../../../entities/ControlledActor';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { current, build, base, travelScenes } from '../../settlement/tests/helpers';
import { assign } from '../../settlement/tests/residentJobHelpers';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { logger } from '../../../../engine/Systems/Logger';
import { Game } from '../../../../engine/Core/Game';
import { isPartyMember } from '../../../../engine/Core/PartyActorIdentity';
import { Monster, MonsterState } from '../../../../entities/Monster';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import monsterCatalog from '../../../../data/monsters.json';
import { retireStationedResident } from '../../../../engine/Core/PartyResident';
import { hasInteractionLine } from '../../../worldSpatial';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { advanceWorldClock } from '../../../world5';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { commitCreatureAnchor } from '../../../../engine/Movement/CreatureSpatial';
import type { GameSnapshot } from '../../../../engine/Core/WholeRunSnapshot';
import * as structureProduction from '../../../../engine/Core/StructureProduction';

function prepared(){
  const scene=residentScene(['party','settlement'],false,(options,config)=>
    createConfiguredWorldHarness(options,{...config,party:{schema:1,members:1}}));
  scene.g.player.loc={x:19,y:13};scene.a.loc={x:20,y:13};
  scene.g.refreshStructureDerivedState();return scene;
}
function roster(g:Game,id:number,operation:'join'|'station',campId:number|null=null){
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,
    issuerSlot:'local:0',actorId:g.player.id,targetId:id,operation,campId,level:{kind:'dungeon',depth:g.depth}});
}
function ready(g:Game){
  for(let n=0;n<40&&g.activeControlledActors.some(a=>a.ticksUntilTurn>0);n++){
    while(logger.pendingAcknowledgment)logger.acknowledgeNext();
    g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);
  }
  expect(g.activeControlledActors.every(a=>a.ticksUntilTurn===0)).toBe(true);
}
function capture(g:Game,id:number,name:string){
  const directory=process.env.PARTY_P1D_RESIDENT_CAPTURE;if(!directory)return;
  mkdirSync(directory,{recursive:true});
  writeFileSync(join(directory,`${name}.json`),JSON.stringify({schema:1,kind:'diagnostic-origin',
    targetId:id,campId:current(g).regionId,snapshot:g.toSnapshot()})+'\n');
}
function diagnostic(g:Game):GameSnapshot{
  const snapshot=g.toSnapshot();delete snapshot.run.recordingOrigin;return snapshot;
}
function travelStationedHome(g:Game,depth:number){
  ready(g);
  const stairs=(g as any).levelSeeds[g.depth-1][depth>g.depth?'downStairsLoc':'upStairsLoc'];
  // Diagnostic placement at a real staircase; the production party command
  // performs all departure, cache, generation and arrival lifecycle work.
  commitCreatureAnchor(g.player,stairs);g.refreshStructureDerivedState();
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,
    issuerSlot:'local:0',actorId:g.player.id,change:{kind:'travel-party',destination:{kind:'dungeon',depth},leavingBehind:[]}});
  expect(g.depth).toBe(depth);
}

it('stationed home stays authoritative across public travel, offline ration settlement, return and diagnostic loads',()=>{
  travelScenes();const {g,a}=prepared(),id=a.id,home=current(g);
  roster(g,id,'join');ready(g);roster(g,id,'station',home.regionId);
  const actor=g.party!.stationed.get(id)!,hp=actor.hp,nutrition=actor.nutrition,inventory=actor.inventory.items;
  travelStationedHome(g,2);
  expect(g.party!.stationed.get(id)).toBe(actor);
  expect(residentRecord(g,id)?.levelRef).toEqual({kind:'dungeon',depth:1});
  expect([...g.monsters,...g.levels.get(1)!.monsters,...g.controlledActors].some(m=>m.id===id)).toBe(false);
  const food=containerItems(g,home.supplyId)[0]!,quantity=food.quantity,foodId=food.id,
    nextDay=(Math.floor(g.world5!.simulationTicks/32000)+1)*32000;
  // As in resident_needs: exercise the actual economic lifecycle at its next
  // day boundary, without fabricating commands or a seed recording origin.
  advanceWorldClock(g.world5!,nextDay-g.world5!.simulationTicks);settleResidentNeeds(g);
  expect(containerItems(g,home.supplyId).find(i=>i.id===foodId)).toBe(food);
  expect(food.quantity).toBe(quantity-1);expect(current(g).consumedLockedUnits).toBe(1);
  expect(g.world5!.offline.find(l=>l.campSlotId===home.slot)!.residentStates.find(n=>n.actorId===id))
    .toMatchObject({alive:true,foodShortage:0,unfedDays:0,departed:false});
  expect(actor.hp).toBe(hp);expect(actor.nutrition).toBe(nutrition);expect(actor.inventory.items).toBe(inventory);
  const offline=diagnostic(g),receipts=structuredClone(g.world5!.receipts);
  settleResidentNeeds(g);
  expect(food.quantity).toBe(quantity-1);expect(g.world5!.receipts).toEqual(receipts);
  travelStationedHome(g,1);
  expect(g.party!.stationed.get(id)).toBe(actor);expect(residentRecord(g,id)).toBeTruthy();
  expect(g.controlledActors.includes(actor)).toBe(false);expect(g.monsters.some(m=>m.id===id)).toBe(false);
  expect(containerItems(g,home.supplyId).find(i=>i.id===foodId)?.quantity).toBe(quantity-1);
  const returned=diagnostic(g),loaded=new Game({seed:1});
  try{for(const snapshot of [offline,returned]){
    expect(loaded.loadSnapshot(snapshot)).toBe(true);expect(loaded.hasCompleteRecording).toBe(false);
    expect(loaded.party!.stationed.get(id)?.hp).toBe(hp);
    expect(loaded.party!.actors.has(id)).toBe(false);expect(residentRecord(loaded,id)?.levelRef).toEqual({kind:'dungeon',depth:1});
    expect(loaded.world5!.offline).toEqual(snapshot.run.world5!.offline);
    expect(loaded.party!.state).toEqual(snapshot.party!.state);
    expect([...loaded.monsters,...[...loaded.levels.values()].flatMap(l=>l.monsters),...loaded.controlledActors].some(m=>m.id===id)).toBe(false);
    expect(containerItems(loaded,home.supplyId).find(i=>i.id===foodId)?.quantity).toBe(quantity-1);
  }}finally{loaded.disposeRecording();}
},120000);

it('public bed removal keeps a stationed resident with housing debt, and camp retirement requires real dismissal',()=>{
  const {g,h,a}=prepared(),id=a.id,home=current(g);roster(g,id,'join');ready(g);roster(g,id,'station',home.regionId);
  const actor=g.party!.stationed.get(id)!,hp=actor.hp,
    item=g.player.inventory.items.find(i=>![g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight].includes(i))!;
  g.player.inventory.removeItem(item);actor.inventory.addItem(item);
  const dismantle=(part:NonNullable<typeof g.world5>['structures'][number])=>{
    const component=part.fixture??part.roof??part.barrier??part.floor!;
    // Dismantling targets a visible adjacent structure, including solid walls;
    // the creature-contact line predicate would reject the wall itself.
    const at=[-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>({x:part.at.x+dx,y:part.at.y+dy})))
      .find(p=>g.grid.getCell(p.x,p.y)?.isPassable&&!g.getMonsterAt(p.x,p.y)&&
        (p.x!==actor.x||p.y!==actor.y))!;
    expect(at).toBeTruthy();g.player.loc=at;g.refreshStructureDerivedState();
    expect(h.ext('settlement','dismantle',{...base(g),componentId:component.id,componentRevision:component.revision}).error).toBeNull();
  };
  const bedId=residentComponent(g,id)!.bedId!;
  dismantle(g.world5!.structures.find(s=>s.fixture?.id===bedId)!);
  expect(residentComponent(g,id)?.bedId).toBeNull();
  advanceWorldClock(g.world5!,3000);settleResidentNeeds(g);
  expect(g.world5!.offline.find(l=>l.campSlotId===home.slot)!.residentStates.find(n=>n.actorId===id)?.housingShortage).toBe(3);
  expect(g.party!.stationed.get(id)).toBe(actor);expect(g.party!.state.retired.some(r=>r.actorId===id)).toBe(false);
  expect(actor.inventory.items).toContain(item);expect(actor.hp).toBe(hp);
  const noBed=diagnostic(g);
  while(g.world5!.structures.some(s=>s.regionId===home.regionId))
    dismantle(g.world5!.structures.find(s=>s.regionId===home.regionId)!);
  g.player.loc={x:22,y:12};g.refreshStructureDerivedState();
  const retirement=()=>{const region=g.extensionRuntime!.worldStructureRegions().find(r=>r.id===home.regionId)!;
    return h.ext('settlement','retire',{...base(g),regionId:region.id,regionRevision:region.revision});};
  const before=diagnostic(g),prefix=g.recordedInputEvents.length;
  const prepare=structureProduction.prepareStructureCommand,
    checked:ReturnType<typeof prepare>[]=[];
  // Observe the real read-only prepare result inside its public command scope.
  // Party's existing module adapter maps failed native prepares to INVALID_TARGET.
  const preflight=vi.spyOn(structureProduction,'prepareStructureCommand').mockImplementation((...args)=>{
    const result=prepare(...args);checked.push(result);return result;
  });
  try{expect(()=>retirement()).toThrow('INVALID_TARGET');}finally{preflight.mockRestore();}
  expect(checked).toContainEqual({ok:false,code:'C5_RESERVED',field:null});
  const after=diagnostic(g);after.savedAt=before.savedAt;expect(after).toEqual(before);
  expect(g.recordedInputEvents).toHaveLength(prefix);
  const contact=[-1,0,1].flatMap(dx=>[-1,0,1].map(dy=>({x:actor.x+dx,y:actor.y+dy})))
    .find(p=>(p.x!==actor.x||p.y!==actor.y)&&g.grid.getCell(p.x,p.y)?.isPassable&&hasInteractionLine(g.grid,p,actor.loc))!;
  expect(contact).toBeTruthy();g.player.loc=contact;g.refreshStructureDerivedState();
  const camp=current(g),resident=residentComponent(g,id)!;
  expect(h.ext('settlement','dismiss-resident',{v:1,stateRevision:g.extensionRuntime!.worldCampState('settlement').revision,
    campId:camp.regionId,campRevision:camp.revision,targetId:id,targetRevision:resident.revision}).error).toBeNull();
  expect(residentRecord(g,id)).toBeUndefined();expect(g.party!.stationed.get(id)).toBe(actor);
  expect(g.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);
  expect(actor.hp).toBe(hp);expect(actor.inventory.items).toHaveLength(0);expect(g.items.filter(i=>i.id===item.id)).toEqual([item]);
  expect(candidateSource(g,id)).toBeUndefined();
  expect(g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]).toMatchObject({status:'terminal',actorId:null});
  g.player.loc={x:22,y:12};g.refreshStructureDerivedState();expect(retirement().error).toBeNull();
  expect(g.extensionRuntime!.worldCampState('settlement').camps).toHaveLength(0);
  expect(g.world5!.residents).toHaveLength(0);expect(g.world5!.offline).toHaveLength(0);
  expect(g.items.filter(i=>i.id===item.id)).toEqual([item]);
  const retired=diagnostic(g),loaded=new Game({seed:1});
  try{expect(loaded.loadSnapshot(noBed)).toBe(true);expect(residentComponent(loaded,id)?.bedId).toBeNull();
    expect(loaded.party!.state.retired.some(r=>r.actorId===id)).toBe(false);
    expect(loaded.loadSnapshot(retired)).toBe(true);expect(loaded.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);
    expect(loaded.party!.stationed.get(id)?.hp).toBe(hp);expect(loaded.items.filter(i=>i.id===item.id)).toHaveLength(1);
    expect(residentRecord(loaded,id)).toBeUndefined();
  }finally{loaded.disposeRecording();}
},120000);
it('public join, station and rejoin preserve the same controlled entity and save/load ownership',()=>{
  const {g,a}=prepared(),id=a.id,camp=current(g);a.hp=11;
  capture(g,id,'resident-before-join');
  roster(g,id,'join');const controlled=g.party!.actors.get(id)!;
  expect(controlled).toBeTruthy();expect(controlled.hp).toBe(11);expect(g.monsters.some(m=>m.id===id)).toBe(false);
  expect(residentRecord(g,id)).toBeUndefined();ready(g);
  const items=controlled.inventory.items,health=controlled.hp;
  roster(g,id,'station',camp.regionId);
  expect(g.party!.stationed.get(id)).toBe(controlled);expect(g.party!.actors.has(id)).toBe(false);
  expect(residentRecord(g,id)).toBeTruthy();expect(controlled.inventory.items).toBe(items);expect(controlled.hp).toBe(health);
  const saved=g.toSaveSnapshot(),loaded=new Game({seed:1});
  for(const change of ['source','profile']){
    const bad=JSON.parse(JSON.stringify(g.toSnapshot()));delete bad.run.recordingOrigin;
    if(change==='source'){
      bad.party.state.sources.find((r:any)=>r.actorId===id).key='forged.spawn.1';
      for(const row of bad.party.state.transfers)if(row.actorId===id)row.sourceKey='forged.spawn.1';
      bad.party.state.residentMemories.find((r:any)=>r.actorId===id).source.source.key='forged.spawn.1';
    }else delete bad.party.stationed.find((r:any)=>r.id===id).partyProfile;
    const root=g.party,player=g.player;expect(g.loadSnapshot(bad)).toBe(false);expect(g.party).toBe(root);expect(g.player).toBe(player);expect(root!.stationed.get(id)).toBe(controlled);
  }
  try{
    expect(loaded.loadSnapshot(saved,message=>console.error(message))).toBe(true);
    expect(loaded.party!.stationed.get(id)).toBeTruthy();expect(loaded.party!.actors.has(id)).toBe(false);
    expect(residentRecord(loaded,id)).toBeTruthy();
  }finally{loaded.disposeRecording();}
  roster(g,id,'join');
  expect(g.party!.actors.get(id)).toBe(controlled);expect(g.party!.stationed.has(id)).toBe(false);
  expect(residentRecord(g,id)).toBeUndefined();expect(controlled.inventory.items).toBe(items);expect(controlled.hp).toBe(health);
},120000);

it.each(['collect','record'])('late %s failure during public station restores member identity and all roots',phase=>{
  const {g,a}=prepared();roster(g,a.id,'join');ready(g);
  const root=g.party!,actor=root.actors.get(a.id)!,inventory=actor.inventory.items,native=root.native[a.id],before=JSON.stringify(g.toSaveSnapshot()),events=structuredClone(g.recordedInputEvents);
  let calls=0;const collect=(g as any).collectExtensionComponents.bind(g);
  const spy=phase==='collect'?vi.spyOn(g as any,'collectExtensionComponents').mockImplementation(()=>{if(++calls===2)throw Error('late-station');return collect();}):vi.spyOn(g as any,'recordInputEvent').mockImplementation(()=>{throw Error('late-station');});
  expect(()=>roster(g,a.id,'station',current(g).regionId)).toThrow('late-station');spy.mockRestore();
  expect(g.party).toBe(root);expect(root.actors.get(a.id)).toBe(actor);expect(root.stationed.has(a.id)).toBe(false);
  expect(isPartyMember(actor)).toBe(true);expect(root.native[a.id]).toBe(native);expect(actor.inventory.items).toBe(inventory);expect(residentRecord(g,a.id)).toBeUndefined();expect(g.recordedInputEvents).toEqual(events);
  const after=g.toSaveSnapshot(),prior=JSON.parse(before);after.savedAt=prior.savedAt;expect(after).toEqual(prior);
},120000);

it('stationed people walk and finish real resident haul phases while only party commands advance time',()=>{
  const {g,h,a}=prepared();g.player.loc={x:20,y:14};g.refreshStructureDerivedState();
  expect(h.ext('settlement','build',build(g,'chest',{x:20,y:15})).error).toBeNull();
  const camp=current(g),destination=g.world5!.containers.find(c=>c.kind==='chest'&&c.id!==camp.supplyId)!;
  const wood=g.player.inventory.items.find(i=>i.worldItem?.definitionId==='settlement.wood')!;
  g.player.loc={x:22,y:12};g.refreshStructureDerivedState();
  expect(h.ext('settlement','transfer',{...base(g),containerId:camp.supplyId,containerRevision:g.world5!.containers.find(c=>c.id===camp.supplyId)!.revision,direction:'deposit',items:[{itemId:wood.id,quantity:3}]}).error).toBeNull();
  g.player.loc={x:19,y:13};a.loc={x:20,y:13};g.refreshStructureDerivedState();roster(g,a.id,'join');ready(g);roster(g,a.id,'station',camp.regionId);
  const actor=g.party!.stationed.get(a.id)!,start={...actor.loc},native=g.party!.stationedNative[a.id];
  const original=containerItems(g,camp.supplyId).find(i=>i.worldItem?.definitionId==='settlement.wood')!;
  expect(assign(h,g,a.id,{kind:'haul',sourceId:camp.supplyId,destinationId:destination.id,itemId:original.id,quantity:1}).error).toBeNull();
  g.player.loc={x:18,y:14};g.refreshStructureDerivedState();actor.applyStatus('weakened',3);
  let walked=false,busy=false;
  for(let n=0;n<80&&!containerItems(g,destination.id).some(i=>i.worldItem?.definitionId==='settlement.wood');n++){
    while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);
    walked ||= actor.x!==start.x||actor.y!==start.y;busy ||= g.actorActions!.bundles.some(b=>b.decisionOwnerId===actor.id);
    expect(g.party!.stationed.get(actor.id)).toBe(actor);expect(g.controlledActors.includes(actor)).toBe(false);expect(g.monsters.some(m=>m.id===actor.id)).toBe(false);
  }
  expect(walked).toBe(true);expect(busy).toBe(true);expect(actor.hasStatus('weakened')).toBe(false);
  expect(containerItems(g,destination.id).filter(i=>i.worldItem?.definitionId==='settlement.wood').reduce((n,i)=>n+i.quantity,0)).toBe(1);
  expect(g.party!.stationedNative[a.id]).toBe(native);expect(g.party!.native[a.id]).toBeUndefined();expect(isPartyMember(actor)).toBe(false);
  const saved=g.toSaveSnapshot(),loaded=new Game({seed:1});try{expect(loaded.loadSnapshot(saved)).toBe(true);expect(loaded.party!.stationed.get(a.id)?.loc).toEqual(actor.loc);}finally{loaded.disposeRecording();}
},120000);

it('stationed retirement drops each owned item once and archives the same entity',()=>{
  const {g,a}=prepared(),id=a.id;roster(g,id,'join');ready(g);roster(g,id,'station',current(g).regionId);
  const actor=g.party!.stationed.get(id)!;
  const item=g.player.inventory.items.find(i=>![g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight].includes(i))!;
  g.player.inventory.removeItem(item);actor.inventory.addItem(item);
  const hp=actor.hp;transactResidentWorld(g,()=>retireStationedResident(g,id,'dismiss'));
  expect(g.party!.stationed.get(id)).toBe(actor);expect(actor.hp).toBe(hp);
  expect(residentRecord(g,id)).toBeUndefined();expect(actor.inventory.items).toHaveLength(0);
  expect(g.items.filter(i=>i.id===item.id)).toEqual([item]);
  expect(g.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);
  retireStationedResident(g,id,'dismiss');expect(g.items.filter(i=>i.id===item.id)).toHaveLength(1);
  expect(()=>roster(g,id,'join')).toThrow();
  const diagnostic=g.toSnapshot(),loaded=new Game({seed:1});
  try{expect(loaded.loadSnapshot(diagnostic)).toBe(true);expect(loaded.party!.state.retired.some(r=>r.actorId===id)).toBe(true);expect(loaded.party!.stationed.get(id)?.hp).toBe(hp);}finally{loaded.disposeRecording();}
},120000);

it('native poison death retires a stationed resident once and preserves terminal source save/load',()=>{
  const {g,a}=prepared();roster(g,a.id,'join');ready(g);roster(g,a.id,'station',current(g).regionId);
  const actor=g.party!.stationed.get(a.id)!;actor.hp=1;actor.applyStatus('poisoned',2);actor.poisonAmount=1;
  const capture=vi.spyOn(g.extensionRuntime!,'captureDeath');
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);
  expect(actor.hp).toBe(0);expect(g.party!.state.retired.filter(r=>r.actorId===a.id)).toHaveLength(1);expect(candidateSource(g,a.id)).toBeUndefined();
  expect(capture.mock.calls.filter(args=>args[0]===actor)).toHaveLength(1);retireStationedResident(g,a.id,'dead');expect(capture.mock.calls.filter(args=>args[0]===actor)).toHaveLength(1);capture.mockRestore();
  const saved=g.toSnapshot(),loaded=new Game({seed:1});try{expect(loaded.loadSnapshot(saved)).toBe(true);expect(loaded.party!.stationed.get(a.id)?.hp).toBe(0);expect(loaded.party!.state.retired.some(r=>r.actorId===a.id)).toBe(true);}finally{loaded.disposeRecording();}
},120000);

it('native hostile decisions hit stationed people and civilian fallback retaliates without a party turn',()=>{
  const {g,a}=prepared();roster(g,a.id,'join');ready(g);roster(g,a.id,'station',current(g).regionId);
  const actor=g.party!.stationed.get(a.id)!;g.player.loc={x:18,y:14};g.refreshStructureDerivedState();
  const at=[{x:actor.x+1,y:actor.y},{x:actor.x,y:actor.y+1},{x:actor.x,y:actor.y-1}].find(p=>g.grid.getCell(p.x,p.y)?.isPassable&&!g.getMonsterAt(p.x,p.y)&&!g.controlledOccupies(p)&&hasInteractionLine(g.grid,actor.loc,p))!;
  expect(at).toBeTruthy();const enemy=new Monster(at.x,at.y,monsterCatalog.find(row=>row.id==='rat') as any);enemy.state=MonsterState.HUNTING;enemy.hp=enemy.maxHp=1000;enemy.accuracy=1000;g.monsters.push(enemy);g.extensionRuntime!.attachCreature(enemy);g.refreshStructureDerivedState();
  const attacks:{from:number;to:number;damage:number;hit:boolean}[]=[],attack=CombatSystem.attack.bind(CombatSystem);
  const spy=vi.spyOn(CombatSystem,'attack').mockImplementation((from,to,options)=>{const result=attack(from,to,options);attacks.push({from:from.id,to:to.id,damage:result.damage,hit:result.hit});return result;});
  try{for(let n=0;n<10&&!attacks.some(r=>r.from===actor.id&&r.damage>0)&&actor.hp>0;n++){while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);}}
  finally{spy.mockRestore();}
  expect(attacks.some(r=>r.from===enemy.id&&r.to===actor.id&&r.damage>0)).toBe(true);
  expect(attacks.some(r=>r.from===actor.id&&r.to===enemy.id&&r.damage>0)).toBe(true);
  expect(g.controlledActors.includes(actor)).toBe(false);expect(g.party!.stationed.get(actor.id)).toBe(actor);expect(g.party!.native[actor.id]).toBeUndefined();
},120000);
it('automatic resident retirement rollback restores stationed inventory, equipment and history after a late source write fails',()=>{
  const {g,a}=prepared(),id=a.id;roster(g,id,'join');ready(g);roster(g,id,'station',current(g).regionId);
  const actor=g.party!.stationed.get(id)!,item=g.player.inventory.items.find(i=>![g.player.equippedWeapon,g.player.equippedArmor,g.player.ringLeft,g.player.ringRight].includes(i))!;
  g.player.inventory.removeItem(item);actor.inventory.addItem(item);
  const root=g.party!,world=g.world5!,inventory=actor.inventory.items,home=residentRecord(g,id),source=candidateSource(g,id),before=JSON.stringify(g.toSaveSnapshot());
  const failure=vi.spyOn(g.extensionRuntime!,'worldCampReplace').mockImplementation(()=>{throw new Error('retirement-source');});
  expect(()=>transactResidentWorld(g,()=>retireStationedResident(g,id,'starvation'))).toThrow('retirement-source');
  failure.mockRestore();
  expect(g.party).toBe(root);expect(g.world5).toBe(world);expect(g.party!.stationed.get(id)).toBe(actor);
  expect(actor.inventory.items).toBe(inventory);expect(actor.inventory.items).toContain(item);
  expect(g.items.some(i=>i===item)).toBe(false);expect(residentRecord(g,id)).toBe(home);expect(candidateSource(g,id)).toEqual(source);
  expect(root.state.retired.some(r=>r.actorId===id)).toBe(false);
  const saved=g.toSaveSnapshot(),prior=JSON.parse(before);saved.savedAt=prior.savedAt;expect(saved).toEqual(prior);
},120000);
it('settles and releases a real paid resident without retiring its entity, source or inventory owner',()=>{
  const {g,a}=prepared(),source=structuredClone(candidateSource(g,a.id));
  const before=g.world5!.offline.flatMap(l=>l.residentStates).find(n=>n.actorId===a.id)!;
  before.foodShortage=1;before.unfedDays=1;
  const actor=a,random=rng.getState(),allocator=getNextEntityId();
  const memory=transactResidentWorld(g,()=>commitPartyResidentRelease(g,a.id));
  expect(memory.actorId).toBe(a.id);expect(memory.need.foodShortage).toBe(1);
  expect(memory.source).toEqual(source);expect(candidateSource(g,a.id)).toEqual(source);
  expect(residentRecord(g,a.id)).toBeUndefined();expect(residentComponent(g,a.id)).toBeUndefined();
  expect(g.monsters.find(m=>m.id===a.id)).toBe(actor);expect(actor.hp).toBeGreaterThan(0);
  expect(g.world5!.offline.flatMap(l=>l.residentStates).some(n=>n.actorId===a.id)).toBe(false);
  expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);
},120000);

it('a failed late resident publication restores the original actor, home, needs and source object graph',()=>{
  const {g,a}=prepared(),camp=current(g),world=g.world5!,residents=world.residents;
  const row=residentRecord(g,a.id),component=residentComponent(g,a.id),source=candidateSource(g,a.id);
  const need=world.offline.flatMap(l=>l.residentStates).find(n=>n.actorId===a.id)!;
  const before=JSON.stringify(g.toSaveSnapshot()),random=rng.getState(),allocator=getNextEntityId();
  const replacement=vi.spyOn(g.extensionRuntime!,'worldCampReplace').mockImplementation(()=>{throw new Error('late-publication');});
  expect(()=>transactResidentWorld(g,()=>commitPartyResidentRelease(g,a.id))).toThrow('late-publication');
  replacement.mockRestore();
  expect(g.world5).toBe(world);expect(world.residents).toBe(residents);expect(residentRecord(g,a.id)).toBe(row);
  expect(g.monsters.find(m=>m.id===a.id)).toBe(a);
  expect(world.offline.flatMap(l=>l.residentStates).find(n=>n.actorId===a.id)).toBe(need);
  expect(residentComponent(g,a.id)).toEqual(component);expect(candidateSource(g,a.id)).toEqual(source);
  expect(current(g)).toEqual(camp);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);
  const after=g.toSaveSnapshot(),prior=JSON.parse(before);after.savedAt=prior.savedAt;
  expect(after).toEqual(prior);
},120000);

it('resident release rejects remote contact before changing its economic ownership',()=>{
  const {g,a}=prepared();g.player.loc={x:25,y:13};g.refreshStructureDerivedState();
  const row=residentRecord(g,a.id),state=JSON.stringify(g.world5),random=rng.getState();
  expect(()=>preparePartyResidentRelease(g,a.id)).toThrow();
  expect(residentRecord(g,a.id)).toBe(row);expect(JSON.stringify(g.world5)).toBe(state);expect(rng.getState()).toEqual(random);
},120000);

it('compilation back into the party refunds the real haul escrow through the resident owner',()=>{
  const {g,h,a}=prepared();g.player.loc={x:20,y:14};g.refreshStructureDerivedState();
  expect(h.ext('settlement','build',build(g,'chest',{x:20,y:15})).error).toBeNull();
  const camp=current(g),destination=g.world5!.containers.find(c=>c.kind==='chest'&&c.id!==camp.supplyId)!;
  const wood=g.player.inventory.items.find(i=>i.worldItem?.definitionId==='settlement.wood')!;
  g.player.loc={x:22,y:12};g.refreshStructureDerivedState();
  expect(h.ext('settlement','transfer',{...base(g),containerId:camp.supplyId,
    containerRevision:g.world5!.containers.find(c=>c.id===camp.supplyId)!.revision,
    direction:'deposit',items:[{itemId:wood.id,quantity:3}]}).error).toBeNull();
  const original=containerItems(g,camp.supplyId).find(i=>i.worldItem?.definitionId==='settlement.wood')!;
  expect(original).toBeTruthy();const total=original.quantity,originalId=original.id;
  g.player.loc={x:19,y:13};a.loc={x:20,y:13};g.refreshStructureDerivedState();
  expect(assign(h,g,a.id,{kind:'haul',sourceId:camp.supplyId,destinationId:destination.id,itemId:original.id,quantity:1}).error).toBeNull();
  // Keep the sole doorway lane clear while the worker walks to the source.
  g.player.loc={x:18,y:14};g.refreshStructureDerivedState();
  for(let n=0;n<40&&!g.world5!.residentJobs.some(j=>j.actorId===a.id);n++){
    while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);
  }
  const job=g.world5!.residentJobs.find(j=>j.actorId===a.id);expect(job,JSON.stringify({
    actor:{at:a.loc,ticks:a.ticksUntilTurn,hp:a.hp},resident:residentComponent(g,a.id),tick:g.world5!.simulationTicks,
    needs:g.world5!.offline.flatMap(l=>l.residentStates),items:containerItems(g,camp.supplyId).map(i=>({id:i.id,quantity:i.quantity}))
  })).toBeTruthy();
  const cargo=containerItems(g,job!.cargoId);expect(cargo).toHaveLength(1);
  const escrowItem=cargo[0]!,contact=[{x:a.x-1,y:a.y},{x:a.x+1,y:a.y},{x:a.x,y:a.y-1},{x:a.x,y:a.y+1}]
    .find(p=>g.grid.getCell(p.x,p.y)?.isPassable&&hasInteractionLine(g.grid,p,a.loc))!;
  expect(contact).toBeTruthy();g.player.loc=contact;g.refreshStructureDerivedState();
  capture(g,a.id,'resident-with-ticket');
  transactResidentWorld(g,()=>commitPartyResidentRelease(g,a.id));
  expect(g.world5!.residentJobs.some(j=>j.actorId===a.id)).toBe(false);
  expect(g.world5!.containers.some(c=>c.id===job!.cargoId)).toBe(false);
  expect(containerItems(g,camp.supplyId).filter(i=>i.worldItem?.definitionId===original.worldItem?.definitionId).reduce((n,i)=>n+i.quantity,0)).toBe(total);
  expect(containerItems(g,camp.supplyId).some(i=>i.id===originalId||i===escrowItem)).toBe(true);
  expect(g.actorActions!.bundles.some(b=>b.decisionOwnerId===a.id)).toBe(false);
},120000);

it('returning resident nutrition never grants food and conservatively carries shortage',()=>{
  const actor=new ControlledActor(2,2);actor.nutrition=900;
  const memory={actorId:actor.id,need:{actorId:actor.id,alive:true,foodShortage:2 as const,housingShortage:0 as const,unfedDays:2,departed:false},source:null};
  applyPartyResidentNutrition(actor,memory);expect(actor.nutrition).toBe(150);
  actor.nutrition=20;applyPartyResidentNutrition(actor,memory);expect(actor.nutrition).toBe(20);
});
