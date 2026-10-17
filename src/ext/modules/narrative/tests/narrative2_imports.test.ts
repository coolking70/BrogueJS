import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const root = path.resolve('src/ext/modules/narrative');
const slash = (value: string) => value.replace(/\\/g, '/');
function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
        ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}
const production = () => files(root).filter(file => /\.(?:ts|vue)$/.test(file) && !/[\\/](?:tests|tools)[\\/]/.test(file));
function resolve(from: string, specifier: string): string {
    const value = specifier.startsWith('@/') ? path.resolve('src', specifier.slice(2))
        : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier) : specifier.startsWith('src/') ? path.resolve(specifier) : specifier;
    if (!path.isAbsolute(value)) return value;
    return slash(value.replace(/\.(?:ts|vue|json)$/, ''));
}
const shared = (name: string) => slash(path.resolve(name));
const allowedTypes = new Set(['ExtensionModule', 'ExtensionContext', 'ExtensionRulesIdentity', 'Json', 'ReadonlyJson', 'HookEvents',
    'CombatEventFact', 'OptionalQueryResult', 'CommittedFactAllocation', 'CommittedFactConsumer', 'ExtensionSnapshot', 'WorldInteractable',
    'WorldInteractablePlacement', 'WorldInteractablePlacementResult']);
type Binding = { name: string; typeOnly: boolean };
/** Parse actual TS syntax, including Vue scripts, exports and dynamic loads.
 * Nonliteral loaders fail closed; only the existing finite portrait glob is allowed. */
function audit(file: string, text: string): string[] {
    const sourceText = file.endsWith('.vue') ? [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n') : text;
    const source = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const errors: string[] = [], relative = slash(path.relative(root, file));
    const add = (reason: string) => errors.push(`${relative}: ${reason}`);
    function check(specifier: string, bindings: Binding[], dynamic = false): void {
        const resolved = resolve(file, specifier), own = resolved.startsWith(`${slash(root)}/`);
        if (own) {
            if (/\/(?:tests|tools)\//.test(resolved) || /\/(?:data\/)?recruitment$/.test(resolved)) add(`runtime authoring/test dependency ${specifier}`);
            return;
        }
        if (['vue', 'i18next'].includes(resolved)) return;
        if (dynamic) { add(`dynamic external dependency ${specifier}`); return; }
        const all = (names: ReadonlySet<string>, typeOnly = false) => bindings.length > 0
            && bindings.every(b => names.has(b.name) && (!typeOnly || b.typeOnly));
        if (resolved === shared('src/ext/descriptor')) {
            if (!bindings.length || bindings.some(b => b.name !== 'FOUNDATION_PROTOCOL' && !(b.name === 'ModuleDescriptor' && b.typeOnly))) add(`descriptor import ${specifier}`);
        } else if (resolved === shared('src/ext/types')) {
            if (!all(allowedTypes, true)) add(`value or unapproved DTO import ${specifier}`);
        } else if (resolved === shared('src/ext/fingerprint')) {
            if (!all(new Set(['extensionDataFingerprint']))) add(`fingerprint import ${specifier}`);
        } else if (resolved === shared('src/ext/json')) {
            if (!all(new Set(['canonical', 'validId', 'isJson']))) add(`JSON helper import ${specifier}`);
        } else if (resolved === shared('src/ext/ui/types')) {
            if (!all(new Set(['ModuleUiContribution', 'ModuleUiHost', 'ModuleUiSession']), true)) add(`UI type import ${specifier}`);
        } else if (resolved === shared('src/ui/dialogService')) {
            if (relative !== 'ui/useNarrativeUi.ts' || !bindings.length || bindings.some(b => b.name !== 'presentationTimeline'
                && !(['DialogAction', 'DialogRequest'].includes(b.name) && b.typeOnly))) add(`dialog adapter import ${specifier}`);
        } else if (resolved === shared('src/engine/Core/Game')) {
            if (relative !== 'ui/view.ts' || !all(new Set(['Game']), true)) add(`Game dependency ${specifier}`);
        } else add(`unapproved dependency ${specifier}`);
    }
    const literal = (node: ts.Node | undefined): string | null => node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
    function visit(node: ts.Node): void {
        if (ts.isImportDeclaration(node)) {
            const specifier = literal(node.moduleSpecifier), clause = node.importClause, bindings: Binding[] = [];
            if (clause?.name) bindings.push({ name: 'default', typeOnly: clause.isTypeOnly });
            if (clause?.namedBindings) {
                if (ts.isNamespaceImport(clause.namedBindings)) bindings.push({ name: '*', typeOnly: clause.isTypeOnly });
                else bindings.push(...clause.namedBindings.elements.map(b => ({ name: (b.propertyName ?? b.name).text, typeOnly: clause.isTypeOnly || b.isTypeOnly })));
            }
            if (specifier === null) add('nonliteral import'); else check(specifier, bindings);
        } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
            const specifier = literal(node.moduleSpecifier), bindings = node.exportClause && ts.isNamedExports(node.exportClause)
                ? node.exportClause.elements.map(b => ({ name: (b.propertyName ?? b.name).text, typeOnly: node.isTypeOnly || b.isTypeOnly })) : [{ name: '*', typeOnly: node.isTypeOnly }];
            if (specifier === null) add('nonliteral export'); else check(specifier, bindings);
        } else if (ts.isImportTypeNode(node)) {
            const specifier = ts.isLiteralTypeNode(node.argument) ? literal(node.argument.literal) : null;
            if (specifier === null) add('nonliteral type import'); else check(specifier, [{ name: node.qualifier?.getText(source) ?? '*', typeOnly: !node.isTypeOf }]);
        } else if (ts.isImportEqualsDeclaration(node)) add('import-equals is not a supported production entry');
        else if (ts.isCallExpression(node)) {
            const callee = node.expression.getText(source);
            if (node.expression.kind === ts.SyntaxKind.ImportKeyword || callee === 'require') {
                const specifier = literal(node.arguments[0]);
                if (specifier === null) add('nonliteral dynamic import'); else check(specifier, [], true);
            } else if (callee === 'import.meta.glob' || callee === 'import.meta.globEager') {
                if (relative !== 'ui/portraits.ts' || callee !== 'import.meta.glob' || literal(node.arguments[0]) !== '../assets/portraits/**/*.{png,webp}') add('unapproved resource glob');
            } else if (/^(?:fetch|eval|Function|Math\.random|Date\.now|.*(?:readFile|readFileSync|loadScript))$/.test(callee)) add(`runtime external/script/random read ${callee}`);
        } else if (ts.isNewExpression(node)) {
            if (['Date', 'Function', 'XMLHttpRequest', 'Worker'].includes(node.expression.getText(source))) add('runtime script/time/network construction');
            if (node.expression.getText(source) === 'URL') {
                const specifier = literal(node.arguments?.[0]);
                if (!specifier || !resolve(file, specifier).startsWith(`${slash(root)}/assets/`)) add('external or metadata URL read');
            }
        }
        ts.forEachChild(node, visit);
    }
    visit(source);
    if (relative !== 'recruitment.ts') {
        const codeStrings: string[] = [];
        const strings = (node: ts.Node) => { if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) codeStrings.push(node.text); ts.forEachChild(node, strings); };
        strings(source);
        if (codeStrings.some(value => /recruitment|recruitable|eligibility|5D3/.test(value))) add('runtime metadata consumer');
    }
    return errors;
}

