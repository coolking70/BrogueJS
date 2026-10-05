import i18next from 'i18next';
import type { MonsterData } from '../entities/Monster';
import type { Creature } from '../entities/Creature';
import { isJson, validId } from './json';

/** Limited, data-only original species. Native status/relationship/HP rules
 * still apply. Arbitrary abilities and composite bodies are later capabilities. */
export interface NativeFormDefinition {
  readonly id: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly size: 2 | 3;
  readonly char: string;
  readonly color: number;
  readonly hp: number;
  readonly accuracy: number;
  readonly defense: number;
  readonly damage: string;
  readonly moveSpeed: number;
  readonly attackSpeed: number;
  readonly bloodType: 0;
  readonly DFChance: 0;
  readonly DFType: 0;
}
export function validNativeForm(value: unknown, owner: string): value is NativeFormDefinition {
  if (
    !isJson(value) ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !==
      'DFChance,DFType,accuracy,attackSpeed,bloodType,char,color,damage,defense,descriptionKey,hp,id,moveSpeed,nameKey,size'
  )
    return false;
  const v = value as unknown as NativeFormDefinition;
  const n = (x: number, a: number, b: number) => Number.isSafeInteger(x) && x >= a && x <= b;
  return (
    validId(v.id) &&
    v.id.startsWith(`${owner}.`) &&
    typeof v.nameKey === 'string' &&
    v.nameKey.startsWith(`ext.${owner}.`) &&
    typeof v.descriptionKey === 'string' &&
    v.descriptionKey.startsWith(`ext.${owner}.`) &&
    (v.size === 2 || v.size === 3) &&
    typeof v.char === 'string' &&
    [...v.char].length === 1 &&
    n(v.color, 0, 0xffffff) &&
    n(v.hp, 1, 10000) &&
    n(v.accuracy, 0, 100) &&
    n(v.defense, 0, 1000) &&
    typeof v.damage === 'string' &&
    /^\d+-\d+$/.test(v.damage) &&
    +v.damage.split('-')[0]! >= 1 &&
    +v.damage.split('-')[1]! >= +v.damage.split('-')[0]! &&
    +v.damage.split('-')[1]! <= 1000 &&
    n(v.moveSpeed, 1, 1000) &&
    n(v.attackSpeed, 1, 1000) &&
    v.bloodType === 0 &&
    v.DFChance === 0 &&
    v.DFType === 0
  );
}
export function nativeFormData(form: NativeFormDefinition): MonsterData {
  // Names/descriptions are plain data-owned strings. Their exact keys are
  // scanned from installed pack JSON, so a generic foundation reader need
  // not broaden the i18n vocabulary to every key under `ext.*`.
  const text = (key: string): string => {
    for (const language of i18next.languages ?? []) {
      const value: unknown = i18next.getResource(language, 'translation', key);
      if (typeof value === 'string') return value;
    }
    return key;
  };
  return {
    id: form.id,
    name: text(form.nameKey),
    description: text(form.descriptionKey),
    char: form.char,
    color: form.color,
    hp: form.hp,
    damage: form.damage,
    accuracy: form.accuracy,
    defense: form.defense,
    moveSpeed: form.moveSpeed,
    attackSpeed: form.attackSpeed,
    minDepth: 1,
    maxDepth: 40,
    goldDropChance: 0,
    itemDropChance: 0,
    bloodType: form.bloodType,
    DFChance: form.DFChance,
    DFType: form.DFType
  };
}
/** Derived per-actor session binding. Definitions remain the enabled module's
 * immutable declarations, never a global catalog or serialized second truth. */
const catalogs = new WeakMap<Creature, readonly NativeFormDefinition[]>();
export function bindNativeForms(actor: Creature, forms?: readonly NativeFormDefinition[]): void {
  if (forms?.length) catalogs.set(actor, forms);
  else catalogs.delete(actor);
}
export function nativeFormsFor(actor: Creature): readonly NativeFormDefinition[] {
  return catalogs.get(actor) ?? [];
}
export function nativeFormFor(actor: Creature, id: string): NativeFormDefinition | undefined {
  return nativeFormsFor(actor).find((f) => f.id === id);
}
