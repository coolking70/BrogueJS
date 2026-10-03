import type { Game } from '../engine/Core/Game';
import type { Logger, LogMessage } from '../engine/Systems/Logger';
import { DialogService, type DialogRequest } from './dialogService';

/** Keep Logger's occurrence queue and archive semantics. No display timeline
 * or engine decision is introduced at D1. */
export function bindDialogAcknowledgments(service: DialogService, game: Game, log: Logger): () => void {
    const requests = new Map<Readonly<LogMessage>, DialogRequest>();
    let player = game.player;
    const sync = () => {
        if (player !== game.player) {
            player = game.player;
            service.reset();
            requests.clear();
        }
        const pending = log.pendingAcknowledgments;
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
                            log.showTerminalAcknowledgments();
                        } else log.acknowledgeNext();
                    } });
                requests.set(message, request);
            }
            service.update(request.token, { terminalAvailable: game.isGameOver });
        }
    };
    const removeSource = service.registerSource(sync, 100);
    log.presentAcknowledgments(() => !game.replayRecording, () => service.sync());
    service.sync();
    return () => {
        removeSource();
        for (const request of requests.values()) request.cancel();
        log.presentAcknowledgments(null);
    };
}
