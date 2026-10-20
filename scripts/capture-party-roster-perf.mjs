/** Explicit diagnostic rescue setups; never a natural generation/seed route. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,basename} from 'node:path';
import {boot,write,hash} from './ext-perf-common.mjs';
import {ROSTER_PERF_ID} from './profile-party-roster-perf.mjs';
const captureToolHash=hash(readFileSync(new URL('./capture-party-roster-perf.mjs',import.meta.url),'utf8'));
const out=resolve(process.argv[2]??'');assert.ok(process.argv[2]&&!existsSync(out),'Fresh output directory required');mkdirSync(out,{recursive:true});
const {server,Game,load,logger}=await boot(),games=[];
try {
 const {Monster,MonsterState}=await load('entities/Monster.ts'),catalog=(await load('data/monsters.json')).default,{TerrainType}=await load('engine/Map/Grid.ts');
 for(const actors of [1,2,4]) {
  const g=new Game({seed:1});games.push(g);g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:actors}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:actors}})]});g.animationEnabled=false;
  const occupied=new Set([...g.controlledActors,...g.monsters,...g.dormantMonsters].map(a=>`${a.x},${a.y}`));
  const at=[[1,0],[0,1],[-1,0],[0,-1]].map(([dx,dy])=>({x:g.player.x+dx,y:g.player.y+dy})).find(p=>g.grid.isValidPos(p.x,p.y)&&!occupied.has(`${p.x},${p.y}`));assert.ok(at,'No legal diagnostic cell');
  g.grid.setTerrain(at.x,at.y,TerrainType.FLOOR);
  const captive=new Monster(at.x,at.y,catalog.find(m=>m.id==='goblin'));captive.isCaged=true;captive.state=MonsterState.WANDERING;g.monsters.push(captive);g.extensionRuntime.attachCreature(captive);
  g.becomeAllyWith(captive);captive.hp=6;captive.regenCounter=7;
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  const setup=g.toSnapshot();assert.equal(setup.party.state.schema,4);
  const name=`rescue-${actors}.snapshot.json`,file=resolve(out,name);write(file,setup);
  const h=new Game({seed:1});games.push(h);assert.ok(h.loadSnapshot(JSON.parse(readFileSync(file,'utf8'))),'Captured diagnostic snapshot rejected');
  const commands=actors===4?[{label:'full-roster',operation:'join',targetId:captive.id,campId:null,outcome:'rejection',error:'NO_SPACE'}]
   :[{label:'rescued-goblin-join',operation:'join',targetId:captive.id,campId:null,outcome:'success'},
    {label:'joined-busy-rejection',operation:'join',targetId:captive.id,campId:null,outcome:'rejection',error:'ACTOR_BUSY'}];
  write(resolve(out,`rescue-${actors}.scenario.json`),{identity:ROSTER_PERF_ID,label:`diagnostic-rescue-${actors}`,provenance:'diagnostic-snapshot',captureToolHash,initialActors:actors,setupSnapshot:name,setupHash:hash(readFileSync(file,'utf8')),commands});
  g.disposeRecording();h.disposeRecording();
 }
 // Optional trusted fixture captures from the resident owner test. Preparatory
 // waits are recorded public inputs used to create a *new* explicit setup; they
 // are not hidden inside zero-tick conversion timing.
 for(const wrapperFile of process.argv.slice(3)) {
  const wrapper=JSON.parse(readFileSync(wrapperFile,'utf8'));
  assert.equal(wrapper.schema,1);assert.equal(wrapper.kind,'diagnostic-origin');
  const g=new Game({seed:1});games.push(g);assert.ok(g.loadSnapshot(wrapper.snapshot));g.animationEnabled=false;
  const stem=basename(wrapperFile,'.json'),targetId=wrapper.targetId,campId=wrapper.campId;
  const saveScene=(suffix,commands)=>{
   const name=`${stem}-${suffix}.snapshot.json`,file=resolve(out,name);write(file,g.toSnapshot());
   write(resolve(out,`${stem}-${suffix}.scenario.json`),{identity:ROSTER_PERF_ID,label:`diagnostic-${stem}-${suffix}`,provenance:'diagnostic-snapshot',captureToolHash,initialActors:g.party.state.members.filter(m=>m.life!=='dead').length,setupSnapshot:name,setupHash:hash(readFileSync(file,'utf8')),commands});
  };
  const roster=(operation,camp)=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party.state.revision,issuerSlot:'local:0',actorId:g.player.id,targetId,operation,campId:camp,level:{kind:'dungeon',depth:g.depth}});};
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  saveScene('join',[{label:stem+'-join',operation:'join',targetId,campId:null,outcome:'success'}]);
  roster('join',null);
  if(campId===null||campId===undefined){g.disposeRecording();continue;}
  for(let i=0;i<40&&g.activeControlledActors.some(a=>a.ticksUntilTurn>0);i++) {
   while(logger.pendingAcknowledgment)logger.acknowledgeNext();assert.ok(g.readyPartyActorId);g.submitPartyIntent({kind:'wait'},g.readyPartyActorId);
  }
  assert.ok(g.activeControlledActors.every(a=>a.ticksUntilTurn===0));
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  saveScene('roundtrip',[{label:'station',operation:'station',targetId,campId,outcome:'success'},{label:'rejoin',operation:'join',targetId,campId:null,outcome:'success'}]);
  g.disposeRecording();
 }
}finally{for(const g of games)g.disposeRecording();await server.close();}
