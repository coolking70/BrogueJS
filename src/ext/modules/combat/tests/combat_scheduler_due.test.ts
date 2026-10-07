import { afterEach, describe, expect, it } from 'vitest';
import { createHeadlessGame, type TurnAction } from '../../../../test/harness';
import { installedOptionalModules } from '../../../../test/support/installedExtensions';
import { createExtensionRegistry } from '../../../catalog';
import type { Game } from '../../../../engine/Core/Game';
import { isProductionActorActionRunInvalid } from '../../../../engine/Core/ActorActionSession';
import { logger } from '../../../../engine/Systems/Logger';
import { canDirectlySeeMonster } from '../../../../engine/UI/MonsterVisibility';
import { digestRoot, eventDigest, inventoryStamp } from '../../../../engine/Core/RecordingDigest';
import { DIGEST_DOMAINS, EVENT_DOMAINS } from '../../../../engine/Core/RecordingV4';
import { rechain } from '../../../../test/support/recordingV4';

const move = (x: number, y: number): TurnAction => ({ action: 'move', data: { x, y } });
const wait = (): TurnAction => ({ action: 'wait' });
// Original seed-7397 crash: the 27th command commits a new owner's attack
// while another owner's inter-segment has reached zero in the same tick.
const reproduction: TurnAction[] = [
    ...Array.from({ length: 11 }, wait),
    ...Array.from({ length: 5 }, () => move(-1, 0)),
    wait(), wait(), ...Array.from({ length: 4 }, () => move(0, -1)),
    move(1, 0), move(-1, 0), move(1, 0), move(0, -1), move(0, -1),
];
function acknowledge(): void { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); }
// Continue the original probe's natural, cardinal BFS toward visible enemies.
// This reads the world without RNG, fixture edits or synthetic scheduler calls.
function continuation(game: Game): TurnAction {
    for (const target of game.monsters.filter(monster => monster.hp > 0 && !monster.isAlly
        && canDirectlySeeMonster(game.player, game.grid, monster))) {
        const origin = { x: game.player.x, y: game.player.y };
        const queue = [{ ...origin, first: null as { x: number; y: number } | null }];
        const seen = new Set([`${origin.x},${origin.y}`]);
        for (let index = 0; index < queue.length; index++) {
            const point = queue[index]!;
            if (Math.max(Math.abs(point.x - target.x), Math.abs(point.y - target.y)) <= 1) {
                const step = point.first ?? { x: Math.sign(target.x - point.x), y: Math.sign(target.y - point.y) };
                return move(step.x, step.y);
            }
            for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
                const x = point.x + dx!, y = point.y + dy!, key = `${x},${y}`, cell = game.grid.getCell(x, y);
                if (seen.has(key) || !cell?.isPassable || !cell.isVisible
                    || game.monsters.some(monster => monster.hp > 0 && monster !== target && monster.x === x && monster.y === y)) continue;
                seen.add(key); queue.push({ x, y, first: point.first ?? { x: dx!, y: dy! } });
            }
        }
    }
    return wait();
}
function mechanical(game: Game) {
    const snapshot = structuredClone(game.toSnapshot()); snapshot.savedAt = 0;
    // v5 whole-run snapshots already exclude the session's recording buffer.
    // Keep the neutral actorActions root and the complete world/both RNG streams.
    return snapshot;
}
function checkpoint(game: Game) {
    const snapshot = game.toSnapshot();
    return { tick: snapshot.run.currentTick, turn: snapshot.run.absoluteTurnNumber,
        simulationTicks: snapshot.run.world5?.simulationTicks ?? null,
        levelRef: { kind: 'dungeon', depth: snapshot.depth }, player: snapshot.player.loc,
        hp: snapshot.player.hp, inventoryStamp: inventoryStamp(game.player.inventory.items), rng: snapshot.rngState,
        checkpoint: eventDigest(snapshot.extensions ?? null, snapshot.run.world5 ?? null,
            snapshot.extensions?.manifest ?? null, snapshot.run.actorActions ?? null,
            snapshot.run.worldWorkFacts ?? null, snapshot.run.worldWorkDetails ?? null) };
}
afterEach(() => { logger.reset(); logger.onDisturb = null; });

