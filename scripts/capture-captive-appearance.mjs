/** Generate the R-1 terrain goldens from CE sources, never from web visuals.
 * Run: node scripts/capture-captive-appearance.mjs
 * CAPTIVE-1: scope the original CE extractor to six appended captive anchors.
 * Historical appearance fixtures remain byte-for-byte unchanged.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const ce = readFileSync(resolve(root, '.ce-reference/BrogueCE-master/src/brogue/Globals.c'), 'utf8');
const base = readFileSync(resolve(root, '.ce-reference/BrogueCE-master/src/brogue/GlobalsBase.c'), 'utf8');
const glyphSource = readFileSync(resolve(root, '.ce-reference/BrogueCE-master/src/platform/platformdependent.c'), 'utf8');
const unicodeSource = readFileSync(resolve(root, '.ce-reference/BrogueCE-master/src/platform/platform.h'), 'utf8');
const names = ["MANACLE_TL", "MANACLE_BR", "MANACLE_TR", "MANACLE_BL", "MANACLE_B", "MANACLE_R"];
const required = (condition, message) => { if (!condition) throw Error(message); };

const colors = new Map();
for (const source of [ce, base]) {
    for (const m of source.matchAll(/const color\s+(\w+)\s*=\s*\{\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(-?\d+)\s*,/g)) {
        colors.set(m[1], [Number(m[2]), Number(m[3]), Number(m[4])]);
    }
}
const unicode = new Map([...unicodeSource.matchAll(/^#define\s+(U_\w+)\s+0x([\da-fA-F]+)/gm)].map(m => [m[1], String.fromCodePoint(parseInt(m[2], 16))]));
const glyphs = new Map();
for (const m of glyphSource.matchAll(/case\s+(G_\w+):\s*return\s+(U_\w+|'(?:\\.|[^'\\])*')\s*;/g)) {
    const value = m[2].trim();
    let glyph;
    try { glyph = value.startsWith('U_') ? unicode.get(value) : Function(`return ${value}`)(); }
    catch { throw Error(`Unparseable glyph ${m[1]}: ${value}`); }
    glyphs.set(m[1], glyph);
}
for (const m of glyphSource.matchAll(/((?:case\s+G_\w+:\s*){2,})return\s+(U_\w+|'(?:\\.|[^'\\])*')\s*;/g)) {
    const value = m[2].trim();
    const glyph = value.startsWith('U_') ? unicode.get(value) : Function(`return ${value}`)();
    for (const label of m[1].matchAll(/case\s+(G_\w+):/g)) glyphs.set(label[1], glyph);
}
const tiles = new Map();
const lines = ce.split('\n');
for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s*\/\*([A-Z][A-Z0-9_]+),?\*\/\s*\{\s*([^,]+),\s*([^,]+),\s*([^,]+),/);
    if (m) tiles.set(m[1], { glyph: m[2].trim(), fore: m[3].trim(), back: m[4].trim(), line: i + 1 });
}
const dynamic = new Map();
for (const m of ce.matchAll(/\{\s*&([A-Za-z]+Start(?:Color)?)\s*,\s*&([A-Za-z]+End(?:Color)?)\s*\}/g)) {
    dynamic.set(m[1].replace(/Start(?:Color)?$/, ''), [m[1], m[2]]);
}
const color = symbol => {
    if (symbol === '0') return null;
    const name = symbol.replace(/^&/, '');
    const parts = colors.get(name) ?? colors.get(dynamic.get(name)?.[0]);
    required(parts, `Unknown CE color ${symbol}`);
    // CE's default depth is one (RogueMain.c); dynamic colors interpolate
    // start/end components with integer weight trunc(100 / AMULET_LEVEL=26).
    const pair = dynamic.get(name);
    const values = pair ? parts.map((v, i) => Math.trunc((v * 97 + colors.get(pair[1])[i] * 3) / 100)) : parts;
    return '#' + values.map(v => Math.trunc(Math.max(0, Math.min(100, v)) * 255 / 100).toString(16).padStart(2, '0')).join('');
};
const result = {};
for (const name of names) {
    const tileName = name;
    const tile = tiles.get(tileName);
    required(tile, `No CE tile for ${name} -> ${tileName}`);
    const char = tile.glyph === '0' ? '' : tile.glyph.startsWith("'") ? tile.glyph.slice(1, -1) : glyphs.get(tile.glyph);
    required(char !== undefined, `Unknown glyph ${tile.glyph} for ${name}`);
    const foreground = color(tile.fore);
    const background = color(tile.back);
    result[name] = {
        ceTile: tileName, ceLine: tile.line, char,
        color: foreground ?? '#000000',
        bgColor: background === null ? null : parseInt(background.slice(1), 16),
    };
}
const output = resolve(root, 'src/test/fixtures/captive-ce-terrain.json');
const generated = JSON.stringify(result, null, 2) + '\n';
writeFileSync(output, generated);
console.log('Captured '+names.length+' captive appearances from actual CE sources');
