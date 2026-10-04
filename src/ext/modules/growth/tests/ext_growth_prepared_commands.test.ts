import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { TerrainType as T, DungeonLayer as L } from '../../../../engine/Map/Grid';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { createGrowthGameplay } from '../module';
import { parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack } from '../types';
import type { GrowthState } from '../state';
import data from '../data/definitions.json';
import { extensionDataFingerprint } from '../../../../ext/fingerprint';
import { ExtensionRegistry } from '../../../../ext/registry';
import * as catalog from '../../../../ext/catalog';

const seed = 671234;
const skillId = (name: string) => `growth.skill.${name}`;
const state = (game: Game) => game.extensionRuntime!.snapshot().modules.growth as unknown as GrowthState;
function configured() {
    const pack = structuredClone(data) as unknown as GrowthDefinitionPack;
    pack.config.levels.attributePoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 20 };
    pack.config.levels.skillPoints = { kind: 'periodic', firstLevel: 1, every: 1, amount: 30 };
    pack.config.experience.sources.firstVisits = false;
    // Preserve ephemeral gas until the skill under test, rather than spending a setup turn.
    pack.config.skills.equipTime = 'none';
    const parsed = parseGrowthDefinitionPack(pack, { moduleVersion: pack.moduleVersion, hasText: () => true });
    const identity = { schema: 1, version: pack.moduleVersion, fingerprint: extensionDataFingerprint(pack) };
    vi.spyOn(catalog, 'createExtensionRegistry').mockImplementation(() => {
        const registry = new ExtensionRegistry();
        registry.register('growth', pack.moduleVersion, () => createGrowthGameplay(parsed, identity), identity);
        return registry;
    });
}
function finish(game: Game) {
    for (let step = 0; step < 200 && game.isAdvancing; step++) game.stepAdvancement();
    expect(game.isAdvancing).toBe(false);
    expect(game.lastAdvancementError).toBeNull();
}
function commandData(game: Game, action: string, payload: Record<string, unknown>) {
    return JSON.stringify({ module: 'growth', action, payload: { revision: state(game).revision, ...payload } });
}
function command(game: Game, action: string, payload: Record<string, unknown>) {
    game.executeCommand('ext:command', commandData(game, action, payload));
    finish(game);
}
function room(game: Game) {
    game.monsters = []; game.dormantMonsters = []; game.items = [];
    game.visibleMonsters.clear(); game.visibleItems.clear();
    for (let x = 0; x < game.grid.width; x++) for (let y = 0; y < game.grid.height; y++) {
        game.grid.setTerrain(x, y, x >= 8 && x <= 16 && y >= 8 && y <= 12 ? T.FLOOR : T.GRANITE);
        const cell = game.grid.getCell(x, y)!;
        Object.assign(cell, { hasMemory: true, isVisible: true, isExplored: true,
            isClairvoyantVisible: false, isMagicMapped: false, isDiscovered: false,
            machineNumber: 0, rememberedLayers: [...cell.layers] });
    }
    game.player.loc = { x: 10, y: 10 };
    game.player.equippedWeapon = null; game.player.equippedArmor = null;
    game.animationEnabled = false;
}
function enemy(game: Game, acid: boolean, ally = false, x = 11, y = 10) {
    const target = new Monster(x, y, { ...monsters.find(row => row.id === (acid ? 'acid_mound' : 'monkey'))!, hp: 500, defense: 0 } as MonsterData);
    target.state = MonsterState.ASLEEP; target.ticksUntilTurn = 10000;
    target.isAlly = ally;
    if (ally) target.setStatusDuration('discordant', 100);
    game.monsters.push(target);
    return target;
}
function equip(game: Game, id = 'sword') {
    const weapon = ItemLoader.spawnWeapon(id, -1, -1)!;
    Object.assign(weapon, { enchantment: 0, runicType: undefined, runicKnown: false, isProtected: false });
    game.player.inventory.addItem(weapon); game.player.equippedWeapon = weapon;
}
interface Scenario { name: string; setup(game: Game): void; skill: string; messages: string[] }
const risks: Scenario[] = [
    { name: 'fire', skill: 'withdraw', setup(game) { game.grid.setTerrain(11, 10, T.PLAIN_FIRE); }, messages: ['Venture into flame?'] },
    { name: 'gas', skill: 'withdraw', setup(game) { game.grid.setTerrain(11, 10, T.CONFUSION_GAS); }, messages: ['Venture into dangerous gas?'] },
    { name: 'chasm', skill: 'withdraw', setup(game) { game.grid.setTerrain(11, 10, T.CHASM); game.grid.getCell(11, 10)!.isDiscovered = true; }, messages: ['Dive into the depths?'] },
    { name: 'plate', skill: 'withdraw', setup(game) { game.grid.setTerrain(11, 10, T.PRESSURE_PLATE); }, messages: ['Step onto the pressure plate?'] },
    { name: 'acid', skill: 'measured-strike', setup(game) { enemy(game, true); equip(game); }, messages: ['Degrade your'] },
    { name: 'discordant ally', skill: 'measured-strike', setup(game) { enemy(game, false, true); }, messages: ['Are you sure you want to attack'] },
];
const twoQuestions: Scenario = { name: 'acid discordant ally', skill: 'measured-strike',
    setup(game) { enemy(game, true, true); equip(game); }, messages: ['Degrade your', 'Are you sure you want to attack'] };
