import type { Game } from '../../../../engine/Core/Game';
import { canSeeMonster } from '../../../../engine/UI/MonsterVisibility';
import { timeSystem } from '../../../../engine/Systems/Time';
import { presentationTimeline } from '../../../../ui/presentationTimeline';
import { readPublicCombatTelegraphs } from '../../../../ui/combatDrawing';

const activeTraces = new WeakMap<object, { stop: () => unknown }>();

/** Opt-in DEV observation only. Never drives a frame, command, RNG, or clock.
 * The bounded trace adds observation overhead; it is not an FPS benchmark. */
export function createCombatDiagnosticTrace(game: Game) {
    if (!import.meta.env.DEV) throw new Error('Combat diagnostics require a development build');
    const runtime = game.extensionRuntime;
    if (!runtime?.actorActionBinding()) throw new Error('Combat diagnostics require an active combat run');
    activeTraces.get(runtime)?.stop();
    const identities = new WeakMap<object, number>();
    let nextIdentity = 1, frame = 0, running = true, frameHandle: number | undefined;
    const identity = (value: object) => {
        let id = identities.get(value);
        if (!id) { id = nextIdentity++; identities.set(value, id); }
        return id;
    };
    const facts: { sourceEntityId: number; targetEntityId: number; depth: number; frame: number }[] = [];
    let defendedCount = 0;
    const original = runtime.notifyActorParried;
    const observed: typeof original = function (this: typeof runtime, ...args) {
        const result = original.apply(this, args); // Preserve receiver, arguments, return and native throws.
        if (!running) return result;
        defendedCount++;
        facts.push({ sourceEntityId: args[0], targetEntityId: args[1], depth: args[2], frame });
        if (facts.length > 256) facts.shift();
        return result;
    };
    runtime.notifyActorParried = observed;
    function snapshot() {
        // Every sample reacquires the runtime state and bundle list. Old snapshots
        // are detached evidence, never a live source of the next sample.
        const state = game.extensionRuntime?.actorActionBinding()?.state;
        const timeline = presentationTimeline(game);
        const bundles = state?.scheduler.bundles ?? [];
        return {
            frame, running, activeGameMatches: typeof window === 'undefined' ? null
                : (window as Window & { activeGame?: Game }).activeGame === game, sameRuntime: game.extensionRuntime === runtime,
            tick: timeSystem.currentTick, turn: game.absoluteTurnNumber, animationEnabled: game.animationEnabled,
            isAdvancing: game.isAdvancing, inputLocked: game.isInputLocked(), error: String(game.lastAdvancementError ?? ''),
            player: { id: game.player.id, x: game.player.x, y: game.player.y, hp: game.player.hp, ticksUntilTurn: game.player.ticksUntilTurn },
            resources: state?.actors.map(row => ({ ...row })) ?? [],
            bundles: bundles.map(bundle => ({ ...bundle, objectIdentity: identity(bundle),
                subactions: bundle.subactions.map(source => ({ ...source, phases: source.phases.map(phase => ({ ...phase })) })) })),
            sources: [...new Set(bundles.flatMap(bundle => bundle.subactions.map(source => source.sourceEntityId)))].map(id => {
                const source = game.monsters.find(monster => monster.id === id);
                return { id, nativeMember: !!source, objectIdentity: source ? identity(source) : null,
                    typeId: source?.typeId, spatial: source?.spatial ?? null, hp: source?.hp, x: source?.x, y: source?.y, ticksUntilTurn: source?.ticksUntilTurn,
                    visible: source ? canSeeMonster(game.player, game.grid, source) : null,
                    anchorCellVisible: source ? !!game.grid.getCell(source.x, source.y)?.isVisible : null };
            }),
            liveTelegraphs: readPublicCombatTelegraphs(game),
            displayedTelegraphs: timeline?.projection?.telegraphs ?? null,
            presentation: timeline?.diagnostics ?? null, defendedCount,
        };
    }
    type Sample = ReturnType<typeof snapshot> & { wallTimeMs: number };
    const samples: Sample[] = [];
    function sample(wallTimeMs: number) {
        if (!running) return;
        frame++;
        samples.push(JSON.parse(JSON.stringify({ ...snapshot(), wallTimeMs })) as Sample);
        if (samples.length > 256) samples.shift();
        if (typeof requestAnimationFrame === 'function') frameHandle = requestAnimationFrame(sample);
    }
    const read = () => JSON.parse(JSON.stringify({ current: snapshot(), samples, defendedFacts: facts }));
    const stop = () => {
        running = false;
        if (frameHandle !== undefined && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frameHandle);
        if (runtime.notifyActorParried === observed) runtime.notifyActorParried = original;
        if (activeTraces.get(runtime)?.stop === stop) activeTraces.delete(runtime);
        return read();
    };
    activeTraces.set(runtime, { stop });
    if (typeof requestAnimationFrame === 'function') frameHandle = requestAnimationFrame(sample);
    return { read, stop };
}
