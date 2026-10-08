import type { CampState } from '../../structureSdk';
import { assertC5Json } from '../../worldJson';
import { exact, uint } from '../../worldBasics';
import { validId } from '../../json';
export const initialState = (): CampState => ({
  schema: 2,
  spawnSlots: [],
  plotDays: [],
  revision: 0,
  camps: [],
  constructions: [],
  history: []
});
export function validateState(v: unknown): v is CampState {
  try {
    assertC5Json(v);
    exact(v, 'schema,revision,camps,constructions,history,spawnSlots,plotDays', 'state');
    const s = v as unknown as CampState;
    if (s.schema !== 2) return false;
    uint(s.revision, 'revision');
    if (
      !Array.isArray(s.camps) ||
      s.camps.length > 8 ||
      !Array.isArray(s.constructions) ||
      s.constructions.length > 12288 ||
      !Array.isArray(s.history) ||
      s.history.length > 128
    )
      return false;
    if(!Array.isArray(s.spawnSlots)||s.spawnSlots.length>4||!Array.isArray(s.plotDays)||s.plotDays.length>96)return false;
    for(const a of s.spawnSlots){exact(a,'depth,attempts,status,actorId','spawnSlot');uint(a.attempts,'attempts',1);if(![1,5,10,15].includes(a.depth)||a.attempts>2||!['placed','skipped','terminal','deferred'].includes(a.status))return false;if(a.actorId!==null)uint(a.actorId,'actorId',1);if((a.status==='placed')!==(a.actorId!==null))return false;}
    if(new Set(s.spawnSlots.map(a=>a.depth)).size!==s.spawnSlots.length)return false;
    for(const a of s.plotDays){exact(a,'componentId,day','plotDay');uint(a.componentId,'componentId',1);uint(a.day,'day');}
    if(new Set(s.plotDays.map(a=>a.componentId)).size!==s.plotDays.length)return false;
    const unique = (rows: readonly number[]) => new Set(rows).size === rows.length;
    if (
      !unique(s.camps.map((c) => c.regionId)) ||
      !unique(s.camps.map((c) => c.depth)) ||
      !unique(s.camps.map((c) => c.slot)) ||
      !unique(s.camps.flatMap((c) => c.locked.map((l) => l.itemId)))
    )
      return false;
    for (const c of s.camps) {
      exact(
        c,
        'regionId,depth,slot,ordinal,revision,markerId,supplyId,locked,reportTick,reportItems,consumedLockedUnits,granaryIds',
        'camp'
      );
      for (const k of ['regionId', 'depth', 'ordinal', 'markerId', 'supplyId'] as const)
        uint(c[k], k, 1);
      for (const k of ['slot', 'revision', 'reportTick'] as const) uint(c[k], k);
      if (
        c.slot > 7 ||
        c.depth > 40 ||
        !Array.isArray(c.locked) ||
        c.locked.length > 2 ||
        !Array.isArray(c.reportItems) ||
        c.reportItems.length > 64
      )
        return false;
      let total = 0;
      for (const l of c.locked) {
        exact(l, 'itemId,quantity', 'lock');
        uint(l.itemId, 'itemId', 1);
        uint(l.quantity, 'quantity', 1);
        total += l.quantity;
      }
      uint(c.consumedLockedUnits, "consumedLockedUnits");
      if (total + c.consumedLockedUnits !== 2 || !Array.isArray(c.granaryIds) || c.granaryIds.length>16 || !c.granaryIds.includes(c.supplyId) || !unique(c.granaryIds)) return false;
      for(const id of c.granaryIds)uint(id,"granaryId",1);
      for (const r of c.reportItems) {
        exact(r, 'itemId,quantity,name', 'reportItem');
        uint(r.itemId, 'itemId', 1);
        uint(r.quantity, 'quantity', 1);
        if (typeof r.name !== 'string' || r.name.length > 256) return false;
      }
    }
    if (!unique(s.constructions.map((c) => c.componentId))) return false;
    for (const r of s.constructions) {
      exact(r, 'componentId,materials', 'construction');
      uint(r.componentId, 'componentId', 1);
      if (!Array.isArray(r.materials) || r.materials.length > 8) return false;
      for (const a of r.materials) {
        exact(a, 'itemDefinitionId,count', 'material');
        uint(a.count, 'count', 1);
        if (a.count > 99 || !validId(a.itemDefinitionId)) return false;
      }
    }
    for (const h of s.history) {
      exact(h, 'regionId,slot,ordinal,tick,operation', 'history');
      uint(h.regionId, 'regionId', 1);
      uint(h.slot, 'slot');
      uint(h.ordinal, 'ordinal', 1);
      uint(h.tick, 'tick');
      if (h.slot > 7 || !['establish', 'expand', 'retire'].includes(h.operation)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
