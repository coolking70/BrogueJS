import { expect, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  captureNatural,
  EVIDENCE,
  lastAttempt,
  NPCS,
  readTrace,
  reconstruct,
  RouteFailure,
  writeEvidence
} from './narrative2_naturalFixture';

const cases = [
  { name: 'five-wizard', mode: 'wizard' as const, targets: NPCS.map((n) => n.id) },
  { name: 'cord-normal', mode: 'normal' as const, targets: ['cord.mender'] }
];
it.each(cases)(
  'N2-TRACE $name: fixed real public commands retain full mechanical and message checkpoints',
  async ({ name, mode, targets }) => {
    if (process.env.BROGUE_CAPTURE_NARRATIVE2_TRACE === '1') {
      mkdirSync(EVIDENCE, { recursive: true });
      const attempts: unknown[] = [];
      let result: ReturnType<typeof captureNatural> | undefined;
      for (let seed = 1; seed <= 256; seed++) {
        try {
          result = captureNatural(seed, ['narrative'], mode, targets);
          attempts.push({
            seed,
            ...(lastAttempt as object),
            events: result.trace.events,
            routeCommands: result.trace.routeCommands,
            dialogueCommands: result.trace.commands.filter((c) => c.action === 'ext:command')
              .length,
            result: 'complete'
          });
          break;
        } catch (error) {
          // Only route failure permits another seed. Mechanical/replay/assertion failures escape unchanged.
          if (!(error instanceof RouteFailure)) throw error;
          attempts.push({ seed, ...(lastAttempt as object), result: error.message });
          writeFileSync(`${EVIDENCE}/${name}-search.json`, JSON.stringify(attempts, null, 2));
        }
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      writeFileSync(`${EVIDENCE}/${name}-search.json`, JSON.stringify(attempts, null, 2));
      expect(result, 'bounded seed search 1..64 then 65..256').toBeDefined();
      writeEvidence(name, result!);
      writeFileSync(
        new URL(`../data/narrative2-${name}.trace.json`, import.meta.url),
        JSON.stringify(result!.trace, null, 2) + '\n'
      );
    }
    const data = reconstruct(readTrace(name));
    expect(data.input.targets).toEqual(targets);
    expect(data.input.births).toHaveLength(targets.length);
    expect(data.recording.events).toHaveLength(data.input.events);
  },
  900000
);
