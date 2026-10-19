import {afterEach,it,expect} from 'vitest';
import '../../../../i18n';
import {Game} from '../../../../engine/Core/Game';
import {TerrainType} from '../../../../engine/Map/Grid';
import {T_OBSTRUCTS_DIAGONAL_MOVEMENT} from '../../../../engine/Map/TerrainCatalog';
import {PartyAiV1} from '../../../../ext/modules/party/PartyAiV1';
import {partyAiView} from '../../../../engine/Core/PartyAi';
import {defaultPartyAi,type PartyAiView} from '../../../../ext/partyAi';
import {logger} from '../../../../engine/Systems/Logger';
const games:Game[]=[];afterEach(()=>{games.splice(0).forEach(g=>g.disposeRecording());while(logger.pendingAcknowledgment)logger.acknowledgeNext();});
function view(kind:'gather'|'guard'|'retreat'):PartyAiView{return {seed:'42',fingerprint:'review',actorId:1,ordinal:0,level:1,at:{x:2,y:2},hp:20,maxHp:20,leader:null,cells:Array.from({length:49},(_,i)=>({x:i%7,y:Math.floor(i/7),passable:true,blocksDiagonal:false,danger:false,stairs:false})),occupied:[{x:3,y:3}],enemies:[],recovery:[],rangedItem:null,pickups:[],settings:defaultPartyAi().settings,order:{kind,level:1,x:3,y:3}};}
it.each(['gather','guard','retreat'] as const)('R2-F11 %s does not hold across one blocked corner',kind=>{const v=view(kind),side=v.cells.find(c=>c.x===3&&c.y===2)!;side.passable=false;side.blocksDiagonal=true;expect(PartyAiV1.decide(v).intent).toEqual({kind:'move',dx:0,dy:1});});
it('R2-F11 unknown corner is conservative; known non-diagonal-blocker preserves native eligibility',()=>{const v=view('gather');v.cells=v.cells.filter(c=>c.x!==3||c.y!==2);expect(PartyAiV1.decide(v).intent).toEqual({kind:'move',dx:0,dy:1});v.cells=[...v.cells,{x:3,y:2,passable:false,blocksDiagonal:false,danger:false,stairs:false}];expect(PartyAiV1.decide(v)).toMatchObject({intent:{kind:'wait'},diagnostic:'hold'});});
it('R2-F11 hidden live geometry cannot change remembered diagonal projection',()=>{
 const g=new Game({seed:1});games.push(g);g.startNewGame({seed:42,ruleSet:'extended',extensions:['party'],initialCommands:[JSON.stringify({module:'party',action:'create',payload:{schema:1,members:2}})]});
 const x=20,y=15;g.grid.setTerrain(x,y,TerrainType.FLOOR);const cell=g.grid.getCell(x,y)!;cell.isVisible=false;cell.hasMemory=true;cell.isMagicMapped=false;cell.rememberedLayers=[...cell.layers];cell.rememberedTerrainFlags=0;cell.rememberedFlags={passable:true,opaque:false,trapFree:true};
 const ai=g.party!.state.members[0]!.ai,before=partyAiView(g,g.player,ai);expect(before.cells.find(c=>c.x===x&&c.y===y)!.blocksDiagonal).toBe(false);
 g.grid.setTerrain(x,y,TerrainType.WALL);cell.isVisible=false;expect(partyAiView(g,g.player,ai)).toEqual(before);
 cell.rememberedTerrainFlags=T_OBSTRUCTS_DIAGONAL_MOVEMENT;expect(partyAiView(g,g.player,ai).cells.find(c=>c.x===x&&c.y===y)!.blocksDiagonal).toBe(true);
 cell.hasMemory=false;cell.isMagicMapped=false;expect(partyAiView(g,g.player,ai).cells.some(c=>c.x===x&&c.y===y)).toBe(false);
});
