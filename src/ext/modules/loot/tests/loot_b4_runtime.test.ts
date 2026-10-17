import { TerrainType } from '../../../../engine/Map/Grid';
import '../../../../i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { createWorldHarness, worldHarnessGame } from '../../../testing/worldHarness';
import { resolveLootCatalog } from '../session';
import { deriveNativeFacts } from '../item';
import { assembleDropItem } from '../../../../engine/Items/FixedItemAssembly';
import { ItemLoader } from '../../../../engine/Items/ItemLoader';
import { nativeStat, nativeProjectileRunic, markStatsDirty } from '../../../../engine/Stats/NativeStatSources';
import { rng } from '../../../../engine/Random';
import { timeSystem } from '../../../../engine/Systems/Time';
import { logger } from '../../../../engine/Systems/Logger';
import { auditFullObjectGraph } from '../../../../test/support/fullGenerationCheckpointOracle';
import { Monster, type MonsterData } from '../../../../entities/Monster';
import monsters from '../../../../data/monsters.json';
import type { LootItemDataV1 } from '../types';
const handles:ReturnType<typeof createWorldHarness>[]=[];
afterEach(()=>{vi.restoreAllMocks();handles.splice(0).forEach(h=>h.dispose());});
function open(){const h=createWorldHarness({seed:42,mode:'easy',modules:['loot']});handles.push(h);const g=worldHarnessGame(h);while(logger.pendingAcknowledgment)logger.acknowledgeNext();return g;}
function data(baseId='dagger'):LootItemDataV1{return {v: 5,baseId,ilvl:40,rarity:'normal',uniqueId:null,setId: null, pieceId: null, identityKnown: true,affixes:[],corrupted:false,enhancement:0,sockets:0,socketed:[],nameParts:null,origin:{source:'floor',depth:26}};}
function add(g:ReturnType<typeof open>,d:LootItemDataV1){d.identityKnown=d.affixes.every(a=>a.known);const c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),n=deriveNativeFacts(d,c),item=assembleDropItem({native:{kind:n.kind,category:n.category,enchantment:n.enchantment,runicType:n.runicType,isCursed:n.isCursed,identified:n.identified,familiarityRemaining:1000,...(d.targetClass?{targetClass:d.targetClass}:{})},moduleData:{loot:JSON.parse(JSON.stringify(d))}});expect(g.player.inventory.addItem(item)).toBe(true);g.extensionRuntime!.bindItemData(item);return item;}
function read(g:ReturnType<typeof open>){const s=ItemLoader.spawnScroll('scroll_of_enchantment',-1,-1)!;expect(g.player.inventory.addItem(s)).toBe(true);const scroll=g.player.inventory.stackFor(s)!;ItemLoader.identifyItemKind(scroll);g.executeItemCommand('read',scroll);return scroll;}
const rows=(i:ReturnType<typeof add>)=>(i.moduleData!.loot as unknown as LootItemDataV1).affixes;
it.each(['dagger','leather_armor','ring_of_light'])('real read/select %s defers consumption and preserves native requirements',base=>{
 const g=open(),i=add(g,data(base)),req=i.strengthRequired,ench=i.enchantment,tick=timeSystem.currentTick;
 const scroll=read(g);expect(g.pendingEnchantment).toBe(true);expect(g.player.inventory.items).toContain(scroll);expect(timeSystem.currentTick).toBe(tick);
 g.executeItemCommand('enchant',i);expect(g.pendingEnchantment).toBe(false);expect(g.player.inventory.items).not.toContain(scroll);
 expect((i.moduleData!.loot as unknown as LootItemDataV1).enhancement).toBe(1);expect(i.enchantment).toBe(ench);expect(i.strengthRequired).toBe(req);expect(i.timesEnchanted).toBe(1);expect(timeSystem.currentTick).toBeGreaterThan(tick);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
});
it('cancel from real read leaves scroll, knowledge, RNG and mechanical time unchanged',()=>{
 const g=open(),i=add(g,data()),tick=timeSystem.currentTick,random=rng.getState();const scroll=read(g);
 g.executeCommand('escape');expect(g.pendingEnchantment).toBe(false);expect(g.player.inventory.items).toContain(scroll);expect(timeSystem.currentTick).toBe(tick);expect(rng.getState()).toEqual(random);expect(i.timesEnchanted).toBe(0);
});
it('full normal item rejects before consuming and before curse removal',()=>{
 const g=open(),d=data();d.enhancement=10;const i=add(g,d);i.isCursed=true;
 const scroll=read(g),tick=timeSystem.currentTick,random=rng.getState();g.executeItemCommand('enchant',i);
 expect(g.player.inventory.items).toContain(scroll);expect(i.isCursed).toBe(true);expect(i.timesEnchanted).toBe(0);expect(timeSystem.currentTick).toBe(tick);expect(rng.getState()).toEqual(random);
});
it('late finish failure restores whole world, scroll, target and RNG after actual gain',()=>{
 const g=open(),i=add(g,data());read(g);vi.spyOn(g as any,'createFlare').mockImplementation(()=>{throw Error('late flare');});
 const audit=auditFullObjectGraph([g,rng]);
 expect(g.chooseEnchantTarget(i)).toBe(false);expect(audit.differences()).toEqual([]);
});
it('pending current-version save validates scroll ownership before retiring live game',()=>{
 const g=open();add(g,data());const scroll=read(g),snapshot=g.toSnapshot();expect(g.loadSnapshot(snapshot)).toBe(true);
 const bad=structuredClone(snapshot);bad.run.enchantmentScrollId=scroll.id+100000;const audit=auditFullObjectGraph([g,rng]);expect(g.loadSnapshot(bad)).toBe(false);expect(audit.differences()).toEqual([]);
});
const fixed=[['whisper','quietus',16],['cinder-mail','reflection',24],['colossus-maul','force',32],['vigil-plate','absorption',32]] as const;
it.each(fixed)('unique %s owns %s L0=%i without enchant addition; unknown reads do not reveal', (id,type,power)=>{
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),u=c.pack.uniques.uniques.find(u=>u.id===`loot.unique.${id}`)!;
 const d={...data(u.baseId),rarity:'unique' as const,uniqueId:u.id,affixes:u.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known:false}))},i=add(g,d);g.player.equip(i);markStatsDirty(g.player);
 const key=i.category===0?'native.runic-power':'native.armor-runic-power',before=JSON.stringify(i.moduleData),random=rng.getState();
 expect(nativeStat(g.player,key)).toBe(power);expect(g.extensionRuntime!.stats.breakdown(g.player.id,key,{},true).value).toBe(0);expect(JSON.stringify(i.moduleData)).toBe(before);expect(rng.getState()).toEqual(random);expect(i.runicType).toBe(type);
});
it('actual absorption reveals exactly its unique row; zero input does not; duplicate is read-only',()=>{
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),u=c.pack.uniques.uniques.find(u=>u.id==='loot.unique.vigil-plate')!;
 const i=add(g,{...data(u.baseId),rarity:'unique',uniqueId:u.id,affixes:u.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known:false}))});g.player.equip(i);
 const target=new Monster(g.player.x+1,g.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);g.monsters.push(target);g.extensionRuntime!.attachCreature(target);
 g.tryTriggerArmorRunic(target,0,true);expect(rows(i).every(r=>!r.known)).toBe(true);
 expect(g.tryTriggerArmorRunic(target,10,true)).toBeLessThan(10);expect(rows(i).filter(r=>r.known).map(r=>r.id)).toEqual(['loot.unique.vigil-plate.r4']);expect(i.runicKnown).toBe(true);
 const audit=auditFullObjectGraph([g,rng]);g.extensionRuntime!.commitItemRunicKnowledge(g.player,i,target,'absorption');expect(audit.differences()).toEqual([]);
});

