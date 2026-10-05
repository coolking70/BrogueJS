import type { MissionTicket, OperationRuntime, OperationView, StrategicReward } from '../../../engine/Simulation/StrategicRuntime';
import type { MissionReward } from '../../../engine/Simulation/MissionRuntime';
import { integer, record } from '../../../engine/Simulation/Protocol';
import { canonical } from '../../json';
import data from './data/definitions.json';
function ticket(s: OperationView): MissionTicket {
    return {id:`operation-${s.serial}-${s.index}`,seed:((Math.imul(s.serial,1664525)^Math.imul(s.region+1,1013904223)^Math.imul(s.index+1,69069))>>>0)||1,variant:(s.region+s.index)%3,difficulty:s.difficulty};
}
export function createOperations(restored?: unknown): OperationRuntime {
    const state:OperationView=restored===undefined?{region:0,difficulty:0,index:0,status:'idle',ticket:null,serial:0}:(()=>{
        if(!record(restored,['region','difficulty','index','status','ticket','serial'])||!integer(restored.region,0,2)||!integer(restored.difficulty,0,2)||!integer(restored.index,0,3)
            ||!integer(restored.serial,0,1000000)||!['idle','active','complete','failed'].includes(restored.status as string))throw new Error('Invalid operation state');
        const v=restored as unknown as OperationView;
        if(v.status==='idle'?(v.serial!==0||v.index!==0||v.ticket!==null):v.serial===0||v.status==='complete'&&v.index!==3||v.status!=='complete'&&v.index===3
            ||v.ticket!==null&&(v.status!=='active'||canonical(v.ticket)!==canonical(ticket(v))))throw new Error('Invalid operation cursor');
        return structuredClone(v);
    })();
    return {
        start(region,difficulty){if(state.status==='active'||!integer(region,0,2)||!integer(difficulty,0,2)||state.serial>=1000000)throw new Error('Invalid operation start');
            Object.assign(state,{region,difficulty,index:0,status:'active',ticket:null,serial:state.serial+1});},
        deploy(){if(state.status!=='active'||state.ticket)throw new Error('Operation cannot deploy');state.ticket=ticket(state);return structuredClone(state.ticket);},
        settle(t,status,reward:MissionReward|null):StrategicReward{
            if(state.status!=='active'||!state.ticket||canonical(t)!==canonical(state.ticket)||!['success','failed'].includes(status))throw new Error('Wrong or already settled sortie');
            if(status==='success'&&(!record(reward,['credits','samples','optional','killBonus'])||!integer(reward.credits,0,10000)||!integer(reward.samples,0,1000)||typeof reward.optional!=='boolean'||!integer(reward.killBonus,0,10000))
                ||status==='failed'&&reward!==null)throw new Error('Invalid sortie reward');
            state.ticket=null;
            if(status==='success'){state.index++;if(state.index===data.missions)state.status='complete';}else state.status='failed';
            const completed=state.status==='complete';
            return {id:t.id,credits:(reward?.credits??0)+(completed?data.bonusCredits:0),samples:(reward?.samples??0)+(completed?data.bonusSamples:0),completed,difficulty:state.difficulty};
        },snapshot(){return structuredClone(state);},view(){return structuredClone(state);}
    };
}
