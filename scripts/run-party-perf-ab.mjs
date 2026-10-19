import { discoverModules } from './test-discovery.mjs';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFileSync} from 'node:child_process';
import {hash,write} from './ext-perf-common.mjs';
import {hashCandidate} from './check-module-removal.mjs';
import {PARTY_PERF_ID,PARTY_PERF_POLICY,partyShardActors,validatePartyMeasurement,parsePartyPerfOptions,assertStablePartyMeasurement} from './party-perf-identity.mjs';
// Includes SSR boot, measurement, save/load and the complete seed replay.
// The one-actor baseline can exceed ten minutes on the hosted Xeon runner.
// Match the window runner's bounded twenty-minute allowance; this is not a perf budget.
export const PARTY_PROFILE_TIMEOUT_MS = 1200000;
export function runPartyProfile({control,root,file,mode,actors,steps}, spawn = spawnSync) {
 const started = performance.now();
 const child = spawn(process.execPath,[resolve(control,'scripts/profile-party-perf.mjs'),file,mode,String(actors),String(steps)],{
  cwd:root,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=3072'},encoding:'utf8',maxBuffer:16*1024*1024,timeout:PARTY_PROFILE_TIMEOUT_MS
 });
 const log = {exit:child.status,signal:child.signal??null,error:child.error?{code:child.error.code??null,message:child.error.message}:null,
  timeoutMs:PARTY_PROFILE_TIMEOUT_MS,elapsedMs:performance.now()-started,stdout:child.stdout,stderr:child.stderr};
 write(file+'.log.json',log);
 assert.ok(!child.error&&child.status===0,
  `Failed ${file}: exit=${log.exit}, signal=${log.signal}, error=${log.error?.code??log.error?.message??'none'}, elapsedMs=${log.elapsedMs.toFixed(0)}, timeoutMs=${log.timeoutMs}\n${child.stderr??''}`);
}
export async function runPartyAb(args){
 const options=parsePartyPerfOptions(args);
 const counts=options.shard?[partyShardActors(options.shard)]:[1,2,4],out=resolve(options.out);assert.ok(!existsSync(out),'Evidence directory must be fresh');mkdirSync(out,{recursive:true});
 const roots=options.calibrationOnly?{B:resolve(options.head)}:{A:resolve(options.base),B:resolve(options.head)},sides=Object.keys(roots),control=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const toolNames=['run-party-perf-ab.mjs','profile-party-perf.mjs','party-perf-identity.mjs','merge-party-perf-ab.mjs','ext-perf-common.mjs'];
 const tools=Object.fromEntries(toolNames.map(name=>[name,hash(readFileSync(resolve(control,'scripts',name),'utf8'))]));
 const sources=Object.fromEntries(Object.entries(roots).map(([side,root])=>{assert.ok(discoverModules(root).some(module=>module.id==='party'),`Party ${side} requires a party-capable candidate; phase6 has no party scenario`);let sha=null;try{sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();}catch{}return [side,{sha,sourceHash:hashCandidate(root).sha256}];}));
 const result={identity:PARTY_PERF_ID,status:'running',policy:PARTY_PERF_POLICY,options,sources,tools,runs:[],comparisons:[]};
 try{
  for(let round=1;round<=options.rounds;round++)for(const actors of counts)for(const mode of PARTY_PERF_POLICY.modes)for(const side of sides){
   const artifact=`${round}-${side}-${actors}-${mode}.json`,file=resolve(out,artifact);
   runPartyProfile({control,root:roots[side],file,mode,actors,steps:options.steps});
   const row=validatePartyMeasurement(JSON.parse(readFileSync(file,'utf8')),{actors,mode,steps:options.steps});assert.equal(row.sourceHash,sources[side].sourceHash,'Source changed during measurement');
   const previous=result.runs.find(r=>r.side===side&&r.actors===actors&&r.mode===mode);if(previous)assertStablePartyMeasurement(row,previous.measurement);
   result.runs.push({round,side,actors,mode,artifact,artifactHash:hash(readFileSync(file,'utf8')),measurement:row});write(resolve(out,'result.json'),result);
  }
  if(!options.calibrationOnly)for(const actors of counts)for(const mode of PARTY_PERF_POLICY.modes)for(let round=1;round<=options.rounds;round++){
   const a=result.runs.find(r=>r.round===round&&r.side==='A'&&r.actors===actors&&r.mode===mode).measurement,b=result.runs.find(r=>r.round===round&&r.side==='B'&&r.actors===actors&&r.mode===mode).measurement;
   result.comparisons.push({round,actors,mode,comparable:a.rowsHash===b.rowsHash&&a.rngHash===b.rngHash,commandP95Ratio:a.step.p95?b.step.p95/a.step.p95:null,fullP95Ratio:a.full.p95?b.full.p95/a.full.p95:null,status:'report-only'});
  }
  for(const side of sides)assert.equal(hashCandidate(roots[side]).sha256,sources[side].sourceHash,'Candidate changed');
  result.status=options.rounds===3&&options.steps===2049?'measured-no-budget':'smoke-only';
 }catch(error){result.status='failed';result.error=String(error);throw error;}finally{write(resolve(out,'result.json'),result);const {writeFileSync}=await import('node:fs');writeFileSync(resolve(out,'summary.md'),`# Party performance ${result.status}\n\nMode: ${options.calibrationOnly?'calibration-only (B only)':'A/B report-only'}. ${result.runs.length} observations; rounds=${options.rounds}, steps=${options.steps}. No P1a performance pass or frozen budget; aggregate suggests provisional budgets only from three complete B rounds.\n`);}
 return result;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runPartyAb(process.argv.slice(2));
