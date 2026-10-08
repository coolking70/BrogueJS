import { assertConstructionPack, assertCampPolicy } from '../../constructionSchema';
import { assertResidentPolicy } from '../../residentSchema';
import zhCN from './locales/zh_CN.json';
import { exact } from '../../worldBasics';
import { c5Canonical } from '../../worldJson';
import type { WorldDefinitionPack } from '../../structureTypes';
import type { CampPolicy } from '../../structureSdk';
export interface SettlementPack {
  schema: 1;
  moduleVersion: '1.1.0';
  rulesVersion: '1.1.0';
  world: WorldDefinitionPack;
  camp: CampPolicy;
  residents: import("../../residentSdk").ResidentPolicy;
}
export function assertSettlementPack(v: unknown): asserts v is SettlementPack {
  c5Canonical(v);
  exact(v, 'schema,moduleVersion,rulesVersion,world,camp,residents', 'pack');
  const p = v as unknown as SettlementPack;
  if (p.schema !== 1 || p.moduleVersion !== '1.1.0' || p.rulesVersion !== '1.1.0')
    throw new Error('Invalid settlement version');
  assertResidentPolicy(p.residents,"settlement");
  assertConstructionPack(p.world, 'settlement', new Set(Object.keys(zhCN)));
  assertCampPolicy(p.camp, 'settlement', p.world, new Set(Object.keys(zhCN)));
}