const moveChain: Scenario = { name: 'layered hazards', skill: 'withdraw', setup(game) {
    game.grid.setTerrainLayer(11, 10, L.LIQUID, T.CHASM);
    game.grid.getCell(11, 10)!.isDiscovered = true;
    game.grid.setTerrainLayer(11, 10, L.SURFACE, T.PLAIN_FIRE);
    game.grid.setTerrainLayer(11, 10, L.GAS, T.CONFUSION_GAS);
    game.grid.setTerrainLayer(11, 10, L.DUNGEON, T.PRESSURE_PLATE);
}, messages: ['Dive into the depths?', 'Venture into flame?', 'Venture into dangerous gas?', 'Step onto the pressure plate?'] };
function scene(scenario: Scenario) {
    const game = createHeadlessGame(seed, 'test');
    const start = game.startNewGame.bind(game);
    // Replaying the actual recorded character-creation prefix reproduces the same
    // scene; no synthetic events or post-load mutation repair the replay world.
    vi.spyOn(game, 'startNewGame').mockImplementation(options => { start(options); room(game); scenario.setup(game); });
    game.startNewGame({ seed, mode: 'test', ruleSet: 'extended' });
    command(game, 'create-character', { revision: 0 });
    command(game, 'allocate', { attributes: { 'growth.attribute.agility': 2 } });
    command(game, 'learn-skill', { skillId: skillId('withdraw') });
    command(game, 'learn-skill', { skillId: skillId('measured-strike') });
    command(game, 'equip-skills', { active: [skillId('withdraw'), skillId('measured-strike')], passive: [] });
    return game;
}
function use(game: Game, scenario: Scenario) {
    const target = scenario.skill === 'withdraw' ? { kind: 'cell', x: 11, y: 10 }
        : { kind: 'creature', id: game.monsters[0]!.id };
    game.executeCommand('ext:command', commandData(game, 'use-skill', { skillId: skillId(scenario.skill), target }));
}
/** Raw world fields plus the read-only extension snapshot, never Game.toSnapshot while pending. */
function world(game: Game) {
    return structuredClone({ extensions: game.extensionRuntime!.snapshot(), rng: rng.getState(),
        tick: timeSystem.currentTick, turn: game.absoluteTurnNumber, depth: game.depth,
        loc: game.player.loc, hp: game.player.hp, maxHp: game.player.maxHp,
        nutrition: game.player.nutrition, status: game.player.statusDurations,
        stats: game.stats,
        inventory: game.player.inventory.items.map(item => ({ id: item.id, quantity: item.quantity,
            charges: item.charges, enchantment: item.enchantment, letter: item.inventoryLetter })),
        equipment: [game.player.equippedWeapon?.id, game.player.equippedArmor?.id],
        monsters: game.monsters.map(monster => ({ id: monster.id, hp: monster.hp, loc: monster.loc,
            ally: monster.isAlly, status: monster.statusDurations })),
        cells: Array.from({ length: game.grid.width }, (_, x) => Array.from({ length: game.grid.height }, (_, y) => game.grid.getCell(x, y)!.layers)),
    });
}
function answer(game: Game, decision: boolean) {
    const pending = game.pendingCommandConfirmation!;
    expect(pending).not.toBeNull(); expect(Object.isFrozen(pending)).toBe(true);
    expect(game.resolveCommandDecision(pending.token, decision)).toBe(true);
    expect(game.resolveCommandDecision(pending.token, !decision)).toBe(false);
}
function captureQuestions(game: Game) {
    const questions: string[] = [];
    game.onCommandConfirmRequest = () => {
        if (game.pendingCommandConfirmation) questions.push(game.pendingCommandConfirmation.message);
    };
    return questions;
}
function replayToEnd(game: Game, count: number) {
    for (let step = 0; step < count && game.replayCursor < count && !game.replayError; step++) game.replayStep(true);
    finish(game);
    expect(game.replayError).toBeNull(); expect(game.replayCursor).toBe(count);
    expect(game.pendingCommandConfirmation).toBeNull();
}
afterEach(() => vi.restoreAllMocks());

