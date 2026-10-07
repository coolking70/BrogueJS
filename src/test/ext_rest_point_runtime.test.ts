import { afterEach, describe, it, expect, vi } from 'vitest';
import { structureHarness, createCamp, build, fixture } from './support/structureFixture';
import { worldWorkLastError, withWorldActorScope } from '../engine/Core/WorldWork';
import { planRest, planRestPointPlacement, commitStructureWorld } from '../engine/Map/StructureWorld';
import { assertWorldDefinitionPack } from '../engine/Core/WorldDefinitions';
import { definitions } from '../ext/testing/fixtures/structureBasic';
afterEach(() => vi.restoreAllMocks());
describe('foundation RestPoint', () => {
  it('standalone placement, CAS and maximum native waits without tickets/bundles', () => {
    const { g, h } = structureHarness();
    fixture(g, 'rest-placement', {
      definitionId: 'c5fixture.rest',
      levelRef: { kind: 'dungeon', depth: 1 },
      at: { x: 21, y: 10 }
    });
    expect(worldWorkLastError(g)).toBeNull();
    const r = g.world5!.restPoints[0]!;
    const hp = g.player.hp,
      food = g.player.nutrition;
    fixture(g, 'rest', { restPointId: r.interactableId, revision: r.revision });
    expect(worldWorkLastError(g)).toBeNull();
    expect(g.world5!.tickets).toHaveLength(0);
    expect(g.actorActions!.bundles).toHaveLength(0);
    const start = g.recordedInputEvents.length;
    expect(h.runAutoUntilIdle(6)).toBe(3);
    expect(g.recordedInputEvents.slice(start).map((e) => e.action)).toEqual([
      'auto_step',
      'auto_step',
      'auto_step'
    ]);
    expect(g.player.hp).toBeGreaterThanOrEqual(hp);
    expect(g.player.nutrition).toBeLessThan(food);
    expect(g.world5!.receipts.filter((v) => v.kind === 'rest')).toMatchObject([
      { result: 'completed' }
    ]);
    expect(r.lastUseOrdinal).toBe(1);
  });
  it('save/load, every replay prefix, seek and saved continuation produce the same digest', () => {
    const { g, h } = structureHarness();
    createCamp(g);
    build(g, 'bed');
    const r = g.world5!.restPoints[0]!;
    fixture(g, 'rest', { restPointId: r.interactableId, revision: r.revision });
    h.command('auto_step');
    const between = h.save();
    h.load(between);
    expect(h.runAutoUntilIdle(5)).toBe(2);
    const end = h.digest(),
      recording = h.exportRecording();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(end);
    h.seek(recording, 4);
    h.load(h.save());
    expect(h.runAutoUntilIdle(5)).toBe(2);
    expect(h.digest()).toBe(end);
  });
  it.each(['escape', 'damage', 'distance', 'target'])(
    'interruption %s writes one receipt and keeps native status ownership',
    (kind) => {
      const { g, h } = structureHarness();
      createCamp(g);
      const c = build(g, 'bed')!.fixture!,
        r = g.world5!.restPoints[0]!;
      fixture(g, 'rest', { restPointId: r.interactableId, revision: r.revision });
      if (kind === 'damage') g.player.hp--;
      if (kind === 'distance') g.player.loc = { x: 24, y: 10 };
      if (kind === 'target')
        fixture(g, 'structure', {
          kind: 'damage',
          componentId: c.id,
          revision: c.revision,
          amount: 100,
          damageKind: 'physical'
        });
      else h.command(kind === 'escape' ? 'escape' : 'auto_step');
      expect(g.hasFoundationRestPoint()).toBe(false);
      expect(g.world5!.receipts.filter((v) => v.kind === 'rest')).toHaveLength(1);
      expect(g.world5!.receipts.find((v) => v.kind === 'rest')!.result).toBe('interrupted');
      h.command('escape');
      expect(g.world5!.receipts.filter((v) => v.kind === 'rest')).toHaveLength(1);
    }
  );
  it('non-command UI stop marks disturbance without publishing a receipt', () => {
    const { g, h } = structureHarness();
    fixture(g, 'rest-placement', {
      definitionId: 'c5fixture.rest',
      levelRef: { kind: 'dungeon', depth: 1 },
      at: { x: 21, y: 10 }
    });
    const r = g.world5!.restPoints[0]!;
    fixture(g, 'rest', { restPointId: r.interactableId, revision: 0 });
    (g as any).stopAutoTravel();
    expect(g.hasFoundationRestPoint()).toBe(true);
    expect(g.world5!.receipts.filter((r) => r.kind === 'rest')).toHaveLength(0);
    h.command('auto_step');
    expect(g.world5!.receipts.filter((r) => r.kind === 'rest')).toHaveLength(1);
  });
  it('read plan is detached and target CAS rejects a concurrent use', () => {
    const { g } = structureHarness();
    fixture(g, 'rest-placement', {
      definitionId: 'c5fixture.rest',
      levelRef: { kind: 'dungeon', depth: 1 },
      at: { x: 21, y: 10 }
    });
    const r = g.world5!.restPoints[0]!;
    withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (s) => {
      const p = planRest({ restPointId: r.interactableId, revision: 0 }, s);
      expect(p.ok).toBe(true);
      r.revision++;
      if (p.ok)
        expect(commitStructureWorld(g, p.value, s)).toMatchObject({ ok: false, code: 'C5_STALE' });
    });
  });
  it.each([
    (d: any) => (d.maxRestTicks = 99),
    (d: any) => (d.maxRestTicks = 30001),
    (d: any) => (d.maxRestTicks = 101),
    (d: any) => (d.interactionDistance = -1),
    (d: any) => (d.interactionDistance = 17),
    (d: any) => (d.restorePolicy.hp = 'full-on-complete'),
    (d: any) => (d.restorePolicy.hp = 'provider-on-complete'),
    (d: any) => (d.restorePolicy.optionalCombatResources = 'full'),
    (d: any) => (d.resetPolicy = 'respawn')
  ])('rejects unsupported RestPoint policy %#', (mutate) => {
    const pack = structuredClone(definitions);
    mutate(pack.restPoints![0]);
    expect(() => assertWorldDefinitionPack(pack, 'c5fixture')).toThrow();
  });
  it('combat bonfires and foundation rest points keep separate ledgers and survive load', () => {
    const { g, h } = structureHarness(['combat']);
    createCamp(g);
    build(g, 'bed');
    expect(g.world5!.restPoints).toHaveLength(1);
    const before = g.extensionRuntime!.snapshot().modules.combat;
    const save = h.save();
    h.load(save);
    expect(g.world5!.restPoints).toHaveLength(1);
    expect(g.extensionRuntime!.snapshot().modules.combat).toEqual(before);
  });
});

