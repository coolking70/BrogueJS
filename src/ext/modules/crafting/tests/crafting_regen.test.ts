import { describe, expect, it } from 'vitest';
import { amount, ascend, descend, game, harness, harvest, nearNode, node, quiet, waitTicks } from './runtimeHelpers';

describe('crafting T9 lazy regeneration through real commands', () => {
  it.each([['wood-node', 2000], ['fiber-node', 1000]] as const)('%s gains one per %i ticks and reads preserve revision', (shortId, interval) => {
    const h = harness(), n = nearNode(h, shortId);
    expect(harvest(h, shortId).error).toBeNull();
    expect(harvest(h, shortId).error).toBeNull();
    const lastTick = n.lastSettledTick, remaining = n.remaining, revision = n.revision;
    waitTicks(h, interval - n.regenRemainder - (game(h).world5!.simulationTicks - lastTick) - 100);
    const beforeRead = structuredClone(n);
    for (let i = 0; i < 5; i++) {
      expect(h.readWorkContext('crafting', { kind: 'node', interactableId: n.interactableId }).ok).toBe(true);
      game(h).extensionRuntime!.readModuleView('crafting');
    }
    expect(n).toEqual(beforeRead);
    expect(n.revision).toBe(revision);
    expect(harvest(h, shortId).error).toBeNull();
    expect(n.remaining).toBe(remaining - 1);
    // The previous harvest advances the clock to the exact regeneration boundary.
    expect(harvest(h, shortId).error).toBeNull();
    expect(n.remaining).toBe(remaining - 1);
    expect(n.regenRemainder).toBe(0);
  });

  it.each([['wood-node', 2000], ['fiber-node', 1000]] as const)('%s full capacity never banks elapsed regeneration', (shortId, interval) => {
    const h = harness(), n = nearNode(h, shortId);
    waitTicks(h, interval * 2);
    expect(harvest(h, shortId).error).toBeNull();
    expect(n.remaining).toBe(n.capacity - 1);
    expect(n.regenRemainder).toBe(0);
    expect(harvest(h, shortId).error).toBeNull();
    expect(n.remaining).toBe(n.capacity - 2);
    expect(n.regenRemainder).toBe(100);
  });

  it.each(['stone-node', 'metal-node', 'hide-cache'])('%s never regenerates', async shortId => {
    const h = harness();
    if (shortId === 'metal-node') {
      descend(h);
      const { add } = await import('./runtimeHelpers');
      add(game(h), 'pick', 1);
    }
    const n = nearNode(h, shortId);
    expect(harvest(h, shortId).error).toBeNull();
    const remaining = n.remaining;
    waitTicks(h, 4000);
    expect(harvest(h, shortId).error).toBeNull();
    expect(n.remaining).toBe(remaining - 1);
    expect(n.regenRemainder).toBe(0);
  });

  it('off-level elapsed time materializes on the next harvest after returning', () => {
    const h = harness(), n = nearNode(h, 'wood-node');
    expect(harvest(h).error).toBeNull();
    expect(harvest(h).error).toBeNull();
    const prior = structuredClone(n), wood = amount(h, 'wood');
    descend(h); quiet(game(h)); waitTicks(h, 2000); ascend(h);
    nearNode(h, 'wood-node');
    const restored = node(h);
    expect(restored.remaining).toBe(prior.remaining);
    expect(restored.revision).toBe(prior.revision);
    expect(harvest(h).error).toBeNull();
    expect(amount(h, 'wood')).toBe(wood + 1);
    expect(restored.remaining).toBe(prior.remaining);
    expect(restored.regenRemainder).toBeGreaterThanOrEqual(0);
    expect(restored.regenRemainder).toBeLessThan(2000);
  });
});
