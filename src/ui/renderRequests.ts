/** All engine/animation draws in one ticker are presented together. The game
 * still advances at its original cadence; only redundant canvas work is merged. */
export class RenderRequests {
    private pending = false;
    request = () => { this.pending = true; };
    flush(draw: () => void) {
        if (!this.pending) return;
        this.pending = false;
        draw();
    }
}
