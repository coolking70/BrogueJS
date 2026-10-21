import {verifyRoundEnvironments} from './merge-party-rounds.mjs';
import {verifySemanticArtifact} from './party-perf-semantic.mjs';
import assert from 'node:assert/strict';
import {assertStableCrossformat} from './party-perf-crossformat.mjs';
import { readFileSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { write, hash } from './ext-perf-common.mjs';
import { validateWindowMeasurement, validateAiMeasurement, compareWindowPair, compareAiPair } from './run-party-window-perf.mjs';
export function merge(reports) {
  assert.equal(reports.length, 3, 'Require all three shards');
  const first = reports[0];
  if(first.options?.comparison==='party-p1c-p1d-v2')assert.ok(first.tools?.['party-perf-crossformat.mjs'],'Missing adapter provenance');
  assert.ok(['party-window-v1','party-ai-v1'].includes(first.identity));
  const
    runs = [], sides = first.mode === 'ab' ? ['A', 'B'] : ['B'];
  assert.ok(['ab', 'calibration-only'].includes(first.mode));
  for (const report of reports) {
    verifyRoundEnvironments(report);
    assert.equal(report.roundSharded,first.roundSharded);
    assert.equal(report.identity, first.identity);
    assert.equal(report.mode, first.mode);
    assert.deepEqual(report.sources, first.sources);
    assert.ok(['smoke-only', 'measured-no-budget'].includes(report.status),
      `Shard ${report.options?.shard ?? 'unknown'} ${report.status}: ${report.error ?? 'measurement incomplete'}`);
    assert.deepEqual(report.source, first.source);
    assert.deepEqual(report.tools, first.tools);
    for (const k of ['rounds', 'steps', 'scene', 'comparison']) assert.equal(report.options[k], first.options[k]);
    runs.push(...report.runs);
  }
  const seen = new Set();
  for (const r of runs) {
    (first.identity==='party-ai-v1'?validateAiMeasurement:validateWindowMeasurement)(r.measurement);
    const side = r.side ?? 'B';
    assert.ok(sides.includes(side));
    const key = `${r.round}-${side}-${r.measurement.actors}-${r.measurement.mode}`;
    assert.ok(!seen.has(key), 'Duplicate scene');
    seen.add(key);
    assert.equal(r.measurement.sourceHash, (first.mode === 'ab' ? first.sources[side] : first.source).sourceHash);
    assert.equal(r.measurement.steps, first.options.steps);
    assert.equal(r.measurement.scene, first.options.scene);
  }
  for (let round = 1; round <= first.options.rounds; round++)
    for (const a of [1, 2, 4])
      for (const mode of ['party-only', 'party-all'])
        for (const side of sides) assert.ok(seen.has(`${round}-${side}-${a}-${mode}`), 'Missing scene');
  assert.equal(runs.length, first.options.rounds * 6 * sides.length);
  for (const a of [1, 2, 4])
    for (const mode of ['party-only', 'party-all']) for (const side of sides) {
      const rows = runs
        .filter((r) => (r.side ?? 'B') === side && r.measurement.actors === a && r.measurement.mode === mode)
        .map((r) => r.measurement);
      for (const row of rows) assertStableCrossformat(row, rows[0]);
      for (const row of rows)
        for (const key of [
          'input',
          'rowsHash',
          'rngHash',
          'fullDigest',
          'fullDomains',
          ...(first.identity === 'party-ai-v1' ? ['aiCounters'] : []),
          ...(first.roundSharded?[]:['node','machine']),
          'sourceHash',
          'ticks',
          'zeroTicks'
        ])
          assert.deepEqual(row[key], rows[0][key]);
    }
  const comparisons = first.mode === 'ab' ? runs.filter(r => r.side === 'A').map(a => {
    const b = runs.find(r => r.side === 'B' && r.round === a.round && r.measurement.actors === a.measurement.actors && r.measurement.mode === a.measurement.mode);
    return { round: a.round, actors: a.measurement.actors, mode: a.measurement.mode,
      ...(first.identity === 'party-ai-v1' ? compareAiPair : compareWindowPair)(a.measurement, b.measurement, first.options.comparison ?? 'strict') };
  }) : [];
  return {
    identity: first.identity,
    mode: first.mode,
    ...(first.mode === 'ab' ? { sources: first.sources } : {}),
    comparisons,
    status:
      first.options.rounds === 3 && first.options.steps === 2049
        ? 'measured-no-budget'
        : 'smoke-only',
    source: first.source,
    tools: first.tools,
    options: first.options,
    runs,
    budget: null,
    note: 'Numbers/metric grades need maintainer review, then a separate complete validation. No automatic freeze; no D6 verdict.'
  };
}
export function verifyWindowTools(tools) {
  const names=['profile-party-window-perf.mjs','run-party-window-perf.mjs','merge-party-window-perf.mjs','ext-perf-common.mjs','party-perf-crossformat.mjs','party-perf-semantic.mjs','merge-party-rounds.mjs'];
  assert.deepEqual(Object.keys(tools).sort(),names.sort(),'Unknown or missing measurement tool');
  for(const name of names)assert.equal(hash(readFileSync(new URL(name,import.meta.url),'utf8')),tools[name],`Tool drift ${name}`);
}
/** Artifact transport is checked independently of the in-memory aggregation. */
export function readShard(file) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  assert.ok(['smoke-only','measured-no-budget'].includes(report.status), `Shard ${report.options?.shard ?? file} ${report.status}: ${report.error ?? 'measurement incomplete'}`);
  assert.ok(Array.isArray(report.runs), `Shard ${file}: missing runs array`);
  for (const run of report.runs) {
    verifySemanticArtifact(run.measurement,dirname(file));
    assert.match(run.artifact, /^[1-3]-(?:[AB]-)?[124]-party-(only|all)\.json$/);
    const path = resolve(dirname(file), run.artifact),
      raw = readFileSync(path, 'utf8');
    assert.equal(hash(raw), run.artifactHash, 'Raw measurement hash mismatch');
    assert.deepEqual(JSON.parse(raw), run.measurement, 'Result/raw measurement mismatch');
    for (const kind of ['save', 'recording']) {
      const value = JSON.parse(readFileSync(path + '.' + kind + '.json', 'utf8'));
      assert.equal(
        hash(value),
        run.measurement.artifactDigests?.[kind],
        'Raw lifecycle artifact mismatch'
      );
    }
  }
  return report;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    out = args.shift();
  assert.ok(out && args.length === 3, 'output + three result.json files');
  mkdirSync(out, { recursive: true });
  try {
    const result = merge(args.map(readShard));
    verifyWindowTools(result.tools);
    args.forEach((file, i) =>
      cpSync(dirname(resolve(file)), resolve(out, ['classic', 'all-full', 'all-prefix'][i]), {
        recursive: true
      })
    );
    write(resolve(out, 'result.json'), result);
    writeFileSync(
      resolve(out, 'summary.md'),
      `# ${result.identity} ${result.status}\n\n${result.runs.length} measurements. ${result.note}\n`
    );
  } catch (error) {
    write(resolve(out, 'result.json'), { status: 'failed', hard: 'failed', error: String(error), shards: args });
    writeFileSync(resolve(out, 'summary.md'), `# Party calibration failed\n\n${String(error)}\n\nNo performance verdict or budget. Inspect the original shard artifacts.\n`);
    throw error;
  }
}
