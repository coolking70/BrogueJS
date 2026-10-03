import { vi } from 'vitest';
import type { Game, CommandConfirmation } from '../../engine/Core/Game';
import { DialogService } from '../../ui/dialogService';
import { bindDialogCommands } from '../../ui/dialogAcknowledgments';

/** Controllable engine port for input-only tests; rule/recording tests use Game. */
export function commandConfirmationFixture(replay = false) {
    const service = new DialogService();
    let pending: CommandConfirmation | null = null;
    const resolved = vi.fn((_message: string, _decision: boolean) => {});
    const game = {
        replayRecording: replay ? {} : null,
        onCommandConfirmRequest: null as (() => void) | null,
        get pendingCommandConfirmation() { return pending; },
        resolveCommandDecision(token: object, decision: boolean) {
            if (pending?.token !== token) return false;
            resolved(pending.message, decision); pending = null; this.onCommandConfirmRequest?.(); return true;
        },
        cancelPendingCommand() { pending = null; this.onCommandConfirmRequest?.(); },
    };
    const remove = bindDialogCommands(service, game as unknown as Game);
    return {
        service, resolved,
        publish(message: string) {
            pending = Object.freeze({ token: Object.freeze({}), ownerCommandId: 1, message });
            game.onCommandConfirmRequest?.();
        },
        answer(decision: boolean) { return service.answer(service.current!.token, decision ? 'yes' : 'no'); },
        dispose() { remove(); service.dispose(); },
    };
}
