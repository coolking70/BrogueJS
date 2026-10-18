import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '../../scripts/ext-perf-common.mjs';
import { it, expect } from 'vitest';
import { parseOptions, validateWindowMeasurement } from '../../scripts/run-party-window-perf.mjs';
import { merge, readShard } from '../../scripts/merge-party-window-perf.mjs';
const h = 'a'.repeat(64),
  stat = { n: 1, p50: 1, p95: 1, p99: 1, max: 1, total: 1 };
function measurement(actors, mode) {
  return {
    identity: 'party-window-v1',
    oos: 0,
    previewPollution: 0,
    actors,
    mode,
    steps: 1,
    scene: 'windows',
    samples: [{index: 0, recordLength: 4}],
    initialRecordLength: 3,
    finalRecordLength: 4,
    positiveTicks: 1,
    zeroTicks: 0,
    sourceHash: h,
    rowsHash: h,
    rngHash: h,
    fullDigest: h,
    input: { hash: h },
    node: 'v24',
    machine: { cpu: 'test' },
    ticks: 100,
    ...Object.fromEntries(
      ['inputToReady', 'acceptWait', 'projection', 'full', 'encoding', 'preview', 'focus'].map(
        (k) => [k, stat]
      )
    )
  };
}
function reports(rounds = 1) {
  return [1, 2, 4].map((actors) => ({
    identity: 'party-window-v1',
    mode: 'calibration-only',
    status: 'smoke-only',
    source: { sha: h, sourceHash: h },
    tools: { tool: h },
    options: { rounds, steps: 1, scene: 'windows' },
    runs: Array.from({ length: rounds }, (_, i) =>
      ['party-only', 'party-all'].map((mode) => ({
        round: i + 1,
        measurement: measurement(actors, mode)
      }))
    ).flat()
  }));
}
it('keeps smoke report-only and never invents a frozen budget', () => {
  const r = merge(reports());
  expect(r.status).toBe('smoke-only');
  expect(r.budget).toBeNull();
  expect(r.runs).toHaveLength(6);
});
it.each(['missing', 'duplicate', 'oos', 'source', 'input', 'machine', 'rounds'])(
  'fails closed for %s',
  (kind) => {
    const r = reports(3);
    if (kind === 'missing') r.pop();
    if (kind === 'duplicate') r[0].runs.push(r[0].runs[0]);
    if (kind === 'oos') r[0].runs[0].measurement.oos = 1;
    if (kind === 'source') r[0].source.sourceHash = 'b'.repeat(64);
    if (kind === 'input') r[0].runs[2].measurement.input = { hash: 'b'.repeat(64) };
    if (kind === 'machine') r[0].runs[2].measurement.machine = { cpu: 'different' };
    if (kind === 'rounds') r[1].options.rounds = 2;
    expect(() => merge(r)).toThrow();
  }
);
it('rejects invalid observer data and ambiguous CLI options', () => {
  expect(() =>
    validateWindowMeasurement({ ...measurement(2, 'party-only'), previewPollution: 1 })
  ).toThrow();
  expect(() => parseOptions(['--head', 'x', '--out', 'y', '--steps', '0'])).toThrow();
  expect(() =>
    parseOptions(['--head', 'x', '--out', 'y', '--rounds', '1', '--rounds', '3'])
  ).toThrow();
  expect(parseOptions(['--head', 'x', '--out', 'y', '--rounds', '1', '--steps', '8']).rounds).toBe(
    1
  );
});

it('requires original raw measurement and lifecycle artifacts, detecting missing or corrupted transfers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'window-perf-transport-'));
  try {
    const report = reports()[0];
    report.runs = report.runs.slice(0, 1);
    const run = report.runs[0],
      artifact = '1-1-party-only.json',
      save = { kind: 'save' },
      recording = { kind: 'recording' };
    run.artifact = artifact;
    run.measurement.artifactDigests = { save: hash(save), recording: hash(recording) };
    const raw = JSON.stringify(run.measurement);
    run.artifactHash = hash(raw);
    const file = join(dir, 'result.json');
    writeFileSync(file, JSON.stringify(report));
    writeFileSync(join(dir, artifact), raw);
    writeFileSync(join(dir, artifact + '.save.json'), JSON.stringify(save));
    writeFileSync(join(dir, artifact + '.recording.json'), JSON.stringify(recording));
    expect(readShard(file)).toEqual(report);
    writeFileSync(join(dir, artifact + '.save.json'), JSON.stringify({ kind: 'corrupt' }));
    expect(() => readShard(file)).toThrow('Raw lifecycle artifact mismatch');
    rmSync(join(dir, artifact));
    expect(() => readShard(file)).toThrow();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

it.each(['stalled', 'duplicate', 'truncated', 'missing-counter'])('rejects false successful measurements: %s', kind => {
  const row = measurement(1, 'party-all');
  if (kind === 'stalled') row.samples[0].recordLength = 3;
  if (kind === 'duplicate') row.samples[0].recordLength = 5;
  if (kind === 'truncated') row.finalRecordLength = 3;
  if (kind === 'missing-counter') delete row.initialRecordLength;
  expect(() => validateWindowMeasurement(row)).toThrow();
});
