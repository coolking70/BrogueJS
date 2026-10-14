import { missingPackages, verifyInstalledPackageFallback } from '../../../../test/support/optionalPackageLifecycle';
import { afterEach, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { start, play, mechanical, clone, state } from './support/combat2Harness';
import { logger } from '../../../../engine/Systems/Logger';
import fixture from './fixtures/combat2-sdk-seed23.json';
import secondFixture from './fixtures/combat2-sdk-seed118.json';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });
it('C2-SDK natural seed23 must preserve metadata and scheduler ownership', () => {
    mkdirSync('/tmp/combat2-evidence/natural', { recursive: true });
    const { game, initialCommands } = start(fixture.modules, fixture.seed, 'wizard');
    expect(initialCommands).toEqual(fixture.initialCommands);
    for (const input of fixture.inputs) play(game, input.action, input.data);
    writeFileSync('/tmp/combat2-evidence/natural/seed23-before-failure.save.json', JSON.stringify(game.toSaveSnapshot()));
    writeFileSync('/tmp/combat2-evidence/natural/seed23-before-failure.recording.json', JSON.stringify(game.exportRecording()));
    const before = mechanical(game);
    try { play(game, fixture.attempted.action, fixture.attempted.data); }
    catch (error) {
        writeFileSync('/tmp/combat2-evidence/natural/seed23-public-reproduction.json', JSON.stringify({ error: String(error),
            before, after: { actorActions: clone(game.actorActions), combat: clone(state(game)), depth: game.depth,
                player: { hp: game.player.hp, x: game.player.x, y: game.player.y }, isGameOver: game.isGameOver } }));
        throw error;
    }
}, 180000);

it(missingPackages(secondFixture.modules).length ? 'C2-SDK seed118 dependencies absent: remaining-world lifecycle and genuine seven-pack save/replay rejection' : 'C2-SDK natural seed118 death capture must preserve valid growth state', () => {
    const out = '/tmp/combat2-evidence/natural/seed118';
    if (missingPackages(secondFixture.modules).length) { verifyInstalledPackageFallback(secondFixture.modules); return; }
    const { game, initialCommands } = start(secondFixture.modules, secondFixture.seed, 'wizard');
    expect(initialCommands).toEqual(secondFixture.initialCommands);
    for (const input of secondFixture.inputs) play(game, input.action, input.data);
    writeFileSync(`${out}-before-failure.save.json`, JSON.stringify(game.toSaveSnapshot()));
    writeFileSync(`${out}-before-failure.recording.json`, JSON.stringify(game.exportRecording()));
    const before = mechanical(game);
    try { play(game, secondFixture.attempted.action, secondFixture.attempted.data); }
    catch (error) {
        writeFileSync(`${out}-public-reproduction.json`, JSON.stringify({ error: String(error), before,
            after: { actorActions: clone(game.actorActions), combat: clone(state(game)), depth: game.depth,
                player: { hp: game.player.hp, x: game.player.x, y: game.player.y }, isGameOver: game.isGameOver } }));
        throw error;
    }
}, 180000);
