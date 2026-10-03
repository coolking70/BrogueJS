import { logger } from '../engine/Systems/Logger';

/** Capture before Input.ts without adding a command or repeating a held key. */
export function acknowledgmentKeys(results?: { available: () => boolean; show: () => void }) {
    const swallowed = new Set<string>();
    const keydown = (event: KeyboardEvent) => {
        if (!logger.pendingAcknowledgment && !swallowed.has(event.code)) return;
        // Terminal buttons remain keyboard reachable. MORE's existing key
        // profile is otherwise unchanged until the shared DialogHost task.
        if (logger.pendingAcknowledgment && results?.available() && event.key === 'Tab') {
            event.stopImmediatePropagation();
            swallowed.add(event.code);
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        swallowed.add(event.code);
        const resultButton = (event.target as HTMLElement | null)?.closest?.('[data-dialog-action="view-result"]');
        if (results?.available() && (event.key.toLowerCase() === 'r'
            || (resultButton && ['Enter', ' '].includes(event.key)))) {
            if (!event.repeat) results.show();
            return;
        }
        if (!event.repeat && !['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) logger.acknowledgeNext();
    };
    const keyup = (event: KeyboardEvent) => {
        if (!swallowed.delete(event.code)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    return { keydown, keyup };
}