it('all 21 random rune rows accept current data and only their matching committed receipt reveals',()=>{
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),defs=c.affixes.filter(a=>a.rune);expect(defs).toHaveLength(21);
 for(const a of defs){const d=data(a.rune!.slot==='weapon'?'dagger':'leather_armor');d.rarity='magic';d.corrupted=a.polarity===-1;d.affixes=[{id:a.id,tier:1,values:a.tiers[0]!.ranges.map(r=>r[0]),known:false}];if(['slaying','immunity'].includes(a.rune!.runicType))d.targetClass='animal';
  const i=add(g,d);g.player.equip(i);const key=i.category===0?'native.runic-power':'native.armor-runic-power';markStatsDirty(g.player);
  const audit=auditFullObjectGraph([g,rng]);nativeStat(g.player,key);g.extensionRuntime!.stats.hypothetical(g.player.id,{equip:i.id},true);expect(rows(i)[0]!.known,a.id).toBe(false);expect(audit.differences()).toEqual([]);
  g.extensionRuntime!.commitItemRunicKnowledge(g.player,i,null,'wrong-type');expect(rows(i)[0]!.known,a.id).toBe(false);
  // Protocol-only vector, separate from the actual effect cases below.
  g.extensionRuntime!.commitItemRunicKnowledge(g.player,i,null,a.rune!.runicType);expect(rows(i)[0]!.known,a.id).toBe(true);
  g.player.unequip(i,true);g.player.inventory.removeItem(i);
 }
});
const weaponRunes=['speed','quietus','paralyzing','multiplicity','slowing','confusion','force','slaying','mercy','plenty'];
it.each(weaponRunes)('actual weapon effect %s reveals its row without identifying unrelated affixes',type=>{
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),a=c.affixes.find(a=>a.rune?.slot==='weapon'&&a.rune.runicType===type)!;
 const d=data();d.rarity='magic';d.corrupted=a.polarity===-1;d.affixes=[{id:a.id,tier:1,values:a.tiers[0]!.ranges.map(r=>r[0]),known:false}];if(type==='slaying')d.targetClass='animal';
 const i=add(g,d);g.player.equip(i);const target=new Monster(g.player.x+1,g.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);target.hp=10;target.maxHp=100;g.monsters.push(target);g.extensionRuntime!.attachCreature(target);
 // Controlled scene: open space permits force and copies; no generator claim.
 for(let x=g.player.x-3;x<=g.player.x+8;x++)for(let y=g.player.y-3;y<=g.player.y+3;y++)if(g.grid.getCell(x,y))g.grid.setTerrain(x,y,TerrainType.FLOOR);
 (g as any).applyWeaponRunicEffect(target,1,type);expect(rows(i)[0]!.known,type).toBe(true);expect(i.runicKnown).toBe(true);
});
const armorRunes=['multiplicity','mutuality','absorption','reprisal','immunity','reflection','respiration','dampening','burden','vulnerability','immolation'];
it.each(armorRunes)('actual armor effect %s reveals only after danger',type=>{
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),a=c.affixes.find(a=>a.rune?.slot==='armor'&&a.rune.runicType===type)!;
 const d=data('leather_armor');d.rarity='magic';d.corrupted=a.polarity===-1;d.affixes=[{id:a.id,tier:1,values:a.tiers[0]!.ranges.map(r=>r[0]),known:false}];if(type==='immunity')d.targetClass='animal';
 const i=add(g,d);g.player.equip(i);for(let x=g.player.x-4;x<=g.player.x+4;x++)for(let y=g.player.y-4;y<=g.player.y+4;y++)if(g.grid.getCell(x,y))g.grid.setTerrain(x,y,TerrainType.FLOOR);
 const target=new Monster(g.player.x+1,g.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);target.hp=target.maxHp=100;g.monsters.push(target);g.extensionRuntime!.attachCreature(target);
 nativeStat(g.player,'native.armor-runic-power');expect(rows(i)[0]!.known).toBe(false);
 if(type==='mutuality'){const other=new Monster(g.player.x,g.player.y+1,(monsters as MonsterData[]).find(m=>m.id==='rat')!);g.monsters.push(other);g.extensionRuntime!.attachCreature(other);}
 vi.spyOn(rng,'randPercent').mockReturnValue(true);
 if(type==='reflection'){const r=g.castMonsterBolt(target,g.player,'SLOW_2');expect(r?.reflections.some(r=>r.creature===g.player)).toBe(true);}
 else if(type==='respiration'){g.grid.setTerrain(g.player.x,g.player.y,TerrainType.CONFUSION_GAS);(g as any).applyEnvironmentalEffects(g.player);expect(g.player.hasStatus('confused')).toBe(false);}
 else if(type==='dampening'){g.grid.setTerrain(g.player.x,g.player.y,TerrainType.GAS_EXPLOSION);(g as any).resolveExplosionDamage(g.player);}
 else g.tryTriggerArmorRunic(target,10,true);
 expect(rows(i)[0]!.known,type).toBe(true);expect(i.runicKnown).toBe(true);
});
function rune(g:ReturnType<typeof open>,type:string,slot:'weapon'|'armor'){
 const c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),a=c.affixes.find(a=>a.rune?.slot===slot&&a.rune.runicType===type)!,d=data(slot==='weapon'?'dagger':'leather_armor');d.rarity='magic';d.corrupted=a.polarity<0;d.affixes=[{id:a.id,tier:1,values:a.tiers[0]!.ranges.map(r=>r[0]),known:false}];if(type==='slaying'||type==='immunity')d.targetClass='animal';const i=add(g,d);g.player.equip(i);return i;
}
function rat(g:ReturnType<typeof open>){const target=new Monster(g.player.x+1,g.player.y,(monsters as MonsterData[]).find(m=>m.id==='rat')!);g.monsters.push(target);g.extensionRuntime!.attachCreature(target);return target;}
it.each(['paralyzing','confusion','speed','mercy','slaying'])('weapon %s does not reveal without attributable change',type=>{
 const g=open(),i=rune(g,type,'weapon'),target=rat(g);
 if(type==='paralyzing')target.setStatusDuration('paralyzed',9999);
 if(type==='confusion')target.setStatusDuration('confused',9999);
 if(type==='speed')g.player.ticksUntilTurn=-1;
 if(type==='mercy')target.hp=target.maxHp;
 if(type==='slaying')target.typeId='goblin';
 (g as any).applyWeaponRunicEffect(target,1,type);expect(rows(i)[0]!.known).toBe(false);expect(i.runicKnown).toBe(false);
});
it.each(['multiplicity','burden','immolation','absorption','vulnerability','immunity','mutuality','reprisal','respiration','dampening','reflection'])('armor %s rejects failed/no-danger effect attribution',type=>{
 const g=open(),i=rune(g,type,'armor'),target=rat(g);vi.spyOn(rng,'randPercent').mockReturnValue(false);
 if(type==='immunity')target.typeId='goblin';
 if(type==='reprisal')target.behaviorFlags.add('MONST_INVULNERABLE');
 if(type==='reflection'){const result=g.castMonsterBolt(target,g.player,'SLOW_2');expect(result?.reflections).toHaveLength(0);}
 else if(type==='respiration'||type==='dampening'){g.grid.setTerrain(g.player.x,g.player.y,TerrainType.FLOOR);(g as any).applyEnvironmentalEffects(g.player);}
 else g.tryTriggerArmorRunic(target,type==='immunity'?10:0,true);
 expect(rows(i)[0]!.known,type).toBe(false);expect(i.runicKnown).toBe(false);
});
it('failed rune knowledge validator rolls back lethal effect, complete graph, both RNG streams and allocator',()=>{
 const g=open(),i=rune(g,'quietus','weapon'),target=rat(g);
 vi.spyOn(ItemLoader,'updateIdentifiableItem').mockImplementation(()=>{throw Error('runic knowledge rejected');});const audit=auditFullObjectGraph([g,rng]);
 expect(()=>(g as any).applyWeaponRunicEffect(target,1,'quietus')).toThrow('runic knowledge rejected');expect(audit.differences()).toEqual([]);expect(rows(i)[0]!.known).toBe(false);
});
it.each(fixed.slice(0,3))('actual fixed unique %s publishes its own row',id=>{
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),u=c.pack.uniques.uniques.find(u=>u.id===`loot.unique.${id}`)!;
 const i=add(g,{...data(u.baseId),rarity:'unique',uniqueId:u.id,affixes:u.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known:false}))});g.player.equip(i);const target=rat(g);
 for(let x=g.player.x-2;x<=g.player.x+10;x++)for(let y=g.player.y-2;y<=g.player.y+2;y++)if(g.grid.getCell(x,y))g.grid.setTerrain(x,y,TerrainType.FLOOR);
 if(i.runicType==='reflection'){vi.spyOn(rng,'randPercent').mockReturnValue(true);expect(g.castMonsterBolt(target,g.player,'SLOW_2')?.reflections.some(r=>r.creature===g.player)).toBe(true);}
 else (g as any).applyWeaponRunicEffect(target,1,i.runicType);
 expect(rows(i).filter(r=>r.known).map(r=>r.id)).toEqual([u.rows.find(r=>r.modifiers.some(m=>m.runicType))!.rowId]);
});
it('war hammer level2→3 contributes local damage and one quarter-unit conversion exactly once',()=>{
 const g=open(),d=data('war_hammer');d.enhancement=2;const i=add(g,d);g.player.strength=20;g.player.equip(i);markStatsDirty(g.player);
 expect([nativeStat(g.player,'native.weapon-base-min'),nativeStat(g.player,'native.weapon-base-max'),nativeStat(g.player,'native.weapon-enchant')]).toEqual([30,42,0]);
 read(g);g.executeItemCommand('enchant',i);expect([nativeStat(g.player,'native.weapon-base-min'),nativeStat(g.player,'native.weapon-base-max'),nativeStat(g.player,'native.weapon-enchant')]).toEqual([32,45,4]);expect(i.enchantment).toBe(0);expect(i.strengthRequired).toBe(20);
 g.extensionRuntime!.stats.clear();expect(nativeStat(g.player,'native.weapon-base-max')).toBe(45);
});
it('armor adds five maximum HP and five internal armor per accepted level without a refill',()=>{
 const g=open(),d=data('leather_armor');d.enhancement=2;const i=add(g,d),hp=g.player.hp;g.player.equip(i);markStatsDirty(g.player);const max=g.player.maxHp,armor=nativeStat(g.player,'native.defense');expect(max-hp).toBe(10);
 read(g);g.executeItemCommand('enchant',i);expect(g.player.maxHp).toBe(max+5);expect(nativeStat(g.player,'native.defense')).toBe(armor+5);expect(g.player.hp).toBeLessThan(g.player.maxHp);expect(i.enchantment).toBe(0);
});

