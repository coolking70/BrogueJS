import { describe, expect, it } from 'vitest';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { TerrainType } from '../../../../engine/Map/Grid';
import { nativeStat } from '../../../../engine/Stats/NativeStatSources';
import type { Monster } from '../../../../entities/Monster';
import type { WorldHarness } from '../../../worldSdk';
import {
  addAlly,
  addFood,
  edible,
  feed,
  game,
  knowledgeState,
  makeHarness,
  mechanics,
  observeFacts,
  scene,
  state,
  roastChoice
} from './mechanicsHelpers';

/** Initial scene only: load a valid low-satiety save, then use the public feed command. */
function hungry(h: WorldHarness, ally: Monster, value = 100): Monster {
  const g = game(h),
    snapshot = g.toSnapshot(),
    row = snapshot.extensions!.foundation.actorNeeds!.rows.find((r) => r.actorId === ally.id)!;
  const band = value === 0 ? 'starving' : value <= 150 ? 'weak' : value <= 300 ? 'hungry' : 'fed';
  Object.assign(row, {
    value,
    band,
    remainderTicks: 0,
    lastSettledTick: snapshot.run.world5!.simulationTicks,
    zeroSinceTick: value === 0 ? snapshot.run.world5!.simulationTicks : null,
    deadlineFired: false
  });
  snapshot.extensions!.components[String(ally.id)]!['foraging:hunger'] = { band };
  expect(g.loadSnapshot(snapshot)).toBe(true);
  g.animationEnabled = false;
  return g.monsters.find((m) => m.id === ally.id)!;
}
function request(h: WorldHarness, ally: Monster, itemId: number) {
  const c = edible(h);
  return {
    v: 1,
    targetId: ally.id,
    targetRevision: c.feedTargets.find((t) => t.actorId === ally.id)!.targetRevision,
    itemId,
    inventoryStamp: c.inventoryStamp
  };
}

const cases = [
  ['mend', 200, 'known', null],
  ['venom', 300, 'known', 'poisoned'],
  ['prism', 350, 'tasted', null],
  ['astray', 300, 'known', 'confused'],
  ['upheave', 300, 'known', 'nauseous'],
  ['farsense', 200, 'tasted', null],
  ['veil', 250, 'tasted', null],
  ['drowse', 400, 'known', 'slumber'],
  ['blast', 150, 'tasted', null],
  ['might', 250, 'known', null],
  ['stiffen', 250, 'known', 'paralyzed'],
  ['quicken', 150, 'known', 'hasted']
] as const;

