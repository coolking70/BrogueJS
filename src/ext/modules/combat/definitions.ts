import type { ExtensionRulesIdentity } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import definitions from './data/definitions.json';
import locale from './locales/zh_CN.json';
import { loadCombatPack } from './schema';
import type { CombatPack } from './types';

export const COMBAT_VERSION = '1.5.0';
/** Only mechanical JSON participates. Object key order is canonicalized by the
 * foundation fingerprint helper; array order remains part of rule identity. */
export function getCombatPackIdentity(): ExtensionRulesIdentity {
    return Object.freeze({ schema: 1, version: COMBAT_VERSION, fingerprint: extensionDataFingerprint(definitions) });
}
export function loadCombatDefinitionPack(): CombatPack { return loadCombatPack(definitions, locale); }
