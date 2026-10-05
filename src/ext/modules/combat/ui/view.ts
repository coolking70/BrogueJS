import type { Game } from '../../../../engine/Core/Game';
import type { Facing } from '../types';

export interface CombatUiAction {
    readonly id: string; readonly nameKey: string; readonly canUse: boolean;
    readonly cost?: number; readonly unavailableKey?: string;
}
export interface CombatUiResources {
    readonly stamina: number; readonly capacity: number; readonly regenDelayRemaining: number;
    readonly dodgeRemainingTicks: number; readonly dodgeRecoveryRemainingTicks: number;
}
/** Accept detached public resource DTOs from either a live view or an ACK frame. */
export function readCombatUiResources(value: unknown): CombatUiResources | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const fields = ['stamina', 'capacity', 'regenDelayRemaining', 'dodgeRemainingTicks', 'dodgeRecoveryRemainingTicks'] as const;
    if (fields.some(key => !Number.isSafeInteger(row[key]) || (row[key] as number) < 0)
        || (row.capacity as number) === 0 || (row.stamina as number) > (row.capacity as number)) return null;
    return Object.freeze(Object.fromEntries(fields.map(key => [key, row[key]]))) as unknown as CombatUiResources;
}
export interface CombatUiView {
    readonly session: object;
    readonly revision: number;
    readonly readOnly: boolean;
    readonly actions: readonly CombatUiAction[];
    readonly resources: CombatUiResources | null;
}
export const combatDirections: readonly { readonly facing: Facing; readonly nameKey: string; readonly glyph: string }[] = [
    { facing: 'nw', nameKey: 'ext.combat.ui.direction.nw', glyph: '↖' },
    { facing: 'n', nameKey: 'ext.combat.ui.direction.n', glyph: '↑' },
    { facing: 'ne', nameKey: 'ext.combat.ui.direction.ne', glyph: '↗' },
    { facing: 'w', nameKey: 'ext.combat.ui.direction.w', glyph: '←' },
    { facing: 'e', nameKey: 'ext.combat.ui.direction.e', glyph: '→' },
    { facing: 'sw', nameKey: 'ext.combat.ui.direction.sw', glyph: '↙' },
    { facing: 's', nameKey: 'ext.combat.ui.direction.s', glyph: '↓' },
    { facing: 'se', nameKey: 'ext.combat.ui.direction.se', glyph: '↘' },
];
export function readCombatUiView(game: Game): CombatUiView | null {
    const source = game.extensionRuntime?.readModuleView('combat');
    if (!source || source.state.schema !== 1 || !Number.isSafeInteger(source.state.revision) || !Array.isArray(source.state.actions)) return null;
    const actions = source.state.actions.filter((entry): entry is { id: string; nameKey: string; canUse: boolean; cost?: number; unavailableKey?: string } =>
        !!entry && typeof entry === 'object' && !Array.isArray(entry)
        && typeof entry.id === 'string' && typeof entry.nameKey === 'string' && typeof entry.canUse === 'boolean');
    return Object.freeze({ session: source.session, revision: source.state.revision as number,
        readOnly: !!game.replayRecording || game.isGameOver || !source.canManageCharacter,
        resources: readCombatUiResources(source.state.resources),
        actions: Object.freeze(actions.map(action => Object.freeze({ id: action.id, nameKey: action.nameKey, canUse: action.canUse,
            ...(Number.isSafeInteger(action.cost) && action.cost! >= 0 ? { cost: action.cost } : {}),
            ...(typeof action.unavailableKey === 'string' && action.unavailableKey.startsWith('ext.combat.')
                ? { unavailableKey: action.unavailableKey } : {}) }))) });
}
/** Session/revision are display capabilities only, never recorded as future facts.
 * Engine preparation still checks current eligibility, geometry and all risks. */
export function buildCombatUiCommand(game: Game, expected: CombatUiView, attackId: string, facing: Facing): string | null {
    const current = readCombatUiView(game);
    if (!current || current.readOnly || expected.readOnly || current.session !== expected.session
        || current.revision !== expected.revision || !current.actions.some(action => action.id === attackId && action.canUse)
        || !combatDirections.some(direction => direction.facing === facing)) return null;
    return attackId === 'dodge' ? JSON.stringify({ module: 'combat', action: 'dodge', payload: { facing } })
        : JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId, facing } });
}
