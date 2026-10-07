import { describe, expect, it } from 'vitest';
import type { ModuleDescriptor } from '../../../descriptor';
import { FOUNDATION_PROTOCOL } from '../../../descriptor';
import type { Json } from '../../../types';
import type { NeedEventFact } from '../../../edibleSdk';
import type { WorldHarness } from '../../../worldSdk';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { nativeStat } from '../../../../engine/Stats/NativeStatSources';
import { TerrainType } from '../../../../engine/Map/Grid';
import { descriptor } from '../descriptor';
import {
  addAlly,
  addFood,
  edible,
  feed,
  game,
  makeHarness,
  mechanics,
  messages,
  scene,
  saveContinue,
  state,
  waitTurns
} from './mechanicsHelpers';

const nonEaters = [
  'arrow_turret',
  'bloat',
  'dart_turret',
  'explosive_bloat',
  'flame_turret',
  'flamedancer',
  'golem',
  'ifrit',
  'lich',
  'mangrove_dryad',
  'phantom',
  'phoenix',
  'pit_bloat',
  'revenant',
  'sentinel',
  'spark_turret',
  'vampire',
  'wisp',
  'wraith',
  'zombie'
];
function needs(h: WorldHarness) {
  return game(h).extensionRuntime!.snapshot().foundation.actorNeeds?.rows ?? [];
}
function component(h: WorldHarness, id: number) {
  return game(h).extensionRuntime!.snapshot().components[String(id)]?.['foraging:hunger'];
}
function observeNeeds() {
  const facts: NeedEventFact[] = [];
  const override: ModuleDescriptor = {
    ...descriptor,
    create: () => {
      const m = descriptor.create(),
        participant = m.actorNeedParticipant!;
      return {
        ...m,
        actorNeedParticipant: {
          qualifies: participant.qualifies,
          onNeedEvent(f, tx) {
            facts.push(structuredClone(f));
            participant.onNeedEvent?.(f, tx);
          }
        }
      };
    }
  };
  return { facts, override };
}
/** Load a valid starvation scene; deadline and departure still run exclusively through public waits. */
function starving(h: WorldHarness, ally: Monster): Monster {
  const g = game(h),
    snapshot = g.toSnapshot(),
    row = snapshot.extensions!.foundation.actorNeeds!.rows.find((r) => r.actorId === ally.id)!;
  Object.assign(row, {
    value: 0,
    band: 'starving',
    remainderTicks: 0,
    lastSettledTick: snapshot.run.world5!.simulationTicks,
    zeroSinceTick: snapshot.run.world5!.simulationTicks,
    deadlineFired: false
  });
  snapshot.extensions!.components[String(ally.id)]!['foraging:hunger'] = { band: 'starving' };
  expect(g.loadSnapshot(snapshot)).toBe(true);
  g.animationEnabled = false;
  return g.monsters.find((m) => m.id === ally.id)!;
}

