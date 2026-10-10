import type { Json, ExtensionRulesIdentity } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import type { RaidRules } from '../../settlementRaids';
export const RAID_RULES: RaidRules = Object.freeze({
  period: 1000,
  grace: 32000,
  cooldown: 32000,
  warning: 2000,
  threshold: 64,
  maxActors: 8,
  maxEvents: 4,
  rosters: [
    { minDepth: 1, ids: ['rat', 'kobold'] },
    { minDepth: 4, ids: ['goblin', 'jackal'] },
    { minDepth: 9, ids: ['goblin', 'ogre'] },
    { minDepth: 16, ids: ['ogre', 'troll'] }
  ]
});
export function validRaidConfiguration(value: unknown): value is Json {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).join(',') === 'raids' &&
    typeof (value as { raids: unknown }).raids === 'boolean'
  );
}
export function raidIdentity(
  configuration: Json,
  base: ExtensionRulesIdentity
): ExtensionRulesIdentity {
  if (!validRaidConfiguration(configuration)) throw new Error('Invalid raid configuration');
  return {
    ...base,
    fingerprint: extensionDataFingerprint({ base, configuration, rules: RAID_RULES })
  };
}
