import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { captureNatural } from './support/combat2Natural';
import { validateNaturalPersistence } from './support/combat2Persistence';
import { rows, state } from './support/combat2Harness';
import { logger } from '../../../../engine/Systems/Logger';

import { installedRelatedCombinations } from '../../../../test/support/optionalPackageLifecycle';

const combinations = installedRelatedCombinations('combat', ['crafting', 'foraging', 'giants', 'growth', 'narrative', 'settlement']);
afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
describe(`C2-COMBO ${combinations.length === 9 ? 'nine' : combinations.length} related genuine new-game installations`, () => {
    it.each(combinations.map((modules, index) => ({ modules, index, label: modules.join('+') || 'none' })))('$label verifies new attacks, genuine hit, save suffix, replay, seek and continued origin', ({ modules, index }) => {
        const goals = { player: new Set<string>(), npc: new Set<string>(), parry: true, evasion: true, giant: false, growth: false };
        const result = captureNatural(1, 'wizard', modules, goals, 300, 'combination');
        const directory = '/tmp/combat2-evidence/combinations'; mkdirSync(directory, { recursive: true });
        writeFileSync(`${directory}/${index}.recording.json`, JSON.stringify(result.recording));
        writeFileSync(`${directory}/${index}.trace.json`, JSON.stringify(result.trace, null, 2));
        expect(result.game.isGameOver).toBe(false);
        if (modules.includes('combat')) {
            expect(state(result.game).schema).toBe(4);
            for (const row of rows) expect(result.trace.inputs.some(input => typeof input.data === 'string' && input.data.includes(`"attackId":"combat.${row.id}"`))).toBe(true);
            expect(result.trace.hits.some(hit => hit.sourceId === result.game.player.id && hit.damage > 0 && hit.attackId?.startsWith('combat.'))).toBe(true);
        } else { expect(result.game.extensionRuntime!.readModuleView('combat')).toBeNull(); expect(result.game.extensionRuntime!.actorActionBinding()).toBeNull(); }
        if (modules.includes('growth')) { expect(goals.growth).toBe(true); expect(result.trace.growth.length).toBe(1); }
        const persistence = validateNaturalPersistence(result);
        writeFileSync(`${directory}/${index}.result.json`, JSON.stringify({ modules, seed: 1, mode: 'wizard', identity: result.recording.extensions, trace: { events: result.recording.events.length,
            tick: result.trace.tick, bytes: result.trace.recordingBytes, reason: result.trace.reason, commands: result.trace.commands }, persistence }, null, 2));
    }, 180000);
});
