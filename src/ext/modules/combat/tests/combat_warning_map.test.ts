import { afterEach, describe, expect, it, vi } from 'vitest';
import { Graphics } from 'pixi.js';
import { Game } from '../../../../engine/Core/Game';
import { observePresentation } from '../../../../engine/Core/PresentationObserver';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { squareDisplayScene } from '../../../../test/support/squareDisplayScene';
import { paintCombatTelegraphs, readPublicCombatTelegraphs, telegraphsAt, type DisplayTelegraph } from '../../../../ui/combatDrawing';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { displayedFrame, PresentationTimeline } from '../../../../ui/presentationTimeline';
import type { Json } from '../../../types';

const disposers: (() => void)[] = [];
afterEach(() => {
    disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks();
    logger.observeMessages(null); logger.presentAcknowledgments(null);
});
const cell = { x: 15, y: 11 }, tileSize = 16;
const warning = (actionId: number, parryable?: boolean, phase: DisplayTelegraph['phase'] = 'windup'): DisplayTelegraph =>
    ({ actionId, sourceSubactionId: 1, sourceEntityId: 1, phase, cells: [cell],
        ...(parryable === undefined ? {} : { parryable }), remainingTicks: 50 });

/** Actual Pixi instructions, without renderer/texture identities. */
function draw(telegraphs: readonly DisplayTelegraph[], size = tileSize) {
    const graphics = new Graphics();
    try {
        paintCombatTelegraphs(graphics, telegraphs, size);
        return graphics.context.instructions.flatMap(entry => entry.action === 'fill' || entry.action === 'stroke'
            ? [{ action: entry.action, color: entry.data.style.color, alpha: entry.data.style.alpha,
                width: entry.action === 'stroke' ? entry.data.style.width : undefined,
                path: entry.data.path.instructions.map(({ action, data }) => ({ action,
                    data: data.filter((value: unknown): value is number => typeof value === 'number') })) }]
            : []);
    } finally { graphics.destroy(); }
}
const markPaths = (trace: ReturnType<typeof draw>) => trace.filter(entry => entry.action === 'stroke' && entry.alpha === 1)
    .map(entry => entry.path.slice(2)); // The leading two operations are the existing phase marker.
const point = (action: string, x: number, y: number, size = tileSize) =>
    ({ action, data: [(cell.x + x) * size, (cell.y + y) * size].map(value => Math.round(value * 1000) / 1000) });
const normalized = (path: ReturnType<typeof markPaths>[number]) => path.map(entry =>
    ({ ...entry, data: entry.data.map(value => Math.round(value * 1000) / 1000) }));
const shield = (size = tileSize) => [point('moveTo', .15, .65, size), point('lineTo', .35, .65, size),
    point('lineTo', .35, .77, size), point('lineTo', .25, .86, size), point('lineTo', .15, .77, size), point('lineTo', .15, .65, size)];
const cross = (size = tileSize) => [point('moveTo', .65, .65, size), point('lineTo', .85, .85, size),
    point('moveTo', .85, .65, size), point('lineTo', .65, .85, size)];
const unknown = (size = tileSize) => [point('moveTo', .5, .65, size), point('lineTo', .58, .755, size),
    point('lineTo', .5, .86, size), point('lineTo', .42, .755, size), point('lineTo', .5, .65, size)];

function scene() {
    const game = new Game(); game.startNewGame({ seed: 403003, mode: 'test', ruleSet: 'extended', extensions: [] });
    const monster = squareDisplayScene(game);
    const state = { schema: 1, telegraphs: [true, false, undefined].map((parryable, i) => ({
        ...warning(i + 1, parryable), sourceEntityId: monster.id, cells: [{ ...cell }],
    })) };
    const read = vi.spyOn(game.extensionRuntime!, 'readModuleView').mockImplementation(id => id === 'combat'
        ? { session: {}, state: state as unknown as Record<string, Json>, definitions: {}, playerId: game.player.id,
            components: {}, canManageCharacter: true } : null);
    return { game, monster, state, read };
}

