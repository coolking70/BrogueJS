import {timeSystem} from '../engine/Systems/Time';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import I18NextVue from 'i18next-vue';
import i18next from 'i18next';
import '../i18n';
import { createSfcHarness } from './support/sfcHarness';
import * as creation from '../ext/ui/creation';
import { createExtensionRegistry } from '../ext/catalog';
import {logger} from '../engine/Systems/Logger';
import { Game } from '../engine/Core/Game';
import { Monster, MonsterState } from '../entities/Monster';
import { getNextEntityId } from '../entities/Creature';
import monsterCatalog from '../data/monsters.json';
import { TerrainType } from '../engine/Map/Grid';
import { footprintOf } from '../engine/Movement/CreatureSpatial';
import { ItemLoader } from '../engine/Items/ItemLoader';
import { rng } from '../engine/Random';
import { newPartyWindow } from '../ext/partyWindow';
import { candidateSource } from '../engine/Core/ResidentWorld';
import { worldWorkLastError } from '../engine/Core/WorldWork';
import { peekEdibleState } from '../engine/Core/EdibleState';
import { bedroom, campScene, currentCamp, addCampMaterial } from './support/partyCampFixture';
import type { WorldHarness } from '../ext/worldSdk';
import type { GameSnapshot } from '../engine/Core/WholeRunSnapshot';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

type N = { tag: string; text: string; props: Record<string, any>; children: N[]; parent: N | null;
  readonly tagName: string; readonly options: N[]; addEventListener(): void; removeEventListener(): void; focus():void; querySelector(selector:string):N|null; querySelectorAll(selector:string):N[]; matches(selector:string):boolean };
const node = (tag = '', text = ''): N => Vue.markRaw<N>({ tag, text, props: {}, children: [], parent: null,
  get tagName() { return tag.toUpperCase(); }, get options() { return this.children.filter((n:N) => n.tag === 'option'); },
  addEventListener() {}, removeEventListener() {}, focus(){Reflect.set(document,'activeElement',this);},
  matches(selector){return selector==='[data-preset]'?this.props['data-preset']!==undefined:false;},
  querySelector(selector){const m=/\[data-preset="([^"]+)"\]/.exec(selector);return all(this).find(n=>m?n.props['data-preset']===m[1]:false)??null;},
  querySelectorAll(){return all(this).filter(n=>n.tag==='button'&&!n.props.disabled&&n.props.tabindex!==-1);} });
const body = node('body');
const all = (n: N): N[] => [n, ...n.children.flatMap(all)];
const text = (n: N): string => n.text + n.children.map(text).join('');
const renderer = Vue.createRenderer<N, N>({
  createElement: tag => node(tag), createText: t => node('', t), createComment: () => node(),
  insert(child, parent, anchor) {
    child.parent?.children.splice(child.parent.children.indexOf(child), 1);
    const index = anchor ? parent.children.indexOf(anchor) : -1;
    parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent;
  },
  remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
  setText(n, t) { n.text = t; }, setElementText(n, t) { n.text = t; n.children = []; },
  parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
  patchProp(n, k, _old, value) { n.props[k] = value; if (['value', 'type', 'multiple'].includes(k)) Reflect.set(n, k, value); }, querySelector: () => body
});

