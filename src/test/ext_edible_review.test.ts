import { it, expect, vi } from 'vitest';
import { forage, ally, grant, read, history, closedLoop } from './support/forageFixture';
import { descriptor, definitions } from '../ext/testing/fixtures/forageFixture';
import { settleActorNeeds } from '../engine/Core/ActorNeeds';
import { beginDeparture, settleDepartures } from '../engine/Core/ActorDeparture';
import { fireContactPending } from '../engine/Core/FireContact';
import { spawnDungeonFeature, catalogFeature } from '../engine/Map/DungeonFeature';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import { TerrainType } from '../engine/Map/Grid';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { advanceWorldClock } from '../ext/world5';
import i18next from 'i18next';

it('P1 a departing spear wielder neither attacks nor retries the step', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  const enemy = new Monster(9, 12, monsters.find((m) => m.id === 'rat') as MonsterData);
  g.monsters.push(enemy);
  g.extensionRuntime!.attachCreature(enemy);
  const hp = enemy.hp;
  h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
  const move = vi.spyOn(g, 'moveDepartingActor');
  g.departureTurn(a);
  expect(enemy.hp).toBe(hp);
  expect(move).toHaveBeenCalledTimes(1);
});

it('P1 an unsuccessful move spends one attempt and one timer', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
  const move = vi.spyOn(g, 'moveDepartingActor').mockReturnValue(false);
  const at = { ...a.loc };
  g.departureTurn(a);
  expect(move).toHaveBeenCalledTimes(1);
  expect(a.loc).toEqual(at);
  expect(a.ticksUntilTurn).toBe(a.movementSpeed);
});

it('P1 departure precedes native activation DF and corpse absorption', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
  vi.spyOn(a, 'DFChance', 'get').mockReturnValue(100);
  vi.spyOn(a, 'DFType', 'get').mockReturnValue(DF.DF_BLOAT_EXPLOSION);
  const behavior = a.hasBehavior.bind(a);
  vi.spyOn(a, 'hasBehavior').mockImplementation(
    (flag) => flag === 'MONST_GETS_TURN_ON_ACTIVATION' || behavior(flag)
  );
  const roll = vi.spyOn(rng, 'randPercent'),
    hp = a.hp;
  expect(a.prepareNativeDecision(g, 0)).toBe(true);
  expect(roll).not.toHaveBeenCalled();
  expect(a.hp).toBe(hp);
  a.corpseAbsorptionCounter = 3;
  a.prepareNativeDecision(g, 0);
  expect(a.corpseAbsorptionCounter).toBe(3);
});

it('P1 entrancement cannot route a departed spear wielder into an attack', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  const enemy = new Monster(9, 12, monsters.find((m) => m.id === 'rat') as MonsterData);
  g.monsters.push(enemy);
  g.extensionRuntime!.attachCreature(enemy);
  h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
  a.setStatusDuration('entranced', 10);
  const at = { ...a.loc },
    hp = enemy.hp;
  a.moveEntranced(g, -1, 1);
  expect(a.loc).toEqual(at);
  expect(enemy.hp).toBe(hp);
  expect(a.prepareNativeDecision(g, 0)).toBe(true);
  expect(a.loc).toEqual(at);
});

it('P1 direct native fallback also routes a departing actor through its single safe step', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
  const move = vi.spyOn(g, 'moveDepartingActor').mockReturnValue(false);
  const attack = vi.spyOn(a as any, 'takeNativeDecisionWithinAction');
  a.takeNativeDecision(g);
  expect(move).toHaveBeenCalledTimes(1);
  expect(attack).not.toHaveBeenCalled();
});

it.each([TerrainType.LAVA, TerrainType.CHASM, TerrainType.PLAIN_FIRE, TerrainType.POISON_GAS])(
  'P1 departure rejects hazardous destination %s even with no reachable stairs',
  (terrain) => {
    const h = forage(),
      g = h.game(),
      a = ally(h);
    h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
    for (let y = 9; y <= 11; y++)
      for (let x = 10; x <= 12; x++)
        if (x !== a.x || y !== a.y) g.grid.setTerrain(x, y, TerrainType.GRANITE);
    g.grid.setTerrain(12, 9, terrain);
    const at = { ...a.loc },
      hp = a.hp,
      before = rng.getState();
    g.departureTurn(a);
    expect(a.loc).toEqual(at);
    expect(a.hp).toBe(hp);
    expect(rng.getState()).toEqual(before);
  }
);

