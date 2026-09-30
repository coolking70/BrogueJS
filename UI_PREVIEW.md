# BrogueJS playable UI studies — second round

> Branch handoff (2026-09-30): this branch carries the deployed v10 preview back
> into the original repository. See [the Chinese handoff](docs/UI_LAB_HANDOFF.md)
> for final scope, validation and local testing. The stage-by-stage notes below
> describe the historical UI/map work; v10 also changes Monster search memoization,
> documented in [the follow-up report](docs/reports/ui-monster-search-performance.md).

Isolated preview based on coolking70/BrogueJS at ee51a1197ba827dbaaa2b96fe9014b6667287037.

The first-round visual treatments have been replaced completely. Internal query IDs remain stable for existing links:

- `?concept=classic`: 玄石圣所 / Obsidian Reliquary. Original dungeon painting, engraved gold title, charcoal/brass left-hand journal and framed map.
- `?concept=tactical`: 荧渊 / The Verdant Abyss. Original jewel-toned cavern art, crystal-green game menu, wide map, suspended HUD, separate message and action rails, full details drawer.
- `?concept=immersive`: 蚀刻远征 / The Cartographer. Original woodcut artwork, parchment/vermilion title, black-map/ivory-ledger layout, ink-dark knowledge overlays.

The title screen has real New Game, Continue, Save Management, Recording, and Display Settings submenus. Continue reflects browser-local save availability. The existing mode, seed, save, recording import/export and display-preference implementations are preserved. Menu opening interrupts auto-travel through the existing command boundary and pauses recording playback; modal keyboard routing prevents background moves.

All variants share the same game instance, canvas, map glyphs, command paths and origin-local saves. Switching themes does not remount the canvas. No engine, entity, game data, RNG, save format, or original upstream repository changes.

Original generated art files are in `public/art`, with exact generation prompts in `provenance.json`. These are finished game assets, not screenshots. No image-generation code or service is needed at runtime.

Development: `npm ci; npm run dev`. Production: `npm run build`.

AGPL source download is available through the small interface-style information panel, linked to this branch’s GitHub source archive. Dependencies, Site identity, generated archives and build output are not committed. Browser saves are origin-local; the public preview, localhost and GitHub Pages do not automatically share saves.

## Validation

Production type check/build passed. Focused frontend, menu, i18n, repository hygiene and rendering suite: 9 files / 86 tests passed. Terrain catalog source guards passed in an earlier unchanged-engine run. No engine baseline regeneration.

Live cloud-browser review confirmed all three generated-art title screens, normal seeded-game start, keyboard movement, same-run theme switching, readable woodcut inventory, and real menus. Sidebar entity-section shrinking found in live review was corrected. Portrait/touch layouts received source review and focused frontend tests; a separate mobile browser viewport was not available.


## Map replacement studies (2026-09-30)

Same-run map selection is independent from the three interface concepts. Original
restores the baseline Latin layout. Refined ASCII centers the monospace glyphs,
reduces entity bloom and gently tones only neutral terrain colors. Hanzi uses an
embedded 76 KB subset of Noto Sans CJK SC, square cells and centered 13.5 px type.
Vector tiles use original geometric terrain/item icons and small Hanzi monster
nameplates, with an unmistakable gold player silhouette.

The localized table covers every 208 terrain identities, 67 catalog monsters, all
13 item categories, player clones and spectral images. Player is 我. Hidden doors,
traps and dormant mechanisms keep their ordinary wall/floor disguises. The adapter
runs after Appearance visibility and color selection, reads remembered snapshots
for unseen cells, retains magic-location markers, and never resolves real identity
during hallucination. Unknown glyphs deterministically become 异 (unknown monster:
兽; unknown item: 物). Modern gas remains the original colored overlay. Damage and
status floating text remain annotations with their amounts/full wording intact.
No engine, entity or gameplay catalog was changed; RNG and command boundaries are
untouched. Original engine baseline remains ee51a1197ba827dbaaa2b96fe9014b6667287037.

The searchable glyph legend explains collisions: a single character describes a
category, while original colors, status colors and right-click/long-press inspection
retain distinctions. The vector mode is intentionally a hybrid, not a painted
sprite atlas: creatures retain labels for legibility. Hanzi and vector modes force
square map geometry even when the original display preference is stretched.

Focused validation: 131 tests passed across new mapping/visibility/rendering checks,
Appearance, existing UI render/theme/touch tests, i18n and source-hygiene guards.
The terrain production-reader guard was run separately; its unchanged large
15-seed generation survey was not needed. Production type check and build passed.

Live review found background-only shallow water needed its own 水 label and narrow
desktop maps needed readable follow-camera scaling in Hanzi/vector modes. Both
were corrected without changing visibility or water rules; Fit Map still restores
the whole-level view. Original and refined ASCII keep their existing camera.
