import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ModalKeyboard, isTextEntry } from '../ui/modalKeyboard';

let manager: import('../engine/Input').InputManager;
const events = new EventTarget();
const commands: unknown[][] = [];
let removeModal: (() => void) | undefined;
beforeAll(async () => {
    vi.stubGlobal('window', events);
    const { InputManager } = await import('../engine/Input');
    manager = new InputManager();
    manager.setCallback((...args) => commands.push(args));
});
afterEach(() => { removeModal?.(); removeModal = undefined; commands.length = 0; });
afterAll(() => vi.unstubAllGlobals());
function keydown(key: string, target?: object): KeyboardEvent {
    const event = new Event('keydown', { cancelable: true }) as KeyboardEvent;
    Object.defineProperty(event, 'key', { value: key });
    if (target) Object.defineProperty(event, 'target', { value: target });
    events.dispatchEvent(event);
    return event;
}

describe('UX-1B explicit modal keyboard ownership', () => {
    it('consults a later-mounted modal before an earlier global listener and restores globals on disposal', () => {
        const selected: string[] = [];
        removeModal = manager.registerModalKeyHandler(event => {
            selected.push(event.key); event.preventDefault(); return true;
        });
        for (const key of ['d', 'a', 'e', 'i', 'h', 'j', 'k', 'l', 'x']) keydown(key);
        expect(selected).toEqual(['d', 'a', 'e', 'i', 'h', 'j', 'k', 'l', 'x']);
        expect(commands).toEqual([]);
        removeModal();
        keydown('d');
        expect(commands).toEqual([['inventory_action', 'drop']]);
    });

    it('keeps text inputs and contenteditable out of both modal and game dispatch', () => {
        const modal = vi.fn(() => true);
        removeModal = manager.registerModalKeyHandler(modal);
        for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { isContentEditable: true }]) {
            keydown('d', target);
        }
        expect(modal).not.toHaveBeenCalled(); expect(commands).toEqual([]);
        expect(isTextEntry(null)).toBe(false);
    });

    it('claims native button activation without preventing the DOM default action', () => {
        removeModal = manager.registerModalKeyHandler(() => true);
        expect(keydown('Enter', { tagName: 'BUTTON' }).defaultPrevented).toBe(false);
        expect(commands).toEqual([]);
    });

    it('orders result/inspection/inventory by explicit priority regardless of registration order', () => {
        for (const order of [[0, 100, 50], [100, 50, 0]]) {
            const scopes = new ModalKeyboard();
            const seen: number[] = [];
            const remove: Array<() => void> = [];
            for (const priority of order) remove.push(scopes.register(() => { seen.push(priority); return priority === 50; }, priority));
            expect(scopes.handle({ key: 'Escape' } as KeyboardEvent)).toBe(true);
            expect(seen).toEqual([100, 50]);
            remove.forEach(dispose => dispose());
            expect(scopes.handle({ key: 'Escape' } as KeyboardEvent)).toBe(false);
        }
    });
});
