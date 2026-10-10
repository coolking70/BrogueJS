import { expect, vi } from 'vitest';
import * as catalog from '../../../catalog';
import { FOUNDATION_PROTOCOL, registryFromDescriptors, type ModuleDescriptor } from '../../../descriptor';
import type { ExtensionContext, ExtensionModule, Json, OptionalRewardPrepareContext, OptionalRewardPreparation, OptionalRewardRequest, ReadonlyJson } from '../../../types';
import { createHeadlessGame } from '../../../../test/harness';
import type { Game } from '../../../../engine/Core/Game';
import { logger } from '../../../../engine/Systems/Logger';
import { rng } from '../../../../engine/Random';
import { createNarrativeModuleFromPack } from '../module';
import { loadNarrativePack } from '../schema';
import type { NarrativePack } from '../types';
import type { NarrativeState } from '../state';
import { buildNarrativeUiCommand, readNarrativeUiView } from '../ui/view';
import definitions from '../data/definitions.json';
import portraits from '../data/portraits.json';
import locale from '../locales/zh_CN.json';

export const N2_CASES = [
    { npc: 'cord.mender', name: '缝绳人', a: 'splice', b: 'sever', reward: 'cord.settled', clueNpc: 'archive.keeper' },
    { npc: 'cistern.listener', name: '听水员', a: 'mark', b: 'erase', reward: 'cistern.settled', clueNpc: 'cord.mender' },
    { npc: 'bone.clerk', name: '拾骨书记', a: 'blank', b: 'number', reward: 'bone.settled', clueNpc: 'archive.keeper' },
    { npc: 'salt.warden', name: '盐灯看守', a: 'share', b: 'keep', reward: 'salt.settled', clueNpc: 'cistern.listener' },
    { npc: 'letter.carrier', name: '末班递信人', a: 'return', b: 'wait', reward: 'letter.settled', clueNpc: 'bone.clerk' },
] as const;
export type N2Case = typeof N2_CASES[number];
export const clone = <T>(value: T): T => structuredClone(value);
export const acknowledge = () => { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); };
export const narrative = (game: Game) => game.extensionRuntime!.snapshot().modules.narrative as unknown as NarrativeState;
export const translate = (key: string): string => { const value = (locale as Record<string, string>)[key]; expect(value, key).toBeTypeOf('string'); return value!; };

/** DIAGNOSTIC ONLY: all production dialogue/effects/conditions/flags/budgets are
 * unchanged. Selected NPCs use their original placement with depth 1..1; other
 * NPC placements are empty. No runtime state is injected or rewritten. This
 * fixture does NOT prove production depth ranges or natural-route coverage. */
export function diagnosticPack(npcIds: readonly string[], change?: (raw: typeof definitions) => void): NarrativePack {
    const raw = clone(definitions);
    for (const npc of raw.npcs) npc.placements = npcIds.includes(npc.id)
        ? npc.placements.map(placement => ({ ...placement, minDepth: 1, maxDepth: 1 })) : [];
    change?.(raw);
    return loadNarrativePack(raw, portraits, locale);
}

