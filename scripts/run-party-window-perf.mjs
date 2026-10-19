import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, execFileSync } from 'node:child_process';
import { hash, write } from './ext-perf-common.mjs';
import { hashCandidate } from './check-module-removal.mjs';
export function parseOptions(args) {
  const o = { rounds: 3, steps: 2049, scene: 'windows' },
    seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const k = args[i];
    assert.ok(
      ['--base', '--head', '--out', '--rounds', '--steps', '--shard', '--scene'].includes(k) && !seen.has(k),
      'Unknown/duplicate option'
    );
    seen.add(k);
    const v = args[++i];
    assert.ok(v && !v.startsWith('--'));
    o[k.slice(2)] = ['--rounds', '--steps'].includes(k) ? Number(v) : v;
  }
  assert.ok(o.head && o.out);
  assert.ok([1, 2, 3].includes(o.rounds));
  assert.ok(Number.isSafeInteger(o.steps) && o.steps > 0 && o.steps <= 2049);
  assert.ok(['single', 'windows', 'fixed-ticks', 'ai'].includes(o.scene));
  if (o.shard) assert.ok(['classic', 'all-full', 'all-prefix'].includes(o.shard));
  if(o.scene==='ai')assert.ok(!o.base,'AI v1 is B calibration only');
  return o;
}
export function validateWindowMeasurement(row) {return validateMeasurement(row,'party-window-v1');}
export function validateAiMeasurement(row) {assert.equal(row.scene,'ai');assert.ok(row.aiCounters.calls>0);assert.ok(row.aiCounters.nodes>=0);assert.ok(row.aiCounters.acceptedDecisions>0);return validateMeasurement(row,'party-ai-v1');}
function validateMeasurement(row, identity) {
  assert.equal(row.identity, identity);
  assert.equal(row.oos, 0);
  assert.equal(row.previewPollution, 0);
  assert.ok([1, 2, 4].includes(row.actors));
  assert.ok(['party-only', 'party-all'].includes(row.mode));
  assert.equal(row.samples.length, row.steps);
  assert.ok(Number.isSafeInteger(row.initialRecordLength) && row.initialRecordLength >= 0);
  assert.equal(row.finalRecordLength, row.initialRecordLength + row.steps);
  row.samples.forEach((sample, index) => {
    assert.equal(sample.index, index);
    assert.equal(sample.recordLength, row.initialRecordLength + index + 1, 'Unaccepted or duplicated measured input');
  });
  assert.equal(row.positiveTicks + row.zeroTicks, row.steps);
  for (const key of ['sourceHash', 'rowsHash', 'rngHash', 'fullDigest'])
    assert.match(row[key], /^[a-f0-9]{64}$/);
  for (const metric of [
    'inputToReady',
    'acceptWait',
    'projection',
    'full',
    'encoding',
    'preview',
    'focus'
  ]) {
    assert.ok(row[metric].n > 0);
    for (const key of ['p50', 'p95', 'p99', 'max', 'total'])
      assert.ok(Number.isFinite(row[metric][key]) && row[metric][key] >= 0);
  }
  return row;
}
/** Same-input optimization comparison: semantic drift is an error, not a
 * performance result. Layer timers overlap and must never be added together. */
