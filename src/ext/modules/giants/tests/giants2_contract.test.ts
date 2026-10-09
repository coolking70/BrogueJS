import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as catalog from '../../../catalog';
import { registryFromDescriptors, FOUNDATION_PROTOCOL } from '../../../descriptor';
import { extensionDataFingerprint } from '../../../fingerprint';
import { nativeFormData } from '../../../nativeForms';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { logger } from '../../../../engine/Systems/Logger';
import { assertGiantsPack, isGiantsPack } from '../schema';
import { loadGiantsDefinitionPack, getGiantsPackIdentity, GIANTS_VERSION } from '../definitions';
import { createGiantsModuleFromPack } from '../module';
import { descriptor } from '../descriptor';
import locale from '../locales/zh_CN.json';
import type { GiantsPack } from '../types';
import { startGiants, json } from './naturalFixture';

const document = readFileSync(
  new URL('../../../../../docs/ext/giants2.dot-package.md', import.meta.url),
  'utf8'
);
function section(marker: string): unknown {
  const expression = new RegExp(
    `<!-- ${marker} -->\\s*\x60\x60\x60json\\s*([\\s\\S]*?)\\s*\x60\x60\x60`
  );
  const match = document.match(expression);
  if (!match) throw new Error(`Missing authoritative ${marker} JSON`);
  return JSON.parse(match[1]!);
}
function original(): GiantsPack {
  // Byte oracle copied verbatim with git show e0fa39a225428d36e6e342f6585f57f45960e6ba.
  const bytes = readFileSync(new URL('./oracles/giants-before-giants2.json', import.meta.url));
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(
    'dda97858a8770fde02ca47955dbdf7b5deac80c593abcefa4da8b1ef9b13a4ad'
  );
  const value: unknown = JSON.parse(bytes.toString());
  assertGiantsPack(value);
  return value;
}
function additions(): GiantsPack {
  const value = section('giants2-additions');
  assertGiantsPack(value);
  return value;
}
function install(pack: GiantsPack, ids: readonly string[] = ['giants']) {
  const module = createGiantsModuleFromPack(pack);
  const descriptors = catalog
    .getInstalledModuleDescriptors()
    .map((d) => (d.id === 'giants' ? { ...d, rules: module.rules, create: () => module } : d));
  vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(
    registryFromDescriptors(descriptors)
  );
  return startGiants(ids, 1, 'wizard');
}
afterEach(() => {
  vi.restoreAllMocks();
  logger.reset();
});

