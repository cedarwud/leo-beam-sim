# Codex server prompt — finish the six classroom experiments

You are the controller, implementer, and reviewer in the current
`leo-beam-sim` repository. The only product goal is to make the six T1–T6
experiments used in the upcoming class operate reliably from start to finish.
Do not expand the simulator beyond what those six exercises consume.

## Read first

1. `docs/handoff/HANDOFF-t1-t6-classroom-server-2026-08-07.md`
2. `docs/handoff/T1-T6-LAB-GUIDE-2026-08-07.md`
3. `docs/handoff/T1-T6-FIELD-COVERAGE-2026-08-07.md`
4. `docs/handoff/T1-T6-ACTUAL-VALUE-EXAMPLES-2026-08-07.md`
5. `docs/handoff/FORMULA-CONSUMER-MANIFEST-2026-08-07.md`

Inspect `git status`, `git log -3`, the current source, and the actual package
scripts before editing. The handoff files are requirements and prior evidence,
not proof that the server checkout currently passes.

## Required result

From a fresh start, a learner can complete T1–T6 using only visible labels and
the lab guide. Every named control exists and is enabled; every worksheet field
has a visible value or an explicit unavailability reason; restart and recovery
work; records export to JSON and CSV; no NaN, Infinity, stale value, unexplained
blank, or fabricated number reaches the learner-facing UI.

Use one small typed experiment-record path shared by the six tasks. Each record
needs a stable run/window identity, scenario/profile, start/end/duration,
changed and unchanged controls, producer status, absence reason, and the exact
task observations. Derived values stay read-only. Values must come from the
actual producer/runtime path or a clearly identified deterministic fixture; do
not hard-code the expected conclusion.

## Six acceptance dry-runs

1. **T1 complete power chain** — change one power control and show unit-correct
   RF output, PA input, circuit power, and total power whose rows add up.
2. **T2 component and event effects** — run baseline plus PA-efficiency,
   circuit-power, and handover-energy variants with exactly one changed input per
   arm. Record controls, power, radio/handover/total energy, handover count,
   Run EE, and low-SINR ratio. Keep the handover count comparable across the
   handover-cost arms.
3. **T3 conditional B/K comparison** — A/B/C use fixed `U=1` and `SINR=0 dB`;
   A→B changes only K and A→C changes only B. Record B, K, U, SINR, rate, data,
   serving satellite/cell/beam, and producer status. Transmit power is not a
   causal or worksheet field for T3 and must not be reintroduced.
4. **T4 reset ownership** — restart-measurement clears only the measurement and
   evaluation window. Restore-defaults restores PA efficiency, circuit power,
   and handover energy. Record before/after parameters, data/energy, window,
   simulation clock, playback state, and scene identity to prove unrelated state
   is preserved.
5. **T5 power-reduction falsifier** — repeat 50 dBm versus 35 dBm in the same
   service context and retain raw U/SINR/throughput/service evidence. The current
   observed aggregate says energy falls but delivered data falls faster, so Run
   EE also falls. If a clean rerun does not reproduce a meaningful result, stop
   and recommend removing the experiment instead of manufacturing one.
6. **T6 canonical system EE** — show producer status, P_sys, instantaneous EE,
   per-user serving identity and contribution, contribution sum, identity
   PASS/FAIL, ratio-of-sums EE, sample/window state, serving beam, and separately
   sourced actual versus rated RF power. A zero-duration first sample is `—`; a
   positive-duration sample becomes valid.

Low-SINR remains the strict finite-sample ratio below 14 dB. No finite samples
means `—`, not 0%. Keep Teaching Run EE and canonical instantaneous/evaluation
EE explicitly separate.

## Scope and autonomy

This is non-heavy implementation. Do not start training, sweeps, or long
rollouts. Use parallel workers only for non-overlapping files; keep one owner for
the shared record/export schema. Preserve unrelated work and do not reset,
restore, stash, or mass-delete. Do not edit course PPTX or speaker notes. Do not
add a backend, accounts, database, telemetry service, or digital twin. Act on
safe in-scope implementation without asking; ask only when a real product choice
would change an experiment's purpose.

There is one known pre-existing governance red gate in the checkpoint:
`validate-frontend-scene-lane-governance` expects the retired literal
`absoluteTargetSec = liveTimelineWindowStartSec + target` in `App.tsx`. Reconcile
the assertion with the current timeline authority; do not restore obsolete code
merely to satisfy a string check, and do not weaken the gate without evidence.

The integration checkpoint also has one immediate build blocker:
`src/teaching/experimentRecord.test.ts` and
`src/ui/info-panel/ExperimentRecordCard.test.tsx` import `vitest`, but this
package does not currently declare that dependency. Therefore `npm run lint`
and `npm run build` stop on TS2307. Resolve this first by converting the two
focused tests to the repository's existing `node:test` style unless Vitest is
already an intentional project dependency; do not add a dependency only to hide
the mismatch.

## Verification

Begin with `npm ci` if dependencies are absent. At minimum run:

```bash
node --import tsx/esm src/teaching/energyModel.test.ts
node --import tsx/esm src/teaching/energyLedger.test.ts
node --import tsx/esm src/teaching/beamshiftCanonicalEe.test.ts
node --import tsx/esm src/teaching/energyComparison.test.ts
node --import tsx/esm src/teaching/experimentRecord.test.ts
node --import tsx/esm src/scene/useSimStatePublisher.test.ts
node --import tsx/esm src/ui/info-panel/TeachingEnergyCard.test.tsx
node --import tsx/esm src/ui/signal-tuning/EnergyTab.test.tsx
npm run lint
npm run build
```

Add focused tests for every new field and export mapping. Use a headless browser
on the server to execute all six dry-runs and retain screenshots plus exported
records. If browser dependencies are genuinely unavailable, complete source,
tests, and build, then write an exact pending local-GUI checklist; do not call a
server build visual or classroom acceptance.

## Done and stop

Report a T1–T6 matrix with: operation, actual producer, visible consumer,
record/export field, focused test, browser evidence, and remaining blocker. Done
means all six guided dry-runs pass and their records can be used to fill the
classroom worksheets without improvisation. Stop immediately at that point; do
not continue general polish. If real data falsifies an experiment's purpose,
report it immediately and stop that task. Do not push unless the owner asks.
