import { Container, Graphics, GraphicsContext, Sprite, Texture } from 'pixi.js';
import type { TileSemantic } from './mapTileSemantics';
import { paintVectorTile, resolveVectorIcon, type RetainedVectorTarget } from './vectorAtlas';

/** Geometry is white ink plus the atlas's black cutouts, with original alpha.
 * The per-instance tint supplies the exact current engine color. Size/camera/DPR
 * are transforms, not bitmap cache keys, so zoom never reuses a blurry raster.
 * Keys come ONLY from the already-public resolved silhouette, never true IDs.
 * The resolver has a finite catalog, so flickering light cannot grow this cache. */
export class VectorGeometryCache {
    private contexts = new Map<string, GraphicsContext>();
    get size() { return this.contexts.size; }
    get(value: TileSemantic): GraphicsContext | null {
        const icon = resolveVectorIcon(value);
        if (icon.family === 'blank') return null;
        const key = `${icon.group}:${icon.family}:${icon.variant}`;
        let context = this.contexts.get(key);
        if (!context) {
            context = new GraphicsContext();
            // Pixi's auto threshold would give complex walls/water one draw
            // call per cell. Atlas paths are small and safe to batch explicitly.
            context.batchMode = 'batch';
            const painter = new Graphics({ context });
            paintVectorTile(painter, value, 0xffffff, 0, 0, 16);
            painter.destroy(); // externally owned context remains cached
            this.contexts.set(key, context);
        }
        return context;
    }
    destroy() { for (const context of this.contexts.values()) context.destroy(); this.contexts.clear(); }
}

/** A bounded pool in paint order, with persistent shared Pixi geometry. */
export class RetainedVectorLayer extends Container implements RetainedVectorTarget {
    readonly retainedVector = true;
    private sprites: Graphics[] = [];
    private next = 0;
    constructor(private readonly cache: VectorGeometryCache, private readonly paintOrderParent?: Container) { super(); this.eventMode = 'none'; }
    clear() { this.next = 0; }
    paintTile(value: TileSemantic, color: string | number, x: number, y: number, size: number): false {
        const context = this.cache.get(value);
        if (!context) return false;
        let sprite = this.sprites[this.next++];
        if (!sprite) { sprite = new Graphics({ context }); this.sprites.push(sprite); (this.paintOrderParent ?? this).addChild(sprite); }
        else if (sprite.context !== context) sprite.context = context;
        const parsed = typeof color === 'number' ? color : parseInt(color.replace(/^#/, ''), 16);
        sprite.tint = Number.isFinite(parsed) ? parsed : 0;
        // Preserve old per-cell background/foreground order at tile edges.
        if (this.paintOrderParent) sprite.zIndex = (x * 0x10000 + y) * 2 + 1;
        sprite.position.set(x * size, y * size);
        sprite.scale.set(size / 16);
        sprite.visible = true;
        return false;
    }
    finish() { for (let i = this.next; i < this.sprites.length; i++) this.sprites[i]!.visible = false; }
}

/** Flat backgrounds need only shared white quads, not new paths every refresh. */
export class RetainedBackgroundLayer extends Container {
    private sprites: Sprite[] = [];
    private next = 0;
    constructor() { super(); this.eventMode = 'none'; this.sortableChildren = true; }
    clear() { this.next = 0; }
    paint(color: number, x: number, y: number, size: number) {
        let sprite = this.sprites[this.next++];
        if (!sprite) { sprite = new Sprite(Texture.WHITE); this.sprites.push(sprite); this.addChild(sprite); }
        sprite.zIndex = (x * 0x10000 + y) * 2;
        sprite.position.set(x * size, y * size);
        sprite.width = size; sprite.height = size;
        sprite.tint = color; sprite.visible = true;
    }
    finish() { for (let i = this.next; i < this.sprites.length; i++) this.sprites[i]!.visible = false; }
}
