import type { Game } from '../engine/Core/Game';
import i18next from 'i18next';
import { creatureStatusRows, isSidebarVisibleStatus } from '../engine/Status/statusConfig';

/** CE IO.c:4824: searching uses the same progress row as other visible statuses.
 * Keep its existing Game counter out of the creature's decaying status store. */
export function playerHudStatusRows(game: Pick<Game, 'player' | 'searchProgress'>, visible = isSidebarVisibleStatus) {
    const rows = creatureStatusRows(game.player, visible);
    const charge = game.searchProgress;
    if (charge > 0 && visible('searching')) {
        rows.unshift({ id: 'searching', label: i18next.t('sidebar.searching', { defaultValue: 'Searching' }),
            color: '#93c5fd', value: `${charge}/5`, fraction: Math.max(0, Math.min(1, charge / 5)) });
    }
    return rows;
}

