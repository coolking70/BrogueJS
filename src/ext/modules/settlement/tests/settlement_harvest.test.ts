import { it, expect } from 'vitest';
import { setup, walk, base } from './helpers';
import { materializedNode } from '../../../../engine/Core/WorldWorkWorld';
import { structureReadSDK } from '../../../../engine/Core/StructureProduction';
it.each(['wood', 'stone', 'fiber'])(
  'harvests settlement %s through real movement and the public work command',
  (name) => {
    const { h, g } = setup(),
      node = g.world5!.nodes.find((n) => n.definitionId === `settlement.${name}-node`)!;
    walk(h, g, { x: node.at.x, y: node.at.y + 1 });
    const quantity = () =>
      g.player.inventory.items
        .filter((i) => i.worldItem?.definitionId === `settlement.${name}`)
        .reduce((q, i) => q + i.quantity, 0);
    const q = quantity(),
      tick = g.world5!.simulationTicks;
    expect(
      h.ext('settlement', 'harvest', {
        v: 1,
        nodeId: node.interactableId,
        nodeRevision: node.revision,
        inventoryStamp: base(g).inventoryStamp,
        destinationId: null,
        destinationRevision: null
      }).error
    ).toBeNull();
    h.runAutoUntilIdle(4);
    expect(quantity()).toBe(q + 1);
    expect(g.world5!.simulationTicks - tick).toBe(100);
    expect(node.remaining).toBe(19);
    const before = structuredClone(node);
    for (let i = 0; i < 20; i++) h.command('wait');
    expect(materializedNode(g, node).remaining).toBe(name === 'stone' ? 19 : 20);
    expect(node).toEqual(before); // regeneration is projected, settled only by work
    const view = structureReadSDK(g, 'settlement').read() as any;
    expect(view.nodes.find((n: any) => n.interactableId === node.interactableId).remaining).toBe(
      name === 'stone' ? 19 : 20
    );
    const snapshot = h.save(),
      digest = h.digest();
    h.load(snapshot);
    expect(h.digest()).toBe(digest);
    const recording = h.exportRecording();
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    expect(h.digest()).toBe(digest);
  }
);
