/**
 * src/test/p1_30_i18n_gate.test.ts — i18n 键存在性红灯 + 变异名拼接 + 实跑冒烟。
 *
 * 背景（docs/archive/dev-history/i18n_risk_assessment.md §5.1–5.2 / P1-30 任务书）：
 * i18next 的 defaultValue 让缺翻译完全静默——缺键时直接渲染英文，不报错不告警。
 * 本文件把这条无声通道变成红灯：
 *  1. 静态扫描 src/ 全部 i18next.t() / $t() 调用，断言每个键都存在于
 *     zh_CN.json（扫描器见 i18n_scan.ts；动态键用前缀白名单与同文件追踪处理）；
 *  2. 数据驱动的 name.* 键全覆盖检查（归档误删 name.* 会让怪物/物品名集体
 *     变英文，这里按数据文件逐名核对）；
 *  3. 变异名拼接：中文下必须是"爆裂的老鼠"，不得含英文字母或多余空格；
 *  4. 实跑若干回合：包装 i18next.t，任何一次命中缺失键（exists=false）都算红。
 *
 * 本文件刻意用**真实 zh_CN 资源**初始化 i18next（与 harness 的空资源约定相反）：
 * 拼接与冒烟检查要验证的就是真实文案。
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { join, dirname } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import i18next, { type TOptions } from 'i18next';

import zhCN from '../locales/zh_CN.json';
import { getInstalledModuleDescriptors } from '../ext/catalog';
import { getRealtimeModules } from '../ext/realtimeCatalog';
import { scanI18nUsage } from './i18n_scan';
import monstersJson from '../data/monsters.json';
import weaponsJson from '../data/weapons.json';
import armorsJson from '../data/armors.json';
import consumablesJson from '../data/consumables.json';
import arcanaJson from '../data/arcana.json';
import mutationsJson from '../data/mutations.json';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { logger } from '../engine/Systems/Logger';
import { Monster, type MonsterData, type MutationData } from '../entities/Monster';
import { createHeadlessGame, runTurns } from './harness';

const REPO_SRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const descriptors = getInstalledModuleDescriptors();
const RESOURCE: Record<string, string> = Object.assign({}, zhCN, ...[...descriptors, ...getRealtimeModules()].map(module => module.locales?.zh_CN ?? {}));

// 本文件所有用例都用真实 zh_CN 资源。i18next 未初始化时（其他 test 文件的
// 模块图与本文件隔离，vitest 默认 isolate）这里就是第一次也是唯一一次 init。
if (!i18next.isInitialized) {
    i18next.init({
        lng: 'zh_CN',
        fallbackLng: 'zh_CN',
        resources: { zh_CN: { translation: RESOURCE } },
        initImmediate: false, // 同步初始化
    });
}

describe('P1-30 模块包本地化引用：有限数据与错误词汇，不豁免命名空间', () => {
    const dataFields = ['nameKey', 'descriptionKey', 'textKey', 'titleKey', 'unavailableKey', 'altKey', 'reasonKey', 'labelKey'];
    const usedKeys = [...dataFields.map(field => `ext.fixture.data.${field}`),
        'ext.fixture.error.A', 'ext.fixture.error.B', 'ext.fixture.static'];
    const resource = Object.fromEntries([...usedKeys, 'ext.fixture.error.UNUSED'].map(key => [key, '测试文本']));
    const withPack = (check: (root: string, moduleDir: string) => void): void => {
        const root = mkdtempSync(join(tmpdir(), 'p1-30-pack-i18n-'));
        const moduleDir = join(root, 'ext', 'modules', 'fixture');
        const write = (path: string, code: string) => {
            const file = join(moduleDir, path);
            mkdirSync(dirname(file), { recursive: true });
            writeFileSync(file, code);
        };
        try {
            write('descriptor.ts', 'export {};');
            write('data/nested/definitions.json', JSON.stringify({ entries: dataFields.map(field => ({
                [field]: `ext.fixture.data.${field}`, note: 'ext.fixture.error.UNUSED',
            })), optional: { textKey: null } }));
            write('locales/zh_CN.json', JSON.stringify({ textKey: 'ext.fixture.error.UNUSED' }));
            write('tests/helper.ts', 'const ignored = { textKey: "ext.fixture.error.UNUSED" };');
            write('ignored.test.ts', 'const ignored = { textKey: "ext.fixture.error.UNUSED" };');
            write('codes.ts', 'export const CODES = ["A", "B"] as const; export type Code = typeof CODES[number];');
            write('errors.ts', [
                'import type { Code } from "./codes";',
                'export class Diagnostic {',
                '  readonly textKey: string;',
                '  constructor(code: Code) { this.textKey = `ext.fixture.error.${code}`; }',
                '}',
                'export const message = { textKey: "ext.fixture.static" };',
            ].join('\n'));
            check(root, moduleDir);
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    };

    it('引用实际嵌套数据与跨文件 readonly 枚举派生模板，未使用错误码仍为死键', () => {
        withPack(root => {
            const result = scanI18nUsage(root, resource);
            expect([...result.literals.keys()].sort()).toEqual([...usedKeys].sort());
            expect(result.unreferenced).toEqual(['ext.fixture.error.UNUSED']);
            expect(result.prefixes.size).toBe(0);
            expect(result.missing).toEqual([]);
            expect(result.unresolved).toEqual([]);
            expect(result.filesScanned).toContain('ext/modules/fixture/data/nested/definitions.json');
            expect(result.literals.get('ext.fixture.error.A')?.[0]).toMatchObject({
                file: 'ext/modules/fixture/errors.ts', line: 4,
            });
        });
    });

    it('Vue script、相邻插值和条件属性逐个扫描，注释与普通属性不冒充调用', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'Panel.vue'), [
                '<script setup lang="ts">',
                'import { useTranslation } from "i18next-vue";',
                'const { t } = useTranslation();',
                'const label = t("ext.fixture.ui.script");',
                'const props = defineProps<{ error: "ext.fixture.ui.rejected" | null }>();',
                '</script>',
                '<template>',
                '<!-- {{ $t("ext.fixture.ui.UNUSED") }} -->',
                `<p title="$t('ext.fixture.ui.UNUSED')">`,
                '  {{ t("ext.fixture.ui.first") }}</p><p>{{ $t("ext.fixture.ui.second") }} · {{ $t("ext.fixture.ui.open") }}',
                `</p><button :title="true ? $t('ext.fixture.ui.title') : undefined">`,
                '{{ $t("ext.fixture.ui.button") }}</button>',
                '<p v-if="error">{{ $t(error) }}</p>',
                '</template>',
            ].join('\n'));
            const keys = ['script', 'rejected', 'first', 'second', 'open', 'title', 'button'].map(key => `ext.fixture.ui.${key}`);
            const result = scanI18nUsage(root, { ...resource, ...Object.fromEntries([...keys, 'ext.fixture.ui.UNUSED'].map(key => [key, '文案'])) });
            expect(result.unresolved).toEqual([]);
            expect(result.missing).toEqual([]);
            expect(result.prefixes.size).toBe(0);
            expect(keys.every(key => result.literals.has(key))).toBe(true);
            expect(result.unreferenced).toEqual(['ext.fixture.error.UNUSED', 'ext.fixture.ui.UNUSED']);
            expect(result.literals.get('ext.fixture.ui.open')).toMatchObject([{ file: 'ext/modules/fixture/Panel.vue', line: 10 }]);
            expect(result.literals.get('ext.fixture.ui.title')).toMatchObject([{ file: 'ext/modules/fixture/Panel.vue', line: 11 }]);
        });
    });

    it('动态模块字段仅取实际 data JSON 词汇，投影别名需有真实转发', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'consumer.ts'), [
                'const project = npc => ({ speakerNameKey: npc.nameKey });',
                'function publish(message) { i18next.t(message.textKey); }',
            ].join('\n'));
            writeFileSync(join(moduleDir, 'Panel.vue'), [
                '<template><p>{{ $t(model.active.speakerNameKey) }} {{ $t(model.active.textKey) }}</p>',
                '<button :title="choice.unavailableKey ? $t(choice.unavailableKey) : undefined">{{ $t(choice.textKey) }}</button>',
                '<span :title="$t(target.descriptionKey)">{{ $t(target.nameKey) }}</span></template>',
            ].join('\n'));
            const result = scanI18nUsage(root, resource);
            expect(result.unresolved).toEqual([]);
            expect(result.missing).toEqual([]);
            expect(result.prefixes.size).toBe(0);
            expect(result.unreferenced).toEqual(['ext.fixture.error.UNUSED']);
            expect(result.literals.get('ext.fixture.data.nameKey')?.map(loc => loc.file)).toContain('ext/modules/fixture/Panel.vue');
            expect(result.literals.get('ext.fixture.data.textKey')?.map(loc => loc.file)).toContain('ext/modules/fixture/consumer.ts');
            // Removing the source data must revoke the dynamic vocabulary even
            // though the consumer, projection and locale still exist.
            rmSync(join(moduleDir, 'data'), { recursive: true });
            const withoutData = scanI18nUsage(root, resource);
            expect(withoutData.unresolved).toHaveLength(7);
            expect(dataFields.every(field => withoutData.unreferenced.includes(`ext.fixture.data.${field}`))).toBe(true);
        });
    });

    it('动态字段不能借用其它模块、未证实别名或任意表达式的词汇', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'consumer.ts'), [
                'i18next.t(model.unknownKey);',
                'i18next.t(model.unprovenNameKey);',
                'i18next.t(loadTextKey());',
                'i18next.t(model["textKey"]);',
            ].join('\n'));
            const foreign = join(root, 'ext', 'modules', 'foreign');
            mkdirSync(foreign, { recursive: true });
            writeFileSync(join(foreign, 'descriptor.ts'), 'export {};');
            writeFileSync(join(foreign, 'consumer.ts'), 'i18next.t(message.textKey);');
            writeFileSync(join(root, 'outside.ts'), 'i18next.t(message.textKey);');
            const result = scanI18nUsage(root, resource);
            expect(result.unresolved).toHaveLength(6);
            expect(result.prefixes.size).toBe(0);
            expect(result.unreferenced).toEqual(['ext.fixture.error.UNUSED']);
        });
    });

    it('新增数据键、属性末尾调用与有限 prop 缺失均亮红，同组死键仍亮红', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'data', 'injected.json'), JSON.stringify({ textKey: 'ext.fixture.data.MISSING' }));
            writeFileSync(join(moduleDir, 'projection.ts'), [
                'const broken = { nameKey: "ext.fixture.data.MISSING_SOURCE" };',
                'const view = { unavailableKey: flag ? "ext.fixture.data.MISSING_FALLBACK" : choice.unavailableKey };',
            ].join('\n'));
            writeFileSync(join(moduleDir, 'Panel.vue'), [
                '<script setup lang="ts">',
                'defineProps<{ error: "ext.fixture.ui.MISSING_PROP" | null }>();',
                '</script>',
                `<template><p>{{ $t(row.textKey) }}</p><button :title="ready && $t('ext.fixture.ui.MISSING_ATTRIBUTE')">`,
                '{{ $t("ext.fixture.static") }} · {{ $t("ext.fixture.ui.MISSING_LAST") }}</button><p v-if="error">{{ $t(error) }}</p></template>',
            ].join('\n'));
            const result = scanI18nUsage(root, { ...resource, 'ext.fixture.ui.UNUSED': '死键' });
            expect(result.unresolved).toEqual([]);
            expect(result.missing.map(entry => entry.key).sort()).toEqual([
                'ext.fixture.data.MISSING', 'ext.fixture.data.MISSING_FALLBACK', 'ext.fixture.data.MISSING_SOURCE', 'ext.fixture.ui.MISSING_ATTRIBUTE', 'ext.fixture.ui.MISSING_LAST', 'ext.fixture.ui.MISSING_PROP',
            ]);
            expect(result.unreferenced).toEqual(['ext.fixture.error.UNUSED', 'ext.fixture.ui.UNUSED']);
            expect(result.prefixes.size).toBe(0);
        });
    });

    it('开放 string prop 与 script 局部参数仍拒绝，未消费的有限 prop 不算引用', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'Panel.vue'), [
                '<script setup lang="ts">',
                'defineProps<{ finite: "ext.fixture.ui.finite" | null; open: string | null; unused: "ext.fixture.ui.unused" }>();',
                'function display(finite: string) { i18next.t(finite); }',
                '</script>',
                '<template><p v-if="finite">{{ $t(finite) }}</p><p v-if="open">{{ $t(open) }}</p></template>',
            ].join('\n'));
            const result = scanI18nUsage(root, { ...resource, 'ext.fixture.ui.finite': '文案', 'ext.fixture.ui.unused': '死键' });
            expect(result.unresolved).toHaveLength(2);
            expect(result.literals.has('ext.fixture.ui.finite')).toBe(true);
            expect(result.unreferenced).toEqual(['ext.fixture.error.UNUSED', 'ext.fixture.ui.unused']);
        });
    });

    it('数据引用及有限模板缺失资源均亮红，不能由同前缀其它翻译掩盖', () => {
        withPack(root => {
            const missing = ['ext.fixture.data.altKey', 'ext.fixture.error.B'];
            const incomplete = Object.fromEntries(Object.entries(resource).filter(([key]) => !missing.includes(key)));
            expect(scanI18nUsage(root, incomplete).missing.map(entry => entry.key).sort()).toEqual(missing);
        });
    });

    it('开放 string 模板不可扩大成前缀豁免，超过有限候选预算也拒绝', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'errors.ts'), [
                'export function diagnostic(code: string) { return { textKey: `ext.fixture.error.${code}` }; }',
                'export function nullable(code: "A" | null) { return { textKey: `ext.fixture.error.${code}` }; }',
                `type Huge = ${Array.from({ length: 257 }, (_, i) => JSON.stringify(String(i))).join(' | ')};`,
                'export function excessive(code: Huge) { return { textKey: `ext.fixture.error.${code}` }; }',
            ].join('\n'));
            const result = scanI18nUsage(root, resource);
            expect(result.unresolved).toHaveLength(3);
            expect(result.prefixes.size).toBe(0);
            expect(result.unreferenced).toEqual([
                'ext.fixture.error.A', 'ext.fixture.error.B', 'ext.fixture.error.UNUSED', 'ext.fixture.static',
            ]);
        });
    });

    it('多插值保留所有静态后缀，只产生精确有限键', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'errors.ts'), [
                'export function diagnostic(code: "A" | "B", state: "open" | "closed") {',
                '  return { textKey: `ext.fixture.${code}.state.${state}.text` };',
                '}',
            ].join('\n'));
            const keys = ['A', 'B'].flatMap(code => ['open', 'closed'].map(state => `ext.fixture.${code}.state.${state}.text`));
            const result = scanI18nUsage(root, { ...resource, ...Object.fromEntries(keys.map(key => [key, '文本'])) });
            expect(keys.every(key => result.literals.has(key))).toBe(true);
            expect(result.prefixes.size).toBe(0);
            expect(result.missing).toEqual([]);
            expect(result.unresolved).toEqual([]);
        });
    });

    it('删除模块后数据及错误词汇均自然移除，不留硬导入或测试引用', () => {
        withPack((root, moduleDir) => {
            writeFileSync(join(moduleDir, 'consumer.ts'), 'i18next.t(message.textKey);');
            expect(scanI18nUsage(root, resource).unresolved).toEqual([]);
            rmSync(moduleDir, { recursive: true });
            const result = scanI18nUsage(root, {});
            expect(result.filesScanned).toEqual([]);
            expect(result.literals.size).toBe(0);
            expect(result.missing).toEqual([]);
            expect(result.unresolved).toEqual([]);
            expect(scanI18nUsage(root, resource).unreferenced).toEqual(Object.keys(resource).sort());
        });
    });
});

describe('P1-30 键存在性红灯：源码引用的每个 i18n 键必须存在于 zh_CN.json', () => {
    const result = scanI18nUsage(REPO_SRC, RESOURCE, [
        { file: 'products/shooter/ShooterApp.vue', expression: 'module.labelKey', keys: getRealtimeModules().map(module => module.labelKey) },
        { file: 'products/shooter/ShooterApp.vue', expression: 'weapon.labelKey', keys: getRealtimeModules().flatMap(module => [...module.uiKeys]) },
        { file: 'products/shooter/components/PlayerProgress.vue', expression: 'activity.labelKey', keys: getRealtimeModules().filter(module => module.kind === 'mission').flatMap(module => [...module.uiKeys]) },
        ...['mission.titleKey', 'site.labelKey', 'nearby.labelKey'].map(expression => ({ file: 'products/shooter/ShooterApp.vue', expression, keys: getRealtimeModules().flatMap(module => [...module.uiKeys]) })),
        { file: 'components/MainMenu.vue', expression: 'module.labelKey', keys: descriptors.map(module => module.labelKey) },
        { file: 'components/MainMenu.vue', expression: 'module.descriptionKey', keys: descriptors.flatMap(module => module.descriptionKey ? [module.descriptionKey] : []) },
    ]);

    it('扫描覆盖了引擎、实体与界面（不含测试文件自身）', () => {
        expect(result.filesScanned.length).toBeGreaterThan(30);
        expect(result.filesScanned.some(f => f.endsWith('.vue'))).toBe(true);
        expect(result.filesScanned.some(f => f.startsWith('engine/'))).toBe(true);
        expect(result.filesScanned.some(f => f.startsWith('test/'))).toBe(false);
        // 静态字面量键的量级护栏：若扫描器退化（正则失配、文件遍历坏了），
        // 这里的下限会先红，而不是让"零缺失"假绿。
        expect(result.literals.size).toBeGreaterThan(250);
    });

    it('每个静态字面量键都存在（缺失即红）', () => {
        const missing = result.missing.map(m => {
            const locs = m.locs.map(l => `${l.file}:${l.line}`).join(', ');
            return `  ${m.key}  ←  ${locs}`;
        });
        expect(missing, `缺失翻译键 ${missing.length} 个（缺键会静默渲染英文defaultValue）：\n${missing.join('\n')}`)
            .toEqual([]);
    });

    it('每个动态键前缀下至少有一个真实键（防前缀打错字整组落空）', () => {
        const empty = result.emptyPrefixes.map(e => {
            const locs = e.locs.map(l => `${l.file}:${l.line}`).join(', ');
            return `  "${e.prefix}*"  ←  ${locs}`;
        });
        expect(empty, `前缀在 zh_CN.json 里一个键都盖不到：\n${empty.join('\n')}`).toEqual([]);
    });

    it('所有 t() 调用的首参都可静态解析（新调用点必须写成可扫描形式）', () => {
        const bad = result.unresolved.map(u => `  ${u.file}:${u.line}  ${u.reason}\n    ${u.snippet}`);
        expect(bad, `无法解析的 t() 调用 ${bad.length} 个：\n${bad.join('\n')}`).toEqual([]);
    });

    it('zh_CN.json 没有从未被引用的死键（发现死键应移入 zh_CN.legacy.json 归档）', () => {
        expect(result.unreferenced, `未被引用的键 ${result.unreferenced.length} 个，应归档到 zh_CN.legacy.json（前 20 个）：\n  ${result.unreferenced.slice(0, 20).join('\n  ')}`)
            .toEqual([]);
    });
});

describe('P1-30 数据驱动的 name.* 键覆盖（防归档误删：误删 = 怪物/物品名集体变英文）', () => {
    interface Named { name?: string; trueName?: string }

    const names: string[] = [];
    for (const m of monstersJson as Named[]) if (m.name) names.push(m.name);
    for (const w of weaponsJson as Named[]) if (w.name) names.push(w.name);
    for (const a of armorsJson as Named[]) if (a.name) names.push(a.name);
    const cons = consumablesJson as Record<string, Named[]>;
    for (const pool of ['potions', 'scrolls', 'food']) {
        for (const c of cons[pool] ?? []) if (c.trueName) names.push(c.trueName);
    }
    const arc = arcanaJson as Record<string, Named[]>;
    for (const pool of ['wands', 'staffs', 'rings', 'charms', 'keys', 'amulets']) {
        for (const a of arc[pool] ?? []) if (a.name) names.push(a.name);
    }
    // 随机外观名（药水颜色 / 魔杖金属 / 法杖木材 / 戒指宝石 / 护符材质）
    names.push(...ItemLoader.potionColors.map(p => p.name));
    names.push(...ItemLoader.wandFlavorNames, ...ItemLoader.staffFlavorNames);
    names.push(...ItemLoader.ringFlavorNames, ...ItemLoader.charmFlavorNames);

    it('英文形式的名字必须有 name.* 键且译文含中文（中文名原样返回，无需键）', () => {
        // ItemLoader 约定：外观池新词条直接存中文显示名，tn() 对无键字符串原样
        // 返回——所以只对含 ASCII 字母的英文名强制要求键；中文名反而不应被
        // 误加键（tn 会命中 name.中文 无意义键）。
        const needKey = names.filter(n => /[A-Za-z]/.test(n));
        const missing = needKey.filter(n => !RESOURCE['name.' + n]);
        const noCjk = needKey.filter(n => {
            const v = RESOURCE['name.' + n];
            return v !== undefined && !/[\u4e00-\u9fff]/.test(v);
        });
        expect(missing, `缺 name.* 键 ${missing.length} 个：\n  ${missing.map(n => 'name.' + n).join('\n  ')}`).toEqual([]);
        expect(noCjk, `name.* 译文不含中文 ${noCjk.length} 个：\n  ${noCjk.map(n => `name.${n} => ${RESOURCE['name.' + n]}`).join('\n  ')}`).toEqual([]);
    });
});

describe('P1-30 变异名拼接：中文语序，无英文残留、无多余空格', () => {
    const mutations = mutationsJson as unknown as MutationData[];
    // 覆盖浅中深各层的若干怪物（含双字/多字中文名）
    const guineaPigIds = ['rat', 'kobold', 'jackal', 'goblin', 'pink_jelly', 'troll', 'wraith', 'dragon'];
    const allMonsters = monstersJson as unknown as MonsterData[];

    it.each(guineaPigIds)('8 个变异 × %s：拼接结果 = 资源键插值，无英文/无空格', (id) => {
        const data = allMonsters.find(m => m.id === id);
        expect(data, `monsters.json 里找不到 id=${id}`).toBeTruthy();
        for (const mut of mutations) {
            const mon = new Monster(0, 0, data!);
            const baseName = mon.name; // 构造时已经过 translateName
            expect(baseName, `${id} 的基础名应已翻译为中文`).toMatch(/^[^A-Za-z]+$/);

            mon.mutate(mut);
            const expected = (RESOURCE['mutation.' + mut.id] ?? '').replace('{{name}}', baseName);
            expect(mon.name).toBe(expected);
            expect(mon.name, '不得含英文字母').not.toMatch(/[A-Za-z]/);
            expect(mon.name, '不得含任何空白字符').not.toMatch(/\s/);
        }
    });

    it('8 个变异名资源键全部存在（缺失时拼接会回退英文）', () => {
        for (const mut of mutations) {
            expect(RESOURCE['mutation.' + mut.id], `缺 mutation.${mut.id}`).toBeTruthy();
        }
    });
});

describe('P1-30 实跑冒烟：真实资源下推进回合，任何 t() 命中缺失键即红', () => {
    let origT: typeof i18next.t;
    const violations: string[] = [];
    const rawKeyLogs: string[] = [];
    // t() 整串返回键名的形状（缺键且无 defaultValue 时 i18next 的行为）
    const KEY_SHAPE = /^[a-z][a-zA-Z0-9_]*(\.[a-zA-Z0-9_]+)+$/;

    beforeAll(() => {
        origT = i18next.t.bind(i18next);
        (i18next as { t: unknown }).t = (key: string | string[], opts?: TOptions) => {
            const res = origT(key, opts);
            const first = Array.isArray(key) ? key[0] : key;
            if (typeof first === 'string' && !i18next.exists(first, opts)) {
                // ItemLoader.tn() 的既有契约：name.<X> 无键时以 defaultValue=X
                // 原样返回（外观池的中文名就是这么透传的，渲染仍是中文）。
                // 只有"缺键且 defaultValue 是英文"才是真漏键（会渲染英文）。
                const passthrough = (opts as { defaultValue?: string } | undefined)?.defaultValue;
                const isCjkNamePassthrough =
                    first.startsWith('name.') &&
                    passthrough === first.slice('name.'.length) &&
                    !/[A-Za-z]/.test(passthrough ?? '');
                if (!isCjkNamePassthrough) violations.push(first);
            }
            return res;
        };
    });

    afterAll(() => {
        (i18next as { t: unknown }).t = origT;
    });

    it('3 个 seed × 400 回合：无漏键、日志无裸键串', () => {
        let logCount = 0;
        const capture = (text: string) => {
            logCount++;
            if (KEY_SHAPE.test(text.trim())) rawKeyLogs.push(text);
        };
        for (const seed of [20260915, 42, 777]) {
            const game = createHeadlessGame(seed);
            // 包装 logger 单例的实例方法捕获全部消息（runTurns 内部还有一层
            // 计数包装，链式叠加：它的 originalLog 绑定的正是这里的包装）
            const prev = logger.log.bind(logger);
            logger.log = (text: string, color?: string) => { capture(text); prev(text, color); };
            try {
                const result = runTurns(game, 400);
                expect(result.turnsRun).toBeGreaterThan(0);
            } finally {
                delete (logger as { log?: unknown }).log;
            }
        }
        expect(logCount, '冒烟应产生足量日志以覆盖文案路径').toBeGreaterThan(20);
        expect(violations, `实跑中命中缺失键 ${violations.length} 次：\n  ${[...new Set(violations)].join('\n  ')}`)
            .toEqual([]);
        expect(rawKeyLogs, `日志出现裸键串（缺键且无 defaultValue）：\n  ${[...new Set(rawKeyLogs)].join('\n  ')}`)
            .toEqual([]);
    });
});
