import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BodyTransitionFact } from '../ext/bodyTransitions';
import type { CombatEventFact } from '../ext/types';
import { resolveActorQueryScope } from '../ext/actorQuery';
import { getNextEntityId } from '../entities/Creature';
import { rng, RNGType } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { auditFullObjectGraph, fullGenerationRoots } from './support/fullGenerationCheckpointOracle';
import { scene, transition, capacityInput, attack, modules } from './support/committedBodyTransitions';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

describe('3g committed facts around successful 4e body transitions', () => {
    it.each(['phase', 'split'] as const)('%s restores the complete original graph when a later consumer rejects and succeeds on retry', reason => {
        let fail = true, applied: BodyTransitionFact | undefined;
        const observed: CombatEventFact[] = [];
        const { game, core, actors, group, external } = scene((fact, context) => {
            expect(applied?.outcome).toBe('applied');
            observed.push(structuredClone(fact));
            context.message('fixture committed transition fact');
            context.randomInt(1, 20);
            rng.setRNG(RNGType.RNG_COSMETIC); rng.randRange(1, 20);
            if (fail) throw new Error('fixture post-transition consumer failure');
        }, true);
        const runtime = game.extensionRuntime!, list = game.monsters, source = actors[1]!, spatial = source.spatial!;
        const death = vi.spyOn(runtime, 'captureDeath');
        const state = runtime.actorActionBinding()?.state, resources = state ? [...state.actors] : [];
        const next = getNextEntityId(), random = rng.getState(), before = runtime.snapshot(), messages = logger.getState();
        const keys = Reflect.ownKeys(game), audit = auditFullObjectGraph(fullGenerationRoots(game), [runtime]);
        const perform = () => runtime.withCommittedFacts(() => {
            // Direct native transition/fact setup deliberately isolates the
            // rollback boundary from command recording and time advancement.
            applied = game.transitionBody(transition(core.id, reason));
            expect(applied.outcome).toBe('applied');
            expect(game.monsters).not.toContain(source);
            expect(resolveActorQueryScope(game.actorActionWorld(), source)).toBeNull();
            if (modules.includes('growth')) {
                expect(() => runtime.queryOptionalActor('growth.combat-stats.v1', source, capacityInput)).toThrow('Untrusted');
            } else {
                expect(runtime.queryOptionalActor('growth.combat-stats.v1', source, capacityInput)).toEqual({ status: 'unavailable', reason: 'absent' });
            }
            // Exercise cached-light writes in the same native transaction too;
            // transitionBody already repaints the active light map itself.
            game.levels.get(1)!.lightMap.clear(); game.levels.get(1)!.lightMap.clearLighting();
            runtime.commitCombatEvent(source, attack);
        });
        expect(perform).toThrow('fixture post-transition consumer failure');
        expect(Reflect.ownKeys(game)).toEqual(keys);
        expect(audit.differences()).toEqual([]);
        expect(runtime.snapshot()).toEqual(before);
        expect(rng.getState()).toEqual(random); expect(getNextEntityId()).toBe(next); expect(logger.getState()).toEqual(messages);
        expect(game.monsters).toBe(list); expect(game.bodyGroups![0]).toBe(group); expect(source.spatial).toBe(spatial);
        expect(state).toBe(runtime.actorActionBinding()?.state);
        resources.forEach((resource, i) => expect(state!.actors[i]).toBe(resource));
        expect(runtime.queryOptionalActor('growth.combat-stats.v1', source, capacityInput)).toMatchObject(modules.includes('growth') ? { status: 'available', value: { status: 'supported' } } : { status: 'unavailable', reason: 'absent' });
        expect(observed).toHaveLength(1);
        expect(observed[0]).toMatchObject({ factId: before.foundation.nextFactId, actor: { entityId: source.id, partId: 'leg00', generation: 0 } });

        fail = false; perform();
        expect(observed).toHaveLength(2); expect(observed[1]).toEqual(observed[0]);
        expect(runtime.snapshot().foundation.nextFactId).toBe(before.foundation.nextFactId + 1);
        expect(getNextEntityId()).toBe(next + (reason === 'split' ? 1 : 0));
        expect(game.monsters).not.toContain(source); expect(source.hp).toBe(0);
        expect(death).not.toHaveBeenCalled();
        expect(runtime.queryOptionalActor('growth.combat-stats.v1', core, capacityInput)).toMatchObject(modules.includes('growth') ? { status: 'available', value: { status: 'supported' } } : { status: 'unavailable', reason: 'absent' });
        if (reason === 'phase') {
            expect(game.monsters).toEqual([core, actors[7], actors[8], external]);
            expect(resolveActorQueryScope(game.actorActionWorld(), actors[8]!)).toEqual({ depth: game.depth, partId: 'leg00', generation: 0 });
            expect(resolveActorQueryScope(game.actorActionWorld(), actors[7]!)).toEqual({ depth: game.depth, partId: 'leg01', generation: 0 });
            expect(resolveActorQueryScope(game.actorActionWorld(), source)).toBeNull();
            expect(runtime.queryOptionalActor('growth.combat-stats.v1', actors[8]!, capacityInput)).toMatchObject(modules.includes('growth') ? { status: 'available', value: { status: 'supported' } } : { status: 'unavailable', reason: 'absent' });
            const forged = Object.assign(Object.create(Object.getPrototypeOf(actors[8]!)), actors[8]);
            expect(resolveActorQueryScope(game.actorActionWorld(), forged)).toBeNull();
            if (modules.includes('growth')) {
                expect(() => runtime.queryOptionalActor('growth.combat-stats.v1', forged, capacityInput)).toThrow('Untrusted');
            } else {
                expect(runtime.queryOptionalActor('growth.combat-stats.v1', forged, capacityInput)).toEqual({ status: 'unavailable', reason: 'absent' });
            }
        } else {
            expect(game.monsters.filter(actor => actor !== external).map(actor => actor.id)).toEqual([core.id, next]);
            expect(game.monsters.filter(actor => actor !== external).map(actor => actor.hp)).toEqual([40, 40]);
        }
    });

});
