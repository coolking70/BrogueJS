import type { Game } from '../../../../engine/Core/Game';
import type { Facing } from '../types';

export interface CombatUiAction { readonly id: string; readonly nameKey: string; readonly canUse: boolean }
export interface CombatUiView {
    readonly session: object;
    readonly revision: number;
    readonly readOnly: boolean;
    readonly actions: readonly CombatUiAction[];
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
    const actions = source.state.actions.filter((entry): entry is { id: string; nameKey: string; canUse: boolean } =>
        !!entry && typeof entry === 'object' && !Array.isArray(entry)
        && typeof entry.id === 'string' && typeof entry.nameKey === 'string' && typeof entry.canUse === 'boolean');
    return Object.freeze({ session: source.session, revision: source.state.revision as number,
        readOnly: !!game.replayRecording || game.isGameOver || !source.canManageCharacter,
        actions: Object.freeze(actions.map(action => Object.freeze({ ...action }))) });
}
/** Session/revision are display capabilities only, never recorded as future facts.
 * Engine preparation still checks current eligibility, geometry and all risks. */
export function buildCombatUiCommand(game: Game, expected: CombatUiView, attackId: string, facing: Facing): string | null {
    const current = readCombatUiView(game);
    if (!current || current.readOnly || expected.readOnly || current.session !== expected.session
        || current.revision !== expected.revision || !current.actions.some(action => action.id === attackId && action.canUse)
        || !combatDirections.some(direction => direction.facing === facing)) return null;
    return JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId, facing } });
}