describe('T-COMP eligibility and shared actor needs', () => {
  it('attaches an ordinary ally at exactly 1800, only while foraging is enabled', () => {
    const h = makeHarness();
    scene(h);
    const ally = addAlly(h);
    expect(needs(h)).toEqual([
      expect.objectContaining({
        actorId: ally.id,
        needId: 'foraging.companion-satiety',
        value: 1800,
        band: 'fed',
        remainderTicks: 0,
        zeroSinceTick: null,
        deadlineFired: false,
        revision: 1
      })
    ]);
    expect(component(h, ally.id)).toEqual({ band: 'fed' });
    const plain = makeHarness(51020001, ['crafting']);
    scene(plain);
    addAlly(plain);
    expect(needs(plain)).toEqual([]);
  });

  it.each(nonEaters)('excludes the fixed nonEater template %s', (id) => {
    const h = makeHarness();
    scene(h);
    const ally = addAlly(h, id);
    expect(ally.isAlly).toBe(true);
    expect(needs(h)).toEqual([]);
    expect(component(h, ally.id)).toBeUndefined();
  });

  it.each(['inanimate', 'timed-summon'] as const)(
    'excludes %s independently of the template list',
    (kind) => {
      const h = makeHarness();
      const g = scene(h);
      const source = monsters.find((m) =>
        kind === 'inanimate'
          ? (m.behaviorFlags as readonly string[]).includes('MONST_INANIMATE')
          : m.id === 'goblin'
      ) as MonsterData;
      const ally = new Monster(11, 10, source);
      ally.ticksUntilTurn = 1_000_000;
      if (kind === 'timed-summon') ally.setStatusDuration('lifespan_remaining', 100);
      g.monsters.push(ally);
      g.extensionRuntime!.attachCreature(ally);
      g.becomeAllyWith(ally);
      expect(
        kind === 'inanimate'
          ? ally.hasBehavior('MONST_INANIMATE')
          : ally.hasStatus('lifespan_remaining')
      ).toBe(true);
      expect(needs(h)).toEqual([]);
    }
  );

  it.each([true, false] as const)(
    'resident fixture resident=%s is consumed through the optional query contract',
    (resident) => {
      const queried: Json[] = [];
      const fixture: ModuleDescriptor = {
        id: 'residentfixture',
        version: '1.0.0',
        foundation: FOUNDATION_PROTOCOL,
        labelKey: 'ext.residentfixture.name',
        create: () => ({
          id: 'residentfixture',
          version: '1.0.0',
          initialState: () => ({}),
          validateState: (v): v is Json => !!v && typeof v === 'object',
          optionalQueries: {
            'settlement.resident-status.v1': {
              accepts: (input) =>
                !!input &&
                typeof input === 'object' &&
                !Array.isArray(input) &&
                Object.keys(input).join(',') === 'actorId',
              query: (input) => {
                queried.push(structuredClone(input) as Json);
                return { resident };
              },
              validate: (v): v is Json => !!v && typeof v === 'object'
            }
          }
        }),
        locales: { zh_CN: { 'ext.residentfixture.name': '居民测试' } }
      };
      const h = makeHarness(51020001, ['foraging', 'residentfixture'], [fixture]);
      scene(h);
      const ally = addAlly(h);
      expect(queried).toContainEqual({ actorId: ally.id });
      expect(needs(h).map((r) => r.actorId)).toEqual(resident ? [] : [ally.id]);
    }
  );

  it('detaches the need and hunger component when the actor loses alliance', () => {
    const h = makeHarness();
    scene(h);
    const ally = addAlly(h);
    ally.isAlly = false;
    ally.extensionHooks?.relationshipChanged?.(ally);
    expect(needs(h)).toEqual([]);
    expect(component(h, ally.id)).toBeUndefined();
    expect(state(h).history.slice(-1)[0]).toMatchObject({ kind: 'need', result: 'detached' });
    expect(state(h).totals.departed).toBe(0);
  });

  it('gives a real giants group only one core need and retires every member together', () => {
    const h = makeHarness(51020001, ['foraging', 'giants']);
    const g = scene(h);
    const body = g.extensionRuntime!.edibleModule('giants')!.nativeBodies!.definitions[0]!;
    const core = g.createCompositeMonster(body.id, { x: 13, y: 12 });
    expect(core).not.toBeNull();
    g.becomeAllyWith(core!);
    const group = g.bodyGroups![0]!,
      ids = group.members.flatMap((m) => (m.entityId === null ? [] : [m.entityId]));
    expect(ids.length).toBeGreaterThan(1);
    expect(needs(h).map((r) => r.actorId)).toEqual([group.coreId]);
    for (const m of g.monsters) m.ticksUntilTurn = 1_000_000;
    starving(h, core!);
    waitTurns(h, 320);
    expect(g.monsters.some((m) => ids.includes(m.id))).toBe(false);
    expect(g.bodyGroups).toBeUndefined();
    expect(needs(h)).toEqual([]);
    expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts).toHaveLength(1);
    expect(
      ids.every((id) => g.extensionRuntime!.snapshot().foundation.deaths[String(id)] === undefined)
    ).toBe(true);
  });
});

