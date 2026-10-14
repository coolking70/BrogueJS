/** Compare complete normalized world snapshots and all floor-boundary hashes. */
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const [before, after, output] = process.argv.slice(2);
const read = (prefix,suffix) => JSON.parse(readFileSync(`${prefix}.${suffix}.json`,'utf8'));
const a=read(before,'state'), b=read(after,'state'), sa=read(before,'summary'), sb=read(after,'summary');
let leaves=0, differences=0;
const paths=[];
function compare(a,b,path) {
    if (a && b && typeof a==='object' && typeof b==='object') {
        const ak=Object.keys(a),bk=Object.keys(b);
        if(Array.isArray(a)!==Array.isArray(b) || ak.length!==bk.length) mismatch(path+'.keys');
        for(const key of new Set([...ak,...bk])) compare(a[key],b[key],`${path}.${key}`);
    } else { leaves++; if(!Object.is(a,b))mismatch(path); }
}
function mismatch(path) {differences++;if(paths.length<20)paths.push(path);}
compare(a,b,'world');
assert.equal(differences,0,JSON.stringify({differences,paths}));
assert.deepEqual(sb.checkpoints,sa.checkpoints,'Floor-boundary state/RNG digests differ');
assert.equal(sb.events,sa.events);
const metadata = rows => rows.map(({ms, ...row}) => row);
assert.deepEqual(metadata(read(after, 'rows')), metadata(read(before, 'rows')), 'Per-command results differ');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const result={events:sb.events,commandMetadataCompared:sb.events,checkpoints:sb.checkpoints.length,comparedLeaves:leaves,differences,
    normalizedFields:['savedAt'],beforeHash:hash(a),afterHash:hash(b),rng:b.rngState};
if(output)writeFileSync(output,JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