it.each(['throw', 'object', 'promise'])(
  'P2 qualifies %s degrades to false with a diagnostic during native ally gain',
  (failure) => {
    const bad = {
      ...descriptor,
      create: () => {
        const m = descriptor.create();
        m.actorNeedParticipant!.qualifies = (() => {
          if (failure === 'throw') throw Error('qualifies fault');
          return failure === 'promise' ? Promise.reject(Error('async fault')) : {};
        }) as any;
        return m;
      }
    };
    const h = forage([], [bad]),
      g = h.game();
    expect(h.fixture({ kind: 'ally', at: { x: 11, y: 10 } }).error).toBeNull();
    expect(g.monsters[0]!.isAlly).toBe(true);
    expect(g.extensionRuntime!.snapshot().foundation.actorNeeds).toBeUndefined();
    expect(g.extensionRuntime!.readEdibleDiagnostics()).toContainEqual({
      owner: 'fgfixture',
      method: 'qualifies'
    });
  }
);

it('P3 need deadlines remain scheduled while a follower is in transit', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  g.monsters = [];
  // Native stairs arrival owns publication. The need clock does not own this array.
  const source = {
    monsters: [a],
    visibleMonsters: new Set([a]),
    playerExitedVia: { x: 11, y: 10 }
  };
  a.entersLevelIn = 1;
  a.approaching = 1;
  g.grid.setTerrain(11, 10, TerrainType.STAIRS_UP);
  advanceWorldClock(g.world5!, 100);
  settleActorNeeds(g);
  (g as any).monsterEntersLevel(a, source);
  expect(g.monsters).toContain(a);
  advanceWorldClock(g.world5!, 600);
  settleActorNeeds(g);
  expect(
    history(h)
      .filter((f) => f.kind === 'band')
      .map((f) => [f.band, f.crossedAtTick])
  ).toEqual([
    ['low', 300],
    ['empty', 500]
  ]);
  expect(history(h).filter((f) => f.kind === 'deadline')).toHaveLength(1);
});

it('P4 native ally resurrection reattaches the same actor with an initial need', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'damage', actorId: a.id, amount: 10000 });
  h.command('wait');
  expect(g.purgatory).toContain(a);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds).toBeUndefined();
  expect(g.resurrectAlly({ x: 11, y: 10 })).toBe(true);
  expect(g.monsters).toContain(a);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds!.rows).toEqual([
    expect.objectContaining({
      actorId: a.id,
      value: definitions.actorNeeds![0]!.initial,
      revision: 1
    })
  ]);
});

it('P5 inventory ignition never drains while native DF contact is active', () => {
  const h = forage(),
    g = h.game();
  for (let n = 0; n < 8; n++) grant(h, 'sample' + n);
  let active = 0;
  const native = (g as any).applyDungeonFeatureContact.bind(g);
  vi.spyOn(g as any, 'applyDungeonFeatureContact').mockImplementation((...args: any[]) => {
    active++;
    try {
      return native(...args);
    } finally {
      active--;
    }
  });
  const observations: number[] = [],
    runtime = g.extensionRuntime!;
  const participate = runtime.edibleParticipate.bind(runtime);
  vi.spyOn(runtime, 'edibleParticipate').mockImplementation((...args) => {
    if (args[1] === 'onFireContact') observations.push(active);
    return participate(...args);
  });
  spawnDungeonFeature(g.grid, g.player.x, g.player.y, catalogFeature(DF.DF_EXPLOSION_FIRE), false);
  expect(observations.length).toBeGreaterThan(0);
  expect(observations.every((n) => n === 0)).toBe(true);
  expect(fireContactPending(g)).toBe(false);
});

