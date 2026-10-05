import type { BattleSetup } from '../../engine/Simulation/BattleSetup';
import type { MetaRuntime, OperationRuntime, StrategicDescriptor, MissionTicket } from '../../engine/Simulation/StrategicRuntime';
import type { MissionView } from '../../engine/Simulation/MissionRuntime';
import { dataArray, record } from '../../engine/Simulation/Protocol';
import { getStrategicModules } from '../../ext/realtimeCatalog';
import { canonicalState } from './ShooterState';
const manifest=(d:StrategicDescriptor)=>({id:d.id,version:d.version,rules:d.rules});
export type CampaignCommand = {kind:'start';region:number;difficulty:number}|{kind:'purchase';type:'weapon'|'support';slot:number}|{kind:'equip';slots:number[]};
/** Strategic writes are transactions; battle, replay and account have separate authority. */
export class CampaignSession {
    private operations:OperationRuntime|null;
    private meta:MetaRuntime|null;
    private readonly descriptors:readonly StrategicDescriptor[];
    constructor(installed=getStrategicModules(),restored?:unknown){
        this.descriptors=installed;
        let states:Record<string,unknown>={};
        if(restored!==undefined){
            if(!record(restored,['format','version','modules','states'])||restored.format!=='broguejs-campaign-s6'||restored.version!==1||!dataArray(restored.modules,2)
                ||canonicalState(restored.modules)!==canonicalState(installed.map(manifest))||!record(restored.states,installed.map(d=>d.id)))throw new Error('Missing or incompatible strategic modules');
            states=restored.states;
        }
        const op=installed.find(d=>d.kind==='operation'),meta=installed.find(d=>d.kind==='meta');
        this.operations=op?.createOperations(states[op.id])??null;this.meta=meta?.createMeta(states[meta.id])??null;
    }
    static fromSnapshot(value:unknown,available=getStrategicModules()):CampaignSession {
        if(!record(value,['format','version','modules','states'])||!dataArray(value.modules,2))throw new Error('Invalid campaign snapshot');
        const installed=value.modules.map(m=>{if(!record(m,['id','version','rules']))throw new Error('Invalid strategic manifest');const d=available.find(d=>d.id===m.id);if(!d)throw new Error('Missing strategic module');return d;});
        if(new Set(installed.map(d=>d.id)).size!==installed.length)throw new Error('Duplicate strategic modules');return new CampaignSession(installed,value);
    }
    view(){return {operation:this.operations?.view()??null,meta:this.meta?.view()??null};}
    snapshot(){return {format:'broguejs-campaign-s6',version:1,modules:this.descriptors.map(manifest),states:Object.fromEntries(this.descriptors.map(d=>[d.id,d.kind==='operation'?this.operations!.snapshot():this.meta!.snapshot()]))};}
    private transaction<T>(write:()=>T):T {const before=this.snapshot();try{return write();}catch(e){const copy=new CampaignSession(this.descriptors,before);this.operations=copy.operations;this.meta=copy.meta;throw e;}}
    execute(command:CampaignCommand):void {this.transaction(()=>{
        if(command.kind==='start'){if(!this.operations)throw new Error('Operations unavailable');if(command.difficulty>(this.meta?.view().difficulty??2))throw new Error('Difficulty locked');this.operations.start(command.region,command.difficulty);}
        else {if(!this.meta||this.operations?.view().ticket)throw new Error('Armory unavailable during sortie');if(command.kind==='purchase')this.meta.purchase(command.type,command.slot);else this.meta.equip(command.slots);}
    });}
    deploy():{ticket:MissionTicket;setup:BattleSetup}{return this.transaction(()=>{
        if(!this.operations)throw new Error('Operations unavailable');const ticket=this.operations.deploy();
        return {ticket,setup:this.meta?.setup(ticket)??{variant:ticket.variant,difficulty:ticket.difficulty,weapons:[0,1,2,3],support:[0,0,0,0]}};
    });}
    settle(ticket:MissionTicket,mission:MissionView):void {this.transaction(()=>{
        if(!this.operations||mission.status==='active')throw new Error('Unfinished sortie');
        const reward=this.operations.settle(ticket,mission.status,mission.reward);this.meta?.grant(reward);
    });}
}
