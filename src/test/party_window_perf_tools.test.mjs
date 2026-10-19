import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '../../scripts/ext-perf-common.mjs';
import { it, expect } from 'vitest';
import { parseOptions, validateWindowMeasurement, validateAiMeasurement } from '../../scripts/run-party-window-perf.mjs';
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

function abReports() {
  return reports(3).map(report => {
    const sources = { A: report.source, B: { sha: 'b'.repeat(40), sourceHash: 'b'.repeat(64) } };
    return { ...report, mode: 'ab', source: sources.B, sources, runs: report.runs.flatMap(run => ['A', 'B'].map(side => ({
      ...structuredClone(run), side, measurement: { ...structuredClone(run.measurement), sourceHash: sources[side].sourceHash,
        fullDomains: Object.fromEntries(['actorActions', 'extensions', 'knowledge', 'native', 'party', 'random', 'world5'].map(k => [k, h])) }
    }))) };
  });
}
it('accepts window A/B with distinct source hashes and compares all three rounds without inventing a budget', () => {
  expect(parseOptions(['--base', 'a', '--head', 'b', '--out', 'c']).base).toBe('a');
  const result = merge(abReports());
  expect(result.mode).toBe('ab'); expect(result.runs).toHaveLength(36); expect(result.comparisons).toHaveLength(18);
  expect(result.comparisons.every(c => c.commandP95Ratio === 1 && c.status === 'report-only')).toBe(true);
  expect(result.budget).toBeNull();
});
it.each(['missing-side', 'wrong-side', 'domains', 'missing-domains', 'rows', 'rng', 'work', 'source', 'input', 'cpu'])(
  'rejects window A/B %s drift rather than reporting a speedup', kind => {
    const reports = abReports(), run = reports[0].runs[1];
    if (kind === 'missing-side') reports[0].runs.splice(1, 1);
    if (kind === 'wrong-side') run.side = 'C';
    if (kind === 'domains') run.measurement.fullDomains.party = 'c'.repeat(64);
    if (kind === 'missing-domains') for (const report of reports) for (const r of report.runs) delete r.measurement.fullDomains;
    if (kind === 'rows') run.measurement.rowsHash = 'c'.repeat(64);
    if (kind === 'rng') run.measurement.rngHash = 'c'.repeat(64);
    if (kind === 'work') run.measurement.samples[0].memberActions = 27;
    if (kind === 'source') run.measurement.sourceHash = h;
    if (kind === 'input') run.measurement.input.hash = 'c'.repeat(64);
    if (kind === 'cpu') run.measurement.machine.cpu = 'other';
    expect(() => merge(reports)).toThrow();
  }
);

function aiReports(){return reports().map(r=>({...r,identity:'party-ai-v1',options:{...r.options,scene:'ai'},runs:r.runs.map(run=>({...run,measurement:{...run.measurement,identity:'party-ai-v1',scene:'ai',aiCounters:{calls:2,acceptedDecisions:2,nodes:7,budgetFallbacks:0,cacheHits:0}}}))}));}
it('keeps AI calibration distinct and rejects A/B or mixed identities',()=>{
  expect(merge(aiReports()).status).toBe('smoke-only');
  expect(()=>parseOptions(['--head','b','--out','x','--scene','ai','--base','a'])).toThrow();
  const mixed=aiReports();mixed[0].runs[0].measurement.identity='party-window-v1';expect(()=>merge(mixed)).toThrow();
  expect(()=>validateWindowMeasurement(aiReports()[0].runs[0].measurement)).toThrow();
});
it.each(['calls','acceptedDecisions','nodes'])('rejects absent AI work counter %s',key=>{const row=aiReports()[0].runs[0].measurement;delete row.aiCounters[key];expect(()=>validateAiMeasurement(row)).toThrow();});
