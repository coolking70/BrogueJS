import type { ExtensionModule, Json } from '../../types';
import { extensionDataFingerprint } from '../../fingerprint';
import { assertLoadedCombatPack } from './schema';
import { initialCombatState, isInactiveCombatState } from './state';
import { isCombatAction, isCombatResources } from './components';
import { projectCombatView } from './view';
import type { CombatPack } from './types';

/** Inert installation only. The pure planners are deliberately NOT commands or
 * optional providers until the foundation action/world transaction exists. */
export function createCombatModuleFromPack(pack: CombatPack): ExtensionModule {
    assertLoadedCombatPack(pack);
    return {
        id: 'combat', version: pack.moduleVersion,
        rules: { schema: pack.schema, version: pack.rulesVersion, fingerprint: extensionDataFingerprint(pack) },
        initialState: () => initialCombatState() as unknown as Json,
        validateState: (value): value is Json => isInactiveCombatState(value),
        componentValidators: { resources: value => isCombatResources(value, pack), action: value => isCombatAction(value, pack) },
        // Well-formed library fixtures are not executable save data. Without 3a0,
        // accepting these on load would strand actors outside any scheduler.
        validateComponents: (_state, components) => Object.values(components).every(values =>
            Object.keys(values).every(name => !name.startsWith('combat:'))),
        projectView: () => projectCombatView(),
    };
}
