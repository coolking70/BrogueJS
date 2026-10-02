/** UI-only cancellation for pointer holds. No game commands or restart path. */
const stops = new Set<() => void>();
const contexts = new Set<() => void>();
let removeGlobalListeners: (() => void) | undefined;

export function cancelHeldInputs(): void {
    for (const stop of [...stops]) stop();
}

export function registerHeldInput(stop: () => void): () => void {
    if (!stops.size) {
        const win = window, doc = document;
        const onHidden = () => { if (doc.hidden) cancelHeldInputs(); };
        win.addEventListener('blur', cancelHeldInputs);
        doc.addEventListener('visibilitychange', onHidden);
        removeGlobalListeners = () => {
            win.removeEventListener('blur', cancelHeldInputs);
            doc.removeEventListener('visibilitychange', onHidden);
        };
    }
    stops.add(stop);
    return () => {
        stop();
        stops.delete(stop);
        if (!stops.size) { removeGlobalListeners?.(); removeGlobalListeners = undefined; }
    };
}

/** The engine is not reactive. Check modal entries after input/render requests
 * and before hold timers fire. A fresh press can still repeat aiming movement
 * in an already-open target selector; closing a modal never restarts a hold. */
export function registerHeldInputContext(read: () => readonly unknown[]): () => void {
    let previous = read();
    const check = () => {
        const next = read();
        const opened = next.some((value, index) => !!value && value !== previous[index]);
        previous = next;
        if (opened) cancelHeldInputs();
    };
    contexts.add(check);
    return () => { contexts.delete(check); };
}

export function syncHeldInputContext(): void {
    for (const check of contexts) check();
}
