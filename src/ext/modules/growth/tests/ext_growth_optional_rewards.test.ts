import { extensionDigest, checkpointExtensionDigest, initialRecordingCheckpoint } from '../../../../test/support/recordingV4';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { ExtensionRegistry } from '../../../../ext/registry';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { isJson } from '../../../../ext/json';
import type { ExtensionModule, Json, OptionalRewardPrepareContext, OptionalRewardRequest } from '../../../../ext/types';
import * as catalog from '../../../../ext/catalog';
import data from '../data/definitions.json';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack } from '../types';
import { isGrowthState, type GrowthState } from '../state';
import type { GrowthProgression } from '../components';

const capability = 'growth.story-reward.v1';
const rewardId = 'growth.reward.review';
const request: OptionalRewardRequest = { issuerId:'reward-test', rewardId, instanceId:'chapter.one', recipient:'player' };
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
const progression = (game: Game) => game.extensionRuntime!.snapshot().components[game.player.id]!['growth:progression'] as GrowthProgression;
const command = (game: Game, action = 'claim', payload: Json = {}) => game.executeCommand('ext:command', JSON.stringify({module:'reward-test',action,payload}));
const create = (game: Game) => game.executeCommand('ext:command', JSON.stringify({module:'growth',action:'create-character',payload:{revision:0}}));
function freeze<T>(value: T): T {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
}
function fixture(change: (pack: GrowthDefinitionPack) => void = () => undefined, reversed = false) {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.experience.sources.story = true;
    pack.config.experience.story.rewards = [{id:rewardId,amount:160,reasonKey:'ext.growth.level_gained'}];
    change(pack);
    const parsed = parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
    const identity = {schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
    const growth = createGrowthGameplay(parsed,identity);
    const issuer = (): ExtensionModule => ({id:'reward-test',version:'1.0.0',initialState:()=>({}),validateState:isJson,
        commands: {
            claim(payload,context) {
                const input = payload as {rewardId?:string;instanceId?:string};
                const key = input.rewardId ?? rewardId, instance = input.instanceId ?? request.instanceId;
                const ready = context.prepareOptionalReward(capability,key,instance);
                const result = context.commitOptionalReward(capability,key,instance);
                if ((ready.status === 'ready') !== (result.status === 'applied')) throw new Error('Preparation and commit disagreed');
                context.setState(result as Json);
            },
            twice(_payload,context) {
                for (const instance of ['chapter.one','chapter.two']) context.commitOptionalReward(capability,rewardId,instance);
            },
        },
    });
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        const registerGrowth = () => registry.register('growth',pack.moduleVersion,()=>createGrowthGameplay(parsed,identity),identity);
        const registerIssuer = () => registry.register('reward-test','1.0.0',issuer);
        if (reversed) { registerIssuer();registerGrowth(); } else { registerGrowth();registerIssuer(); }
        return registry;
    });
    const game = createHeadlessGame(86412,'test');
    game.startNewGame({seed:86412,mode:'test',ruleSet:'extended',extensions:['growth','reward-test']});
    return {game,growth,pack};
}
function stableWorld(game: Game) {
    const {savedAt:_savedAt,...snapshot} = game.toSnapshot();
    // A refused load appends its user-facing diagnostic; all simulation/persistent world fields remain exact.
    const {logger:_logger,...run} = snapshot.run;
    return JSON.parse(JSON.stringify({...snapshot,run})) as unknown;
}
function prepareContext(game: Game): OptionalRewardPrepareContext {
    const snapshot = game.extensionRuntime!.snapshot(), player = game.player;
    const components = snapshot.components[player.id]!;
    return freeze({playerId:player.id,state:snapshot.modules.growth!,
        getPlayerComponent:(name: string)=>components[`growth:${name}`],
        player:{id:player.id,name:player.name,hp:player.hp,maxHp:player.maxHp,x:player.x,y:player.y,
            player:true,monsterId:null,allied:true,hostile:false},
        resources:{strength:player.strength,gold:game.stats.gold}});
}
afterEach(()=>vi.restoreAllMocks());