it('P6 material equip rejects uniformly and drop messages use the known display name', () => {
  const h = forage(),
    g = h.game(),
    item = grant(h);
  const before = structuredClone(logger.messages),
    tick = g.world5!.simulationTicks;
  g.executeItemCommand('equip', item);
  expect(g.world5!.simulationTicks).toBe(tick);
  expect(logger.messages).not.toEqual(before);
  expect(JSON.stringify(logger.messages)).not.toContain(item.name);
  g.executeItemCommand('drop', item);
  expect(JSON.stringify(logger.messages)).not.toContain(item.name);
  expect(JSON.stringify(logger.messages)).toContain(item.displayName);
  closedLoop(h);
});

it.each([TerrainType.WATER_DEEP, TerrainType.LAVA])(
  'P6 pickup refusal %s supplies a safe translated display-name parameter',
  (terrain) => {
    const h = forage(),
      g = h.game(),
      item = grant(h, 'sample1', 1, true, g.player.loc);
    g.grid.setTerrain(g.player.x, g.player.y, terrain);
    const translate = vi.spyOn(i18next, 't');
    h.command('pickup');
    const key = terrain === TerrainType.LAVA ? 'item.lava_reach' : 'item.deep_water_reach';
    expect(translate.mock.calls.find((c) => c[0] === key)![1]).toMatchObject({
      name: item.displayName
    });
    expect(JSON.stringify(logger.messages)).toContain(item.displayName);
    expect(JSON.stringify(logger.messages)).not.toContain(item.name);
    expect(g.items).toContain(item);
  }
);

it.each([1, 3])(
  'P7 twenty quantity-%i explosions prepare rendering once after drain',
  (quantity) => {
    const h = forage(),
      g = h.game();
    const items = Array.from({ length: 20 }, () =>
      grant(h, 'sample7', quantity, true, { x: 12, y: 10 })
    );
    const render = vi.spyOn(g, 'requestEdibleRender');
    h.fixture({ kind: 'fire', itemId: items[0]!.id });
    expect(history(h).filter((f) => f.cause)).toHaveLength(20);
    expect(render).toHaveBeenCalledTimes(1);
    expect(fireContactPending(g)).toBe(false);
    closedLoop(h);
  }
);

it('P8 a fallen departing actor is retired from pending ownership and has one receipt', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  a.hp = a.maxHp = 100;
  h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
  a.falling = true;
  (g as any).monstersFall();
  settleDepartures(g);
  expect(g.monsters).not.toContain(a);
  expect([...(g as any).pendingFallenByDepth.values()].flat()).not.toContain(a);
  expect(g.extensionRuntime!.snapshot().foundation.departures!.active).toEqual([]);
  expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts).toHaveLength(1);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds).toBeUndefined();
  expect(g.toSnapshot().entityGraph.monsters.some((m) => m.id === a.id)).toBe(false);
});

it('P8 an actor retired earlier in the same scheduler block never takes a native turn', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'ally', at: { x: 12, y: 10 } });
  const b = g.monsters.slice(-1)[0]!;
  a.ticksUntilTurn = b.ticksUntilTurn = 100;
  vi.spyOn(a, 'takeNativeDecision').mockImplementation(() => {
    beginDeparture(g, b.id, { owner: 'fgfixture', reason: 'same block', visibleGraceTicks: 0 });
    a.ticksUntilTurn = 100;
  });
  const turn = vi.spyOn(b, 'takeNativeDecision');
  h.command('wait');
  expect(g.monsters).not.toContain(b);
  expect(b.hp).toBeGreaterThan(0);
  expect(turn).not.toHaveBeenCalled();
});

it.each(['glyph', 'color', 'maxStack', 'tags'])(
  'P9 mismatched knowledge-group %s is rejected at installation',
  (key) => {
    const bad = {
      ...descriptor,
      create: () => {
        const m = descriptor.create(),
          p = structuredClone(definitions);
        (p.edibleItems![3] as any)[key] = (
          { glyph: '!', color: '#112233', maxStack: 19, tags: [] } as any
        )[key];
        m.worldDefinitions = p;
        return m;
      }
    };
    expect(() => forage([], [bad])).toThrow(/C5_BAD_DEFINITION/);
  }
);

