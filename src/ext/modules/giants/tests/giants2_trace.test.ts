import { expect, it } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { startGiants, json } from './naturalFixture';
import {
  captureNatural,
  lastSearchAttempt,
  digest,
  world,
  settle,
  type Species
} from './giants2NaturalFixture';
export type NaturalTrace = ReturnType<typeof captureNatural>['trace'];
export const readTrace = (species: Species): NaturalTrace =>
  JSON.parse(
    readFileSync(new URL(`../data/giants2-${species}-trace.json`, import.meta.url), 'utf8')
  );
it.each(['lantern', 'copper'] as const)(
  'fixed %s natural public-command trace matches all mechanical checkpoint hashes',
  async (species) => {
    const path = new URL(`../data/giants2-${species}-trace.json`, import.meta.url);
    if (process.env.BROGUE_CAPTURE_GIANTS2_TRACE === '1') {
      const history: unknown[] = [];
      let captured: ReturnType<typeof captureNatural> | undefined;
      mkdirSync('/tmp/giants2-evidence', { recursive: true });
      for (let seed = 1; seed <= 256; seed++) {
        try {
          captured = captureNatural(species, seed);
          history.push({ ...lastSearchAttempt, seed, result: 'complete' });
          break;
        } catch (error) {
          history.push({ ...lastSearchAttempt, seed, result: String(error) });
          writeFileSync(
            `/tmp/giants2-evidence/${species}-search.json`,
            JSON.stringify(history, null, 2)
          );
          console.info(species, seed, String(error));
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      writeFileSync(
        `/tmp/giants2-evidence/${species}-search.json`,
        JSON.stringify(history, null, 2)
      );
      expect(captured, 'bounded seed search must complete natural combat').toBeDefined();
      writeFileSync(path, JSON.stringify(captured!.trace, null, 2) + '\n');
      writeFileSync(
        `/tmp/giants2-evidence/${species}-recording.json`,
        JSON.stringify(captured!.recording)
      );
      for (const [index, snapshot] of captured!.snapshots)
        writeFileSync(
          `/tmp/giants2-evidence/${species}-save-${index}.json`,
          JSON.stringify(snapshot)
        );
    }
    const trace = readTrace(species),
      game = startGiants(trace.modules, trace.seed, trace.mode);
    settle(game);
    expect(digest(world(game))).toBe(trace.checkpoints.find((p) => p.index === 0)!.worldHash);
    for (let i = 0; i < trace.commands.length; i++) {
      const command = trace.commands[i]!;
      game.executeCommand(command.action, command.data);
      if (game.pendingCommandConfirmation)
        for (const answer of command.decisions ?? [])
          game.resolveCommandDecision(game.pendingCommandConfirmation.token, answer);
      settle(game);
      for (const point of trace.checkpoints.filter((p) => p.index === i + 1))
        expect(digest(world(game)), point.label).toBe(point.worldHash);
    }
    expect(digest(world(game))).toBe(trace.finalHash);
    expect(json(game.toSnapshot().rngState)).toEqual(trace.finalRng);
    expect(game.exportRecording().events.length).toBe(trace.events);
  },
  900000
);