describe('EXT-2c growth optional reward provider',()=> {
    it.each(['disabled','unsupported-key'] as const)('treats %s as a pure skip with no growth receipt or XP',reason=> {
        const {game} = fixture(pack=> {if (reason === 'disabled') pack.config.experience.sources.story = false;});
        create(game); const before = game.extensionRuntime!.snapshot().modules.growth, random = rng.getState();
        command(game,'claim',{rewardId:reason === 'unsupported-key' ? 'growth.reward.absent' : rewardId});
        expect(game.extensionRuntime!.snapshot().modules['reward-test']).toEqual({status:'skipped',reason});
        expect(game.extensionRuntime!.snapshot().modules.growth).toEqual(before);
        expect(progression(game).experience).toBe(0); expect(state(game).storyReceipts).toEqual([]);
        expect(rng.getState()).toEqual(random);
    });
    it('fully preflights a provider-owned grant using frozen detached player facts without writes or RNG',()=> {
        const {game,growth} = fixture();create(game);
        const before = game.extensionRuntime!.snapshot(), random = rng.getState(), context = prepareContext(game);
        const provider = growth.optionalRewards![capability]!;
        const first = provider.prepare(freeze({...request}),context);
        expect(first.status).toBe('ready');
        if (first.status !== 'ready') throw new Error('Expected ready');
        expect(first.plan).toMatchObject({amount:160,reasonKey:'ext.growth.level_gained',received:false,
            receiptId:'reward-test:growth.reward.review:chapter.one',award:{progression:{level:3,experience:160}}});
        expect(provider.prepare(request,context)).toEqual(first);
        expect(game.extensionRuntime!.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);
        expect(()=>provider.prepare(request,{...context,player:{...context.player!,hp:Number.MAX_SAFE_INTEGER,maxHp:Number.MAX_SAFE_INTEGER}})).toThrow(/overflow/);
        const overflowState = {...context.state as object,revision:Number.MAX_SAFE_INTEGER};
        expect(()=>provider.prepare(request,{...context,state:overflowState as Json})).toThrow(/overflow/);
        expect(game.extensionRuntime!.snapshot()).toEqual(before);
    });
    it('separately preflights exact native strength bounds under a level-derived strength bonus',()=> {
        const {game,growth} = fixture(pack=> {
            const strength = pack.config.attributes.find(attribute=>attribute.id === 'growth.attribute.strength-training')!;
            strength.effects[0]!.magnitude.source = {kind:'level'};
        });
        create(game);
        const before = game.extensionRuntime!.snapshot(), random = rng.getState(), context = prepareContext(game);
        expect((context.state as unknown as GrowthState).revision).toBeLessThan(Number.MAX_SAFE_INTEGER);
        const provider = growth.optionalRewards![capability]!, maximum = Number.MAX_SAFE_INTEGER;
        const exact = provider.prepare(request,{...context,resources:{...context.resources,strength:maximum-2}});
        expect(exact.status).toBe('ready');
        if (exact.status !== 'ready') throw new Error('Expected exact strength boundary to be ready');
        expect(exact.plan).toMatchObject({award:{character:{expectedStrength:maximum-2,strength:maximum},derived:{appliedStrength:3}}});
        expect(()=>provider.prepare(request,{...context,resources:{...context.resources,strength:maximum-1}})).toThrow(/overflow/);
        expect(game.extensionRuntime!.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);
    });
    it('applies XP, resources, and one receipt before the same command checkpoint; duplicates and load never regrant',()=> {
        const {game} = fixture();create(game);
        const maxHp = game.player.maxHp, hp = game.player.hp, random = rng.getState(), turn = game.absoluteTurnNumber, tick = timeSystem.currentTick;
        command(game);
        expect(progression(game)).toMatchObject({level:3,experience:160,attributePoints:2,skillPoints:1});
        expect(game.player.maxHp).toBeGreaterThan(maxHp); expect(game.player.hp).toBe(hp);
        expect(state(game).pending).toEqual([]);expect(state(game).storyReceipts).toEqual(['reward-test:growth.reward.review:chapter.one']);
        expect(game.extensionRuntime!.snapshot().modules['reward-test']).toEqual({status:'applied'});
        const after = game.extensionRuntime!.snapshot();
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.checkpoint!.domains.extensions).toBe(extensionDigest(after ?? null));
        command(game);expect(game.extensionRuntime!.snapshot()).toEqual(after);
        expect(game.absoluteTurnNumber).toBe(turn);expect(timeSystem.currentTick).toBe(tick);expect(rng.getState()).toEqual(random);
        const saved = game.toSaveSnapshot();expect(game.loadSnapshot(saved)).toBe(true);
        command(game);expect(game.extensionRuntime!.snapshot()).toEqual(after);
    });
    it('commits consecutive same-command receipts against the updated progression without losing either reward',()=> {
        const {game} = fixture();create(game);command(game,'twice');
        expect(progression(game).experience).toBe(320);expect(progression(game).level).toBe(4);
        expect(state(game).storyReceipts).toEqual(['reward-test:growth.reward.review:chapter.one','reward-test:growth.reward.review:chapter.two']);
        expect(state(game).pending).toEqual([]);
    });
    it('rejects a supported grant before initialization rather than reporting an unapplied reward as ready',()=> {
        const {game,growth} = fixture();const before = game.extensionRuntime!.snapshot();
        expect(()=>growth.optionalRewards![capability]!.prepare(request,prepareContext(game))).toThrow();
        expect(game.extensionRuntime!.snapshot()).toEqual(before);
    });
    it('rejects malformed or unknown-quote receipts before retiring or changing the live world',()=> {
        const {game,pack} = fixture();create(game);command(game);
        const saved = game.toSaveSnapshot(), before = stableWorld(game), player = game.player, runtime = game.extensionRuntime;
        for (const receipt of ['', 'garbage', 'reward-test:growth.reward.review', 'reward-test:growth.reward.review:chapter.one:extra',
            ':growth.reward.review:chapter.one', 'Reward-test:growth.reward.review:chapter.one',
            'reward-test:growth.reward.review:bad_id', 'reward-test:growth.reward.absent:chapter.one']) {
            const corrupt = structuredClone(saved), growth = corrupt.extensions!.modules.growth as unknown as GrowthState;
            growth.storyReceipts = [receipt];
            expect(isGrowthState(growth,pack),receipt).toBe(false);
            expect(game.loadSnapshot(corrupt),receipt).toBe(false);
            expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(stableWorld(game)).toEqual(before);
        }
        const permitted = structuredClone(state(game));
        permitted.storyReceipts = ['uninstalled-issuer:growth.reward.review:chapter.one'];
        const disabled = structuredClone(pack);disabled.config.experience.sources.story = false;
        expect(isGrowthState(permitted,disabled)).toBe(true);
    });
    it('validates pending story provenance and exact owned quote before rejecting malformed saved work',()=> {
        const {game,pack} = fixture();create(game);
        const saved = game.toSaveSnapshot(), before = stableWorld(game), player = game.player, runtime = game.extensionRuntime;
        const valid = {kind:'story' as const,recipientId:game.player.id,rewardKey:'uninstalled-issuer:growth.reward.review:chapter.one',
            definitionId:rewardId,amount:160,reasonKey:'ext.growth.level_gained'};
        const pending = structuredClone(state(game));pending.pending = [valid];
        expect(isGrowthState(pending,pack)).toBe(true);
        const mutations = [
            {rewardKey:'malformed'}, {rewardKey:'reward-test:growth.reward.absent:chapter.one'},
            {definitionId:'growth.reward.absent'}, {amount:161}, {amount:-1}, {reasonKey:'ext.growth.wrong-reason'},
        ];
        for (const mutation of mutations) {
            const corrupt = structuredClone(saved), growth = corrupt.extensions!.modules.growth as unknown as GrowthState;
            growth.pending = [{...valid,...mutation}];
            expect(isGrowthState(growth,pack)).toBe(false);expect(game.loadSnapshot(corrupt)).toBe(false);
            expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(stableWorld(game)).toEqual(before);
        }
    });
    it('does not overflow or duplicate a zero-valued quote receipt',()=> {
        const {game} = fixture(pack=>pack.config.experience.story.rewards[0]!.amount=0);create(game);
        const revision = state(game).revision;command(game);command(game);
        expect(progression(game).experience).toBe(0);expect(state(game).revision).toBe(revision);
        expect(state(game).storyReceipts).toEqual(['reward-test:growth.reward.review:chapter.one']);
    });
});

