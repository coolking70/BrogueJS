import { describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../ext/registry';
import { ExtensionRuntime, type ExtensionPorts } from '../ext/runtime';
import { Creature } from '../entities/Creature';
import type { MonsterData } from '../entities/Monster';
import type { ExtensionModule, Json } from '../ext/types';
import { Game } from '../engine/Core/Game';
import { createHeadlessGame } from './harness';

const ports = (): ExtensionPorts => ({ depth: () => 1, playerId: () => 1, randomInt: vi.fn(() => 7), message: vi.fn() });
function probe(overrides: Partial<ExtensionModule> = {}): ExtensionModule {
    return { id: 'probe', version: '1.0.0', initialState: () => ({}),
        validateState: (v): v is Json => !!v && typeof v === 'object', ...overrides };
}
function runtime(module = probe(), p = ports()) {
    const registry = new ExtensionRegistry(); registry.register(module.id, module.version, () => module, module.rules);
    return new ExtensionRuntime(registry, registry.manifest([module.id]), p);
}
function creature(): Creature { return new Creature(1, 1, 'fixture', 'r', 1); }

describe('EXT-1a0 foundation versions and retained data', () => {
    it('binds complete data identity and foundation version before invoking any factory', () => {
        const registry = new ExtensionRegistry(), factory = vi.fn(() => probe({ rules: identity }));
        const identity = { schema: 1, version: '1.0.0', fingerprint: `sha256:${'a'.repeat(64)}` };
        registry.register('probe', '1.0.0', factory, identity);
        const header = registry.manifest(['probe']);
        expect(header.foundation).toBe(4); expect(factory).not.toHaveBeenCalled();
        for (const change of [
            (v: typeof header) => { delete v.foundation; },
            (v: typeof header) => { v.modules[0]!.rules!.version = '1.0.1'; },
            (v: typeof header) => { v.modules[0]!.rules!.fingerprint = `sha256:${'b'.repeat(64)}`; },
            (v: typeof header) => { delete v.modules[0]!.rules; },
        ]) {
            const invalid = structuredClone(header); change(invalid);
            expect(() => registry.create(invalid)).toThrow('mismatch');
            expect(factory).not.toHaveBeenCalled();
        }
        expect(registry.create(header)).toHaveLength(1);
        identity.fingerprint = `sha256:${'c'.repeat(64)}`;
        expect(registry.manifest(['probe'])).toEqual(header);
    });
    it('preserves reachable corpses and module receipts while releasing unreachable bodies at a safe boundary', () => {
        const kept = creature(), removed = creature();
        const r = runtime(probe({ onNewGame(context) {
            context.setState({ rewardReceipts: [removed.id] });
            context.setComponent(kept.id, 'level-data', { level: 2 });
            context.setComponent(removed.id, 'level-data', { level: 3 });
        } }));
        r.newGame(); r.attachCreature(kept); r.attachCreature(removed);
        const origin = r.causality.create('melee', kept.id);
        r.causality.withOrigin(origin, () => {
            r.causality.statusChanged(kept.id, 'poisoned', 0, 3);
            r.causality.statusChanged(removed.id, 'poisoned', 0, 3);
        });
        r.captureDeath(kept, false, origin); r.captureDeath(removed, false, null);
        r.collectComponents([kept]);
        const state = r.snapshot();
        expect(state.components[String(kept.id)]).toEqual({ 'probe:level-data': { level: 2 } });
        expect(state.components[String(removed.id)]).toBeUndefined();
        expect(state.modules.probe).toEqual({ rewardReceipts: [removed.id] });
        expect(state.foundation.deaths[String(removed.id)]).toBeUndefined();
        expect(state.foundation.causality.statusOrigins[String(kept.id)]).toBeDefined();
        expect(removed.extensionHooks).toBeUndefined();
        expect(kept.extensionHooks).toBeDefined();
    });
    it('validates source/death records atomically, without retiring a currently running game', () => {
        const game = createHeadlessGame(700, 'test');
        game.startNewGame({ seed: 700, mode: 'test', ruleSet: 'extended', extensions: [] });
        const original = game.extensionRuntime, player = game.player;
        const invalid = game.toSaveSnapshot();
        invalid.extensions!.foundation.causality.nextEffectId = 0;
        expect(game.loadSnapshot(invalid)).toBe(false);
        expect(game.extensionRuntime).toBe(original); expect(game.player).toBe(player);
        const missing = game.toSaveSnapshot();
        delete (missing.extensions as any).foundation;
        expect(game.loadSnapshot(missing)).toBe(false);
        expect(game.extensionRuntime).toBe(original);
        expect(Game.isSnapshot(invalid)).toBe(true); // Envelope shape is separate from extension validation.
    });
});

describe('EXT-1a0 staged facts and synchronous publication', () => {
    it('runs no speculative module work, discards nested failed births and commits each surviving ID once', () => {
        const calls: string[] = [], p = ports();
        const r = runtime(probe({ hooks: {
            creatureSpawned(event, context) { calls.push(`spawn:${event.creature.id}`); context.setComponent(event.creature.id, 'level-data', { level: 1 }); context.randomInt(1, 8); },
            playerTurnEnded() { calls.push('turn'); },
            generationRolledBack(_event, context) { expect(() => context.randomInt(1, 8)).toThrow('outside'); calls.push('rollback'); },
        } }), p);
        const a = creature(), b = creature(), discarded = creature();
        const root = r.beginGeneration('floor'); r.attachCreature(b); r.emit('playerTurnEnded', { turn: 1 });
        const nested = r.beginGeneration('blueprint'); r.attachCreature(discarded); r.rollbackGeneration(nested);
        r.attachCreature(a);
        expect(calls).toEqual([]); expect(p.randomInt).not.toHaveBeenCalled();
        expect(() => r.snapshot()).toThrow('open generation');
        r.commitGeneration(root);
        expect(calls).toEqual([`spawn:${a.id}`, `spawn:${b.id}`, 'turn', 'rollback']);
        expect(p.randomInt).toHaveBeenCalledTimes(2);
        expect(r.snapshot().components[String(discarded.id)]).toBeUndefined();
        expect(discarded.extensionHooks).toBeUndefined();
        r.attachCreature(a); expect(p.randomInt).toHaveBeenCalledTimes(2);
    });
    it('rejects out-of-order transaction closure and restores module state after publication throws', () => {
        const r = runtime(probe({ hooks: { creatureSpawned(_event, context) { context.setState({ leaked: true }); throw new Error('broken hook'); } } }));
        const baseline = r.snapshot(), root = r.beginGeneration('floor'), child = r.beginGeneration('child');
        expect(() => r.commitGeneration(root)).toThrow('LIFO');
        r.commitGeneration(child); r.attachCreature(creature());
        expect(() => r.commitGeneration(root)).toThrow('broken hook');
        r.rollbackGeneration(root);
        expect(r.snapshot()).toEqual(baseline);
        expect(() => r.rollbackGeneration(root)).toThrow('LIFO');
    });
});

describe('EXT-1a0 command-boundary collection', () => {
    it('keeps every mechanical root, but not an observation-only dead object', async () => {
        const catalog = await import('../ext/catalog');
        const { Monster } = await import('../entities/Monster');
        const data = (await import('../data/monsters.json')).default.find(entry => entry.id === 'rat')!;
        const module = probe({ hooks: { creatureSpawned(event, context) { context.setComponent(event.creature.id, 'level-data', { level: 1 }); } }, commands: { noop() {} } });
        const registry = new ExtensionRegistry(); registry.register('probe', '1.0.0', () => module);
        const spy = vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        try {
            const game = createHeadlessGame(700, 'test');
            game.startNewGame({ seed: 700, mode: 'test', ruleSet: 'extended', extensions: ['probe'] });
            const units = Array.from({ length: 7 }, (_, index) => new Monster(index + 2, 2, data as MonsterData));
            const [active, dormant, cached, fallen, corpse, passenger, observed] = units;
            for (const unit of units) game.extensionRuntime!.attachCreature(unit);
            active!.carriedMonster = passenger!;
            game.monsters = [active!]; game.dormantMonsters = [dormant!];
            (game as any).levels.set(2, { ...(game as any).activeLevelState(), monsters: [cached!], dormantMonsters: [] });
            (game as any).pendingFallenByDepth.set(3, [fallen!]);
            (game as any).purgatory = [corpse!]; corpse!.hp = 0;
            game.everSeenMonsters.add(observed!); observed!.hp = 0;
            game.executeCommand('ext:command', JSON.stringify({ module: 'probe', action: 'noop', payload: null }));
            const components = game.extensionRuntime!.snapshot().components;
            for (const unit of units.slice(0, 6)) expect(components[String(unit.id)]).toBeDefined();
            expect(components[String(observed!.id)]).toBeUndefined();
            expect(game.everSeenMonsters.has(observed!)).toBe(true);
            expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.extensions!.components).toEqual(components);
        } finally { spy.mockRestore(); }
    });
    it('finalizes animated checkpoints after collection and reproduces the same save/replay envelope', () => {
        const game = createHeadlessGame(701, 'test');
        game.startNewGame({ seed: 701, mode: 'test', ruleSet: 'extended', extensions: [] });
        game.animationEnabled = true;
        game.executeCommand('wait');
        expect(game.isAdvancing).toBe(true);
        const collector = vi.spyOn(game.extensionRuntime!, 'collectComponents');
        for (let i = 0; i < 100 && game.isAdvancing; i++) game.stepAdvancement();
        expect(game.isAdvancing).toBe(false); expect(collector).toHaveBeenCalled();
        const state = game.extensionRuntime!.snapshot();
        expect(game.recordedInputEvents[game.recordedInputEvents.length - 1]!.extensions).toEqual(state);
        const recording = game.exportRecording(), saved = game.toSaveSnapshot();
        const restored = createHeadlessGame(702, 'test');
        expect(restored.loadSnapshot(saved)).toBe(true); expect(restored.extensionRuntime!.snapshot()).toEqual(state);
        const replay = createHeadlessGame(703, 'test');
        expect(replay.loadReplay(recording)).toBe(true); replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(replay.extensionRuntime!.snapshot()).toEqual(state);
    });
});

describe('EXT-1a0 player terminal fact', () => {
    it('captures the fatal source once and does not reuse the monster kill event', () => {
        const game = createHeadlessGame(710, 'test');
        game.startNewGame({ seed: 710, mode: 'test', ruleSet: 'extended', extensions: [] });
        const r = game.extensionRuntime!, emit = vi.spyOn(r, 'emit');
        const source = r.causality.create('reprisal', 900, 900, null);
        r.causality.withOrigin(source, () => game.player.takeDamage(game.player.hp, true));
        game.triggerGameOver(false, 'fixture'); game.triggerGameOver(false, 'fixture');
        const deaths = emit.mock.calls.filter(([name]) => name === 'playerDied');
        expect(deaths).toHaveLength(1);
        expect(deaths[0]![1]).toMatchObject({ creature: { id: game.player.id, player: true, hp: 0 }, origin: source, administrative: false });
        expect(emit.mock.calls.some(([name]) => name === 'kill')).toBe(false);
        expect(r.snapshot().foundation.deaths[String(game.player.id)]!.origin).toEqual(source);
        expect(r.causality.current).toBeNull();
    });
});
