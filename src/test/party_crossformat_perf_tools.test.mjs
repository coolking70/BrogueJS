import {it,expect} from 'vitest';
import {hash} from '../../scripts/ext-perf-common.mjs';
import {CROSSFORMAT_ID,CROSSFORMAT_DELTAS,liftP1cWorld,crossformatFrame,compareCrossformatProof} from '../../scripts/party-perf-crossformat.mjs';
import {parseOptions} from '../../scripts/run-party-window-perf.mjs';
import {parsePartyPerfOptions} from '../../scripts/party-perf-identity.mjs';
const domains=['native','extensions','world5','actorActions','knowledge','random','party'];
function fixture(){
 const manifest={schema:1,foundation:23,modules:[{id:'party',version:'0.3.0',configuration:{schema:1,members:2},rules:{schema:1,version:'0.3.0',fingerprint:'sha256:'+ 'a'.repeat(64)}}]};
 const targetManifest=structuredClone(manifest);targetManifest.foundation=24;targetManifest.modules[0].version='0.4.0';targetManifest.modules[0].rules.version='0.4.0';targetManifest.modules[0].rules.fingerprint='sha256:'+ 'b'.repeat(64);
 const world={version:10,schema:'brogue-web-whole-run-v10',extensions:{manifest,foundation:{version:23,nextFactId:9}},party:{state:{schema:3,members:[{actorId:1,hp:7},{actorId:9,hp:6}],revision:4},actors:[{id:9,inventory:[{id:32,charges:1}]}],native:{1:{timer:7},9:{timer:4}}},rng:{substantive:9,cosmetic:17}};
 return {world,targetManifest};
}
// A deterministic whole-object oracle for adapter policy tests. Production
// smoke uses RecordingDigest mechanicalDigest/hashJson without substitution.
function digest(world,input){
 const roots=Object.fromEntries(domains.map(d=>[d,hash([d,world,input])]));
 const codec=world.version===10?['brogue-web-whole-run-v10',10,23,5]:['brogue-web-whole-run-v11',11,24,6];
 return {root:hash(['c5-root-v1',codec,hash(world.extensions.manifest),domains.map(d=>roots[d])]),domains:roots};
}
function paired(){
 const {world,targetManifest}=fixture(),bWorld=liftP1cWorld(world,targetManifest);
 const target={sourceHash:'b'.repeat(64),manifests:{'2/party-only':targetManifest}};
 const aFrames=[0,1].map(i=>crossformatFrame(world,{},targetManifest,digest,hash,i));
 const bFrames=[0,1].map(i=>crossformatFrame(bWorld,{},targetManifest,digest,hash,i));
 const row=(manifest,frames,sourceHash)=>({actors:2,mode:'party-only',steps:1,sourceHash,input:{seed:42,manifest},fullDigest:frames.at(-1).nativeRoot,crossformat:{identity:CROSSFORMAT_ID,allowedDeltas:CROSSFORMAT_DELTAS,target,nativeCodec:manifest.foundation===23?{foundation:23,wholeRun:10,recording:7,origin:5,state:3}:{foundation:24,wholeRun:11,recording:8,origin:6,state:4},frames,lifecycle:{saveLoad:true,seedReplay:true,seek:true}}});
 return {a:row(world.extensions.manifest,aFrames,'a'.repeat(64)),b:row(targetManifest,bFrames,'b'.repeat(64))};
}
it('lifts only the explicitly enumerated identities and creation provenance without mutating A',()=>{
 const {world,targetManifest}=fixture(),before=structuredClone(world),b=liftP1cWorld(world,targetManifest);
 expect(world).toEqual(before);expect(b.version).toBe(11);expect(b.party.state.schema).toBe(4);
 expect(b.party.state.sources).toEqual([{actorId:1,kind:'creation',key:'creation:0',template:'party-member'},{actorId:9,kind:'creation',key:'creation:1',template:'party-member'}]);
 expect(b.party.actors).toEqual(world.party.actors);expect(b.rng).toEqual(world.rng);
 expect(b.party.native).toEqual(world.party.native);expect(b.extensions.foundation.nextFactId).toBe(9);
});
it('compares each accepted-input oracle while retaining unequal original digests and exact target identity',()=>{
 const {a,b}=paired();expect(a.fullDigest).not.toBe(b.fullDigest);
 const result=compareCrossformatProof(a,b);expect(result.frames).toBe(2);expect(result.status).toBe('equivalent-under-explicit-adapter');
 expect(result.nativeDigests).toEqual({A:a.fullDigest,B:b.fullDigest});expect(result.adaptedDigest).toBe(b.fullDigest);
});
it.each(['unknown-state','inventory','rng','source','new-member','missing-frame','old-format','missing-lifecycle','wrong-manifest','same-side'])(
 'fails closed on unapproved %s differences',kind=>{
  const {a,b}=paired();
  if(['unknown-state','inventory','rng','new-member'].includes(kind)){
   const {world,targetManifest}=fixture(),bad=liftP1cWorld(world,targetManifest);
   if(kind==='unknown-state')bad.party.state.surprise=true;
   if(kind==='inventory')bad.party.actors[0].inventory[0].charges++;
   if(kind==='rng')bad.rng.cosmetic++;
   if(kind==='new-member')bad.party.state.members.push({actorId:99,hp:3});
   b.crossformat.frames[1]=crossformatFrame(bad,{},targetManifest,digest,hash,1);b.fullDigest=b.crossformat.frames[1].nativeRoot;
  }
  if(kind==='source')b.sourceHash='c'.repeat(64);
  if(kind==='missing-frame')a.crossformat.frames.shift();
  if(kind==='old-format')a.crossformat.identity='party-p1b-p1c-v1';
  if(kind==='missing-lifecycle')delete b.crossformat.lifecycle.seek;
  if(kind==='wrong-manifest')b.input.manifest.foundation=25;
  if(kind==='same-side')a.crossformat.frames[0].side='B';
  expect(()=>compareCrossformatProof(a,b)).toThrow();
 }
);
it.each(['manifest-extra','bad-party-version','extra-rule','existing-provenance','bad-foundation'])('rejects unsafe A or target identity %s',kind=>{
 const {world,targetManifest}=fixture();
 if(kind==='manifest-extra')targetManifest.modules.push({id:'unknown',version:'1'});
 if(kind==='bad-party-version')world.extensions.manifest.modules[0].version='0.2.0';
 if(kind==='extra-rule')targetManifest.modules[0].rules.allowAnything=true;
 if(kind==='existing-provenance')world.party.state.rescued=[];
 if(kind==='bad-foundation')world.extensions.foundation.version=22;
 expect(()=>liftP1cWorld(world,targetManifest)).toThrow();
});
it('requires explicit adapter selection and never accepts it for calibration or as a strict alias',()=>{
 expect(parseOptions(['--base','a','--head','b','--out','o']).comparison).toBe('strict');
 expect(parseOptions(['--base','a','--head','b','--out','o','--comparison',CROSSFORMAT_ID]).comparison).toBe(CROSSFORMAT_ID);
 expect(parsePartyPerfOptions(['--base','a','--head','b','--out','o','--comparison',CROSSFORMAT_ID]).comparison).toBe(CROSSFORMAT_ID);
 expect(()=>parseOptions(['--head','b','--out','o','--comparison',CROSSFORMAT_ID])).toThrow();
 expect(()=>parsePartyPerfOptions(['--head','b','--out','o','--calibration-only','--comparison',CROSSFORMAT_ID])).toThrow();
 expect(()=>parseOptions(['--head','b','--out','o','--comparison','ignore-versions'])).toThrow();
});

