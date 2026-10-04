import portraitData from '../data/portraits.json';
import locales from '../locales/zh_CN.json';
import { loadPortraitManifest } from '../schema';
import type { PortraitManifest } from '../types';

/** Display-only metadata; no rule definitions or engine objects reach the view. */
export interface NarrativePortraitView {
    readonly id: string | null;
    readonly url: string | null;
    readonly width: number;
    readonly height: number;
    readonly fit: 'contain';
    readonly anchor: 'bottom-center';
    readonly altKey: string;
    readonly fallbackGlyph: string;
}

const assetPrefix = '../assets/portraits/';
const bundledAssets = import.meta.glob<string>('../assets/portraits/**/*.{png,webp}', {
    eager: true, query: '?url', import: 'default',
});
const fallback: NarrativePortraitView = Object.freeze({
    id: null, url: null, width: 240, height: 320, fit: 'contain', anchor: 'bottom-center',
    altKey: 'ext.narrative.portrait.unavailable', fallbackGlyph: '◇',
});

/** The map is Vite's finite, module-local asset inventory, never a URL built
 * from an untrusted id. Missing files are presentation fallbacks, not pack errors. */
export function createNarrativePortraitResolver(raw: unknown, assets: Readonly<Record<string, string>> = bundledAssets): {
    readonly manifest: PortraitManifest;
    readonly resolve: (id: string | null | undefined) => NarrativePortraitView;
} {
    const manifest = loadPortraitManifest(raw, locales);
    const resolved = new Map(manifest.portraits.map(portrait => {
        const path = portrait.asset === null ? null : assetPrefix + portrait.asset;
        const url = path !== null && Object.prototype.hasOwnProperty.call(assets, path) ? assets[path]! : null;
        return [portrait.id, Object.freeze({ id: portrait.id, url, width: portrait.width, height: portrait.height,
            fit: portrait.fit, anchor: portrait.anchor, altKey: portrait.altKey, fallbackGlyph: portrait.fallbackGlyph })] as const;
    }));
    return Object.freeze({ manifest, resolve: (id: string | null | undefined) => id ? resolved.get(id) ?? fallback : fallback });
}

const localPortraits = createNarrativePortraitResolver(portraitData);
export const narrativePortraitDisplayVersion = localPortraits.manifest.displayVersion;
export const resolveNarrativePortrait = localPortraits.resolve;