describe('growth prepared controlled commands keep Runtime.command synchronous and exactly once', () => {
    for (const scenario of risks) it.each([false, true])(`${scenario.name}: answer %s matches native synchronous world, RNG and growth cost`, decision => {
        configured();
        const sync = scene(scenario), ask = vi.fn(() => decision);
        sync.onConfirmRequest = ask; use(sync, scenario); finish(sync);
        expect(ask).toHaveBeenCalledTimes(1);
        const expected = world(sync);
        const game = scene(scenario), before = world(game), count = game.recordedInputEvents.length;
        const runtimeCommand = vi.spyOn(game.extensionRuntime!, 'command');
        const prefix = vi.spyOn(game as unknown as { finishTransientDisplay(): void }, 'finishTransientDisplay');
        game.onCommandConfirmRequest = () => {};
        game.onConfirmRequest = () => { throw new Error('Suspended commands must consume supplied answers'); };
        use(game, scenario);
        expect(game.pendingCommandConfirmation?.message).toContain(scenario.messages[0]);
        expect(runtimeCommand).not.toHaveBeenCalled();
        expect(world(game)).toEqual(before); expect(game.recordedInputEvents).toHaveLength(count);
        expect(game.extensionRuntime!.readyToSave).toBe(true);
        expect(() => game.toSaveSnapshot()).toThrow('during a command');
        expect(() => game.exportRecording()).toThrow('during a command');
        const prefixCount = prefix.mock.calls.length;
        game.executeCommand('wait'); game.tickAdvancement(100000);
        expect(world(game)).toEqual(before); expect(runtimeCommand).not.toHaveBeenCalled();
        answer(game, decision); finish(game);
        expect(runtimeCommand).toHaveBeenCalledTimes(1);
        expect(game.hasPendingConfirmation).toBe(false);
        if (scenario.name !== 'chasm' || !decision) expect(prefix).toHaveBeenCalledTimes(prefixCount);
        expect(world(game)).toEqual(expected);
        if (!decision) expect(world(game)).toEqual(before);
        expect(game.recordedInputEvents).toHaveLength(count + 1);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual([decision]);
        const recording = game.exportRecording();
        const replayQuestions = captureQuestions(game);
        expect(game.loadReplay(recording)).toBe(true);
        replayToEnd(game, recording.events.length); expect(world(game)).toEqual(expected);
        game.replaySeek(count); replayToEnd(game, recording.events.length); expect(world(game)).toEqual(expected);
        expect(replayQuestions).toEqual([]);
    });

    it.each([{ decisions: [false] }, { decisions: [true, false] }, { decisions: [true, true] }])('acid→ally questions consume answers $decisions once, with no cost before final approval', ({ decisions }) => {
        configured();
        const sync = scene(twoQuestions); let cursor = 0;
        sync.onConfirmRequest = () => decisions[cursor++]!;
        use(sync, twoQuestions); finish(sync); expect(cursor).toBe(decisions.length);
        const expected = world(sync);
        const game = scene(twoQuestions), before = world(game);
        const runtimeCommand = vi.spyOn(game.extensionRuntime!, 'command');
        game.onCommandConfirmRequest = () => {};
        game.onConfirmRequest = () => { throw new Error('unexpected synchronous UI callback'); };
        use(game, twoQuestions);
        for (let index = 0; index < decisions.length; index++) {
            expect(game.pendingCommandConfirmation?.message).toContain(twoQuestions.messages[index]);
            expect(runtimeCommand).not.toHaveBeenCalled(); expect(world(game)).toEqual(before);
            answer(game, decisions[index]!);
        }
        finish(game); expect(game.hasPendingConfirmation).toBe(false);
        expect(runtimeCommand).toHaveBeenCalledTimes(1);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual(decisions);
        expect(world(game)).toEqual(expected);
        if (decisions.includes(false)) expect(world(game)).toEqual(before);
    });

    for (const weapon of ['whip', 'spear', 'axe']) {
        it.each([{ decisions: [false] }, { decisions: [true, false] }, { decisions: [true, true] }])(`${weapon}: measured-strike keeps whole-hit-list risks and answers $decisions`, ({ decisions }) => {
            configured();
            const scenario: Scenario = { name: weapon, skill: 'measured-strike', messages: twoQuestions.messages,
                setup(game) {
                    if (weapon === 'whip') {
                        enemy(game, true, true); enemy(game, false, false, 12, 10);
                    } else {
                        // The explicitly selected primary is harmless. Both questions
                        // belong to a secondary target in the native spear/sweep list.
                        enemy(game, false);
                        enemy(game, true, true, weapon === 'axe' ? 10 : 12, weapon === 'axe' ? 11 : 10);
                    }
                    equip(game, weapon);
                } };
            const sync = scene(scenario); let cursor = 0;
            sync.onConfirmRequest = () => decisions[cursor++]!;
            use(sync, scenario); finish(sync); expect(cursor).toBe(decisions.length);
            const expected = world(sync), game = scene(scenario), before = world(game);
            const runtimeCommand = vi.spyOn(game.extensionRuntime!, 'command');
            const attack = vi.spyOn(CombatSystem, 'attack');
            const approvedTargets = (weapon === 'whip' ? game.monsters.slice(0, 1) : game.monsters).map(target => target.id).sort((a, b) => a - b);
            game.onCommandConfirmRequest = () => {}; use(game, scenario);
            for (let index = 0; index < decisions.length; index++) {
                expect(game.pendingCommandConfirmation?.message).toContain(scenario.messages[index]);
                expect(runtimeCommand).not.toHaveBeenCalled(); expect(attack).not.toHaveBeenCalled();
                expect(world(game)).toEqual(before); answer(game, decisions[index]!);
            }
            finish(game); expect(game.hasPendingConfirmation).toBe(false);
            expect(runtimeCommand).toHaveBeenCalledTimes(1);
            expect(attack.mock.calls.filter(([actor]) => actor === game.player).map(([, target]) => target.id).sort((a, b) => a - b))
                .toEqual(decisions.includes(false) ? [] : approvedTargets);
            expect(world(game)).toEqual(expected);
            if (decisions.includes(false)) expect(world(game)).toEqual(before);
            expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual(decisions);
            attack.mockRestore();
            const recording = game.exportRecording(), replayQuestions = captureQuestions(game);
            expect(game.loadReplay(recording)).toBe(true); replayToEnd(game, recording.events.length);
            expect(world(game)).toEqual(expected); expect(replayQuestions).toEqual([]);
        });
    }

    for (const weapon of ['rapier', 'flail']) it.each([false, true])(`withdraw with ${weapon} confirms its acidic movement attack, answer %s`, decision => {
        configured();
        const scenario: Scenario = { name: weapon, skill: 'withdraw', messages: ['Degrade your'],
            setup(game) { enemy(game, true, false, weapon === 'rapier' ? 12 : 11, weapon === 'rapier' ? 10 : 11); equip(game, weapon); } };
        const sync = scene(scenario), ask = vi.fn(() => decision);
        sync.onConfirmRequest = ask; use(sync, scenario); finish(sync);
        expect(ask).toHaveBeenCalledTimes(1);
        const expected = world(sync), game = scene(scenario), before = world(game);
        const runtimeCommand = vi.spyOn(game.extensionRuntime!, 'command');
        const attack = vi.spyOn(CombatSystem, 'attack');
        game.onCommandConfirmRequest = () => {}; use(game, scenario);
        expect(game.pendingCommandConfirmation?.message).toContain('Degrade your');
        expect(runtimeCommand).not.toHaveBeenCalled(); expect(attack).not.toHaveBeenCalled();
        expect(world(game)).toEqual(before); answer(game, decision); finish(game);
        expect(runtimeCommand).toHaveBeenCalledTimes(1);
        expect(attack.mock.calls.filter(([actor]) => actor === game.player)).toHaveLength(decision ? 1 : 0);
        expect(game.player.loc).toEqual({ x: decision ? 11 : 10, y: 10 });
        expect(world(game)).toEqual(expected);
        if (!decision) expect(world(game)).toEqual(before);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual([decision]);
        attack.mockRestore();
        const recording = game.exportRecording(), replayQuestions = captureQuestions(game);
        expect(game.loadReplay(recording)).toBe(true); replayToEnd(game, recording.events.length);
        expect(world(game)).toEqual(expected); expect(replayQuestions).toEqual([]);
    });

    it.each([0, 1, 2, 3, 4])('withdraw risk chain refuses at %s without consuming action IDs, focus, cooldown, effects or time', stop => {
        configured();
        const sync = scene(moveChain); let cursor = 0;
        sync.onConfirmRequest = () => cursor++ !== stop; use(sync, moveChain); finish(sync);
        const expected = world(sync), game = scene(moveChain), before = world(game);
        const runtimeCommand = vi.spyOn(game.extensionRuntime!, 'command');
        game.onCommandConfirmRequest = () => {}; use(game, moveChain);
        const decisions: boolean[] = [];
        for (let index = 0; index < moveChain.messages.length && game.hasPendingConfirmation; index++) {
            expect(game.pendingCommandConfirmation?.message).toBe(moveChain.messages[index]);
            expect(runtimeCommand).not.toHaveBeenCalled(); expect(world(game)).toEqual(before);
            decisions.push(index !== stop); answer(game, index !== stop);
        }
        finish(game); expect(decisions).toHaveLength(Math.min(stop + 1, 4));
        expect(runtimeCommand).toHaveBeenCalledTimes(1);
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.decisions).toEqual(decisions);
        expect(world(game)).toEqual(expected);
        if (stop < 4) expect(world(game)).toEqual(before);
    });
});

