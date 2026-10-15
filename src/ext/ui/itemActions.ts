import type { InjectionKey } from 'vue';
import type { ModuleUiCommand } from './types';
/** IDs are resolved again by each live owner; no Item is passed through this port. */
export const moduleItemActions: InjectionKey<(itemId: number) => readonly ModuleUiCommand[]> = Symbol('module-item-actions');
