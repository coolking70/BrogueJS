import { expect, it } from 'vitest';
import { writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { naturalSpine, GIANTS_SPINE_ACCEPTANCE_SEED } from './naturalFixture';
import { canonical } from '../../../json';
const hash=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export function captureSpineNaturalTrace() {
  const {game,boss,state}=naturalSpine(),s=game.toSnapshot(),recording=game.exportRecording();
  return {schema:1,seed:GIANTS_SPINE_ACCEPTANCE_SEED,mode:game.mode,depth:game.depth,commands:recording.events.length,
    commandsHash:hash(recording.events.map(e=>({action:e.action,data:e.data,decisions:e.decisions,tick:e.tick,turn:e.turn,depth:e.levelRef.kind==='dungeon'?e.levelRef.depth:-1}))),
    nativeWorldHash:hash({grid:s.grid,monsters:s.monsters,items:s.items,rng:s.rngState}),extensionsHash:hash(s.extensions),
    rng:s.rngState,state,boss:{id:boss.id,typeId:boss.typeId,loc:boss.loc,hp:boss.hp,maxHp:boss.maxHp,spatial:boss.spatial}};
}

it('naturally recreates spine seed, commands, both RNGs and original sample trace',()=>{
    const actual=captureSpineNaturalTrace(),path=new URL('../data/spine-natural-trace.json',import.meta.url);
    if(process.env.BROGUE_CAPTURE_GIANTS_TRACE==='1')writeFileSync(path,JSON.stringify(actual,null,2)+'\n');
    expect(actual).toEqual(JSON.parse(readFileSync(path,'utf8')));
},60000);