it.each(['dagger','ring_of_light'])('enhancement preserves native negation/degradation offset on %s and zero is inert',base=>{
 const g=open(),d=data(base);d.enhancement=3;const i=add(g,d);i.enchantment=-2;
 const audit=auditFullObjectGraph([g,rng]);g.extensionRuntime!.applyItemEnhancement(i,0);expect(audit.differences()).toEqual([]);
 read(g);g.executeItemCommand('enchant',i);expect(i.enchantment).toBe(base==='dagger'?-2:-1);expect((i.moduleData!.loot as unknown as LootItemDataV1).enhancement).toBe(4);
});
it.each(['quietus','slowing','force','multiplicity','plenty'])('weapon %s rejects already complete or blocked effects',type=>{
 const g=open(),i=rune(g,type,'weapon'),target=rat(g);
 if(type==='quietus')target.hp=0;
 if(type==='slowing')target.setStatusDuration('slowed',5); // L0=2: floor((2+2)^2/3)
 if(['force','multiplicity','plenty'].includes(type))for(let x=0;x<g.grid.width;x++)for(let y=0;y<g.grid.height;y++)g.grid.setTerrain(x,y,TerrainType.WALL);
 (g as any).applyWeaponRunicEffect(target,1,type);expect(rows(i)[0]!.known).toBe(false);expect(i.runicKnown).toBe(false);
});
it('repeated known/unknown projections never start item transactions or consume either RNG stream',()=>{
 const g=open(),i=rune(g,'absorption','armor'),r=g.extensionRuntime!;
 nativeStat(g.player,'native.armor-runic-power');r.stats.hypothetical(g.player.id,{},true);
 const transaction=vi.spyOn(r,'itemCommandTransaction'),audit=auditFullObjectGraph([g,rng]);
 for(let n=0;n<100;n++){nativeStat(g.player,'native.armor-runic-power');r.stats.hypothetical(g.player.id,{},true);r.itemEnhancementLimit(i);}
 expect(transaction).not.toHaveBeenCalled();expect(audit.differences()).toEqual([]);
});
it.each(fixed)('fixed unique %s rejects a failed or zero %s effect',id=>{
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),u=c.pack.uniques.uniques.find(u=>u.id===`loot.unique.${id}`)!;
 const i=add(g,{...data(u.baseId),rarity:'unique',uniqueId:u.id,affixes:u.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known:false}))});g.player.equip(i);const target=rat(g);
 if(i.runicType==='reflection'){vi.spyOn(rng,'randPercent').mockReturnValue(false);expect(g.castMonsterBolt(target,g.player,'SLOW_2')?.reflections).toHaveLength(0);}
 else if(i.runicType==='absorption')expect(g.tryTriggerArmorRunic(target,0,true)).toBe(0);
 else{if(i.runicType==='quietus')target.hp=0;else g.grid.setTerrain(target.x+1,target.y,TerrainType.WALL);(g as any).applyWeaponRunicEffect(target,1,i.runicType);}
 expect(rows(i).every(r=>!r.known)).toBe(true);expect(i.runicKnown).toBe(false);
});

