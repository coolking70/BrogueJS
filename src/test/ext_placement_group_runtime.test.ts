import { it, expect } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../ext/testing/worldHarness';
import { createForageHarness } from '../ext/testing/forageHarness';
import { forage, closedLoop } from './support/forageFixture';
import { rng } from '../engine/Random';
import { descriptor, definitions, locales } from '../ext/testing/fixtures/forageFixture';
import {
  validateEdibleDefinitions,
  validateEdibleTemplates,
  validateEdibleModule
} from '../engine/Core/EdibleDefinitions';
import { extensionDataFingerprint } from '../ext/fingerprint';
it('with/without food same terrain/monsters/native items/two random streams; count and depth eligibility', () => {
  const base = createWorldHarness({ seed: 51020001, modules: [] }),
    g = worldHarnessGame(base),
    snapshot = g.toSnapshot(),
    random = rng.getState();
  base.dispose();
  const h = createForageHarness({ seed: 51020001, modules: [] }),
    after = h.game().toSnapshot();
  expect(after.levels.map((l) => l.grid)).toEqual(snapshot.levels.map((l) => l.grid));
  const normalize = (s: any) =>
    s.levels.map((l: any) => ({
      monsters: l.monsters.map((m: any) => ({ form: m.form, loc: m.loc, hp: m.hp })),
      items: l.items.filter((i: any) => !i.worldItem).map(({ id, inventoryLetter, ...i }: any) => i)
    }));
  expect(normalize(after)).toEqual(normalize(snapshot));
  expect(rng.getState()).toEqual(random);
  const nodes = h.game().world5!.nodes;
  expect(nodes.length).toBeGreaterThanOrEqual(1);
  expect(nodes.length).toBeLessThanOrEqual(2);
  expect(nodes.every((n) => n.definitionId === 'fgfixture.node-a')).toBe(true);
  expect(
    h.game().world5!.receipts.find((r) => r.identity === 'fgfixture.group@dungeon.1')
  ).toMatchObject({ result: 'completed', reason: null });
  closedLoop(h);
  h.dispose();
});
it('skip run-limit records one deterministic receipt and no node', () => {
  const p = structuredClone(definitions);
  p.placementGroups![0]!.maxPerRun = 0;
  const rules = { schema: 1, version: '1.0.0', fingerprint: extensionDataFingerprint(p) },
    override = {
      ...descriptor,
      rules,
      create: () => ({ ...descriptor.create(), rules, worldDefinitions: p })
    };
  const h = forage([], [override]);
  expect(h.game().world5!.nodes).toHaveLength(0);
  expect(
    h.game().world5!.receipts.find((r) => r.identity === 'fgfixture.group@dungeon.1')
  ).toMatchObject({ result: 'skipped', reason: 'run-limit' });
  closedLoop(h);
});
it.each([
  ['unknown edible key', (p: any): any => (p.edibleItems[0].extra = 1)],
  ['maxstack', (p: any): any => (p.edibleItems[0].maxStack = 21)],
  ['satiety', (p: any): any => (p.edibleItems[0].satiety = 2151)],
  ['shrinking transform stack', (p: any): any => (p.edibleItems[1].maxStack = 1)],
  ['cycle', (p: any): any => (p.edibleItems[1].fire.to = 'fgfixture.raw')],
  ['crossowner', (p: any): any => (p.edibleItems[0].owner = 'other')],
  [
    'status',
    (p: any): any => (p.edibleItems[3].effect = { kind: 'status', status: 'stuck', turns: 3 })
  ],
  [
    'nested derived',
    (p: any): any => (p.edibleItems[1].effect.options[0] = p.edibleItems[1].effect)
  ],
  ['temp material', (p: any): any => (p.edibleItems[9].effect.player.key = 'native.hit-chance')],
  [
    'negative more',
    (p: any): any =>
      (p.edibleItems[9].effect.other = {
        key: 'native.physical-damage-dealt',
        category: 'more',
        valueBp: -1
      })
  ],
  ['duplicate member', (p: any): any => (p.knowledgeGroups[0].kinds[1].raw = 'fgfixture.raw')],
  ['appearance budget', (p: any): any => (p.knowledgeGroups[0].appearancePool = [])],
  ['group range', (p: any): any => (p.placementGroups[0].perDepth[0].max = 33)],
  ['group weight', (p: any): any => (p.placementGroups[0].members[0].weight = 0)],
  ['group placement', (p: any): any => (p.resourceNodes[0].placement.dungeon = {})],
  ['terrain vocab', (p: any): any => (p.placementGroups[0].preference.tags = ['terrain.cave'])],
  ['need initial', (p: any): any => (p.actorNeeds[0].initial = 101)],
  ['need bands', (p: any): any => (p.actorNeeds[0].bands[1].atOrBelow = 100)],
  ['need ticks', (p: any): any => (p.actorNeeds[0].ticksPerPoint = 0)],
  ['need grace', (p: any): any => (p.actorNeeds[0].departure.visibleGraceTicks = 101)]
] as const)('strict definition rejects %s', (_name, mutate) => {
  const p = structuredClone(definitions);
  mutate(p);
  expect(() => validateEdibleDefinitions(p, 'fgfixture')).toThrow();
});
it('module protocol/action collisions and locale placeholders refused', () => {
  expect(() => validateEdibleModule(descriptor.create(), undefined)).toThrow('C5_BAD_VERSION');
  const m = descriptor.create();
  m.commands!.feed = () => {};
  expect(() => validateEdibleModule(m, 1)).toThrow('C5_BAD_DEFINITION');
  expect(() =>
    validateEdibleTemplates(definitions, {
      zh_CN: { ...locales, 'ext.fgfixture.template.roasted': '{{title}}' }
    })
  ).toThrow();
});

