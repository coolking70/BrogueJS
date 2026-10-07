import type { Game } from '../engine/Core/Game';
import { inputManager } from '../engine/Input';
import { syncHeldInputContext } from './heldInput';
/** The canvas command route is shared by keyboard and DPad. Nonmodal drawers
 * pause automatic travel in the renderer, but do not own this route. */
export function installCanvasGameInput(game: Game, modalOpen: () => boolean): void {
  inputManager.setCallback((action, data) => {
    if (modalOpen()) return;
    syncHeldInputContext();
    game.handlePlayerAction(action, data);
    syncHeldInputContext();
    game.update();
  });
  inputManager.setUnboundKeyCallback(() => {
    if (modalOpen() || !game.isAutoTraveling()) return;
    game.handlePlayerAction('interrupt_auto');
    game.update();
  });
}
