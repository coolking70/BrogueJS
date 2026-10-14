/** Host-only C6 coordinator. Modules import itemSdk; they never receive this authority. */
import type { DropEvent, DropSource, DropProposal, DropAcceptance, DropPlanHandle, DropProvider } from './itemSdk';
import type { ExtensionModule, ReadonlyJson } from './types';
import type { CreatureBirth } from './birth';
import type { GenerationPlacementFact } from './generation';
import type { BodyTransitionFact } from './bodyTransitions';
import { assertItemJson, copyItemValue, freezeItemValue, ItemDataError } from '../engine/Items/ItemData';
import { validateNativeAssembly } from '../engine/Items/FixedItemAssembly';
import { validId } from './json';
import { c5Hash } from './worldJson';
export interface ItemDropSnapshot {
  nextEventId: number;
  nextEncounterOrdinal: number;
  unique: Record<string, string>;
  catalogs: Record<string, string>;
  births: Record<string, boolean>;
  encounters: { key: string; owner: string; formId: string; depth: number; subjects: number[]; splitSubjects?: number[]; lost: boolean }[];
}
export type DropInput = DropEvent extends infer E ? E extends DropEvent ? Omit<E, 'v' | 'eventId'> : never : never;
interface Prepared { event: DropEvent; proposal: DropProposal; owner: string; provider: DropProvider; token: object; revision: number }
function fail(): never { throw new ItemDataError('C6_DATA'); }
const integer = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): n is number => Number.isSafeInteger(n) && Number(n) >= min && Number(n) <= max;
const exact = (o: object, keys: string) => Object.keys(o).sort().join(',') === keys;
export class ItemDrops {
  private readonly providers = new Map<DropSource, { owner: string; provider: DropProvider }>();
  private readonly plans = new WeakMap<object, Prepared>();
  private readonly catalogs = new Map<string, readonly string[]>();
  private readonly declarations = new Map<string, readonly string[]>();
  private readonly encounterForms = new Map<string, ReadonlySet<string>>();
  private state: ItemDropSnapshot = { nextEventId: 1, nextEncounterOrdinal: 1, unique: {}, catalogs: {}, births: {}, encounters: [] };
  constructor(modules: readonly ExtensionModule[]) {
    for (const m of modules) {
      if (m.itemEncounters !== undefined) {
        assertItemJson(m.itemEncounters);
        if (!Array.isArray(m.itemEncounters) || m.itemEncounters.length > 128 || new Set(m.itemEncounters).size !== m.itemEncounters.length
          || m.itemEncounters.some(id => !m.generationContributions?.some(t => t.id === id))) fail();
        this.declarations.set(m.id, [...m.itemEncounters]);
        this.encounterForms.set(m.id, new Set((m.generationContributions ?? []).filter(t => m.itemEncounters!.includes(t.id)).map(t => t.formId)));
      }
      const p = m.itemDrops; if (!p) continue;
      if (!m.itemDataValidators?.[m.id] || typeof p.roll !== 'function' || typeof p.settle !== 'function'
        || !Array.isArray(p.sources) || !p.sources.length || new Set(p.sources).size !== p.sources.length
        || Object.keys(p).some(k => !['sources','roll','settle','uniqueCatalog','statKeys'].includes(k))) fail();
      if(p.statKeys!==undefined && (!Array.isArray(p.statKeys)||p.statKeys.length>16||p.statKeys.some(k=>!validId(k))))fail();
      const catalog = p.uniqueCatalog ?? []; assertItemJson(catalog);
      if (!Array.isArray(catalog) || catalog.length > 128 || new Set(catalog).size !== catalog.length || catalog.some(id => !validId(id) || !id.startsWith(`${m.id}.`))) fail();
      this.catalogs.set(m.id, [...catalog]); this.state.unique[m.id] = '0'.repeat(32);this.state.catalogs[m.id]=c5Hash({catalog,sources:p.sources});
      for (const source of p.sources) {
        if (!['floor','kill','encounter','vault'].includes(source) || this.providers.has(source)) fail();
        this.providers.set(source, { owner: m.id, provider: p });
      }
    }
  }
  get active(): boolean { return !!(this.providers.size || this.declarations.size); }
  statKeys(source:DropSource):readonly string[]{ return this.providers.get(source)?.provider.statKeys??[]; }
  owner(source: DropSource): string | undefined { return this.providers.get(source)?.owner; }
  has(source: DropSource): boolean { return this.providers.has(source); }
  snapshot(): ItemDropSnapshot { return copyItemValue(this.state); }
  restore(value: ItemDropSnapshot): void { this.validate(value); this.state = copyItemValue(value); }
  validate(s: ItemDropSnapshot): void {
    assertItemJson(s);
    if (!s || !exact(s, 'births,catalogs,encounters,nextEncounterOrdinal,nextEventId,unique') || !integer(s.nextEventId, 1) || !integer(s.nextEncounterOrdinal, 1)
      || !s.catalogs || JSON.stringify(s.catalogs)!==JSON.stringify(this.state.catalogs)
      || !s.unique || Array.isArray(s.unique) || Object.keys(s.unique).sort().join(',') !== [...this.catalogs.keys()].sort().join(',')
      || !s.births || Array.isArray(s.births) || Object.keys(s.births).length > 32768
      || Object.entries(s.births).some(([id, v]) => !/^[1-9]\d*$/.test(id) || !integer(Number(id), 1) || typeof v !== 'boolean')
      || !Array.isArray(s.encounters) || s.encounters.length > 128) fail();
    for (const [owner, bits] of Object.entries(s.unique)) if (typeof bits !== 'string' || !/^[0-9a-f]{32}$/.test(bits)
      || (BigInt(`0x${bits}`) >> BigInt(this.catalogs.get(owner)!.length)) !== 0n) fail();
    const keys = new Set<string>(), subjects = new Set<number>();
    for (const e of s.encounters) {
      if (!exact(e, this.has('encounter')?'depth,formId,key,lost,owner,splitSubjects,subjects':'depth,formId,key,lost,owner,subjects') || !this.declarations.has(e.owner) || typeof e.key !== 'string' || e.key.length > 256 || !e.key.startsWith(`${e.owner}.`)
        || !this.encounterForms.get(e.owner)?.has(e.formId) || !integer(e.depth, 1, 40) || typeof e.lost !== 'boolean' || keys.has(e.key)
        || !Array.isArray(e.subjects) || !e.subjects.length || e.subjects.length > 64 || e.subjects.some(id => !integer(id, 1) || subjects.has(id))
        || this.has('encounter') && (!Array.isArray(e.splitSubjects) || new Set(e.splitSubjects).size!==e.splitSubjects.length
        || e.splitSubjects.some(id=>!e.subjects.includes(id)))) fail();
      keys.add(e.key); for (const id of e.subjects) { if (subjects.has(id)) fail(); subjects.add(id); }
    }
  }
  birth(id: number, fact: CreatureBirth | undefined): void {
    if (!this.has('kill') || Object.prototype.hasOwnProperty.call(this.state.births, id)) return;
    if (Object.keys(this.state.births).length >= 32768) throw new ItemDataError('C6_BUDGET');
    this.state.births[id] = !!fact?.initiallyHostile && ['natural','scripted','test'].includes(fact.creationReason) && !fact.nativeStatsCopied;
  }
  eligible(id: number): boolean { return this.state.births[id] === true; }
  subject(id: number): boolean { return this.state.encounters.some(e => e.subjects.includes(id)); }
  /** Split descendants share the original encounter, but own no ordinary kill
   * reward. This durable provenance is independent of the optional kill service. */
  splitSubject(id:number):boolean {return this.state.encounters.some(e=>e.splitSubjects?.includes(id));}
  lose(id:number):void {const e=this.state.encounters.find(e=>e.subjects.includes(id));if(e)e.lost=true;}
  placement(f: GenerationPlacementFact, exists: (id: number) => boolean): void {
    if (f.result !== 'placed' || !this.declarations.get(f.owner)?.includes(f.templateId)) return;
    if (f.actorId === null || !exists(f.actorId) || this.subject(f.actorId) || this.state.encounters.some(e => e.key === `${f.instanceKey}.encounter`)) fail();
    if (this.state.encounters.length >= 128) throw new ItemDataError('C6_BUDGET');
    this.state.encounters.push({ key: `${f.instanceKey}.encounter`, owner: f.owner, formId: f.formId, depth: f.depth, subjects: [f.actorId], ...(this.has('encounter')?{splitSubjects:[]}:{}), lost: false });
    this.validate(this.state);
  }
  transition(f: BodyTransitionFact, exists: (id: number) => boolean): void {
    if (f.outcome !== 'applied') return;
    const e = this.state.encounters.find(e => e.subjects.includes(f.sourceGroupId)); if (!e) return;
    if (!['split','phase'].includes(f.reason)) return;
    if (!f.resultGroupIds.length || f.resultGroupIds.some(id => !exists(id) || id !== f.sourceGroupId && this.subject(id))) fail();
    if(e.splitSubjects)e.splitSubjects=[...e.splitSubjects.filter(id=>id!==f.sourceGroupId||f.resultGroupIds.includes(id)),
      ...f.resultGroupIds.filter(id=>id!==f.sourceGroupId&&!e.splitSubjects!.includes(id))];
    e.subjects = [...e.subjects.filter(id => id !== f.sourceGroupId), ...f.resultGroupIds]; this.validate(this.state);
  }
  prune(reachable:readonly number[]):void {
    const ids=new Set(reachable);
    for(const id of Object.keys(this.state.births))if(!ids.has(Number(id)))delete this.state.births[id];
    for(const e of [...this.state.encounters])for(const id of [...e.subjects])if(!ids.has(id))this.terminal(id,true);
  }
  validateReferences(ids:readonly number[]):void {
    const present=new Set(ids);
    if(Object.keys(this.state.births).some(id=>!present.has(Number(id)))||this.state.encounters.some(e=>e.subjects.some(id=>!present.has(id))))fail();
  }
  /** Allocate ordinal at terminal consumption, so reverse registration order cannot skip a receipt. */
  terminal(id: number, lost: boolean): { encounterKey: string; encounterOrdinal: number; formId: string } | null {
    delete this.state.births[id];
    const e = this.state.encounters.find(e => e.subjects.includes(id)); if (!e) return null;
    e.lost ||= lost; e.subjects = e.subjects.filter(subject => subject !== id); if(e.splitSubjects)e.splitSubjects=e.splitSubjects.filter(subject=>subject!==id);
    if (e.subjects.length) return null;
    this.state.encounters.splice(this.state.encounters.indexOf(e), 1);
    if (e.lost) return null;
    const encounterOrdinal = this.state.nextEncounterOrdinal++;
    if (!integer(this.state.nextEncounterOrdinal, 1)) fail();
    return { encounterKey: e.key, encounterOrdinal, formId: e.formId };
  }
  prepare(input: DropInput, token: object, revision: number, state: ReadonlyJson,
    pure: <T>(work: () => T) => T, random: (lo: number, hi: number) => number, stat: (id: number, key: string) => number): DropPlanHandle | null {
    const entry = this.providers.get(input.source); if (!entry) return null;
    const event = freezeItemValue(copyItemValue({ ...input, v: 1 as const, eventId: this.state.nextEventId++ })) as DropEvent;
    if (!integer(this.state.nextEventId, 1)) fail();
    let draws = 0, bucket = 0, bucketDraws = 0, active = true;
    let proposal: DropProposal;
    try { proposal = pure(() => entry.provider.roll(event, Object.freeze({ owner: entry.owner, state: freezeItemValue(copyItemValue(state)), event,
      beginItem(index: number) { if (!active || !integer(index, 0, 8) || index < bucket || index===bucket && bucketDraws>0) fail(); bucket = index; bucketDraws = 0; },
      randomInt(lo: number, hi: number) { if (!active || !integer(lo, -2147483648, 2147483647) || !integer(hi, lo, 2147483647) || ++draws > 512 || ++bucketDraws > 64) throw new ItemDataError('C6_BUDGET'); return random(lo, hi); },
      stat(id: number, key: string) { if (!active || id !== event.playerId) fail(); return stat(id, key); }
    }))); } finally { active = false; }
    assertItemJson(proposal, -3);
    if (!exact(proposal, 'converted,gold,items,uniqueIds,v') || proposal.v !== 1 || typeof proposal.converted !== 'boolean'
      || !Array.isArray(proposal.items) || proposal.items.length > 8 || !integer(proposal.gold, 0, 2147483647)
      || !Array.isArray(proposal.uniqueIds) || proposal.uniqueIds.length !== proposal.items.length
      || !proposal.converted && (proposal.items.length > 0 || proposal.gold !== 0)
      || ['floor','vault'].includes(event.source) && (proposal.items.length > 1 || proposal.gold !== 0)) fail();
    const unique = new Set<string>();
    proposal.items.forEach((spec, i) => {
      if (!spec || !exact(spec, 'moduleData,native') || !spec.moduleData || Object.keys(spec.moduleData).join(',') !== entry.owner) fail();
      validateNativeAssembly(spec.native);
      if ((event.source === 'floor' || event.source === 'vault') && spec.native.category !== event.itemClass
        || event.source === 'vault' && event.baseId !== null && spec.native.kind !== event.baseId) fail();
      const uid = proposal.uniqueIds[i]!;
      if (uid !== null) {
        const index = this.catalogs.get(entry.owner)!.indexOf(uid);
        if (index < 0 || unique.has(uid) || (BigInt(`0x${this.state.unique[entry.owner]}`) & (1n << BigInt(index))) !== 0n) fail(); unique.add(uid);
      }
    });
    const handle = Object.freeze({ contract: 'C6-1' as const }) as DropPlanHandle;
    this.plans.set(handle, { event, proposal: freezeItemValue(copyItemValue(proposal)), ...entry, token, revision });
    return handle;
  }
  commit(plan: DropPlanHandle, token: object, revision: number,
    accept: (proposal: DropProposal, event: DropEvent) => DropAcceptance,
    settle: (owner: string, provider: DropProvider, event: DropEvent, accepted: DropAcceptance) => void): DropAcceptance {
    const p = this.plans.get(plan); if (!p || p.token !== token || p.revision !== revision) fail();
    this.plans.delete(plan);
    const accepted = accept(p.proposal, p.event); assertItemJson(accepted);
    if(!exact(accepted,'accepted,acceptedGold,eventId,newUniqueIds,skipped,v') || !Array.isArray(accepted.accepted) || !Array.isArray(accepted.skipped) || !Array.isArray(accepted.newUniqueIds)
      || accepted.accepted.some((a,i)=>!exact(a,'index,itemId')||!integer(a.itemId,1)||i>0&&a.index<=accepted.accepted[i-1]!.index)
      || new Set(accepted.accepted.map(a=>a.itemId)).size!==accepted.accepted.length
      || accepted.skipped.some(a=>!exact(a,'index,reason')||!['capacity','placement'].includes(a.reason)))fail();
    if (accepted.eventId !== p.event.eventId || accepted.v !== 1 || !integer(accepted.acceptedGold, 0, p.proposal.gold)
      || accepted.acceptedGold !== 0 && accepted.acceptedGold !== p.proposal.gold
      || accepted.accepted.length + accepted.skipped.length !== p.proposal.items.length) fail();
    const indexes = [...accepted.accepted, ...accepted.skipped].map(a => a.index);
    if (new Set(indexes).size !== indexes.length || indexes.some(i => !integer(i, 0, p.proposal.items.length - 1))) fail();
    const receipts = accepted.accepted.map(a => p.proposal.uniqueIds[a.index]).filter((id): id is string => id !== null && id !== undefined);
    if (JSON.stringify(receipts) !== JSON.stringify(accepted.newUniqueIds)) fail();
    for (const id of receipts) this.state.unique[p.owner] = (BigInt(`0x${this.state.unique[p.owner]}`) | (1n << BigInt(this.catalogs.get(p.owner)!.indexOf(id)))).toString(16).padStart(32, '0');
    settle(p.owner, p.provider, p.event, freezeItemValue(copyItemValue(accepted)));
    return accepted;
  }
}