import { placeResourceGroups } from '../engine/Core/PlacementGroups';
import { TerrainType, DungeonLayer } from '../engine/Map/Grid';
import { placementCandidates } from '../engine/Core/WorldWorkWorld';
import { derivedSeedKey, derivedRange } from '../engine/Core/DerivedDraw';
it.each(['no-space', 'level-budget', 'run-budget'] as const)(
  'group skip %s obeys the authoritative budget before writing',
  (kind) => {
    const h = forage(),
      g = h.game(),
      before = g.extensionRuntime!.worldWorkEntities().length;
    g.world5!.nodes = [];
    if (kind === 'no-space') {
      for (let y = 0; y < g.grid.height; y++)
        for (let x = 0; x < g.grid.width; x++) g.grid.setTerrain(x, y, TerrainType.WALL);
    } else {
      const n = kind === 'level-budget' ? 32 : 512;
      g.world5!.nodes = Array.from({ length: n }, (_, i) => ({
        instanceKey: 'preexisting.' + i,
        levelRef: { kind: 'dungeon', depth: kind === 'level-budget' ? 1 : 2 }
      })) as any;
    }
    placeResourceGroups(g);
    expect(g.extensionRuntime!.worldWorkEntities()).toHaveLength(before);
    expect(g.world5!.receipts.slice(-1)[0]).toMatchObject({
      result: 'skipped',
      reason: kind === 'no-space' ? 'no-space' : 'budget'
    });
  }
);
it.each([
  null,
  TerrainType.LUMINESCENT_FUNGUS,
  TerrainType.FUNGUS_FOREST,
  TerrainType.TRAMPLED_FUNGUS_FOREST
])('weighted cells agree with independent Chebyshev radius model for terrain %s', (terrain) => {
  const h = forage(),
    g = h.game(),
    group = definitions.placementGroups![0]!;
  g.world5!.nodes = [];
  if (terrain !== null) g.grid.setTerrainLayer(13, 13, DungeonLayer.SURFACE, terrain);
  const cells = placementCandidates(g),
    key = derivedSeedKey(
      g.currentSeed,
      'fgfixture',
      g.extensionRuntime!.worldDefinitionFingerprints().fgfixture!.slice(7)
    ),
    count = group.perDepth[0]!.min + derivedRange(key, 'fgfixture.group.count.dungeon.1', 0, 2),
    want = [];
  for (let k = 0; k < count; k++) {
    const weights = cells.map((p) =>
      terrain !== null && Math.max(Math.abs(p.x - 13), Math.abs(p.y - 13)) <= 3 ? 4 : 1
    );
    let r = derivedRange(
        key,
        'fgfixture.group.cell.dungeon.1',
        k,
        weights.reduce((n, v) => n + v, 0)
      ),
      index = 0;
    while (r >= weights[index]!) {
      r -= weights[index++]!;
    }
    want.push(cells.splice(index, 1)[0]);
  }
  placeResourceGroups(g);
  expect(g.world5!.nodes.map((n) => n.at)).toEqual(want);
});
