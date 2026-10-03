/** Compile client SFCs for the custom renderer, without Vitest's SSR transform. */
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import i18next from 'i18next';
import { parse, compileScript } from '@vue/compiler-sfc';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { inputManager } from '../../../../engine/Input';
import { activeGame } from '../../../../engine/Core/Game';
import * as view from '../view';
import * as growthCharacter from '../ui/useGrowthCharacter';
import type { ModuleUiContribution } from '../../../ui/types';

export function growthUiFixture() {
    const modules: Record<string, unknown> = { vue: Vue, 'i18next-vue': translation,
        i18next: { default: i18next, __esModule: true },
        '../../../../engine/Input': { inputManager }, '../../../../engine/Core/Game': { activeGame },
        '../view': view, './useGrowthCharacter': growthCharacter };
    function compile(file: string, sfc = true): any {
        const source = readFileSync(new URL('../ui/' + file, import.meta.url), 'utf8');
        const input = sfc ? compileScript(parse(source).descriptor, { id: file, inlineTemplate: true }).content : source;
        const code = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
        const exports: any = {};
        new Function('require', 'exports', code)((id: string) => {
            if (!(id in modules)) throw new Error(`Missing module client fixture import: ${id}`);
            return modules[id];
        }, exports);
        return sfc ? exports.default : exports;
    }
    for (const name of ['GrowthCharacterPanel', 'GrowthHud', 'GrowthSkillBar', 'GrowthCreationPanel', 'GrowthCreationStep']) {
        modules[`./${name}.vue`] = { default: compile(`${name}.vue`), __esModule: true };
    }
    // Resolve pure async declarations synchronously in this deterministic renderer;
    // each component is still compiled from its real source above.
    const source = readFileSync(new URL('../ui/useGrowthUi.ts', import.meta.url), 'utf8');
    const input = source.replace(/const (\w+) = defineAsyncComponent\(\(\) => import\('\.\/(\w+)\.vue'\)\);/g, "import $1 from './$2.vue';");
    const code = ts.transpileModule(input, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
    const exports: any = {};
    new Function('require', 'exports', code)((id: string) => {
        if (!(id in modules)) throw new Error(`Missing module session fixture import: ${id}`);
        return modules[id];
    }, exports);
    return {
        contribution: { moduleId: 'growth', useSession: host => exports.useGrowthUi(host, async () => (modules['./GrowthCharacterPanel.vue'] as any).default), creationStep: (modules['./GrowthCreationStep.vue'] as any).default } as ModuleUiContribution,
        hud: (modules['./GrowthHud.vue'] as any).default as Vue.Component,
    };
}
