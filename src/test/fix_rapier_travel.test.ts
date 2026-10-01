import { describe, expect, it } from 'vitest';
import { createHeadlessGame } from './harness';
import { Game } from '../engine/Core/Game';
import { TerrainType as T, DungeonLayer as L } from '../engine/Map/Grid';
import { promoteTile } from '../engine/Map/Promotion';
import { spawnDungeonFeature, catalogFeature } from '../engine/Map/DungeonFeature';
import { DF } from '../engine/Map/DungeonFeatureCatalog';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';

function scene(weaponId: string | null = 'rapier', game?: Game) {
    const g = game ?? createHeadlessGame(438182354, 'test');
    g.monsters = []; g.dormantMonsters = []; g.items = [];
    g.visibleMonsters.clear(); g.visibleItems.clear();
    for (let x = 0; x < g.grid.width; x++) for (let y = 0; y < g.grid.height; y++) {
        const corridor = x >= 5 && x <= 55 && y === 10;
        const remoteRoom = x >= 65 && x <= 75 && y >= 3 && y <= 15;
        g.grid.setTerrain(x, y, corridor || remoteRoom ? T.FLOOR : T.GRANITE);
        const cell = g.grid.getCell(x, y)!;
        Object.assign(cell, { hasMemory: true, isExplored: true, isVisible: false,
            isClairvoyantVisible: false, isMagicMapped: false, autoSearched: true,
            machineNumber: 0, rememberedLayers: [...cell.layers], rememberedItem: null });
    }
    g.player.loc = { x: 10, y: 10 };
    g.player.statusDurations = {}; g.player.setStatusDuration('darkness', 1000);
    g.player.maxStatus.darkness = 1000;
    g.player.equippedWeapon = null; g.player.equippedArmor = null;
    const weapon = weaponId ? ItemLoader.spawnWeapon(weaponId, -1, -1)! : null;
    if (weapon) g.player.inventory.addItem(weapon);
    (g as any).updateVision();
    logger.reset(); g.disturbed = false;
    return { g, weapon };
}

function start(g: Game, action: 'mouse_travel' | 'auto_explore') {
    if (action === 'auto_explore') {
        for (let x = 35; x <= 55; x++) {
            const cell = g.grid.getCell(x, 10)!;
            cell.hasMemory = false; cell.isExplored = false;
        }
    }
    g.executeCommand(action, action === 'mouse_travel' ? { x: 50, y: 10 } : undefined);
    expect(g.autoPath.length).toBeGreaterThan(10);
}

describe('distant DF path cache invalidation preserves automatic movement', () => {
    for (const action of ['mouse_travel', 'auto_explore'] as const) {
        it.each([null, 'rapier', 'spear', 'pike', 'whip', 'flail', 'axe'])('%s keeps ' + action + ' running when a distant forcefield melts', weaponId => {
            const { g, weapon } = scene(weaponId);
            if (weapon) g.executeItemCommand('equip', weapon);
            g.grid.setTerrainLayer(70, 8, L.DUNGEON, T.FORCEFIELD);
            start(g, action);
            const route = structuredClone(g.autoPath), random = rng.getState();
            // The same real promotion -> DF -> invalidation path as the user's
            // recording, isolated from the probabilistic promotion schedule.
            const promotion = promoteTile(g.grid, 70, 8, L.DUNGEON, false);
            expect(promotion.spawn?.pathingChanged).toBe(true);
            expect(g.autoPath).toEqual(route);
            expect(g.toSnapshot().run.isAutoExploring ?? false).toBe(action === 'auto_explore');
            expect(g.disturbed).toBe(false);
            expect(rng.getState()).toEqual(random);
            for (let step = 1; step <= 12; step++) {
                g.executeCommand('auto_step');
                expect(g.player.loc).toEqual({ x: 10 + step, y: 10 });
                expect(g.autoPath.length).toBeGreaterThan(0);
                expect(g.disturbed).toBe(false);
            }
        });
    }

    it('naturally scheduled forcefield decay continues travel and replays with zero OOS', () => {
        const setup = (game?: Game) => {
            const f = scene('rapier', game);
            for (let x = 68; x <= 72; x++) for (let y = 7; y <= 8; y++) f.g.grid.setTerrainLayer(x, y, L.DUNGEON, T.FORCEFIELD);
            return f;
        };
        const { g, weapon } = setup();
        g.executeItemCommand('equip', weapon!);
        start(g, 'mouse_travel');
        for (let step = 1; step <= 40; step++) {
            g.executeCommand('auto_step');
            expect(g.player.loc).toEqual({ x: 10 + step, y: 10 });
            if (step < 40) expect(g.autoPath.length).toBe(40 - step);
        }
        expect(g.autoPath).toEqual([]); // arrival still stops
        expect(Array.from({ length: 10 }, (_, n) => g.grid.getCell(68 + n % 5, 7 + Math.floor(n / 5))!)
            .some(cell => !cell.layers.includes(T.FORCEFIELD))).toBe(true);
        const recording = g.exportRecording(), random = rng.getState(), loc = { ...g.player.loc };
        expect(g.loadReplay(recording)).toBe(true); setup(g);
        while (g.replayCursor < recording.events.length && !g.replayError) g.replayStep();
        expect(g.replayError).toBeNull();
        expect(g.replayCursor).toBe(recording.events.length);
        expect(g.player.loc).toEqual(loc);
        expect(rng.getState()).toEqual(random);
    });

    it('still rejects a newly blocked remaining route before spending another turn or RNG', () => {
        const { g, weapon } = scene(); g.executeItemCommand('equip', weapon!);
        start(g, 'mouse_travel');
        const f = { ...catalogFeature(DF.DF_FORCEFIELD), startProbability: 0, probabilityDecrement: 0 };
        expect(spawnDungeonFeature(g.grid, 25, 10, f, false).pathingChanged).toBe(true);
        // Commit knowledge as a visible terrain update would, without exposing
        // distant unseen live terrain to the travel revalidation predicate.
        const cell = g.grid.getCell(25, 10)!;
        cell.rememberedLayers = [...cell.layers];
        const turn = g.stats.turns, random = rng.getState();
        g.executeCommand('auto_step');
        expect(g.autoPath).toEqual([]); expect(g.disturbed).toBe(true);
        expect(g.player.loc).toEqual({ x: 10, y: 10 });
        expect(g.stats.turns).toBe(turn); expect(rng.getState()).toEqual(random);
    });

    it('still stops for a message after distant terrain invalidation', () => {
        const { g, weapon } = scene(); g.executeItemCommand('equip', weapon!);
        g.grid.setTerrainLayer(70, 8, L.DUNGEON, T.FORCEFIELD); start(g, 'mouse_travel');
        promoteTile(g.grid, 70, 8, L.DUNGEON, false);
        logger.log('a new threat');
        const turn = g.stats.turns, random = rng.getState();
        g.executeCommand('auto_step');
        expect(g.autoPath).toEqual([]); expect(g.disturbed).toBe(true);
        expect(g.stats.turns).toBe(turn); expect(rng.getState()).toEqual(random);
    });
});
