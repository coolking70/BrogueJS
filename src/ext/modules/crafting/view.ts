import type { ExtensionProjectionContext } from '../../world';
import type { LevelRef, WorkTicket, WorldErrorCode } from '../../worldSdk';
import type { CraftingPack } from './types';
import { loadCraftingPack } from './definitions';
import { validateCraftingState, type HistoryEntry } from './state';

export interface CraftingAvailableView {
  v: 1;
  available: true;
  levelRef: LevelRef;
  inventoryStamp: string;
  activeTicket: null | {
    ticketId: number; ticketRevision: number; kind: WorkTicket['kind'];
    definitionId: string; nameKey: string; totalBatches: number; completedBatches: number;
    remainingTicks: number; status: WorkTicket['status'];
  };
  nodes: {
    interactableId: number; definitionId: string; nameKey: string; glyph: string; color: string;
    remaining: number; capacity: number; available: number; nodeRevision: number;
    requiredToolTag: string | null; canHarvest: boolean; reason: WorldErrorCode | null;
  }[];
  stations: {
    interactableId: number; definitionId: string; nameKey: string; tags: string[];
    stationRevision: number; inReach: boolean;
  }[];
  recipes: {
    recipeId: string; nameKey: string; descriptionKey: string;
    inputs: { itemDefinitionId: string; nameKey: string; perBatch: number; have: number }[];
    outputs: { itemDefinitionId: string; nameKey: string; perBatch: number }[];
    workTicks: number; stationTags: string[]; stationId: number | null; stationRevision: number | null;
    maxBatch: number; reason: WorldErrorCode | null;
  }[];
  placements: {
    definitionId: string; nameKey: string; placementTicks: number;
    source: 'kit' | 'materials' | null; kitHave: number;
    cost: { itemDefinitionId: string; nameKey: string; need: number; have: number }[];
  }[];
  history: HistoryEntry[];
}
export type CraftingView = { v: 1; available: false } | CraftingAvailableView;

