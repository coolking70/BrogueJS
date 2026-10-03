import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { checkModuleBoundaries } from '../../scripts/check-module-boundaries.mjs';

const temporary: string[] = [];
const emptyManifest = JSON.stringify({ test: [], gen: [], drift: [] });
function fixture() {
    const root = mkdtempSync(join(tmpdir(), 'module-boundaries-'));
    temporary.push(root);
    const write = (file: string, content: string) => {
        mkdirSync(dirname(join(root, file)), { recursive: true });
        writeFileSync(join(root, file), content);
    };
    write('scripts/test-suites.json', emptyManifest);
    const module = (id: string) => {
        write(`src/ext/modules/${id}/descriptor.ts`, 'export default {};');
        write(`src/ext/modules/${id}/test-suites.json`, emptyManifest);
    };
    return { root, write, module, check: () => checkModuleBoundaries(root) };
}
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });

describe('module boundaries parse references and test ownership', () => {
    it('accepts the empty-module build and module-owned references to itself and foundation', () => {
        const f = fixture();
        expect(f.check()).toEqual([]);
        f.module('alpha');
        f.write('src/ext/modules/alpha/index.ts', `
            import './local';
            import type { Shared } from '../../types';
            export * from '@/ext/modules/alpha/local';
            const ownData = new URL('./data/pack.json', import.meta.url);
            const later = () => import('./ui/Panel.vue');
        `);
        expect(f.check()).toEqual([]);
    });

    it('finds import, export, type-only, dynamic, require and import-type dependencies even on deleted modules', () => {
        const f = fixture();
        f.write('src/global.ts', `
            import Thing from './ext/modules/absent/main';
            import type { Shape } from './ext/modules/absent/types';
            export { named } from './ext/modules/absent/reexport';
            export type { Other } from './ext/modules/absent/type-export';
            const lazy = () => import('./ext/modules/absent/lazy');
            const required = require('./ext/modules/absent/required');
            import assigned = require('./ext/modules/absent/assigned');
            type T = import('./ext/modules/absent/import-type').T;
        `);
        const issues = f.check();
        expect(issues).toHaveLength(8);
        expect(issues.every(issue => issue.startsWith('src/global.ts:') && issue.includes('absent'))).toBe(true);
    });

    it('rejects cross-module relative, normalized, alias and absolute references', () => {
        const f = fixture(); f.module('alpha'); f.module('beta');
        f.write('src/ext/modules/alpha/index.ts', `
            import '../beta/a';
            export * from './nested/../../beta/b';
            import '@/ext/modules/beta/c';
            import ${JSON.stringify(join(f.root, 'src/ext/modules/beta/d'))};
            import ${JSON.stringify(pathToFileURL(join(f.root, 'src/ext/modules/beta/e')).href)};
        `);
        expect(f.check()).toHaveLength(5);
        expect(f.check().every(issue => issue.includes('cross-module reference'))).toBe(true);
    });

    it('resolves inherited TypeScript path aliases and baseUrl without requiring target files', () => {
        const f = fixture();
        f.write('config/base.json', JSON.stringify({ compilerOptions: { baseUrl: '..', paths: { '@internal/*': ['src/*'] } } }));
        f.write('tsconfig.json', JSON.stringify({ extends: './config/base.json', include: ['src/**/*.ts'] }));
        f.write('src/outside.ts', `import '@internal/ext/modules/deleted/rules'; import 'src/ext/modules/deleted/data.json';`);
        expect(f.check().filter(issue => issue.startsWith('src/outside.ts:'))).toHaveLength(2);
    });

    it('resolves referenced tsconfigs and multiple alias replacements', () => {
        const f = fixture();
        f.write('tsconfig.json', JSON.stringify({ files: [], references: [{ path: './config' }] }));
        f.write('config/tsconfig.json', JSON.stringify({ compilerOptions: { baseUrl: '..', paths: { '@internal/*': ['missing/*', 'src/*'] } } }));
        f.write('src/outside.ts', `import '@internal/ext/modules/deleted/rules';`);
        expect(f.check().filter(issue => issue.startsWith('src/outside.ts:'))).toHaveLength(1);
    });

    it('resolves constant, concatenated and template paths while preserving a known owner before dynamic suffixes', () => {
        const f = fixture();
        f.write('src/outside.ts', [
            `const file = './ext/modules/deleted/constant'; import(file);`,
            `import('./ext/modules/' + 'deleted' + '/joined');`,
            'import(`./ext/modules/deleted/${page}.vue`);',
            `readFileSync(join(root, 'src', 'ext', 'modules', 'deleted', 'data.json'));`,
        ].join('\n'));
        expect(f.check()).toHaveLength(4);
    });

    it('allows exactly the descriptor discovery glob in the generic catalog', () => {
        const f = fixture(); f.module('alpha');
        f.write('src/ext/catalog.ts', `const descriptors = import.meta.glob<unknown>('./modules/*/descriptor.ts', { eager: true });`);
        f.write('src/ext/ui/registry.ts', `const descriptors = import.meta.glob<unknown>('../modules/*/ui/descriptor.ts', { eager: true });`);
        expect(f.check()).toEqual([]);
        for (const expression of [
            `import.meta.glob('./modules/*/descriptor.ts', { eager: false })`,
            `import.meta.glob('./modules/alpha/descriptor.ts', { eager: true })`,
            `import.meta.glob('./modules/*/descriptor.ts', { eager: true, import: 'default' })`,
            `import.meta.glob(['./modules/*/descriptor.ts'], { eager: true })`,
            `import.meta.glob('./modules/*/index.ts', { eager: true })`,
        ]) {
            f.write('src/ext/catalog.ts', expression);
            expect(f.check(), expression).not.toEqual([]);
        }
        f.write('src/ext/catalog.ts', '');
        f.write('src/ext/ui/registry.ts', `import.meta.glob('../modules/alpha/ui/descriptor.ts', { eager: true });`);
        expect(f.check()).toHaveLength(1);
        f.write('src/ext/ui/registry.ts', '');
        f.write('src/ext/other.ts', `import.meta.glob('./modules/*/descriptor.ts', { eager: true });`);
        expect(f.check()).toHaveLength(1);
    });

    it('checks Vue scripts, block src attributes, static and bound template resources, and style URLs', () => {
        const f = fixture();
        f.write('src/Outside.vue', `<script setup lang="ts">
import type { T } from './ext/modules/deleted/types';
</script>
<template>
  <img src="/src/ext/modules/deleted/portrait.png" />
  <img :src="'@/ext/modules/deleted/bound.png'" />
  <source srcset="/src/ext/modules/deleted/one.png 1x, /src/ext/modules/deleted/two.png 2x" />
  <div style="background: url('/src/ext/modules/deleted/inline.png')" />
  <div :style="{ backgroundImage: 'url(/src/ext/modules/deleted/bound-style.png)' }" />
</template>
<style src="./ext/modules/deleted/external.css"></style>
<style>
@import './ext/modules/deleted/import.css';
.portrait { background-image: url('./ext/modules/deleted/style.png'); }
</style>`);
        const issues = f.check();
        expect(issues).toHaveLength(10);
        expect(issues.some(issue => issue.includes('bound-style.png'))).toBe(true);
        expect(issues.every(issue => /^src\/Outside.vue:\d+:/.test(issue))).toBe(true);
    });

    it('checks external Vue script/template blocks, HTML, and JSX resources', () => {
        const f = fixture();
        f.write('src/Outside.vue', `<script src="./ext/modules/deleted/script.ts"></script><template src="./ext/modules/deleted/template.html"></template>`);
        f.write('index.html', `<script src="/src/ext/modules/deleted/entry.js"></script><link href="/src/ext/modules/deleted/theme.css" rel="stylesheet">`);
        f.write('src/picture.tsx', `const image = <img src="/src/ext/modules/deleted/jsx.png" />;`);
        expect(f.check()).toHaveLength(5);
    });

    it('resolves Vue script constants used by template resource bindings', () => {
        const f = fixture();
        f.write('src/Outside.vue', `<script setup lang="ts">
const portrait = '/src/ext/modules/deleted/portrait.png';
const inline = "background: url('/src/ext/modules/deleted/style.png')";
</script><template><img :src="portrait" /><div :style="inline" /></template>`);
        expect(f.check()).toHaveLength(2);
    });

    it('rejects build aliases naming concrete module directories', () => {
        const f = fixture();
        f.write('vite.config.ts', `
const first = { resolve: { alias: { '@concrete': './src/ext/modules/deleted' } } };
const second = { resolve: { alias: [{ find: '@concrete', replacement: './src/ext/modules/deleted' }] } };
`);
        expect(f.check()).toHaveLength(2);
    });

    it('resolves Vite object aliases through fileURLToPath(new URL(...))', () => {
        const f = fixture();
        f.write('vite.config.ts', `import { fileURLToPath } from 'node:url'; export default { resolve: { alias: { '@internal': fileURLToPath(new URL('./src', import.meta.url)) } } };`);
        f.write('src/outside.ts', `import '@internal/ext/modules/deleted/rules';`);
        expect(f.check()).toHaveLength(1);
        expect(f.check()[0]).toContain('src/outside.ts:1:');
    });

    it('resolves Vite array aliases with string/RegExp find and path helper replacements', () => {
        const f = fixture();
        f.write('vite.config.ts', String.raw`const aliases = [
{ find: '@one', replacement: resolve(__dirname, 'src') },
{ find: /^@two\//, replacement: './src/' }
]; export default { resolve: { alias: aliases } };`);
        f.write('src/outside.ts', `import '@one/ext/modules/deleted/first'; import '@two/ext/modules/deleted/second';`);
        expect(f.check()).toHaveLength(2);
    });

    it('fails closed when a declared build alias cannot be resolved statically', () => {
        const f = fixture();
        f.write('vite.config.ts', `export default { resolve: { alias: configureAliases() } };`);
        expect(f.check().join('\n')).toContain('Unsupported dynamic build alias');
    });

    it('parses CSS tokens rather than matching comments and content strings', () => {
        const f = fixture();
        f.write('src/style.css', String.raw`
/* url('./ext/modules/deleted/comment.png') */
.example::before { content: "url('./ext/modules/deleted/text.png')"; }
.image { background: url("./ext/modules/deleted/paren).png"); }
@import url('./ext/modules/deleted/theme.css') screen;
.escaped { background: url('./ext/modules/deleted/\70 ortrait.png'); }
`);
        const issues = f.check();
        expect(issues).toHaveLength(3);
        expect(issues.some(issue => issue.includes('portrait.png'))).toBe(true);
        expect(issues.some(issue => issue.includes('comment.png') || issue.includes('text.png'))).toBe(false);
    });

    it('checks JSON manifests and build-copy/resource declarations without scanning ordinary code strings', () => {
        const f = fixture();
        f.write('public/assets.json', JSON.stringify({ images: ['/src/ext/modules/deleted/portrait.png'] }));
        f.write('vite.config.ts', `const config = { assets: ['./src/ext/modules/deleted/a.png'], targets: [{ src: 'src/ext/modules/deleted/data.json', dest: 'dist' }] };`);
        f.write('scripts/copy.mjs', `copyFileSync('src/ext/modules/deleted/portrait.png', 'dist/portrait.png');`);
        expect(f.check()).toHaveLength(4);
    });

    it('checks npm shell copy inputs and computed require property calls', () => {
        const f = fixture();
        f.write('package.json', JSON.stringify({ scripts: { build: 'cp "src/ext/modules/deleted/portrait.png" public/portrait.png' } }));
        f.write('src/outside.ts', `module['require']('./ext/modules/deleted/rules'); require['resolve']('./ext/modules/deleted/data.json');`);
        expect(f.check()).toHaveLength(3);
    });

    it('ignores comments, inert example strings, template prose, and remote URLs', () => {
        const f = fixture();
        f.write('src/examples.ts', `
// import './ext/modules/deleted/comment';
const example = "import './ext/modules/deleted/inert';";
const explanation = './ext/modules/deleted/this-is-just-a-string';
console.log('src/ext/modules/deleted/example');
const picture = { src: 'https://example.org/src/ext/modules/deleted/picture.png' };
`);
        f.write('src/Examples.vue', `<template><p>import './ext/modules/deleted/prose'</p></template><style>.x::before { content: "url('./ext/modules/deleted/inert.png')"; }</style>`);
        expect(f.check()).toEqual([]);
    });

    it('checks triple-slash type references and query/hash/encoded URL suffixes', () => {
        const f = fixture();
        f.write('src/outside.ts', `/// <reference path="./ext/modules/deleted/types.d.ts" />\nimport './ext/modules/deleted/picture.png?url';\nnew URL('/src/ext/modules/deleted%2Fencoded.png#piece', import.meta.url);`);
        expect(f.check()).toHaveLength(3);
    });

    it('fails closed on missing, duplicate, stale, or unregistered test ownership', () => {
        const f = fixture(); f.module('alpha');
        f.write('src/ext/modules/alpha/tests/owned.test.ts', 'export {};');
        expect(f.check().join('\n')).toContain('Unregistered discovered test');
        f.write('src/ext/modules/alpha/test-suites.json', JSON.stringify({ test: ['tests/owned.test.ts'], gen: [], drift: [] }));
        expect(f.check()).toEqual([]);
        f.write('src/ext/modules/alpha/test-suites.json', JSON.stringify({ test: ['tests/owned.test.ts', 'tests/owned.test.ts'], gen: [], drift: [] }));
        expect(f.check().join('\n')).toContain('Duplicate test registration');
        f.write('src/ext/modules/alpha/test-suites.json', JSON.stringify({ test: ['tests/deleted.test.ts'], gen: [], drift: [] }));
        expect(f.check().join('\n')).toContain('Stale or invalid registered test');
        rmSync(join(f.root, 'scripts/test-suites.json'));
        expect(f.check().join('\n')).toContain('Missing test ownership manifest');
    });

    it('rejects module-owned tests listed globally and generic tests that import a concrete module', () => {
        const f = fixture(); f.module('alpha');
        f.write('src/ext/modules/alpha/tests/owned.test.ts', 'export {};');
        f.write('src/test/generic.test.ts', `import '../ext/modules/alpha/descriptor';`);
        f.write('scripts/test-suites.json', JSON.stringify({ test: ['src/ext/modules/alpha/tests/owned.test.ts', 'src/test/generic.test.ts'], gen: [], drift: [] }));
        const issues = f.check().join('\n');
        expect(issues).toContain('Foundation manifest cannot own module test');
        expect(issues).toContain('src/test/generic.test.ts:1: import/export');
    });

    it('provides a fail-status CLI with an explicit fixture root', () => {
        const f = fixture();
        const executable = fileURLToPath(new URL('../../scripts/check-module-boundaries.mjs', import.meta.url));
        const run = () => spawnSync(process.execPath, [executable, '--root', f.root], { encoding: 'utf8' });
        expect(run().status).toBe(0);
        f.write('src/outside.ts', `import './ext/modules/deleted/main';`);
        const failed = run();
        expect(failed.status).toBe(1);
        expect(failed.stderr).toContain('src/outside.ts:1:');
    });
});