describe('EXT-2c public player query',()=> {
    it('publishes exactly the initialized player level and identities with a frozen DTO',()=> {
        const {game} = fixture();
        expect(()=>game.extensionRuntime!.queryOptional('growth.public-character.v1',{v:1})).toThrow();
        create(game);
        const before = game.extensionRuntime!.snapshot(), random = rng.getState();
        const result = game.extensionRuntime!.queryOptional('growth.public-character.v1',{v:1});
        expect(result).toEqual({status:'available',value:{level:1,professionId:null,lineageId:null,faithId:null}});
        expect(Object.isFrozen(result)).toBe(true);
        if (result.status === 'available') expect(Object.isFrozen(result.value)).toBe(true);
        expect(game.extensionRuntime!.queryOptional('growth.public-character.v1',{v:2})).toEqual({status:'unavailable',reason:'unsupported-input'});
        expect(game.extensionRuntime!.queryOptional('growth.public-character.v1',{v:1,actorId:99})).toEqual({status:'unavailable',reason:'unsupported-input'});
        expect(game.extensionRuntime!.snapshot()).toEqual(before);expect(rng.getState()).toEqual(random);
        command(game);
        expect(game.extensionRuntime!.queryOptional('growth.public-character.v1',{v:1})).toMatchObject({status:'available',value:{level:3}});
    });
    it('rejects malformed and extra private fields at the provider boundary',()=> {
        const {growth} = fixture(); const query = growth.optionalQueries!['growth.public-character.v1']!;
        const valid = {level:1,professionId:null,lineageId:null,faithId:null};
        expect(query.validate(valid)).toBe(true);
        for (const malformed of [{...valid,level:NaN},{...valid,level:0},{...valid,level:1.1},
            {...valid,level:999},{...valid,professionId:42},{...valid,faithId:'bad:id'},
            {...valid,templateId:'private-template'},{...valid,choices:[]}]) expect(query.validate(malformed)).toBe(false);
    });
});

