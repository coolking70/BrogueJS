import assert from 'node:assert/strict';
import {runSupplements} from './ext-perf-supplements.mjs';
const [measurement,out,...extra]=process.argv.slice(2);
assert.ok(measurement&&out&&!extra.length,'Expected MEASUREMENT_DIR NEW_SUPPLEMENT_DIR');
const result=runSupplements(measurement,out);
console.log(JSON.stringify({supplements:result.status,measurement}));
if(result.status==='failed')process.exitCode=1;
