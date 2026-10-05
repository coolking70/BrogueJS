import i18next from 'i18next';
import type { Game } from '../../../../engine/Core/Game';
import { createHeadlessGame } from '../../../../test/harness';
import { createExtensionRegistry } from '../../../catalog';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import locale from '../locales/zh_CN.json';
import type { GiantsState } from '../types';
export const GIANTS_ACCEPTANCE_SEED = 7306;
export const json = <V>(v: V): V => JSON.parse(JSON.stringify(v));
export function startGiants(
  ids: readonly string[] = ['giants'],
  seed = GIANTS_ACCEPTANCE_SEED
): Game {
  const game = createHeadlessGame(seed, 'test');
  i18next.addResourceBundle(i18next.language, 'translation', locale, true, true);
  const registry = createExtensionRegistry(),
    manifest = registry.manifest(ids);
  const initialCommands = registry
    .create(manifest)
    .flatMap((m) =>
      m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []
    );
  game.startNewGame({
    seed,
    mode: 'normal',
    ruleSet: 'extended',
    extensions: ids,
    initialCommands
  });
  game.animationEnabled = false;
  return game;
}
/** Read-only route choice. Every change is an actual move/search/stair command;
 * no map reveal, actor relocation, HP edits or debug encounter injection. */
export function walkNaturalToDepth(game: Game, depth = 3): void {
  for (let command = 0; command < 600 && game.depth < depth && !game.isGameOver; command++) {
    const grid = game.grid,
      key = (p: { x: number; y: number }) => p.y * grid.width + p.x;
    const target = game.levelSeeds[game.depth - 1]!.downStairsLoc,
      start = { ...game.player.loc },
      queue = [start],
      previous = new Map<number, { x: number; y: number } | null>([[key(start), null]]);
    const valid = (p: { x: number; y: number }) => {
      const c = grid.getCell(p.x, p.y);
      return (
        c &&
        (c.isPassable || [T.DOOR, T.SECRET_DOOR].includes(c.terrain)) &&
        !c.layers.includes(T.LAVA) &&
        !c.layers.includes(T.WATER_DEEP) &&
        !c.layers.includes(T.CHASM)
      );
    };
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      if (p.x === target.x && p.y === target.y) break;
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0]
      ]) {
        const n = { x: p.x + dx!, y: p.y + dy! };
        if (valid(n) && !previous.has(key(n))) {
          previous.set(key(n), p);
          queue.push(n);
        }
      }
    }
    if (!previous.has(key(target))) throw new Error('Natural fixture has no stair route');
    let at = target,
      next = target;
    while (previous.get(key(at))) {
      next = at;
      at = previous.get(key(at))!;
    }
    if (grid.getCell(next.x, next.y)!.terrain === T.SECRET_DOOR) game.executeCommand('search');
    else if (next.x === game.player.x && next.y === game.player.y)
      game.executeCommand('stairs_down');
    else game.executeCommand('move', { x: next.x - game.player.x, y: next.y - game.player.y });
    if (game.pendingCommandConfirmation)
      game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
  }
  if (game.depth !== depth || game.isGameOver)
    throw new Error(`Natural route failed: D${game.depth}, HP ${game.player.hp}`);
}
export function giantsState(game: Game): GiantsState {
  return game.toSnapshot().extensions!.modules.giants as unknown as GiantsState;
}
export function naturalGiants(ids: readonly string[] = ['giants']) {
  const game = startGiants(ids);
  walkNaturalToDepth(game);
  const state = giantsState(game),
    boss = game.monsters.find((m) => m.id === state.bosses[0]?.primaryId);
  if (!boss) throw new Error('Natural route did not generate a boss');
  return { game, boss, state };
}
