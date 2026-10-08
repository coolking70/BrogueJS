import type { CampRecord, CampPolicy } from '../../../structureSdk';
import type { ItemRead, ContainerRead, ResourceNodeRecord, ItemAmount } from '../../../worldSdk';
import type { StructureDefinition, StructureComponent, RestPoint } from '../../../structureTypes';
export interface SettlementView {
  v: 1;
  revision: number;
  depth: number;
  at: { x: number; y: number };
  inventoryStamp: string;
  available: boolean;
  inventory: (ItemRead & { food: boolean; displayName: string })[];
  camps: (CampRecord & {
    bounds: { x: number; y: number; width: number; height: number };
    regionRevision: number;
    remote: boolean;
  })[];
  boxes: (Omit<ContainerRead, 'items'> & {
    items: (ItemRead & { lockedQuantity: number; displayName: string })[];
  })[];
  components: (StructureComponent & {
    at: { x: number; y: number };
    slot: string;
    nameKey: string;
  })[];
  jobTargets?: {
    campId: number;
    boxes: { id: number; revision: number; at: { x: number; y: number } }[];
    plots: { id: number; revision: number; at: { x: number; y: number }; nameKey: string }[];
  }[];
  residents?:import("../../../residentSdk").ResidentRead;
  restPoints: RestPoint[];
  definitions: StructureDefinition[];
  policy: CampPolicy;
  nodes: (ResourceNodeRecord & { nameKey: string })[];
  lastError: string | null;
}
export function readView(v: unknown): SettlementView | null {
  return v && typeof v === 'object' && (v as SettlementView).v === 1 ? (v as SettlementView) : null;
}
export function base(v: SettlementView) {
  return { v: 1, stateRevision: v.revision, inventoryStamp: v.inventoryStamp };
}
export function payment(
  v: SettlementView,
  cost: readonly ItemAmount[],
  sourceId: number | null,
  selected: Record<string, string>
) {
  const source = v.boxes.find((b) => b.id === sourceId);
  return {
    ...base(v),
    sourceContainerId: sourceId,
    sourceRevision: source?.revision ?? null,
    materials: cost.map((c) => ({
      itemDefinitionId: selected[c.itemDefinitionId] ?? c.itemDefinitionId,
      count: c.count
    }))
  };
}

/** Disposable targets on the current 79×29 dungeon map. */
export function clampMapTarget(at: { x: number; y: number }) {
  return { x: Math.max(1, Math.min(77, Number.isFinite(at.x) ? Math.trunc(at.x) : 1)),
    y: Math.max(1, Math.min(27, Number.isFinite(at.y) ? Math.trunc(at.y) : 1)) };
}
export function campBounds(at: { x: number; y: number }) {
  return { x: Math.max(1, Math.min(69, at.x - 4)),
    y: Math.max(1, Math.min(19, at.y - 4)), width: 9, height: 9 };
}
