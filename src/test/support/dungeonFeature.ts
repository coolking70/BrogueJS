import type { Game } from '../../engine/Core/Game';
import type { Pos } from '../../types';
import { spawnDungeonFeature, catalogFeature } from '../../engine/Map/DungeonFeature';
import type { DF } from '../../engine/Map/DungeonFeatureCatalog';

/** Direct native DF probes live with test support, not production DF readers.
 * Uses the game's bound production effects; no replacement ports or catalog edits. */
export function applyCatalogFeature(game: Game, at: Pos, id: DF) {
  return spawnDungeonFeature(game.grid, at.x, at.y, catalogFeature(id), false);
}
