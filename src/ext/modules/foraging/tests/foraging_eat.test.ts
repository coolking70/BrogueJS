import { describe, expect, it } from 'vitest';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import type { StatusId } from '../../../../entities/Creature';
import { ItemCategory } from '../../../../engine/Items/Item';
import { nativeStat } from '../../../../engine/Stats/NativeStatSources';
import { makeHarness, scene, addFood, eat, state, game, knowledgeState, mechanics, observeFacts, roastChoice, waitTurns } from './mechanicsHelpers';

const cases = [
  ['mend', 200, 'heal-fraction'], ['venom', 300, 'status'], ['prism', 350, 'status'],
  ['astray', 300, 'status'], ['upheave', 300, 'status-and-satiety'], ['farsense', 200, 'status'],
  ['veil', 250, 'status'], ['drowse', 400, 'status'], ['blast', 150, 'explosive'],
  ['might', 250, 'temp-stat'], ['stiffen', 250, 'status'], ['quicken', 150, 'status']
] as const;
describe('foraging T-EAT real native consumption', () => {
  it('synchronously records exactly No then Yes and proves zero cost versus actual consumption', () => {
    const h = makeHarness(), g = scene(h), food = addFood(h, 'venom', 2);
    g.player.nutrition = 1800;
    const before = mechanics(h), n = g.recordedInputEvents.length, letter = food.inventoryLetter;
    const no = eat(h, food, [false]);
    expect(no.cursor).toBe(1); expect(no.events).toHaveLength(1);
    expect(no.events[0]).toMatchObject({ action: 'item:execute', data: `eat|${letter}`, decisions: [false] });
    expect(no.events[0]!.decisions).toStrictEqual([false]);
    expect(mechanics(h)).toEqual(before); expect(food.quantity).toBe(2);
    const yes = eat(h, food, [true]);
    expect(yes.cursor).toBe(1); expect(yes.events).toHaveLength(1);
    expect(yes.events[0]).toMatchObject({ action: 'item:execute', data: `eat|${letter}`, decisions: [true] });
    expect(yes.events[0]!.decisions).toStrictEqual([true]);
    expect(food.quantity).toBe(1); expect(state(h).totals.eaten).toBe(1);
    expect(g.toSnapshot().run.currentTick).toBeGreaterThan(before.tick);
    expect(g.absoluteTurnNumber).toBeGreaterThan(before.turn);
    const exported = JSON.parse(h.exportRecording());
    expect(exported.events[n].decisions).toStrictEqual([false]);
    expect(exported.events[n + 1].decisions).toStrictEqual([true]);
  });
  it.each(cases)('%s applies exactly its unique %s satiety intent through the actual native eat command', (kind, satiety, intent) => {
    let g: ReturnType<typeof scene>; let appliedDurations: Partial<Record<StatusId, number>> = {};
    const observed = observeFacts(() => { appliedDurations = { ...g.player.statusDurations }; }), h = makeHarness(51020001, ['foraging'], [observed.override]); g = scene(h);
    g.player.nutrition = 500; if (kind === 'mend') g.player.hp = 10;
    const food = addFood(h, kind, 2), hp = g.player.hp, max = g.player.maxHp;
    eat(h, food);
    expect(food.quantity).toBe(1); expect(observed.consumed).toHaveLength(1);
    const fact = observed.consumed[0]!;
    expect(fact).toMatchObject({ definitionId: `foraging.${kind}`, operation: 'eat', hpBefore: hp, maxHp: max, resolvedIntent: { kind: intent }, outcome: { intent, immune: false, notApplicable: false, satietyGained: satiety } });
    expect(knowledgeState(g, `foraging.${kind}`)).toBe(kind === 'blast' ? 'tasted' : 'known');
    expect(state(h).totals.eaten).toBe(1); expect(state(h).totals.revealed).toBe(kind === 'blast' ? 0 : 1);
    // Exact heal amount is blocked by SDK double-percent healing; see phase5g.report.
    if (kind === 'upheave') expect(fact.outcome.satietyLost).toBe(300);
    if (kind === 'blast') { expect(fact.outcome.applied).toBe(false); expect(state(h).totals.exploded).toBe(0); }
    if (!['mend', 'blast', 'might'].includes(kind)) expect(fact.outcome.newlyStarted).toBe(true);
    const expectedStatuses: Record<string, readonly [StatusId, number]> = { venom: ['poisoned', 8], prism: ['hallucinating', 100], astray: ['confused', 8], upheave: ['nauseous', 15], farsense: ['telepathy', 150], veil: ['darkness', 200], drowse: ['slumber', 25], stiffen: ['paralyzed', 8], quicken: ['haste', 10] };
    const status = expectedStatuses[kind]; if (status) expect(appliedDurations[status[0]]).toBe(status[1]);
    if (kind === 'drowse') { expect(g.player.hasStatus('slumber')).toBe(false); expect(g.world5!.simulationTicks).toBe(2500); }
    if (kind === 'stiffen') { expect(g.player.hasStatus('paralyzed')).toBe(false); expect(g.world5!.simulationTicks).toBe(800); }

  });
  it('full-health healing is tasted, later injured consumption is known, and knowledge never falls back', () => {
    const h = makeHarness(), g = scene(h), food = addFood(h, 'mend', 3);
    eat(h, food); expect(knowledgeState(g, 'foraging.mend')).toBe('tasted');
    g.player.hp = 1; eat(h, food); expect(knowledgeState(g, 'foraging.mend')).toBe('known');
    g.player.hp = g.player.maxHp; eat(h, food); expect(knowledgeState(g, 'foraging.mend')).toBe('known');
    expect(knowledgeState(g, 'foraging.mend-roasted')).toBe('unknown');
  });
  it.each([['prism', 'hallucinating'], ['veil', 'darkness']] as const)('%s while already affected is tasted', (kind, status) => {
    const h = makeHarness(), g = scene(h), food = addFood(h, kind);
    g.player.setStatusDuration(status, 250); eat(h, food);
    expect(knowledgeState(g, `foraging.${kind}`)).toBe('tasted');
  });
  it('immunity prevents paralysis and leaves the tasted observation without revealing', () => {
    const observed = observeFacts(), h = makeHarness(51020001, ['foraging'], [observed.override]), g = scene(h);
    g.player.statusImmunities.add('paralyzed'); eat(h, addFood(h, 'stiffen'));
    expect(observed.consumed[0]!.outcome).toMatchObject({ immune: true, applied: false, newlyStarted: false });
    expect(g.player.hasStatus('paralyzed')).toBe(false); expect(knowledgeState(g, 'foraging.stiffen')).toBe('tasted');
  });
  it('nausea clamps its immediate satiety loss at 150 before the paid turn', () => {
    const observed = observeFacts(), h = makeHarness(51020001, ['foraging'], [observed.override]), g = scene(h);
    g.player.nutrition = 1; eat(h, addFood(h, 'upheave'));
    expect(observed.consumed[0]!.outcome).toMatchObject({ satietyGained: 300, satietyLost: 151 });
    expect(g.player.nutrition).toBe(149);
  });
  it('temporary strength is exactly +2 for 400 turns and never changes permanent strength', () => {
    const h = makeHarness(), g = scene(h), original = g.player.strength, before = g.world5!.simulationTicks;
    eat(h, addFood(h, 'might'));
    expect(nativeStat(g.player, 'native.strength')).toBe(original + 2);
    expect(g.extensionRuntime!.snapshot().foundation.timedStats!.rows[0]).toMatchObject({ key: 'native.strength', value: 2, untilTick: before + 40000 });
    waitTurns(h, 398); expect(nativeStat(g.player, 'native.strength')).toBe(original + 2);
    waitTurns(h, 1); expect(nativeStat(g.player, 'native.strength')).toBe(original);
    expect(g.player.strength).toBe(original);
  });
  it('actual consumed 25-turn slumber is interrupted by the next real poison-damage tick', () => {
    let g: ReturnType<typeof scene>, applied = 0;
    const observed = observeFacts(() => { applied = g.player.getStatusDuration('slumber'); }), h = makeHarness(51020001, ['foraging'], [observed.override]); g = scene(h);
    g.player.setStatusDuration('poisoned', 8); const hp = g.player.hp, start = g.world5!.simulationTicks;
    eat(h, addFood(h, 'drowse'));
    expect(observed.consumed[0]!.resolvedIntent).toEqual({ kind: 'status', status: 'slumber', turns: 25 }); expect(applied).toBe(25);
    expect(g.player.hp).toBeLessThan(hp); expect(g.player.hasStatus('slumber')).toBe(false);
    expect(g.world5!.simulationTicks - start).toBe(100); expect(knowledgeState(g, 'foraging.drowse')).toBe('known');
  });
  it.each(['none', 'ration_of_food', 'mango'] as const)('automatic starvation eating selects %s and never a material mushroom', nativeFood => {
    const h = makeHarness(), g = scene(h);
    for (const i of [...g.player.inventory.items]) if (i.category === ItemCategory.FOOD) g.player.inventory.removeItem(i);
    const mushroom = addFood(h, 'mend', 2);
    const food = nativeFood === 'none' ? null : ItemLoader.spawnFood(nativeFood, g.player.x, g.player.y)!;
    if (food) g.player.inventory.addItem(food);
    g.player.nutrition = 1; h.command('wait');
    expect(mushroom.quantity).toBe(2); expect(state(h).totals.eaten).toBe(0);
    if (food) { expect(g.player.inventory.items).not.toContain(food); expect(g.player.nutrition).toBeGreaterThan(1000); }
    else expect(g.player.nutrition).toBe(0);
  });
  it.each(['ration_of_food', 'mango'] as const)('baseline: native %s may be automatically eaten during slumber', nativeFood => {
    const h = makeHarness(), g = scene(h);
    for (const i of [...g.player.inventory.items]) if (i.category === ItemCategory.FOOD) g.player.inventory.removeItem(i);
    const food = ItemLoader.spawnFood(nativeFood, g.player.x, g.player.y)!; g.player.inventory.addItem(food);
    const mushroom = addFood(h, 'drowse', 2); g.player.nutrition = 1; g.player.setStatusDuration('slumber', 5);
    h.command('wait');
    expect(g.player.inventory.items).not.toContain(food); expect(mushroom.quantity).toBe(2);
    expect(g.player.nutrition).toBeGreaterThan(1000);
  });
  it.each([0, 1] as const)('independent crypto oracle selects roast policy %i and verifies actual effect plus separate raw knowledge', choice => {
    const fingerprintHarness = makeHarness(), fp = game(fingerprintHarness).extensionRuntime!.worldDefinitionFingerprints().foraging!;
    let seed = 1; while (roastChoice(seed, fp, 1) !== choice) seed++;
    const observed = observeFacts(), h = makeHarness(seed, ['foraging'], [observed.override]), g = scene(h);
    g.player.nutrition = 500; eat(h, addFood(h, 'venom-roasted'));
    expect(observed.consumed[0]!.resolvedIntent).toEqual(choice === 0 ? { kind: 'status', status: 'poisoned', turns: 8 } : { kind: 'none' });
    expect(knowledgeState(g, 'foraging.venom-roasted')).toBe(choice === 0 ? 'known' : 'tasted');
    expect(knowledgeState(g, 'foraging.venom')).toBe(choice === 0 ? 'known' : 'unknown');
  });
});
