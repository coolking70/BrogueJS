import { describe, it, expect } from 'vitest';
import { loadGiantsDefinitionPack, getGiantsPackIdentity } from '../definitions';
import { isGiantsPack } from '../schema';
import { initialGiantsState, isGiantsState, isGiantsBossMarker } from '../state';
import { descriptor } from '../descriptor';
import { createGiantsModuleFromPack } from '../module';
import locale from '../locales/zh_CN.json';
describe('giants original content contract', () => {
  it('is opt-in, foundation-only, fingerprinted and fully localized', () => {
    const pack = loadGiantsDefinitionPack(),
      m = createGiantsModuleFromPack(pack);
    expect(descriptor.defaultEnabled).toBe(false);
    expect(m.dependencies ?? []).toEqual([]);
    expect(m.rules).toEqual(getGiantsPackIdentity());
    expect(pack.forms[0]).toMatchObject({
      id: 'giants.ridgeback',
      size: 2,
      hp: 120,
      accuracy: 90,
      defense: 40,
      damage: '4-9',
      moveSpeed: 100,
      attackSpeed: 100
    });
    expect(pack.templates[0]).toMatchObject({
      width: 12,
      height: 10,
      entranceWidth: 3,
      minDepth: 3,
      maxDepth: 8,
      chance: 50,
      candidateLimit: 16
    });
    for (const key of [
      descriptor.labelKey,
      descriptor.descriptionKey,
      ...pack.forms.flatMap((f) => [f.nameKey, f.descriptionKey])
    ])
      expect(locale[key as keyof typeof locale]).toBeTruthy();
    expect(pack.forms).toHaveLength(2);
    expect(pack.templates).toHaveLength(2);
    expect(pack.forms[1]).toMatchObject({
      id: 'giants.abyssal-colossus',
      size: 3,
      hp: 260,
      defense: 60,
      accuracy: 95,
      damage: '8-16',
      moveSpeed: 200,
      attackSpeed: 100,
      bloodType: 0,
      DFChance: 0,
      DFType: 0
    });
    expect(pack.templates[1]).toEqual({
      id: 'giants.abyssal-chamber',
      priority: 0,
      minDepth: 7,
      maxDepth: 14,
      chance: 40,
      width: 16,
      height: 12,
      entranceWidth: 4,
      candidateLimit: 16,
      formId: 'giants.abyssal-colossus',
      guard: 'return-to-spawn'
    });
    expect(new Set(pack.forms.map((f) => f.nameKey)).size).toBe(2);
    expect(m.commands).toBeUndefined();
    expect(m.rulePolicies).toBeUndefined();
    expect(m.optionalRewards).toBeUndefined();
  });
  it('rejects malformed packs instead of repairing or accepting scripts', () => {
    const pack = loadGiantsDefinitionPack();
    expect(isGiantsPack(pack)).toBe(true);
    for (const v of [
      null,
      { ...pack, extra: true },
      { ...pack, forms: [] },
      { ...pack, forms: [pack.forms[0], pack.forms[0]] },
      { ...pack, templates: [{ ...pack.templates[0], formId: 'rat' }] },
      { ...pack, templates: [{ ...pack.templates[0], candidateLimit: 17 }] }
    ])
      expect(isGiantsPack(v)).toBe(false);
    const changed = loadGiantsDefinitionPack();
    changed.forms[0] = { ...changed.forms[0]!, hp: changed.forms[0]!.hp + 1 };
    expect(createGiantsModuleFromPack(changed).rules?.fingerprint).not.toBe(
      getGiantsPackIdentity().fingerprint
    );
  });
  it('state rejects duplicate receipts, ghost regions, fake defeated and coordinate/HP copies', () => {
    const pack = loadGiantsDefinitionPack(),
      s = initialGiantsState();
    expect(isGiantsState(s, pack)).toBe(true);
    const instanceKey = 'giants.stone-chamber.depth-3';
    const placement = {
      instanceKey,
      templateId: pack.templates[0]!.id,
      depth: 3,
      result: 'placed',
      regionId: 42,
      reason: null
    };
    const boss = {
      encounterKey: `${instanceKey}.encounter`,
      primaryId: 43,
      spawnDefinitionId: pack.forms[0]!.id,
      instanceKey,
      regionId: 42,
      subjects: [{ groupId: 43, status: 'alive' }],
      status: 'alive'
    };
    const valid = { ...s, placements: [placement], bosses: [boss] };
    expect(isGiantsState(valid, pack)).toBe(true);
    for (const v of [
      { ...valid, bosses: [] },
      { ...valid, placements: [placement, placement] },
      { ...valid, bosses: [{ ...boss, status: 'defeated' }] },
      { ...valid, bosses: [{ ...boss, hp: 120 }] },
      { ...valid, bosses: [{ ...boss, subjects: [{ groupId: 44, status: 'alive' }] }] }
    ])
      expect(isGiantsState(v, pack)).toBe(false);
    expect(
      isGiantsBossMarker({
        schema: 1,
        encounterKey: boss.encounterKey,
        spawnDefinitionId: boss.spawnDefinitionId
      })
    ).toBe(true);
    expect(
      isGiantsBossMarker({
        schema: 1,
        encounterKey: boss.encounterKey,
        spawnDefinitionId: boss.spawnDefinitionId,
        hp: 120
      })
    ).toBe(false);
  });
});
