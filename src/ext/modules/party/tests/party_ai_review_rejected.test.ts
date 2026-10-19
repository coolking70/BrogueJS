import {afterEach,it,expect,vi} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {TerrainType} from '../../../../engine/Map/Grid';
import {commitCreatureAnchor} from '../../../../engine/Movement/CreatureSpatial';
import {logger} from '../../../../engine/Systems/Logger';
import {timeSystem} from '../../../../engine/Systems/Time';
import {rng} from '../../../../engine/Random';
import {getNextEntityId} from '../../../../entities/Creature';
import {decidePartyAi} from '../../../../engine/Core/PartyAi';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
afterEach(()=>{vi.restoreAllMocks();clear();});
it.each([true,false])('R2 expected rejected stale-memory wall: AI=%s',ai=>{
 const g=new Game({seed:1}),h=new Game({seed:1});try{
 g.startNewGame({seed:42,ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:2}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:2}})]});g.animationEnabled=false;clear();
 const [a,b]=g.controlledActors;g.monsters=[];g.dormantMonsters=[];g.items=[];
 for(let y=10;y<21;y++)for(let x=15;x<31;x++){g.grid.setTerrain(x,y,TerrainType.FLOOR);const c=g.grid.getCell(x,y)!;c.isVisible=false;c.hasMemory=true;c.rememberedFlags={passable:true,opaque:false,trapFree:true};c.rememberedTerrain=TerrainType.FLOOR;}
 commitCreatureAnchor(a!,{x:20,y:15});commitCreatureAnchor(b!,{x:25,y:15});g.grid.setTerrain(21,15,TerrainType.WALL);const wall=g.grid.getCell(21,15)!;wall.isVisible=false;wall.hasMemory=true;wall.rememberedFlags={passable:true,opaque:false,trapFree:true};
 g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:a!.id,change:{kind:'leader',actorId:b!.id}});
 if(ai)g.executeCommand('party:ai',{kind:'party:ai',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',change:{kind:'controller',actorId:a!.id,expectedEpoch:0,controller:{kind:'ai',policyId:'party-ai-v1'}}});
 if(ai)expect(decidePartyAi(g,a!.id).intent).toEqual({kind:'move',dx:1,dy:0});
 const attempts:any[]=[];const original=(g as any).attemptWindowIntent.bind(g);vi.spyOn(g as any,'attemptWindowIntent').mockImplementation((...args:any[])=>{const before=mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState()),r=rng.getState(),id=getNextEntityId();const result=original(...args);attempts.push({intent:args[1],result});if(ai&&result.rejected){expect(mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState())).toEqual(before);expect(rng.getState()).toEqual(r);expect(getNextEntityId()).toBe(id);}return result;});
 const before=timeSystem.currentTick;clear();g.submitPartyWindow({kind:'party:window',schema:2,seq:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',startTick:before,length:{kind:'ticks',ticks:100},fineActorId:null,automatic:false,trigger:'manual',plans:ai?[]:[{actorId:a!.id,controllerSlot:'local:0',update:'replace',plan:{kind:'queue',actions:[{kind:'move',dx:1,dy:0}]}}]});
 expect(attempts[0].result.rejected).toBe(true);expect(a!.loc).toEqual({x:20,y:15});
 if(ai){expect(attempts[1].intent).toEqual({kind:'wait'});expect(timeSystem.currentTick-before).toBe(100);expect(g.party!.state.members[0]!.ai.ordinal).toBe(1);expect(g.party!.state.window.receipt!.trace.filter(t=>t.actorId===a!.id)).toMatchObject([{intent:{kind:'wait'},outcome:'accepted',chargedTicks:100}]);expect(g.party!.state.window.receipt!.interrupts.some(f=>f.kind==='plan-invalid')).toBe(false);}else{expect(timeSystem.currentTick-before).toBe(0);expect(g.party!.state.window.receipt!.interrupts.some(f=>f.kind==='plan-invalid')).toBe(true);expect(g.party!.state.members[0]!.ai.ordinal).toBe(0);}
 const saved=JSON.parse(JSON.stringify(g.toSaveSnapshot()));expect(h.loadSnapshot(saved)).toBe(true);expect(h.party!.state).toEqual(g.party!.state);
 }finally{g.disposeRecording();h.disposeRecording();}
});
