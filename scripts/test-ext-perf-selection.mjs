import assert from 'node:assert/strict';
import {selectExtPerf} from './ext-perf-selection.mjs';
const old=selectExtPerf(['input','output']);assert.equal(old.manifest,'scripts/ext-perf-budget.json');assert.equal(old.route('all'),'scripts/perf/ext-late-all.route.json');
const next=selectExtPerf(['input','output','--phase6b4','--regenerate']);assert.equal(next.manifest,'scripts/ext-perf-6b4-budget.json');assert.equal(next.route('classic'),'scripts/perf/ext-6b4-late-classic.route.json');assert.equal(next.regenerate,true);
for(const args of [[],['input'],['--phase6b4','output'],['input','output','--manifest=anything'],['input','output','--phase6b4','--phase6b4'],['input','output','--regenerate','--regenerate'],['input','output','--classic-only']])assert.throws(()=>selectExtPerf(args));
assert.throws(()=>next.route('../all'));console.log('Performance selection: 2 identities and 8 rejection cases passed');
const {perfIdentity,loadPerfIdentity,comparablePrefix}=await import('./ext-perf-selection.mjs');
const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=await import('node:fs');
const {tmpdir}=await import('node:os');
const {resolve,dirname}=await import('node:path');
assert.equal(selectExtPerf(['i','o','--identity=6c1']).manifest,'scripts/ext-perf-6c1-budget.json');
for(const flags of [['--identity=6c2'],['--identity=unknown'],['--identity=p0','--phase6b4'],['--identity=p0','--identity=6b4']])assert.throws(()=>selectExtPerf(['i','o',...flags]));
assert.throws(()=>loadPerfIdentity(process.cwd(),'6c1'),'Uncalibrated C1 cannot pass the normal budget checker');
const temp=mkdtempSync(resolve(tmpdir(),'c1-selection-'));
try{
 const entry=perfIdentity('6c1'),source={recordingHash:'x',events:2050,coverage:{20:{settled:500}}};
 const artifacts={[entry.manifest]:{cases:{classic:{...source,source},all:{...source,source}}}};
 for(const id of ['classic','all']){artifacts[entry.route(id)]={recordingHash:'x',commands:Array(2050).fill({action:'wait'})};artifacts[entry.source(id)]=source;}
 const write=()=>{for(const [path,value]of Object.entries(artifacts)){mkdirSync(dirname(resolve(temp,path)),{recursive:true});writeFileSync(resolve(temp,path),JSON.stringify(value));}};
 write();loadPerfIdentity(temp,'6c1');
 for(const path of Object.keys(artifacts)){rmSync(resolve(temp,path));assert.throws(()=>loadPerfIdentity(temp,'6c1'));write();}
 artifacts[entry.route('all')].recordingHash='bad';write();assert.throws(()=>loadPerfIdentity(temp,'6c1'));
 const events=[1,2,3].map(n=>({action:'wait',rng:{substantive:n,cosmetic:n},turn:n,simulationTicks:n*100}));
 assert.equal(comparablePrefix({events},{events:structuredClone(events)}),3);
 const changed=structuredClone(events);changed[2].rng.cosmetic++;
 assert.equal(comparablePrefix({events},{events:changed}),2);
 assert.throws(()=>comparablePrefix({events},{events:[]}));
}finally{rmSync(temp,{recursive:true,force:true});}
console.log('C1 finite selection, all artifact omissions, conflicting/unknown identities, hash drift and derived prefix passed');
