/** Regenerate the frozen v4 artifact from compact, checked-in commands.
 * These are live executeCommand calls, not altered headers/checkpoints. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {boot,drain,hash,write} from './ext-perf-common.mjs';
const [routeFile,out]=process.argv.slice(2);assert.ok(routeFile&&out);
const route=JSON.parse(readFileSync(routeFile,'utf8'));
Date.now=()=>route.recordedAt;
const {server,Game,logger}=await boot();
try {
 const g=new Game();g.animationEnabled=true;g.onRenderRequested=()=>{};
 g.startNewGame({seed:route.seed,mode:route.mode,ruleSet:route.extensions?'extended':'classic',extensions:route.extensions?.modules.map(m=>m.id),extensionConfigurations:Object.fromEntries(route.extensions?.modules.filter(m=>m.configuration!==undefined).map(m=>[m.id,m.configuration])??[])});
 for(const [i,event] of route.commands.entries()) {
  let decision=0;g.onConfirmRequest=()=>{assert.ok(decision<event.decisions.length);return event.decisions[decision++];};
  g.executeCommand(event.action,event.data);drain(g);
  while(g.pendingCommandConfirmation){g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);drain(g);}
  await g.flushRecording();while(logger.pendingAcknowledgment)logger.acknowledgeNext();
  assert.equal(g.recordedInputEvents.length,i+1,`Command not accepted ${i+1}`);
  if((i+1)%100===0)console.log(JSON.stringify({command:i+1,depth:g.depth}));
 }
 const recording=await g.exportRecordingAsync({includeSnapshots:false});
 const actualHash=hash(recording);
 // Retain a failed candidate separately so drift can be attributed field by
 // field without replacing the frozen input or losing the expensive capture.
 if(actualHash!==route.recordingHash)write(out+'.mismatch.json',recording);
 assert.equal(actualHash,route.recordingHash,'Generated artifact drifted: inspect .mismatch.json; never silently rebaseline');
 assert.ok(g.recordingMetrics.peakJobs<=2);
 write(out+'.capture.json',{metrics:g.recordingMetrics,node:process.version,events:recording.events.length});
 write(out,recording);console.log(JSON.stringify({out,events:recording.events.length,sha256:hash(recording)}));
}finally{await server.close();}
