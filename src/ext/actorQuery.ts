import { Monster } from '../entities/Monster';
import type { Creature } from '../entities/Creature';
import type { ActorActionProductionWorld } from '../engine/Core/ActorActionProduction';
/** Native/candidate worlds are supplied only by engine callers, never JSON commands. */
export function resolveActorQueryScope(world: ActorActionProductionWorld, actor: Creature): { depth:number;partId:string|null;generation:number|null } | null {
    const rows = [{depth:world.depth,actor:world.player},...world.levels.flatMap(level=>level.actors.map(actor=>({depth:level.depth,actor})))];
    // Retained carried/leader closure owns components even while not spatially
    // scheduled. Direct level ownership always wins over a relationship edge.
    const direct=new Map(rows.map(row=>[row.actor,row.depth]));
    const seen=new Set<Creature>();
    const visit=(source:Creature,depth:number):void=>{
        if(seen.has(source))return;seen.add(source);
        if(!direct.has(source))rows.push({actor:source,depth});
        if(source instanceof Monster){if(source.carriedMonster)visit(source.carriedMonster,direct.get(source.carriedMonster)??depth);
            if(source.leader)visit(source.leader,direct.get(source.leader)??depth);}
    };
    for(const row of [...rows].sort((a,b)=>a.depth-b.depth||a.actor.id-b.actor.id))visit(row.actor,row.depth);
    const matches=rows.filter(row=>row.actor.id===actor.id);
    if (!matches.length || matches.some(row=>row.actor!==actor || row.depth!==matches[0]!.depth)) return null;
    const member=actor.spatial?.bodyMember;
    if (!member) return {depth:matches[0]!.depth,partId:null,generation:null};
    const group=world.bodyGroups?.find(group=>group.groupId===member.groupId);
    const slot=group?.members.find(slot=>slot.partId===member.partId && slot.entityId===actor.id && slot.life==='active');
    if (!group || !slot) return null;
    const core=rows.find(row=>row.actor.id===group.groupId);
    if (!core || core.depth!==matches[0]!.depth) return null;
    return {depth:matches[0]!.depth,partId:member.partId,generation:slot.generation};
}
