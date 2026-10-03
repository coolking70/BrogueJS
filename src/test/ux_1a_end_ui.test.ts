import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Vue from 'vue';
import { createRenderer, h, nextTick, type Component } from 'vue';
import { readFileSync } from 'node:fs';
import { parse, compileScript } from '@vue/compiler-sfc';
import { transformWithEsbuild } from 'vite';
import * as highScores from '../engine/Core/HighScores';
import * as acknowledgments from '../ui/messageAcknowledgment';
import { logger } from '../engine/Systems/Logger';
import { rng } from '../engine/Random';

const { game } = vi.hoisted(() => ({ game: {
    isGameOver: false, gameOverWon: false, gameOverReason: '', gameOverScore: 0,
    gameOverInventory: [], stats: { kills: 0, gold: 0, turns: 1, maxDepth: 4 }, replayRecording: null, isAdvancing: false,
} }));


// Vue's actual component lifecycle/render functions, with a tiny host renderer.
// CSS geometry and native hit testing are covered by scripts/ux-1-ui-check.mjs.
interface Node { type: string; children: Node[]; parent: Node | null; props: Record<string, any>; text: string }
const node = (type: string, text = ''): Node => ({ type, text, children: [], parent: null, props: {} });
const renderer = createRenderer<Node, Node>({
    createElement: tag => node(tag), createText: text => node('#text', text), createComment: text => node('#comment', text),
    insert(child, parent, anchor) {
        if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1);
        const index = anchor ? parent.children.indexOf(anchor) : -1;
        parent.children.splice(index < 0 ? parent.children.length : index, 0, child); child.parent = parent;
    },
    remove(child) { child.parent?.children.splice(child.parent.children.indexOf(child), 1); child.parent = null; },
    setText: (n, text) => { n.text = text; }, setElementText: (n, text) => { n.text = text; n.children = []; },
    parentNode: n => n.parent, nextSibling: n => n.parent?.children[n.parent.children.indexOf(n) + 1] ?? null,
    patchProp: (n, key, _old, value) => { n.props[key] = value; },
});
let End: Component;
let Ack: Component;
let app: ReturnType<typeof renderer.createApp> | undefined;
let root: Node;
let captureKeydown: (event: KeyboardEvent) => void;
const all = (root: Node): Node[] => [root, ...root.children.flatMap(all)];
const byClass = (name: string) => all(root).find(n => n.props.class?.split(' ').includes(name));
const settle = async () => { vi.advanceTimersByTime(250); await nextTick(); };
function mount(props: Record<string, unknown> = {}) {
    root = node('root');
    app = renderer.createApp({ render: () => h('main', [h(End, props), h(Ack)]) });
    app.config.globalProperties.$t = ((key: string) => key) as typeof app.config.globalProperties.$t;
    app.mount(root);
}
beforeAll(async () => {
    const target = new EventTarget();
    vi.stubGlobal('window', { addEventListener: (type: string, handler: EventListener, capture?: boolean) => {
        if (type === 'keydown' && capture) captureKeydown = handler as (event: KeyboardEvent) => void;
        target.addEventListener(type, handler, capture);
    }, removeEventListener: target.removeEventListener.bind(target),
        setInterval: (...args: Parameters<typeof setInterval>) => setInterval(...args), clearInterval: (id: ReturnType<typeof setInterval>) => clearInterval(id) });
    const input = await import('../engine/Input');
    // Vitest compiles SFCs for SSR. Compile the same script/template for the
    // client here, so the host renderer exercises the browser render function.
    const modules: Record<string, unknown> = { vue: Vue, '../engine/Core/Game': { activeGame: game },
        '../engine/Core/HighScores': highScores, '../engine/Systems/Logger': { logger },
        '../engine/Input': input, '../ui/messageAcknowledgment': acknowledgments };
    const load = async (name: string): Promise<Component> => {
        const filename = new URL('../components/' + name + '.vue', import.meta.url);
        const { descriptor } = parse(readFileSync(filename, 'utf8'));
        const script = compileScript(descriptor, { id: name, inlineTemplate: true });
        const { code } = await transformWithEsbuild(script.content, name + '.ts', { loader: 'ts', format: 'cjs' });
        const module = { exports: {} as { default: Component } };
        new Function('require', 'module', 'exports', code)((id: string) => {
            if (!(id in modules)) throw new Error('Unexpected UI dependency: ' + id);
            return modules[id];
        }, module, module.exports);
        return module.exports.default;
    };
    End = await load('GameEndOverlay');
    Ack = await load('MessageAcknowledgment');
});
beforeEach(() => { vi.useFakeTimers(); logger.reset(); game.isGameOver = false; game.isAdvancing = false; });
afterEach(() => { app?.unmount(); app = undefined; vi.useRealTimers(); logger.presentAcknowledgments(null); });
afterAll(() => vi.unstubAllGlobals());