const modules = ['combat', 'crafting', 'foraging', 'giants', 'growth', 'loot', 'narrative', 'settlement'];
const installed=[...modules,'party'].sort();
let Menu: Vue.Component;
let failure: Error | undefined;
let capturedError: unknown;
beforeAll(async () => {
    expect(createExtensionRegistry().manifest(['party']).modules.map(m=>m.id)).toEqual(['party']);
    expect(createExtensionRegistry().manifest(modules).modules.map(m => m.id)).toEqual(modules);
    vi.stubGlobal('window', { innerWidth: 800, innerHeight: 900, addEventListener() {}, removeEventListener() {},
        localStorage: { getItem: () => null, setItem() {} } });
    vi.stubGlobal('document', { documentElement: { dataset: {}, style: { setProperty() {} } }, activeElement: null,
        addEventListener() {}, removeEventListener() {}, querySelector: () => null });
    const harness = createSfcHarness({ baseURL: import.meta.url });
    const steps: Record<string, Vue.Component> = {
        party: await harness.load('../ext/modules/party/ui/PartyCreationStep.vue'),
        growth: await harness.load('../ext/modules/growth/ui/GrowthCreationStep.vue'),
        loot: await harness.load('../ext/modules/loot/ui/creation/LootCreationStep.vue'),
    };
    const Empty = Vue.defineComponent({ render: () => null });
    Menu = await createSfcHarness({ baseURL: import.meta.url, components: {
        '../components/theme/TitleFx.vue': Empty, '../components/MapTileLegend.vue': Empty,
    }, stubs: { '../ext/ui/creation': {
        ...creation,
        // Node's Vue transform is SSR. Only substitute the client-compiled SFC
        // loaders; keep real discovery, factories, selections and config merging.
        prepareModuleCreation(ids: readonly string[]) {
            const plan = creation.prepareModuleCreation(ids);
            return { ...plan, steps: plan.steps.map(step => {
                if (!steps[step.moduleId]) throw new Error(`Unmapped creation SFC: ${step.moduleId}`);
                return { ...step, component: undefined, load: async () => steps[step.moduleId]! };
            }) };
        },
        buildModuleCreationConfigurations(...args: Parameters<typeof creation.buildModuleCreationConfigurations>) {
            try {
                if (failure) { const error = failure; failure = undefined; throw error; }
                return creation.buildModuleCreationConfigurations(...args);
            } catch (error) { capturedError = error; throw error; }
        },
    } } }).load('../components/MainMenu.vue');
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); failure = undefined; capturedError = undefined; body.children = []; });
afterAll(() => vi.unstubAllGlobals());
const flush = async () => { await Vue.nextTick(); await Vue.nextTick(); await Vue.nextTick(); };
const find = (prop: string, value: string, where = body) => all(where).find(n => n.props[prop] === value)!;
async function click(n: N) {
    expect(n).toBeDefined(); expect(n.props.disabled).not.toBe(true);
    n.props.onClick?.({ detail: 1, preventDefault() {}, stopPropagation() {} }); await flush();
}
async function openCreation(ids: readonly string[], options: { preset?: string; raids?: boolean; classic?:boolean; members?: 1 | 2 | 4; exerciseStale?: boolean } = {}) {
    vi.useFakeTimers();
    const submitted = vi.fn(), root = node();
    const app = renderer.createApp(Menu, { inGame: false, hasSave: false, hasReplay: false, saveInfo: null, replayInfo: null, onNewGame: submitted });
    app.use(I18NextVue, { i18next }); app.mount(root);
    try {
        const button = (label: string) => all(root).find(n => n.tag === 'button' && text(n).includes(label))!;
        await click(button(i18next.t('menu.actions.new_game')));
        find('data-testid', 'rule-set', root).props['onUpdate:modelValue']('extended'); await flush();
        // Start from no modules, then select loot before growth to exercise its recommendation.
        for (const id of installed) { find('data-module', id, root).props.onChange({ target: { checked: false } }); await flush(); }
        for (const id of [...ids].sort((a, b) => Number(b === 'loot') - Number(a === 'loot'))) {
            const checkbox = find('data-module', id, root);
            if (!checkbox.props.checked) { checkbox.props.onChange({ target: { checked: true } }); await flush(); }
            if (id === 'loot') expect(find('data-module', 'growth', root).props.checked).toBe(true);
        }
        if (!ids.includes('growth')) { find('data-module', 'growth', root).props.onChange({ target: { checked: false } }); await flush(); }
        expect(installed.filter(id => find('data-module', id, root).props.checked)).toEqual([...ids].sort());
        const seed = all(root).find(n => n.tag === 'input' && n.props.type === 'text')!;
        seed.props['onUpdate:modelValue']('42'); await flush();
        if (options.raids) {
            const label = all(root).find(n => n.tag === 'label' && text(n).includes(i18next.t('ext.settlement.raid.option')))!;
            const control = all(label).find(n => n.tag === 'input')!;
            control.props['onUpdate:modelValue'](true); await flush();
        }
        if(options.classic){find('data-testid','rule-set',root).props['onUpdate:modelValue']('classic');await flush();}
        await click(button(i18next.t('title.begin')));
        if(ids.includes('party')){
            if (options.exerciseStale) {
                const retiredSubmit = all(body).find(n=>n.props['data-party-next']!==undefined)!.props.onClick;
                await click(all(body).find(n=>n.tag==='button'&&text(n)===i18next.t('ext.creation.cancel'))!);
                expect(submitted).not.toHaveBeenCalled();
                await click(button(i18next.t('title.begin')));
                retiredSubmit();
                await flush();
                expect(submitted).not.toHaveBeenCalled();
                expect(all(body).some(n=>n.props['data-party-count']!==undefined)).toBe(true);
            }
            const count = all(body).find(n=>n.props['data-party-count']!==undefined)!;
            count.props['onUpdate:modelValue'](options.members ?? 2); await flush();
            const next = all(body).find(n=>n.props['data-party-next']!==undefined)!;
            const staleSubmit = next.props.onClick;
            await click(next);
            if (options.exerciseStale) { staleSubmit(); await flush(); }
            vi.advanceTimersByTime(600);await flush();
        }
        if (ids.includes('growth')) for(let member=0;member<(ids.includes('party')?(options.members??2):1);member++){
            for (let i = 0; i < 3; i++) { await click(find('data-creation', 'next')); vi.advanceTimersByTime(600); await flush(); }
            const submit = find('data-creation', 'submit'), staleSubmit = submit.props.onClick;
            await click(submit);
            if (options.exerciseStale) { staleSubmit(); await flush(); }
            vi.advanceTimersByTime(600); await flush();
        }
        if (ids.includes('loot')) {
            if (options.preset) await click(find('data-preset', options.preset));
            await click(find('data-action', 'confirm'));
        }
        return { app, root, submitted };
    } catch (error) { app.unmount(); throw error; }
}

