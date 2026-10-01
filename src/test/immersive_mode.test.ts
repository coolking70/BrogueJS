import 'vue'; // Initialize the renderer before supplying the keyboard/storage-only document fixture.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { rng } from '../engine/Random';
import { activeGame } from '../engine/Core/Game';

const source = (file: string) => readFileSync(new URL('../' + file, import.meta.url), 'utf8');
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

async function setup(initial?: string) {
    const saved = new Map<string, string>();
    if (initial !== undefined) saved.set('brogue-web-display-v1', initial);
    const listeners = new Map<string, (event: KeyboardEvent) => void>();
    const storage = { getItem: (key: string) => saved.get(key) ?? null,
        setItem: (key: string, value: string) => saved.set(key, value) };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage, location: { search: '', href: 'https://brogue.test/' },
        history: { replaceState() {} }, addEventListener: (type: string, cb: (event: KeyboardEvent) => void) => listeners.set(type, cb) });
    vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty() {} } } });
    vi.resetModules();
    const settings = await import('../engine/Settings');
    const { InputManager } = await import('../engine/Input');
    const { registerImmersiveShortcut } = await import('../ui/immersiveMode');
    const input = new InputManager();
    const command = vi.fn(), unbound = vi.fn();
    input.setCallback(command); input.setUnboundKeyCallback(unbound);
    const game = { isInventoryOpen: false, isThrowing: false, pendingArcana: null as unknown,
        referenceScreen: null as unknown, isGameOver: false, isTimePaused: () => false };
    const context = { inGame: true, menuOpen: false, game };
    const stop = registerImmersiveShortcut(input, () => context);
    const key = (extra = {}) => {
        const event = { key: '`', code: 'Backquote', target: null, ctrlKey: false, altKey: false,
            metaKey: false, shiftKey: false, repeat: false, defaultPrevented: false,
            preventDefault: vi.fn(), stopImmediatePropagation: vi.fn(), ...extra };
        listeners.get('keydown')!(event as unknown as KeyboardEvent);
        return event;
    };
    return { settings, saved, input, command, unbound, context, stop, key };
}

