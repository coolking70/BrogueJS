import type { Game } from '../engine/Core/Game';
import type { Logger } from '../engine/Systems/Logger';
import { cellAppearance, itemAppearance, rememberedItemAppearance, playerAppearance, type CosmeticRng } from '../engine/UI/Appearance';
import { publicMonsterMapCells } from '../engine/UI/MonsterBody';
import { observeDisplayMonster } from './monsterDisplay';
import type { DisplayBody } from './bodyDrawing';
import { sidebarEntityRows, sidebarPlayerStats } from '../engine/UI/MonsterSidebar';
import { displayRandom } from '../engine/Lighting/CosmeticLight';
import { terrainRandomValues } from '../engine/UI/DancingColors';
import { playerHudStatusRows } from './playerHudStatus';
import { targetingState } from './targeting';
import { readInteractableMapMarkers } from './worldInteractableMap';
import { terrainSemantic, rememberedItemSemantic, itemSemantic, playerSemantic, type TileSemantic } from './mapTileSemantics';

export interface DisplayTile {
    readonly semantic: Readonly<TileSemantic>;
    readonly color: string | number;
    readonly bgColor: number | null;
}
export interface DisplayEntity extends DisplayTile {
    readonly x: number; readonly y: number; readonly interactive: boolean;
}
/** DTOs contain only the results of the existing appearance/knowledge gates.
 * Null cells carry no terrain, gas, item or monster information. */
export interface DisplayMap {
    readonly columns: readonly (readonly (DisplayTile | null)[])[];
    readonly entities: readonly DisplayEntity[];
    readonly bodies: readonly DisplayBody[];
}
export function freezeDisplay<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const child of Object.values(value)) freezeDisplay(child);
        Object.freeze(value);
    }
    return value;
}
/** Pure observation: no vision/flare preparation, archive getter, snapshots,
 * discovery or simulation RNG. The display owner has its own random stream. */
export function observeDisplayMap(game: Game, previous?: DisplayMap,
    interactables = game.readVisibleInteractables()): DisplayMap {
    const hallucinating = !!game.player.statusDurations.hallucinating;
    const telepathy = !!game.player.statusDurations.telepathy;
    const random = displayRandom(game.grid);
    const cosmetic: CosmeticRng = { percent: p => random.randPercent(p),
        pick: list => list[random.randRange(0, list.length - 1)]! };
    const items = new Map(game.items.map(item => [`${item.x},${item.y}`, item]));
    const columns: (readonly (DisplayTile | null)[])[] = [];
    const gasBackgrounds = new Map<string, number>();
    for (let x = 0; x < game.grid.width; x++) {
        const column: (DisplayTile | null)[] = [];
        for (let y = 0; y < game.grid.height; y++) {
            const cell = game.grid.getCell(x, y)!;
            const visual = cellAppearance(cell, {
                gas: game.environment.gasGrid[x]?.[y], lightChannels: game.lightMap.lightAt(x, y),
                dancingLightChannels: game.lightMap.renderLightAt(x, y),
                terrainRandomValues: terrainRandomValues(cell, game.grid),
                flareChannels: game.flareLightAt(x, y), flashChannels: game.terrainFlashAt(x, y),
                depth: game.depth, groundItem: items.get(`${x},${y}`) ?? null,
                carriedItem: null, hallucinating, cosmetic,
            });
            let tile: DisplayTile | null = visual ? { color: visual.color, bgColor: visual.bgColor,
                semantic: terrainSemantic(cell, visual, hallucinating) } : null;
            if (visual?.bgColor !== null && visual?.bgColor !== undefined) gasBackgrounds.set(`${x},${y}`, visual.bgColor);
            const old = previous?.columns[x]?.[y];
            if (JSON.stringify(tile) === JSON.stringify(old)) tile = old!;
            column.push(freezeDisplay(tile));
        }
        columns.push(previous?.columns[x]?.length === column.length && column.every((tile, y) => tile === previous.columns[x]![y])
            ? previous.columns[x]! : Object.freeze(column));
    }
    const entities: DisplayEntity[] = [];
    const bodies: DisplayBody[] = [];
    const place = (visual: { color: string | number; interactive: boolean }, x: number, y: number, semantic: TileSemantic) => {
        entities.push({ x, y, semantic, color: visual.color, bgColor: null, interactive: visual.interactive });
    };
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        const cell = game.grid.getCell(x, y)!;
        const visual = rememberedItemAppearance(cell);
        if (visual) place(visual, x, y, rememberedItemSemantic(cell, visual.char));
    }
    for (const item of game.items) {
        const cell = game.grid.getCell(item.x, item.y);
        const visual = itemAppearance(item, { cellVisible: !!cell?.isVisible, cellHasMemory: !!cell?.hasMemory, telepathy, hallucinating, cosmetic });
        if (visual && cell?.isVisible) place(visual, item.x, item.y, itemSemantic(item, visual.char, hallucinating));
    }
    // Keep the same visible-only marker precedence as the live canvas. Queued
    // presentation must neither erase these markers nor query the future world.
    const occupied = new Set([
        ...game.items.filter(item => game.grid.getCell(item.x, item.y)?.isVisible).map(item => `${item.x},${item.y}`),
        ...game.monsters.flatMap(monster => publicMonsterMapCells(game.player, game.grid, monster).map(p => `${p.x},${p.y}`)),
    ]);
    for (const marker of readInteractableMapMarkers(interactables, {
        depth: game.depth, player: game.player.loc, occupied, cellAt: (x, y) => game.grid.getCell(x, y),
    })) place({ color: marker.color, interactive: true }, marker.x, marker.y, marker.semantic);
    for (const monster of game.monsters) {
        const display = observeDisplayMonster(game, monster, cosmetic, gasBackgrounds);
        if (display) { entities.push(display.entity); if (display.body) bodies.push(display.body); }
    }
    const player = playerAppearance(game.player);
    place(player, game.player.x, game.player.y, playerSemantic(player.char));
    return freezeDisplay({ columns: Object.freeze(columns), entities, bodies });
}

