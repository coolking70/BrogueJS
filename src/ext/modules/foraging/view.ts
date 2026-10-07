import type { ExtensionProjectionContext } from '../../world';
import type { WorldErrorCode } from '../../worldSdk';
import type { ForagingPack, ForagingView } from './types';
import { loadForagingPack } from './definitions';
import { isHungerBand } from './state';
export type { ForagingView } from './types';
type AvailableView = Extract<ForagingView, { available: true }>;

/** SDK projections are detached reads: no settling, knowledge inference or hidden identities. */
export function projectForagingView(context: ExtensionProjectionContext, pack: ForagingPack = loadForagingPack()): ForagingView {
  try {
    if (!context.edible || !context.worldWork) return { v: 1, available: false };
    const edibleRead = context.edible.readEdibleContext();
    const workRead = context.worldWork.readWorkContext({ kind: 'inventory' });
    if (!edibleRead.ok || !workRead.ok) return { v: 1, available: false };
    const edible = edibleRead.value, work = workRead.value;
    const nodes: AvailableView['nodes'] = [];
    for (const nearby of context.nearbyInteractables) {
      if (nearby.owner !== 'foraging') continue;
      const read = context.worldWork.readWorkContext({ kind: 'node', interactableId: nearby.id });
      if (!read.ok || !read.value.node) continue;
      const node = read.value.node;
      if (node.owner !== 'foraging' || !pack.resourceNodes.some(d => d.id === node.definitionId)) continue;
      const available = Math.max(0, node.remaining - node.reservedUnits);
      let reason: WorldErrorCode | null = null;
      if (!work.available) reason = work.activeTicket ? 'C5_BUSY' : 'C5_GATE';
      else if (Math.max(Math.abs(work.at.x - node.at.x), Math.abs(work.at.y - node.at.y)) > 1) reason = 'C5_DISTANCE';
      else if (node.remaining < 1) reason = 'C5_RESOURCE_EMPTY';
      else if (available < 1) reason = 'C5_RESERVED';
      nodes.push({ interactableId: node.interactableId, remaining: node.remaining, capacity: node.capacity,
        available, nodeRevision: node.revision, canHarvest: reason === null, reason });
    }
    const foods: AvailableView['foods'] = [];
    for (const item of edible.inventory) {
      const own = item.definitionId !== null && item.definitionId.startsWith('foraging.') && pack.edibleItems.some(d => d.id === item.definitionId);
      const native = item.definitionId === null && (item.nativeFood === 'ration_of_food' || item.nativeFood === 'mango');
      if (!own && !native) continue;
      foods.push({ itemId: item.itemId, displayName: item.displayName, quantity: item.quantity,
        source: own ? 'foraging' : 'native', knowledge: item.knowledge,
        satiety: native || item.knowledge === 'known' ? item.satiety : null, roastable: own });
    }
    const companions: AvailableView['companions'] = edible.feedTargets.flatMap(target =>
      target.needId === pack.companion.needId && isHungerBand(target.band) ? [{ actorId: target.actorId,
        targetRevision: target.targetRevision, band: target.band, departing: target.departing }] : []);
    const ticket = work.activeTicket;
    return { v: 1, available: true, inventoryStamp: edible.inventoryStamp,
      activeTicket: ticket?.owner === 'foraging' && ticket.kind === 'harvest' && pack.resourceNodes.some(d => d.id === ticket.definitionId)
        ? { ticketId: ticket.ticketId, remainingTicks: ticket.remainingTicks } : null,
      nodes, foods, companions,
      heatSources: edible.heatSources.map(s => ({ interactableId: s.interactableId, kind: s.kind })) };
  } catch { return { v: 1, available: false }; }
}
