import type { ModuleUiContribution } from '../../../ui/types';
import { useForagingUi } from './useForagingUi';
export { useForagingUi } from './useForagingUi';
export default { moduleId: 'foraging', useSession: useForagingUi } satisfies ModuleUiContribution;
