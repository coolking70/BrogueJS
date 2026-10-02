import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import * as translation from 'i18next-vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { parse as parseCss } from 'postcss';
import { activeGame as game, Game } from '../engine/Core/Game';
import { TerrainType } from '../engine/Map/Grid';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';
import { timeSystem } from '../engine/Systems/Time';
import { computeLayoutMode } from '../ui/layout';
import '../i18n';

// Exercise the production client templates without a browser, as in theme_shell_fixes.
interface Node { type: string; text: string; props: Record<string, any>; children: Node[]; parent: Node | null }
const node = (type: string, text = ''): Node => ({ type, text, props: {}, children: [], parent: null });
const renderer = Vue.createRenderer<Node, Node>({
    createElement: type => node(type), createText: text => node('text', text), createComment: text => node('comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        child.parent = parent;
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child);
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, value) => { n.text = value; }, setElementText: (n, value) => { n.text = value; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _previous, value) => { n.props[key] = value; },
});
const all = (n: Node): Node[] => [n, ...n.children.flatMap(all)];
const text = (n: Node): string => n.text + n.children.map(text).join('');
const hasClass = (n: Node, cls: string) => String(n.props.class).split(' ').includes(cls);
const mounted: Array<ReturnType<typeof renderer.createApp>> = [];
let ThemeHud: Vue.Component;
let Sidebar: Vue.Component;

function mount(component: Vue.Component, props = {}) {
    const root = node('root'), app = renderer.createApp(component, props);
    app.use(I18NextVue, { i18next }); app.mount(root); mounted.push(app);
    return root;
}
function room() {
    game.animationEnabled = false;
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.visibleMonsters.clear(); game.visibleItems.clear(); game.everSeenMonsters.clear(); game.everSeenItems.clear();
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x >= 5 && x <= 45 && y >= 5 && y <= 15 ? TerrainType.FLOOR : TerrainType.GRANITE);
        const cell = game.grid.getCell(x, y)!;
        Object.assign(cell, { isVisible: false, isExplored: true, hasMemory: true, isMagicMapped: false,
            isClairvoyantVisible: false, autoSearched: true, machineNumber: 0,
            rememberedLayers: [...cell.layers], rememberedItem: null });
    }
    game.player.loc = { x: 10, y: 10 }; game.player.hp = game.player.maxHp = 30;
    game.player.equippedArmor = null; game.player.equippedWeapon = null;
    (game as any).monsterSpawnFuse = 100000;
    (game as any).updateVision(); logger.reset(); game.disturbed = false;
}
async function poll() { await vi.advanceTimersByTimeAsync(100); await Vue.nextTick(); }
function expectProgress(root: Node, charge: number, sidebar = false) {
    const rows = all(root).filter(n => hasClass(n, sidebar ? 'status-tag' : 'th-status'));
    const search = rows.find(n => text(n).includes('搜索'));
    if (charge === 0) { expect(search).toBeUndefined(); return; }
    expect(search, `search ${charge}/5 must be visible`).toBeDefined();
    expect(text(search!)).toContain(`${charge}/5`);
    const fill = all(search!).find(n => hasClass(n, sidebar ? 'status-duration' : 'th-status-fill'));
    expect(fill?.props.style.width).toBe(`${charge * 20}%`);
}

