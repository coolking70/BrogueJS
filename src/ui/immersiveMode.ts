import { displaySettings } from '../engine/Settings';
import type { ModalKeyHandler } from './modalKeyboard';

interface KeyboardPipeline {
    registerModalKeyHandler(handler: ModalKeyHandler, priority?: number): () => void;
}
interface ShortcutContext {
    inGame: boolean;
    menuOpen: boolean;
    game: {
        isInventoryOpen: boolean;
        isThrowing: boolean;
        pendingArcana: unknown;
        referenceScreen: unknown;
        isGameOver: boolean;
        isTimePaused(): boolean;
    };
}

/** CE Rogue.h:1162-1223 / IO.c:2455-2714: ` is unbound; \\ is TRUE_COLORS_KEY.
 * Run after all modal handlers, before the game keymap/unbound-key interruption.
 * This display preference never enters the game command, recording or RNG path.
 */
export function registerImmersiveShortcut(input: KeyboardPipeline, context: () => ShortcutContext): () => void {
    return input.registerModalKeyHandler(event => {
        if (event.key !== '`' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
        event.preventDefault();
        const { inGame, menuOpen, game } = context();
        if (!event.repeat && inGame && !menuOpen && !game.isGameOver && !game.isInventoryOpen
            && !game.isThrowing && !game.pendingArcana && !game.referenceScreen && !game.isTimePaused()) {
            displaySettings.immersiveMode = !displaySettings.immersiveMode;
        }
        return true;
    }, -1000);
}
