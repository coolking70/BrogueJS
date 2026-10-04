import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import type { Component } from 'vue';

export interface SfcModule {
    default: Component;
    [name: string]: unknown;
}

export interface SfcHarnessOptions {
    /** All public paths (including stub keys) are relative to this test URL. */
    baseURL: string;
    /** Module exports, only for dependencies that really need substitution. */
    stubs?: Record<string, unknown>;
    /** Explicit child components; these take precedence over stubComponents. */
    components?: Record<string, Component>;
    /** Optional fallback for child SFCs, e.g. to isolate App from Pixi/DOM. */
    stubComponents?: Component;
    /** Lexical globals for compiled SFCs, e.g. manually polled timers. */
    globals?: Record<string, unknown>;
}

const extensions = ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json', '.vue'];
function resolveImport(specifier: string, importer: string): string {
    if (!specifier.startsWith('.') && !isAbsolute(specifier) && !specifier.startsWith('file:')) return specifier;
    const path = specifier.startsWith('file:') ? fileURLToPath(specifier) : resolve(dirname(importer), specifier);
    const candidates = [path];
    if (extname(path) === '.js') candidates.push(path.slice(0, -3) + '.ts', path.slice(0, -3) + '.tsx');
    if (!extname(path)) candidates.push(...extensions.map(extension => path + extension));
    candidates.push(...extensions.map(extension => resolve(path, 'index' + extension)));
    const found = candidates.find(candidate => existsSync(candidate) && statSync(candidate).isFile());
    if (!found) throw new Error(`Cannot resolve SFC import "${specifier}" from ${importer}`);
    return found;
}

/** CommonJS interop without copying live ESM bindings or mutating namespaces. */
function moduleExports(namespace: object): object {
    const exports = Object.create(null);
    for (const key of Reflect.ownKeys(namespace)) {
        if (key !== '__esModule') Object.defineProperty(exports, key, { enumerable: true, get: () => Reflect.get(namespace, key) });
    }
    Object.defineProperty(exports, '__esModule', { value: true });
    return exports;
}

/**
 * Compile client render functions for Vue's custom host renderer. Vitest's
 * regular .vue transform in node is SSR; ordinary modules still go through its
 * module runner so mocks and engine/UI singletons match the test's imports.
 * Stubs affect SFC imports; use vi.mock for substitution inside ordinary TS.
 */
export function createSfcHarness(options: SfcHarnessOptions) {
    const base = fileURLToPath(options.baseURL);
    const stubs = new Map(Object.entries(options.stubs ?? {}).map(([key, value]) => [resolveImport(key, base), value]));
    for (const [key, component] of Object.entries(options.components ?? {})) {
        stubs.set(resolveImport(key, base), { default: component, __esModule: true });
    }
    const cache = new Map<string, Promise<SfcModule>>();
    const globals = Object.entries(options.globals ?? {});

    async function compile(filename: string, ancestors: string[]): Promise<SfcModule> {
        const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename });
        if (errors.length) throw new Error(`Cannot parse SFC ${filename}: ${errors.join('\n')}`);
        const id = filename;
        const script = descriptor.script || descriptor.scriptSetup ? compileScript(descriptor, { id, inlineTemplate: true }) : undefined;
        let source = script?.content ?? 'export default {};';
        if (!descriptor.scriptSetup && descriptor.template) {
            const template = compileTemplate({ source: descriptor.template.content, filename, id,
                compilerOptions: { bindingMetadata: script?.bindings } });
            if (template.errors.length) throw new Error(`Cannot compile SFC ${filename}: ${template.errors.join('\n')}`);
            source += '\n' + template.code;
        }
        const code = ts.transpileModule(source, { fileName: filename + '.ts', compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
        } }).outputText;
        // Read the emitted imports, including helpers added by template compilation.
        const imports = new Set<string>();
        const visit = (node: ts.Node) => {
            if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
                && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]!)) imports.add(node.arguments[0]!.text);
            ts.forEachChild(node, visit);
        };
        visit(ts.createSourceFile(filename + '.js', code, ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS));
        const dependencies = new Map<string, unknown>();
        for (const specifier of imports) {
            const resolved = resolveImport(specifier, filename);
            if (stubs.has(resolved)) dependencies.set(specifier, stubs.get(resolved));
            else if (resolved.endsWith('.vue')) {
                dependencies.set(specifier, options.stubComponents
                    ? { default: options.stubComponents, __esModule: true }
                    : await loadResolved(resolved, ancestors));
            } else {
                dependencies.set(specifier, moduleExports(await import(/* @vite-ignore */ resolved)));
            }
        }
        const module = { exports: {} as SfcModule };
        new Function('require', 'module', 'exports', ...globals.map(([name]) => name), `${code}\n//# sourceURL=${filename}`)(
            (specifier: string) => {
                if (!dependencies.has(specifier)) throw new Error(`Unresolved runtime SFC import "${specifier}" from ${filename}`);
                return dependencies.get(specifier);
            }, module, module.exports, ...globals.map(([, value]) => value),
        );
        if (!descriptor.scriptSetup && descriptor.template) {
            (module.exports.default as { render?: unknown }).render = module.exports.render;
        }
        return module.exports;
    }

    function loadResolved(filename: string, ancestors: string[]): Promise<SfcModule> {
        if (ancestors.includes(filename)) throw new Error(`Circular SFC import: ${[...ancestors, filename].join(' -> ')}`);
        let pending = cache.get(filename);
        if (!pending) {
            pending = compile(filename, [...ancestors, filename]);
            cache.set(filename, pending);
        }
        return pending;
    }

    async function loadModule<T extends SfcModule = SfcModule>(specifier: string): Promise<T> {
        const filename = resolveImport(specifier, base);
        if (!filename.endsWith('.vue')) throw new Error(`Expected a .vue component: ${filename}`);
        return await loadResolved(filename, []) as T;
    }

    return { loadModule, load: async (specifier: string): Promise<Component> => (await loadModule(specifier)).default };
}
