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
assert.equal(selectExtPerf(['i','o','--identity=6c2']).manifest,'scripts/ext-perf-6c2-budget.json');
for(const flags of [['--identity=6c5'],['--identity=unknown'],['--identity=p0','--phase6b4'],['--identity=p0','--identity=6b4']])assert.throws(()=>selectExtPerf(['i','o',...flags]));
const frozen=loadPerfIdentity(process.cwd(),'6c1');
assert.equal(frozen.entry.accepted,true);
assert.equal(frozen.sources.all.source,'e27648489953069b9aca4c9cf2b8a5ed5162a372');
const c2=loadPerfIdentity(process.cwd(),'6c2');
assert.equal(c2.entry.accepted,true);
assert.equal(c2.sources.all.source,'feb33b030f74949a2e0af001362b53f2f6e0eea3');
assert.equal(c2.manifest.provenance.acceptance,'known-prefix-overhead');
assert.equal(c2.manifest.provenance.cloudVerdict,'regression');
const temp=mkdtempSync(resolve(tmpdir(),'c1-selection-'));
try{
 assert.throws(()=>loadPerfIdentity(temp,'6c2'),'Uncalibrated C2 cannot pass the normal budget checker');
 for(const identity of ['6c1','6c2']){
 const entry=perfIdentity(identity),source={recordingHash:'x',events:2050,coverage:{20:{settled:500}}};
 const artifacts={[entry.manifest]:{cases:{classic:{...source,source},all:{...source,source}}}};
 for(const id of ['classic','all']){artifacts[entry.route(id)]={recordingHash:'x',commands:Array(2050).fill({action:'wait'})};artifacts[entry.source(id)]=source;}
 const write=()=>{for(const [path,value]of Object.entries(artifacts)){mkdirSync(dirname(resolve(temp,path)),{recursive:true});writeFileSync(resolve(temp,path),JSON.stringify(value));}};
 write();loadPerfIdentity(temp,identity);
 for(const path of Object.keys(artifacts)){rmSync(resolve(temp,path));assert.throws(()=>loadPerfIdentity(temp,identity));write();}
 artifacts[entry.route('all')].recordingHash='bad';write();assert.throws(()=>loadPerfIdentity(temp,identity));
 }
 const events=[1,2,3].map(n=>({action:'wait',rng:{substantive:n,cosmetic:n},turn:n,simulationTicks:n*100}));
 assert.equal(comparablePrefix({events},{events:structuredClone(events)}),3);
 const changed=structuredClone(events);changed[2].rng.cosmetic++;
 assert.equal(comparablePrefix({events},{events:changed}),2);
 assert.throws(()=>comparablePrefix({events},{events:[]}));
}finally{rmSync(temp,{recursive:true,force:true});}
console.log('C1/C2 finite selection, all artifact omissions, conflicting/unknown identities, hash drift and derived prefix passed');

assert.equal(selectExtPerf(['i','o','--identity=6c3']).manifest,'scripts/ext-perf-6c3-budget.json');
assert.equal(perfIdentity('6c3').accepted,false);

assert.equal(perfIdentity('6c4').accepted,false);assert.equal(perfIdentity('6c4').generate,true);assert.throws(()=>loadPerfIdentity(process.cwd(),'6c4'));
