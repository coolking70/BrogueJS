/** Two reviewed benchmark identities; no caller supplied paths or partial cases. */
import assert from 'node:assert/strict';
export function selectExtPerf(args) {
 const [inputDir,outputDir,...flags]=args;
 assert.ok(inputDir&&outputDir&&!inputDir.startsWith('--')&&!outputDir.startsWith('--'),'Expected input and output directories');
 assert.equal(new Set(flags).size,flags.length,'Duplicate benchmark option');
 assert.ok(flags.every(f=>f==='--regenerate'||f==='--phase6b4'),'Unknown benchmark option');
 const phase6b4=flags.includes('--phase6b4');
 return {inputDir,outputDir,regenerate:flags.includes('--regenerate'),
  manifest:phase6b4?'scripts/ext-perf-6b4-budget.json':'scripts/ext-perf-budget.json',
  route:id=>{assert.ok(id==='classic'||id==='all','Unknown benchmark case');return `scripts/perf/ext-${phase6b4?'6b4-':''}late-${id}.route.json`;}};
}
