import type { Game } from '../../../../engine/Core/Game';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import type { Creature } from '../../../../entities/Creature';
import monsters from '../../../../data/monsters.json';
import { TerrainType } from '../../../../engine/Map/Grid';
import { canFitAt, footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { markActorActionFixture } from '../../../../engine/Core/ActorActionSession';
import { bindPhasedAttackProduction } from '../../../../engine/Core/PhasedAttackProduction';
import { logger } from '../../../../engine/Systems/Logger';
import { presentationTimeline } from '../../../../ui/presentationTimeline';
import { readPublicCombatTelegraphs } from '../../../../ui/combatDrawing';
import type { Pos } from '../../../../types';

/** DEV-only diagnostic placement, not natural content or save/replay evidence.
 * No terrain edits: reject before allocating IDs unless an adjacent floor fits. */
export function placeCombatTelegraphFixture(game: Game) {
    if (!import.meta.env.DEV) throw new Error('Combat diagnostics require a development build');
    if (!game.extensionRuntime?.actorActionBinding() || !game.extensionRuntime.readModuleView('combat'))
        throw new Error('Enable combat in a new extended run before using this fixture');
    if (game.isGameOver || game.replayRecording || game.isInputLocked() || presentationTimeline(game)?.busy
        || logger.pendingAcknowledgment || game.hasPendingConfirmation || game.isInventoryOpen || game.pendingArcana
        || game.isThrowing || game.referenceScreen || game.player.movementSpeed !== 100)
        throw new Error('Combat diagnostics require an idle live map with ordinary player speed');
    const interactables = game.readVisibleInteractables();
    let location: { size: 1 | 2; at: Pos } | undefined;
    const positions: Pos[] = [];
    for (let y = game.player.y - 3; y <= game.player.y + 2; y++)
        for (let x = game.player.x - 3; x <= game.player.x + 2; x++) positions.push({ x, y });
    for (const size of [2, 1] as const) {
        const at = positions.find(at => {
            const candidate = { loc: at, hp: 1, ...(size === 2 ? {
                spatial: { schema: 1, footprintId: 'builtin:square-2', pose: 'r0' },
            } : {}) } as Creature;
            const cells = footprintOf(candidate);
            if (Math.min(...cells.map(p => Math.max(Math.abs(p.x - game.player.x), Math.abs(p.y - game.player.y)))) !== 1) return false;
            return canFitAt(game, candidate, at, { allowsTerrain: p => {
                const cell = game.grid.getCell(p.x, p.y);
                return !!cell?.isVisible && cell.layers.every(t => t === TerrainType.FLOOR || t === TerrainType.NOTHING)
                    && !cell.machineNumber && !game.items.some(item => item.x === p.x && item.y === p.y)
                    && !interactables.some(entity => entity.x === p.x && entity.y === p.y);
            } });
        });
        if (at) { location = { size, at }; break; }
    }
    if (!location) throw new Error('No safe visible adjacent floor; move to a larger room');
    // Establish the trusted production binding before applying the diagnostic
    // export guard. Future export remains blocked even after the warning ends.
    bindPhasedAttackProduction(game);
    markActorActionFixture(game);
    let source!: Monster;
    game.executeCommand('fixture:combat-telegraph-display', undefined, () => {
        const data = { ...monsters.find(monster => monster.id === 'ogre')!, hp: 10000 } as MonsterData;
        source = location!.size === 2 ? game.createSquareMonster(data, 2, location!.at)!
            : new Monster(location!.at.x, location!.at.y, data);
        if (!source) throw new Error('Combat fixture publication rejected');
        if (location!.size === 1) game.monsters.push(source);
        source.state = MonsterState.HUNTING; source.ticksUntilTurn = 50; source.regenTurns = 0;
    });
    game.executeCommand('wait');
    game.update();
    return { sourceEntityId: source.id, size: location.size, sourceCells: footprintOf(source).map(p => ({ ...p })),
        telegraphs: readPublicCombatTelegraphs(game).filter(telegraph => telegraph.sourceEntityId === source.id) };
}

export function installCombatDiagnostics(game: Game): () => void {
    if (!import.meta.env.DEV || typeof window === 'undefined') return () => {};
    const target = window as Window & { debug_combat_telegraphs?: () => ReturnType<typeof placeCombatTelegraphFixture> };
    const run = () => placeCombatTelegraphFixture(game);
    target.debug_combat_telegraphs = run;
    return () => { if (target.debug_combat_telegraphs === run) delete target.debug_combat_telegraphs; };
}
