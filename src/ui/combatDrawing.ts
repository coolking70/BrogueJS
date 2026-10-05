import type { Graphics } from 'pixi.js';
import type { Game } from '../engine/Core/Game';
import { canDirectlySeeMonster } from '../engine/UI/MonsterVisibility';
import type { Pos } from '../types';

/** Public, detached current-segment warning only. No definitions or future cells. */
export interface DisplayTelegraph {
    readonly actionId: number;
    readonly sourceSubactionId: number;
    readonly sourceEntityId: number;
    readonly cells: readonly Readonly<Pos>[];
    readonly phase: 'windup' | 'inter-segment';
    /** Optional for older display DTOs. Missing metadata is unknown, not false. */
    readonly parryable?: boolean;
    readonly remainingTicks?: number;
}
const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);
const positiveId = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) > 0;
const order = (a: DisplayTelegraph, b: DisplayTelegraph) =>
    (a.phase === 'windup' ? 0 : 1) - (b.phase === 'windup' ? 0 : 1)
    || a.actionId - b.actionId || a.sourceSubactionId - b.sourceSubactionId || a.sourceEntityId - b.sourceEntityId;

/** A missing/disabled module is an empty layer, without a concrete module import.
 * Copy at the observation boundary so historical ACK frames never query live state.
 * A revealed marker alone grants no attack identity; remembered terrain grants no cells. */
export function readPublicCombatTelegraphs(game: Game): readonly DisplayTelegraph[] {
    const view = game.extensionRuntime?.readModuleView('combat');
    if (!view || view.state.schema !== 1 || !Array.isArray(view.state.telegraphs)) return Object.freeze([]);
    const visibleSources = new Set([...(game.player.hp > 0 ? [game.player.id] : []), ...game.monsters
        .filter(monster => canDirectlySeeMonster(game.player, game.grid, monster)).map(monster => monster.id)]);
    const result: DisplayTelegraph[] = [];
    for (const value of view.state.telegraphs) {
        if (!record(value) || !positiveId(value.actionId) || !positiveId(value.sourceSubactionId)
            || !positiveId(value.sourceEntityId) || !visibleSources.has(value.sourceEntityId)
            || (value.phase !== 'windup' && value.phase !== 'inter-segment') || !Array.isArray(value.cells)) continue;
        const seen = new Set<string>();
        const cells: Readonly<Pos>[] = [];
        for (const cell of value.cells) {
            if (!record(cell) || !Number.isSafeInteger(cell.x) || !Number.isSafeInteger(cell.y)) continue;
            const x = cell.x as number, y = cell.y as number, key = `${x},${y}`;
            if (seen.has(key) || !game.grid.getCell(x, y)?.isVisible) continue;
            seen.add(key); cells.push(Object.freeze({ x, y }));
        }
        if (cells.length) result.push(Object.freeze({ actionId: value.actionId, sourceSubactionId: value.sourceSubactionId,
            sourceEntityId: value.sourceEntityId, phase: value.phase, cells: Object.freeze(cells.sort((a, b) => a.y - b.y || a.x - b.x)),
            ...(typeof value.parryable === 'boolean' ? { parryable: value.parryable } : {}),
            ...(Number.isSafeInteger(value.remainingTicks) && (value.remainingTicks as number) >= 0
                ? { remainingTicks: value.remainingTicks as number } : {}) }));
    }
    return Object.freeze(result.sort(order));
}

export function telegraphsAt(telegraphs: readonly DisplayTelegraph[], cell: Readonly<Pos>): readonly DisplayTelegraph[] {
    return telegraphs.filter(entry => entry.cells.some(p => p.x === cell.x && p.y === cell.y)).sort(order);
}

/** One stable paint per cell, never stacked alpha implying extra damage. Both
 * phases have a border plus a distinct mark; terrain remains visible beneath. */
export function paintCombatTelegraphs(graphics: Graphics, telegraphs: readonly DisplayTelegraph[], tileSize: number): void {
    const painted = new Set<string>();
    for (const telegraph of [...telegraphs].sort(order)) for (const cell of telegraph.cells) {
        const key = `${cell.x},${cell.y}`;
        if (painted.has(key)) continue;
        painted.add(key);
        const x = cell.x * tileSize, y = cell.y * tileSize;
        const windup = telegraph.phase === 'windup', color = windup ? 0xe89b67 : 0xe2cc80;
        graphics.rect(x + 1, y + 1, tileSize - 2, tileSize - 2).fill({ color, alpha: 0.13 });
        graphics.rect(x + 1.5, y + 1.5, tileSize - 3, tileSize - 3).stroke({ color, alpha: 0.85, width: 1 });
        if (windup) graphics.moveTo(x + tileSize * .5, y + 2).lineTo(x + tileSize * .5, y + 5);
        else graphics.moveTo(x + tileSize * .35, y + 3).lineTo(x + tileSize * .65, y + 3);
        graphics.stroke({ color, alpha: 1, width: 1.5 });
    }
}
