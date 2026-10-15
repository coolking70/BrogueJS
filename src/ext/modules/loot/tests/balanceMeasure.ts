/** B2 frozen small benchmark. Controlled equipment experiments are not natural runs. */
import '../../../../i18n';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { resolveLootCatalog, LOOT_MODULE_VERSION } from '../session';
import { rollLoot } from '../generator';
import { mulberry32 } from '../tools/stats';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { nativeStat, nativeRational } from '../../../../engine/Stats/NativeStatSources';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import species from '../../../../data/monsters.json';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { rng } from '../../../../engine/Random';
import { monsterScalingAt } from '../economy';
import { TerrainType } from '../../../../engine/Map/Grid';
import { isAutoDescent, isDeepWater } from '../../../../engine/Map/TerrainCatalog';
const depths=[1,5,10,15,20,26],presets=['scarce','standard','bountiful'],seeds=[104729,13007,65537];
const foes=['rat','goblin','ogre','troll','golem','dragon'];
const round=(n:number)=>Math.round(n*1000)/1000;
function open(presetId:string,seed:number,modules=['loot']){
 const h=createWorldHarness({seed,mode:'normal',modules}),g=worldHarnessGame(h);
 g.startNewGame({seed,mode:'normal',ruleSet:'extended',extensions:modules,extensionConfigurations:{loot:{presetId}},initialCommands:[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId}})]});g.animationEnabled=false;
 return {g,h};
}
function fixed(depth:number,presetId:string,seed:number,modules=['loot']){
 const {g,h}=open(presetId,seed,modules);
 try{
  const p=g.player,r=g.extensionRuntime!,catalog=resolveLootCatalog(r.queryOptional.bind(r)),random=mulberry32(seed+depth*1009);
  for(const i of [...p.inventory.items])p.unequip(i,true);
  const items=['weapon','armor','ring','ring'].map(itemClass=>{
   const generated=rollLoot(catalog,{v:1,source:'floor',depth,presetId,itemClass:itemClass as 'weapon'|'armor'|'ring',rarityFindBp:0,claimedUniqueIds:[]},random).items[0]!;
   const n=generated.native,item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:n.category==='weapon'?20:1000},moduleData:{loot:JSON.parse(JSON.stringify(generated.data))}});
   p.inventory.addItem(item);r.bindItemData(item);p.equip(item);return item;
  });
  // Native strength is the normal new-game value; equipment strength is materialized normally.
  // No hypothetical depth/strength formula and no four independent maxima.
  g.depth=depth;
  const foeData=(species as MonsterData[]).find(m=>m.id===foes[depths.indexOf(depth)])!;
  if(!foeData)throw Error('Missing benchmark foe');
  const target=new Monster(p.x+1,p.y,foeData);target.state=MonsterState.HUNTING;g.monsters.push(target);r.attachCreature(target);target.hp=target.maxHp;
  const known=r.stats.hypothetical(p.id,{},true),actual=r.stats.hypothetical(p.id,{},false),recovery=nativeRational(p);
  const min=nativeStat(p,'native.damage-min'),max=nativeStat(p,'native.damage-max'),hit=CombatSystem.previewHitChance(p,target);
  const speed=nativeStat(p,'native.attack-speed'),weapon=p.equippedWeapon;
  const attackTicks=weapon?.flags?.includes('ITEM_ATTACKS_QUICKLY')?Math.floor(speed/2):weapon?.flags?.includes('ITEM_ATTACKS_STAGGER')?speed*2:speed;
  const received=r.stats.evaluatePair(target.id,p.id,'physical-damage',{baseValue:10,attackKind:'melee',direct:true});
  const enemyHit=CombatSystem.previewHitChance(target,p),enemyMean=(nativeStat(target,'native.damage-min')+nativeStat(target,'native.damage-max'))/2;
  const damageTaken10=r.stats.value(p.id,'native.resist.physical');
  const outgoing=r.stats.evaluatePair(p.id,target.id,'physical-damage',{baseValue:Math.floor((min+max)/2),attackKind:'melee',direct:true});
  const ttk=outgoing*hit>0?target.maxHp/(outgoing*hit/100):null;
  const equipped=items.map(i=>({id:i.id,base:i.identityId,required:i.strengthRequired??0,enchant:i.enchantment,identified:i.isIdentified,familiarity:i.charges,data:JSON.parse(JSON.stringify(i.moduleData!.loot))}));
  const omniscient=actual;
  const randomBefore=rng.getState();let attacks=0,totalTicks=0,blocked=false;
  p.hp=p.maxHp;
  while(target.hp>0&&attacks<200){const result=CombatSystem.attack(p,target);if(result.staminaBlocked||result.staggerBlocked){blocked=true;break;}attacks++;totalTicks+=weapon?.flags?.includes('ITEM_ATTACKS_STAGGER')?(result.hit?2*speed:speed):attackTicks;}
  const killed=target.hp<=0;
  // A separate bounded incoming experiment starts at full resources, not a simultaneous duel.
  target.hp=target.maxHp;p.hp=p.maxHp;let hits=0,incoming=0;
  for(;incoming<200&&p.hp>0;incoming++){const before=p.hp;CombatSystem.attack(target,p);if(p.hp<before)hits++;}
  return {depth,presetId,seed,modules,strength:actual['native.strength'],effectiveStrength:actual['native.effective-strength'],equipment:equipped,known,omniscient,min,max,hit,attackTicks,hp:actual['native.max-hp'],armor:actual['native.defense']!/10,foe:foeData.id,foeHp:target.maxHp,enemyHit,enemyMean,received10:received,physicalResistanceBp:damageTaken10,regen:round(recovery.numerator/recovery.denominator),ehpProxy:round(actual['native.max-hp']!*10/Math.max(1,received)),ttkProxy:ttk===null?null:round(ttk*attackTicks),actualKill:{attacks,ticks:totalTicks,killed,blocked},actualSurvival:{attacks:incoming,hits,dead:p.hp<=0},strengthDeficit:Math.max(0,...items.map(i=>(i.strengthRequired??0)-actual['native.effective-strength']!)),curve:monsterScalingAt(catalog.pack.presets.presets.find(p=>p.id===presetId)!,depth),rngBefore:randomBefore};
 }finally{h.dispose();}
}
async function natural(seed:number){
 const {g,h}=open('standard',seed);const history:unknown[]=[];let attempts=0,last='';
 try{
  for(;attempts<300&&!g.isGameOver;attempts++){
   if(g.recordingInputBlocked)await g.flushRecording();
   const snapshot={depth:g.depth,strength:g.player.strength,hp:g.player.hp,maxHp:g.player.maxHp,turn:g.stats.turns,weapon:g.player.equippedWeapon?.identityId,armor:g.player.equippedArmor?.identityId};
   if(last!==String(g.depth)){history.push(snapshot);last=String(g.depth);}
   // Only actually acquired, known strength potions are used; no inventory injection.
   const strength=g.player.inventory.items.find(i=>i.consumableId==='potion_of_strength'&&ItemLoader.identifiedItems.has(i.consumableId));
   if(strength){g.executeItemCommand('quaff',strength);continue;}
   const target=g.levelSeeds[g.depth-1]!.downStairsLoc,key=(p:{x:number;y:number})=>`${p.x},${p.y}`;
   if(key(g.player.loc)===key(target)){g.executeCommand('stairs_down');continue;}
   // Controlled route planner knows terrain; the game remains normal, with real combat/resources.
   const queue=[{...g.player.loc}],prev=new Map<string,{x:number;y:number}|null>([[key(g.player.loc),null]]);
   for(let n=0;n<queue.length&&!prev.has(key(target));n++)for(const [dx,dy]of [[0,-1],[-1,0],[1,0],[0,1]]){
    const a=queue[n]!,b={x:a.x+dx!,y:a.y+dy!},c=g.grid.getCell(b.x,b.y);
    if(c&&(c.isPassable||c.layers.includes(TerrainType.DOOR)||c.layers.includes(TerrainType.SECRET_DOOR))&&!c.layers.some(t=>isAutoDescent(t)||isDeepWater(t)||t===TerrainType.LAVA)&&!prev.has(key(b))){prev.set(key(b),a);queue.push(b);}
   }
   if(!prev.has(key(target)))break;
   let at=target,next=at;while(prev.get(key(at))){next=at;at=prev.get(key(at))!;}
   if(g.grid.getCell(next.x,next.y)!.layers.includes(TerrainType.SECRET_DOOR))g.executeCommand('search');else g.executeCommand('move',{x:next.x-g.player.x,y:next.y-g.player.y});
   while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
   if(g.depth>=10)break;
  }
  const recording=h.exportRecording(),save=h.save(),digest=h.digest();h.load(save);const load=h.digest()===digest,replay=h.replay(recording);h.seek(recording,JSON.parse(recording).events.length);const seek=h.digest()===digest;h.load(save);h.command('escape');const continuation=h.replay(h.exportRecording());
  return {seed,mode:'normal',planner:'terrain-aware stairs, no injected state',budget:300,attempts,history,final:{depth:g.depth,strength:g.player.strength,hp:g.player.hp,gameOver:g.isGameOver},load,replay,seek,continuation};
 }finally{h.dispose();}
}
export async function measureLootBalance(){
 const samples:(ReturnType<typeof fixed>&{band:string|undefined})[]=[];
 for(const depth of depths)for(const preset of presets){
  const group=seeds.map(seed=>fixed(depth,preset,seed)).sort((a,b)=>(a.ttkProxy??Infinity)-(b.ttkProxy??Infinity));
  group.forEach((s,index)=>samples.push({...s,band:['high','mid','low'][index]}));
 }
 const optional=[fixed(10,'standard',104729,['loot','combat']),fixed(10,'standard',104729,['loot','giants'])];
 const routes=[];for(const seed of [7,26,42])routes.push(await natural(seed));
 return {version:LOOT_MODULE_VERSION,method:{depths,presets,seeds,knowledge:'initial known, actual mechanics, then full reveal upper bound',selection:'one generated weapon + armor + two distinct ring instances per seed, rank entire tuple by real pipeline TTK proxy',strength:'normal native starting strength plus actual equipped modifiers, no assumed depth curve',budget:'54 fixed + 2 capability samples + 3 normal routes x 300 commands',candidate:'no curve changed; target intervals await maintainer'},samples,optional,routes};
}
