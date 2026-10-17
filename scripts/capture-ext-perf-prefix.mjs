/** Diagnostic same-command prefix, exported by production (never slice/edit a
 * recording). Same-identity regression also uses this for the complete frozen
 * command route, capturing current codec headers on both A and B. Historical
 * identity transitions still use regenerate-ext-perf's frozen hash check.
 * Run with cwd set to the engine checkout: ROUTE OUTPUT EVENTS. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {boot,drain,hash,write} from './ext-perf-common.mjs';
const [routeFile,out,countText]=process.argv.slice(2);
const route=JSON.parse(readFileSync(routeFile,'utf8')),count=Number(countText);
assert.ok(out&&Number.isSafeInteger(count)&&count>0&&count<=route.commands.length);
Date.now=()=>route.recordedAt;
const {server,Game,logger}=await boot();
try {
 const g=new Game();g.animationEnabled=true;g.onRenderRequested=()=>{};
 g.startNewGame({seed:route.seed,mode:route.mode,ruleSet:route.extensions?'extended':'classic',extensions:route.extensions?.modules.map(m=>m.id),extensionConfigurations:Object.fromEntries(route.extensions?.modules.filter(m=>m.configuration!==undefined).map(m=>[m.id,m.configuration])??[])});
 const commands=route.commands.slice(0,count),coverage={};
 for(const [i,event] of commands.entries()) {
  const depth=g.depth,turn=g.stats.turns;
  let decision=0;g.onConfirmRequest=()=>{assert.ok(decision<event.decisions.length);return event.decisions[decision++];};
  g.executeCommand(event.action,event.data);drain(g);
  while(g.pendingCommandConfirmation){g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);drain(g);}
  await g.flushRecording();while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  assert.equal(g.recordedInputEvents.length,i+1,`Command not accepted ${i+1}`);
  assert.equal(g.isGameOver,false,'Prefix died');
  if(event.action==='wait'&&depth===20){assert.equal(g.depth,depth,'Wait scene fell');coverage[depth]??={settled:0};coverage[depth].settled+=g.stats.turns-turn;}
 }
 const recording=await g.exportRecordingAsync({includeSnapshots:false});
 // Compact routes omit undefined optional data, just like production JSON export.
 assert.deepEqual(JSON.parse(JSON.stringify(recording.events.map(({action,data,decisions})=>({action,data,decisions})))),commands,'Production commands/decisions changed');
 assert.ok(g.recordingMetrics.peakJobs<=2);
 write(out,recording);
 write(out+'.source.json',{kind:count===route.commands.length?'recaptured-fixed-route':'diagnostic-production-prefix',source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,seed:route.seed,mode:recording.mode,recordedAt:recording.recordedAt,recordingVersion:recording.version,codec:recording.codec,extensions:recording.extensions,modules:recording.extensions?.modules.map(m=>m.id)??[],coverage,routeHash:hash(route),commandsHash:hash(commands),events:count,recordingHash:hash(recording)});
} finally {await server.close();}
