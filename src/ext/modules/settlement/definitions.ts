import data from './data/definitions.json';
import { assertSettlementPack, type SettlementPack } from './schema';
import { extensionDataFingerprint } from '../../fingerprint';
export const SETTLEMENT_VERSION = '1.1.0' as const;
export function loadSettlementPack(): SettlementPack {
  const p = structuredClone(data);
  assertSettlementPack(p);
  return p;
}
export const getSettlementIdentity = (p = loadSettlementPack()) => ({
  schema: 1,
  version: SETTLEMENT_VERSION,
  fingerprint: extensionDataFingerprint(p)
});
