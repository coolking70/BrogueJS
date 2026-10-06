import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import manifest from '../data/portraits.json';
import palette from '../assets/portraits/palette.json';

interface PngChunk { type: string; data: Buffer }
function chunks(png: Buffer): PngChunk[] {
    expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    const result: PngChunk[] = [];
    let offset = 8;
    while (offset < png.length) {
        expect(offset + 12).toBeLessThanOrEqual(png.length);
        const length = png.readUInt32BE(offset);
        expect(offset + 12 + length).toBeLessThanOrEqual(png.length);
        const type = png.toString('ascii', offset + 4, offset + 8);
        result.push({ type, data: png.subarray(offset + 8, offset + 8 + length) });
        offset += length + 12;
        if (type === 'IEND') break;
    }
    expect(offset).toBe(png.length);
    expect(result[0]!.type).toBe('IHDR');
    expect(result[result.length - 1]!.type).toBe('IEND');
    return result;
}
function paeth(a: number, b: number, c: number): number {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}
function decodeIndices(pngChunks: PngChunk[], width: number, height: number, depth: number): number[][] {
    const compressed = Buffer.concat(pngChunks.filter(c => c.type === 'IDAT').map(c => c.data));
    expect(compressed.length).toBeGreaterThan(0);
    const raw = inflateSync(compressed), stride = Math.ceil(width * depth / 8);
    expect(raw.length).toBe(height * (stride + 1));
    let previous = new Uint8Array(stride);
    const pixels: number[][] = [];
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)]!;
        expect(filter).toBeLessThanOrEqual(4);
        const row = new Uint8Array(stride);
        for (let x = 0; x < stride; x++) {
            const value = raw[y * (stride + 1) + 1 + x]!;
            const left = x > 0 ? row[x - 1]! : 0, up = previous[x]!, upperLeft = x > 0 ? previous[x - 1]! : 0;
            const predictor = filter === 0 ? 0 : filter === 1 ? left : filter === 2 ? up
                : filter === 3 ? Math.floor((left + up) / 2) : paeth(left, up, upperLeft);
            row[x] = (value + predictor) & 255;
        }
        pixels.push(Array.from({ length: width }, (_, x) => depth === 8 ? row[x]! : (row[x >> 1]! >> (x % 2 ? 0 : 4)) & 15));
        previous = row;
    }
    return pixels;
}
function rgb(hex: string): [number, number, number] {
    return [Number.parseInt(hex.slice(1, 3), 16), Number.parseInt(hex.slice(3, 5), 16), Number.parseInt(hex.slice(5, 7), 16)];
}
function luminance(color: readonly number[]): number {
    const channels = color.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return channels[0]! * .2126 + channels[1]! * .7152 + channels[2]! * .0722;
}

