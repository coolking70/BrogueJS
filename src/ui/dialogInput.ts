import { cancelHeldInputs } from './heldInput';
import type { DialogAction, DialogEntry, DialogService, DialogToken } from './dialogService';

/** CE IO.c:2914-2927 / 2951-2973. Enter retains CE's yes meaning,
 * even when the no button has focus. MORE never accepts a movement key. */
export function dialogKeyAction(entry: Pick<DialogEntry, 'kind' | 'terminalAvailable' | 'choices' | 'actions' | 'defaultAction'>, event: KeyboardEvent): DialogAction | undefined {
    if (entry.kind === 'confirm') {
        if (['y', 'Y', 'Enter'].includes(event.key)) return 'yes';
        if (['n', 'N', ' ', 'Escape'].includes(event.key)) return 'no';
    } else if (entry.kind === 'dialogue') {
        if (event.key === 'Escape') return entry.actions?.includes('back') ? 'back' : 'close';
        if (/^[1-9]$/.test(event.key)) {
            const choice = entry.choices?.[Number(event.key) - 1];
            if (choice?.enabled) return choice.action;
        }
        if (event.key === 'Enter' || event.key === ' ') {
            const focused = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action]') as HTMLElement | null;
            if (focused?.hasAttribute?.('disabled')) return;
            const action = focused?.getAttribute('data-dialog-action') as DialogAction | undefined;
            if (action && entry.actions?.includes(action)) return action;
            if (event.key === 'Enter') return entry.defaultAction;
        }
    } else {
        const results = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action="view-result"]');
        if (entry.terminalAvailable && (event.key.toLowerCase() === 'r'
            || (results && ['Enter', ' '].includes(event.key)))) return 'view-result';
        if ([' ', 'Escape'].includes(event.key)) return 'more';
    }
}

interface CaptureHandler { keydown(event: KeyboardEvent): boolean; keyup?(event: KeyboardEvent): boolean }
interface Host {
    service: DialogService;
    contains(target: EventTarget | null): boolean;
    hint(): void;
    tab?(event: KeyboardEvent): void;
    navigate?(event: KeyboardEvent): void;
    scroll?(event: KeyboardEvent): void;
    blocked?(): boolean;
    resultAvailable?(): boolean;
    viewResult?(): void;
}
const POINTER_CLUSTER_MS = 500;

/** A single capture listener orders Host and Reference before InputManager's
 * text-entry check. Physical state is tracked even while no dialog is open. */
export class DialogInput {
    private host?: Host;
    private handlers: Array<{ handler: CaptureHandler; priority: number }> = [];
    private pressed = new Set<string>();
    private swallowed = new Set<string>();
    private pointers = new Set<number>();
    private stalePointers = new Set<number>();
    private press?: { id: number; token: DialogToken; action: DialogAction; x: number; y: number };
    private activeToken?: DialogToken;
    private activeBusy = false;
    private resultPress?: { id: number; x: number; y: number };
    private nativeDepth = 0;
    private removeListeners?: () => void;
    private win?: Window;
    // The second physical press of a browser double click must not answer
    // the next question. This also covers touch where click.detail is absent.
    private lastPointerAnswer = -Infinity;
    private lastPointerRelease = -Infinity;
    private suppressClicksUntil = -Infinity;

