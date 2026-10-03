import { describe, expect, it } from 'vitest';
import data from '../data/definitions.json';
import { loadGrowthDefinitionPack, parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack, GrowthIdentity, GrowthRuleActor, GrowthSkill } from '../types';
import { createGrowthIdentityBuild, defaultGrowthIdentitySelection, initialGrowthIdentityBuild, growthIdentityAttributeValues,
    growthIdentityDefinitions, growthIdentityEffects, growthIdentityGiftIds, grantGrowthIdentitySkills, isGrowthIdentityBuild,
    growthIdentityFirstVisitEffects, type GrowthIdentitySelection } from '../identities';
import { initialGrowthSkillBuild, inheritGrowthSkillBuild, growthLearnedCost, growthSkillDefinition, canLearnGrowthSkill,
    createGrowthEffectInstance, growthSkillScopes, growthSkillCooldown, isGrowthSkillBuild, type GrowthSkillBuild } from '../skills';
import { evaluateGrowthPhysicalDamage, evaluateGrowthPort } from '../evaluator';
import { growthFocusCapacity, growthFocusInterval, growthScalarInput } from '../attributes';
import { rng } from '../../../../engine/Random';

const pack = loadGrowthDefinitionPack({hasText:()=>true});
const copy = () => structuredClone(data) as unknown as GrowthDefinitionPack;
const parsed = (value: GrowthDefinitionPack) => parseGrowthDefinitionPack(value,{moduleVersion:value.moduleVersion,hasText:()=>true});
const identity = (source: GrowthDefinitionPack, id: string) => source.definitions.find(d=>d.id===id) as GrowthIdentity;
function selection(profession='guardian',lineage='human',faith='unaffiliated'): GrowthIdentitySelection {
    return {professionId:`growth.profession.${profession}`,lineageId:`growth.lineage.${lineage}`,faithId:`growth.faith.${faith}`,
        choices:lineage==='human'?[{identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.agility':1}}]:[]};
}
function created(chosen=selection()) {
    const identity=createGrowthIdentityBuild(pack,chosen), actor:GrowthRuleActor={id:1,level:1,attributes:growthIdentityAttributeValues(pack,identity)};
    const build=grantGrowthIdentitySkills(pack,identity,actor,initialGrowthSkillBuild());
    return {identity,actor,build};
}
const combinations = ['guardian','scout','explorer','skirmisher'].flatMap(profession=>['human','stoneborn','duskborn','reedfolk'].flatMap(lineage=>
    ['unaffiliated','watch','path','restraint'].map(faith=>({profession,lineage,faith}))));

describe('EXT-1e shared identity selection and provenance',()=> {
    it.each(combinations)('creates $profession / $lineage / $faith with bounded free grants and no RNG',({profession,lineage,faith})=> {
        const before=rng.getState(), {identity,actor,build}=created(selection(profession,lineage,faith));
        expect(isGrowthIdentityBuild(identity,pack)).toBe(true);
        expect(Object.values(actor.attributes).reduce((sum,value)=>sum+value,0)).toBe(3);
        expect(build.gifted).toEqual(growthIdentityGiftIds(pack,identity));expect(build.learned).toEqual(build.gifted);
        expect(build.active).toHaveLength(1);expect(build.passive).toHaveLength(1);expect(build.inherited).toEqual([]);
        expect(growthLearnedCost(pack,build)).toBe(0);expect(isGrowthSkillBuild(build,pack,actor.id,0,1,identity)).toBe(true);
        expect(grantGrowthIdentitySkills(pack,identity,actor,build)).toEqual(build);expect(rng.getState()).toEqual(before);
    });
    it('defaults are reversible data-order previews and never mutate the frozen pack',()=> {
        const before=JSON.stringify(pack), chosen=defaultGrowthIdentitySelection(pack);
        expect(chosen).toEqual(selection());expect(createGrowthIdentityBuild(pack,chosen).choices[0]!.attributes).not.toBe(chosen.choices[0]!.attributes);
        chosen.choices[0]!.attributes['growth.attribute.agility']=8;
        expect(defaultGrowthIdentitySelection(pack)).toEqual(selection());expect(JSON.stringify(pack)).toBe(before);
    });
    it('backs out overlapping defaults without random choice or spending point budgets twice',()=> {
        const changed=copy();changed.config.attributes.find(a=>a.id==='growth.attribute.agility')!.cap=1;
        identity(changed,'growth.profession.scout').attributes[0]!.amount=1;
        for(const skill of changed.definitions) if(skill.kind==='skill') for(const requirement of skill.prerequisites)
            if(requirement.kind==='attribute' && requirement.attributeId==='growth.attribute.agility') requirement.min=1;
        changed.config.identities.budgets.lineage=2;
        identity(changed,'growth.lineage.human').choices=[
            {attributeIds:['growth.attribute.agility','growth.attribute.will'],points:1,perAttributeCap:1},
            {attributeIds:['growth.attribute.agility'],points:1,perAttributeCap:1},
        ];
        const custom=parsed(changed), chosen=defaultGrowthIdentitySelection(custom);
        expect(chosen.choices.map(choice=>choice.attributes)).toEqual([{'growth.attribute.will':1},{'growth.attribute.agility':1}]);
        expect(()=>createGrowthIdentityBuild(custom,chosen)).not.toThrow();
    });
    it('handles huge exact and impossible weighted defaults without a rank-sized loop',()=> {
        const changed=copy();changed.config.attributeTotalCap=null;changed.config.identities.enabled.professions=false;changed.config.identities.enabled.faiths=false;
        const attribute=changed.config.attributes.find(a=>a.id==='growth.attribute.agility')!;attribute.cap=Number.MAX_SAFE_INTEGER;attribute.pointCost=2;
        changed.config.identities.budgets.lineage=Number.MAX_SAFE_INTEGER;
        const human=identity(changed,'growth.lineage.human');human.choices=[{attributeIds:[attribute.id],points:Number.MAX_SAFE_INTEGER-1,perAttributeCap:Number.MAX_SAFE_INTEGER}];
        const exact=defaultGrowthIdentitySelection(changed);expect(exact.choices[0]!.attributes[attribute.id]).toBe((Number.MAX_SAFE_INTEGER-1)/2);
        expect(()=>createGrowthIdentityBuild(changed,exact)).not.toThrow();
        human.choices[0]!.points=Number.MAX_SAFE_INTEGER;
        const unfilled=defaultGrowthIdentitySelection(changed);expect(unfilled.choices[0]!.attributes).toEqual({});
        expect(()=>createGrowthIdentityBuild(changed,unfilled)).toThrow();
    });
    it('requires explicit enabled identities, rejects wrong kinds and ignores no unknown fields',()=> {
        for (const value of [null,{}, {...selection(),professionId:null},{...selection(),professionId:'growth.lineage.human'},
            {...selection(),extra:true},{...selection(),templateId:null},{...selection(),choices:[]},
            {...selection(),choices:[...selection().choices,...selection().choices]}]) expect(()=>createGrowthIdentityBuild(pack,value)).toThrow();
        expect(isGrowthIdentityBuild(initialGrowthIdentityBuild(),pack)).toBe(false);
        expect(isGrowthIdentityBuild(initialGrowthIdentityBuild(),pack,true)).toBe(true);
        const extra={...initialGrowthIdentityBuild(),revision:0};expect(isGrowthIdentityBuild(extra,pack,true)).toBe(false);
    });
    it('turns disabled dimensions into explicit nulls without grants, gifts, effects or choices',()=> {
        const changed=copy();changed.config.identities.enabled={professions:false,lineages:false,faiths:false};const custom=parsed(changed);
        const chosen=defaultGrowthIdentitySelection(custom), build=createGrowthIdentityBuild(custom,chosen);
        expect(build).toEqual(initialGrowthIdentityBuild());expect(growthIdentityDefinitions(custom,build)).toEqual([]);
        expect(growthIdentityEffects(custom,build)).toEqual([]);expect(growthIdentityGiftIds(custom,build)).toEqual([]);
        expect(()=>createGrowthIdentityBuild(custom,selection())).toThrow();
        expect(growthIdentityEffects(custom,selection('guardian','stoneborn','watch'))).toEqual([]);
    });
    it('validates exact weighted choice budgets, declared attributes, per-choice rank caps and indexes atomically',()=> {
        for (const choice of [
            {identityId:'growth.lineage.human',choiceIndex:1,attributes:{'growth.attribute.agility':1}},
            {identityId:'growth.lineage.stoneborn',choiceIndex:0,attributes:{'growth.attribute.agility':1}},
            {identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.agility':2}},
            {identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.agility':0}},
            {identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.agility':-1}},
            {identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.agility':0.5}},
            {identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.missing':1}},
            {identityId:'growth.lineage.human',choiceIndex:0,attributes:{}},
        ]) {const chosen={...selection(),choices:[choice]}, before=JSON.stringify(chosen);expect(()=>createGrowthIdentityBuild(pack,chosen)).toThrow();expect(JSON.stringify(chosen)).toBe(before);}
        const changed=copy(), agility=changed.config.attributes.find(a=>a.id==='growth.attribute.agility')!;
        agility.pointCost=2;changed.config.identities.budgets.profession=4;changed.config.identities.budgets.lineage=2;
        identity(changed,'growth.lineage.human').choices[0]!.points=2;const custom=parsed(changed);
        expect(createGrowthIdentityBuild(custom,selection()).choices[0]!.attributes).toEqual({'growth.attribute.agility':1});
        expect(()=>createGrowthIdentityBuild(custom,{...selection(),choices:[{identityId:'growth.lineage.human',choiceIndex:0,attributes:{'growth.attribute.will':1}}]})).toThrow();
    });
    it('checks combined identity caps, global rank caps and exact definition budgets before returning grants',()=> {
        const changed=copy();changed.config.attributes.find(a=>a.id==='growth.attribute.constitution')!.cap=2;const custom=parsed(changed);
        expect(()=>createGrowthIdentityBuild(custom,selection('guardian','stoneborn'))).toThrow();
        const total=copy();total.config.attributeTotalCap=2;const capped=parsed(total);
        expect(()=>createGrowthIdentityBuild(capped,selection())).toThrow();
        const budget=copy();budget.config.identities.budgets.profession=1;
        expect(()=>createGrowthIdentityBuild(budget,selection())).toThrow();
    });
    it('rejects accessors, symbols and sparse choice arrays without executing code',()=> {
        let read=false;const accessor={...selection()};Object.defineProperty(accessor,'professionId',{enumerable:true,get(){read=true;return 'growth.profession.guardian';}});
        expect(()=>createGrowthIdentityBuild(pack,accessor)).toThrow();expect(read).toBe(false);
        expect(()=>createGrowthIdentityBuild(pack,{...selection(),[Symbol('extra')]:1})).toThrow();
        const sparse=selection();sparse.choices=new Array(1);expect(()=>createGrowthIdentityBuild(pack,sparse)).toThrow();
        const hidden=selection();Object.defineProperty(hidden.choices,'0',{enumerable:false,get(){read=true;return {};}});
        expect(()=>createGrowthIdentityBuild(pack,hidden)).toThrow();expect(read).toBe(false);
    });
    it('waives gifts only at grant time, resolves gift prerequisites together, and keeps clone gifts cost-free',()=> {
        const chosen=created(selection('scout','duskborn')), clone=inheritGrowthSkillBuild(chosen.build);
        expect(clone.gifted).toEqual([]);expect(clone.inherited).toEqual(chosen.build.learned);expect(growthLearnedCost(pack,clone)).toBe(0);
        const changed=copy(), profession=identity(changed,'growth.profession.guardian'), gift=profession.gifts[0]!;
        gift.waivePrerequisites=false;const row=changed.definitions.find(d=>d.id===gift.skillId) as GrowthSkill;row.prerequisites=[{kind:'level',min:2}];
        const custom=parsed(changed), selected=createGrowthIdentityBuild(custom,selection()), actor={id:1,level:1,attributes:growthIdentityAttributeValues(custom,selected)};
        const empty=initialGrowthSkillBuild();expect(()=>grantGrowthIdentitySkills(custom,selected,actor,empty)).toThrow();expect(empty).toEqual(initialGrowthSkillBuild());
        expect(grantGrowthIdentitySkills(custom,selected,{...actor,level:2},empty).gifted).toContain(row.id);
        profession.gifts[0]!.waivePrerequisites=true;row.lock={mode:'hard',professionIds:['growth.profession.scout'],lineageIds:[],faithIds:[]};changed.config.skills.lockMode='hard';
        const waived=parsed(changed);expect(grantGrowthIdentitySkills(waived,selected,actor,empty).gifted).toContain(row.id);
        expect(canLearnGrowthSkill(waived,row,actor,empty,selected)).toBe(false);
        const paid={...empty,learned:[row.id]};expect(()=>grantGrowthIdentitySkills(waived,selected,actor,paid)).toThrow();
    });
    it('shares gift limits across dimensions while deduplicating a repeated gift',()=> {
        const changed=copy(), human=identity(changed,'growth.lineage.human');
        human.gifts=[{skillId:'growth.skill.brace',waivePrerequisites:true}];
        const duplicate=parsed(changed), chosen=createGrowthIdentityBuild(duplicate,selection());
        expect(growthIdentityGiftIds(duplicate,chosen)).toHaveLength(2);
        const actor={id:1,level:1,attributes:growthIdentityAttributeValues(duplicate,chosen)};
        expect(grantGrowthIdentitySkills(duplicate,chosen,actor,initialGrowthSkillBuild()).active).toEqual(['growth.skill.brace']);
        human.gifts=[{skillId:'growth.skill.survey',waivePrerequisites:true}];const excess=parsed(changed);
        expect(()=>createGrowthIdentityBuild(excess,selection())).toThrow();
        expect(()=>grantGrowthIdentitySkills(excess,selection(),actor,initialGrowthSkillBuild())).toThrow();
    });
    it.each(['none','soft','hard'] as const)('uses minimum global/per-skill locks: %s',global=> {
        const changed=copy();changed.config.skills.lockMode=global;
        const row=changed.definitions.find(d=>d.id==='growth.skill.measured-strike') as GrowthSkill;
        row.lock={mode:'hard',professionIds:['growth.profession.scout'],lineageIds:['growth.lineage.duskborn'],faithIds:['growth.faith.watch']};
        const custom=parsed(changed), actor={id:1,level:1,attributes:growthIdentityAttributeValues(custom,createGrowthIdentityBuild(custom,selection()))};
        expect(canLearnGrowthSkill(custom,row,actor,initialGrowthSkillBuild(),selection())).toBe(global!=='hard');
        expect(canLearnGrowthSkill(custom,row,actor,initialGrowthSkillBuild(),selection('scout','duskborn','watch'))).toBe(true);
        row.lock.mode='soft';expect(canLearnGrowthSkill(changed,row,actor,initialGrowthSkillBuild(),selection())).toBe(true);
    });
});

describe('EXT-1e identity/oath effects use shared finite ports and tagged snapshots',()=> {
    it('applies duration, intensity and cooldown together and validates exact casting-time identity sources',()=> {
        const {identity,actor,build}=created(selection('guardian','stoneborn','watch')), brace=growthSkillDefinition(pack,'growth.skill.brace')!;
        const effect=brace.effects.find(effect=>effect.kind==='timed')!;if(effect.kind!=='timed')throw Error();
        const instance=createGrowthEffectInstance(pack,brace,effect,actor,build,4,1,1,identity);build.effects=[instance];
        expect(instance.expiresAt).toBe(7);expect(instance.taggedSources).toContain('growth.lineage.stoneborn');expect(instance.taggedSources).toContain('growth.faith.watch');
        expect(growthSkillCooldown(pack,brace,actor,build,4,identity)).toBe(12);
        const input={...growthScalarInput({...actor,id:2},100),target:actor,attackKind:'melee' as const,damageKind:'physical' as const,direct:true,immune:false};
        expect(evaluateGrowthPhysicalDamage(pack,input,growthSkillScopes(pack,build,4,'target',identity))).toBe(75);
        expect(evaluateGrowthPhysicalDamage(pack,input,growthSkillScopes(pack,build,7,'target',identity))).toBe(100);
        expect(isGrowthSkillBuild(build,pack,actor.id,4,2,identity)).toBe(true);
        const before=JSON.stringify(build);for(const mutate of [
            (b:GrowthSkillBuild)=>{b.effects[0]!.taggedSources.push('growth.lineage.duskborn');b.effects[0]!.taggedSources.sort();},
            (b:GrowthSkillBuild)=>{b.effects[0]!.taggedSources=b.effects[0]!.taggedSources.filter(id=>id!=='growth.lineage.stoneborn');b.effects[0]!.expiresAt=6;},
            (b:GrowthSkillBuild)=>{b.effects[0]!.taggedSources.push('growth.skill.brace');b.effects[0]!.taggedSources.sort();},
            (b:GrowthSkillBuild)=>{b.effects[0]!.taggedSources.push('growth.identity.unknown');b.effects[0]!.taggedSources.sort();},
            (b:GrowthSkillBuild)=>{b.effects[0]!.expiresAt=6;},
            (b:GrowthSkillBuild)=>{b.gifted.push('growth.skill.composure');b.gifted.sort();},
        ]) {const corrupt=structuredClone(build);mutate(corrupt);expect(isGrowthSkillBuild(corrupt,pack,actor.id,4,2,identity)).toBe(false);}
        expect(JSON.stringify(build)).toBe(before);
    });
    it('keeps nonmatching skill tags neutral and applies identity search effects only to tagged manual search',()=> {
        const {identity,actor,build}=created(selection('explorer','reedfolk'));
        const input={...growthScalarInput(actor,10),mode:'manual' as const,tags:['growth.tag.survey']};
        const scopes=growthSkillScopes(pack,build,0,'actor',identity);
        expect(evaluateGrowthPort(pack,'searchStrength',input,scopes)).toBe(23);
        expect(evaluateGrowthPort(pack,'searchStrength',{...input,tags:[]},scopes)).toBe(21);
        expect(evaluateGrowthPort(pack,'searchStrength',{...input,mode:'automatic'},scopes)).toBe(16);
        const unrelated=growthSkillDefinition(pack,'growth.skill.survey')!;
        expect(growthSkillCooldown(pack,unrelated,actor,build,0,selection('guardian','stoneborn','watch'))).toBe(unrelated.cooldown);
    });
    it('adds oath benefits/costs and pure first-visit receipts once per actor/effect/depth, including no-op resource grants',()=> {
        const path=created(selection('guardian','human','path')), scopes=growthSkillScopes(pack,path.build,0,'actor',path.identity);
        expect(growthFocusCapacity(pack,path.actor,scopes)).toBe(7);
        expect(growthIdentityFirstVisitEffects(pack,path.identity,1,1,[])).toEqual([]);
        const first=growthIdentityFirstVisitEffects(pack,path.identity,1,2,[]);expect(first).toHaveLength(1);expect(first[0]!.effect.amount).toBe(1);
        expect(first[0]!.receiptKey).toBe('growth.effect.path-focus:1:2');
        expect(growthIdentityFirstVisitEffects(pack,path.identity,1,2,[first[0]!.receiptKey])).toEqual([]);
        expect(growthIdentityFirstVisitEffects(pack,path.identity,2,2,[first[0]!.receiptKey])).toHaveLength(1);
        expect(growthIdentityFirstVisitEffects(pack,path.identity,1,27,[])).toEqual([]);
        const restraint=created(selection('guardian','human','restraint')), restraintScopes=growthSkillScopes(pack,restraint.build,0,'actor',restraint.identity);
        expect(growthFocusCapacity(pack,restraint.actor,restraintScopes)).toBe(9);expect(growthFocusInterval(pack,restraint.actor,restraintScopes)).toBe(9);
    });
    it('rejects hidden/accessor timed snapshot fields without running getters',()=> {
        const {identity,actor,build}=created();let called=false;
        Object.defineProperty(build,'effects',{enumerable:true,get(){called=true;return [];}});
        expect(isGrowthSkillBuild(build,pack,actor.id,0,1,identity)).toBe(false);expect(called).toBe(false);
        const extra=initialGrowthSkillBuild();Object.defineProperty(extra,'hidden',{value:1});
        expect(isGrowthSkillBuild(extra,pack,1,0,1)).toBe(false);
    });
    it('uses renamed data IDs without adding rule branches',()=> {
        const changed=JSON.parse(JSON.stringify(data).split('growth.lineage.stoneborn').join('growth.lineage.custom-body').split('growth.faith.watch').join('growth.faith.custom-oath')) as GrowthDefinitionPack;
        const custom=parsed(changed), selected=createGrowthIdentityBuild(custom,selection('guardian','custom-body','custom-oath'));
        const actor={id:1,level:1,attributes:growthIdentityAttributeValues(custom,selected)}, build=grantGrowthIdentitySkills(custom,selected,actor,initialGrowthSkillBuild());
        const brace=growthSkillDefinition(custom,'growth.skill.brace')!, effect=brace.effects.find(effect=>effect.kind==='timed')!;if(effect.kind!=='timed')throw Error();
        expect(createGrowthEffectInstance(custom,brace,effect,actor,build,0,1,1,selected).expiresAt).toBe(3);
        expect(growthSkillCooldown(custom,brace,actor,build,0,selected)).toBe(12);
    });
});
