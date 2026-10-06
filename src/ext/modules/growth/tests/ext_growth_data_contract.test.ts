import { extensionDigest, checkpointExtensionDigest } from '../../../../test/support/recordingV4';
import { describe, expect, it, vi } from 'vitest';
import { ExtensionRegistry } from '../../../registry';
import * as catalog from '../../../catalog';
import { createGrowthContractModule } from '..';
import { createHeadlessGame } from '../../../../test/harness';

describe('EXT-1a0 opt-in data contract module', () => {
    it('records and restores the actual sample data identity without enabling growth gameplay', () => {
        // Historical 1a0 contract probe: explicit empty-state factory and its original versioned envelope.
        // Production growth gameplay/default selection is covered independently by ext_growth_runtime.
        const contract = createGrowthContractModule();
        const rules = { ...contract.rules!, version: '1.0.0' };
        const registry = new ExtensionRegistry();
        registry.register('growth', '1.0.0', () => ({ ...contract, version: '1.0.0', rules }), rules);
        const factory = vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
        try {
        const game = createHeadlessGame(704, 'test');
        game.startNewGame({ seed: 704, mode: 'test', ruleSet: 'extended', extensions: ['growth'] });
        const identity = game.extensionRuntime!.manifest.modules[0]!.rules!;
        expect(identity.schema).toBe(1); expect(identity.version).toBe('1.0.0');
        expect(identity.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
        game.executeCommand('wait');
        expect(game.extensionRuntime!.snapshot().modules.growth).toEqual({});
        expect(game.extensionRuntime!.snapshot().components).toEqual({});
        const saved = game.toSaveSnapshot(), recording = game.exportRecording();
        const original = game.extensionRuntime, player = game.player;
        const bad = structuredClone(saved); bad.extensions!.manifest.modules[0]!.rules!.fingerprint = `sha256:${'0'.repeat(64)}`;
        expect(game.loadSnapshot(bad)).toBe(false); expect(game.extensionRuntime).toBe(original); expect(game.player).toBe(player);
        const badReplay = structuredClone(recording); badReplay.extensions!.modules[0]!.rules!.version = '1.0.1';
        expect(game.loadReplay(badReplay)).toBe(false); expect(game.extensionRuntime).toBe(original);
        const restored = createHeadlessGame(705, 'test'); expect(restored.loadSnapshot(saved)).toBe(true);
        expect(restored.extensionRuntime!.manifest.modules[0]!.rules).toEqual(identity);
        const replay = createHeadlessGame(706, 'test'); expect(replay.loadReplay(recording)).toBe(true); replay.replayStep(true);
        expect(replay.replayError).toBeNull(); expect(extensionDigest(replay.extensionRuntime!.snapshot() ?? null)).toBe(checkpointExtensionDigest(saved));
        } finally { factory.mockRestore(); }
    });
    it('rejects invalid local data before retiring the previous live run', async () => {
        const data = (await import('../data/definitions.json')).default;
        const game = createHeadlessGame(708, 'test');
        game.startNewGame({ seed: 708, mode: 'test', ruleSet: 'extended' });
        const previous = game.extensionRuntime, player = game.player, seed = game.currentSeed;
        const oldCap = data.config.levels.cap;
        try {
            data.config.levels.cap = 0;
            expect(() => game.startNewGame({ seed: 709, mode: 'test', ruleSet: 'extended', extensions: ['growth'] })).toThrow();
            expect(game.extensionRuntime).toBe(previous); expect(game.player).toBe(player); expect(game.currentSeed).toBe(seed);
            expect(game.player.extensionHooks).toBeDefined();
        } finally { data.config.levels.cap = oldCap; }
    });
    it('never loads or fingerprints growth data in a classic new game or command', async () => {
        const data = await import('../definitions');
        const load = vi.spyOn(data, 'loadGrowthDefinitionPack'), identity = vi.spyOn(data, 'getGrowthPackIdentity');
        try {
            const classic = createHeadlessGame(707, 'test'); classic.executeCommand('wait');
            expect(load).not.toHaveBeenCalled(); expect(identity).not.toHaveBeenCalled();
            expect(classic.extensionRuntime).toBeNull(); expect(classic.toSnapshot().extensions).toBeUndefined();
        } finally { load.mockRestore(); identity.mockRestore(); }
    });
});

