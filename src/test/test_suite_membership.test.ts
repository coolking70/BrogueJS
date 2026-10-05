/** Test ownership remains strict when installed module directories disappear. */
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { configDefaults } from 'vitest/config';
import { testSuiteOptions } from '../../vite.config';
import { resolveTestSuites, suiteNames } from '../../scripts/test-discovery.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const discovery = resolveTestSuites(root);

function fixture(action: (directory: string) => void): void {
    const directory = mkdtempSync(join(tmpdir(), 'brogue-test-ownership-'));
    const put = (path: string, data: unknown) => {
        mkdirSync(join(directory, path, '..'), { recursive: true });
        writeFileSync(join(directory, path), typeof data === 'string' ? data : JSON.stringify(data));
    };
    put('scripts/test-suites.json', { test: ['src/test/ext_base.test.ts'], gen: [], drift: [] });
    put('src/test/ext_base.test.ts', '');
    put('src/ext/modules/probe/descriptor.ts', 'export default {}');
    put('src/ext/modules/probe/test-suites.json', { test: ['tests/owned.test.ts'], gen: [], drift: [] });
    put('src/ext/modules/probe/tests/owned.test.ts', '');
    try { action(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

describe('test suite membership', () => {
    it('registers every discovered test exactly once with its actual owner', () => {
        const registered = suiteNames.flatMap(suite => discovery.suites[suite]);
        expect([...registered].sort()).toEqual(discovery.files);
        expect(new Set(registered).size).toBe(registered.length);
        for (const file of discovery.files) {
            const owner = discovery.owners[file]!;
            if (owner.kind === 'module') expect(file.startsWith(`src/ext/modules/${owner.moduleId}/tests/`)).toBe(true);
            else expect(file.startsWith('src/ext/modules/')).toBe(false);
        }
    });

    it('uses the exact resolved partition in Vite and ext includes all foundation/module tests', () => {
        for (const suite of [...suiteNames, 'ext'] as const) {
            expect(testSuiteOptions(suite)).toEqual({ include: discovery.suites[suite], exclude: configDefaults.exclude });
        }
        expect(discovery.suites.ext).toEqual(discovery.files.filter(file => discovery.owners[file]!.kind === 'module' || /^src\/test\/(?:ext_|phase4)/.test(file)));
        expect(testSuiteOptions(undefined)).toEqual({ include: discovery.files, exclude: configDefaults.exclude });
        expect(() => testSuiteOptions('typo')).toThrow('Unknown test suite');
    });

    it('routes all npm suites through the shared discovery runner', () => {
        const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
        for (const suite of ['test', 'full', 'gen', 'drift', 'ext']) {
            expect(scripts[suite === 'test' ? 'test' : `test:${suite}`]).toBe(`node scripts/run-test-suite.mjs ${suite}`);
        }
    });

    it('removes only owned tests after actual module-directory deletion', () => fixture(directory => {
        writeFileSync(join(directory, 'src/test/phase4e_fixture.test.ts'), '');
        writeFileSync(join(directory, 'scripts/test-suites.json'), JSON.stringify({ test: ['src/test/ext_base.test.ts', 'src/test/phase4e_fixture.test.ts'], gen: [], drift: [] }));
        const before = resolveTestSuites(directory);
        expect(before.suites.test).toHaveLength(3);
        rmSync(join(directory, 'src/ext/modules/probe'), { recursive: true });
        const after = resolveTestSuites(directory);
        expect(after.modules).toEqual([]);
        expect(after.suites.test).toEqual(['src/test/ext_base.test.ts', 'src/test/phase4e_fixture.test.ts']);
        expect(after.suites.ext).toEqual(['src/test/ext_base.test.ts', 'src/test/phase4e_fixture.test.ts']);
    }));

    it('uses the same stable module-ID grammar as the runtime registry', () => fixture(directory => {
        const modules = join(directory, 'src/ext/modules');
        renameSync(join(modules, 'probe'), join(modules, 'alpha.beta'));
        expect(resolveTestSuites(directory).modules.map(module => module.id)).toEqual(['alpha.beta']);
        renameSync(join(modules, 'alpha.beta'), join(modules, 'alpha--bad'));
        expect(() => resolveTestSuites(directory)).toThrow('Invalid module directory');
        renameSync(join(modules, 'alpha--bad'), join(modules, 'alpha-'));
        expect(() => resolveTestSuites(directory)).toThrow('Invalid module directory');
    }));

    it('fails stale, unregistered, duplicate and escaped ownership rather than excluding tests', () => fixture(directory => {
        const manifest = join(directory, 'src/ext/modules/probe/test-suites.json');
        const save = (test: string[]) => writeFileSync(manifest, JSON.stringify({ test, gen: [], drift: [] }));
        save(['tests/owned.test.ts', 'tests/missing.test.ts']);
        expect(() => resolveTestSuites(directory)).toThrow('Stale');
        save([]); expect(() => resolveTestSuites(directory)).toThrow('Unregistered');
        save(['tests/owned.test.ts', 'tests/owned.test.ts']); expect(() => resolveTestSuites(directory)).toThrow('Duplicate');
        save(['../other.test.ts']); expect(() => resolveTestSuites(directory)).toThrow('invalid owned path');
        save(['tests/owned.test.ts']);
        writeFileSync(join(directory, 'scripts/test-suites.json'), JSON.stringify({ test: ['src/test/ext_base.test.ts', 'src/ext/modules/probe/tests/owned.test.ts'], gen: [], drift: [] }));
        expect(() => resolveTestSuites(directory)).toThrow('Foundation manifest cannot own module test');
    }));
});
