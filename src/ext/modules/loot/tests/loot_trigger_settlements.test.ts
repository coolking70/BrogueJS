import '../../../../i18n';
import { afterEach, expect, it } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { resolveLootCatalog } from '../session';
import { rollLoot } from '../generator';
import { mulberry32 } from '../tools/stats';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { CombatSystem } from '../../../../engine/Combat/Combat';
import { Monster, MonsterState, type MonsterData } from '../../../../entities/Monster';
import species from '../../../../data/monsters.json';
import { TerrainType } from '../../../../engine/Map/Grid';
import type { LootItemDataV1 } from '../types';
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>handles.splice(0).forEach(h=>h.dispose()));
function scene(suffix:string,combat=false,ring=false){
 const h=createWorldHarness({seed:42,mode:'easy',modules:combat?['loot','combat']:['loot']}),g=worldHarnessGame(h);handles.push(h);const c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),id=`loot.affix.${suffix}`,def=c.affixes.find(a=>a.id===id)!;
 for(let seed=1;seed<=5000;seed++){
  const result=rollLoot(c,{v:1,source:'floor',depth:26,presetId:'standard',itemClass:ring?'ring':def.itemClasses[0]!,rarityFindBp:0,claimedUniqueIds:[]},mulberry32(seed));
  const found=result.items.find(i=>i.data.affixes.some(a=>a.id===id));if(!found)continue;
  const n=found.native,item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:1000},moduleData:{loot:JSON.parse(JSON.stringify(found.data))}});
  g.player.inventory.addItem(item);g.extensionRuntime!.bindItemData(item);for(const i of [...g.player.inventory.items])g.player.unequip(i,true);g.player.equip(item);
  const known=()=> (item.moduleData!.loot as unknown as LootItemDataV1).affixes.find(a=>a.id===id)!.known;
  expect(known()).toBe(false);return {g,h,item,known};
 }
 throw Error(`Missing generated fixture ${id}`);
}
it.each(['radiant','clairvoyant','shadow','noisy'])('actual turn vision/perception commits %s, ordinary render does not',name=>{
 const {g,known}=scene(name);(g as unknown as {updateVision():void}).updateVision();expect(known()).toBe(false);g.executeCommand('wait');expect(known()).toBe(true);
});
it.each(['fireward','antivenom'])('actual %s reduction, zero input does not reveal',name=>{
 const {g,known}=scene(name),kind=name==='fireward'?'fire':'poison';g.player.takeDamage(0,false,undefined,undefined,kind);expect(known()).toBe(false);g.player.takeDamage(10,false,undefined,undefined,kind);expect(known()).toBe(true);
});
it('real regeneration advances fractional carry only when injured and not suppressed',()=>{
 const {g,known}=scene('mending');g.player.hp=g.player.maxHp;g.player.recoverPerTurn();expect(known()).toBe(false);g.player.hp--;g.player.recoverPerTurn(true);expect(known()).toBe(false);g.player.recoverPerTurn();expect(known()).toBe(true);
});
it.each(['precise','clumsy','reinforced','plated','brittle'])('real probability roll witnesses %s including misses',name=>{
 const {g,known}=scene(name),target=new Monster(g.player.x+1,g.player.y,(species as MonsterData[]).find(m=>m.id==='golem')!);target.state=MonsterState.HUNTING;g.monsters.push(target);g.extensionRuntime!.attachCreature(target);
 for(let i=0;i<10&&!known();i++){g.player.hp=g.player.maxHp;target.hp=target.maxHp;if(name==='precise'||name==='clumsy')CombatSystem.attack(g.player,target);else CombatSystem.attack(target,g.player);}
 expect(known()).toBe(true);
});
it.each(['swift','sluggish'])('real command attack clock witnesses %s',name=>{
 const {g,known}=scene(name);const target=new Monster(g.player.x+1,g.player.y,(species as MonsterData[]).find(m=>m.id==='ogre')!);target.state=MonsterState.HUNTING;g.grid.getCell(target.x,target.y)!.layers[0]=TerrainType.FLOOR;g.monsters.push(target);g.extensionRuntime!.attachCreature(target);g.executeCommand('move',{x:1,y:0});expect(known()).toBe(true);
});
it('real staff recharge witnesses wisdom, full staff does not',()=>{
 const {g,known}=scene('wisdom'),staff=ItemLoader.spawnStaff('staff_of_fire',0,0)!;g.player.inventory.addItem(staff);staff.charges=staff.maxCharges;staff.staffRechargeRemaining=500;
 const tick=()=> (g as unknown as {tickArcanaResources():void}).tickArcanaResources();tick();expect(known()).toBe(false);staff.charges=0;tick();expect(known()).toBe(true);
});
it.each(['leech','reaper'])('real melee resource effect witnesses %s only on matching gear',name=>{
 const {g,known}=scene(name);if(name==='reaper'){const staff=ItemLoader.spawnStaff('staff_of_fire',0,0)!;staff.charges=0;g.player.inventory.addItem(staff);}g.player.hp=Math.max(1,g.player.maxHp-10);
 const target=new Monster(g.player.x+1,g.player.y,(species as MonsterData[]).find(m=>m.id==='ogre')!);target.isCaged=true;g.monsters.push(target);g.extensionRuntime!.attachCreature(target);
 for(let i=0;i<30&&!known();i++){target.hp=target.maxHp;CombatSystem.attack(g.player,target);}expect(known()).toBe(true);
});