it('loot projectile uses its own L0, commits its row, and never reveals the held weapon',()=>{
 const g=open(),projectile=rune(g,'paralyzing','weapon'),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),u=c.pack.uniques.uniques.find(u=>u.id==='loot.unique.colossus-maul')!;
 const held=add(g,{...data(u.baseId),rarity:'unique',uniqueId:u.id,affixes:u.rows.map(r=>({id:r.rowId,tier:0,values:r.ranges.map(v=>v[0]),known:false}))});g.player.equip(held);markStatsDirty(g.player);
 const target=rat(g);target.hp=target.maxHp=10000;target.setStatusDuration('stuck',1000);vi.spyOn(rng,'randPercent').mockReturnValue(true);
 expect(nativeStat(g.player,'native.runic-power')).toBe(32);expect(nativeProjectileRunic(g.player,projectile)).toBe(2);
 g.throwItemAt(projectile,target.x,target.y);expect(rows(projectile)[0]!.known).toBe(true);expect(target.maxStatus.paralyzed).toBe(3);expect(rows(held).every(r=>!r.known)).toBe(true);
 expect(g.player.inventory.items).not.toContain(projectile);
});
it('loot projectile knowledge failure restores removal, effect, both RNG streams and the whole world',()=>{
 const g=open(),projectile=rune(g,'paralyzing','weapon');g.player.unequip(projectile,true);const target=rat(g);target.hp=target.maxHp=10000;target.setStatusDuration('stuck',1000);
 vi.spyOn(rng,'randPercent').mockReturnValue(true);vi.spyOn(ItemLoader,'updateIdentifiableItem').mockImplementation(()=>{throw Error('projectile knowledge rejected');});const audit=auditFullObjectGraph([g,rng]);
 expect(()=>g.throwItemAt(projectile,target.x,target.y)).toThrow('projectile knowledge rejected');expect(audit.differences()).toEqual([]);
});