it('P10 DF failures preserve the original error without calling spawnSettled', () => {
  const h = forage(),
    g = h.game(),
    original = Error('original DF error');
  const settled = vi.fn(() => {
    throw Error('secondary drain error');
  });
  expect(() =>
    spawnDungeonFeature(g.grid, 12, 10, catalogFeature(DF.DF_EXPLOSION_FIRE), false, {
      effects: {
        refreshCell: () => {
          throw original;
        },
        spawnSettled: settled
      }
    })
  ).toThrow(original);
  expect(settled).not.toHaveBeenCalled();
});

it('P10 starvation damage wakes slumber and still bypasses shield', () => {
  const h = forage(),
    g = h.game();
  g.player.nutrition = 0;
  h.fixture({ kind: 'status', actorId: g.player.id, status: 'slumber', turns: 20 });
  g.player.setStatusDuration('shielded', 100);
  const hp = g.player.hp;
  expect(g.player.recoverPerTurn()).toBe('starving');
  expect(g.player.hp).toBe(hp - 1);
  expect(g.player.getStatusDuration('shielded')).toBe(100);
  expect(g.player.hasStatus('slumber')).toBe(false);
});

it('P10 overfeed confirmation has its own risk type and survives replay', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'food' });
  const confirm = vi.spyOn(g as any, 'requestConfirm');
  const c = read(h),
    item = c.inventory.find((i) => i.nativeFood)!;
  h.ext(
    'fgfixture',
    'feed',
    {
      targetId: a.id,
      targetRevision: c.feedTargets[0]!.targetRevision,
      itemId: item.itemId,
      inventoryStamp: c.inventoryStamp
    },
    [false]
  );
  expect(confirm.mock.calls[0]![1]).toMatchObject({
    kind: 'edible-overfeed',
    target: { kind: 'creature', id: a.id }
  });
  expect(g.recordedInputEvents.slice(-1)[0]!.decisions).toEqual([false]);
  closedLoop(h);
});

it('P10 a single deferred settlement emits every crossed band in chronological order', () => {
  const h = forage();
  ally(h);
  h.fixture({ kind: 'advance', ticks: 600, deferred: true });
  expect(
    history(h)
      .filter((f) => f.kind === 'band')
      .map((f) => [f.previousBand, f.band, f.crossedAtTick, f.deferred])
  ).toEqual([
    ['full', 'low', 300, true],
    ['low', 'empty', 500, true]
  ]);
  closedLoop(h);
});

it.each(['web', 'vomit'] as const)(
  'P1 %s spends exactly one interrupted attempt',
  (interruption) => {
    const h = forage(),
      g = h.game(),
      a = ally(h);
    h.fixture({ kind: 'departure', actorId: a.id, grace: 1000 });
    const at = { ...a.loc };
    if (interruption === 'web') {
      g.grid.setTerrain(a.x, a.y, TerrainType.WEB);
      a.setStatusDuration('stuck', 4);
      g.departureTurn(a);
      expect(a.getStatusDuration('stuck')).toBe(3);
    } else {
      a.setStatusDuration('nauseous', 4);
      const vomit = vi.spyOn(g, 'tryVomit').mockReturnValue(true);
      g.departureTurn(a);
      expect(vomit).toHaveBeenCalledTimes(1);
    }
    expect(a.loc).toEqual(at);
    expect(a.ticksUntilTurn).toBe(a.movementSpeed);
  }
);

