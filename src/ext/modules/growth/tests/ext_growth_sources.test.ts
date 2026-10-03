import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import type { GameSnapshot } from '../../../../engine/Core/WholeRunSnapshot';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { DCOLS, DROWS, TerrainType } from '../../../../engine/Map/Grid';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { markCreatureBirth } from '../../../../ext/birth';
import { creatureView, itemView, type ExtensionModule, type Json } from '../../../../ext/types';
import type { GrowthState } from '../state';
import type { GrowthProgression } from '../components';
import type { GrowthDefinitionPack } from '../types';
import data from '../data/definitions.json';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

afterEach(() => vi.restoreAllMocks());
const state = (game: Game): GrowthState => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const savedState = (snapshot: GameSnapshot): GrowthState => snapshot.extensions!.modules.growth as unknown as GrowthState;
const progression = (game: Game, id = game.player.id): GrowthProgression =>
    game.extensionRuntime!.snapshot().components[id]!['growth:progression'] as GrowthProgression;
function flush(game: Game): void { game.executeCommand('growth-sources-fixture', undefined, () => undefined); }

/** Explicit world-only fixtures: no callback-generated input is presented as replay evidence. */
function scene(extensions?: readonly string[]): Game {
    const game = createHeadlessGame(4801, 'test');
    game.startNewGame({ seed: 4801, mode: 'test', ruleSet: 'extended', extensions });
    game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'create-character', payload: { revision: 0 } }));
    game.clearRecording();
    game.monsters = []; game.dormantMonsters = []; game.items = []; game.player.loc = { x: 4, y: 5 };
    for (let x = 1; x < DCOLS - 1; x++) for (let y = 1; y < DROWS - 1; y++) {
        game.grid.setTerrain(x, y, TerrainType.FLOOR);
        Object.assign(game.grid.getCell(x, y)!, { isVisible: true, isDiscovered: true });
    }
    flush(game); return game;
}
function monster(game: Game, x: number, species = 'rat', allied = false): Monster {
    const actor = new Monster(x, 5, (monsters as MonsterData[]).find(entry => entry.id === species)!);
    actor.isAlly = allied;
    markCreatureBirth(actor, 'natural'); game.monsters.push(actor); return actor;
}
function removeDead(game: Game): void { (game as any).removeDeadMonsters(); }

function delayedSourceScene(): { game: Game; sourceId: number; targetId: number } {
    const game = scene(), source = monster(game, 8, 'rat', true), target = monster(game, 12);
    source.doesNotResurrect = true;
    const bolt = game.castMonsterBolt(source, target, 'POISON');
    expect(bolt!.hits.map(hit => hit.creature.id)).toEqual([target.id]);
    expect(target.getStatusDuration('poisoned')).toBeGreaterThan(0);
    expect(game.extensionRuntime!.causality.statusOrigin(target.id, 'poisoned')).toMatchObject({
        kind: 'bolt', actorId: source.id, creditActorId: source.id,
        creditPartyId: source.extensionHooks!.partyId(source),
    });
    target.hp = 1;
    source.takeDamage(source.hp, true);
    removeDead(game); flush(game);
    expect(game.monsters).not.toContain(source); expect(game.purgatory).not.toContain(source);
    expect(game.extensionRuntime!.snapshot().components[source.id]).toBeUndefined();
    expect(source.extensionHooks).toBeUndefined();
    expect(state(game).actors[source.id]).toMatchObject({ allied: true, alive: false });
    expect(progression(game).experience).toBe(0);
    return { game, sourceId: source.id, targetId: target.id };
}

