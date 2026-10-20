import { it, expect } from 'vitest';
import '../../../../i18n';
import { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { mechanicalDigest } from '../../../../engine/Core/RecordingDigest';
import { residentComponent, residentRecord, inResidentCamp } from '../../../../engine/Core/ResidentWorld';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';
import { TerrainType } from '../../../../engine/Map/Grid';
import { hasInteractionLine } from '../../../worldSpatial';
import { nativeStat } from '../../../../engine/Stats/NativeStatSources';
import route from '../../settlement/tests/resident-natural-route.json';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
const digest=(g:Game)=>mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
function wait(g:Game){clear();expect(g.readyPartyActorId).not.toBeNull();g.submitPartyIntent({kind:'wait'},g.readyPartyActorId!);}
function idle(g:Game){for(let n=0;n<80&&g.activeControlledActors.some(a=>a.ticksUntilTurn>0);n++)wait(g);expect(g.activeControlledActors.every(a=>a.ticksUntilTurn===0)).toBe(true);}
function roster(g:Game,id:number,operation:'join'|'station'){
 clear();g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,targetId:id,operation,campId:operation==='station'?route.campId:null,level:{kind:'dungeon',depth:g.depth}});
}
/** Only public movement follows the actual moving resident after its paid recruit. */
function approach(g:Game,id:number){
 for(let count=0;count<200;count++){
  idle(g);
  const actor=g.party!.actors.get(id)??g.monsters.find(m=>m.id===id)!;expect(actor).toBeTruthy();
  if(Math.max(Math.abs(g.player.x-actor.x),Math.abs(g.player.y-actor.y))<=1&&hasInteractionLine(g.grid,g.player.loc,actor.loc))return;
  const key=(p:{x:number;y:number})=>`${p.x},${p.y}`,queue=[{...g.player.loc}],previous=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);
  let found:{x:number;y:number}|undefined;
  for(let n=0;n<queue.length&&!found;n++){
   const at=queue[n]!;
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const p={x:at.x+dx!,y:at.y+dy!},cell=g.grid.getCell(p.x,p.y);
    if(!cell?.isPassable||cell.layers.some(t=>[TerrainType.LAVA,TerrainType.CHASM,TerrainType.WATER_DEEP].includes(t))||!cell.hasMemory&&!cell.isExplored&&!cell.isVisible||g.getMonsterAt(p.x,p.y)||previous.has(key(p)))continue;
    previous.set(key(p),at);queue.push(p);
    if(Math.max(Math.abs(p.x-actor.x),Math.abs(p.y-actor.y))<=1&&hasInteractionLine(g.grid,p,actor.loc)){found=p;break;}
   }
  }
  expect(found,'known public route to the real recruited resident').toBeTruthy();let next=found!;
  for(let p=previous.get(key(next));p&&key(p)!==key(g.player.loc);p=previous.get(key(next)))next=p;
  clear();g.submitPartyIntent({kind:'move',dx:next.x-g.player.x,dy:next.y-g.player.y},g.player.id);expect(g.isGameOver).toBe(false);
 }
 throw Error('Natural resident contact did not converge');
}
/** The natural recruit is west of the camp. Walk the joined member through
 * observed safe cells before requesting station; no placement or camp edits. */
