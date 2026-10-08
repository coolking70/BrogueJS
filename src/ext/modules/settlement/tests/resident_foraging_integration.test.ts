import { describe, expect, it, vi } from 'vitest';
import { getInstalledModuleDescriptors } from '../../../catalog';
import { setup, current, travelScenes, stairs } from './helpers';
import { bedroom } from './residentHelpers';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { residentComponent } from '../../../../engine/Core/ResidentWorld';
import { removeResident } from '../../../../engine/Core/ResidentProduction';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';
import { advanceWorldClock } from '../../../world5';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { TerrainType } from '../../../../engine/Map/Grid';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';

// Controlled room/actor prerequisites, genuine installed participants and
// public rescue/recruit decisions. Optional content is never a compile-time dependency.
function rescued() {
  const { h, g } = setup(['settlement', 'foraging']);
  bedroom(h, g);
  const a = new Monster(20, 13, (monsters as MonsterData[]).find(m => m.id === 'goblin')!);
  a.isCaged = true;
  g.monsters.push(a); g.extensionRuntime!.attachCreature(a);
  g.executeCommand('wait', undefined, () => g.freeCaptive(a));
  a.loc = { x: 20, y: 13 }; a.ticksUntilTurn = 100;
  g.player.loc = { x: 19, y: 13 }; g.refreshStructureDerivedState();
  return { h, g, a };
}
type Scene = ReturnType<typeof rescued>;
const snapshot = (g: Scene['g']) => ({ ...g.toSnapshot(), savedAt: 0 });
function need({ g, a }: Scene) {
  return g.extensionRuntime!.snapshot().foundation.actorNeeds?.rows.filter(r => r.actorId === a.id) ?? [];
}
function hunger({ g, a }: Scene) { return g.extensionRuntime!.snapshot().components[String(a.id)]?.['foraging:hunger']; }
function payload({ g, a }: Scene) {
  const c = current(g);
  return { v: 1, stateRevision: g.extensionRuntime!.worldCampState('settlement').revision,
    campId: c.regionId, campRevision: c.revision, targetId: a.id, targetRevision: residentComponent(g, a.id)?.revision ?? 0 };
}
function recruit(s: Scene, yes = true) { return s.h.ext('settlement', 'recruit', payload(s), [yes]); }
function exclusive(s: Scene) {
  expect(residentComponent(s.g, s.a.id)).toBeDefined();
  expect(need(s)).toEqual([]); expect(hunger(s)).toBeUndefined();
}
function fault(s: Scene, writer: 'removeOwnComponent' | 'setOwnComponent' | 'replaceState', after: boolean) {
  const participant = s.g.extensionRuntime!.edibleModule('foraging')!.actorNeedParticipant!;
  const original = participant.onNeedEvent!;
  let calls = 0;
  const spy = vi.spyOn(participant, 'onNeedEvent').mockImplementation((fact, tx) => original(fact, {
    ...tx,
    [writer]: (...args: unknown[]) => {
      calls++;
      if (after) (tx[writer] as (...args: unknown[]) => void)(...args);
      throw Error('ownership writer fault');
    }
  }));
  return { spy, calls: () => calls };
}

