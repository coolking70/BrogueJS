import { it, expect, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { candidateSource, residentComponent } from '../../../../engine/Core/ResidentWorld';
import { rng } from '../../../../engine/Random';
import { getNextEntityId } from '../../../../entities/Creature';
import route from './resident-captive-route.json';
import { worldWorkLastError } from '../../../../engine/Core/WorldWork';

it('normal seed3 current-source UI route rescues the natural D3 original goblin, builds a paid camp/bed and recruits No/Yes with replay/continuation', () => {
  vi.restoreAllMocks();
  const h = createWorldHarness({ seed: route.seed, mode: 'normal', modules: ['settlement'] }),
    g = worldHarnessGame(h);
  const points = new Map(route.checkpoints.map((p) => [p.events, p]));
  const seeks: { events: number; digest: string }[] = [];
  let actor: (typeof g.monsters)[number] | undefined,
    beforeNo:
      | {
          tick: number;
          random: ReturnType<typeof rng.getState>;
          id: number;
          world: unknown;
          digest: string;
        }
      | undefined;
  try {
    const initial = points.get(0)!;
    expect(initial.name).toBe('initial');
    expect(g.recordedInputEvents).toHaveLength(0);
    expect(g.depth).toBe(initial.depth);
    expect(g.world5!.simulationTicks).toBe(initial.tick);
    expect(h.digest()).toBe(initial.digest);
    seeks.push({ events: 0, digest: initial.digest });
    for (const step of route.steps)
      for (let n = 0; n < step.count; n++) {
        const before = g.recordedInputEvents.length,
          answers = [...step.decisions];
        g.onConfirmRequest = () => answers.shift() ?? true;
        h.command(step.action, step.data);
        while (g.pendingCommandConfirmation)
          g.resolveCommandDecision(g.pendingCommandConfirmation.token, answers.shift() ?? true);
        if (step.action === 'ext:command') {
          if (process.env.RESIDENT_CAPTIVE_CAPTURE && worldWorkLastError(g))
            writeFileSync(
              process.env.RESIDENT_CAPTIVE_CAPTURE + '.failed.json',
              JSON.stringify({
                event: before + 1,
                data: step.data,
                error: worldWorkLastError(g),
                snapshot: g.toSnapshot(),
                recording: JSON.parse(h.exportRecording())
              })
            );
          expect(worldWorkLastError(g), `event ${before + 1}: ${String(step.data)}`).toBeNull();
        }
        expect(g.isGameOver).toBe(false);
        expect(g.recordedInputEvents.length).toBe(before + 1);
        const checkpoint = points.get(before + 1);
        if (!checkpoint) continue;
        expect(g.depth).toBe(checkpoint.depth);
        expect(g.world5!.simulationTicks).toBe(checkpoint.tick);
        expect(h.digest()).toBe(checkpoint.digest);
        const point=checkpoint.name;
        if (point === 'before-rescue') {
          actor = g.monsters.find((a) => a.id === route.actorId);
          expect(actor).toBeDefined();
          expect(actor).toMatchObject({ isCaged: true, isAlly: false, typeId: 'goblin' });
          expect(candidateSource(g, actor!.id)).toBeUndefined();
          beforeNo = {
            tick: g.world5!.simulationTicks,
            random: rng.getState(),
            id: getNextEntityId(),
            world: structuredClone(g.world5),
            digest: h.digest()
          };
        }
        if (point === 'after-rescue-no') {
          expect(g.monsters.find((a) => a.id === route.actorId)).toBe(actor);
          expect(actor!.isCaged).toBe(true);
          expect(candidateSource(g, actor!.id)).toBeUndefined();
          expect(g.world5!.simulationTicks).toBe(beforeNo!.tick);
          expect(rng.getState()).toEqual(beforeNo!.random);
          expect(getNextEntityId()).toBe(beforeNo!.id);
          expect(g.world5).toEqual(beforeNo!.world);
        }
        if (point === 'actual-rescue') {
          expect(g.monsters.find((a) => a.id === route.actorId)).toBe(actor);
          expect(actor).toMatchObject({ isCaged: false, isAlly: true });
          expect(candidateSource(g, actor!.id)?.source).toMatchObject({
            kind: 'rescue',
            key: 'settlement.rescue.85',
            consumed: false
          });
          expect(
            g.world5!.receipts.filter((r) => r.identity === 'settlement.rescue.85')
          ).toHaveLength(1);
        }
        if (point === 'before-recruit')
          beforeNo = {
            tick: g.world5!.simulationTicks,
            random: rng.getState(),
            id: getNextEntityId(),
            world: structuredClone(g.world5),
            digest: h.digest()
          };
        if (point === 'after-recruit-no') {
          expect(h.digest()).toBe(beforeNo!.digest);
          expect(residentComponent(g, actor!.id)).toBeUndefined();
          expect(g.world5).toEqual(beforeNo!.world);
          expect(rng.getState()).toEqual(beforeNo!.random);
          expect(getNextEntityId()).toBe(beforeNo!.id);
        }
        if (point === 'after-recruit-yes') {
          expect(g.monsters.find((a) => a.id === route.actorId)).toBe(actor);
          expect(g.world5!.simulationTicks).toBe(beforeNo!.tick + 100);
          const resident = residentComponent(g, actor!.id);
          expect(resident).toBeDefined();
          expect(resident).toMatchObject({ campId: 106, bedId: route.bed.id });
          expect(candidateSource(g, actor!.id)?.source.consumed).toBe(true);
        }
        seeks.push({ events: before + 1, digest: h.digest() });
      }
    expect(g.recordedInputEvents).toHaveLength(route.events);
    const recording = h.exportRecording(),
      save = h.save(),
      digest = h.digest();
    if (process.env.RESIDENT_CAPTIVE_CAPTURE)
      writeFileSync(
        process.env.RESIDENT_CAPTIVE_CAPTURE,
        JSON.stringify({
          recording: JSON.parse(recording),
          save: JSON.parse(save),
          checkpoints: seeks
        })
      );
    h.load(save);
    expect(h.digest()).toBe(digest);
    h.command('wait');
    expect(h.replay(h.exportRecording())).toEqual({ ok: true, firstMismatch: null });
    expect(h.replay(recording)).toEqual({ ok: true, firstMismatch: null });
    for (const point of seeks) {
      h.seek(recording, point.events);
      expect(h.digest()).toBe(point.digest);
    }
    // Optional final-source audit checks the untouched complete external trace,
    // including its original captured roots, rather than recapturing them.
    const references: string[] = process.env.RESIDENT_CAPTIVE_RECORDINGS ? JSON.parse(process.env.RESIDENT_CAPTIVE_RECORDINGS) : process.env.RESIDENT_CAPTIVE_RECORDING ? [process.env.RESIDENT_CAPTIVE_RECORDING] : [];
    const referenceResults = [];
    for (const reference of references) {
      const raw = readFileSync(reference, 'utf8');
      const result = h.replay(raw);
      referenceResults.push({
        path: reference,
        sha256: createHash('sha256').update(raw).digest('hex'),
        result
      });
      if (process.env.RESIDENT_CAPTIVE_AUDIT)
        writeFileSync(process.env.RESIDENT_CAPTIVE_AUDIT, JSON.stringify({
          referencesEnvironment: process.env.RESIDENT_CAPTIVE_RECORDINGS,
          seeks,
          referenceResults
        }, null, 2) + '\n');
      expect(result, reference).toEqual({ ok: true, firstMismatch: null });
    }
  } finally {
    h.dispose();
  }
});
