import type { FloatingText } from '../engine/Visuals/FloatingText';
import { DISPLAY_FRAME_MS } from '../engine/UI/ActionCadence';

// Object identity survives frozen timeline copies without using the random ID
// (which can collide), touching the world, or retaining discarded runs.
const identities = new WeakMap<FloatingText, Readonly<object>>();
export function observeFloatingText(text: FloatingText) {
    let identity = identities.get(text);
    if (!identity) { identity = Object.freeze({}); identities.set(text, identity); }
    return { identity, text: text.text, color: text.color, x: text.x, y: text.y, life: text.life, dy: text.dy };
}
type Observation = ReturnType<typeof observeFloatingText>;

/** One display clock for live and frozen frames. Start on first presentation,
 * so queued effects are not spent before their frame reaches the viewer. */
export class FloatingTextPresentation {
    private milliseconds = 0;
    private starts = new WeakMap<object, { at: number; initial: Observation }>();
    tick(milliseconds: number): void {
        if (Number.isFinite(milliseconds) && milliseconds > 0) this.milliseconds += milliseconds;
    }
    project(texts: readonly Observation[]): Observation[] {
        return texts.flatMap(text => {
            let start = this.starts.get(text.identity);
            if (!start) {
                start = { at: this.milliseconds, initial: text };
                this.starts.set(text.identity, start);
            }
            const elapsed = (this.milliseconds - start.at) / DISPLAY_FRAME_MS;
            const life = start.initial.life - elapsed;
            return life > 1e-7 ? [{ ...text, life, y: start.initial.y + start.initial.dy * elapsed }] : [];
        });
    }
    expired(text: FloatingText): boolean {
        const identity = identities.get(text), start = identity && this.starts.get(identity);
        return !!start && this.milliseconds - start.at + 1e-7 >= start.initial.life * DISPLAY_FRAME_MS;
    }
}
