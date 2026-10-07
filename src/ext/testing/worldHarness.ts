/** Real engine adapter. No mocked clocks, commands, persistence or replay. */
import i18next from 'i18next';
import { Game } from '../../engine/Core/Game';
import { mechanicalDigest } from '../../engine/Core/RecordingDigest';
import { deepFreeze } from '../../engine/Movement/SpatialSchema';
import { getInstalledModuleDescriptors } from '../catalog';
import { registryFromDescriptors } from '../descriptor';
import { installWorldFixtureRegistry } from '../world5Fixture';
import { readWorkContext } from '../../engine/Core/WorldWorkWorld';
import { worldWorkLastError } from '../../engine/Core/WorldWork';
import { descriptor as skeleton } from './fixtures/craftingSkeleton';
import { descriptor as basic } from './fixtures/worldWorkBasic';
import type { WorldHarnessOptions, WorldHarness } from '../worldSdk';
const games = new WeakMap<WorldHarness, Game>();
export const worldHarnessGame = (h: WorldHarness): Game => {
  const game = games.get(h);
  if (!game) throw new Error('Unknown harness');
  return game;
};
export function createWorldHarness(options: WorldHarnessOptions, overrides:readonly import('../descriptor').ModuleDescriptor[]=[]): WorldHarness {
  if (!import.meta.env.DEV) throw new Error('World harness unavailable');
  if (!i18next.isInitialized)
    i18next.init({ lng: 'en', fallbackLng: false, resources: {}, initImmediate: false });
  const descriptors = [...getInstalledModuleDescriptors(), skeleton, basic].map(d=>overrides.find(o=>o.id===d.id)??d),
    registry = registryFromDescriptors(descriptors);
  const ids = [...options.modules];
  if (options.fixtures?.includes('crafting-skeleton') && !ids.includes('craftskel'))
    ids.push('craftskel');
  if (options.fixtures?.includes('world-work-basic') && !ids.includes('c5fixture'))
    ids.push('c5fixture');
  const initialCommands = registry
    .create(registry.manifest(ids))
    .flatMap((m) =>
      m.initialCommand ? [JSON.stringify({ module: m.id, ...m.initialCommand })] : []
    );
  const game = new Game();
  installWorldFixtureRegistry(game, registry);
  game.startNewGame({
    seed: options.seed,
    mode: options.mode ?? 'normal',
    ruleSet: ids.length ? 'extended' : 'classic',
    extensions: ids,
    ...(ids.length ? { initialCommands } : {})
  });
  game.animationEnabled = false;
  let disposed = false;
  const alive = () => {
    if (disposed) throw new Error('Disposed world harness');
  };
  const harness: WorldHarness = {
    ext(module, action, payload, answers = []) {
      alive();
      const before = game.recordedInputEvents.length;
      let cursor = 0;
      game.onConfirmRequest = () => answers[cursor++] ?? true;
      game.executeCommand('ext:command', JSON.stringify({ module, action, payload }));
      while (game.pendingCommandConfirmation)
        game.resolveCommandDecision(
          game.pendingCommandConfirmation.token,
          answers[cursor++] ?? true
        );
      return Object.freeze({
        recorded: game.recordedInputEvents.length > before,
        error: worldWorkLastError(game)
      });
    },
    command(action, data) {
      alive();
      game.executeCommand(action, data);
    },
    runAutoUntilIdle(max) {
      alive();
      let n = 0;
      while (game.isAutoTraveling() && n < max) {
        game.executeCommand('auto_step');
        n++;
      }
      return n;
    },
    readWorkContext(owner, query) {
      alive();
      return readWorkContext(game, owner, query);
    },
    world5() {
      alive();
      return game.world5 ? deepFreeze(structuredClone(game.world5)) : null;
    },
    save() {
      alive();
      return JSON.stringify(game.toSaveSnapshot());
    },
    load(save) {
      alive();
      if (!game.loadSnapshot(JSON.parse(save))) throw new Error('Invalid world harness save');
      game.animationEnabled = false;
    },
    exportRecording() {
      alive();
      return JSON.stringify(game.exportRecording());
    },
    replay(recording) {
      alive();
      if (!game.loadReplay(JSON.parse(recording))) return { ok: false, firstMismatch: 0 };
      while (game.replayCursor < game.replayEvents.length && !game.replayError)
        game.replayStep(true);
      return Object.freeze({
        ok: !game.replayError,
        firstMismatch:
          game.replayDiagnostic?.command ?? (game.replayError ? game.replayCursor + 1 : null)
      });
    },
    seek(recording, afterCommand) {
      alive();
      if (!game.loadReplay(JSON.parse(recording)))
        throw new Error('Invalid world harness recording');
      game.replaySeek(afterCommand);
      if (game.replayError) throw new Error(game.replayError);
    },
    digest() {
      alive();
      return mechanicalDigest(game.toSnapshot(), (game as any).recordingInputState()).root;
    },
    dispose() {
      if (!disposed) {
        game.extensionRuntime?.unload();
        disposed = true;
      }
    }
  };
  games.set(harness, game);
  return harness;
}