it('P2 a failed requalification follows false semantics without interrupting the trigger', () => {
  let fail = false;
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create(),
        native = m.actorNeedParticipant!.qualifies;
      m.actorNeedParticipant!.qualifies = (...args) => {
        if (fail) throw Error('requalification');
        return native(...args);
      };
      return m;
    }
  };
  const h = forage([], [bad]),
    g = h.game(),
    a = ally(h);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds!.rows).toHaveLength(1);
  fail = true;
  expect(h.fixture({ kind: 'trigger', actorId: a.id }).error).toBeNull();
  expect(a.isAlly).toBe(true);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds).toBeUndefined();
  expect(history(h).slice(-1)[0]).toMatchObject({ kind: 'detached', reason: 'ineligible' });
  expect(g.extensionRuntime!.readEdibleDiagnostics()).toContainEqual({
    owner: 'fgfixture',
    method: 'qualifies'
  });
});

it('P3 actual stairs transition, countdown arrival and overdue events survive replay/seek', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'stairs' });
  h.command('stairs_down');
  expect(g.depth).toBe(2);
  expect(g.monsters).not.toContain(a);
  expect(a.entersLevelIn).toBeGreaterThan(0);
  h.fixture({ kind: 'advance', ticks: 100 }); // prime the cache while in transit
  for (let n = 0; n < 4 && !g.monsters.includes(a); n++) h.command('wait');
  expect(g.monsters).toContain(a);
  h.fixture({ kind: 'advance', ticks: 600 });
  expect(
    history(h)
      .filter((f) => f.kind === 'band')
      .map((f) => [f.band, f.crossedAtTick])
  ).toEqual([
    ['low', 300],
    ['empty', 500]
  ]);
  expect(history(h).filter((f) => f.kind === 'deadline')).toHaveLength(1);
  closedLoop(h);
});

it('P4 resurrection needs and P8 fall retirement both survive save/replay/seek', () => {
  const h = forage(),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'damage', actorId: a.id, amount: 10000 });
  h.command('wait');
  h.fixture({ kind: 'resurrect' });
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds!.rows[0]).toMatchObject({
    actorId: a.id,
    value: 50
  });
  closedLoop(h);
  h.fixture({ kind: 'ally', at: { x: 12, y: 10 }, hp: 100 });
  const b = g.monsters.slice(-1)[0]!;
  h.fixture({ kind: 'departure', actorId: b.id, grace: 1000 });
  h.fixture({ kind: 'fall', actorId: b.id });
  expect(g.extensionRuntime!.snapshot().foundation.departures!.active).toEqual([]);
  expect(g.toSnapshot().entityGraph.monsters.some((m) => m.id === b.id)).toBe(false);
  closedLoop(h);
});

it.each(['glyph', 'color'] as const)('P9 node %s cannot disclose kind identity either', (key) => {
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create(),
        p = structuredClone(definitions);
      p.resourceNodes[1]![key] = key === 'glyph' ? '!' : '#112233';
      m.worldDefinitions = p;
      return m;
    }
  };
  expect(() => forage([], [bad])).toThrow(/C5_BAD_DEFINITION/);
});

it('P10 a failing intermediate band callback cannot suppress later mechanical crossings', () => {
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create(),
        native = m.actorNeedParticipant!.onNeedEvent!;
      m.actorNeedParticipant!.onNeedEvent = (f, tx) => {
        if (f.kind === 'band' && f.band === 'low') throw Error('intermediate band');
        native(f, tx);
      };
      return m;
    }
  };
  const h = forage([], [bad]),
    g = h.game();
  ally(h);
  h.fixture({ kind: 'advance', ticks: 600, deferred: true });
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds!.rows[0]).toMatchObject({
    band: 'empty',
    value: 0,
    revision: 3
  });
  expect(history(h).filter((f) => f.kind === 'band')).toEqual([
    expect.objectContaining({ band: 'empty', previousBand: 'low', crossedAtTick: 500 })
  ]);
  expect(g.extensionRuntime!.readEdibleDiagnostics()).toHaveLength(1);
  h.fixture({ kind: 'advance', ticks: 1 });
  expect(g.extensionRuntime!.readEdibleDiagnostics()).toHaveLength(1);
  closedLoop(h);
});

