import i18next from 'i18next';
import { cellTerrainFlags } from '../../../../engine/Map/DungeonFeature';
import { T_IS_FIRE, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../../../../engine/Map/TerrainCatalog';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { ItemCategory, type Item } from '../../../../engine/Items/Item';
import type { Game } from '../../../../engine/Core/Game';
import { createHeadlessGame } from '../../../../test/harness';
import { createExtensionRegistry } from '../../../catalog';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import locale from '../locales/zh_CN.json';
import type { GiantsState } from '../types';
// Appended natural templates invalidate the former 7306 normal route (death on D2).
// 7328 preserves the original cardinal-command route and sole D3 ridgeback scene.
export const GIANTS_ACCEPTANCE_SEED = 7328;
export const json = <V>(v: V): V => JSON.parse(JSON.stringify(v));
export function startGiants(
  ids: readonly string[] = ['giants'],
  seed = GIANTS_ACCEPTANCE_SEED,
  mode: 'normal' | 'easy' | 'wizard' = 'normal'
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
    mode,
    ruleSet: 'extended',
    extensions: ids,
    initialCommands
  });
  game.animationEnabled = false;
  return game;
}
/** Read-only route choice. Every change is an actual move/search/stair command;
 * no map reveal, actor relocation, HP edits or debug encounter injection. */
export function walkNaturalToDepth(game: Game, depth = 3, recover = false): void {
  for (
    let command = 0;
    command < (recover ? 2000 : 600) && game.depth < depth && !game.isGameOver;
    command++
  ) {
    // Optional deeper route collects/equips ordinary weapons and rests. No cheats;
    // all item choices and recovery turns are recorded through the public boundary.
    const power = (item: Item | null) => {
      if (!item?.damage) return 0;
      const d = CombatSystem.parseDamageString(item.damage);
      return d.min + d.max;
    };
    const usable = (item: Item) =>
      item.category === ItemCategory.WEAPON &&
      (item.strengthRequired ?? 0) <= game.player.strength &&
      power(item) > power(game.player.equippedWeapon);
    const upgrade =
      recover && !game.player.equippedWeapon?.isCursed
        ? game.player.inventory.items.find(usable)
        : undefined;
    if (upgrade) {
      game.executeItemCommand('equip', upgrade);
      continue;
    }
    const food =
      recover && game.player.nutrition < 400
        ? game.player.inventory.items.find((i) => i.category === ItemCategory.FOOD)
        : undefined;
    if (food) {
      game.executeItemCommand('eat', food);
      continue;
    }
    // The original D3 path is unchanged.
    if (
      recover &&
      game.player.hp < game.player.maxHp &&
      game.player.nutrition > 400 &&
      ![...game.visibleMonsters].some((m) => m.hp > 0 && !m.isAlly)
    ) {
      game.executeCommand('wait');
      continue;
    }
    const grid = game.grid,
      key = (p: { x: number; y: number }) => p.y * grid.width + p.x;
    const weapon =
      recover && !game.player.equippedWeapon?.isCursed
        ? game.items
            .filter(usable)
            .sort(
              (a, b) =>
                Math.max(Math.abs(a.x - game.player.x), Math.abs(a.y - game.player.y)) -
                Math.max(Math.abs(b.x - game.player.x), Math.abs(b.y - game.player.y))
            )[0]
        : undefined;
    let target = weapon?.loc ?? game.levelSeeds[game.depth - 1]!.downStairsLoc;
    const start = { ...game.player.loc };
    const valid = (p: { x: number; y: number }) => {
      const c = grid.getCell(p.x, p.y);
      return (
        c &&
        (c.isPassable || [T.DOOR, T.SECRET_DOOR].includes(c.terrain)) &&
        !c.layers.includes(T.LAVA) &&
        !c.layers.includes(T.WATER_DEEP) &&
        !c.layers.includes(T.CHASM) &&
        (!recover || (c.trapType !== 'fire' && !(cellTerrainFlags(grid, p.x, p.y) & T_IS_FIRE)))
      );
    };
    const route = (avoidEnemies: boolean) => {
      const queue = [start],
        previous = new Map<number, { x: number; y: number } | null>([[key(start), null]]);
      const safe = (p: { x: number; y: number }) =>
        valid(p) &&
        (!avoidEnemies ||
          !game.monsters.some(
            (m) => m.hp > 0 && !m.isAlly && Math.max(Math.abs(m.x - p.x), Math.abs(m.y - p.y)) <= 2
          ));
      for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        if (p.x === target.x && p.y === target.y) break;
        const directions = recover
          ? [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0],
              [-1, -1],
              [-1, 1],
              [1, -1],
              [1, 1]
            ]
          : [
              [0, -1],
              [0, 1],
              [-1, 0],
              [1, 0]
            ];
        for (const [dx, dy] of directions) {
          const n = { x: p.x + dx!, y: p.y + dy! };
          if (
            safe(n) &&
            (!dx ||
              !dy ||
              (valid({ x: p.x + dx!, y: p.y }) &&
                valid({ x: p.x, y: p.y + dy! }) &&
                !(cellTerrainFlags(grid, p.x + dx!, p.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT) &&
                !(cellTerrainFlags(grid, p.x, p.y + dy!) & T_OBSTRUCTS_DIAGONAL_MOVEMENT))) &&
            !previous.has(key(n))
          ) {
            previous.set(key(n), p);
            queue.push(n);
          }
        }
      }
      return previous;
    };
    let previous = route(recover);
    if (recover && !previous.has(key(target))) previous = route(false);
    if (recover && !previous.has(key(target)) && weapon) {
      target = game.levelSeeds[game.depth - 1]!.downStairsLoc;
      previous = route(true);
      if (!previous.has(key(target))) previous = route(false);
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
      game.executeCommand(weapon ? 'pickup' : 'stairs_down');
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
export function naturalGiants(ids: readonly string[] = ['giants'], mode: 'normal' | 'wizard' = 'normal') {
  const game = startGiants(ids, GIANTS_ACCEPTANCE_SEED, mode);
  walkNaturalToDepth(game);
  const state = giantsState(game),
    boss = game.monsters.find((m) => m.id === state.bosses[0]?.primaryId);
  if (!boss) throw new Error('Natural route did not generate a boss');
  return { game, boss, state };
}

export const GIANTS_COLOSSUS_ACCEPTANCE_SEED = 7309;
export function naturalColossus() {
  const game = startGiants(['giants'], GIANTS_COLOSSUS_ACCEPTANCE_SEED, 'wizard');
  walkNaturalToDepth(game, 7, true);
  const state = giantsState(game),
    boss = game.monsters.find((m) => m.typeId === 'giants.abyssal-colossus');
  if (!boss) throw new Error('Natural route did not generate the colossus');
  return { game, boss, state };
}

export const GIANTS_SPINE_ACCEPTANCE_SEED = 7309;
export function naturalSpine() {
  const game = startGiants(['giants'], GIANTS_SPINE_ACCEPTANCE_SEED, 'wizard');
  for (let depth = 9; depth <= 14; depth++) {
    walkNaturalToDepth(game, depth, true);
    const boss = game.monsters.find(m => m.typeId === 'giants.spine-crawler');
    if (boss) return { game, boss, state: giantsState(game) };
  }
  throw new Error('Natural route did not generate the spine crawler');
}
