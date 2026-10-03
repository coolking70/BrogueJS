import { describe, expect, it } from 'vitest';
import data from '../data/definitions.json';
import { loadGrowthDefinitionPack, parseGrowthDefinitionPack } from '../definitions';
import type { GrowthDefinitionPack, GrowthIdentity, GrowthRuleActor, GrowthSkill, GrowthTimedEffect } from '../types';
import { createGrowthIdentityBuild, grantGrowthIdentitySkills, growthIdentityAttributeValues } from '../identities';
import { createGrowthEffectInstance, growthSkillDefinition, initialGrowthSkillBuild, growthSkillScopes, growthSkillCooldown,
    growthSkillScalar, projectGrowthSkillBuild, growthPublicSkillScopes, growthPublicSkillCooldown, growthPublicSkillScalar,
    type GrowthSkillBuild } from '../skills';
import { evaluateGrowthPhysicalDamage, evaluateGrowthPort } from '../evaluator';
import { growthScalarInput } from '../attributes';
import { rng } from '../../../../engine/Random';

const base = loadGrowthDefinitionPack({hasText:()=>true});
const attributes = (pack: typeof base, values: Record<string,number>={}) => Object.fromEntries(pack.config.attributes.map(attribute=>[attribute.id,values[attribute.id]??0]));
function freeze<T>(value: T): T {
    if(value && typeof value==='object') {for(const child of Object.values(value)) freeze(child);Object.freeze(value);}return value;
}
function foreign() {
    const dataCopy=structuredClone(data) as unknown as GrowthDefinitionPack;
    const skill=dataCopy.definitions.find(definition=>definition.id==='growth.skill.pressure') as GrowthSkill;
    const effect=skill.effects.find(effect=>effect.kind==='timed' && effect.recipient==='target') as GrowthTimedEffect;
    effect.modifiers[0]!.conditions=[];
    effect.modifiers[0]!.magnitude={source:{kind:'attribute',attributeId:'growth.attribute.will'},coefficient:-100,divisor:1,rounding:'floor',min:-1000,max:0};
    effect.modifiers.push({kind:'modifier',port:'cooldownDuration',operation:'add',slot:null,
        magnitude:{source:{kind:'level'},coefficient:1,divisor:1,rounding:'floor',min:0,max:20},conditions:[]});
    const profession:GrowthIdentity={kind:'profession',id:'growth.profession.private-source',nameKey:'ext.growth.profession.guardian.name',
        descriptionKey:'ext.growth.profession.guardian.description',attributes:[],choices:[],gifts:[],recommendedAttributes:[],recommendedSkills:[],effects:[],oaths:[{
            id:'growth.oath.private-source',descriptionKey:'ext.growth.oath.watch.description',effects:[{
                kind:'tagged-modifier',property:'intensity',tag:'growth.tag.pressure-target',operation:'add',slot:null,
                magnitude:{source:{kind:'level'},coefficient:-25,divisor:1,rounding:'floor',min:-500,max:0},
                conditions:[{kind:'role',value:'actor'},{kind:'hit',value:true},{kind:'tag',tag:'growth.tag.brace'}],
            }],
        }]};
    const passive:GrowthSkill={...structuredClone(dataCopy.definitions.find(definition=>definition.id==='growth.skill.composure') as GrowthSkill),
        id:'growth.skill.private-passive',effects:[{kind:'tagged-modifier',property:'intensity',tag:'growth.tag.pressure-target',operation:'add',slot:null,
            magnitude:{source:{kind:'attribute',attributeId:'growth.attribute.perception'},coefficient:-10,divisor:1,rounding:'floor',min:-100,max:0},
            conditions:[{kind:'role',value:'target'},{kind:'hit',value:false}]}]};
    dataCopy.definitions.push(profession,passive);
    const pack=parseGrowthDefinitionPack(dataCopy,{moduleVersion:dataCopy.moduleVersion,hasText:()=>true});
    const source:GrowthRuleActor={id:79973,level:7,attributes:attributes(pack,{'growth.attribute.will':3,'growth.attribute.perception':4})};
    const sourceBuild={...initialGrowthSkillBuild(),learned:[passive.id],passive:[passive.id]};
    const build:GrowthSkillBuild={...initialGrowthSkillBuild(),learned:['growth.skill.brace','growth.skill.composure'],active:['growth.skill.brace'],passive:['growth.skill.composure']};
    build.effects=[createGrowthEffectInstance(pack,skill,effect,source,sourceBuild,4,912,671,{professionId:profession.id})];
    const actor:GrowthRuleActor={id:1,level:1,attributes:attributes(pack)}, target={...actor,id:2};
    return {pack,source,build,actor,target};
}