const selected = [
 ['none',[]],['E',modules],['P',['party']],['P+growth',['party','growth']],['P+loot',['party','loot']],['P+growth+loot',['party','growth','loot']],
 ['P+camp',['party','settlement','crafting','foraging']],['P+combat+giants',['party','combat','giants']],['P+narrative',['party','narrative']],['E+P',installed],['E-growth+P',installed.filter(id=>id!=='growth')],['E-loot+P',installed.filter(id=>id!=='loot')],
] as const;
describe('P1d selected UI creation combinations (12 extended plus classic)', () => {
    it.each(selected)('%s reaches a real new run with matching manifest and initial inputs', async (_name, ids: readonly string[]) => {
        const ui = await openCreation(ids);
        try {
            expect(ui.submitted, String(capturedError)).toHaveBeenCalledTimes(1);
            const payload = ui.submitted.mock.calls[0]![0];
            expect(payload.extensionConfigurations).toEqual({
                ...(ids.includes('party') ? {party:{schema:1,members:2}}:{}),
                ...(ids.includes('settlement') ? { settlement: { raids: false } } : {}),
                ...(ids.includes('loot') ? { loot: { presetId: 'standard' } } : {}),
            });
            assertStarted(payload, ids);
            expect(text(ui.root) + text(body)).not.toContain(i18next.t('ext.creation.unavailable'));
        } finally { ui.app.unmount(); }
    });
});

