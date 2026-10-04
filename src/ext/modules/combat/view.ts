import type { Json } from '../../types';
/** No telegraphs, resource bars, hidden actor facts or executable controls in 3a1. */
export function projectCombatView(): Json { return { schema: 1, telegraphs: [], resources: null, actions: [] }; }
