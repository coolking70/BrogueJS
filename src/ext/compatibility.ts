import i18next from 'i18next';
import type { ExtensionRulesIdentity } from './types';

export type ExtensionCompatibilityCode = 'missing' | 'version' | 'state-invalid';
/** Required identity belongs to the saved file; actual belongs to this install.
 * Diagnostics carry data only and never replace compatibility validation. */
export class ExtensionCompatibilityError extends Error {
    constructor(readonly code: ExtensionCompatibilityCode, readonly moduleId: string,
        message: string, readonly expected?: string, readonly actual?: string | null,
        readonly rules?: { expected?: ExtensionRulesIdentity; actual?: ExtensionRulesIdentity }) {
        super(message); this.name = 'ExtensionCompatibilityError';
    }
}

export function formatExtensionCompatibilityError(error: unknown): string {
    if (!(error instanceof ExtensionCompatibilityError)) return i18next.t('ext.error.incompatible', {
        defaultValue: 'Extension set, version or state is incompatible.',
    });
    const values = { moduleId: error.moduleId, expected: error.expected, actual: error.actual };
    if (error.code === 'missing') return i18next.t('ext.error.missing', { ...values,
        defaultValue: 'Cannot load: required module {{moduleId}} ({{expected}}) is not installed.',
    });
    if (error.code === 'state-invalid') return i18next.t('ext.error.state_invalid', { ...values,
        defaultValue: 'Cannot load: module {{moduleId}} has invalid state or components.',
    });
    if (error.rules) return i18next.t('ext.error.rules', { ...values,
        expectedRules: JSON.stringify(error.rules.expected ?? null), actualRules: JSON.stringify(error.rules.actual ?? null),
        defaultValue: 'Cannot load: module {{moduleId}} rule data differs. Required: {{expectedRules}}; installed: {{actualRules}}.',
    });
    return i18next.t('ext.error.version', { ...values,
        defaultValue: 'Cannot load: module {{moduleId}} requires version {{expected}}; installed version is {{actual}}.',
    });
}
