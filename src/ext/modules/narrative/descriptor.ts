import { FOUNDATION_PROTOCOL } from '../../descriptor';
import type { ModuleDescriptor } from '../../descriptor';
import { createNarrativeModule } from './index';
import { getNarrativePackIdentity, NARRATIVE_VERSION } from './definitions';
import zhCN from './locales/zh_CN.json';

export const descriptor: ModuleDescriptor = {
    id: 'narrative', version: NARRATIVE_VERSION, foundation: FOUNDATION_PROTOCOL,
    rules: getNarrativePackIdentity(), create: createNarrativeModule,
    // Explicit opt-in; the headless world/session contract does not install a UI.
    defaultEnabled: false,
    labelKey: 'ext.narrative.module.name', descriptionKey: 'ext.narrative.module.description',
    locales: { zh_CN: zhCN },
};
