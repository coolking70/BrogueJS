import type { CommandConfirmation, Game } from '../engine/Core/Game';
import type { Logger, LogMessage } from '../engine/Systems/Logger';
import { cancelHeldInputs } from './heldInput';
import { DialogService, type DialogRequest } from './dialogService';
import { PresentationTimeline, presentationTimeline } from './presentationTimeline';
export { displayedFrame, presentationTimeline } from './presentationTimeline';

export function terminalPresentationReady(game: Game): boolean {
    return presentationTimeline(game)?.terminalReady ?? game.isGameOver;
}

/** Logger retains occurrence/archive ownership; the timeline exposes only the
 * ACK at the display cursor. Minimal non-world hosts retain the D1 adapter. */
export function bindDialogAcknowledgments(service: DialogService, game: Game, log: Logger): () => void {
    const timeline = game.grid ? new PresentationTimeline(game, log, () => service.sync()) : undefined;
    const removeReset = service.onReset(() => timeline?.clear());
    const requests = new Map<Readonly<LogMessage>, DialogRequest>();
    let player = game.player;
    const sync = () => {
        if (player !== game.player) {
            player = game.player;
            service.reset();
            requests.clear();
        }
        if (game.replayRecording) timeline?.clear();
        const pending = timeline ? (timeline.acknowledgment ? [timeline.acknowledgment] : []) : log.pendingAcknowledgments;
        for (const [message, request] of requests) {
            if (!pending.includes(message) || !service.isPending(request.token)) { request.cancel(); requests.delete(message); }
        }
        for (const message of pending) {
            let request = requests.get(message);
            if (!request) {
                request = service.request({ kind: 'acknowledgment', owner: 'messages', text: message.text,
                    terminalAvailable: game.isGameOver, onAnswer: action => {
                        if (log.pendingAcknowledgment !== message) return false;
                        if (action === 'view-result') {
                            if (!game.isGameOver) return false;
                            if (timeline) timeline.showResult();
                            else log.showTerminalAcknowledgments();
                        } else if (timeline) return timeline.acknowledge(message);
                        else log.acknowledgeNext();
                    } });
                requests.set(message, request);
            }
            service.update(request.token, { terminalAvailable: game.isGameOver });
        }
    };
    const removeSource = service.registerSource(sync, 300);
    log.presentAcknowledgments(() => !game.replayRecording, () => service.sync());
    service.sync();
    return () => {
        removeSource();
        removeReset(); timeline?.dispose();
        for (const request of requests.values()) request.cancel();
        log.presentAcknowledgments(null);
    };
}

/** Adapt engine capabilities to the session Host. The UI never holds a rule
 * closure, and service cancellation cannot manufacture a recorded No. */
export function bindDialogCommands(service: DialogService, game: Game): () => void {
    let spec: CommandConfirmation | null = null;
    let request: DialogRequest | undefined;
    const sync = () => {
        const next = game.pendingCommandConfirmation;
        if (next === spec && request && service.isPending(request.token)) return;
        request?.cancel();
        request = undefined;
        spec = next;
        if (!next || game.replayRecording) return;
        cancelHeldInputs();
        request = service.request({ kind: 'confirm', owner: `command:${next.ownerCommandId}`,
            text: next.message, danger: true, defaultAction: 'no',
            onAnswer: action => game.resolveCommandDecision(next.token, action === 'yes'),
        });
    };
    const unsubscribe = service.subscribe(() => {
        if (spec && request && !service.isPending(request.token)
            && game.pendingCommandConfirmation === spec) game.cancelPendingCommand(spec.token);
    });
    const removeSource = service.registerSource(sync, 200);
    const previous = game.onCommandConfirmRequest;
    const notify = (notice?: string) => {
        service.sync();
        if (notice) service.request({ kind: 'acknowledgment', owner: 'command:changed', text: notice,
            onAnswer() { /* Display-only feedback: no Logger disturbance or rule event. */ },
        });
    };
    game.onCommandConfirmRequest = notify;
    service.sync();
    return () => {
        removeSource();
        unsubscribe();
        if (spec) game.cancelPendingCommand(spec.token);
        request?.cancel();
        if (game.onCommandConfirmRequest === notify) game.onCommandConfirmRequest = previous;
    };
}
