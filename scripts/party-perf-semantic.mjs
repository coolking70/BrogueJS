/** Reviewed P1d native attack ownership delta. The measured candidates are never
 * patched. A separate B-minus-one-line execution supplies a complete oracle,
 * with its own save/load/replay/seek, instead of masking combat digest fields. */
import assert from 'node:assert/strict';
import {cpSync,mkdtempSync,readFileSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {hash,write} from './ext-perf-common.mjs';
import {hashCandidate} from './check-module-removal.mjs';

export const SEMANTIC_ID='p1d-native-attack-ownership-v1';
export const SEMANTIC_FILE='src/engine/Core/NativeAttackTransaction.ts';
export const SEMANTIC_AFTER_SHA='ddbbbde62071ac55172fb1024b515fa16fec5d8e0cb4e222b75bd74466bd06de';
export const SEMANTIC_BEFORE_SHA='35085cc348d972dbfe389371df56e4c58a7e0b913469972a89f322bff32d2c6c';
const before='(game.party?game.nativeAllyActors.some(candidate=>candidate===actor):actor===game.player)';
const after='actor === game.player';
export function semanticReferenceSource(source) {
 assert.equal(hash(source),SEMANTIC_BEFORE_SHA,'Unreviewed native attack ownership source');
 assert.equal(source.split(before).length,2);
 return source.replace(before,after);
}
export const needsSemanticReference=row=>row.mode==='party-all'&&row.actors>1;
export function captureSemanticReference({control,root,file,row,crossTarget,timeoutMs}) {
 if(!crossTarget||!needsSemanticReference(row))return;
 const dir=mkdtempSync(join(tmpdir(),'party-semantic-'));
 try {
  const original=hashCandidate(root);
  assert.equal(original.sha256,row.sourceHash,'Native candidate changed before semantic reference');
  for(const entry of original.files)cpSync(resolve(root,entry.path),resolve(dir,entry.path),{recursive:true});
  symlinkSync(resolve(root,'node_modules'),resolve(dir,'node_modules'),'dir');
  const source=readFileSync(resolve(dir,SEMANTIC_FILE),'utf8'),patched=semanticReferenceSource(source);
  writeFileSync(resolve(dir,SEMANTIC_FILE),patched);
  const changed=hashCandidate(dir);
  assert.deepEqual(changed.files,original.files.map(f=>f.path===SEMANTIC_FILE?{...f,sha256:hash(patched)}:f),'Reference changed more than the reviewed line');
  const referenceFile=file+'.semantic.json',script=row.scene?'profile-party-window-perf.mjs':'profile-party-perf.mjs';
  const args=[resolve(control,'scripts',script),referenceFile,row.mode,String(row.actors),String(row.steps),...(row.scene?[row.scene]:[])];
  const started=performance.now(),child=spawnSync(process.execPath,args,{cwd:dir,env:{...process.env,NODE_OPTIONS:'--max-old-space-size=3072',PARTY_PERF_CROSSFORMAT_TARGET:crossTarget},encoding:'utf8',maxBuffer:16*1024*1024,timeout:timeoutMs});
  write(referenceFile+'.log.json',{exit:child.status,signal:child.signal,error:child.error?.code??null,timeoutMs,elapsedMs:performance.now()-started,stdout:child.stdout,stderr:child.stderr});
  assert.ok(!child.error&&child.status===0,`Semantic reference failed: ${basename(referenceFile)} ${child.error?.code??child.signal??child.status}`);
  const raw=readFileSync(referenceFile,'utf8'),measurement=JSON.parse(raw);
  const lifecycleHashes=Object.fromEntries(['save','recording'].map(k=>[k,hash(readFileSync(referenceFile+'.'+k+'.json','utf8'))]));
  row.crossformat.semanticReference={identity:SEMANTIC_ID,file:SEMANTIC_FILE,beforeHash:hash(source),afterHash:hash(patched),nativeSourceHash:original.sha256,sourceHash:changed.sha256,artifact:basename(referenceFile),artifactHash:hash(raw),lifecycleHashes,measurement};
  validateSemanticReference(row);
  write(file,row);
 } finally {rmSync(dir,{recursive:true,force:true});}
}
export function validateSemanticReference(row) {
 const ref=row.crossformat?.semanticReference;
 if(!needsSemanticReference(row)){assert.equal(ref,undefined);return row;}
 assert.ok(ref,'Missing reviewed semantic reference');
 assert.equal(ref.identity,SEMANTIC_ID);assert.equal(ref.file,SEMANTIC_FILE);assert.equal(ref.beforeHash,SEMANTIC_BEFORE_SHA);
 assert.equal(ref.afterHash,SEMANTIC_AFTER_SHA);
 assert.equal(ref.nativeSourceHash,row.sourceHash,'Semantic reference belongs to another native candidate');
 assert.match(ref.sourceHash,/^[a-f0-9]{64}$/);assert.equal(ref.measurement.sourceHash,ref.sourceHash);
 assert.match(ref.artifact,/^[1-3]-B-[24]-party-all\.json\.semantic\.json$/);
 assert.equal(ref.measurement.crossformat?.semanticReference,undefined);
 assert.deepEqual(ref.measurement.crossformat.lifecycle,{saveLoad:true,seedReplay:true,seek:true});
 for(const key of ['identity','actors','mode','steps','input','rowsHash','rngHash','zeroTicks','ticks','initialRecordLength','finalRecordLength','aiCounters','node','machine'])
  assert.deepEqual(ref.measurement[key],row[key],`Semantic reference workload drift ${key}`);
 assert.equal(ref.measurement.oos,0);
 return ref.measurement;
}
export function verifySemanticArtifact(row,directory) {
 if(!row.crossformat)return;
 const ref=row.crossformat.semanticReference;
 if(!ref)return;
 validateSemanticReference(row);
 const file=resolve(directory,ref.artifact),raw=readFileSync(file,'utf8');
 assert.equal(hash(raw),ref.artifactHash,'Semantic reference artifact hash');assert.deepEqual(JSON.parse(raw),ref.measurement);
 for(const kind of ['save','recording'])assert.equal(hash(readFileSync(file+'.'+kind+'.json','utf8')),ref.lifecycleHashes[kind],'Semantic lifecycle artifact hash');
}
