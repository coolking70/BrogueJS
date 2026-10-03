import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hashCandidate, isCandidateInput, removalMatrix } from '../../scripts/check-module-removal.mjs';

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
