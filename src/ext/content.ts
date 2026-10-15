import type { Json } from './types';
import { isJson, validId } from './json';
import { c5Canonical } from './worldJson';
import { extensionDataFingerprint } from './fingerprint';

/** Pure declarations, assembled once from the exact enabled set before factories publish capabilities. */
export interface ContentContribution {
  readonly schema: 1;
  readonly owner: string;
  readonly target: string;
  readonly version: string;
  readonly fingerprint: string;
  readonly data: Json;
}
export function validateContent(values: readonly ContentContribution[], owner:string, version:string): void {
  c5Canonical(values);
  if(!isJson(values)||!Array.isArray(values)||values.length>8||JSON.stringify(values).length>65536)throw new Error('Invalid content budget');
  const targets=new Set<string>();
  for(const c of values){
    if(!c||Object.keys(c).sort().join(',')!=='data,fingerprint,owner,schema,target,version'||c.schema!==1||c.owner!==owner||c.version!==version||!validId(c.target)||c.target===owner||targets.has(c.target)||extensionDataFingerprint(c.data)!==c.fingerprint)throw new Error('Invalid content contribution');
    targets.add(c.target);
  }
}