function enterCamp(g:Game,id:number){
 const camp=g.extensionRuntime!.worldCampRecord('settlement',route.campId)!;
 for(let count=0;count<100;count++){
  idle(g);const actor=g.party!.actors.get(id)!;
  if(inResidentCamp(g,camp,actor.loc))return;
  const key=(p:{x:number;y:number})=>`${p.x},${p.y}`,queue=[{...actor.loc}],previous=new Map<string,{x:number;y:number}|null>([[key(actor.loc),null]]);
  let found:{x:number;y:number}|undefined;
  for(let n=0;n<queue.length&&!found;n++){
   const at=queue[n]!;
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const p={x:at.x+dx!,y:at.y+dy!},cell=g.grid.getCell(p.x,p.y);
    if(!cell?.isPassable||cell.layers.some(t=>[TerrainType.LAVA,TerrainType.CHASM,TerrainType.WATER_DEEP].includes(t))||!cell.hasMemory&&!cell.isExplored&&!cell.isVisible||g.getMonsterAt(p.x,p.y)||g.activeControlledActors.some(a=>a.id!==id&&a.x===p.x&&a.y===p.y)||previous.has(key(p)))continue;
    previous.set(key(p),at);queue.push(p);
    if(inResidentCamp(g,camp,p)){found=p;break;}
   }
  }
  expect(found,'known public route into the original paid camp').toBeTruthy();let next=found!;
  for(let p=previous.get(key(next));p&&key(p)!==key(actor.loc);p=previous.get(key(next)))next=p;
  // Equal clocks still dispatch in deterministic actor order. Pay the earlier
  // member's public wait before submitting this member's movement.
  for(let n=0;n<8&&g.readyPartyActorId!==id;n++)wait(g);
  expect(g.readyPartyActorId).toBe(id);
  clear();g.submitPartyIntent({kind:'move',dx:next.x-actor.x,dy:next.y-actor.y},id);expect(g.isGameOver).toBe(false);
 }
 throw Error('Natural camp entry did not converge');
}
it('seed28 original public recruit prefix supports resident roster roundtrip, seed replay, bidirectional seek and continuation',()=>{
 const g=new Game({seed:1}),h=new Game({seed:2});
 try{
  g.startNewGame({seed:route.seed,mode:'normal',ruleSet:'extended',extensions:['party','settlement'],extensionConfigurations:{party:{schema:1,members:1}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:1}})]});g.animationEnabled=false;clear();
  const id=g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId!;
  expect(id).toBe(route.actorId);const original=g.monsters.find(m=>m.id===id)!;expect(original.loc).toEqual(route.checkpoints[0]!.actorLocation);
  let logical=0;
  prefix:for(const step of route.steps)for(let repetition=0;repetition<step.count;repetition++){
   if(logical===route.milestones.recruitYes)break prefix;
   logical++;clear();const answers=[...step.decisions],before=g.world5!.simulationTicks;
   g.onConfirmRequest=()=>answers.shift()??true;
   try{
    if(step.action==='move'){const d=step.data as {x:number;y:number};g.submitPartyIntent({kind:'move',dx:d.x,dy:d.y},g.player.id);}
    else if(step.action==='wait'||step.action==='search')g.submitPartyIntent({kind:step.action},g.player.id);
    else if(step.action==='ext:command'){const input=JSON.parse(step.data as string);g.submitPartyIntent({kind:'module',owner:input.module,commandId:input.action,payload:input.payload},g.player.id);}
    else throw Error(`Unsupported original input ${step.action}`);
    while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,answers.shift()??true);
    while(g.party!.state.window.decision){expect(g.party!.state.window.decision!.kind).toBe('confirm');g.choosePartyDecision((answers.shift()??true)?'yes':'no');}
   }catch(error){throw new Error(`Natural prefix logical ${logical}, ${step.action}, at ${JSON.stringify(g.player.loc)}, tick ${g.world5!.simulationTicks}: ${String(error)}`);}
   expect(answers,`original decisions at ${logical}`).toHaveLength(0);expect(g.isGameOver,`logical ${logical}`).toBe(false);
   if(step.action==='ext:command')expect(worldWorkLastError(g),`logical ${logical}: ${step.data}`).toBeNull();
   if(logical===route.milestones.recruitNo){expect(g.world5!.simulationTicks).toBe(before);expect(residentRecord(g,id)).toBeUndefined();}
   if(logical===route.milestones.recruitYes){expect(g.world5!.simulationTicks-before).toBe(100);expect(residentComponent(g,id)).toMatchObject({campId:route.campId,bedId:route.bedId});}
  }
  expect(logical).toBe(388);expect(g.monsters.find(m=>m.id===id)).toBe(original);expect(g.extensionRuntime!.residentComponent<{consumed:boolean}>('settlement',id,'source')?.consumed).toBe(true);
  approach(g,id);idle(g);const beforeIndex=g.recordedInputEvents.length,before=digest(g),hp=original.hp;
  roster(g,id,'join');const actor=g.party!.actors.get(id)!;expect(actor.hp).toBe(hp);idle(g);
  enterCamp(g,id);approach(g,id);idle(g);
  roster(g,id,'station');expect(g.party!.stationed.get(id)).toBe(actor);const stationIndex=g.recordedInputEvents.length,station=digest(g),stationStealth=nativeStat(actor,'native.stealth-range'),stationSave=clone(g.toSaveSnapshot());
  roster(g,id,'join');expect(g.party!.actors.get(id)).toBe(actor);expect(residentRecord(g,id)).toBeUndefined();
  const endIndex=g.recordedInputEvents.length,final=digest(g),save=clone(g.toSaveSnapshot()),record=clone(g.exportRecording());
  if(process.env.PARTY_P1D_RESIDENT_CAPTURE){const directory=process.env.PARTY_P1D_RESIDENT_CAPTURE;mkdirSync(directory,{recursive:true});for(const [name,value]of [['natural-resident-roundtrip-save',save],['natural-resident-recording',record]]as const)writeFileSync(join(directory,name+'.json'),JSON.stringify(value)+'\n');}
  expect(h.loadSnapshot(stationSave,message=>console.error(message))).toBe(true);expect(nativeStat(h.party!.stationed.get(id)!,'native.stealth-range')).toBe(stationStealth);
  expect(h.loadSnapshot(save,message=>console.error(message))).toBe(true);expect(digest(h)).toEqual(final);expect(h.loadReplay(record)).toBe(true);h.animationEnabled=false;
  for(const [index,expected]of [[endIndex,final],[beforeIndex,before],[stationIndex,station],[endIndex,final]]as const){h.replaySeek(index);expect(h.replayError).toBeNull();expect(h.replayCursor).toBe(index);expect(digest(h)).toEqual(expected);if(index===stationIndex)expect(nativeStat(h.party!.stationed.get(id)!,'native.stealth-range')).toBe(stationStealth);}
  expect(h.loadSnapshot(save)).toBe(true);h.animationEnabled=false;wait(h);const continued=digest(h),extended=clone(h.exportRecording());expect(extended.events.length).toBe(endIndex+1);
  expect(g.loadReplay(extended)).toBe(true);g.animationEnabled=false;g.replaySeek(extended.events.length);expect(g.replayError).toBeNull();expect(digest(g)).toEqual(continued);
 }finally{g.disposeRecording();h.disposeRecording();}
},360000);
