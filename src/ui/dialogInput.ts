import { cancelHeldInputs } from './heldInput';
import type { DialogAction, DialogEntry, DialogService, DialogToken } from './dialogService';

/** CE IO.c:2914-2927 / 2951-2973. Enter retains CE's yes meaning,
 * even when the no button has focus. MORE never accepts a movement key. */
export function dialogKeyAction(entry: Pick<DialogEntry, 'kind' | 'terminalAvailable'>, event: KeyboardEvent): DialogAction | undefined {
    if (entry.kind === 'confirm') {
        if (['y', 'Y', 'Enter'].includes(event.key)) return 'yes';
        if (['n', 'N', ' ', 'Escape'].includes(event.key)) return 'no';
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
    private nativeDepth = 0;
    private removeListeners?: () => void;
    // The second physical press of a browser double click must not answer
    // the next question. This also covers touch where click.detail is absent.
    private lastPointerAnswer = -Infinity;
    private suppressClicksUntil = -Infinity;

    install(win: Window): void {
        if (this.removeListeners) return;
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
            this.host = undefined;
            this.activeToken = undefined;
            this.press = undefined;
        };
    }
    sync(): void {
        this.host?.service.sync();
        const token = this.host?.service.current?.token;
        if (token === this.activeToken) return;
        this.activeToken = token;
        this.press = undefined;
        if (token) {
            for (const code of this.pressed) this.swallowed.add(code);
            for (const id of this.pointers) this.stalePointers.add(id);
            cancelHeldInputs();
        }
    }
    busy(): boolean { this.sync(); return !!this.activeToken || this.nativeDepth > 0; }
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
            const action = dialogKeyAction(entry, event);
            if (action) this.host!.service.answer(entry.token, action);
            else this.host!.hint();
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
        if (!entry) return;
        const inside = this.host!.contains(event.target);
        // Prevent background activation, but preserve scrolling inside long text.
        event.stopImmediatePropagation();
        if (!inside) { event.preventDefault(); this.stalePointers.add(event.pointerId); return; }
        if (event.button !== 0 || event.detail > 1 || this.stalePointers.has(event.pointerId)
            || performance.now() - this.lastPointerAnswer < POINTER_CLUSTER_MS) return;
        const button = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action]') as HTMLElement | null;
        const action = button?.getAttribute('data-dialog-action') as DialogAction | undefined;
        if (action || entry.kind === 'acknowledgment') {
            this.press = { id: event.pointerId, token: entry.token, action: action ?? 'more', x: event.clientX, y: event.clientY };
        }
    };
    pointerup = (event: PointerEvent): void => {
        this.sync();
        this.pointers.delete(event.pointerId);
        const stale = this.stalePointers.delete(event.pointerId);
        const entry = this.host?.service.current;
        if (stale || entry || this.nativeDepth) { this.consume(event); this.suppressClicksUntil = performance.now() + POINTER_CLUSTER_MS; }
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
        if (this.host?.service.current) this.consume(event);
    };
    private lostCapture = (event: PointerEvent): void => {
        if (this.press?.id === event.pointerId) this.press = undefined;
        // Losing DOM capture does not mean that the physical finger is up.
        if (this.stalePointers.has(event.pointerId) || this.host?.service.current) this.consume(event);
    };
    click = (event: MouseEvent): void => {
        // All Host pointer answers happen on the matched release. DOM keyboard
        // clicks and touch compatibility clicks never settle a second request.
        if (this.busy() || performance.now() < this.suppressClicksUntil) this.consume(event);
    };
    private blur = (): void => {
        // Losing window focus is not a physical release (native confirm can
        // also blur it). Keep the quarantine until the actual up/cancel.
        for (const code of this.pressed) this.swallowed.add(code);
        for (const id of this.pointers) this.stalePointers.add(id);
        this.press = undefined;
        cancelHeldInputs();
    };
    private consume(event: Event): void { event.preventDefault(); event.stopImmediatePropagation(); }
    dispose(): void {
        this.removeListeners?.(); this.removeListeners = undefined; this.blur();
        this.pressed.clear(); this.swallowed.clear(); this.pointers.clear(); this.stalePointers.clear();
    }
}

export const dialogInput = new DialogInput();