describe('DESIGN-3 immersive preference and keyboard pipeline', () => {
    it('defaults off, writes synchronously to the existing display key and survives reload with other settings intact', async () => {
        const { settings, saved, key } = await setup('{"mapScaleMode":"stretch","sidebarWidthMode":"proportional","uiScale":1.25,"showDamageNumbers":true}');
        expect(settings.displaySettings.immersiveMode).toBe(false);
        key();
        expect(JSON.parse(saved.get(settings.DISPLAY_SETTINGS_KEY)!)).toEqual({ mapScaleMode: 'stretch',
            sidebarWidthMode: 'proportional', uiScale: 1.25, showDamageNumbers: true, immersiveMode: true });
        vi.resetModules();
        const reloaded = await import('../engine/Settings');
        expect(reloaded.displaySettings).toEqual({ mapScaleMode: 'stretch', sidebarWidthMode: 'proportional',
            uiScale: 1.25, showDamageNumbers: true, immersiveMode: true });
        reloaded.displaySettings.immersiveMode = false;
        expect(reloaded.loadDisplaySettings().immersiveMode).toBe(false);
        expect(saved.size).toBe(1);
    });

    it.each(['{"immersiveMode":"true"}', '{"immersiveMode":1}', 'null', 'broken'])('rejects malformed preferences: %s', async raw => {
        const { settings } = await setup(raw);
        expect(settings.displaySettings.immersiveMode).toBe(false);
    });

    it('toggles twice without game commands, unbound-key interruption or RNG consumption, and unregisters cleanly', async () => {
        const { settings, key, command, unbound, stop } = await setup();
        const before = rng.getState();
        key(); expect(settings.displaySettings.immersiveMode).toBe(true);
        key({ repeat: true }); expect(settings.displaySettings.immersiveMode).toBe(true);
        key(); expect(settings.displaySettings.immersiveMode).toBe(false);
        expect(command).not.toHaveBeenCalled(); expect(unbound).not.toHaveBeenCalled();
        expect(rng.getState()).toEqual(before);
        stop(); key(); expect(unbound).toHaveBeenCalledOnce();
    });

    it('leaves a real run snapshot and recorder unchanged when routed through the existing input pipeline', async () => {
        activeGame.startNewGame({ seed: '12345', mode: 'wizard' });
        const { input, key } = await setup();
        input.setCallback((action, data) => { activeGame.handlePlayerAction(action, data); activeGame.update(); });
        vi.spyOn(Date, 'now').mockReturnValue(12345); // savedAt is capture metadata, independent of gameplay.
        const snapshot = activeGame.toSaveSnapshot();
        const recorded = [...activeGame.recordedInputEvents];
        const state = rng.getState();
        key(); key();
        expect(activeGame.toSaveSnapshot()).toEqual(snapshot);
        expect(activeGame.recordedInputEvents).toEqual(recorded);
        expect(rng.getState()).toEqual(state);
    });

    it('keeps an in-session preference usable when browser storage is unavailable', async () => {
        const { settings, key } = await setup();
        vi.stubGlobal('window', { localStorage: { getItem() { throw new Error('unavailable'); }, setItem() { throw new Error('unavailable'); } } });
        expect(settings.loadDisplaySettings().immersiveMode).toBe(false);
        expect(() => key()).not.toThrow();
        expect(settings.displaySettings.immersiveMode).toBe(true);
    });

    it('yields to higher-priority modals and blocks menus, inventory, both targeting modes, reference and paused/end screens', async () => {
        const { settings, input, key, context, command } = await setup();
        const modal = vi.fn(() => true);
        const close = input.registerModalKeyHandler(modal, 350);
        key(); expect(modal).toHaveBeenCalledOnce(); expect(settings.displaySettings.immersiveMode).toBe(false);
        close();
        for (const field of ['isInventoryOpen', 'isThrowing', 'pendingArcana', 'referenceScreen', 'isGameOver'] as const) {
            const previous = context.game[field]; context.game[field] = true;
            key(); expect(settings.displaySettings.immersiveMode, field).toBe(false);
            context.game[field] = previous as never;
        }
        context.menuOpen = true; key(); expect(settings.displaySettings.immersiveMode).toBe(false);
        context.menuOpen = false; context.inGame = false; key(); expect(settings.displaySettings.immersiveMode).toBe(false);
        context.inGame = true; context.game.isTimePaused = () => true; key(); expect(settings.displaySettings.immersiveMode).toBe(false);
        expect(command).not.toHaveBeenCalled();
    });

    it('respects text entry/default prevention and ignores modified/repeated keys', async () => {
        const { settings, key } = await setup();
        for (const extra of [{ target: { tagName: 'INPUT' } }, { target: { tagName: 'TEXTAREA' } },
            { target: { isContentEditable: true } }, { defaultPrevented: true }, { ctrlKey: true },
            { altKey: true }, { metaKey: true }, { shiftKey: true }, { repeat: true }]) {
            key(extra); expect(settings.displaySettings.immersiveMode).toBe(false);
        }
    });

    it('preserves all four map preferences independently across refresh and keeps the permanent settings/legend entry', async () => {
        const { settings, saved } = await setup();
        const { selectMapMode, mapMode } = await import('../ui/mapTiles');
        for (const mode of ['original', 'refined', 'hanzi', 'tiles'] as const) {
            selectMapMode(mode); expect(mapMode.value).toBe(mode);
            expect(saved.get('brogue-ui-map-style')).toBe(mode);
            vi.resetModules();
            expect((await import('../ui/mapTiles')).mapMode.value).toBe(mode);
            expect(settings.displaySettings.immersiveMode).toBe(false);
        }
        const menu = source('components/MainMenu.vue');
        expect(menu).toContain('selectMapMode(value)');
        expect(menu).toContain('v-model="mapModeModel"');
        expect(menu).toContain('v-model="displaySettings.immersiveMode"');
        expect(menu).toContain('<MapTileLegend v-if="legendOpen"');
        for (const mode of ['original','refined','hanzi','tiles']) expect(menu).toContain(`value="${mode}"`);
        const app = source('App.vue');
        expect(app).toContain('registerImmersiveShortcut(inputManager');
        expect(app).toContain('removeImmersiveShortcut?.()');
        expect(source('ui/immersiveMode.ts')).not.toMatch(/executeCommand|executeItemCommand|triggerAction|rng\./);
    });
});
