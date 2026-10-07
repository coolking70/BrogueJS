import type { CraftingCommand, Position } from '../../../worldSdk';
import { readCraftingUiView, type CraftingUiView } from './view';

export interface CraftingContainerChoice { id: number; revision: number }
function fields(value: unknown, keys: string[]): boolean {
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) return false;
  return Reflect.ownKeys(value).length === keys.length && keys.every(key => {
    const field = Object.getOwnPropertyDescriptor(value, key); return !!field && 'value' in field && field.enumerable;
  });
}
function container(choice: CraftingContainerChoice | null): boolean {
  return choice === null || (fields(choice, ['id', 'revision']) && (Number.isSafeInteger(choice.id) && choice.id > 0
    && Number.isSafeInteger(choice.revision) && choice.revision >= 0));
}
const encode = (command: CraftingCommand): string => JSON.stringify(command);
export function buildHarvestCommand(view: CraftingUiView, nodeId: number, destination: CraftingContainerChoice | null = null): string | null {
  if (!readCraftingUiView(view) || !container(destination)) return null;
  const node = view.nodes.find(row => row.interactableId === nodeId);
  return node?.canHarvest ? encode({ module: 'crafting', action: 'harvest', payload: { v: 1,
    nodeId, nodeRevision: node.nodeRevision, inventoryStamp: view.inventoryStamp,
    destinationId: destination?.id ?? null, destinationRevision: destination?.revision ?? null } }) : null;
}
export function buildCraftCommand(view: CraftingUiView, recipeId: string, batchCount: number, source: CraftingContainerChoice | null = null): string | null {
  if (!readCraftingUiView(view) || !container(source)) return null;
  if (source && (source.id !== view.sourceContainerId || source.revision !== view.sourceRevision)) return null;
  const recipe = view.recipes.find(row => row.recipeId === recipeId);
  if (!recipe || !Number.isSafeInteger(batchCount) || batchCount < 1 || batchCount > recipe.maxBatch) return null;
  return encode({ module: 'crafting', action: 'craft', payload: { v: 1, recipeId, batchCount,
    stationId: recipe.stationId, stationRevision: recipe.stationRevision,
    sourceContainerId: source?.id ?? view.sourceContainerId, sourceRevision: source?.revision ?? view.sourceRevision, inventoryStamp: view.inventoryStamp } });
}
export function buildPlaceCommand(view: CraftingUiView, definitionId: string, at: Position): string | null {
  if (!readCraftingUiView(view) || !fields(at, ['x', 'y']) || !Number.isSafeInteger(at.x) || !Number.isSafeInteger(at.y)
    || !view.placements.some(row => row.definitionId === definitionId && row.source !== null)) return null;
  return encode({ module: 'crafting', action: 'place-station', payload: { v: 1, definitionId, x: at.x, y: at.y, inventoryStamp: view.inventoryStamp } });
}
export function buildCancelCommand(view: CraftingUiView): string | null {
  if (!readCraftingUiView(view) || view.activeTicket?.status !== 'working') return null;
  return encode({ module: 'crafting', action: 'cancel-work', payload: { v: 1,
    ticketId: view.activeTicket.ticketId, ticketRevision: view.activeTicket.ticketRevision } });
}
