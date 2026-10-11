import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { start, mechanical, play, observe, clone, state } from './support/combat2Harness';
import { digest, route, type Trace } from './support/combat2Natural';
import { validateNaturalPersistence } from './support/combat2Persistence';
import { TerrainType } from '../../../../engine/Map/Grid';
import { readCreatureBirth } from '../../../birth';
import { logger } from '../../../../engine/Systems/Logger';
import type { Game } from '../../../../engine/Core/Game';

const out = '/tmp/combat2-evidence/revisit', fixture = 'src/ext/modules/combat/tests/fixtures/combat2-revisit.json';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
it('C2-PERSIST fixed original seed1 walks to real stairs and revisits the cached level', () => {
    mkdirSync(out, { recursive: true });
    const capturing = process.env.COMBAT2_CAPTURE_REVISIT === '1';
    const reference: Trace = capturing
        ? (JSON.parse(readFileSync('src/ext/modules/combat/tests/fixtures/combat2-natural.json', 'utf8')) as Trace[]).find(trace => trace.seed === 1)!
        : JSON.parse(readFileSync(fixture, 'utf8'));
    const { game, initialCommands, zero } = start(reference.modules, reference.seed, reference.mode), observation = observe(game);
    if (!capturing) expect(game.exportRecording().extensions).toEqual(reference.identity);
    const trace: Trace = { seed: reference.seed, mode: reference.mode, modules: reference.modules, initialCommands,
        prefix: game.recordedInputEvents.length, identity: clone(game.exportRecording().extensions), inputs: [],
        checkpoints: { 0: digest(zero), [game.recordedInputEvents.length]: digest(mechanical(game)) }, keyIndices: [], births: [],
        hits: [], releases: [], parries: [], evasion: [], growth: [], reason: 'fixed-original-prefix-real-stair-revisit', commands: 0,
        depth: game.depth, tick: 0, finalRng: null, recordingBytes: 0 };
    const keys = new Map<number, { snapshot: ReturnType<typeof mechanical>; save: ReturnType<Game['toSaveSnapshot']> }>();
    const remember = () => { const index = game.recordedInputEvents.length; trace.keyIndices.push(index);
        keys.set(index, { snapshot: mechanical(game), save: clone(game.toSaveSnapshot()) }); };
    const transitions: { index: number; from: number; to: number }[] = [];
    let lastMechanical = mechanical(game);
    const execute = (action: string, data?: unknown) => {
        const before = game.depth; play(game, action, data); trace.commands++;
        const index = game.recordedInputEvents.length; trace.inputs.push({ action, data, index }); lastMechanical = mechanical(game);
        trace.checkpoints[index] = digest(lastMechanical);
        if (before !== game.depth) { transitions.push({ index, from: before, to: game.depth }); remember(); }
        for (const monster of game.monsters) if (!trace.births.some(birth => birth.id === monster.id)) {
            const birth = readCreatureBirth(monster); if (birth) trace.births.push({ id: monster.id, depth: game.depth, type: monster.typeId, birth: clone(birth) });
        }
    };
    try {
        remember();
        if (capturing) {
            for (const input of reference.inputs) {
                execute(input.action, input.data); expect(trace.checkpoints[input.index]).toBe(reference.checkpoints[input.index]);
                if (game.depth === 2) break;
            }
            expect(game.depth).toBe(2); remember();
            const cachedIds = new Set(game.monsters.map(monster => monster.id));
            const travel = (targetDepth: number, terrain: TerrainType, action: string) => {
                for (let step = 0; step < 50 && game.depth !== targetDepth; step++) {
                    let stairs: { x: number; y: number } | undefined;
                    for (let y = 0; y < game.grid.height; y++) for (let x = 0; x < game.grid.width; x++) {
                        if (game.grid.getCell(x, y)!.layers.includes(terrain)) stairs = { x, y };
                    }
                    expect(stairs).toBeTruthy(); const path = route(game, stairs!); expect(path).not.toBeNull();
                    if (!path!.length) execute(action); else execute('move', { x: path![0]!.x, y: path![0]!.y });
                }
                expect(game.depth).toBe(targetDepth); remember();
            };
            travel(1, TerrainType.STAIRS_UP, 'stairs_up');
            const frozenBefore = clone(state(game).actors.filter(actor => cachedIds.has(actor.actorId)));
            execute('wait');
            const frozenAfter = clone(state(game).actors.filter(actor => cachedIds.has(actor.actorId)));
            writeFileSync(`${out}/cached-resource-rows.json`, JSON.stringify({ frozenBefore, frozenAfter }, null, 2));
            expect(frozenAfter).toEqual(frozenBefore);
            travel(2, TerrainType.STAIRS_DOWN, 'stairs_down');
        } else {
            for (const input of reference.inputs) {
                execute(input.action, input.data); expect(trace.checkpoints[input.index]).toBe(reference.checkpoints[input.index]);
                if (reference.keyIndices.includes(input.index)) remember();
            }
        }
        remember(); trace.depth = game.depth; trace.tick = mechanical(game).run.currentTick; trace.finalRng = mechanical(game).rngState;
        trace.hits = clone(observation.hits); trace.releases = clone(observation.releases); trace.parries = clone(observation.parries);
        const recording = clone(game.exportRecording()); trace.recordingBytes = Buffer.byteLength(JSON.stringify(recording));
        writeFileSync(`${out}/recording.json`, JSON.stringify(recording)); writeFileSync(`${out}/transitions.json`, JSON.stringify(transitions, null, 2));
        if (capturing) writeFileSync(fixture, JSON.stringify(trace) + '\n');
        expect(transitions.some(transition => transition.from === 2 && transition.to === 1)).toBe(true);
        expect(transitions.some(transition => transition.from === 1 && transition.to === 2 && transition.index > transitions.find(transition => transition.to === 1)!.index)).toBe(true);
        writeFileSync(`${out}/result.json`, JSON.stringify(validateNaturalPersistence({ game, trace, recording, keys, zero }), null, 2));
    } catch (error) {
        if (capturing) {
            trace.depth = lastMechanical.depth; trace.tick = lastMechanical.run.currentTick; trace.finalRng = lastMechanical.rngState;
            trace.hits = clone(observation.hits); trace.releases = clone(observation.releases); trace.parries = clone(observation.parries);
            trace.reason = 'fixed-original-prefix-revisit-incomplete'; writeFileSync(fixture, JSON.stringify(trace) + '\n');
        }
        writeFileSync(`${out}/failure.json`, JSON.stringify({ error: String(error), inputs: trace.inputs, transitions })); throw error;
    } finally { observation.restore(); }
}, 180000);