describe('EXT-1a actual effect responsibility and departed source summaries', () => {
    it('actual allied SPARK reflection pays the 80/20 split only at the command safe point', () => {
        const game = scene(), caster = monster(game, 8), reflector = monster(game, 12, 'stone_guardian', true);
        caster.hp = 1;
        const result = game.castMonsterBolt(caster, reflector, 'SPARK')!;
        expect(result.caster).toBe(caster);
        expect(result.reflections.map(reflection => reflection.creature)).toEqual([reflector]);
        expect(caster.hp).toBe(0);
        const origin = game.extensionRuntime!.snapshot().foundation.deaths[caster.id]!.origin;
        expect(origin).toMatchObject({ kind: 'reflection', actorId: caster.id, creditActorId: reflector.id,
            creditPartyId: reflector.extensionHooks!.partyId(reflector) });
        expect(progression(game).experience).toBe(0); expect(progression(game, reflector.id).experience).toBe(0);
        const random = rng.getState(); flush(game);
        expect(progression(game).experience).toBe(6); expect(progression(game, reflector.id).experience).toBe(2);
        expect(state(game).rewardReceipts).toContain(`birth:${caster.id}`); expect(rng.getState()).toEqual(random);
        flush(game); expect(progression(game).experience).toBe(6); expect(progression(game, reflector.id).experience).toBe(2);
    });

    it('actual unally/really after a reflected kill invalidates the old party relation before payment', () => {
        const game = scene(), caster = monster(game, 8), reflector = monster(game, 12, 'rat', true);
        reflector.abilityFlags.add('MA_REFLECT_100'); caster.hp = 1;
        const result = game.castMonsterBolt(caster, reflector, 'SPARK')!;
        expect(result.reflections.map(reflection => reflection.creature)).toEqual([reflector]);
        expect(caster.hp).toBe(0);
        const oldParty = game.extensionRuntime!.snapshot().foundation.deaths[caster.id]!.origin!.creditPartyId;
        const oldRelation = state(game).actors[reflector.id]!.relation;
        expect(reflector.polymorph(() => undefined)).toBe(true); expect(reflector.isAlly).toBe(false);
        game.becomeAllyWith(reflector);
        expect(state(game).actors[reflector.id]!.relation).toBe(oldRelation + 2);
        expect(reflector.extensionHooks!.partyId(reflector)).not.toBe(oldParty);
        flush(game);
        expect(progression(game).experience).toBe(0); expect(progression(game, reflector.id).experience).toBe(0);
        expect(state(game).rewardReceipts).toContain(`birth:${caster.id}`);
        expect(game.loadSnapshot(game.toSaveSnapshot())).toBe(true);
    });

    it('real poison retains a dead unreachable ally summary through save/load and pays only the surviving player share', () => {
        const { game, sourceId, targetId } = delayedSourceScene();
        const origin = game.extensionRuntime!.causality.statusOrigin(targetId, 'poisoned');
        const saved = game.toSaveSnapshot(), savedExtension = structuredClone(saved.extensions);
        expect(saved.run.recordingOrigin).toBeUndefined(); expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.extensionRuntime!.snapshot()).toEqual(savedExtension);
        expect(game.extensionRuntime!.causality.statusOrigin(targetId, 'poisoned')).toEqual(origin);
        expect(game.monsters.some(actor => actor.id === sourceId)).toBe(false);
        expect(game.extensionRuntime!.snapshot().components[sourceId]).toBeUndefined();
        const target = game.monsters.find(actor => actor.id === targetId)!;
        (game as any).resolvePoisonDamage(target);
        expect(target.hp).toBe(0);
        expect(game.extensionRuntime!.snapshot().foundation.deaths[targetId]!.origin).toEqual(origin);
        expect(progression(game).experience).toBe(0); flush(game);
        expect(progression(game).experience).toBe(6);
        expect(game.extensionRuntime!.snapshot().components[sourceId]).toBeUndefined();
        expect(state(game).rewardReceipts).toContain(`birth:${targetId}`);
        removeDead(game); flush(game);
        const paid = game.toSaveSnapshot(); expect(game.loadSnapshot(paid)).toBe(true); flush(game);
        expect(progression(game).experience).toBe(6);
    });

    it.each(['missing-source', 'wrong-player', 'wrong-credit-actor', 'future-relation', 'native-summary-mismatch'] as const)
    ('rejects %s corruption before retiring the live run', defect => {
        const { game, sourceId, targetId } = delayedSourceScene();
        const snapshot = game.toSaveSnapshot(), before = game.extensionRuntime!.snapshot();
        const player = game.player, runtime = game.extensionRuntime, random = rng.getState();
        const origin = snapshot.extensions!.foundation.causality.statusOrigins[targetId]!.poisoned!;
        if (defect === 'missing-source') delete savedState(snapshot).actors[sourceId];
        else if (defect === 'wrong-player') snapshot.extensions!.foundation.causality.statusOrigins[targetId]!.poisoned =
            { ...origin, creditPartyId: `player:999999:actor:${sourceId}:relation:0` };
        else if (defect === 'wrong-credit-actor') snapshot.extensions!.foundation.causality.statusOrigins[targetId]!.poisoned =
            { ...origin, creditPartyId: `player:${game.player.id}:actor:${targetId}:relation:0` };
        else if (defect === 'future-relation') snapshot.extensions!.foundation.causality.statusOrigins[targetId]!.poisoned =
            { ...origin, creditPartyId: `player:${game.player.id}:actor:${sourceId}:relation:999999` };
        else Object.assign(savedState(snapshot).actors[targetId]!, { allied: true, hostile: false });
        expect(game.loadSnapshot(snapshot)).toBe(false); expect(game.player).toBe(player); expect(game.extensionRuntime).toBe(runtime);
        expect(runtime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(random);
    });

    it('loads observation-only corpse history without recreating its collected component or session hooks', () => {
        const game = scene(), target = monster(game, 5);
        target.hp = 1; target.applyStatus('paralyzed', 10);
        (game as any).everSeenMonsters.add(target);
        CombatSystem.attack(game.player, target, { grid: game.grid });
        expect(target.hp).toBe(0); removeDead(game); flush(game);
        const saved = game.toSaveSnapshot();
        expect(saved.entityGraph.monsters.some(actor => actor.id === target.id)).toBe(true);
        expect(saved.extensions!.components[target.id]).toBeUndefined();
        expect(game.loadSnapshot(saved)).toBe(true);
        expect(game.extensionRuntime!.snapshot().components[target.id]).toBeUndefined();
        const historical = [...(game as any).everSeenMonsters as Set<Monster>].find(actor => actor.id === target.id)!;
        expect(historical).toBeDefined(); expect(historical.extensionHooks).toBeUndefined();
        const experience = progression(game).experience; flush(game);
        expect(progression(game).experience).toBe(experience);
        expect(game.extensionRuntime!.snapshot().components[target.id]).toBeUndefined();
    });
});

