import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
import type { SupportHost, SupportView } from '../../../engine/Simulation/SupportRuntime';
import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import { SUPPORTS } from './definitions';
export interface Deployment {
    id: number; slot: number; pose: WorldPoint; requested: number; arrived: boolean;
    charges: number; nextFire: number;
}
export interface SupportState {
    schema: 1; nextId: number; ready: number[]; deployments: Deployment[]; notice: SupportView['notice'];
}
export function validateState(value: unknown, host: SupportHost): asserts value is SupportState {
    const tick = host.tick(), point = (p: unknown) => record(p, ['x', 'y']) && integer(p.x, 1024, (host.world.grid.width - 1) * 1024)
        && integer(p.y, 1024, (host.world.grid.height - 1) * 1024) && !!host.world.grid.getCell(Math.floor(p.x / 1024), Math.floor(p.y / 1024))?.isPassable;
    if (!record(value, ['schema','nextId','ready','deployments','notice']) || value.schema !== 1 || !integer(value.nextId, 1, tick * 4 + 1)
        || !dataArray(value.ready, 4) || value.ready.length !== 4 || !value.ready.every((n,i) => integer(n, 0, tick + SUPPORTS[i]!.cooldown))
        || !dataArray(value.deployments, 8)) throw new Error('Invalid support state');
    let previous = 0;
    const slots = new Set<number>();
    for (const d of value.deployments) {
        if (!record(d, ['id','slot','pose','requested','arrived','charges','nextFire']) || !integer(d.id, previous + 1, value.nextId - 1)
            || !integer(d.slot, 0, 3) || slots.has(d.slot) || !point(d.pose) || !integer(d.requested, 1, tick) || typeof d.arrived !== 'boolean') throw new Error('Invalid support deployment');
        const a = SUPPORTS[d.slot]!;
        if (d.arrived !== (tick >= d.requested + a.delay) || tick >= d.requested + a.delay + a.lifetime
            || value.ready[d.slot] !== d.requested + a.cooldown || !integer(d.charges, 0, a.charges)
            || (!d.arrived && (d.charges !== a.charges || d.nextFire !== d.requested + a.delay))
            || !integer(d.nextFire, d.requested + a.delay, tick + Math.max(a.interval, a.delay))
            || d.slot !== 1 && d.nextFire !== d.requested + a.delay
            || d.slot === 0 && d.charges === 0) throw new Error('Invalid support lifecycle');
        previous = d.id; slots.add(d.slot);
    }
    if (value.notice !== null && (!record(value.notice, ['code','tick']) || !['accepted','range','blocked','cooldown','dead','supplied'].includes(value.notice.code as string)
        || !integer(value.notice.tick, 1, tick))) throw new Error('Invalid support notice');
}
