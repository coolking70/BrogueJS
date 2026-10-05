import type { ModuleUiContribution } from '../../../ui/types';
import { useCombatUi } from './useCombatUi';
export { useCombatUi } from './useCombatUi';
export default { moduleId: 'combat', useSession: useCombatUi } satisfies ModuleUiContribution;
