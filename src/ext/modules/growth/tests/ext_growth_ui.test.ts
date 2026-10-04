import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { parse, compileStyle } from '@vue/compiler-sfc';
import postcss from 'postcss';
import { readFileSync } from 'node:fs';
import baseZhCN from '../../../../locales/zh_CN.json';
import growthZhCN from '../locales/zh_CN.json';
const zhCN = { ...baseZhCN, ...growthZhCN };
import { Game, activeGame as game } from '../../../../engine/Core/Game';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { displaySettings } from '../../../../engine/Settings';
import { createSfcHarness } from '../../../../test/support/sfcHarness';
import data from '../data/definitions.json';
import type { GrowthDefinitionPack, GrowthSkill } from '../types';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';
import { HUNGER_THRESHOLD } from '../../../../entities/Player';
import { presentationTimeline } from '../../../../ui/presentationTimeline';
import { observePresentation } from '../../../../engine/Core/PresentationObserver';
import type { DialogService } from '../../../../ui/dialogService';
import * as growthView from '../view';
import { readGrowthCharacterView, createGrowthAllocationDraft, buildGrowthAllocateCommand } from '../view';

// Real App, HUD, command bar and character SFC lifecycle/templates mounted to a
// deterministic Vue renderer. Pixel/viewport acceptance remains browser work.
interface Node {
    type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null; isConnected: boolean;
    closest(selector: string): Node | null; hasAttribute(name: string): boolean; getAttribute(name: string): string | null;
    querySelectorAll<T>(selector: string): T[]; focus(): void; blur(): void; contains(target: Node): boolean; getBoundingClientRect(): object;
}
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const hasClass = (n: Node, cls: string) => String(n.props.class).split(' ').includes(cls);
const doc = { activeElement: null as Node | null, addEventListener: vi.fn(), removeEventListener: vi.fn(), hidden: false,
    querySelector: (selector: string) => selector === '.game-view' ? all(root).find(n => hasClass(n, 'game-view')) : body,
    documentElement: { dataset: {}, style: { setProperty() {} } } };
