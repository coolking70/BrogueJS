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
      ['--head', '--out', '--rounds', '--steps', '--shard', '--scene'].includes(k) && !seen.has(k),
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
  assert.ok(['single', 'windows', 'fixed-ticks'].includes(o.scene));
  if (o.shard) assert.ok(['classic', 'all-full', 'all-prefix'].includes(o.shard));
  return o;
}
export function validateWindowMeasurement(row) {
  assert.equal(row.identity, 'party-window-v1');
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
export async function run(args) {
  const o = parseOptions(args),
    out = resolve(o.out),
    root = resolve(o.head),
    control = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  assert.ok(!existsSync(out));
  mkdirSync(out, { recursive: true });
  let sha = null;
  try {
    sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {}
  const source = { sha, sourceHash: hashCandidate(root).sha256 },
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
    identity: 'party-window-v1',
    mode: 'calibration-only',
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
        for (const mode of ['party-only', 'party-all']) {
          const artifact = `${round}-${actors}-${mode}.json`,
            file = resolve(out, artifact),
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
                cwd: root,
                env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=3072' },
                encoding: 'utf8',
                maxBuffer: 16 * 1024 * 1024,
                timeout: 1200000
              }
            );
          write(resolve(out, artifact + '.log.json'), {
            exit: child.status,
            stdout: child.stdout,
            stderr: child.stderr
          });
          assert.equal(child.status, 0, `Failed ${artifact}: ${child.stderr}`);
          const row = validateWindowMeasurement(JSON.parse(readFileSync(file, 'utf8')));
          assert.equal(row.sourceHash, source.sourceHash);
          const old = result.runs.find(
            (r) => r.measurement.actors === actors && r.measurement.mode === mode
          );
          if (old)
            for (const k of [
              'sourceHash',
              'input',
              'rowsHash',
              'rngHash',
              'fullDigest',
              'ticks',
              'zeroTicks',
              'node',
              'machine'
            ])
              assert.deepEqual(row[k], old.measurement[k], `Drift ${k}`);
          result.runs.push({
            round,
            artifact,
            artifactHash: hash(readFileSync(file, 'utf8')),
            measurement: row
          });
          write(resolve(out, 'result.json'), result);
        }
    }
    assert.equal(hashCandidate(root).sha256, source.sourceHash, 'Candidate changed');
    result.status = o.rounds === 3 && o.steps === 2049 ? 'measured-no-budget' : 'smoke-only';
  } catch (error) {
    result.status = 'failed';
    result.error = String(error);
    throw error;
  } finally {
    write(resolve(out, 'result.json'), result);
    writeFileSync(
      resolve(out, 'summary.md'),
      `# Party window ${result.status}\n\n${result.runs.length} observations; ${o.scene}, rounds=${o.rounds}, steps=${o.steps}. Calibration only, no D6 verdict or frozen threshold. Node endpoints are not browser/FPS or memory peak evidence.\n`
    );
  }
  return result;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await run(process.argv.slice(2));
