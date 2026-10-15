import { extensionDataFingerprint } from './fingerprint';
import { isStatJson, validStatId } from './stats';
import { validId } from './json';

export interface AttributeCatalogEntry {
  readonly id: string;
  readonly stat: string;
  readonly nameKey: string;
  readonly descriptionKey: string;
  readonly unit: 'rank';
  readonly minimum: number;
  readonly maximum: number;
  readonly equipment: boolean;
}
export interface AttributeCatalog {
  readonly v: 1;
  readonly rulesFingerprint: string;
  readonly attributes: readonly AttributeCatalogEntry[];
  readonly fingerprint: string;
}
export function attributeCatalogFingerprint(attributes: readonly AttributeCatalogEntry[], rulesFingerprint: string): string {
  return extensionDataFingerprint({rulesFingerprint,attributes:attributes.map(({nameKey:_,descriptionKey:__,...entry})=>entry)});
}
export function validateAttributeCatalog(value: unknown): asserts value is AttributeCatalog {
  if (!isStatJson(value) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid attribute catalog');
  const c = value as unknown as AttributeCatalog;
  if (Object.keys(c).sort().join(',') !== 'attributes,fingerprint,rulesFingerprint,v' || c.v !== 1 || !/^sha256:[a-f0-9]{64}$/.test(c.rulesFingerprint) || !Array.isArray(c.attributes) || c.attributes.length > 32
    || c.attributes.some((a,i)=>!a || Object.keys(a).sort().join(',') !== 'descriptionKey,equipment,id,maximum,minimum,nameKey,stat,unit'
      || !validId(a.id) || !validStatId(a.stat) || a.stat !== `growth.attribute:${a.id}` || a.unit !== 'rank'
      || typeof a.nameKey !== 'string' || !a.nameKey.startsWith('ext.') || typeof a.descriptionKey !== 'string' || !a.descriptionKey.startsWith('ext.')
      || a.minimum !== 0 || !Number.isSafeInteger(a.maximum) || a.maximum < 0 || typeof a.equipment !== 'boolean'
      || i > 0 && c.attributes[i-1]!.id >= a.id)
    || attributeCatalogFingerprint(c.attributes,c.rulesFingerprint) !== c.fingerprint) throw new Error('Invalid attribute catalog');
}
