import {expect,it} from 'vitest';
import {ItemDrops} from '../../../itemDrops';
import {createItemHarness} from '../../../testing/itemHarness';
import {descriptor,createItemDropFixture} from '../../../testing/fixtures/itemFixture';
import {MonsterState} from '../../../../entities/Monster';
import {loadGiantsDefinitionPack} from '../definitions';
import {createGiantsModuleFromPack} from '../module';
import {walkNaturalToDepth} from './naturalFixture';
it('orders terminal consumption, survives reload, follows split and loses administrative encounters',()=>{
    const pack=loadGiantsDefinitionPack(),m=createGiantsModuleFromPack(pack),s=new ItemDrops([m]);
    const place=(actorId:number,key:string)=>s.placement({owner:'giants',instanceKey:`giants.${key}`,templateId:pack.templates[0]!.id,depth:1,result:'placed',reason:null,regionId:null,actorId,formId:pack.templates[0]!.formId},()=>true);
    place(10,'first');place(20,'second');
    const forged=s.snapshot();forged.encounters[0]!.formId='giants.undeclared';expect(()=>s.restore(forged)).toThrow();
    s.transition({sourceGroupId:10,reason:'split',moveId:null,outcome:'applied',resultGroupIds:[11,12],retiredIds:[10]},()=>true);
    expect(s.terminal(11,false)).toBeNull();expect(s.terminal(20,false)?.encounterOrdinal).toBe(1);
    const restored=new ItemDrops([m]);restored.restore(s.snapshot());expect(restored.terminal(12,false)?.encounterOrdinal).toBe(2);expect(restored.terminal(12,false)).toBeNull();
    place(30,'lost');expect(s.terminal(30,true)).toBeNull();expect(s.snapshot().nextEncounterOrdinal).toBe(2);
  });

it('real giants split transfers C6 subjects and terminal rewards survive save/load without reading private state',()=>{
  const h=createItemHarness({seed:7309,modules:['giants']},[{...descriptor,create:()=>createItemDropFixture({sources:['encounter']})}]),g=h.game();
  g.startNewGame({seed:7309,mode:'wizard',ruleSet:'extended',extensions:['c6fixture','giants']});g.animationEnabled=false;
  walkNaturalToDepth(g,7,true);const boss=g.monsters.find(m=>m.typeId==='giants.abyssal-colossus')!;expect(boss).toBeDefined();
  const key=g.extensionRuntime!.snapshot().foundation.itemDrops!.encounters.find(e=>e.subjects.includes(boss.id))!.key;
  // Only damage/readiness is diagnostic, exactly as the existing native split test.
  boss.hp=129;boss.state=MonsterState.HUNTING;boss.ticksUntilTurn=0;g.executeCommand('wait');expect(g.lastAdvancementError).toBeNull();
  const subjects=g.extensionRuntime!.snapshot().foundation.itemDrops!.encounters.find(e=>e.key===key)!.subjects;expect(subjects).toHaveLength(2);
  const before=(g.extensionRuntime!.snapshot().modules.c6fixture as any).settled;
  g.killMonster(g.monsters.find(m=>m.id===subjects[0])!);expect((g.extensionRuntime!.snapshot().modules.c6fixture as any).settled).toBe(before);
  expect(g.loadSnapshot(g.toSnapshot())).toBe(true);const last=g.monsters.find(m=>m.id===subjects[1])!;g.killMonster(last);
  expect((g.extensionRuntime!.snapshot().modules.c6fixture as any).settled).toBe(before+1);
  expect(g.extensionRuntime!.snapshot().foundation.itemDrops!.encounters.some(e=>e.key===key)).toBe(false);
  const settled=g.toSnapshot();expect(g.loadSnapshot(settled)).toBe(true);g.killMonster(last);expect((g.extensionRuntime!.snapshot().modules.c6fixture as any).settled).toBe(before+1);h.dispose();
},60000);
