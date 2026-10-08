import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repositoryRoot, resolveTestSuites } from './test-discovery.mjs';

const [command = 'test', ...args] = process.argv.slice(2);
const suite = command === 'full' ? 'test' : command;
let discovery;
try { discovery = resolveTestSuites(repositoryRoot); }
catch (error) { console.error(error.message); process.exit(1); }
if (!Object.hasOwn(discovery.suites, suite)) {
    console.error(`Unknown test suite: ${command}. Expected test, full, gen, drift or ext.`);
    process.exit(1);
}
// Vite repeats the same strict discovery locally. Do not put the growing file
// inventory in a single environment string (Linux's exec limit is per string).
const env = { ...process.env, BROGUE_TEST_SUITE: suite,
    ...(command === 'full' ? { BROGUE_REQUIRE_CE: '1' } : {}),
};
delete env.BROGUE_TEST_DISCOVERY;
const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('vitest.mjs', import.meta.resolve('vitest/package.json'))),
    'run', ...args,
], {
    cwd: repositoryRoot, stdio: 'inherit',
    env,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
