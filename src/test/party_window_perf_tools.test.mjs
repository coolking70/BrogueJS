import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hash } from '../../scripts/ext-perf-common.mjs';
import { it, expect } from 'vitest';
import { parseOptions, validateWindowMeasurement, validateAiMeasurement, measurementTimeoutMs } from '../../scripts/run-party-window-perf.mjs';
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

function aiReports(){return reports().map(r=>({...r,identity:'party-ai-v1',options:{...r.options,scene:'ai'},runs:r.runs.map(run=>({...run,measurement:{...run.measurement,identity:'party-ai-v1',scene:'ai',input:{...run.measurement.input,route:'party-ai-managed-v1'},aiCounters:{calls:2,acceptedDecisions:2,nodes:7,budgetFallbacks:0,cacheHits:0}}}))}));}
it('keeps AI calibration distinct, selects AI A/B and rejects mixed identities',()=>{
  expect(merge(aiReports()).status).toBe('smoke-only');
  expect(parseOptions(['--head','b','--out','x','--scene','ai','--base','a']).base).toBe('a');
  const mixed=aiReports();mixed[0].runs[0].measurement.identity='party-window-v1';expect(()=>merge(mixed)).toThrow();
  expect(()=>validateWindowMeasurement(aiReports()[0].runs[0].measurement)).toThrow();
});
it('budgets four-member AI lifecycle verification within the workflow without changing measurement length', () => {
  expect([1, 2, 4].map(n => measurementTimeoutMs('ai', n))).toEqual([1800000, 1800000, 3600000]);
  expect(measurementTimeoutMs('windows', 4)).toBe(1800000);
  expect(parseOptions(['--head', 'b', '--out', 'x', '--scene', 'ai']).steps).toBe(2049);
  // Four A/B children and one semantic reference per hosted round, plus setup.
  expect(5 * measurementTimeoutMs('ai', 4)).toBeLessThan(345 * 60000);
  expect([1, 2, 4].map(n => measurementTimeoutMs('ai', n, true))).toEqual([1200000, 1200000, 2400000]);
  expect(measurementTimeoutMs('windows', 4, true)).toBe(1200000);
  expect(6 * measurementTimeoutMs('ai', 4, true)).toBeLessThan(345 * 60000);
});
it('keeps a failed AI shard fatal and identifies its original timeout', () => {
  const rows = aiReports();
  rows[2].status = 'failed'; rows[2].options.shard = 'all-prefix';
  rows[2].error = 'Failed 1-4-party-only.json: ETIMEDOUT';
  expect(() => merge(rows)).toThrow('Shard all-prefix failed: Failed 1-4-party-only.json: ETIMEDOUT');
});
it('publishes the actual aggregate failure instead of the workflow setup fallback', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ai-perf-failure-'));
  try {
    const rows = aiReports(), files = rows.map((row, i) => {
      row.runs = [];
      if (i === 2) {
        row.status = 'failed'; row.options.shard = 'all-prefix';
        row.error = 'Failed 1-4-party-only.json: ETIMEDOUT';
      }
      const file = join(dir, `${i}.json`); writeFileSync(file, JSON.stringify(row)); return file;
    });
    const out = join(dir, 'merged');
    const child = spawnSync(process.execPath, ['scripts/merge-party-window-perf.mjs', out, ...files], { encoding: 'utf8' });
    expect(child.status).toBe(1);
    const result = JSON.parse(readFileSync(join(out, 'result.json'), 'utf8'));
    expect(result.status).toBe('failed'); expect(result.hard).toBe('failed');
    expect(result.error).toContain('Shard all-prefix failed: Failed 1-4-party-only.json: ETIMEDOUT');
    expect(readFileSync(join(out, 'summary.md'), 'utf8')).toContain('ETIMEDOUT');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
it.each(['calls','acceptedDecisions','nodes'])('rejects absent AI work counter %s',key=>{const row=aiReports()[0].runs[0].measurement;delete row.aiCounters[key];expect(()=>validateAiMeasurement(row)).toThrow();});

function aiAbReports() {
  return abReports().map(report => ({ ...report, identity: 'party-ai-v1', options: {...report.options, scene: 'ai'},
    runs: report.runs.map(run => ({...run, measurement: {...run.measurement, identity: 'party-ai-v1', scene: 'ai',
      input: {...run.measurement.input, route: 'party-ai-managed-v1'},
      aiCounters: {calls: 3, acceptedDecisions: 3, nodes: 7, budgetFallbacks: 0, cacheHits: 0}}})) }));
}
it('compares all AI A/B sides and rounds with strict semantics and report-only budgets', () => {
  const result = merge(aiAbReports());
  expect(result.identity).toBe('party-ai-v1');
  expect(result.runs).toHaveLength(36);
  expect(result.comparisons).toHaveLength(18);
  expect(result.comparisons.every(row => row.status === 'report-only' && row.commandP95Ratio === 1)).toBe(true);
  expect(result.budget).toBeNull();
});
it.each(['calls', 'nodes', 'acceptedDecisions', 'budgetFallbacks', 'cacheHits', 'route', 'fullDigest', 'workload'])(
  'rejects AI A/B semantic or workload drift in %s', key => {
    const reports = aiAbReports();
    for (const report of reports) for (const run of report.runs.filter(r => r.side === 'B')) {
      if (key === 'route') run.measurement.input.route = 'unknown';
      else if (key === 'fullDigest') run.measurement.fullDigest = 'b'.repeat(64);
      else if (key === 'workload') run.measurement.samples[0].npcActions = 5;
      else run.measurement.aiCounters[key]++;
    }
    expect(() => merge(reports)).toThrow();
  }
);
it('preserves AI scene selection when the cloud workflow appends A/B arguments', () => {
  const workflow = readFileSync('.github/workflows/ext-perf.yml', 'utf8');
  expect(workflow).toContain('args=(--scene ai)');
  expect(workflow).toContain('args+=(--base "$GITHUB_WORKSPACE/base")');
  expect(workflow).not.toContain('party-ai requires calibration-only');
});
it('rejects a shortened multi-round window run', () => {
  expect(() => parseOptions(['--head','b','--out','x','--steps','16','--rounds','3'])).toThrow('smoke-only');
});
import {verifyWindowTools} from '../../scripts/merge-party-window-perf.mjs';
it('rechecks actual observer, runner, merger and adapter bytes before publishing a transported result',()=>{
 const tools=Object.fromEntries(['profile-party-window-perf.mjs','run-party-window-perf.mjs','merge-party-window-perf.mjs','ext-perf-common.mjs','party-perf-crossformat.mjs','party-perf-semantic.mjs','merge-party-rounds.mjs'].map(name=>[name,hash(readFileSync(`scripts/${name}`,'utf8'))]));
 expect(()=>verifyWindowTools(tools)).not.toThrow();
 tools['party-perf-crossformat.mjs']='a'.repeat(64);expect(()=>verifyWindowTools(tools)).toThrow('Tool drift');
 delete tools['party-perf-crossformat.mjs'];expect(()=>verifyWindowTools(tools)).toThrow('missing');
});

it('reports setup fallback and malformed observations without an iterable TypeError', () => {
 const dir=mkdtempSync(join(tmpdir(),'party-fallback-'));
 try {
  const file=join(dir,'result.json');
  writeFileSync(file,JSON.stringify({status:'failed',error:'No measurement report; inspect setup logs'}));
  expect(()=>readShard(file)).toThrow('No measurement report; inspect setup logs');
  writeFileSync(file,JSON.stringify({status:'smoke-only'}));
  expect(()=>readShard(file)).toThrow('missing runs array');
 }finally{rmSync(dir,{recursive:true,force:true});}
});