/** Ignore trivia only: identifiers, literal values, modifiers, types and order
 * remain part of the frozen declaration identity. Function bodies are excluded. */
function declarationFingerprint(file: string, text: string): string {
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const declarations = source.statements.filter(node => (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)
        || ts.isEnumDeclaration(node) || ts.isVariableStatement(node))
        && ts.canHaveModifiers(node) && ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    const tokens: [number, string][] = [];
    for (const declaration of declarations) {
        const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, declaration.getText(source));
        for (let kind = scanner.scan(); kind !== ts.SyntaxKind.EndOfFileToken; kind = scanner.scan()) tokens.push([kind, scanner.getTokenText()]);
    }
    return createHash('sha256').update(JSON.stringify(tokens)).digest('hex');
}
function gameFieldFingerprint(text: string): string {
    const source = ts.createSourceFile('Game.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const game = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'Game');
    if (!game || !ts.isClassDeclaration(game)) throw new Error('Missing Game declaration');
    const names = game.members.filter(ts.isPropertyDeclaration).map(field => field.name.getText(source));
    for (const ctor of game.members.filter(ts.isConstructorDeclaration)) {
        for (const parameter of ctor.parameters) if (parameter.modifiers?.some(modifier => [ts.SyntaxKind.PublicKeyword,
            ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind))) names.push(parameter.name.getText(source));
    }
    return createHash('sha256').update(JSON.stringify(names)).digest('hex');
}

describe('N2-IMPORT exhaustive narrative production ownership', () => {
    it('checks every production TS/Vue entry against the fixed import table, including author-only validation', () => {
        const entries = production(); expect(entries.length).toBeGreaterThan(20);
        expect(entries.map(file => slash(path.relative(root, file)))).toContain('recruitment.ts');
        expect(entries.flatMap(file => audit(file, readFileSync(file, 'utf8')))).toEqual([]);
    });
    it('rejects aliases, re-exports, value imports, dynamic reads, tests and metadata in production', () => {
        const file = path.join(root, 'module.ts');
        for (const code of [
            "import type { PrivateState } from '../growth/state';",
            "export { thing } from '@/ext/modules/settlement/module';",
            "export * from '../../types';", "import { Json } from '../../types';",
            "import type { Game } from '../../../../engine/Core/Game';",
            "import { presentationTimeline } from '../../../ui/dialogService';",
            "const m = import('../growth/module');", "const m = import('./' + name);",
            "const m = require('./data/recruitment.json');", "export { loadNarrativeRecruitment } from './recruitment';",
            "import { x } from './tests/contentFixture';", "import { x } from './tools/compile_narrative2.mjs';",
            "const rows = import.meta.glob('./data/*.json');", "fetch('./data/recruitment.json');",
            "const rows = new URL('./data/recruitment.json', import.meta.url);", "Date.now();", "Math.random();",
        ]) expect(audit(file, code), code).not.toEqual([]);
        expect(audit(path.join(root, 'ui/view.ts'), "import type { Game } from '../../../../engine/Core/Game';")).toEqual([]);
        expect(audit(file, "import type { Json as Value } from '../../types';")).toEqual([]);
    });
    it('preserves the baseline Game field set and narrative-facing shared protocol declarations', () => {
        // Phase6 current declaration baseline (maintainer recapture),
        // Game fields include phase6 runtime/cache additions; declarations pin
        // foundation20/whole-run7 and explicit item contribution declarations.
        // No git process is needed in CI.
        // This bounded guard is not a hash of whole shared implementations;
        // the final explicit repository scope audit covers all remaining files.
        expect(gameFieldFingerprint(readFileSync('src/engine/Core/Game.ts', 'utf8'))).toBe('846e034a5de13e61feb4952f82e22c62c0face460c191392ab8d7366f595790a');
        const contracts: [string, string][] = [
            ['src/ext/descriptor.ts', 'd1367d93e523ed14ada75d523396b1c8494087e5fe94ca9c164d34dcab6a0f39'],
            ['src/ext/types.ts', 'd48487db043031606f3b900bf2b96ae2b13b4369eafb6f92ad75caa5e6144994'],
            ['src/ext/world.ts', 'a6d6092d9b31fc7d8f12de633efa92fcca1a59bb61763d1fb28ec356906cbc9d'],
            ['src/ext/ui/types.ts', '0bef99ef738eca4a28bbaa7b716865e82f66db53903a12367e07df63679fba1c'],
            ['src/engine/Core/WholeRunSnapshot.ts', 'bdde1113622aecdfa5ef0e3d4e910b3920613cf0eef6dd2cc9bfa908de2a74e0'],
            ['src/engine/Core/RecordingV4.ts', '858c712a875024b46445e638d8b589563ea67d7974efe1691e18b4ae4e868305'],
        ];
        for (const [file, expected] of contracts) expect(declarationFingerprint(file, readFileSync(file, 'utf8')), file).toBe(expected);
        const sample = 'export interface A { readonly n: 1; }';
        expect(declarationFingerprint('sample.ts', sample)).toBe(declarationFingerprint('sample.ts', '/* trivia */ export interface A{readonly n:1;}'));
        expect(declarationFingerprint('sample.ts', sample)).not.toBe(declarationFingerprint('sample.ts', 'export interface A { readonly n: 2; }'));
    });
    it('has exact test discovery membership without duplicate, stale or omitted tests', () => {
        const suites = JSON.parse(readFileSync(path.join(root, 'test-suites.json'), 'utf8')) as Record<string, string[]>;
        expect(Object.keys(suites).sort()).toEqual(['drift', 'test']);
        const registered = Object.values(suites).flat(), discovered = files(path.join(root, 'tests'))
            .filter(file => file.endsWith('.test.ts')).map(file => slash(path.relative(root, file)));
        expect(registered.length).toBe(new Set(registered).size);
        expect([...registered].sort()).toEqual(discovered.sort());
        for (const entry of registered) expect(existsSync(path.join(root, entry)), entry).toBe(true);
        for (const name of ['data', 'metadata', 'graph', 'imports']) expect(suites.test).toContain(`tests/narrative2_${name}.test.ts`);
        expect(suites).not.toHaveProperty('gen');
        if (discovered.includes('tests/narrative2_trace.test.ts')) expect(suites.drift).toContain('tests/narrative2_trace.test.ts');
    });
    it('keeps metadata outside the rule schema, state and public projection declarations', () => {
        for (const name of ['types.ts', 'state.ts', 'input.ts', 'definitions.ts', 'descriptor.ts', 'module.ts', 'view.ts', 'ui/view.ts']) {
            const source = readFileSync(path.join(root, name), 'utf8');
            expect(source, name).not.toMatch(/\brecruit(?:ment|able)?\b|\beligibility\b|\btargetPhase\b|\bresidentId\b|\bjobId\b/);
        }
    });
});
