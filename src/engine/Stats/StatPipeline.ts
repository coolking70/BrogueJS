import {
  STAT_LAYERS,
  StatValidationError,
  validateStatKey,
  validateStatRows,
  validatePairFacts,
  validateEquipChange
} from '../../ext/stats';
import type {
  EquipChange,
  PairFacts,
  StatActorFacts,
  StatBreakdown,
  StatKeyDeclaration,
  StatModifierRow,
  StatQuery,
  StatRounding, StatRational
} from '../../ext/stats';
import { compareCodePoints } from '../../ext/worldJson';

export interface StatFraction {
  readonly numerator: bigint;
  readonly denominator: bigint;
}
export type OwnedStatRow = StatModifierRow & { readonly owner: string };
export interface StatPipelineHost {
  beforeRead?(actorId:number):void;
  nativeSignature?(actorId:number):string;
  actor(actorId: number): Readonly<StatActorFacts>;
  revision(actorId: number): number;
  base(
    actorId: number,
    stat: string,
    dependency: (stat: string) => number,
    facts: PairFacts,
    change?: EquipChange,
    knownOnly?: boolean
  ): number | StatRational;
  collect(
    actorId: number,
    facts: PairFacts,
    change?: EquipChange,
    knownOnly?: boolean,
    queryStat?: string
  ): readonly OwnedStatRow[];
  nativeRows?(actorId:number,stat:string,dependency:(stat:string)=>number,facts:PairFacts,change?:EquipChange,knownOnly?:boolean):readonly OwnedStatRow[];
  readonly debug?: boolean;
  applied?(actorId:number,key:string):number;
}
function frozen<T>(v: T): T {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) {
    Object.values(v).forEach(frozen);
    Object.freeze(v);
  }
  return v;
}
function bound(value: bigint, min: number, max: number): bigint {
  return value < BigInt(min) ? BigInt(min) : value > BigInt(max) ? BigInt(max) : value;
}
export function roundStatFraction(v: StatFraction, mode: StatRounding): number {
  if (v.denominator <= 0n) throw new StatValidationError('source');
  const n = v.numerator,
    d = v.denominator,
    r = n % d;
  let q = n / d;
  if (mode === 'floor' && r < 0n) q--;
  if (mode === 'ceil' && r > 0n) q++;
  if (mode === 'nearest-half-away' && (r < 0n ? -r : r) * 2n >= d) q += n < 0n ? -1n : 1n;
  const out = Number(q);
  if (!Number.isSafeInteger(out)) throw new StatValidationError('source');
  return out === 0 ? 0 : out;
}
export function safeStatRational(v: StatFraction): StatRational {
  let a = v.numerator < 0n ? -v.numerator : v.numerator, b = v.denominator;
  if (b <= 0n) throw new StatValidationError('source');
  while (b) { const r = a % b; a = b; b = r; }
  const n = Number(v.numerator / a), d = Number(v.denominator / a);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new StatValidationError('source');
  return Object.freeze({ numerator: n === 0 ? 0 : n, denominator: d });
}
/** Interpret definition decimals exactly, without intermediate Number products. */
export function decimalStatFraction(value:number):StatFraction {
  if(!Number.isFinite(value))throw new StatValidationError('source');
  const [digits,exponent='0']=String(value).split('e'),parts=digits!.split('.'),places=parts[1]?.length??0;
  let n=BigInt(parts.join('')),d=10n**BigInt(places);const e=Number(exponent);
  if(e>0)n*=10n**BigInt(e);else if(e<0)d*=10n**BigInt(-e);
  return {numerator:n,denominator:d};
}
function order(a: OwnedStatRow, b: OwnedStatRow): number {
  return (
    STAT_LAYERS.indexOf(a.layer) - STAT_LAYERS.indexOf(b.layer) ||
    compareCodePoints(a.owner, b.owner) ||
    compareCodePoints(a.sourceId, b.sourceId) ||
    compareCodePoints(a.sourceKind, b.sourceKind)
  );
}
function validateStatOverrides(rows:readonly OwnedStatRow[]):void {
  const overrides=new Map<string,(number|undefined)[]>();
  for(const row of rows)if(row.category==='override'){
    const values=overrides.get(row.stat)??[];
    if(values.length&&(row.priority===undefined||values.includes(undefined)||values.includes(row.priority)))throw new StatValidationError('override');
    values.push(row.priority);overrides.set(row.stat,values);
  }
}
export function validateStatBudget(rows: readonly OwnedStatRow[]): void {
  if (rows.length > 256) throw new StatValidationError('budget');
  const sources=new Map<string,Set<string>>();
  for(const row of rows){
    const set=sources.get(row.stat)??new Set<string>();
    set.add(`${row.owner}:${row.sourceKind}:${row.sourceId}`);sources.set(row.stat,set);
    if(set.size>64)throw new StatValidationError('budget');
  }
  validateStatOverrides(rows);
}
/** Exact scalar kernel: there is no intermediate rounding or Number multiplication. */
export function evaluateStat(
  key: StatKeyDeclaration,
  base: number | StatRational,
  input: readonly OwnedStatRow[],
  exactMore:ReadonlyMap<string,StatFraction>=new Map(),
  participantRows?:readonly (readonly OwnedStatRow[])[],
  nativeBounds = true
): StatBreakdown {
  if (typeof base === 'number' ? !Number.isSafeInteger(base) : !Number.isSafeInteger(base.numerator) || !Number.isSafeInteger(base.denominator) || base.denominator < 1) throw new StatValidationError('source');
  if(participantRows){participantRows.forEach(validateStatBudget);validateStatOverrides(input);}else validateStatBudget(input);
  const rows = [...input].sort(order);
  let b = BigInt(typeof base === 'number' ? base : base.numerator),
    bd = BigInt(typeof base === 'number' ? 1 : base.denominator),
    flat = 0n,
    increased = 0n,
    min = key.minimum,
    max = key.maximum;
  if (key.owner === 'native' && (!nativeBounds || !rows.some(row => row.owner !== 'native'))) {
    min = Number.MIN_SAFE_INTEGER;
    max = Number.MAX_SAFE_INTEGER;
  } else if (key.id === 'native.attack-speed') {
    // CE statuses/mutations may already exceed 400. Modules cannot truncate
    // that identity merely by adding a zero row.
    const native = evaluateStat(key, base, rows.filter(row => row.owner === 'native'), exactMore, undefined, false).value;
    max = Math.max(400, native);
  }
  const overrides = rows
    .filter((r) => r.category === 'override')
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  if (overrides.length) { b = BigInt(overrides[0]!.value); bd = 1n; }
  const slots = new Map<string, bigint>();
  const legacySlots=new Map<string,StatFraction>();
  for(const row of rows)if(row.category==='more'){
    const factor=row.legacyFactor!==undefined?decimalStatFraction(Number(row.legacyFactor)):{numerator:10000n+BigInt(row.value),denominator:10000n};
    const prior=legacySlots.get(row.slot!)??{numerator:1n,denominator:1n};
    legacySlots.set(row.slot!,{numerator:prior.numerator*factor.denominator+(factor.numerator-factor.denominator)*prior.denominator,denominator:prior.denominator*factor.denominator});
  }
  for (const r of rows) {
    if (r.category === 'flat' && !r.budget) flat += BigInt(r.value);
    if (r.category === 'increased' && !r.budget) increased += BigInt(r.value);
    if (r.category === 'more') slots.set(r.slot!, (slots.get(r.slot!) ?? 0n) + BigInt(r.value));
    if (r.category === 'clamp') {
      min = Math.max(min, r.value);
      max = Math.min(max, r.maximum!);
    }
  }
  const budgets=new Map<string,{category:string;minimum:number;maximum:number;sum:bigint}>();
  for(const row of rows)if(row.budget){const id=`${row.owner}:${row.category}:${row.budget.minimum}:${row.budget.maximum}`,b=budgets.get(id)??{category:row.category,...row.budget,sum:0n};b.sum+=BigInt(row.value);budgets.set(id,b);}
  for(const b of budgets.values()){const amount=bound(b.sum,b.minimum,b.maximum);if(b.category==='flat')flat+=amount;else increased+=amount;}
  if (min > max) throw new StatValidationError('source');
  const pool = bound(increased, key.increased.minimum, key.increased.maximum);
  let numerator = (b + flat * bd) * (10000n + pool),
    denominator = 10000n * bd;
  for (const slot of key.moreSlots)
    if (slots.has(slot.id)) {
      const exact=exactMore.get(slot.id)??(rows.some(row=>row.slot===slot.id&&row.legacyFactor!==undefined)?legacySlots.get(slot.id):undefined);
      if(exact){let n=exact.numerator,d=exact.denominator;if(d<=0n)throw new StatValidationError('source');const lo=10000n+BigInt(slot.minimum),hi=10000n+BigInt(slot.maximum);if(n*10000n<lo*d){n=lo;d=10000n;}else if(n*10000n>hi*d){n=hi;d=10000n;}numerator*=n;denominator*=d;}
      else {numerator *= 10000n + bound(slots.get(slot.id)!, slot.minimum, slot.maximum);denominator *= 10000n;}
    }
  if (numerator < BigInt(min) * denominator) numerator = BigInt(min) * denominator;
  if (numerator > BigInt(max) * denominator) numerator = BigInt(max) * denominator;
  return frozen({
    stat: key.id,
    base,
    value: roundStatFraction({ numerator, denominator }, key.rounding),
    ...(key.rational ? { fraction: safeStatRational({numerator,denominator}) } : {}),
    increased: Number(pool),
    rows
  });
}
export function statConditionsMatch(
  row: StatModifierRow,
  self: Readonly<StatActorFacts>,
  target: Readonly<StatActorFacts> | undefined,
  facts: PairFacts
): boolean {
  return (row.conditions ?? []).every((c) => {
    if (c.kind === 'attack-kind') return c.value === facts.attackKind;
    if (c.kind === 'target-tag') return target?.tags.includes(c.value) === true;
    if (c.kind === 'self-status') return self.statuses.includes(c.value) === (c.present ?? true);
    if (c.kind === 'adjacent') return facts.adjacent === c.value;
    const left = BigInt(self.hp) * 10000n,
      right = BigInt(self.maxHp) * BigInt(c.value);
    return c.comparison === 'at-most' ? left <= right : left >= right;
  });
}
/** Fixed foundation DAG; module declarations cannot add edges. */
export class StatPipeline implements StatQuery {
  readonly keys = new Map<string, StatKeyDeclaration>();
  private readonly cache = new Map<
    number,
    Map<string, { revision: number; value: StatBreakdown }>
  >();
  private readonly sourceCache=new Map<number,Map<string,{raw:readonly OwnedStatRow[];active:readonly OwnedStatRow[]}>>();
  private readonly validatedSources=new Map<number,string>();
  readonly diagnostics = { hits: 0, misses: 0 };
  constructor(
    private readonly host: StatPipelineHost,
    keys: readonly StatKeyDeclaration[],
    readonly dependencies: Readonly<Record<string, readonly string[]>> = {}
  ) {
    for (const key of keys) this.register(key, key.owner);
    const visiting = new Set<string>(),
      done = new Set<string>();
    const visit = (key: string) => {
      if (visiting.has(key) || !this.keys.has(key)) throw new StatValidationError('declaration');
      if (done.has(key)) return;
      visiting.add(key);
      for (const dep of dependencies[key] ?? []) visit(dep);
      visiting.delete(key);
      done.add(key);
    };
    for (const key of this.keys.keys()) visit(key);
  }
  register(key: StatKeyDeclaration, owner: string): void {
    validateStatKey(key, owner);
    if (this.keys.has(key.id)) throw new StatValidationError('declaration');
    if (
      owner !== 'native' &&
      [...this.keys.values()].filter((k) => k.owner === owner).length >= 128
    )
      throw new StatValidationError('budget');
    this.keys.set(key.id, frozen(structuredClone(key)));
    this.validatedSources.clear();
  }
  registerProviderKeys(keys: readonly StatKeyDeclaration[], owner: string): void {
    if (keys.length + [...this.keys.values()].filter((k) => k.owner === owner).length > 128)
      throw new StatValidationError('budget');
    const ids = new Set<string>();
    for (const key of keys) {
      validateStatKey(key, owner);
      if (this.keys.has(key.id) || ids.has(key.id)) throw new StatValidationError('declaration');
      ids.add(key.id);
    }
    for (const key of keys) this.register(key, owner);
  }
  clear(actorId?: number): void {
    if (actorId === undefined) {this.cache.clear();this.sourceCache.clear();}
    else {this.cache.delete(actorId);this.sourceCache.delete(actorId);}
  }
  cacheSize(actorId: number): number {
    return this.cache.get(actorId)?.size ?? 0;
  }
  private rows(
    actorId: number,
    facts: PairFacts,
    change?: EquipChange,
    knownOnly = false,
    suppliedRows?: readonly OwnedStatRow[],
    queryStat?: string,
    raw = false
  ): readonly OwnedStatRow[] {
    const self=this.host.actor(actorId),target=facts.targetId===undefined?undefined:this.host.actor(facts.targetId);
    const stamp=JSON.stringify([this.host.revision(actorId),facts,facts.baseValue===undefined?undefined:queryStat,facts.targetId===undefined?0:this.host.revision(facts.targetId),self,target]);
    const reusable=!suppliedRows&&!this.host.debug&&!change&&!knownOnly;
    let cached=this.sourceCache.get(actorId);if(reusable&&cached?.has(stamp)){const value=cached.get(stamp)!;return raw?value.raw:value.active;}
    const rows = suppliedRows??this.host.collect(actorId, frozen({ ...facts }), change, knownOnly, queryStat);
    const owners = new Set(rows.map((r) => r.owner));
    for (const owner of owners) {
      const owned = rows.filter((r) => r.owner === owner).map(({ owner: _, ...row }) => row);
      validateStatRows(owned, owner, this.keys);
    }
    validateStatBudget(rows);
    const active=rows.filter(r=>(!knownOnly||r.known!==false)&&statConditionsMatch(r,self,target,facts));
    if(reusable){if(!cached){if(this.sourceCache.size>=128)this.sourceCache.delete(this.sourceCache.keys().next().value!);cached=new Map();this.sourceCache.set(actorId,cached);}cached.set(stamp,{raw:rows,active});if(cached.size>128)cached.delete(cached.keys().next().value!);}
    return raw?rows:active;
  }
  private compute(
    actorId: number,
    stat: string,
    facts: PairFacts,
    change?: EquipChange,
    knownOnly = false,
    proposedRows?: readonly OwnedStatRow[]
  ): StatBreakdown {
    const key = this.keys.get(stat);
    if (!key) throw new StatValidationError('declaration');
    const active = new Set<string>(),
      memo = new Map<string, number>(),
      rows = proposedRows??this.rows(actorId, facts, change, knownOnly, undefined, stat);
    const solve = (id: string): number => {
      if (memo.has(id)) return memo.get(id)!;
      if (active.has(id)) throw new StatValidationError('declaration');
      active.add(id);
      const declaration = this.keys.get(id);
      if (!declaration) throw new StatValidationError('declaration');
      for (const dep of this.dependencies[id] ?? []) solve(dep);
      const value = evaluateStat(
        declaration,
        this.host.base(
          actorId,
          id,
          (dep) => {
            if (!(this.dependencies[id] ?? []).includes(dep))
              throw new StatValidationError('declaration');
            return solve(dep);
          },
          facts,
          change,
          knownOnly
        ),
        [...rows.filter((r) => r.stat === id),...(this.host.nativeRows?.(actorId,id,solve,facts,change,knownOnly)??[])]
      ).value;
      memo.set(id, value);
      active.delete(id);
      return value;
    };
    for (const dep of this.dependencies[stat] ?? []) solve(dep);
    return evaluateStat(
      key,
      this.host.base(
        actorId,
        stat,
        (dep) => {
          if (!(this.dependencies[stat] ?? []).includes(dep))
            throw new StatValidationError('declaration');
          return solve(dep);
        },
        facts,
        change,
        knownOnly
      ),
      [...rows.filter((r) => r.stat === stat),...(this.host.nativeRows?.(actorId,stat,solve,facts,change,knownOnly)??[])]
    );
  }
  applied(actorId:number,key:string):number{this.host.beforeRead?.(actorId);return this.host.applied?.(actorId,key)??0;}
  value(actorId: number, stat: string, facts: PairFacts = {}): number {
    if (this.keys.get(stat)?.rational) throw new StatValidationError('source');
    return this.breakdown(actorId, stat, facts).value;
  }
  rational(actorId: number, stat: string, facts: PairFacts = {}): StatRational {
    const value = this.breakdown(actorId,stat,facts).fraction;
    if (!value) throw new StatValidationError('source');
    return value;
  }
  breakdown(
    actorId: number,
    stat: string,
    facts: PairFacts = {},
    knownOnly = false
  ): StatBreakdown {
    validatePairFacts(facts);
    this.host.beforeRead?.(actorId);
    if(facts.targetId!==undefined)this.host.beforeRead?.(facts.targetId);
    if (knownOnly) return this.compute(actorId, stat, facts, undefined, true);
    const revision = this.host.revision(actorId),
      targetRevision = facts.targetId === undefined ? 0 : this.host.revision(facts.targetId);
    const target = facts.targetId === undefined ? undefined : this.host.actor(facts.targetId),
      self = this.host.actor(actorId);
    // HP/position conditions are frozen target facts, not source revisions.
    const stamp = JSON.stringify([
      stat,
      facts,
      targetRevision,
      self.hp,
      self.maxHp,
      self.x,
      self.y,
      target?.hp,
      target?.maxHp,
      target?.x,
      target?.y
    ]);
    let actorCache = this.cache.get(actorId);
    if (!actorCache) {
      if (this.cache.size >= 128) this.cache.delete(this.cache.keys().next().value!);
      actorCache = new Map();
      this.cache.set(actorId, actorCache);
    }
    const cached = actorCache.get(stamp);
    if (cached?.revision === revision) {
      this.diagnostics.hits++;
      actorCache.delete(stamp);
      actorCache.set(stamp, cached);
      if (
        this.host.debug &&
        JSON.stringify(cached.value) !== JSON.stringify(this.compute(actorId, stat, facts))
      )
        throw new Error(`Stat cache drift: ${actorId}/${stat}`);
      return cached.value;
    }
    this.diagnostics.misses++;
    const value = this.compute(actorId, stat, facts);
    actorCache.delete(stamp);
    actorCache.set(stamp, { revision, value });
    if (actorCache.size > 128) actorCache.delete(actorCache.keys().next().value!);
    return value;
  }
  hypothetical(
    actorId: number,
    change: EquipChange,
    knownOnly: boolean
  ): Readonly<Record<string, number>> {
    validateEquipChange(change);
    change = frozen(structuredClone(change));
    const values: Record<string, number> = {};
    for (const stat of this.keys.keys())
      if (!this.keys.get(stat)!.rational) values[stat] = this.compute(actorId, stat, {}, change, knownOnly).value;
    return frozen(values);
  }
  evaluatePair(
    attackerId: number,
    defenderId: number,
    kind: 'physical-damage' | 'hit',
    facts: PairFacts
  ): number {
    validatePairFacts(facts);
    this.host.beforeRead?.(attackerId);
    this.host.beforeRead?.(defenderId);
    const key = kind === 'hit' ? 'native.hit-chance' : 'native.physical-damage-dealt',
      other = kind === 'hit' ? 'native.evasion' : 'native.physical-damage-taken';
    const declaration = this.keys.get(key);
    if (!declaration || facts.baseValue === undefined) throw new StatValidationError('source');
    const attackFacts = { ...facts, targetId: defenderId },
      defenseFacts = { ...facts, targetId: attackerId };
    // Admission limits belong to each actor, before the two pools merge.
    const attackRows=this.rows(attackerId,attackFacts,undefined,false,undefined,key).filter(row=>row.stat===key),
      defenseRows=this.rows(defenderId,defenseFacts,undefined,false,undefined,other).filter(row=>row.stat===other).map(row=>({...row,stat:key})),
      rows=[...attackRows,...defenseRows];
    if (!rows.length) return facts.baseValue;
    return evaluateStat(declaration,facts.baseValue,rows,new Map(),[attackRows,defenseRows]).value;
  }
  sourceSignature(actorId:number):string {
    // Conditional materialization is forbidden. Only these rows and their
    // dependencies can change maxima; unrelated statuses need no preflight.
    const relevant=new Set([...this.keys.values()].filter(key=>key.kind==='materialized').map(key=>key.id));
    const include=(key:string):void=>{for(const dep of this.dependencies[key]??[])if(!relevant.has(dep)){relevant.add(dep);include(dep);}};
    [...relevant].forEach(include);
    const rows=this.rows(actorId,{}).filter(row=>relevant.has(row.stat));
    const bases=[...this.keys.values()].filter(key=>key.kind==='materialized').map(key=>[key.id,this.host.base(actorId,key.id,()=>{throw new StatValidationError('declaration');},{})]);
    const native=[...relevant].flatMap(key=>this.host.nativeRows?.(actorId,key,dep=>this.compute(actorId,dep,{},undefined,false,rows).value,{})??[]);
    return JSON.stringify([rows,native,bases]);
  }
  validateSources(actorId: number): void {
    // Validate the complete proposed source set, including dependency-generated
    // native rows, before any materialized field is published.
    const rows = [...this.rows(actorId,{},undefined,false,undefined,undefined,true)];
    const active=this.rows(actorId,{},undefined,false,this.host.debug?rows:undefined);
    const nativeSignature=this.host.nativeSignature?.(actorId);
    const signature=nativeSignature===undefined?undefined:JSON.stringify([rows,active,nativeSignature]);
    if(signature!==undefined&&this.validatedSources.get(actorId)===signature)return;
    const proposedKeys=new Set(rows.map(row=>row.stat));
    for(const key of this.keys.values()) if(key.kind==='materialized') proposedKeys.add(key.id);
    for(const key of Object.keys(this.dependencies)) proposedKeys.add(key);
    // Rational output safety is relevant even when its base is the only source.
    for(const key of this.keys.values()) if(key.rational) proposedKeys.add(key.id);
    for (const key of proposedKeys) {
      this.compute(actorId, key, {},undefined,false,active);
      rows.push(...(this.host.nativeRows?.(actorId, key, dep => this.compute(actorId, dep, {},undefined,false,active).value, {}) ?? []));
    }
    validateStatBudget(rows);
    if(signature!==undefined){
      this.validatedSources.delete(actorId);
      this.validatedSources.set(actorId,signature);
      if(this.validatedSources.size>128)this.validatedSources.delete(this.validatedSources.keys().next().value!);
    }
  }
}
