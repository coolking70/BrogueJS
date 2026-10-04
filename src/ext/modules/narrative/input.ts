import { validId } from '../../json';
import { NarrativeError } from './errors';
import { assertNarrativeJson, freezeNarrative } from './schema';
import { narrativeInteger, narrativeRecord } from './state';

export type NarrativeInput =
    | { readonly module: 'narrative'; readonly action: 'open'; readonly payload: { readonly v: 2; readonly revision: number; readonly targetEntityId: number } }
    | { readonly module: 'narrative'; readonly action: 'choose'; readonly payload: { readonly v: 2; readonly revision: number; readonly sessionId: number; readonly nodeId: string; readonly choiceId: string } }
    | { readonly module: 'narrative'; readonly action: 'close'; readonly payload: { readonly v: 2; readonly revision: number; readonly sessionId: number } };
/** Strict versioned syntax; current targets, revisions and conditions are checked by the command planner. */
export function validateNarrativeInput(raw: unknown): NarrativeInput {
    assertNarrativeJson(raw, '$input');
    const input = narrativeRecord(raw, ['module','action','payload'], '$input', 'INVALID_INPUT');
    if (input.module !== 'narrative') throw new NarrativeError('INVALID_INPUT', '$input.module');
    if (input.action !== 'open' && input.action !== 'choose' && input.action !== 'close') throw new NarrativeError('INVALID_INPUT', '$input.action');
    const fields = input.action === 'open' ? ['targetEntityId'] : input.action === 'choose' ? ['sessionId','nodeId','choiceId'] : ['sessionId'];
    const payload = narrativeRecord(input.payload, ['v','revision',...fields], '$input.payload', 'INVALID_INPUT');
    if (payload.v !== 2) throw new NarrativeError('INVALID_VERSION', '$input.payload.v');
    if (!narrativeInteger(payload.revision, 0)) throw new NarrativeError('INVALID_INPUT', '$input.payload.revision');
    for (const field of fields) {
        if (field === 'nodeId' || field === 'choiceId') {
            if (!validId(payload[field])) throw new NarrativeError('INVALID_INPUT', `$input.payload.${field}`);
        } else if (!narrativeInteger(payload[field], 1)) throw new NarrativeError('INVALID_INPUT', `$input.payload.${field}`);
    }
    return freezeNarrative(structuredClone(raw) as NarrativeInput);
}
export const parseNarrativeInput = validateNarrativeInput;
export function isNarrativeInput(raw: unknown): raw is NarrativeInput {
    try { validateNarrativeInput(raw); return true; } catch { return false; }
}
