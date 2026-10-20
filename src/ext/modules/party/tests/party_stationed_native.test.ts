import { afterEach, expect, it, vi } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { createConfiguredWorldHarness } from '../../../testing/configuredWorldHarness';
import { residentScene } from '../../settlement/tests/residentHelpers';
import { current } from '../../settlement/tests/helpers';
import { logger } from '../../../../engine/Systems/Logger';
import { nativeStat, markStatsDirty, nativeStatRevision } from '../../../../engine/Stats/NativeStatSources';
import { getBoltForItem } from '../../../../engine/Combat/Bolt';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { TerrainType } from '../../../../engine/Map/Grid';
import { applyCatalogFeature } from '../../../../test/support/dungeonFeature';
import { DF } from '../../../../engine/Map/DungeonFeatureCatalog';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { installRecordingScene } from '../../../../test/support/recordingV4';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { retireStationedResident } from '../../../../engine/Core/PartyResident';
import { ActorCombatResolutionAuthority } from '../../../../engine/Combat/ActorCombatResolution';
import { sourceFootprintVersion } from '../../../../engine/Movement/AttackShape';
import { withActorActionScope } from '../../../../engine/Core/ActorActionScope';

const games:Game[]=[];
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const digest=(g:Game)=>mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());
afterEach(()=>{for(const g of games.splice(0))g.disposeRecording();clear();vi.restoreAllMocks();});
function roster(g:Game,id:number,operation:'join'|'station',campId:number|null=null){
 clear();g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,
  issuerSlot:'local:0',actorId:g.player.id,targetId:id,operation,campId,level:{kind:'dungeon',depth:g.depth}});
}
function prepared(combat=false){
 const {g,a}=residentScene(combat?['party','settlement','combat']:['party','settlement'],false,(options,config)=>
  createConfiguredWorldHarness(options,{...config,party:{schema:1,members:1}}));
 g.player.loc={x:19,y:13};a.loc={x:20,y:13};g.refreshStructureDerivedState();
 roster(g,a.id,'join');
 for(let n=0;n<40&&g.activeControlledActors.some(a=>a.ticksUntilTurn>0);n++){
  clear();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);
 }
 expect(g.activeControlledActors.every(a=>a.ticksUntilTurn===0)).toBe(true);
 roster(g,a.id,'station',current(g).regionId);
 return {g,id:a.id,actor:g.party!.stationed.get(a.id)!};
}
/** Reconstruct the same diagnostic world before the real initial digest on each
 * start/replay. No old command prefix or invented recording origin is retained.
 * This is controlled-scene replay coverage, not a natural seed route. */