export type ProviderMode = 'ready' | 'disabled' | 'unsupported-key';
type ProviderState = { total: number; receipts: string[] };
export function createN2RewardProvider(mode: ProviderMode = 'ready') {
    const control = { mode, failPrepare: false, malformedPrepare: false, failCommit: false, failSettlement: false };
    const prepare = vi.fn((request: Readonly<OptionalRewardRequest>, _context: OptionalRewardPrepareContext): OptionalRewardPreparation => {
        if (control.failPrepare) throw new Error('N2 fixture preparation failed');
        if (control.malformedPrepare) return { status: 'ready', plan: undefined } as unknown as OptionalRewardPreparation;
        if (control.mode !== 'ready') return { status: 'skipped', reason: control.mode };
        if (!N2_CASES.some(entry => entry.reward === request.rewardId)) return { status: 'skipped', reason: 'unsupported-key' };
        return { status: 'ready', plan: { amount: 5, instanceId: request.instanceId } };
    });
    const commit = vi.fn((request: Readonly<OptionalRewardRequest>, plan: ReadonlyJson, context: ExtensionContext) => {
        const state = context.state as unknown as ProviderState;
        expect(state.receipts).not.toContain(request.instanceId);
        state.total += (plan as { amount: number }).amount;
        state.receipts.push(request.instanceId);
        context.setState(state as unknown as Json);
        context.setComponent(context.playerId, 'character', { xp: state.total });
        context.message('N2 fixture reward committed');
        if (control.failCommit) throw new Error('N2 fixture commit failed after writes');
    });
    const create = (): ExtensionModule => ({
        id: 'n2-reward-fixture', version: '1.0.0', initialState: () => ({ total: 0, receipts: [] }),
        validateState: (value): value is Json => {
            const state = value as ProviderState | null;
            return !!state && Number.isSafeInteger(state.total) && state.total >= 0
                && Array.isArray(state.receipts) && new Set(state.receipts).size === state.receipts.length
                && state.receipts.every(receipt => typeof receipt === 'string');
        },
        componentValidators: { character: value => !!value && typeof value === 'object' && Number.isSafeInteger((value as { xp: number }).xp) },
        optionalRewards: { 'growth.story-reward.v1': { prepare, commit } },
        hooks: { simulationSettled(_event, context) {
            if (control.failSettlement && (context.state as unknown as ProviderState).total > 0) {
                context.message('N2 fixture settlement must not escape');
                throw new Error('N2 fixture settlement failed after reward');
            }
        } },
    });
    return { control, prepare, commit, create };
}
export type N2Provider = ReturnType<typeof createN2RewardProvider>;

export function startDiagnostic(options: { npcs: readonly string[]; growth?: boolean; provider?: N2Provider; change?: (raw: typeof definitions) => void }) {
    const content = diagnosticPack(options.npcs, options.change), module = createNarrativeModuleFromPack(content);
    const descriptors: ModuleDescriptor[] = catalog.getInstalledModuleDescriptors().map(descriptor => descriptor.id === 'narrative'
        ? { ...descriptor, rules: module.rules, create: () => createNarrativeModuleFromPack(content) } : descriptor);
    if (options.provider) descriptors.push({ id: 'n2-reward-fixture', version: '1.0.0', foundation: FOUNDATION_PROTOCOL,
        labelKey: 'ext.n2-reward-fixture.name', create: options.provider.create });
    const registry = registryFromDescriptors(descriptors);
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registry);
    const ids = ['narrative', ...(options.growth ? ['growth'] : []), ...(options.provider ? ['n2-reward-fixture'] : [])];
    const initialCommands = registry.create(registry.manifest(ids)).flatMap(entry => entry.initialCommand
        ? [JSON.stringify({ module: entry.id, ...entry.initialCommand })] : []);
    const seed = 8201, game = createHeadlessGame(seed, 'normal');
    game.startNewGame({ seed, mode: 'normal', ruleSet: 'extended', extensions: ids, initialCommands });
    game.animationEnabled = false; acknowledge();
    expect(game.depth).toBe(1);
    const world = game.extensionRuntime!.snapshot().foundation.world;
    for (const npcId of options.npcs) {
        const entity = world.entities.find(entry => entry.contentId === npcId)!;
        expect(entity, npcId).toBeDefined();
        expect(entity).toMatchObject({ owner: 'narrative', contentId: npcId, depth: 1 });
        expect(narrative(game).npcBindings[String(entity.id)]).toMatchObject({ npcId, instanceKey: entity.instanceKey });
        expect(narrative(game).placementReceipts).toContainEqual(expect.objectContaining({ npcId, depth: 1, result: 'placed', instanceKey: entity.instanceKey }));
    }
    return { game, content, registry };
}

/** Only savedAt is removed from the complete emitted snapshot. Logger text,
 * every cached grid, actors, clocks, entities, both RNG states AND counts remain.
 * observed() also captures the real save recordingOrigin independently. */
