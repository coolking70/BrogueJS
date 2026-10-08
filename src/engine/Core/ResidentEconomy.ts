/** Pure C5-1/1.1.0 needs transition. No Game, clocks, RNG or content imports. */
import { assertC5Json } from '../../ext/worldJson';
import { exact, uint, World5Error } from '../../ext/worldBasics';
import type { OfflineResidentState } from '../../ext/world5';
export const residentShortage = (s: OfflineResidentState) =>
  Math.max(s.foodShortage, s.housingShortage);
export const residentEfficiency = (s: OfflineResidentState) =>
  [100, 50, 0, 0][residentShortage(s)]!;
export const initialResidentNeed = (actorId: number): OfflineResidentState => ({
  actorId,
  alive: true,
  foodShortage: 0,
  housingShortage: 0,
  unfedDays: 0,
  departed: false
});
export interface RationRead {
  containerId: number;
  itemId: number;
  quantity: number;
  lockedQuantity: number;
}
export interface ResidentNeedsInput {
  schema: 2;
  fromTick: number;
  toTick: number;
  residents: OfflineResidentState[];
  rations: RationRead[];
  beds: { actorId: number; bedId: number | null }[];
  eligibleBeds: number[];
}
export type ResidentNeedsEffect =
  | {
      kind: 'ration-consume';
      containerId: number;
      itemId: number;
      quantity: number;
      lockedQuantity: number;
      actorId: number;
      atTick: number;
      firstTick: number;
    }
  | { kind: 'resident-departure'; actorId: number; atTick: number; reason: 'starvation' };
