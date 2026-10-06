import { recordingChain, recordingStart, merkleDomain } from '../../engine/Core/RecordingDigest';
import { recordingHeader } from '../../engine/Core/RecordingFormat';
import { Game, type GameRecording } from '../../engine/Core/Game';
import { vi } from 'vitest';
import type { ExtensionSnapshot } from '../../ext/types';
import type { RecordingHeaderV4 } from '../../engine/Core/RecordingV4';
const headerHost = Game.prototype as unknown as { makeRecordingHeader(): RecordingHeaderV4 };
const nativeHeader = headerHost.makeRecordingHeader;
/** Controlled scenes belong before the real origin is captured. Applies to
 * every candidate too; never bypasses the production initial-root validator. */
export function installRecordingScene(setup: (game: Game) => void): void {
  vi.spyOn(headerHost, 'makeRecordingHeader').mockImplementation(function (this: Game) {
    setup(this);
    return nativeHeader.call(this);
  });
}
export function rechain(recording: GameRecording): void {
  let chain = recordingStart(recordingHeader(recording));
  for (const event of recording.events) {
    event.chainDigest = recordingChain(chain, event);
    chain = event.chainDigest;
  }
}
/** A prefix's last-required full digest ceases to be a boundary when appended. */
export function continuingPrefix(recording: GameRecording) {
  const copy = structuredClone(recording);
  const last = copy.events[copy.events.length - 1];
  if (last && (last.index + 1) % 256 !== 0) last.fullCheckpoint = null;
  rechain(copy);
  return copy.events;
}
export const extensionDigest = (snapshot: ExtensionSnapshot | null) =>
  merkleDomain('extensions', { root: snapshot });
/** Test observation of the real replayed state; the file stores only its digest. */
export function replayExtensionAt(
  game: Game,
  recording: GameRecording,
  index: number
): ExtensionSnapshot {
  return (game as any).withReplayCandidate((candidate: Game) => {
    if (!candidate.loadReplay(recording)) throw new Error('Fixture recording rejected');
    while (candidate.replayCursor <= index && !candidate.replayError) candidate.replayStep(true);
    if (candidate.replayError) throw new Error(candidate.replayError);
    return structuredClone(candidate.extensionRuntime!.snapshot());
  });
}
export function initialRecordingCheckpoint(game: Game) {
  const header = game.toSaveSnapshot().run.recordingOrigin!.header;
  return (game as any).withReplayCandidate((candidate: Game) => {
    candidate.startNewGame({
      seed: header.seed,
      mode: header.mode,
      ruleSet: header.extensions ? 'extended' : 'classic',
      extensions: header.extensions?.modules.map((m) => m.id)
    });
    const s = candidate.toSnapshot();
    return {
      tick: s.run.currentTick,
      turn: s.run.absoluteTurnNumber,
      depth: s.depth,
      player: s.player.loc,
      rng: s.rngState,
      extensions: s.extensions ?? null
    };
  }) as {
    tick: number;
    turn: number;
    depth: number;
    player: { x: number; y: number };
    rng: ReturnType<Game['toSnapshot']>['rngState'];
    extensions: ExtensionSnapshot | null;
  };
}
export function checkpointExtensionDigest(value: {
  checkpoint?: { domains: { extensions: string } } | null;
  extensions?: ExtensionSnapshot | null;
}): string {
  return 'checkpoint' in value
    ? value.checkpoint!.domains.extensions
    : extensionDigest(value.extensions ?? null);
}
export function tamperExtension(
  game: Game,
  recording: GameRecording,
  index: number,
  mutate: (state: ExtensionSnapshot) => void
): void {
  const state = replayExtensionAt(game, recording, index);
  mutate(state);
  const event = recording.events[index]!;
  event.checkpoint!.domains.extensions = extensionDigest(state);
  const { digestRoot } = digestHelpers;
  event.checkpoint!.root = digestRoot(event.checkpoint!.domains, recording.extensions, [
    'extensions',
    'world5',
    'actorActions'
  ]);
  if (event.fullCheckpoint) {
    event.fullCheckpoint.domains.extensions = event.checkpoint!.domains.extensions;
    event.fullCheckpoint.root = digestRoot(event.fullCheckpoint.domains, recording.extensions, [
      'native',
      'extensions',
      'world5',
      'actorActions',
      'knowledge',
      'random'
    ]);
  }
  rechain(recording);
}
import * as digestHelpers from '../../engine/Core/RecordingDigest';
