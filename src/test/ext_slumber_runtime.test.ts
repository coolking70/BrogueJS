import { it, expect } from 'vitest';
import { forage, ally, grant, history, closedLoop } from './support/forageFixture';
import { isIncapacitated } from '../engine/Status/Incapacitation';
import { applyEdibleEffect } from '../engine/Core/EdibleEffects';
import { rng } from '../engine/Random';
it('positive damage wakes before shield absorption, zero damage does not', () => {
  const h = forage(),
    a = ally(h);
  h.fixture({ kind: 'status', actorId: a.id, status: 'slumber', turns: 20 });
  h.fixture({ kind: 'status', actorId: a.id, status: 'shielded', turns: 100 });
  const hp = a.hp;
  h.fixture({ kind: 'damage', actorId: a.id, amount: 0 });
  expect(isIncapacitated(a)).toBe(true);
  h.fixture({ kind: 'damage', actorId: a.id, amount: 1 });
  expect(a.hp).toBe(hp);
  expect(a.hasStatus('slumber')).toBe(false);
  expect(a.getStatusDuration('shielded')).toBe(90);
  closedLoop(h);
});
it('slumber player drains native paralysis loop, monster decision disabled', () => {
  const h = forage(),
    g = h.game(),
    i = grant(h, 'sample2');
  h.command('item:execute', 'eat|' + i.inventoryLetter);
  expect(g.player.hasStatus('slumber')).toBe(false);
  expect(g.absoluteTurnNumber).toBeGreaterThanOrEqual(4);
  closedLoop(h);
});
it('slumber immunity reuses paralysis and statuses preserve native poison/haste semantics', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  a.statusImmunities.add('paralyzed');
  let o = applyEdibleEffect(g, a, { kind: 'status', status: 'slumber', turns: 9 }, 0);
  expect(o.immune).toBe(true);
  expect(a.hasStatus('slumber')).toBe(false);
  a.statusImmunities.clear();
  applyEdibleEffect(g, a, { kind: 'status', status: 'poisoned', turns: 3 }, 0);
  applyEdibleEffect(g, a, { kind: 'status', status: 'poisoned', turns: 3 }, 0);
  expect(a.getStatusDuration('poisoned')).toBe(6);
  a.setStatusDuration('slowed', 8);
  o = applyEdibleEffect(g, a, { kind: 'status', status: 'haste', turns: 4 }, 0);
  expect(o.newlyStarted).toBe(true);
  expect(a.hasStatus('hasted')).toBe(true);
  expect(a.hasStatus('slowed')).toBe(false);
  for (const status of ['telepathy', 'hallucinating', 'darkness'] as const) {
    const r = rng.getState();
    o = applyEdibleEffect(g, a, { kind: 'status', status, turns: 4 }, 0);
    expect(o.notApplicable).toBe(true);
    expect(a.hasStatus(status)).toBe(false);
    expect(rng.getState()).toEqual(r);
  }
});
it('timed strength is materialized once, refreshed without stacking and expires via active clock', () => {
  const h = forage(),
    g = h.game(),
    base = g.player.strength,
    i = grant(h, 'sample6', 2);
  h.command('item:execute', 'eat|' + i.inventoryLetter);
  expect(g.player.strength).toBe(base + 2);
  h.command('item:execute', 'eat|' + i.inventoryLetter);
  expect(g.player.strength).toBe(base + 2);
  expect(g.extensionRuntime!.snapshot().foundation.timedStats!.rows).toHaveLength(1);
  closedLoop(h);
  h.fixture({ kind: 'advance', ticks: 400 });
  expect(g.player.strength).toBe(base);
  expect(g.extensionRuntime!.snapshot().foundation.timedStats).toBeUndefined();
  expect(history(h).filter((f) => f.resolvedIntent?.kind === 'temp-stat')).toHaveLength(2);
});
it.each(['hallucinating', 'telepathy', 'darkness', 'confused', 'nauseous', 'paralyzed'] as const)(
  'status %s refreshes along native max-duration application',
  (status) => {
    const h = forage(),
      g = h.game(),
      p = g.player;
    p.setStatusDuration(status, 8);
    const o = applyEdibleEffect(g, p, { kind: 'status', status, turns: 3 }, 0);
    expect(p.getStatusDuration(status)).toBe(8);
    expect(o.applied).toBe(false);
    expect(o.newlyStarted).toBe(false);
  }
);
it('player haste clears slow, status satiety loss obeys floor, heal respects native max', () => {
  const h = forage(),
    g = h.game(),
    p = g.player;
  p.setStatusDuration('slowed', 8);
  applyEdibleEffect(g, p, { kind: 'status', status: 'haste', turns: 9 }, 0);
  expect(p.hasStatus('haste')).toBe(true);
  expect(p.hasStatus('slowed')).toBe(false);
  p.nutrition = 15;
  let o = applyEdibleEffect(
    g,
    p,
    { kind: 'status-and-satiety', status: 'nauseous', turns: 5, satietyLoss: 20, floor: 10 },
    0
  );
  expect(p.nutrition).toBe(10);
  expect(o.satietyLost).toBe(5);
  p.hp = p.maxHp - 2;
  o = applyEdibleEffect(g, p, { kind: 'heal-fraction', percent: 30, min: 5 }, 0);
  expect(o.hpGained).toBe(2);
  expect(p.hp).toBe(p.maxHp);
});
it('monster slumber cannot spend its turn, poison and fire positive damage wake it', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'status', actorId: a.id, status: 'slumber', turns: 20 });
  a.ticksUntilTurn = 0;
  const at = { ...a.loc },
    hp = g.player.hp;
  h.command('wait');
  expect(a.loc).toEqual(at);
  expect(g.player.hp).toBe(hp);
  a.addPoison(3);
  h.command('wait');
  expect(a.hasStatus('slumber')).toBe(false);
  h.fixture({ kind: 'status', actorId: a.id, status: 'slumber', turns: 20 });
  h.fixture({ kind: 'status', actorId: a.id, status: 'burning', turns: 4 });
  h.command('wait');
  expect(a.hasStatus('slumber')).toBe(false);
});

import { CombatSystem } from '../engine/Combat/Combat';
import { Monster, MonsterState, type MonsterData } from '../entities/Monster';
import monsterData from '../data/monsters.json';
import { vi } from 'vitest';
it('slumber forecast is pure, melee is guaranteed and triples damage before wake', () => {
  const data = (id: string) => (monsterData as MonsterData[]).find((m) => m.id === id)!;
  const attacker = new Monster(10, 10, data('goblin'));
  attacker.damageString = '2';
  const defender = new Monster(11, 10, data('rat'));
  defender.state = MonsterState.HUNTING;
  defender.hp = defender.maxHp = 1000;
  defender.setStatusDuration('slumber', 20);
  const state = rng.getState();
  expect(CombatSystem.previewHitChance(attacker, defender)).toBe(100);
  expect(rng.getState()).toEqual(state);
  expect(defender.getStatusDuration('slumber')).toBe(20);
  const hitDie = vi.spyOn(rng, 'randPercent');
  const result = CombatSystem.attack(attacker, defender);
  expect(result).toMatchObject({
    hit: true,
    backstab: true,
    damage: 6,
    text: { circumstance: 'asleep' }
  });
  expect(hitDie).not.toHaveBeenCalled();
  expect(defender.hp).toBe(994);
  expect(defender.hasStatus('slumber')).toBe(false);
});
