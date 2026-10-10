import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

const root = path.resolve('src/ext/modules/foraging');
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.name === 'tests' ? [] : entry.isDirectory() ? files(path.join(dir, entry.name)) : /\.(?:ts|vue)$/.test(entry.name) ? [path.join(dir, entry.name)] : []);
}
type Import = { source: string; typeOnly: boolean };
function imports(text: string): Import[] {
  const result: Import[] = [], source = ts.createSourceFile('source.ts', text, ts.ScriptTarget.Latest, true);
  function literal(node: ts.Node | undefined): string {
    if (!node || !ts.isStringLiteralLike(node)) throw new Error('Import source must be a literal');
    return node.text;
  }
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) result.push({ source: literal(node.moduleSpecifier), typeOnly: node.importClause?.isTypeOnly ?? false });
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier) result.push({ source: literal(node.moduleSpecifier), typeOnly: node.isTypeOnly });
    else if (ts.isImportTypeNode(node)) {
      if (!ts.isLiteralTypeNode(node.argument)) throw new Error('Import type must use a literal');
      result.push({ source: literal(node.argument.literal), typeOnly: !node.isTypeOf });
    } else if (ts.isImportEqualsDeclaration(node)) {
      if (!ts.isExternalModuleReference(node.moduleReference)) throw new Error('Import aliases are not allowed');
      result.push({ source: literal(node.moduleReference.expression), typeOnly: node.isTypeOnly });
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) result.push({ source: literal(node.arguments[0]), typeOnly: false });
    ts.forEachChild(node, visit);
  }
  visit(source); return result;
}
function allowed(file: string, entry: Import): boolean {
  if (['vue', 'i18next'].includes(entry.source)) return true;
  let resolved: string;
  if (entry.source.startsWith('.')) resolved = path.resolve(path.dirname(file), entry.source);
  else if (entry.source.startsWith('@/')) resolved = path.resolve('src', entry.source.slice(2));
  else return false;
  resolved = resolved.replace(/\.(?:ts|js)$/, '');
  if (resolved.startsWith(root + path.sep)) return !resolved.startsWith(path.join(root, 'tests') + path.sep);
  const relative = path.relative(path.resolve('src'), resolved).split(path.sep).join('/');
  if (relative === 'ext/world') return entry.typeOnly;
  return ['ext/worldSdk', 'ext/edibleSdk', 'ext/types', 'ext/descriptor', 'ext/fingerprint'].includes(relative) || relative.startsWith('ext/ui/') || relative.startsWith('ui/');
}

describe('foraging production import boundary (T-IMP)', () => {
  it('checks static, dynamic, type imports and re-exports in every TS and Vue script', () => {
    const sources = files(root); expect(sources.length).toBeGreaterThan(4);
    for (const file of sources) {
      expect(realpathSync(file).startsWith(root + path.sep)).toBe(true);
      const text = readFileSync(file, 'utf8');
      const scripts = file.endsWith('.vue') ? (() => { const sfc = parse(text, { filename: file }).descriptor; expect(sfc.script?.src).toBeUndefined(); expect(sfc.scriptSetup?.src).toBeUndefined(); return [sfc.script?.content ?? '', sfc.scriptSetup?.content ?? '']; })() : [text];
      for (const script of scripts) for (const entry of imports(script)) expect(allowed(file, entry), `${path.relative(root, file)} imports ${entry.source}`).toBe(true);
    }
  });
  it('detects forbidden type imports, dynamic imports, re-exports and nonliteral paths', () => {
    const file = path.join(root, 'probe.ts');
    for (const source of ["import type { X } from '../../stats'", "export type { X } from '../../structureTypes'", "const value = import('../../runtime')", "type X = import('../../stats').X", "import X from '../../world'", "const value = require('../../../engine/Core/Game')", "import type { X } from '../crafting/types'", "import { X } from './tests/helper'"]) expect(imports(source).every(entry => allowed(file, entry)), source).toBe(false);
    expect(() => imports('const module = import(variable)')).toThrow();
    expect(imports("import type { X } from '../../world'; import { EDIBLE_SDK_VERSION } from '../../edibleSdk';").every(entry => allowed(file, entry))).toBe(true);
  });
  it('derives world pack, placement and stat types from ExtensionModule', () => {
    const text = readFileSync(path.join(root, 'types.ts'), 'utf8');
    expect(text).toContain("NonNullable<ExtensionModule['worldDefinitions']>");
    expect(text).toContain("NonNullable<ForagingWorldPack['placementGroups']>[number]");
    expect(text).toContain("NonNullable<ExtensionModule['statSources']>");
    expect(text).toContain("Parameters<ForagingStatSources['collect']>[1]");
    expect(text).toContain("ReturnType<ForagingStatSources['collect']>[number]");
  });
});
