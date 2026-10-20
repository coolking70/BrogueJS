import {it,expect} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {logger} from '../../../../engine/Systems/Logger';
import {mechanicalDigest} from '../../../../engine/Core/RecordingDigest';
import {TerrainType} from '../../../../engine/Map/Grid';
const route={seed:3};
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
it('rescues a naturally generated captive by public inputs and recruits with seed replay and bidirectional seek',()=>{
 const g=new Game({seed:1}),h=new Game({seed:2});
 try{
  g.startNewGame({seed:route.seed,mode:'wizard',ruleSet:'extended',extensions:['party','settlement'],extensionConfigurations:{party:{schema:1,members:1}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:1}})]});g.animationEnabled=false;
  const key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
  const walk=(goal:{x:number;y:number})=>{
    const queue=[{...g.player.loc}],previous=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);let found:{x:number;y:number}|undefined;
    for(let i=0;i<queue.length;i++){const p=queue[i]!;if(key(p)===key(goal)){found=p;break;}for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx!,y:p.y+dy!},cell=g.grid.getCell(n.x,n.y);if(!cell||!(cell.isPassable||cell.terrain===TerrainType.DOOR||cell.terrain===TerrainType.SECRET_DOOR)||cell.layers.some(t=>[TerrainType.LAVA,TerrainType.CHASM,TerrainType.WATER_DEEP].includes(t))||previous.has(key(n)))continue;previous.set(key(n),p);queue.push(n);}}
    expect(found).toBeDefined();let next=found!;for(let p=previous.get(key(next));p&&key(p)!==key(g.player.loc);p=previous.get(key(next)))next=p;
    g.submitPartyIntent(g.grid.getCell(next.x,next.y)!.terrain===TerrainType.SECRET_DOOR?{kind:'search'}:{kind:'move',dx:next.x-g.player.x,dy:next.y-g.player.y},g.player.id);
  };
  g.onConfirmRequest=()=>true;let rescued=false;
  for(let count=0;count<1800&&!rescued;count++){
   while(logger.pendingAcknowledgment)logger.acknowledgeNext();
   if(g.depth<3){const stairs=g.levelSeeds[g.depth-1]!.downStairsLoc;if(key(g.player.loc)===key(stairs))g.executeCommand('party:control',{kind:'party:control',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,change:{kind:'travel-party',destination:{kind:'dungeon',depth:g.depth+1},leavingBehind:[]}});else walk(stairs);}
   else {const captive=g.monsters.find(m=>m.typeId==='goblin'&&m.isCaged);expect(captive).toBeTruthy();walk(captive!.loc);}
   while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
   expect(g.isGameOver).toBe(false);rescued=!!g.party!.state.rescued.length;
  }
  expect(rescued).toBe(true);const proof=g.party!.state.rescued[0]!,actor=g.monsters.find(m=>m.id===proof.actorId)!;expect(actor.typeId).toBe('goblin');
  const before=g.recordedInputEvents.length,hp=actor.hp;
  if(process.env.PARTY_P1D_NATURAL_CAPTURE){mkdirSync(process.env.PARTY_P1D_NATURAL_CAPTURE,{recursive:true});writeFileSync(join(process.env.PARTY_P1D_NATURAL_CAPTURE,'captive-before-join.json'),JSON.stringify({schema:1,kind:'diagnostic-origin',targetId:actor.id,campId:null,snapshot:g.toSnapshot()}));}
  while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('party:roster',{kind:'party:roster',schema:1,expectedRevision:g.party!.state.revision,issuerSlot:'local:0',actorId:g.player.id,targetId:actor.id,operation:'join',campId:null,level:{kind:'dungeon',depth:g.depth}});
  expect(g.party!.actors.get(actor.id)?.hp).toBe(hp);
  const record=g.exportRecording(),saved=g.toSaveSnapshot(),digest=mechanicalDigest(g.toSnapshot(),(g as any).recordingInputState()).root;
  if(process.env.PARTY_P1D_NATURAL_CAPTURE){for(const [name,value] of [['captive-joined-save',saved],['captive-recording',record]] as const)writeFileSync(join(process.env.PARTY_P1D_NATURAL_CAPTURE,name+'.json'),JSON.stringify(value));}
  expect(Game.isSnapshot(saved)).toBe(true);expect(h.loadSnapshot(saved,message=>console.error(message))).toBe(true);expect(h.loadReplay(record)).toBe(true);
  for(const end of [record.events.length,before,record.events.length]){h.replaySeek(end);expect(h.replayError).toBeNull();expect(h.party!.actors.has(actor.id)).toBe(end>before);}
  expect(mechanicalDigest(h.toSnapshot(),(h as any).recordingInputState()).root).toBe(digest);
  expect(h.loadSnapshot(h.toSaveSnapshot())).toBe(true);while(logger.pendingAcknowledgment)logger.acknowledgeNext();h.submitPartyIntent({kind:'wait'},h.readyPartyActorId!);expect(h.exportRecording().events.length).toBe(record.events.length+1);
 }finally{g.disposeRecording();h.disposeRecording();}
},180000);