function recordScene(g:Game){
 const snapshot=clone(g.toSnapshot());delete snapshot.run.recordingOrigin;
 // Creation is still a real first recorded command, including its input guard.
 (snapshot.extensions!.modules.party as {created:boolean}).created=false;
 installRecordingScene(candidate=>{
  // This hook is inside startNewGame, before its initial digest. Loading the
  // diagnostic scene resets the recording admission flag; preserve the fresh
  // start's flag only here. Header/origin/events are then created by startNewGame,
  // and every replay candidate must reconstruct and validate the same full root.
  const fresh=(candidate as any).recordingFromNewGame;expect(fresh).toBe(true);
  expect(candidate.loadSnapshot(clone(snapshot))).toBe(true);
  expect(candidate.hasCompleteRecording).toBe(false);
  (candidate as any).recordingFromNewGame=fresh;
 });
 g.startNewGame({seed:snapshot.seed,ruleSet:'extended',extensions:snapshot.extensions!.manifest.modules.map(m=>m.id),
  extensionConfigurations:{party:{schema:1,members:1},settlement:{raids:false}},
  initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:1}})]});
 g.animationEnabled=false;clear();expect(g.recordedInputEvents).toHaveLength(1);
}
function roundtrip(g:Game,check:(g:Game)=>void){
 clear();check(g);const expected=digest(g),random=rng.getState(),allocator=getNextEntityId(),
  save=clone(g.toSaveSnapshot()),record=clone(g.exportRecording()),h=new Game({seed:1});games.push(h);
 expect(record.events.length).toBeGreaterThan(0);
 expect(h.loadSnapshot(save)).toBe(true);check(h);expect(digest(h)).toEqual(expected);
 expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(allocator);
 expect(h.loadReplay(record)).toBe(true);h.animationEnabled=false;
 for(let n=0;n<record.events.length+5&&h.replayCursor<record.events.length;n++){clear();h.replayStep(true);}
 expect(h.replayError).toBeNull();expect(h.replayCursor).toBe(record.events.length);check(h);expect(digest(h)).toEqual(expected);
 for(const index of [0,record.events.length,0,record.events.length]){
  clear();h.replaySeek(index);expect(h.replayError).toBeNull();expect(h.replayCursor).toBe(index);
  if(index){check(h);expect(digest(h)).toEqual(expected);expect(rng.getState()).toEqual(random);}
 }
 // Loaded continuation must use the same native ports as uninterrupted play.
 expect(h.loadSnapshot(save)).toBe(true);h.animationEnabled=false;clear();h.submitPartyIntent({kind:'wait'},h.readyPartyActorId!);
 const continued=digest(h),extended=clone(h.exportRecording());expect(extended.events).toHaveLength(record.events.length+1);
 expect(g.loadReplay(extended)).toBe(true);g.animationEnabled=false;g.replaySeek(extended.events.length);
 expect(g.replayError).toBeNull();expect(digest(g)).toEqual(continued);
}

it('F1: stationed and rejoined actors both stop healing rays and receive the actual effect',()=>{
 const {g,id}=prepared(),bolt=getBoltForItem('staff_of_healing')!,item=ItemLoader.spawnStaff('staff_of_healing',-1,-1)!;
 for(const joined of [false,true]){
  if(joined)roster(g,id,'join');const actor=g.party!.stationed.get(id)??g.party!.actors.get(id)!;actor.hp=5;
  const result=(g as any).computeBoltResult(bolt,g.player.loc,{x:actor.x+1,y:actor.y});
  expect((g as any).boltWorld(g.player).creatureAt(actor.loc)).toBe(actor);
  expect(result.hits.map((h:any)=>h.creature.id)).toEqual([id]);expect(result.landingPos).toEqual(actor.loc);
  (g as any).applyBoltResult(result,item);expect(actor.hp).toBe(11);
 }
});
it('F1: public healing of a stationed actor persists through load, replay, seek and continuation',()=>{
 const {g,id,actor}=prepared();actor.hp=5;g.player.inventory.addItem(ItemLoader.spawnStaff('staff_of_healing',-1,-1)!);recordScene(g);
 const item=g.player.inventory.items.find(i=>i.identityId==='staff_of_healing')!,at={...g.party!.stationed.get(id)!.loc};
 g.submitPartyIntent({kind:'item',operation:'use',itemId:item.id,target:at},g.player.id);
 expect(g.party!.stationed.get(id)!.hp).toBeGreaterThan(5);
 roundtrip(g,h=>{const a=h.party!.stationed.get(id)!;expect(a.hp).toBeGreaterThan(5);expect((h as any).boltWorld(h.player).creatureAt(a.loc)).toBe(a);});
},120000);

