import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { parse, compileScript, compileStyle } from '@vue/compiler-sfc';
import ts from 'typescript';
import postcss from 'postcss';
import { readFileSync } from 'node:fs';
import zhCN from '../locales/zh_CN.json';
import { activeGame as game } from '../engine/Core/Game';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { displaySettings } from '../engine/Settings';
import data from '../ext/modules/growth/definitions.json';
import type { GrowthDefinitionPack, GrowthSkill } from '../ext/modules/growth/types';
import { createGrowthGameplay } from '../ext/modules/growth/module';
import { parseGrowthDefinitionPack } from '../ext/modules/growth/definitions';
import { extensionDataFingerprint } from '../ext/fingerprint';
import { ExtensionRegistry } from '../ext/registry';
import * as catalog from '../ext/catalog';
import { readGrowthCharacterView, createGrowthAllocationDraft, buildGrowthAllocateCommand } from '../ext/modules/growth/view';

// Real App, HUD, command bar and character SFC lifecycle/templates mounted to a
// deterministic Vue renderer. Pixel/viewport acceptance remains browser work.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null; isConnected: boolean;
    focus(): void; blur(): void; contains(target: Node): boolean; getBoundingClientRect(): object;
}
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const hasClass = (n: Node, cls: string) => String(n.props.class).split(' ').includes(cls);
const doc = { activeElement: null as Node | null, addEventListener: vi.fn(), removeEventListener: vi.fn(), hidden: false,
    querySelector: (selector: string) => selector === '.game-view' ? all(root).find(n => hasClass(n, 'game-view')) : body,
    documentElement: { dataset: {}, style: { setProperty() {} } } };
const node = (type: string, text = ''): Node => Vue.markRaw({ type, text, props: {}, children: [], parent: null, isConnected: true,
    focus() { doc.activeElement = this; }, blur() { if (doc.activeElement === this) doc.activeElement = null; },
    contains(target) { return all(this).includes(target); }, getBoundingClientRect() { return { top: 650, right: 1200 }; } });
const body = node('body'); let root = node('root');
const renderer = Vue.createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent; const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; child.isConnected = false; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _old, value) => { n.props[key] = value; }, querySelector: () => body,
});
const find = (key: string, value: string, scope = body) => all(scope).find(n => n.props[key] === value)!;
const cls = (name: string, scope = body) => all(scope).find(n => hasClass(n, name))!;
const click = (n: Node) => { expect(n).toBeTruthy(); if (!n.props.disabled) n.props.onClick?.({ target: n, currentTarget: n, stopPropagation() {}, preventDefault() {} }); };
async function tick() { await Vue.nextTick(); await Vue.nextTick(); }
const source = (path: string) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
/** Apply the actual compiled scoped styles followed by the later shell stylesheet.
 * This verifies the cascade, not browser glyph measurements or scroll gestures. */
