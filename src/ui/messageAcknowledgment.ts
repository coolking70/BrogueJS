import { logger } from '../engine/Systems/Logger';
import { dialogKeyAction } from './dialogInput';

/** Capture before Input.ts without adding a command or repeating a held key. */
export function acknowledgmentKeys(results?: { available: () => boolean; show: () => void }) {
    const swallowed = new Set<string>();
    const keydown = (event: KeyboardEvent) => {
        if (!logger.pendingAcknowledgment && !swallowed.has(event.code)) return;
        // Compatibility helper for isolated Logger clients. The mounted UI
        // registers Host ownership in dialogInput, never a second capture.
        if (logger.pendingAcknowledgment && results?.available() && event.key === 'Tab') {
            event.stopImmediatePropagation();
            swallowed.add(event.code);
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        swallowed.add(event.code);
        const action = dialogKeyAction({ kind: 'acknowledgment', terminalAvailable: results?.available() }, event);
        if (action === 'view-result') {
            if (!event.repeat) results?.show();
            return;
        }
        if (!event.repeat && action === 'more') logger.acknowledgeNext();
    };
    const keyup = (event: KeyboardEvent) => {
        if (!swallowed.delete(event.code)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
    };
    return { keydown, keyup };
}