/** Detached, deterministic display data. Reading never settles regeneration or starts work. */
export function projectCraftingView(
  context: ExtensionProjectionContext,
  pack: CraftingPack = loadCraftingPack()
): CraftingView {
  const sdk = context.worldWork;
  if (!sdk) return { v: 1, available: false };
  const read = sdk.readWorkContext({ kind: 'inventory' });
  if (!read.ok) return { v: 1, available: false };
  const ctx = read.value;
  const items = new Map([...pack.materials, ...pack.tools].map(item => [item.id, item]));
  const definitions = new Map([
    ...pack.materials, ...pack.tools, ...pack.resourceNodes, ...pack.stations, ...pack.recipes
  ].map(row => [row.id, row]));
  const have = (id: string): number => ctx.inventory.reduce(
    (sum, item) => sum + (item.definitionId === id ? item.available : 0), 0);
  const stations: CraftingAvailableView['stations'] = ctx.stations
    .filter(station => station.definitionId.startsWith('crafting.') && definitions.has(station.definitionId))
    .map(station => ({
      interactableId: station.interactableId,
      definitionId: station.definitionId,
      nameKey: definitions.get(station.definitionId)!.nameKey,
      tags: [...station.tags],
      stationRevision: station.revision,
      inReach: station.workPositions.some(at => at.x === ctx.at.x && at.y === ctx.at.y)
    }));
  const recipes: CraftingAvailableView['recipes'] = pack.recipes.map(recipe => {
    const station = recipe.stationTags.length === 0 ? undefined : stations
      .filter(row => row.inReach && recipe.stationTags.every(tag => row.tags.includes(tag)))
      .sort((a, b) => a.interactableId - b.interactableId)[0];
    const stationId = station?.interactableId ?? null;
    const inputs = recipe.inputs.map(input => ({
      itemDefinitionId: input.itemDefinitionId, nameKey: items.get(input.itemDefinitionId)!.nameKey,
      perBatch: input.count, have: have(input.itemDefinitionId)
    }));
    let maxBatch = 0;
    let reason: WorldErrorCode | null = null;
    if (recipe.stationTags.length > 0 && !station) reason = 'C5_GATE';
    else {
      const candidate = Math.min(pack.limits.batchMax, ...inputs.map(input => Math.floor(input.have / input.perBatch)));
      // Even when input is insufficient, one preview supplies the authoritative reason.
      for (let n = Math.max(1, candidate); n >= 1; n--) {
        const preview = sdk.previewRecipe(recipe.id, n, stationId, null);
        const currentReason = preview.ok ? preview.value.reason : preview.code;
        if (n === Math.max(1, candidate)) reason = currentReason;
        if (candidate > 0 && preview.ok && preview.value.ok) { maxBatch = n; reason = null; break; }
      }
    }
    return {
      recipeId: recipe.id, nameKey: recipe.nameKey, descriptionKey: recipe.descriptionKey,
      inputs, outputs: recipe.outputs.map(output => ({
        itemDefinitionId: output.itemDefinitionId, nameKey: items.get(output.itemDefinitionId)!.nameKey,
        perBatch: output.count
      })), workTicks: recipe.workTicks, stationTags: [...recipe.stationTags],
      stationId, stationRevision: station?.stationRevision ?? null, maxBatch, reason
    };
  });
  const nodes: CraftingAvailableView['nodes'] = [];
  for (const nearby of context.nearbyInteractables) {
    if (nearby.owner !== 'crafting') continue;
    const result = sdk.readWorkContext({ kind: 'node', interactableId: nearby.id });
    if (!result.ok || !result.value.node) continue;
    const node = result.value.node;
    const definition = pack.resourceNodes.find(row => row.id === node.definitionId);
    if (!definition || node.owner !== 'crafting') continue;
    const available = Math.max(0, node.remaining - node.reservedUnits);
    let reason: WorldErrorCode | null = null;
    if (!ctx.available) reason = ctx.activeTicket ? 'C5_BUSY' : 'C5_GATE';
    else if (Math.max(Math.abs(ctx.at.x - node.at.x), Math.abs(ctx.at.y - node.at.y)) > 1) reason = 'C5_DISTANCE';
    else if (node.remaining < definition.unitsPerHarvest) reason = 'C5_RESOURCE_EMPTY';
    else if (available < definition.unitsPerHarvest) reason = 'C5_RESERVED';
    else if (definition.requiredToolTag !== null && !ctx.inventory.some(item =>
      item.tags.includes(definition.requiredToolTag!) && item.toolDurability !== null && item.toolDurability > 0)) reason = 'C5_TOOL';
    nodes.push({
      interactableId: node.interactableId, definitionId: node.definitionId,
      nameKey: definition.nameKey, glyph: definition.glyph, color: definition.color,
      remaining: node.remaining, capacity: node.capacity, available, nodeRevision: node.revision,
      requiredToolTag: definition.requiredToolTag, canHarvest: reason === null, reason
    });
  }
  const ticket = ctx.activeTicket;
  const activeTicket = ticket && ticket.owner === 'crafting' && definitions.has(ticket.definitionId) ? {
    ticketId: ticket.ticketId, ticketRevision: ticket.revision, kind: ticket.kind,
    definitionId: ticket.definitionId, nameKey: definitions.get(ticket.definitionId)!.nameKey,
    totalBatches: ticket.totalBatches, completedBatches: ticket.completedBatches,
    remainingTicks: ticket.remainingTicks, status: ticket.status
  } : null;
  return {
    v: 1, available: true, levelRef: { ...ctx.levelRef }, inventoryStamp: ctx.inventoryStamp,
    activeTicket, nodes, stations, recipes,
    placements: pack.stations.map(station => {
      const kitHave = station.kitDefinitionId === null ? 0 : have(station.kitDefinitionId);
      const cost = station.placementCost.map(input => ({
        itemDefinitionId: input.itemDefinitionId, nameKey: items.get(input.itemDefinitionId)!.nameKey,
        need: input.count, have: have(input.itemDefinitionId)
      }));
      return {
        definitionId: station.id, nameKey: station.nameKey, placementTicks: station.placementTicks,
        source: kitHave > 0 ? 'kit' : cost.every(input => input.have >= input.need) ? 'materials' : null,
        kitHave, cost
      };
    }),
    history: validateCraftingState(context.state, pack)
      ? context.state.history.slice(-8).reverse().map(entry => ({ ...entry })) : []
  };
}
