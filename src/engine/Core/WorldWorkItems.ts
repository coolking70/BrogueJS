/** C3 host-only equipment custody and bounded completion adapter. */
import type { Game } from './Game';
import type { Item } from '../Items/Item';
import type {
  WorkItemInput,
  WorkItemPreparation,
  WorkTicket,
  RecipeDefinition,
  WorkRollBinding
} from '../../ext/worldSdk';
import { World5Error } from '../../ext/world5';
import { itemFacts, copyItemValue } from '../Items/ItemData';
import { assembleDropItem } from '../Items/FixedItemAssembly';
import { itemDefinition, putInventory } from './WorldWorkWorld';
import { markItemStatsDirty } from '../Items/ItemStatInvalidation';
import { markRecordingRoot } from '../../ext/recordingRevisions';
import { c5Canonical } from './WorldCanonical';
const bad = (): never => {
  throw new World5Error('C5_PROVIDER');
};
export { workItemStamp } from '../Items/ItemRevision';
import { workItemStamp } from '../Items/ItemRevision';
export function workOperationInput(
  owner: string,
  operationId: string,
  item: Item,
  rowId?: string
): WorkItemInput {
  const data = itemFacts(item).moduleData?.[owner];
  if (!data) throw new World5Error('C5_BAD_OWNERSHIP');
  return { kind: 'operation', operationId, ...(rowId === undefined ? {} : { rowId }), data };
}
export function prepareWorkOperation(
  game: Game,
  owner: string,
  operationId: string,
  item: Item,
  rowId?: string
): WorkItemPreparation {
  if (item.worldItem || item.quantity !== 1 || ![0, 1, 8].includes(item.category))
    throw new World5Error('C5_BAD_OWNERSHIP');
  const result = game.extensionRuntime!.prepareWorkItem(
    `${owner}.item-operation.v1`,
    workOperationInput(owner, operationId, item, rowId)
  );
  if (
    Object.keys(result).sort().join(',') !== 'inputs,outputs,workTicks' ||
    !Number.isSafeInteger(result.workTicks) ||
    result.workTicks < 1 ||
    result.workTicks > 400 ||
    !Array.isArray(result.inputs) ||
    !Array.isArray(result.outputs) ||
    result.inputs.length > 4 ||
    result.outputs.length > 4
  )
    bad();
  for (const amounts of [result.inputs, result.outputs]) {
    const ids = new Set<string>();
    for (const a of amounts) {
      const d = itemDefinition(game, a.itemDefinitionId);
      if (
        Object.keys(a).sort().join(',') !== 'count,itemDefinitionId' ||
        d.owner !== owner ||
        d.category !== 'material' ||
        d.maxStack !== 99 ||
        !Number.isSafeInteger(a.count) ||
        a.count < 1 ||
        a.count > 40 ||
        ids.has(d.id)
      )
        bad();
      ids.add(d.id);
    }
  }
  return result;
}
export function bindCraftRoll(game: Game, recipe: RecipeDefinition): WorkRollBinding | undefined {
  if (!recipe.lootRoll) return;
  const base = itemDefinition(game, recipe.outputs[0]!.itemDefinitionId).nativeTemplate!;
  const binding: WorkRollBinding = {
    capability: 'loot.item-roll.v1',
    providerIdentity: game.extensionRuntime!.workItemIdentity('loot.item-roll.v1'),
    depth: game.depth,
    recipeId: recipe.id,
    baseId: base,
    maxRarity: recipe.lootRoll.maxRarity
  };
  if (binding.providerIdentity !== null) {
    const prepared = game.extensionRuntime!.prepareWorkItem(
      binding.capability,
      craftInput(game, binding, false)
    );
    if (c5Canonical(prepared) !== c5Canonical({ inputs: [], outputs: [], workTicks: 0 })) bad();
  }
  return binding;
}
function craftInput(game: Game, b: WorkRollBinding, completion: boolean): WorkItemInput {
  const runtime = game.extensionRuntime!;
  return {
    kind: 'craft',
    baseId: b.baseId,
    recipeId: b.recipeId,
    depth: b.depth,
    maxRarity: b.maxRarity,
    rarityFindBp:
      completion && runtime.stats.keys.has('loot.rarity-find')
        ? runtime.stats.value(game.player.id, 'loot.rarity-find')
        : 0
  };
}
export function completeWorkOperation(game: Game, t: WorkTicket): void {
  const op = t.itemOperation!,
    escrow = game.world5!.containers.find((c) => c.id === t.inputEscrowId)!,
    item = game.worldContainerItems!.get(op.targetItemId)!;
  if (!item || !escrow.itemIds.includes(item.id) || workItemStamp(item) !== op.targetStamp)
    throw new World5Error('C5_STALE');
  const capability = `${t.owner}.item-operation.v1`,
    runtime = game.extensionRuntime!,
    prep = prepareWorkOperation(game, t.owner, op.operationId, item, op.rowId);
  if (
    c5Canonical(prep.inputs) !== c5Canonical(t.refundReservation!.counts) ||
    c5Canonical(prep.outputs) !== c5Canonical(t.outputReservation!.counts)
  )
    bad();
  const proposal = runtime.commitWorkItem(
    capability,
    runtime.workItemIdentity(capability)!,
    workOperationInput(t.owner, op.operationId, item, op.rowId)
  );
  if (proposal.kind !== 'update' || Object.keys(proposal).sort().join(',') !== 'data,kind') bad();
  const candidate = {
    ...item,
    moduleData: {
      ...item.moduleData,
      [t.owner]: copyItemValue(proposal.data) as import('../../ext/types').Json
    }
  };
  runtime.validateItemData(candidate, 'update');
  item.moduleData = candidate.moduleData;
  markItemStatsDirty(item);
  markRecordingRoot(item);
  putInventory(game, item);
  escrow.itemIds.splice(escrow.itemIds.indexOf(item.id), 1);
  game.worldContainerItems!.delete(item.id);
}
export function completeCraftRoll(game: Game, t: WorkTicket): boolean {
  const b = t.workRoll;
  if (!b) return false;
  if (b.providerIdentity === null) return false;
  const runtime = game.extensionRuntime!,
    proposal = runtime.commitWorkItem(b.capability, b.providerIdentity, craftInput(game, b, true));
  if (proposal.kind !== 'create') return bad();
  if (
    Object.keys(proposal).sort().join(',') !== 'data,kind,native' ||
    proposal.native.kind !== b.baseId ||
    !proposal.native.identified ||
    proposal.native.enchantment !== 0
  )
    bad();
  const owner = b.capability.split('.')[0]!,
    item = assembleDropItem({
      native: proposal.native,
      moduleData: { [owner]: copyItemValue(proposal.data) as import('../../ext/types').Json }
    });
  runtime.validateItemData(item, 'create');
  runtime.bindItemData(item);
  putInventory(game, item);
  return true;
}
