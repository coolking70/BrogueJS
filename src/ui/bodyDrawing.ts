import type { Graphics } from 'pixi.js';
import type { Pos } from '../types';
import type { PublicMonsterBody } from '../engine/UI/MonsterBody';
import { bodyContains } from '../engine/UI/MonsterBody';

export type DisplayBody = PublicMonsterBody & { readonly color: string | number };
export interface BodyEdge { from: Pos; to: Pos }
/** Edges of the actual public mask, including holes and concave corners. */
export function bodyEdges(cells: readonly Pos[]): BodyEdge[] {
    const occupied = new Set(cells.map(p => `${p.x},${p.y}`));
    const edges: BodyEdge[] = [];
    for (const { x, y } of cells) {
        if (!occupied.has(`${x},${y - 1}`)) edges.push({ from: { x, y }, to: { x: x + 1, y } });
        if (!occupied.has(`${x + 1},${y}`)) edges.push({ from: { x: x + 1, y }, to: { x: x + 1, y: y + 1 } });
        if (!occupied.has(`${x},${y + 1}`)) edges.push({ from: { x: x + 1, y: y + 1 }, to: { x, y: y + 1 } });
        if (!occupied.has(`${x - 1},${y}`)) edges.push({ from: { x, y: y + 1 }, to: { x, y } });
    }
    return edges;
}
export function paintBody(graphics: Graphics, body: DisplayBody, tileSize: number): void {
    for (const p of body.cells) graphics.rect(p.x * tileSize, p.y * tileSize, tileSize, tileSize);
    graphics.fill({ color: body.color, alpha: 0.10 });
    paintBodyOutline(graphics, body.cells, tileSize, body.color, 0.55, 0.8);
}
export function paintBodyOutline(graphics: Graphics, cells: readonly Pos[], tileSize: number,
    color: string | number, alpha = 1, width = 1.5): void {
    for (const edge of bodyEdges(cells)) graphics.moveTo(edge.from.x * tileSize, edge.from.y * tileSize)
        .lineTo(edge.to.x * tileSize, edge.to.y * tileSize);
    graphics.stroke({ color, alpha, width, alignment: 1 });
}
export function selectedBodyCells(bodies: readonly DisplayBody[], at: Pos): readonly Pos[] | null {
    return bodies.find(body => bodyContains(body, at))?.cells ?? null;
}
