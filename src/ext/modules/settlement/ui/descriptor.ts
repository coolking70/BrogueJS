import type { ModuleUiContribution } from '../../../ui/types';
import { useSettlementUi } from './useSettlementUi';
export default {
  moduleId: 'settlement',
  useSession: useSettlementUi
} satisfies ModuleUiContribution;
