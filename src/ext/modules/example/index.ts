import definitions from './definitions.json';
import i18next from 'i18next';
import { exampleDefinitionText } from './text';
import { validateDefinitionPack } from '../../definitions';
import type { ExtensionModule, Json } from '../../types';
export const EXAMPLE_ID = 'example';
export const EXAMPLE_VERSION = '1.0.0';
export function createExampleModule(): ExtensionModule {
    const texts = exampleDefinitionText();
    validateDefinitionPack(definitions, key => Object.prototype.hasOwnProperty.call(texts, key));
    return {
        id: EXAMPLE_ID, version: EXAMPLE_VERSION,
        initialState: () => ({ kills: 0 }),
        validateState: (value: unknown): value is Json => !!value && typeof value === 'object'
            && Object.keys(value).length === 1 && Number.isSafeInteger((value as { kills: number }).kills)
            && (value as { kills: number }).kills >= 0,
        hooks: {
            // Count non-administrative creature deaths, regardless of cause. This is
            // a lifecycle demonstration, not an XP/kill-credit rule for stage 1.
            kill(event, context) {
                if (event.administrative || event.creature.player) return;
                const kills = (context.state as { kills: number }).kills + 1;
                context.setState({ kills });
                context.message(i18next.t('ext.example.kill', { name: event.creature.name, kills, defaultValue: 'Extension: {{name}} falls; total kills {{kills}}.' }));
            },
        },
    };
}