type CreationPayload = Parameters<Game['startNewGame']>[0] & { initialCommands: readonly string[] };
function assertStarted(payload: CreationPayload, ids: readonly string[]) {
    expect(payload.seed).toBe('42');
    expect(payload.mode).toBe('normal');
    expect(payload.ruleSet).toBe('extended');
    expect(payload.extensions).toEqual([...ids].sort());
    expect(() => structuredClone(payload.extensionConfigurations)).not.toThrow();
    const expectedManifest = createExtensionRegistry().manifest(ids, payload.extensionConfigurations);
    const owners = createExtensionRegistry().create(expectedManifest).filter(m => m.initialCommand).map(m => m.id);
    expect(payload.initialCommands.map(command => JSON.parse(command).module)).toEqual(owners);
    const g = new Game();
    try {
        // Same payload handoff as App.startNewGame; no generated fallback input.
        g.startNewGame(payload);
        expect(g.depth).toBe(1);
        expect(g.player.hp).toBeGreaterThan(0);
        expect(g.extensionRuntime!.manifest).toEqual(expectedManifest);
        expect(g.extensionRuntime!.readyToSave).toBe(true);
        expect(g.recordedInputEvents.filter(e => e.action === 'ext:command').map(e => e.data)).toEqual(payload.initialCommands);
        if (ids.includes('party')) {
            const initialCount = (payload.extensionConfigurations!.party as { members: number }).members;
            expect(g.party!.state.initialActorIds).toHaveLength(initialCount);
            expect(g.party!.state.members).toHaveLength(initialCount);
            expect(payload.initialCommands.map(c=>JSON.parse(c)).filter(c=>c.module==='party')).toHaveLength(1);
        }
        g.animationEnabled=false;
        for(const actor of g.controlledActors){while(logger.pendingAcknowledgment)logger.acknowledgeNext();if(g.party)g.submitPartyIntent({kind:'wait'},actor.id);else g.executeCommand('wait');}
        if(g.party){while(logger.pendingAcknowledgment)logger.acknowledgeNext();const planner=g.partyPlanner()!;planner.append(g.player.id,{kind:'wait'});planner.submit(planner.batch(timeSystem.currentTick,{kind:'ticks',ticks:100},null),b=>g.submitPartyWindow(b));expect(g.party.state.window.seq).toBe(1);}
        if(g.party){
          const ai=(change:unknown)=>{while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('party:ai',{kind:'party:ai',schema:1,issuerSlot:'local:0',expectedRevision:g.party!.state.revision,change});};
          for(const m of g.party.state.members)ai({kind:'controller',actorId:m.actorId,expectedEpoch:m.controlEpoch,controller:{kind:'ai',policyId:'party-ai-v1'}});
          ai({kind:'order',actorIds:g.party.state.members.map(m=>m.actorId),order:{kind:'gather',level:g.depth,x:g.player.x,y:g.player.y}});
          const planner=g.partyPlanner()!;while(logger.pendingAcknowledgment)logger.acknowledgeNext();planner.submit(planner.batch(timeSystem.currentTick,{kind:'ticks',ticks:100},null),b=>g.submitPartyWindow(b));
          expect(g.party.state.members.some(m=>m.ai.ordinal>0)).toBe(true);
          for(const m of g.party.state.members)ai({kind:'controller',actorId:m.actorId,expectedEpoch:m.controlEpoch,controller:{kind:'human',slot:'local:0'}});
        }
        const save=g.toSaveSnapshot(),recording = g.exportRecording();
        const h=new Game({seed:1});try{const errors:string[]=[];const loaded=h.loadSnapshot(JSON.parse(JSON.stringify(save)),e=>errors.push(e));expect(loaded,errors.join(';')).toBe(true);expect(h.loadReplay(recording)).toBe(true);while(h.replayCursor<recording.events.length&&!h.replayError)h.replayStep(true);expect(h.replayError).toBeNull();h.replaySeek(0);expect(h.replayError).toBeNull();h.replaySeek(recording.events.length);expect(h.replayError).toBeNull();const branch=JSON.parse(JSON.stringify(h.toSaveSnapshot()));expect(h.loadSnapshot(branch)).toBe(true);while(logger.pendingAcknowledgment)logger.acknowledgeNext();if(h.party)h.submitPartyIntent({kind:'wait'},h.readyPartyActorId!);else h.executeCommand('wait');expect(h.exportRecording().events.length).toBe(recording.events.length+1);}finally{h.disposeRecording();}
        expect(recording.extensions).toEqual(expectedManifest);
        if (ids.includes('growth')) {
            const input = payload.initialCommands.map(c => JSON.parse(c)).find(c => c.module === 'growth');
            expect(payload.initialCommands.map(c=>JSON.parse(c)).filter(c=>c.module==='growth')).toHaveLength(1);
            if (ids.includes('party')) expect(input.payload.members).toHaveLength(g.party!.state.initialActorIds.length);
            for(const selection of ids.includes('party')?input.payload.members.map((m:{creation:unknown})=>m.creation):[input.payload])expect(selection).toMatchObject({ professionId: 'growth.profession.guardian', lineageId: 'growth.lineage.human', faithId: 'growth.faith.unaffiliated' });
        }
        if (ids.includes('loot')) {
            const config = expectedManifest.modules.find(m => m.id === 'loot')!.configuration;
            const input = payload.initialCommands.map(c => JSON.parse(c)).find(c => c.module === 'loot');
            expect(input.payload.presetId).toBe((config as { presetId: string }).presetId);
        }
        if (process.env.PARTY_P1D_COMBINATION_CAPTURE && ids.includes('loot')) {
            const directory = process.env.PARTY_P1D_COMBINATION_CAPTURE;
            const name = installed.every(id => ids.includes(id)) ? 'combo-all' : 'combo-' + [...ids].sort().join('-');
            mkdirSync(directory, {recursive:true});
            writeFileSync(join(directory, name+'-save.json'), JSON.stringify(save)+'\n');
            writeFileSync(join(directory, name+'-recording.json'), JSON.stringify(recording)+'\n');
        }
        // All seed-origin lifecycle assertions above finish before staging any
        // diagnostic conversion. Reload also restores process-global RNG/IDs
        // after the independent replay Game used them.
        expect(g.loadSnapshot(structuredClone(save))).toBe(true);
        if (ids.includes('party')) assertDiagnosticConversionTail(g, save, ids);
        else assertPartyUnavailable(g);
    } finally { g.disposeRecording(); }
}

