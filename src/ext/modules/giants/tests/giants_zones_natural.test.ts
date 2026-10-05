import { expect, it } from 'vitest';
import { naturalSpine, giantsState, json } from './naturalFixture';
import { footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import type { Game } from '../../../../engine/Core/Game';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { canSeeMonsterAt } from '../../../../engine/UI/MonsterVisibility';
import { selectBossHud } from '../ui/view';
import { observeDisplayFrame } from '../../../../ui/displayProjection';
import { logger } from '../../../../engine/Systems/Logger';
import { readCreatureBirth } from '../../../birth';
import { canonical } from '../../../json';

/** Read-only path choice for acceptance. Every move/attack/decision is issued
 * through the public input boundary. No actor/HP/item/terrain injection. */
function nextAttackCommand(game: Game, bossId: number): { x: number; y: number } {
    const boss = game.monsters.find(m => m.id === bossId)!;
    const cells = footprintOf(boss), broken = boss.spatial!.zoneState![0]!.broken;
    const wanted = cells.filter(p => p.zoneId === (broken ? 'head' : 'shell'));
    const at = game.player.loc;
    const touch = wanted.find(p => Math.max(Math.abs(p.x - at.x), Math.abs(p.y - at.y)) === 1
        && (!((p.x - at.x) && (p.y - at.y)) || (game.grid.getCell(p.x, at.y)?.isPassable && game.grid.getCell(at.x, p.y)?.isPassable)));
    if (touch) return { x: touch.x - at.x, y: touch.y - at.y };
    const body = new Set(cells.map(p => `${p.x},${p.y}`));
    const valid = (p: {x:number;y:number}) => {
        const cell = game.grid.getCell(p.x, p.y);
        return !!cell && (cell.isPassable || [T.DOOR, T.SECRET_DOOR].includes(cell.terrain))
            && !cell.layers.some(t => [T.LAVA, T.CHASM, T.WATER_DEEP].includes(t)) && !body.has(`${p.x},${p.y}`);
    };
    const queue = [{ ...at }], previous = new Map<string, {x:number;y:number} | null>([[`${at.x},${at.y}`, null]]);
    let goal: {x:number;y:number} | undefined;
    for (let i = 0; i < queue.length; i++) {
        const p = queue[i]!;
        if (wanted.some(c => Math.abs(c.x - p.x) + Math.abs(c.y - p.y) === 1)) { goal = p; break; }
        for (const [dx, dy] of [[0,-1],[0,1],[-1,0],[1,0]]) {
            const next = { x: p.x + dx!, y: p.y + dy! }, key = `${next.x},${next.y}`;
            if (valid(next) && !previous.has(key)) { previous.set(key, p); queue.push(next); }
        }
    }
    if (!goal) throw new Error('No natural zone approach');
    let next = goal, p = goal;
    while (previous.get(`${p.x},${p.y}`)) { next = p; p = previous.get(`${p.x},${p.y}`)!; }
    if (game.grid.getCell(next.x, next.y)!.terrain === T.SECRET_DOOR) {
        game.executeCommand('search'); return { x: 0, y: 0 };
    }
    return { x: next.x - at.x, y: next.y - at.y };
}
const world = (game: Game) => { const s = json(game.toSnapshot()); s.savedAt = 0; s.run.recordedInputEvents = []; s.run.recordedInputIndex = 0; return canonical(s); };

it('seed 7309 naturally generates D11 zones and defeats them using native commands without growth/combat; break/save/replay/seek/continuation agree', () => {
    const { game, boss } = naturalSpine(), id = boss.id, arrived = game.exportRecording().events.length;
    expect(game.depth).toBe(11); expect(game.extensionRuntime!.manifest.modules.map(m => m.id)).toEqual(['giants']);
    expect(readCreatureBirth(boss)).toMatchObject({ creationReason: 'natural' });
    expect(boss.spatial!.zoneState).toEqual([{ zoneId: 'shell', hp: 30, broken: false, generation: 0 }]);
    let brokenSave: ReturnType<Game['toSaveSnapshot']> | undefined, breakEvent = 0;
    for (let step = 0; step < 600 && boss.hp > 0 && !game.isGameOver; step++) {
        const direction = nextAttackCommand(game, id);
        game.executeCommand(direction.x || direction.y ? 'move' : 'wait', direction);
        while (logger.pendingAcknowledgment) logger.acknowledgeNext();
        if (game.pendingCommandConfirmation) game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
        if (!brokenSave && boss.spatial!.zoneState![0]!.broken) {
            brokenSave = json(game.toSaveSnapshot()); breakEvent = game.exportRecording().events.length;
            expect(boss.hp).toBeGreaterThan(0); expect(giantsState(game).bosses.find(b => b.primaryId === id)!.status).toBe('alive');
            if (footprintOf(boss).some(p => canSeeMonsterAt(game.player, game.grid, boss, p)))
                expect(selectBossHud(observeDisplayFrame(game, logger))?.zone?.broken).toBe(true);
            // CE tries the whip before movement. Its distant broken-shell
            // contact keeps attacking instead of approaching the head. Remove
            // the naturally collected weapon through the public item boundary.
            if (game.player.equippedWeapon?.flags?.includes('ITEM_ATTACKS_EXTEND'))
                game.executeItemCommand('unequip', game.player.equippedWeapon);
        }
    }
    expect(brokenSave).toBeTruthy(); expect(boss.hp).toBe(0);
    expect(giantsState(game).bosses.find(b => b.primaryId === id)!.status).toBe('defeated');
    const recording = json(game.exportRecording()), final = world(game), last = recording.events.length;
    expect(last).toBeGreaterThan(arrived); expect(last).toBeLessThan(arrived + 600);
    expect(game.loadSnapshot(brokenSave!)).toBe(true); game.animationEnabled = false;
    const restored = game.monsters.find(m => m.id === id)!; restored.refreshSpeeds(); expect(restored.movementSpeed).toBe(150);
    // Continue the exact public suffix; the provenance chain must append it.
    for (const event of recording.events.slice(breakEvent)) {
        game.executeCommand(event.action, event.data);
        if (game.pendingCommandConfirmation) for (const decision of event.decisions ?? []) game.resolveCommandDecision(game.pendingCommandConfirmation.token, decision);
        while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    }
    expect(world(game)).toBe(final); expect(game.exportRecording().events).toEqual(recording.events);
    expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false;
    while (game.replayCursor < last) { game.replayStep(true); expect(game.replayError).toBeNull(); }
    expect(world(game)).toBe(final);
    for (const index of [breakEvent, arrived, last]) {
        game.replaySeek(index); expect(game.replayCursor).toBe(index); expect(game.replayError).toBeNull();
        if (index === breakEvent) expect(game.monsters.find(m => m.id === id)!.spatial!.zoneState![0]!.broken).toBe(true);
        if (index === arrived) expect(game.monsters.find(m => m.id === id)!.spatial!.zoneState![0]!.hp).toBe(30);
    }
    expect(world(game)).toBe(final);
    console.info('4c natural acceptance', JSON.stringify({ seed: 7309, mode: 'wizard', modules: ['giants'], depth: 11, arrived, breakEvent, finalEvent: last, bossId: id, hp: boss.hp }));
}, 240000);