export function compareWindowPair(a, b) {
  validateWindowMeasurement(a); validateWindowMeasurement(b);
  for (const key of ['actors', 'mode', 'steps', 'scene', 'input', 'rowsHash', 'rngHash',
    'fullDigest', 'fullDomains', 'ticks', 'zeroTicks', 'initialRecordLength', 'finalRecordLength', 'node', 'machine'])
    assert.deepEqual(a[key], b[key], `A/B drift ${key}`);
  assert.deepEqual(Object.keys(a.fullDomains ?? {}).sort(),
    ['actorActions', 'extensions', 'knowledge', 'native', 'party', 'random', 'world5']);
  const work = row => row.samples.map(({index, action, label, ticks, blocks, npcActions, memberActions, reason, recordLength}) =>
    ({index, action, label, ticks, blocks, npcActions, memberActions, reason, recordLength}));
  assert.deepEqual(work(a), work(b), 'A/B workload drift');
  const ratio = (x, y) => x > 0 ? y / x : null;
  const tail = row => Math.max(0, ...row.samples.filter(s => ['1000', 'auto'].includes(s.label)).map(s => s.inputToReadyMs));
  return { status: 'report-only', commandP95Ratio: ratio(a.inputToReady.p95, b.inputToReady.p95),
    longWindowMaxRatio: ratio(tail(a), tail(b)) };
}
export async function run(args) {
  const o = parseOptions(args),
    out = resolve(o.out),
    root = resolve(o.head),
    control = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.ok(!existsSync(out));
  mkdirSync(out, { recursive: true });
  const roots = o.base ? { A: resolve(o.base), B: root } : { B: root };
  const sources = Object.fromEntries(Object.entries(roots).map(([side, path]) => {
    let commit = null;
    try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: path, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch {}
    return [side, { sha: commit, sourceHash: hashCandidate(path).sha256 }];
  }));
  const source = sources.B,
    toolNames = [
      'profile-party-window-perf.mjs',
      'run-party-window-perf.mjs',
      'merge-party-window-perf.mjs',
      'ext-perf-common.mjs'
    ],
    tools = Object.fromEntries(
      toolNames.map((n) => [n, hash(readFileSync(resolve(control, 'scripts', n), 'utf8'))])
    );
  const result = {
    identity: o.scene==='ai'?'party-ai-v1':'party-window-v1',
    mode: o.base ? 'ab' : 'calibration-only',
    ...(o.base ? { sources } : {}),
    comparisons: [],
    status: 'running',
    options: o,
    source,
    tools,
    runs: [],
    budget: null
  };
  try {
    for (let round = 1; round <= o.rounds; round++) {
      const rotation = [
          [1, 2, 4],
          [2, 4, 1],
          [4, 1, 2]
        ][round - 1],
        counts = o.shard
          ? [[1, 2, 4][['classic', 'all-full', 'all-prefix'].indexOf(o.shard)]]
          : rotation;
      for (const actors of counts)
        for (const mode of ['party-only', 'party-all'])
        for (const side of o.base ? (round % 2 ? ['A', 'B'] : ['B', 'A']) : ['B']) {
          const artifact = `${round}-${o.base ? side + '-' : ''}${actors}-${mode}.json`,
            file = resolve(out, artifact),
            childStarted = performance.now(),
            child = spawnSync(
              process.execPath,
              [
                resolve(control, 'scripts/profile-party-window-perf.mjs'),
                file,
                mode,
                String(actors),
                String(o.steps),
                o.scene
              ],
              {
                cwd: roots[side],
                env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=3072' },
                encoding: 'utf8',
                maxBuffer: 16 * 1024 * 1024,
                timeout: 1200000
              }
            );
          write(resolve(out, artifact + '.log.json'), {
            exit: child.status, signal: child.signal, error: child.error ? {code:child.error.code??null,message:child.error.message}:null, elapsedMs:performance.now()-childStarted, timeoutMs:1200000,
            stdout: child.stdout,
            stderr: child.stderr
          });
          assert.equal(child.status, 0, `Failed ${artifact}: ${child.stderr}`);
          const row = (o.scene==='ai'?validateAiMeasurement:validateWindowMeasurement)(JSON.parse(readFileSync(file, 'utf8')));
          assert.equal(row.sourceHash, sources[side].sourceHash);
          const old = result.runs.find(
            (r) => (r.side ?? 'B') === side && r.measurement.actors === actors && r.measurement.mode === mode
          );
          if (old)
            for (const k of [
              'sourceHash',
              'input',
              'rowsHash',
              'rngHash',
              'fullDigest',
              'fullDomains',
              'ticks',
              'zeroTicks',
              'node',
              'machine'
            ])
              assert.deepEqual(row[k], old.measurement[k], `Drift ${k}`);
          result.runs.push({
            round,
            ...(o.base ? { side } : {}),
            artifact,
            artifactHash: hash(readFileSync(file, 'utf8')),
            measurement: row
          });
          write(resolve(out, 'result.json'), result);
        }
    }
    for (const side of Object.keys(roots)) assert.equal(hashCandidate(roots[side]).sha256, sources[side].sourceHash, 'Candidate changed');
    if (o.base) for (const a of result.runs.filter(r => r.side === 'A')) {
      const b = result.runs.find(r => r.side === 'B' && r.round === a.round && r.measurement.actors === a.measurement.actors && r.measurement.mode === a.measurement.mode);
      result.comparisons.push({ round: a.round, actors: a.measurement.actors, mode: a.measurement.mode,
        ...compareWindowPair(a.measurement, b.measurement) });
    }
    result.status = o.rounds === 3 && o.steps === 2049 ? 'measured-no-budget' : 'smoke-only';
  } catch (error) {
    result.status = 'failed';
    result.error = String(error);
    throw error;
  } finally {
    write(resolve(out, 'result.json'), result);
    writeFileSync(
      resolve(out, 'summary.md'),
      `# Party window ${result.status}\n\n${result.runs.length} observations; ${o.scene}, rounds=${o.rounds}, steps=${o.steps}. ${result.mode === 'ab' ? 'Same-input A/B, report only' : 'Calibration only'}, no D6 verdict or frozen threshold. Node endpoints are not browser/FPS or memory peak evidence.\n`
    );
  }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await run(process.argv.slice(2));
