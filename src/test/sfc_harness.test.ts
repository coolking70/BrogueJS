import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as Vue from 'vue';
import i18next from 'i18next';
import { logger } from '../engine/Systems/Logger';
import { createSfcHarness, type SfcHarnessOptions, type SfcModule } from './support/sfcHarness';

const directories: string[] = [];
const mounted: Array<ReturnType<typeof renderer.createApp>> = [];
afterEach(() => {
    mounted.splice(0).forEach(app => app.unmount());
    directories.splice(0).forEach(directory => rmSync(directory, { recursive: true, force: true }));
});
function fixture(files: Record<string, string>, options: Omit<SfcHarnessOptions, 'baseURL'> = {}) {
    const directory = mkdtempSync(join(tmpdir(), 'brogue-sfc-'));
    directories.push(directory);
    for (const [name, source] of Object.entries(files)) {
        const path = join(directory, name); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, source);
    }
    const baseURL = pathToFileURL(join(directory, 'test.ts')).href;
    return { baseURL, harness: createSfcHarness({ baseURL, ...options }) };
}
interface Node { text: string; props: Record<string, any>; children: Node[]; parent: Node | null }
const node = (text = ''): Node => ({ text, props: {}, children: [], parent: null });
const renderer = Vue.createRenderer<Node, Node>({
    createElement: () => node(), createText: text => node(text), createComment: () => node(),
    insert(child, parent, anchor) {
        child.parent?.children.splice(child.parent.children.indexOf(child), 1);
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent;
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _old, value) => { n.props[key] = value; },
});
function mount(component: Vue.Component) {
    const root = node(), app = renderer.createApp(component);
    app.mount(root); mounted.push(app); return root;
}
const text = (root: Node): string => root.text + root.children.map(text).join('');
const all = (root: Node): Node[] => [root, ...root.children.flatMap(all)];

