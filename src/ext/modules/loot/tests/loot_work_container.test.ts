import { expect, it } from 'vitest';
import { setup, base, establish, build, current, add } from '../../settlement/tests/helpers';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { readWorkContext } from '../../../../engine/Core/WorldWorkWorld';
import { workItemStamp } from '../../../../engine/Items/ItemRevision';
import { readLootGameView } from '../gameView';
import { timeSystem } from '../../../../engine/Systems/Time';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { rng } from '../../../../engine/Random';
it('real settlement chest remains read-only; 100-tick withdrawal precedes forge work and same-ID save/load', () => {
  const { h, g } = setup(['loot', 'crafting', 'settlement']);
  expect(h.ext('settlement', 'establish', establish(g)).error).toBeNull();
  expect(h.ext('settlement', 'build', build(g, 'chest')).error).toBeNull();
  add(g, 'crafting.stone', 6);
  add(g, 'crafting.metal', 4);
  add(g, 'loot.shard', 10);
  const read = () => {
    const r = readWorkContext(g, 'loot', { kind: 'inventory' });
    if (!r.ok) throw Error(r.code);
    return r.value;
  };
  expect(
    h.ext('crafting', 'place-station', {
      v: 1,
      definitionId: 'crafting.forge',
      x: 20,
      y: 11,
      inventoryStamp: read().inventoryStamp
    }).error
  ).toBeNull();
  const item = assembleDropItem({
    native: {
      kind: 'leather_armor',
      category: 'armor',
      enchantment: 0,
      runicType: null,
      isCursed: false,
      identified: false,
      familiarityRemaining: 999
    },
    moduleData: {
      loot: {
        v: 5,
        baseId: 'leather_armor',
        ilvl: 20,
        rarity: 'runeword',
        uniqueId: null,
        setId: null,
        pieceId: null,
        identityKnown: false,
        affixes: [],
        corrupted: false,
        enhancement: 0,
        sockets: 2,
        socketed: ['loot.rune.ka', 'loot.rune.ul'],
        nameParts: null,
        origin: { source: 'floor', depth: 14 }
      }
    }
  });
  expect(g.player.inventory.addItem(item)).toBe(true);
  g.extensionRuntime!.bindItemData(item);
  const id = item.id,
    c = g.world5!.containers.find((c) => c.kind === 'chest' && c.id !== current(g).supplyId)!;
  const transfer = (direction: 'deposit' | 'withdraw') =>
    h.ext('settlement', 'transfer', {
      ...base(g),
      containerId: c.id,
      containerRevision: g.world5!.containers.find((r) => r.id === c.id)!.revision,
      direction,
      items: [{ itemId: id, quantity: 1 }]
    });
  expect(transfer('deposit').error).toBeNull();
  readLootGameView(g, id, []);
  const audit = auditFullObjectGraph([g, rng]);
  for (let n = 0; n < 100; n++) {
    const v = readLootGameView(g, id, []);
    expect(v.selected?.location).toBe('container');
    expect(v.workChoices).toEqual([]);
    expect(v.selected?.known?.identified).toBe(false);
  }
  expect(audit.differences()).toEqual([]);
  const station = read().stations.find((s) => s.tags.includes('station.forge'))!,
    p = {
      operationId: 'loot.work.unsocket-last',
      itemId: id,
      itemRevision: workItemStamp(item),
      stationId: station.interactableId,
      stationRevision: station.revision,
      inventoryStamp: read().inventoryStamp
    };
  const tick = timeSystem.currentTick;
  expect(h.ext('loot', 'item-operation', p).error).toBe('C5_BAD_OWNERSHIP');
  expect(timeSystem.currentTick).toBe(tick);
  expect(transfer('withdraw').error).toBeNull();
  expect(timeSystem.currentTick - tick).toBe(100);
  expect(g.player.inventory.items).toContain(item);
  expect(
    h.ext('loot', 'item-operation', {
      ...p,
      itemRevision: workItemStamp(item),
      inventoryStamp: read().inventoryStamp
    }).error
  ).toBeNull();
  expect(timeSystem.currentTick - tick).toBe(200);
  expect(item.moduleData!.loot).toMatchObject({
    rarity: 'normal',
    socketed: ['loot.rune.ka'],
    identityKnown: false
  });
  expect(
    g.loadSnapshot(g.toSnapshot(), (message) => {
      throw Error(message);
    })
  ).toBe(true);
  expect(g.player.inventory.items.filter((i) => i.id === id)).toHaveLength(1);
  expect(g.worldContainerItems!.has(id)).toBe(false);
});
