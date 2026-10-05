import { describe, expect, it } from 'vitest';
import { MISSION_DATA as d, loadMission } from '../definitions';
import { createMission } from '../missionRuntime';
import type { MissionState } from '../state';
import type { MissionHost, MissionRuntime } from '../../../../engine/Simulation/MissionRuntime';
function room(ranged = false) {
    let tick = 0, deaths = 0, kills = 37;
    const player = { id: 1, team: 0, hp: 100, pose: { ...d.scenario.spawn, facing: 0 }, radius: 280 };
    const targets = d.scenario.targets.map((t, i) => ({ id: i + 2, team: 1, hp: t.maxHp, pose: { ...t.pose, facing: 0 }, radius: t.radius }));
    const host: MissionHost = { tick: () => tick, player: () => structuredClone(player), playerMaxHp: 100,
        target: key => structuredClone(targets[d.scenario.targets.findIndex(t => t.key === key)]!), stats: () => ({ deaths, kills }), rangedAvailable: ranged,
        heal: () => { if (!player.hp || player.hp === 100) return false; player.hp = 100; return true; },
        demolish: key => { targets[d.scenario.targets.findIndex(t => t.key === key)]!.hp = 0; return true; } };
    let runtime = createMission(host);
    const move = (id: string, offset = 0) => { const n = [...d.nodes, ...d.pois].find(n => n.id === id)!; player.pose = { x: n.pose.x + offset, y: n.pose.y, facing: 0 }; };
    const step = (count = 1, interact = false) => { for (let n = 0; n < count; n++) { tick++; runtime.advance(n === 0 && interact ? [{ tick, kind: 'interact' }] : []); } };
    const restore = () => { runtime = createMission(host, JSON.parse(JSON.stringify(runtime.snapshot()))); };
    return { host, player, targets, move, step, restore, runtime: () => runtime,
        death: () => { deaths++; }, setTick: (t: number) => { tick = t; }, setRuntime: (r: MissionRuntime) => { runtime = r; } };
}
function mains(r: ReturnType<typeof room>) {
    for (const id of ['scan-a', 'scan-b']) { r.move(id); r.step(3600, true); r.restore(); }
    for (const id of ['nest-a', 'nest-b', 'nest-c']) { r.move(id, -1100); r.step(90, true); }
    r.move('uplink'); r.step(3600, true);
}
describe('data-driven mission graph, POIs and extraction', () => {
    it('validates graph ownership, cycles, duration bounds and malformed data', () => {
        expect(loadMission(d)).toEqual(d); expect(Object.isFrozen(d.nodes[0]!.pose)).toBe(true);
        for (const change of [(v: any) => v.nodes[0].depends = ['uplink'], (v: any) => v.nodes[1].id = v.nodes[0].id,
            (v: any) => v.deadlineTicks = 17, (v: any) => v.boardingMode = 'foreign', (v: any) => v.scenario.targets[0].key = 'foreign', (v: any) => v.nodes[0].ticks = Infinity]) {
            const bad = structuredClone(d); change(bad); expect(() => loadMission(bad)).toThrow();
        }
    });
    it('locks dependent facilities and records region progress, pauses outside and restores without restarting', () => {
        const r = room(); r.move('uplink'); r.step(1, true); expect((r.runtime().snapshot() as MissionState).nodes[5]!.started).toBe(false);
        r.move('scan-a'); r.step(100, true); const before = r.runtime().snapshot(); r.restore(); expect(r.runtime().snapshot()).toEqual(before);
        expect(r.runtime().view().activity).toEqual({ kind: 'region', labelKey: 'ext.missions.site.scan-a', progress: 100, total: 3600, paused: false });
        r.player.pose = { ...d.scenario.spawn, facing: 0 }; r.step(100); expect((r.runtime().snapshot() as MissionState).nodes[0]!.progress).toBe(100);
        expect(r.runtime().view().activity).toMatchObject({ progress: 100, paused: true });
        r.move('scan-a'); r.player.hp = 0; r.step(20); expect((r.runtime().snapshot() as MissionState).nodes[0]!.progress).toBe(100);
        expect(r.runtime().view().activity?.paused).toBe(true);
        r.player.hp = 100; r.step(3500); expect(r.runtime().targetActive('nest-a')).toBe(false);
    });
    it('collects POIs once, preserves cumulative boarding outside and on death/restore, and awards exactly once', () => {
        const r = room(); r.move('supply-a'); r.step(1, true); expect((r.runtime().snapshot() as MissionState).collected).toEqual([]);
        r.player.hp = 12; r.step(1, true); expect(r.player.hp).toBe(100); r.player.hp = 15; r.step(1, true); expect(r.player.hp).toBe(15); r.player.hp = 100;
        for (const id of ['sample-a', 'sample-b']) { r.move(id); r.step(2, true); r.step(1, true); }
        r.move('rescue'); r.step(1800, true); r.restore(); expect(r.runtime().view().samples).toBe(8);
        mains(r); r.move('extraction'); r.step(1, true); expect(r.runtime().view().extraction).toBe('inbound');
        expect(r.runtime().view().activity).toMatchObject({ kind: 'arrival', progress: 0, total: 5400, paused: false });
        r.step(5399); expect(r.runtime().view().extraction).toBe('inbound'); r.step(1); expect(r.runtime().view().extraction).toBe('boarding');
        r.step(50); r.player.pose = { ...d.scenario.spawn, facing: 0 }; r.step(60); expect(r.runtime().view().extractionRemaining).toBe(849);
        expect(r.runtime().view().activity).toMatchObject({ kind: 'boarding', progress: 51, total: 900, paused: true }); r.restore();
        r.move('extraction'); r.player.hp = 0; r.death(); r.step(90); r.restore(); expect(r.runtime().view().extractionRemaining).toBe(849);
        r.player.hp = 100; r.step(848); r.restore(); expect(r.runtime().view().activity).toMatchObject({ progress: 899, paused: false });
        r.step(); const result = r.runtime().view(); expect(result.activity).toBeNull();
        expect(result.status).toBe('success'); expect(result.reward).toEqual({ credits: 153, samples: 8, optional: true, killBonus: 3 });
        const before = r.runtime().snapshot(); expect(() => r.step()).toThrow('finished'); expect(r.runtime().snapshot()).toEqual(before);
    });
    it('derives demolition progress from its real timer and retires it when leaving the nest', () => {
        const r = room(); expect(r.runtime().view().activity).toBeNull();
        for (const id of ['scan-a', 'scan-b']) { r.move(id); r.step(3600, true); }
        r.move('nest-a', -1100); r.step(15, true); r.restore();
        expect(r.runtime().view().activity).toEqual({ kind: 'demolition', labelKey: 'ext.missions.site.nest-a', progress: 15, total: 90, paused: false });
        r.move('scan-a'); r.step(); expect(r.runtime().view().activity).toBeNull();
        r.move('nest-a', -1100); r.step(89, true); expect(r.runtime().view().activity?.progress).toBe(89);
        r.step(); expect(r.runtime().view().activity).toBeNull(); expect(r.targets[0]!.hp).toBe(0);
    });
    it('finishes on deadline, exhausted lives or abort, without dispensing unextracted samples', () => {
        const timeout = room(); timeout.setTick(26999); timeout.step(); expect(timeout.runtime().view()).toMatchObject({ status: 'failed', reason: 'timeout', reward: null });
        const dead = room(); for (let n = 0; n < 6; n++) dead.death(); dead.step(); expect(dead.runtime().view()).toMatchObject({ status: 'failed', reason: 'lives', lives: 0 });
        const abort = room(); abort.setTick(1); abort.runtime().advance([{ tick: 1, kind: 'abort' }]); expect(abort.runtime().view().reason).toBe('aborted');
    });
    it.each(['lives', 'timeout', 'aborted'] as const)('persists a target destroyed on the same tick as %s termination', reason => {
        const r = room(true);
        for (const id of ['scan-a', 'scan-b']) { r.move(id); r.step(3600, true); }
        // The authoritative combat phase has committed this tick's damage.
        r.targets[0]!.hp = 0;
        if (reason === 'lives') { for (let i = 0; i < 6; i++) r.death(); r.step(); }
        else if (reason === 'timeout') { r.setTick(26999); r.step(); }
        else { r.setTick(7201); r.runtime().advance([{ tick: 7201, kind: 'abort' }]); }
        const state = r.runtime().snapshot() as MissionState;
        expect(state.reason).toBe(reason); expect(state.nodes[2]!.progress).toBe(90);
        expect(state.nodes[2]!.completeTick).toBe(r.host.tick());
        expect(createMission(r.host, state).snapshot()).toEqual(state);
    });
    it('rejects target, graph, timer and result corruption and skips reinforcement pressure during quiet windows', () => {
        const r = room(); r.move('scan-a'); r.step(50, true); const good = r.runtime().snapshot();
        for (const mutate of [(v: any) => v.nodes[5].started = true, (v: any) => v.nodes[0].completeTick = 1,
            (v: any) => v.extractionCallTick = 1, (v: any) => v.collected = ['foreign'], (v: any) => v.reward = {}]) {
            const bad = structuredClone(good); mutate(bad); expect(() => createMission(r.host, bad)).toThrow();
        }
        r.targets[0]!.hp--; expect(() => createMission(r.host, good)).toThrow('target'); r.targets[0]!.hp++;
        r.setTick(1500); expect(r.runtime().view().reinforcements.enabled).toBe(false); r.setTick(2700); expect(r.runtime().view().reinforcements.enabled).toBe(true);
    });
});