it.each([false,true])('F2: shadow and rested=%s survive load and drive the same subsequent hostile decision',rested=>{
 const {g,id,actor}=prepared();g.party!.stationedNative[id]!.justRested=rested;
 g.party!.native[g.player.id]!.justRested=!rested;
 g.player.loc={x:18,y:14};
 const enemy=new Monster(20,14,monsters.find(m=>m.id==='rat') as MonsterData);enemy.state=MonsterState.HUNTING;
 g.monsters.push(enemy);g.extensionRuntime!.attachCreature(enemy);g.refreshStructureDerivedState();markStatsDirty(actor);
 expect(g.lightMap.inShadowAt(actor.x,actor.y)).toBe(true);
 expect(nativeStat(actor,'native.stealth-range')).toBe(rested?4:7);
 const before=nativeStat(actor,'native.stealth-range'),snapshot=clone(g.toSnapshot());delete snapshot.run.recordingOrigin;
 const decision=(game:Game)=>{
  const a=game.party!.stationed.get(id)!,m=game.monsters.find(m=>m.id===enemy.id)!;
  let selected=-1,range=-1;const original=m.prepareNativeDecision;
  const spy=vi.spyOn(m,'prepareNativeDecision').mockImplementation(function(this:Monster,world,value){selected=world.commandActor.id;range=value;return original.call(this,world,value);});
  try{(game as any).timePorts().effects.monsterTakeTurn(m,999);}finally{spy.mockRestore();}
  expect(selected).toBe(id);expect(range).toBe(before);expect(a.hp).toBeGreaterThan(0);
  return {selected,range,digest:digest(game),random:rng.getState()};
 };
 const expected=decision(g),h=new Game({seed:1});games.push(h);
 expect(h.loadSnapshot(snapshot)).toBe(true);expect(nativeStat(h.party!.stationed.get(id)!,'native.stealth-range')).toBe(before);
 expect(decision(h)).toEqual(expected);
 // Reconstruct at the same pre-decision state for a recorded objective tick.
 expect(g.loadSnapshot(snapshot)).toBe(true);recordScene(g);g.submitPartyIntent({kind:'wait'},g.player.id);
 roundtrip(g,h=>{const a=h.party!.stationed.get(id)!;expect(nativeStat(a,'native.stealth-range')).toBe(before);});
},120000);

it('F3: the real portcullis DF evacuates a stationed actor and reserves its destination',()=>{
 const {g,id,actor}=prepared();actor.loc={x:22,y:13};g.player.loc={x:23,y:13};g.refreshStructureDerivedState();const before={...actor.loc};
 const result=applyCatalogFeature(g,actor.loc,DF.DF_ACTIVATE_PORTCULLIS);
 expect(result.evacuationRequired).toBe(true);expect(actor.loc).not.toEqual(before);
 expect(g.grid.getCell(actor.x,actor.y)!.isPassable).toBe(true);
 expect(g.creatureAtCell(actor.loc)).toBe(actor);expect(actor.loc).not.toEqual(g.player.loc);
 const snapshot=clone(g.toSnapshot());delete snapshot.run.recordingOrigin;
 expect(g.loadSnapshot(snapshot)).toBe(true);expect(g.party!.stationed.get(id)!.loc).toEqual(actor.loc);
});
it('F3: a recorded pressure plate closes the gate and evacuates its stationed occupant across replay and seek',()=>{
 const {g,id,actor}=prepared();actor.loc={x:22,y:13};g.player.loc={x:23,y:13};g.refreshStructureDerivedState();const before={...actor.loc};
 g.grid.setTerrain(actor.x,actor.y,TerrainType.PORTCULLIS_DORMANT);g.grid.getCell(actor.x,actor.y)!.machineNumber=731;
 g.grid.setTerrain(23,14,TerrainType.PRESSURE_PLATE);g.grid.getCell(23,14)!.machineNumber=731;
 g.refreshStructureDerivedState();recordScene(g);g.onConfirmRequest=()=>true;
 g.submitPartyIntent({kind:'move',dx:0,dy:1},g.player.id);
 const check=(h:Game)=>{const a=h.party!.stationed.get(id)!;expect(h.grid.getCell(before.x,before.y)!.isPassable).toBe(false);
  expect(a.loc).not.toEqual(before);expect(h.grid.getCell(a.x,a.y)!.isPassable).toBe(true);expect(h.creatureAtCell(a.loc)).toBe(a);};
 check(g);roundtrip(g,check);
},120000);
it.each(['fire','dart','negation'] as const)('audit: stationed %s contact uses the live entity and survives replay/seek',kind=>{
 const {g,id,actor}=prepared();
 if(kind==='negation'){actor.setStatusDuration('levitating',5);actor.setStatusDuration('darkness',5);}
 const item=kind==='fire'?ItemLoader.spawnPotion('potion_of_incineration',-1,-1)!:kind==='dart'?ItemLoader.spawnWeapon('incendiary_dart',-1,-1)!:ItemLoader.spawnScroll('scroll_of_negation',-1,-1)!;
 g.player.inventory.addItem(item);recordScene(g);g.onConfirmRequest=()=>true;
 g.submitPartyIntent({kind:'item',operation:kind!=='negation'?'throw':'use',itemId:item.id,target:kind!=='negation'?{...g.party!.stationed.get(id)!.loc}:null},g.player.id);
 roundtrip(g,h=>{const a=h.party!.stationed.get(id)!;if(kind!=='negation')expect((h as any).burningDuration(a)).toBeGreaterThan(0);else expect(a.hasStatus('darkness')).toBe(false);});
},120000);
it('audit: dead, retired and off-level stationed roots never enter the active bolt/DF world',()=>{
 const {g,id,actor}=prepared();
 const absent=()=>expect((g as any).boltWorld(g.player).creatureAt(actor.loc)).toBeUndefined();
 actor.hp=0;absent();actor.hp=actor.maxHp;
 const record=g.world5!.residents.find(r=>r.actorId===id)!;record.levelRef={kind:'dungeon',depth:2};absent();record.levelRef={kind:'dungeon',depth:g.depth};
 retireStationedResident(g,id,'dismiss');expect(actor.hp).toBeGreaterThan(0);absent();
 const before={...actor.loc};applyCatalogFeature(g,actor.loc,DF.DF_ACTIVATE_PORTCULLIS);expect(actor.loc).toEqual(before);
});