import {noPathBudgetView,validateAiLoad} from '../../scripts/profile-party-ai-load.mjs';
it('keeps the no-path budget load deterministic and separate from managed AI routes',()=>{
 const settings={tactic:'follow',avoidDanger:true,autoPickup:false,consumables:false};
 const view=noPathBudgetView(settings,4);
 expect(view.cells).toHaveLength(10000);expect(view.leader).toEqual({x:500,y:500});
 expect(view.actorId).toBe(4);expect(noPathBudgetView(settings,4)).toEqual(view);
 view.settings.tactic='still';expect(settings.tactic).toBe('follow');
 expect(()=>validateAiLoad({identity:'party-ai-v1'})).toThrow();
});
import {validateRosterScenario,ROSTER_PERF_ID} from '../../scripts/profile-party-roster-perf.mjs';
it('separates diagnostic conversion success and rejection scenarios and binds the setup bytes',()=>{
 const scene={identity:ROSTER_PERF_ID,label:'rescue',provenance:'diagnostic-snapshot',initialActors:1,setupSnapshot:'setup.json',setupHash:'a'.repeat(64),commands:[{label:'join',operation:'join',targetId:2,campId:null,outcome:'success'}]};
 expect(validateRosterScenario(scene)).toBe(scene);
 for(const mutate of [s=>s.provenance='seed',s=>s.setupHash='',s=>s.commands[0].outcome='pass',s=>s.commands[0].operation='create',s=>s.commands[0].campId=1,s=>s.commands[0].error='IGNORED']) {
  const bad=structuredClone(scene);mutate(bad);expect(()=>validateRosterScenario(bad)).toThrow();
 }
 const rejected=structuredClone(scene);Object.assign(rejected.commands[0],{outcome:'rejection',error:'NO_SPACE'});expect(validateRosterScenario(rejected)).toBe(rejected);
 delete rejected.commands[0].error;expect(()=>validateRosterScenario(rejected)).toThrow();
});
import {assertStableCrossformat} from '../../scripts/party-perf-crossformat.mjs';
it('ignores proof timing noise while requiring identical per-input oracle evidence across rounds',()=>{
 const {a}=paired(),b=structuredClone(a);a.crossformat.proofTiming={p95:1};b.crossformat.proofTiming={p95:9};
 expect(()=>assertStableCrossformat(a,b)).not.toThrow();
 b.crossformat.frames[0].nativeRoot='d'.repeat(64);expect(()=>assertStableCrossformat(a,b)).toThrow();
 expect(()=>assertStableCrossformat(a,{})).toThrow();
});
it('charges both sides the same two fresh full oracles per proof frame',()=>{
 const {world,targetManifest}=fixture(),b=liftP1cWorld(world,targetManifest);
 let calls=0;const counted=(...args)=>{calls++;return digest(...args);};
 crossformatFrame(world,{},targetManifest,counted,hash,0);expect(calls).toBe(2);
 calls=0;crossformatFrame(b,{},targetManifest,counted,hash,0);expect(calls).toBe(2);
});

