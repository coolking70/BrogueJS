// Read-only review runner: materialize the probes outside the repository.
// Usage: node docs/ext/phase5-xreview.repro.mjs [-t XR-01]
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temporary = mkdtempSync('/private/tmp/phase5-xreview-');
const probe = join(temporary, 'cross.test.ts');
const config = join(temporary, 'vitest.config.mjs');
const source = readFileSync(
  new URL('./phase5-xreview.repro.ts', import.meta.url),
  'utf8',
).replace(/'__REPO_ROOT__([^']+)'/g, (_, suffix) =>
  JSON.stringify(join(root, suffix)),
);
writeFileSync(probe, source);
writeFileSync(
  config,
  `export default ${JSON.stringify({
    root,
    test: {
      include: [probe],
      testTimeout: 120000,
      maxWorkers: 1,
      fileParallelism: false,
    },
  })};\n`,
);
console.log(`Node ${process.version}; review evidence: ${temporary}`);
const result = spawnSync(
  process.execPath,
  [
    join(root, 'node_modules/vitest/vitest.mjs'),
    'run',
    '--config',
    config,
    probe,
    ...process.argv.slice(2),
    '--maxWorkers=1',
    '--no-file-parallelism',
    '--reporter=verbose',
  ],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=3072' },
  },
);
if (result.error) throw result.error;
if (result.signal) console.error(`Vitest terminated by ${result.signal}`);
process.exitCode = result.status ?? 1;