it.each(['stale', 'distance', 'threat', 'busy'])(
  'rest eligibility rejects %s without consuming time or ordinals',
  (kind) => {
    const { g } = structureHarness();
    fixture(g, 'rest-placement', {
      definitionId: 'c5fixture.rest',
      levelRef: { kind: 'dungeon', depth: 1 },
      at: { x: 21, y: 10 }
    });
    const r = g.world5!.restPoints[0]!;
    if (kind === 'distance') g.player.loc = { x: 24, y: 10 };
    if (kind === 'threat') {
      const m = g.monsters[0]!;
      m.loc = { x: 22, y: 10 };
      g.grid.getCell(22, 10)!.isVisible = true;
    }
    if (kind === 'busy') g.beginFoundationRestPoint(r.interactableId, r.revision, 1, 3);
    const ticks = g.world5!.simulationTicks;
    withWorldActorScope(g, 'c5fixture', g.player.id, 'trusted-world', (scope) =>
      expect(
        planRest({ restPointId: r.interactableId, revision: kind === 'stale' ? 1 : 0 }, scope)
      ).toMatchObject({ ok: false, code: `C5_${kind.toUpperCase()}` })
    );
    expect(r.lastUseOrdinal).toBe(0);
    expect(g.world5!.simulationTicks).toBe(ticks);
  }
);
it.each(['full-hp', 'disturbed'])('rest stops once at %s before another native wait', (kind) => {
  const { g, h } = structureHarness();
  createCamp(g);
  build(g, 'bed');
  const r = g.world5!.restPoints[0]!;
  fixture(g, 'rest', { restPointId: r.interactableId, revision: 0 });
  const tick = g.world5!.simulationTicks;
  if (kind === 'full-hp') g.player.hp = g.player.maxHp;
  else (g as any).disturbed = true;
  h.command('auto_step');
  expect(g.world5!.simulationTicks).toBe(tick);
  expect(g.hasFoundationRestPoint()).toBe(false);
  expect(g.world5!.receipts.filter((r) => r.kind === 'rest')).toMatchObject([
    { result: kind === 'full-hp' ? 'completed' : 'interrupted' }
  ]);
  h.command('escape');
  expect(g.world5!.receipts.filter((r) => r.kind === 'rest')).toHaveLength(1);
});

it('poison and hunger remain in the native wait pipeline rather than being cleared by rest', () => {
  const { g, h } = structureHarness();
  createCamp(g);
  build(g, 'bed');
  g.player.applyStatus('poisoned', 12);
  const status = g.player.getStatusDuration('poisoned'),
    food = g.player.nutrition,
    hp = g.player.hp;
  const r = g.world5!.restPoints[0]!;
  fixture(g, 'rest', { restPointId: r.interactableId, revision: 0 });
  h.command('auto_step');
  expect(g.player.getStatusDuration('poisoned')).toBeGreaterThan(0);
  expect(g.player.getStatusDuration('poisoned')).toBeLessThanOrEqual(status);
  expect(g.player.nutrition).toBeLessThan(food);
  expect(g.player.hp).toBeLessThan(hp);
  expect(g.hasFoundationRestPoint()).toBe(false);
  expect(g.world5!.receipts.filter((r) => r.kind === 'rest')).toMatchObject([
    { result: 'interrupted' }
  ]);
});

it('standalone and bound RestPoints share the global 64 point budget',()=>{
 const {g}=structureHarness();
 for(let i=0;i<64;i++){const e=g.extensionRuntime!.worldWorkPlace({owner:'c5fixture',depth:1,x:40+i%30,y:2+Math.floor(i/30),instanceKey:`rest-budget.${i}`,contentId:'c5fixture.rest',nameKey:'ext.c5fixture.rest.name',descriptionKey:'ext.c5fixture.rest.description',glyph:'=',color:'#aaaaaa',interactionDistance:1,priority:0});g.world5!.restPoints.push({owner:'c5fixture',interactableId:e.id,definitionId:'c5fixture.rest',levelRef:{kind:'dungeon',depth:1},boundComponentId:null,revision:0,lastUseOrdinal:0});}
 withWorldActorScope(g,'c5fixture',g.player.id,'trusted-world',scope=>expect(planRestPointPlacement({definitionId:'c5fixture.rest',levelRef:{kind:'dungeon',depth:1},at:{x:21,y:10}},scope)).toMatchObject({ok:false,code:'C5_BUDGET'}));
 createCamp(g);build(g,'bed');expect(worldWorkLastError(g)).toBe('C5_BUDGET');
});