function acknowledge() { while (logger.pendingAcknowledgment) logger.acknowledgeNext(); }
function assertPartyUnavailable(g: Game) {
    expect(g.partyRosterCandidates()).toEqual([]);
    const events = structuredClone(g.recordedInputEvents), random = rng.getState(), keys = Object.keys(g);
    expect(() => g.executeCommand('party:roster', {
        kind: 'party:roster', schema: 1, expectedRevision: 0, issuerSlot: 'local:0',
        actorId: g.player.id, targetId: g.player.id, operation: 'join', campId: null,
        level: { kind: 'dungeon', depth: g.depth }
    })).toThrow('PARTY_DISABLED');
    expect(g.recordedInputEvents).toEqual(events);
    expect(rng.getState()).toEqual(random);
    expect(Object.keys(g)).toEqual(keys);
}
function readyDiagnosticActors(g: Game) {
    for (let step = 0; step < 100 && g.activeControlledActors.some(actor => actor.ticksUntilTurn > 0); step++) {
        acknowledge();
        expect(g.readyPartyActorId).not.toBeNull();
        g.submitPartyIntent({ kind: 'wait' }, g.readyPartyActorId!);
    }
    expect(g.activeControlledActors.every(actor => actor.ticksUntilTurn === 0)).toBe(true);
    acknowledge();
}
function rosterInput(g: Game, id: number, operation: 'join' | 'station' = 'join', campId: number | null = null) {
    return { kind: 'party:roster', schema: 1, expectedRevision: g.party!.state.revision,
        issuerSlot: 'local:0', actorId: g.player.id, targetId: id, operation, campId,
        level: { kind: 'dungeon', depth: g.depth } };
}
function diagnosticSnapshot(g: Game) {
    const snapshot = g.toSnapshot();
    delete snapshot.run.recordingOrigin;
    return snapshot;
}
function assertDiagnosticConversionTail(g: Game, seedSave: GameSnapshot, ids: readonly string[]) {
    // Explicit controlled scene: a clean planning boundary, a vacant floor patch,
    // delayed unrelated NPCs and one staged captive. No seed replay is claimed.
    const baseline = structuredClone(seedSave);
    delete baseline.run.recordingOrigin;
    baseline.party!.state.window = newPartyWindow(baseline.party!.state.members.map(row => row.actorId));
    expect(g.loadSnapshot(baseline)).toBe(true);
    g.animationEnabled = false;
    g.onConfirmRequest = () => true;
    const occupied = new Set([...g.monsters, ...g.dormantMonsters].flatMap(actor => footprintOf(actor).map(p => `${p.x},${p.y}`)));
    for (const entity of g.extensionRuntime!.worldWorkEntities()) if (entity.depth === g.depth) occupied.add(`${entity.x},${entity.y}`);
    let patch: {x:number;y:number} | undefined;
    for (let y = 2; y < g.grid.height - 6 && !patch; y++) for (let x = 2; x < g.grid.width - 9 && !patch; x++) {
        const cells = Array.from({length:40},(_,index)=>({x:x+index%8,y:y+Math.floor(index/8)}));
        if (cells.every(p => !occupied.has(`${p.x},${p.y}`) &&
            ![TerrainType.STAIRS_UP,TerrainType.STAIRS_DOWN].includes(g.grid.getCell(p.x,p.y)!.terrain))) patch={x,y};
    }
    expect(patch).toBeDefined();
    for(let y=patch!.y;y<patch!.y+5;y++)for(let x=patch!.x;x<patch!.x+8;x++)g.grid.setTerrain(x,y,TerrainType.FLOOR);
    g.player.loc={x:patch!.x+2,y:patch!.y+2};
    g.controlledActors.filter(actor=>actor!==g.player).forEach((actor,index)=>{actor.loc={x:patch!.x+3+index,y:patch!.y+3};});
    for (const monster of g.monsters) monster.ticksUntilTurn = 100000;
    g.refreshStructureDerivedState();
    readyDiagnosticActors(g);
    const captive = new Monster(g.player.x+1,g.player.y,monsterCatalog.find(row=>row.id==='goblin') as any);
    captive.hp=6;captive.isCaged=true;captive.state=MonsterState.WANDERING;captive.ticksUntilTurn=1000;
    const treasure=ItemLoader.spawnGold(7,captive.x,captive.y)!;captive.carriedItem=treasure;
    g.monsters.push(captive);g.extensionRuntime!.attachCreature(captive);g.refreshStructureDerivedState();
    const initialCount=g.party!.state.members.filter(row=>row.life!=='dead').length;
    expect(g.party!.state.rescued.some(row=>row.actorId===captive.id)).toBe(false);
    const rescuePrefix=g.recordedInputEvents.length;
    acknowledge();
    g.submitPartyIntent({kind:'move',dx:1,dy:0},g.player.id);
    while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
    // A diagnostic load has no trusted recording origin. Observe the actual
    // rescue/state transition, while its unrecordable prefix stays unchanged.
    expect(g.recordedInputEvents).toHaveLength(rescuePrefix);
    expect(captive.isCaged).toBe(false);expect(captive.isAlly).toBe(true);
    expect(g.party!.state.rescued).toContainEqual({actorId:captive.id,template:'goblin',key:`rescue:${captive.id}`});
    expect(captive.carriedItem).toBeNull();
    expect(g.items.filter(item=>item.id===treasure.id)).toEqual([treasure]);
    readyDiagnosticActors(g);
    const sourceBefore=structuredClone(candidateSource(g,captive.id)), snapshots: {kind:'native'|'member'|'stationed';value:GameSnapshot}[]=[];
    const before={hp:captive.hp,ticks:captive.ticksUntilTurn,random:rng.getState(),allocator:getNextEntityId(),events:g.recordedInputEvents.length};
    if(initialCount===4){
        expect(()=>g.executeCommand('party:roster',rosterInput(g,captive.id))).toThrow('NO_SPACE');
        expect(g.monsters.find(actor=>actor.id===captive.id)).toBe(captive);
        expect(g.party!.actors.has(captive.id)).toBe(false);
        expect(g.recordedInputEvents).toHaveLength(before.events);
        expect(candidateSource(g,captive.id)).toEqual(sourceBefore);
        snapshots.push({kind:'native',value:diagnosticSnapshot(g)});
    }else{
        g.executeCommand('party:roster',rosterInput(g,captive.id));
        const member=g.party!.actors.get(captive.id)!;
        expect(g.monsters.some(actor=>actor.id===captive.id)).toBe(false);
        expect(g.controlledActors.filter(actor=>actor.id===captive.id)).toEqual([member]);
        expect(member.hp).toBe(before.hp);expect(member.ticksUntilTurn).toBe(before.ticks);
        expect(member.inventory.items).toHaveLength(0);
        expect(g.items.filter(item=>item.id===treasure.id)).toEqual([treasure]);
        expect(g.party!.state.sources.find(row=>row.actorId===captive.id)).toEqual({actorId:captive.id,kind:'rescue',key:`rescue:${captive.id}`,template:'goblin'});
        expect(g.party!.state.transfers.filter(row=>row.actorId===captive.id).map(row=>row.kind)).toEqual(['join']);
        if(ids.includes('settlement'))expect(candidateSource(g,captive.id)?.source.consumed).toBe(true);
        expect(g.recordedInputEvents).toHaveLength(before.events);
        snapshots.push({kind:'member',value:diagnosticSnapshot(g)});
    }
    expect(rng.getState()).toEqual(before.random);expect(getNextEntityId()).toBe(before.allocator);

    if(ids.includes('settlement')&&initialCount<4){
        // Continue the SAME menu-created run. Geometry/material budgets are a
        // diagnostic setup; the camp, room, bed and door are paid public builds.
        campScene(g);
        for(const item of ['wood','stone','fiber'])addCampMaterial(g,'settlement.'+item,99);
        g.controlledActors.filter(actor=>actor!==g.player).forEach((actor,index)=>{actor.loc={x:27+index,y:18};});
        g.refreshStructureDerivedState();readyDiagnosticActors(g);
        const harness={ext(module:string,action:string,payload:unknown){
            acknowledge();g.onConfirmRequest=()=>true;
            const prefix=g.recordedInputEvents.length;
            g.executeCommand('ext:command',JSON.stringify({module,action,payload}));
            while(g.pendingCommandConfirmation)g.resolveCommandDecision(g.pendingCommandConfirmation.token,true);
            expect(g.recordedInputEvents).toHaveLength(prefix);
            const result={recorded:false,error:worldWorkLastError(g)};
            readyDiagnosticActors(g);
            return result;
        }} as WorldHarness;
        bedroom(harness,g);
        const member=g.party!.actors.get(captive.id)!;
        member.loc={x:20,y:13};g.player.loc={x:19,y:13};g.refreshStructureDerivedState();readyDiagnosticActors(g);
        const inventory=member.inventory.items,hp=member.hp,nutrition=member.nutrition,source=structuredClone(g.party!.state.sources.find(row=>row.actorId===member.id)!);
        g.executeCommand('party:roster',rosterInput(g,member.id,'station',currentCamp(g).regionId));
        expect(g.party!.stationed.get(member.id)).toBe(member);expect(g.party!.actors.has(member.id)).toBe(false);
        expect(g.world5!.residents.filter(row=>row.actorId===member.id)).toHaveLength(1);
        expect(member.inventory.items).toBe(inventory);expect(member.hp).toBe(hp);
        expect(candidateSource(g,member.id)?.source.consumed).toBe(true);
        snapshots.push({kind:'stationed',value:diagnosticSnapshot(g)});
        g.executeCommand('party:roster',rosterInput(g,member.id));
        expect(g.party!.actors.get(member.id)).toBe(member);expect(g.party!.stationed.has(member.id)).toBe(false);
        expect(g.world5!.residents.some(row=>row.actorId===member.id)).toBe(false);
        expect(member.inventory.items).toBe(inventory);expect(member.hp).toBe(hp);
        expect(g.party!.state.sources.find(row=>row.actorId===member.id)).toEqual(source);
        expect(member.nutrition).toBeLessThanOrEqual(nutrition);
        expect(peekEdibleState(g.extensionRuntime!).actorNeeds?.rows.some(row=>row.actorId===member.id)??false).toBe(false);
        expect(g.party!.state.transfers.filter(row=>row.actorId===member.id).map(row=>row.kind)).toEqual(['join','station','join']);
        snapshots.push({kind:'member',value:diagnosticSnapshot(g)});
    }
    // Capture every diagnostic checkpoint before another Game changes global IDs.
    const loaded=new Game({seed:1});
    try{for(const snapshot of snapshots){
        expect(snapshot.value.run.recordingOrigin).toBeUndefined();
        expect(loaded.loadSnapshot(structuredClone(snapshot.value))).toBe(true);
        expect(loaded.hasCompleteRecording).toBe(false);
        expect(loaded.party!.state).toEqual(snapshot.value.party!.state);
        const roots=[...loaded.controlledActors,...loaded.party!.stationed.values(),...loaded.monsters].filter(actor=>actor.id===captive.id);
        expect(roots).toHaveLength(1);
        expect(loaded.party!.actors.has(captive.id)).toBe(snapshot.kind==='member');
        expect(loaded.party!.stationed.has(captive.id)).toBe(snapshot.kind==='stationed');
        const saved=snapshot.kind==='native'?snapshot.value.monsters.find(actor=>actor.id===captive.id):
            [...snapshot.value.party!.actors,...snapshot.value.party!.stationed].find(actor=>actor.id===captive.id);
        expect(roots[0]!.hp).toBe(saved!.hp);
    }}finally{loaded.disposeRecording();}
}

