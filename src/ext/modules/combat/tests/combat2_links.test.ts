import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { captureNatural, digest, type Trace } from './support/combat2Natural';
import { validateNaturalPersistence } from './support/combat2Persistence';
import { rows, start, mechanical, play, observe, clone } from './support/combat2Harness';
import { logger } from '../../../../engine/Systems/Logger';
import { readCreatureBirth } from '../../../birth';
import type { Game } from '../../../../engine/Core/Game';

const out = '/tmp/combat2-evidence/links', fixture = 'src/ext/modules/combat/tests/fixtures/combat2-links.json';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
it('C2-NAT optional giants target and public growth skill share a genuine origin and complete persistence', () => {
    mkdirSync(out, { recursive: true });
    if (process.env.COMBAT2_CAPTURE_LINK === '1') {
        const summaries: unknown[] = [];
        for (let seed = 1; seed <= 128; seed++) {
            const goals = { player: new Set(rows.map(row => `combat.${row.id}`)), npc: new Set(rows.map(row => `combat.${row.id}`)), parry: true, evasion: true, giant: false, growth: false };
            const result = captureNatural(seed, 'wizard', ['combat', 'giants', 'growth'], goals);
            writeFileSync(`${out}/${seed}.recording.json`, JSON.stringify(result.recording)); writeFileSync(`${out}/${seed}.trace.json`, JSON.stringify(result.trace));
            summaries.push({ seed, depth: result.trace.depth, reason: result.trace.reason, commands: result.trace.commands, giant: goals.giant, growth: goals.growth });
            writeFileSync(`${out}/search.json`, JSON.stringify(summaries, null, 2));
            if (goals.giant && goals.growth) { writeFileSync(fixture, JSON.stringify(result.trace, null, 2) + '\n');
                writeFileSync(`${out}/result.json`, JSON.stringify(validateNaturalPersistence(result), null, 2)); return; }
        }
        throw new Error('Natural giants/growth loop missing after bounded seeds 1..128; evidence retained outside repository');
    }
    const trace: Trace = JSON.parse(readFileSync(fixture, 'utf8'));
    const { game, zero } = start(trace.modules, trace.seed, trace.mode), observation = observe(game);
    expect(game.exportRecording().extensions).toEqual(trace.identity);
    const keys = new Map<number, { snapshot: ReturnType<typeof mechanical>; save: ReturnType<Game['toSaveSnapshot']> }>();
    keys.set(trace.prefix, { snapshot: mechanical(game), save: clone(game.toSaveSnapshot()) });
    expect(digest(mechanical(game))).toBe(trace.checkpoints[trace.prefix]);
    const births = new Map<number, string>();
    for (const input of trace.inputs) {
        for (const monster of game.monsters) if (readCreatureBirth(monster)?.creationReason === 'natural') births.set(monster.id, monster.typeId);
        play(game, input.action, input.data); expect(digest(mechanical(game))).toBe(trace.checkpoints[input.index]);
        if (trace.keyIndices.includes(input.index)) keys.set(input.index, { snapshot: mechanical(game), save: clone(game.toSaveSnapshot()) });
    }
    const giantHit = observation.hits.some(hit => hit.sourceId === game.player.id && hit.damage > 0
        && rows.some(row => hit.attackId === `combat.${row.id}`) && births.get(hit.targetId)?.startsWith('giants.'));
    expect(observation.hits).toEqual(trace.hits); expect(observation.releases).toEqual(trace.releases); expect(observation.parries).toEqual(trace.parries);
    const recording = clone(game.exportRecording()); expect(recording.events.length).toBe(trace.inputs[trace.inputs.length - 1]!.index);
    observation.restore();
    writeFileSync(`${out}/verified.json`, JSON.stringify(validateNaturalPersistence({ game, trace, recording, keys, zero }), null, 2));
    expect(giantHit).toBe(true);
    expect(trace.growth).toHaveLength(1); expect(trace.growth[0]!.focusBefore).not.toEqual(trace.growth[0]!.focusAfter);
}, 1800000);
