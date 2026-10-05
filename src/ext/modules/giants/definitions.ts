import data from './data/definitions.json';
import { assertGiantsPack } from './schema';
import { extensionDataFingerprint } from '../../fingerprint';
import type { GiantsPack } from './types';
export const GIANTS_VERSION = '1.0.0';
export function loadGiantsDefinitionPack(): GiantsPack {
  const pack = structuredClone(data);
  assertGiantsPack(pack);
  return pack;
}
export function getGiantsPackIdentity() {
  return {
    schema: 1,
    version: GIANTS_VERSION,
    fingerprint: extensionDataFingerprint(loadGiantsDefinitionPack())
  };
}
