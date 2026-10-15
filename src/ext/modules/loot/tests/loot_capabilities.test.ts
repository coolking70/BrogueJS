import {afterEach,expect,it} from 'vitest';
import {createWorldHarness,worldHarnessGame} from '../../../testing/worldHarness';
import {resolveLootCatalog,stateOf} from '../session';
import species from '../../../../data/monsters.json';
import {Monster,MonsterState,type MonsterData} from '../../../../entities/Monster';
import {Item,ItemCategory} from '../../../../engine/Items/Item';
import {forEachItemRoot} from '../../../../engine/Core/WorldItemRoots';
import {nativeStat} from '../../../../engine/Stats/NativeStatSources';
const handles:ReturnType<typeof createWorldHarness>[]=[];
function open(modules:string[]){const h=createWorldHarness({seed:7309,mode:'easy',modules});handles.push(h);return {h,g:worldHarnessGame(h)};}
afterEach(()=>handles.splice(0).forEach(h=>h.dispose()));
it('uses actual combat keys, retains unavailable growth fallback and binds capability identity',()=>{
 const h=createWorldHarness({seed:7309,mode:'easy',modules:['loot','combat','growth']});handles.push(h);const g=worldHarnessGame(h),r=g.extensionRuntime!,c=resolveLootCatalog(r.queryOptional.bind(r));
 expect(c.availability.combat?.stats).toContain('combat.stamina-capacity');expect(c.availability.growth).toBeNull();
 expect(c.affixes.some(a=>a.id==='loot.affix.enduring')).toBe(true);expect(c.affixes.some(a=>a.id.startsWith('loot.affix.adept'))).toBe(false);
 expect(stateOf(r.snapshot().modules.loot!).catalogFingerprint).toBe(c.fingerprint);
 const save=g.toSnapshot();expect(g.loadSnapshot(save)).toBe(true);expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).catalogFingerprint).toBe(c.fingerprint);
});
it.each(['accepted','lost','partial','skip'])('real giants split %s, loaded subjects, accepted receipts and scaling',mode=>{
 const lost=mode==='lost';
 const {g}=open(['loot','giants']);g.startNewGame({seed:7309,mode:'wizard',ruleSet:'extended',extensions:['loot','giants'],initialCommands:[JSON.stringify({module:'loot',action:'create',payload:{v:1,presetId:'standard'}})]});g.animationEnabled=false;
 // Generation diagnostic, not the recorded natural journey: real generator owns arena and birth.
 g.depth=7;(g as unknown as {generateDepth(first:boolean):void}).generateDepth(true);expect(g.lastAdvancementError).toBeNull();
 const r=g.extensionRuntime!,boss=g.monsters.find(m=>m.typeId==='giants.abyssal-colossus')!;expect(boss).toBeDefined();
 expect(resolveLootCatalog(r.queryOptional.bind(r)).availability.giants?.formIds).toContain(boss.typeId);
 expect(r.stats.breakdown(boss.id,'native.max-hp').rows.some(row=>row.owner==='loot'&&row.layer==='environment'&&row.value===3500)).toBe(true);
 expect(nativeStat(boss,'native.max-hp')).toBe(boss.maxHp);
 const key=r.snapshot().foundation.itemDrops!.encounters.find(e=>e.subjects.includes(boss.id))!.key;
 boss.hp=129;boss.state=MonsterState.HUNTING;boss.ticksUntilTurn=0;g.executeCommand('wait');expect(g.lastAdvancementError).toBeNull();
 const subjects=r.snapshot().foundation.itemDrops!.encounters.find(e=>e.key===key)!.subjects;expect(subjects).toHaveLength(2);
 const before=stateOf(r.snapshot().modules.loot!).watermark;
 if(lost){const subject=g.monsters.find(m=>m.id===subjects[0])!;g.becomeAllyWith(subject);r.reconcileMaterialized(subject.id);}
 g.killMonster(g.monsters.find(m=>m.id===subjects[0])!);expect(stateOf(r.snapshot().modules.loot!).watermark).toBe(before);
 expect(g.loadSnapshot(g.toSnapshot(),message=>{throw Error(message);})).toBe(true);
 const beforeItems=g.items.filter(i=>i.moduleData?.loot).length;
 if(mode==='partial'||mode==='skip'){let roots=0;forEachItemRoot(g,()=>roots++);for(let n=roots;n<(mode==='partial'?8191:8192);n++)g.items.push(new Item('capacity','?',1,ItemCategory.WEAPON));}
 g.killMonster(g.monsters.find(m=>m.id===subjects[1])!);
 expect(stateOf(g.extensionRuntime!.snapshot().modules.loot!).watermark).toBe(before+(lost?0:1));
 if(mode==='partial'||mode==='skip'){expect(g.items.filter(i=>i.moduleData?.loot).length).toBe(beforeItems+(mode==='partial'?1:0));expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.encounters.some(e=>e.key===key)).toBe(false);return;}
 const final=g.toSnapshot();expect(g.loadSnapshot(final)).toBe(true);expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.encounters.some(e=>e.key===key)).toBe(false);
},60000);

it('retains the floor of a carried actor during detached multi-level load validation',()=>{
 const {g}=open(['loot']),carrier=g.monsters.find(m=>!m.carriedMonster)!,child=new Monster(carrier.x,carrier.y,(species as MonsterData[]).find(m=>m.id==='ogre')!);
 carrier.carriedMonster=child;g.extensionRuntime!.attachCreature(child);const before=child.maxHp;
 g.depth=7;(g as unknown as {generateDepth(first:boolean):void}).generateDepth(true);
 expect(g.loadSnapshot(g.toSnapshot())).toBe(true);
 const oldCarrier=g.levels.get(1)!.monsters.find(m=>m.id===carrier.id)!;expect(oldCarrier.carriedMonster!.maxHp).toBe(before);
});
