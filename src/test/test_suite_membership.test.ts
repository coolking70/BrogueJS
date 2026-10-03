/** Every test file must be registered once, including new generation censuses. */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { configDefaults } from 'vitest/config';
import { testSuiteOptions } from '../../vite.config';

const root = fileURLToPath(new URL('../../', import.meta.url));
const suiteNames = ['test', 'gen', 'drift'] as const;
const suites = JSON.parse(readFileSync(join(root, 'scripts/test-suites.json'), 'utf8')) as Record<typeof suiteNames[number], string[]>;

function discoverTests(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
        if (entry.name === 'node_modules' || entry.name === '.git') return [];
        const path = join(dir, entry.name);
        if (entry.isDirectory()) return discoverTests(path);
        // Vitest's default **/*.{test,spec}.?(c|m)[jt]s?(x), including co-located tests.
        return entry.isFile() && /\.(test|spec)\.[cm]?[jt]sx?$/.test(entry.name)
            ? [relative(root, path).replace(/\\/g, '/')]
            : [];
    });
}

const files = discoverTests(root).sort();

describe('test suite membership', () => {
    it('registers every discovered test exactly once, without stale paths or overlaps', () => {
        expect(Object.keys(suites).sort()).toEqual([...suiteNames].sort());
        const registered = suiteNames.flatMap(suite => suites[suite]);
        expect(registered.filter(path => !files.includes(path)), 'stale or invalid registered paths').toEqual([]);
        expect(files.filter(path => !registered.includes(path)), 'new tests must be registered in scripts/test-suites.json').toEqual([]);
        expect(registered.filter((path, i) => registered.indexOf(path) !== i), 'suite overlap or duplicate registration').toEqual([]);
        expect([...registered].sort()).toEqual(files);
    });

    it('uses the same partition in the actual Vitest suite options', () => {
        for (const suite of suiteNames) {
            const options = testSuiteOptions(suite);
            const selected = suite === 'test'
                ? files.filter(path => !options.exclude.includes(path))
                : options.include!;
            expect([...selected].sort(), suite).toEqual([...suites[suite]].sort());
            expect(options.exclude).toEqual([
                ...configDefaults.exclude,
                ...(suite === 'test' ? [...suites.gen, ...suites.drift] : []),
            ]);
        }
        expect(testSuiteOptions(undefined)).toEqual({ exclude: configDefaults.exclude });
        expect(() => testSuiteOptions('typo')).toThrow('Unknown test suite');
    });

    it('routes all four npm commands through the shared suite runner', () => {
        const { scripts } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
        expect(scripts.test).toBe('node scripts/run-test-suite.mjs test');
        expect(scripts['test:full']).toBe('node scripts/run-test-suite.mjs full');
        expect(scripts['test:gen']).toBe('node scripts/run-test-suite.mjs gen');
        expect(scripts['test:drift']).toBe('node scripts/run-test-suite.mjs drift');
    });
});
