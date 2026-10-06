import { installRecordingScene } from './support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Graphics } from 'pixi.js';
import { createHeadlessGame } from './harness';
import { squareDisplayScene } from './support/squareDisplayScene';
import { DungeonLayer, TerrainType } from '../engine/Map/Grid';
import { Game } from '../engine/Core/Game';
import { Monster, type MonsterData } from '../entities/Monster';
import monsters from '../data/monsters.json';
import { publicMonsterBody, publicMonsterMapCells } from '../engine/UI/MonsterBody';
import { footprintOf, commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { sidebarEntityRows } from '../engine/UI/MonsterSidebar';
import { monsterAppearance } from '../engine/UI/Appearance';
import { observeDisplayFrame, observeDisplayMap } from '../ui/displayProjection';
import { observeDisplayMonster } from '../ui/monsterDisplay';
import { bodyEdges, paintBody, selectedBodyCells } from '../ui/bodyDrawing';
import { PresentationTimeline, displayedFrame } from '../ui/presentationTimeline';
import { observePresentation } from '../engine/Core/PresentationObserver';
import { targetingState, targetingTapCommand } from '../ui/targeting';
import { nearbyDetail } from '../ui/nearbyInspection';
import { placeSquareBodyFixtures, installSquareBodyDiagnostics } from '../ui/squareBodyDiagnostics';
import { rng } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { mapModes } from '../ui/mapTiles';
import { paintMapText } from '../ui/mapTileDrawing';

const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); vi.unstubAllGlobals(); logger.observeMessages(null); logger.presentAcknowledgments(null); targetingState.aim = null; });
function scene(size: 2 | 3 = 3) { const game = createHeadlessGame(403003, 'test'); return { game, monster: squareDisplayScene(game, size) }; }
function timeline(game: Game) { logger.presentAcknowledgments(() => true); const result = new PresentationTimeline(game, logger); disposers.push(() => result.dispose()); return result; }

