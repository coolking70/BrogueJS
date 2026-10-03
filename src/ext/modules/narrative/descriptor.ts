import type { ModuleDescriptor } from '../../descriptor';
import { createNarrativeModule } from './index';
import { getNarrativePackIdentity, NARRATIVE_VERSION } from './definitions';
import zhCN from './locales/zh_CN.json';

export const descriptor: ModuleDescriptor = {
    id: 'narrative', version: NARRATIVE_VERSION, foundation: 1,
    rules: getNarrativePackIdentity(), create: createNarrativeModule,
    // Kernel-only release: opt in explicitly, without changing existing defaults.
    defaultEnabled: false,
    labelKey: 'ext.narrative.module.name', descriptionKey: 'ext.narrative.module.description',
    locales: { zh_CN: zhCN },
};
