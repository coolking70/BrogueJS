import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { start, mechanical, play, observe, clone, state } from './support/combat2Harness';
import { digest, dirs, type Trace } from './support/combat2Natural';
import { validateNaturalPersistence } from './support/combat2Persistence';
import { readPublicCombatTelegraphs, type DisplayTelegraph } from '../../../../ui/combatDrawing';
import { productionActorActionScheduler } from '../../../../engine/Core/ActorActionProduction';
import { readCreatureBirth } from '../../../birth';
import { cellTerrainFlags } from '../../../../engine/Map/DungeonFeature';
import { T_PATHING_BLOCKER, T_LAVA_INSTA_DEATH, T_IS_DEEP_WATER, T_AUTO_DESCENT } from '../../../../engine/Map/TerrainCatalog';
import { footprintOf } from '../../../../engine/Movement/CreatureSpatial';
import { canDirectlySeeMonster } from '../../../../engine/UI/MonsterVisibility';
import { logger } from '../../../../engine/Systems/Logger';
import type { Game } from '../../../../engine/Core/Game';

const out = '/tmp/combat2-evidence/evasion', fixture = 'src/ext/modules/combat/tests/fixtures/combat2-evasion.json';
const orderedCells = (cells: readonly { x: number; y: number }[]) => [...cells].sort((a, b) => a.y - b.y || a.x - b.x);
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
it('C2-NAT an original seed3 public prefix evades a new warning and preserves its complete origin', () => {
    mkdirSync(out, { recursive: true });
    const capturing = process.env.COMBAT2_CAPTURE_EVASION === '1';
    const reference: Trace = capturing
        ? (JSON.parse(readFileSync('src/ext/modules/combat/tests/fixtures/combat2-natural.json', 'utf8')) as Trace[]).find(trace => trace.seed === 3)!
        : JSON.parse(readFileSync(fixture, 'utf8'));
    const { game, initialCommands, zero } = start(reference.modules, reference.seed, reference.mode), observation = observe(game);
    const trace: Trace = { seed: reference.seed, mode: reference.mode, modules: reference.modules, initialCommands,
        prefix: game.recordedInputEvents.length, identity: clone(game.exportRecording().extensions), inputs: [],
        checkpoints: { 0: digest(zero), [game.recordedInputEvents.length]: digest(mechanical(game)) }, keyIndices: [], births: [],
        hits: [], releases: [], parries: [], evasion: [], growth: [], reason: '', commands: 0, depth: game.depth, tick: 0,
        finalRng: null, recordingBytes: 0 };
    const keys = new Map<number, { snapshot: ReturnType<typeof mechanical>; save: ReturnType<Game['toSaveSnapshot']> }>();
    const remember = () => { const index = game.recordedInputEvents.length; trace.keyIndices.push(index);
        keys.set(index, { snapshot: mechanical(game), save: clone(game.toSaveSnapshot()) }); };
    const execute = (action: string, data?: unknown) => {
        play(game, action, data); trace.commands++;
        const index = game.recordedInputEvents.length; trace.inputs.push({ action, data, index });
        trace.checkpoints[index] = digest(mechanical(game));
        for (const monster of game.monsters) if (!trace.births.some(birth => birth.id === monster.id)) {
            const birth = readCreatureBirth(monster);
            if (birth) trace.births.push({ id: monster.id, depth: game.depth, type: monster.typeId, birth: clone(birth) });
        }
    };
    let pending: DisplayTelegraph | undefined;
    const atRelease: { actionId: number; sourceId: number; cells: { x: number; y: number }[]; player: { x: number; y: number } }[] = [];
    const scheduler = productionActorActionScheduler(game)!, dispatch = scheduler.dispatchActorBoundary;
    scheduler.dispatchActorBoundary = owner => {
        const bundle = game.actorActions!.bundles.find(bundle => bundle.actionId === pending?.actionId && bundle.decisionOwnerId === owner);
        const child = bundle?.subactions.find(child => child.sourceEntityId === pending?.sourceEntityId && child.phaseRemainingTicks === 0);
        const sub = child && state(game).actions.find(action => action.actionId === bundle!.actionId)?.subactions.find(sub => sub.sourceSubactionId === child.sourceSubactionId);
        if (pending && child && sub && JSON.stringify(orderedCells(sub.lockedCells)) === JSON.stringify(orderedCells(pending.cells))) {
            atRelease.push({ actionId: bundle!.actionId, sourceId: child.sourceEntityId, cells: clone(sub.lockedCells), player: { ...game.player.loc } });
        }
        return dispatch(owner);
    };
    try {
        remember();
        for (const input of reference.inputs) {
            const warnings = readPublicCombatTelegraphs(game);
            const warning = warnings.find(warning => warning.cells.some(cell => cell.x === game.player.x && cell.y === game.player.y)
                && game.monsters.some(monster => monster.id === warning.sourceEntityId && ['jackal', 'monkey', 'goblin', 'toad', 'zombie'].includes(monster.typeId)
                    && canDirectlySeeMonster(game.player, game.grid, monster)));
            if (capturing && warning) {
                const legal = (x: number, y: number) => !!game.grid.getCell(x, y)?.isPassable
                    && !(cellTerrainFlags(game.grid, x, y) & (T_PATHING_BLOCKER | T_LAVA_INSTA_DEATH | T_IS_DEEP_WATER | T_AUTO_DESCENT));
                const direction = dirs.find(dir => {
                    const x = game.player.x + dir.x, y = game.player.y + dir.y;
                    return legal(x, y) && (!dir.x || !dir.y || (legal(game.player.x + dir.x, game.player.y) && legal(game.player.x, game.player.y + dir.y)))
                        && !warning.cells.some(cell => cell.x === x && cell.y === y)
                        && !game.monsters.some(monster => canDirectlySeeMonster(game.player, game.grid, monster) && footprintOf(monster).some(cell => cell.x === x && cell.y === y));
                });
                if (direction) {
                    remember(); pending = warning; const from = { ...game.player.loc };
                    execute('move', { x: direction.x, y: direction.y });
                    trace.evasion.push({ actionId: warning.actionId, index: game.recordedInputEvents.length, cells: clone([...warning.cells]), from, to: { ...game.player.loc } });
                    for (let wait = 0; wait < 2 && !atRelease.length; wait++) execute('wait');
                    break;
                }
            }
            if (!capturing && reference.evasion.some(evasion => evasion.index === input.index)) {
                const evasion = reference.evasion.find(evasion => evasion.index === input.index)!;
                pending = warnings.find(warning => warning.actionId === evasion.actionId);
                expect(pending).toBeTruthy(); expect(orderedCells(pending!.cells)).toEqual(orderedCells(evasion.cells)); remember();
                trace.evasion.push(clone(evasion));
            }
            execute(input.action, input.data);
            expect(trace.checkpoints[input.index]).toBe(reference.checkpoints[input.index]);
        }
        remember(); trace.depth = game.depth; trace.tick = mechanical(game).run.currentTick; trace.finalRng = mechanical(game).rngState;
        trace.hits = clone(observation.hits); trace.releases = clone(observation.releases); trace.parries = clone(observation.parries);
        trace.reason = 'fixed-natural-prefix-new-warning-evasion';
        const recording = clone(game.exportRecording()); trace.recordingBytes = Buffer.byteLength(JSON.stringify(recording));
        writeFileSync(`${out}/recording.json`, JSON.stringify(recording)); writeFileSync(`${out}/at-release.json`, JSON.stringify(atRelease, null, 2));
        if (capturing) writeFileSync(fixture, JSON.stringify(trace) + '\n');
        expect(trace.evasion).toHaveLength(1); expect(atRelease.length).toBeGreaterThan(0);
        const proof = atRelease[0]!;
        expect(proof.cells.some(cell => cell.x === proof.player.x && cell.y === proof.player.y)).toBe(false);
        expect(trace.releases.some(release => release.actionId === proof.actionId && release.attackId.startsWith('combat.'))).toBe(true);
        expect(trace.births.some(birth => birth.id === proof.sourceId && (birth.birth as { creationReason: string }).creationReason === 'natural')).toBe(true);
        const persistence = validateNaturalPersistence({ game, trace, recording, keys, zero });
        writeFileSync(`${out}/result.json`, JSON.stringify(persistence, null, 2));
    } finally { scheduler.dispatchActorBoundary = dispatch; observation.restore(); }
}, 180000);
