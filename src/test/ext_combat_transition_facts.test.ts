import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import * as catalog from '../ext/catalog';
import { registryFromDescriptors } from '../ext/descriptor';
import { extensionDataFingerprint } from '../ext/fingerprint';
import type { BodyTransitionFact, BodyTransitionRequest } from '../ext/bodyTransitions';
import type { CombatEventFact, CombatEventPayload, ExtensionContext, ExtensionModule } from '../ext/types';
import { resolveActorQueryScope } from '../ext/actorQuery';
import { getNextEntityId } from '../entities/Creature';
import { MonsterState } from '../entities/Monster';
import { commitCreatureAnchor } from '../engine/Movement/CreatureSpatial';
import { TerrainType } from '../engine/Map/Grid';
import { collectPhasedAttackActors, applyActorPoiseDamage } from '../engine/Core/PhasedAttackProduction';
import { rng, RNGType } from '../engine/Random';
import { logger } from '../engine/Systems/Logger';
import { auditFullObjectGraph, fullGenerationRoots } from './support/fullGenerationCheckpointOracle';
import { emptyProductionArena, installProductionBody, PRODUCTION_BODY_ID, startProductionGame } from './support/productionComposite';

const modules = ['combat', 'giants', 'growth', 'narrative'];
const capacityInput = { v: 1, baseStaminaCapacity: 24, basePoiseCapacity: 12 };
const attack: CombatEventPayload = { eventKind: 'attack-resolved', actionId: 1, sourceSubactionId: 1,
    segmentIndex: 0, resolutionId: null, bonfireId: null, visit: null, hitCount: 1, hpLost: 1 };
const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };

/** Foundation-owned diagnostic content uses the production registry. The real
 * four modules retain their state, validators, queries and native hooks. */
function install(observer: (fact: CombatEventFact, context: ExtensionContext) => void = () => {}) {
    installProductionBody();
    const previous = catalog.createExtensionRegistry();
    const registry = registryFromDescriptors(catalog.getInstalledModuleDescriptors().map(descriptor => {
        const module = previous.create(previous.manifest([descriptor.id]))[0]!;
        if (descriptor.id === 'body-fixture') {
            const reduced = structuredClone(module.nativeBodies!.definitions.find(body => body.id === PRODUCTION_BODY_ID)!);
            reduced.id = 'body-fixture.fixture-reduced';
            reduced.parts = [{ ...reduced.parts[0]!, formId: 'body-fixture.fixture-reduced-core' }, reduced.parts[1]!, reduced.parts[2]!];
            reduced.constraints = reduced.constraints.slice(0, 2);
            const nativeForms = [...module.nativeForms!, { ...module.nativeForms!.find(form => form.id === 'body-fixture.fixture-core')!,
                id: 'body-fixture.fixture-reduced-core', hp: 80 }];
            const nativeBodies = { ...module.nativeBodies!, definitions: [...module.nativeBodies!.definitions, reduced] };
            const rules = { ...module.rules!, fingerprint: extensionDataFingerprint({ base: module.rules, nativeForms, nativeBodies }) };
            return { ...descriptor, rules, create: () => ({ ...module, rules, nativeForms, nativeBodies }) };
        }
        if (descriptor.id === 'narrative') {
            const consumer = module.committedFacts!['combat.event.v1']!;
            const observed: ExtensionModule = { ...module, committedFacts: { ...module.committedFacts,
                'combat.event.v1': { ...consumer, eventKinds: ['attack-resolved', 'staggered', 'parried', 'rest-completed'],
                    prepare: (fact, allocation, context) => ({ fact, plan: consumer.prepare(fact, allocation, context) }),
                    commit: (value, context) => {
                        const { fact, plan } = value as { fact: CombatEventFact; plan: unknown };
                        consumer.commit(plan, context);
                        observer(fact, context);
                    } } } };
            return { ...descriptor, create: () => observed };
        }
        return { ...descriptor, rules: module.rules, create: () => module };
    }));
    vi.mocked(catalog.createExtensionRegistry).mockReturnValue(registry);
}

function scene(observer?: (fact: CombatEventFact, context: ExtensionContext) => void, cached = false) {
    install(observer);
    const game = startProductionGame([...modules, 'body-fixture'], 7349, 'normal');
    if (cached) {
        // Stair location is fixture setup; caching/entry uses the public input.
        game.grid.setTerrain(game.player.x, game.player.y, TerrainType.STAIRS_DOWN);
        game.executeCommand('stairs_down'); acknowledge();
        expect(game.depth).toBe(2); expect(game.levels.has(1)).toBe(true);
    }
    emptyProductionArena(game);
    const core = game.createCompositeMonster(PRODUCTION_BODY_ID, { x: 14, y: 12 })!;
    core.hp = 80; core.state = MonsterState.HUNTING;
    const actors = [...game.monsters], group = game.bodyGroups![0]!;
    const external = game.createModuleMonster('body-fixture.ridgeback', { x: 55, y: 12 })!;
    game.planSquareStep(external, { kind: 'anchors', anchors: [{ x: 50, y: 12 }] });
    collectPhasedAttackActors(game, [game.player, ...game.monsters]);
    (game as any).updateVision(); acknowledge();
    return { game, core, actors, group, external };
}