it('audit: immediate DF contact, burning light, native stat invalidation and generation occupancy include stationed actors',()=>{
 const {g,actor}=prepared();
 expect((g as any).makeGenerationPorts().controlled).toContain(actor);
 expect((g as any).hasCreatureAtForLight(actor.x,actor.y)).toBe(true);
 expect((g as any).burningDuration(actor)).toBe(0);
 const tick=g.world5!.simulationTicks;
 applyCatalogFeature(g,actor.loc,DF.DF_PLAIN_FIRE);
 expect((g as any).burningDuration(actor)).toBeGreaterThan(0);expect(g.world5!.simulationTicks).toBe(tick);
 const revision=nativeStatRevision(actor),lighting=vi.spyOn(g.lightMap,'updateLighting');
 try{
  g.refreshStructureDerivedState();
  expect(nativeStatRevision(actor)).toBeGreaterThan(revision);
  expect(lighting.mock.calls[lighting.mock.calls.length-1]![0].some(light=>light.x===actor.x&&light.y===actor.y&&!light.isMinersLight)).toBe(true);
  expect(lighting.mock.calls[lighting.mock.calls.length-1]![0].some(light=>light.x===actor.x&&light.y===actor.y&&light.isMinersLight)).toBe(false);
 }finally{lighting.mockRestore();}
});

