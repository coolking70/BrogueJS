import { afterEach, describe, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import translations from '../locales/zh_CN.json';
import * as catalog from '../ext/catalog';
import { ExtensionCompatibilityError, formatExtensionCompatibilityError } from '../ext/compatibility';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime } from '../ext/runtime';
import type { ExtensionModule, Json } from '../ext/types';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { createHeadlessGame } from './harness';

const copy = <T>(value: T): T => structuredClone(value);
const command = (module = 'alpha', action = 'pulse', payload: Json = null) => JSON.stringify({ module, action, payload });
const moduleFixture = (id = 'alpha', overrides: Partial<ExtensionModule> = {}): ExtensionModule => ({
    id, version: '1.0.0', initialState: () => ({ count: 0 }),
    validateState: (value): value is Json => !!value && typeof value === 'object' && !Array.isArray(value)
        && Object.keys(value).join(',') === 'count' && Number.isSafeInteger((value as { count: number }).count)
        && (value as { count: number }).count >= 0,
    commands: { pulse() {} }, ...overrides,
});
function register(...modules: ExtensionModule[]) {
    const registry = new ExtensionRegistry();
    for (const module of modules) registry.register(module.id, module.version, () => module, module.rules);
    return registry;
}
function runtime(registry: ExtensionRegistry, ids = ['alpha']) {
    return new ExtensionRuntime(registry, registry.manifest(ids), {
        depth: () => 1, playerId: () => 1, randomInt: vi.fn(() => 1), message: vi.fn(),
    });
}
function open(registry: ExtensionRegistry, ids = ['alpha']) {
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    const game = createHeadlessGame(7321, 'test');
    game.startNewGame({ seed: 7321, mode: 'test', ruleSet: 'extended', extensions: ids });
    game.animationEnabled = false;
    game.executeCommand('ext:command', command());
    return game;
}
afterEach(() => vi.restoreAllMocks());