function hudCascade(target: Node, width: number, height = 844): Record<string, string> {
    const compiled = parse(source('components/theme/ThemeHud.vue')).descriptor.styles.map(style => {
        const result = compileStyle({ source: style.content, filename: 'ThemeHud.vue', id: 'data-v-growth-hud', scoped: style.scoped });
        expect(result.errors).toEqual([]); return result.code;
    }).join('\n');
    const stylesheet = postcss.parse(compiled + '\n' + source('assets/theme-shells.css'));
    const html = node('html'); html.props['data-ui-concept'] = 'glyph';
    const ancestors: Node[] = [];
    for (let parent = target.parent; parent; parent = parent.parent) ancestors.unshift(parent);
    ancestors.unshift(html);
    const matches = (element: Node, compound: string): boolean => {
        compound = compound.replace(/\[data-v-growth-hud\]/g, '');
        const attrs = [...compound.matchAll(/\[([\w-]+)=([\w-]+)\]/g)];
        if (attrs.some(match => element.props[match[1]!] !== match[2])) return false;
        compound = compound.replace(/\[[^\]]+\]/g, '');
        if ([...compound.matchAll(/\.([\w-]+)/g)].some(match => !hasClass(element, match[1]!))) return false;
        compound = compound.replace(/\.[\w-]+/g, '');
        return !compound || compound === element.type;
    };
    const values: Record<string, string> = {}, scores: Record<string, number> = {};
    stylesheet.walkRules(rule => {
        for (let parent: postcss.AnyNode | undefined = rule.parent; parent; parent = parent.parent) {
            if (parent.type !== 'atrule' || parent.name !== 'media') continue;
            const applies = parent.params.split(',').some(query => [...query.matchAll(/(max|min)-(width|height)\s*:\s*(\d+)px/g)].every(match => {
                const actual = match[2] === 'width' ? width : height, limit = Number(match[3]);
                return match[1] === 'max' ? actual <= limit : actual >= limit;
            }));
            if (!applies) return;
        }
        for (const raw of rule.selectors) {
            if (/[>+~:]|\*/.test(raw)) continue;
            const selector = raw.replace(/\[data-v-growth-hud\]/g, ''), parts = selector.trim().split(/\s+/);
            if (!matches(target, parts.pop()!)) continue;
            let index = ancestors.length - 1, match = true;
            for (const part of parts.reverse()) {
                while (index >= 0 && !matches(ancestors[index]!, part)) index--;
                if (index < 0) { match = false; break; }
                index--;
            }
            if (!match) continue;
            const specificity = (selector.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length * 10 + (selector.startsWith('html') ? 1 : 0);
            rule.walkDecls(declaration => {
                const score = specificity + (declaration.important ? 1000 : 0);
                if (score >= (scores[declaration.prop] ?? -1)) { scores[declaration.prop] = score; values[declaration.prop] = declaration.value; }
            });
        }
    });
    return values;
}
const win = { innerWidth: 1440, innerHeight: 900, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    localStorage: { getItem: () => null, setItem() {} }, matchMedia: () => ({ matches: false }),
    setInterval: (fn: () => void, ms: number) => globalThis.setInterval(fn, ms),
    clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id), confirm: () => true };