    install(win: Window): void {
        if (this.removeListeners) return;
        this.win = win;
        const bindings: Array<[string, EventListener]> = [
            ['keydown', this.keydown as EventListener], ['keyup', this.keyup as EventListener],
            ['pointerdown', this.pointerdown as EventListener], ['pointerup', this.pointerup as EventListener],
            ['pointercancel', this.pointercancel as EventListener], ['lostpointercapture', this.lostCapture as EventListener],
            ['click', this.click as EventListener], ['dblclick', this.click as EventListener],
            ['blur', this.blur],
        ];
        for (const [name, handler] of bindings) win.addEventListener(name, handler, true);
        this.removeListeners = () => { for (const [name, handler] of bindings) win.removeEventListener(name, handler, true); };
    }
    register(handler: CaptureHandler, priority = 0): () => void {
        const entry = { handler, priority };
        this.handlers.push(entry);
        this.handlers.sort((a, b) => b.priority - a.priority);
        return () => { this.handlers = this.handlers.filter(item => item !== entry); };
    }
    attach(host: Host): () => void {
        if (this.host) throw new Error('A DialogHost is already mounted');
        this.host = host;
        const unsubscribe = host.service.subscribe(() => this.sync());
        this.sync();
        return () => {
            unsubscribe();
            if (this.host !== host) return;
            if (this.activeBusy) {
                for (const code of this.pressed) this.swallowed.add(code);
                for (const id of this.pointers) this.stalePointers.add(id);
                cancelHeldInputs();
            }
            this.host = undefined;
            this.activeToken = undefined;
            this.press = undefined;
            this.activeBusy = false;
            this.resultPress = undefined;
        };
    }
    sync(): void {
        this.host?.service.sync();
        const token = this.host?.service.current?.token;
        const busy = !!token || !!this.host?.blocked?.();
        if (token === this.activeToken && busy === this.activeBusy) return;
        const wasBusy = this.activeBusy;
        this.activeToken = token;
        this.activeBusy = busy;
        this.press = undefined;
        this.resultPress = undefined;
        if (busy || wasBusy) {
            // A pointer can still be down when keyboard/lifecycle closes the
            // modal; closing is not proof of physical release either.
            // A modal can open from an ordinary DOM click after its pointerup.
            // Its second touch/click belongs to that opening gesture too.
            if (performance.now() - this.lastPointerRelease < POINTER_CLUSTER_MS)
                this.lastPointerAnswer = Math.max(this.lastPointerAnswer, this.lastPointerRelease);
            for (const code of this.pressed) this.swallowed.add(code);
            for (const id of this.pointers) this.stalePointers.add(id);
            cancelHeldInputs();
        }
    }
    /** Shared physical-release barrier for module panels and dialog transitions.
     * InputManager delegates here rather than tracking a second set of keys. */
    cancelHeldKeys(): void {
        for (const code of this.pressed) this.swallowed.add(code);
    }
    busy(): boolean { this.sync(); return this.activeBusy || this.nativeDepth > 0; }
    native<T>(perform: () => T): T {
        cancelHeldInputs();
        for (const code of this.pressed) this.swallowed.add(code);
        for (const id of this.pointers) this.stalePointers.add(id);
        this.nativeDepth++;
        try { return perform(); }
        finally { this.nativeDepth--; this.sync(); }
    }
    keydown = (event: KeyboardEvent): void => {
        this.sync();
        const code = event.code || event.key;
        const old = this.pressed.has(code);
        this.pressed.add(code);
        if (this.swallowed.has(code)) { this.consume(event); return; }
        if (this.nativeDepth) { this.swallowed.add(code); this.consume(event); return; }
        const entry = this.host?.service.current;
        if (entry) {
            this.swallowed.add(code);
            // Native Tab navigation stays in the Host. Its keyup cannot leak.
            if (entry && event.key === 'Tab') { this.host!.tab?.(event); event.stopImmediatePropagation(); return; }
            this.consume(event);
            if (event.repeat || old) return;
            if (entry.kind === 'dialogue' && ['PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) { this.host!.scroll?.(event); return; }
            if (entry.kind === 'dialogue' && ['ArrowUp', 'ArrowDown'].includes(event.key)) { this.host!.navigate?.(event); return; }
            const action = dialogKeyAction(entry, event);
            if (action) this.host!.service.answer(entry.token, action);
            else this.host!.hint();
            return;
        }
        if (this.host?.blocked?.()) {
            this.swallowed.add(code);
            if (event.key === 'Tab') { event.stopImmediatePropagation(); return; }
            this.consume(event);
            const results = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action="view-result"]');
            if (!event.repeat && !old && this.host.resultAvailable?.()
                && (event.key.toLowerCase() === 'r' || (results && ['Enter', ' '].includes(event.key)))) this.host.viewResult?.();
            return;
        }
        for (const { handler } of this.handlers) {
            if (handler.keydown(event)) { event.stopImmediatePropagation(); return; }
        }
    };
    keyup = (event: KeyboardEvent): void => {
        const code = event.code || event.key;
        this.pressed.delete(code);
        if (this.swallowed.delete(code)) { this.consume(event); return; }
        for (const { handler } of this.handlers) {
            if (handler.keyup?.(event)) { event.stopImmediatePropagation(); return; }
        }
    };
    pointerdown = (event: PointerEvent): void => {
        this.sync();
        this.pointers.add(event.pointerId);
        if (this.nativeDepth) { this.stalePointers.add(event.pointerId); this.consume(event); return; }
        const entry = this.host?.service.current;
        if (!entry) {
            if (performance.now() - this.lastPointerAnswer < POINTER_CLUSTER_MS) {
                this.stalePointers.add(event.pointerId); this.consume(event); return;
            }
            if (this.host?.blocked?.()) {
                this.consume(event);
                const result = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action="view-result"]');
                if (result && this.host.resultAvailable?.() && event.button === 0 && !this.stalePointers.has(event.pointerId)
                    && !(event.detail > 1) && performance.now() - this.lastPointerAnswer >= POINTER_CLUSTER_MS) {
                    this.resultPress = { id: event.pointerId, x: event.clientX, y: event.clientY };
                } else this.stalePointers.add(event.pointerId);
            }
            return;
        }
        const inside = this.host!.contains(event.target);
        // Prevent background activation, but preserve scrolling inside long text.
        event.stopImmediatePropagation();
        if (!inside) { event.preventDefault(); this.stalePointers.add(event.pointerId); return; }
        if (event.button !== 0 || event.detail > 1 || this.stalePointers.has(event.pointerId)
            || performance.now() - this.lastPointerAnswer < POINTER_CLUSTER_MS) return;
        const button = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action]') as HTMLElement | null;
        const action = button?.hasAttribute?.('disabled') ? undefined : button?.getAttribute('data-dialog-action') as DialogAction | undefined;
        if (action || entry.kind === 'acknowledgment') {
            this.press = { id: event.pointerId, token: entry.token, action: action ?? 'more', x: event.clientX, y: event.clientY };
        }
    };
    pointerup = (event: PointerEvent): void => {
        this.lastPointerRelease = performance.now();
        this.sync();
        this.pointers.delete(event.pointerId);
        const stale = this.stalePointers.delete(event.pointerId);
        const entry = this.host?.service.current;
        if (stale || entry || this.nativeDepth || this.activeBusy) { this.consume(event); this.suppressClicksUntil = performance.now() + POINTER_CLUSTER_MS; }
        const result = this.resultPress;
        this.resultPress = undefined;
        if (!entry && !stale && !this.nativeDepth && event.button === 0 && result?.id === event.pointerId
            && this.host?.resultAvailable?.() && (event.target as HTMLElement | null)?.closest?.('[data-dialog-action="view-result"]')
            && Math.hypot(event.clientX - result.x, event.clientY - result.y) <= 10) {
            this.host.viewResult?.(); this.lastPointerAnswer = performance.now(); return;
        }
        const press = this.press;
        this.press = undefined;
        if (!entry || stale || this.nativeDepth || event.button !== 0 || !press || press.id !== event.pointerId || press.token !== entry.token
            || !this.host!.contains(event.target) || Math.hypot(event.clientX - press.x, event.clientY - press.y) > 10) return;
        const button = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action]') as HTMLElement | null;
        if (press.action !== 'more' && button?.getAttribute('data-dialog-action') !== press.action) return;
        if (this.host!.service.answer(press.token, press.action)) this.lastPointerAnswer = performance.now();
    };
    pointercancel = (event: PointerEvent): void => {
        this.pointers.delete(event.pointerId);
        this.stalePointers.delete(event.pointerId);
        if (this.press?.id === event.pointerId) this.press = undefined;
        if (this.resultPress?.id === event.pointerId) this.resultPress = undefined;
        if (this.host?.service.current) this.consume(event);
    };
    private lostCapture = (event: PointerEvent): void => {
        if (this.press?.id === event.pointerId) this.press = undefined;
        if (this.resultPress?.id === event.pointerId) this.resultPress = undefined;
        // Losing DOM capture does not mean that the physical finger is up.
        if (this.stalePointers.has(event.pointerId) || this.host?.service.current) this.consume(event);
    };
    click = (event: MouseEvent): void => {
        // All Host pointer answers happen on the matched release. DOM keyboard
        // clicks and touch compatibility clicks never settle a second request.
        if (this.busy() || performance.now() < this.suppressClicksUntil) this.consume(event);
    };
    private blur = (event?: Event): void => {
        // The capture listener also receives every element's blur (blur does
        // not bubble, but capture sees it). Moving focus between buttons on a
        // click is not a window blur and must not void the pressed pointer.
        if (event && event.target !== this.win) return;
        // Losing window focus is not a physical release (native confirm can
        // also blur it). Keep the quarantine until the actual up/cancel.
        for (const code of this.pressed) this.swallowed.add(code);
        for (const id of this.pointers) this.stalePointers.add(id);
        this.press = undefined;
        this.resultPress = undefined;
        cancelHeldInputs();
    };
    private consume(event: Event): void { event.preventDefault(); event.stopImmediatePropagation(); }
    dispose(): void {
        this.removeListeners?.(); this.removeListeners = undefined; this.blur();
        this.pressed.clear(); this.swallowed.clear(); this.pointers.clear(); this.stalePointers.clear();
    }
}

export const dialogInput = new DialogInput();
