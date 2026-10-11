import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { captureNatural, digest, type Trace } from './support/combat2Natural';
import { rows, mechanical, start, acknowledge, observe, clone, state } from './support/combat2Harness';
import type { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { validateNaturalPersistence } from './support/combat2Persistence';

const out = '/tmp/combat2-evidence/natural';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
it('C2-NAT bounded original-world capture or complete compact-trace replay', () => {
    mkdirSync(out, { recursive: true });
    if (process.env.COMBAT2_CAPTURE === '1') {
        const goals = { player: new Set<string>(), npc: new Set<string>(), parry: false, evasion: false, giant: false, growth: false };
        const summaries: unknown[] = [], kept: Trace[] = [];
        const firstSeed = Number(process.env.COMBAT2_FIRST_SEED ?? 1), lastSeed = Number(process.env.COMBAT2_LAST_SEED ?? 128);
        if (firstSeed > 1) summaries.push(...JSON.parse(readFileSync(`${out}/first-search.json`, 'utf8')));
        if (firstSeed > 1) for (const trace of JSON.parse(readFileSync('src/ext/modules/combat/tests/fixtures/combat2-natural.json', 'utf8')) as Trace[]) {
            kept.push(trace);
            for (const hit of trace.hits) if (hit.sourceId === 1 && hit.damage > 0 && hit.attackId
                && trace.births.some(birth => birth.id === hit.targetId && (birth.birth as { creationReason: string }).creationReason === 'natural')) goals.player.add(hit.attackId);
            for (const release of trace.releases) if (trace.births.some(birth => birth.id === release.sourceId
                && (birth.birth as { creationReason: string }).creationReason === 'natural'
                && rows.some(row => row.monster === birth.type && `combat.${row.id}` === release.attackId))) goals.npc.add(release.attackId);
            goals.parry ||= trace.parries.length > 0;
            goals.evasion ||= trace.evasion.some(evasion => trace.releases.some(release => release.actionId === evasion.actionId
                && rows.some(row => release.attackId === `combat.${row.id}`)));
        }
        for (let seed = firstSeed; seed <= lastSeed; seed++) {
            const before = `${goals.player.size}/${goals.npc.size}/${goals.parry}/${goals.evasion}`;
            const result = captureNatural(seed, 'wizard', ['combat'], goals);
            writeFileSync(`${out}/seed-${seed}.recording.json`, JSON.stringify(result.recording));
            writeFileSync(`${out}/seed-${seed}.trace.json`, JSON.stringify(result.trace));
            const after = `${goals.player.size}/${goals.npc.size}/${goals.parry}/${goals.evasion}`;
            summaries.push({ seed, reason: result.trace.reason, depth: result.trace.depth, commands: result.trace.commands, before, after });
            writeFileSync(`${out}/search.json`, JSON.stringify(summaries, null, 2));
            console.info(JSON.stringify(summaries[summaries.length - 1]));
            if (after !== before) kept.push(result.trace);
            if (goals.player.size === 5 && goals.npc.size === 5 && goals.parry && goals.evasion) break;
        }
        writeFileSync('src/ext/modules/combat/tests/fixtures/combat2-natural.json', JSON.stringify(kept, null, 2) + '\n');
        if (process.env.COMBAT2_PROBE === '1') return;
        expect([...goals.player].sort()).toEqual(rows.map(row => `combat.${row.id}`).sort());
        expect([...goals.npc].sort()).toEqual(rows.map(row => `combat.${row.id}`).sort());
        expect(goals.parry).toBe(true); expect(goals.evasion).toBe(true);
        return;
    }
    const traces: Trace[] = JSON.parse(readFileSync('src/ext/modules/combat/tests/fixtures/combat2-natural.json', 'utf8'));
    const player = new Set<string>(), npc = new Set<string>(); let parry = false, evasion = false;
    for (const trace of traces) {
        const { game, zero } = start(trace.modules, trace.seed, trace.mode), observation = observe(game);
        const keys = new Map<number, { snapshot: ReturnType<typeof mechanical>; save: ReturnType<Game['toSaveSnapshot']> }>();
        keys.set(trace.prefix, { snapshot: mechanical(game), save: clone(game.toSaveSnapshot()) });
        const boundaries: unknown[] = [];
        expect(game.exportRecording().extensions).toEqual(trace.identity);
        expect(digest(mechanical(game))).toBe(trace.checkpoints[trace.prefix]);
        for (const input of trace.inputs) {
            acknowledge(); game.executeCommand(input.action, input.data);
            if (game.pendingCommandConfirmation) game.resolveCommandDecision(game.pendingCommandConfirmation.token, true);
            expect(game.lastAdvancementError).toBeNull(); expect(digest(mechanical(game))).toBe(trace.checkpoints[input.index]);
            if (trace.keyIndices.includes(input.index)) {
                keys.set(input.index, { snapshot: mechanical(game), save: clone(game.toSaveSnapshot()) });
                boundaries.push({ index: input.index, actorActions: clone(game.actorActions), combat: clone(state(game)) });
            }
        }
        expect(observation.hits).toEqual(trace.hits); expect(observation.releases).toEqual(trace.releases); expect(observation.parries).toEqual(trace.parries); observation.restore();
        const recording = clone(game.exportRecording());
        writeFileSync(`${out}/seed-${trace.seed}.boundaries.json`, JSON.stringify(boundaries, null, 2));
        const result = validateNaturalPersistence({ game, trace, recording, keys, zero });
        writeFileSync(`${out}/seed-${trace.seed}.verified.json`, JSON.stringify(result, null, 2));
        for (const hit of trace.hits) if (hit.sourceId === game.player.id && hit.damage > 0 && hit.attackId
            && trace.births.some(birth => birth.id === hit.targetId && (birth.birth as { creationReason: string }).creationReason === 'natural')) player.add(hit.attackId);
        for (const release of trace.releases) if (trace.births.some(birth => birth.id === release.sourceId
            && (birth.birth as { creationReason: string }).creationReason === 'natural'
            && rows.some(row => row.monster === birth.type && `combat.${row.id}` === release.attackId))) npc.add(release.attackId);
        parry ||= trace.parries.length > 0;
        evasion ||= trace.evasion.some(entry => trace.releases.some(release => release.actionId === entry.actionId
            && rows.some(row => release.attackId === `combat.${row.id}`)));
    }
    expect([...player].sort()).toEqual(rows.map(row => `combat.${row.id}`).sort());
    expect([...npc].sort()).toEqual(rows.map(row => `combat.${row.id}`).sort()); expect(parry).toBe(true); expect(evasion).toBe(true);
}, 1800000);
it('C2-NAT normal short genuine new-hit and complete persistence', () => {
    const goals = { player: new Set<string>(), npc: new Set(rows.map(row => `combat.${row.id}`)), parry: true, evasion: true, giant: false, growth: false };
    const result = captureNatural(1, 'normal', ['combat'], goals, 150, 'normal');
    mkdirSync(out, { recursive: true });
    writeFileSync(`${out}/normal.recording.json`, JSON.stringify(result.recording));
    writeFileSync(`${out}/normal.trace.json`, JSON.stringify(result.trace, null, 2));
    expect(result.trace.hits.some(hit => hit.sourceId === result.game.player.id && hit.damage > 0 && hit.attackId?.startsWith('combat.'))).toBe(true);
    expect(result.trace.births.some(birth => (birth.birth as { creationReason: string }).creationReason === 'natural')).toBe(true);
    const persistence = validateNaturalPersistence(result);
    writeFileSync(`${out}/normal.result.json`, JSON.stringify(persistence, null, 2));
}, 120000);
