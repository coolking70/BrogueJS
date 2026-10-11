# combat2 acceptance evidence and draft handoff

Original candidate: ad05458; dispatch 5782e73; shared baseline 59b9ba6.
No changes to original production/tests. The archive copy `tree/` is disposable.

## New fixes for a separately authorized foundation step

- `sdk1-generation-identity.patch`: checkpoint retained actor-action ledger identity at generation begin; restore it on generation rollback. Reuses the existing identity checkpoint used by ordinary transactions. No codec relaxation.
- `sdk2-growth-death-projection.patch`: project live ActorFacts into the existing ten-field pending death DTO. No growth state schema change; no lost death/origin/reward; unknown persisted actor fields stay rejected.
- `sdk-regression.draft.ts`: copy to a disposable checkout root as `acceptance.test.ts`; use `tree/acceptance.config.ts`. Contains two minimal cases, original public seed23/118 scenarios, and a separate VISIBILITY cadence case. Natural cases reuse committed combat2 input fixtures and helper; formal foundation tests should relocate minimal cases to registered foundation/growth test owners without importing optional combat tests.

Node environment:

```sh
export PATH=/Users/coolking70/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export NODE_OPTIONS=--max-old-space-size=3072
node node_modules/vitest/vitest.mjs run --config acceptance.config.ts -t 'MRE|public seed' --maxWorkers=1 --no-file-parallelism
```

Actual evidence:
- `mre-base-before.log`: two minimal cases fail with real old combat definitions from 59b9ba6; other two cases filtered.
- `mre-base-after.log`: same old definitions, both minimal cases pass with SDK1+2 drafts; other two filtered.
- `patch-public.log`: current combat2 definitions + SDK1+2 drafts; all four minimal/public cases pass, including actual save load and full snapshot equality for seeds23/118.
- `diagnostic.log`: original public cases fail; instrumented rollback reports blueprint abort and stale session state; growth reports movementRegionId=61 in a rejected pending kill of ridgeback id62. Instrumentation was removed before patch tests.
- `patch-regressions.log`: related existing files on SDK1+2 draft copy only; final counts are in log/report.

Draft limitations: minimal identity test is a diagnostic native transaction, not a replacement for natural public seed23. Minimal growth case invokes the actual module hook with a bounded fake context and original strict validator; public seed118 separately proves production reachability. Formal author must cover nested rollback ownership, corpse/reward/region cases, generation cost and complete impacted gates. No claim these drafts are fully reviewed integration fixes.

## Already authorized VISIBILITY scope

`visibility-causality-only.patch` removes the no-flare early return from finishTransientDisplay. It is a one-variable diagnosis, not a complete proposed implementation or approval to duplicate the ongoing repair.
`visibility-before.log`: one complete snapshot comparison fails; `visibility-after.log`: all five cases pass with the extra diagnostic change. The final draft tree has this Game.ts diagnostic reverted before SDK-only regressions.
The three `seek-*-diff.json` enumerate all differences from original complete expected/actual objects. Raw snapshots are outside the repository in /tmp/combat2-evidence/persistence/. No fields were omitted, tolerances changed, or existing captures rewritten.

## Dot-owned premise repair

`bonfire-premise.patch`: only replace diagnostic jackal with unmapped wraith. All original terminal native-hit/heal interruption assertions stay unchanged.
`bonfire-data-rollback.log`: original test passes when only definitions.json is reverted to 59b9ba6.
`bonfire-premise-draft.log`: current definitions with the one-species premise edit passes.
Each run has one selected passing case and 48 name-filtered cases, not source skips.
The first attempts were blocked before execution by an unregistered root diagnostic test; preserved as `*-startup.log`. Moving that temporary diagnostic out of the discovery pattern fixed setup; no guard was weakened.

## Original candidate gates

`commands.json`, `results.jsonl` and boundary/types/build/combat/regressions/drift.log record exact original candidate commands, exits, durations. All test batches used maxWorkers=1 and no-file-parallelism. No capture flags were enabled. Full combat includes old64 combinations; 128, physical deletions and full npm/test:ext/CE suites were not run.

## Additional shared fixture attribution and draft checks

The SDK-only 5-file regression batch passed 48 / failed 2. Both failures are `giants2_foundation` SDK02 diagnostic jackal fixtures (animated false/true), whose native callback is preempted by the new jackal phased binding.
- `clock-original.log`: original shared production + current data reproduces both failures, excluding draft-induced regression.
- `clock-data-rollback.log`: only current definitions reverted to real 59b9ba6; both original cases pass.
- `clock-premise-draft.log`: current definitions + original shared production + jackal-to-wraith fixture-only change; both pass with all assertions preserved.
- `giants2-clock-premise.patch`: the one-line fixture-only draft, outside dot's allowed production/test scope.
- `foundation-patched-premise.log`: SDK1+2 drafts + corrected fixture, all 15 foundation tests pass. The other four files' 35 passing tests are from the initial batch; this is not one new 50/50 batch.
- `patch-types.log`: SDK1+2 vue-tsc -b, exit0 with empty output.

All temporary fixture edits were restored after counterfactual runs. The `tree/` production difference is SDK1+2 only; the root diagnostic draft is named `acceptance.probe.ts` to avoid unregistered normal suite discovery. To run it with the custom config, copy `sdk-regression.draft.ts` to `tree/acceptance.test.ts`, run the command above, and remove/rename it before normal-config regression runs.
Final review: original repository only gains docs/ext/combat2.acceptance.md. No git commit or p5 access.