// R1: committed effects and detail projections must survive current-version saves.
function reviewArmor(type:string){
 const g=open(),c=resolveLootCatalog(g.extensionRuntime!.queryOptional.bind(g.extensionRuntime)),a=c.affixes.find(a=>a.rune?.slot==='armor'&&a.rune.runicType===type)!;
 const d=data('leather_armor');d.rarity='rare';d.nameParts=[0,0];d.affixes=[{id:'loot.affix.fireward',tier:1,values:[800],known:false},{id:a.id,tier:1,values:a.tiers[0]!.ranges.map(r=>r[0]),known:false}];
 const i=add(g,d);g.player.equip(i);
 for(let x=g.player.x-2;x<=g.player.x+2;x++)for(let y=g.player.y-2;y<=g.player.y+2;y++)if(g.grid.getCell(x,y))g.grid.setTerrain(x,y,TerrainType.FLOOR);
 return {g,i};
}
it('R1 mutuality reveals for one damage shared even when the player share is unchanged, including save/load',()=>{
 const {g,i}=reviewArmor('mutuality'),attacker=rat(g),neighbor=rat(g);neighbor.loc={x:g.player.x,y:g.player.y+1};neighbor.hp=neighbor.maxHp=100;
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
 const armor=g.player.equippedArmor!,a=g.monsters.find(m=>m.id===attacker.id)!,n=g.monsters.find(m=>m.id===neighbor.id)!;
 expect(g.tryTriggerArmorRunic(a,1,true)).toBe(1);expect(n.hp).toBe(99);expect(rows(armor).map(r=>r.known)).toEqual([false,true]);expect(armor.runicKnown).toBe(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(g.player.equippedArmor!.id).toBe(i.id);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,true]);expect(g.monsters.find(m=>m.id===neighbor.id)!.hp).toBe(99);
});
it('R1 mutuality one-damage receipt rolls back neighbor damage and knowledge on failure',()=>{
 const {g,i}=reviewArmor('mutuality'),attacker=rat(g),neighbor=rat(g);neighbor.loc={x:g.player.x,y:g.player.y+1};neighbor.hp=neighbor.maxHp=100;
 vi.spyOn(ItemLoader,'updateIdentifiableItem').mockImplementation(()=>{throw Error('shared receipt rejected');});const audit=auditFullObjectGraph([g,rng]);
 expect(()=>g.tryTriggerArmorRunic(attacker,1,true)).toThrow('shared receipt rejected');expect(audit.differences()).toEqual([]);expect(rows(i).every(r=>!r.known)).toBe(true);
});
it('R1 respiration ignores instant poison contact, then reveals only when gradual damage is blocked across save/load',()=>{
 const {g}=reviewArmor('respiration');g.grid.setTerrain(g.player.x,g.player.y,TerrainType.POISON_GAS);g.disturbed=false;
 const before={hp:g.player.hp,statuses:structuredClone(g.player.statusDurations),disturbed:g.disturbed};
 (g as any).applyEnvironmentalEffects(g.player);expect({hp:g.player.hp,statuses:g.player.statusDurations,disturbed:g.disturbed}).toEqual(before);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,false]);expect(g.player.equippedArmor!.runicKnown).toBe(false);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,false]);
 (g as any).applyEnvironmentalEffects();expect(g.player.hp).toBe(before.hp);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,true]);expect(g.player.equippedArmor!.runicKnown).toBe(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,true]);
});
it.each([[TerrainType.CONFUSION_GAS,'confused',25],[TerrainType.PARALYSIS_GAS,'paralyzed',20],[TerrainType.ROT_GAS,'nauseous',20]] as const)('R1 respiration only reveals when gas %s would extend its status, including save/load',(tile,status,duration)=>{
 const {g}=reviewArmor('respiration');g.grid.setTerrain(g.player.x,g.player.y,tile);g.player.setStatusDuration(status,9999);
 (g as any).applyEnvironmentalEffects(g.player);expect(g.player.getStatusDuration(status)).toBe(9999);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,false]);expect(g.player.equippedArmor!.runicKnown).toBe(false);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);g.player.setStatusDuration(status,duration-1);(g as any).applyEnvironmentalEffects(g.player);
 expect(g.player.getStatusDuration(status)).toBe(duration-1);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,true]);expect(g.player.equippedArmor!.runicKnown).toBe(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);expect(rows(g.player.equippedArmor!).map(r=>r.known)).toEqual([false,true]);
});
it('R1 known armor keeps its own L0 and enhancement preview on floor, pickup and saved floor, without revealing other rows',async()=>{
 const {createItemDetailContext}=await import('../../../../engine/UI/ItemDetailContext'),{equipmentDetail}=await import('../../../../engine/UI/ItemDetailEquipment');
 const {g,i}=reviewArmor('absorption'),attacker=rat(g);
 const detail=(item:typeof i)=>equipmentDetail(item,createItemDetailContext(g,item));
 expect(createItemDetailContext(g,i).statProjection!['native.armor-runic-power']).toBe(0);
 g.tryTriggerArmorRunic(attacker,10,true);const carried=createItemDetailContext(g,i),runic=detail(i).slice(-1)[0];
 expect(carried.statProjection!['native.armor-runic-power']).toBe(8);expect(carried.nextStatProjection!['native.armor-runic-power']).toBe(8);
 g.player.unequip(i,true);g.player.inventory.removeItem(i);i.loc={x:g.player.x,y:g.player.y};g.items.push(i);
 const check=(item:typeof i)=>{const context=createItemDetailContext(g,item);expect(context.statProjection!['native.armor-runic-power']).toBe(8);expect(context.nextStatProjection!['native.armor-runic-power']).toBe(8);expect(context.nextStatProjection!['native.defense']).toBe(carried.nextStatProjection!['native.defense']);expect(detail(item).slice(-1)[0]).toEqual(runic);expect(rows(item).map(r=>r.known)).toEqual([false,true]);};
 check(i);const audit=auditFullObjectGraph([g,rng]);for(let n=0;n<3;n++)check(i);expect(audit.differences()).toEqual([]);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);const floor=g.items.find(item=>item.id===i.id)!;check(floor);
 g.items.splice(g.items.indexOf(floor),1);expect(g.player.inventory.addItem(floor)).toBe(true);check(floor);
});

