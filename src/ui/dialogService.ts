import type { InjectionKey } from 'vue';

export type DialogAction = 'yes' | 'no' | 'more' | 'view-result';
export interface DialogToken { readonly id: number; readonly epoch: number }
export interface DialogSpec {
    kind: 'confirm' | 'acknowledgment';
    owner: string;
    text: string;
    danger?: boolean;
    defaultAction?: 'yes' | 'no';
    terminalAvailable?: boolean;
    onAnswer: (action: DialogAction) => boolean | void;
}
export interface DialogEntry extends Readonly<Omit<DialogSpec, 'onAnswer'>> { readonly token: DialogToken }
export type DialogResult = { status: 'answered'; action: DialogAction } | { status: 'cancelled' };
export interface DialogRequest {
    readonly token: DialogToken;
    readonly result: Promise<DialogResult>;
    cancel(): void;
}

/** One mounted session owns the queue and its capabilities. IDs alone cannot
 * answer a request. Cancellation never manufactures a negative engine answer. */
export class DialogService {
    private epoch = 0;
    private nextId = 1;
    private queue: Array<{ entry: DialogEntry; onAnswer: DialogSpec['onAnswer']; settle: (result: DialogResult) => void }> = [];
    private listeners = new Set<() => void>();
    private sources: Array<{ sync: () => void; priority: number }> = [];
    private syncing = false;
    private answering = false;
    private disposed = false;

    get current(): DialogEntry | undefined { return this.queue[0]?.entry; }
    get queueLength(): number { return this.queue.length; }
    isPending(token: DialogToken): boolean { return this.queue.some(item => item.entry.token === token); }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }
    registerSource(sync: () => void, priority = 0): () => void {
        const source = { sync, priority };
        this.sources.push(source);
        this.sources.sort((a, b) => b.priority - a.priority);
        return () => { this.sources = this.sources.filter(item => item !== source); };
    }
    sync(): void {
        if (this.syncing || this.answering || this.disposed) return;
        this.syncing = true;
        try { for (const source of [...this.sources]) source.sync(); }
        finally { this.syncing = false; }
    }
    request(spec: DialogSpec): DialogRequest {
        const token = Object.freeze({ id: this.nextId++, epoch: this.epoch });
        let settle!: (result: DialogResult) => void;
        const result = new Promise<DialogResult>(resolve => { settle = resolve; });
        if (this.disposed) settle({ status: 'cancelled' });
        else {
            const { onAnswer, ...presentation } = spec;
            this.queue.push({ entry: Object.freeze({ ...presentation, token }), onAnswer, settle });
            this.notify();
        }
        return { token, result, cancel: () => this.cancel(token) };
    }
    update(token: DialogToken, patch: Pick<DialogSpec, 'terminalAvailable'>): void {
        const pending = this.queue.find(item => item.entry.token === token);
        if (!pending || pending.entry.terminalAvailable === patch.terminalAvailable) return;
        pending.entry = Object.freeze({ ...pending.entry, ...patch });
        this.notify();
    }
    answer(token: DialogToken, action: DialogAction): boolean {
        const pending = this.queue[0];
        if (this.disposed || this.answering || !pending || pending.entry.token !== token
            || token.epoch !== this.epoch) return false;
        const entry = pending.entry;
        if (!(entry.kind === 'confirm' ? action === 'yes' || action === 'no'
            : action === 'more' || (action === 'view-result' && entry.terminalAvailable))) return false;
        this.answering = true;
        let accepted: boolean | void;
        try { accepted = pending.onAnswer(action); }
        finally { this.answering = false; }
        if (accepted === false) return false;
        // Lifecycle changes inside a callback cannot settle a newer request.
        if (this.queue[0] !== pending) return false;
        this.queue.shift();
        pending.settle({ status: 'answered', action });
        this.notify();
        this.sync();
        return true;
    }
    cancel(token: DialogToken): void {
        const index = this.queue.findIndex(item => item.entry.token === token);
        if (index < 0) return;
        this.queue.splice(index, 1)[0]!.settle({ status: 'cancelled' });
        this.notify();
    }
    reset(): void {
        this.epoch++;
        const previous = this.queue.splice(0);
        for (const pending of previous) pending.settle({ status: 'cancelled' });
        this.notify();
    }
    dispose(): void {
        this.disposed = true;
        this.reset();
        this.sources = [];
        this.listeners.clear();
    }
    private notify(): void { for (const listener of [...this.listeners]) listener(); }
}

export const dialogServiceKey: InjectionKey<DialogService> = Symbol('dialog-session');