describe('UX-1A acknowledgment before terminal controls', () => {
    it('offers explicit results, retains unread occurrences and archive, and clears the old queue on return', async () => {
        const returned = vi.fn(), save = vi.fn(), exported = vi.fn();
        mount({ canSaveReplay: true, onReturnToTitle: returned, onSaveReplay: save, onExportReplayJson: exported });
        logger.log('first warning', '#fff', { acknowledge: true });
        logger.log('second warning', '#fff', { acknowledge: true });
        logger.log('second warning', '#fff', { acknowledge: true });
        game.isGameOver = true; game.isAdvancing = true; await settle();
        const archive = JSON.parse(JSON.stringify(logger.messages));
        const random = rng.getState();
        expect(byClass('view-result-btn')).toBeDefined();
        byClass('view-result-btn')!.props.onClick({ stopPropagation() {} }); await settle();
        expect(byClass('game-end-overlay')).toBeDefined();
        expect(byClass('message-ack-backdrop')).toBeUndefined();
        expect(logger.pendingAcknowledgment).toBeUndefined();
        expect(logger.messages).toEqual(archive);
        expect(rng.getState()).toEqual(random);
        const unread = byClass('unread-messages')!;
        expect(all(unread).filter(n => n.type === 'li').map(n => n.text)).toEqual(['first warning', 'second warning', 'second warning']);
        logger.log('late terminal warning', '#fff', { acknowledge: true }); await settle();
        expect(byClass('message-ack-backdrop')).toBeUndefined();
        expect(all(byClass('unread-messages')!).filter(n => n.type === 'li').slice(-1)[0]?.text).toBe('late terminal warning');
        for (const name of ['save-replay-btn', 'export-replay-btn', 'return-btn']) expect(byClass(name)?.props.disabled).toBe(false);
        byClass('save-replay-btn')?.props.onClick(); byClass('export-replay-btn')?.props.onClick();
        expect(save).toHaveBeenCalledOnce(); expect(exported).toHaveBeenCalledOnce();
        byClass('return-btn')?.props.onClick(); expect(returned).toHaveBeenCalledOnce();
        expect(logger.pendingAcknowledgment).toBeUndefined();
        expect(logger.messages.map(m => m.text)).toEqual(['first warning', 'second warning', 'late terminal warning']);
        game.isGameOver = false; logger.reset(); await settle();
        logger.log('next run', '#fff', { acknowledge: true }); await settle();
        expect(logger.pendingAcknowledgment?.text).toBe('next run');
        expect(byClass('view-result-btn')).toBeUndefined();
        expect(byClass('unread-messages')).toBeUndefined();
    });

    it('keyboard can select results without consuming the pending warning as MORE', async () => {
        mount(); logger.log('unread', '#fff', { acknowledge: true });
        game.isGameOver = true; await settle();
        const event = new Event('keydown', { cancelable: true });
        Object.assign(event, { key: 'r', code: 'KeyR', repeat: false });
        // Node EventTarget does not order capture before bubble like the DOM.
        captureKeydown(event as KeyboardEvent);
        await settle();
        expect(byClass('game-end-overlay')).toBeDefined();
        expect(all(byClass('unread-messages')!).filter(n => n.type === 'li').map(n => n.text)).toEqual(['unread']);
        expect(logger.messages[0]?.count).toBe(1);
    });

    it('Tab preserves the warning and focused results respond to Enter or Space once', async () => {
        for (const key of ['Enter', ' ']) {
            mount(); logger.log('unread', '#fff', { acknowledge: true });
            game.isGameOver = true; await settle();
            const tab = { key: 'Tab', code: 'Tab', repeat: false, preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
            captureKeydown(tab as unknown as KeyboardEvent);
            expect(tab.preventDefault).not.toHaveBeenCalled();
            expect(logger.pendingAcknowledgment?.text).toBe('unread');
            const enter = { key, code: key === 'Enter' ? 'Enter' : 'Space', repeat: false,
                target: { closest: (selector: string) => selector === '[data-dialog-action="view-result"]' ? {} : null },
                preventDefault: vi.fn(), stopImmediatePropagation: vi.fn() };
            captureKeydown(enter as unknown as KeyboardEvent);
            captureKeydown({ ...enter, repeat: true } as unknown as KeyboardEvent);
            await settle();
            expect(byClass('game-end-overlay')).toBeDefined();
            expect(all(byClass('unread-messages')!).filter(n => n.type === 'li').map(n => n.text)).toEqual(['unread']);
            app!.unmount(); app = undefined; logger.reset(); game.isGameOver = false;
        }
    });

    it('preserves every pending warning and presents the result only after the last acknowledgment', async () => {
        mount();
        logger.log('paralysis', '#fff', { acknowledge: true }); logger.log('fatal warning', '#fff', { acknowledge: true });
        game.isGameOver = true;
        await settle();
        expect(byClass('game-end-overlay')).toBeUndefined(); expect(byClass('message-ack-backdrop')).toBeDefined();
        expect(logger.pendingAcknowledgment?.text).toBe('paralysis');
        logger.acknowledgeNext(); await settle();
        expect(byClass('game-end-overlay')).toBeUndefined(); expect(logger.pendingAcknowledgment?.text).toBe('fatal warning');
        logger.acknowledgeNext(); await settle();
        expect(byClass('game-end-overlay')).toBeDefined(); expect(byClass('message-ack-backdrop')).toBeUndefined();
        expect(logger.messages).toHaveLength(2);
    });

    it('defaults unavailable replay actions to disabled and keeps return available', async () => {
        const returned = vi.fn(); mount({ onReturnToTitle: returned }); game.isGameOver = true; await settle();
        expect(byClass('save-replay-btn')?.props.disabled).toBe(true);
        expect(byClass('export-replay-btn')?.props.disabled).toBe(true);
        expect(byClass('return-btn')?.props.disabled).toBe(false);
        byClass('return-btn')?.props.onClick(); expect(returned).toHaveBeenCalledOnce();
        expect(game.isGameOver).toBe(true); // Presentation cannot mutate the terminal checkpoint.
    });

    it('forwards save/export and makes all terminal actions wait for a pending final checkpoint', async () => {
        const save = vi.fn(), exported = vi.fn();
        mount({ canSaveReplay: true, onSaveReplay: save, onExportReplayJson: exported }); game.isGameOver = true; await settle();
        byClass('save-replay-btn')?.props.onClick(); byClass('export-replay-btn')?.props.onClick();
        expect(save).toHaveBeenCalledOnce(); expect(exported).toHaveBeenCalledOnce();
        app!.unmount();
        mount({ canSaveReplay: true, replayBusy: true, replayFeedback: 'waiting fixture' }); await settle();
        for (const name of ['save-replay-btn', 'export-replay-btn', 'return-btn']) expect(byClass(name)?.props.disabled).toBe(true);
        expect(byClass('replay-feedback')?.text).toBe('waiting fixture');
    });
});