describe('G2-DATA authoritative package and historical compatibility', () => {
  it('exactly appends the entire dispatch subpackage to immutable original prefixes', () => {
    const before = original(),
      added = additions();
    const expected = {
      ...before,
      forms: [...before.forms, ...added.forms],
      templates: [...before.templates, ...added.templates],
      transitions: [...before.transitions!, ...added.transitions!],
      bodies: {
        ...before.bodies!,
        definitions: [...before.bodies!.definitions, ...added.bodies!.definitions],
        breakRules: [...before.bodies!.breakRules, ...added.bodies!.breakRules]
      }
    };
    expect(loadGiantsDefinitionPack()).toEqual(expected);
    expect([
      expected.forms.length,
      expected.templates.length,
      expected.bodies.definitions.length,
      expected.bodies.breakRules.length,
      expected.transitions.length,
      expected.bodies.attackProfiles!.length
    ]).toEqual([9, 6, 2, 2, 2, 2]);
    expect(expected.bodies.statusProfiles).toBeUndefined();
    expect(added.templates.map((t) => t.formId)).toEqual([
      'giants.blind-lantern',
      'giants.copper-tendril'
    ]);
    expect(added.forms.map((f) => f.id)).toEqual([
      'giants.blind-lantern',
      'giants.blind-lantern-open',
      'giants.copper-tendril',
      'giants.copper-tendril-limb'
    ]);
    const manual = readFileSync(
      new URL('../../../../../docs/ext/giants-config.md', import.meta.url),
      'utf8'
    );
    const defaults = manual.match(/<!-- giants2-config-defaults -->\s*```json\s*([\s\S]*?)\s*```/);
    expect(defaults).not.toBeNull();
    expect(JSON.parse(defaults![1]!)).toEqual(added);
    for (const list of [
      expected.forms,
      expected.templates,
      expected.transitions,
      expected.bodies.definitions,
      expected.bodies.breakRules
    ])
      expect(new Set(list.map((entry) => entry.id)).size).toBe(list.length);
    expect(extensionDataFingerprint(expected)).toBe(
      'sha256:1a49551065efebbcea96cb35cb83fcd049f969b24aee4bf6dd4c5c7f0790d4f8'
    );
    expect(getGiantsPackIdentity()).toEqual(createGiantsModuleFromPack(expected).rules);
    expect(getGiantsPackIdentity().fingerprint).not.toBe(extensionDataFingerprint(before));
    expect([GIANTS_VERSION, expected.moduleVersion, expected.rulesVersion]).toEqual([
      '1.0.0',
      '1.0.0',
      '1.0.0'
    ]);
    // 合入前父底座已升至13；巨兽数据合入不得改变这个固定协议。
    expect(FOUNDATION_PROTOCOL).toBe(13);
    expect(descriptor.defaultEnabled).toBe(false);
    expect(createGiantsModuleFromPack(expected).dependencies ?? []).toEqual([]);
  });

  it('merges exact new locale text and preserves every old key except module.description', () => {
    const bytes = readFileSync(
      new URL('./oracles/giants-locale-before-giants2.json', import.meta.url)
    );
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(
      'c8f05a0ce1f958e1d9d5830054af76990afeff6d4ae6c76ee41752851d9d92f8'
    );
    expect(locale).toEqual({
      ...JSON.parse(bytes.toString()),
      ...(section('giants2-locale') as Record<string, string>)
    });
    for (const form of loadGiantsDefinitionPack().forms)
      for (const key of [
        form.nameKey,
        form.descriptionKey,
        ...(form.footprint?.zones ?? []).map((zone) => zone.nameKey)
      ])
        expect((locale as Record<string, string>)[key]).toBeTruthy();
  });

  it.each(['standalone additions', 'complete production', 'seven-module production'] as const)(
    'installs %s with real schema, module factory and Runtime closure',
    (kind) => {
      const pack = kind === 'standalone additions' ? additions() : loadGiantsDefinitionPack();
      const ids =
        kind === 'seven-module production'
          ? catalog.getInstalledModuleDescriptors().map((d) => d.id)
          : ['giants'];
      const game = install(pack, ids),
        runtime = game.extensionRuntime!;
      expect(
        runtime
          .nativeForms()
          .filter((form) => form.id.startsWith('giants.'))
          .map((form) => form.id)
      ).toEqual(pack.forms.map((form) => form.id));
      for (const body of pack.bodies!.definitions)
        expect(runtime.spatialCatalog.body(body.id)).toEqual(body);
      for (const depth of [1, 2, 4, 5, 8, 9])
        expect(
          runtime
            .generationContributions(depth)
            .filter((t) => t.owner === 'giants')
            .map((t) => t.id)
            .sort()
        ).toEqual(
          pack.templates
            .filter((t) => depth >= t.minDepth && depth <= t.maxDepth)
            .map((t) => t.id)
            .sort()
        );
      for (const form of additions().forms)
        expect(nativeFormData(form)).toMatchObject({ goldDropChance: 0, itemDropChance: 0 });
      expect(game.extensionRuntime).toBe(runtime);
    }
  );

  it.each([
    ['duplicate form', (p: any) => p.forms.push(p.forms[0])],
    [
      'foreign owner ID',
      (p: any) => {
        p.forms[0].id = 'combat.blind-lantern';
      }
    ],
    [
      'missing origin',
      (p: any) => {
        p.forms[0].footprint.geometry.cells.shift();
      }
    ],
    [
      'disconnected mask',
      (p: any) => {
        p.forms[0].footprint.geometry.cells[6] = { x: 10, y: 10 };
      }
    ],
    [
      'mirror pose',
      (p: any) => {
        p.forms[0].footprint.poses = ['m0'];
      }
    ],
    [
      'zone outside footprint',
      (p: any) => {
        p.forms[0].footprint.zoneCells[0].x = 10;
      }
    ],
    [
      'nonunit zone transfer',
      (p: any) => {
        p.forms[0].footprint.zones[0].health.ownerTransfer.denominator = 2;
      }
    ],
    [
      'missing body reference',
      (p: any) => {
        p.templates[1].bodyId = 'giants.absent';
      }
    ],
    [
      'missing member form',
      (p: any) => {
        p.bodies.definitions[0].parts[1].formId = 'giants.absent';
      }
    ],
    [
      'nonquarter member transfer',
      (p: any) => {
        p.bodies.definitions[0].parts[1].coreTransfer.denominator = 3;
      }
    ],
    [
      'cyclic parent edge',
      (p: any) => {
        p.bodies.definitions[0].constraints[0].parentPartId = 'limb00';
      }
    ],
    [
      'zero-cost clock',
      (p: any) => {
        p.transitions[0].ticks = 0;
      }
    ],
    [
      'missing transition result',
      (p: any) => {
        p.transitions[0].transition.results[0].formId = 'giants.absent';
      }
    ],
    [
      'unopened regeneration',
      (p: any) => {
        p.transitions[0].transition.reason = 'regrow';
      }
    ],
    [
      'invented drops',
      (p: any) => {
        p.forms[0].itemDropChance = 10;
      }
    ]
  ] as const)('rejects %s through unchanged production validation', (_name, edit) => {
    const pack = additions();
    edit(pack);
    expect(isGiantsPack(pack)).toBe(false);
    expect(() => createGiantsModuleFromPack(pack)).toThrow('Invalid giants pack');
  });

  it('rejects actual old-pack save and command recording before retiring an existing current run', () => {
    // Capture genuine old rules from the immutable historical pack, not a patched current manifest.
    const oldGame = install(original());
    oldGame.executeCommand('wait');
    oldGame.executeCommand('wait');
    const saved = json(oldGame.toSaveSnapshot()),
      recording = json(oldGame.exportRecording());
    expect(recording.events).toHaveLength(2);
    expect(oldGame.loadSnapshot(saved)).toBe(true);
    expect(oldGame.loadReplay(recording)).toBe(true);
    while (oldGame.replayCursor < recording.events.length) {
      oldGame.replayStep(true);
      expect(oldGame.replayError).toBeNull();
    }
    vi.restoreAllMocks();
    const game = startGiants(['giants'], 2, 'wizard');
    game.executeCommand('wait');
    const player = game.player,
      runtime = game.extensionRuntime,
      grid = game.grid,
      ids = getNextEntityId(),
      random = json(rng.getState());
    const mechanical = () => {
      const value = json(game.toSaveSnapshot());
      value.savedAt = 0;
      return value;
    };
    const before = mechanical();
    for (const reject of [() => game.loadSnapshot(saved), () => game.loadReplay(recording)]) {
      expect(reject()).toBe(false);
      expect(game.player).toBe(player);
      expect(game.extensionRuntime).toBe(runtime);
      expect(game.grid).toBe(grid);
      expect(getNextEntityId()).toBe(ids);
      expect(rng.getState()).toEqual(random);
      expect(mechanical()).toEqual(before);
    }
  }, 60000);
});
