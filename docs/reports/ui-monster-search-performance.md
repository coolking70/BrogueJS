# Search-local monster passability cache (2026-09-30)

## Scope

This is a follow-up to the isolated UI Site's renderer fix, not a change to the
original repository. Baseline Site source: 77c0f715a0a8cc1c6494674649e6ffa60b4875c5.
Only the two player-target A* call sites in Monster and a private helper change
production behavior implementation. Generic Pathfind and its existing stable
heap remain untouched; the earlier UX-1E heap improvement is not repeated here.

The target is seed 33008, D3, auto_step turn 315→316, where three unreachable
monster searches repeatedly evaluate expensive movement/avoidance predicates.

## Equivalence argument

Both existing predicates are kept verbatim. Their complete reachable chain reads
terrain/catalog flags, occupancy (including pending-death occupants), origin,
player position, statuses, behavior/ability Sets, HP, allegiance and pack links.
There is no RNG, logger/event dispatch, asynchronous boundary, reentrant gameplay
hook or mutation during a synchronous search. Therefore each coordinate has one
answer for that invocation. Unknown/allowed/blocked are distinct cache states;
failed queries are cached too, and the first evaluation stays lazy.

The table is newly allocated per invocation and discarded on return, before any
movement. No result crosses a monster, turn, path, floor, status change or terrain
change. It is not a persistent Game field and does not enter a save/recording.

A* still issues every query in its original order and receives the same answer.
Goal precheck, occupied origin, eight-way/corner behavior, 1.414 diagonal cost,
heuristic, strict g improvement, tie/reopening order and complete returned paths
are unchanged. No visitation cutoff is introduced. Catalog errors from the first
query still propagate. Generic callbacks may remain stateful; only these two
proven read-only monster predicates are memoized.

## Behavioral evidence

The repeatable script is `node scripts/profile-monster-search.mjs`.
It runs real executeCommand/update steps on seeds 27027 and 33008 at D1/D3/D4/D5.
Floors are naturally generated but entered synthetically, and HP 10000 is the
existing survival fixture. This is not an uninterrupted natural playthrough.

- 1326 command actions, positions, HP/nutrition, monster states, both RNG streams
  and recorded events match the direct uncached adapter
- All 204 complete A* paths and coordinate/result query-order hashes match
- Eight complete world-snapshot hashes match; savedAt alone is normalized
- Before and after the problematic step, complete world snapshots match
- A separate prototype recomputed every cached hit and found zero unstable answers
- Underlying expensive predicate reads fall from 70244 to 18340 across these paths;
  the A* query count and order itself does not change
- New unit tests compare both predicates for every catalog species, open/barrier/
  corner maps, water/web/secret/fire/corridor cases, and changes between calls to
  terrain, occupants/death state, status/immunity, position and allegiance
- The unchanged generic dynamic-callback and legacy path-order oracle still passes

## Same-checkpoint timing

Node v24.19.0; alternate baseline and optimized order, three warmup pairs, twenty
measured pairs. Snapshot restoration and complete resulting-world hashing happen
outside the timed real command+update interval. No renderer is attached. Every
resulting full-world hash is identical. Times are milliseconds, not Android FPS.

| Variant | Median | p95 | Max |
|---|---:|---:|---:|
| Direct original predicate |103.694|120.943|121.219|
| Search-local memoization |40.949|50.178|65.425|

This substantially reduces the identified spike; it does not make every command
fit a 16.7ms frame or establish that all natural deep-floor/Android stutter is gone.
Renderer, other engine/environment spikes and the frame-count movement cadence
remain distinct concerns. Monster action frequency and gameplay rules are not
reduced to obtain this result.

## Gate requirements

Build and focused tests passed. The pinned CE reference was fetched and verified:
legacy 49be8dd3fc1b9a0fb477df4c9153c0e1cf796fe9. The full CE-inclusive aggregate, drift and targeted revalidation are complete,
with the exact outcomes below. Source/test inputs were fingerprinted across the run.

### Aggregate run and pre-existing UI fixtures

The CE-inclusive aggregate ran for 4792.73s on unchanged source/test inputs. It
reported 4576 passed checks, six failed checks in two old UI fixtures, eight
historical skips and five todos. One worker exited unexpectedly; B2 transcription
was the only file without completed checks. Drift then passed in 51.31s. This is
not described as a clean aggregate pass.

Both UI failures were proved independently in a temporary copy of Site v9:

- X3-U5: unchanged test fails; replacing only CommandBar with the original
  ee51a119 component passes 7/7. Its host lacked document event methods, and the
  intentional command-bar redesign put secondary actions under More. Adding the
  host methods and opening More through its real handler passes 7/7 without
  changing any original assertion
- X4a: unchanged inline-source guard fails; replacing only GameCanvas with the
  original component passes. Normalization moved into the shared paintMapText
  helper during the earlier map-mode refactor. The updated guard traces terrain,
  entity and bolt delegation, checks the shared normalization path, and executes
  actual original/refined text painting for every terrain/monster glyph. Floating
  text, cancellation, obsolete-key and engine-command assertions stay intact.
  All 21 X4a checks pass

The running aggregate was not edited. After its terminal result, these two
fixture-only updates were integrated and the actual final checkout's 28 affected
checks passed under BROGUE_REQUIRE_CE=1. No production source changed after the
aggregate started. Its B2 census was retried alone; the resource diagnosis and terminal result
are recorded below. The complete aggregate is not rerun for
these fixture-only repairs; results are reported as an aggregate plus targeted
revalidation, not a newly clean single command.


### Final resource retry and outcome

The first isolated B2 retry exhausted the default approximately 2GB JavaScript
heap after 398.25s, explicitly reporting `JavaScript heap out of memory`. It did
not report a failed gameplay assertion. About 6.6GB system memory was available.
The same unchanged 21-test file then passed in 480.72s with this process-only limit:

```
NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--max-old-space-size=4096" BROGUE_REQUIRE_CE=1 npx vitest run src/test/b2_transcription.test.ts --maxWorkers=1 --no-file-parallelism --reporter=verbose
```

Runtime: Node v24.19.0. No test timeout, seed, iteration count, assertion or
production code was changed for this retry. The final source/test fingerprint
delta from the immutable aggregate contains only the two documented UI fixtures.
All 254 full-collection files ultimately have passing results across the aggregate
and targeted revalidation: 4603 distinct executable checks, eight historical skips,
five todos. Generation drift passed separately. Do not describe this as one clean
rerun of the complete aggregate. Final build/typecheck passed after the fixture-only changes
(`vue-tsc -b` and Vite production build).

Machine-readable timing and equivalence evidence is retained in
`ui-monster-search-metrics.json`; the repeatable benchmark script regenerates it.
