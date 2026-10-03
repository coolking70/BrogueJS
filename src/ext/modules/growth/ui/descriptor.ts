import type { ModuleUiContribution } from '../../../ui/types';
import { useGrowthUi } from './useGrowthUi';
export default {
    moduleId: 'growth',
    loadCreationStep: () => import('./GrowthCreationStep.vue').then(module => module.default),
    useSession: useGrowthUi,
} satisfies ModuleUiContribution;
