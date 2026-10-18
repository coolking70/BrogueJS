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
async function openCreation(ids: readonly string[], options: { preset?: string; raids?: boolean; classic?:boolean } = {}) {
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
        if(ids.includes('party')){await click(all(body).find(n=>n.props['data-party-next']!==undefined)!);vi.advanceTimersByTime(600);await flush();}
        if (ids.includes('growth')) for(let member=0;member<(ids.includes('party')?2:1);member++){
            for (let i = 0; i < 3; i++) { await click(find('data-creation', 'next')); vi.advanceTimersByTime(600); await flush(); }
            await click(find('data-creation', 'submit')); vi.advanceTimersByTime(600); await flush();
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
 ['P+camp',['party','settlement','crafting','foraging']],['P+combat+giants',['party','combat','giants']],['E+P',installed],['E-growth+P',installed.filter(id=>id!=='growth')],['E-loot+P',installed.filter(id=>id!=='loot')],
] as const;
describe('P1a selected UI creation combinations', () => {
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
        g.animationEnabled=false;
        for(const actor of g.controlledActors){while(logger.pendingAcknowledgment)logger.acknowledgeNext();if(g.party)g.submitPartyIntent({kind:'wait'},actor.id);else g.executeCommand('wait');}
        if(g.party){while(logger.pendingAcknowledgment)logger.acknowledgeNext();const planner=g.partyPlanner()!;planner.append(g.player.id,{kind:'wait'});planner.submit(planner.batch(timeSystem.currentTick,{kind:'ticks',ticks:100},null),b=>g.submitPartyWindow(b));expect(g.party.state.window.seq).toBe(1);}
        const save=g.toSaveSnapshot(),recording = g.exportRecording();
        const h=new Game({seed:1});try{const errors:string[]=[];const loaded=h.loadSnapshot(JSON.parse(JSON.stringify(save)),e=>errors.push(e));expect(loaded,errors.join(';')).toBe(true);expect(h.loadReplay(recording)).toBe(true);while(h.replayCursor<recording.events.length&&!h.replayError)h.replayStep(true);expect(h.replayError).toBeNull();h.replaySeek(recording.events.length);expect(h.replayError).toBeNull();const branch=JSON.parse(JSON.stringify(h.toSaveSnapshot()));expect(h.loadSnapshot(branch)).toBe(true);while(logger.pendingAcknowledgment)logger.acknowledgeNext();if(h.party)h.submitPartyIntent({kind:'wait'},h.readyPartyActorId!);else h.executeCommand('wait');expect(h.exportRecording().events.length).toBe(recording.events.length+1);}finally{h.disposeRecording();}
        expect(recording.extensions).toEqual(expectedManifest);
        if (ids.includes('growth')) {
            const input = payload.initialCommands.map(c => JSON.parse(c)).find(c => c.module === 'growth');
            for(const selection of ids.includes('party')?input.payload.members.map((m:{creation:unknown})=>m.creation):[input.payload])expect(selection).toMatchObject({ professionId: 'growth.profession.guardian', lineageId: 'growth.lineage.human', faithId: 'growth.faith.unaffiliated' });
        }
        if (ids.includes('loot')) {
            const config = expectedManifest.modules.find(m => m.id === 'loot')!.configuration;
            const input = payload.initialCommands.map(c => JSON.parse(c)).find(c => c.module === 'loot');
            expect(input.payload.presetId).toBe((config as { presetId: string }).presetId);
        }
    } finally { g.disposeRecording(); }
}

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
 try{expect(ui.submitted).toHaveBeenCalledTimes(1);g.startNewGame(ui.submitted.mock.calls[0]![0]);g.animationEnabled=false;expect(g.party).toBeUndefined();while(logger.pendingAcknowledgment)logger.acknowledgeNext();g.executeCommand('wait');const save=g.toSaveSnapshot(),record=g.exportRecording();expect(save.version).toBe(7);expect(record.version).toBe(4);expect(h.loadSnapshot(JSON.parse(JSON.stringify(save)))).toBe(true);expect(h.loadReplay(record)).toBe(true);while(h.replayCursor<record.events.length&&!h.replayError)h.replayStep(true);expect(h.replayError).toBeNull();h.replaySeek(record.events.length);expect(h.replayError).toBeNull();const branch=JSON.parse(JSON.stringify(h.toSaveSnapshot()));expect(h.loadSnapshot(branch)).toBe(true);while(logger.pendingAcknowledgment)logger.acknowledgeNext();h.executeCommand('wait');expect(h.exportRecording().events.length).toBe(record.events.length+1);}finally{ui.app.unmount();g.disposeRecording();h.disposeRecording();}
});
