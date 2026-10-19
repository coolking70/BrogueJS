import {boot,stats} from './scripts/ext-perf-common.mjs';
const {server,Game,load}=await boot();
const {checkpointGenerationWorld}=await load('engine/Core/WorldCheckpoint.ts');
const g=new Game({seed:1});g.startNewGame({seed:42,mode:'wizard',ruleSet:'extended',extensions:['party'],extensionConfigurations:{party:{schema:1,members:4}},initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:4}})]});g.animationEnabled=false;
const times=[];for(let i=0;i<110;i++){const t=performance.now();g.checkpointCombatFactWorld();if(i>=10)times.push(performance.now()-t);}
console.log(JSON.stringify(stats(times)));g.disposeRecording();await server.close();