function configureStory(enabled: boolean): void {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.experience.sources.story = enabled;
    pack.config.experience.story.rewards = [{ id: 'growth.reward.review', amount: 11, reasonKey: 'ext.growth.level_gained' }];
    const validated = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    const issuer = (): ExtensionModule => ({
        id: 'story-test', version: '1.0.0', dependencies: ['growth'], initialState: () => ({}),
        validateState: (value): value is Json => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0,
        hooks: { itemUsed(event, context) {
            if (event.operation === 'review-story') context.grantReward({ recipientId: context.playerId,
                rewardId: 'growth.reward.review', instanceId: 'chapter.one' });
        } },
    });
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(validated, identity), identity);
        registry.register('story-test', '1.0.0', issuer); return registry;
    });
}
function requestStory(game: Game): void {
    game.extensionRuntime!.emit('itemUsed', { creature: creatureView(game.player, game.player.id),
        item: itemView(game.player.inventory.items[0]!), operation: 'review-story' });
}

describe('EXT-1a trusted configured story reward boundary', () => {
    it.each([false, true])('honors story enabled=%s and persists one receipt across duplicate trusted grants and reload', enabled => {
        configureStory(enabled); const game = scene(['growth', 'story-test']);
        const random = rng.getState(); requestStory(game); requestStory(game);
        expect(state(game).pending.filter(fact => fact.kind === 'story')).toHaveLength(2);
        expect(progression(game).experience).toBe(0); flush(game);
        expect(progression(game).experience).toBe(enabled ? 11 : 0);
        expect(state(game).storyReceipts).toEqual(['story-test:growth.reward.review:chapter.one']);
        expect(rng.getState()).toEqual(random);
        const saved = game.toSaveSnapshot(); expect(game.loadSnapshot(saved)).toBe(true);
        requestStory(game); flush(game);
        expect(progression(game).experience).toBe(enabled ? 11 : 0);
        expect(state(game).storyReceipts).toHaveLength(1);
        const before = game.extensionRuntime!.snapshot(), beforeRandom = rng.getState();
        game.executeCommand('ext:command', JSON.stringify({ module: 'growth', action: 'grant-reward',
            payload: { recipientId: game.player.id, rewardId: 'growth.reward.review', instanceId: 'chapter.two', amount: 9999 } }));
        expect(game.extensionRuntime!.snapshot()).toEqual(before); expect(rng.getState()).toEqual(beforeRandom);
    });
});
