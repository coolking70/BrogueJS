import { afterEach, it, expect, vi } from 'vitest';
import { structureHarness, createCamp, fixture, build } from './support/structureFixture';
import { worldWorkLastError, withWorldActorScope } from '../engine/Core/WorldWork';
import { planRegionChange, commitStructureWorld } from '../engine/Map/StructureWorld';
afterEach(() => vi.restoreAllMocks());
it('create/expand/retire CAS, reusable minimum slot and persistent high water', () => {
  const { g, h } = structureHarness();
  let r = createCamp(g);
  expect(worldWorkLastError(g)).toBeNull();
  expect(r.campSlotId).toBe(0);
  expect(r.revision).toBe(0);
  fixture(g, 'region', {
    kind: 'expand',
    regionId: r.id,
    revision: 0,
    bounds: { x: 16, y: 6, width: 11, height: 11 }
  });
  r = g.extensionRuntime!.worldStructureRegions()[0]!;
  expect(r.revision).toBe(1);
  fixture(g, 'region', { kind: 'retire', regionId: r.id, revision: 0 });
  expect(worldWorkLastError(g)).toBe('C5_STALE');
  fixture(g, 'region', { kind: 'retire', regionId: r.id, revision: 1 });
  expect(worldWorkLastError(g)).toBeNull();
  expect(g.extensionRuntime!.snapshot().foundation.world).not.toHaveProperty('regions');
  const save = h.save();
  h.load(save);
  expect(g.extensionRuntime!.snapshot().foundation.world).not.toHaveProperty('regions');
  r = createCamp(g);
  expect(r.campSlotId).toBe(0);
  expect(g.world5!.campSlotOrdinals![0]).toBe(2);
  expect(g.world5!.levels).toHaveLength(1);
});
it.each([
  { x: 0, y: 5, width: 9, height: 9 },
  { x: 17, y: 7, width: 8, height: 9 },
  { x: 75, y: 7, width: 9, height: 9 }
])('reject invalid create bounds %j', (bounds) => {
  const { g } = structureHarness();
  fixture(g, 'region', {
    kind: 'create',
    instanceKey: 'bad',
    levelRef: { kind: 'dungeon', depth: 1 },
    bounds
  });
  expect(worldWorkLastError(g)).toBe('C5_BLOCKED');
  expect(g.extensionRuntime!.worldStructureRegions()).toHaveLength(0);
});
it('nonempty retirement is reserved; scope expires and handles are single-use', () => {
  const { g } = structureHarness();
  const r = createCamp(g);
  build(g, 'floor');
  fixture(g, 'region', { kind: 'retire', regionId: r.id, revision: 0 });
  expect(worldWorkLastError(g)).toBe('C5_RESERVED');
  let scope: any, plan: any;
  withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (s) => {
    scope = s;
    plan = planRegionChange(
      {
        kind: 'expand',
        regionId: r.id,
        revision: 0,
        bounds: { x: 16, y: 6, width: 11, height: 11 }
      },
      s
    );
  });
  expect(plan.ok).toBe(true);
  expect(commitStructureWorld(g, plan.value, scope)).toMatchObject({ ok: false, code: 'C5_SCOPE' });
});
