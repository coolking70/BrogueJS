import { startGiants, json } from './naturalFixture';
import { emptyProductionArena } from '../../../../test/support/productionComposite';
import { commitCreatureAnchor, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { MonsterState, type Monster } from '../../../../entities/Monster';
import { withBodyContact } from '../../../../engine/Combat/BodyCombat';
import type { Game } from '../../../../engine/Core/Game';
export const LANTERN = 'giants.blind-lantern',
  OPEN = 'giants.blind-lantern-open';
export const COPPER = 'giants.copper-tendril',
  BODY = 'giants.copper-tendril-body';
/** Explicit diagnostic setup. Never export these scenes as natural trace evidence. */
export function lanternScene(ids: string[] = ['giants']) {
  const game = startGiants(ids, 1, 'wizard');
  emptyProductionArena(game);
  commitCreatureAnchor(game.player, { x: 40, y: 12 });
  const boss = game.createModuleMonster(LANTERN, { x: 14, y: 12 })!;
  boss.state = MonsterState.HUNTING;
  boss.behaviorFlags.add('MONST_ALWAYS_HUNTING');
  boss.givenUpOnScent = true;
  boss.ticksUntilTurn = 10000;
  boss.regenTurns = 0;
  return { game, boss };
}
export function copperScene(ids: string[] = ['giants']) {
  const game = startGiants(ids, 1, 'wizard');
  emptyProductionArena(game);
  const core = game.createCompositeMonster(BODY, { x: 14, y: 12 })!;
  const group = game.bodyGroups!.find((g) => g.coreId === core.id)!;
  const limbs = game.monsters.filter((m) => m !== core);
  core.state = MonsterState.HUNTING;
  core.behaviorFlags.add('MONST_ALWAYS_HUNTING');
  core.givenUpOnScent = true;
  for (const m of game.monsters) {
    m.regenTurns = 0;
    m.ticksUntilTurn = 10000;
  }
  return { game, core, group, limbs };
}
export function hitZone(game: Game, boss: Monster, amount: number, zone = 'mantle') {
  const contact = footprintOf(boss).find((p) => p.zoneId === zone);
  if (!contact) throw Error(`Missing zone ${zone}`);
  const origin = game.extensionRuntime!.causality.create('melee', game.player.id);
  return game.extensionRuntime!.causality.withOrigin(origin, () =>
    withBodyContact(boss, contact, () =>
      boss.takeDamage(amount, true, game.grid, undefined, 'physical')
    )
  );
}
export function mechanical(game: Game) {
  const s = json(game.toSnapshot());
  s.savedAt = 0;
  return s;
}
