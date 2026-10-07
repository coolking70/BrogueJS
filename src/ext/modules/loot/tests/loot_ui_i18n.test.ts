import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { scanI18nUsage } from '../../../../test/i18n_scan';
import { getInstalledModuleDescriptors } from '../../../catalog';
import { descriptor } from '../descriptor';
import { getLootPackIdentity, LOOT_VERSION } from '../definitions';
import main from '../../../../locales/zh_CN.json';
import core from '../locales/zh_CN.json';
import ui from '../locales/ui.zh_CN.json';

const resources: Record<string, string> = Object.assign({}, main,
  ...getInstalledModuleDescriptors().map(entry => entry.locales?.zh_CN ?? {}));
const owned = (loc: { file: string }) => loc.file.startsWith('ext/modules/loot/');
describe('loot UI localization closure', () => {
  it('resolves all owned uses with no dynamic prefixes, and references every UI key', () => {
    const result = scanI18nUsage(resolve('src'), resources);
    expect(result.unresolved.filter(owned)).toEqual([]);
    expect(result.missing.filter(entry => entry.locs.some(owned))).toEqual([]);
    expect([...result.prefixes].filter(([, locations]) => locations.some(owned))).toEqual([]);
    expect(Object.keys(ui).filter(key => !result.literals.has(key))).toEqual([]);
    expect(result.unreferenced.filter(key => key.startsWith('ext.loot.ui.'))).toEqual([]);
  }, 30000);
  it('keeps UI resources original, nonempty, Chinese and disjoint from the core locale', () => {
    for (const [key, value] of Object.entries(ui)) {
      expect(key).toMatch(/^ext\.loot\.ui\./);
      expect(key in core, key).toBe(false);
      expect(value.trim().length, key).toBeGreaterThan(0);
      expect(value, key).not.toMatch(/TODO/i);
      // Name interpolation templates, signs and enhancement suffixes are language-neutral.
      const literal = value.replace(/\{\{[^}]+\}\}/g, '').replace(/[\s+%×?=–−\-\d()[\]{}.,:;!†]/g, '');
      if (literal) expect(literal, key).toMatch(/[\u3400-\u9fff]/);
    }
    expect(descriptor.locales?.zh_CN).toEqual({ ...core, ...ui });
  });
  it('preserves the approved v1.1 pack identity and module version', () => {
    expect(LOOT_VERSION).toBe('0.1.1');
    expect(getLootPackIdentity()).toEqual({ schema: 1, version: '0.1.1',
      fingerprint: 'sha256:7785d8e68e6486bd422e40c6a3f0d317b102683116dcea8e483f2256d9c84fd2' });
    expect(descriptor.rules).toEqual(getLootPackIdentity());
  });
});