let App: Vue.Component, Hud: Vue.Component, app: ReturnType<typeof renderer.createApp> | undefined;
let input: typeof import('../engine/Input').inputManager;
let held: typeof import('../ui/heldInput');
let viewport: typeof import('../ui/layout').viewport;
let ruleSet: 'classic' | 'extended' = 'extended';
const con = 'growth.attribute.constitution', str = 'growth.attribute.strength-training';
function configured(change?: (pack: GrowthDefinitionPack) => void) {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.attributePoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 20 };
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 4 };
    pack.config.experience.sources.firstVisits = false; change?.(pack);
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry(); registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity); return registry;
    }); return pack;
}
async function start() {
    root = node('root'); app = renderer.createApp(App); app.use(I18NextVue, { i18next }); app.mount(root);
    click(find('data-start', 'game', root)); await tick(); vi.advanceTimersByTime(100); await tick();
    game.animationEnabled = false;
}
async function open() { click(find('data-action', 'show_character', root)); await tick(); expect(cls('growth-panel')).toBeTruthy(); }
async function step(id: string, direction = 'plus') { click(find('data-step', direction, find('data-attribute', id))); await tick(); }
function allocateOutside(id: string) {
    const draft = createGrowthAllocationDraft(readGrowthCharacterView(game)!); draft.attributes[id] = 1;
    game.executeCommand('ext:command', buildGrowthAllocateCommand(readGrowthCharacterView(game, draft)!, game)!);
}
beforeAll(async () => {
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    input = (await import('../engine/Input')).inputManager; held = await import('../ui/heldInput');
    const layout = await import('../ui/layout'); viewport = layout.viewport;
    const empty = { default: { render: () => null }, __esModule: true };
    const modules: Record<string, unknown> = {
        vue: Vue, 'i18next-vue': translation, i18next: { default: i18next, __esModule: true },
        './engine/Settings': await import('../engine/Settings'), './engine/Input': { inputManager: input },
        '../engine/Input': { inputManager: input }, '../../engine/Input': { inputManager: input },
        './engine/Systems/Logger': { logger }, './engine/Core/Game': { activeGame: game },
        './engine/Core/SaveStorage': await import('../engine/Core/SaveStorage'), './ui/layout': layout,
        './ui/immersiveMode': await import('../ui/immersiveMode'), './ui/recordingExport': await import('../ui/recordingExport'),
        './ui/heldInput': held, './ui/useGrowthCharacter': await import('../ui/useGrowthCharacter'),
        './ext/modules/growth/view': await import('../ext/modules/growth/view'),
        '../../ui/useGameHud': await import('../ui/useGameHud'), '../../entities/Player': await import('../entities/Player'),
        '../ui/commands': await import('../ui/commands'),
    };
    const compile = (path: string): Vue.Component => {
        const script = compileScript(parse(source(path)).descriptor, { id: path, inlineTemplate: true });
        const code = ts.transpileModule(script.content, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
        const exports: any = {};
        new Function('require', 'exports', code)((key: string) => { if (!(key in modules)) throw new Error(`Unresolved growth UI import: ${key}`); return modules[key]; }, exports);
        return exports.default;
    };
    for (const name of ['ContextPanel', 'MessageJournal', 'MessageAcknowledgment', 'InventoryOverlay', 'GameEndOverlay', 'ReplayControls', 'AgentControls', 'DetailPanel', 'ReferenceOverlay', 'MapZoomControls', 'SideDrawer', 'DPad', 'TargetBar']) modules[`./components/${name}.vue`] = empty;
    for (const name of ['ThemeLog', 'ThemeNearby', 'RadialCommands']) modules[`./components/theme/${name}.vue`] = empty;
    modules['./components/MainMenu.vue'] = { default: { emits: ['new-game'], setup(_props: unknown, { emit }: any) { return () => Vue.h('button', { 'data-start': 'game', onClick: () => emit('new-game', { seed: '6721', mode: 'test', ruleSet }) }); } }, __esModule: true };
    modules['./components/GameCanvas.vue'] = { default: { props: ['displayModalOpen'], render() { return Vue.h('div'); } }, __esModule: true };
    modules['./components/CommandBar.vue'] = { default: compile('components/CommandBar.vue'), __esModule: true };
    Hud = compile('components/theme/ThemeHud.vue');
    modules['./components/theme/ThemeHud.vue'] = { default: Hud, __esModule: true };
    modules['./components/growth/GrowthCharacterPanel.vue'] = { default: compile('components/growth/GrowthCharacterPanel.vue'), __esModule: true };
    App = compile('App.vue');
});
beforeEach(() => { vi.useFakeTimers(); ruleSet = 'extended'; viewport.mode = 'desktop'; viewport.coarsePointer = false; displaySettings.immersiveMode = false; doc.activeElement = null; logger.reset(); input.setCallback(vi.fn()); input.setUnboundKeyCallback(vi.fn()); });
afterEach(() => { app?.unmount(); app = undefined; body.children = []; root.children = []; logger.presentAcknowledgments(null); vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(() => vi.unstubAllGlobals());

describe('EXT-1c mounted growth character interactions', () => {
    it('keeps classic HUD/commands free of growth UI', async () => {
        ruleSet = 'classic'; await start();
        expect(cls('th-growth', root)).toBeUndefined(); expect(find('data-action', 'show_character', root)).toBeUndefined();
        expect(cls('growth-panel')).toBeUndefined(); expect(game.extensionRuntime).toBeNull();
    });
    it.each([320, 390])('keeps hunger, HP and depth beside one live compact level entry at %i px', async width => {
        configured(); await start(); app!.unmount();
        win.innerWidth = width; viewport.mode = 'portrait'; displaySettings.immersiveMode = true;
        const model = Vue.shallowRef(readGrowthCharacterView(game)!);
        root = node('root');
        app = renderer.createApp({ setup: () => () => Vue.h(Hud, { growth: model.value, immersive: true }) });
        app.use(I18NextVue, { i18next }); app.mount(root); await tick();
        const entry = cls('th-growth-entry', root);
        expect(text(entry)).toBe('Lv1●'); expect(entry.props['aria-label']).toBe('角色'); expect(entry.props.title).toBe('角色');
        expect(all(cls('th-growth-heading', root)).filter(n => n.type === 'strong')).toHaveLength(0);
        expect(cls('th-hp', root)).toBeTruthy(); expect(cls('th-depth', root)).toBeTruthy();
        game.player.nutrition = 1; vi.advanceTimersByTime(100); await tick();
        expect(text(cls('th-food-word', root))).toBe(i18next.t('sidebar.hunger.faint'));
        model.value = { ...model.value, level: 7 }; await tick(); expect(text(entry)).toBe('Lv7●');
        // This is a CSS contract, not a claim about browser pixel measurements.
        const styles = parse(source('components/theme/ThemeHud.vue')).descriptor.styles;
        const hiddenCritical: string[] = [];
        for (const style of styles) postcss.parse(style.content).walkRules(rule => {
            if (!/\.th-(food|hp|depth)(?![\w-])/.test(rule.selector)) return;
            rule.walkDecls(declaration => {
                if ((declaration.prop === 'display' && declaration.value === 'none')
                    || (declaration.prop === 'visibility' && declaration.value === 'hidden')) hiddenCritical.push(rule.selector);
            });
        });
        expect(hiddenCritical).toEqual([]);
        win.innerWidth = 1440;
    });
    it('compiles narrow immersive scoped CSS to precise descendants, never hiding the app or vital blocks', () => {
        const descriptor = parse(source('components/theme/ThemeHud.vue')).descriptor;
        for (const style of descriptor.styles) {
            const compiled = compileStyle({ source: style.content, filename: 'ThemeHud.vue', id: 'data-v-growth-hud', scoped: style.scoped });
            expect(compiled.errors).toEqual([]);
            let narrowRules = 0;
            postcss.parse(compiled.code).walkAtRules('media', media => {
                if (media.params !== '(max-width:420px)') return;
                media.walkRules(rule => {
                    narrowRules++;
                    rule.walkDecls(declaration => {
                        if (declaration.prop === 'display' && declaration.value === 'none') {
                            expect(rule.selector).toBe('html[data-ui-concept=glyph] .app-layout.immersive-mode .theme-hud.has-growth .th-turn');
                            const shellShows: string[] = [];
                            postcss.parse(source('assets/theme-shells.css')).walkRules(shellRule => {
                                shellRule.walkDecls('display', display => {
                                    if (display.important && display.value === 'flex') {
                                        for (const selector of shellRule.selector.split(',')) {
                                            if (selector.includes('.immersive-mode') && selector.trim().endsWith(' .th-turn')) shellShows.push(selector.trim());
                                        }
                                    }
                                });
                            });
                            const shellSelector = 'html[data-ui-concept=glyph] .app-layout.immersive-mode .theme-hud .th-turn';
                            expect(shellShows).toContain(shellSelector);
                            // These flat class/attribute/type selectors have no IDs or
                            // pseudo classes: adding .has-growth strictly wins even
                            // though the shell stylesheet is emitted later.
                            const classWeight = (selector: string) => (selector.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length;
                            for (const shown of shellShows) {
                                expect(rule.selector.startsWith('html')).toBe(shown.startsWith('html'));
                                expect(classWeight(rule.selector)).toBeGreaterThan(classWeight(shown));
                            }
                            expect(rule.selector).not.toBe('.immersive-mode');
                            expect(rule.selector).not.toMatch(/\.th-(food|hp|depth)(?![\w-])/);
                        }
                        if (declaration.prop === 'gap') expect(rule.selector).toBe('.immersive-mode .theme-hud.has-growth');
                    });
                });
            });
            expect(narrowRules).toBe(2);
        }
    });
    it.each([320, 390])('preserves intrinsic search and other badges in the compiled immersive cascade at %i px', async width => {
        configured(); await start(); viewport.mode = 'portrait'; displaySettings.immersiveMode = true;
        game.monsters = []; game.dormantMonsters = [];
        game.executeCommand('search'); game.executeCommand('search'); game.executeCommand('search');
        game.player.setStatusDuration('poisoned', 20); game.player.setStatusDuration('haste', 20);
        vi.advanceTimersByTime(100); await tick();
        const header = cls('theme-hud', root), statuses = cls('th-statuses', root);
        const badges = all(statuses).filter(item => hasClass(item, 'th-status'));
        expect(text(badges[0]!)).toContain('搜索中 3/5');
        expect(badges.map(text).join(' ')).toContain('中毒'); expect(badges.map(text).join(' ')).toContain('急行');
        expect(hudCascade(header, width).gap).toBe('2px');
        expect(hudCascade(statuses, width)).toMatchObject({ flex: '0 1 auto', width: 'auto', 'min-width': '0', 'overflow-x': 'auto', 'overflow-y': 'hidden', 'flex-wrap': 'nowrap' });
        for (const badge of badges) expect(hudCascade(badge, width)).toMatchObject({ 'max-width': 'none', flex: '0 0 auto', 'white-space': 'nowrap' });
        for (const name of ['th-hp', 'th-food', 'th-depth', 'th-growth']) expect(hudCascade(cls(name, root), width).display).not.toBe('none');
        viewport.mode = 'desktop'; displaySettings.immersiveMode = false; await tick();
        expect(hudCascade(statuses, 1440, 900)['flex-wrap']).toBe('wrap');
        for (const badge of badges) expect(hudCascade(badge, 1440, 900)['max-width']).toBe('100%');
    });
    it('removes extension HUD and entry on the first rendered classic restart frame', async () => {
        configured(); await start(); expect(cls('th-growth', root)).toBeTruthy();
        click(cls('th-menu', root)); await tick(); ruleSet = 'classic';
        click(find('data-start', 'game', root)); await tick();
        // Intentionally do not advance the 100 ms HUD timer.
        expect(cls('th-growth', root)).toBeUndefined(); expect(find('data-action', 'show_character', root)).toBeUndefined();
        expect(game.extensionRuntime).toBeNull();
    });
    it('opens from real commands, cancels holds, edits +/- and resets/cancels without simulation or recording changes', async () => {
        configured(); await start(); game.player.hp -= 7;
        const state = JSON.stringify(game.toSnapshot()), random = rng.getState(), count = game.recordedInputEvents.length;
        const stop = vi.fn(), remove = held.registerHeldInput(stop);
        await open(); expect(stop).toHaveBeenCalled(); expect(doc.activeElement).toBe(cls('growth-panel'));
        const contexts = all(body).filter(n => hasClass(n, 'growth-port-context')).map(text);
        expect(contexts).toContain('攻击方式：近战'); expect(contexts).toContain('攻击方式：投掷'); expect(contexts).toContain('作用对象：行动者');
        expect(find('data-action', 'allocate').props.disabled).toBe(true);
        await step(con); expect(text(find('data-preview', 'maxHp'))).toContain('+3');
        await step(con, 'minus'); expect(find('data-action', 'allocate').props.disabled).toBe(true);
        await step(str); expect(text(cls('growth-budget'))).toContain('3');
        click(find('data-action', 'reset')); await tick(); expect(find('data-action', 'allocate').props.disabled).toBe(true);
        await step(con); click(find('data-action', 'cancel')); await tick();
        expect(cls('growth-panel')).toBeUndefined(); expect(doc.activeElement).toBe(cls('game-view', root));
        expect(game.recordedInputEvents).toHaveLength(count); expect(rng.getState()).toEqual(random); expect(JSON.stringify(game.toSnapshot())).toBe(state); remove();
    });
    it('submits an actual allocate command exactly once on double click and preserves wounds and RNG', async () => {
        configured(); await start(); game.player.hp -= 7;
        const hp = game.player.hp, maxHp = game.player.maxHp, count = game.recordedInputEvents.length, random = rng.getState();
        await open(); await step(con); const button = find('data-action', 'allocate'); click(button); click(button); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(count + 1); expect(game.player.maxHp).toBe(maxHp + 3); expect(game.player.hp).toBe(hp); expect(rng.getState()).toEqual(random);
        expect(JSON.parse(String(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.data))).toMatchObject({ module: 'growth', action: 'allocate', payload: { revision: 1, attributes: { [con]: 1 } } });
        expect(cls('growth-panel')).toBeTruthy(); expect(text(cls('growth-success'))).toContain('已分配'); expect(find('data-action', 'allocate').props.disabled).toBe(true);
        click(find('data-action', 'allocate')); await tick(); expect(game.recordedInputEvents).toHaveLength(count + 1);
        click(cls('growth-back')); await tick(); expect(doc.activeElement).toBe(cls('game-view', root));
    });
    it('rejects a stale revision before a queued UI submit, then resets to the current revision', async () => {
        configured(); await start(); await open(); await step(con); allocateOutside(str);
        const count = game.recordedInputEvents.length; click(find('data-action', 'allocate')); await tick();
        expect(game.recordedInputEvents).toHaveLength(count); expect(cls('growth-error')).toBeTruthy(); expect(find('data-action', 'allocate').props.disabled).toBe(true);
        click(find('data-action', 'reset')); await tick(); await step(con); click(find('data-action', 'allocate')); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(count + 1);
    });
    it('uses actual changed definition entries, prices, caps, effects, prerequisite names and slot counts', async () => {
        const pack = configured(pack => {
            const attribute = structuredClone(pack.config.attributes.find(item => item.id === con)!);
            attribute.id = 'growth.attribute.custom'; attribute.nameKey = 'ext.growth.custom.attribute'; attribute.pointCost = 2; attribute.cap = 2;
            for (const effect of attribute.effects) { effect.magnitude.source = { kind: 'attribute', attributeId: attribute.id }; effect.magnitude.coefficient = 7; }
            pack.config.attributes.push(attribute); pack.config.skills.activeSlots = 1; pack.config.skills.passiveSlots = 0;
            const skill = structuredClone(pack.definitions.find(item => item.kind === 'skill') as GrowthSkill); skill.id = 'growth.skill.custom'; skill.nameKey = 'ext.growth.custom.skill'; skill.prerequisites = [{ kind: 'attribute', attributeId: attribute.id, min: 2 }]; pack.definitions.push(skill);
            const identity = structuredClone(pack.definitions.find(item => item.kind === 'faith')!); identity.id = 'growth.faith.custom'; identity.nameKey = 'ext.growth.custom.faith'; pack.definitions.push(identity);
        });
        i18next.addResourceBundle('zh_CN', 'translation', { 'ext.growth.custom.attribute': '坚韧测试', 'ext.growth.custom.skill': '新技能测试', 'ext.growth.custom.faith': '新信仰测试' }, true, true);
        await start(); await open(); expect(all(body).filter(n => n.props['data-attribute']).length).toBe(pack.config.attributes.length);
        await step('growth.attribute.custom'); await step('growth.attribute.custom'); expect(text(find('data-preview', 'maxHp'))).toContain('+14'); expect(text(cls('growth-budget'))).toContain('4'); expect(find('data-step', 'plus', find('data-attribute', 'growth.attribute.custom')).props.disabled).toBe(true);
        click(find('data-tab', 'skills')); await tick(); const row = find('data-skill', 'growth.skill.custom'); expect(text(row)).toContain('坚韧测试'); expect(text(row)).toContain('已满足'); expect(text(cls('growth-slot-list'))).toContain('1 槽'); expect(text(cls('growth-slot-list'))).toContain('0 槽'); expect(all(row).some(n => n.type === 'button')).toBe(false);
        click(find('data-tab', 'identities')); await tick(); expect(text(find('data-identity', 'growth.faith.custom'))).toContain('新信仰测试'); expect(text(body)).toContain('阶段 1e');
    });
    it('supports inline configured respec review/cancel and commits once through its command boundary', async () => {
        configured(pack => { pack.config.respec = { enabled: true, cost: { resource: 'attribute-points', amount: 1 }, refundBasisPoints: 5000, clearCooldowns: false }; });
        await start(); allocateOutside(con); allocateOutside(con); const maxHp = game.player.maxHp, count = game.recordedInputEvents.length;
        await open(); click(find('data-action', 'review-respec')); await tick(); expect(find('data-action', 'confirm-respec')).toBeTruthy();
        click(cls('growth-back')); await tick(); expect(game.recordedInputEvents).toHaveLength(count);
        await open(); click(find('data-action', 'review-respec')); await tick(); const button = find('data-action', 'confirm-respec'); click(button); click(button); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(count + 1); expect(game.player.maxHp).toBe(maxHp - 6); expect(JSON.parse(String(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.data)).action).toBe('respec');
    });
    it('closes with Escape and outside click, isolates global game/immersive keys, and restores canvas focus', async () => {
        configured(); await start(); await open();
        const command = vi.fn(); input.setCallback(command);
        const event = (key: string) => ({ key, code: key, repeat: false, ctrlKey: false, altKey: false, metaKey: false, shiftKey: false, target: body, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as KeyboardEvent;
        input['handleKeyDown'](event('i')); input['handleKeyDown'](event('`')); expect(command).not.toHaveBeenCalled(); expect(displaySettings.immersiveMode).toBe(false);
        input['handleKeyDown'](event('Escape')); await tick(); expect(cls('growth-panel')).toBeUndefined(); expect(doc.activeElement).toBe(cls('game-view', root));
        await open(); click(cls('growth-overlay')); await tick(); expect(cls('growth-panel')).toBeUndefined();
    });
    it('checks opening eligibility synchronously despite a previously enabled button', async () => {
        configured(); await start(); const opener = find('data-action', 'show_character', root); expect(opener.props.disabled).toBe(false);
        game.pendingIdentify = true; click(opener); await tick(); expect(cls('growth-panel')).toBeUndefined(); game.pendingIdentify = false;
        vi.advanceTimersByTime(100); await tick(); game.isInventoryOpen = true; click(opener); await tick(); expect(cls('growth-panel')).toBeUndefined(); game.isInventoryOpen = false;
        vi.advanceTimersByTime(100); await tick(); logger.presentAcknowledgments(() => true); logger.log('ack fixture', '#fff', { acknowledge: true }); click(opener); await tick(); expect(cls('growth-panel')).toBeUndefined(); logger.reset();
    });
    it('renders replay character information read-only, including disabled allocation and respec', async () => {
        configured(pack => { pack.config.respec.enabled = true; }); await start();
        const recording = game.exportRecording(); expect(recording).toBeTruthy(); expect(game.loadReplay(recording!)).toBe(true); game.replayStep(); vi.advanceTimersByTime(100); await tick();
        click(cls('th-growth-entry', root)); await tick(); expect(cls('growth-panel')).toBeTruthy(); expect(text(body)).toContain('录像回放');
        expect(all(body).filter(n => n.props['data-step']).every(n => n.props.disabled)).toBe(true); expect(find('data-action', 'allocate').props.disabled).toBe(true); expect(find('data-action', 'review-respec').props.disabled).toBe(true);
    });
});
