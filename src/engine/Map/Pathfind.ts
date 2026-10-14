/**
 * src/engine/Map/Pathfind.ts
 * A* Pathfinding for Auto-move and Monster AI
 */

import type { Grid } from './Grid';
import type { Pos } from '../../types';
import { PathFrontier } from './PathFrontier';

export class Pathfind {
    /**
     * Compute an A* path from start to goal.
     * Returns an array of Pos from the next step up to the goal.
     * Returns null if no path found.
     */
    static findPath(grid: Grid, startX: number, startY: number, goalX: number, goalY: number, canPass: (x: number, y: number) => boolean,
        canStep?: (from: Pos, to: Pos) => boolean): Pos[] | null {
        if (!grid.isValidPos(goalX, goalY)) return null;
        if (!canPass(goalX, goalY)) return null;

        const openSet = new PathFrontier();
        const cameFrom = new Map<string | number, Pos>();
        const gScore = new Map<string | number, number>();

        // Bounded integer cells have a unique numeric index. Avoid allocating
        // strings for every neighbor; retain the generic API's old keys for
        // fractional/out-of-grid starts, whose search domain is not this grid.
        const height = grid.height;
        const numericKeys = Number.isSafeInteger(grid.width * height) && height > 0
            && Number.isInteger(startX) && Number.isInteger(startY)
            && startX >= 0 && startX < grid.width && startY >= 0 && startY < height;
        const toKey = numericKeys ? (x: number, y: number) => x * height + y
            : (x: number, y: number) => `${x},${y}`;
        const startKey = toKey(startX, startY);

        gScore.set(startKey, 0);
        openSet.improve(startKey, { x: startX, y: startY }, this.heuristic(startX, startY, goalX, goalY));

        while (openSet.length > 0) {
            // Stable ties and decrease-key order match the former linear array.
            const current = openSet.pop();

            if (current.x === goalX && current.y === goalY) {
                return this.reconstructPath(cameFrom, current, toKey);
            }

            const currentKey = toKey(current.x, current.y);
            const currentG = gScore.get(currentKey)!;

            // Neighbors (8-way)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    if (dx === 0 && dy === 0) continue;

                    const nx = current.x + dx;
                    const ny = current.y + dy;

                    if (!grid.isValidPos(nx, ny) || !canPass(nx, ny)) continue;
                    if (canStep && !canStep(current, { x: nx, y: ny })) continue;

                    // Diagonals cost slightly more
                    const moveCost = (dx !== 0 && dy !== 0) ? 1.414 : 1.0;
                    const tentative_gScore = currentG + moveCost;

                    const neighborKey = toKey(nx, ny);
                    const nGScore = gScore.get(neighborKey) ?? Infinity;

                    if (tentative_gScore < nGScore) {
                        cameFrom.set(neighborKey, { x: current.x, y: current.y });
                        gScore.set(neighborKey, tentative_gScore);
                        openSet.improve(neighborKey, { x: nx, y: ny }, tentative_gScore + this.heuristic(nx, ny, goalX, goalY));
                    }
                }
            }
        }

        return null; // No path
    }

    private static heuristic(x1: number, y1: number, x2: number, y2: number): number {
        // Octile distance
        const dx = Math.abs(x1 - x2);
        const dy = Math.abs(y1 - y2);
        return Math.max(dx, dy) + (Math.sqrt(2) - 1) * Math.min(dx, dy);
    }

    private static reconstructPath(cameFrom: Map<string | number, Pos>, current: Pos,
        toKey: (x: number, y: number) => string | number): Pos[] {
        const totalPath = [current];
        let currKey = toKey(current.x, current.y);

        while (cameFrom.has(currKey)) {
            current = cameFrom.get(currKey)!;
            currKey = toKey(current.x, current.y);
            totalPath.unshift(current);
        }

        // Remove start node
        totalPath.shift();
        return totalPath;
    }
}
