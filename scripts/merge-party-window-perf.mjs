import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync, cpSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { write, hash } from './ext-perf-common.mjs';
import { validateWindowMeasurement } from './run-party-window-perf.mjs';
export function merge(reports) {
  assert.equal(reports.length, 3, 'Require all three shards');
  const first = reports[0],
    runs = [];
  for (const report of reports) {
    assert.equal(report.identity, 'party-window-v1');
    assert.equal(report.mode, 'calibration-only');
    assert.ok(['smoke-only', 'measured-no-budget'].includes(report.status));
    assert.deepEqual(report.source, first.source);
    assert.deepEqual(report.tools, first.tools);
    for (const k of ['rounds', 'steps', 'scene']) assert.equal(report.options[k], first.options[k]);
    runs.push(...report.runs);
  }
  const seen = new Set();
  for (const r of runs) {
    validateWindowMeasurement(r.measurement);
    const key = `${r.round}-${r.measurement.actors}-${r.measurement.mode}`;
    assert.ok(!seen.has(key), 'Duplicate scene');
    seen.add(key);
    assert.equal(r.measurement.sourceHash, first.source.sourceHash);
    assert.equal(r.measurement.steps, first.options.steps);
    assert.equal(r.measurement.scene, first.options.scene);
  }
  for (let round = 1; round <= first.options.rounds; round++)
    for (const a of [1, 2, 4])
      for (const mode of ['party-only', 'party-all'])
        assert.ok(seen.has(`${round}-${a}-${mode}`), 'Missing scene');
  assert.equal(runs.length, first.options.rounds * 6);
  for (const a of [1, 2, 4])
    for (const mode of ['party-only', 'party-all']) {
      const rows = runs
        .filter((r) => r.measurement.actors === a && r.measurement.mode === mode)
        .map((r) => r.measurement);
      for (const row of rows)
        for (const key of [
          'input',
          'rowsHash',
          'rngHash',
          'fullDigest',
          'node',
          'machine',
          'sourceHash',
          'ticks',
          'zeroTicks'
        ])
          assert.deepEqual(row[key], rows[0][key]);
    }
  return {
    identity: 'party-window-v1',
    mode: 'calibration-only',
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
/** Artifact transport is checked independently of the in-memory aggregation. */
export function readShard(file) {
  const report = JSON.parse(readFileSync(file, 'utf8'));
  for (const run of report.runs) {
    assert.match(run.artifact, /^[1-3]-[124]-party-(only|all)\.json$/);
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
  const result = merge(args.map(readShard));
  mkdirSync(out, { recursive: true });
  args.forEach((file, i) =>
    cpSync(dirname(resolve(file)), resolve(out, ['classic', 'all-full', 'all-prefix'][i]), {
      recursive: true
    })
  );
  write(resolve(out, 'result.json'), result);
  writeFileSync(
    resolve(out, 'summary.md'),
    `# Party window ${result.status}\n\n${result.runs.length} measurements. ${result.note}\n`
  );
}
