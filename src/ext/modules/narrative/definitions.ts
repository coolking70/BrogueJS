import type { ExtensionRulesIdentity } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import definitions from './data/definitions.json';
import portraits from './data/portraits.json';
import locale from './locales/zh_CN.json';
import { loadNarrativePack } from './schema';
import type { NarrativePack } from './types';

export const NARRATIVE_VERSION = '1.2.0';
/** Mechanical data alone identifies replay rules. Display assets have their own
 * version and do not silently change the simulation's identity. */
export function getNarrativePackIdentity(): ExtensionRulesIdentity {
    return { schema: 1, version: NARRATIVE_VERSION, fingerprint: extensionDataFingerprint(definitions) };
}
export function loadNarrativeDefinitionPack(): NarrativePack {
    return loadNarrativePack(definitions, portraits, locale);
}
