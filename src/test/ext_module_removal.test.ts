import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkModuleRemoval, hashCandidate, isCandidateInput, removalGates, removalMatrix } from '../../scripts/check-module-removal.mjs';

const temporary: string[] = [];
function directory() {
    const root = mkdtempSync(join(tmpdir(), 'brogue-removal-policy-'));
    temporary.push(root);
    return root;
}
function fixture() {
    const root = directory();
    const write = (path: string, content: string) => {
        mkdirSync(dirname(join(root, path)), { recursive: true });
        writeFileSync(join(root, path), content);
    };
    const manifest = (test: string[]) => JSON.stringify({ test, gen: [], drift: [] });
    write('scripts/test-suites.json', manifest(['src/test/ext_foundation_probe.test.ts']));
    write('src/test/ext_foundation_probe.test.ts', 'export {};');
    for (const id of ['alpha', 'beta']) {
        write(`src/ext/modules/${id}/descriptor.ts`, 'export default {};');
        write(`src/ext/modules/${id}/test-suites.json`, manifest(['tests/probe.test.ts']));
        write(`src/ext/modules/${id}/tests/probe.test.ts`, 'export {};');
    }
    mkdirSync(join(root, 'node_modules'));
    return { root, write };
}
afterEach(() => {
    vi.restoreAllMocks();
    for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('physical module removal verification inputs', () => {
    it('enumerates every actual installed-directory subset without inventing future modules', () => {
        expect(removalMatrix([])).toEqual([{ id: 'keep-none', retained: [], removed: [] }]);
        expect(removalMatrix([{ id: 'alpha' }, { id: 'beta' }])).toEqual([
            { id: 'keep-alpha+beta', retained: ['alpha', 'beta'], removed: [] },
            { id: 'keep-alpha', retained: ['alpha'], removed: ['beta'] },
            { id: 'keep-beta', retained: ['beta'], removed: ['alpha'] },
            { id: 'keep-none', retained: [], removed: ['alpha', 'beta'] },
        ]);
    });
    it('hashes source/tests/resources without counting preserved CE reference or generated/raw evidence', () => {
        for (const path of ['src/ext/modules/alpha/data/rules.json', 'src/test/ext_probe.test.ts', 'scripts/test-suites.json', 'public/icon.png']) {
            expect(isCandidateInput(path), path).toBe(true);
        }
        for (const path of ['.git/HEAD', 'dist/app.js', 'node_modules/.vite/cache', 'node_modules/foo/index.js', 'tmp-phase1c-raw/screen.png', 'tsconfig.tsbuildinfo', 'tmp-phase1e-review/old.test.ts', '.ce-reference/BrogueCE-master/src/brogue/Rogue.h']) {
            expect(isCandidateInput(path), path).toBe(false);
        }
    });
    it('hashes candidate bytes and names deterministically without reusing build caches', () => {
        const root = mkdtempSync(join(tmpdir(), 'brogue-removal-hash-'));
        try {
            mkdirSync(join(root, 'src')); mkdirSync(join(root, 'dist'));
            writeFileSync(join(root, 'src/input.ts'), 'first'); writeFileSync(join(root, 'dist/output.js'), 'old');
            const first = hashCandidate(root);
            expect(first.files.map(file => file.path)).toEqual(['src/input.ts']);
            writeFileSync(join(root, 'dist/output.js'), 'new'); expect(hashCandidate(root)).toEqual(first);
            writeFileSync(join(root, 'src/input.ts'), 'second'); expect(hashCandidate(root).sha256).not.toBe(first.sha256);
        } finally { rmSync(root, { recursive: true, force: true }); }
    });
});

describe('normal-tree full and physical-removal gate profiles', () => {
    it('keeps complete npm test on the normal tree and only omits it after actual directory removal', () => {
        const rows = removalMatrix([{ id: 'alpha' }, { id: 'beta' }]);
        for (const row of rows) {
            const gates = removalGates(row, { maxWorkers: 2, engineOnly: true, output: '/tmp/evidence' });
            const ids = gates.commands.map(gate => gate.id);
            expect(gates.profile).toBe(row.removed.length ? 'removal' : 'full');
            expect(ids).toEqual(['boundaries', 'typecheck', 'build', 'extension-tests',
                ...(row.removed.length ? [] : ['complete-npm-test']), 'composition-smoke']);
            expect(gates.commands.find(gate => gate.id === 'extension-tests')?.command)
                .toEqual(['npm', 'run', 'test:ext', '--', '--maxWorkers=2']);
            expect(gates.commands.filter(gate => gate.command[0] === 'npm' && gate.command[1] === 'test'))
                .toHaveLength(row.removed.length ? 0 : 1);
            expect(gates.commands.find(gate => gate.id === 'composition-smoke')?.command)
                .toEqual([process.execPath, 'scripts/check-module-composition-smoke.mjs', '--output', `/tmp/evidence/${row.id}-smoke.json`,
                    '--engine-only', ...(row.removed.length ? ['--removed-modules', row.removed.join(',')] : [])]);
            expect(gates.commands.flatMap(gate => gate.command).some(arg => ['ce:fetch', 'test:full', 'test:gen'].includes(arg))).toBe(false);
        }
    });

    it('plans the complete matrix by default and explicitly records the normal-tree full obligation', async () => {
        const f = fixture();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const plan = await checkModuleRemoval([`--root=${f.root}`, '--plan']);
        expect(plan.requestedProfile).toBe('auto');
        expect(plan.matrix.map(row => row.profile)).toEqual(['full', 'removal', 'removal', 'removal']);
        expect(plan.normalTreeFullGate).toMatchObject({ required: true, includedInMatrix: true, status: 'not-run' });
        for (const row of plan.matrix) {
            expect(row.plannedGates).toEqual(removalGates(row).commands);
        }
    });

    it('filters explicit profiles without labeling unrun complete npm test as passed', async () => {
        const f = fixture();
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const removal = await checkModuleRemoval([`--root=${f.root}`, '--profile=removal', '--plan']);
        expect(removal.matrix).toHaveLength(3);
        expect(removal.matrix.every(row => row.removed.length > 0 && row.profile === 'removal')).toBe(true);
        expect(removal.normalTreeFullGate).toMatchObject({ required: true, includedInMatrix: false, status: 'not-run' });
        const full = await checkModuleRemoval([`--root=${f.root}`, '--profile=full', '--plan']);
        expect(full.matrix).toHaveLength(1);
        expect(full.matrix[0]).toMatchObject({ retained: ['alpha', 'beta'], removed: [], profile: 'full' });
        await expect(checkModuleRemoval([`--root=${f.root}`, '--profile=removal', '--retain=alpha,beta', '--plan']))
            .rejects.toThrow('No directory subsets match');
        await expect(checkModuleRemoval([`--root=${f.root}`, '--profile=full', '--retain=none', '--plan']))
            .rejects.toThrow('No directory subsets match');
        await expect(checkModuleRemoval([`--root=${f.root}`, '--profile=fast', '--plan']))
            .rejects.toThrow('Invalid gate profile');
    });

    it('prepares real deletions with exact test ownership, preserved CE sources and fresh caches without claiming execution', async () => {
        const f = fixture(), output = directory();
        f.write('.ce-reference/source.txt', 'existing CE reference');
        f.write('dist/old.js', 'old build');
        f.write('node_modules/.vite/old.json', '{}');
        f.write('node_modules/.tmp/old.tsbuildinfo', 'old types');
        f.write('tsconfig.tsbuildinfo', 'old types');
        vi.spyOn(console, 'log').mockImplementation(() => {});
        const result = await checkModuleRemoval([`--root=${f.root}`, `--output=${output}`, '--profile=removal', '--retain=beta', '--prepare-only', '--engine-only']);
        if (!('cases' in result)) throw new Error('Expected preparation evidence, not a plan');
        expect(result.status).toBe('prepared-not-verified');
        expect(result.normalTreeFullGate).toMatchObject({ required: true, includedInMatrix: false, status: 'not-run' });
        expect(result.browserStatus).toBe('not-run');
        expect(result.sourceFinalHash).toBe(result.inputHash);
        expect(result.cases).toHaveLength(1);
        const row = result.cases[0]!, copy = row.temporaryCopy;
        temporary.push(dirname(copy));
        expect(row).toMatchObject({ profile: 'removal', status: 'prepared-not-verified', gates: [], completeNpmTest: 'not-required-in-removal-profile', remainingModules: ['beta'] });
        expect(row.removedTests).toEqual(['src/ext/modules/alpha/tests/probe.test.ts']);
        expect(row.remainingTests).toEqual(['src/ext/modules/beta/tests/probe.test.ts', 'src/test/ext_foundation_probe.test.ts']);
        expect(row.deleted[0]).toMatchObject({ id: 'alpha', directory: 'src/ext/modules/alpha', verifiedAbsent: true });
        expect(row.plannedGates).toEqual(removalGates(row, { output, engineOnly: true }).commands);
        const removedRoot = row.deleted[0]!.directory, retainedRoot = result.ownedRoots.find(root => root !== removedRoot)!;
        expect(existsSync(join(f.root, removedRoot))).toBe(true);
        expect(existsSync(join(copy, removedRoot))).toBe(false);
        expect(existsSync(join(copy, retainedRoot))).toBe(true);
        expect(readFileSync(join(copy, '.ce-reference/source.txt'), 'utf8')).toBe('existing CE reference');
        for (const cache of ['dist', 'node_modules/.vite', 'node_modules/.tmp', 'tsconfig.tsbuildinfo']) {
            expect(existsSync(join(copy, cache)), cache).toBe(false);
        }
        const recorded = JSON.parse(readFileSync(join(output, 'module-removal-results.json'), 'utf8'));
        expect(recorded).toEqual(result);
    });
});
