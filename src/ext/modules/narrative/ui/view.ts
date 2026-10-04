import type { Game } from '../../../../engine/Core/Game';
import type { NarrativeInput } from '../input';

export interface NarrativeNearbyTarget {
    readonly targetEntityId: number; readonly nameKey: string; readonly descriptionKey: string;
    readonly glyph: string; readonly color: string;
}
export interface NarrativeActiveView {
    readonly sessionId: number; readonly targetEntityId: number; readonly nodeId: string;
    readonly speakerNameKey: string; readonly textKey: string; readonly portraitId: string | null;
    readonly choices: readonly { readonly id: string; readonly textKey: string; readonly enabled: boolean; readonly unavailableKey: string | null }[];
    readonly transitionLimitReached: boolean;
}
export interface NarrativeUiView {
    readonly session: object; readonly revision: number; readonly readOnly: boolean;
    readonly nearby: readonly NarrativeNearbyTarget[];
    readonly active: NarrativeActiveView | null;
}
/** The module's projection already filters visibility and choice conditions.
 * Rendering never loads mechanical definitions or evaluates story effects. */
export function readNarrativeUiView(game: Game): NarrativeUiView | null {
    const source = game.extensionRuntime?.readModuleView('narrative');
    if (!source) return null;
    return { session: source.session, revision: source.state.revision as number,
        nearby: source.state.nearby as unknown as readonly NarrativeNearbyTarget[],
        active: source.state.active as unknown as NarrativeActiveView | null,
        readOnly: !!game.replayRecording || game.isGameOver };
}
export function buildNarrativeUiCommand(game: Game, expected: NarrativeUiView, action: 'open' | 'choose' | 'close', id?: number | string): string | null {
    const current = readNarrativeUiView(game);
    if (!current || current.readOnly || expected.readOnly || current.session !== expected.session || current.revision !== expected.revision) return null;
    let input: NarrativeInput;
    if (action === 'open') {
        if (current.active || typeof id !== 'number' || !current.nearby.some(target => target.targetEntityId === id)) return null;
        input = { module: 'narrative', action, payload: { v: 2, revision: expected.revision, targetEntityId: id } };
    } else {
        const active = current.active;
        if (!active || active.sessionId !== expected.active?.sessionId || active.nodeId !== expected.active.nodeId) return null;
        if (action === 'choose') {
            if (typeof id !== 'string' || !active.choices.some(choice => choice.id === id && choice.enabled)) return null;
            input = { module: 'narrative', action, payload: { v: 2, revision: expected.revision, sessionId: active.sessionId, nodeId: active.nodeId, choiceId: id } };
        } else input = { module: 'narrative', action, payload: { v: 2, revision: expected.revision, sessionId: active.sessionId } };
    }
    return JSON.stringify(input);
}
