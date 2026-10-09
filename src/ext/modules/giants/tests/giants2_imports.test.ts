import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from '@vue/compiler-sfc';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../../../', import.meta.url));
const own = 'src/ext/modules/giants/';
const typeOnly = new Set([
  'src/ext/types.ts',
  'src/ext/world.ts',
  'src/ext/ui/types.ts',
  'src/ui/displayProjection.ts'
]);
const allowed = new Set([
  ...typeOnly,
  'src/ext/descriptor.ts',
  'src/ext/fingerprint.ts',
  'src/ext/json.ts',
  'src/ext/nativeForms.ts',
  'src/ext/generation.ts',
  'src/ext/bodyTransitions.ts',
  'src/engine/Movement/SpatialSchema.ts',
  'src/engine/UI/MonsterZones.ts'
]);
const config = ts.readConfigFile(resolve(root, 'tsconfig.app.json'), ts.sys.readFile);
const compilerOptions = ts.parseJsonConfigFileContent(config.config, ts.sys, root).options;
function target(file: string, specifier: string): string {
  const absolute = specifier.startsWith('@/')
    ? resolve(root, 'src', specifier.slice(2))
    : specifier.startsWith('src/')
      ? resolve(root, specifier)
      : specifier.startsWith('.')
        ? resolve(dirname(resolve(root, file)), specifier)
        : specifier.startsWith('/')
          ? specifier
          : null;
  if (absolute) {
    const found =
      [absolute, `${absolute}.ts`, `${absolute}.tsx`, resolve(absolute, 'index.ts')].find(
        existsSync
      ) ?? absolute;
    return relative(root, found).replace(/\\/g, '/');
  }
  const resolved = ts.resolveModuleName(
    specifier,
    resolve(root, file),
    compilerOptions,
    ts.sys
  ).resolvedModule;
  return resolved && !resolved.isExternalLibraryImport
    ? relative(root, resolved.resolvedFileName).replace(/\\/g, '/')
    : specifier;
}
function violations(file: string, source: string): string[] {
  const errors: string[] = [],
    production = !file.startsWith(`${own}tests/`);
  const check = (specifier: string, onlyType: boolean, names: string[] = []) => {
    const destination = target(file, specifier);
    if (destination.startsWith('src/ext/modules/') && !destination.startsWith(own)) {
      errors.push(`other module: ${destination}`);
      return;
    }
    if (!production) return;
    if (destination.startsWith(own)) {
      if (destination.startsWith(`${own}tests/`))
        errors.push(`production imports test: ${destination}`);
      return;
    }
    if (['vue', 'i18next'].includes(destination)) return;
    if (!allowed.has(destination)) {
      errors.push(`outside §6.1: ${destination}`);
      return;
    }
    if (typeOnly.has(destination) && !onlyType)
      errors.push(`value from type-only entry: ${destination}`);
    if (
      destination === 'src/ext/descriptor.ts' &&
      names.some((name) => name !== (onlyType ? 'ModuleDescriptor' : 'FOUNDATION_PROTOCOL'))
    )
      errors.push(`descriptor symbol outside §6.1: ${names.join(',')}`);
  };
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      if (!clause) check(node.moduleSpecifier.text, false);
      else {
        if (clause.name) check(node.moduleSpecifier.text, clause.isTypeOnly, ['default']);
        const bindings = clause.namedBindings;
        if (bindings && ts.isNamedImports(bindings) && bindings.elements.length === 0)
          check(node.moduleSpecifier.text, clause.isTypeOnly);
        if (bindings && ts.isNamedImports(bindings) && bindings.elements.length === 0)
          check(node.moduleSpecifier.text, clause.isTypeOnly);
        if (bindings && ts.isNamedImports(bindings))
          for (const element of bindings.elements)
            check(node.moduleSpecifier.text, clause.isTypeOnly || element.isTypeOnly, [
              element.propertyName?.text ?? element.name.text
            ]);
        else if (bindings) check(node.moduleSpecifier.text, clause.isTypeOnly, ['*']);
      }
    } else if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      if (
        node.exportClause &&
        ts.isNamedExports(node.exportClause) &&
        node.exportClause.elements.length === 0
      )
        check(node.moduleSpecifier.text, node.isTypeOnly);
      if (node.exportClause && ts.isNamedExports(node.exportClause))
        for (const element of node.exportClause.elements)
          check(node.moduleSpecifier.text, node.isTypeOnly || element.isTypeOnly, [
            element.propertyName?.text ?? element.name.text
          ]);
      else check(node.moduleSpecifier.text, node.isTypeOnly, ['*']);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    ) {
      check(node.argument.literal.text, !node.isTypeOf, [node.qualifier?.getText(ast) ?? '*']);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      const expression = node.moduleReference.expression;
      if (expression && ts.isStringLiteral(expression))
        check(expression.text, node.isTypeOnly, ['*']);
      else errors.push('nonliteral import equals');
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require') ||
        (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'require'))
    ) {
      const argument = node.arguments[0];
      if (
        argument &&
        (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))
      )
        check(argument.text, false, ['*']);
      else errors.push('nonliteral dynamic dependency');
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return errors;
}
function files(directory: string): string[] {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? files(`${directory}/${entry.name}`)
      : /\.(ts|tsx|vue)$/.test(entry.name)
        ? [`${directory}/${entry.name}`]
        : []
  );
}
describe('G2-IMP exact dispatch dependency boundary', () => {
  it('checks all production and test sources, including both Vue script blocks', () => {
    const failures: string[] = [];
    for (const file of files(own.slice(0, -1))) {
      const text = readFileSync(resolve(root, file), 'utf8');
      const blocks = file.endsWith('.vue')
        ? (() => {
            const { descriptor } = parse(text);
            return [descriptor.script?.content, descriptor.scriptSetup?.content].filter(
              (s): s is string => s !== undefined
            );
          })()
        : [text];
      for (const block of blocks)
        failures.push(...violations(file, block).map((error) => `${file}: ${error}`));
    }
    expect(failures).toEqual([]);
  });
  it.each([
    "import {} from '@/engine/Core/Game'",
    "export {} from '@/engine/Core/Game'",
    "import {} from '@/ext/modules/combat/index'",
    "export {} from '@/ext/modules/combat/index'",
    "import { Game } from '@/engine/Core/Game'",
    "export * from '../../modules/combat/index'",
    "import('../../../engine/Core/Game')",
    "require('@/ext/modules/growth/data/definitions.json')",
    "import x = require('@/ext/types')",
    "import { ExtensionModule } from '@/ext/types'",
    "export { DisplayFrame } from '@/ui/displayProjection'",
    "type X = typeof import('@/ext/world')",
    "import helper from './tests/naturalFixture'",
    "import { registryFromDescriptors } from '@/ext/descriptor'",
    'import(path)',
    'require(path)'
  ])('rejects forbidden AST dependency: %s', (source) => {
    expect(violations(`${own}probe.ts`, source).length).toBeGreaterThan(0);
  });
  it.each([
    "import type { ExtensionModule } from '@/ext/types'",
    "import { type DisplayFrame } from '@/ui/displayProjection'",
    "export type { PublicMonsterZone } from '@/engine/UI/MonsterZones'",
    "type X = import('@/ext/world').WorldValidationView",
    "import { FOUNDATION_PROTOCOL, type ModuleDescriptor } from '@/ext/descriptor'",
    "import('./ui/BossHud.vue')"
  ])('accepts exact allowed type/value form: %s', (source) => {
    expect(violations(`${own}probe.ts`, source)).toEqual([]);
  });
  it('forbids other module implementations even in tests while allowing catalog composition', () => {
    expect(
      violations(`${own}tests/probe.ts`, "import { createExtensionRegistry } from '@/ext/catalog'")
    ).toEqual([]);
    for (const source of [
      "import {} from '@/ext/modules/combat/index'",
      "export {} from '@/ext/modules/combat/index'",
      "import type { X } from '@/ext/modules/combat/types'",
      "export * from '@/ext/modules/growth/index'",
      "require('@/ext/modules/settlement/data/definitions.json')"
    ])
      expect(violations(`${own}tests/probe.ts`, source).length).toBeGreaterThan(0);
  });
});