// Evaluate the stylesheet's descendant class/attribute rules to catch compact
// immersive display:none regressions. Pixel geometry still needs browser QA.
const css = parseCss(readFileSync(new URL('../assets/theme-shells.css', import.meta.url), 'utf8'));
function compoundMatches(n: Node, selector: string): boolean {
    const negatives = [...selector.matchAll(/:not\(\.([\w-]+)\)/g)];
    if (negatives.some(match => hasClass(n, match[1]!))) return false;
    selector = selector.replace(/:not\(\.[\w-]+\)/g, '');
    const attrs = [...selector.matchAll(/\[([\w-]+)=([\w-]+)\]/g)];
    if (attrs.some(match => n.props[match[1]!] !== match[2])) return false;
    selector = selector.replace(/\[[\w-]+=[\w-]+\]/g, '');
    const classes = [...selector.matchAll(/\.([\w-]+)/g)];
    if (classes.some(match => !hasClass(n, match[1]!))) return false;
    selector = selector.replace(/\.[\w-]+/g, '');
    return selector === '' || selector === n.type;
}
function cssStyle(n: Node) {
    const html = node('html'); html.props['data-ui-concept'] = 'glyph';
    const ancestors: Node[] = [];
    for (let parent = n.parent; parent; parent = parent.parent) ancestors.unshift(parent);
    ancestors.unshift(html);
    const values: Record<string, string> = {}, scores: Record<string, number> = {};
    css.walkRules(rule => {
        for (const selector of rule.selectors) {
            const parts = selector.trim().split(/\s+/);
            if (!compoundMatches(n, parts.pop()!)) continue;
            let index = ancestors.length - 1;
            let matches = true;
            for (const part of parts.reverse()) {
                while (index >= 0 && !compoundMatches(ancestors[index]!, part)) index--;
                if (index < 0) { matches = false; break; }
                index--;
            }
            if (!matches) continue;
            const specificity = (selector.match(/\.[\w-]+|\[[^\]]+\]/g)?.length ?? 0) * 10 + (selector.startsWith('html') ? 1 : 0);
            rule.walkDecls(declaration => {
                const score = specificity + (declaration.important ? 1000 : 0);
                if (score >= (scores[declaration.prop] ?? -1)) {
                    scores[declaration.prop] = score; values[declaration.prop] = declaration.value;
                }
            });
        }
    });
    return values;
}

beforeAll(async () => {
    vi.stubGlobal('window', { innerWidth: 1280,
        setInterval: (callback: () => void, ms: number) => globalThis.setInterval(callback, ms),
        clearInterval: (id: ReturnType<typeof setInterval>) => globalThis.clearInterval(id),
        addEventListener() {}, removeEventListener() {},
    });
    const modules: Record<string, unknown> = {
        vue: Vue, 'i18next-vue': translation, i18next: { default: i18next, __esModule: true },
        '../engine/Core/Game': { activeGame: game },
        '../engine/Systems/Logger': await import('../engine/Systems/Logger'),
        '../engine/Status/statusConfig': await import('../engine/Status/statusConfig'),
        '../engine/Settings': await import('../engine/Settings'),
        '../engine/UI/MonsterSidebar': await import('../engine/UI/MonsterSidebar'),
        '../engine/Input': await import('../engine/Input'),
        '../entities/Player': await import('../entities/Player'),
        '../../entities/Player': await import('../entities/Player'),
        '../ui/useGameHud': await import('../ui/useGameHud'),
        '../../ui/useGameHud': await import('../ui/useGameHud'),
    };
    const compile = (file: string): Vue.Component => {
        const { descriptor } = parse(readFileSync(new URL(`../components/${file}`, import.meta.url), 'utf8'));
        const script = compileScript(descriptor, { id: file, inlineTemplate: true });
        const code = ts.transpileModule(script.content, { compilerOptions: {
            target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
        } }).outputText;
        const exports: any = {};
        new Function('require', 'exports', code)((key: string) => {
            if (!(key in modules)) throw new Error(`Unresolved search HUD import: ${key}`);
            return modules[key];
        }, exports);
        return exports.default;
    };
    ThemeHud = compile('theme/ThemeHud.vue'); Sidebar = compile('Sidebar.vue');
});
beforeEach(() => {
    vi.useFakeTimers(); game.startNewGame({ seed: 33005, mode: 'test' }); room();
});
afterEach(() => { for (const app of mounted.splice(0)) app.unmount(); vi.useRealTimers(); vi.restoreAllMocks(); });
afterAll(() => vi.unstubAllGlobals());

