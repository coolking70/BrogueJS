import { circleIsFree, type CollisionGrid } from '../../../engine/Movement/KinematicCollision';
import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
const T = 1024;
const DIRECTIONS = [[0, -1], [-1, 0], [1, 0], [0, 1]] as const;
/** A single BFS per target cell and clearance class, shared by the entire
 * cohort. Static terrain and target position fully determine the derived cache. */
export class FlowField {
    private readonly passable: Uint8Array;
    private readonly distances: Int32Array;
    private goal = -1;
    private targetCell = -1;
    constructor(private readonly grid: CollisionGrid, readonly radius: number) {
        this.passable = Uint8Array.from({ length: grid.width * grid.height }, (_, i) =>
            Number(circleIsFree({ grid }, { x: (i % grid.width) * T + T / 2, y: Math.floor(i / grid.width) * T + T / 2 }, radius)));
        this.distances = new Int32Array(this.passable.length).fill(-1);
    }
    update(target: WorldPoint): void {
        const tx = Math.floor(target.x / T), ty = Math.floor(target.y / T), cell = ty * this.grid.width + tx;
        if (cell === this.targetCell) return;
        this.targetCell = cell; this.distances.fill(-1); this.goal = -1;
        let best = Infinity;
        for (let i = 0; i < this.passable.length; i++) if (this.passable[i]) {
            const d = (i % this.grid.width - tx) ** 2 + (Math.floor(i / this.grid.width) - ty) ** 2;
            if (d < best) { best = d; this.goal = i; }
        }
        if (this.goal < 0) return;
        const queue = new Int32Array(this.passable.length); let head = 0, tail = 1;
        queue[0] = this.goal; this.distances[this.goal] = 0;
        while (head < tail) {
            const i = queue[head++]!, x = i % this.grid.width, y = Math.floor(i / this.grid.width);
            for (const [dx, dy] of DIRECTIONS) {
                const nx = x + dx, ny = y + dy, n = ny * this.grid.width + nx;
                if (nx < 0 || ny < 0 || nx >= this.grid.width || ny >= this.grid.height || !this.passable[n] || this.distances[n] !== -1) continue;
                this.distances[n] = this.distances[i]! + 1; queue[tail++] = n;
            }
        }
    }
    distance(at: WorldPoint): number { return this.distances[Math.floor(at.y / T) * this.grid.width + Math.floor(at.x / T)] ?? -1; }
    waypoint(at: WorldPoint, target: WorldPoint, tie: number): WorldPoint | null {
        const x = Math.floor(at.x / T), y = Math.floor(at.y / T), index = y * this.grid.width + x;
        const distance = this.distances[index] ?? -1;
        if (distance < 0) {
            // Steering may leave the center-line clearance corridor while its
            // circle remains valid. Rejoin a nearby reachable cell instead of
            // freezing at a rounded corner; actual movement still sweeps.
            let best: WorldPoint | null = null, score = Infinity;
            for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= this.grid.width || ny >= this.grid.height || (this.distances[ny * this.grid.width + nx] ?? -1) < 0) continue;
                const p = { x: nx * T + T / 2, y: ny * T + T / 2 }, d = (p.x - at.x) ** 2 + (p.y - at.y) ** 2;
                if (d < score) { best = p; score = d; }
            }
            return best;
        }
        if (distance === 0) return circleIsFree({ grid: this.grid }, target, this.radius) ? target
            : { x: (this.goal % this.grid.width) * T + T / 2, y: Math.floor(this.goal / this.grid.width) * T + T / 2 };
        let result: WorldPoint | null = null, best = Infinity;
        for (let offset = 0; offset < 4; offset++) {
            const [dx, dy] = DIRECTIONS[(offset + tie) % 4]!, nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= this.grid.width || ny >= this.grid.height) continue;
            if (this.distances[ny * this.grid.width + nx] !== distance - 1) continue;
            const p = { x: nx * T + T / 2, y: ny * T + T / 2 }, score = (p.x - at.x) ** 2 + (p.y - at.y) ** 2;
            if (score < best) { best = score; result = p; }
        }
        return result;
    }
}
