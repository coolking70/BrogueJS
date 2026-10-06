#!/usr/bin/env python3
"""Reproducible phase 6B1-alpha portrait pipeline (Python + Pillow + numpy).

Pass three original 1024x1536 GPT outputs, in archive/bell/wick order. Candidate
PNGs, palette.json and measurements are staged outside the repository. Inspect
all three contact sheets and measurements before replacing any shipped assets.
No source resizing, per-character crop, dithering or hand painting is performed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image

KEY_COLOR = np.array([255, 0, 255], dtype=np.int16)
BACKGROUND = (17, 19, 15)
NAMES = ('archive-keeper', 'bell-mender', 'wick-listener')
SOURCE_SIZE = (1024, 1536)
TARGET_SIZE = (48, 64)
CROP = (0, 171, 1024, 1536)


def luminance(rgb: np.ndarray) -> np.ndarray:
    value = np.asarray(rgb, dtype=np.float64) / 255
    linear = np.where(value <= .04045, value / 12.92, ((value + .055) / 1.055) ** 2.4)
    return linear @ np.array([.2126, .7152, .0722])


def remove_specks(alpha: np.ndarray) -> int:
    """Delete only detached 4-connected opaque components of at most two pixels."""
    seen: set[tuple[int, int]] = set()
    components: list[list[tuple[int, int]]] = []
    height, width = alpha.shape
    for y, x in zip(*np.nonzero(alpha), strict=True):
        point = (int(y), int(x))
        if point in seen:
            continue
        seen.add(point)
        stack = [point]
        component = []
        while stack:
            row, col = stack.pop()
            component.append((row, col))
            for yy, xx in ((row - 1, col), (row + 1, col), (row, col - 1), (row, col + 1)):
                if 0 <= yy < height and 0 <= xx < width and alpha[yy, xx] and (yy, xx) not in seen:
                    seen.add((yy, xx))
                    stack.append((yy, xx))
        components.append(component)
    if not components:
        raise ValueError('Empty foreground after keying/downsampling')
    largest = max(components, key=len)
    removed = 0
    for component in components:
        if component is not largest and len(component) <= 2:
            for point in component:
                alpha[point] = False
            removed += len(component)
    return removed


def prepare(path: Path) -> tuple[np.ndarray, np.ndarray, dict]:
    with Image.open(path) as source:
        if source.size != SOURCE_SIZE:
            raise ValueError(f'{path.name}: source must be {SOURCE_SIZE}, got {source.size}')
        rgb = np.array(source.convert('RGB'), dtype=np.int16)
    corners = (rgb[:32, :32], rgb[:32, -32:], rgb[-32:, :32], rgb[-32:, -32:])
    deltas = [float(np.abs(corner.mean(axis=(0, 1)) - KEY_COLOR).max()) for corner in corners]
    if any(delta > 60 for delta in deltas):
        raise ValueError(f'{path.name}: source corner/key gate failed: {deltas}')
    keyed = (np.abs(rgb - KEY_COLOR).max(axis=2) <= 60) | (np.minimum(rgb[:, :, 0], rgb[:, :, 2]) - rgb[:, :, 1] > 30)
    alpha = ~keyed
    x0, y0, x1, y1 = CROP
    rgb, alpha = rgb[y0:y1, x0:x1], alpha[y0:y1, x0:x1]
    upper = int(alpha.shape[0] * .8)
    edges = [int(alpha[0].sum()), int(alpha[:upper, 0].sum()), int(alpha[:upper, -1].sum())]
    if any(count > 2 for count in edges):
        raise ValueError(f'{path.name}: source crop clips head/prop: {edges}')
    # BOX filtering is applied to premultiplied float planes, then undone.
    a = alpha.astype(np.float32)
    small_alpha = np.array(Image.fromarray(a).resize(TARGET_SIZE, Image.Resampling.BOX))
    channels = []
    for channel in range(3):
        premultiplied = rgb[:, :, channel].astype(np.float32) * a
        small = np.array(Image.fromarray(premultiplied).resize(TARGET_SIZE, Image.Resampling.BOX))
        channels.append(np.divide(small, small_alpha, out=np.zeros_like(small), where=small_alpha > 0))
    pixels = np.stack(channels, axis=2).round().clip(0, 255).astype(np.uint8)
    opaque = small_alpha >= (128 / 255)
    removed = remove_specks(opaque)
    return pixels, opaque, {'source': str(path.resolve()), 'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                            'sourceSize': list(SOURCE_SIZE), 'sourceCornerMaxChannelDeltas': deltas,
                            'sourceCropEdgesOpaque': edges, 'removedSpeckPixels': removed}


def make_palette(prepared: list, size: int) -> np.ndarray:
    all_pixels = np.concatenate([rgb[alpha] for rgb, alpha, _ in prepared])
    strip = Image.fromarray(all_pixels.reshape(1, -1, 3), 'RGB')
    quantized = strip.quantize(colors=size, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    used = sorted(index for _, index in quantized.getcolors())
    palette = np.array(quantized.getpalette(), dtype=np.uint8).reshape(-1, 3)[used]
    if len(palette) != size:
        raise ValueError(f'Median-cut produced {len(palette)}, expected {size} shared colours')
    palette = palette[np.argsort(luminance(palette), kind='stable')]
    red, green, blue = palette.astype(np.int16).T
    if np.any((np.minimum(red, blue) - green > 30) & (red > 150)):
        raise ValueError('Shared palette contains key-colour contamination')
    return palette


def measure(rgb: np.ndarray, mask: np.ndarray, png: bytes, palette: np.ndarray) -> dict:
    padded = np.pad(mask, 1, constant_values=False)
    boundary = mask & ~(padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:])
    light = luminance(rgb[boundary])
    bg = float(luminance(np.array(BACKGROUND)))
    contrast = (np.maximum(light, bg) + .05) / (np.minimum(light, bg) + .05)
    rows = np.flatnonzero(mask.sum(axis=1) >= 3)
    upper = int(TARGET_SIZE[1] * .8)
    allowed = {tuple(color) for color in palette.tolist()}
    return {'headTopRow': int(rows[0]) if len(rows) else None, 'opaqueCoverage': float(mask.mean()),
            'cornersTransparent': not bool(mask[0, 0] or mask[0, -1] or mask[-1, 0] or mask[-1, -1]),
            'topRowOpaque': int(mask[0].sum()), 'upperSideOpaque': [int(mask[:upper, 0].sum()), int(mask[:upper, -1].sum())],
            'outlineContrastMedian': float(np.median(contrast)), 'outlineBoundaryPixels': int(boundary.sum()),
            'paletteOutOfBounds': sum(tuple(color) not in allowed for color in rgb[mask].tolist()),
            'bytes': len(png), 'sha256': hashlib.sha256(png).hexdigest()}


def run(paths: list[Path], out: Path, evidence: Path, colors: int = 24) -> dict:
    # All raw gates are checked before writing a candidate set.
    prepared = [prepare(path) for path in paths]
    palette = make_palette(prepared, colors)
    out.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)
    (out / 'palette.json').write_text(json.dumps(['#%02x%02x%02x' % tuple(color) for color in palette], indent=2) + '\n')
    report = {'pipeline': 'phase6b1a-12.5', 'paletteColors': colors, 'portraits': {}, 'failures': []}
    previews = []
    for name, (pixels, mask, source_info) in zip(NAMES, prepared, strict=True):
        distance = np.abs(pixels.astype(np.int16)[:, :, None, :] - palette.astype(np.int16)).sum(axis=3)
        index = np.where(mask, np.argmin(distance, axis=2) + 1, 0).astype(np.uint8)
        indexed = Image.fromarray(index, 'P')
        indexed.putpalette([0, 0, 0] + palette.reshape(-1).tolist())
        # One explicit transparent entry, all remaining entries implicitly opaque.
        # Let Pillow infer 8 bits from 25/33 entries: forcing bits=8 pads PLTE to 256.
        indexed.save(out / (name + '.png'), optimize=True, transparency=bytes([0]))
        # save() does not attach tRNS to the in-memory image; reopen the actual PNG
        # so contact sheets composite transparent index 0 onto BACKGROUND, not black.
        with Image.open(out / (name + '.png')) as saved:
            final = saved.convert('RGBA')
        metrics = measure(np.array(final)[:, :, :3], mask, (out / (name + '.png')).read_bytes(), palette)
        report['portraits'][name] = {**source_info, **metrics}
        tests = {'headTopRow': 3 <= metrics['headTopRow'] <= 12,
                 'coverage': .35 <= metrics['opaqueCoverage'] <= .75,
                 'corners': metrics['cornersTransparent'], 'topEdge': metrics['topRowOpaque'] <= 2,
                 'sideEdges': max(metrics['upperSideOpaque']) <= 2,
                 'outlineContrast': metrics['outlineContrastMedian'] >= 1.5,
                 'size': metrics['bytes'] <= 4096, 'palette': metrics['paletteOutOfBounds'] == 0}
        report['failures'].extend(f'{name}:{check}' for check, passed in tests.items() if not passed)
        background = Image.new('RGBA', TARGET_SIZE, (*BACKGROUND, 255))
        background.alpha_composite(final)
        previews.append(background.convert('RGB'))
    heads = [entry['headTopRow'] for entry in report['portraits'].values()]
    report['headTopRange'] = max(heads) - min(heads)
    report['totalBytes'] = sum(entry['bytes'] for entry in report['portraits'].values())
    if report['headTopRange'] > 4:
        report['failures'].append('set:headTopRange')
    if report['totalBytes'] > 12288:
        report['failures'].append('set:totalBytes')
    for scale in (1, 5, 8):
        sheet = Image.new('RGB', ((48 * 3 + 8 * 2) * scale, 64 * scale), BACKGROUND)
        for position, preview in enumerate(previews):
            sheet.paste(preview.resize((48 * scale, 64 * scale), Image.Resampling.NEAREST), (position * 56 * scale, 0))
        sheet.save(evidence / f'contact-{scale}x.png')
    (evidence / 'measurements.json').write_text(json.dumps(report, indent=2) + '\n')
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources', type=Path, nargs=3, metavar='SOURCE')
    parser.add_argument('--out', type=Path, required=True, help='Candidate PNG/palette directory (stage outside repository)')
    parser.add_argument('--evidence', type=Path, required=True, help='Outside-repository measurements/contact sheets')
    parser.add_argument('--colors', type=int, choices=(24, 32), default=24,
                        help='32 is permitted only for the single documented D-22 quality escalation')
    args = parser.parse_args()
    try:
        report = run(args.sources, args.out, args.evidence, args.colors)
    except ValueError as error:
        parser.exit(1, str(error) + '\n')
    print(json.dumps(report, indent=2))
    if report['failures']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
