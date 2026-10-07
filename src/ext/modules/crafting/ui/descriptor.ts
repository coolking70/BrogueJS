import type { ModuleUiContribution } from '../../../ui/types';
import { useCraftingUi } from './useCraftingUi';
export { useCraftingUi } from './useCraftingUi';
export default { moduleId: 'crafting', useSession: useCraftingUi } satisfies ModuleUiContribution;
