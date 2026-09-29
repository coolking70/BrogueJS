/** Mouse gestures on the map are presentation-only until a click is confirmed. */
export function shouldHandleMapWheel(modifiers: { ctrlKey: boolean; metaKey: boolean }): boolean {
    return !modifiers.ctrlKey && !modifiers.metaKey;
}

export function wheelZoomFactor(deltaY: number): number {
    return Math.exp(-Math.max(-240, Math.min(240, deltaY)) * 0.002);
}

/** Presentation-only cursor paint; map/creature appearance remains in Appearance.ts. */
export const MAP_HOVER_FILL = 0xffffff;
export const MAP_HOVER_STROKE = 0xfacc15;

/** Never make an unexplored cell appear interactive through the hover layer. */
export function shouldHighlightMapCell(cell: { isVisible: boolean; hasMemory: boolean; isMagicMapped: boolean } | null): boolean {
    return !!cell && (cell.isVisible || cell.hasMemory || cell.isMagicMapped);
}

export class MousePanTracker {
    private pointerId: number | null = null;
    private startX = 0;
    private startY = 0;
    private lastX = 0;
    private lastY = 0;
    private dragging = false;

    down(pointerId: number, x: number, y: number): void {
        this.pointerId = pointerId;
        this.startX = this.lastX = x;
        this.startY = this.lastY = y;
        this.dragging = false;
    }

    move(pointerId: number, x: number, y: number): { dx: number; dy: number; dragging: boolean } {
        if (pointerId !== this.pointerId) return { dx: 0, dy: 0, dragging: false };
        if (!this.dragging && Math.hypot(x - this.startX, y - this.startY) < 5) {
            return { dx: 0, dy: 0, dragging: false };
        }
        this.dragging = true;
        const delta = { dx: x - this.lastX, dy: y - this.lastY, dragging: true };
        this.lastX = x;
        this.lastY = y;
        return delta;
    }

    up(pointerId: number): boolean {
        if (pointerId !== this.pointerId) return false;
        const wasDragging = this.dragging;
        this.cancel();
        return wasDragging;
    }

    cancel(): void {
        this.pointerId = null;
        this.dragging = false;
    }

    get isDragging(): boolean { return this.dragging; }
}
