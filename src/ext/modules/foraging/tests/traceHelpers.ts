/** Natural route capture: every game mutation is an ordinary recorded command. */
import i18next from 'i18next';
import { expect } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import type { WorldHarness, JsonValue, WorldErrorCode, Position } from '../../../worldSdk';
import { cellTerrainFlags } from '../../../../engine/Map/DungeonFeature';
import { TerrainType as T } from '../../../../engine/Map/Grid';
import { T_IS_FIRE, T_OBSTRUCTS_DIAGONAL_MOVEMENT } from '../../../../engine/Map/TerrainCatalog';
import { clearWorldCell, workPositions } from '../../../../engine/Core/WorldWorkWorld';
import { readEdibleContext } from '../../../../engine/Core/EdibleCommands';
import { knowledgeView } from '../../../../engine/Core/KindKnowledge';
import foundationLocale from '../../../../locales/zh_CN.json';
import zhCN from '../locales/zh_CN.json';

export interface TraceCommand { action:string; data:JsonValue; answers?:boolean[]; expect:{recorded:boolean;error?:WorldErrorCode|null} }
export const copyJson = <T>(v:T):T => JSON.parse(JSON.stringify(v));
export const last = <T>(r:readonly T[]):T|undefined => r[r.length-1];
export function startNatural(seed:number,modules:string[] = ['foraging']) {
  if (!i18next.isInitialized) i18next.init({lng:'zh_CN',fallbackLng:false,resources:{},initImmediate:false});
  i18next.addResources(i18next.language,'translation',foundationLocale);
  i18next.addResources(i18next.language,'translation',zhCN);
  return createWorldHarness({seed,mode:'normal',modules});
}
export function edibleContext(h:WorldHarness) {const r=readEdibleContext(worldHarnessGame(h),'foraging');if(!r.ok)throw Error(r.code);return r.value;}
export function foragingFinal(h:WorldHarness) {const g=worldHarnessGame(h);return copyJson({inventory:g.player.inventory.items.map(i=>({displayName:i.displayName,quantity:i.quantity})),knowledge:knowledgeView(g,'foraging','foraging.mushrooms'),state:g.extensionRuntime!.snapshot().modules.foraging,digest:h.digest()});}
export function harvestPayload(h:WorldHarness,owner:string,id:number) {const r=h.readWorkContext(owner,{kind:'node',interactableId:id});if(!r.ok)throw Error(r.code);return {v:1,nodeId:id,nodeRevision:r.value.node!.revision,inventoryStamp:r.value.inventoryStamp,destinationId:null,destinationRevision:null};}
export function executeTraceCommand(h:WorldHarness,c:Pick<TraceCommand,'action'|'data'|'answers'>):TraceCommand['expect'] {
 if(c.action==='ext:command') {const e=JSON.parse(c.data as string);return h.ext(e.module,e.action,e.payload,c.answers);}
 const g=worldHarnessGame(h),before=g.recordedInputEvents.length,old=g.onConfirmRequest,oldPending=g.onCommandConfirmRequest;
 let cursor=0;expect(g.pendingCommandConfirmation).toBeNull();
 try {g.onCommandConfirmRequest=null;g.onConfirmRequest=()=>c.answers?.[cursor++]??true;h.command(c.action,c.data);expect(g.pendingCommandConfirmation).toBeNull();}
 finally {g.onConfirmRequest=old;g.onCommandConfirmRequest=oldPending;}
 if(c.answers) {expect(cursor).toBe(c.answers.length);expect(g.recordedInputEvents[before]!.decisions).toEqual(c.answers);}
 return {recorded:g.recordedInputEvents.length>before};
}
export class NaturalForagingDriver {
 readonly commands:TraceCommand[]=[];
 constructor(readonly h:WorldHarness){}
 get game(){return worldHarnessGame(this.h);}
 command(action:string,data:JsonValue=null,answers?:boolean[]) {
  if(this.game.isGameOver)throw Error('Player died');
  const before=this.game.recordedInputEvents.length;
  const result=executeTraceCommand(this.h,{action,data,answers});
  const decisions=this.game.recordedInputEvents[before]?.decisions??[];
  this.commands.push({action,data,...(decisions.length?{answers:[...decisions]}:{}),expect:result});
  if(this.commands.length>3000)throw Error('Route exceeds 3000 commands');
  return result;
 }
 ext(module:string,action:string,payload:JsonValue){return this.command('ext:command',JSON.stringify({module,action,payload}));}
  route(targets: readonly Position[], avoidEnemies = true): Position[] | null {
    const game = this.game,
      grid = game.grid,
      start = { ...game.player.loc };
    const key = (p: Position) => p.y * grid.width + p.x;
    const goals = new Set(targets.map(key));
    const valid = (p: Position) => {
      const c = grid.getCell(p.x, p.y);
      return (
        !!c &&
        (c.isPassable || c.terrain === T.DOOR) &&
        !c.layers.some((t) => [T.LAVA, T.WATER_DEEP, T.CHASM].includes(t)) &&
        c.trapType !== 'fire' &&
        !(cellTerrainFlags(grid, p.x, p.y) & T_IS_FIRE)
      );
    };
    const queue = [start],
      previous = new Map<number, Position | null>([[key(start), null]]);
    let target: Position | undefined;
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]!;
      if (goals.has(key(p))) {
        target = p;
        break;
      }
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1]
      ]) {
        const n = { x: p.x + dx!, y: p.y + dy! };
        if (previous.has(key(n)) || !valid(n)) continue;
        if (
          dx &&
          dy &&
          (!valid({ x: n.x, y: p.y }) ||
            !valid({ x: p.x, y: n.y }) ||
            cellTerrainFlags(grid, n.x, p.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT ||
            cellTerrainFlags(grid, p.x, n.y) & T_OBSTRUCTS_DIAGONAL_MOVEMENT)
        )
          continue;
        if (
          avoidEnemies &&
          game.monsters.some(
            (m) => m.hp > 0 && !m.isAlly && Math.max(Math.abs(m.x - n.x), Math.abs(m.y - n.y)) <= 2
          )
        )
          continue;
        previous.set(key(n), p);
        queue.push(n);
      }
    }
    if (!target) return null;
    const result = [target];
    for (let p = previous.get(key(target)); p; p = previous.get(key(p))) result.push(p);
    return result.reverse();
  }
  walk(targets: readonly Position[], max = 600) {
    const depth = this.game.depth;
    for (let count = 0; count < max; count++) {
      if (this.game.depth !== depth) return;
      const path = this.route(targets) ?? this.route(targets, false);
      if (!path) throw new Error(`No safe route on D${this.game.depth}`);
      if (path.length === 1) return;
      const next = path[1]!;
      const before = `${this.game.depth}:${this.game.player.x}:${this.game.player.y}:${this.game.player.hp}`;
      this.command('move', { x: next.x - this.game.player.x, y: next.y - this.game.player.y });
      const after = `${this.game.depth}:${this.game.player.x}:${this.game.player.y}:${this.game.player.hp}`;
      if (before === after && !last(this.commands)!.expect.recorded)
        throw new Error('Unrecorded blocked move');
    }
    throw new Error('Natural walk did not reach target');
  }
  approachNode(id: string) {
    const nodes = this.h
      .world5()!
      .nodes.filter(
        (n) =>
          n.definitionId === id &&
          n.levelRef.kind === 'dungeon' &&
          n.levelRef.depth === this.game.depth
      );
    const candidates = nodes
      .map((n) => ({
        n,
        path:
          this.route(workPositions(this.game, n.at)) ??
          this.route(workPositions(this.game, n.at), false)
      }))
      .filter((r) => r.path)
      .sort((a, b) => a.path!.length - b.path!.length);
    if (!candidates.length) throw new Error(`No reachable ${id}`);
    const node = candidates[0]!.n;
    this.walk(workPositions(this.game, node.at));
    return node.interactableId;
  }
  clearThreat() {
    // Bump-attacks are ordinary public movement, and pursuing a visible foe is a read-only choice.
    for (let n = 0; n < 100; n++) {
      const enemies = [...this.game.visibleMonsters]
        .filter((m) => m.hp > 0 && !m.isAlly && !m.isCaged)
        .sort(
          (a, b) =>
            Math.max(Math.abs(a.x - this.game.player.x), Math.abs(a.y - this.game.player.y)) -
            Math.max(Math.abs(b.x - this.game.player.x), Math.abs(b.y - this.game.player.y))
        );
      if (!enemies.length) return;
      const enemy = enemies[0]!,
        path = this.route([enemy.loc], false);
      if (!path || path.length < 2) throw new Error('Visible foe unreachable');
      const next = path[1]!;
      this.command('move', { x: next.x - this.game.player.x, y: next.y - this.game.player.y });
    }
    throw new Error('Threat clearance exceeded limit');
  }
 harvestNode(nodeId:number,owner='foraging',count=1) {
  for(let n=0;n<count;n++){
   const node=this.h.world5()!.nodes.find(r=>r.interactableId===nodeId)!;
   this.walk(workPositions(this.game,node.at));
   const r=this.ext(owner,'harvest',harvestPayload(this.h,owner,nodeId));
   if(r.error)throw Error(`Harvest: ${r.error}`);
   if(last(this.h.world5()!.terminalTickets)?.status!=='completed')throw Error('Harvest interrupted');
  }
 }
 nearestFungus() {
  const nodes=this.h.world5()!.nodes.filter(n=>n.owner==='foraging'&&n.levelRef.kind==='dungeon'&&n.levelRef.depth===this.game.depth&&n.remaining>0);
  const candidates=nodes.map(n=>({n,path:this.route(workPositions(this.game,n.at))})).filter(r=>r.path).sort((a,b)=>a.path!.length-b.path!.length);
  if(!candidates.length)throw Error('No reachable fungus');
  return candidates[0]!.n.interactableId;
 }
 item(id:number){const item=this.game.player.inventory.items.find(i=>i.id===id);if(!item)throw Error('Missing item');return item;}
 eat(id:number,answer:boolean) {return this.command('item:execute',`eat|${this.item(id).inventoryLetter}`,[answer]);}
 roast(id:number) {const c=edibleContext(this.h),heat=c.heatSources[0];if(!heat)throw Error('No heat');const r=this.ext('foraging','roast',{v:1,itemId:id,heatSourceId:heat.interactableId,inventoryStamp:c.inventoryStamp});if(r.error)throw Error(`Roast: ${r.error}`);}
 placeHearth() {
  for(let attempt=0;attempt<20;attempt++){
   const r=this.h.readWorkContext('crafting',{kind:'inventory'});if(!r.ok)throw Error(r.code);const c=r.value;
   const candidates:Position[]=[];
   for(let y=c.at.y-1;y<=c.at.y+1;y++)for(let x=c.at.x-1;x<=c.at.x+1;x++)if(clearWorldCell(this.game,{x,y})&&workPositions(this.game,{x,y}).some(p=>p.x===c.at.x&&p.y===c.at.y))candidates.push({x,y});
   if(!candidates.length)throw Error('No adjacent hearth site');
   const out=this.ext('crafting','place-station',{v:1,definitionId:'crafting.hearth',...candidates[0]!,inventoryStamp:c.inventoryStamp});
   if(out.error)throw Error(`Place hearth: ${out.error}`);
   if(last(this.h.world5()!.terminalTickets)?.status!=='completed')throw Error('Place hearth interrupted');
   return candidates[0]!;
  }
  throw Error('No hearth');
 }
}
