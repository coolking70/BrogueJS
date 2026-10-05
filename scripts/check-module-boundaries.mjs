#!/usr/bin/env node
/** Check ownership from syntax, never from the currently installed module names.
 * A deleted module must still be rejected when a surviving file references it.
 */
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { parse as parseSfc } from '@vue/compiler-sfc';
import { parse as parseTemplate } from '@vue/compiler-dom';
import postcss from 'postcss';
import { resolveTestSuites } from './test-discovery.mjs';

const slash = value => value.replace(/\\/g, '/');
const moduleOwner = value => /^src\/ext\/modules\/([^/]+)(?:\/|$)/.exec(slash(value))?.[1];
const ignoredDirectories = new Set(['node_modules', '.git', 'dist', 'dist-ssr', 'output', 'coverage', '.ce-reference', '.cache', '.vite', '.tmp', '.openai', '.sites-runtime', 'docs', 'references']);
const sourceExtension = /\.(?:[cm]?[jt]sx?|vue|css|scss|sass|less|jsonc?|html?)$/i;
const resourceProperties = /^(?:src|srcset|href|poster|url|path|paths|file|files|from|to|source|sources|target|targets|dest|destination|asset|assets|resource|resources|entry|entries|input|include|exclude|external|publicDir|outDir|template|stylesheet|worker|icon|image|portrait|replacement|backgroundImage|background|maskImage|fontFamily)$/i;
const resourceCalls = /^(?:require|resolve|importScripts|fetch|Worker|SharedWorker|Audio|Image|readFile(?:Sync)?|readdir(?:Sync)?|stat(?:Sync)?|access(?:Sync)?|existsSync|copyFile(?:Sync)?|cp(?:Sync)?|createReadStream|source|readSource|loadSource|load|loadAsync|addBundle|add|glob|globSync|globEager)$/;

function projectFiles(root) {
    const result = [];
    function walk(dir) {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            if (ignoredDirectories.has(entry.name)) continue;
            // These root-only, gitignored directories are prior raw evidence,
            // never application/configuration input (and absent from candidates).
            if (dir === root && /^(?:tmp-|\.ce-reference-fetch-)/.test(entry.name)) continue;
            const absolute = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(absolute);
            else if (entry.isFile() && sourceExtension.test(entry.name)) result.push(absolute);
        }
    }
    walk(root);
    return result.sort();
}

