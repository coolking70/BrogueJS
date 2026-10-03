import type { Component } from 'vue';
import { createExtensionRegistry } from '../catalog';
import type { ExtensionRegistry } from '../registry';
import type { ExtensionModule } from '../types';
import { getInstalledModuleUiContributions } from './registry';
import type { ModuleUiContribution } from './types';

export interface ModuleCreationPlan {
    readonly extensions: readonly string[];
    readonly steps: readonly { moduleId: string; component?: Component; load?: () => Promise<Component> }[];
    readonly modules: readonly ExtensionModule[];
}
/** Validate enabled packages before retiring the old run; factories remain pure. */
export function prepareModuleCreation(extensions: readonly string[], contributions: readonly ModuleUiContribution[] = getInstalledModuleUiContributions(), registry: ExtensionRegistry = createExtensionRegistry()): ModuleCreationPlan {
    const manifest = registry.manifest(extensions), modules = registry.create(manifest);
    const steps = modules.flatMap(module => {
        const ui = contributions.find(entry => entry.moduleId === module.id);
        return ui?.creationStep || ui?.loadCreationStep ? [{ moduleId: module.id, component: ui.creationStep, load: ui.loadCreationStep }] : [];
    });
    return { extensions: manifest.modules.map(entry => entry.id), modules, steps };
}
/** UI overrides only its owner's initial input. No-UI modules use declared defaults. */
export function buildModuleCreationCommands(plan: ModuleCreationPlan, selected: ReadonlyMap<string, readonly string[]>): readonly string[] {
    for (const id of selected.keys()) if (!plan.steps.some(step => step.moduleId === id)) throw new Error('Unexpected creation step');
    return plan.modules.flatMap(module => {
        const hasStep = plan.steps.some(step => step.moduleId === module.id);
        const commands = hasStep ? selected.get(module.id) : module.initialCommand
            ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : [];
        if (!commands || commands.length !== (module.initialCommand ? 1 : 0)) throw new Error('Incomplete module creation');
        for (const command of commands) {
            const input = JSON.parse(command);
            if (input.module !== module.id || input.action !== module.initialCommand?.action) throw new Error('Invalid creation owner/action');
        }
        return [...commands];
    });
}