it('R1 unknown floor inspection stays filtered and does not grant inventory admission',async()=>{
 const {createItemDetailContext}=await import('../../../../engine/UI/ItemDetailContext'),{equipmentDetail}=await import('../../../../engine/UI/ItemDetailEquipment');
 const {g,i}=reviewArmor('absorption');g.player.unequip(i,true);g.player.inventory.removeItem(i);i.loc={x:g.player.x,y:g.player.y};g.items.push(i);
 const inspect=()=>{const ctx=createItemDetailContext(g,i);expect(ctx.statProjection!['native.armor-runic-power']).toBe(0);expect(ctx.nextStatProjection!['native.armor-runic-power']).toBe(0);expect(equipmentDetail(i,ctx).some(s=>s.header?.includes('吸收'))).toBe(false);};
 inspect();const transaction=vi.spyOn(g.extensionRuntime!,'itemCommandTransaction'),audit=auditFullObjectGraph([g,rng]);inspect();expect(transaction).not.toHaveBeenCalled();expect(audit.differences()).toEqual([]);
 expect(()=>g.extensionRuntime!.stats.hypothetical(g.player.id,{equip:i.id},true)).toThrow();expect(rows(i).every(r=>!r.known)).toBe(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);const floor=g.items.find(item=>item.id===i.id)!;expect(createItemDetailContext(g,floor).statProjection!['native.armor-runic-power']).toBe(0);expect(rows(floor).every(r=>!r.known)).toBe(true);
});