import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname} from 'node:path';
import {crossformatAlgorithms,readCrossformatTarget} from '../../scripts/party-perf-crossformat.mjs';
it('accepts the actual P1c/P1d oracle sources only under the two reviewed empty-stationed traversal changes',()=>{
 const dir=mkdtempSync(resolve(tmpdir(),'party-oracle-'));
 try {
  const algorithms=crossformatAlgorithms(process.cwd());expect(algorithms.side).toBe('B');
  const files=Object.keys(algorithms.hashes);
  for(const file of files){const path=resolve(dir,file);mkdirSync(dirname(path),{recursive:true});writeFileSync(path,readFileSync(resolve(process.cwd(),file)));}
  const target=resolve(dir,'target.json');writeFileSync(target,JSON.stringify({identity:CROSSFORMAT_ID,allowedDeltas:CROSSFORMAT_DELTAS,sourceHash:'b'.repeat(64),algorithms}));
  expect(()=>readCrossformatTarget(target,dir)).not.toThrow();
  const recording=resolve(dir,files[0]);
  writeFileSync(recording,readFileSync(recording,'utf8')
   .replace('...(root.party?[...root.party.actors,...root.party.stationed].flatMap((a:any)=>a.inventory):[])','...(root.party?.actors.flatMap((a:any)=>a.inventory)??[])')
   .replace('root.player, ...(root.party?[...root.party.actors,...root.party.stationed]:[])','root.player, ...(root.party?.actors??[])'));
  expect(crossformatAlgorithms(dir).side).toBe('A');expect(()=>readCrossformatTarget(target,dir)).not.toThrow();
  for(const file of files){const path=resolve(dir,file),original=readFileSync(path,'utf8');writeFileSync(path,original+'\n// unreviewed change\n');expect(()=>readCrossformatTarget(target,dir)).toThrow();writeFileSync(path,original);}
  const bad=JSON.parse(readFileSync(target,'utf8'));bad.algorithms.hashes[files[0]]='a'.repeat(64);writeFileSync(target,JSON.stringify(bad));expect(()=>readCrossformatTarget(target,dir)).toThrow();
 } finally {rmSync(dir,{recursive:true,force:true});}
});
it.each(['stationed','stationedNative'])('rejects nonempty %s before using the reviewed oracle delta',key=>{
 const {world,targetManifest}=fixture(),b=liftP1cWorld(world,targetManifest);
 b.party[key]=key==='stationed'?[{id:99,inventory:[]}]:{'99':{timer:1}};
 expect(()=>crossformatFrame(b,{},targetManifest,digest,hash,0)).toThrow();
});
import {instrumentRosterEconomy,startRosterWorkObservation,ROSTER_WORK_HOOK,ROSTER_WORK_UNITS} from '../../scripts/party-roster-work-observer.mjs';
it('observes actual economic work only in the diagnostic hook scope and fails on source anchor drift',()=>{
 for(const name of ['ResidentNeeds.ts','ResidentEconomy.ts','ResidentJobs.ts']){
  const file=`/src/engine/Core/${name}`,source=readFileSync(resolve(process.cwd(),file.slice(1)),'utf8'),result=instrumentRosterEconomy(source,file);
  expect(result.sourceHash).toBe(hash(source));expect(result.instrumentedHash).not.toBe(result.sourceHash);expect(result.code).toContain(ROSTER_WORK_HOOK);
  expect(()=>instrumentRosterEconomy(source+source,file)).toThrow();
 }
 expect(instrumentRosterEconomy('no code','/src/engine/Core/Game.ts')).toBe(null);
 const stop=startRosterWorkObservation();expect(()=>startRosterWorkObservation()).toThrow();
 globalThis[Symbol.for(ROSTER_WORK_HOOK)]('settleCalls',2);globalThis[Symbol.for(ROSTER_WORK_HOOK)]('residentInputRows',3);
 const counts=stop();expect(counts.settleCalls).toBe(2);expect(counts.residentInputRows).toBe(3);expect(Object.keys(counts)).toEqual(Object.keys(ROSTER_WORK_UNITS));expect(globalThis[Symbol.for(ROSTER_WORK_HOOK)]).toBeUndefined();
});