describe('4a-3 public body projection and shared drawing', () => {
    it.each([2, 3] as const)('%s-square collision cells = paint cells, one row, one main glyph; mode changes only the glyph', size => {
        const { game, monster } = scene(size); const frame = observeDisplayFrame(game, logger), body = frame.map.bodies[0]!;
        expect(body.cells).toEqual(footprintOf(monster).map(({ x, y }) => ({ x, y })));
        expect(frame.rows.filter(r => r.kind === 'monster')).toHaveLength(1);
        expect(frame.rows[0]).toMatchObject({ bodySize: size, loc: body.glyph });
        expect(frame.map.entities.filter(e => e.semantic.kind === 'monster')).toHaveLength(1);
        const paints: unknown[] = [], labels: string[] = [];
        for (const mode of mapModes) {
            const graphics = new Graphics(); paintBody(graphics, body, 16); paints.push(graphics.context.instructions.map(i => i.action === 'fill' || i.action === 'stroke' ? { action: i.action, path: i.data.path.instructions, color: i.data.style.color, alpha: i.data.style.alpha } : { action: i.action })); 
            const sprite = { style: {}, text: '', visible: false, x: 0, y: 0, anchor: { set() {} }, scale: { set() {} } };
            const entity = frame.map.entities.find(e => e.semantic.kind === 'monster')!;
            paintMapText(sprite as never, entity.semantic, entity.color, mode, entity.x, entity.y, 16); labels.push(sprite.text);
            if (mode !== 'tiles') expect(sprite.x).toBe((body.glyph.x + (mode === 'original' ? 0 : .5)) * 16); graphics.destroy();
        }
        expect(paints.every(p => JSON.stringify(p) === JSON.stringify(paints[0]))).toBe(true);
        expect(new Set(labels).size).toBeGreaterThan(1);
        expect(bodyEdges(body.cells)).toHaveLength(size * 4);
    });
    it('mask edges follow an L shape and a hole, never fill the bounding rectangle', () => {
        const cells = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 1, y: 2 }];
        expect(bodyEdges(cells)).toHaveLength(8);
        expect(bodyEdges(cells)).toContainEqual({ from: { x: 2, y: 2 }, to: { x: 2, y: 3 } });
        const hole = Array.from({ length: 9 }, (_, i) => ({ x: i % 3, y: Math.floor(i / 3) })).filter(p => p.x !== 1 || p.y !== 1);
        expect(bodyEdges(hole)).toHaveLength(16);
        const rect = vi.fn().mockReturnThis(), fill = vi.fn().mockReturnThis(), moveTo = vi.fn().mockReturnThis(), lineTo = vi.fn().mockReturnThis(), stroke = vi.fn().mockReturnThis();
        paintBody({ rect, fill, moveTo, lineTo, stroke } as never, { entityId: 1, cells, glyph: cells[0]!, size: null, color: '#fff' }, 16);
        expect(rect.mock.calls).toEqual(cells.map(p => [p.x * 16, p.y * 16, 16, 16]));
        expect(lineTo).toHaveBeenCalledTimes(8);
    });
    it('hidden anchor/tails never appear in body, row, hover/target geometry or inspection location', () => {
        const { game, monster } = scene();
        for (const p of footprintOf(monster)) game.grid.getCell(p.x, p.y)!.isVisible = false;
        const tail = { x: 14, y: 13 }; game.grid.getCell(tail.x, tail.y)!.isVisible = true;
        game.updateHover(tail.x, tail.y); const frame = observeDisplayFrame(game, logger);
        expect(frame.map.bodies[0]).toMatchObject({ cells: [tail], glyph: tail, size: null });
        expect(frame.rows[0]).toMatchObject({ loc: tail, bodyCells: [tail], bodySize: null, focused: true });
        expect(selectedBodyCells(frame.map.bodies, tail)).toEqual([tail]);
        expect(selectedBodyCells(frame.map.bodies, monster.loc)).toBeNull();
        expect(frame.map.entities.filter(e => e.semantic.kind === 'monster')).toMatchObject([{ x: tail.x, y: tail.y }]);
        expect(nearbyDetail(game, frame.rows[0]!)).not.toBeNull();
        game.handleInspectAt(tail.x, tail.y); expect(game.inspectTarget?.name).toBe(monster.name);
        game.inspectTarget = null; game.handleInspectAt(monster.x, monster.y); expect(game.inspectTarget).toBeNull();
    });
    it('stable seen main cell and minimum public distance order, including a focused tail', () => {
        const { game, monster } = scene(); const first = publicMonsterBody(game.player, game.grid, monster)!;
        const other = new Monster(16, 8, monsters.find(m => m.id === 'rat')! as MonsterData); game.monsters.push(other);
        game.hoveredCell = { x: 14, y: 13 };
        const rows = sidebarEntityRows(game.player, game.grid, game.monsters, game.items, game.hoveredCell);
        expect(rows[0]).toMatchObject({ id: monster.id, loc: first.glyph, distanceSquared: 4, distance: 2, focused: true });
        expect(publicMonsterBody(game.player, game.grid, monster)).toEqual(first);
        game.grid.getCell(12, 11)!.isVisible = false;
        expect(publicMonsterBody(game.player, game.grid, monster)?.glyph).toEqual(first.glyph);
        game.hoveredCell = null; expect(sidebarEntityRows(game.player, game.grid, game.monsters, game.items)[0]?.id).toBe(monster.id);
    });
    it.each(['telepathy', 'entranced'] as const)('%s reveal-only keeps one position marker and no shape', status => {
        const { game, monster } = scene();
        for (const p of footprintOf(monster)) game.grid.getCell(p.x, p.y)!.isVisible = false;
        (status === 'telepathy' ? game.player : monster).setStatusDuration(status, 10);
        const frame = observeDisplayFrame(game, logger);
        expect(frame.map.bodies).toEqual([]);
        expect(frame.map.entities.filter(e => e.semantic.kind === 'monster')).toHaveLength(1);
        expect(frame.rows[0]).toMatchObject({ loc: monster.loc, bodySize: null, bodyCells: [monster.loc] });
    });
    it('hallucination calls appearance once per body; refresh never changes either rule RNG', () => {
        const { game, monster } = scene(); game.player.setStatusDuration('hallucinating', 100);
        const cosmetic = { percent: vi.fn(() => true), pick: vi.fn(<T>(list: readonly T[]) => list[0] as T) as <T>(list: readonly T[]) => T };
        const before = rng.getState(); const display = observeDisplayMonster(game, monster, cosmetic, new Map())!;
        expect(cosmetic.percent).toHaveBeenCalledTimes(1); expect(cosmetic.pick).toHaveBeenCalledTimes(2);
        expect(display.body?.color).toBe(display.entity.color);
        for (let i = 0; i < 20; i++) observeDisplayFrame(game, logger);
        expect(rng.getState()).toEqual(before);
    });
    it('invisible gas outlines only public gas cells; reveal-only hidden identity retains marker precedence', () => {
        const { game, monster } = scene(); monster.setStatusDuration('invisible', 10);
        game.player.setStatusDuration('telepathy', 10);
        const hidden = observeDisplayFrame(game, logger);
        expect(hidden.map.bodies).toEqual([]); expect(hidden.rows.filter(r => r.kind === 'monster')).toEqual([]);
        expect(hidden.map.entities.filter(e => e.semantic.kind === 'marker')).toMatchObject([{ x: monster.x, y: monster.y }]);
        expect(publicMonsterMapCells(game.player, game.grid, monster)).toEqual([monster.loc]);
        const tail = { x: 14, y: 13 }; game.grid.getCell(tail.x, tail.y)!.layers[DungeonLayer.GAS] = TerrainType.POISON_GAS;
        const visible = observeDisplayFrame(game, logger);
        expect(visible.map.bodies[0]).toMatchObject({ cells: [tail], glyph: tail, size: null });
        expect(visible.rows[0]).toMatchObject({ loc: tail, bodySize: null });
    });
    it('ordinary creature keeps the original single-cell appearance and empty body drawing path', () => {
        const { game, monster } = scene(); delete monster.spatial;
        const cosmetic = { percent: vi.fn(() => false), pick: vi.fn(<T>(list: readonly T[]) => list[0] as T) as <T>(list: readonly T[]) => T };
        const visual = monsterAppearance(monster, { cellVisible: true, cellHasMemory: true, telepathy: false,
            hallucinating: false, cosmetic, monsterVisibility: 'direct' })!;
        expect(observeDisplayMonster(game, monster, cosmetic, new Map())).toMatchObject({ body: null,
            entity: { ...monster.loc, color: visual.color, interactive: visual.interactive, semantic: { original: visual.char } } });
        expect(observeDisplayMap(game).bodies).toEqual([]); expect(cosmetic.percent).not.toHaveBeenCalled();
    });
    it('one real body strike emits one damage floater, without a per-cell copy', () => {
        const { game, monster } = scene(); commitCreatureAnchor(game.player, { x: 15, y: 13 }); monster.defense = -1000;
        const sword = ItemLoader.spawnWeapon('sword', -1, -1)!; sword.damage = '2-2'; sword.enchantment = 0; sword.strengthRequired = game.player.effectiveStrength;
        game.player.inventory.addItem(sword); game.player.equippedWeapon = sword;
        game.executeCommand('move', { x: -1, y: 0 });
        expect(monster.hp).toBe(298);
        expect(observeDisplayFrame(game, logger).floatingTexts.filter(f => f.text === '-2')).toHaveLength(1);
    });
    it('MORE retains old body position/HP/hover and detached frozen public HUD rows', () => {
        const { game, monster } = scene(); const t = timeline(game); game.updateHover(14, 13);
        logger.log('body old damage', '#fff', { acknowledge: true }); const old = displayedFrame(game)!;
        commitCreatureAnchor(monster, { x: 20, y: 10 }); monster.hp = 17; game.clearHover();
        observePresentation(game, 'command-complete');
        expect(displayedFrame(game)).toBe(old); expect(old.rows[0]).toMatchObject({ hp: 300, loc: { x: 13, y: 12 } });
        expect(old.hoverCell).toEqual({ x: 14, y: 13 }); expect(old.map.bodies[0]?.cells).toHaveLength(9);
        expect(Object.isFrozen(old.map.bodies[0]?.cells)).toBe(true); expect(nearbyDetail(game, old.rows[0]!)).toBeNull();
        expect(t.acknowledge(t.acknowledgment!)).toBe(true);
        expect(observeDisplayFrame(game, logger).rows[0]).toMatchObject({ hp: 17, loc: { x: 21, y: 11 } });
    });
    it('replay and back/forward seek clear old projection/hover/aim and rebuild current square geometry', () => {
        installRecordingScene(squareDisplayScene);
        const game = createHeadlessGame(403003, 'test'); game.executeCommand('wait'); game.executeCommand('move', { x: 1, y: 0 });
        const recording = game.exportRecording(); timeline(game); expect(game.loadReplay(recording)).toBe(true);
        for (const index of [2, 0, 1]) {
            game.hoveredCell = { x: 14, y: 13 }; targetingState.aim = { x: 14, y: 13 }; game.replaySeek(index);
            expect(game.replayError).toBeNull(); expect(displayedFrame(game)).toBeUndefined();
            expect(game.hoveredCell).toBeNull(); expect(targetingState.aim).toBeNull();
            const frame = observeDisplayFrame(game, logger); expect(frame.map.bodies).toHaveLength(1);
            expect(frame.map.bodies[0]?.cells).toEqual(footprintOf(game.monsters[0]!).map(({ x, y }) => ({ x, y })));
            expect(frame.arcana).toBeNull(); expect(frame.throwAim).toBeNull();
        }
    });
    it('different tail cells adjust aim rather than confirm, preserving exact contact coordinates', () => {
        const { game } = scene(); const a = { x: 14, y: 11 }, b = { x: 14, y: 13 };
        expect(game.getMonsterAt(a.x, a.y)).toBe(game.getMonsterAt(b.x, b.y));
        expect(targetingTapCommand('throw', b, a, null, game.player.loc)).toEqual({ kind: 'aim', ...b });
        expect(targetingTapCommand('arcana', b, null, a, game.player.loc)).toEqual({ kind: 'dispatch', action: 'move', data: { x: 0, y: 2 } });
        expect(targetingTapCommand('throw', b, b, null, game.player.loc)).toEqual({ kind: 'execute', action: 'mouse_travel', data: b });
        expect(targetingTapCommand('arcana', b, null, b, game.player.loc)).toEqual({ kind: 'dispatch', action: 'confirm_target' });
    });
});