describe('extension compatibility diagnostics', () => {
    it('reports required and installed versions, missing IDs and a stable first mismatch without constructing modules', () => {
        const registry = new ExtensionRegistry(), factory = vi.fn(() => moduleFixture());
        registry.register('alpha', '1.0.0', factory);
        expect(() => registry.validateManifest({ schema: 1, foundation: 5,
            modules: [{ id: 'zeta', version: '3.0.0' }, { id: 'alpha', version: '2.0.0' }] }))
            .toThrow(expect.objectContaining({ code: 'version', moduleId: 'alpha', expected: '2.0.0', actual: '1.0.0' }));
        expect(() => registry.validateManifest({ schema: 1, foundation: 5, modules: [{ id: 'zeta', version: '3.0.0' }] }))
            .toThrow(expect.objectContaining({ code: 'missing', moduleId: 'zeta', expected: '3.0.0', actual: null }));
        expect(factory).not.toHaveBeenCalled();
    });
    it('identifies rule fingerprints and retains generic fallback for malformed or incomplete manifests', () => {
        const rules = { schema: 1, version: '1.0.0', fingerprint: `sha256:${'a'.repeat(64)}` };
        const registry: ExtensionRegistry = register(moduleFixture('alpha', { rules }));
        const manifest = registry.manifest(['alpha']);
        manifest.modules[0]!.rules!.fingerprint = `sha256:${'b'.repeat(64)}`;
        expect(() => registry.validateManifest(manifest)).toThrow(expect.objectContaining({ code: 'version', moduleId: 'alpha',
            rules: { expected: manifest.modules[0]!.rules, actual: rules } }));
        for (const invalid of [{ ...manifest, foundation: undefined }, { ...manifest, extra: true },
            { ...manifest, modules: [{ id: 'alpha' }] }, { ...manifest, modules: [...manifest.modules, ...manifest.modules] }]) {
            let thrown: unknown;
            try { registry.validateManifest(invalid); } catch (error) { thrown = error; }
            expect(thrown).toBeInstanceOf(Error);
            expect(thrown).not.toBeInstanceOf(ExtensionCompatibilityError);
        }
    });
    it('distinguishes invalid module state, references and component values from unavailable packages', () => {
        const registry = register(moduleFixture('alpha', { componentValidators: { counter: value => value === 0 } }));
        const active = runtime(registry), badState = active.snapshot(); badState.modules.alpha = { count: -1 };
        expect(() => active.validateSnapshot(badState)).toThrow(expect.objectContaining({ code: 'state-invalid', moduleId: 'alpha' }));
        const badComponent = active.snapshot(); badComponent.components['1'] = { 'alpha:counter': -1 };
        expect(() => active.validateSnapshot(badComponent)).toThrow(expect.objectContaining({ code: 'state-invalid', moduleId: 'alpha' }));
        const refs = runtime(register(moduleFixture('alpha', { validateComponents: (_state, components) => !components['2'] })));
        const badRefs = refs.snapshot(); badRefs.components['2'] = { 'alpha:counter': 0 };
        expect(() => refs.validateSnapshot(badRefs)).toThrow(expect.objectContaining({ code: 'state-invalid', moduleId: 'alpha' }));
        const foreign = active.snapshot(); foreign.components['1'] = { 'missing:counter': 0 };
        expect(() => active.validateSnapshot(foreign)).toThrow('namespace');
    });
    it('preserves the live run and reports precise localized save/replay failures without storing diagnostics in Game', async () => {
        await i18next.init({ lng: 'zh_CN', resources: { zh_CN: { translation: translations } } });
        const registry = register(moduleFixture()), game = open(registry);
        const saved = copy(game.toSaveSnapshot()), recording = copy(game.exportRecording());
        const current = { player: game.player, runtime: game.extensionRuntime, rng: rng.getState(), events: copy(game.recordedInputEvents) };
        const unload = vi.spyOn(current.runtime!, 'unload'), messages = vi.spyOn(logger, 'log'), display = vi.fn();
        const lastMessage = () => messages.mock.calls[messages.mock.calls.length - 1]?.[0];
        const assertIntact = () => {
            expect(game.player).toBe(current.player); expect(game.extensionRuntime).toBe(current.runtime);
            expect(rng.getState()).toEqual(current.rng); expect(game.recordedInputEvents).toEqual(current.events);
            expect(unload).not.toHaveBeenCalled();
            expect(display).toHaveBeenLastCalledWith(lastMessage());
        };
        vi.mocked(catalog.createExtensionRegistry).mockReturnValue(register());
        const missing = new ExtensionCompatibilityError('missing', 'alpha', 'Unavailable extension: alpha', '1.0.0', null);
        expect(game.loadSnapshot(saved, display)).toBe(false); expect(lastMessage()).toBe(formatExtensionCompatibilityError(missing)); assertIntact();
        expect(lastMessage()).toContain('缺少模块 alpha，文件要求版本 1.0.0');
        expect(game.loadReplay(recording, display)).toBe(false); expect(lastMessage()).toBe(formatExtensionCompatibilityError(missing)); assertIntact();
        expect(lastMessage()).toContain('缺少模块 alpha，文件要求版本 1.0.0');
        vi.mocked(catalog.createExtensionRegistry).mockReturnValue(registry);
        const wrongSave = copy(saved), wrongReplay = copy(recording);
        wrongSave.extensions!.manifest.modules[0]!.version = '2.0.0'; wrongReplay.extensions!.modules[0]!.version = '2.0.0';
        const version = new ExtensionCompatibilityError('version', 'alpha', 'mismatch', '2.0.0', '1.0.0');
        expect(game.loadSnapshot(wrongSave, display)).toBe(false); expect(lastMessage()).toBe(formatExtensionCompatibilityError(version)); assertIntact();
        expect(lastMessage()).toContain('模块 alpha 要求版本 2.0.0，当前安装版本为 1.0.0');
        expect(game.loadReplay(wrongReplay, display)).toBe(false); expect(lastMessage()).toBe(formatExtensionCompatibilityError(version)); assertIntact();
        expect(lastMessage()).toContain('模块 alpha 要求版本 2.0.0，当前安装版本为 1.0.0');
        const stateSave = copy(saved), stateReplay = copy(recording);
        stateSave.extensions!.modules.alpha = { count: -1 }; stateReplay.events[0]!.extensions!.modules.alpha = { count: -1 };
        const state = new ExtensionCompatibilityError('state-invalid', 'alpha', 'Invalid module state');
        expect(game.loadSnapshot(stateSave, display)).toBe(false); expect(lastMessage()).toBe(formatExtensionCompatibilityError(state)); assertIntact();
        expect(lastMessage()).toContain('模块 alpha 的状态或组件无效');
        expect(game.loadReplay(stateReplay, display)).toBe(false); expect(lastMessage()).toBe(formatExtensionCompatibilityError(state)); assertIntact();
        expect(lastMessage()).toContain('模块 alpha 的状态或组件无效');
        const generic = copy(saved); delete generic.extensions!.manifest.foundation;
        expect(game.loadSnapshot(generic, display)).toBe(false); expect(lastMessage()).toBe(formatExtensionCompatibilityError(undefined)); assertIntact();
    });
});

