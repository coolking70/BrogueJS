/** FIFO session queue; DF callbacks enqueue, outer DF settlement drains. */
import type { Game } from './Game';
import type { Item } from '../Items/Item';
import type { FireContactCause, FireContactFact } from '../../ext/worldEdible';
import { edibleDefinition, edibleItemAdapter, markKnowledge, knowledgeName } from './KindKnowledge';
import { bindWorldItem } from '../Items/WorldItems';
import { DF } from '../Map/DungeonFeatureCatalog';
import { spawnDungeonFeature, catalogFeature, dungeonFeatureActive } from '../Map/DungeonFeature';
import { logger } from '../Systems/Logger';
import i18next from 'i18next';
import { checkedAdd } from '../../ext/world5';
import { rng } from '../Random';
interface Contact {
  item: Item;
  cause: FireContactCause;
  at: { x: number; y: number };
  location: 'floor' | 'inventory';
}
interface Queue {
  pending: Contact[];
  draining: boolean;
  depth: number;
}
const queues = new WeakMap<Game, Queue>();
export function fireContactPending(game: Game): boolean {
  const q = queues.get(game);
  return !!q && (q.draining || q.pending.length > 0);
}
export function clearFireContacts(game: Game): void {
  queues.delete(game);
}
export function queueFireContact(
  game: Game,
  item: Item,
  cause: FireContactCause,
  at?: { x: number; y: number }
): void {
  if (!edibleDefinition(game, item)) return;
  const location = game.player.inventory.items.includes(item) ? 'inventory' : 'floor';
  if (location === 'floor' && !game.items.includes(item)) return;
  if (
    location === 'floor' &&
    cause !== 'lava' &&
    game.absoluteTurnNumber < (item.fireContactCooldownUntilTurn ?? 0)
  )
    return;
  let q = queues.get(game);
  if (!q) {
    q = { pending: [], draining: false, depth: game.depth };
    queues.set(game, q);
  }
  q.pending.push({
    item,
    cause,
    at: { ...(at ?? (location === 'inventory' ? game.player.loc : item.loc)) },
    location
  });
}
export function drainFireContacts(game: Game, strict = false): void {
  if (dungeonFeatureActive(game.grid)) return;
  const q = queues.get(game);
  if (!q || q.draining || !q.pending.length) return;
  q.draining = true;
  const processed = new Set<number>();
  let render = false;
  try {
    while (q.pending.length) {
      const c = q.pending.shift()!,
        item = c.item,
        d = edibleDefinition(game, item);
      if (processed.has(item.id) || !d || q.depth !== game.depth) continue;
      const live =
        c.location === 'floor'
          ? game.items.includes(item)
          : game.player.inventory.items.includes(item);
      if (!live) continue;
      if (
        c.location === 'floor' &&
        c.cause !== 'lava' &&
        game.absoluteTurnNumber < (item.fireContactCooldownUntilTurn ?? 0)
      )
        continue;
      processed.add(item.id);
      const beforeId = d.id,
        quantity = item.quantity,
        visible = c.location === 'inventory' || !!game.grid.getCell(c.at.x, c.at.y)?.isVisible;
      let result: FireContactFact['result'],
        toDefinitionId: string | null = null,
        explosion: FireContactFact['explosion'] = null;
      if (c.cause === 'lava' && d.fire.onContact !== 'explode') {
        game.removeEdibleFloorItem(item);
        result = 'destroyed';
      } else if (d.fire.onContact === 'transform') {
        const to = edibleDefinition(game, d.fire.to)!;
        item.worldItem!.definitionId = to.id;
        item.name = to.nameKey;
        item.description = to.descriptionKey;
        item.char = to.glyph;
        item.color = parseInt(to.color.slice(1), 16);
        if (c.location === 'floor')
          item.fireContactCooldownUntilTurn = checkedAdd(game.absoluteTurnNumber, 10);
        else delete item.fireContactCooldownUntilTurn;
        bindWorldItem(item, edibleItemAdapter(game, to));
        result = 'transformed';
        toDefinitionId = to.id;
      } else {
        if (c.location === 'floor') game.removeEdibleFloorItem(item);
        else game.player.inventory.removeItem(item);
        if (d.fire.onContact === 'explode') {
          result = 'exploded';
          explosion = quantity < d.fire.largeAtQuantity ? 'explosion-fire' : 'bloat-explosion';
        } else result = 'burned-up';
      }
      const runtime = game.extensionRuntime!,
        fact: FireContactFact = {
          owner: d.owner,
          factId: runtime.edibleFactId(),
          itemId: item.id,
          definitionId: beforeId,
          quantity,
          cause: c.cause,
          location: c.location,
          at: c.at,
          result,
          toDefinitionId,
          explosion,
          visibleToPlayer: visible,
          tick: game.world5!.simulationTicks
        };
      runtime.edibleParticipate(
        d.owner,
        'onFireContact',
        fact,
        {
          markKnowledge: (id: string, state: 'tasted' | 'known') =>
            markKnowledge(game, d.owner, id, state)
        },
        !strict
      );
      if (visible)
        logger.log(
          i18next.t(d.fire.messageKey, {
            item: knowledgeName(game, beforeId, d.nameKey),
            result: toDefinitionId
              ? knowledgeName(game, toDefinitionId, edibleDefinition(game, toDefinitionId)!.nameKey)
              : '',
            interpolation: { escapeValue: false }
          }),
          '#ffaa55'
        );
      if (explosion)
        spawnDungeonFeature(
          game.grid,
          c.at.x,
          c.at.y,
          catalogFeature(
            explosion === 'explosion-fire' ? DF.DF_EXPLOSION_FIRE : DF.DF_BLOAT_EXPLOSION
          ),
          false
        );
      else if (c.location === 'floor' && result !== 'transformed')
        spawnDungeonFeature(game.grid, c.at.x, c.at.y, catalogFeature(DF.DF_ITEM_FIRE), false);
      render = true;
    }
    if (render) game.requestEdibleRender();
  } finally {
    q.pending.length = 0;
    q.draining = false;
    queues.delete(game);
  }
}
export function igniteEdibleInventory(game: Game): void {
  const items = game.player.inventory.items
    .filter((i) => edibleDefinition(game, i))
    .sort((a, b) => ((a.inventoryLetter ?? '') < (b.inventoryLetter ?? '') ? -1 : 1));
  for (const item of items)
    if (rng.randRange(1, 3) === 1) queueFireContact(game, item, 'carrier-ignited');
  drainFireContacts(game);
}
