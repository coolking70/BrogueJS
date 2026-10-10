/** CE IO.c:3451-3515 message archive and presentation-only acknowledgement. */
export interface LogMessage {
    id: number;
    text: string;
    color: string;
    count: number;
    turn: number;
    acknowledge?: boolean;
    foldable?: boolean;
}
interface MessageEvidence { turn: number; color: string; acknowledge: boolean; foldable: boolean }

export interface MessageOptions {
    acknowledge?: boolean;
    /** Rejected inputs and file diagnostics are UI feedback, outside the archive. */
    presentationOnly?: boolean;
    /** CE FOLDABLE: combat text; only same-turn duplicates collapse. */
    foldable?: boolean;
}

// CE Rogue.h:120-128: ROWS * 10 * 4, not the number of visible lines.
export const MESSAGE_ARCHIVE_ENTRIES = 34 * 10 * 4;
export const MAX_MESSAGE_REPEATS = 100;
const disturbanceCallbacks = new WeakMap<Logger, () => void>();
// UI wiring and pending clicks must never enter snapshots or recording hashes.
const presentations = new WeakMap<Logger, {
    enabled: () => boolean; pending: LogMessage[]; unread: LogMessage[]; terminalShown: boolean;
    changed?: () => void;
}>();
// UI notifications cannot alter the result of an engine command.
function notifyPresentation(log: Logger): void {
    try { presentations.get(log)?.changed?.(); } catch { /* presentation is optional */ }
}
const combatBuffers = new WeakMap<Logger, { text: string; color: string }[]>();
const heardCombat = new WeakSet<Logger>();
const feedback = new WeakMap<Logger, LogMessage>();
type MessageObserver = (message: Readonly<LogMessage>, acknowledge: boolean, occurrence?: Readonly<LogMessage>) => void;
const messageObservers = new WeakMap<Logger, MessageObserver>();
const messageCheckpoints = new WeakMap<Logger, () => () => void>();

/** Restore the original array and mutable rows, including folded repeats. */
function checkpointRows<T extends object>(rows: T[]): () => void {
    const descriptors = new Map(Reflect.ownKeys(rows).map(key =>
        [key, Object.getOwnPropertyDescriptor(rows, key)!] as const));
    const entries = rows.map(row => [row, Object.getOwnPropertyDescriptors(row)] as const);
    return () => {
        for (const [row, saved] of entries) {
            for (const key of Reflect.ownKeys(row)) {
                if (!Object.prototype.hasOwnProperty.call(saved, key)) Reflect.deleteProperty(row, key);
            }
            Object.defineProperties(row, saved);
        }
        for (const key of Reflect.ownKeys(rows)) {
            if (!descriptors.has(key)) Reflect.deleteProperty(rows, key);
        }
        for (const [key, descriptor] of descriptors) Object.defineProperty(rows, key, descriptor);
    };
}

/** CE FOLDABLE presentation: preserve the individual archive entries/repeats. */
export function foldCombatMessages(messages: readonly LogMessage[], width = 100): LogMessage[] {
    const lines: LogMessage[] = [];
    for (const message of messages) {
        const last = lines[lines.length - 1];
        if (last?.foldable && message.foldable && last.turn === message.turn
            && last.count === 1 && message.count === 1 && last.color === message.color
            && !last.acknowledge && !message.acknowledge
            && last.text.length + message.text.length + 2 <= width) {
            last.text = last.text.replace(/[.。]$/, '') + '; ' + message.text;
        } else lines.push({ ...message });
    }
    return lines;
}

export class Logger {
    /** After archiving, before the caller's next effect. Never flushes combat. */
    public observeMessages(observer: MessageObserver | null, checkpoint?: () => () => void): void {
        if (observer) messageObservers.set(this, observer);
        else messageObservers.delete(this);
        if (observer && checkpoint) messageCheckpoints.set(this, checkpoint);
        else messageCheckpoints.delete(this);
    }
    public messages: LogMessage[] = [];
    public get displayMessages(): readonly LogMessage[] {
        const notice = feedback.get(this);
        return notice ? [...this.messages, notice] : this.messages;
    }
    public turn = 0;
    private nextId = 0;
    /** Emission evidence is independent of translated text and display folding. */
    private mechanicalMessages: MessageEvidence[] = [];
    private mechanicalNextId = 0;
    public get onDisturb(): (() => void) | null { return disturbanceCallbacks.get(this) ?? null; }
    public set onDisturb(callback: (() => void) | null) {
        if (callback) disturbanceCallbacks.set(this, callback);
        else disturbanceCallbacks.delete(this);
    }
    public blockCombatText = false;
    public disturb(): void { this.onDisturb?.(); }

