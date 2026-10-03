import type { ExtensionModule, Json } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import { initialNarrativeState, isNarrativeState } from './state';
import type { NarrativePack } from './types';
import { assertLoadedNarrativePack } from './schema';

/** 2a1 installs a validated package and its private save namespace. The pure
 * planner is deliberately not a player-facing command or an engine hook:
 * world targets/input gating arrive in 2b, committed facts/reward flush in 2c.
 * No mutable context, world field, growth implementation or RNG is imported. */
export function createNarrativeModuleFromPack(pack: NarrativePack): ExtensionModule {
    assertLoadedNarrativePack(pack);
    return {
        id: 'narrative', version: pack.moduleVersion,
        rules: { schema: pack.schema, version: pack.rulesVersion, fingerprint: extensionDataFingerprint(pack) },
        initialState: () => initialNarrativeState(pack) as unknown as Json,
        validateState: (value): value is Json => isNarrativeState(value, pack),
    };
}