const node = (type: string, text = ''): Node => Vue.markRaw({ type, text, props: {} as Record<string, any>, children: [], parent: null, isConnected: true,
    closest(selector) {
        if (selector === '[role="dialog"], [role="alertdialog"]' && ['dialog', 'alertdialog'].includes(this.props.role)) return this;
        if (selector === '[style*="display: none"]' && this.props.style?.display === 'none') return this;
        return this.parent?.closest(selector) ?? null;
    },
    hasAttribute(name) { return this.props[name] !== undefined && this.props[name] !== false; },
    getAttribute(name) { return this.props[name] ?? null; },
    querySelectorAll<T>(selector: string) { return all(this).filter(item => selector === 'button, [tabindex="0"]' ? item.type === 'button' || item.props.tabindex === '0'
        : selector === '[data-dialog-scroll]' ? !!item.props['data-dialog-scroll'] : item.type === selector) as T[]; },
    focus() {
        doc.activeElement = this;
        // Propagate native focusin capture, including an attempted Host restore
        // into a portal that is still hidden by an ACK-following display delay.
        for (let ancestor: Node | null = this; ancestor; ancestor = ancestor.parent) ancestor.props.onFocusinCapture?.({ target: this });
    }, blur() { if (doc.activeElement === this) doc.activeElement = null; },
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
const source = (path: string) => readFileSync(new URL('../../../../' + path, import.meta.url), 'utf8');
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
let App: Vue.Component, Hud: Vue.Component, GrowthHud: Vue.Component, app: ReturnType<typeof renderer.createApp> | undefined;
let input: typeof import('../../../../engine/Input').inputManager;
let held: typeof import('../../../../ui/heldInput');
let viewport: typeof import('../../../../ui/layout').viewport;
let realDialogs = false, mountedDialogs: DialogService;
let moduleSessions: import('../../../ui/types').ModuleUiSession[] = [];
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
async function open() { click(find('data-action', 'growth:character', root)); await tick(); expect(cls('growth-panel')).toBeTruthy(); }
async function step(id: string, direction = 'plus') { click(find('data-step', direction, find('data-attribute', id))); await tick(); }
function allocateOutside(id: string) {
    const draft = createGrowthAllocationDraft(readGrowthCharacterView(game)!); draft.attributes[id] = 1;
    game.executeCommand('ext:command', buildGrowthAllocateCommand(readGrowthCharacterView(game, draft)!, game)!);
}
beforeAll(async () => {
    vi.stubGlobal('window', win); vi.stubGlobal('document', doc);
    await i18next.init({ lng: 'zh_CN', fallbackLng: false, resources: { zh_CN: { translation: zhCN } }, initImmediate: false });
    input = (await import('../../../../engine/Input')).inputManager; held = await import('../../../../ui/heldInput');
    const layout = await import('../../../../ui/layout'); viewport = layout.viewport;
    const empty = { render: () => null };
    const { contribution: originalContribution, hud } = (await import('./uiFixture')).growthUiFixture();
    const contribution = { ...originalContribution, useSession: (host: import('../../../ui/types').ModuleUiHost) => {
        const session = originalContribution.useSession!(host); moduleSessions.push(session); return session;
    } };
    const genericUi = await import('../../../../ext/ui/useModuleUi');
    const stubs = {
        '../../../../ext/ui/useModuleUi': { useModuleUi: (host: import('../../../ui/types').ModuleUiHost) => genericUi.useModuleUi(host, [contribution]) },
    };
    const harness = createSfcHarness({ baseURL: import.meta.url, stubs });
    const DialogHost = await harness.load('../../../../components/DialogHost.vue');
    Hud = await harness.load('../../../../components/theme/ThemeHud.vue');
    GrowthHud = hud;
    // Mount the same real HUD/command bar/module panels while leaving unrelated
    // shell components and Pixi outside this deterministic custom renderer.
    const appHarness = createSfcHarness({ baseURL: import.meta.url, stubs, stubComponents: empty, components: {
        '../../../../components/DialogHost.vue': { props: ['service', 'epoch'], setup(props: any) { mountedDialogs = props.service; return () => realDialogs ? Vue.h(DialogHost, props) : null; } },
        '../../../../components/MainMenu.vue': { emits: ['new-game'], setup(_props: unknown, { emit }: any) {
            return () => Vue.h('button', { 'data-start': 'game', onClick: () => emit('new-game', { seed: '6721', mode: 'test', ruleSet }) });
        } },
        '../../../../components/GameCanvas.vue': { props: ['displayModalOpen'], render() { return Vue.h('div'); } },
        '../../../../components/CommandBar.vue': await harness.load('../../../../components/CommandBar.vue'),
        '../../../../components/theme/ThemeHud.vue': Hud,
    } });
    App = await appHarness.load('../../../../App.vue');
});
beforeEach(() => { vi.useFakeTimers(); realDialogs = false; moduleSessions = []; ruleSet = 'extended'; viewport.mode = 'desktop'; viewport.coarsePointer = false; displaySettings.immersiveMode = false; doc.activeElement = null; logger.reset(); input.setCallback(vi.fn()); input.setUnboundKeyCallback(vi.fn()); });
afterEach(() => { app?.unmount(); app = undefined; body.children = []; root.children = []; logger.presentAcknowledgments(null); vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(() => vi.unstubAllGlobals());

describe('EXT-1c mounted growth character interactions', () => {
    it('reads and submits against the supplied Game rather than the global active game', async () => {
        configured(); await start();
        const other = new Game(); other.startNewGame({ seed: '991', mode: 'test', ruleSet: 'extended' });
        for (const command of other.extensionRuntime!.initialCommands()) other.executeCommand('ext:command', command);
        other.animationEnabled = false;
        const globalBefore = game.extensionRuntime!.snapshot(), globalEvents = game.recordedInputEvents.length;
        const scope = Vue.effectScope(), { useGrowthUi } = await import('../ui/useGrowthUi');
        const session = scope.run(() => useGrowthUi({ game: () => other, tick: Vue.ref(0), immersive: Vue.ref(false), canOpenPanel: () => true, beforeOpenPanel() {}, afterClosePanel() {} }, async () => ({ render: () => null })))!;
        const before = readGrowthCharacterView(other)!;
        expect(session.hud.value!.props.model).toEqual(before);
        session.commands.value[0]!.invoke(); await tick();
        const adjust = session.panel.value!.props.onAdjust as (id: string, delta: number) => void;
        adjust(con, 1);
        const submit = session.panel.value!.props.onSubmit as () => Promise<void>;
        await submit();
        expect(readGrowthCharacterView(other)!.revision).toBe(before.revision + 1);
        expect(readGrowthCharacterView(other)!.attributes.find(row => row.id === con)!.value).toBe(before.attributes.find(row => row.id === con)!.value + 1);
        expect(game.extensionRuntime!.snapshot()).toEqual(globalBefore); expect(game.recordedInputEvents).toHaveLength(globalEvents);
        scope.stop();
    });
    it('recovers rejected panel loads without locking gameplay and ignores cancelled or retired loads', async () => {
        configured(); await start();
        const { useGrowthUi } = await import('../ui/useGrowthUi');
        const pending: { resolve(value: Vue.Component): void; reject(error: Error): void }[] = [];
        const loader = vi.fn(() => new Promise<Vue.Component>((resolve, reject) => pending.push({ resolve, reject })));
        const scope = Vue.effectScope(), opened = vi.fn(), closed = vi.fn();
        const session = scope.run(() => useGrowthUi({ game: () => game, tick: Vue.ref(0), immersive: Vue.ref(false), canOpenPanel: () => true,
            beforeOpenPanel: opened, afterClosePanel: closed }, loader))!;
        const state = game.extensionRuntime!.snapshot(), random = rng.getState(), inputs = game.recordedInputEvents.length;
        session.commands.value[0]!.invoke(); expect(session.panelOpen.value).toBe(false);
        expect(session.commands.value[0]!.label).toBe(i18next.t('ext.growth.ui.loading_panel'));
        session.commands.value[0]!.invoke(); pending[0]!.resolve({ render: () => null }); await tick();
        expect(session.panelOpen.value).toBe(false); expect(opened).not.toHaveBeenCalled();
        session.commands.value[0]!.invoke(); pending[1]!.reject(new Error('offline')); await tick();
        expect(session.panelOpen.value).toBe(false); expect(session.commands.value[0]!.label).toBe(i18next.t('ext.growth.ui.load_panel_failed'));
        session.commands.value[0]!.invoke(); session.close(); pending[2]!.resolve({ render: () => null }); await tick();
        expect(session.panelOpen.value).toBe(false);
        session.commands.value[0]!.invoke(); scope.stop(); pending[3]!.resolve({ render: () => null }); await tick();
        expect(session.panelOpen.value).toBe(false); expect(opened).not.toHaveBeenCalled();
        expect(game.extensionRuntime!.snapshot()).toEqual(state); expect(rng.getState()).toEqual(random); expect(game.recordedInputEvents).toHaveLength(inputs);
    });
    it('rejects saved callbacks after scope retirement or a same-Game runtime replacement', async () => {
        configured(); await start();
        const { useGrowthUi } = await import('../ui/useGrowthUi');
        for (const replaceRuntime of [false, true]) {
            const scope = Vue.effectScope(), beforeOpen = vi.fn(), afterClose = vi.fn();
            const session = scope.run(() => useGrowthUi({ game: () => game, tick: Vue.ref(0), immersive: Vue.ref(false), canOpenPanel: () => true,
                beforeOpenPanel: beforeOpen, afterClosePanel: afterClose }, async () => ({ render: () => null })))!;
            const invoke = session.commands.value[0]!.invoke;
            invoke(); await tick();
            const props = session.panel.value!.props;
            if (replaceRuntime) {
                game.startNewGame({ seed: '6744', mode: 'test', ruleSet: 'extended' });
                for (const command of game.extensionRuntime!.initialCommands()) game.executeCommand('ext:command', command);
            } else scope.stop();
            const state = game.extensionRuntime!.snapshot(), random = rng.getState(), inputs = game.recordedInputEvents.length;
            beforeOpen.mockClear(); afterClose.mockClear();
            invoke(); session.refresh(); session.close();
            (props.onAdjust as (id: string, delta: number) => void)(con, 1);
            await (props.onSubmit as () => Promise<void>)();
            (props.onReset as () => void)(); (props.onClose as () => void)();
            await (props.onSkill as (action: string, id: string) => Promise<void>)('learn', 'growth.skill.brace');
            expect(game.extensionRuntime!.snapshot()).toEqual(state); expect(rng.getState()).toEqual(random); expect(game.recordedInputEvents).toHaveLength(inputs);
            expect(beforeOpen).not.toHaveBeenCalled(); expect(afterClose).not.toHaveBeenCalled(); scope.stop();
        }
    });
    it('keeps classic HUD/commands free of growth UI', async () => {
        ruleSet = 'classic'; await start();
        expect(cls('th-growth', root)).toBeUndefined(); expect(find('data-action', 'growth:character', root)).toBeUndefined();
        expect(cls('growth-panel')).toBeUndefined(); expect(game.extensionRuntime).toBeNull();
    });
    it.each([320, 390])('keeps hunger, HP and depth beside one live compact level entry at %i px', async width => {
        configured(); await start(); app!.unmount();
        win.innerWidth = width; viewport.mode = 'portrait'; displaySettings.immersiveMode = true;
        const model = Vue.shallowRef(readGrowthCharacterView(game)!);
        root = node('root');
        app = renderer.createApp({ setup: () => () => Vue.h(Hud, { hasModuleHud: true, immersive: true }, { default: () => Vue.h(GrowthHud, { model: model.value, immersive: true, blocked: false }) }) });
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
                            expect(rule.selector).toBe('html[data-ui-concept=glyph] .app-layout.immersive-mode .theme-hud.has-module-hud .th-turn');
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
                            // pseudo classes: adding .has-module-hud strictly wins even
                            // though the shell stylesheet is emitted later.
                            const classWeight = (selector: string) => (selector.match(/\.[\w-]+|\[[^\]]+\]/g) ?? []).length;
                            for (const shown of shellShows) {
                                expect(rule.selector.startsWith('html')).toBe(shown.startsWith('html'));
                                expect(classWeight(rule.selector)).toBeGreaterThan(classWeight(shown));
                            }
                            expect(rule.selector).not.toBe('.immersive-mode');
                            expect(rule.selector).not.toMatch(/\.th-(food|hp|depth)(?![\w-])/);
                        }
                        if (declaration.prop === 'gap') expect(rule.selector).toBe('.immersive-mode .theme-hud.has-module-hud');
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
        expect(cls('th-growth', root)).toBeUndefined(); expect(find('data-action', 'growth:character', root)).toBeUndefined();
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
        click(find('data-tab', 'identities')); await tick(); expect(text(find('data-identity', 'growth.faith.custom'))).toContain('新信仰测试'); expect(text(body)).toContain(i18next.t('ext.growth.creation.fixed_identity'));
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
        configured(); await start(); const opener = find('data-action', 'growth:character', root); expect(opener.props.disabled).toBe(false);
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

describe('EXT-1d mounted skill learning, loadout, targeting and display', () => {
    const skillId = (suffix: string) => `growth.skill.${suffix}`;
    const actions = (suffix: string) => find('data-skill-actions', skillId(suffix));
    async function skills() { click(find('data-action', 'show-skills', root)); await tick(); expect(find('data-tab', 'skills').props.class).toContain('selected'); }
    async function press(action: string, suffix: string) { click(find('data-action', action, actions(suffix))); await tick(); await tick(); }
    function record(action: string, payload: object) {
        game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action, payload: { revision: readGrowthCharacterView(game)!.revision, ...payload } }));
    }
    async function prepared() {
        configured(pack => { pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 30 }; pack.config.skills.activeSlots = 6; });
        await start(); game.monsters = []; game.dormantMonsters = []; game.items = [];
        record('allocate', { attributes: { 'growth.attribute.constitution': 2, 'growth.attribute.agility': 2, 'growth.attribute.perception': 2 } });
        vi.advanceTimersByTime(100); await tick();
    }
    it('shows data-derived attribute and skill text, learns once on double click and equips with one native wait', async () => {
        await prepared(); await open(); expect(text(find('data-attribute', con))).toContain('每点：最大生命 +3（单项上限 +24）');
        click(find('data-tab', 'skills')); await tick(); const row = find('data-skill', skillId('brace'));
        expect(text(row)).toContain('受到的物理伤害 -20%'); expect(text(row)).toContain('使用消耗：3 专注');
        expect(all(row).some(node => node.type === 'button')).toBe(false);
        const before = game.recordedInputEvents.length, turns = game.stats.turns, rngBefore = rng.getState();
        const button = find('data-action', 'learn-skill', actions('brace')); click(button); click(button); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(before + 1); expect(game.stats.turns).toBe(turns); expect(rng.getState()).toEqual(rngBefore);
        expect(readGrowthCharacterView(game)!.skills.find(skill => skill.id === skillId('brace'))!.learned).toBe(true);
        await press('equip-skill', 'brace'); expect(game.stats.turns).toBe(turns + 1); expect(game.recordedInputEvents).toHaveLength(before + 2);
        const event = JSON.parse(String(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.data));
        expect(event).toMatchObject({ action: 'equip-skills', payload: { active: [skillId('brace')], passive: [] } });
        expect(find('data-action', 'use-skill', actions('brace')).props.disabled).toBe(false);
    });
    it.each(['yes', 'no', 'stale'] as const)('tracks a pending skill confirmation without premature rejection (%s)', async outcome => {
        await prepared(); await skills(); await press('learn-skill', 'brace'); await press('equip-skill', 'brace');
        const original = game.executeCommand.bind(game), before = game.extensionRuntime!.snapshot(), random = rng.getState();
        const count = game.recordedInputEvents.length;
        let pending: import('../../../../engine/Core/Game').CommandConfirmation | null = null;
        let command = '';
        vi.spyOn(game, 'pendingCommandConfirmation', 'get').mockImplementation(() => pending);
        const execute = vi.spyOn(game, 'executeCommand').mockImplementation((_action, data) => {
            command = String(data); pending = { token: {}, ownerCommandId: 71, message: 'UI fixture confirmation' };
        });
        await press('use-skill', 'brace');
        expect(find('data-action', 'use-skill', actions('brace')).props.disabled).toBe(true);
        expect(cls('growth-error')).toBeUndefined(); expect(cls('growth-success')).toBeUndefined();
        expect(game.extensionRuntime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        expect(game.recordedInputEvents).toHaveLength(count);
        // This is a UI pending/completion fixture; real risk, No and recorder
        // semantics are covered separately by the prepared-command engine tests.
        pending = null; execute.mockRestore();
        if (outcome === 'yes') original('ext:command', command);
        if (outcome === 'no') game.recordedInputEvents.push({ index: count, tick: 0, depth: game.depth,
            player: { ...game.player.loc }, action: 'ext:command', data: command, decisions: [false] });
        vi.advanceTimersByTime(100); await tick();
        expect(cls('growth-error')).toBeUndefined();
        if (outcome === 'yes') expect(text(cls('growth-success'))).toBe(i18next.t('ext.growth.ui.skill_used'));
        else if (outcome === 'no') {
            expect(text(cls('growth-success'))).toBe(i18next.t('ext.growth.ui.skill_cancelled'));
            expect(game.extensionRuntime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
        } else expect(cls('growth-success')).toBeUndefined();
    });
    it('keeps action positions stable when the second physical click arrives after a Vue rerender', async () => {
        await prepared(); await skills();
        const buttons = () => all(actions('measured-strike')).filter(node => node.type === 'button');
        const initial = buttons(), order = ['learn-skill', 'equip-skill', 'unequip-skill', 'use-skill'];
        expect(initial.map(node => node.props['data-action'])).toEqual(order);
        const count = game.recordedInputEvents.length, turns = game.stats.turns, points = readGrowthCharacterView(game)!.skillPoints;
        click(initial[0]!); await tick(); await tick(); vi.advanceTimersByTime(100); await tick();
        // Hit-test the same column after the DOM update, not the old listener captured before rendering.
        const afterLearn = buttons(); expect(afterLearn.map(node => node.props['data-action'])).toEqual(order);
        expect(afterLearn[0]).toBe(initial[0]); expect(afterLearn[0]!.props.disabled).toBe(true); click(afterLearn[0]!); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(count + 1); expect(game.stats.turns).toBe(turns);
        expect(readGrowthCharacterView(game)!.skillPoints).toBe(points - 2);
        expect(readGrowthCharacterView(game)!.skills.find(skill => skill.id === skillId('measured-strike'))!.equipped).toBe(false);
        click(afterLearn[1]!); await tick(); await tick(); vi.advanceTimersByTime(100); await tick();
        const afterEquip = buttons(); expect(afterEquip.map(node => node.props['data-action'])).toEqual(order);
        expect(afterEquip[1]).toBe(initial[1]); expect(afterEquip[1]!.props.disabled).toBe(true); click(afterEquip[1]!); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(count + 2); expect(game.stats.turns).toBe(turns + 1);
        expect(readGrowthCharacterView(game)!.skills.find(skill => skill.id === skillId('measured-strike'))!.equipped).toBe(true);
        click(afterEquip[2]!); await tick(); await tick();
        const afterUnequip = buttons(); expect(afterUnequip[2]).toBe(initial[2]); expect(afterUnequip[2]!.props.disabled).toBe(true);
        click(afterUnequip[2]!); await tick(); await tick(); expect(game.recordedInputEvents).toHaveLength(count + 3); expect(game.stats.turns).toBe(turns + 2);
    });
    it.each([[320, false], [320, true], [390, false], [390, true]] as const)('reserves the complete first search badge with Lv20/10 points at %ipx immersive=%s', async (width, immersive) => {
        const priorObserver = globalThis.ResizeObserver;
        let resized: (() => void) | undefined;
        vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resized = callback; } observe() {} disconnect() {} });
        try {
            configured(); await start(); app!.unmount();
            game.monsters = []; game.dormantMonsters = []; game.executeCommand('search');
            game.player.hp = 52; game.player.maxHp = 69;
            game.player.setStatusDuration('poisoned', 20); game.player.setStatusDuration('haste', 20);
            win.innerWidth = width; viewport.mode = 'portrait'; displaySettings.immersiveMode = immersive;
            const model = Vue.shallowRef({ ...readGrowthCharacterView(game)!, level: 20, attributePoints: 10, skillPoints: 10 });
            root = node('root');
            app = renderer.createApp({ setup: () => () => Vue.h('div', { class: `app-layout theme-shell layout-portrait ${immersive ? 'immersive-mode' : ''}` },
                [Vue.h(Hud, { hasModuleHud: true, immersive, showPanelButton: true }, { default: () => Vue.h(GrowthHud, { model: model.value, immersive, blocked: false }) })]) });
            app.use(I18NextVue, { i18next }); app.mount(root); await tick();
            const statuses = cls('th-statuses', root), first = cls('th-search-progress', root);
            expect(text(first)).toContain('搜索中 1/5'); expect(text(cls('th-growth', root))).toContain('Lv20');
            if (!immersive) expect(text(cls('th-growth-points', root))).toContain('10');
            // Measured fixture from the actual 320px Mac failure; no simulation value is changed by this callback.
            first.getBoundingClientRect = () => ({ width: 59.49, top: 0, right: 59.49 });
            const saved = game.extensionRuntime!.snapshot(), random = rng.getState(), count = game.recordedInputEvents.length;
            expect(resized).toBeTypeOf('function'); resized!(); await tick();
            // The inline logical minimum wins over the real compiled cascade's generic min-width:0.
            expect(statuses.props.style.minInlineSize).toBe('60px');
            const styles = hudCascade(statuses, width);
            if (immersive) {
                expect(styles).toMatchObject({ flex: '0 1 auto', 'overflow-x': 'auto', 'overflow-y': 'hidden', 'flex-wrap': 'nowrap' });
                expect(hudCascade(first, width)).toMatchObject({ flex: '0 0 auto', 'max-width': 'none', 'white-space': 'nowrap' });
                expect(text(cls('th-panel', root))).toBe('周围');
            }
            for (const name of ['th-hp', 'th-food', 'th-depth', 'th-growth']) expect(hudCascade(cls(name, root), width).display).not.toBe('none');
            expect(all(statuses).filter(item => hasClass(item, 'th-status'))).toHaveLength(3);
            expect(game.extensionRuntime!.snapshot()).toEqual(saved); expect(rng.getState()).toEqual(random); expect(game.recordedInputEvents).toHaveLength(count);
        } finally { vi.stubGlobal('ResizeObserver', priorObserver); win.innerWidth = 1440; }
    });
    it('compiles stable four-column skill controls that remain bounded on a 320px panel', () => {
        const style = parse(source('ext/modules/growth/ui/GrowthCharacterPanel.vue')).descriptor.styles[0]!;
        const compiled = compileStyle({ source: style.content, filename: 'GrowthCharacterPanel.vue', id: 'data-v-growth-panel', scoped: style.scoped });
        expect(compiled.errors).toEqual([]);
        const declarations: Record<string, Record<string, string>> = {};
        postcss.parse(compiled.code).walkRules(rule => { if (!rule.selector.includes('.growth-skill-actions')) return;
            const name = rule.selector.replace(/\[data-v-growth-panel\]/g, '');
            rule.walkDecls(value => { (declarations[name] ??= {})[value.prop] = value.value; });
        });
        expect(declarations['.growth-skill-actions']).toMatchObject({ display: 'grid', 'grid-template-columns': 'repeat(4,minmax(0,1fr))' });
        expect(declarations['.growth-skill-actions>span']).toMatchObject({ 'grid-column': '1/-1' });
        expect(declarations['.growth-panel .growth-skill-actions button']).toMatchObject({ 'min-width': '0', padding: '8px 2px' });
    });
    it('latches a cached-panel skill-bar double click even when the skill has zero cooldown and cost', async () => {
        configured(pack => {
            const brace = pack.definitions.find(entry => entry.id === 'growth.skill.brace') as GrowthSkill;
            brace.cooldown = 0; brace.focusCost = 0; brace.prerequisites = [];
        });
        await start(); game.monsters = []; game.dormantMonsters = []; game.items = [];
        record('learn-skill', { skillId: skillId('brace') }); record('equip-skills', { active: [skillId('brace')], passive: [] });
        vi.advanceTimersByTime(100); await tick();
        await skills(); click(cls('growth-back')); await tick();
        const button = find('data-use-skill', skillId('brace'), root), count = game.recordedInputEvents.length, turns = game.stats.turns;
        click(button); click(button); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(count + 1); expect(game.stats.turns).toBe(turns + 1);
        expect(cls('growth-panel')).toBeTruthy();
    });
    it('withholds real future growth output through a skill hunger ACK and delay, then restores immediately without remounting', async () => {
        realDialogs = true;
        await prepared(); await skills(); await press('learn-skill', 'brace'); await press('equip-skill', 'brace');
        const panel = cls('growth-panel'), overlay = cls('growth-overlay'), hud = cls('th-growth', root), bar = cls('growth-skill-bar', root);
        const session = moduleSessions[0], count = moduleSessions.length;
        const button = find('data-action', 'use-skill', actions('brace')); button.focus();
        game.player.inventory.items = []; game.player.nutrition = HUNGER_THRESHOLD + 1;
        game.player.setStatusDuration('slowed', 20); game.animationEnabled = true;
        click(button); await tick();
        for (let index = 0; index < 100 && game.isAdvancing; index++) game.tickAdvancement(16);
        expect(game.isAdvancing).toBe(false); await tick();
        const timeline = presentationTimeline(game)!;
        expect(mountedDialogs.current?.kind).toBe('acknowledgment');
        expect(timeline.pendingEvents.some(event => event.kind === 'animation-delay')).toBe(true);
        vi.advanceTimersByTime(100); await tick();
        for (const surface of [hud, bar, overlay]) {
            expect(surface.props.style.visibility).toBe('hidden');
            expect(surface.props.inert).toBe(true); expect(surface.props['aria-hidden']).toBe(true);
        }
        expect(doc.activeElement).toBe(find('data-dialog-action', 'more'));
        expect(cls('growth-panel')).toBe(panel); expect(moduleSessions).toHaveLength(count); expect(moduleSessions[0]).toBe(session);
        const final = readGrowthCharacterView(game)!, snapshot = game.extensionRuntime!.snapshot(), random = rng.getState(), events = game.recordedInputEvents.length;
        expect(final.skills.find(skill => skill.id === skillId('brace'))!.cooldownRemaining).toBeGreaterThan(0);
        mountedDialogs.answer(mountedDialogs.current!.token, 'more'); await tick();
        expect(mountedDialogs.current).toBeUndefined(); expect(timeline.busy).toBe(true);
        expect(overlay.props.style.visibility).toBe('hidden'); expect(panel.contains(doc.activeElement!)).toBe(false);
        // No shell timer tick: the timeline's existing service source restores
        // fresh model output on the exact idle transition.
        for (let index = 0; index < 1000 && timeline.busy; index++) timeline.tick(16);
        await tick(); expect(timeline.busy).toBe(false);
        expect(cls('growth-panel')).toBe(panel); expect(moduleSessions[0]).toBe(session);
        for (const surface of [hud, bar, overlay]) {
            expect(surface.props.style?.visibility).not.toBe('hidden'); expect(surface.props.inert).toBeUndefined();
        }
        expect(text(cls('growth-bar-focus', root))).toBe(i18next.t('ext.growth.ui.focus_compact', { current: final.focus.current, capacity: final.focus.capacity }));
        expect(text(actions('brace').parent!)).toContain(i18next.t('ext.growth.ui.cooldown_remaining', { count: final.skills.find(skill => skill.id === skillId('brace'))!.cooldownRemaining }));
        expect(doc.activeElement).toBe(panel); // the original use button is now disabled
        expect(game.extensionRuntime!.snapshot()).toEqual(snapshot); expect(rng.getState()).toEqual(random); expect(game.recordedInputEvents).toHaveLength(events);
    });
    it('preserves controller, allocation draft, selected tab and focus across display-only suspension', async () => {
        realDialogs = true; configured(); await start();
        const draft = vi.spyOn(growthView, 'createGrowthAllocationDraft');
        await open(); await step(con); const panel = cls('growth-panel'), session = moduleSessions[0];
        click(find('data-tab', 'identities')); await tick();
        const selected = find('data-tab', 'identities'); selected.focus();
        const created = draft.mock.results.map(result => result.value), snapshot = game.extensionRuntime!.snapshot(), random = rng.getState();
        logger.log('display-only interruption', '#fff', { acknowledge: true });
        observePresentation(game, 'animation-delay', 40); await tick();
        expect(cls('growth-overlay').props.style.visibility).toBe('hidden');
        mountedDialogs.answer(mountedDialogs.current!.token, 'more'); await tick();
        expect(panel.contains(doc.activeElement!)).toBe(false);
        presentationTimeline(game)!.tick(40); await tick();
        expect(cls('growth-panel')).toBe(panel); expect(moduleSessions[0]).toBe(session);
        expect(draft.mock.results.map(result => result.value)).toEqual(created);
        expect(find('data-tab', 'identities')).toBe(selected); expect(selected.props.class).toContain('selected'); expect(doc.activeElement).toBe(selected);
        click(find('data-tab', 'attributes')); await tick();
        expect(text(find('data-attribute', con))).toContain('→');
        expect((session!.panel.value!.props.model as growthView.GrowthCharacterViewModel).allocation.attributes).toEqual({ [con]: 1 });
        expect(game.extensionRuntime!.snapshot()).toEqual(snapshot); expect(rng.getState()).toEqual(random);
    });
    it('does not steal focus from a shared alertdialog when display presentation becomes idle', async () => {
        realDialogs = true; configured(); await start(); await open();
        const panel = cls('growth-panel'); find('data-tab', 'attributes').focus();
        logger.log('display-only interruption', '#fff', { acknowledge: true });
        observePresentation(game, 'animation-delay', 40); await tick();
        mountedDialogs.answer(mountedDialogs.current!.token, 'more'); await tick();
        mountedDialogs.request({ kind: 'confirm', owner: 'test:next-confirm', text: 'Next decision', defaultAction: 'no', onAnswer() {} });
        await tick(); const no = find('data-dialog-action', 'no');
        // The next shared dialog owns keyboard focus while the display suffix
        // finishes; restoring the suspended character must not take it back.
        no.focus(); expect(doc.activeElement).toBe(no);
        presentationTimeline(game)!.tick(40); await tick();
        expect(cls('growth-overlay').props.style?.visibility).not.toBe('hidden');
        expect(cls('growth-panel')).toBe(panel); expect(doc.activeElement).toBe(no);
    });
    it('restores visible read-only module browsing after replay load and seek replace a busy live timeline', async () => {
        realDialogs = true; await prepared(); await skills(); await press('learn-skill', 'brace'); await press('equip-skill', 'brace');
        const recording = game.exportRecording(); click(cls('growth-back')); await tick();
        logger.log('abandoned live warning', '#fff', { acknowledge: true });
        observePresentation(game, 'animation-delay', 40); await tick();
        expect(cls('growth-skill-bar', root).props.style.visibility).toBe('hidden');
        expect(game.loadReplay(recording)).toBe(true);
        game.replaySeek(recording.events.length); vi.advanceTimersByTime(100); await tick();
        expect(presentationTimeline(game)!.busy).toBe(false); expect(game.replayError).toBeNull();
        expect(cls('growth-skill-bar', root).props.style?.visibility).not.toBe('hidden');
        await skills(); expect(cls('growth-overlay').props.style?.visibility).not.toBe('hidden');
        expect(text(body)).toContain('录像回放');
        expect(all(body).filter(node => ['learn-skill', 'equip-skill', 'unequip-skill', 'use-skill'].includes(node.props['data-action'])).every(node => node.props.disabled)).toBe(true);
        const snapshot = game.extensionRuntime!.snapshot(), random = rng.getState(), cursor = game.replayCursor;
        click(find('data-tab', 'identities')); await tick(); click(find('data-tab', 'skills')); await tick();
        expect(game.extensionRuntime!.snapshot()).toEqual(snapshot); expect(rng.getState()).toEqual(random); expect(game.replayCursor).toBe(cursor);
    });
    it('executes wait/search skills exactly once and disables cooldown repeat while browsing is pure', async () => {
        await prepared(); await skills(); await press('learn-skill', 'brace'); await press('equip-skill', 'brace');
        const before = game.recordedInputEvents.length, turns = game.stats.turns, focus = readGrowthCharacterView(game)!.focus.current;
        const button = find('data-action', 'use-skill', actions('brace')); click(button); click(button); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(before + 1); expect(game.stats.turns).toBe(turns + 1);
        expect(readGrowthCharacterView(game)!.focus.current).toBe(focus - 3);
        expect(find('data-action', 'use-skill', actions('brace')).props.disabled).toBe(true);
        vi.spyOn(Date, 'now').mockReturnValue(123456);
        const saved = JSON.stringify(game.toSnapshot()), random = rng.getState();
        vi.advanceTimersByTime(2000); await tick(); expect(JSON.stringify(game.toSnapshot())).toBe(saved); expect(rng.getState()).toEqual(random);
        await press('learn-skill', 'survey'); await press('equip-skill', 'survey');
        await press('use-skill', 'survey'); expect(game.searchProgress).toBe(1);
        expect(JSON.parse(String(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.data))).toMatchObject({ action: 'use-skill', payload: { skillId: skillId('survey'), target: { kind: 'self' } } });
    });
    it('cancels targeting with center, outside and Escape without resource/time/RNG/record changes; native targets revalidate', async () => {
        await prepared(); await skills(); await press('learn-skill', 'withdraw'); await press('equip-skill', 'withdraw');
        const saved = JSON.stringify(game.toSnapshot()), random = rng.getState(), count = game.recordedInputEvents.length;
        await press('use-skill', 'withdraw'); expect(cls('growth-target-picker')).toBeTruthy();
        click(find('data-action', 'cancel-target')); await tick(); expect(cls('growth-target-picker')).toBeUndefined();
        await press('use-skill', 'withdraw'); click(cls('growth-overlay')); await tick(); expect(cls('growth-panel')).toBeTruthy(); expect(cls('growth-target-picker')).toBeUndefined();
        await press('use-skill', 'withdraw'); input['handleKeyDown']({ key: 'Escape', code: 'Escape', target: body, preventDefault() {}, stopImmediatePropagation() {} } as unknown as KeyboardEvent); await tick();
        expect(cls('growth-panel')).toBeTruthy(); expect(cls('growth-target-picker')).toBeUndefined();
        expect(game.recordedInputEvents).toHaveLength(count); expect(JSON.stringify(game.toSnapshot())).toBe(saved); expect(rng.getState()).toEqual(random);
        await press('use-skill', 'withdraw'); const choice = all(body).find(node => node.props['data-direction'] && !node.props.disabled)!;
        expect(choice).toBeTruthy(); const before = { ...game.player.loc }; click(choice); await tick(); await tick();
        expect(game.player.loc).not.toEqual(before); expect(game.recordedInputEvents).toHaveLength(count + 1);
        const event = JSON.parse(String(game.recordedInputEvents[count]!.data)); expect(event.payload.target).toEqual({ kind: 'cell', ...game.player.loc }); expect(event.payload.actorId).toBeUndefined();
        expect(cls('growth-panel')).toBeTruthy(); expect(cls('growth-target-picker')).toBeUndefined();
    });
    it('uses visible adjacent creature IDs and rejects a stale target without paying or substituting a different attack', async () => {
        await prepared(); await skills(); await press('learn-skill', 'measured-strike'); await press('equip-skill', 'measured-strike');
        const { Monster } = await import('../../../../entities/Monster');
        const { TerrainType } = await import('../../../../engine/Map/Grid');
        const { default: monsters } = await import('../../../../data/monsters.json');
        const x = game.player.x + 1, y = game.player.y;
        game.grid.setTerrain(x, y, TerrainType.FLOOR); const cell = game.grid.getCell(x, y)!;
        cell.isVisible = true; cell.isDiscovered = true;
        const enemy = new Monster(x, y, monsters.find(monster => monster.id === 'rat') as never);
        enemy.hp = enemy.maxHp = 1000; enemy.ticksUntilTurn = 10000; game.monsters.push(enemy); game.extensionRuntime!.attachCreature(enemy);
        vi.advanceTimersByTime(100); await tick(); await press('use-skill', 'measured-strike');
        const east = find('data-direction', 'e'); expect(east.props.disabled).toBe(false);
        enemy.loc.x += 2;
        const count = game.recordedInputEvents.length, focus = readGrowthCharacterView(game)!.focus.current, turns = game.stats.turns, random = rng.getState();
        click(east); await tick(); await tick(); expect(cls('growth-error')).toBeTruthy();
        expect(game.recordedInputEvents).toHaveLength(count); expect(readGrowthCharacterView(game)!.focus.current).toBe(focus);
        expect(game.stats.turns).toBe(turns); expect(rng.getState()).toEqual(random);
        enemy.loc.x = x; vi.advanceTimersByTime(100); await tick(); await press('use-skill', 'measured-strike'); click(find('data-direction', 'e')); await tick(); await tick();
        expect(game.recordedInputEvents).toHaveLength(count + 1); expect(readGrowthCharacterView(game)!.focus.current).toBe(focus - 2);
        expect(JSON.parse(String(game.recordedInputEvents[count]!.data))).toMatchObject({ action: 'use-skill', payload: { skillId: skillId('measured-strike'), target: { kind: 'creature', id: enemy.id } } });
        expect(game.stats.turns).toBe(turns + 1);
    });
    it('keeps no-slot/unmet/unaffordable learning and all replay mutations disabled', async () => {
        configured(pack => { pack.config.skills.activeSlots = 0; pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 2 }; });
        await start(); await skills(); expect(find('data-action', 'learn-skill', actions('brace')).props.disabled).toBe(true);
        await press('learn-skill', 'measured-strike'); expect(find('data-action', 'equip-skill', actions('measured-strike')).props.disabled).toBe(true);
        expect(find('data-action', 'learn-skill', actions('survey')).props.disabled).toBe(true);
        click(cls('growth-back')); await tick(); const recording = game.exportRecording(); expect(game.loadReplay(recording)).toBe(true);
        while (game.replayCursor < recording.events.length && !game.replayError) game.replayStep(true);
        vi.advanceTimersByTime(100); await tick(); await skills();
        expect(all(body).filter(node => ['learn-skill', 'equip-skill', 'unequip-skill', 'use-skill'].includes(node.props['data-action'])).every(node => node.props.disabled)).toBe(true);
        expect(text(body)).toContain('录像回放');
    });
    it('compiles dedicated skill layout rows with fully scoped selectors in normal/immersive/replay/coarse layouts', () => {
        const style = parse(source('App.vue')).descriptor.styles[0]!;
        const compiled = compileStyle({ source: style.content, filename: 'App.vue', id: 'data-v-growth-app', scoped: style.scoped });
        expect(compiled.errors).toEqual([]); const rows: string[] = [];
        postcss.parse(compiled.code).walkRules(rule => {
            if (!rule.selector.includes('has-module-bars')) return;
            expect(rule.selector).toMatch(/^html\[data-ui-concept=glyph\] \.app-layout\.theme-shell\./);
            expect(rule.selector).not.toContain('[data-v-');
            rule.walkDecls('grid-template-areas', declaration => { expect(declaration.value).toContain('skills'); expect(declaration.value).toContain('map'); rows.push(rule.selector); });
            rule.walkDecls(declaration => expect(declaration.prop).not.toBe('display'));
        });
        expect(rows).toHaveLength(7);
    });
});
