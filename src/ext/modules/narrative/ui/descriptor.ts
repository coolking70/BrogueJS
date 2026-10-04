import type { ModuleUiContribution } from '../../../ui/types';
import { useNarrativeUi } from './useNarrativeUi';
export default { moduleId: 'narrative', useSession: useNarrativeUi } satisfies ModuleUiContribution;
