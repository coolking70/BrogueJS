# UI map performance investigation (2026-09-30)

This report covers the renderer-only phase through Site v9. The subsequent
engine search-cache work is recorded in [the follow-up](ui-monster-search-performance.md).

## Scope and result

Isolated public Brogue UI Site only. Engine, entities, data, rules, path order, RNG,
recording format and five-ticker auto-step cadence are unchanged from the source
base. Original repository and user-device files were not edited.

The v7 vector renderer recreated and triangulated every visible/remembered shape
at every light/animation refresh. Retain white vector geometry, tint with the
exact current engine color, reuse flat background quads, and coalesce multiple
canvas requests into the next single presented frame. Geometry is vector (no
bitmap/DPR cache). Black cutouts, alpha, path geometry, per-cell overlap order,
visibility gates, memory and hallucinated silhouettes are preserved. The cache
is keyed by the finite public silhouette catalog, not true hidden identities or
changing colors. Shared contexts and global white texture have explicit cleanup.

Pixi's automatic batching threshold is unsuitable for these wall/water shapes.
The cache explicitly uses batch mode. The real Pixi CPU assembly/packing probe
produces one batch and zero standalone graphics instructions for all three sizes.
This tests batch assembly, not actual GPU elapsed time.

## Repeatable CPU benchmark

Node v24.19.0, same synthetic tile mix and cycling colors before/after. 30 warmup
frames; 600 measured frames for 320/1200 tiles, 180 for oversized 3713-tile stress (actual map: 2291 tiles). The
final run was made after tests/build finished to avoid their CPU contention.
Times include CPU shape construction and actual Pixi tessellation. They exclude
engine work, browser layout, renderer packing/upload, and GPU drawing. These are
not Android FPS measurements. Run:

- node scripts/profile-retained-map.mjs /tmp/brogue-map-profile.json
- node scripts/check-retained-map-batches.mjs

| Tiles | Implementation | Samples | Median ms | p95 ms | Max ms | Cold frame ms | Tessellations incl. warmup |
|---:|---|---:|---:|---:|---:|---:|---:|
| 320 | v7-retessellated | 600 | 4.985 | 9.028 | 17.250 | 18.359 | 630 |
| 320 | retained | 600 | 0.224 | 0.499 | 16.677 | 10.041 | 7 |
| 1200 | v7-retessellated | 600 | 21.239 | 27.219 | 53.409 | 33.980 | 630 |
| 1200 | retained | 600 | 0.813 | 1.433 | 10.968 | 6.049 | 7 |
| 3713 | v7-retessellated | 180 | 75.235 | 100.199 | 112.930 | 76.929 | 210 |
| 3713 | retained | 180 | 2.952 | 4.327 | 6.055 | 11.032 | 7 |

Retained runs used seven shared geometry contexts throughout; no color-driven
cache growth. The all-catalog regression separately covers every authored icon.

## Live browser baseline

Cloud desktop Chrome, screenshot viewport 1180x756. Version 8 added diagnostics
only over v7; baseline code commit 4329783675afc12fde414c1b0b94a44c7ef6e4e2.
Normal seed 27027, D1, two Explore requests produced the same ten automatic
steps in original and vector modes: player (36,17), HP30, nutrition2140, twelve
recorded commands. Autoexplore stopped normally at an item and then a visible rat.

- Original: draw CPU median/p95/max 1.6/2.4/9.4ms; auto-frame 16.7/19.1/21.9ms
- Vector: draw CPU median/p95/max 2.5/3.5/24.2ms; auto-frame 16.7/18.4/30.8ms
- Small D1 remains near 60fps: a severe stall was not reproduced in this scene
- The callback draw measurement excludes Pixi's renderer work. The final optional
  profiler also reports renderer CPU submission, not GPU elapsed time
- Auto-step call timing is not comparable as engine speedup: baseline includes a
  synchronous canvas callback, while the optimized callback queues one final draw
- Android hardware, natural deep-floor long play, and GPU time were not measured

Use ?profile=1 to show an opt-in local timing panel, with a reset button. It is
absent by default, records bounded buffers, and does not send/store telemetry.
Live verification of the final deployment is recorded in the delivery report.

## Engine tail found during the renderer phase

A read-only Node probe reproduced seed33008 D3 auto_step turn315→316 at 74.4ms
uninstrumented and approximately 80–102ms instrumented. Three unreachable monster
A* searches made about 6600 passability checks apiece and cost about 20–21ms each.
Autoexploration BFS was only 1.83ms and final update 2.25ms in the initial sample.
This is existing engine code, byte-identical to the original ee51a11 source.

Across 1326 real commands (1168 turns, seeds 27027/33008, D1/D3/D4/D5), auto-step
inclusive p50/p95/max was 10.17/19.75/102.41ms. A separate 331–349ms D5 wait caused
a fall/new-floor setup, so is not a routine-walking measurement. Floors were
naturally generated but entered synthetically; HP 10000 was a survival fixture.
The instrumented/uninstrumented runs matched all command actions, positions,
turns, HP, monster counts, both RNG streams and eight final checkpoints.

The vector fix removes repeated drawing overhead; it does not claim to fix these
engine stalls. The subsequent search-local cache addresses this identified
hotspot with exact path/order/RNG/replay guards; see the follow-up report. It
does not change gameplay frequency or claim all mobile/deep-floor stutter is gone.

## Verification

- Build and TypeScript check passed
- Focused frontend/display/input/cadence/appearance tests: 16 files, 161 tests passed
- Terrain production-reader source whitelist: 1 test passed (29 intentionally not selected)
- New cache tests cover full atlas paths/alpha/tint, finite cache, hidden/memory/
  hallucination boundaries, repeated updates, zoom/size changes, interleaved paint
  order, absent actors/bolts, shared texture/context cleanup, and draw coalescing
- New same-seed test: 60 real commands with extra direct vs coalesced display draws
  have identical recordings, every world checkpoint, both RNG streams and final
  terrain/visibility/memory; optimized path makes 60 draws rather than repeated ones
- Pixi pipeline aggregation passed at 320/1200/3713 tiles, all one batch
- No full engine or CE suite run: no engine production file changed
- CE reference source absent; CE-specific checks were not claimed
- Existing P2-6 F1 source guard did not match v7's layout ternary (confirmed against
  c62e9abd). Restored its direct settings call, then applied the same uniform-only
  override for Hanzi/vector maps. Behavior unchanged; existing test unchanged