// Cross-module coverage discovers the other installed package; removing its directory leaves all growth-only cases above intact.
const installedNarrative = catalog.getInstalledModuleDescriptors().find(descriptor=>descriptor.id === 'narrative');
const compositionCases = installedNarrative ? ['disabled','unsupported-key','ready'] as const : [];
function narrativeState(game: Game) {
    return game.extensionRuntime!.snapshot().modules.narrative as unknown as {
        revision: number; active: {sessionId: number;nodeId: string} | null; rewardReceipts: Json[];
    };
}
function realComposition(kind: 'disabled'|'unsupported-key'|'ready', reversed: boolean): Game {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.experience.sources.story = kind !== 'disabled';
    pack.config.experience.story.rewards = kind === 'unsupported-key' ? [] : [{id:'archive.read',amount:160,reasonKey:'ext.growth.level_gained'}];
    const parsed = parseGrowthDefinitionPack(pack,{moduleVersion:pack.moduleVersion,hasText:()=>true});
    const identity = {schema:1,version:pack.moduleVersion,fingerprint:extensionDataFingerprint(pack)};
    vi.spyOn(catalog,'createExtensionRegistry').mockImplementation(()=> {
        const registry = new ExtensionRegistry(), narrative = installedNarrative!;
        const register = {
            growth:()=>registry.register('growth',pack.moduleVersion,()=>createGrowthGameplay(parsed,identity),identity),
            narrative:()=>registry.register(narrative.id,narrative.version,narrative.create,narrative.rules),
        };
        for (const id of reversed ? ['narrative','growth'] as const : ['growth','narrative'] as const) register[id]();
        return registry;
    });
    const game = createHeadlessGame(8201,'test'), registry = catalog.createExtensionRegistry(), ids = ['growth','narrative'];
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(module=>module.initialCommand
        ? [JSON.stringify({module:module.id,...module.initialCommand})] : []);
    game.startNewGame({seed:8201,mode:'test',ruleSet:'extended',extensions:ids,initialCommands});
    game.animationEnabled = false;
    return game;
}
function converse(game: Game, action: string, fields: object): string {
    const input = JSON.stringify({module:'narrative',action,payload:{v:2,revision:narrativeState(game).revision,...fields}});
    while (logger.pendingAcknowledgment) logger.acknowledgeNext();
    game.executeCommand('ext:command',input);
    return input;
}
function projected(game: Game) {
    const snapshot = game.toSnapshot();
    return {player:snapshot.player,extensions:snapshot.extensions,rng:snapshot.rngState,turn:snapshot.run.absoluteTurnNumber,tick:snapshot.run.currentTick};
}
describe.each(compositionCases)('EXT-2c discovered narrative and growth %s',kind=> {
    it.each([false,true])('keeps choice, rewards, saves, replay and seek coherent with reverse registration=%s',reversed=> {
        const game = realComposition(kind,reversed), origin = structuredClone(initialRecordingCheckpoint(game));
        const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity=>entity.owner === 'narrative' && entity.contentId === 'archive.keeper')!;
        expect(target).toBeDefined();
        expect(Math.max(Math.abs(target.x-game.player.x),Math.abs(target.y-game.player.y))).toBeLessThanOrEqual(target.interactionDistance);
        const random = rng.getState(), turn = game.absoluteTurnNumber, tick = timeSystem.currentTick;
        converse(game,'open',{targetEntityId:target.id});
        const active = narrativeState(game).active!;
        const savedBefore = structuredClone(game.toSaveSnapshot());
        const choice = converse(game,'choose',{sessionId:active.sessionId,nodeId:active.nodeId,choiceId:'read-note'});
        const granted = kind === 'ready' ? 160 : 0;
        expect(progression(game).experience).toBe(granted);
        expect(state(game).pending).toEqual([]);
        expect(state(game).storyReceipts).toHaveLength(kind === 'ready' ? 1 : 0);
        expect(narrativeState(game).rewardReceipts).toHaveLength(1);
        const after = projected(game), count = game.recordedInputEvents.length;
        expect(game.recordedInputEvents[count-1]!.checkpoint!.domains.extensions).toBe(extensionDigest(after.extensions ?? null));
        game.executeCommand('ext:command',choice);
        expect(game.recordedInputEvents).toHaveLength(count);expect(projected(game)).toEqual(after);
        // Repeated checkpoint snapshots cannot flush or duplicate rewards.
        expect(extensionDigest(game.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(after));
        expect(extensionDigest(game.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(after));
        expect(rng.getState()).toEqual(random);expect(game.absoluteTurnNumber).toBe(turn);expect(timeSystem.currentTick).toBe(tick);
        const savedAfter = structuredClone(game.toSaveSnapshot());
        expect(game.loadSnapshot(savedAfter)).toBe(true);expect(projected(game)).toEqual(after);
        expect(game.loadSnapshot(savedBefore)).toBe(true);game.animationEnabled = false;
        converse(game,'choose',{sessionId:active.sessionId,nodeId:active.nodeId,choiceId:'read-note'});
        expect(projected(game)).toEqual(after);
        converse(game,'open',{targetEntityId:target.id});
        const again = narrativeState(game).active!;
        const reopen = projected(game), openCount = game.recordedInputEvents.length;
        converse(game,'choose',{sessionId:again.sessionId,nodeId:again.nodeId,choiceId:'read-note'});
        expect(game.recordedInputEvents).toHaveLength(openCount);expect(projected(game)).toEqual(reopen);
        converse(game,'close',{sessionId:again.sessionId});
        const recording = structuredClone(game.exportRecording()), final = projected(game);
        expect(game.hasCompleteRecording).toBe(true);expect(game.loadReplay(recording)).toBe(true);game.animationEnabled = false;
        for (const event of recording.events) {
            game.replayStep(true);expect(game.replayError).toBeNull();
            expect(extensionDigest(game.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(event));expect(rng.getState()).toEqual(event.rng);
        }
        expect(projected(game)).toEqual(final);
        for (const index of [0,1,2,3,recording.events.length]) {
            game.replaySeek(index);expect(game.replayError).toBeNull();expect(game.replayCursor).toBe(index);
            const expected = index ? recording.events[index-1]! : origin;
            expect(extensionDigest(game.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(expected));expect(rng.getState()).toEqual(expected.rng);
        }
    },30000);
});
