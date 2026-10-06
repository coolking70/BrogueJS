/** Foundation level-entry effects, preceding all content enteredLevel hooks. */
import { worldMessage } from './WorldWork';
import type { Game } from './Game';
import { levelKey, World5Error } from '../../ext/world5';
import { assembleWorldItem } from '../Items/WorldItems';
import { registerWorld5WorkFixture } from '../../ext/world5Fixture';
import {
  worldPack,
  checkItemBudget,
  checkInteractableBudget,
  allocateWorldId,
  nearbyCells,
  clearWorldCell,
  placementCandidates,
  placementDraw,
  placeNode,
  updateWorldReasons,
  recordWorldReceipt,
  recordWorldFact,
  previewItem
} from './WorldWorkWorld';
export { registerWorld5WorkFixture };
function tryPlaceNode(...args: Parameters<typeof placeNode>): boolean {
  try {
    placeNode(...args);
    return true;
  } catch (error) {
    if (error instanceof World5Error && error.code === 'C5_BUDGET') return false;
    throw error;
  }
}
export function enterWorldWorkLevel(game: Game, firstVisit: boolean): void {
  if (!game.world5) return;
  const w = game.world5!,
    ref = { kind: 'dungeon' as const, depth: game.depth },
    key = levelKey(ref),
    runtime = game.extensionRuntime!;
  for (const pack of runtime.worldDefinitionPacks()) {
    const owner =
      pack.items[0]?.owner ??
      pack.resourceNodes[0]?.owner ??
      pack.stations[0]?.owner ??
      pack.recipes[0]?.owner;
    if (!owner) continue;
    if (runtime.isWorldWorkFixture(owner) && firstVisit && game.depth === 1) {
      installWorldWorkBasic(game, owner);
    } else {
      for (const pending of [...w.pendingPlacements].filter(
        (p) => p.owner === owner && levelKey(p.levelRef) === key
      )) {
        const d = pack.resourceNodes.find((d) => d.id === pending.definitionId)!,
          cells = placementCandidates(game);
        w.pendingPlacements.splice(w.pendingPlacements.indexOf(pending), 1);
        if (
          cells.length &&
          w.nodes.filter((n) => n.definitionId === d.id).length <
            (d.placement.dungeon?.maxPerRun ?? 0)
        ) {
          const at =
            cells[placementDraw(game.currentSeed, key, d.id, pending.ordinal, cells.length).index]!;
          if (!tryPlaceNode(game, d, at, `${d.id}.${key}.${pending.ordinal}`)) {
            recordWorldReceipt(
              game,
              owner,
              'placement',
              `retry.${d.id}.${key}.${pending.ordinal}`,
              'skipped',
              'budget'
            );
            continue;
          }
          recordWorldReceipt(
            game,
            owner,
            'placement',
            `retry.${d.id}.${key}.${pending.ordinal}`,
            'completed',
            null
          );
        } else
          recordWorldReceipt(
            game,
            owner,
            'placement',
            `retry.${d.id}.${key}.${pending.ordinal}`,
            'skipped',
            'no-space'
          );
      }
      if (firstVisit)
        for (const d of pack.resourceNodes) {
          const p = d.placement.dungeon;
          if (!p || game.depth < p.minDepth || game.depth > p.maxDepth) continue;
          const count = Math.min(
            p.maxPerDepth,
            p.maxPerRun - w.nodes.filter((n) => n.definitionId === d.id).length
          );
          for (let ordinal = 0; ordinal < count; ordinal++) {
            const cells = placementCandidates(game);
            if (cells.length) {
              const at =
                cells[placementDraw(game.currentSeed, key, d.id, ordinal, cells.length).index]!;
              if (!tryPlaceNode(game, d, at, `${d.id}.${key}.${ordinal}`)) {
                recordWorldReceipt(
                  game,
                  owner,
                  'placement',
                  `place.${d.id}.${key}.${ordinal}`,
                  'skipped',
                  'budget'
                );
                continue;
              }
              recordWorldReceipt(
                game,
                owner,
                'placement',
                `place.${d.id}.${key}.${ordinal}`,
                'completed',
                null
              );
            } else {
              if (p.onNoSpace === 'defer')
                w.pendingPlacements.push({
                  owner,
                  definitionId: d.id,
                  levelRef: ref,
                  ordinal,
                  retriesLeft: 1
                });
              recordWorldReceipt(
                game,
                owner,
                'placement',
                `place.${d.id}.${key}.${ordinal}`,
                'skipped',
                p.onNoSpace === 'defer' ? 'defer' : 'no-space'
              );
            }
          }
        }
    }
    if (
      game.depth === 1 &&
      firstVisit &&
      pack.startupItems &&
      !w.startupGrants.some((g) => g.owner === owner)
    )
      grantStartupItems(game, owner);
  }
  updateWorldReasons(game);
}
export function grantStartupItems(game: Game, owner: string): void {
  const pack = worldPack(game, owner),
    startup = pack.startupItems!,
    w = game.world5!;
  if (w.startupGrants.some((g) => g.owner === owner)) return;
  const receipt = {
    owner,
    instanceKey: startup.instanceKey,
    result: 'granted' as 'granted' | 'partial' | 'skipped',
    toInventory: [] as { itemDefinitionId: string; count: number }[],
    toFloor: [] as { itemDefinitionId: string; count: number }[],
    skipped: [] as { itemDefinitionId: string; count: number }[],
    tick: w.simulationTicks
  };
  for (const row of startup.items) {
    const d = pack.items.find((i) => i.id === row.itemDefinitionId)!;
    let rest = row.count;
    while (rest > 0) {
      const count = Math.min(rest, d.maxStack),
        fake = previewItem(d, count);
      let budget = true;
      try {
        checkItemBudget(game, 1);
      } catch {
        budget = false;
      }
      const toBag = budget && game.player.inventory.hasSpace(fake),
        at = toBag ? null : budget ? nearbyCells(game).find((p) => clearWorldCell(game, p)) : null;
      if (toBag) {
        const item = assembleWorldItem(d, count);
        game.player.inventory.addItem(item);
        receipt.toInventory.push({ itemDefinitionId: d.id, count });
      } else if (at) {
        const item = assembleWorldItem(d, count);
        item.loc = { ...at };
        game.items.push(item);
        receipt.toFloor.push({ itemDefinitionId: d.id, count });
      } else receipt.skipped.push({ itemDefinitionId: d.id, count });
      rest -= count;
    }
  }
  receipt.result =
    receipt.toInventory.length === 0 && receipt.toFloor.length === 0
      ? 'skipped'
      : receipt.toFloor.length || receipt.skipped.length
        ? 'partial'
        : 'granted';
  w.startupGrants.push(receipt);
  recordWorldReceipt(
    game,
    owner,
    'startup',
    `startup.${owner}.${startup.instanceKey}`,
    receipt.result === 'skipped' ? 'skipped' : 'completed',
    receipt.result === 'granted' ? null : 'overflow'
  );
  recordWorldFact(game, {
    owner,
    ticketId: null,
    completionOrdinal: 0,
    operation: 'startup',
    definitionId: startup.items[0]!.itemDefinitionId,
    actorId: game.player.id,
    completedBatches: 0,
    result: receipt.result === 'skipped' ? 'skipped' : 'completed',
    reason: receipt.result === 'granted' ? null : 'overflow',
    tick: w.simulationTicks
  });
  worldMessage(game, startup.items[0]!.itemDefinitionId, 'startup');
}
/** Only the registered test-only fixture owner can use this static placement. */
export function installWorldWorkBasic(game: Game, owner: string): void {
  if (!import.meta.env.DEV || !game.extensionRuntime!.isWorldWorkFixture(owner))
    throw new Error('C5_SCOPE');
  const pack = worldPack(game, owner),
    d = pack.resourceNodes[0]!;
  let at = nearbyCells(game).find((p) => clearWorldCell(game, p));
  if (!at) throw new Error('C5_BLOCKED');
  if (!tryPlaceNode(game, d, at, `${d.id}.basic`))
    recordWorldReceipt(
      game,
      owner,
      'placement',
      `basic.${d.id}.${levelKey({ kind: 'dungeon', depth: game.depth })}`,
      'skipped',
      'budget'
    );
  const station = pack.stations[0]!;
  at = nearbyCells(game).find((p) => clearWorldCell(game, p));
  if (!at) throw new Error('C5_BLOCKED');
  const e = game.extensionRuntime!.worldWorkPlace({
    owner,
    depth: game.depth,
    x: at.x,
    y: at.y,
    instanceKey: `${station.id}.basic`,
    contentId: station.id,
    nameKey: station.nameKey,
    descriptionKey: station.descriptionKey,
    glyph: station.glyph,
    color: station.color,
    interactionDistance: 1,
    priority: 0
  });
  game.world5!.stations.push({
    interactableId: e.id,
    owner,
    definitionId: station.id,
    levelRef: { kind: 'dungeon', depth: game.depth },
    boundComponentId: null,
    revision: 0
  });
  placeFixtureChest(game, owner, 16);
}
export function placeFixtureChest(game: Game, owner: string, capacity: number): number {
  if (!import.meta.env.DEV || !game.extensionRuntime!.isWorldWorkFixture(owner))
    throw new Error('C5_SCOPE');
  const w = game.world5!,
    def = worldPack(game, owner).stations[0]!;
  if (w.containers.filter((c) => c.kind === 'chest').length >= 112) throw new Error('C5_BUDGET');
  const remains = w.containers.find(
    (c) => c.kind === 'remains' && levelKey(c.levelRef) === `dungeon.${game.depth}`
  );
  checkInteractableBudget(game, remains ? 1 : 2);
  const create = (kind: 'chest' | 'remains', slots: number): number => {
    const at = nearbyCells(game).find((p) => clearWorldCell(game, p));
    if (!at) throw new Error('C5_BLOCKED');
    const id = allocateWorldId(game),
      e = game.extensionRuntime!.worldWorkPlace({
        owner,
        depth: game.depth,
        x: at.x,
        y: at.y,
        instanceKey: `${owner}.${kind}.${id}`,
        contentId: def.id,
        nameKey: def.nameKey,
        descriptionKey: def.descriptionKey,
        glyph: '▣',
        color: def.color,
        interactionDistance: 1,
        priority: 0
      });
    w.containers.push({
      id,
      owner,
      kind,
      capacity: slots,
      levelRef: { kind: 'dungeon', depth: game.depth },
      position: { kind: 'interactable', interactableId: e.id },
      itemIds: [],
      revision: 0,
      ticketId: null
    });
    return id;
  };
  const id = create('chest', capacity);
  if (!remains) {
    if (w.containers.filter((c) => c.kind === 'remains').length >= 16) throw new Error('C5_BUDGET');
    create('remains', 1024);
  }
  updateWorldReasons(game);
  return id;
}
