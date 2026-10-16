/** Planner-only state. Thresholds count commands, never wall time or RNG.
 * Keep the original route until it stops progressing, then abandon optional
 * loot and exclude repeatedly blocked directed edges when replanning. */
export class RouteRecovery {
 constructor() { this.depth=null; this.events=[]; }
 edge(x,y,step) { return `${x},${y}>${x+step.x},${y+step.y}`; }
 observe(depth,x,y) {
  if(depth!==this.depth) {
   this.depth=depth; this.visits=new Map(); this.blocked=new Set();
   this.stairsOnly=false; this.previous=null; this.stalled=0; this.steps=0;
  }
  const loc=`${x},${y}`, prior=this.previous;
  this.stalled=prior?.loc===loc?this.stalled+1:0;
  this.steps++;
  this.visits.set(loc,(this.visits.get(loc)??0)+1);
  // Repeated visits catch oscillation; depth age bounds moving loot detours.
  if(this.stalled>=24||this.visits.get(loc)>=24||(!this.stairsOnly&&this.steps>=512)) {
   const wasStairsOnly=this.stairsOnly;
   this.stairsOnly=true;
   if(wasStairsOnly&&prior?.loc===loc&&prior.step&&this.stalled>=24)
    this.blocked.add(this.edge(x,y,prior.step));
   this.events.push({depth,x,y,step:this.steps,reason:wasStairsOnly?'replan':'skip-loot',blocked:this.blocked.size});
   this.visits.clear(); this.stalled=0;
  }
  this.previous={loc,step:null};
 }
 attempted(step) { if(step&&typeof step==='object')this.previous.step=step; }
 allows(x,y,dx,dy) { return !this.blocked.has(this.edge(x,y,{x:dx,y:dy})); }
}

export function retryEntryDelay(delays,depth,attempt,error) {
 // Never turn an engine, recording or coverage failure into a route retry.
 if(!error.routeBlocked||attempt>=15)throw error;
 const delay=(delays.get(depth)??0)+1;
 delays.set(depth,delay);
 return delay;
}

export function nextRouteStep(context,avoid=true,loot=!context.recovery.stairsOnly,safe=true) {
 const {g,recovery,score,TerrainType,cellTerrainFlags,flags}=context;
 const nextStep=(...args)=>nextRouteStep(context,...args);
  const upgrade=loot&&!g.player.equippedWeapon?.isCursed?g.items.filter(i=>i.category===0&&i.identityId!=='dart'&&!i.isCursed&&(i.strengthRequired??0)<=g.player.strength&&score(i)>score(g.player.equippedWeapon)).sort((a,b)=>Math.max(Math.abs(a.loc.x-g.player.x),Math.abs(a.loc.y-g.player.y))-Math.max(Math.abs(b.loc.x-g.player.x),Math.abs(b.loc.y-g.player.y)))[0]:null;
  const w=g.grid.width,h=g.grid.height,key=(x,y)=>x*h+y;
  const start=key(g.player.x,g.player.y), queue=[start], parent=new Map([[start,-1]]);
  const dirs=[[0,-1],[1,0],[0,1],[-1,0],[1,-1],[1,1],[-1,1],[-1,-1]];
  for(let i=0;i<queue.length;i++) {
   const k=queue[i],x=Math.floor(k/h),y=k%h,c=g.grid.getCell(x,y);
   if(upgrade?x===upgrade.loc.x&&y===upgrade.loc.y:c.layers.includes(TerrainType.STAIRS_DOWN)) { let n=k; if(n===start)return upgrade?'pickup':null; while(parent.get(n)!==start)n=parent.get(n); return {x:Math.floor(n/h)-g.player.x,y:n%h-g.player.y}; }
   for(const [dx,dy]of dirs) {const nx=x+dx,ny=y+dy,n=key(nx,ny),cell=g.grid.getCell(nx,ny); if(!cell||parent.has(n)||!recovery.allows(x,y,dx,dy)||(avoid&&g.getMonsterAt(nx,ny)))continue;
    const f=cellTerrainFlags(g.grid,nx,ny); if((!cell.isPassable&&!cell.layers.includes(TerrainType.SECRET_DOOR))||(f&(flags.T_LAVA_INSTA_DEATH|flags.T_AUTO_DESCENT))||(safe&&(f&flags.T_ENTANGLES)))continue;
    if(dx&&dy&&(!g.grid.getCell(x+dx,y)?.isPassable||!g.grid.getCell(x,y+dy)?.isPassable))continue;
    parent.set(n,k);queue.push(n);
   }
  }
  // Optional loot never justifies fighting through a blocked route. Try the
  // required stairs first; repeated failed attacks can feed lifestealing mobs.
  if(avoid&&upgrade)return nextStep(true,false,safe);
  if(avoid)return nextStep(false,loot,safe);
  if(upgrade)return nextStep(true,false,safe);
  if(safe)return nextStep(true,false,false);
  throw Object.assign(Error(`No stairs path D${g.depth} at ${g.player.x},${g.player.y}`),{routeBlocked:true});
 }
