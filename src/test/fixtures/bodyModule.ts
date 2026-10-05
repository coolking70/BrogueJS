/** Foundation-owned executable declarations. No installed module data, hooks,
 * UI, state or fingerprint is borrowed. The historical encounter values are
 * retained so the existing mechanics assertions keep their original meaning. */
import type { ModuleDescriptor } from '../../ext/descriptor';
import type { ExtensionModule } from '../../ext/types';
import type { NativeFormDefinition } from '../../ext/nativeForms';
import type { BodyDefinition, PartBreakRule } from '../../engine/Movement/SpatialSchema';
import { extensionDataFingerprint } from '../../ext/fingerprint';

const owner = 'body-fixture';
const id = (name: string) => `${owner}.${name}`;
const form = (name: string, values: Partial<NativeFormDefinition>): NativeFormDefinition => ({
    id: id(name), nameKey: `ext.${owner}.${name}.name`, descriptionKey: `ext.${owner}.${name}.description`,
    char: 'F', color: 11965276, hp: 120, accuracy: 90, defense: 40, damage: '4-9',
    moveSpeed: 100, attackSpeed: 100, bloodType: 0, DFChance: 0, DFType: 0, size: 2, ...values,
});
export function bodyFixtureDescriptor(): ModuleDescriptor {
    const ridge = form('ridgeback', {}), colossus = form('abyssal-colossus', { size: 3, hp: 260, accuracy: 95, defense: 60, damage: '8-16', moveSpeed: 200 });
    const spine = form('spine-crawler', { hp: 150, defense: 30, damage: '5-10' });
    delete (spine as { size?: number }).size;
    Object.assign(spine, { footprint: { geometry: { kind: 'mask', cells: [0,1,2,3].map(x => ({ x, y: 0 })) }, poses: ['r0','r90','r180','r270'],
        zones: [{ id: 'shell', nameKey: `ext.${owner}.shell`, health: { kind: 'local', maxHp: 30, ownerTransfer: { numerator: 1, denominator: 1 } }, armor: 2, damageMultiplier: { numerator: 1, denominator: 1 }, breakRuleId: id('shell-break') },
            { id: 'head', nameKey: `ext.${owner}.head`, health: { kind: 'native' }, armor: 0, damageMultiplier: { numerator: 1, denominator: 1 }, breakRuleId: 'foundation:keep-zone' }],
        zoneCells: [{ x: 0, y: 0, zoneId: 'head' }, { x: 1, y: 0, zoneId: 'shell' }, { x: 2, y: 0, zoneId: 'shell' }] },
        breakRules: [{ id: id('shell-break'), owner, trigger: 'hp-zero', disposition: 'keep-zone', modifiers: [
            { kind: 'move-ticks-multiplier', numerator: 3, denominator: 2 }, { kind: 'expose-zone', partId: 'self', zoneId: 'head', damageMultiplier: { numerator: 2, denominator: 1 } },
            { kind: 'balance-loss', amount: 6, fallbackStunTicks: 50 }] }] });
    const core = form('shale-weaver', { hp: 96, accuracy: 75, defense: 20, damage: '3-6', moveSpeed: 150, attackSpeed: 150 });
    const leg = form('shale-weaver-leg', { hp: 12, accuracy: 75, defense: 10, damage: '1-3', moveSpeed: 150, attackSpeed: 200 });
    delete (leg as { size?: number }).size;
    Object.assign(leg, { footprint: { geometry: { kind: 'rect', width: 1, height: 1 }, poses: ['r0'] } });
    const offsets = [{x:-1,y:-1},{x:0,y:-1},{x:2,y:-1},{x:2,y:0},{x:2,y:2},{x:1,y:2},{x:-1,y:2},{x:-1,y:1}];
    const rule: PartBreakRule = { id: id('leg-retire'), owner, trigger: 'hp-zero', disposition: 'remove', childrenOnBreak: 'retire-subtree',
        modifiers: [{ kind: 'move-ticks-multiplier', numerator: 9, denominator: 8 }, { kind: 'balance-loss', amount: 4, fallbackStunTicks: 30 }] };
    const body: BodyDefinition = { id: id('shale-weaver-body'), owner, minSupportParts: 1, noSupport: 'immobile', coreDeath: 'remove-members', statusProfileId: 'foundation:native',
        parts: [{ partId: 'core', role: 'core', providesSupport: false, formId: core.id, preferredOffset: {x:0,y:0}, attackProfileIds: [id('core-profile')],
            coreTransfer: {numerator:0,denominator:1}, breakRuleId: 'foundation:keep-zone', statusProfileId: 'foundation:native' },
            ...offsets.map((preferredOffset, i) => ({partId:`leg${String(i).padStart(2,'0')}`,role:'support' as const,providesSupport:true,formId:leg.id,preferredOffset,
                attackProfileIds:[id('leg-profile')],coreTransfer:{numerator:1,denominator:4},breakRuleId:rule.id,statusProfileId:'foundation:native'}))],
        constraints: offsets.map((_,i)=>({childPartId:`leg${String(i).padStart(2,'0')}`,parentPartId:'core',kind:'tether',minDistance:1,maxDistance:3,maxStepPerAction:2,requiresClearLink:true})) };
    const declarations = { nativeForms: [ridge,colossus,spine,core,leg], nativeBodies: { definitions:[body],breakRules:[rule],attackProfiles:[
        {id:id('core-profile'),owner,providerProfileId:'combat.shock-ring'},{id:id('leg-profile'),owner,providerProfileId:'combat.fan-edge'}] },
        bodyTransitions:[{id:id('colossus-fracture'),sourceFormId:colossus.id,condition:{kind:'hp-at-most' as const,numerator:1,denominator:2},ticks:200,hpCost:0,
            transition:{reason:'split' as const,results:[{formId:ridge.id,memberMap:[]},{formId:ridge.id,memberMap:[]}],hp:'conserve' as const,statuses:'preserve' as const,relationships:'preserve' as const,placement:'nearest' as const}}] };
    const rules = {schema:1,version:'1.0.0',fingerprint:extensionDataFingerprint(declarations)};
    const module = (): ExtensionModule => ({id:owner,version:'1.0.0',rules,ownedRegions:true,
        initialState: () => ({ revision: 0 }), validateState: (v): v is import('../../ext/types').Json => !!v && typeof v === 'object' && !Array.isArray(v)
            && Object.keys(v).join(',') === 'revision' && 'revision' in v && Number.isSafeInteger(v.revision) && Number(v.revision) >= 0,
        ...structuredClone(declarations)});
    return {id:owner,version:'1.0.0',foundation:4,rules,create:module,labelKey:`ext.${owner}.name`};
}