import {SEMANTIC_ID,SEMANTIC_FILE,SEMANTIC_BEFORE_SHA,semanticReferenceSource} from '../../scripts/party-perf-semantic.mjs';
import {combineRoundReports} from '../../scripts/merge-party-rounds.mjs';
it('pins the exact native ownership change, preserving every other source byte',()=>{
 const source=readFileSync(SEMANTIC_FILE,'utf8'),patched=semanticReferenceSource(source);
 expect(hash(source)).toBe(SEMANTIC_BEFORE_SHA);
 expect(patched.replace('return actor === game.player || game.monsters.some(candidate => candidate === actor);','return (game.party?game.nativeAllyActors.some(candidate=>candidate===actor):actor===game.player) || game.monsters.some(candidate => candidate === actor);')).toBe(source);
 expect(()=>semanticReferenceSource(source+'\n')).toThrow('Unreviewed');
});
it('requires an independent full reference and native lifecycle for the reviewed multi-member combat delta',()=>{
 const {a,b}=paired();
 a.mode=b.mode='party-all';
 const manifests=a.crossformat.target.manifests;manifests['2/party-all']=manifests['2/party-only'];delete manifests['2/party-only'];
 expect(()=>compareCrossformatProof(a,b)).toThrow('Missing reviewed semantic reference');
 const measurement=structuredClone(b);measurement.sourceHash='d'.repeat(64);
 b.crossformat.semanticReference={identity:SEMANTIC_ID,file:SEMANTIC_FILE,beforeHash:SEMANTIC_BEFORE_SHA,afterHash:hash(semanticReferenceSource(readFileSync(SEMANTIC_FILE,'utf8'))),nativeSourceHash:b.sourceHash,sourceHash:measurement.sourceHash,artifact:'1-B-2-party-all.json.semantic.json',measurement};
 measurement.oos=0;
 expect(compareCrossformatProof(a,b).status).toBe('equivalent-under-explicit-adapter');
 const mislabeled=structuredClone(b);mislabeled.crossformat.frames[0].side='A';expect(()=>compareCrossformatProof(a,mislabeled)).toThrow();
 for(const mutate of [r=>r.measurement.crossformat.frames[1].nativeDomains.extensions='f'.repeat(64),r=>r.measurement.crossformat.lifecycle.seek=false,r=>r.beforeHash='e'.repeat(64),r=>r.nativeSourceHash='e'.repeat(64),r=>r.measurement.rngHash='e'.repeat(64)]){
  const bad=structuredClone(b);mutate(bad.crossformat.semanticReference);expect(()=>compareCrossformatProof(a,bad)).toThrow();
 }
});
it('coalesces complete round slices and rejects failed, missing, duplicated or drifting rounds',()=>{
 const reports=[1,2,3].map(round=>({identity:'party-v1',status:'round-complete',options:{rounds:3,steps:2049,shard:'all-full',roundIndex:round,out:`out-${round}`},sources:{A:'a',B:'b'},tools:{p:'hash'},runs:[{round,measurement:{node:`v24.${round}.0`,machine:{cpu:`cpu-${round}`}}}],comparisons:[]}));
 expect(combineRoundReports(reports).runs.map(r=>r.round)).toEqual([1,2,3]);
 expect(combineRoundReports(reports).options.roundIndex).toBeUndefined();
 for(const mutate of [r=>r.pop(),r=>r[2].options.roundIndex=2,r=>r[2].sources.B='other',r=>r[2].runs[0].round=1,r=>r[2].status='failed']){
  const bad=structuredClone(reports);mutate(bad);expect(()=>combineRoundReports(bad)).toThrow();
 }
});
it('accepts only bounded round slices and preserves the global AB/BA/AB round number',()=>{
 for(const parse of [parseOptions,parsePartyPerfOptions]){
  const args=['--base','a','--head','b','--out','o','--rounds','3','--shard','all-full'];
  expect(parse([...args,'--round-index','2']).roundIndex).toBe(2);
  for(const n of ['0','4','NaN','1.5'])expect(()=>parse([...args,'--round-index',n])).toThrow();
 }
});
