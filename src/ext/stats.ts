/** Foundation stat declarations. Content providers receive detached facts only. */
import i18next from 'i18next';
import { validId } from './json';
import type { ActorFacts, ReadonlyJson } from './types';

export type StatLayer =
  | 'base'
  | 'intrinsic'
  | 'equipment'
  | 'character'
  | 'temporary'
  | 'environment';
export const STAT_LAYERS: readonly StatLayer[] = [
  'base',
  'intrinsic',
  'equipment',
  'character',
  'temporary',
  'environment'
];
export type StatCategory = 'override' | 'flat' | 'increased' | 'more' | 'clamp';
export interface StatRational { readonly numerator: number; readonly denominator: number }
export type StatRounding = 'floor' | 'nearest-half-away' | 'ceil';
export interface StatKeyDeclaration {
  readonly id: string;
  readonly owner: string;
  readonly unit: string;
  readonly kind: 'query' | 'materialized';
  readonly minimum: number;
  readonly maximum: number;
  readonly rounding: StatRounding;
  readonly rational?: boolean;
  readonly categories: readonly StatCategory[];
  readonly increased: { readonly minimum: number; readonly maximum: number };
  readonly moreSlots: readonly {
    readonly id: string;
    readonly minimum: number;
    readonly maximum: number;
  }[];
  readonly base?: number;
}
export type StatCondition =
  | { readonly kind: 'attack-kind'; readonly value: 'melee' | 'thrown' }
  | { readonly kind: 'target-tag'; readonly value: string }
  | { readonly kind: 'self-status'; readonly value: string; readonly present?: boolean }
  | { readonly kind: 'adjacent'; readonly value: boolean }
  | {
      readonly kind: 'hp-ratio';
      readonly comparison: 'at-most' | 'at-least';
      readonly value: number;
    };
