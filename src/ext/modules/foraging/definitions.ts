import data from './data/definitions.json';
import { extensionDataFingerprint } from '../../fingerprint';
import { assertForagingPack } from './schema';
import type { ForagingPack, ForagingWorldPack } from './types';

export const FORAGING_VERSION = '1.0.0' as const;

export function loadForagingPack(): ForagingPack {
  const pack = structuredClone(data);
  assertForagingPack(pack);
  return pack;
}

export function getForagingPackIdentity(pack: ForagingPack = loadForagingPack()) {
  assertForagingPack(pack);
  return { schema: 1, version: FORAGING_VERSION, fingerprint: extensionDataFingerprint(pack) };
}

/** The SDK receives an independent copy of mechanics, in the authoritative array order. */
export function toWorldDefinitionPack(pack: ForagingPack): ForagingWorldPack {
  assertForagingPack(pack);
  return structuredClone({
    schema: 1 as const,
    worldSdk: 1 as const,
    items: [],
    resourceNodes: pack.resourceNodes,
    stations: [],
    recipes: [],
    startupItems: null,
    edibleItems: pack.edibleItems,
    knowledgeGroups: pack.knowledgeGroups,
    placementGroups: pack.placementGroups,
    actorNeeds: pack.actorNeeds
  });
}