function rayEnemy(g:Game,x:number,y=13,type='rat'){
 const m=new Monster(x,y,monsters.find(m=>m.id===type) as MonsterData);
 m.hp=m.maxHp=1000;g.monsters.push(m);g.extensionRuntime!.attachCreature(m);return m;
}
function rayScene(combat=false){
 const scene=prepared(combat),{g,actor}=scene;
 // Outside the constructed bedroom: no synthetic terrain under structures.
 g.player.loc={x:22,y:13};actor.loc={x:23,y:13};
 for(let x=22;x<=28;x++)g.grid.setTerrain(x,13,TerrainType.FLOOR);
 g.refreshStructureDerivedState();return scene;
}
it.each([false,true])('F4: public lightning continues after stationed death (reflection=%s), with retirement, load, replay and seek',reflected=>{
 const {g,id,actor}=rayScene();actor.hp=1;
 const rear=rayEnemy(g,24);
 if(reflected)rayEnemy(g,26,13,'stone_guardian');
 const drop=ItemLoader.spawnWeapon('dagger',-1,-1)!;actor.inventory.addItem(drop);
 const staff=ItemLoader.spawnStaff('staff_of_lightning',-1,-1)!;staff.enchantment=3;g.player.inventory.addItem(staff);
 g.refreshStructureDerivedState();recordScene(g);
 g.submitPartyIntent({kind:'item',operation:'use',itemId:staff.id,target:{x:26,y:13}},g.player.id);
 roundtrip(g,h=>{
  expect(h.isGameOver).toBe(false);expect(h.party!.stationed.get(id)!.hp).toBe(0);
  expect(h.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);
  expect(h.world5!.residents.some(r=>r.actorId===id)).toBe(false);
  expect(h.party!.stationed.get(id)!.inventory.items).toHaveLength(0);
  expect(h.items.filter(i=>i.id===drop.id)).toHaveLength(1);
  expect(h.monsters.find(m=>m.id===rear.id)!.hp).toBeLessThan(1000);
  if(reflected)expect(h.player.hp).toBeLessThan(h.player.maxHp);
 });
},120000);
it.each(['stationed-target','stationed-intervening','member'] as const)('F4: monster SPARK lethal %s respects roster identity and terrain continuation',kind=>{
 const {g,id,actor}=rayScene();
 if(kind==='member')roster(g,id,'join');
 const victim=g.party!.actors.get(id)??actor;victim.hp=1;
 g.player.loc={x:25,y:13};
 const caster=rayEnemy(g,22),rear=rayEnemy(g,24);
 const exposure=vi.spyOn(g as any,'applyBoltTerrainAt');
 g.refreshStructureDerivedState();
 const result=g.castMonsterBolt(caster,kind==='stationed-intervening'?rear:victim,'SPARK')!;
 expect(victim.hp).toBe(0);
 expect(result.hits.map(h=>h.creature.id)).toEqual(kind==='member'?[id]:[id,rear.id,g.player.id]);
 expect(rear.hp<1000).toBe(kind!=='member');
 expect(exposure.mock.calls.some(call=>(call[1] as {x:number}).x===23)).toBe(kind!=='member');
 expect(g.isGameOver).toBe(false);
});
it('F4: a fatal non-primary member contact still stops player lightning at the approved boundary',()=>{
 const {g,id}=rayScene();roster(g,id,'join');const member=g.party!.actors.get(id)!;member.hp=1;
 const rear=rayEnemy(g,24),staff=ItemLoader.spawnStaff('staff_of_lightning',-1,-1)!;staff.enchantment=3;
 g.player.inventory.addItem(staff);recordScene(g);
 g.submitPartyIntent({kind:'item',operation:'use',itemId:staff.id,target:{x:24,y:13}},g.player.id);
 roundtrip(g,h=>{
  expect(h.party!.actors.get(id)!.hp).toBe(0);expect(h.monsters.find(m=>m.id===rear.id)!.hp).toBe(1000);
  expect(h.isGameOver).toBe(false);expect(h.party!.state.members.find(r=>r.actorId===id)!.life).toBe('dead');
 });
},120000);
it.each(['dart','weapon'] as const)('audit F4: public thrown %s hits the intervening stationed actor instead of passing through',kind=>{
 const {g,id,actor}=rayScene();actor.hp=kind==='weapon'?1:actor.maxHp;actor.setStatusDuration('paralyzed',10);
 const rear=rayEnemy(g,26);
 const item=ItemLoader.spawnWeapon(kind==='dart'?'incendiary_dart':'dagger',-1,-1)!;
 item.damage='10-10';g.player.inventory.addItem(item);recordScene(g);
 g.submitPartyIntent({kind:'item',operation:'throw',itemId:item.id,target:{x:26,y:13}},g.player.id);
 roundtrip(g,h=>{
  const a=h.party!.stationed.get(id)!;
  if(kind==='weapon'){expect(a.hp).toBe(0);expect(h.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);}
  else expect((h as any).burningDuration(a)).toBeGreaterThan(0);
  expect(h.monsters.find(m=>m.id===rear.id)!.hp).toBe(1000);
  expect(h.isGameOver).toBe(false);
 });
},120000);
it('audit F4: locked area segment includes stationed actors and continues after their death',()=>{
 const {g,actor}=rayScene();g.player.loc={x:23,y:14};actor.hp=1;
 const source=rayEnemy(g,22);source.state=MonsterState.HUNTING;source.damageString='10-10';
 actor.setStatusDuration('paralyzed',10);g.player.setStatusDuration('paralyzed',10);
 g.refreshStructureDerivedState();
 const authority=new ActorCombatResolutionAuthority(g,{schema:1,nextResolutionId:1,actors:[]});
 const plans=authority.prepareLockedBodySegment({kind:'locked-body-segment',depth:g.depth,sourceEntityId:source.id,
  sourceFootprintVersion:sourceFootprintVersion(g.spatialOf(source)),
  shape:{schema:1,kind:'footprint-offset-union',offsets:[{x:1,y:0},{x:1,y:1}],selfExclusion:'source-member'},
  lockedCells:[{x:23,y:13},{x:23,y:14}],approvedRisks:[],dodgeable:false,parryable:false});
 expect(plans.map(p=>p.intent.targetEntityId)).toEqual([actor.id,g.player.id]);
 const hp=g.player.hp;
 withActorActionScope(g,'npc-scheduler',source.id,scope=>{for(const plan of plans)authority.commitNativeMelee(scope,plan);});
 expect(actor.hp).toBe(0);expect(g.player.hp).toBeLessThan(hp);
});
it.each(['stationed','member'] as const)('audit F4: explosion fill continues after %s death and reaches later cells',kind=>{
 const {g,id,actor}=rayScene();
 if(kind==='member')roster(g,id,'join');
 const victim=g.party!.actors.get(id)??actor;victim.hp=1;g.player.loc={x:28,y:13};
 const rear=rayEnemy(g,24);
 applyCatalogFeature(g,{x:23,y:13},DF.DF_BLOAT_EXPLOSION);
 expect(victim.hp).toBe(0);expect(rear.hp).toBeLessThan(1000);
 expect(g.isGameOver).toBe(false);
 if(kind==='stationed')expect(g.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);
 else expect(g.party!.state.members.find(r=>r.actorId===id)!.life).toBe('dead');
});
it.each(['spear','sweep'] as const)('audit F4: hostile %s includes stationed and member contacts without truncating its target list',kind=>{
 const {g,actor}=rayScene(),source=rayEnemy(g,22);source.state=MonsterState.HUNTING;source.damageString='10-10';
 g.player.loc=kind==='spear'?{x:24,y:13}:{x:23,y:14};actor.hp=1;
 actor.setStatusDuration('paralyzed',10);g.player.setStatusDuration('paralyzed',10);g.refreshStructureDerivedState();
 const hp=g.player.hp;
 if(kind==='spear')expect((source as any).performSpearAttack(g,1,0)).toBe(true);
 else (source as any).performSweepAttack(g,actor);
 expect(actor.hp).toBe(0);expect(g.player.hp).toBeLessThan(hp);
});
it('audit F4: force collision damages the stationed obstacle as well as the launched target',()=>{
 const {g,actor}=rayScene();actor.loc={x:26,y:13};
 const target=rayEnemy(g,23),weapon=ItemLoader.spawnWeapon('sword',-1,-1)!;weapon.runicType='force';weapon.enchantment=4;
 g.player.inventory.addItem(weapon);g.player.equippedWeapon=weapon;g.refreshStructureDerivedState();
 const hp=actor.hp;
 (g as any).applyWeaponRunicEffect(target,1,'force');
 expect(target.loc).toEqual({x:25,y:13});expect(target.hp).toBe(998);expect(actor.hp).toBe(hp-2);
});
it('audit F4: a real combat area attack reaches stationed victims across public wait, save, replay and seek',()=>{
 const {g,id,actor}=rayScene(true);actor.hp=1;actor.setStatusDuration('paralyzed',10);
 g.player.loc={x:23,y:14};
 const source=rayEnemy(g,22,13,'ogre');source.state=MonsterState.HUNTING;source.ticksUntilTurn=0;source.damageString='10-10';source.accuracy=10000;markStatsDirty(source);
 g.refreshStructureDerivedState();recordScene(g);
 for(let n=0;n<8&&!g.party!.state.retired.some(r=>r.actorId===id);n++){clear();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);}
 roundtrip(g,h=>{
  expect(h.party!.stationed.get(id)!.hp).toBe(0);
  expect(h.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);
  expect(h.player.hp).toBeLessThan(h.player.maxHp);
  expect(h.isGameOver).toBe(false);
 });
},120000);
it('audit F4: native residents retain lightning penetration after death',()=>{
 const {g,a}=residentScene(['party','settlement'],false,(options,config)=>
  createConfiguredWorldHarness(options,{...config,party:{schema:1,members:1}}));
 g.player.loc={x:22,y:13};a.loc={x:23,y:13};a.hp=1;
 const rear=rayEnemy(g,24),staff=ItemLoader.spawnStaff('staff_of_lightning',-1,-1)!;staff.enchantment=3;
 g.refreshStructureDerivedState();
 const result=g.zapBoltFromPlayer(getBoltForItem('staff_of_lightning')!,staff,rear.loc);
 expect(result.hits.map(h=>h.creature.id)).toEqual([a.id,rear.id]);expect(a.hp).toBe(0);expect(rear.hp).toBeLessThan(1000);
});
it('audit F4: lethal non-piercing fire still stops at the resident but exposes its cell to fire',()=>{
 const {g,actor}=rayScene();actor.hp=1;const rear=rayEnemy(g,24);
 const staff=ItemLoader.spawnStaff('staff_of_fire',-1,-1)!;staff.enchantment=3;
 const exposure=vi.spyOn(g as any,'applyBoltTerrainAt');
 const result=g.zapBoltFromPlayer(getBoltForItem('staff_of_fire')!,staff,rear.loc);
 expect(result.hits.map(h=>h.creature.id)).toEqual([actor.id]);expect(rear.hp).toBe(1000);
 expect(actor.hp).toBe(0);expect(exposure.mock.calls.some(call=>(call[1] as {x:number}).x===23)).toBe(true);
});
it('audit F4: public incineration affects the later neighbor after the stationed victim dies; load/replay/seek',()=>{
 const {g,id,actor}=rayScene();actor.hp=1;actor.setStatusDuration('paralyzed',10);
 const rear=rayEnemy(g,24);rear.ticksUntilTurn=10000;
 const potion=ItemLoader.spawnPotion('potion_of_incineration',-1,-1)!;g.player.inventory.addItem(potion);
 g.refreshStructureDerivedState();recordScene(g);
 g.submitPartyIntent({kind:'item',operation:'throw',itemId:potion.id,target:{x:26,y:13}},g.player.id);
 roundtrip(g,h=>{
  expect(h.party!.stationed.get(id)!.hp).toBe(0);
  expect(h.party!.state.retired.filter(r=>r.actorId===id)).toHaveLength(1);
  const later=h.monsters.find(m=>m.id===rear.id)!;expect(later.hp).toBeLessThan(1000);
  expect((h as any).burningDuration(later)).toBeGreaterThan(0);expect(h.isGameOver).toBe(false);
 });
},120000);