describe('T-FEED real public feeding', () => {
  it.each([
    ['ration_of_food', 1800],
    ['mango', 1550]
  ] as const)('%s gives its exact native nutrition to the companion', (id, nutrition) => {
    const facts = observeFacts(),
      h = makeHarness(51020001, ['foraging'], [facts.override]);
    scene(h);
    const ally = hungry(h, addAlly(h)),
      g = game(h);
    const granted = ItemLoader.spawnFood(id, g.player.x, g.player.y)!;
    expect(g.player.inventory.addItem(granted)).toBe(true);
    const food = g.player.inventory.items.find((i) => i.consumableId === id)!,
      quantity = food.quantity;
    const before = g.toSnapshot().run.currentTick,
      playerNutrition = g.player.nutrition;
    expect(feed(h, ally, food).error).toBeNull();
    expect(facts.consumed).toHaveLength(1);
    expect(facts.consumed[0]).toMatchObject({
      operation: 'feed',
      eaterId: ally.id,
      feederId: g.player.id,
      definitionId: null,
      nativeFood: id,
      outcome: { satietyGained: nutrition, satietyLost: 0 }
    });
    expect(edible(h).feedTargets[0]!.value).toBe(100 + nutrition);
    expect(g.player.nutrition).toBeLessThanOrEqual(playerNutrition);
    expect(g.toSnapshot().run.currentTick - before).toBe(100);
    expect(g.player.inventory.items.find((i) => i.id === food.id)?.quantity ?? 0).toBe(
      quantity - 1
    );
    expect(state(h).totals).toMatchObject({ fed: 1, eaten: 0, revealed: 0 });
    expect(state(h).history.slice(-1)[0]).toMatchObject({ kind: 'feed', result: 'food' });
  });

  it.each(cases)(
    '%s applies only to the fed companion, with exact satiety and knowledge',
    (kind, satiety, knowledge, status) => {
      const facts = observeFacts(),
        h = makeHarness(51020001, ['foraging'], [facts.override]);
      scene(h);
      const ally = hungry(h, addAlly(h)),
        g = game(h);
      ally.hp = kind === 'mend' ? 5 : ally.maxHp;
      const food = addFood(h, kind, 2),
        playerHp = g.player.hp;
      expect(feed(h, ally, food).error).toBeNull();
      expect(facts.consumed).toHaveLength(1);
      const fact = facts.consumed[0]!;
      expect(fact).toMatchObject({
        definitionId: `foraging.${kind}`,
        operation: 'feed',
        eaterId: ally.id,
        feederId: g.player.id,
        visibleToPlayer: true,
        outcome: { satietyGained: satiety }
      });
      expect(edible(h).feedTargets[0]!.value).toBe(kind === 'upheave' ? 150 : 100 + satiety);
      expect(knowledgeState(g, `foraging.${kind}`)).toBe(knowledge);
      expect(food.quantity).toBe(1);
      expect(state(h).totals).toMatchObject({
        fed: 1,
        eaten: 0,
        revealed: knowledge === 'known' ? 1 : 0
      });
      expect(g.player.hp).toBe(playerHp);
      if (status) {
        expect(ally.hasStatus(status)).toBe(true);
        expect(g.player.hasStatus(status)).toBe(false);
        expect(fact.outcome).toMatchObject({ applied: true, newlyStarted: true });
      }
      if (kind === 'mend') {
        expect(fact.resolvedIntent).toEqual({ kind: 'heal-fraction', percent: 30, min: 5 });
        expect(fact.outcome.hpGained).toBe(5);
        expect(ally.hp).toBe(10);
      }
      if (kind === 'upheave') expect(fact.outcome.satietyLost).toBe(250);
      if (['prism', 'farsense', 'veil'].includes(kind))
        expect(fact.outcome).toMatchObject({ notApplicable: true, applied: false });
      if (kind === 'blast')
        expect(fact.outcome).toMatchObject({ applied: false, notApplicable: false });
      if (kind === 'might') {
        expect(nativeStat(ally, 'native.physical-damage-dealt', { baseValue: 100 })).toBe(125);
        expect(g.extensionRuntime!.snapshot().foundation.timedStats!.rows).toContainEqual({
          actorId: ally.id,
          owner: 'foraging',
          key: 'native.physical-damage-dealt',
          category: 'more',
          value: 2500,
          untilTick: fact.tick + 40000
        });
        expect(nativeStat(g.player, 'native.strength')).toBe(g.player.strength);
      }
    }
  );

  it.each([
    ['minimum', 15, 1, 5],
    ['percent', 101, 1, 30],
    ['cap', 101, 99, 2],
    ['full', 101, 101, 0]
  ] as const)('companion mend %s reports exact immediate HP and gain', (_case, maxHp, hp, gain) => {
    let ally: Monster,
      immediateHp = -1;
    const facts = observeFacts(() => {
        immediateHp = ally.hp;
      }),
      h = makeHarness(51020001, ['foraging'], [facts.override]);
    scene(h);
    ally = addAlly(h);
    ally.maxHp = maxHp;
    ally.hp = hp;
    expect(feed(h, ally, addFood(h, 'mend')).error).toBeNull();
    expect(facts.consumed[0]!.outcome.hpGained).toBe(gain);
    expect(immediateHp).toBe(hp + gain);
  });
  it.each([0, 1] as const)('companion roasted mend policy %i keeps or strips healing', (choice) => {
    const fp = game(makeHarness()).extensionRuntime!.worldDefinitionFingerprints().foraging!;
    let seed = 1;
    while (roastChoice(seed, fp, 0) !== choice) seed++;
    let ally: Monster,
      immediateHp = -1;
    const facts = observeFacts(() => {
        immediateHp = ally.hp;
      }),
      h = makeHarness(seed, ['foraging'], [facts.override]);
    scene(h);
    ally = addAlly(h);
    ally.maxHp = 101;
    ally.hp = 1;
    expect(feed(h, ally, addFood(h, 'mend-roasted')).error).toBeNull();
    expect(facts.consumed[0]!.resolvedIntent).toEqual(
      choice === 0 ? { kind: 'heal-fraction', percent: 30, min: 5 } : { kind: 'none' }
    );
    expect(facts.consumed[0]!.outcome.hpGained).toBe(choice === 0 ? 30 : 0);
    expect(immediateHp).toBe(choice === 0 ? 31 : 1);
  });
  it('full-health mend is tasted, then feeding while injured reveals the same kind', () => {
    const h = makeHarness();
    scene(h);
    const ally = hungry(h, addAlly(h)),
      food = addFood(h, 'mend', 2);
    expect(feed(h, ally, food).error).toBeNull();
    expect(knowledgeState(game(h), 'foraging.mend')).toBe('tasted');
    ally.hp = 1;
    expect(feed(h, ally, food).error).toBeNull();
    expect(knowledgeState(game(h), 'foraging.mend')).toBe('known');
    expect(state(h).totals).toMatchObject({ fed: 2, revealed: 1 });
  });

  it('an immune companion only tastes stiffen and receives its nutrition', () => {
    const facts = observeFacts(),
      h = makeHarness(51020001, ['foraging'], [facts.override]);
    const g = scene(h),
      ally = addAlly(h),
      food = addFood(h, 'stiffen');
    ally.statusImmunities.add('paralyzed');
    expect(feed(h, ally, food, [true])).toEqual({ recorded: true, error: null });
    expect(ally.hasStatus('paralyzed')).toBe(false);
    expect(facts.consumed[0]!.outcome).toMatchObject({
      immune: true,
      applied: false,
      satietyGained: 250
    });
    expect(knowledgeState(g, 'foraging.stiffen')).toBe('tasted');
    expect(state(h).totals).toMatchObject({ fed: 1, revealed: 0 });
  });

  it('char supplies 20 nutrition without creating mushroom knowledge', () => {
    const h = makeHarness();
    scene(h);
    const ally = hungry(h, addAlly(h)),
      food = addFood(h, 'char');
    const before = game(h).extensionRuntime!.snapshot().foundation.kindKnowledge;
    expect(feed(h, ally, food).error).toBeNull();
    expect(edible(h).feedTargets[0]!.value).toBe(120);
    expect(game(h).extensionRuntime!.snapshot().foundation.kindKnowledge).toEqual(before);
    expect(state(h).history.slice(-1)[0]).toMatchObject({ kind: 'feed', result: 'food' });
  });

  it('overfeeding No and Yes record their actual decisions; No has zero cost and Yes saturates at 2150', () => {
    const h = makeHarness();
    const g = scene(h),
      ally = addAlly(h),
      food = ItemLoader.spawnFood('ration_of_food', 10, 10)!;
    expect(g.player.inventory.addItem(food)).toBe(true);
    const item = g.player.inventory.items.find((i) => i.consumableId === 'ration_of_food')!,
      quantity = item.quantity;
    const before = mechanics(h),
      index = g.recordedInputEvents.length;
    expect(feed(h, ally, item, [false])).toEqual({ recorded: true, error: null });
    expect(g.recordedInputEvents).toHaveLength(index + 1);
    expect(g.recordedInputEvents[index]).toMatchObject({
      action: 'ext:command',
      decisions: [false]
    });
    expect(mechanics(h)).toEqual(before);
    expect(item.quantity).toBe(quantity);
    expect(feed(h, ally, item, [true])).toEqual({ recorded: true, error: null });
    expect(g.recordedInputEvents).toHaveLength(index + 2);
    expect(g.recordedInputEvents[index + 1]).toMatchObject({
      action: 'ext:command',
      decisions: [true]
    });
    expect(edible(h).feedTargets[0]!.value).toBe(2150);
    expect(state(h).totals.fed).toBe(1);
    expect(g.toSnapshot().run.currentTick - before.tick).toBe(100);
  });

  it.each([
    'distance',
    'invisible',
    'hostile',
    'slumber',
    'paralyzed',
    'nonfood',
    'revision',
    'stamp',
    'wrong-level'
  ] as const)('%s feed rejection records an attempt with zero mechanical cost', (condition) => {
    const h = makeHarness();
    const g = scene(h),
      ally = addAlly(h),
      food = addFood(h, 'mend');
    const payload = request(h, ally, food.id);
    let expected: string;
    switch (condition) {
      case 'distance':
        ally.loc = { x: 13, y: 10 };
        expected = 'C5_DISTANCE';
        break;
      case 'invisible':
        g.grid.getCell(ally.x, ally.y)!.isVisible = false;
        expected = 'C5_UNKNOWN_TARGET';
        break;
      case 'hostile':
        ally.isAlly = false;
        ally.extensionHooks?.relationshipChanged?.(ally);
        expected = 'C5_UNKNOWN_TARGET';
        break;
      case 'slumber':
      case 'paralyzed':
        ally.setStatusDuration(condition, 100);
        expected = 'C5_GATE';
        break;
      case 'nonfood':
        payload.itemId = g.player.inventory.items.find((i) => i.category !== 4 && !i.worldItem)!.id;
        expected = 'C5_INPUT';
        break;
      case 'revision':
        payload.targetRevision++;
        expected = 'C5_STALE';
        break;
      case 'stamp':
        payload.inventoryStamp += '-stale';
        expected = 'C5_STALE';
        break;
      case 'wrong-level': {
        ally.setStatusDuration('slumber', 100);
        g.grid.setTerrain(g.player.x, g.player.y, TerrainType.STAIRS_DOWN);
        h.command('stairs_down');
        expect(g.depth).toBe(2);
        expect(g.monsters).not.toContain(ally);
        expected = 'C5_WRONG_LEVEL';
        break;
      }
    }
    const before = mechanics(h);
    const index = g.recordedInputEvents.length;
    expect(h.ext('foraging', 'feed', payload)).toEqual({ recorded: true, error: expected });
    expect(g.recordedInputEvents).toHaveLength(index + 1);
    expect(mechanics(h)).toEqual(before);
    expect(g.player.inventory.items).toContain(food);
  });
});
