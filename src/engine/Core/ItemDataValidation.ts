import type { Game } from './Game';
import type { GameSnapshot } from './WholeRunSnapshot';
import type { ExtensionRuntime } from '../../ext/runtime';
import { ItemDataError, validateItemData, hasItemData } from '../Items/ItemData';
import type { ItemDataPhase } from '../../ext/itemSdk';
import { forEachItemRoot } from './WorldItemRoots';
import type { GameSnapshotItem, GameSnapshotMonster } from './EntitySnapshot';
const fail = (): never => { throw new ItemDataError('C6_OWNERSHIP'); };
const check = (row: object, runtime: ExtensionRuntime | null, phase: ItemDataPhase) => {
  if (runtime) runtime.validateItemData(row, phase);
  else validateItemData(row, [], new Map(), phase);
};
export function validateLiveItemRoots(game: Game, phase: ItemDataPhase): void {
  const ids = new Map<number, boolean>();
  forEachItemRoot(game, item => {
    if (ids.has(item.id) && (hasItemData(item) || ids.get(item.id))) fail();
    ids.set(item.id, hasItemData(item));
    check(item, game.extensionRuntime, phase);
  });

}
/** Audit every raw row before the codec can discard fields or duplicate IDs.
 * Entity graph history is validated without counting it as mechanical ownership. */
export function validateSnapshotItems(s: GameSnapshot, runtime: ExtensionRuntime | null, phase: ItemDataPhase): void {
  const levels = [s, ...s.levels];
  const rows = [...levels.flatMap(l => l.items), ...s.player.inventory, ...(s.party?.actors.flatMap(a=>a.inventory)??[]),
    ...s.pendingFallenItemsByDepth.flatMap(q => q.items), ...s.entityGraph.items];
  const items = new Map<number, GameSnapshotItem>();
  for (const row of rows) {
    if (!row || !Number.isSafeInteger(row.id) || row.id < 1 || hasItemData(row) && row.id >= s.run.nextEntityId || items.has(row.id)) fail();
    items.set(row.id, row);
    check(row, runtime, phase);
  }
  const roots = [...levels.flatMap(l => [...l.monsters, ...l.dormantMonsters]),
    ...(s.purgatory ?? []), ...s.pendingFallenByDepth.flatMap(q => q.monsters)];
  const monsters = new Map<number, GameSnapshotMonster>();
  for (const row of [...roots, ...s.entityGraph.monsters]) {
    // Whole-run rows do not carry a second standalone graph.
    if (row.graph !== undefined || items.has(row.id) || row.id === s.player.id) fail();
    monsters.set(row.id, row);
  }
  if (items.has(s.player.id)) fail();
  const owners = new Set<number>();
  const own = (id: number) => { if (!items.has(id) || owners.has(id) && hasItemData(items.get(id)!)) fail(); owners.add(id); };
  [...levels.flatMap(l => l.items), ...s.player.inventory, ...(s.party?.actors.flatMap(a=>a.inventory)??[]), ...s.pendingFallenItemsByDepth.flatMap(q => q.items)].forEach(i => own(i.id));
  const visited = new Set<number>();
  const visit = (row: GameSnapshotMonster) => {
    if (visited.has(row.id)) return;
    visited.add(row.id);
    if (row.carriedItemId != null) own(row.carriedItemId);
    if (row.carriedMonsterId != null) {
      const held = monsters.get(row.carriedMonsterId);
      if (!held) fail();
      visit(held!);
    }
  };
  roots.forEach(visit);
  for (const c of s.run.world5?.containers ?? []) c.itemIds.forEach(own);

  for(const actor of [s.player,...(s.party?.actors??[])]){
  const equipped = [actor.equippedWeaponId, actor.equippedArmorId, actor.ringLeftId, actor.ringRightId].filter((id): id is number => id !== null);
  if (equipped.some(id => items.has(id) && hasItemData(items.get(id)!) && (equipped.filter(v => v === id).length !== 1 || !actor.inventory.some(i => i.id === id)))) fail();
  }
}