export interface ResidentNeedsPlan {
  contractVersion: '1.1.0';
  fromTick: number;
  toTick: number;
  residents: OfflineResidentState[];
  rations: RationRead[];
  beds: { actorId: number; bedId: number | null }[];
  effects: ResidentNeedsEffect[];
  epochCount: number;
}
export function assertResidentNeedsInput(v: unknown): asserts v is ResidentNeedsInput {
  assertC5Json(v);
  exact(v, 'schema,fromTick,toTick,residents,rations,beds,eligibleBeds', 'needsInput');
  const p = v as unknown as ResidentNeedsInput;
  if (p.schema !== 2) throw new World5Error('C5_BAD_VERSION');
  uint(p.fromTick, 'fromTick');
  uint(p.toTick, 'toTick');
  if (p.toTick < p.fromTick) throw new World5Error('C5_BAD_TIME');
  if (
    !Array.isArray(p.residents) ||
    p.residents.length > 16 ||
    !Array.isArray(p.rations) ||
    p.rations.length > 1024 ||
    !Array.isArray(p.beds) ||
    p.beds.length !== p.residents.length ||
    !Array.isArray(p.eligibleBeds) ||
    p.eligibleBeds.length > 384
  )
    throw new World5Error('C5_BUDGET');
  const unique = (a: number[]) => new Set(a).size === a.length;
  if (
    !unique(p.residents.map((s) => s.actorId)) ||
    !unique(p.rations.map((s) => s.itemId)) ||
    !unique(p.eligibleBeds) || !unique(p.beds.map(b=>b.actorId))
  )
    throw new World5Error('C5_BAD_REFERENCE');
  for (const s of p.residents) {
    exact(s, 'actorId,alive,foodShortage,housingShortage,unfedDays,departed', 'needs');
    uint(s.actorId, 'actorId', 1);
    if (
      typeof s.alive !== 'boolean' ||
      typeof s.departed !== 'boolean' ||
      ![0, 1, 2, 3].includes(s.foodShortage) ||
      ![0, 1, 2, 3].includes(s.housingShortage) ||
      !Number.isSafeInteger(s.unfedDays) ||
      s.unfedDays < 0 ||
      s.unfedDays > 4
    )
      throw new World5Error('C5_BAD_PAYLOAD');
  }
  for (const r of p.rations) {
    exact(r, 'containerId,itemId,quantity,lockedQuantity', 'ration');
    uint(r.containerId, 'container', 1);
    uint(r.itemId, 'item', 1);
    uint(r.quantity, 'quantity', 1);
    uint(r.lockedQuantity, 'lock');
    if (r.lockedQuantity > r.quantity) throw new World5Error('C5_BAD_REFERENCE');
  }
  for (const b of p.beds) {
    exact(b, 'actorId,bedId', 'bed');
    if (!p.residents.some((s) => s.actorId === b.actorId))
      throw new World5Error('C5_BAD_REFERENCE');
    if (b.bedId !== null) uint(b.bedId, 'bedId', 1);
  }
  for (const id of p.eligibleBeds) uint(id, 'eligibleBed', 1);
}
/** Runtime bounded by finite ration units + four starvation transitions, never elapsed days. */
export function planResidentNeeds(input: Readonly<ResidentNeedsInput>): ResidentNeedsPlan {
  assertResidentNeedsInput(input);
  const p = structuredClone(input),
    effects: ResidentNeedsEffect[] = [];
  p.residents.sort((a, b) => a.actorId - b.actorId);
  p.beds.sort((a, b) => a.actorId - b.actorId);
  p.eligibleBeds.sort((a, b) => a - b);
  const live = () => p.residents.filter((s) => s.alive && !s.departed);
  const allocate = () => {
    const used = new Set<number>();
    for (const b of p.beds) {
      if (
        !live().some((s) => s.actorId === b.actorId) ||
        b.bedId === null ||
        !p.eligibleBeds.includes(b.bedId) ||
        used.has(b.bedId)
      )
        b.bedId = null;
      else used.add(b.bedId);
    }
    for (const b of p.beds)
      if (b.bedId === null && live().some((s) => s.actorId === b.actorId)) {
        const id = p.eligibleBeds.find((id) => !used.has(id));
        if (id !== undefined) {
          b.bedId = id;
          used.add(id);
        }
      }
  };
  allocate();
  let cursor = input.fromTick;
  const housing = (through: number) => {
    const n = Math.floor(through / 1000) - Math.floor(cursor / 1000);
    if (n > 0)
      for (const s of live()) {
        const bed = p.beds.find((b) => b.actorId === s.actorId)?.bedId;
        s.housingShortage = (
          bed !== null && bed !== undefined
            ? Math.max(0, s.housingShortage - n)
            : Math.min(3, s.housingShortage + n)
        ) as 0 | 1 | 2 | 3;
      }
    cursor = through;
  };
  let day = Math.floor(input.fromTick / 32000) + 1;
  const lastDay = Math.floor(input.toTick / 32000);
  while (day <= lastDay && live().length) {
    const actors = live();
    const total = p.rations.reduce((sum, r) => sum + r.quantity, 0);
    if (!Number.isSafeInteger(total)) throw new World5Error('C5_OVERFLOW');
    const rounds = Math.min(lastDay - day + 1, Math.floor(total / actors.length));
    if (rounds > 0) {
      // Consume a run of complete daily rounds. A stock prefix is assigned to
      // actors by its absolute offset modulo population; no elapsed-day loop.
      const chunks = [
        ...p.rations.filter(r => r.lockedQuantity > 0).sort((a,b) => a.itemId-b.itemId)
          .map(r => ({r, count:r.lockedQuantity, locked:true})),
        ...p.rations.filter(r => r.quantity > r.lockedQuantity)
          .sort((a,b) => a.containerId-b.containerId || a.itemId-b.itemId)
          .map(r => ({r, count:r.quantity-r.lockedQuantity, locked:false}))
      ];
      let offset = 0;
      const units = rounds * actors.length;
      for (const {r,count,locked} of chunks) {
        const taken = Math.min(count, units-offset);
        if (taken <= 0) break;
        for (let index=0;index<actors.length;index++) {
          const first = offset + (index-offset%actors.length+actors.length)%actors.length;
          if (first >= offset+taken) continue;
          const quantity = 1 + Math.floor((offset+taken-1-first)/actors.length);
          const firstTick = (day+Math.floor(first/actors.length))*32000;
          effects.push({kind:'ration-consume',containerId:r.containerId,itemId:r.itemId,
            quantity,lockedQuantity:locked?quantity:0,actorId:actors[index]!.actorId,
            firstTick,atTick:firstTick+(quantity-1)*32000});
        }
        r.quantity-=taken;
        if(locked)r.lockedQuantity-=taken;
        offset+=taken;
      }
      for(const actor of actors){
        actor.foodShortage=Math.max(0,actor.foodShortage-rounds) as 0|1|2|3;
        actor.unfedDays=0;
      }
      housing((day+rounds-1)*32000);
      day+=rounds;
      continue;
    }
    const atTick = day * 32000;
    housing(atTick - 1);
    for (const s of live()) {
      const sorted = p.rations
        .filter((r) => r.quantity > 0)
        .sort(
          (a, b) =>
            (b.lockedQuantity > 0 ? 1 : 0) - (a.lockedQuantity > 0 ? 1 : 0) ||
            (a.lockedQuantity > 0 && b.lockedQuantity > 0
              ? a.itemId - b.itemId
              : a.containerId - b.containerId || a.itemId - b.itemId)
        );
      const r = sorted[0];
      if (r) {
        const locked = r.lockedQuantity > 0 ? 1 : 0;
        r.quantity--;
        r.lockedQuantity -= locked;
        s.foodShortage = Math.max(0, s.foodShortage - 1) as 0 | 1 | 2 | 3;
        s.unfedDays = 0;
        effects.push({
          kind: 'ration-consume',
          containerId: r.containerId,
          itemId: r.itemId,
          quantity: 1,
          lockedQuantity: locked,
          actorId: s.actorId,
          firstTick: atTick,
          atTick
        });
      } else {
        const leave = s.foodShortage === 3;
        s.foodShortage = Math.min(3, s.foodShortage + 1) as 0 | 1 | 2 | 3;
        s.unfedDays = Math.min(4, s.unfedDays + 1);
        if (leave) {
          s.departed = true;
          effects.push({
            kind: 'resident-departure',
            actorId: s.actorId,
            atTick,
            reason: 'starvation'
          });
        }
      }
    }
    allocate();
    housing(atTick);
    day++;
  }
  housing(input.toTick);
  return {
    contractVersion: '1.1.0',
    fromTick: input.fromTick,
    toTick: input.toTick,
    residents: p.residents,
    rations: p.rations,
    beds: p.beds,
    effects,
    epochCount: Math.floor(input.toTick / 1000) - Math.floor(input.fromTick / 1000)
  };
}
