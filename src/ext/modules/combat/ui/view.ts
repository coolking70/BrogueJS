import type { Game } from '../../../../engine/Core/Game';
import type { Facing } from '../types';

export interface CombatUiAction {
    readonly id: string; readonly nameKey: string; readonly canUse: boolean;
    readonly cost?: number; readonly unavailableKey?: string;
    readonly windowTicks?: number; readonly recoveryTicks?: number;
}
export interface CombatUiBonfire {
    /** World entity identity, never the reusable definition ID. */
    readonly entityId: number; readonly nameKey: string; readonly descriptionKey: string;
    readonly restTicks: number; readonly canUse: boolean; readonly unavailableKey?: string;
}
export interface CombatUiRest {
    readonly bonfireId: number; readonly remainingTicks: number;
    readonly status: 'resting' | 'interrupted';
}
const combatTextKey = (value: unknown): value is string => typeof value === 'string' && value.startsWith('ext.combat.');
/** Nearby bonfires are public DTOs. Invalid or ambiguous identities fail closed. */
export function readCombatUiBonfires(value: unknown): readonly CombatUiBonfire[] {
    if (!Array.isArray(value)) return Object.freeze([]);
    const ids = new Set<number>(), rows: CombatUiBonfire[] = [];
    for (const entry of value) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)
            || !Number.isSafeInteger(entry.entityId) || entry.entityId <= 0 || ids.has(entry.entityId)
            || !combatTextKey(entry.nameKey) || !combatTextKey(entry.descriptionKey)
            || !Number.isSafeInteger(entry.restTicks) || entry.restTicks <= 0 || typeof entry.canUse !== 'boolean') return Object.freeze([]);
        ids.add(entry.entityId);
        rows.push(Object.freeze({ entityId: entry.entityId, nameKey: entry.nameKey, descriptionKey: entry.descriptionKey,
            restTicks: entry.restTicks, canUse: entry.canUse,
            ...(combatTextKey(entry.unavailableKey) ? { unavailableKey: entry.unavailableKey } : {}) }));
    }
    return Object.freeze(rows);
}
/** Older ACK frames have no rest DTO. They must not acquire future live state. */
export function readCombatUiRest(value: unknown): CombatUiRest | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (!Number.isSafeInteger(row.bonfireId) || (row.bonfireId as number) <= 0
        || !Number.isSafeInteger(row.remainingTicks) || (row.remainingTicks as number) < 0
        || (row.status !== 'resting' && row.status !== 'interrupted')) return null;
    return Object.freeze({ bonfireId: row.bonfireId as number, remainingTicks: row.remainingTicks as number, status: row.status });
}
export interface CombatUiResources {
    readonly stamina: number; readonly capacity: number; readonly regenDelayRemaining: number;
    readonly dodgeRemainingTicks: number; readonly dodgeRecoveryRemainingTicks: number;
    /** Older captured frames may contain stamina only. Never invent future values. */
    readonly poise?: number; readonly poiseCapacity?: number; readonly poiseRecoveryDelayRemaining?: number;
    readonly parryRemainingTicks?: number; readonly parryRecoveryRemainingTicks?: number; readonly staggerRemainingTicks?: number;
}
/** Accept detached public resource DTOs from either a live view or an ACK frame. */
export function readCombatUiResources(value: unknown): CombatUiResources | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const fields = ['stamina', 'capacity', 'regenDelayRemaining', 'dodgeRemainingTicks', 'dodgeRecoveryRemainingTicks'] as const;
    if (fields.some(key => !Number.isSafeInteger(row[key]) || (row[key] as number) < 0)
        || (row.capacity as number) === 0 || (row.stamina as number) > (row.capacity as number)) return null;
    const defenseFields = ['poise', 'poiseCapacity', 'poiseRecoveryDelayRemaining', 'parryRemainingTicks',
        'parryRecoveryRemainingTicks', 'staggerRemainingTicks'] as const;
    const hasDefense = defenseFields.some(key => row[key] !== undefined);
    if (hasDefense && (defenseFields.some(key => !Number.isSafeInteger(row[key]) || (row[key] as number) < 0)
        || (row.poiseCapacity as number) === 0 || (row.poise as number) > (row.poiseCapacity as number))) return null;
    return Object.freeze(Object.fromEntries([...fields, ...(hasDefense ? defenseFields : [])]
        .map(key => [key, row[key]]))) as unknown as CombatUiResources;
}
export interface CombatUiView {
    readonly session: object;
    readonly revision: number;
    readonly readOnly: boolean;
    readonly actions: readonly CombatUiAction[];
    readonly resources: CombatUiResources | null;
    readonly bonfires?: readonly CombatUiBonfire[];
    readonly rest?: CombatUiRest | null;
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
    const actions = source.state.actions.filter((entry): entry is { id: string; nameKey: string; canUse: boolean; cost?: number;
        windowTicks?: number; recoveryTicks?: number; unavailableKey?: string } =>
        !!entry && typeof entry === 'object' && !Array.isArray(entry)
        && typeof entry.id === 'string' && typeof entry.nameKey === 'string' && typeof entry.canUse === 'boolean');
    return Object.freeze({ session: source.session, revision: source.state.revision as number,
        readOnly: !!game.replayRecording || game.isGameOver || !source.canManageCharacter,
        resources: readCombatUiResources(source.state.resources),
        bonfires: readCombatUiBonfires(source.state.bonfires), rest: readCombatUiRest(source.state.rest),
        actions: Object.freeze(actions.map(action => Object.freeze({ id: action.id, nameKey: action.nameKey, canUse: action.canUse,
            ...(Number.isSafeInteger(action.cost) && action.cost! >= 0 ? { cost: action.cost } : {}),
            ...(Number.isSafeInteger(action.windowTicks) && action.windowTicks! > 0 ? { windowTicks: action.windowTicks } : {}),
            ...(Number.isSafeInteger(action.recoveryTicks) && action.recoveryTicks! >= 0 ? { recoveryTicks: action.recoveryTicks } : {}),
            ...(typeof action.unavailableKey === 'string' && action.unavailableKey.startsWith('ext.combat.')
                ? { unavailableKey: action.unavailableKey } : {}) }))) });
}
/** An explanation is not authority to rest later or at another world object. */
export function buildCombatRestCommand(game: Game, expected: CombatUiView, bonfireId: number): string | null {
    if (!Number.isSafeInteger(bonfireId) || bonfireId <= 0 || expected.readOnly
        || !expected.bonfires?.some(bonfire => bonfire.entityId === bonfireId && bonfire.canUse)) return null;
    const current = readCombatUiView(game);
    if (!current || current.readOnly || current.session !== expected.session || current.revision !== expected.revision
        || !current.bonfires?.some(bonfire => bonfire.entityId === bonfireId && bonfire.canUse)) return null;
    return JSON.stringify({ module: 'combat', action: 'rest', payload: { bonfireId } });
}
/** Session/revision are display capabilities only, never recorded as future facts.
 * Engine preparation still checks current eligibility, geometry and all risks. */
export function buildCombatUiCommand(game: Game, expected: CombatUiView, attackId: string, facing: Facing): string | null {
    const current = readCombatUiView(game);
    if (!current || current.readOnly || expected.readOnly || current.session !== expected.session
        || current.revision !== expected.revision || !current.actions.some(action => action.id === attackId && action.canUse)
        || !combatDirections.some(direction => direction.facing === facing)) return null;
    return attackId === 'dodge' || attackId === 'parry' ? JSON.stringify({ module: 'combat', action: attackId, payload: { facing } })
        : JSON.stringify({ module: 'combat', action: 'attack', payload: { attackId, facing } });
}