describe('shared client SFC dependency resolver', () => {
    it('loads TS directory/reexports, JSON, packages and the same Vitest singleton without a map', async () => {
        const loggerPath = fileURLToPath(new URL('../engine/Systems/Logger.ts', import.meta.url));
        const { harness } = fixture({
            'Root.vue': `<script lang="ts">
                import * as Vue from 'vue'; import i18next from 'i18next';
                import { logger } from ${JSON.stringify(loggerPath)};
                import { value } from './lib'; import data from './data.json';
                export const dependencies = { Vue, i18next, logger, value, data };
                export default {};
            </script>`,
            'lib/index.ts': "export { value } from './value';",
            'lib/value.ts': "export const value: string = 'automatic';",
            'data.json': '{"suffix":" JSON"}',
        });
        const result = await harness.loadModule<SfcModule & { dependencies: {
            Vue: typeof Vue; i18next: typeof i18next; logger: typeof logger; value: string; data: { suffix: string };
        } }>('./Root.vue');
        expect(result.dependencies.Vue.ref).toBe(Vue.ref);
        expect(result.dependencies.i18next).toBe(i18next);
        expect(result.dependencies.logger).toBe(logger);
        expect(result.dependencies.value + result.dependencies.data.suffix).toBe('automatic JSON');
    });

    it('recursively compiles client child templates and keeps their real click handlers and cache', async () => {
        const { harness } = fixture({
            'Root.vue': '<script setup lang="ts">import Child from "./nested/Child.vue";</script><template><Child /></template>',
            'nested/Child.vue': '<script setup lang="ts">import { ref } from "vue"; import { label } from "../label"; const count = ref(0);</script><template><button @click="count++">{{ label }} {{ count }}</button></template>',
            'label.ts': 'export const label = "child";',
        });
        const root = mount(await harness.load('./Root.vue'));
        expect(text(root)).toBe('child 0');
        all(root).find(n => n.props.onClick)!.props.onClick(); await Vue.nextTick();
        expect(text(root)).toBe('child 1');
        expect(await harness.load('./nested/Child.vue')).toBe(await harness.load('./nested/../nested/Child.vue'));
    });

    it('compiles template-only and ordinary script components as client renders', async () => {
        const { harness } = fixture({
            'Template.vue': '<template><span>template only</span></template>',
            'Classic.vue': '<script lang="ts">export const answer = 42; export default { data: () => ({ label: "classic" }) };</script><template><span>{{ label }}</span></template>',
        });
        expect(text(mount(await harness.load('./Template.vue')))).toBe('template only');
        const classic = await harness.loadModule('./Classic.vue');
        expect(classic.answer).toBe(42); expect(text(mount(classic.default))).toBe('classic');
    });

    it('resolves one mutable stub through different component depths and .js/.ts paths', async () => {
        const injected = { value: 'stub' };
        const { harness } = fixture({
            'Root.vue': '<script lang="ts">import { state } from "./state.js"; import * as child from "./nested/Child.vue"; export { state, child }; export default {};</script>',
            'nested/Child.vue': '<script lang="ts">import { state } from "../state.ts"; export { state }; export default {};</script>',
            'state.ts': 'export const state = { value: "real" };',
        }, { stubs: { './state': { state: injected } } });
        const result = await harness.loadModule<SfcModule & { state: typeof injected; child: { state: typeof injected } }>('./Root.vue');
        expect(result.state).toBe(injected); expect(result.child.state).toBe(injected);
        injected.value = 'updated'; expect(result.child.state.value).toBe('updated');
    });

    it('preserves live bindings in automatically loaded ESM dependencies', async () => {
        const { harness } = fixture({
            'Root.vue': '<script lang="ts">import { value, update } from "./state"; export const current = () => value; export { update }; export default {};</script>',
            'state.ts': 'export let value = 1; export const update = () => { value++; };',
        });
        const result = await harness.loadModule<SfcModule & { current(): number; update(): void }>('./Root.vue');
        expect(result.current()).toBe(1); result.update(); expect(result.current()).toBe(2);
    });

    it('applies explicit child substitutions before the fallback, while loading roots explicitly', async () => {
        const { harness } = fixture({
            'Root.vue': '<script setup lang="ts">import First from "./First.vue"; import Second from "./Second.vue";</script><template><First /><Second /></template>',
            'First.vue': '<template><b>real first</b></template>',
            'Second.vue': '<template><b>real second</b></template>',
        }, { components: { './First.vue': { render: () => Vue.h('b', 'injected') } }, stubComponents: { render: () => null } });
        expect(text(mount(await harness.load('./Root.vue')))).toBe('injected');
        expect(text(mount(await harness.load('./Second.vue')))).toBe('real second');
    });

    it('isolates component caches and globals between harness instances', async () => {
        const { baseURL, harness } = fixture({
            'Root.vue': '<script lang="ts">export const timer = setInterval(() => {}, 50); export default {};</script>',
        }, { globals: { setInterval: vi.fn(() => 'first') } });
        const interval = vi.fn(() => 'second');
        const second = createSfcHarness({ baseURL, globals: { setInterval: interval } });
        expect((await harness.loadModule('./Root.vue')).timer).toBe('first');
        expect((await second.loadModule('./Root.vue')).timer).toBe('second');
        expect(await second.load('./Root.vue')).not.toBe(await harness.load('./Root.vue'));
        expect(interval).toHaveBeenCalledTimes(1);
    });

    it('reports missing dependencies with the requesting component path', async () => {
        const { harness } = fixture({ 'Root.vue': '<script setup lang="ts">import value from "./missing";</script><template>{{ value }}</template>' });
        await expect(harness.load('./Root.vue')).rejects.toThrow(/Cannot resolve SFC import "\.\/missing" from .*Root\.vue/);
    });

    it('reports cyclic SFC dependencies instead of waiting on its own cache', async () => {
        const { harness } = fixture({
            'Root.vue': '<script setup lang="ts">import Child from "./Child.vue";</script><template><Child /></template>',
            'Child.vue': '<script setup lang="ts">import Root from "./Root.vue";</script><template><Root /></template>',
        });
        await expect(harness.load('./Root.vue')).rejects.toThrow(/Circular SFC import: .*Root\.vue -> .*Child\.vue -> .*Root\.vue/);
    });

    it('rejects malformed components and non-SFC entry points', async () => {
        const { harness } = fixture({ 'Root.vue': '<template><span></template>', 'module.ts': 'export const value = 1;' });
        await expect(harness.load('./Root.vue')).rejects.toThrow(/Cannot parse SFC .*Root\.vue/);
        await expect(harness.load('./module.ts')).rejects.toThrow(/Expected a \.vue component/);
    });
});