describe('EXT-6B1a shared pixel portrait production contract', () => {
    it('uses a sorted unique shared palette with no magenta key contamination', () => {
        // D-22: 32 colours preserves the silver hair, copper bell and skin separation.
        expect(palette).toHaveLength(32);
        expect(new Set(palette).size).toBe(palette.length);
        const lights: number[] = [];
        for (const color of palette) {
            expect(color).toMatch(/^#[0-9a-f]{6}$/);
            const [r, g, b] = rgb(color);
            expect(Math.min(r, b) - g > 30 && r > 150).toBe(false);
            lights.push(luminance([r, g, b]));
        }
        expect(lights).toEqual([...lights].sort((a, b) => a - b));
        expect(manifest.displayVersion).toBe('1.2.0');
    });
    it.each(manifest.portraits)('$id is an indexed 48×64 binary-alpha PNG with bounded edges and contrast', entry => {
        expect(entry).toMatchObject({ width: 48, height: 64, fit: 'contain', anchor: 'bottom-center' });
        expect(entry.asset).toMatch(/^[a-z-]+\.png$/);
        const png = readFileSync(new URL(`../assets/portraits/${entry.asset}`, import.meta.url));
        expect(png.length).toBeLessThanOrEqual(4096);
        const blocks = chunks(png), header = blocks.find(c => c.type === 'IHDR')!.data;
        expect(blocks.filter(c => c.type === 'IHDR')).toHaveLength(1);
        expect(header.length).toBe(13);
        expect(header.readUInt32BE(0)).toBe(48); expect(header.readUInt32BE(4)).toBe(64);
        const depth = header[8]!;
        expect([4, 8]).toContain(depth);
        expect([...header.subarray(9)]).toEqual([3, 0, 0, 0]); // indexed, compression/filter methods, non-interlaced
        expect(blocks.filter(c => ['tEXt', 'iTXt', 'zTXt', 'eXIf', 'tIME'].includes(c.type))).toEqual([]);
        const pltes = blocks.filter(c => c.type === 'PLTE'), trns = blocks.filter(c => c.type === 'tRNS');
        expect(pltes).toHaveLength(1); expect(trns).toHaveLength(1);
        const plte = pltes[0]!.data, alpha = [...trns[0]!.data];
        expect(plte.length % 3).toBe(0); expect(plte.length / 3).toBeLessThanOrEqual(palette.length + 1);
        expect(alpha.length).toBeGreaterThan(0); expect(alpha.length).toBeLessThanOrEqual(plte.length / 3);
        expect(alpha[0]).toBe(0); expect(alpha.filter(a => a === 0)).toHaveLength(1);
        expect(alpha.slice(1).every(a => a === 255)).toBe(true);
        const colors: number[][] = [];
        for (let index = 0; index < plte.length / 3; index++) {
            const color = [...plte.subarray(index * 3, index * 3 + 3)];
            colors.push(color);
            if (index > 0) expect(palette).toContain('#' + color.map(c => c.toString(16).padStart(2, '0')).join(''));
        }
        const indices = decodeIndices(blocks, 48, 64, depth);
        expect(indices.flat().every(index => index < colors.length)).toBe(true);
        const opaque = indices.map(row => row.map(index => (alpha[index] ?? 255) === 255));
        expect([opaque[0]![0], opaque[0]![47], opaque[63]![0], opaque[63]![47]]).toEqual([false, false, false, false]);
        const counts = opaque.map(row => row.filter(Boolean).length);
        expect(counts[0]).toBeLessThanOrEqual(2);
        for (const col of [0, 47]) expect(opaque.slice(0, Math.floor(64 * .8)).filter(row => row[col]).length).toBeLessThanOrEqual(2);
        const head = counts.findIndex(count => count >= 3);
        expect(head).toBeGreaterThanOrEqual(3); expect(head).toBeLessThanOrEqual(12);
        const coverage = counts.reduce((a, b) => a + b, 0) / (48 * 64);
        expect(coverage).toBeGreaterThanOrEqual(.35); expect(coverage).toBeLessThanOrEqual(.75);
        const contrasts: number[] = [], background = luminance([17, 19, 15]);
        for (let y = 0; y < 64; y++) for (let x = 0; x < 48; x++) {
            if (!opaque[y]![x]) continue;
            if ([[y - 1, x], [y + 1, x], [y, x - 1], [y, x + 1]].every(([yy, xx]) => opaque[yy!]?.[xx!])) continue;
            const light = luminance(colors[indices[y]![x]!]!);
            contrasts.push((Math.max(light, background) + .05) / (Math.min(light, background) + .05));
        }
        contrasts.sort((a, b) => a - b);
        const middle = Math.floor(contrasts.length / 2);
        const median = contrasts.length % 2 ? contrasts[middle]! : (contrasts[middle - 1]! + contrasts[middle]!) / 2;
        expect(median).toBeGreaterThanOrEqual(1.5);
    });
    it('keeps consistent head placement and the whole set under 12 KiB', () => {
        const results = manifest.portraits.map(entry => {
            const png = readFileSync(new URL(`../assets/portraits/${entry.asset}`, import.meta.url));
            const blocks = chunks(png), depth = blocks.find(c => c.type === 'IHDR')!.data[8]!;
            const rows = decodeIndices(blocks, 48, 64, depth);
            return { head: rows.findIndex(row => row.filter(index => index !== 0).length >= 3), bytes: png.length };
        });
        expect(results).toHaveLength(3);
        const heads = results.map(r => r.head);
        expect(Math.max(...heads) - Math.min(...heads)).toBeLessThanOrEqual(4);
        expect(results.reduce((sum, r) => sum + r.bytes, 0)).toBeLessThanOrEqual(12288);
    });
});
