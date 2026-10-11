import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { start, arena, add, rows, play, attackCommand, mechanical, clone } from './support/combat2Harness';
import { installRecordingScene, continuingPrefix } from '../../../../test/support/recordingV4';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { createCombatModuleFromPack } from '../module';
import { loadCombatPack } from '../schema';
import type { CombatPack } from '../types';
import base from './fixtures/combat2-base.json';
import baseLocale from './fixtures/combat2-base-locale.json';
import { logger } from '../../../../engine/Systems/Logger';
import type { ProductionActorAttackState } from '../../../actorActions';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
describe('C2-PERSIST exact new stages and recorded provenance', () => {
    it('diagnostic five real commands save/load, full replay, nonmonotonic seek and continuation', () => {
        installRecordingScene(game => { if (game.extensionRuntime?.actorActionBinding()) { arena(game); add(game, 21, 15); add(game, 22, 15); add(game, 23, 15); } });
        const { game, zero } = start(), expected = [mechanical(game)], saves: ReturnType<Game['toSaveSnapshot']>[] = [];
        for (const row of rows) { play(game, 'ext:command', attackCommand(`combat.${row.id}`)); expected.push(mechanical(game)); saves.push(clone(game.toSaveSnapshot())); }
        const recording = clone(game.exportRecording()), prefix = recording.events.length - rows.length;
        const replay = createHeadlessGame(401, 'test'); expect(replay.loadReplay(recording)).toBe(true); replay.animationEnabled = false;
        expect(mechanical(replay)).toEqual(zero);
        while (replay.replayCursor < prefix) replay.replayStep(true);
        expect(mechanical(replay)).toEqual(expected[0]);
        for (let i = 1; i < expected.length; i++) { replay.replayStep(true); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(expected[i]); }
        for (const index of [recording.events.length, 0, prefix + 3, prefix + 1, recording.events.length]) {
            replay.replaySeek(index); expect(replay.replayError).toBeNull(); expect(mechanical(replay)).toEqual(index === 0 ? zero : expected[index - prefix]);
        }
        for (const [index, save] of saves.entries()) {
            const loaded = createHeadlessGame(402, 'test'); expect(loaded.loadSnapshot(save)).toBe(true); loaded.animationEnabled = false; loaded.onConfirmRequest = () => true;
            expect(mechanical(loaded)).toEqual(expected[index + 1]);
            for (const row of rows.slice(index + 1)) play(loaded, 'ext:command', attackCommand(`combat.${row.id}`));
            expect(mechanical(loaded)).toEqual(expected[5]); expect(loaded.exportRecording().events).toEqual(recording.events);
        }
        const loaded = createHeadlessGame(403, 'test'); expect(loaded.loadSnapshot(saves[2]!)).toBe(true); loaded.animationEnabled = false; loaded.onConfirmRequest = () => true;
        for (const row of rows.slice(3)) play(loaded, 'ext:command', attackCommand(`combat.${row.id}`)); play(loaded, 'wait');
        const continued = loaded.exportRecording(), final = mechanical(loaded);
        expect(continued.events.slice(0, recording.events.length)).toEqual(continuingPrefix(recording));
        const whole = createHeadlessGame(404, 'test'); expect(whole.loadReplay(continued)).toBe(true); whole.animationEnabled = false;
        while (whole.replayCursor < continued.events.length) { whole.replayStep(true); expect(whole.replayError).toBeNull(); }
        expect(mechanical(whole)).toEqual(final);
    }, 120000);
    it('rejects the genuine preimplementation old fingerprint and genuine new inputs when combat is unavailable without retiring live state', () => {
        // The externally preserved capture was made before changing production.
        // A standalone checkout can recreate an equivalent genuine old input
        // through the loader/factory and unchanged engine origin path.
        const legacy = createCombatModuleFromPack(loadCombatPack(base as unknown as CombatPack, baseLocale));
        const descriptors = catalog.getInstalledModuleDescriptors();
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registryFromDescriptors(descriptors.map(descriptor => descriptor.id === 'combat'
            ? { ...descriptor, rules: legacy.rules, create: () => legacy } : descriptor)));
        const old = start().game; play(old, 'ext:command', attackCommand('fixture.slash'));
        let oldSave = clone(old.toSaveSnapshot()), oldRecording = clone(old.exportRecording());
        if (process.env.COMBAT2_PREIMPLEMENTATION === '1') {
            oldSave = JSON.parse(readFileSync('/tmp/combat2-evidence/legacy/save.json', 'utf8'));
            oldRecording = JSON.parse(readFileSync('/tmp/combat2-evidence/legacy/recording.json', 'utf8'));
        }
        vi.restoreAllMocks(); const current = start().game; play(current, 'ext:command', attackCommand('combat.anchor-break'));
        const newSave = clone(current.toSaveSnapshot()), newRecording = clone(current.exportRecording());
        const retainedPlayer = current.player, retainedRuntime = current.extensionRuntime;
        const reject = (save: typeof oldSave, recording: typeof oldRecording) => {
            const before = mechanical(current); expect(current.loadSnapshot(save)).toBe(false); expect(current.loadReplay(recording)).toBe(false);
            expect(current.player).toBe(retainedPlayer); expect(current.extensionRuntime).toBe(retainedRuntime); expect(mechanical(current)).toEqual(before);
        };
        reject(oldSave, oldRecording);
        vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registryFromDescriptors(descriptors.filter(descriptor => descriptor.id !== 'combat')));
        reject(newSave, newRecording);
    }, 60000);
    it('rejects bad current lock cells, stage index, profile, mirror and budget with complete preservation', () => {
        const { game } = start(); arena(game); const npc = add(game, 21, 15, 'jackal'); npc.ticksUntilTurn = 1;
        play(game, 'wait'); const saved = clone(game.toSaveSnapshot());
        expect(saved.run.actorActions!.bundles.length).toBeGreaterThan(0);
        const edits = [
            (save: typeof saved) => { (save.extensions!.modules.combat as unknown as ProductionActorAttackState).actions[0]!.subactions[0]!.lockedCells.push({ x: 9999, y: 9999 }); },
            (save: typeof saved) => { save.run.actorActions!.bundles[0]!.subactions[0]!.phaseIndex = 99; },
            (save: typeof saved) => { (save.extensions!.modules.combat as unknown as ProductionActorAttackState).actions[0]!.subactions[0]!.profileId = 'fixture.profile'; },
            (save: typeof saved) => { save.run.actorActions!.bundles[0]!.subactions[0]!.phaseRemainingTicks++; },
            (save: typeof saved) => { save.run.actorActions!.bundles[0]!.subactions.push(...Array.from({ length: 4 }, () => clone(save.run.actorActions!.bundles[0]!.subactions[0]!))); },
        ];
        for (const edit of edits) { const bad = clone(saved); edit(bad); const before = mechanical(game), player = game.player, runtime = game.extensionRuntime;
            expect(game.loadSnapshot(bad)).toBe(false); expect(mechanical(game)).toEqual(before); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime); }
    });
});
