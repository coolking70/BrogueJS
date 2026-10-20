/** P1c -> P1d is an explicit, directional proof, never strict digest equality.
 * The only permitted changes are listed below. Every other mechanical leaf is
 * retained in the full oracle. This adapter supports unchanged creation routes;
 * conversions/rescues belong to separately identified B calibration scenes.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {boot, hash, write} from './ext-perf-common.mjs';
import {hashCandidate} from './check-module-removal.mjs';
export const CROSSFORMAT_ID = 'party-p1c-p1d-v1';
export const CROSSFORMAT_DELTAS = Object.freeze([
 'version:10->11', 'schema:brogue-web-whole-run-v10->v11',
 'recording:7->8 and origin:5->6 (native lifecycle, never patched)',
 'full-root codec tuple:[v10,10,23,5]->[v11,11,24,6]',
 'extensions.manifest.foundation:23->24', 'extensions.foundation.version:23->24',
 'extensions.manifest.modules[party]:0.3.0->0.4.0 rules identity (configuration unchanged)',
 'party.state.schema:3->4', 'party.state.initialActorIds:creation member IDs',
 'party.state.sources:creation provenance', 'party.state.transfers:[]',
 'oracle:two reviewed stationed traversals, valid only with empty stationed and stationedNative',
 'party.state.rescued:[]', 'party.state.residentMemories:[]', 'party.state.retired:[]', 'party.stationed:[]', 'party.stationedNative:{}'
]);
const DOMAINS = ['native','extensions','world5','actorActions','knowledge','random','party'];
const ALGORITHMS = ['src/engine/Core/RecordingDigest.ts','src/engine/Core/WorldCanonical.ts','src/ext/fingerprint.ts'];
const RECORDING_ALGORITHM = ALGORITHMS[0];
// Bound to P1c e72cd62/3431533. Only these two exact substitutions are
// equivalent on unchanged creation routes; no regexp or whole-file waiver.
const P1C_RECORDING_SHA = '88cc117934769a7b948db314fa5d9a1f81b963cf94bce14281c96b219131a943';
const P1D_RECORDING_SHA = 'bf3befd4b0a8c305012162d887d6fa32e514f47dfda4e3cebb53e988e6eba9cd';
const RECORDING_DELTA = 'empty-stationed-traversals-v1';
const REVIEWED_TRAVERSALS = [
 ['...(root.party?.actors.flatMap((a:any)=>a.inventory)??[])', '...(root.party?[...root.party.actors,...root.party.stationed].flatMap((a:any)=>a.inventory):[])'],
 ['root.player, ...(root.party?.actors??[])', 'root.player, ...(root.party?[...root.party.actors,...root.party.stationed]:[])']
];
export function crossformatAlgorithms(root) {
 const sources=Object.fromEntries(ALGORITHMS.map(p=>[p,readFileSync(resolve(root,p),'utf8')]));
 const hashes=Object.fromEntries(ALGORITHMS.map(p=>[p,hash(sources[p])]));
 let recording=sources[RECORDING_ALGORITHM];
 const side=hashes[RECORDING_ALGORITHM]===P1C_RECORDING_SHA?'A':'B';
 if(side==='B')for(const [before,after] of REVIEWED_TRAVERSALS) {
  assert.equal(recording.split(after).length,2,'Unreviewed stationed traversal');
  assert.ok(!recording.includes(before),'Mixed recording algorithm');
  recording=recording.replace(after,before);
 }
 assert.equal(hash(recording),P1C_RECORDING_SHA,'Cross-format full oracle algorithm changed; review a new adapter');
 const canonical={...hashes,[RECORDING_ALGORITHM]:hash(recording)};
 return {identity:RECORDING_DELTA,side,hashes,canonical};
}
function validateTargetAlgorithms(algorithms) {
 assert.equal(algorithms.identity,RECORDING_DELTA);assert.equal(algorithms.side,'B');
 assert.deepEqual(Object.keys(algorithms.hashes).sort(),[...ALGORITHMS].sort());
 for(const value of Object.values(algorithms.hashes))assert.match(value,/^[a-f0-9]{64}$/);
 assert.equal(algorithms.hashes[RECORDING_ALGORITHM],P1D_RECORDING_SHA);
 assert.deepEqual(algorithms.canonical,{...algorithms.hashes,[RECORDING_ALGORITHM]:P1C_RECORDING_SHA});
}

export function prepareCrossformatTarget(head, out) {
 const file = resolve(out, 'crossformat-target.json');
 execFileSync(process.execPath, [fileURLToPath(import.meta.url), '--capture', file],
  {cwd:resolve(head),env:{...process.env,NODE_OPTIONS:'--max-old-space-size=3072'},stdio:['ignore','pipe','pipe'],timeout:120000});
 return file;
}
export function readCrossformatTarget(file, sourceRoot=process.cwd()) {
 if (!file) return null;
 const target=JSON.parse(readFileSync(file,'utf8'));
 assert.equal(target.identity,CROSSFORMAT_ID);
 assert.deepEqual(target.allowedDeltas,CROSSFORMAT_DELTAS);
 validateTargetAlgorithms(target.algorithms);
 const sourceAlgorithms=crossformatAlgorithms(sourceRoot);
 assert.deepEqual(sourceAlgorithms.canonical,target.algorithms.canonical,'Cross-format full oracle algorithm changed; review a new adapter');
 assert.match(target.sourceHash,/^[a-f0-9]{64}$/);
 return target;
}
function partyEntry(manifest) {
 assert.equal(manifest.schema,1);
 const entries=manifest.modules.filter(m=>m.id==='party');
 assert.equal(entries.length,1);
 return entries[0];
}
/** Preserve every unlisted field; replacing the party entry is allowed only after
 * exact comparison of its schema, configuration and keys. Target identities are
 * generated by B's real registry and travel with hashed raw observations. */
