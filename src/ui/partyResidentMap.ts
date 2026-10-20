import type { Game } from '../engine/Core/Game';

/** Read the live resident root only; an archived or remote party entity is not
 * map knowledge. This projection never changes perception, clocks or RNG. */
export function visibleStationedResidents(game: Pick<Game, 'party' | 'world5' | 'depth' | 'grid'>) {
  if (!game.party || !game.world5) return [];
  const retired = new Set(game.party.state.retired.map(row => row.actorId));
  const local = new Set(game.world5.residents
    .filter(row => row.levelRef.kind === 'dungeon' && row.levelRef.depth === game.depth)
    .map(row => row.actorId));
  return [...game.party.stationed.values()].filter(actor =>
    actor.hp > 0 && !retired.has(actor.id) && local.has(actor.id) &&
    game.grid.getCell(actor.x, actor.y)?.isVisible
  );
}