describe('read-only search progress presentation', () => {
    it.each([
        [1280, 800, false], [390, 844, true], [844, 390, true], [768, 1024, true], [1024, 768, true],
    ] as const)('contains multiple statuses at %i×%i (touch=%s), including immersive mode', async (width, height, touch) => {
        for (const immersive of [false, true]) {
            const layout = computeLayoutMode(width, height);
            const root = mount(ThemeHud, { class: 'area-vitals', showPanelButton: layout !== 'desktop' || immersive });
            root.type = 'div';
            root.props.class = `app-layout theme-shell layout-${layout}${touch ? ' has-touch-controls' : ''}${immersive ? ' immersive-mode' : ''}`;
            game.executeCommand('search'); game.executeCommand('search'); game.executeCommand('search');
            game.player.setStatusDuration('poisoned', 20); game.player.setStatusDuration('haste', 20);
            await poll();
            const header = all(root).find(n => hasClass(n, 'theme-hud'))!;
            const statuses = all(root).find(n => hasClass(n, 'th-statuses'))!;
            const numbers = all(root).find(n => hasClass(n, 'th-stats'))!;
            const hudStyle = cssStyle(header), statusStyle = cssStyle(statuses);
            // Only the HUD participates in App's outer grid; its status row stays inside it.
            expect(statuses.parent).toBe(header); expect(header.parent).toBe(root);
            expect(hudStyle['grid-area']).toBe('vitals');
            expect(statusStyle['grid-area'] ?? 'auto').toBe('auto');
            expect(statusStyle.position ?? 'static').toBe('static');
            expect(statusStyle['min-width']).toBe('0'); expect(statusStyle['max-width']).toBe('100%');
            expect(statusStyle.height ?? 'auto').toBe('auto');
            expect(statusStyle['flex-basis'] ?? statusStyle.flex?.split(' ')[2] ?? 'auto').toBe('auto');
            const rows = all(statuses).filter(n => hasClass(n, 'th-status'));
            expect(rows.map(text).join(' ')).toContain('搜索中');
            expect(rows.map(text).join(' ')).toContain('中毒'); expect(rows.map(text).join(' ')).toContain('急行');
            for (const row of rows) {
                expect(cssStyle(row).display).not.toBe('none');
                expect(cssStyle(row)['align-self'] ?? 'auto').not.toBe('stretch');
            }
            if (immersive) {
                expect(hudStyle['flex-wrap']).toBe('nowrap'); expect(statusStyle['flex-wrap']).toBe('nowrap');
                expect(statusStyle.width).toBe('auto');
                expect(statusStyle['overflow-x']).toBe('auto'); expect(statusStyle['overflow-y']).toBe('hidden');
                expect(statusStyle['scrollbar-width']).toBe('none');
            } else {
                expect(header.children.indexOf(statuses)).toBeGreaterThan(header.children.indexOf(numbers));
                expect(Number(statusStyle.order ?? 0)).toBeGreaterThanOrEqual(Number(cssStyle(numbers).order ?? 0));
                expect(statusStyle.width).toBe('100%'); expect(statusStyle['flex-wrap']).toBe('wrap');
                expect(statusStyle.flex).toBe('0 0 auto');
                if (layout !== 'portrait') expect(hudStyle['flex-wrap']).toBe('nowrap');
            }
            // A state disappearing must not leave a reserved row or implicit column.
            game.executeCommand('wait'); await poll();
            expectProgress(root, 0);
            expect(all(root).filter(n => hasClass(n, 'th-status')).map(text).join(' ')).toContain('中毒');
            game.player.setStatusDuration('poisoned', 0); game.player.setStatusDuration('haste', 0); await poll();
            expect(all(root).some(n => hasClass(n, 'th-statuses'))).toBe(false);
            game.startNewGame({ seed: 33005, mode: 'test' }); room();
        }
    });

    it.each([
        ['desktop', false], ['portrait', false], ['landscape', false],
        ['desktop', true], ['portrait', true], ['landscape', true],
    ] as const)('keeps the progress bar visible in %s (immersive=%s)', async (layout, immersive) => {
        const root = mount(ThemeHud);
        root.type = 'div'; root.props.class = `app-layout theme-shell layout-${layout}${immersive ? ' immersive-mode' : ''}`;
        game.player.setStatusDuration('haste', 20);
        game.executeCommand('search'); await poll(); expectProgress(root, 1);
        const header = all(root).find(n => hasClass(n, 'theme-hud'))!;
        const statuses = all(root).find(n => hasClass(n, 'th-statuses'))!;
        const search = all(root).find(n => hasClass(n, 'th-search-progress'))!;
        const fill = all(search).find(n => hasClass(n, 'th-status-fill'))!;
        for (const n of [header, statuses, search, fill]) expect(cssStyle(n).display).not.toBe('none');
        expect(cssStyle(fill)).toMatchObject({ position: 'absolute', height: '2px' });
        const other = all(root).find(n => hasClass(n, 'th-status') && !hasClass(n, 'th-search-progress'))!;
        expect(other).toBeDefined();
        // Follow-up requires concurrent statuses in compact immersive mode too;
        // CE IO.c:4823-4825 renders every named positive status, not only searching.
        if (immersive && layout !== 'desktop') expect(cssStyle(statuses).display).toBe('flex');
        expect(cssStyle(other).display).not.toBe('none');
    });

    it('renders 1/5–4/5 in the glyph HUD and sidebar, then hides after the existing completion message', async () => {
        const hud = mount(ThemeHud), sidebar = mount(Sidebar);
        await poll(); expectProgress(hud, 0); expectProgress(sidebar, 0, true);
        for (let charge = 1; charge <= 5; charge++) {
            game.executeCommand('search'); await poll();
            expectProgress(hud, charge % 5); expectProgress(sidebar, charge % 5, true);
        }
        expect(game.stats.turns).toBe(5);
        expect(logger.messages.some(m => m.text === i18next.t('search.detailed_finished'))).toBe(true);
    });

    it.each(['wait', 'move'])('%s between searches clears the displayed progress', async action => {
        const hud = mount(ThemeHud);
        game.executeCommand('search'); game.executeCommand('search'); await poll(); expectProgress(hud, 2);
        game.executeCommand(action, action === 'move' ? { x: 1, y: 0 } : undefined);
        await poll(); expectProgress(hud, 0);
        game.executeCommand('search'); await poll(); expectProgress(hud, 1);
    });

    it('shows every yielded long-search step and hides after step five', async () => {
        const hud = mount(ThemeHud);
        game.executeCommand('search_long'); await poll(); expectProgress(hud, 1);
        for (let charge = 2; charge <= 5; charge++) {
            game.stepAutoPath(); await poll(); expectProgress(hud, charge % 5);
        }
        expect(game.isAutoTraveling()).toBe(false); expect(game.stats.turns).toBe(5);
        expect(game.recordedInputEvents.map(e => e.action)).toEqual(['search_long', 'auto_step', 'auto_step', 'auto_step', 'auto_step']);
    });

    it.each(['search', 'search_long'])('restores the current %s progress from the existing save state', async action => {
        const hud = mount(ThemeHud), sidebar = mount(Sidebar);
        game.executeCommand(action);
        for (let i = 0; i < 2; i++) action === 'search' ? game.executeCommand('search') : game.stepAutoPath();
        const saved = JSON.parse(JSON.stringify(game.toSaveSnapshot()));
        game.executeCommand('wait'); await poll(); expectProgress(hud, 0);
        expect(game.loadSnapshot(saved)).toBe(true); await poll();
        expectProgress(hud, 3); expectProgress(sidebar, 3, true);
        for (let i = 0; i < 2; i++) action === 'search' ? game.executeCommand('search') : game.stepAutoPath();
        await poll(); expectProgress(hud, 0); expect(game.stats.turns).toBe(5);
    });

    it('tracks manual and long searches on replay and seek without OOS', async () => {
        const hud = mount(ThemeHud);
        game.executeCommand('search'); game.executeCommand('search'); game.executeCommand('wait');
        game.executeCommand('search_long'); while (game.isAutoTraveling()) game.stepAutoPath();
        const recording = game.exportRecording(), start = game.startNewGame.bind(game);
        vi.spyOn(game, 'startNewGame').mockImplementation(options => { start(options); room(); });
        expect(game.loadReplay(recording)).toBe(true); await poll(); expectProgress(hud, 0);
        for (const charge of [1, 2, 0, 1, 2, 3, 4, 0]) {
            game.replayStep(); await poll(); expectProgress(hud, charge); expect(game.replayError).toBeNull();
        }
        game.replaySeek(2); await poll(); expectProgress(hud, 2); expect(game.replayError).toBeNull();
    });

    it('polling both displays leaves the world, turns, both RNG streams and recording unchanged', async () => {
        game.executeCommand('search');
        // Save metadata uses wall-clock time; hold it fixed while advancing HUD timers.
        vi.spyOn(Date, 'now').mockReturnValue(Date.now());
        const before = { snapshot: game.toSaveSnapshot(), rng: rng.getState(), tick: timeSystem.currentTick,
            events: structuredClone(game.recordedInputEvents) };
        const hud = mount(ThemeHud), sidebar = mount(Sidebar);
        for (let i = 0; i < 5; i++) { await poll(); expectProgress(hud, 1); expectProgress(sidebar, 1, true); }
        expect({ snapshot: game.toSaveSnapshot(), rng: rng.getState(), tick: timeSystem.currentTick,
            events: structuredClone(game.recordedInputEvents) }).toEqual(before);
        expect(game.player.statusDurations).not.toHaveProperty('searching');
        expect(Object.getOwnPropertyDescriptor(Game.prototype, 'searchProgress')).toMatchObject({ get: expect.any(Function), set: undefined });
        expect(Object.prototype.hasOwnProperty.call(game, 'searchProgress')).toBe(false);
    });
});
