import i18next from 'i18next';
/** Example pack's localized vocabulary. No world mutation or randomness. */
export function exampleDefinitionText(): Record<string, string> {
    return {
        'ext.definition.observe': i18next.t('ext.definition.observe', { defaultValue: 'Observe' }),
        'ext.definition.wanderer': i18next.t('ext.definition.wanderer', { defaultValue: 'Wanderer' }),
        'ext.definition.traveler': i18next.t('ext.definition.traveler', { defaultValue: 'Traveler' }),
        'ext.definition.greeting': i18next.t('ext.definition.greeting', { defaultValue: 'Greeting' }),
        'ext.definition.hello': i18next.t('ext.definition.hello', { defaultValue: 'Hello, traveler.' }),
        'ext.definition.leave': i18next.t('ext.definition.leave', { defaultValue: 'Farewell' }),
        'ext.definition.guide': i18next.t('ext.definition.guide', { defaultValue: 'Guide' }),
    };
}