export function observeDisplayFrame(game: Game, log: Logger, previous?: { map: DisplayMap }) {
    const preview = game.getArcanaPreview();
    const interactables = game.readVisibleInteractables().map(entity => ({ ...entity }));
    return freezeDisplay({
        displayTurn: game.absoluteTurnNumber, messageTurn: log.turn, depth: game.depth,
        player: { x: game.player.x, y: game.player.y, hp: game.player.hp, maxHp: game.player.maxHp, nutrition: game.player.nutrition,
            statuses: { ...game.player.statusDurations } },
        stats: sidebarPlayerStats(game.player, game.stats.gold, game['calculateStealthRange']()),
        statuses: playerHudStatusRows(game),
        rows: sidebarEntityRows(game.player, game.grid, game.monsters, game.items, game.hoveredCell, game.depth),
        logs: log.messages.map(message => ({ ...message })),
        hoverText: game.hoveredText || game.flavorText,
        hoverCell: game.hoveredCell ? { ...game.hoveredCell } : null,
        targeting: game.pendingArcana ? 'arcana' as const : game.isThrowing ? 'throw' as const : 'none' as const,
        throwAim: targetingState.aim ? { ...targetingState.aim } : null,
        targetName: game.pendingArcana?.item.displayName ?? game.throwItemTarget?.displayName ?? '',
        arcana: game.pendingArcana ? { name: game.pendingArcana.item.displayName, cursor: { ...game.pendingArcana.cursor },
            path: preview?.path.map(pos => ({ ...pos })) ?? [], maxDistance: preview?.maxDistance ?? null } : null,
        interactables,
        map: observeDisplayMap(game, previous?.map, interactables),
        bolt: game.getCurrentBoltFrame() ? { ...game.getCurrentBoltFrame()! } : null,
        floatingTexts: game.floatingTexts.map(ft => ({ text: ft.text, color: ft.color, x: ft.x, y: ft.y, life: ft.life })),
        terminal: game.isGameOver,
    });
}
export type DisplayFrame = ReturnType<typeof observeDisplayFrame>;
