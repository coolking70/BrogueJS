import type { MissionCommand, MissionHost, MissionMarker, MissionRuntime, MissionView } from '../../../engine/Simulation/MissionRuntime';
import { canonical } from '../../json';
import { MISSION_DATA as d } from './definitions';
import { validateMissionState, type MissionState } from './state';
import { completeObjective, objectiveReady } from './objectiveGraph';
import { within } from './poi';
import { gatheredSamples, missionReward } from './rewards';
import { extractionView } from './extraction';

export function createMission(host: MissionHost, restored?: unknown): MissionRuntime {
    const state: MissionState = restored === undefined ? { schema: 1, status: 'active', reason: null, terminalTick: 0,
        nodes: d.nodes.map(n => ({ id: n.id, started: false, progress: 0, completeTick: 0 })), collected: [],
        extractionCallTick: 0, boardingProgress: 0, demolition: null, reward: null }
        : (() => { validateMissionState(restored, host.tick()); return structuredClone(restored); })();
    const extractionId = d.nodes.find(n => n.kind === 'extraction')!.id;
    function pressure() {
        const stage = [...d.reinforcements.stages].reverse().find(s => s.after.every(id => state.nodes.find(n => n.id === id)!.completeTick > 0))!;
        return { enabled: state.status === 'active' && (state.extractionCallTick > 0 || host.tick() % d.reinforcements.cycleTicks < d.reinforcements.activeTicks), batch: stage.batch, limits: { ...stage.limits } };
    }
    function targetActive(key: string): boolean { return state.status === 'active' && objectiveReady(state, key) && !state.nodes.find(n => n.id === key)?.completeTick; }
    for (const t of d.scenario.targets) {
        const body = host.target(t.key), n = state.nodes.find(n => n.id === t.key)!;
        if (body.hp === 0 !== (n.completeTick > 0) || !objectiveReady(state, t.key) && body.hp !== t.maxHp) throw new Error('Invalid mission target mirror');
    }
    if (state.status === 'success' && canonical(state.reward) !== canonical(missionReward(state, host.stats().kills))) throw new Error('Invalid mission reward');
    if (state.status === 'active' && (host.tick() >= d.deadlineTicks || host.stats().deaths >= d.deathLimit)
        || state.reason === 'timeout' && host.tick() !== d.deadlineTicks || state.reason === 'lives' && host.stats().deaths < d.deathLimit) throw new Error('Invalid mission terminal state');
    function markers(): MissionMarker[] {
        return [...d.nodes.map((def, i) => {
            const n = state.nodes[i]!;
            return { id: def.id, labelKey: def.labelKey, kind: def.kind, pose: { ...def.pose }, radius: def.radius,
                status: n.completeTick ? 'complete' as const : !objectiveReady(state, def.id) ? 'locked' as const : n.started ? 'active' as const : 'ready' as const,
                progress: n.progress, total: def.ticks };
        }), ...d.pois.map(p => ({ id: p.id, labelKey: p.labelKey, kind: p.kind, pose: { ...p.pose }, radius: p.radius,
            status: state.collected.includes(p.id) ? 'complete' as const : 'ready' as const, progress: state.collected.includes(p.id) ? 1 : 0, total: 1 }))];
    }
    function nearby(): string | null {
        if (state.status !== 'active' || !host.player().hp) return null;
        const p = host.player().pose;
        return markers().filter(m => m.status === 'ready' && within(p, m.pose, m.kind === 'nest' ? 1600 : m.radius)
            && (m.kind !== 'nest' || !host.rangedAvailable && state.demolition?.id !== m.id) && (m.kind !== 'supply' || host.player().hp < host.playerMaxHp))
            .sort((a, b) => (p.x - a.pose.x) ** 2 + (p.y - a.pose.y) ** 2 - (p.x - b.pose.x) ** 2 - (p.y - b.pose.y) ** 2 || a.id.localeCompare(b.id, 'en'))[0]?.id ?? null;
    }
    function finish(status: 'success' | 'failed', reason: MissionView['reason']): void {
        state.status = status; state.reason = reason; state.terminalTick = host.tick(); state.demolition = null;
        if (status === 'success') state.reward = missionReward(state, host.stats().kills);
    }
    return {
        targetActive,
        isFinished: () => state.status !== 'active',
        advance(commands: readonly MissionCommand[]) {
            if (state.status !== 'active') throw new Error('Mission already finished');
            // Combat commits before this phase. Preserve target/graph mirrors
            // even when death, timeout or abort ends this very same tick.
            for (const def of d.nodes) if (def.kind === 'nest' && targetActive(def.id) && host.target(def.id).hp === 0)
                completeObjective(state, def.id, host.tick());
            if (host.stats().deaths >= d.deathLimit) { finish('failed', 'lives'); return; }
            if (host.tick() >= d.deadlineTicks) { finish('failed', 'timeout'); return; }
            if (commands.some(c => c.kind === 'abort')) { finish('failed', 'aborted'); return; }
            if (commands.some(c => c.kind === 'interact')) {
                const id = nearby(), poi = d.pois.find(p => p.id === id), n = state.nodes.find(n => n.id === id);
                if (poi && (poi.kind !== 'supply' || host.heal())) state.collected.push(poi.id);
                if (n) {
                    const def = d.nodes.find(d => d.id === n.id)!;
                    if (def.kind === 'nest') { state.demolition = { id: n.id, remaining: d.demolitionTicks }; }
                    else { n.started = true; if (def.kind === 'extraction') state.extractionCallTick = host.tick(); }
                }
            }
            const player = host.player();
            if (state.demolition) {
                const n = d.nodes.find(n => n.id === state.demolition!.id)!;
                if (!player.hp || !within(player.pose, n.pose, 1600)) state.demolition = null;
                else if (--state.demolition.remaining === 0) { host.demolish(n.id); state.demolition = null; }
            }
            for (const [i, def] of d.nodes.entries()) {
                const n = state.nodes[i]!;
                if (n.completeTick || !objectiveReady(state, n.id)) continue;
                if (def.kind === 'nest') { if (host.target(n.id).hp === 0) completeObjective(state, n.id, host.tick()); continue; }
                if (!n.started || def.kind === 'extraction') continue;
                if (player.hp && within(player.pose, def.pose, def.radius)) {
                    n.progress++; if (n.progress === def.ticks) completeObjective(state, n.id, host.tick());
                }
            }
            const e = d.nodes.find(n => n.kind === 'extraction')!, n = state.nodes.find(n => n.id === e.id)!;
            if (state.extractionCallTick && host.tick() >= state.extractionCallTick + d.extractionDelayTicks) {
                state.boardingProgress = player.hp && within(player.pose, e.pose, e.radius) ? state.boardingProgress + 1 : 0;
                n.progress = state.boardingProgress;
                if (state.boardingProgress === e.ticks) { completeObjective(state, e.id, host.tick()); finish('success', 'extracted'); }
            }
        },
        snapshot() { return structuredClone(state); },
        view(): MissionView {
            const evac = extractionView(state, host.tick(), objectiveReady(state, extractionId));
            return { titleKey: d.titleKey, status: state.status, reason: state.reason, remaining: Math.max(0, d.deadlineTicks - host.tick()),
                lives: Math.max(0, d.deathLimit - host.stats().deaths), markers: markers(), nearby: nearby(), ...evac, samples: gatheredSamples(state), reward: state.reward && { ...state.reward },
                reinforcements: pressure() };
        },
    };
}