export interface StatModifierRow {
  readonly stat: string;
  readonly category: StatCategory;
  readonly value: number;
  readonly layer: StatLayer;
  readonly sourceKind: string;
  readonly sourceId: string;
  readonly slot?: string;
  /** Exact decimal factor retained only by the legacy growth translator. */
  readonly legacyFactor?: string;
  readonly priority?: number;
  readonly budget?: {readonly minimum:number;readonly maximum:number};
  /** clamp.value is the lower endpoint; maximum is its upper endpoint. */
  readonly maximum?: number;
  readonly conditions?: readonly StatCondition[];
  readonly grantPolicy?: 'refill-delta';
  /** Unidentified equipment modifiers can be excluded from a known projection. */
  readonly known?: boolean;
}
export interface EquippedStatItem {
  readonly id: number;
  readonly category: number;
  readonly kindKey: string;
  readonly enchant: number;
  readonly identified: boolean;
  readonly runic: { readonly kind: string | null; readonly identified: boolean };
}
export interface PairFacts {
  readonly targetId?: number;
  readonly attackKind?: 'melee' | 'thrown';
  readonly adjacent?: boolean;
  readonly baseValue?: number;
  readonly mode?: 'manual' | 'automatic';
  readonly skillId?: string;
  readonly baseCooldown?: number;
  readonly probabilityRoll?: boolean;
  readonly direct?: boolean;
  readonly immune?: boolean;
  readonly projectileEnchant?:number;
  readonly projectileStrength?:number;
}
export interface StatActorFacts extends ActorFacts {
  readonly statuses: readonly string[];
  readonly tags: readonly string[];
}
export interface StatSourceContext {
  readonly playerId: number;
  readonly state: ReadonlyJson;
  readonly facts: Readonly<PairFacts>;
  getComponent(actorId: number, name: string): ReadonlyJson | undefined;
  equippedItems(): readonly EquippedStatItem[];
  /** Detached L0 template values, before any source is applied. */
  base(stat: string): number;
}
export interface StatSourceProvider {
  readonly keys?: readonly StatKeyDeclaration[];
  collect(actor: Readonly<StatActorFacts>, context: StatSourceContext): readonly StatModifierRow[];
  revisionHint?(actor: Readonly<StatActorFacts>, context: StatSourceContext): number;
}
export interface StatBreakdown {
  readonly stat: string;
  readonly base: number | StatRational;
  readonly value: number;
  readonly fraction?: StatRational;
  readonly increased: number;
  readonly rows: readonly (StatModifierRow & { readonly owner: string })[];
}
export interface EquipChange {
  readonly equip?: number;
  readonly unequip?: number | readonly number[];
}
export interface StatQuery {
  applied(actorId:number,stat:string):number;
  rational(actorId: number, stat: string, facts?: PairFacts): StatRational;
  value(actorId: number, stat: string, facts?: PairFacts): number;
  breakdown(actorId: number, stat: string, facts?: PairFacts, knownOnly?: boolean): StatBreakdown;
  hypothetical(
    actorId: number,
    change: EquipChange,
    knownOnly: boolean
  ): Readonly<Record<string, number>>;
}
export class StatValidationError extends Error {
  constructor(readonly reason: 'declaration' | 'source' | 'budget' | 'override' | 'condition') {
    super(i18next.t(`ext.stats.errors.${reason}`));
    this.name = 'StatValidationError';
  }
}
const integer = (value: unknown): value is number => Number.isSafeInteger(value);
const CATEGORIES: readonly StatCategory[] = ['override', 'flat', 'increased', 'more', 'clamp'];
/** Unlike general JSON helpers, this boundary must never execute a getter. */
export function isStatJson(value: unknown, seen = new Set<object>()): boolean {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isSafeInteger(value);
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return false;
  const keys = Reflect.ownKeys(value),
    array = Array.isArray(value);
  if (
    array &&
    (keys.length !== value.length + 1 ||
      keys.some(
        (k) =>
          k !== 'length' &&
          (typeof k !== 'string' || !/^(0|[1-9]\d*)$/.test(k) || Number(k) >= value.length)
      ))
  )
    return false;
  seen.add(value);
  for (const k of keys) {
    if (array && k === 'length') continue;
    const d = Object.getOwnPropertyDescriptor(value, k)!;
    if (
      typeof k !== 'string' ||
      ['__proto__', 'constructor', 'prototype'].includes(k) ||
      !d.enumerable ||
      !('value' in d) ||
      !isStatJson(d.value, seen)
    ) {
      seen.delete(value);
      return false;
    }
  }
  seen.delete(value);
  return true;
}
export function validateStatKey(
  value: unknown,
  owner: string
): asserts value is StatKeyDeclaration {
  if (!isStatJson(value) || !value || typeof value !== 'object' || Array.isArray(value))
    throw new StatValidationError('declaration');
  const v = value as unknown as StatKeyDeclaration;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          'id',
          'owner',
          'unit',
          'kind',
          'minimum',
          'maximum',
          'rounding',
          'rational',
          'categories',
          'increased',
          'moreSlots',
          'base'
        ].includes(k)
    ) ||
    !validId(v.id) ||
    v.owner !== owner ||
    !v.id.startsWith(`${owner}.`) ||
    typeof v.unit !== 'string' ||
    !v.unit ||
    !['query', 'materialized'].includes(v.kind) ||
    !integer(v.minimum) ||
    !integer(v.maximum) ||
    v.minimum > v.maximum ||
    !['floor', 'nearest-half-away', 'ceil'].includes(v.rounding) ||
    (v.rational !== undefined && (v.id !== 'native.regeneration' || v.rational !== true)) ||
    !Array.isArray(v.categories) ||
    !v.categories.length ||
    new Set(v.categories).size !== v.categories.length ||
    v.categories.some((c) => !CATEGORIES.includes(c)) ||
    !v.increased ||
    Object.keys(v.increased).sort().join(',') !== 'maximum,minimum' ||
    !integer(v.increased.minimum) ||
    !integer(v.increased.maximum) ||
    v.increased.minimum < -10000 ||
    v.increased.minimum > v.increased.maximum ||
    !Array.isArray(v.moreSlots) ||
    v.moreSlots.length > 16 ||
    new Set(v.moreSlots.map((s) => s.id)).size !== v.moreSlots.length ||
    v.moreSlots.some(
      (s) =>
        Object.keys(s).sort().join(',') !== 'id,maximum,minimum' ||
        !validId(s.id) ||
        !integer(s.minimum) ||
        !integer(s.maximum) ||
        s.minimum < -10000 ||
        s.minimum > s.maximum
    ) ||
    (v.base !== undefined && (!integer(v.base) || v.base < v.minimum || v.base > v.maximum))
  )
    throw new StatValidationError('declaration');
  if (
    v.kind === 'materialized' &&
    ![
      'native.max-hp',
      'native.strength',
      'combat.stamina-capacity',
      'combat.poise-capacity',
      'growth.focus-capacity'
    ].includes(v.id)
  )
    throw new StatValidationError('declaration');
}
export function validateStatRows(
  value: unknown,
  owner: string,
  keys: ReadonlyMap<string, StatKeyDeclaration>
): asserts value is readonly StatModifierRow[] {
  if (!isStatJson(value) || !Array.isArray(value)) throw new StatValidationError('source');
  if (value.length > 256) throw new StatValidationError('budget');
  for (const row of value as StatModifierRow[]) {
    const key = keys.get(row?.stat);
    if (
      !row ||
      Object.keys(row).some(
        (k) =>
          ![
            'stat',
            'category',
            'value',
            'layer',
            'sourceKind',
            'sourceId',
            'slot',
            'legacyFactor',
            'priority',
            'budget',
            'maximum',
            'conditions',
            'grantPolicy',
            'known'
          ].includes(k)
      ) ||
      (row.budget!==undefined && (!isStatJson(row.budget)||Object.keys(row.budget).sort().join(',')!=='maximum,minimum'||!integer(row.budget.minimum)||!integer(row.budget.maximum)||row.budget.minimum>row.budget.maximum||!['flat','increased'].includes(row.category))) ||
      !key ||
      !key.categories.includes(row.category) ||
      !integer(row.value) ||
      (row.legacyFactor!==undefined && (owner!=='growth'||row.category!=='more'||row.sourceKind!=='growth-modifier'||typeof row.legacyFactor!=='string'||!Number.isFinite(Number(row.legacyFactor))||Number(row.legacyFactor)<0||String(Number(row.legacyFactor))!==row.legacyFactor)) ||
      !STAT_LAYERS.includes(row.layer) ||
      !validId(row.sourceId) ||
      !validId(row.sourceKind) ||
      (row.layer === 'base' && owner !== key.owner) ||
      (row.known !== undefined && typeof row.known !== 'boolean') ||
      (row.category === 'more' && (!row.slot || !key.moreSlots.some((s) => s.id === row.slot))) ||
      (row.category !== 'more' && row.slot !== undefined) ||
      (row.priority !== undefined && (row.category !== 'override' || !integer(row.priority))) ||
      (row.category === 'clamp' && (!integer(row.maximum) || row.value > row.maximum)) ||
      (row.category !== 'clamp' && row.maximum !== undefined) ||
      (row.grantPolicy !== undefined &&
        (row.grantPolicy !== 'refill-delta' ||
          owner !== 'growth' ||
          row.layer !== 'character' ||
          key.kind !== 'materialized'))
    )
      throw new StatValidationError('source');
    if (
      row.conditions !== undefined &&
      (key.kind === 'materialized' || !Array.isArray(row.conditions) || row.conditions.length > 16)
    )
      throw new StatValidationError('condition');
    for (const c of row.conditions ?? []) {
      const legal =
        c.kind === 'attack-kind'
          ? ['melee', 'thrown'].includes(c.value) &&
            Object.keys(c).sort().join(',') === 'kind,value'
          : c.kind === 'target-tag'
            ? typeof c.value === 'string' &&
              /^(body\.[a-z][a-z.-]*|abomination|dar|animal|goblin|ogre|dragon|undead|jelly|turret|infernal|mage|waterborne|airborne|fireborne|troll)$/.test(
                c.value
              ) &&
              Object.keys(c).sort().join(',') === 'kind,value'
            : c.kind === 'self-status'
              ? typeof c.value === 'string' &&
                /^[a-z_]+$/.test(c.value) &&
                (c.present === undefined || typeof c.present === 'boolean') &&
                Object.keys(c).every((k) => ['kind', 'value', 'present'].includes(k))
              : c.kind === 'adjacent'
                ? typeof c.value === 'boolean' && Object.keys(c).sort().join(',') === 'kind,value'
                : c.kind === 'hp-ratio'
                  ? ['at-most', 'at-least'].includes(c.comparison) &&
                    integer(c.value) &&
                    c.value >= 0 &&
                    c.value <= 10000 &&
                    Object.keys(c).sort().join(',') === 'comparison,kind,value'
                  : false;
      if (!legal) throw new StatValidationError('condition');
    }
  }
}

