import type { Game } from './Game';

export type PresentationPoint = 'animation-delay' | 'turn' | 'terminal' | 'command-complete';
interface Observer {
    observe(point: PresentationPoint, delayMs?: number): void;
    reset(): void;
    blocked(): boolean;
}
// Optional session port, never a Game field or part of the world/recorder.
const observers = new WeakMap<Game, Observer>();
export function bindPresentationObserver(game: Game, observer: Observer): () => void {
    observers.set(game, observer);
    return () => { if (observers.get(game) === observer) observers.delete(game); };
}
export function observePresentation(game: Game, point: PresentationPoint, delayMs?: number): void {
    try { observers.get(game)?.observe(point, delayMs); } catch { /* UI failure cannot change a command */ }
}
export function resetPresentation(game: Game): void {
    try { observers.get(game)?.reset(); } catch { /* optional presentation */ }
}
export function presentationBlocked(game: Game): boolean {
    try { return observers.get(game)?.blocked() ?? false; } catch { return false; }
}