it.each([1, 2, 4] as const)('MainMenu creates %i growth identities once after cancel/retry, stale callbacks and double submit', async members => {
    const ui = await openCreation(['party', 'growth'], { members, exerciseStale: true });
    try {
        expect(ui.submitted, String(capturedError)).toHaveBeenCalledTimes(1);
        const payload = ui.submitted.mock.calls[0]![0];
        expect(payload.extensionConfigurations.party).toEqual({ schema: 1, members });
        assertStarted(payload, ['party', 'growth']);
    } finally { ui.app.unmount(); }
});

it('all modules preserve edited raids and a non-default loot preset through actual startup', async () => {
    const ui = await openCreation(modules, { raids: true, preset: 'scarce' });
    try {
        expect(ui.submitted).toHaveBeenCalledTimes(1);
        const payload = ui.submitted.mock.calls[0]![0];
        expect(payload.extensionConfigurations).toEqual({ settlement: { raids: true }, loot: { presetId: 'scarce' } });
        assertStarted(payload, modules);
    } finally { ui.app.unmount(); }
});

it.each([['loot'], ['settlement']])('logs the original submission error and allows retry for %s', async id => {
    const error = new Error('creation configuration diagnostic sentinel');
    failure = error;
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ids = [id];
    const ui = await openCreation(ids, { preset: id === 'loot' ? 'scarce' : undefined });
    try {
        expect(ui.submitted).not.toHaveBeenCalled();
        expect(text(ui.root) + text(body)).toContain(i18next.t('ext.creation.unavailable'));
        expect(diagnostic).toHaveBeenCalledExactlyOnceWith('[MainMenu] Module creation submission failed', {
            extensions: ids, step: id === 'loot' ? 'loot' : null,
        }, error);
        await click(id === 'loot' ? find('data-action', 'confirm') : all(ui.root).find(n => n.tag === 'button' && text(n).includes(i18next.t('title.begin')))!);
        expect(ui.submitted).toHaveBeenCalledTimes(1);
        const payload = ui.submitted.mock.calls[0]![0];
        if (id === 'loot') expect(payload.extensionConfigurations.loot).toEqual({ presetId: 'scarce' });
        assertStarted(payload, ids);
    } finally { ui.app.unmount(); }
});