    /** Mounted UI opts in; headless and replay never wait for a human. */
    public presentAcknowledgments(enabled: (() => boolean) | null, changed?: () => void): void {
        if (enabled) presentations.set(this, { enabled, pending: [], unread: [], terminalShown: false, changed });
        else presentations.delete(this);
    }
    public get pendingAcknowledgment(): LogMessage | undefined {
        const display = presentations.get(this);
        // Replay reads retire stale live ACKs once. Empty reads must not refresh reactive UI.
        if (display && !display.enabled()
            && (display.pending.length || display.unread.length || display.terminalShown))
            this.clearAcknowledgments();
        return display?.pending[0];
    }
    public get pendingAcknowledgments(): readonly Readonly<LogMessage>[] {
        this.pendingAcknowledgment; // Preserve the existing replay bypass.
        return presentations.get(this)?.pending.slice() ?? [];
    }
    /** Presentation copies in occurrence order, including folded duplicates. */
    public get unreadAcknowledgments(): LogMessage[] {
        return presentations.get(this)?.unread.map(message => ({ ...message })) ?? [];
    }
    public showTerminalAcknowledgments(): void {
        const display = presentations.get(this);
        if (!display) return;
        display.terminalShown = true;
        display.unread.push(...display.pending);
        display.pending = [];
        notifyPresentation(this);
    }
    public acknowledgeNext(): void { presentations.get(this)?.pending.shift(); notifyPresentation(this); }
    public clearAcknowledgments(): void {
        const display = presentations.get(this);
        if (display) {
            display.pending = []; display.unread = []; display.terminalShown = false;
            notifyPresentation(this);
        }
    }

    public combat(text: string, color = '#ffffff', lethal = false): void {
        if (!text || (this.blockCombatText && !lethal)) return;
        const buffer = combatBuffers.get(this) ?? [];
        // CE COLS * 2 buffer; flush before an overflow, retaining message order.
        if (buffer.reduce((n, m) => n + m.text.length + 1, 0) + text.length > 198) this.flushCombat();
        const pending = combatBuffers.get(this) ?? [];
        pending.push({ text, color });
        combatBuffers.set(this, pending);
    }
    public hearCombat(text: string, lethal = false): void {
        if (!lethal && (this.blockCombatText || heardCombat.has(this))) return;
        if (!lethal) heardCombat.add(this);
        this.combat(text, '#ffffff', lethal);
    }
    public flushCombat(): void {
        const pending = combatBuffers.get(this) ?? [];
        combatBuffers.delete(this); // log() flushes too; clear before recursion.
        for (const message of pending) this.log(message.text, message.color, { foldable: true });
    }
    public endCombatTurn(): void {
        this.flushCombat();
        heardCombat.delete(this);
    }
    /** Extension generation needs an in-memory rollback, including presentation
     * and pending combat. Unlike getState(), observing this checkpoint must not
     * flush messages, disturb the player or consume acknowledgments. */
    public checkpoint(): () => void {
        const notice = feedback.get(this);
        const messages = this.messages, restoreMessages = checkpointRows(messages);
        const nextId = this.nextId, turn = this.turn, blockCombatText = this.blockCombatText;
        const mechanicalMessages = this.mechanicalMessages, restoreMechanical = checkpointRows(mechanicalMessages);
        const mechanicalNextId = this.mechanicalNextId;
        const combat = combatBuffers.get(this), restoreCombat = combat && checkpointRows(combat);
        const heard = heardCombat.has(this), display = presentations.get(this);
        // D3 occurrences are immutable capabilities shared with the timeline.
        // Rollback preserves their identities as well as their occurrence order.
        const pending = display?.pending, unread = display?.unread;
        const restorePending = pending && checkpointRows(pending);
        const restoreUnread = unread && checkpointRows(unread);
        let restoreObservation: (() => void) | undefined;
        try { restoreObservation = messageCheckpoints.get(this)?.(); } catch { /* optional UI */ }
        const terminalShown = display?.terminalShown;
        const disturb = disturbanceCallbacks.get(this);
        return () => {
            if (notice) feedback.set(this, notice); else feedback.delete(this);
            restoreMessages(); this.messages = messages;
            this.nextId = nextId; this.turn = turn; this.blockCombatText = blockCombatText;
            restoreMechanical(); this.mechanicalMessages = mechanicalMessages; this.mechanicalNextId = mechanicalNextId;
            if (combat) { restoreCombat!(); combatBuffers.set(this, combat); }
            else combatBuffers.delete(this);
            if (heard) heardCombat.add(this); else heardCombat.delete(this);
            if (display) {
                restorePending!(); restoreUnread!();
                display.pending = pending!; display.unread = unread!; display.terminalShown = terminalShown!;
                presentations.set(this, display);
            }
            else presentations.delete(this);
            if (disturb) disturbanceCallbacks.set(this, disturb); else disturbanceCallbacks.delete(this);
            try { restoreObservation?.(); } catch { /* optional UI cannot break rollback */ }
        };
    }
    public getState() {
        this.flushCombat();
        return this.peekState();
    }
    /** Pure mechanical observation, including no presentation flush or disturbance. */
    public peekState() {
        return { messages: this.messages.map(m => ({ ...m })), nextId: this.nextId, turn: this.turn,
            mechanical: { messages: this.mechanicalMessages.map(m => ({ ...m })), nextId: this.mechanicalNextId } };
    }
    public setState(state: ReturnType<Logger['getState']>): void {
        feedback.delete(this);
        combatBuffers.delete(this);
        heardCombat.delete(this);
        this.messages = state.messages.map(m => ({ ...m }));
        this.nextId = state.nextId;
        this.turn = state.turn;
        this.mechanicalMessages = state.mechanical.messages.map(m => ({ ...m }));
        this.mechanicalNextId = state.mechanical.nextId;
        this.clearAcknowledgments();
    }
    public reset(): void {
        feedback.delete(this);
        combatBuffers.delete(this);
        heardCombat.delete(this);
        this.messages = [];
        this.nextId = 0;
        this.mechanicalMessages = []; this.mechanicalNextId = 0;
        this.turn = 0;
        this.blockCombatText = false;
        this.clearAcknowledgments();
    }

