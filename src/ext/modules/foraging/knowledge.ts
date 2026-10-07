import type { EdibleConsumedFact, EffectIntent } from '../../edibleSdk';
import type { ForagingKind, ForagingPack } from './types';

export const safeUint = (v: unknown, min = 0): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= min;
/** Inspect descriptors before reading, including nested data; never execute an accessor. */
export function dataRecord(value: unknown, keys?: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  const own = Reflect.ownKeys(value);
  return (!keys || own.length === keys.length) && own.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return typeof key === 'string' && (!keys || keys.includes(key)) && !!d && d.enumerable && 'value' in d;
  });
}
function intent(value: unknown): value is EffectIntent {
  if (!dataRecord(value) || typeof value.kind !== 'string') return false;
  switch (value.kind) {
    case 'none': case 'explosive': return dataRecord(value, ['kind']);
    case 'heal-fraction': return dataRecord(value, ['kind', 'percent', 'min']) && safeUint(value.percent, 1) && value.percent <= 100 && safeUint(value.min);
    case 'status': return dataRecord(value, ['kind', 'status', 'turns']) && typeof value.status === 'string' &&
      ['poisoned', 'hallucinating', 'confused', 'nauseous', 'telepathy', 'darkness', 'haste', 'paralyzed', 'slumber'].includes(value.status) && safeUint(value.turns, 1);
    case 'status-and-satiety': return dataRecord(value, ['kind', 'status', 'turns', 'satietyLoss', 'floor']) &&
      value.status === 'nauseous' && safeUint(value.turns, 1) && safeUint(value.satietyLoss, 1) && safeUint(value.floor);
    case 'temp-stat': return dataRecord(value, ['kind', 'turns', 'player', 'other']) && safeUint(value.turns, 1) &&
      dataRecord(value.player, ['key', 'value']) && typeof value.player.key === 'string' && Number.isSafeInteger(value.player.value) &&
      dataRecord(value.other, ['key', 'category', 'valueBp']) && typeof value.other.key === 'string' &&
      ['more', 'increased'].includes(value.other.category as string) && Number.isSafeInteger(value.other.valueBp);
    default: return false;
  }
}
export function validConsumedFact(value: unknown): value is EdibleConsumedFact {
  try {
    if (!dataRecord(value, ['owner', 'factId', 'operation', 'eaterId', 'feederId', 'definitionId', 'nativeFood',
      'resolvedIntent', 'outcome', 'hpBefore', 'maxHp', 'visibleToPlayer', 'tick']) || value.owner !== 'foraging' ||
      !safeUint(value.factId, 1) || !['eat', 'feed'].includes(value.operation as string) || !safeUint(value.eaterId, 1) ||
      !(value.feederId === null || safeUint(value.feederId, 1)) ||
      !(value.definitionId === null || typeof value.definitionId === 'string') ||
      ![null, 'ration_of_food', 'mango'].includes(value.nativeFood as string | null) ||
      !intent(value.resolvedIntent) || !safeUint(value.hpBefore) || !safeUint(value.maxHp, 1) || value.hpBefore > value.maxHp ||
      typeof value.visibleToPlayer !== 'boolean' || !safeUint(value.tick) ||
      !dataRecord(value.outcome, ['intent', 'applied', 'newlyStarted', 'immune', 'notApplicable', 'hpGained', 'satietyGained', 'satietyLost'])) return false;
    const o = value.outcome;
    return o.intent === value.resolvedIntent.kind && ['applied', 'newlyStarted', 'immune', 'notApplicable'].every(k => typeof o[k] === 'boolean') &&
      ['hpGained', 'satietyGained', 'satietyLost'].every(k => safeUint(o[k]));
  } catch { return false; }
}

export type ForagingForm = 'raw' | 'roasted';
/** The predicate follows observed facts, not whether a duration happened to increase. */
export function shouldReveal(kind: ForagingKind, form: ForagingForm, fact: EdibleConsumedFact): boolean {
  try {
    if (!validConsumedFact(fact) || !dataRecord(kind) || !['raw', 'roasted'].includes(form) ||
      fact.outcome.immune || fact.outcome.notApplicable || fact.resolvedIntent.kind === 'none' ||
      (fact.operation === 'feed' && (kind.companionReveal !== true || !fact.visibleToPlayer))) return false;
    switch (kind.reveal) {
      case 'always': return true;
      case 'if-injured': return fact.hpBefore < fact.maxHp;
      case 'if-not-already': return fact.outcome.newlyStarted;
      default: return false;
    }
  } catch { return false; }
}
export function inspectConsumedFact(fact: unknown, pack: ForagingPack) {
  if (!validConsumedFact(fact)) return null;
  if ((fact.definitionId === null && fact.nativeFood !== null) || fact.definitionId === 'foraging.char')
    return { fact, kind: null, form: null, raw: null, knownNameKey: null, revealed: false } as const;
  const group = pack.knowledgeGroups[0];
  const member = group?.kinds.find(k => k.raw === fact.definitionId || k.roasted === fact.definitionId);
  const kind = member && pack.kinds.find(k => k.id === member.id);
  if (!kind || !member) return null;
  const form = member.raw === fact.definitionId ? 'raw' : 'roasted';
  return { fact, kind, form, raw: member.raw, knownNameKey: member.knownNameKey, revealed: shouldReveal(kind, form, fact) };
}