it('P10 departure requested at an intermediate band stops later scheduling exactly once', () => {
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create(),
        native = m.actorNeedParticipant!.onNeedEvent!;
      m.actorNeedParticipant!.onNeedEvent = (f, tx) => {
        native(f, tx);
        if (f.kind === 'band' && f.band === 'low') tx.depart(f.actorId);
      };
      return m;
    }
  };
  const h = forage([], [bad]),
    g = h.game();
  ally(h);
  h.fixture({ kind: 'advance', ticks: 800, deferred: true });
  expect(history(h).filter((f) => f.kind === 'band')).toEqual([
    expect.objectContaining({ band: 'low', crossedAtTick: 300 })
  ]);
  expect(history(h).filter((f) => f.kind === 'deadline')).toEqual([]);
  expect(g.extensionRuntime!.snapshot().foundation.departures!.active).toHaveLength(1);
  closedLoop(h);
});

it('P10 same-settlement band and deadline revisions never rewind', () => {
  const h = forage(),
    g = h.game();
  ally(h);
  h.fixture({ kind: 'advance', ticks: 700 });
  expect(
    history(h)
      .filter((f) => f.kind === 'band' || f.kind === 'deadline')
      .map((f) => [f.kind, f.band, f.crossedAtTick, f.value])
  ).toEqual([
    ['band', 'low', 300, 20],
    ['band', 'empty', 500, 0],
    ['deadline', 'empty', 700, 0]
  ]);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds!.rows[0]).toMatchObject({
    revision: 5,
    deadlineFired: true
  });
  closedLoop(h);
});

it('P10 immediate retirement at an intermediate band stops every later callback', () => {
  const bad = {
    ...descriptor,
    create: () => {
      const m = descriptor.create(),
        native = m.actorNeedParticipant!.onNeedEvent!;
      m.actorNeedParticipant!.onNeedEvent = (f, tx) => {
        native(f, tx);
        if (f.kind === 'band' && f.band === 'low') tx.depart(f.actorId);
      };
      return m;
    }
  };
  const h = forage([], [bad]),
    g = h.game(),
    a = ally(h);
  h.fixture({ kind: 'relocate', actorId: a.id, at: { x: 65, y: 25 } });
  h.fixture({ kind: 'advance', ticks: 800, deferred: true });
  expect(history(h).filter((f) => f.kind === 'band')).toEqual([
    expect.objectContaining({ band: 'low', crossedAtTick: 300 })
  ]);
  expect(history(h).filter((f) => f.kind === 'deadline')).toEqual([]);
  expect(g.monsters).not.toContain(a);
  expect(g.extensionRuntime!.snapshot().foundation.actorNeeds).toBeUndefined();
  expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts).toHaveLength(1);
  expect(g.extensionRuntime!.readEdibleDiagnostics()).toEqual([]);
  closedLoop(h);
});

it('P1 real body departure preserves formation and rejects hazards for every part', () => {
  const h = forage(['combat', 'giants']),
    g = h.game();
  for (let y = 4; y <= 24; y++)
    for (let x = 4; x <= 30; x++) g.grid.setTerrain(x, y, TerrainType.FLOOR);
  h.fixture({ kind: 'group', at: { x: 17, y: 14 } });
  const group = g.bodyGroups![0]!,
    core = g.monsters.find((m) => m.id === group.coreId)!;
  h.fixture({ kind: 'departure', actorId: core.id, grace: 1000 });
  const members = [...g.monsters],
    before = members.map((m) => ({ id: m.id, hp: m.hp, at: { ...m.loc } }));
  const target = { x: core.x + 1, y: core.y };
  g.grid.setTerrain(target.x, target.y, TerrainType.LAVA);
  expect(g.moveDepartingActor(core, target)).toBe(false);
  expect(members.map((m) => ({ id: m.id, hp: m.hp, at: { ...m.loc } }))).toEqual(before);
  g.grid.setTerrain(target.x, target.y, TerrainType.FLOOR);
  expect(g.moveDepartingActor(core, target)).toBe(true);
  expect(core.loc).toEqual(target);
  expect(members.map((m) => m.hp)).toEqual(before.map((m) => m.hp));
  expect(g.bodyGroups![0]!.groupId).toBe(group.groupId);
});
