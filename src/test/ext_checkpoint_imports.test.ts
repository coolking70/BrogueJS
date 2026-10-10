import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => vi.resetModules());

// Each entry starts with an empty module cache; no Game/harness preload may
// make a Creature -> stats -> generation -> Player initialization cycle pass.
it.each([
    ['Creature', () => import('../entities/Creature')],
    ['NativeStatSources', () => import('../engine/Stats/NativeStatSources')],
    ['Runtime', () => import('../ext/runtime')],
    ['WorldCheckpoint', () => import('../engine/Core/WorldCheckpoint')],
    ['GenerationCoordinator', () => import('../engine/Core/GenerationCoordinator')],
    ['Game', () => import('../engine/Core/Game')],
] as const)('loads %s first without an entity initialization cycle', async (_name, load) => {
    vi.resetModules();
    await load();
    const { Creature } = await import('../entities/Creature');
    const { Player } = await import('../entities/Player');
    const { Monster } = await import('../entities/Monster');
    const { ExtensionRuntime } = await import('../ext/runtime');
    expect(Object.getPrototypeOf(Player.prototype)).toBe(Creature.prototype);
    expect(Object.getPrototypeOf(Monster.prototype)).toBe(Creature.prototype);
    expect(typeof ExtensionRuntime.prototype.checkpointNativeStatSession).toBe('function');
});

it('keeps the old checkpoint entry as the same functions, without wrapping recovery', async () => {
    vi.resetModules();
    const light = await import('../engine/Core/WorldCheckpoint');
    const legacy = await import('../engine/Core/GenerationCoordinator');
    expect(legacy.checkpointGenerationWorld).toBe(light.checkpointGenerationWorld);
    expect(legacy.checkpointGenerationWorldGroups).toBe(light.checkpointGenerationWorldGroups);
});
