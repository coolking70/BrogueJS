import {afterEach,it,expect,vi} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {Monster,MonsterState} from '../../../../entities/Monster';
import {getNextEntityId} from '../../../../entities/Creature';
import catalog from '../../../../data/monsters.json';
import {TerrainType} from '../../../../engine/Map/Grid';
import {logger} from '../../../../engine/Systems/Logger';
import {rng} from '../../../../engine/Random';
import {timeSystem} from '../../../../engine/Systems/Time';
import {validatePartyState} from '../../../party';
import {nativeStat} from '../../../../engine/Stats/NativeStatSources';
import {markStatsDirty} from '../../../../engine/Stats/NativeStatSources';
import {CombatSystem} from '../../../../engine/Combat/Combat';
import {auditFullObjectGraph,fullGenerationRoots} from '../../../../test/support/fullGenerationCheckpointOracle';
const games:Game[]=[];
const clear=()=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();};
function start(n=1){const g=new Game({seed:1});games.push(g);g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:n}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:n}})]});g.animationEnabled=false;clear();return g;}
function captive(g:Game){const m=new Monster(g.player.x+1,g.player.y,catalog.find(x=>x.id==='goblin') as any);g.grid.setTerrain(m.x,m.y,TerrainType.FLOOR);g.monsters.push(m);m.isCaged=true;m.state=MonsterState.WANDERING;g.extensionRuntime!.attachCreature(m);return m;}
function input(g:Game,id:number){return {kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,targetId:id,operation:'join',campId:null,level:{kind:'dungeon',depth:g.depth}};}
function rescue(g:Game,m:Monster){(g as any).becomeAllyWith(m);clear();}
afterEach(()=>{games.splice(0).forEach(g=>g.disposeRecording());vi.restoreAllMocks();logger.reset();});
it('requires actual rescue provenance and preserves native resources, ID, clocks and streams',()=>{
 const g=start(),m=captive(g),req=input(g,m.id);expect(()=>g.executeCommand('party:roster',req)).toThrow('INVALID_TARGET');
 rescue(g,m);m.hp=6;m.regenCounter=7;const before={random:rng.getState(),id:getNextEntityId(),tick:timeSystem.currentTick,events:g.recordedInputEvents.length};
 g.executeCommand('party:roster',input(g,m.id));const a=g.party!.actors.get(m.id)!;
 expect(a).toBeDefined();expect(a).not.toBe(m);expect(a.hp).toBe(6);expect(a.maxHp).toBe(m.maxHp);expect(a.statusDurations).toEqual(m.statusDurations);
 expect(nativeStat(a,'native.accuracy')).toBe(nativeStat(m,'native.accuracy'));expect(nativeStat(a,'native.defense')).toBe(nativeStat(m,'native.defense'));expect(a.partyProfile?.penetrate).toBe(true);expect(a.bloodType).toBe(m.bloodType);
 expect(g.monsters.includes(m)).toBe(false);expect(g.controlledActors.filter(x=>x.id===m.id)).toEqual([a]);expect(rng.getState()).toEqual(before.random);expect(getNextEntityId()).toBe(before.id);expect(timeSystem.currentTick).toBe(before.tick);expect(g.recordedInputEvents.length).toBe(before.events+1);
 expect(g.party!.state.initialActorIds).toEqual([g.player.id]);expect(g.party!.state.sources.find(s=>s.actorId===m.id)?.kind).toBe('rescue');expect(()=>validatePartyState(g.party!.state)).not.toThrow();
 const snapshot=JSON.parse(JSON.stringify(g.toSnapshot())),h=new Game({seed:1});games.push(h);expect(h.loadSnapshot(snapshot)).toBe(true);expect(h.party!.actors.get(m.id)?.hp).toBe(6);expect(h.party!.state).toEqual(g.party!.state);
});
it.each([1,2,4])('capacity is living roster including frozen (%i initial)',n=>{const g=start(n),m=captive(g);rescue(g,m);const before=g.toSnapshot(),events=g.recordedInputEvents.length;
 if(n===4){expect(()=>g.executeCommand('party:roster',input(g,m.id))).toThrow('NO_SPACE');expect(g.recordedInputEvents.length).toBe(events);expect(g.party!.state).toEqual(before.party!.state);}else{g.executeCommand('party:roster',input(g,m.id));expect(g.party!.state.members.length).toBe(n+1);}
});
it.each(['replace','emit','vision'])('late %s failure restores the full native graph and recorded prefix',phase=>{
 const g=start(),m=captive(g);rescue(g,m);const request=input(g,m.id),random=rng.getState(),id=getNextEntityId(),events=structuredClone(g.recordedInputEvents),actor=g.player,root=g.party;
 if(phase==='replace')vi.spyOn(g.extensionRuntime!,'replacePartyCreature').mockImplementation(()=>{throw Error('injected');});
 if(phase==='emit'){const emit=g.extensionRuntime!.emit.bind(g.extensionRuntime!);vi.spyOn(g.extensionRuntime!,'emit').mockImplementation((event,data)=>{if(event==='partyRosterChanged')throw Error('injected');return emit(event,data as any);});}
 if(phase==='vision')vi.spyOn(g as any,'updateVision').mockImplementation(()=>{throw Error('injected');});
 const audit=auditFullObjectGraph(fullGenerationRoots(g),[g.extensionRuntime!]);
 expect(()=>g.executeCommand('party:roster',request)).toThrow('injected');expect(g.party).toBe(root);expect(g.player).toBe(actor);expect(g.monsters.includes(m)).toBe(true);expect(g.recordedInputEvents).toEqual(events);expect(rng.getState()).toEqual(random);expect(getNextEntityId()).toBe(id);expect(audit.differences()).toEqual([]);
});
it('rejects unknown source keys, old state and manufactured static roster expansions',()=>{const g=start(),s=structuredClone(g.party!.state);expect(()=>validatePartyState({...s,schema:3})).toThrow();s.members.push({...s.members[0]!,actorId:999});s.window.members.push({...s.window.members[0]!,actorId:999});expect(()=>validatePartyState(s)).toThrow();});
it('busy, stale and wrong layer refusals leave the command prefix and RNG intact',()=>{const g=start(),m=captive(g);rescue(g,m);const req=input(g,m.id),events=g.recordedInputEvents.length,random=rng.getState();
 expect(()=>g.executeCommand('party:roster',{...req,expectedRevision:req.expectedRevision-1})).toThrow('STALE_REVISION');expect(()=>g.executeCommand('party:roster',{...req,level:{kind:'dungeon',depth:2}})).toThrow('INVALID_TARGET');g.player.ticksUntilTurn=20;expect(()=>g.executeCommand('party:roster',req)).toThrow('ACTOR_BUSY');expect(g.recordedInputEvents.length).toBe(events);expect(rng.getState()).toEqual(random);
});
it.each(['resolveAttack','resolveAttackExtended'])('retains native unarmed damage and weakness through real %s',method=>{
 const g=start(),m=captive(g);rescue(g,m);
 const enemy=new Monster(30,15,catalog.find(x=>x.id==='goblin') as any);
 enemy.state=MonsterState.HUNTING;enemy.hp=enemy.maxHp=1000;g.monsters.push(enemy);g.extensionRuntime!.attachCreature(enemy);
 const solve=(CombatSystem as any)[method].bind(CombatSystem),values:number[]=[],expected:number[]=[];
 for(const weakness of [0,2])for(let seed=1;seed<=12;seed++){m.weaknessAmount=weakness;markStatsDirty(m);rng.seedRandomGenerator(seed);enemy.hp=1000;expected.push(solve(m,enemy,{lungeAttack:true}).damage);}
 m.weaknessAmount=0;g.executeCommand('party:roster',input(g,m.id));const actor=g.party!.actors.get(m.id)!;
 for(const weakness of [0,2]){
   actor.weaknessAmount=weakness;m.weaknessAmount=weakness;markStatsDirty(actor);markStatsDirty(m);
   expect(nativeStat(actor,'native.defense')).toBe(nativeStat(m,'native.defense'));
   for(let seed=1;seed<=12;seed++){
     rng.seedRandomGenerator(seed);enemy.hp=1000;const converted=solve(actor,enemy,{lungeAttack:true}).damage;
     expect(converted).toBe(expected[values.length]);values.push(converted);
   }
 }
 expect(new Set(values).size).toBeGreaterThan(1);
});
it('rejects a rescue rewritten as narrative authority while keeping a live run',()=>{
 const g=start(),m=captive(g);rescue(g,m);g.executeCommand('party:roster',input(g,m.id));
 const snapshot=JSON.parse(JSON.stringify(g.toSnapshot()));
 const source=snapshot.party.state.sources.find((s:any)=>s.actorId===m.id);
 source.kind='narrative';source.template='cord.mender';source.key='cord.mender.first.slot.1';
 snapshot.party.actors[0].partyProfile.template='cord.mender';snapshot.party.actors[0].partyProfile.penetrate=false;
 snapshot.party.state.transfers[0].sourceKey=source.key;snapshot.party.state.rescued=[];
 const before=g.player,root=g.party;
 expect(g.loadSnapshot(snapshot)).toBe(false);expect(g.player).toBe(before);expect(g.party).toBe(root);
});