function transition(groupId: number, reason: 'phase' | 'split'): BodyTransitionRequest {
    return { sourceGroupId: groupId, reason,
        results: reason === 'phase'
            ? [{ formId: 'body-fixture.fixture-reduced-core', memberMap: [{ from: 'leg07', to: 'leg00' }, { from: 'leg06', to: 'leg01' }] }]
            : [{ formId: 'body-fixture.ridgeback', memberMap: [] }, { formId: 'body-fixture.ridgeback', memberMap: [] }],
        hp: reason === 'split' ? 'conserve' : 'ratio', statuses: 'preserve', relationships: 'preserve', placement: 'nearest' };
}

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
        const state = runtime.actorActionBinding()!.state, resources = [...state.actors];
        const next = getNextEntityId(), random = rng.getState(), before = runtime.snapshot(), messages = logger.getState();
        const keys = Reflect.ownKeys(game), audit = auditFullObjectGraph(fullGenerationRoots(game), [runtime]);
        const perform = () => runtime.withCommittedFacts(() => {
            // Direct native transition/fact setup deliberately isolates the
            // rollback boundary from command recording and time advancement.
            applied = game.transitionBody(transition(core.id, reason));
            expect(applied.outcome).toBe('applied');
            expect(game.monsters).not.toContain(source);
            expect(() => runtime.queryOptionalActor('growth.combat-stats.v1', source, capacityInput)).toThrow('Untrusted');
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
        expect(state).toBe(runtime.actorActionBinding()!.state);
        resources.forEach((resource, i) => expect(state.actors[i]).toBe(resource));
        expect(runtime.queryOptionalActor('growth.combat-stats.v1', source, capacityInput)).toMatchObject({ status: 'available', value: { status: 'supported' } });
        expect(observed).toHaveLength(1);
        expect(observed[0]).toMatchObject({ factId: before.foundation.nextFactId, actor: { entityId: source.id, partId: 'leg00', generation: 0 } });

        fail = false; perform();
        expect(observed).toHaveLength(2); expect(observed[1]).toEqual(observed[0]);
        expect(runtime.snapshot().foundation.nextFactId).toBe(before.foundation.nextFactId + 1);
        expect(getNextEntityId()).toBe(next + (reason === 'split' ? 1 : 0));
        expect(game.monsters).not.toContain(source); expect(source.hp).toBe(0);
        expect(death).not.toHaveBeenCalled();
        expect(runtime.queryOptionalActor('growth.combat-stats.v1', core, capacityInput)).toMatchObject({ status: 'available', value: { status: 'supported' } });
        if (reason === 'phase') {
            expect(game.monsters).toEqual([core, actors[7], actors[8], external]);
            expect(resolveActorQueryScope(game.actorActionWorld(), actors[8]!)).toEqual({ depth: game.depth, partId: 'leg00', generation: 0 });
            expect(resolveActorQueryScope(game.actorActionWorld(), actors[7]!)).toEqual({ depth: game.depth, partId: 'leg01', generation: 0 });
            expect(resolveActorQueryScope(game.actorActionWorld(), source)).toBeNull();
            expect(runtime.queryOptionalActor('growth.combat-stats.v1', actors[8]!, capacityInput)).toMatchObject({ status: 'available', value: { status: 'supported' } });
            const forged = Object.assign(Object.create(Object.getPrototypeOf(actors[8]!)), actors[8]);
            expect(() => runtime.queryOptionalActor('growth.combat-stats.v1', forged, capacityInput)).toThrow('Untrusted');
        } else {
            expect(game.monsters.filter(actor => actor !== external).map(actor => actor.id)).toEqual([core.id, next]);
            expect(game.monsters.filter(actor => actor !== external).map(actor => actor.hp)).toEqual([40, 40]);
        }
    });

    it('publishes a genuine stagger only after the successful transition and restores its resource row on failure', () => {
        let fail = true;
        const facts: CombatEventFact[] = [];
        const { game, core } = scene(fact => { facts.push(structuredClone(fact)); if (fail) throw new Error('fixture stagger consumer failure'); });
        const runtime = game.extensionRuntime!, resources = runtime.actorActionBinding()!.state;
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

    it('executes the formal active split and subsequent committed attack through normal commands with all four modules', () => {
        const facts: CombatEventFact[] = [];
        install(fact => facts.push(structuredClone(fact)));
        const game = startProductionGame(modules, 7351, 'normal');
        emptyProductionArena(game);
        // Functional encounter setup, not a natural-generation claim. Only the
        // HP threshold/readiness/position are arranged; transition and attacks use input.
        const core = game.createModuleMonster('giants.abyssal-colossus', { x: 20, y: 12 })!;
        core.hp = 129; core.state = MonsterState.HUNTING; core.givenUpOnScent = true; core.ticksUntilTurn = 0;
        core.behaviorFlags.add('MONST_ALWAYS_HUNTING');
        commitCreatureAnchor(game.player, { x: 19, y: 12 });
        (game as any).updateVision(); acknowledge();
        const next = getNextEntityId();
        game.executeCommand('wait'); acknowledge();
        expect(core.bodyTransitionHistory).toEqual(['giants.colossus-fracture']);
        expect(game.monsters.map(actor => actor.id)).toEqual([core.id, next]);
        expect(game.monsters.map(actor => actor.hp)).toEqual([65, 64]);
        game.executeCommand('ext:command', JSON.stringify({ module: 'combat', action: 'attack',
            payload: { attackId: 'fixture.double-thrust', facing: 'e' } })); acknowledge();
        const resolved = facts.filter(fact => fact.eventKind === 'attack-resolved' && fact.actor.entityId === game.player.id);
        expect(resolved.map(fact => fact.segmentIndex)).toEqual([0, 1]);
        expect(new Set(resolved.map(fact => fact.factId)).size).toBe(2);
        expect(game.lastAdvancementError).toBeNull();
        expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    });
});