/** TypeScript handles JSON comments, extends and project references for us. */
function pathMappings(root) {
    const mappings = [{ find: '@/*', replacements: [path.join(root, 'src/*')] }];
    const bases = new Set([root]), errors = [];
    const visited = new Set();
    function read(config) {
        if (!existsSync(config) || visited.has(config)) return;
        visited.add(config);
        const source = ts.readConfigFile(config, ts.sys.readFile);
        if (source.error) return;
        const parsed = ts.parseJsonConfigFileContent(source.config, ts.sys, path.dirname(config), {}, config);
        const base = parsed.options.baseUrl ?? parsed.options.pathsBasePath ?? path.dirname(config);
        if (parsed.options.baseUrl) bases.add(parsed.options.baseUrl);
        for (const [find, replacements] of Object.entries(parsed.options.paths ?? {})) {
            mappings.unshift({ find, replacements: replacements.map(value => path.resolve(base, value)) });
        }
        for (const ref of parsed.projectReferences ?? []) read(path.extname(ref.path) ? ref.path : path.join(ref.path, 'tsconfig.json'));
    }
    for (const name of readdirSync(root)) if (/^tsconfig(?:\.[\w-]+)?\.json$/.test(name)) read(path.join(root, name));
    // Vite aliases are independent of tsconfig paths. Resolve both common
    // object and array forms, including URL/path helpers, without executing a
    // build configuration (which may have arbitrary side effects).
    for (const name of readdirSync(root)) {
        if (!/^(?:vite|vitest)\.config\.[cm]?[jt]s$/.test(name)) continue;
        const file = path.join(root, name), source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
        const constants = new Map();
        const collect = node => {
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constants.set(node.name.text, node.initializer);
            ts.forEachChild(node, collect);
        };
        collect(source);
        const failure = node => errors.push({ file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, message: 'Unsupported dynamic build alias: use statically resolvable string/RegExp aliases so module ownership can be checked' });
        const unwrap = (node, seen = new Set()) => {
            if (node && (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node))) return unwrap(node.expression, seen);
            if (node && ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text)) return unwrap(constants.get(node.text), new Set([...seen, node.text]));
            return node;
        };
        const add = (findNode, replacementNode, location) => {
            const replacements = expressionValues(replacementNode, constants);
            if (replacements.length !== 1 || replacements[0].includes('*')) { failure(location); return; }
            const replacement = path.resolve(path.dirname(file), replacements[0]) + (replacements[0].endsWith('/') ? '/' : '');
            const find = typeof findNode === 'string' ? findNode : expressionValues(findNode, constants)[0];
            const unwrappedFind = typeof findNode === 'string' ? undefined : unwrap(findNode);
            if (unwrappedFind && ts.isRegularExpressionLiteral(unwrappedFind)) {
                const literal = unwrappedFind.text, end = literal.lastIndexOf('/');
                try { mappings.unshift({ regex: new RegExp(literal.slice(1, end), literal.slice(end + 1)), replacements: [replacement] }); }
                catch { failure(location); }
            } else if (find) {
                mappings.unshift({ find, replacements: [replacement] }, { find: `${find}/*`, replacements: [`${replacement}/*`] });
            } else failure(location);
        };
        const visit = node => {
            if (ts.isPropertyAssignment(node) && nameOf(node.name) === 'alias') {
                const aliases = unwrap(node.initializer);
                if (aliases && ts.isObjectLiteralExpression(aliases)) {
                    for (const item of aliases.properties) {
                        if (!ts.isPropertyAssignment(item) || !nameOf(item.name)) { failure(item); continue; }
                        add(nameOf(item.name), item.initializer, item);
                    }
                } else if (aliases && ts.isArrayLiteralExpression(aliases)) {
                    for (const item of aliases.elements) {
                        const entry = unwrap(item);
                        if (!entry || !ts.isObjectLiteralExpression(entry)) { failure(item); continue; }
                        const find = entry.properties.find(prop => ts.isPropertyAssignment(prop) && nameOf(prop.name) === 'find');
                        const replacement = entry.properties.find(prop => ts.isPropertyAssignment(prop) && nameOf(prop.name) === 'replacement');
                        if (!find || !replacement) { failure(item); continue; }
                        add(find.initializer, replacement.initializer, item);
                    }
                } else failure(node);
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
    }
    return { mappings, bases: [...bases], errors };
}

function matchAlias(pattern, value) {
    const star = pattern.indexOf('*');
    if (star < 0) return pattern === value ? '' : undefined;
    const prefix = pattern.slice(0, star), suffix = pattern.slice(star + 1);
    return value.startsWith(prefix) && value.endsWith(suffix) && value.length >= prefix.length + suffix.length
        ? value.slice(prefix.length, suffix ? -suffix.length : undefined) : undefined;
}

