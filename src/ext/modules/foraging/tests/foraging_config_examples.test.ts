import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadForagingPack, toWorldDefinitionPack } from '../definitions';
import { assertForagingPack } from '../schema';
import type { CompanionRules, ForagingKind, ForagingPack, ForagingPlacementGroup } from '../types';
import type { ActorNeedDeclaration, EdibleItemDefinition, KindKnowledgeGroup } from '../../../edibleSdk';
import type { ResourceDefinition } from '../../../worldSdk';
import { assertWorldDefinitionPack } from '../../../../engine/Core/WorldDefinitions';
import locale from '../locales/zh_CN.json';
import monsters from '../../../../data/monsters.json';

type KindProposal = {
  kind: ForagingKind;
  raw: EdibleItemDefinition;
  roasted: EdibleItemDefinition;
  node: ResourceDefinition;
  knowledgeKind: KindKnowledgeGroup['kinds'][number];
  placementMember: ForagingPlacementGroup['members'][number];
  localeProposal: Record<string, string>;
};
const manual = readFileSync('docs/ext/foraging-config.md', 'utf8');
const blocks = [...manual.matchAll(/```json\n([\s\S]*?)\n```/g)].map(match => JSON.parse(match[1]!) as unknown);
const proposal = blocks[0] as KindProposal, need = blocks[1] as ActorNeedDeclaration, companion = blocks[2] as CompanionRules;
const localeKeys = new Set(Object.keys({ ...locale, ...proposal.localeProposal }));
const sameKeys = (value: object, reference: object) => expect(Object.keys(value).sort()).toEqual(Object.keys(reference).sort());
function withWorldFields(pack: ForagingPack) {
  // Future proposals deliberately cannot go through the current fixed module schema.
  return { ...toWorldDefinitionPack(loadForagingPack()), resourceNodes: pack.resourceNodes, edibleItems: pack.edibleItems,
    knowledgeGroups: pack.knowledgeGroups, placementGroups: pack.placementGroups, actorNeeds: pack.actorNeeds };
}

describe('foraging configuration manual complete examples', () => {
  it('contains exactly three JSON objects and explicitly marks each as unapproved', () => {
    expect(blocks).toHaveLength(3);
    for (const block of blocks) expect(block !== null && typeof block === 'object' && !Array.isArray(block)).toBe(true);
    for (const number of ['一', '二', '三']) expect(manual).toMatch(new RegExp(`### 示例${number}[^\\n]*未批准`));
  });
  it('the proposed thirteenth kind is a complete valid SDK closure but requires module schema review', () => {
    const pack = loadForagingPack();
    sameKeys(proposal, { kind: null, raw: null, roasted: null, node: null, knowledgeKind: null, placementMember: null, localeProposal: null });
    sameKeys(proposal.kind, pack.kinds[0]!); sameKeys(proposal.raw, pack.edibleItems[0]!); sameKeys(proposal.roasted, pack.edibleItems[12]!);
    sameKeys(proposal.node, pack.resourceNodes[0]!); sameKeys(proposal.knowledgeKind, pack.knowledgeGroups[0]!.kinds[0]!);
    sameKeys(proposal.placementMember, pack.placementGroups[0]!.members[0]!);
    const existingRawCount = pack.kinds.length;
    pack.kinds.push(proposal.kind);
    pack.edibleItems.splice(existingRawCount, 0, proposal.raw);
    pack.edibleItems.splice(pack.edibleItems.length - 1, 0, proposal.roasted);
    pack.resourceNodes.push(proposal.node);
    pack.knowledgeGroups[0]!.kinds = [...pack.knowledgeGroups[0]!.kinds, proposal.knowledgeKind];
    pack.placementGroups[0]!.members = [...pack.placementGroups[0]!.members, proposal.placementMember];
    expect([pack.kinds.length, pack.edibleItems.length, pack.resourceNodes.length]).toEqual([13, 26, 13]);
    expect(pack.edibleItems.slice(0, 13).map(row => row.id)).toEqual(pack.kinds.map(row => `foraging.${row.id}`));
    expect(pack.edibleItems[pack.edibleItems.length - 1]!.id).toBe('foraging.char');
    expect(proposal.roasted.satiety).toBe(proposal.raw.satiety + 100);
    expect(proposal.roasted.effect).toEqual({ kind: 'derived-choice', domainId: 'foraging.roast-policy', ordinal: 12, options: [proposal.raw.effect, { kind: 'none' }] });
    const keys = [proposal.raw.nameKey, proposal.raw.descriptionKey, proposal.roasted.nameKey, proposal.roasted.descriptionKey,
      proposal.node.nameKey, proposal.node.descriptionKey, proposal.knowledgeKind.knownNameKey, proposal.knowledgeKind.knownDescriptionKey];
    expect(Object.keys(proposal.localeProposal).sort()).toEqual(keys.sort());
    expect(proposal.localeProposal[proposal.knowledgeKind.knownNameKey]).toBe('星径菌');
    expect(() => assertWorldDefinitionPack(withWorldFields(pack), 'foraging', localeKeys)).not.toThrow();
    expect(() => assertForagingPack(pack, localeKeys)).toThrow();
    expect(locale).not.toHaveProperty('ext.foraging.kind.starpath.name');
  });
  it('the proposed hunger declaration is complete and SDK-valid, with exact documented ticks', () => {
    const pack = loadForagingPack(); sameKeys(need, pack.actorNeeds[0]!); pack.actorNeeds = [need];
    expect(need).toEqual({ owner: 'foraging', id: 'foraging.companion-satiety', role: 'satiety', max: 2150, initial: 1800, ticksPerPoint: 100,
      bands: [{ id: 'fed', atOrBelow: 2150 }, { id: 'hungry', atOrBelow: 400 }, { id: 'weak', atOrBelow: 200 }, { id: 'starving', atOrBelow: 0 }],
      zeroDeadlineTicks: 30000, departure: { visibleGraceTicks: 2000 } });
    expect(need.bands.slice(1).map(band => (need.initial - band.atOrBelow) * need.ticksPerPoint)).toEqual([140000, 160000, 180000]);
    expect(need.initial * need.ticksPerPoint + need.zeroDeadlineTicks!).toBe(210000);
    expect(() => assertWorldDefinitionPack(withWorldFields(pack), 'foraging', localeKeys)).not.toThrow();
    expect(() => assertForagingPack(pack, localeKeys)).toThrow();
  });
  it('the complete nonEaters edit references a real template and passes the present structural schema', () => {
    const pack = loadForagingPack(), original = pack.companion;
    sameKeys(companion, original);
    expect(companion).toEqual({ ...original, nonEaters: [...original.nonEaters.filter(id => id !== 'bloat'), 'bog_monster'].sort() });
    expect(companion.nonEaters).toHaveLength(20);
    expect(new Set(companion.nonEaters).size).toBe(20);
    expect(monsters.some(monster => monster.id === 'bog_monster')).toBe(true);
    for (const id of companion.nonEaters) expect(monsters.some(monster => monster.id === id), id).toBe(true);
    pack.companion = companion;
    expect(() => assertForagingPack(pack, localeKeys)).not.toThrow();
    expect(() => assertWorldDefinitionPack(toWorldDefinitionPack(pack), 'foraging', localeKeys)).not.toThrow();
    expect(loadForagingPack().companion.nonEaters).toContain('bloat');
    expect(loadForagingPack().companion.nonEaters).not.toContain('bog_monster');
  });
});
