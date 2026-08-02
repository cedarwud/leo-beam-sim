# Producer Dispatch — two consolidated asks (2026-08-02)

**From:** `leo-beam-sim` (consumer). **To:** `modqn-paper-reproduction` (producer).
**Why one file:** both asks were already written up separately at different times and
neither has been dispatched. Sending them together avoids a second round-trip.

**Boundary (binding, CLAUDE.md §5 #1):** leo is a READ-ONLY consumer of producer
artifacts. Nothing in this file edits, retrains, or re-evaluates anything in
`modqn-paper-reproduction`. These are requests for the producer to run on the
producer's own machine.

**Verification status of this file:** the two asks below were re-checked against the
live leo tree on 2026-08-02 and both still hold — the workaround for A is still in
the code, and the gap list for B was dumped from the running source-gap model, not
copied from an older doc. What was NOT re-checked: whether the producer has already
fixed either one on its side (leo cannot see the producer's tree).

---

## Ask A — re-emit the dense-Q **window** `provenance-map.json` (LIGHT)

Full brief already written: [`producer-provenance-map-window-fix-request.md`](./producer-provenance-map-window-fix-request.md).
Nothing in it has changed; this is a pointer plus a freshness check.

- **Type:** re-emit ONE sidecar file for an EXISTING window export. No retrain, no re-eval.
- **Problem:** the dense-Q *window* export shipped a **251-byte stub** `provenance-map.json`
  (only a `timeline.stepTrace.policyDiagnostics` annotation — no `bundleSchemaVersion`,
  no `fields`). The Grade-1 standard export and the baseline both carry the full ~63-field
  map via `build_provenance_map(cfg, metadata)`.
- **Current leo workaround (verified still present 2026-08-02):**
  `src/modqn/replay-bundle/loader.ts` carries `tolerateProvenanceSchemaVersionAbsence`,
  a mode-scoped tolerance on the family-b path. The manifest's copy stays authoritative
  and strict, and a present-but-*wrong* version is still rejected.
- **What leo gets:** the tolerance can be deleted, so the schema-version check becomes
  uniformly strict again instead of having one lane-shaped hole in it.

## Ask B — export the fields that keep D6 replay cinema blocked

`docs/sdd-index.md` marks **D6 (MODQN Replay Handover Cinema)** blocked, and the
consumer side is already built and gated. It is waiting on producer data only.

Dumped from `createCurrentModqnReplayProofSourceGaps()` on 2026-08-02 — **13 current
gaps, of which 11 are `owner: modqn-paper-reproduction` + `reason: not-yet-exported`,
all `policy: fail-closed`** (fail-closed = leo renders nothing rather than guessing):

| field | claim it unblocks |
|---|---|
| `beamHopping.activeSchedule` | beam-hopping animation |
| `beamHopping.nextSchedule` | next-beam preview |
| `timeline.sourceRowIdentity` | stable source-row proof |
| `timeline.focusUeSelection` | producer-chosen focus UE |
| `timeline.activeCellState` | active-cell state |
| `timeline.allUeServingHistory` | all-UE serving map (also the r3 load-balance proof) |
| `timeline.handoverPenaltyAttribution` | handover-penalty attribution |
| `metrics.angleAwareTerms` | angle-aware per-step claim |
| `metrics.energyEfficiencyTerms` | energy-efficiency per-step claim |
| `diagnostics.denseQPolicy` | dense-Q proof |
| `traffic.queueRows` | producer queue proof |

The remaining 2 are **not** "please export this" asks and should not be actioned blindly:

- `entities.satellites.trajectory` — `non-renderable-frame` (the frame is a
  no-earth-rotation proxy; exporting more of it does not make it renderable).
- `entities.beams.footprints` — `display-only-provenance`.

### Note for whoever scopes Ask B

`metrics.energyEfficiencyTerms` now has a **direct consumer**. As of 2026-08-02 leo
renders a live **r1 EE** readout beside the live SINR, computed with the reference's own
formula (`η = B_alloc·log₂(1+γ)/P_beam`, ported in `src/utils/energyEfficiency.ts` and
pinned against the producer's two-step credit by `validate:r1-energy-efficiency:model`).
That is the LIVE lane only. If the producer exports `energyEfficiencyTerms`, the replay
lane can show the same quantity from producer truth and a live-vs-replay comparison
becomes possible. **Today it cannot** — the live number is a leo-computed reward-surface
ratio and carries no producer-backed EE claim, which is exactly why the live claim
boundary still forbids `Catfish-EE`, `general EE-MODQN superiority`, `active-TX EE
recovery`, and `physical energy saving`.

If only part of Ask B can be delivered, `timeline.allUeServingHistory` is the highest
leverage single field: it is the intended producer source for the r3 load-balance proof,
which today has no producer-backed path at all (see `src/scene/beamLoadContention.ts`).

---

## Not in scope here

The **MODQN baseline non-reproduction** finding
([`modqn-baseline-collapse-diagnosis-brief.md`](./modqn-baseline-collapse-diagnosis-brief.md),
status DEFINITIVE Phase 1) is a research question about the paper's own formulation, not
a data-export request. It is deliberately NOT bundled into this dispatch — mixing a
"please re-emit a sidecar" ask with a "the published baseline does not reproduce" finding
would bury the latter.
