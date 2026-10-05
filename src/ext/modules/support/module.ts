import type { SupportCommand, SupportHost, SupportRuntime, SupportView } from '../../../engine/Simulation/SupportRuntime';
import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
import { integerSqrt } from '../../../engine/Movement/WorldUnits';
import { raycast } from '../../../engine/Movement/SpatialQuery';
import { SUPPORTS } from './definitions';
import { validateState, type SupportState } from './state';
const distance2 = (a: WorldPoint, b: WorldPoint) => (a.x-b.x)**2 + (a.y-b.y)**2;
export function createSupport(host: SupportHost, restored?: unknown): SupportRuntime {
    const levels=host.equipment?.support ?? [0,0,0,0];
    const abilities=SUPPORTS.map((a,i)=>({...a,cooldown:Math.floor(a.cooldown*(100-Math.max(0,levels[i]!)*15)/100)}));
    const state: SupportState = restored === undefined ? { schema: 1, nextId: 1, ready: [0,0,0,0], deployments: [], notice: null }
        : (() => { validateState(restored, host, abilities); return structuredClone(restored); })();
    if(state.deployments.some(d=>levels[d.slot]!<0)||state.ready.some((n,i)=>levels[i]!<0&&n!==0))throw new Error('Unequipped support state');
    function nearby() {
        const player = host.body?.(host.ownerId);
        return player?.hp ? state.deployments.find(d => d.slot === 0 && d.arrived && d.charges > 0
            && distance2(player.pose, d.pose) <= abilities[0]!.radius ** 2 && !raycast({ grid: host.world.grid }, d.pose,
                { x: player.pose.x-d.pose.x, y: player.pose.y-d.pose.y }))?.id ?? null : null;
    }
    function view(): SupportView {
        const tick = host.tick(), scans = state.deployments.filter(d => d.slot === 3 && d.arrived);
        return { abilities: abilities.map((a, slot) => ({ slot, labelKey: a.labelKey, remaining: Math.max(0,state.ready[slot]!-tick),
            cooldown: a.cooldown, delay: a.delay, radius: a.radius, range: a.range, dangerous: slot === 2 })).filter(a=>levels[a.slot]!>=0),
            deployments: state.deployments.map(d => { const a=abilities[d.slot]!; return { id:d.id, slot:d.slot, pose:{...d.pose},
                phase:d.arrived?'active':'inbound', remaining: d.requested+a.delay+(d.arrived?a.lifetime:0)-tick,
                total:d.arrived?a.lifetime:a.delay, radius:a.radius, charges:d.charges }; }),
            revealed: scans.length ? host.bodies().filter(b=>b.hp && b.team !== host.health(host.ownerId)?.team
                && scans.some(d=>distance2(d.pose,b.pose)<=abilities[3]!.radius**2)).map(b=>b.id).sort((a,b)=>a-b) : [],
            nearbySupply: nearby(), notice: state.notice && {...state.notice} };
    }
    return {
        advance(commands: readonly SupportCommand[], interact: boolean): boolean {
            const tick = host.tick(), player = host.body?.(host.ownerId);
            for (const c of commands) {
                if(levels[c.slot]!<0)continue;
                const a = abilities[c.slot]!, pose = {x:c.x,y:c.y};
                const code = !player?.hp ? 'dead' : state.ready[c.slot]! > tick ? 'cooldown'
                    : distance2(player.pose,pose) > a.range**2 ? 'range'
                    : !host.world.grid.getCell(Math.floor(c.x/1024),Math.floor(c.y/1024))?.isPassable ? 'blocked' : 'accepted';
                state.notice = {code,tick};
                if (code !== 'accepted') continue;
                state.ready[c.slot] = tick+a.cooldown;
                state.deployments = state.deployments.filter(d => d.slot !== c.slot);
                state.deployments.push({id:state.nextId++,slot:c.slot,pose,requested:tick,arrived:false,charges:a.charges,nextFire:tick+a.delay});
            }
            for (const d of state.deployments) {
                const a=abilities[d.slot]!;
                if (tick < d.requested+a.delay) continue;
                d.arrived = true;
                if (d.slot === 2) {
                    // Shared authority applies each entity once; solid terrain
                    // occludes the blast. The caller can be killed by it too.
                    for (const b of host.bodies()) if (b.hp && distance2(d.pose,b.pose) <= (a.radius+b.radius)**2
                        && !raycast({grid:host.world.grid}, d.pose, {x:b.pose.x-d.pose.x,y:b.pose.y-d.pose.y})) {
                        const distance = Number(integerSqrt(BigInt(distance2(d.pose,b.pose))));
                        host.damage({sourceId:host.ownerId,targetId:b.id,amount:Math.max(1,Math.floor(a.damage*(a.radius-Math.min(a.radius,Math.max(0,distance-b.radius)))/a.radius)),kind:'explosive',friendlyFire:'all'});
                    }
                    host.clearHazards(d.pose,a.radius);
                    host.emit({tick,kind:'explosion',from:{...d.pose},to:{...d.pose},radius:a.radius,hit:true});
                }
                if (d.slot === 1 && d.charges > 0 && tick >= d.nextFire && tick < d.requested+a.delay+a.lifetime) {
                    const team=host.health(host.ownerId)?.team;
                    const target=host.bodies().filter(b=>b.hp && b.team!==team && distance2(d.pose,b.pose)<=a.radius**2
                        && !raycast({grid:host.world.grid},d.pose,{x:b.pose.x-d.pose.x,y:b.pose.y-d.pose.y}))
                        .sort((p,q)=>distance2(d.pose,p.pose)-distance2(d.pose,q.pose)||p.id-q.id)[0];
                    if (target) {
                        host.damage({sourceId:host.ownerId,targetId:target.id,amount:a.damage,kind:'kinetic',friendlyFire:'none'});
                        host.emit({tick,kind:'tracer',from:{...d.pose},to:{x:target.pose.x,y:target.pose.y},radius:0,hit:true});
                        d.charges--; d.nextFire=tick+a.interval;
                    }
                }
            }
            state.deployments=state.deployments.filter(d=>tick<d.requested+abilities[d.slot]!.delay+abilities[d.slot]!.lifetime);
            const id=nearby(), consumed=interact && id !== null && host.replenish();
            if (consumed) { state.deployments.find(d=>d.id===id)!.charges--; state.notice={code:'supplied',tick}; }
            state.deployments=state.deployments.filter(d=>d.slot!==0 || d.charges>0);
            return consumed;
        },
        snapshot() { return structuredClone(state); }, view,
    };
}