describe('T-COMP exact hunger and non-lethal departure', () => {
  it.each(['departing', 'retired'] as const)(
    '%s save/load preserves the deadline, receipt and exact public-command continuation',
    (phase) => {
      const h = makeHarness();
      scene(h);
      const ally = starving(h, addAlly(h)),
        id = ally.id;
      waitTurns(h, phase === 'departing' ? 300 : 320);
      const before = game(h).extensionRuntime!.snapshot().foundation.departures!;
      expect(before.active.map((row) => row.actorId)).toEqual(phase === 'departing' ? [id] : []);
      expect(before.receipts).toHaveLength(phase === 'departing' ? 0 : 1);
      saveContinue(h, () => waitTurns(h, phase === 'departing' ? 20 : 2));
      const g = game(h),
        after = g.extensionRuntime!.snapshot().foundation.departures!;
      expect(g.monsters.some((m) => m.id === id)).toBe(false);
      expect(after.active).toEqual([]);
      expect(after.receipts).toEqual([
        expect.objectContaining({ actorId: id, owner: 'foraging', tick: 32000, result: 'retired' })
      ]);
      expect(state(h).totals.departed).toBe(1);
      expect(needs(h)).toEqual([]);
      expect(g.extensionRuntime!.snapshot().foundation.deaths[String(id)]).toBeUndefined();
    }
  );

  it('runs 1800 → hungry → weak → starving at exactly 200 ticks per point, with shared stat penalties', () => {
    const observed = observeNeeds(),
      h = makeHarness(51020001, ['foraging'], [observed.override]);
    const g = scene(h),
      ally = addAlly(h),
      hp = ally.hp,
      accuracy = nativeStat(ally, 'native.accuracy');
    // Player endurance is scene setup; no companion food, clock or needs are altered.
    g.player.hp = g.player.maxHp = 10000;
    g.player.nutrition = 2150;
    waitTurns(h, 2999);
    expect(g.world5!.simulationTicks).toBe(299900);
    expect(edible(h).feedTargets[0]).toMatchObject({ value: 301, band: 'fed' });
    h.command('wait');
    expect(edible(h).feedTargets[0]).toMatchObject({ value: 300, band: 'hungry' });
    expect(nativeStat(ally, 'native.accuracy')).toBe(accuracy);
    waitTurns(h, 299);
    expect(edible(h).feedTargets[0]).toMatchObject({ value: 151, band: 'hungry' });
    h.command('wait');
    expect(edible(h).feedTargets[0]).toMatchObject({ value: 150, band: 'weak' });
    expect(nativeStat(ally, 'native.accuracy')).toBe(Math.floor(accuracy * 0.8));
    expect(nativeStat(ally, 'native.physical-damage-dealt', { baseValue: 100 })).toBe(75);
    expect(ally.weaknessAmount).toBe(0);
    waitTurns(h, 299);
    expect(edible(h).feedTargets[0]!.value).toBe(1);
    h.command('wait');
    expect(edible(h).feedTargets[0]).toMatchObject({ value: 0, band: 'starving' });
    expect(nativeStat(ally, 'native.accuracy')).toBe(Math.floor(accuracy * 0.6));
    expect(nativeStat(ally, 'native.physical-damage-dealt', { baseValue: 100 })).toBe(50);
    expect(
      observed.facts.filter((f) => f.kind === 'band').map((f) => [f.band, f.crossedAtTick, f.value])
    ).toEqual([
      ['hungry', 300000, 300],
      ['weak', 330000, 150],
      ['starving', 360000, 0]
    ]);
    expect(needs(h)[0]!.zeroSinceTick).toBe(360000);
    expect(ally.hp).toBe(hp);
    expect(ally.weaknessAmount).toBe(0);
    expect(state(h).totals.fed).toBe(0);
  }, 120000);

  it('retires an unseen starving companion at 30000 ticks, drops carried items, and never creates a death or XP fact', () => {
    const h = makeHarness();
    scene(h);
    const ally = starving(h, addAlly(h)),
      g = game(h),
      hp = ally.hp;
    const item = addFood(h, 'char');
    g.player.inventory.removeItem(item);
    ally.carriedItem = item;
    ally.loc = { x: 65, y: 25 };
    g.grid.setTerrain(65, 25, TerrainType.FLOOR);
    g.grid.getCell(65, 25)!.isVisible = false;
    const deaths = g.extensionRuntime!.snapshot().foundation.deaths;
    waitTurns(h, 299);
    expect(g.monsters).toContain(ally);
    h.command('wait');
    expect(g.world5!.simulationTicks).toBe(30000);
    expect(g.monsters).not.toContain(ally);
    expect(g.purgatory).not.toContain(ally);
    expect(ally.hp).toBe(hp);
    expect(ally.carriedItem).toBeNull();
    expect(g.items).toContain(item);
    expect(g.extensionRuntime!.snapshot().foundation.deaths).toEqual(deaths);
    expect(needs(h)).toEqual([]);
    expect(state(h).totals.departed).toBe(1);
    expect(messages()).toContain(`${ally.name}饿得受不了，离开了队伍。`);
    expect(g.extensionRuntime!.snapshot().foundation.departures!.receipts[0]).toMatchObject({
      actorId: ally.id,
      tick: 30000,
      result: 'retired'
    });
  });

  it('keeps visible departure non-hostile for at most 20 turns, blocks feeding, and does not attack', () => {
    const h = makeHarness();
    scene(h);
    const ally = starving(h, addAlly(h)),
      g = game(h);
    const food = addFood(h, 'mend'),
      hp = ally.hp,
      playerHp = g.player.hp;
    waitTurns(h, 300);
    expect(edible(h).feedTargets[0]).toMatchObject({ departing: true, band: 'starving' });
    expect(ally.isAlly).toBe(true);
    expect(ally.hp).toBe(hp);
    const before = mechanics(h);
    expect(feed(h, ally, food).error).toBe('C5_GATE');
    expect(mechanics(h)).toEqual(before);
    const enemy = new Monster(11, 11, monsters.find((m) => m.id === 'rat') as MonsterData);
    enemy.ticksUntilTurn = 1_000_000;
    g.monsters.push(enemy);
    g.extensionRuntime!.attachCreature(enemy);
    const enemyHp = enemy.hp;
    ally.ticksUntilTurn = 0;
    for (let n = 0; n < 20 && g.monsters.includes(ally); n++) h.command('wait');
    expect(g.monsters).not.toContain(ally);
    expect(g.world5!.simulationTicks).toBeLessThanOrEqual(32000);
    expect(g.player.hp).toBe(playerHp);
    expect(ally.hp).toBe(hp);
    expect(enemy.hp).toBe(enemyHp);
    expect(g.extensionRuntime!.snapshot().foundation.deaths[String(ally.id)]).toBeUndefined();
    expect(state(h).totals.departed).toBe(1);
  });

  it('feeding before the deadline clears zeroSinceTick and prevents the old deadline from firing', () => {
    const h = makeHarness();
    scene(h);
    const ally = starving(h, addAlly(h)),
      g = game(h);
    waitTurns(h, 299);
    const food = addFood(h, 'mend');
    expect(feed(h, ally, food).error).toBeNull();
    expect(needs(h)[0]).toMatchObject({
      zeroSinceTick: null,
      deadlineFired: false,
      band: 'hungry'
    });
    h.command('wait');
    expect(g.monsters).toContain(ally);
    expect(edible(h).feedTargets[0]!.departing).toBe(false);
    expect(state(h).totals.departed).toBe(0);
  });

  it('leaving the level retires a visible departing actor with the deferred named message', () => {
    const h = makeHarness();
    scene(h);
    const ally = starving(h, addAlly(h)),
      g = game(h);
    waitTurns(h, 300);
    expect(edible(h).feedTargets[0]!.departing).toBe(true);
    g.grid.setTerrain(g.player.x, g.player.y, TerrainType.STAIRS_DOWN);
    h.command('stairs_down');
    expect(g.depth).toBe(2);
    expect(g.monsters).not.toContain(ally);
    expect(state(h).totals.departed).toBe(1);
    expect(messages()).toContain(`${ally.name}在你离开时离队了。`);
    expect(g.extensionRuntime!.snapshot().foundation.deaths[String(ally.id)]).toBeUndefined();
    g.grid.setTerrain(g.player.x, g.player.y, TerrainType.STAIRS_UP);
    h.command('stairs_up');
    expect(g.depth).toBe(1);
    expect(g.monsters.some((m) => m.id === ally.id)).toBe(false);
    expect(needs(h)).toEqual([]);
  });

  it('materializes an overdue off-level need on return and marks its deadline deferred', () => {
    const observed = observeNeeds(),
      h = makeHarness(51020001, ['foraging'], [observed.override]);
    scene(h);
    const ally = starving(h, addAlly(h)),
      g = game(h);
    ally.setStatusDuration('slumber', 1000);
    g.grid.setTerrain(g.player.x, g.player.y, TerrainType.STAIRS_DOWN);
    h.command('stairs_down');
    expect(g.depth).toBe(2);
    expect(g.monsters).not.toContain(ally);
    scene(h);
    waitTurns(h, 300);
    expect(observed.facts.filter((f) => f.kind === 'deadline')).toEqual([]);
    g.grid.setTerrain(g.player.x, g.player.y, TerrainType.STAIRS_UP);
    h.command('stairs_up');
    expect(g.depth).toBe(1);
    expect(observed.facts.filter((f) => f.kind === 'deadline')).toEqual([
      expect.objectContaining({ actorId: ally.id, deferred: true, crossedAtTick: 30000 })
    ]);
    expect(g.extensionRuntime!.snapshot().foundation.deaths[String(ally.id)]).toBeUndefined();
  });

  it('a revived companion is the same actor with a fresh 1800 need', () => {
    const h = makeHarness();
    scene(h);
    const ally = starving(h, addAlly(h)),
      g = game(h);
    ally.takeDamage(10000);
    h.command('wait');
    expect(g.purgatory).toContain(ally);
    expect(needs(h)).toEqual([]);
    expect(g.resurrectAlly({ x: 11, y: 10 })).toBe(true);
    expect(g.monsters).toContain(ally);
    expect(ally.hp).toBeGreaterThan(0);
    expect(needs(h)).toEqual([
      expect.objectContaining({
        actorId: ally.id,
        value: 1800,
        band: 'fed',
        revision: 1,
        zeroSinceTick: null,
        deadlineFired: false
      })
    ]);
    expect(component(h, ally.id)).toEqual({ band: 'fed' });
  });
});
