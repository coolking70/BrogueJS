import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import ts from 'typescript';
import { getInstalledModuleUiContributions } from '../../../ui/registry';

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(join(dir, entry.name)) : [join(dir, entry.name)]);
}
const source = resolve('src'), loot = resolve('src/ext/modules/loot');
describe('loot UI remains unmounted and pure', () => {
  it('has no discoverable descriptor or registered contribution', () => {
    expect(existsSync(join(loot, 'ui/descriptor.ts'))).toBe(false);
    expect(getInstalledModuleUiContributions().some(entry => entry.moduleId === 'loot')).toBe(false);
  });
  it('has no references from outside its module, including relative paths', () => {
    const forbidden: string[] = [];
    for (const file of files(source).filter(file => !file.startsWith(`${loot}/`) && /\.(?:ts|vue|js)$/.test(file))) {
      const text = readFileSync(file, 'utf8');
      if (/modules\/loot\/(?:ui|tools)/.test(text)) forbidden.push(relative(source, file));
      const imports = [...text.matchAll(/(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]/g)];
      for (const match of imports) {
        const target = match[1]!;
        if (target.startsWith('.')) {
          const absolute = resolve(file, '..', target);
          if (absolute.startsWith(`${loot}/ui/`) || absolute.startsWith(`${loot}/tools/`)) forbidden.push(relative(source, file));
        }
      }
    }
    expect(forbidden).toEqual([]);
  });
  it('contains no runtime access, ambient effects, or cross-module imports', () => {
    for (const file of files(join(loot, 'ui')).filter(file => /\.(?:ts|vue)$/.test(file))) {
      const text = readFileSync(file, 'utf8');
      expect(text, file).not.toMatch(/Math\.random|\bDate\b|\bwindow\s*\.|\bdocument\s*\.|\blocalStorage\b|\baddEventListener\b/);
      const script = file.endsWith('.vue') ? text.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1] ?? '' : text;
      const ast = ts.createSourceFile(file, script, ts.ScriptTarget.Latest, true);
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          const target = node.moduleSpecifier.text;
          expect(target, file).not.toMatch(/engine\/Core|ext\/runtime|ext\/ui|src\/ui|modules\/(growth|combat|giants|narrative)/);
          if (target.startsWith('.')) {
            const absolute = resolve(file, '..', target);
            expect(absolute.startsWith(`${loot}/`) || /^.*\/src\/data\/(weapons|armors|arcana)\.json$/.test(absolute), `${file}: ${target}`).toBe(true);
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
    }
  });
});