describe('recorded extension input registration preflight', () => {
    it('checks only envelope/registration, without applying state-dependent input gates', () => {
        const allowInput = vi.fn(() => false), active = runtime(register(moduleFixture('alpha', { allowInput })));
        expect(active.validateRecording([{ action: 'ext:command', data: command() }])).toBe(true);
        // Payload semantics remain module-owned: registration is not a claim
        // that a syntactically valid future payload can execute in every state.
        expect(active.validateRecording([{ action: 'ext:command', data: command('alpha', 'pulse', { future: true }) }])).toBe(true);
        expect(allowInput).not.toHaveBeenCalled();
        expect(active.allowsInput('ext:command', command())).toBe(false); expect(allowInput).toHaveBeenCalledOnce();
    });
    it('rejects disabled, missing, unknown, inherited and malformed commands before retiring the live run', () => {
        const registry = register(moduleFixture(), moduleFixture('disabled')), game = open(registry);
        const recording = copy(game.exportRecording()), before = game.player, current = game.extensionRuntime, state = current!.snapshot(), random = rng.getState();
        const unload = vi.spyOn(current!, 'unload');
        const invalid = [command('disabled'), command('missing'), command('alpha', 'unknown'), command('alpha', 'toString'),
            command('alpha', 'constructor'), 'null', '[]', '{', '{}',
            JSON.stringify({ module: 'alpha', action: 'pulse' }),
            JSON.stringify({ module: 'alpha', action: 'pulse', payload: null, extra: true }),
            '{"module":"alpha","action":"pulse","payload":{"__proto__":{}}}',
            JSON.stringify({ module: 'alpha', action: 'pulse', payload: null, constructor: {} })];
        for (const data of invalid) {
            const bad = copy(recording); bad.events[0]!.data = data;
            expect(game.loadReplay(bad), data).toBe(false); expect(game.player).toBe(before);
            expect(game.extensionRuntime).toBe(current); expect(current!.snapshot()).toEqual(state);
            expect(rng.getState()).toEqual(random); expect(game.recordedInputEvents).toEqual(recording.events);
        }
        expect(unload).not.toHaveBeenCalled();
        expect(game.loadReplay(recording)).toBe(true); game.replayStep(true); expect(game.replayError).toBeNull();
    });
    it('rejects future commands in an enabled data-only module and non-function command entries', () => {
        // A foundation-owned stand-in exercises the 2a1 registration boundary
        // without importing any physically removable gameplay package.
        const active = runtime(register(moduleFixture('narrative', { commands: undefined })), ['narrative']);
        for (const action of ['open', 'choose', 'close']) {
            const data = command('narrative', action, { v: 1, revision: 0 });
            expect(active.validateRecording([{ action: 'ext:command', data }])).toBe(false);
            expect(active.allowsInput('ext:command', data)).toBe(false);
        }
        const invalid = runtime(register(moduleFixture('alpha', { commands: { pulse: null } as unknown as ExtensionModule['commands'] })));
        expect(invalid.validateRecording([{ action: 'ext:command', data: command() }])).toBe(false);
    });
});

describe('menu compatibility diagnostic forwarding', () => {
    it.each([
        ['continueGame', 'menu.log.save_format_not_supported'],
        ['loadReplay', 'menu.log.replay_load_failed'],
        ['importReplayJson', 'menu.log.replay_import_failed'],
    ])('runs the actual %s failure handler with precise diagnostics and its generic fallback', async (name, fallback) => {
        // Extract the actual App handler through the TS AST. This exercises its
        // early-return UI logic without replacing it with a duplicate test helper.
        const app = readFileSync(new URL('../App.vue', import.meta.url), 'utf8');
        const source = ts.createSourceFile('App.ts', app.split('<script setup lang="ts">')[1]!.split('</script>')[0]!, ts.ScriptTarget.Latest, true);
        let initializer: ts.Expression | undefined;
        const visit = (node: ts.Node): void => {
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) initializer = node.initializer;
            ts.forEachChild(node, visit);
        };
        visit(source); expect(initializer).toBeDefined();
        const code = ts.transpileModule(`(${initializer!.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
        for (const diagnostic of ['无法读取：缺少模块 alpha，文件要求版本 1.0.0。', undefined]) {
            const report = vi.fn(), load = vi.fn((_input: unknown, onError: (message: string) => void) => {
                if (diagnostic !== undefined) onError(diagnostic);
                return false;
            });
            const handler = new Function('activeGame', 'readSnapshot', 'window', 'REPLAY_KEY', 'cancelHeldInputs', 'replayMessage', 'i18next', `return ${code}`)(
                { loadSnapshot: load, loadReplay: load }, async () => ({}), { localStorage: { getItem: () => '{}' } }, 'replay', vi.fn(), report, { t: (key: string) => key });
            await handler({ text: async () => '{}' });
            expect(load).toHaveBeenCalledOnce(); expect(report).toHaveBeenCalledExactlyOnceWith(diagnostic ?? fallback);
        }
    });
});