describe('EXT-1e identity-safe public timed effect DTO',()=> {
    it('projects exact detached fields without gift receipts, source identity, actor attributes or effect bookkeeping',()=> {
        const {pack,build}=foreign(),before=JSON.stringify({pack,build}),random=rng.getState();
        const projected=projectGrowthSkillBuild(pack,freeze(build));
        expect(Object.keys(projected).sort()).toEqual(['active','effects','inherited','learned','passive']);
        const effect=projected.effects[0]!;
        expect(Object.keys(effect).sort()).toEqual(['expiresAt','modifiers','taggedModifiers','tags']);
        expect(effect.expiresAt).toBe(6);expect(effect.modifiers[0]!.magnitude).toEqual({source:{kind:'constant'},coefficient:-300,divisor:1,rounding:'floor',min:-300,max:-300});
        expect(effect.taggedModifiers.map(modifier=>modifier.magnitude.coefficient)).toEqual([-175,-40]);
        const serialized=JSON.stringify(projected);
        for(const forbidden of ['gifted','growth.profession.private-source','growth.oath.private-source','growth.skill.private-passive',
            'growth.skill.pressure','growth.effect.pressure-target','growth.attribute.will','growth.attribute.perception',
            '79973','taggedSources','instanceId','actionId','startedAt','remaining']) expect(serialized).not.toContain(forbidden);
        effect.tags.push('growth.tag.changed');effect.modifiers[0]!.conditions.push({kind:'hit',value:false});
        effect.taggedModifiers[0]!.conditions.push({kind:'hit',value:false});effect.modifiers[0]!.magnitude.coefficient=99;
        projected.learned.push('growth.skill.changed');
        expect(JSON.stringify({pack,build})).toBe(before);expect(rng.getState()).toEqual(random);
    });
    it.each(['actor','target'] as const)('preserves foreign-source conditional intensity with %s ownership for every hit/tag condition',owner=> {
        const {pack,build,actor,target}=foreign(),projected=freeze(projectGrowthSkillBuild(pack,freeze(build))),random=rng.getState();
        for(const hit of [false,true]) for(const tagged of [false,true]) for(const clock of [4,5,6]) {
            const input={...growthScalarInput(actor,5000),target,attackKind:'melee' as const,damageKind:'physical' as const,rollMode:'roll-probability' as const,
                tags:tagged?['growth.tag.brace']:[]};
            const original=evaluateGrowthPort(pack,'hitChance',input,growthSkillScopes(pack,build,clock,owner),{hit});
            const visible=evaluateGrowthPort(pack,'hitChance',input,growthPublicSkillScopes(pack,projected,clock,owner),{hit});
            expect(visible).toBe(original);
            expect(visible).toBe(clock>=6?5000:4700-(owner==='actor'&&hit&&tagged?175:owner==='target'&&!hit?40:0));
        }
        expect(rng.getState()).toEqual(random);
    });
    it('keeps cooldown/scalar previews equivalent and uses captured values even if the live source changes later',()=> {
        const {pack,build,actor}=foreign(),projected=projectGrowthSkillBuild(pack,build),brace=growthSkillDefinition(pack,'growth.skill.brace')!;
        const identity={faithId:'growth.faith.restraint'};
        for(const clock of [4,6]) {
            expect(growthPublicSkillCooldown(pack,brace,actor,projected,clock,identity)).toBe(growthSkillCooldown(pack,brace,actor,build,clock,identity));
            for(const port of ['focusCapacity','focusRecoveryInterval','searchStrength'] as const)
                expect(growthPublicSkillScalar(pack,port,actor,projected,8,clock,identity)).toBe(growthSkillScalar(pack,port,actor,build,8,clock,identity));
        }
        expect(growthPublicSkillCooldown(pack,brace,actor,projected,4,identity)).toBe(17);
        (build.effects[0]!.source.attributes as Record<string,number>)['growth.attribute.will']=8;
        const input={...growthScalarInput(actor,5000),rollMode:'roll-probability' as const};
        expect(evaluateGrowthPort(pack,'hitChance',input,growthPublicSkillScopes(pack,projected,4))).toBe(4700);
        expect(evaluateGrowthPort(pack,'hitChance',input,growthSkillScopes(pack,build,4))).toBe(4200);
    });
    it('preserves player identity/passive contributions and self-effect math without exposing durable sources',()=> {
        const identity=createGrowthIdentityBuild(base,{professionId:'growth.profession.guardian',lineageId:'growth.lineage.stoneborn',faithId:'growth.faith.watch',choices:[]});
        const actor={id:1,level:1,attributes:growthIdentityAttributeValues(base,identity)},build=grantGrowthIdentitySkills(base,identity,actor,initialGrowthSkillBuild());
        const brace=growthSkillDefinition(base,'growth.skill.brace')!,effect=brace.effects[0] as GrowthTimedEffect;
        build.effects=[createGrowthEffectInstance(base,brace,effect,actor,build,4,1,1,identity)];
        const projected=freeze(projectGrowthSkillBuild(base,freeze(build))),random=rng.getState();
        const input={...growthScalarInput({...actor,id:2},100),target:actor,attackKind:'melee' as const,damageKind:'physical' as const,direct:true,immune:false};
        for(const clock of [4,7]) expect(evaluateGrowthPhysicalDamage(base,input,growthPublicSkillScopes(base,projected,clock,'target',identity)))
            .toBe(evaluateGrowthPhysicalDamage(base,input,growthSkillScopes(base,build,clock,'target',identity)));
        expect(evaluateGrowthPhysicalDamage(base,input,growthPublicSkillScopes(base,projected,4,'target',identity))).toBe(75);
        expect(growthPublicSkillCooldown(base,brace,actor,projected,4,identity)).toBe(12);
        expect(Object.keys(projected).sort()).not.toContain('gifted');expect(rng.getState()).toEqual(random);
    });
    it('preserves fractional clamp endpoints, multiply slots and deferred conditions when resolving source magnitudes',()=> {
        const changed=structuredClone(data) as unknown as GrowthDefinitionPack,skill=changed.definitions.find(definition=>definition.id==='growth.skill.brace') as GrowthSkill;
        const effect=skill.effects[0] as GrowthTimedEffect;
        effect.modifiers[0]!.operation='multiply';effect.modifiers[0]!.slot='growth.slot.final';
        effect.modifiers[0]!.magnitude={source:{kind:'level'},coefficient:1,divisor:10,rounding:'floor',min:0.75,max:0.75};
        effect.modifiers[0]!.conditions=[{kind:'hit',value:true}];
        const pack=parseGrowthDefinitionPack(changed,{moduleVersion:changed.moduleVersion,hasText:()=>true}),actor={id:1,level:2,attributes:attributes(pack)},build=initialGrowthSkillBuild();
        build.effects=[createGrowthEffectInstance(pack,skill,effect,actor,build,0,1,1)];
        const projected=projectGrowthSkillBuild(pack,build);
        expect(projected.effects[0]!.modifiers[0]).toMatchObject({operation:'multiply',slot:'growth.slot.final',conditions:[{kind:'hit',value:true}],magnitude:{coefficient:0.75,min:0.75,max:0.75}});
        const input={...growthScalarInput({...actor,id:2},100),target:actor,attackKind:'melee' as const,damageKind:'physical' as const,direct:true,immune:false};
        for(const hit of [true,false]) {
            const raw=evaluateGrowthPhysicalDamage(pack,input,growthSkillScopes(pack,build,0,'target'),{hit});
            expect(evaluateGrowthPhysicalDamage(pack,input,growthPublicSkillScopes(pack,projected,0,'target'),{hit})).toBe(raw);
            expect(raw).toBe(hit?75:100);
        }
    });
});
