import { afterEach, describe, expect, it, vi } from 'vitest';
import { DialogService, type DialogEntry } from '../ui/dialogService';
import { DialogInput, dialogKeyAction } from '../ui/dialogInput';
import { bindDialogAcknowledgments } from '../ui/dialogAcknowledgments';
import { Logger } from '../engine/Systems/Logger';
import type { Game } from '../engine/Core/Game';

const key = (value: string, repeat = false, target: unknown = null) => ({ key: value,
    code: value === ' ' ? 'Space' : value, repeat, target,
    preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as KeyboardEvent;
const inside = { closest: () => null };
const pointer = (id = 1, target: unknown = inside, x = 0, y = 0) => ({ pointerId: id,
    target, button: 0, clientX: x, clientY: y, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() }) as unknown as PointerEvent;
const request = (service: DialogService, answer = vi.fn(), kind: 'confirm' | 'acknowledgment' = 'confirm') =>
    service.request({ kind, text: 'same text', owner: 'test', onAnswer: answer });
afterEach(() => vi.restoreAllMocks());

describe('D1 session queue capabilities', () => {
    it('preserves FIFO and duplicate occurrences; tokens belong to one session', async () => {
        const service = new DialogService(), other = new DialogService();
        const answer = vi.fn(), first = request(service, answer), second = request(service, answer);
        const foreign = request(other);
        expect(service.queueLength).toBe(2);
        expect(Object.isFrozen(service.current)).toBe(true);
        expect(service.current).not.toHaveProperty('onAnswer');
        expect(service.answer(second.token, 'yes')).toBe(false);
        expect(service.answer(foreign.token, 'yes')).toBe(false);
        expect(service.answer({ ...first.token }, 'yes')).toBe(false);
        expect(service.answer(first.token, 'more')).toBe(false);
        expect(service.answer(first.token, 'no')).toBe(true);
        expect(service.answer(first.token, 'yes')).toBe(false);
        expect(await first.result).toEqual({ status: 'answered', action: 'no' });
        expect(service.current?.token).toBe(second.token);
        expect(service.answer(second.token, 'yes')).toBe(true);
        expect(answer.mock.calls).toEqual([['no'], ['yes']]);
        other.dispose(); service.dispose();
    });
    it('cancel/reset/dispose settle pending promises without a business answer', async () => {
        const service = new DialogService(), answer = vi.fn();
        const first = request(service, answer), second = request(service, answer);
        second.cancel(); second.cancel(); service.reset();
        expect(await first.result).toEqual({ status: 'cancelled' });
        expect(await second.result).toEqual({ status: 'cancelled' });
        const next = request(service, answer);
        expect(next.token.epoch).toBeGreaterThan(first.token.epoch);
        expect(service.answer(first.token, 'yes')).toBe(false);
        service.dispose();
        expect(await next.result).toEqual({ status: 'cancelled' });
        expect(await request(service, answer).result).toEqual({ status: 'cancelled' });
        expect(answer).not.toHaveBeenCalled();
    });
    it('a rejected admission keeps the request, and a reentrant answer is refused', () => {
        const service = new DialogService();
        let accept = false;
        const handle = request(service, vi.fn(() => {
            expect(service.answer(handle.token, 'yes')).toBe(false);
            return accept;
        }));
        expect(service.answer(handle.token, 'yes')).toBe(false);
        expect(service.current?.token).toBe(handle.token);
        accept = true;
        expect(service.answer(handle.token, 'yes')).toBe(true);
        expect(service.queueLength).toBe(0);
    });
});

describe('D1 unified capture arbitration', () => {
    function scene(kind: 'confirm' | 'acknowledgment' = 'confirm') {
        const input = new DialogInput(), service = new DialogService(), hint = vi.fn(), answer = vi.fn();
        input.attach({ service, hint, contains: target => [inside, yes, result].includes(target as unknown as typeof inside) });
        const handle = request(service, answer, kind);
        return { input, service, hint, answer, handle };
    }
    const yes = { closest: () => ({ getAttribute: () => 'yes' }) };
    const result = { closest: () => ({ getAttribute: () => 'view-result' }) };
    it.each([['y','yes'], ['Y','yes'], ['Enter','yes'], ['n','no'], ['N','no'], [' ','no'], ['Escape','no']] as const)
    ('CE confirm %s answers %s once and swallows repeat/key-up through the next request', (value, action) => {
        const { input, service, answer } = scene();
        input.keydown(key(value)); request(service, answer);
        input.keydown(key(value, true)); input.keydown(key(value));
        expect(answer.mock.calls).toEqual([[action]]);
        const released = key(value); input.keyup(released);
        expect(released.preventDefault).toHaveBeenCalledOnce();
        input.keydown(key(value)); expect(answer.mock.calls).toEqual([[action], [action]]);
        input.keyup(key(value));
        const next = key('ArrowRight'); input.keydown(next);
        expect(next.preventDefault).not.toHaveBeenCalled();
    });
    it.each(['ArrowRight', 'Enter', 'y', 'n', '`'])('MORE refuses %s and gives a UI-only hint', value => {
        const { input, hint, answer } = scene('acknowledgment');
        const event = key(value, false, { tagName: 'INPUT' });
        input.keydown(event);
        expect(answer).not.toHaveBeenCalled(); expect(hint).toHaveBeenCalledOnce();
        expect(event.preventDefault).toHaveBeenCalledOnce();
    });
    it.each([' ', 'Escape'])('MORE accepts a fresh %s', value => {
        const { input, answer } = scene('acknowledgment');
        input.keydown(key(value)); expect(answer).toHaveBeenCalledWith('more');
    });
    it('records the trigger key before a dialog opens, quarantines it until release, and orders Reference after Host', () => {
        const input = new DialogInput(), service = new DialogService(), reference = vi.fn(() => true), answer = vi.fn();
        input.register({ keydown: reference });
        input.attach({ service, hint() {}, contains: () => true });
        input.keydown(key('ArrowRight')); expect(reference).toHaveBeenCalledOnce();
        const first = request(service, answer);
        input.keydown(key('ArrowRight', true)); input.keydown(key(' ', true));
        expect(answer).not.toHaveBeenCalled();
        input.keyup(key(' ')); input.keydown(key(' '));
        expect(answer).toHaveBeenCalledWith('no');
        expect(service.answer(first.token, 'yes')).toBe(false);
        input.keydown(key('ArrowRight', true)); expect(reference).toHaveBeenCalledOnce();
        input.keyup(key('ArrowRight')); input.keydown(key('ArrowRight'));
        expect(reference).toHaveBeenCalledTimes(2);
    });
    it('Host is independent of registration order and Tab keeps native focus navigation', () => {
        const { input, answer } = scene(), reference = vi.fn(() => true);
        input.register({ keydown: reference }, 1_000_000);
        const tab = key('Tab'); input.keydown(tab);
        expect(tab.preventDefault).not.toHaveBeenCalled(); expect(tab.stopImmediatePropagation).toHaveBeenCalledOnce();
        input.keydown(key('Enter', false, { closest: () => ({ getAttribute: () => 'no' }) }));
        expect(answer).toHaveBeenCalledWith('yes'); expect(reference).not.toHaveBeenCalled();
    });
    it('only a matched Host press/release resolves MORE; outside releases, stale fingers, scroll and lost capture do not', () => {
        const { input, answer } = scene('acknowledgment');
        input.pointerup(pointer()); expect(answer).not.toHaveBeenCalled();
        input.pointerdown(pointer(1, null)); input.pointerup(pointer()); expect(answer).not.toHaveBeenCalled();
        input.pointerdown(pointer()); input.pointerup(pointer(1, null)); expect(answer).not.toHaveBeenCalled();
        input.pointerdown(pointer()); input.pointerup(pointer(1, inside, 0, 30)); expect(answer).not.toHaveBeenCalled();
        input.pointerdown(pointer()); input.pointercancel(pointer()); input.pointerup(pointer()); expect(answer).not.toHaveBeenCalled();
        input.pointerdown(pointer()); input.pointerup(pointer()); expect(answer).toHaveBeenCalledWith('more');
    });
    it('a dangerous confirm never accepts background/message clicks; double click and touch/keyboard DOM clicks cannot solve the next token', () => {
        let now = 1000; vi.spyOn(performance, 'now').mockImplementation(() => now);
        const { input, service, answer } = scene();
        input.pointerdown(pointer()); input.pointerup(pointer()); expect(answer).not.toHaveBeenCalled();
        now += 400;
        input.pointerdown(pointer(1, yes)); input.pointerup(pointer(1, yes)); expect(answer).toHaveBeenCalledOnce();
        request(service, answer);
        const click = { preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() } as unknown as MouseEvent;
        input.click(click); input.pointerdown(pointer(1, yes)); input.pointerup(pointer(1, yes));
        expect(answer).toHaveBeenCalledOnce(); expect(click.preventDefault).toHaveBeenCalledOnce();
        now += 600; input.pointerdown(pointer(1, yes)); input.pointerup(pointer(1, yes));
        expect(answer).toHaveBeenCalledTimes(2);
    });
    it('an old map finger stays quarantined through lost capture, modal close and its late click', () => {
        const input = new DialogInput(), service = new DialogService(), answer = vi.fn();
        const win = new EventTarget(); input.install(win as unknown as Window);
        input.attach({ service, contains: target => (target as unknown) === inside, hint() {} });
        input.pointerdown(pointer(7, null)); request(service, answer, 'acknowledgment');
        const lost = new Event('lostpointercapture', { cancelable: true }); Object.assign(lost, { pointerId: 7 });
        win.dispatchEvent(lost); expect(lost.defaultPrevented).toBe(true);
        input.keydown(key(' ')); expect(answer).toHaveBeenCalledOnce();
        const up = pointer(7, inside); input.pointerup(up); expect(up.preventDefault).toHaveBeenCalledOnce();
        const late = { preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() } as unknown as MouseEvent;
        input.click(late); expect(late.preventDefault).toHaveBeenCalledOnce();
        expect(answer).toHaveBeenCalledOnce(); input.dispose();
    });
    it('a secondary-button release cannot complete a primary Host press', () => {
        const { input, answer } = scene('acknowledgment');
        input.pointerdown(pointer()); input.pointerup({ ...pointer(), button: 2 } as PointerEvent);
        expect(answer).not.toHaveBeenCalled();
    });
    it('native confirmation preserves its result and quarantines the old held key', () => {
        const input = new DialogInput(); input.keydown(key('y'));
        expect(input.native(() => { expect(input.busy()).toBe(true); return false; })).toBe(false);
        const repeat = key('y', true); input.keydown(repeat); expect(repeat.preventDefault).toHaveBeenCalledOnce();
        input.keyup(key('y')); const next = key('y'); input.keydown(next); expect(next.preventDefault).not.toHaveBeenCalled();
    });
    it('native confirmation temporarily owns input without resolving an already queued Host', () => {
        const { input, service, handle, answer } = scene();
        expect(input.native(() => {
            input.keydown(key('y')); input.pointerdown(pointer()); input.pointerup(pointer());
            return false;
        })).toBe(false);
        expect(answer).not.toHaveBeenCalled(); expect(service.current?.token).toBe(handle.token);
        input.keyup(key('y')); input.keydown(key('y')); expect(answer).toHaveBeenCalledWith('yes');
    });
    it('window blur cannot release an old held key after a dialog closes', () => {
        const input = new DialogInput(), service = new DialogService(), gameKey = vi.fn(() => false);
        const win = new EventTarget(); input.install(win as unknown as Window);
        input.register({ keydown: gameKey }); input.attach({ service, contains: () => true, hint() {} });
        input.keydown(key('ArrowRight')); gameKey.mockClear();
        request(service); input.keydown(key('n')); win.dispatchEvent(new Event('blur'));
        input.keydown(key('ArrowRight', true)); expect(gameKey).not.toHaveBeenCalled();
        input.keyup(key('ArrowRight')); input.keydown(key('ArrowRight')); expect(gameKey).toHaveBeenCalledOnce();
        input.dispose();
    });
    it('view-result remains available with advancing simulation and leaves MORE unread', () => {
        const entry = { kind: 'acknowledgment', terminalAvailable: true } as DialogEntry;
        expect(dialogKeyAction(entry, key('r'))).toBe('view-result');
        expect(dialogKeyAction(entry, key('Enter', false, result))).toBe('view-result');
        expect(dialogKeyAction(entry, key(' ', false, result))).toBe('view-result');
    });
});

describe('D1 Logger adapter', () => {
    it('queues 102 folded occurrences by identity, preserves the capped archive, and bypasses replay', async () => {
        const service = new DialogService(), log = new Logger();
        const game = { player: {}, replayRecording: null, isGameOver: false } as unknown as Game;
        const remove = bindDialogAcknowledgments(service, game, log);
        for (let i = 0; i < 102; i++) log.log('same', '#fff', { acknowledge: true });
        expect(service.queueLength).toBe(102); expect(log.messages[0]?.count).toBe(100);
        const archive = log.getState();
        for (let i = 0; i < 102; i++) expect(service.answer(service.current!.token, 'more')).toBe(true);
        expect(log.getState()).toEqual(archive); expect(service.queueLength).toBe(0);
        log.log('old', '#fff', { acknowledge: true });
        const token = service.current!.token;
        game.replayRecording = {} as Game['replayRecording']; service.sync();
        expect(service.current).toBeUndefined(); expect(service.answer(token, 'more')).toBe(false);
        log.log('replay', '#fff', { acknowledge: true }); expect(service.current).toBeUndefined();
        remove(); service.dispose();
    });
    it('terminal bypass preserves unread order/archive and late terminal warnings never become modal', () => {
        const service = new DialogService(), log = new Logger();
        const game = { player: {}, replayRecording: null, isGameOver: false, isAdvancing: true } as unknown as Game;
        const remove = bindDialogAcknowledgments(service, game, log);
        for (const text of ['first', 'same', 'same']) log.log(text, '#fff', { acknowledge: true });
        game.isGameOver = true; service.sync(); const archive = log.getState();
        expect(service.answer(service.current!.token, 'view-result')).toBe(true);
        expect(service.queueLength).toBe(0); expect(log.getState()).toEqual(archive);
        expect(log.unreadAcknowledgments.map(message => message.text)).toEqual(['first', 'same', 'same']);
        log.log('late', '#fff', { acknowledge: true }); expect(service.current).toBeUndefined();
        expect(log.unreadAcknowledgments.map(message => message.text)).toEqual(['first', 'same', 'same', 'late']);
        log.clearAcknowledgments(); expect(log.unreadAcknowledgments).toEqual([]);
        remove();
    });
});
