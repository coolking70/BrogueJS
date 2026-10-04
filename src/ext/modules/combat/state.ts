import { assertCombatJson, integer, record } from './schema';
import type { CombatState } from './types';

export function initialCombatState(): CombatState { return { schema: 1, revision: 0, nextActionId: 1 }; }
export function validateCombatState(value: unknown): CombatState {
    assertCombatJson(value);
    const state = record(value, ['schema', 'revision', 'nextActionId']);
    if (state.schema !== 1) throw new Error('combat: invalid state schema');
    const revision = integer(state.revision, 0, Number.MAX_SAFE_INTEGER - 1);
    const nextActionId = integer(state.nextActionId, 1, Number.MAX_SAFE_INTEGER);
    if (nextActionId - 1 > revision) throw new Error('combat: action allocation exceeds revision');
    return structuredClone(value) as CombatState;
}
export function isCombatState(value: unknown): value is CombatState {
    try { validateCombatState(value); return true; } catch { return false; }
}
/** 3a1 installs no command/executor. A progressed state cannot be resumed here. */
export function isInactiveCombatState(value: unknown): value is CombatState {
    return isCombatState(value) && value.revision === 0 && value.nextActionId === 1;
}
