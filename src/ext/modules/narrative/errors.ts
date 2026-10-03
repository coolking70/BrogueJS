/** Codes are stable machine diagnostics; localized UI text is looked up separately. */
export const NARRATIVE_ERROR_CODES = [
    'INVALID_JSON', 'UNKNOWN_KEY', 'INVALID_TYPE', 'INVALID_VERSION', 'INVALID_ID', 'DUPLICATE_ID',
    'UNKNOWN_REFERENCE', 'INVALID_TEXT', 'INVALID_PORTRAIT', 'INVALID_INTEGER', 'INVALID_RANGE',
    'INVALID_CONDITION', 'INVALID_EVENT_FIELD', 'CONDITION_DEPTH', 'CONDITION_LIMIT', 'EFFECT_LIMIT',
    'EVENT_LIMIT', 'TRANSITION_LIMIT', 'JOURNAL_LIMIT', 'RECEIPT_LIMIT', 'UNREACHABLE_NODE',
    'AUTOMATIC_CYCLE', 'MISSING_EXIT', 'DUPLICATE_RECEIPT', 'INVALID_STATE', 'INVALID_INPUT',
    'INVALID_FACT', 'STALE_PLAN', 'COUNTER_RANGE', 'FLAG_VALUE', 'INVALID_OPTIONAL_RESULT',
    'REWARD_COMMIT_REQUIRED', 'INVALID_CHOICE', 'CONDITION_UNAVAILABLE', 'INVALID_TRIGGER',
] as const;
export type NarrativeErrorCode = typeof NARRATIVE_ERROR_CODES[number];
export class NarrativeError extends Error {
    readonly name = 'NarrativeError';
    readonly textKey: string;
    constructor(readonly code: NarrativeErrorCode, readonly path: string) {
        super(`Narrative ${code} at ${path}`);
        this.textKey = `ext.narrative.error.${code}`;
    }
}