describe('growth prepared confirmation stale guards and durable recorder', () => {
    it.each(['growth revision', 'target', 'runtime', 'RNG'] as const)('rejects stale %s without running the queued Runtime.command', kind => {
        configured(); const game = scene(twoQuestions), runtime = game.extensionRuntime!;
        const notify = vi.fn(); game.onCommandConfirmRequest = notify; use(game, twoQuestions);
        const token = game.pendingCommandConfirmation!.token, count = game.recordedInputEvents.length;
        if (kind === 'growth revision') {
            const { extensions: priorExtension, ...priorNative } = world(game);
            runtime.command(commandData(game, 'learn-skill', { skillId: skillId('hold-breath') }));
            const { extensions: changedExtension, ...changedNative } = world(game);
            expect(changedNative).toEqual(priorNative);
            expect((changedExtension.modules.growth as unknown as GrowthState).revision)
                .toBe((priorExtension.modules.growth as unknown as GrowthState).revision + 1);
        }
        if (kind === 'target') game.monsters[0]!.loc = { x: 12, y: 10 };
        if (kind === 'runtime') {
            // Same manifest, IDs and snapshot; replacing only runtime identity is stale.
            const replacement = (game as unknown as { createExtensionRuntime(manifest: typeof runtime.manifest, snapshot: ReturnType<typeof runtime.snapshot>): typeof runtime })
                .createExtensionRuntime(runtime.manifest, runtime.snapshot());
            game.extensionRuntime = replacement;
        }
        if (kind === 'RNG') rng.randRange(0, 100);
        const changed = world(game), oldCommand = vi.spyOn(runtime, 'command');
        const newCommand = game.extensionRuntime !== runtime ? vi.spyOn(game.extensionRuntime!, 'command') : oldCommand;
        expect(game.resolveCommandDecision(token, true)).toBe(true);
        expect(game.resolveCommandDecision(token, false)).toBe(false);
        expect(game.hasPendingConfirmation).toBe(false);
        expect(oldCommand).not.toHaveBeenCalled(); expect(newCommand).not.toHaveBeenCalled();
        expect(world(game)).toEqual(changed); expect(game.recordedInputEvents).toHaveLength(count);
        expect(game.hasCompleteRecording).toBe(false);
        expect(notify).toHaveBeenLastCalledWith('The situation has changed. Please enter the command again.');
    });

    it.each([false, true])('replay, seek and saved continued recording preserve a two-question answer %s with zero OOS', approve => {
        configured(); const game = scene(twoQuestions);
        game.onCommandConfirmRequest = () => {}; use(game, twoQuestions); answer(game, true); answer(game, approve); finish(game);
        const expected = world(game), recording = game.exportRecording(), saved = game.toSaveSnapshot();
        expect(recording.events[recording.events.length - 1]!.decisions).toEqual([true, approve]);
        const replayQuestions = captureQuestions(game);
        expect(game.loadReplay(recording)).toBe(true); replayToEnd(game, recording.events.length); expect(world(game)).toEqual(expected);
        game.replaySeek(2); replayToEnd(game, recording.events.length); expect(world(game)).toEqual(expected);
        expect(game.loadSnapshot(saved)).toBe(true); expect(world(game)).toEqual(expected);
        const prefix = game.recordedInputEvents.length;
        game.executeCommand('wait'); finish(game);
        expect(game.hasCompleteRecording).toBe(true); expect(game.recordedInputEvents).toHaveLength(prefix + 1);
        const continued = game.exportRecording(), final = world(game);
        expect(game.loadReplay(continued)).toBe(true); replayToEnd(game, continued.events.length); expect(world(game)).toEqual(final);
        expect(replayQuestions).toEqual([]);
    });

    it.each(['missing', 'surplus'] as const)('replay rejects %s recorded decisions instead of asking the UI', kind => {
        configured(); const game = scene(twoQuestions);
        game.onCommandConfirmRequest = () => {}; use(game, twoQuestions); answer(game, true); answer(game, false);
        const recording = game.exportRecording(), finalIndex = recording.events.length - 1;
        recording.events[finalIndex]!.decisions = kind === 'missing' ? [true] : [true, false, true];
        const replayQuestions = captureQuestions(game);
        expect(game.loadReplay(recording)).toBe(true);
        for (let index = 0; index < recording.events.length && !game.replayError; index++) game.replayStep(true);
        expect(game.replayError).toContain(`OOS at command ${finalIndex + 1}`);
        expect(game.replayCursor).toBe(finalIndex); expect(game.hasPendingConfirmation).toBe(false);
        expect(replayQuestions).toEqual([]);
    });
});
