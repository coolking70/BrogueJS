# UI Site monster-search performance follow-up

2026-09-30. Baseline Site source:77c0f715a0a8cc1c6494674649e6ffa60b4875c5.
Original repository and user computer are out of scope.

Reproduction:seed33008, synthetic sequential floor generation and deterministic
autoexploration policy from the existing performance investigation, D3
turn315→316. Three unreachable monster searches repeatedly evaluate expensive
terrain/occupancy/avoidance predicates. The stable heap from UX-1E already exists;
do not replace it or claim its earlier optimization again.

Allowed production scope:the two Monster player-target A* calls and one private
per-invocation memoization helper. Generic Pathfind and PathFrontier remain
unchanged. The cache is local to one synchronous search, initialized unknown,
stores both accepted and rejected cells lazily, and is discarded before movement.

Correctness constraints:
- Keep original predicate ordering and initial goal check
- Same complete path, costs, neighbor order, tie/reopen behavior and termination
- No new visitation budget or diagonal/corner rule
- No caching between monsters, actions, searches, floors or status changes
- No RNG, events, logger, asynchronous hooks or gameplay mutation in a predicate
- Preserve occupancy including searching monster and pending-death occupants
- Exceptions on first evaluation propagate normally
- Stateful generic callbacks continue to work with the unmodified Pathfind API

Verification:prototype and production traces of all1326 commands and204 paths;
full path/query-result order, both RNG streams and world checkpoints. Alternating
same-checkpoint timings; invalidation and creature/terrain edge regressions.
Build, CE reference fetch, full CE-inclusive suite and drift are required before
publication. No baseline/trace/test weakening. Record any independent failure and
retest original production source as a counterfactual before touching a fixture.