export function liftP1cWorld(snapshot,targetManifest) {
 const value=structuredClone(snapshot), entry=partyEntry(value.extensions.manifest),target=partyEntry(targetManifest);
 assert.equal(targetManifest.foundation,24);assert.equal(target.version,'0.4.0');
 assert.equal(target.rules.version,'0.4.0');assert.equal(target.rules.schema,1);
 assert.equal(value.version,10);assert.equal(value.schema,'brogue-web-whole-run-v10');
 assert.equal(value.extensions.manifest.foundation,23);assert.equal(value.extensions.foundation.version,23);
 assert.equal(entry.version,'0.3.0');assert.equal(entry.rules.version,'0.3.0');
 assert.deepEqual(Object.keys(entry).sort(),Object.keys(target).sort());
 assert.deepEqual(Object.keys(entry.rules).sort(),Object.keys(target.rules).sort());
 assert.deepEqual(entry.configuration,target.configuration);assert.equal(entry.rules.schema,target.rules.schema);
 const adaptedManifest=structuredClone(value.extensions.manifest);
 adaptedManifest.foundation=24;
 adaptedManifest.modules[adaptedManifest.modules.findIndex(m=>m.id==='party')]=structuredClone(target);
 assert.deepEqual(adaptedManifest,targetManifest,'Unknown manifest difference');
 assert.equal(value.party.state.schema,3);
 for(const key of ['initialActorIds','sources','transfers','rescued','residentMemories','retired'])assert.ok(!Object.hasOwn(value.party.state,key),`Unexpected P1c ${key}`);
 assert.ok(!Object.hasOwn(value.party,'stationed'));assert.ok(!Object.hasOwn(value.party,'stationedNative'));
 const ids=value.party.state.members.map(m=>m.actorId).sort((a,b)=>a-b);
 assert.equal(ids.length,entry.configuration.members);assert.equal(new Set(ids).size,ids.length);
 value.version=11;value.schema='brogue-web-whole-run-v11';
 value.extensions.manifest=adaptedManifest;value.extensions.foundation.version=24;
 value.party.state.schema=4;value.party.state.initialActorIds=ids;
 value.party.state.sources=ids.map((actorId,index)=>({actorId,kind:'creation',key:`creation:${index}`,template:'party-member'}));
 value.party.state.transfers=[];value.party.state.rescued=[];value.party.state.residentMemories=[];value.party.state.retired=[];value.party.stationed=[];value.party.stationedNative={};
 return value;
}
export function crossformatFrame(snapshot,inputState,targetManifest,mechanicalDigest,hashJson,index) {
 const native=mechanicalDigest(snapshot,inputState);
 assert.deepEqual(Object.keys(native.domains).sort(),[...DOMAINS].sort());
 const side=snapshot.version===10?'A':'B';
 const lifted=side==='A'?liftP1cWorld(snapshot,targetManifest):structuredClone(snapshot);
 if(side==='B') {
  assert.equal(snapshot.version,11);assert.equal(snapshot.schema,'brogue-web-whole-run-v11');
  assert.deepEqual(snapshot.extensions.manifest,targetManifest);
  assert.equal(snapshot.extensions.foundation.version,24);assert.equal(snapshot.party.state.schema,4);
  assert.deepEqual(snapshot.party.stationed,[],'Reviewed oracle delta requires empty stationed');
  assert.deepEqual(snapshot.party.stationedNative,{},'Creation-route adapter requires empty stationedNative');
 }
 // Both sides execute two fresh full oracles and one detached lift/copy, so
 // the proof does not give B a cheaper instrumentation path.
 const adapted=mechanicalDigest(lifted,inputState);
 if(side==='B')assert.deepEqual(adapted,native,'B oracle is not stable');
 // Rebuild the B identity root, explicitly keeping its version tuple. The A
 // module's digestRoot correctly uses A's codec, so it cannot be reused here.
 const adaptedRoot=hashJson(['c5-root-v1',['brogue-web-whole-run-v11',11,24,6],hashJson(targetManifest),DOMAINS.map(k=>adapted.domains[k])]);
 if(side==='B')assert.equal(adaptedRoot,native.root,'Unexpected B root algorithm');
 return {index,side,nativeRoot:native.root,nativeDomains:native.domains,adaptedRoot,adaptedDomains:adapted.domains};
}
export function assertStableCrossformat(a,b) {
 if (!a.crossformat && !b.crossformat) return;
 assert.ok(a.crossformat && b.crossformat, 'Cross-format proof disappeared between rounds');
 for (const key of ['identity','allowedDeltas','target','nativeCodec','frames','lifecycle'])
  assert.deepEqual(a.crossformat[key],b.crossformat[key],`Unstable cross-format ${key}`);
}
export function compareCrossformatProof(a,b) {
 const x=a.crossformat,y=b.crossformat;
 assert.deepEqual({...a.input,manifest:undefined},{...b.input,manifest:undefined},'Cross-format input drift');
 assert.ok(x&&y,'Missing cross-format proof; strict digest mismatch cannot be waived');
 for(const proof of [x,y]) {
  assert.equal(proof.identity,CROSSFORMAT_ID);assert.deepEqual(proof.allowedDeltas,CROSSFORMAT_DELTAS);
  assert.equal(proof.frames.length,a.steps+1,'Require initial and every accepted input oracle');
  assert.equal(proof.lifecycle.saveLoad,true);assert.equal(proof.lifecycle.seedReplay,true);assert.equal(proof.lifecycle.seek,true);
 }
 assert.deepEqual(x.nativeCodec,{foundation:23,wholeRun:10,recording:7,origin:5,state:3});
 assert.deepEqual(y.nativeCodec,{foundation:24,wholeRun:11,recording:8,origin:6,state:4});
 assert.deepEqual(x.target,y.target);
 assert.equal(b.input.manifest.foundation,24);assert.equal(partyEntry(b.input.manifest).version,'0.4.0');
 assert.deepEqual(b.input.manifest,y.target.manifests[`${b.actors}/${b.mode}`]);
 const manifest=structuredClone(a.input.manifest);
 assert.equal(manifest.foundation,23);manifest.foundation=24;
 const entry=partyEntry(manifest),targetEntry=partyEntry(b.input.manifest);
 assert.equal(entry.version,'0.3.0');assert.deepEqual(entry.configuration,targetEntry.configuration);
 manifest.modules[manifest.modules.findIndex(m=>m.id==='party')]=structuredClone(targetEntry);
 assert.deepEqual(manifest,b.input.manifest,'Unknown A/B manifest difference');assert.equal(y.target.sourceHash,b.sourceHash);
 for(let i=0;i<x.frames.length;i++) {
  const p=x.frames[i],q=y.frames[i];
  for(const frame of [p,q]) {
   assert.match(frame.nativeRoot,/^[a-f0-9]{64}$/);assert.match(frame.adaptedRoot,/^[a-f0-9]{64}$/);
   for(const field of ['nativeDomains','adaptedDomains']) {assert.deepEqual(Object.keys(frame[field]).sort(),[...DOMAINS].sort());for(const value of Object.values(frame[field]))assert.match(value,/^[a-f0-9]{64}$/);}
  }
  assert.equal(p.index,i);assert.equal(q.index,i);assert.equal(p.side,'A');assert.equal(q.side,'B');
  assert.deepEqual(p.adaptedDomains,q.nativeDomains,`Unknown mechanical difference at input ${i}`);
  assert.equal(p.adaptedRoot,q.nativeRoot,`Unknown root difference at input ${i}`);
 }
 if (a.fullDomains) assert.deepEqual(x.frames.at(-1).nativeDomains,a.fullDomains);
 if (b.fullDomains) assert.deepEqual(y.frames.at(-1).nativeDomains,b.fullDomains);
 assert.equal(x.frames.at(-1).nativeRoot,a.fullDigest);assert.equal(y.frames.at(-1).nativeRoot,b.fullDigest);
 return {identity:CROSSFORMAT_ID,frames:x.frames.length,allowedDeltas:CROSSFORMAT_DELTAS,
  nativeDigests:{A:a.fullDigest,B:b.fullDigest},adaptedDigest:x.frames.at(-1).adaptedRoot,status:'equivalent-under-explicit-adapter'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 assert.equal(process.argv[2],'--capture');assert.ok(process.argv[3]);
 const {server,load}=await boot();
 try {
  const {createExtensionRegistry,getInstalledModuleDescriptors}=await load('ext/catalog.ts');
  const registry=createExtensionRegistry(),manifests={};
  for(const actors of [1,2,4])for(const mode of ['party-only','party-all']) {
   const ids=mode==='party-only'?['party']:getInstalledModuleDescriptors().map(m=>m.id);
   const manifest=registry.manifest(ids,{party:{schema:1,members:actors}});
   assert.equal(manifest.foundation,24);assert.equal(partyEntry(manifest).version,'0.4.0');manifests[`${actors}/${mode}`]=manifest;
  }
  write(resolve(process.argv[3]),{identity:CROSSFORMAT_ID,sourceHash:hashCandidate(process.cwd()).sha256,algorithms:crossformatAlgorithms(process.cwd()),allowedDeltas:CROSSFORMAT_DELTAS,manifests});
 } finally {await server.close();}
}
