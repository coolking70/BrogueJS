/** Supplemental correctness gates have their own report; never rewrite measurements. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,openSync,closeSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync,spawnSync} from 'node:child_process';
import {hash,write} from './ext-perf-common.mjs';
import {perfIdentity} from './ext-perf-selection.mjs';

const control=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function supplementStages(options){
 if(options.shard==='all-prefix'||!perfIdentity(options.headIdentity).generate)return [];
 // C2 reuses the C1 scene with its native item schema.
 return ['c1',...(options.headIdentity==='6c3'?['c3']:options.headIdentity==='6c4'?['c4']:[])];
}
export function runSupplements(measurement,output){
 const out=resolve(output),measurementFile=resolve(measurement,'result.json');
 assert.ok(!existsSync(out),'Use a fresh supplement output directory');
 mkdirSync(out,{recursive:true});
 const result={version:1,status:'running',required:true,steps:[],startedAt:new Date().toISOString()};
 const publish=()=>{
  write(resolve(out,'result.json'),result);
  writeFileSync(resolve(out,'summary.md'),['# Phase6 bounded supplements',`Status: **${result.status}**; required correctness gates.`,
   'Main measurements remain in their original artifact; a supplemental failure still fails the job and aggregate.',
   ...result.steps.map(s=>`- ${s.stage}: ${s.status}; exit ${s.exit??'—'}; ${s.error??s.log??''}`),result.error??''].join('\n')+'\n');
 };
 publish();
 try{
  const raw=readFileSync(measurementFile,'utf8'),main=JSON.parse(raw);
  Object.assign(result,{measurementSha256:hash(raw),runnerInvocation:main.runner?.invocation,head:main.identities?.B});
  assert.equal(main.hard,'pass','Main measurement correctness must finish first');
  assert.ok(main.finishedAt,'Unfinished main measurements');
  const head=main.options.head;
  const git=(...args)=>execFileSync('git',args,{cwd:head,encoding:'utf8'}).trim();
  assert.equal(git('rev-parse','HEAD'),main.identities.B.commit,'Supplement head changed');
  assert.equal(hash(execFileSync('git',['diff','HEAD','--','src'],{cwd:head,encoding:'utf8'})),main.identities.B.sourceHash,'Supplement source changed');
  assert.equal(git('ls-files','--others','--exclude-standard','src'),'','Untracked supplement source');
  for(const tool of ['ext-perf-supplements.mjs','run-ext-perf-supplements.mjs','profile-ext-6c1.mjs','profile-ext-6c3.mjs','profile-ext-6c4.mjs','ext-perf-common.mjs'])
   assert.equal(hash(readFileSync(resolve(control,'scripts',tool),'utf8')),main.toolHashes[tool],`Supplement tool drift ${tool}`);
  for(const stage of supplementStages(main.options)){
   const step={stage,status:'running',log:stage+'.log',startedAt:new Date().toISOString()};
   result.steps.push(step);publish();console.log(`${stage.toUpperCase()}-bounded-supplement started`);
   const fd=openSync(resolve(out,step.log),'w');let child;
   try{child=spawnSync(process.execPath,['--max-old-space-size=3072',resolve(control,`scripts/profile-ext-6${stage}.mjs`),resolve(out,stage+'-scenes.json')],
    {cwd:head,stdio:['ignore',fd,fd],timeout:90*60*1000,killSignal:'SIGKILL',env:{...process.env,NODE_OPTIONS:'--max-old-space-size=3072'}});}
   finally{closeSync(fd);}
   Object.assign(step,{exit:child.status,signal:child.signal,finishedAt:new Date().toISOString(),status:'failed'});
   try{
    assert.equal(child.status,0,`${stage} failed (${child.error??child.signal??child.status}); see ${step.log}`);
    step.scenes=JSON.parse(readFileSync(resolve(out,stage+'-scenes.json'),'utf8'));
    assert.equal(step.scenes.status,'pass','Supplement scene did not pass');step.status='pass';
   }catch(error){step.error=String(error.stack??error);}
   publish();console.log(`${stage.toUpperCase()}-bounded-supplement ${step.status} (exit ${step.exit}); ${resolve(out,step.log)}`);
  }
  result.status=result.steps.some(s=>s.status!=='pass')?'failed':result.steps.length?'pass':'not-required';
 }catch(error){result.status='failed';result.error=String(error.stack??error);}
 result.finishedAt=new Date().toISOString();publish();return result;
}

export function validateSupplements(main,measurementText,dir){
 const report=JSON.parse(readFileSync(resolve(dir,'result.json'),'utf8'));
 assert.equal(report.version,1);assert.equal(report.required,true);
 assert.equal(report.measurementSha256,hash(measurementText),'Supplement measurement binding drift');
 assert.equal(report.runnerInvocation,main.runner.invocation);assert.deepEqual(report.head,main.identities.B);
 assert.ok(report.finishedAt,'Unfinished supplements');
 assert.deepEqual(report.steps.map(s=>s.stage),supplementStages(main.options),'Missing/duplicate supplemental gate');
 for(const step of report.steps){
  assert.equal(step.status,'pass',`Failed supplement ${step.stage}`);assert.equal(step.exit,0);
  assert.deepEqual(JSON.parse(readFileSync(resolve(dir,step.stage+'-scenes.json'),'utf8')),step.scenes,'Supplement scene drift');
  assert.equal(step.scenes.status,'pass');
 }
 assert.equal(report.status,report.steps.length?'pass':'not-required');return report;
}