function referenceTargets(root, source, raw, aliases) {
    let reference = slash(raw.trim()).replace(/^~/, '').replace(/^!+/, '');
    if (!reference || reference.startsWith('#')) return [];
    if (reference.includes('!')) reference = reference.slice(reference.lastIndexOf('!') + 1);
    if (/^(?:https?:|data:|blob:|node:|mailto:|tel:|\/\/)/i.test(reference)) return [];
    if (reference.startsWith('file:')) {
        try { reference = slash(fileURLToPath(reference)); } catch { return []; }
    }
    reference = reference.split(/[?#]/, 1)[0];
    try { reference = decodeURIComponent(reference); } catch { /* retain malformed escapes for diagnostics */ }
    if (reference.startsWith('/@fs/')) reference = reference.slice(4);
    const candidates = [];
    for (const { find, regex, replacements } of aliases.mappings) {
        if (regex) {
            regex.lastIndex = 0;
            if (regex.test(reference)) for (const replacement of replacements) {
                regex.lastIndex = 0;
                candidates.push(reference.replace(regex, replacement));
            }
            continue;
        }
        const match = matchAlias(find, reference);
        if (match !== undefined) candidates.push(...replacements.map(value => value.replace('*', match)));
    }
    if (reference.startsWith('.')) candidates.push(path.resolve(path.dirname(source), reference));
    else if (path.isAbsolute(reference)) {
        candidates.push(path.normalize(reference));
        // Vite's /src URLs are project-root paths, whereas actual absolute paths
        // (including /@fs/ and file: URLs) must retain their filesystem meaning.
        if (!reference.startsWith(slash(root) + '/')) candidates.push(path.join(root, reference));
    } else {
        candidates.push(path.resolve(path.dirname(source), reference));
        candidates.push(...aliases.bases.map(base => path.resolve(base, reference)));
    }
    return [...new Set(candidates.flatMap(absolute => {
        const result = [slash(path.relative(root, absolute))];
        if (existsSync(absolute)) result.push(slash(path.relative(root, realpathSync(absolute))));
        return result;
    }))];
}

const nameOf = node => ts.isIdentifier(node) || ts.isStringLiteralLike(node) ? node.text : undefined;
const calledName = node => ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? node.name.text
    : ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression) ? node.argumentExpression.text : undefined;

/** Read shell words in npm build scripts; do not execute or treat prose as code. */
function shellWords(command) {
    const words = []; let word = '', quote;
    for (let i = 0; i < command.length; i++) {
        const char = command[i];
        if (char === '\\' && quote !== "'" && i + 1 < command.length) { word += command[++i]; continue; }
        if (quote) { if (char === quote) quote = undefined; else word += char; }
        else if (char === '"' || char === "'") quote = char;
        else if (/[\s;&|<>]/.test(char)) { if (word) words.push(word); word = ''; }
        else word += char;
    }
    if (word) words.push(word);
    return words;
}

/** Conservative constant evaluation: a dynamic suffix cannot hide a known owner. */
function expressionValues(node, constants, seen = new Set()) {
    if (!node) return [];
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isNonNullExpression(node)) return expressionValues(node.expression, constants, seen);
    if (ts.isIdentifier(node) && constants.has(node.text) && !seen.has(node.text)) {
        return expressionValues(constants.get(node.text), constants, new Set([...seen, node.text]));
    }
    if (ts.isTemplateExpression(node)) {
        let values = [node.head.text];
        for (const span of node.templateSpans) {
            const substitutions = expressionValues(span.expression, constants, seen);
            values = values.flatMap(prefix => (substitutions.length ? substitutions : ['*']).map(value => prefix + value + span.literal.text));
        }
        return values.slice(0, 100);
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const left = expressionValues(node.left, constants, seen), right = expressionValues(node.right, constants, seen);
        return (left.length ? left : ['*']).flatMap(a => (right.length ? right : ['*']).map(b => a + b)).slice(0, 100);
    }
    if (ts.isConditionalExpression(node)) return [...expressionValues(node.whenTrue, constants, seen), ...expressionValues(node.whenFalse, constants, seen)];
    if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(item => expressionValues(item, constants, seen));
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && node.arguments) {
        const name = calledName(node.expression);
        if (name === 'URL' || name === 'fileURLToPath') return expressionValues(node.arguments[0], constants, seen);
        if (name === 'join' || name === 'resolve') {
            const parts = node.arguments.map(item => expressionValues(item, constants, seen));
            // An unknown absolute root still lets us recognize project-root paths.
            return parts.reduce((results, values) => results.flatMap(prefix => (values.length ? values : ['*']).map(value => path.posix.join(prefix, slash(value)))), ['']).map(value => value.replace(/^\*\//, ''));
        }
    }
    return [];
}

function isImportMeta(node) {
    return ts.isMetaProperty(node) && node.keywordToken === ts.SyntaxKind.ImportKeyword && node.name.text === 'meta';
}

function isDiscoveryCall(node, sourceName) {
    const discoveryPattern = sourceName === 'src/ext/catalog.ts' ? './modules/*/descriptor.ts'
        : sourceName === 'src/ext/realtimeCatalog.ts' ? './modules/*/runtime.ts'
        : sourceName === 'src/ext/ui/registry.ts' ? '../modules/*/ui/descriptor.ts' : undefined;
    if (!discoveryPattern || !ts.isCallExpression(node) || node.arguments.length !== 2) return false;
    if (!ts.isPropertyAccessExpression(node.expression) || node.expression.name.text !== 'glob' || !isImportMeta(node.expression.expression)) return false;
    const [pattern, options] = node.arguments;
    return ts.isStringLiteral(pattern) && pattern.text === discoveryPattern
        && ts.isObjectLiteralExpression(options) && options.properties.length === 1
        && ts.isPropertyAssignment(options.properties[0]) && nameOf(options.properties[0].name) === 'eager'
        && options.properties[0].initializer.kind === ts.SyntaxKind.TrueKeyword;
}

/** Tokenize CSS values so comments, content strings and quoted ')' stay inert. */
function cssTokens(value) {
    const result = [];
    for (let i = 0; i < value.length;) {
        if (/\s/.test(value[i])) { i++; continue; }
        if (value.slice(i, i + 2) === '/*') { const end = value.indexOf('*/', i + 2); i = end < 0 ? value.length : end + 2; continue; }
        const start = i, quote = value[i];
        if (quote === '"' || quote === "'") {
            let text = ''; i++;
            while (i < value.length && value[i] !== quote) {
                if (value[i] === '\\' && i + 1 < value.length) { text += value[i++]; text += value[i++]; }
                else text += value[i++];
            }
            i++;
            result.push({ kind: 'string', text, start });
        } else if ('(),'.includes(value[i])) result.push({ kind: value[i], text: value[i++], start });
        else {
            while (i < value.length && !/[\s(),"']/.test(value[i]) && value.slice(i, i + 2) !== '/*') {
                if (value[i] === '\\' && i + 1 < value.length) { i += 2; } else i++;
            }
            result.push({ kind: 'word', text: value.slice(start, i), start });
        }
    }
    return result;
}

function unescapeCss(value) {
    return value.replace(/\\([\da-f]{1,6})\s?|\\([^\r\n])/gi, (_, hex, char) => hex ? String.fromCodePoint(parseInt(hex, 16) || 0xfffd) : char);
}

function cssReferences(value, imported = false) {
    const tokens = cssTokens(value), result = [];
    if (imported && tokens[0]?.kind === 'string') result.push(unescapeCss(tokens[0].text));
    for (let i = 0; i < tokens.length; i++) {
        if (tokens[i].kind !== 'word' || unescapeCss(tokens[i].text).toLowerCase() !== 'url' || tokens[i + 1]?.kind !== '(') continue;
        const parts = []; i += 2;
        while (i < tokens.length && tokens[i].kind !== ')') parts.push(tokens[i++].text);
        if (parts.length) result.push(unescapeCss(parts.join('')));
    }
    return result;
}

/** @returns {string[]} Located ownership and test-manifest errors. */
export function checkModuleBoundaries(root = process.cwd()) {
    root = path.resolve(root);
    const issues = [], reported = new Set(), aliases = pathMappings(root);
    const report = (file, line, kind, reference, target) => {
        const text = `${slash(path.relative(root, file))}:${line}: ${kind}${reference ? ` ${JSON.stringify(reference)}` : ''}${target ? ` -> ${target}` : ''}`;
        if (!reported.has(text)) { reported.add(text); issues.push(text); }
    };
    for (const error of aliases.errors) report(error.file, error.line, error.message);
    function check(file, line, reference, kind) {
        for (const target of referenceTargets(root, file, reference, aliases)) {
            const owner = moduleOwner(target);
            if (!owner || owner === moduleOwner(slash(path.relative(root, file)))) continue;
            // Node tooling enumerates metadata without naming any concrete owner.
            // Imports and loader globs still require the exact discovery entries.
            if (owner === '*' && /^(?:existsSync|readdir(?:Sync)?|stat(?:Sync)?|access(?:Sync)?|readFile(?:Sync)?) resource$/.test(kind)) continue;
            report(file, line, `${kind}: ${moduleOwner(slash(path.relative(root, file))) ? 'cross-module reference' : 'module implementation/resource referenced outside its owner'}`, reference, target);
        }
    }
    function css(file, text, offset = 0, inline = false) {
        try {
            const sheet = postcss.parse(inline ? `x {${text}}` : text, { from: file });
            sheet.walk(node => {
                const imported = node.type === 'atrule' && /^(?:import|use|forward)$/i.test(node.name);
                if (node.type !== 'decl' && !imported) return;
                for (const reference of cssReferences(imported ? node.params : node.value, imported)) check(file, offset + (node.source?.start?.line ?? 1), reference, 'CSS resource');
            });
        } catch (error) { report(file, offset + (error.line ?? 1), `CSS parse error: ${error.reason ?? error.message}`); }
    }
    function script(file, text, offset = 0, boundResource = false, inheritedConstants = new Map()) {
        const sourceName = slash(path.relative(root, file));
        const source = ts.createSourceFile(file.replace(/\.vue$/, '.tsx'), text, ts.ScriptTarget.Latest, true, /\.[cm]?jsx$|\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
        const constants = new Map(inheritedConstants);
        const collect = node => {
            if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) constants.set(node.name.text, node.initializer);
            ts.forEachChild(node, collect);
        };
        collect(source);
        const lineAt = node => offset + source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        const checkNode = (node, kind) => { for (const value of expressionValues(node, constants)) check(file, lineAt(node), value, kind); };
        for (const directive of [...source.referencedFiles, ...source.typeReferenceDirectives]) check(file, offset + source.getLineAndCharacterOfPosition(directive.pos).line + 1, directive.fileName, 'TypeScript reference');
        const visit = node => {
            if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) checkNode(node.moduleSpecifier, 'import/export');
            else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference) && node.moduleReference.expression) checkNode(node.moduleReference.expression, 'import require');
            else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) checkNode(node.argument.literal, 'import type');
            else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
                if (isDiscoveryCall(node, sourceName)) return; // The two precise, generic descriptor discovery entries.
                const name = calledName(node.expression);
                const isImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
                if (isImport || name === 'URL' || (name && resourceCalls.test(name))) {
                    // copy/loader/build APIs may have more than one resource argument.
                    for (const arg of node.arguments ?? []) checkNode(arg, isImport ? 'dynamic import' : `${name} resource`);
                }
            } else if (ts.isPropertyAssignment(node) && (resourceProperties.test(nameOf(node.name) ?? '')
                || (ts.isObjectLiteralExpression(node.parent) && ts.isPropertyAssignment(node.parent.parent) && nameOf(node.parent.parent.name) === 'alias'))) {
                checkNode(node.initializer, 'resource property');
                if (/^(?:style|background|backgroundImage|maskImage)$/i.test(nameOf(node.name) ?? '')) {
                    for (const value of expressionValues(node.initializer, constants)) for (const ref of cssReferences(value)) check(file, lineAt(node), ref, 'inline CSS resource');
                }
            } else if (ts.isJsxAttribute(node) && resourceProperties.test(node.name.getText(source)) && node.initializer) {
                checkNode(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer, 'JSX resource');
            }
            ts.forEachChild(node, visit);
        };
        visit(source);
        if (boundResource) {
            for (const statement of source.statements) if (ts.isExpressionStatement(statement)) checkNode(statement.expression, 'Vue bound resource');
        }
        return constants;
    }
    function template(file, text, offset = 0, constants = new Map()) {
        let ast;
        try { ast = parseTemplate(text, { onError: error => report(file, offset + error.loc.start.line, `template parse error: ${error.message}`) }); }
        catch (error) { report(file, offset + 1, `template parse error: ${error.message}`); return; }
        const visit = node => {
            for (const prop of node.props ?? []) {
                const line = offset + prop.loc.start.line;
                if (prop.type === 6 && prop.value) {
                    if (prop.name === 'style') css(file, prop.value.content, line - 1, true);
                    else if (resourceProperties.test(prop.name) || prop.name === 'xlink:href') {
                        const refs = prop.name === 'srcset' ? prop.value.content.split(',').map(item => item.trim().split(/\s+/)[0]) : [prop.value.content];
                        for (const ref of refs) check(file, line, ref, 'template resource');
                    }
                } else if (prop.type === 7 && prop.name === 'bind' && prop.exp) {
                    const name = prop.arg?.content;
                    script(file, `(${prop.exp.content})`, line - 1, resourceProperties.test(name ?? ''), constants);
                    if (name === 'style') {
                        const expression = ts.createSourceFile('style.ts', `(${prop.exp.content})`, ts.ScriptTarget.Latest, true);
                        for (const stmt of expression.statements) if (ts.isExpressionStatement(stmt)) for (const value of expressionValues(stmt.expression, constants)) css(file, value, line - 1, true);
                    }
                }
            }
            for (const child of node.children ?? []) visit(child);
        };
        visit(ast);
    }
    for (const file of projectFiles(root)) {
        const text = readFileSync(file, 'utf8');
        if (/\.vue$/i.test(file)) {
            const parsed = parseSfc(text, { filename: file });
            for (const error of parsed.errors) report(file, typeof error === 'object' ? error.loc?.start.line ?? 1 : 1, `Vue parse error: ${typeof error === 'string' ? error : error.message}`);
            const { descriptor } = parsed;
            let constants = new Map();
            for (const block of [descriptor.script, descriptor.scriptSetup, descriptor.template, ...descriptor.styles, ...descriptor.customBlocks].filter(Boolean)) {
                if (block.src) check(file, block.loc.start.line, block.src, `Vue ${block.type} src`);
                if (block.type === 'script') constants = script(file, block.content, block.loc.start.line - 1, false, constants);
                else if (block.type === 'template') template(file, block.content, block.loc.start.line - 1, constants);
                else if (block.type === 'style') css(file, block.content, block.loc.start.line - 1);
                else if (block.lang === 'json' || block.lang === 'jsonc') json(file, block.content, block.loc.start.line - 1);
            }
        } else if (/\.(?:css|scss|sass|less)$/i.test(file)) css(file, text);
        else if (/\.html?$/i.test(file)) template(file, text);
        else if (/\.jsonc?$/i.test(file)) json(file, text);
        else script(file, text);
    }
    function json(file, text, offset = 0) {
        const source = ts.parseJsonText(file, text);
        for (const diagnostic of source.parseDiagnostics) report(file, offset + source.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1, `JSON parse error: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
        const visit = (node, parent, npmScript = false) => {
            if (ts.isStringLiteral(node) && !(parent && ts.isPropertyAssignment(parent) && parent.name === node)) {
                // Complete path values are resource declarations; prose which merely
                // mentions an import/path is not executable configuration.
                const line = offset + source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
                if (npmScript) for (const word of shellWords(node.text)) check(file, line, word.replace(/^--[\w-]+=/, ''), 'npm script resource');
                else if (!/[\r\n]/.test(node.text)) check(file, line, node.text, 'JSON resource/test manifest');
            }
            ts.forEachChild(node, child => visit(child, node, npmScript || (path.basename(file) === 'package.json' && ts.isPropertyAssignment(node) && nameOf(node.name) === 'scripts')));
        };
        visit(source);
    }
    try { resolveTestSuites(root); }
    catch (error) { report(path.join(root, 'scripts/test-suites.json'), 1, `test ownership: ${error.message}`); }
    return issues.sort();
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const args = process.argv.slice(2);
    if (args.length && !(args.length === 2 && args[0] === '--root')) {
        console.error('Usage: node scripts/check-module-boundaries.mjs [--root <project-directory>]');
        process.exitCode = 1;
    } else {
        try {
            const issues = checkModuleBoundaries(args[1] ?? fileURLToPath(new URL('../', import.meta.url)));
            if (issues.length) { console.error(issues.join('\n')); process.exitCode = 1; }
            else console.log('Module boundaries and test ownership verified.');
        } catch (error) { console.error(`Module boundary check failed: ${error.message}`); process.exitCode = 1; }
    }
}
