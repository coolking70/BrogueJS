import type { Game } from '../engine/Core/Game';
import { inputManager } from '../engine/Input';
import { logger } from '../engine/Systems/Logger';
import { dialogInput } from './dialogInput';
import { presentationTimeline } from './presentationTimeline';

/** DEV-only convenience over the same input route as the rest button. Never
 * bypass a lock, answer a confirmation, or retry a submitted world command. */
export function installGameDebug(game: Game, modalOpen: () => boolean): () => void {
    if (!import.meta.env.DEV) return () => {};
    let disposed = false, running = false;
    const status = () => ({
        turn: game.stats.turns, absoluteTurn: game.absoluteTurnNumber,
        commands: game.recordedInputEvents.length,
        advancing: game.isAdvancing, inputLocked: game.isInputLocked(),
        recordingBusy: game.recordingInputBlocked,
        presentationBusy: !!presentationTimeline(game)?.busy,
        acknowledgment: logger.pendingAcknowledgment?.text ?? null,
        confirmation: game.pendingCommandConfirmation?.message ?? null,
        modal: modalOpen(), paused: !!game.isTimePaused(),
        interaction: game.interactionActive, inventory: game.isInventoryOpen,
        targeting: !!(game.pendingArcana || game.isThrowing || game.pendingIdentify || game.pendingEnchantment || game.pendingUseConfirm),
        reference: game.referenceScreen, replay: !!game.replayRecording, gameOver: game.isGameOver,
    });
    const api = {
        status,
        async wait(options: { timeoutMs?: number } = {}) {
            const timeout = options.timeoutMs ?? 5000;
            if (!Number.isFinite(timeout) || timeout <= 0) throw new Error('debug_game.wait: invalid timeoutMs');
            if (running) throw new Error('debug_game.wait: another wait is pending');
            running = true;
            const player = game.player, deadline = performance.now() + timeout;
            const settle = async () => {
                for (;;) {
                    const s = status();
                    const blocked = disposed ? 'canvas disposed' : game.player !== player ? 'run replaced'
                        : s.replay ? 'replay' : s.gameOver ? 'game over'
                        : s.confirmation ? 'confirmation' : s.acknowledgment ? 'acknowledgment'
                        : s.modal ? 'display modal' : s.interaction ? 'interaction'
                        : s.paused || s.inventory || s.targeting || s.reference ? 'overlay'
                        : s.inputLocked && !s.advancing ? 'input locked' : null;
                    if (blocked) throw new Error(`debug_game.wait blocked: ${blocked}; ${JSON.stringify(s)}`);
                    if (game.lastAdvancementError) throw game.lastAdvancementError;
                    if (!s.advancing && !s.recordingBusy && !s.presentationBusy && !dialogInput.busy()) return s;
                    if (performance.now() >= deadline) throw new Error(`debug_game.wait timed out; ${JSON.stringify(s)}`);
                    await new Promise(resolve => window.setTimeout(resolve, 16));
                }
            };
            try {
                const before = await settle();
                // Awaiting admission yields: recheck synchronously before dispatch.
                const current = status();
                if (disposed || game.player !== player || JSON.stringify(current) !== JSON.stringify(before) || dialogInput.busy())
                    throw new Error('debug_game.wait: input context changed before dispatch');
                inputManager.triggerAction('wait');
                const after = await settle();
                if (after.turn <= before.turn) throw new Error(`debug_game.wait: command did not advance a player turn; ${JSON.stringify(after)}`);
                return { before, after };
            } finally { running = false; }
        },
    };
    const target = window as Window & { debug_game?: typeof api };
    target.debug_game = api;
    return () => { disposed = true; if (target.debug_game === api) delete target.debug_game; };
}
