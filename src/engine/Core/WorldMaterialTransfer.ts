import {lockedFoodQuantity} from './StructureProduction';
/** Trusted adapter only; absent from the content SDK. One atomic transfer, 100 ticks. */
import type { Game } from './Game';
import type { WorldResult, WorldCommit } from '../../ext/worldSdk';
import { World5Error, checkedAdd, levelKey } from '../../ext/world5';
import { inventoryStamp } from './RecordingDigest';
import { Item, ItemCategory } from '../Items/Item';
import { assembleWorldItem } from '../Items/WorldItems';
import { hasInteractionLine } from '../../ext/worldSpatial';
import { serializeItem } from './EntitySnapshot';
import { c5Canonical } from './WorldCanonical';
import { deepFreeze } from '../Movement/SpatialSchema';
import { transactWorldWork } from './WorldWork';
import {
  containerRead,
  containerItems,
  checkItemBudget,
  itemDefinition,
  distance,
  putInventory,
  putContainer,
  recordWorldReceipt,
  result,
  additionalItemSlots,
  reservedInventorySlots,
  reservedContainerSlots
} from './WorldWorkWorld';
export interface MaterialTransferRequest {
  containerId: number;
  containerRevision: number;
  inventoryStamp: string;
  direction: 'deposit' | 'withdraw';
  items: readonly { itemId: number; quantity: number }[];
}
export interface MaterialTransferPlan {
  request: MaterialTransferRequest;
  canonical: string;
}
const issued = new WeakMap<object, { game: Game; epoch: number; used: boolean }>();
export function planMaterialTransfer(
  game: Game,
  request: MaterialTransferRequest
): WorldResult<MaterialTransferPlan> {
  try {
    c5Canonical(request);
    if (!game.world5) throw new World5Error('C5_DISABLED');
    if (game.player.hp <= 0 || game.isGameOver) throw new World5Error('C5_DEAD');
    if (
      game.interactionActive ||
      game.actorActions?.bundles.some((b) => b.decisionOwnerId === game.player.id)
    )
      throw new World5Error('C5_BUSY');
    if (
      !request ||
      Object.keys(request).sort().join(',') !==
        'containerId,containerRevision,direction,inventoryStamp,items' ||
      !['deposit', 'withdraw'].includes(request.direction) ||
      !Array.isArray(request.items) ||
      !request.items.length ||
      request.items.length > 64
    )
      throw new World5Error('C5_BAD_PAYLOAD');
    const c = game.world5.containers.find(
      (c) => c.id === request.containerId && (c.kind === 'chest'||c.kind==='remains')
    );
    if (!c) throw new World5Error('C5_UNKNOWN_TARGET');
    if (levelKey(c.levelRef) !== `dungeon.${game.depth}`) throw new World5Error('C5_WRONG_LEVEL');
    if (
      c.revision !== request.containerRevision ||
      inventoryStamp(game.player.inventory.items) !== request.inventoryStamp
    )
      throw new World5Error('C5_STALE');
    const read = containerRead(game, c.id);
    if (!read.at || !game.grid.getCell(read.at.x, read.at.y)?.hasMemory)
      throw new World5Error('C5_UNKNOWN_TARGET');
    if (
      distance(game.player.loc, read.at) > 1 ||
      !hasInteractionLine(game.grid, game.player.loc, read.at)
    )
      throw new World5Error('C5_DISTANCE');
    const source =
        request.direction === 'deposit' ? game.player.inventory.items : containerItems(game, c.id),
      seen = new Set<number>();
    const incoming: Item[] = [];
    for (const row of request.items) {
      const item = source.find((i) => i.id === row.itemId);
      if (
        !item ||
        seen.has(row.itemId) ||
        Object.keys(row).sort().join(',') !== 'itemId,quantity' ||
        !Number.isSafeInteger(row.quantity) ||
        row.quantity < 1 ||
        row.quantity > item.quantity
      )
        throw new World5Error('C5_BAD_PAYLOAD');
      if(request.direction==='withdraw'&&item.quantity-row.quantity<lockedFoodQuantity(game,item.id))throw new World5Error('C5_RESERVED');
      seen.add(row.itemId);
      if (item.category === ItemCategory.GOLD) throw new World5Error('C5_INPUT');
      if (
        [
          game.player.equippedWeapon,
          game.player.equippedArmor,
          game.player.ringLeft,
          game.player.ringRight
        ].includes(item)
      )
        throw new World5Error('C5_BUSY');
      incoming.push(Object.assign(Object.create(Item.prototype), item, { quantity: row.quantity }));
    }
    if (
      request.direction === 'deposit' &&
      containerRead(game, c.id).occupiedSlots +
        reservedContainerSlots(game, c.id) +
        additionalItemSlots(game, containerItems(game, c.id), incoming) >
        c.capacity
    )
      throw new World5Error('C5_CAPACITY');
    if (
      request.direction === 'withdraw' &&
      game.player.inventory.packCount() +
        reservedInventorySlots(game) +
        additionalItemSlots(game, game.player.inventory.items, incoming) >
        game.player.inventory.capacity
    )
      throw new World5Error('C5_CAPACITY');
    checkItemBudget(
      game,
      request.items.filter((r) => source.find((i) => i.id === r.itemId)!.quantity !== r.quantity)
        .length
    );
    const plan = deepFreeze({
      request: structuredClone(request),
      canonical: JSON.stringify(request)
    });
    issued.set(plan, { game, epoch: game.worldWorkCommandEpoch, used: false });
    return { ok: true, value: plan };
  } catch (e) {
    return { ok: false, code: e instanceof World5Error ? e.code : 'C5_BAD_PAYLOAD', field: null };
  }
}
export function commitMaterialTransfer(
  game: Game,
  plan: MaterialTransferPlan
): WorldResult<WorldCommit> {
  const permit = issued.get(plan);
  if (!permit || permit.game !== game || permit.epoch !== game.worldWorkCommandEpoch)
    return { ok: false, code: 'C5_SCOPE', field: null };
  if (permit.used) return { ok: false, code: 'C5_PLAN_USED', field: null };
  permit.used = true;
  return result(() => {
    const fresh = planMaterialTransfer(game, plan.request);
    if (!fresh.ok) throw new World5Error(fresh.code);
    return transactWorldWork(game, () => {
      const r = plan.request,
        c = game.world5!.containers.find((c) => c.id === r.containerId)!,
        source =
          r.direction === 'deposit' ? game.player.inventory.items : containerItems(game, c.id);
      for (const row of r.items) {
        const item = source.find((i) => i.id === row.itemId)!;
        let moved = item;
        if (item.quantity > row.quantity) {
          if (item.worldItem)
            moved = assembleWorldItem(
              itemDefinition(game, item.worldItem.definitionId),
              row.quantity
            );
          else {
            const fresh = new Item(item.name, item.char, item.color, item.category);
            moved = Object.assign(fresh, serializeItem(item), {
              id: fresh.id,
              quantity: row.quantity
            });
          }
          item.quantity -= row.quantity;
        } else if (r.direction === 'deposit') game.player.inventory.removeItem(item);
        else c.itemIds.splice(c.itemIds.indexOf(item.id), 1);
        if (r.direction === 'deposit') putContainer(game, c.id, moved);
        else {
          putInventory(game, moved);
          game.worldContainerItems!.delete(moved.id);
        }
      }
      c.revision = checkedAdd(c.revision, 1);
      const identity = `transfer.${c.id}.${c.revision}`;
      recordWorldReceipt(game, c.owner, 'transfer', identity, 'completed', null);
      return {
        operation: 'transfer',
        receiptIdentity: identity,
        ticketId: null,
        chargedTicks: 100
      };
    });
  });
}
