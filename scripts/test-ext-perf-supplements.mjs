import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,copyFileSync,symlinkSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {hash} from './ext-perf-common.mjs';
import {supplementStages,validateSupplements} from './ext-perf-supplements.mjs';

for(const headIdentity of ['6c1','6c2'])assert.deepEqual(supplementStages({headIdentity,shard:'all-full'}),['c1']);
assert.deepEqual(supplementStages({headIdentity:'6c4',shard:'all-prefix'}),[]);
const dir=mkdtempSync(resolve(tmpdir(),'ext-supplement-test-'));
try{
 const control=resolve(dir,'control'),scripts=resolve(control,'scripts'),measurement=resolve(dir,'main');
 mkdirSync(scripts,{recursive:true});mkdirSync(measurement);symlinkSync(resolve('node_modules'),resolve(control,'node_modules'));
 const names=['ext-perf-supplements.mjs','run-ext-perf-supplements.mjs','ext-perf-common.mjs','ext-perf-selection.mjs','profile-ext-6c1.mjs','profile-ext-6c3.mjs','profile-ext-6c4.mjs'];
 for(const name of names)copyFileSync(resolve('scripts',name),resolve(scripts,name));
 const fixture="import {writeFileSync} from 'node:fs';writeFileSync(process.argv[2],JSON.stringify({status:'pass'}));";
 writeFileSync(resolve(scripts,'profile-ext-6c1.mjs'),'process.exit(7);');
 writeFileSync(resolve(scripts,'profile-ext-6c4.mjs'),fixture);
 const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
 const main={hard:'pass',status:'regression',finishedAt:'fixture',runner:{invocation:'fixture'},
  options:{head:process.cwd(),headIdentity:'6c4',shard:'all-full'},
  identities:{B:{commit:git('rev-parse','HEAD'),sourceHash:hash(execFileSync('git',['diff','HEAD','--','src'],{encoding:'utf8'}))}},
  toolHashes:Object.fromEntries(names.map(name=>[name,hash(readFileSync(resolve(scripts,name),'utf8'))]))};
 const file=resolve(measurement,'result.json');writeFileSync(file,JSON.stringify(main));
 const before=readFileSync(file,'utf8'),failed=resolve(dir,'failed');
 const run=out=>spawnSync(process.execPath,[resolve(scripts,'run-ext-perf-supplements.mjs'),measurement,out],{encoding:'utf8'});
 const failure=run(failed);assert.equal(failure.status,1,failure.stderr);
 const result=JSON.parse(readFileSync(resolve(failed,'result.json'),'utf8'));
 assert.equal(result.status,'failed');assert.deepEqual(result.steps.map(s=>[s.stage,s.status,s.exit]),[['c1','failed',7],['c4','pass',0]]);
 assert.equal(readFileSync(file,'utf8'),before,'Supplement failure must not rewrite main result');
 assert.throws(()=>validateSupplements(main,before,failed));
 writeFileSync(resolve(scripts,'profile-ext-6c1.mjs'),fixture);
 // Exact tool provenance rejects a stale main report before any scenes run.
 const drift=resolve(dir,'drift');assert.equal(run(drift).status,1);
 assert.match(JSON.parse(readFileSync(resolve(drift,'result.json'),'utf8')).error,/tool drift/);
 main.toolHashes['profile-ext-6c1.mjs']=hash(fixture);writeFileSync(file,JSON.stringify(main));
 const good=resolve(dir,'good'),success=run(good);assert.equal(success.status,0,success.stderr);
 assert.equal(validateSupplements(main,readFileSync(file,'utf8'),good).status,'pass');
 assert.equal(JSON.parse(readFileSync(file,'utf8')).status,'regression','Supplement pass must not clear D6 regression');
 const workflow=readFileSync('.github/workflows/ext-perf.yml','utf8');
 assert.ok(workflow.indexOf('- name: Upload JSON, Markdown and raw evidence')<workflow.indexOf('- name: Phase6 bounded supplements'));
 assert.match(workflow,/--supplements defer/);
 assert.match(workflow,/- name: Phase6 bounded supplements[^\n]*\n\s+if: always\(\) && inputs.suite == 'phase6'/);
 assert.match(workflow,/- name: Upload phase6 supplement results and logs\n\s+if: always\(\) && inputs.suite == 'phase6'/);
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('Supplement failures remain gates, continue other witnesses, preserve main bytes and bind provenance; upload ordering passed');
