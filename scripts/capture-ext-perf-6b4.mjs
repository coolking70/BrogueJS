/** Reuse an original complete route under the current rules. All mutations are
 * production commands; output identities come only from production export.
 * Failure records the accepted prefix length and exact divergence, never a budget.
 * node scripts/capture-ext-perf-6b4.mjs classic|all OUTPUT_DIRECTORY */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {boot,drain,hash,write} from './ext-perf-common.mjs';
const [id,out]=process.argv.slice(2);assert.ok(['classic','all'].includes(id)&&out);
const path=`${out}/${id}-438491256`,route=JSON.parse(readFileSync(`scripts/perf/ext-late-${id}.route.json`,'utf8'));
Date.now=()=>route.recordedAt;
const {server,Game,logger}=await boot();let current=0;const coverage={};
try{
 const g=new Game();g.animationEnabled=true;g.onRenderRequested=()=>{};
 g.startNewGame({seed:route.seed,mode:route.mode,ruleSet:route.extensions?'extended':'classic',extensions:route.extensions?.modules.map(m=>m.id),extensionConfigurations:Object.fromEntries(route.extensions?.modules.filter(m=>m.configuration!==undefined).map(m=>[m.id,m.configuration])??[])});
 try{
  for(const [i,event]of route.commands.entries()){
   current=i+1;const depth=g.depth,turn=g.stats.turns;let decision=0;
   g.onConfirmRequest=()=>{assert.ok(decision<event.decisions.length);return event.decisions[decision++];};
   g.executeCommand(event.action,event.data);drain(g);
   while(g.pendingCommandConfirmation){g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);drain(g);}
   await g.flushRecording();while(logger.pendingAcknowledgment)logger.acknowledgeNext();
   assert.equal(g.recordedInputEvents.length,current,`Command not accepted ${current}`);assert.equal(g.isGameOver,false,'Route died');
   const c=coverage[depth]??={settled:0,maxMonsters:0};c.settled+=g.stats.turns-turn;c.maxMonsters=Math.max(c.maxMonsters,g.monsters.filter(m=>m.hp>0).length);
   if(current%100===0)console.log(JSON.stringify({command:current,depth:g.depth}));
  }
  assert.equal(g.depth,20);assert.ok(coverage[20]?.settled>=500);
  const recording=await g.exportRecordingAsync({includeSnapshots:false});assert.ok(g.recordingMetrics.peakJobs<=2);
  write(path+'.recording.json',recording);
  write(path+'.route.json',{seed:recording.seed,mode:recording.mode,recordedAt:recording.recordedAt,extensions:recording.extensions??null,recordingHash:hash(recording),commands:recording.events.map(({action,data,decisions})=>({action,data,decisions}))});
  write(path+'.source.json',{kind:'wizard-command-route',planner:'original complete route reused; no world edits',originalRecordingHash:route.recordingHash,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,seed:String(recording.seed),mode:recording.mode,recordedAt:recording.recordedAt,recordingVersion:recording.version,codec:recording.codec,extensions:recording.extensions,modules:recording.extensions?.modules.map(m=>m.id)??[],coverage,events:recording.events.length,recordingHash:hash(recording)});
  console.log(JSON.stringify({id,events:recording.events.length,depth:g.depth,coverage,recordingHash:hash(recording)}));
 }catch(error){write(path+'.divergence.json',{command:current,event:route.commands[current-1],depth:g.depth,loc:g.player.loc,accepted:g.recordedInputEvents.length,coverage,message:String(error)});throw error;}
}finally{await server.close();}