describe('4a-3 development fixture export guard', () => {
    it('installs/disposes only a debug function; safely places both sizes and rejects every production export', () => {
        const { game } = scene(); game.monsters = []; const before = rng.getState();
        vi.stubGlobal('window', {}); const remove = installSquareBodyDiagnostics(game); disposers.push(remove);
        const rows = (window as any).debug_square_bodies(); expect(rows.map((r: any) => r.size)).toEqual([2, 3]);
        expect(game.monsters).toHaveLength(2); expect(rows.map((r: any) => r.cells.length)).toEqual([4, 9]);
        expect(new Set(rows.flatMap((r: any) => r.cells.map((p: any) => `${p.x},${p.y}`))).size).toBe(13);
        for (const name of ['toSnapshot', 'toSaveSnapshot', 'exportRecording'] as const) expect(() => game[name]()).toThrow('fixture');
        expect(rng.getState()).not.toEqual(before); remove(); expect((window as any).debug_square_bodies).toBeUndefined();
    });
    it('a no-space failure changes no world, IDs, recorder or rule RNG and leaves exports usable', () => {
        const { game } = scene(); game.monsters = []; for (const column of (game.grid as any).cells) for (const cell of column) cell.isVisible = false;
        const before = game.toSnapshot(), random = rng.getState();
        expect(() => placeSquareBodyFixtures(game)).toThrow('No safe visible space');
        const after = game.toSnapshot(); after.savedAt = before.savedAt;
        expect(after).toEqual(before); expect(rng.getState()).toEqual(random); expect(() => game.exportRecording()).not.toThrow();
    });
});
