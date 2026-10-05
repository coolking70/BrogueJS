import type { Game } from '../engine/Core/Game';
import type { MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { markActorActionFixture } from '../engine/Core/ActorActionSession';
import { TerrainType } from '../engine/Map/Grid';
import { canFitAt } from '../engine/Movement/CreatureSpatial';
import type { Creature } from '../entities/Creature';
import type { Pos } from '../types';
import { presentationTimeline } from './presentationTimeline';

/** Explicit DEV fixture command, never registered in the menu/input catalogue.
 * The same fail-closed fixture guard as 3a0 blocks all production exports. */
export function placeSquareBodyFixtures(game: Game): readonly { entityId: number; size: number; cells: readonly Pos[] }[] {
    if (!import.meta.env.DEV) throw new Error('Square body diagnostics require a development build');
    if (game.isGameOver || game.replayRecording || game.isInputLocked() || presentationTimeline(game)?.busy
        || game.hasPendingConfirmation || game.isInventoryOpen || game.pendingArcana || game.isThrowing || game.referenceScreen)
        throw new Error('Square body diagnostics require an idle live map');
    const locations: { size: 2 | 3; at: Pos }[] = [];
    const reserved = new Set<string>();
    const interactables = game.readVisibleInteractables();
    const positions: Pos[] = [];
    for (let x = 1; x < game.grid.width - 1; x++) for (let y = 1; y < game.grid.height - 1; y++) positions.push({ x, y });
    positions.sort((a, b) => (a.x - game.player.x) ** 2 + (a.y - game.player.y) ** 2
        - (b.x - game.player.x) ** 2 - (b.y - game.player.y) ** 2 || a.y - b.y || a.x - b.x);
    for (const size of [2, 3] as const) {
        const at = positions.find(at => {
            const candidate = { loc: at, hp: 1, spatial: { schema: 1, footprintId: `builtin:square-${size}`, pose: 'r0' } } as Creature;
            return canFitAt(game, candidate, at, { allowsTerrain: p => {
                const cell = game.grid.getCell(p.x, p.y);
                return !!cell?.isVisible && cell.layers.every(t => t === TerrainType.FLOOR || t === TerrainType.NOTHING)
                    && !cell.machineNumber && !reserved.has(`${p.x},${p.y}`)
                    && !game.items.some(item => item.x === p.x && item.y === p.y)
                    && !interactables.some(entity => entity.x === p.x && entity.y === p.y);
            } });
        });
        if (!at) throw new Error('No safe visible space for both square fixtures; move to a larger room');
        locations.push({ size, at });
        for (let x = at.x; x < at.x + size; x++) for (let y = at.y; y < at.y + size; y++) reserved.add(`${x},${y}`);
    }
    markActorActionFixture(game);
    const result: { entityId: number; size: number; cells: readonly Pos[] }[] = [];
    game.executeCommand('fixture:square-body-display', undefined, () => {
        for (const { size, at } of locations) {
            const data = { ...monsters.find(m => m.id === 'rat')!, hp: size * 100,
                behaviorFlags: ['MONST_IMMOBILE'] } as MonsterData;
            const monster = game.createSquareMonster(data, size, at);
            if (!monster) throw new Error('Square fixture publication rejected');
            result.push({ entityId: monster.id, size, cells: game.footprintOf(monster).map(p => ({ x: p.x, y: p.y })) });
        }
    });
    game.update();
    return result;
}
export function installSquareBodyDiagnostics(game: Game): () => void {
    if (!import.meta.env.DEV) return () => {};
    const target = window as Window & { debug_square_bodies?: () => ReturnType<typeof placeSquareBodyFixtures> };
    const run = () => placeSquareBodyFixtures(game);
    target.debug_square_bodies = run;
    return () => { if (target.debug_square_bodies === run) delete target.debug_square_bodies; };
}
