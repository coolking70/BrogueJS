import { readForagingUiView, type ForagingUiView } from './view';
export function buildHarvestCommand(view: ForagingUiView, nodeId: number): string | null {
  const data = readForagingUiView(view), node = data?.nodes.find(row => row.interactableId === nodeId);
  return node?.canHarvest ? JSON.stringify({ module: 'foraging', action: 'harvest', payload: { v: 1, nodeId,
    nodeRevision: node.nodeRevision, inventoryStamp: data!.inventoryStamp, destinationId: null, destinationRevision: null } }) : null;
}
export function buildFeedCommand(view: ForagingUiView, targetId: number, itemId: number): string | null {
  const data = readForagingUiView(view), target = data?.companions.find(row => row.actorId === targetId);
  return target && !target.departing && data!.foods.some(row => row.itemId === itemId) ? JSON.stringify({ module: 'foraging', action: 'feed', payload: {
    v: 1, targetId, targetRevision: target.targetRevision, itemId, inventoryStamp: data!.inventoryStamp } }) : null;
}
export function buildRoastCommand(view: ForagingUiView, heatSourceId: number, itemId: number): string | null {
  const data = readForagingUiView(view);
  return data?.heatSources.some(row => row.interactableId === heatSourceId) && data.foods.some(row => row.itemId === itemId && row.roastable)
    ? JSON.stringify({ module: 'foraging', action: 'roast', payload: { v: 1, heatSourceId, itemId, inventoryStamp: data.inventoryStamp } }) : null;
}
