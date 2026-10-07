import data from './data/definitions.json';
import { extensionDataFingerprint } from '../../fingerprint';
import type { WorldDefinitionPack } from '../../worldSdk';
import { assertCraftingPack } from './schema';
import type { CraftingPack } from './types';

export const CRAFTING_VERSION = '1.0.0' as const;

export function loadCraftingPack(): CraftingPack {
  const pack = structuredClone(data);
  assertCraftingPack(pack);
  return pack;
}

export function getCraftingPackIdentity(pack: CraftingPack = loadCraftingPack()) {
  assertCraftingPack(pack);
  return {
    schema: 1,
    version: CRAFTING_VERSION,
    fingerprint: extensionDataFingerprint(pack)
  };
}

/** The SDK owns runtime behavior; only the mechanical definitions cross this boundary. */
export function toWorldDefinitionPack(pack: CraftingPack): WorldDefinitionPack {
  assertCraftingPack(pack);
  return {
    schema: 1,
    worldSdk: 1,
    items: [...pack.materials, ...pack.tools],
    resourceNodes: pack.resourceNodes,
    stations: pack.stations,
    recipes: pack.recipes,
    startupItems: pack.startupItems
  };
}
