/** Sole trusted enumeration of mechanical Item owners; display/equipment refs are not roots. */
import type { Game, LevelState } from './Game';
import type { Item } from '../Items/Item';
import type { ItemOwnerRef } from '../../ext/worldSdk';
import type { Monster } from '../../entities/Monster';
export function forEachItemRoot(
  game: Game,
  visit: (item: Item, owner: ItemOwnerRef) => void
): void {
  const internal = game as unknown as {
    levels: Map<number, LevelState>;
    currentLevelDepth: number;
    pendingFallenItemsByDepth: Map<number, Item[]>;
    pendingFallenByDepth: Map<number, Monster[]>;
  };
  const floor = (items: readonly Item[], depth: number) =>
    items.forEach((item) =>
      visit(item, { kind: 'floor', levelRef: { kind: 'dungeon', depth }, at: { ...item.loc } })
    );
  const carriers = (monsters: readonly Monster[]) => {
    const seen = new Set<Monster>();
    const held = (monster: Monster): void => {
      if (seen.has(monster)) return;
      seen.add(monster);
      if (monster.carriedItem) visit(monster.carriedItem, { kind: 'carrier', actorId: monster.id });
      if (monster.carriedMonster) held(monster.carriedMonster);
    };
    monsters.forEach(held);
  };
  for (const item of game.player.inventory.items)
    visit(item, { kind: 'inventory', actorId: game.player.id });
  floor(game.items, game.depth);
  carriers([...game.monsters, ...game.dormantMonsters]);
  for (const [depth, level] of [...internal.levels]
    .filter(([d]) => d !== internal.currentLevelDepth)
    .sort(([a], [b]) => a - b)) {
    floor(level.items, depth);
    carriers([...level.monsters, ...(level.dormantMonsters ?? [])]);
  }
  for (const [depth, items] of [...internal.pendingFallenItemsByDepth].sort(([a], [b]) => a - b))
    floor(items, depth);
  carriers([
    ...game.purgatory,
    ...[...internal.pendingFallenByDepth].sort(([a], [b]) => a - b).flatMap(([, actors]) => actors)
  ]);
  for (const container of [...(game.world5?.containers ?? [])].sort((a, b) => a.id - b.id))
    for (const id of container.itemIds) {
      const item = game.worldContainerItems?.get(id);
      if (!item) throw new Error('C5_BAD_REFERENCE');
      visit(item, { kind: 'container', containerId: container.id });
    }
}
export function countWorldItemRoots(game: Game): number {
  let count = 0;
  const ids = new Set<number>();
  forEachItemRoot(game, (item) => {
    if (ids.has(item.id)) throw new Error('C5_BAD_OWNERSHIP');
    ids.add(item.id);
    count++;
  });
  return count;
}

export function containerItemRoots(game: Game): Item[] {
  const items: Item[] = [];
  if (!game.world5) return items;
  forEachItemRoot(game, (item, owner) => {
    if (owner.kind === 'container') items.push(item);
  });
  return items;
}