describe('public map warning parry properties', () => {
    it.each(['windup', 'inter-segment'] as const)('uses distinct shield, cross and unknown geometry during %s', phase => {
        const traces = [true, false, undefined].map(parryable => draw([warning(1, parryable, phase)]));
        expect(traces.map(trace => normalized(markPaths(trace)[0]!))).toEqual([shield(), cross(), unknown()]);
        // Identical fill and border: the distinction survives without a color cue.
        expect(traces[0]!.slice(0, 2)).toEqual(traces[1]!.slice(0, 2));
        expect(traces[0]!.slice(0, 2)).toEqual(traces[2]!.slice(0, 2));
        for (const trace of traces) {
            expect(trace.filter(entry => entry.action === 'fill')).toHaveLength(1);
            expect(trace.filter(entry => entry.action === 'fill')[0]!.alpha).toBe(.13);
            expect(trace.filter(entry => entry.action === 'stroke')).toHaveLength(2);
        }
    });

    it('keeps nonparryable and unknown marks alongside a higher-priority parryable warning with one fill', () => {
        const parryable = warning(1, true), unparryable = warning(9, false, 'inter-segment'), old = warning(10);
        const expected = [...shield(), ...cross(), ...unknown()];
        const first = draw([parryable, unparryable, old]);
        expect(normalized(markPaths(first)[0]!)).toEqual(expected);
        for (const entries of [[old, unparryable, parryable], [unparryable, parryable, old],
            [parryable, parryable, old, unparryable, unparryable]]) {
            expect(draw(entries)).toEqual(first);
            expect(draw(entries).filter(entry => entry.action === 'fill')).toHaveLength(1);
        }
        expect(telegraphsAt([old, unparryable, parryable], cell).map(entry => entry.parryable)).toEqual([true, undefined, false]);
        expect(normalized(markPaths(draw([parryable, unparryable]))[0]!)).toEqual([...shield(), ...cross()]);
    });

    it('aggregates each cell independently and scales property marks within its border', () => {
        const other = { x: cell.x + 1, y: cell.y };
        const entries = [warning(1, true), { ...warning(2, false), cells: [cell, other] }];
        const trace = draw(entries);
        expect(trace.filter(entry => entry.action === 'fill')).toHaveLength(2);
        expect(markPaths(trace).map(normalized)).toEqual([[...shield(), ...cross()],
            cross().map(entry => ({ ...entry, data: [entry.data[0]! + tileSize, entry.data[1]!] }))]);
        for (const size of [12, 16, 24, 32]) {
            const scaled = draw([warning(1, true), warning(2, false), warning(3)], size);
            expect(normalized(markPaths(scaled)[0]!)).toEqual([...shield(size), ...cross(size), ...unknown(size)]);
            const width = scaled.find(entry => entry.action === 'stroke' && entry.alpha === 1)!.width!;
            const xRange = (path: ReturnType<typeof shield>) => path.map(entry => entry.data[0]!);
            // Adjacent property strokes must remain separate even in mixed cells.
            expect(Math.min(...xRange(unknown(size))) - Math.max(...xRange(shield(size)))).toBeGreaterThan(width);
            expect(Math.min(...xRange(cross(size))) - Math.max(...xRange(unknown(size)))).toBeGreaterThan(width);
        }
    });

    it('shows only public visible cells and never gains properties from a hidden or merely revealed source', () => {
        const { game, monster, state } = scene();
        const hidden = { x: cell.x, y: cell.y + 1 };
        game.grid.getCell(hidden.x, hidden.y)!.isVisible = false;
        for (const entry of state.telegraphs) entry.cells.push(hidden, cell, { x: -1, y: 0 });
        const publicWarnings = readPublicCombatTelegraphs(game);
        expect(publicWarnings).toHaveLength(3);
        expect(publicWarnings.map(entry => entry.cells)).toEqual([[cell], [cell], [cell]]);
        expect(normalized(markPaths(draw(publicWarnings))[0]!)).toEqual([...shield(), ...cross(), ...unknown()]);
        monster.setStatusDuration('invisible', 10); game.player.setStatusDuration('telepathy', 10);
        expect(draw(readPublicCombatTelegraphs(game))).toEqual([]);
        monster.setStatusDuration('invisible', 0);
        for (const bodyCell of game.footprintOf(monster)) game.grid.getCell(bodyCell.x, bodyCell.y)!.isVisible = false;
        expect(draw(readPublicCombatTelegraphs(game))).toEqual([]);
    });

    it('does not relabel missing or malformed metadata as a nonparryable warning', () => {
        const { game, state } = scene();
        state.telegraphs.splice(1);
        const source = state.telegraphs[0]! as unknown as Record<string, unknown>;
        for (const value of [undefined, null, 'false', 0, 1, {}, []]) {
            source.parryable = value;
            const captured = readPublicCombatTelegraphs(game);
            expect(captured[0]).not.toHaveProperty('parryable');
            expect(normalized(markPaths(draw(captured))[0]!)).toEqual(unknown());
        }
    });

    it('paints historical ACK properties after live warnings change, disappear and lose visibility without a live read', () => {
        const { game, monster, state, read } = scene();
        logger.presentAcknowledgments(() => true);
        const timeline = new PresentationTimeline(game, logger); disposers.push(() => timeline.dispose());
        logger.log('map warning history fixture', '#fff', { acknowledge: true });
        const historical = displayedFrame(game)!;
        const initial = draw(historical.telegraphs);
        expect(normalized(markPaths(initial)[0]!)).toEqual([...shield(), ...cross(), ...unknown()]);
        expect(Object.isFrozen(historical.telegraphs)).toBe(true);
        for (const entry of state.telegraphs) {
            entry.parryable = false; entry.cells[0]!.x++;
            entry.phase = 'inter-segment'; entry.remainingTicks = 1;
        }
        observePresentation(game, 'command-complete');
        expect(draw(readPublicCombatTelegraphs(game))).not.toEqual(initial);
        state.telegraphs = []; monster.setStatusDuration('invisible', 10);
        game.grid.getCell(cell.x, cell.y)!.isVisible = false;
        observePresentation(game, 'command-complete');
        const readCount = read.mock.calls.length, before = rng.getState();
        for (let i = 0; i < 5; i++) {
            expect(displayedFrame(game)).toBe(historical);
            expect(draw(displayedFrame(game)!.telegraphs)).toEqual(initial);
        }
        expect(read).toHaveBeenCalledTimes(readCount); expect(rng.getState()).toEqual(before);
        expect(historical.telegraphs.map(entry => entry.parryable)).toEqual([true, false, undefined]);
        expect(timeline.acknowledge(timeline.acknowledgment!)).toBe(true);
        expect(displayedFrame(game)).toBeUndefined();
        expect(draw(observeDisplayFrame(game, logger).telegraphs)).toEqual([]);
        expect(draw(historical.telegraphs)).toEqual(initial);
    });

    it('repeated observation and drawing mutate neither state, commands, ticks, HP, DTOs nor either RNG stream', () => {
        const { game, monster, state } = scene(), command = vi.spyOn(game, 'executeCommand');
        const checkpoint = () => ({ state: structuredClone(state), rng: rng.getState(),
            turn: game.absoluteTurnNumber, ticks: game.player.ticksUntilTurn, hp: game.player.hp,
            monsterHp: monster.hp, monsterTicks: monster.ticksUntilTurn, inputs: game.recordedInputEvents.length });
        const captured = readPublicCombatTelegraphs(game), detached = structuredClone(captured), before = checkpoint();
        for (let i = 0; i < 10; i++) {
            expect(draw(readPublicCombatTelegraphs(game))).toEqual(draw(captured));
            expect(draw(observeDisplayFrame(game, logger).telegraphs)).toEqual(draw(captured));
        }
        expect(captured).toEqual(detached); expect(checkpoint()).toEqual(before);
        expect(command).not.toHaveBeenCalled();
    });
});
