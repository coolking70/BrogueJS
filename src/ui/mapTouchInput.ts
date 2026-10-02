import { GestureTracker, type GestureEvent } from './touchGestures';
import { registerHeldInput, syncHeldInputContext } from './heldInput';

/** Canvas pointer lifecycle and long-press polling, shared by the real canvas
 * and event/timer regressions. Gesture outputs retain their existing command
 * boundary in GameCanvas. Cancellation discards stale pointers and late taps. */
export function bindMapTouchInput(canvas: HTMLCanvasElement, handle: (events: GestureEvent[]) => void): () => void {
    const gestures = new GestureTracker();
    const captured = new Set<number>();
    let timer = 0;
    const stopPolling = () => { window.clearInterval(timer); timer = 0; };
    const release = (id: number) => {
        captured.delete(id);
        try { canvas.releasePointerCapture(id); } catch { /* 原生模态可能已释放捕获 */ }
    };
    const stop = () => {
        stopPolling();
        gestures.reset();
        for (const id of [...captured]) release(id);
    };
    const unregister = registerHeldInput(stop);
    const emit = (events: GestureEvent[]) => { handle(events); syncHeldInputContext(); };
    const isTouchLike = (e: PointerEvent) => e.pointerType === 'touch' || e.pointerType === 'pen';
    const down = (e: PointerEvent) => {
        if (!isTouchLike(e)) return;
        e.preventDefault();
        syncHeldInputContext();
        captured.add(e.pointerId);
        try { canvas.setPointerCapture(e.pointerId); } catch { /* 合成事件无活动指针 */ }
        emit(gestures.down(e.pointerId, e.clientX, e.clientY, performance.now()));
        if (gestures.active && !timer) timer = window.setInterval(() => {
            syncHeldInputContext();
            const events = gestures.poll(performance.now());
            emit(events);
            if (!gestures.active || events.some(event => event.type === 'longpress')) stopPolling();
        }, 50);
    };
    const move = (e: PointerEvent) => {
        if (!isTouchLike(e)) return;
        const r = canvas.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX >= r.right || e.clientY < r.top || e.clientY >= r.bottom) { stop(); return; }
        emit(gestures.move(e.pointerId, e.clientX, e.clientY));
    };
    const up = (e: PointerEvent) => {
        if (!isTouchLike(e)) return;
        emit(gestures.up(e.pointerId, performance.now()));
        if (!gestures.active) stopPolling();
        release(e.pointerId);
    };
    const cancel = (e: PointerEvent) => { if (isTouchLike(e)) stop(); };
    // lostpointercapture need not carry a trustworthy pointerType.
    const lost = (e: PointerEvent) => { if (captured.has(e.pointerId)) stop(); };
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', cancel);
    canvas.addEventListener('pointerleave', cancel);
    canvas.addEventListener('lostpointercapture', lost);
    return () => {
        unregister();
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('pointercancel', cancel);
        canvas.removeEventListener('pointerleave', cancel);
        canvas.removeEventListener('lostpointercapture', lost);
    };
}
