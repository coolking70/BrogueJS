import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const suites = JSON.parse(readFileSync(new URL('./test-suites.json', import.meta.url), 'utf8'));
const [command = 'test', ...args] = process.argv.slice(2);
const suite = command === 'full' ? 'test' : command;
if (!Object.hasOwn(suites, suite)) {
    console.error(`Unknown test suite: ${command}. Expected test, full, gen or drift.`);
    process.exit(1);
}

const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('vitest.mjs', import.meta.resolve('vitest/package.json'))),
    'run',
    ...args,
], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    stdio: 'inherit',
    env: {
        ...process.env,
        BROGUE_TEST_SUITE: suite,
        ...(command === 'full' ? { BROGUE_REQUIRE_CE: '1' } : {}),
    },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
