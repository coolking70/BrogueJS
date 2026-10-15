import { describe, expect, it, vi } from 'vitest';
import { projectItemModifiers } from '../item';
import type { LootItemDataV1, LootModifierDraft } from '../types';
import { LootUiError, freezeLootUi } from '../ui/errors';
import { knownModifierDrafts, projectLootKnowledge } from '../ui/knowledge';
import type { LootKnowledgeFacts } from '../ui/types';
import { getLootUiFixture, LOOT_UI_FIXTURE_IDS, transformLootUiFixture } from '../tools/preview/fixtures';

const facts = (overrides: Partial<LootKnowledgeFacts> = {}): LootKnowledgeFacts => ({ v: 1, location: 'pack',
  ringKindKnown: true, magicPolarity: 'unknown', curseRevealed: false, hallucinating: false, familiarity: null, ...overrides });
function deeplyFrozen(value: unknown): boolean {
  return value === null || typeof value !== 'object' || (Object.isFrozen(value) && Object.values(value).every(deeplyFrozen));
}
const sorted = (drafts: LootModifierDraft[]) => [...drafts].sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.stat.localeCompare(b.stat));

describe('loot known projection trust boundary', () => {
  it('rejects invalid item data first and gives a stable code/path', () => {
    const f = getLootUiFixture('R04');
    expect(() => projectLootKnowledge({ ...f.data, v: 2 } as unknown as LootItemDataV1, f.catalog, facts())).toThrowError(new LootUiError('INVALID_ITEM', 'data'));
  });
  it.each([
    null, {}, { ...facts(), extra: true }, { ...facts(), v: 2 }, { ...facts(), location: 'void' },
    { ...facts(), ringKindKnown: 1 }, { ...facts(), magicPolarity: 'good' }, { ...facts(), curseRevealed: 1 },
    { ...facts(), hallucinating: 'yes' }, { ...facts(), familiarity: {} }, { ...facts(), familiarity: { unit: 'kills', remaining: -1 } },
    { ...facts(), familiarity: { unit: 'kills', remaining: .5 } }, { ...facts(), familiarity: { unit: 'turns', remaining: Number.MAX_SAFE_INTEGER + 1 } },
    { ...facts(), familiarity: { unit: 'steps', remaining: 1 } }, { ...facts(), familiarity: { unit: 'kills', remaining: 1, extra: true } },
  ])('strictly rejects malformed facts %#', value => {
    const f = getLootUiFixture('R04');
    expect(() => projectLootKnowledge(f.data, f.catalog, value as LootKnowledgeFacts)).toThrowError(/INVALID_INPUT/);
  });
  it.each([
    ['R04', { curseRevealed: true }], ['R04', { magicPolarity: 'malevolent' }], ['R10', { magicPolarity: 'benign' }],
    ['R04', { location: 'floor', familiarity: { unit: 'kills', remaining: 1 } }], ['R01', { familiarity: { unit: 'turns', remaining: 0 } }],
  ] as const)('rejects inconsistent facts %s %#', (id, overrides) => {
    const f = getLootUiFixture(id);
    expect(() => projectLootKnowledge(f.data, f.catalog, facts(overrides))).toThrowError(/INCONSISTENT_FACTS/);
  });
  it('checks all identification before allowing familiarity', () => {
    const f = getLootUiFixture('R04');
    expect(() => projectLootKnowledge(transformLootUiFixture('R04', { reveal: 'all' }), f.catalog,
      facts({ familiarity: { unit: 'kills', remaining: 0 } }))).toThrowError(/INCONSISTENT_FACTS/);
  });
  it('strips all unknown row ids, tiers, values, and negative polarity', () => {
    const f = getLootUiFixture('R10'), item = projectLootKnowledge(f.data, f.catalog, facts());
    expect(item.affixes).toHaveLength(f.data.affixes.length);
    for (const row of item.affixes) expect(Object.keys(row).sort()).toEqual(['known', 'position']);
    for (const row of f.data.affixes) expect(JSON.stringify(item)).not.toContain(row.id);
    expect(item.corrupted).toBeNull(); expect(item.rareName).toBeNull();
  });
  it('retains only requested known rows in original order with independent values', () => {
    const f = getLootUiFixture('R06'), data = transformLootUiFixture('R06', { reveal: [0, 2] });
    const item = projectLootKnowledge(data, f.catalog, facts());
    expect(item.affixes.map(row => row.known)).toEqual(data.affixes.map(row => row.known));
    for (const [i, row] of item.affixes.entries()) if (row.known) {
      const def = f.catalog.affixes.find(a => a.id === row.id)!;
      expect(row).toEqual({ ...data.affixes[i], position: def.position, polarity: def.polarity });
      expect(row.values).not.toBe(data.affixes[i]!.values);
    }
  });
  it.each(['R07', 'R12'] as const)('floor strips affixes and identified identity of %s', id => {
    const f = getLootUiFixture(id), item = projectLootKnowledge(transformLootUiFixture(id, { reveal: 'all' }), f.catalog, facts({ location: 'floor' }));
    expect(item).toMatchObject({ location: 'floor', ilvl: null, affixCount: null, affixes: [], uniqueId: null, rareName: null, identified: true });
    expect(knownModifierDrafts(item, f.catalog)).toEqual([]);
  });
  it('hallucination affects floor rarity only; held/equipped views ignore it', () => {
    const f = getLootUiFixture('R06');
    expect(projectLootKnowledge(f.data, f.catalog, facts({ location: 'floor', hallucinating: true })).rarity).toBeNull();
    for (const location of ['pack', 'equipped'] as const) expect(projectLootKnowledge(f.data, f.catalog, facts({ location, hallucinating: true })).rarity).toBe('rare');
  });
  it('unknown ring kind removes base id without hiding weapon and armor bases', () => {
    for (const id of ['R01', 'R02', 'R03'] as const) {
      const f = getLootUiFixture(id), item = projectLootKnowledge(f.data, f.catalog, facts({ ringKindKnown: false }));
      expect(item.baseId).toBe(id === 'R03' ? null : f.data.baseId);
    }
    const f = getLootUiFixture('R05'), item = projectLootKnowledge(f.data, f.catalog, facts({ ringKindKnown: false }));
    expect(JSON.stringify(knownModifierDrafts(item, f.catalog))).not.toContain(f.data.baseId);
    expect(knownModifierDrafts(item, f.catalog).some(row => row.sourceId === 'unknown-ring#implicit')).toBe(true);
  });
  it('exposes unique/rare identity only once all rows are known', () => {
    for (const id of ['R07', 'R12'] as const) {
      const f = getLootUiFixture(id);
      const partial = projectLootKnowledge(transformLootUiFixture(id, { reveal: [0] }), f.catalog, facts());
      expect(partial.uniqueId).toBeNull(); expect(partial.rareName).toBeNull(); expect(partial.identified).toBe(false);
      const all = projectLootKnowledge(transformLootUiFixture(id, { reveal: 'all' }), f.catalog, facts());
      expect(all.uniqueId).toEqual(f.data.uniqueId); expect(all.rareName).toEqual(f.data.nameParts);
      if (id === 'R12') expect(all.affixes.every(row => row.known && row.position === 'row' && row.polarity === 1)).toBe(true);
    }
  });
  it('reveals corruption by identification, curse evidence, or a known negative row', () => {
    const f = getLootUiFixture('R10');
    const negative = f.data.affixes.findIndex(row => f.catalog.affixes.find(a => a.id === row.id)!.polarity === -1);
    const cases = [projectLootKnowledge(transformLootUiFixture('R10', { reveal: 'all' }), f.catalog, facts()),
      projectLootKnowledge(f.data, f.catalog, facts({ curseRevealed: true })),
      projectLootKnowledge(transformLootUiFixture('R10', { reveal: [negative] }), f.catalog, facts())];
    for (const item of cases) expect(item).toMatchObject({ corrupted: true, polarity: 'malevolent' });
    expect(projectLootKnowledge(f.data, f.catalog, facts({ magicPolarity: 'malevolent' }))).toMatchObject({ corrupted: null, polarity: 'malevolent' });
  });
  it('benign detection does not imply identified, but fully identified clean items force benign', () => {
    const f = getLootUiFixture('R04');
    expect(projectLootKnowledge(f.data, f.catalog, facts({ magicPolarity: 'benign' }))).toMatchObject({ corrupted: null, polarity: 'benign', identified: false });
    expect(projectLootKnowledge(transformLootUiFixture('R04', { reveal: 'all' }), f.catalog, facts())).toMatchObject({ corrupted: false, polarity: 'benign', identified: true });
  });
  it('omits unique ring implicit until every fixed row is known, retaining disclosed override and enhancement', () => {
    const f = getLootUiFixture('R13'), data = transformLootUiFixture('R13', { reveal: [0], enhancement: 2 });
    const drafts = knownModifierDrafts(projectLootKnowledge(data, f.catalog, facts()), f.catalog);
    expect(drafts.some(d => d.sourceId.endsWith('#implicit'))).toBe(false);
    expect(drafts.some(d => d.category === 'override')).toBe(true);
    expect(drafts.some(d => d.sourceId.endsWith('#enhancement'))).toBe(true);
    expect(drafts.filter(d => d.sourceId.startsWith('loot.unique.'))).toHaveLength(1);
  });
  it.each(LOOT_UI_FIXTURE_IDS)('full-knowledge draft oracle, deep immutability and no random: %s', id => {
    const f = getLootUiFixture(id), data = freezeLootUi(transformLootUiFixture(id, { reveal: 'all', enhancement: 1 }));
    const inputFacts = freezeLootUi(facts()), snapshot = JSON.stringify({ data, inputFacts });
    const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('unexpected random'); });
    try {
      const projected = projectLootKnowledge(data, f.catalog, inputFacts), drafts = knownModifierDrafts(projected, f.catalog);
      expect(sorted(drafts)).toEqual(sorted(projectItemModifiers(data, f.catalog).filter(d => d.known)));
      expect(deeplyFrozen(projected)).toBe(true); expect(deeplyFrozen(drafts)).toBe(true);
      expect(JSON.stringify({ data, inputFacts })).toBe(snapshot); expect(random).not.toHaveBeenCalled();
    } finally { random.mockRestore(); }
  });
});