describe('same-tick production scheduler commits', () => {
    it('runs seed 7397 for the 27-command reproduction plus 100 turns, reloads and replays/seeks exactly', () => {
        // Discover optional packages so this module's test remains valid in
        // physical-removal candidates without importing another module.
        const ids = installedOptionalModules(['growth', 'narrative', 'combat', 'giants']);
        const registry = createExtensionRegistry();
        const initialCommands = registry.create(registry.manifest(ids)).flatMap(module => module.initialCommand
            ? [JSON.stringify({ module: module.id, ...module.initialCommand })] : []);
        const game = createHeadlessGame(7397, 'wizard');
        game.startNewGame({ seed: 7397, mode: 'wizard', ruleSet: 'extended', extensions: ids, initialCommands });
        game.animationEnabled = false; game.onConfirmRequest = () => true;
        expect(reproduction).toHaveLength(27);
        const seekWorlds = new Map([[initialCommands.length, mechanical(game)]]);
        const commandWorlds = new Map<number, ReturnType<typeof mechanical>>();
        for (let index = 0; index < reproduction.length + 100; index++) {
            const command = reproduction[index] ?? continuation(game);
            acknowledge(); const turn = game.absoluteTurnNumber;
            expect(() => game.executeCommand(command.action, command.data), `command ${index + 1}`).not.toThrow();
            expect(game.absoluteTurnNumber, `command ${index + 1}`).toBeGreaterThan(turn);
            expect(game.isGameOver).toBe(false); expect(isProductionActorActionRunInvalid(game)).toBe(false);
            expect(game.recordedInputEvents).toHaveLength(initialCommands.length + index + 1);
            commandWorlds.set(initialCommands.length + index + 1, mechanical(game));
            if ([26, 27, 77, 127].includes(index + 1)) {
                const before = mechanical(game), saved = game.toSaveSnapshot();
                expect(game.loadSnapshot(structuredClone(saved))).toBe(true); game.animationEnabled = false;
                expect(mechanical(game)).toEqual(before);
                expect(isProductionActorActionRunInvalid(game)).toBe(false);
                seekWorlds.set(initialCommands.length + index + 1, before);
            }
        }
        const finalWorld = mechanical(game), recording = structuredClone(game.exportRecording());
        expect(recording.version).toBe(4);
        expect(recording.events).toHaveLength(initialCommands.length + 127);
        expect(game.loadReplay(recording)).toBe(true); game.animationEnabled = false;
        for (const event of recording.events) {
            expect(() => game.replayStep(true)).not.toThrow();
            expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(event.index + 1);
            expect(checkpoint(game)).toEqual({ tick: event.tick, turn: event.turn,
                simulationTicks: event.simulationTicks, levelRef: event.levelRef,
                player: event.player, hp: event.hp, inventoryStamp: event.inventoryStamp,
                rng: event.rng, checkpoint: event.checkpoint });
            if (event.index >= initialCommands.length) expect(mechanical(game)).toEqual(commandWorlds.get(event.index + 1));
            expect(isProductionActorActionRunInvalid(game)).toBe(false);
        }
        expect(mechanical(game)).toEqual(finalWorld);
        // Include backward seeks across the original fault boundary and the
        // reloaded continuation, then return to the complete final world.
        for (const index of [...seekWorlds.keys()].reverse()) {
            game.replaySeek(index); expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(index);
            expect(mechanical(game)).toEqual(seekWorlds.get(index));
        }
        game.replaySeek(recording.events.length); expect(game.replayError).toBeNull();
        expect(mechanical(game)).toEqual(finalWorld);
        expect(game.loadReplay({ ...recording, version: 3 })).toBe(false);
        expect(mechanical(game)).toEqual(finalWorld);
        // A valid hash chain cannot hide a forged neutral-clock checkpoint at
        // the original crash boundary. Replay must name the exact command/domain.
        const forged = structuredClone(recording), at = forged.events[initialCommands.length + 26]!;
        expect(at.checkpoint).not.toBeNull();
        at.checkpoint!.domains.actorActions = '0'.repeat(64);
        at.checkpoint!.root = digestRoot(at.checkpoint!.domains, forged.extensions, EVENT_DOMAINS);
        if (at.fullCheckpoint) {
            at.fullCheckpoint.domains.actorActions = at.checkpoint!.domains.actorActions;
            at.fullCheckpoint.root = digestRoot(at.fullCheckpoint.domains, forged.extensions, DIGEST_DOMAINS);
        }
        rechain(forged);
        expect(game.loadReplay(forged)).toBe(true); game.animationEnabled = false;
        while (game.replayCursor < at.index + 1 && !game.replayError) game.replayStep(true);
        expect(game.replayDiagnostic).toMatchObject({ command: at.index + 1, domain: 'actorActions', precision: 'exact',
            interval: { fromCommand: at.index + 1, toCommand: at.index + 1 } });
        expect(game.replayError).toContain(`command ${at.index + 1}`);
        expect(game.replayError).toContain('domain actorActions');
    }, 120_000);
});
