import assert from 'node:assert/strict';
import {selectExtPerf} from './ext-perf-selection.mjs';
const old=selectExtPerf(['input','output']);assert.equal(old.manifest,'scripts/ext-perf-budget.json');assert.equal(old.route('all'),'scripts/perf/ext-late-all.route.json');
const next=selectExtPerf(['input','output','--phase6b4','--regenerate']);assert.equal(next.manifest,'scripts/ext-perf-6b4-budget.json');assert.equal(next.route('classic'),'scripts/perf/ext-6b4-late-classic.route.json');assert.equal(next.regenerate,true);
for(const args of [[],['input'],['--phase6b4','output'],['input','output','--manifest=anything'],['input','output','--phase6b4','--phase6b4'],['input','output','--regenerate','--regenerate'],['input','output','--classic-only']])assert.throws(()=>selectExtPerf(args));
assert.throws(()=>next.route('../all'));console.log('Performance selection: 2 identities and 8 rejection cases passed');
