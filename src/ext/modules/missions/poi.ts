import type { WorldPoint } from '../../../engine/Movement/WorldUnits';
export function within(point: WorldPoint, center: WorldPoint, radius: number): boolean {
    return (point.x - center.x) ** 2 + (point.y - center.y) ** 2 <= radius ** 2;
}
