/** Full JSON equality (only savedAt is normalized by the capture runner). */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {write} from './ext-perf-common.mjs';
const [before,after,out]=process.argv.slice(2);
const read=(p,s)=>JSON.parse(readFileSync(p+s,'utf8'));
const a=read(before,'.summary.json'),b=read(after,'.summary.json');
assert.equal(a.recordingHash,b.recordingHash);
function compare(x,y,path='$') {
 assert.equal(typeof x,typeof y,path);
 if(x===null||typeof x!=='object'){assert.equal(x,y,path);return 1;}
 assert.ok(y!==null,path);assert.equal(Array.isArray(x),Array.isArray(y),path);
 assert.deepEqual(Object.keys(x),Object.keys(y),path);
 let leaves=0;for(const k of Object.keys(x))leaves+=compare(x[k],y[k],path+'.'+k);return leaves;
}
const domainLeaves=compare(read(before,'.domains.json'),read(after,'.domains.json'),'eventDomains')
 +compare(read(before,'.full-domains.json'),read(after,'.full-domains.json'),'verifiedFullDomains');
const leaves=compare(read(before,'.state.json'),read(after,'.state.json'));
assert.deepEqual(a.semantic,b.semantic);
write(out,{before,after,leaves,domainLeaves,differences:0,semantic:b.semantic,depth:Object.fromEntries(Object.keys(a.depth).map(d=>[d,{before:a.depth[d],after:b.depth[d]}]))});
console.log(JSON.stringify({leaves,domainLeaves,differences:0}));