if (getInstalledModuleDescriptors().some(d => d.id === 'foraging')) describe('real foraging / resident ownership', () => {
  it('No is pure, Yes removes both companion roots, and legal present release restores one need', () => {
    const s = rescued(), { g, a } = s;
    expect(need(s)).toHaveLength(1); expect(hunger(s)).toBeDefined();
    const before = snapshot(g), digest = s.h.digest(), random = rng.getState(), id = getNextEntityId();
    expect(recruit(s, false).error).toBeNull();
    expect(snapshot(g)).toEqual(before); expect(s.h.digest()).toBe(digest);
    expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
    expect(recruit(s).error).toBeNull(); exclusive(s);
    expect(g.monsters).toContain(a);
    // Trusted qualification removal of a still-present eligible ally, not dismissal/departure.
    removeResident(g, a.id, 'qualification');
    expect(residentComponent(g, a.id)).toBeUndefined();
    expect(need(s)).toHaveLength(1); expect(hunger(s)).toBeDefined();
    expect(g.departureActors()).toContain(a);
    const saved = s.h.digest(); s.h.load(s.h.save()); expect(s.h.digest()).toBe(saved);
  });

  it.each(['removeOwnComponent', 'replaceState'] as const)('R1 recruit %s failure rolls back the entire ownership handoff', writer => {
    for (const after of [false, true]) {
      const s = rescued(), { g, a } = s, before = snapshot(g), random = rng.getState(), id = getNextEntityId();
      const checkpoint = g.checkpointResidentWorld.bind(g);
      let restores = 0;
      vi.spyOn(g, 'checkpointResidentWorld').mockImplementation(() => {
        const audit = auditFullObjectGraph({ g, logger }), restore = checkpoint();
        return () => { restore(); restores++; expect(audit.differences()).toEqual([]); };
      });
      const injected = fault(s, writer, after);
      expect(recruit(s).error).toBe('C5_PROVIDER');
      expect(injected.calls()).toBe(1); expect(restores).toBe(1);
      expect(snapshot(g)).toEqual(before); expect(g.monsters).toContain(a);
      expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
      expect(need(s)).toHaveLength(1); expect(hunger(s)).toBeDefined();
      injected.spy.mockRestore();
      expect(recruit(s).error).toBeNull(); exclusive(s);
      s.h.dispose(); vi.restoreAllMocks();
    }
  });

  it.each(['setOwnComponent', 'replaceState'] as const)('R1 release %s failure restores resident/day-food and allows one retry', writer => {
    for (const after of [false, true]) {
      const s = rescued(), { g, a } = s;
      expect(recruit(s).error).toBeNull(); exclusive(s);
      const before = snapshot(g), random = rng.getState(), id = getNextEntityId();
      const injected = fault(s, writer, after);
      // Capture the transaction's actual callback identity after installing
      // the writer fault, rather than treating the injected spy as a rollback leak.
      const audit = auditFullObjectGraph({ g, logger });
      expect(() => removeResident(g, a.id, 'qualification')).toThrow('C5_PROVIDER');
      expect(injected.calls()).toBe(1);
      expect(audit.differences(), JSON.stringify(audit.differences())).toEqual([]);
      expect(snapshot(g)).toEqual(before); expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(id);
      exclusive(s); injected.spy.mockRestore();
      removeResident(g, a.id, 'qualification');
      expect(need(s)).toHaveLength(1); expect(hunger(s)).toBeDefined();
      s.h.dispose(); vi.restoreAllMocks();
    }
  });

  it('escort cached by real stairs still consumes only its home ration', () => {
    travelScenes(); const s = rescued(), { g, a, h } = s;
    expect(recruit(s).error).toBeNull();
    expect(h.ext('settlement', 'set-residence', { ...payload(s), mode: 'escort' }).error).toBeNull();
    a.setStatusDuration('paralyzed', 1000);
    stairs(h, g, true); expect(g.depth).toBe(2);
    expect(g.levels.get(1)!.monsters).toContain(a); exclusive(s);
    const food = containerItems(g, current(g).supplyId)[0]!, quantity = food.quantity;
    advanceWorldClock(g.world5!, 32000 - g.world5!.simulationTicks); settleResidentNeeds(g);
    expect(food.quantity).toBe(quantity - 1); exclusive(s);
    expect(residentComponent(g, a.id)?.mode).toBe('escort');
    const digest = h.digest(); h.load(h.save()); expect(h.digest()).toBe(digest);
  });

  it('a real pending fall keeps home ration ownership and no companion hunger', () => {
    const s = rescued(), { g, a, h } = s;
    expect(recruit(s).error).toBeNull();
    // Goblin HP is insufficient for all native fall outcomes; use the actual
    // generated resident template for this controlled fall case.
    removeResident(g, a.id, 'qualification');
    const actor = g.monsters.find(m => m.id === g.extensionRuntime!.worldCampState('settlement').spawnSlots[0]!.actorId)!;
    const native = { ...s, a: actor }; actor.loc = { x: 20, y: 13 };
    expect(recruit(native).error).toBeNull(); exclusive(native);
    actor.loc = { x: 27, y: 20 }; actor.ticksUntilTurn = 10000;
    g.grid.setTerrain(27, 20, TerrainType.CHASM);
    for (let n = 0; n < 3 && g.monsters.includes(actor); n++) h.command('wait');
    expect(g.toSnapshot().pendingFallenByDepth.flatMap(q => q.monsters).some(m => m.id === actor.id)).toBe(true);
    exclusive(native);
    const food = containerItems(g, current(g).supplyId)[0]!, quantity = food.quantity;
    advanceWorldClock(g.world5!, 32000 - g.world5!.simulationTicks); settleResidentNeeds(g);
    expect(food.quantity).toBe(quantity - 1); exclusive(native);
    const digest = h.digest(); h.load(h.save()); expect(h.digest()).toBe(digest);
  });
});
