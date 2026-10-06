import { afterEach, expect, it, vi } from 'vitest';
import type { CombatEventFact } from '../../../types';
import { applyActorPoiseDamage } from '../../../../engine/Core/PhasedAttackProduction';
import { logger } from '../../../../engine/Systems/Logger';
import { scene, transition } from '../../../../test/support/committedBodyTransitions';

afterEach(() => { vi.restoreAllMocks(); logger.reset(); logger.onDisturb = null; });

it('publishes a genuine stagger only after the successful transition and restores its resource row on failure', () => {
        let fail = true;
        const facts: CombatEventFact[] = [];
        const { game, core } = scene(fact => { facts.push(structuredClone(fact)); if (fail) throw new Error('fixture stagger consumer failure'); });
        const runtime = game.extensionRuntime!, resources = runtime.actorActionBinding()!.state;
        // Without growth, native resource rows are allocated on first use.
        applyActorPoiseDamage(game, core.id, 1);
        const pool = resources.actors.find(actor => actor.actorId === core.id)!, before = runtime.snapshot();
        const perform = () => runtime.withCommittedFacts(() => {
            expect(game.transitionBody(transition(core.id, 'phase')).outcome).toBe('applied');
            applyActorPoiseDamage(game, core.id, 100);
        });
        expect(perform).toThrow('fixture stagger consumer failure');
        expect(runtime.snapshot()).toEqual(before); expect(resources.actors.find(actor => actor.actorId === core.id)).toBe(pool);
        fail = false; perform();
        expect(facts).toHaveLength(2); expect(facts[1]).toEqual(facts[0]);
        expect(facts[1]).toMatchObject({ eventKind: 'staggered', actor: { entityId: core.id, partId: 'core', generation: 0 } });
        expect(pool.poise).toBe(0); expect(pool.staggerRemainingTicks).toBeGreaterThan(0);
    });
