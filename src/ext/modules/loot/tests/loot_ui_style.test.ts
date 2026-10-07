import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from '@vue/compiler-sfc';
import postcss from 'postcss';
import rarities from '../data/rarities.json';

const root = resolve('src/ext/modules/loot');
const files = readdirSync(resolve(root, 'ui')).filter(file => file.endsWith('.vue')).map(file => resolve(root, 'ui', file));
const gallery = resolve(root, 'tools/preview/LootUiGallery.vue');
const allFiles = existsSync(gallery) ? [...files, gallery] : files;
const source = (file: string) => readFileSync(file, 'utf8');
const styles = (file: string) => parse(source(file), { filename: file }).descriptor.styles;
const tokens = ['bg', 'raised', 'fg', 'dim', 'line', 'good', 'bad', 'focus'];
function luminance(hex: string): number {
  const values = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return values[0]! * .2126 + values[1]! * .7152 + values[2]! * .0722;
}
function contrast(a: string, b: string) { const values = [luminance(a), luminance(b)].sort((left, right) => right - left); return (values[0]! + .05) / (values[1]! + .05); }

describe('loot UI standalone style contract', () => {
  it('keeps seven presentational SFCs unscoped and every selector in the loot namespace', () => {
    expect(files).toHaveLength(7);
    for (const file of allFiles) {
      expect(styles(file).length, file).toBeGreaterThan(0);
      for (const style of styles(file)) {
        expect(style.scoped, file).not.toBe(true);
        expect(style.content, file).not.toMatch(/!important|@import|url\s*\(|:global|prefers-color-scheme/i);
        const ast = postcss.parse(style.content);
        ast.walkRules(rule => { for (const selector of rule.selectors) expect(selector.trim(), `${file}: ${selector}`).toMatch(/^\.loot-/); });
      }
    }
  });
  it('declares dark shell fallbacks and explicit light overrides on each component root', () => {
    for (const file of files) {
      const css = styles(file).map(style => style.content).join('\n');
      for (const token of tokens) expect(css, `${file}: ${token}`).toContain(`--loot-${token}:`);
      expect(css, file).toContain('[data-loot-theme="light"]');
      expect(css, file).toContain('container-type: inline-size');
      expect(css, file).toContain('@container');
      expect(css, file).toContain('overflow-wrap: anywhere');
      expect(css, file).toContain('min-width: 0');
    }
    const css = files.flatMap(file => styles(file).map(style => style.content)).join('\n');
    expect(css).toContain('(max-width: 359px)');
    expect(css).toContain('(min-width: 360px) and (max-width: 639px)');
    expect(css).toContain('(min-width: 640px)');
    // Inline-size containment suppresses intrinsic width, so chips must set an explicit usable width.
    expect(styles(resolve(root, 'ui/LootItemChip.vue'))[0]!.content).toMatch(/\.loot-item-chip\s*\{[^}]*width:\s*100%/);
    expect(styles(resolve(root, 'ui/LootComparePanel.vue'))[0]!.content).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
  });
  it('gives every button/control class a 44px target and visible keyboard outline', () => {
    for (const file of allFiles) {
      const declarations = new Map<string, Record<string, string>>();
      for (const style of styles(file)) postcss.parse(style.content).walkRules(rule => {
        for (const selector of rule.selectors) {
          const values = declarations.get(selector.trim()) ?? {};
          rule.walkDecls(declaration => { values[declaration.prop] = declaration.value; });
          declarations.set(selector.trim(), values);
        }
      });
      const controls = [...source(file).matchAll(/<(?:button|input|select|textarea)\b[^>]*\sclass="([^"]+)"[^>]*>/g)].map(match => match[1]!.split(/\s+/));
      if (file.endsWith('LootItemChip.vue')) controls.push(['loot-item-chip-interactive']);
      for (const classes of controls) {
        const target = classes.find(name => declarations.get(`.${name}`)?.['min-height'] === '44px' && declarations.get(`.${name}`)?.['min-width'] === '44px');
        expect(target, `${file}: ${classes.join(' ')}`).toBeTruthy();
        expect(declarations.get(`.${target}:focus-visible`)?.outline, file).toBe('2px solid var(--loot-focus)');
      }
    }
  });
  it('preserves all six data-defined rarity colors at WCAG 3:1 in both themes', () => {
    const values = rarities.rarities.map(rarity => ({ id: rarity.id, dark: contrast(rarity.colorDark, '#0d0d0c'), light: contrast(rarity.colorLight, '#f4f1e8') }));
    expect(values).toHaveLength(6);
    for (const row of values) { expect(row.dark, `${row.id} dark`).toBeGreaterThanOrEqual(3); expect(row.light, `${row.id} light`).toBeGreaterThanOrEqual(3); }
    expect(values.find(row => row.id === 'rare')!.light).toBeLessThan(4.5);
    console.info('loot rarity contrast:', JSON.stringify(values.map(row => ({ id: row.id, dark: +row.dark.toFixed(3), light: +row.light.toFixed(3) }))));
  });
});