export function validatePairFacts(facts: unknown): asserts facts is PairFacts {
  if (!isStatJson(facts) || !facts || typeof facts !== 'object' || Array.isArray(facts))
    throw new StatValidationError('condition');
  const v = facts as PairFacts;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          'targetId',
          'attackKind',
          'adjacent',
          'baseValue',
          'mode',
          'skillId',
          'baseCooldown',
          'probabilityRoll',
          'direct',
          'immune', 'projectileEnchant', 'projectileStrength'
        ].includes(k)
    ) ||
    (v.targetId !== undefined && (!integer(v.targetId) || v.targetId < 1)) ||
    (v.attackKind !== undefined && !['melee', 'thrown'].includes(v.attackKind)) ||
    (v.mode !== undefined && !['manual', 'automatic'].includes(v.mode)) ||
    (v.skillId !== undefined && !validId(v.skillId)) ||
    (v.projectileEnchant!==undefined&&!integer(v.projectileEnchant)) ||
    (v.projectileStrength!==undefined&&(!integer(v.projectileStrength)||v.projectileStrength<0)) ||
    (v.baseValue !== undefined && !integer(v.baseValue)) ||
    (v.baseCooldown !== undefined && (!integer(v.baseCooldown) || v.baseCooldown < 0)) ||
    ['adjacent', 'probabilityRoll', 'direct', 'immune'].some(
      (k) => k in v && typeof (v as Record<string, unknown>)[k] !== 'boolean'
    )
  )
    throw new StatValidationError('condition');
}
export function validateEquipChange(change: unknown): asserts change is EquipChange {
  if (!isStatJson(change) || !change || typeof change !== 'object' || Array.isArray(change))
    throw new StatValidationError('source');
  const v = change as EquipChange,
    ids = v.unequip === undefined ? [] : Array.isArray(v.unequip) ? v.unequip : [v.unequip];
  if (
    Object.keys(v).some((k) => k !== 'equip' && k !== 'unequip') ||
    (v.equip !== undefined && (!integer(v.equip) || v.equip < 1)) ||
    ids.length > 4 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !integer(id) || id < 1)
  )
    throw new StatValidationError('source');
}

/** Pure foundation scalar facade for detached module previews/source preparation. */
export { evaluateStat, decimalStatFraction, roundStatFraction, safeStatRational } from '../engine/Stats/StatPipeline';