    public log(text: string, color = '#ffffff', options: MessageOptions = {}): void {
        if (!text) return;
        if (options.presentationOnly) {
            feedback.set(this, { id: -1, text, color, count: 1, turn: this.turn });
            notifyPresentation(this);
            return;
        }
        feedback.delete(this);
        this.flushCombat();
        this.mechanicalMessages.push({ turn: this.turn, color, acknowledge: !!options.acknowledge, foldable: !!options.foldable });
        this.mechanicalNextId++;
        if (this.mechanicalMessages.length > MESSAGE_ARCHIVE_ENTRIES) this.mechanicalMessages.shift();
        this.disturb();
        let entry: LogMessage | undefined;
        // CE examines at most ARCHIVE_ENTRIES - 1 preceding entries. Stop at
        // the first other-turn entry, except the latest non-FOLDABLE message.
        for (let back = 1; back < MESSAGE_ARCHIVE_ENTRIES && back <= this.messages.length; back++) {
            const previous = this.messages[this.messages.length - back]!;
            if (!((back === 1 && !options.foldable) || previous.turn === this.turn)) break;
            if (previous.text === text) {
                previous.turn = this.turn;
                previous.count = Math.min(MAX_MESSAGE_REPEATS, previous.count + 1);
                entry = previous;
                break;
            }
        }
        if (!entry) {
            entry = { id: this.nextId++, text, color, count: 1, turn: this.turn,
                ...(options.acknowledge ? { acknowledge: true } : {}),
                ...(options.foldable ? { foldable: true } : {}) };
            this.messages.push(entry);
            if (this.messages.length > MESSAGE_ARCHIVE_ENTRIES) this.messages.shift();
        }
        let occurrence: Readonly<LogMessage> | undefined;
        if (options.acknowledge) {
            entry.acknowledge = true;
            const display = presentations.get(this);
            // Each occurrence still needs acknowledgment, even at count 100.
            if (display?.enabled()) {
                occurrence = Object.freeze({ ...entry, text, color });
                (display.terminalShown ? display.unread : display.pending).push(occurrence as LogMessage);
            }
        }
        try { messageObservers.get(this)?.(Object.freeze({ ...entry, text, color }), !!options.acknowledge, occurrence); }
        catch { /* observation cannot enter an engine error path */ }
        notifyPresentation(this);
    }
}
export const logger = new Logger();

/** The archive's rendered text is retained for display; only emission metadata
 * is mechanical evidence. Validate both before retiring a world on load. */
export function isLoggerSnapshot(value: unknown): value is ReturnType<Logger['getState']> {
    const v = value as ReturnType<Logger['getState']> | null;
    const uint = (n: number) => Number.isSafeInteger(n) && n >= 0;
    return !!v && uint(v.nextId) && uint(v.turn) && Array.isArray(v.messages) && v.messages.length <= MESSAGE_ARCHIVE_ENTRIES
        && v.messages.every(m => m && uint(m.id) && m.id < v.nextId && uint(m.turn) && typeof m.text === 'string'
            && typeof m.color === 'string' && Number.isInteger(m.count) && m.count >= 1 && m.count <= MAX_MESSAGE_REPEATS
            && (m.acknowledge === undefined || typeof m.acknowledge === 'boolean') && (m.foldable === undefined || typeof m.foldable === 'boolean'))
        && !!v.mechanical && uint(v.mechanical.nextId) && Array.isArray(v.mechanical.messages)
        && v.mechanical.messages.length <= Math.min(MESSAGE_ARCHIVE_ENTRIES, v.mechanical.nextId)
        && v.mechanical.messages.every(m => m && Object.keys(m).sort().join(',') === 'acknowledge,color,foldable,turn'
            && uint(m.turn) && typeof m.color === 'string' && typeof m.acknowledge === 'boolean' && typeof m.foldable === 'boolean');
}
