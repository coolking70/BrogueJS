import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import { rng } from '../../../../engine/Random';
import { logger } from '../../../../engine/Systems/Logger';
import { descriptor } from '../descriptor';
import { FOUNDATION_PROTOCOL, registryFromDescriptors } from '../../../descriptor';
import { getInstalledModuleDescriptors } from '../../../catalog';
import { installWorldFixtureRegistry } from '../../../world5Fixture';
import { createLootModule } from '../index';

// Save recording origins and command checkpoints also contain extensions. Only
// that named namespace is removed; every remaining field is compared unchanged.
function withoutExtensions(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutExtensions);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== 'extensions').map(([key, child]) => [key, withoutExtensions(child)]));
  return value;
}
function open(installed: boolean) {
  const game = createHeadlessGame(7201, 'test');
  if(!installed)installWorldFixtureRegistry(game,registryFromDescriptors(getInstalledModuleDescriptors().filter(d=>d.id!=='loot')));
  game.startNewGame({ seed: 7201, mode: 'test', ruleSet: 'extended', extensions: [] });
  game.animationEnabled = false;
  return game;
}
function acknowledge() { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); }
afterEach(() => vi.restoreAllMocks());
describe('loot default-off neutrality contract', () => {
  it('registers the integrated module, rejects inert state and defaults off without RNG', () => {
    const before=rng.getState(),module=createLootModule();
    expect(module.id).toBe('loot');expect(module.version).toBe('0.7.0');
    expect(module.initialState()).toMatchObject({v:2,presetId:'standard',created:false,revision:0});
    expect(module.validateState(module.initialState())).toBe(true);
    for(const invalid of [{},null,[],{extra:1},0,'',new Date()])expect(module.validateState(invalid)).toBe(false);
    expect(descriptor.defaultEnabled).toBe(false);expect(descriptor.foundation).toBe(FOUNDATION_PROTOCOL);
    expect(descriptor.rules).toEqual(module.rules);expect(rng.getState()).toEqual(before);
  });
  it('keeps all non-extension save fields and RNG identical through 36 commands, then loads/replays/seeks', () => {
    // A fixed wall clock removes only nondeterministic savedAt creation time.
    vi.spyOn(Date, 'now').mockReturnValue(1791302400000);
    const histories = [false, true].map(enabled => {
      const game = open(enabled);
      const states: ReturnType<typeof rng.getState>[] = [];
      for (let index = 0; index < 36; index++) {
        acknowledge();
        if (index % 6 === 0) game.executeCommand('move', { x: 1, y: 0 });
        else if (index % 6 === 1) game.executeCommand('move', { x: -1, y: 0 });
        else game.executeCommand(index % 3 === 0 ? 'search' : 'wait');
        states.push(structuredClone(rng.getState()));
      }
      return { states, save: structuredClone(game.toSaveSnapshot()), recording: structuredClone(game.exportRecording()) };
    });
    const plain = histories[0]!, loot = histories[1]!;
    expect(loot.recording.events.length).toBeGreaterThanOrEqual(24);
    expect(loot.states).toEqual(plain.states);
    expect(withoutExtensions(loot.save)).toEqual(withoutExtensions(plain.save));
    expect(loot.save.extensions!.modules.loot).toBeUndefined();
    expect(plain.save.extensions!.manifest.modules).toEqual([]);
    expect(loot.save.extensions!.manifest.modules.map(module => module.id)).toEqual([]);
    const loaded = createHeadlessGame(81, 'test');
    expect(loaded.loadSnapshot(loot.save)).toBe(true);
    expect(loaded.toSaveSnapshot()).toEqual(loot.save);
    const replay = createHeadlessGame(82, 'test');
    expect(replay.loadReplay(loot.recording)).toBe(true);
    replay.animationEnabled = false;
    for (const event of loot.recording.events) {
      replay.replayStep(true);
      expect(replay.replayError).toBeNull();
      expect(replay.replayCursor).toBe(event.index + 1);
      expect(rng.getState()).toEqual(event.rng);
      expect(replay.replayError).toBeNull(); // recording4 uses digest/checkpoint validation, not per-event extension snapshots.
    }
    expect(replay.replayStatus).toBe('finished');
    for (const cursor of [0, 1, Math.floor(loot.recording.events.length / 2), loot.recording.events.length]) {
      replay.replaySeek(cursor);
      expect(replay.replayError).toBeNull(); expect(replay.replayCursor).toBe(cursor);
    }
  }, 30000);
});
