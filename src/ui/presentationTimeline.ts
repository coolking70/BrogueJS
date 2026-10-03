import type { Game } from '../engine/Core/Game';
import { bindPresentationObserver, type PresentationPoint } from '../engine/Core/PresentationObserver';
import type { Logger, LogMessage } from '../engine/Systems/Logger';
import { observeDisplayFrame, type DisplayFrame } from './displayProjection';

type EventData = { kind: 'frame'; frame: DisplayFrame }
    | { kind: 'message'; message: Readonly<LogMessage> }
    | { kind: 'acknowledgment'; occurrence: Readonly<LogMessage> }
    | { kind: 'animation-delay'; milliseconds: number }
    | { kind: 'terminal' | 'command-complete' };
export type PresentationEvent = EventData & { readonly sequence: number };
const timelines = new WeakMap<Game, PresentationTimeline>();

/** The iterator/world/recorder never wait for this cursor. Only live command
 * admission is blocked; MORE consumes no rule decision, command or random draw. */
export class PresentationTimeline {
    private events: PresentationEvent[] = [];
    private nextSequence = 1;
    private cursor = 0;
    private remainingMs = 0;
    private waiting?: Readonly<LogMessage>;
    private frame?: DisplayFrame;
    private lastCaptured?: DisplayFrame;
    private terminalObserved = false;
    private terminalReached = false;
    private detailedFrames = 0;
    private suppressedFrames = 0;
    private captureFailures = 0;
    private removeObserver: () => void;

    constructor(private game: Game, private log: Logger, private changed: () => void = () => {}) {
        timelines.set(game, this);
        this.removeObserver = bindPresentationObserver(game, {
            observe: (point, delay) => this.observe(point, delay), reset: () => this.clear(), blocked: () => this.busy,
        });
        log.observeMessages((message, acknowledge, occurrence) => {
            if (!this.enabled) return;
            this.capture();
            this.append({ kind: 'message', message });
            if (acknowledge && occurrence && !this.terminalObserved) this.append({ kind: 'acknowledgment', occurrence });
            if (this.terminalReached) log.showTerminalAcknowledgments();
            this.pump();
        });
    }
    get enabled(): boolean { return !this.game.replayRecording; }
    get busy(): boolean { return !!this.waiting || this.remainingMs > 0 || this.events.length > 0; }
    get acknowledgment(): Readonly<LogMessage> | undefined { return this.waiting; }
    get projection(): DisplayFrame | undefined { return this.busy || this.terminalReached ? this.frame : undefined; }
    get terminalReady(): boolean { return this.terminalReached || (!this.busy && this.game.isGameOver); }
    get resultAvailable(): boolean { return this.game.isGameOver && this.busy; }
    get diagnostics() {
        return { simulationTurn: this.game.absoluteTurnNumber, displayTurn: this.projection?.displayTurn ?? this.game.absoluteTurnNumber,
            presentationCursor: this.cursor, terminalAvailable: this.resultAvailable,
            nextSequence: this.nextSequence, pendingEvents: this.events.length, waiting: !!this.waiting,
            remainingMs: this.remainingMs, suppressedFrames: this.suppressedFrames, captureFailures: this.captureFailures, terminalReady: this.terminalReady };
    }
    /** Read-only diagnostics of the unplayed suffix, not a serialized state. */
    get pendingEvents(): readonly Readonly<PresentationEvent>[] { return this.events.slice(); }
    private notify(): void { try { this.changed(); } catch { /* no business exceptions */ } }
    private append(event: EventData): void { this.events.push(Object.freeze({ ...event, sequence: this.nextSequence++ })); }
    private capture(optional = false): boolean {
        // Bound expensive animation detail, never ACKs/messages or their frames.
        if (optional && this.detailedFrames >= 128) { this.suppressedFrames++; return false; }
        try {
            const frame = observeDisplayFrame(this.game, this.log, this.lastCaptured);
            this.lastCaptured = frame;
            this.append({ kind: 'frame', frame });
            this.detailedFrames++;
            return true;
        } catch {
            // A failed display calculation cannot swallow its ACK or abort a
            // rule command. Retain the last safe observed frame, when available.
            this.captureFailures++;
            if (this.lastCaptured) this.append({ kind: 'frame', frame: this.lastCaptured });
            return false;
        }
    }
    private observe(point: PresentationPoint, delayMs = 0): void {
        if (!this.enabled) return;
        const backlog = this.busy;
        const detailed = this.capture(point === 'turn' || point === 'animation-delay');
        if (point === 'terminal') {
            this.terminalObserved = true;
            this.append({ kind: 'terminal' });
        } else if (point === 'command-complete') this.append({ kind: point });
        if (detailed && backlog && !this.terminalObserved && delayMs > 0) this.append({ kind: 'animation-delay', milliseconds: delayMs });
        this.pump();
    }
    private pump(): void {
        if (!this.enabled) { this.clear(); return; }
        while (!this.waiting && this.remainingMs === 0 && this.events.length) {
            const event = this.events.shift()!;
            this.cursor = event.sequence;
            if (event.kind === 'frame') this.frame = event.frame;
            else if (event.kind === 'acknowledgment') this.waiting = event.occurrence;
            else if (event.kind === 'animation-delay' && !this.terminalReached) this.remainingMs = event.milliseconds;
            else if (event.kind === 'terminal') {
                this.terminalReached = true;
                this.log.showTerminalAcknowledgments();
            }
        }
        if (!this.busy) { this.detailedFrames = 0; this.lastCaptured = undefined; }
        this.notify();
    }
    tick(milliseconds: number): void {
        if (!this.enabled) { if (this.busy || this.frame) this.clear(); return; }
        // Reading never accrues animation time, including background resume.
        if (this.waiting) return;
        if (this.remainingMs > 0) this.remainingMs = Math.max(0, this.remainingMs - Math.max(0, milliseconds));
        this.pump();
    }
    acknowledge(occurrence: Readonly<LogMessage>): boolean {
        if (this.waiting !== occurrence || this.log.pendingAcknowledgment !== occurrence) return false;
        this.log.acknowledgeNext();
        this.waiting = undefined;
        this.pump();
        return true;
    }
    showResult(): boolean {
        if (!this.game.isGameOver) return false;
        this.capture();
        this.frame = this.lastCaptured;
        this.events = []; this.waiting = undefined; this.remainingMs = 0;
        this.cursor = this.nextSequence - 1;
        this.terminalObserved = this.terminalReached = true;
        this.log.showTerminalAcknowledgments();
        this.notify();
        return true;
    }
    clear(): void {
        this.events = []; this.waiting = undefined; this.frame = this.lastCaptured = undefined;
        this.remainingMs = this.detailedFrames = this.suppressedFrames = 0;
        this.captureFailures = this.cursor = 0; this.nextSequence = 1;
        this.terminalObserved = this.terminalReached = false;
        this.log.clearAcknowledgments();
        this.notify();
    }
    dispose(): void {
        this.removeObserver(); this.log.observeMessages(null); this.clear();
        if (timelines.get(this.game) === this) timelines.delete(this.game);
    }
}
export const presentationTimeline = (game: Game): PresentationTimeline | undefined => timelines.get(game);
export const displayedFrame = (game: Game): DisplayFrame | undefined => timelines.get(game)?.projection;
