import { readFileSync } from 'node:fs';
import { afterEach, expect, it, vi } from 'vitest';
import i18next from 'i18next';
import { assertGiantsPack, isGiantsPack } from '../schema';
import { loadGiantsDefinitionPack } from '../definitions';
import { createGiantsModuleFromPack } from '../module';
import * as catalog from '../../../catalog';
import { registryFromDescriptors } from '../../../descriptor';
import { nativeFormData } from '../../../nativeForms';
import { startGiants, json } from './naturalFixture';
import { logger } from '../../../../engine/Systems/Logger';
afterEach(() => { vi.restoreAllMocks(); logger.reset(); });

it('all three complete author examples are read from the manual and installed by the real schema/runtime', () => {
  const manual = readFileSync(new URL('../../../../../docs/ext/giants-config.md', import.meta.url), 'utf8');
  const examples = [...manual.matchAll(/<!-- giants-config-example: (\w+) -->\n```json\n([\s\S]*?)\n```/g)];
  expect(examples.map(example => example[1])).toEqual(['enemy', 'body', 'transition']);
  for (const example of examples) {
    const pack: unknown = JSON.parse(example[2]!); assertGiantsPack(pack);
    vi.restoreAllMocks();
    const module = createGiantsModuleFromPack(pack);
    const descriptors = catalog.getInstalledModuleDescriptors().map(d => d.id === 'giants' ? { ...d, rules: module.rules, create: () => module } : d);
    vi.spyOn(catalog, 'createExtensionRegistry').mockReturnValue(registryFromDescriptors(descriptors));
    const runtime = startGiants(['giants'], 7351, 'wizard').extensionRuntime!;
    expect(runtime.nativeForms().map(form => form.id)).toEqual(pack.forms.map(form => form.id));
    expect(runtime.generationContributions(pack.templates[0]!.minDepth)).toHaveLength(pack.templates.length);
    if (example[1] === 'body') expect(runtime.spatialCatalog.body(pack.bodies!.definitions[0]!.id).parts).toHaveLength(2);
    if (example[1] === 'transition') expect(module.bodyTransitions).toEqual(pack.transitions);
  }
});

it('messages resolve actual configured forms and quantities, including renamed results and all move kinds', () => {
  // Initialize the exact same locales/entity naming adapter used by production.
  startGiants();
  for (const reason of ['phase','split','clone','summon'] as const) {
    const pack = loadGiantsDefinitionPack(), original = pack.transitions![0]!;
    const move = { ...original, transition: { ...original.transition, reason,
      hp: reason === 'split' ? 'conserve' as const : reason === 'phase' ? 'ratio' as const : 'current' as const,
      results: Array.from({ length: reason === 'split' ? 3 : 1 }, () => ({ formId: ['clone','summon'].includes(reason) ? original.sourceFormId : pack.forms[0]!.id, memberMap: [] })) } };
    pack.transitions = [move];
    const targetIndex = pack.forms.findIndex(form => form.id === move.transition.results[0]!.formId);
    // Reuse another declared text key: no species-name literal in the hook.
    const target = { ...pack.forms[targetIndex]!, nameKey: 'ext.giants.spine_crawler.name' };
    pack.forms[targetIndex] = target;
    const module = createGiantsModuleFromPack(pack), message = vi.fn();
    module.hooks!.bodyTransition!({sourceGroupId:1,reason,moveId:move.id,outcome:'applied',resultGroupIds:[1,2,3],retiredIds:[]}, {
      state: {schema:1,revision:0,placements:[],bosses:[]}, setState: vi.fn(), setComponent: vi.fn(), message
    } as any);
    expect(message).toHaveBeenCalledOnce();
    expect(message.mock.calls[0]![0]).toContain(`${reason === 'split' ? 3 : 1}具${nativeFormData(target).name}`);
    expect(message.mock.calls[0]![0]).not.toContain('岩脊碎像');
    const failure = vi.fn();
    module.hooks!.bodyTransition!({sourceGroupId:1,reason,moveId:move.id,outcome:'no-space',resultGroupIds:[],retiredIds:[]}, {message:failure} as any);
    expect(failure.mock.calls[0]![0]).toContain(nativeFormData(pack.forms.find(form=>form.id===move.sourceFormId)!).name);
  }
  expect(i18next.t('ext.giants.transition.split', {name:'沉渊巨像',results:'2具岩脊兽'})).toBe('沉渊巨像崩解，裂成2具岩脊兽！');
});

it('unopened declarations and hostile persisted capabilities are rejected before retiring the old run', () => {
  const edits = [
    (pack: any) => { pack.forms[0].size = 4; },
    (pack: any) => { pack.forms[2].footprint.poses = ['m0']; },
    (pack: any) => { pack.forms[2].breakRules[0].regenerate = {delayTicks:100,formId:pack.forms[2].id,maxCycles:1}; },
    (pack: any) => { pack.bodies.breakRules[0].disposition = 'debris'; },
    (pack: any) => { pack.bodies.definitions[0].coreDeath = 'debris-members'; },
    (pack: any) => { pack.transitions[0].transition.reason = 'regrow'; },
  ];
  for (const edit of edits) { const pack = loadGiantsDefinitionPack(); edit(pack); expect(isGiantsPack(pack)).toBe(false); expect(()=>createGiantsModuleFromPack(pack)).toThrow(); }
  const game = startGiants(['giants'], 7347, 'wizard'); game.monsters=[]; game.dormantMonsters=[];
  // The current room is open at the player; search actual full-fit candidates.
  const at = Array.from({length:game.grid.width*game.grid.height},(_,i)=>({x:i%game.grid.width,y:Math.floor(i/game.grid.width)}))
    .find(p=>game.canCreateModuleMonster('giants.spine-crawler',p))!;
  const actor=game.createModuleMonster('giants.spine-crawler',at)!;
  const save=json(game.toSaveSnapshot()), player=game.player, runtime=game.extensionRuntime;
  for (const edit of [
    (s:typeof save)=>{s.monsters[0]!.spatial!.pose='m0';},
    (s:typeof save)=>{s.monsters[0]!.spatial!.zoneState![0]!.regenerateInTicks=10;},
    (s:typeof save)=>{s.monsters[0]!.spatial!.zoneState![0]!.generation=1;},
    (s:typeof save)=>{s.monsters[0]!.typeId='giants.square-4';s.monsters[0]!.form.id='giants.square-4';},
  ]) { const bad=json(save);edit(bad);expect(game.loadSnapshot(bad)).toBe(false);expect(game.player).toBe(player);expect(game.extensionRuntime).toBe(runtime);expect(game.monsters).toContain(actor); }
  expect(()=>game.createModuleMonster('giants.square-4',at)).toThrow('Unavailable');
});
