import { writeFileSync } from 'node:fs';
import { expect } from 'vitest';
import type { Game } from '../../../../engine/Core/Game';
import type { WorldHarness } from '../../../worldSdk';
import { ItemCategory } from '../../../../engine/Items/Item';
import { containerItems } from '../../../../engine/Core/WorldWorkWorld';
import { advanceWorldClock } from '../../../world5';
import { settleResidentNeeds } from '../../../../engine/Core/ResidentNeeds';

/** Independent finite-stock daily reference; no production planning kernel. */
export function verifyResidentScale(h: WorldHarness, g: Game): void {
  const start = g.world5!.simulationTicks,
    initial = h.save(),
    before = g.world5!.receipts[g.world5!.receipts.length - 1]!.ordinal;
  const facts: { identity: string; tick: number; slot: number; actorId: number }[] = [];
  for (const c of g.extensionRuntime!.worldCampState('settlement').camps) {
    let stock = containerItems(g, c.supplyId)
      .filter((i) => i.category === ItemCategory.FOOD)
      .reduce((n, i) => n + i.quantity, 0);
    const actors = g
      .world5!.offline.find((l) => l.campSlotId === c.slot)!
      .residentStates.map((n) => ({ id: n.actorId, f: n.foodShortage as number, alive: true }))
      .sort((a, b) => a.id - b.id);
    for (let day = 1; day <= 12 && actors.some((a) => a.alive); day++) {
      const tick = (Math.floor(start / 32000) + day) * 32000;
      for (const a of actors.filter((a) => a.alive)) {
        let kind: string | null = null;
        if (stock) {
          stock--;
          a.f = Math.max(0, a.f - 1);
          kind = 'ration';
        } else if (a.f === 3) {
          a.alive = false;
          kind = 'departure';
        } else a.f++;
        if (kind)
          facts.push({
            identity: `${kind}.${c.slot}.${c.ordinal}.${a.id}.${tick}`,
            tick,
            slot: c.slot,
            actorId: a.id
          });
      }
    }
    expect(stock).toBe(0);
    expect(actors.some((a) => a.alive)).toBe(false);
  }
  facts.sort((a, b) => a.tick - b.tick || a.slot - b.slot || a.actorId - b.actorId);
  const expected = facts.slice(-128).map((f, n) => ({
    identity: f.identity,
    tick: f.tick,
    ordinal: before + facts.length - Math.min(128, facts.length) + n + 1
  }));
  const target = Number.MAX_SAFE_INTEGER;
  const run = (segments: 1 | 2 | 17) => {
    h.load(initial);
    // Keep clock input calls identical; only settlement partitioning differs.
    for (let n = 1; n < 17; n++) {
      const tick = (Math.floor(start / 32000) + n) * 32000;
      advanceWorldClock(g.world5!, tick - g.world5!.simulationTicks);
      if (segments === 17 || (segments === 2 && n === 1)) settleResidentNeeds(g);
    }
    advanceWorldClock(g.world5!, target - g.world5!.simulationTicks);
    settleResidentNeeds(g);
    expect(g.world5!.residents).toHaveLength(0);
    expect(g.world5!.residentJobs).toHaveLength(0);
    expect(
      g.world5!.receipts.map((r) => ({ identity: r.identity, tick: r.tick, ordinal: r.ordinal }))
    ).toEqual(expected);
    const digest = h.digest(),
      snapshot = g.toSnapshot();
    h.load(JSON.stringify(snapshot));
    expect(h.digest()).toBe(digest);
    expect(() => advanceWorldClock(g.world5!, 1)).toThrow();
    expect(h.digest()).toBe(digest);
    const result = {
      digest,
      world: snapshot.run.world5,
      extensions: snapshot.extensions,
      items: snapshot.entityGraph.items,
      monsters: snapshot.entityGraph.monsters
    };
    if (process.env.RESIDENT_PREP_OUT)
      writeFileSync(
        process.env.RESIDENT_PREP_OUT + '/scale-' + segments + '.json',
        JSON.stringify(result)
      );
    return result;
  };
  const whole = run(1);
  expect(run(2)).toEqual(whole);
  expect(run(17)).toEqual(whole);
}