it('real search evaluates awareness only in the presence of a secret',()=>{
 const {g,known}=scene('seeker');g.grid.setTerrain(g.player.x+1,g.player.y,TerrainType.SECRET_DOOR,'#',0x999999);g.executeCommand('search');expect(known()).toBe(true);
});
it.each(['vital','frail','titan','enduring','steadfast'])('real equip commits signed capacity %s',name=>{
 const {g,item,known}=scene(name,['enduring','steadfast'].includes(name));g.player.unequip(item,true);g.executeItemCommand('equip',item);expect(known()).toBe(true);
});
it.each(['tireless','stalwart'])('actual combat resource recovery commits %s',name=>{
 const {g,known}=scene(name,true);g.executeCommand('wait');expect(known()).toBe(false);
 const target=new Monster(g.player.x+1,g.player.y,(species as MonsterData[]).find(m=>m.id==='ogre')!);target.state=MonsterState.HUNTING;g.grid.setTerrain(target.x,target.y,TerrainType.FLOOR,'.',0x999999);g.monsters.push(target);g.extensionRuntime!.attachCreature(target);
 for(let i=0;i<15&&!known();i++){g.player.hp=g.player.maxHp;target.hp=target.maxHp;if(name==='tireless')g.executeCommand('move',{x:1,y:0});else {CombatSystem.attack(target,g.player);g.executeCommand('wait');}}
 expect(known()).toBe(true);
});

it('actual next-floor generation commits fortune after a rarity roll',()=>{
 const {g,known}=scene('fortune');g.player.loc={...g.levelSeeds[g.depth-1]!.downStairsLoc};g.executeCommand('stairs_down');expect(g.depth).toBe(2);expect(known()).toBe(true);
});
it('two equipped rings sharing regeneration reveal independently while a spare stays hidden',()=>{
 const {g,item}=scene('mending',false,true);expect(item.category).toBe(8);
 const copy=()=>{const n={kind:item.identityId!,category:'ring' as const,enchantment:item.enchantment,runicType:item.runicType??null,isCursed:item.isCursed,identified:item.isIdentified,familiarityRemaining:1000};const next=assembleDropItem({native:n,moduleData:{loot:JSON.parse(JSON.stringify(item.moduleData!.loot))}});g.player.inventory.addItem(next);g.extensionRuntime!.bindItemData(next);return next;};
 const second=copy(),spare=copy();g.player.equip(second);g.player.hp--;g.player.recoverPerTurn();
 const known=(i:typeof item)=>(i.moduleData!.loot as unknown as LootItemDataV1).affixes.find(a=>a.id==='loot.affix.mending')!.known;
 expect(known(item)).toBe(true);expect(known(second)).toBe(true);expect(known(spare)).toBe(false);
});