export function fullWorld(game: Game) {
    const { savedAt: _savedAt, ...snapshot } = game.toSnapshot();
    return clone(snapshot);
}
export function observed(game: Game) {
    // toSaveSnapshot finalizes the current recorder checkpoint/chain. Complete
    // that public boundary before reading either copy of the recording; taking
    // events first would make this oracle compare its own unfinished prefix.
    const save = game.toSaveSnapshot();
    return { world: fullWorld(game), random: clone(rng.getState()), messages: clone(logger.messages),
        recording: clone(game.recordedInputEvents), cursor: game.replayCursor,
        hasCompleteRecording: game.hasCompleteRecording, canExportRecording: game.canExportRecording,
        recordingOrigin: clone(save.run.recordingOrigin ?? null) };
}
export function progress(game: Game) {
    const state = narrative(game);
    return clone({ flags: state.flags, counters: state.counters, journal: state.journal,
        triggerReceipts: state.triggerReceipts, rewardReceipts: state.rewardReceipts,
        npcBindings: state.npcBindings, placementReceipts: state.placementReceipts, pendingPlacements: state.pendingPlacements });
}
export function command(game: Game, action: 'open' | 'choose' | 'close', id?: number | string): string {
    acknowledge();
    const view = readNarrativeUiView(game)!;
    const data = buildNarrativeUiCommand(game, view, action, id);
    expect(data, `${action}:${String(id)} at ${view.active?.nodeId ?? 'closed'}`).not.toBeNull();
    const before = game.toSnapshot(), random = clone(rng.getState()), events = game.recordedInputEvents.length;
    game.executeCommand('ext:command', data);
    expect(game.recordedInputEvents).toHaveLength(events + 1);
    const after = game.toSnapshot();
    expect(after.run.absoluteTurnNumber).toBe(before.run.absoluteTurnNumber);
    expect(after.run.currentTick).toBe(before.run.currentTick);
    expect(after.player).toEqual(before.player);
    expect(after.grid).toEqual(before.grid);
    expect(after.levels).toEqual(before.levels);
    expect(rng.getState()).toEqual(random);
    expect(game.hasPendingConfirmation).toBe(false);
    return data!;
}
export function open(game: Game, npcId: string): string {
    const target = game.extensionRuntime!.snapshot().foundation.world.entities.find(entity => entity.contentId === npcId)!;
    expect(readNarrativeUiView(game)!.nearby.some(entry => entry.targetEntityId === target.id), `${npcId} near entrance`).toBe(true);
    return command(game, 'open', target.id);
}
export const choose = (game: Game, id: string) => command(game, 'choose', id);
export function reject(game: Game, data: string): void {
    acknowledge(); const before = observed(game);
    game.executeCommand('ext:command', data);
    expect(observed(game)).toEqual(before);
    // The refusal is presentation-only, never a hidden mechanical message.
    expect(logger.displayMessages[logger.displayMessages.length - 1]?.id).toBe(-1);
}
export function rejectChoice(game: Game, choiceId: string): void {
    const view = readNarrativeUiView(game)!, state = narrative(game), active = state.active!;
    expect(buildNarrativeUiCommand(game, view, 'choose', choiceId)).toBeNull();
    reject(game, JSON.stringify({ module: 'narrative', action: 'choose', payload: {
        v: 2, revision: state.revision, sessionId: active.sessionId, nodeId: active.nodeId, choiceId,
    } }));
}
export function unlockClue(game: Game, row: N2Case): void {
    open(game, row.clueNpc);
    if (row.clueNpc === 'archive.keeper') { choose(game, 'read-note'); return; }
    choose(game, 'ask'); choose(game, 'consider'); choose(game, 'choose-a'); choose(game, 'leave-a');
}
export function decide(game: Game, npc: string, ending: 'a' | 'b'): string {
    open(game, npc); choose(game, 'ask'); choose(game, 'consider');
    return choose(game, `choose-${ending}`);
}
