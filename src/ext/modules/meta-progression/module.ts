import type { MetaRuntime, MetaView } from '../../../engine/Simulation/StrategicRuntime';
import { dataArray, integer, record } from '../../../engine/Simulation/Protocol';
import data from './data/definitions.json';
interface MetaState extends MetaView { claimed: string[] }
export function createMeta(restored?:unknown):MetaRuntime {
    const state:MetaState=restored===undefined?{credits:data.startingCredits,samples:0,weapons:[0,1],support:[0,-1,-1,0],equipped:[0,1],difficulty:0,completed:0,claimed:[]}:(()=>{
        if(!record(restored,['credits','samples','weapons','support','equipped','difficulty','completed','claimed'])||!integer(restored.credits,0,100000000)||!integer(restored.samples,0,10000000)
            ||!integer(restored.difficulty,0,2)||!integer(restored.completed,0,10000)||!dataArray(restored.claimed,10000)||!restored.claimed.every(s=>typeof s==='string'&&/^operation-[1-9]\d{0,6}-[0-2]$/.test(s))||new Set(restored.claimed).size!==restored.claimed.length
            ||!dataArray(restored.weapons,4)||!restored.weapons.includes(0)||!restored.weapons.includes(1)||!restored.weapons.every(n=>integer(n,0,3))||new Set(restored.weapons).size!==restored.weapons.length
            ||!dataArray(restored.support,4)||restored.support.length!==4||!restored.support.every(n=>integer(n,-1,2))||restored.support[0]!<0||restored.support[3]!<0
            ||!dataArray(restored.equipped,2)||restored.equipped.length!==2||!restored.equipped.every(n=>(restored.weapons as unknown[]).includes(n))||new Set(restored.equipped).size!==2
            ||restored.completed>restored.claimed.length)throw new Error('Invalid meta state');return structuredClone(restored) as unknown as MetaState;
    })();
    return {
        purchase(kind,slot){if(!integer(slot,0,3)||!['weapon','support'].includes(kind))throw new Error('Invalid purchase');
            let cost:number;
            if(kind==='weapon'){if(state.weapons.includes(slot))throw new Error('Already unlocked');cost=data.weaponCosts[slot]!;}
            else{const level=state.support[slot]!;if(level===2)throw new Error('Maximum support upgrade');cost=level<0?data.supportCosts[slot]!:data.upgradeCosts[level]!;}
            if(state.credits<cost)throw new Error('Insufficient credits');state.credits-=cost;
            if(kind==='weapon')state.weapons.push(slot);else state.support[slot]=state.support[slot]!+1;},
        equip(slots){if(slots.length!==2||new Set(slots).size!==2||!slots.every(s=>state.weapons.includes(s)))throw new Error('Invalid loadout');state.equipped=[...slots];},
        grant(reward){if(!record(reward,['id','credits','samples','completed','difficulty'])||typeof reward.id!=='string'||!/^operation-[1-9]\d{0,6}-[0-2]$/.test(reward.id)||!integer(reward.credits,0,20000)||!integer(reward.samples,0,2000)||typeof reward.completed!=='boolean'||!integer(reward.difficulty,0,2))throw new Error('Invalid account reward');
            if(state.claimed.includes(reward.id))return;
            if(state.claimed.length>=10000||state.credits+reward.credits>100000000||state.samples+reward.samples>10000000)throw new Error('Account capacity reached');
            state.claimed.push(reward.id);state.credits+=reward.credits;state.samples+=reward.samples;
            if(reward.completed){state.completed++;state.difficulty=Math.max(state.difficulty,Math.min(2,reward.difficulty+1));}},
        setup(t){return {variant:t.variant,difficulty:t.difficulty,weapons:[...state.equipped],support:[...state.support]};},
        snapshot(){return structuredClone(state);},view(){const {claimed:_,...v}=state;return structuredClone(v);}
    };
}