it('classic uses the real menu payload and keeps the phase6 codec',async()=>{
 const ui=await openCreation([],{classic:true});const g=new Game({seed:1}),h=new Game({seed:1});
 try{expect(ui.submitted).toHaveBeenCalledTimes(1);g.startNewGame(ui.submitted.mock.calls[0]![0]);g.animationEnabled=false;expect(g.party).toBeUndefined();while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('wait');const save=g.toSaveSnapshot(),record=g.exportRecording();expect(save.version).toBe(7);expect(record.version).toBe(4);expect(h.loadSnapshot(JSON.parse(JSON.stringify(save)))).toBe(true);expect(h.loadReplay(record)).toBe(true);while(h.replayCursor<record.events.length&&!h.replayError)h.replayStep(true);expect(h.replayError).toBeNull();h.replaySeek(record.events.length);expect(h.replayError).toBeNull();const branch=JSON.parse(JSON.stringify(h.toSaveSnapshot()));expect(h.loadSnapshot(branch)).toBe(true);while(logger.pendingAcknowledgment)logger.acknowledgeNext();h.executeCommand('wait');expect(h.exportRecording().events.length).toBe(record.events.length+1);assertPartyUnavailable(h);}finally{ui.app.unmount();g.disposeRecording();h.disposeRecording();}
});
