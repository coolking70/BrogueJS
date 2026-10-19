import {timeSystem} from '../../../../engine/Systems/Time';
import type {ActorIntent} from '../../../party';
import {it,expect} from 'vitest';
import '../../../../i18n';
import {TerrainType} from '../../../../engine/Map/Grid';
import {Game} from '../../../../engine/Core/Game';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
import {rng} from '../../../../engine/Random';
import {createExtensionRegistry} from '../../../catalog';
import {logger} from '../../../../engine/Systems/Logger';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
function start(combat=false){const ids=combat?['party','combat']:['party'],registry=createExtensionRegistry();const initialCommands=registry.create(registry.manifest(ids)).flatMap(m=>m.initialCommand?[JSON.stringify({module:m.id,...m.initialCommand})]:[]);const g=new Game({seed:1});g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:ids,initialCommands});g.animationEnabled=false;return g;}
const digest=(g:Game)=>mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState());
function clear(){while(logger.pendingAcknowledgment)logger.acknowledgeNext();}
function travel(g:Game,depth:number,leave:number[]=[],actorId=g.readyPartyActorId){clear();g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId,change:{kind:'travel-party',destination:{kind:'dungeon',depth},leavingBehind:leave}});}
it('freezes a distant member, preserves its resources, and reactivates it on return',()=>{
 const g=start();try{const a=g.player,b=g.controlledActors[1]!,before={loc:{...b.loc},hp:b.hp,nutrition:b.nutrition,ticks:b.ticksUntilTurn};const stairs=(g as any).levelSeeds[0].downStairsLoc;commitCreatureAnchor(a,stairs);
 expect(()=>travel(g,2)).toThrow('TRAVEL_NOT_READY');expect(g.depth).toBe(1);travel(g,2,[b.id]);expect(g.depth).toBe(2);expect(g.party!.state.members[1]!.life).toBe('frozen');
 for(let i=0;i<4;i++){clear();g.submitPartyIntent({kind:'wait'},a.id);}
 expect({loc:b.loc,hp:b.hp,nutrition:b.nutrition,ticks:b.ticksUntilTurn}).toEqual(before);
 const save=g.toSaveSnapshot(),h=new Game({seed:1});try{expect(h.loadSnapshot(JSON.parse(JSON.stringify(save)))).toBe(true);expect(h.party!.state.members[1]!.life).toBe('frozen');}finally{h.disposeRecording();}
 commitCreatureAnchor(a,(g as any).levelSeeds[1].upStairsLoc);travel(g,1);expect(g.party!.state.members.every(m=>m.life==='active')).toBe(true);expect(b.loc).toEqual(before.loc);
 }finally{g.disposeRecording();}
},120000);
it.each([['single',false],['window',false],['single',true],['window',true]] as const)('walks both members through a natural first floor using %s, combat=%s, and replays the complete prefix',(mode,combat)=>{
 const g=start(combat);let h:Game|undefined;try{
 const step=(intent:ActorIntent,id:number)=>{if(mode==='single')g.submitPartyIntent(intent,id);else g.submitPartyWindow({kind:'party:window',schema:2,seq:g.party!.state.window.seq+1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:timeSystem.currentTick,length:{kind:'fine'},fineActorId:id,automatic:false,trigger:'manual',plans:[{actorId:id,controllerSlot:'local:0',update:'replace',plan:{kind:'queue',actions:[intent]}}]});};
 const key=(x:number,y:number)=>`${x},${y}`,lead=g.controlledActors[1]!;
 for(let steps=0;steps<1400&&g.depth===1;steps++){
  clear();const stairsAt=(g as any).levelSeeds[0].downStairsLoc;const id=mode==='window'?(lead.x===stairsAt.x&&lead.y===stairsAt.y?g.player.id:lead.id):g.readyPartyActorId;expect(id).not.toBeNull();const actor=g.controlledActors.find(a=>a.id===id)!,stairs=(g as any).levelSeeds[0].downStairsLoc;
  const close=g.activeControlledActors.every(a=>Math.abs(a.x-stairs.x)+Math.abs(a.y-stairs.y)<=1);
  if(close&&lead.x===stairs.x&&lead.y===stairs.y&&g.activeControlledActors.every(a=>a.ticksUntilTurn===0)){travel(g,2,[],lead.id);break;}
  if(actor!==lead&&(lead.x!==stairs.x||lead.y!==stairs.y)){step({kind:'wait'},id!);continue;}
  if(actor!==lead&&Math.abs(actor.x-stairs.x)+Math.abs(actor.y-stairs.y)<=1){step({kind:'wait'},id!);continue;}
  if(actor===lead&&actor.x===stairs.x&&actor.y===stairs.y){step({kind:'wait'},id!);continue;}
  const queue=[{x:actor.x,y:actor.y}],prior=new Map<string,{x:number;y:number}|null>([[key(actor.x,actor.y),null]]);let goal:{x:number;y:number}|undefined;
  for(let index=0;index<queue.length;index++){const p=queue[index]!;if((actor===lead?p.x===stairs.x&&p.y===stairs.y:Math.abs(p.x-stairs.x)+Math.abs(p.y-stairs.y)<=1)){goal=p;break;}
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx!,y:p.y+dy!},cell=g.grid.getCell(n.x,n.y);if(!cell||!(cell.isPassable||cell.layers.includes(TerrainType.DOOR))||prior.has(key(n.x,n.y))||g.activeControlledActors.some(a=>a!==actor&&a.x===n.x&&a.y===n.y))continue;prior.set(key(n.x,n.y),p);queue.push(n);}
  }
  if(!goal){step({kind:'wait'},id!);continue;}
  let next=goal;for(let p=prior.get(key(next.x,next.y));p&&!(p.x===actor.x&&p.y===actor.y);p=prior.get(key(next.x,next.y)))next=p;
  step({kind:'move',dx:next.x-actor.x,dy:next.y-actor.y},id!);
 }
 expect(g.depth,JSON.stringify({positions:g.controlledActors.map(a=>({id:a.id,loc:a.loc,hp:a.hp,ticks:a.ticksUntilTurn})),stairs:(g as any).levelSeeds[0].downStairsLoc})).toBe(2);expect(g.activeControlledActors).toHaveLength(2);clear();const expected=digest(g),random=rng.getState(),record=g.exportRecording(),save=JSON.parse(JSON.stringify(g.toSaveSnapshot()));
 h=new Game({seed:1});expect(h.loadSnapshot(save)).toBe(true);expect(digest(h)).toEqual(expected);expect(rng.getState()).toEqual(random);
 expect(h.loadReplay(record)).toBe(true);while(h.replayCursor<record.events.length&&!h.replayError){clear();h.replayStep(true);}expect(h.replayError).toBeNull();expect(h.depth).toBe(2);expect(h.controlledActors.map(a=>a.loc)).toEqual(g.controlledActors.map(a=>a.loc));expect(digest(h)).toEqual(expected);expect(rng.getState()).toEqual(random);
 h.replaySeek(record.events.length-1);expect(h.replayError).toBeNull();expect(h.depth).toBe(1);
 h.replaySeek(record.events.length);expect(h.replayError).toBeNull();expect(digest(h)).toEqual(expected);expect(rng.getState()).toEqual(random);
 }finally{g.disposeRecording();h?.disposeRecording();}
},180000);
it('a secondary fall freezes the primary, and frozen survivors can recover after active death',()=>{
 const g=start();try{const a=g.player,b=g.controlledActors[1]!,origin={...a.loc};
 for(let y=b.y-1;y<=b.y+1;y++)for(let x=b.x-1;x<=b.x+1;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR,'.',0x888888);
 const at={x:b.x-1,y:b.y};g.grid.setTerrain(at.x,at.y,TerrainType.CHASM,' ',0x222222);g.grid.getCell(at.x,at.y)!.isDiscovered=true;g.monsters.length=0;
 clear();g.submitPartyIntent({kind:'wait'},a.id);clear();g.submitPartyIntent({kind:'move',dx:-1,dy:0},b.id);
 expect(g.depth).toBe(2);expect(a.loc).toEqual(origin);expect(g.party!.state.members[0]!.life).toBe('frozen');expect(g.party!.state.members[1]!.life).toBe('active');
 b.hp=0;g.triggerGameOver(false,'fixture');expect(g.isGameOver).toBe(false);clear();g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:a.id,change:{kind:'recover-level',destination:{kind:'dungeon',depth:1}}});expect(g.depth).toBe(1);expect(g.activeControlledActors.map(a=>a.id)).toEqual([a.id]);
 const finalSave=g.toSaveSnapshot();const h=new Game({seed:1});try{expect(h.loadSnapshot(finalSave,message=>console.error(message))).toBe(true);}finally{h.disposeRecording();}
 }finally{g.disposeRecording();}
},120000);
