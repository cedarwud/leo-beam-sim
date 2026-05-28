# Phase D Training Visualization Mini-SDD

Status: draft for Phase D (post Phase B merge).
Date: 2026-05-25
Owner: `leo-beam-sim` consumer-side training-replay scene mode + reward / decision visualization.
Target repo: `/home/u24/papers/project/leo-beam-sim`.
Producer authority: `modqn-paper-reproduction/src/modqn_paper_reproduction/export/replay_bundle.py` (Phase 03A `phase-03a-replay-bundle-v1`).
Backend authority: `docs/modqn-training-trigger-backend-sdd.md` (B0–B4 shipped 2026-05-16 in modqn-paper-reproduction commit `41a0155`).
Phase A SDD: `docs/paper-faithful-mini-sdd.md`.
Phase B SDD: `docs/phase-b-training-pipeline-mini-sdd.md`.

## 0. Reading Order

Read before changing this SDD or starting any Phase D slice:

1. `.agent-memory/project_paper_faithful_vision.md` — user vision Phase D
   bullet: "training-replay scene mode (能播 phase-03a-replay-bundle-v1) +
   reward curve panel + Q-value / decision viz; 解鎖 PR-θ 已 stub 的
   Load-into-scene 真正生效".
2. `.agent-memory/project_modqn_vendor_deferred.md` — Phase 6W antenna
   pattern provenance gate. Phase D **does not** vendor live MODQN policy
   inference; replay-only.
3. `docs/phase-b-training-pipeline-mini-sdd.md` §12 + PR-θ deferral notes
   in commit `00f75c0`. Phase D unblocks the `Load-into-scene` stub.
4. `docs/modqn-omega-handover-sdd.md` §9.3 (S2 runtime fetch acceptance) —
   the runtime-fetch helper is reused for user-trained bundles.
5. `docs/modqn-training-trigger-backend-sdd.md` §6.4 (`GET /artifacts/<id>/<filename>`)
   — surface contract for user-trained bundle files.
6. `src/modqn/replay-bundle/types.ts` + `src/modqn/replay-bundle/loader.ts`
   — phase-03a-replay-bundle-v1 typed parser already exists.
7. `src/modqn/replay-bundle/replay-state.ts` lines 47–56 + `playback-shell.ts`
   lines 169–185 — the 1000-row / 10-slot / 4-sat / 918-event hardcoded
   expectations that Phase D must relax for user-trained replay.
8. `CLAUDE.md` §3 (artifact immutability) + §4 (vendor-on-demand rule).
   Phase D consumes bundles, never edits.

## 1. Purpose

Phase B landed the training trigger pipeline (form + jobs panel + artifact
picker) but explicitly deferred two things in PR-θ:

- "Actual scene playback of user-trained bundles is Phase D. PR-θ wires
  Load-into-scene as a selection-state transition (flips visible
  `user-trained` chip) but does NOT render the bundle into the scene."
- "MODQN bundle format is `phase-03a-replay-bundle-v1`; existing
  `loadShowcaseArtifact` consumes `visual-showcase-v1`, so a new render
  path is required and lives in Phase D."

Phase D ships the render path. After Phase D:

- The user finishes a training run in the MODQN-demo mode.
- The artifact picker shows the user-trained bundle with an amber
  `user-trained` chip.
- Clicking `Load into scene` fetches the bundle from the backend
  (`GET /artifacts/<jobId>/manifest.json` + `provenance-map.json` +
  `timeline/step-trace.jsonl` + optional `evaluation/summary.json`),
  parses it through the existing `phase-03a-replay-bundle-v1` loader,
  builds a playback envelope, and swaps it into the MODQN replay
  scene route in place of the startup-fetched Phase 7C producer bundle.
- A reward-curve panel shows per-slot scalarReward + the three
  rewardVector components (`r1Throughput`, `r2Handover`, `r3LoadBalance`).
- A decision-viz panel shows `policyDiagnostics.topCandidates[].scalarizedQ`
  and `denseActionScores` for the focused row, so the user can see *why*
  the policy picked that beam.

Phase D is replay-only. No live policy inference, no live PyTorch in
the browser. The user-trained bundle is itself the immutable artifact;
the scene displays it.

## 2. Authority and Boundaries

### 2.1 Owned by Phase D

- New user-trained bundle fetcher: backend-aware `GET /artifacts/<jobId>/...`
  wrapper around the existing `runtime-fetch.ts` Promise.all assembly.
- New "user-trained" mode key + label + evidence status. Distinct from
  the Phase 7C `modqn-replay-7beam` mode so the existing 4-sat producer
  baseline path is untouched.
- Relaxed shape validation: per-bundle `rowCount` / `slotCount` /
  `satelliteCount` / `eventCounts` read from the manifest, not hardcoded.
- App.tsx wire: `handleLoadIntoScene` now fetches, parses, builds the
  envelope, and replaces the scene's replay state.
- New `RewardCurvePanel` rendered in MODQN-demo right sidebar (next to
  `ModqnEvidenceTab`).
- New `DecisionVizPanel` rendered alongside the reward curve or as a
  sibling sub-tab.
- (Optional, stretch) `JobsPanel` running-job card shows per-episode
  progress derived from stdoutTail regex `episode \d+ / \d+`.

### 2.2 Not owned by Phase D

- Backend service. Backend changes go in `modqn-paper-reproduction`.
- Bundle schema. The producer owns `phase-03a-replay-bundle-v1`.
- Live MODQN policy inference. Phase 6W antenna-pattern provenance gate
  applies (see `.agent-memory/project_modqn_vendor_deferred.md`).
- Paper-faithful claim semantics. Any user-trained bundle's manifest
  carries `paperFaithful: false`; the UI only displays it.
- Scene tree. `MainScene` + scene-grammar stay shared between
  paper-faithful and user-trained replay; only the envelope swaps.
- Bundle schema validation. The existing `parseModqnReplayBundle` is the
  single source-of-truth parser. Phase D does NOT vendor a second parser.
- Visual-showcase-v1 bridge. Phase D directly consumes the
  `phase-03a-replay-bundle-v1` artifact via the backend; it does NOT
  detour through `visual-showcase-v1`.

### 2.3 Hard bans (PR-level, all Phase D slices)

- Do NOT edit `modqn-paper-reproduction`.
- Do NOT change `FOOTPRINT_RADIUS_WORLD`, `MainScene`, or any scene-tree
  file in a way that forks paper-faithful vs user-trained rendering.
- Do NOT relax the `MODQN_REPLAY_BUNDLE_SCHEMA_VERSION` or `MODQN_PAPER_ID`
  constants in `types.ts`. The schema is the contract.
- Do NOT mutate manifest / provenance / timeline JSON after parse.
- Do NOT bypass the amber `user-trained` chip on any user-trained render
  path (Phase B PR-θ §10.5 plus this phase).
- Do NOT introduce a live policy inference pathway (Phase 6W gate).
- Do NOT auto-load a user-trained bundle on startup. Load only on
  explicit `handleLoadIntoScene` click.
- Do NOT remove or weaken the existing Phase 7C 4-sat / 1000-row /
  10-slot validation for the `modqn-replay-7beam` mode. The relaxation
  is **opt-in** under the new user-trained mode only.

### 2.4 2026-05-27 Training Env Truth Mapping

When a user-trained artifact is loaded, the scene reads producer-owned
`run_metadata.json` first and falls back to the service manifest's
`trainingTruth.envAxes`. The frontend maps those values into display
profile/runtime state without changing producer semantics:

- `envAxes.nSatellites` is the total satellite count. The MODQN service-area
  display profile renders this as `planes = nSatellites` and
  `satsPerPlane = 1`; it must not be assigned to `satsPerPlane` on a
  pre-existing multi-plane profile, because that would multiply the training
  satellite count.
- `envAxes.altitudeKm`, `antenna.theta3dbDeg`, channel frequency/bandwidth/tx
  power, UE count, UE area, UE mobility, and mobility seed are applied to the
  local display profile only after artifact load.
- In MODQN mode, UE slot 0 is sampled from the training distribution just like
  the other UEs. SINR mode keeps the legacy observer-anchored primary UE so the
  two render paths remain isolated.
- `visualSatelliteAltitude` remains display-only framing. It does not rewrite
  `envAxes.altitudeKm` or producer `run_metadata.json`.

Focused validator coverage: `npm run validate:phase-d:app-wire`.

## 3. Current State

Relevant existing code (audited 2026-05-25 on branch
`paper-faithful-pr-theta-artifact-picker`, commit `00f75c0`):

- `src/modqn/replay-bundle/loader.ts` — typed parser for
  `phase-03a-replay-bundle-v1`. Accepts arbitrary `rowCount` /
  `slotCount` from manifest. Used unchanged by Phase D.
- `src/modqn/replay-bundle/replay-state.ts:47–56` — hardcoded
  `EXPECTED_SATELLITE_COUNT = 4`, `EXPECTED_TIMELINE_ROWS = 1000`,
  `EXPECTED_SLOT_COUNT = 10`, `MODQN_EXPECTED_EVENT_COUNTS = { none: 918,
  'intra-satellite-beam-switch': 82, 'inter-satellite-handover': 0 }`.
- `src/modqn/replay-bundle/playback-shell.ts:169–185` — validation
  rejects `rowCount !== 1000 || slotCount !== 10` and rejects mismatched
  event-counts. Both will trigger `getModqnReplayPlaybackModelValidationIssue`
  on any user-trained bundle.
- `src/modqn/replay-bundle/runtime-fetch.ts` — `fetchModqnReplayBundleEnvelope`
  already accepts a `fetchUrlBase` override. Reusable for backend-side
  fetches. Phase D adds a thin wrapper that points the URL at
  `${trainingServiceBaseUrl}/artifacts/${jobId}` rather than the dev
  vite static route.
- `src/modqn/training-trigger/artifactManifest.ts` — Phase B PR-θ
  helper that fetches *only* `manifest.json` to read the `userTrained`
  flag. Phase D extends this into a full bundle pull (or composes the
  existing runtime-fetch helper with a backend URL builder).
- `src/App.tsx:316` — `bundleProvenanceKind` state (paper-faithful |
  user-trained). PR-θ wires it but the scene still shows the startup
  Phase 7C bundle.
- `src/App.tsx:686–697` — `handleLoadIntoScene` stub: fetches manifest,
  flips chip + selectedJobId state, does NOT swap scene envelope.
- `src/App.tsx:708–739` — startup `useEffect` runs
  `fetchModqnReplayBundleEnvelope()` against the producer Phase 7C
  bundle path; sets `modqnReplayEnvelope` + `modqnReplayShellModel` +
  `modqnReplayDisplayState`. The user-trained path must reuse the same
  state triple (not parallel state), or the scene won't switch.
- `src/ui/modqn-training/JobsPanel.tsx:174–176` — `Load into scene`
  button delegates to `onLoadIntoScene` prop; ArtifactPicker uses the
  same callback.
- Backend endpoint surface (per backend SDD §6.4): user-trained bundle
  files are static-served at `${baseUrl}/artifacts/${jobId}/${filename}`.
  Path traversal blocked; filenames are `manifest.json`,
  `provenance-map.json`, `timeline/step-trace.jsonl`, and optionally
  `evaluation/summary.json`.

## 4. Slice Plan

Phase D is sized at 6 slices plus 1 optional stretch. One slice per PR.
Slices stack: D-S2 depends on the new mode constants from D-S2-prep,
D-S3 depends on D-S1 + D-S2, etc.

| Slice | Subject | Touches | Cross-repo dep? |
|---|---|---|---|
| PR-ι (D-S1) | user-trained bundle fetch wrapper | new `src/modqn/training-trigger/userTrainedBundleFetch.ts` (composes existing `runtime-fetch` + backend URL base), validator | none |
| PR-κ (D-S2) | user-trained envelope mode + relaxed shape validation | edit `src/modqn/replay-bundle/replay-state.ts` (add `MODQN_USER_TRAINED_MODE_*` consts + `evidenceStatus = 'user-trained'`), edit `src/modqn/replay-bundle/playback-shell.ts` (per-mode shape validator), validator | none |
| PR-λ (D-S3) | App.tsx wire — handleLoadIntoScene swaps envelope | edit `src/App.tsx` (fetch via D-S1, build via D-S2, replace `modqnReplayEnvelope` + `modqnReplayShellModel` + `modqnReplayDisplayState`; revert path on error), validator | none |
| PR-μ (D-S4) | reward curve panel | new `src/ui/modqn-training/RewardCurvePanel.tsx` + register in MODQN-demo right sidebar, validator | none |
| PR-ν (D-S5) | decision viz panel (Q-values + dense action scores) | new `src/ui/modqn-training/DecisionVizPanel.tsx`, validator | none |
| PR-ξ (D-S6) | training-replay banner + claim-boundary copy update | edit `src/ui/ClaimBoundaryBanner.tsx` (or equivalent) to mention training-replay mode; validator | none |
| PR-ο (D-S7, optional stretch) | per-episode progress readout in JobsPanel | edit `src/ui/modqn-training/JobsPanel.tsx` running-card to parse stdoutTail `episode N / M` regex; validator | possibly — depends on backend stdout format |

Each slice is one PR. Stack-base for the next slice is the previous
slice's branch.

### 4.1 Why split D-S1 from D-S2

`runtime-fetch.ts`'s `fetchModqnReplayBundleEnvelope` already accepts a
`fetchUrlBase` override but its envelope construction (in
`replay-state.ts` `createModqnReplayEnvelopeFromContents`) currently
fail-closes on 4-sat / 1000-row / 10-slot. D-S1 is the fetch composition
layer (zero envelope-shape concerns); D-S2 is the schema relaxation. Two
clean diffs > one tangled one.

### 4.2 Why D-S2 introduces a new mode instead of editing the existing one

The Phase 7C `modqn-replay-7beam` mode is a frozen reference baseline.
Its rowCount/slotCount/event-counts assertions are correctness gates for
the producer artifact. Relaxing them in-place would weaken evidence for
the paper-faithful path. D-S2 adds a parallel mode (`modqn-user-trained`)
that carries `evidenceStatus = 'user-trained'`. Validation rules per
mode are independent; the Phase 7C path keeps its strict shape gates.

### 4.3 Why D-S6 ships a banner update separately

PR-λ swaps the envelope but does not update the visible claim-boundary
banner copy. The banner currently labels the scene "paper-faithful
producer artifact"; under user-trained replay it must say "user-trained
artifact (not paper-faithful)". This is a small but user-visible diff;
keeping it isolated avoids dragging banner-styling churn into the
load-into-scene PR.

## 5. New User-Trained Mode Constants (PR-κ)

Added to `src/modqn/replay-bundle/replay-state.ts`:

```ts
export const MODQN_USER_TRAINED_MODE_KEY = 'modqn-user-trained' as const;
export const MODQN_USER_TRAINED_MODE_LABEL =
  'MODQN user-trained replay' as const;
export const MODQN_USER_TRAINED_EVIDENCE_STATUS = 'user-trained' as const;
```

The `ModqnReplayAdapterModeKey` union becomes:

```ts
export type ModqnReplayAdapterModeKey =
  | typeof MODQN_REPLAY_7BEAM_MODE_KEY
  | typeof MODQN_USER_TRAINED_MODE_KEY
  | 'sensitivity-demo';
```

`ModqnReplayEvidenceStatus` becomes:

```ts
export type ModqnReplayEvidenceStatus =
  | typeof MODQN_REPLAY_7BEAM_EVIDENCE_STATUS
  | typeof MODQN_USER_TRAINED_EVIDENCE_STATUS
  | typeof MODQN_FIXTURE_ONLY_EVIDENCE_STATUS;
```

Per-mode shape validation in `playback-shell.ts`
`getModqnReplayPlaybackModelValidationIssue` switches on `model.modeKey`:

- `modqn-replay-7beam` → strict 4-sat / 1000-row / 10-slot / 918-event
  checks (unchanged).
- `modqn-user-trained` → only assert: `rowCount >= 1`, `slotCount >= 1`,
  `slots.length === slotCount`, `eventCounts` sums to `rowCount`,
  `evidenceStatus === 'user-trained'`. No 4-sat / 1000-row / 918-event
  assertion.
- `sensitivity-demo` → unchanged (fixture path).

## 6. User-Trained Bundle Fetch (PR-ι)

A small wrapper that builds the backend URL base for the running training
service and reuses `fetchModqnReplayBundleEnvelope` with the user-trained
mode metadata:

```ts
// src/modqn/training-trigger/userTrainedBundleFetch.ts
import {
  fetchModqnReplayBundleEnvelope,
  type ModqnRuntimeBundleFetchResult,
} from '../replay-bundle/runtime-fetch';
import {
  MODQN_USER_TRAINED_EVIDENCE_STATUS,
  MODQN_USER_TRAINED_MODE_KEY,
} from '../replay-bundle/replay-state';
import type { ServiceClientConfig } from './types';
import { artifactUrl } from './serviceClient';

export interface FetchUserTrainedBundleParams {
  readonly config: ServiceClientConfig;
  readonly jobId: string;
  readonly fetchImpl?: typeof fetch;
}

export async function fetchUserTrainedBundleEnvelope(
  params: FetchUserTrainedBundleParams,
): Promise<ModqnRuntimeBundleFetchResult> {
  // No trailing slash; runtime-fetch's fetchTextSurface adds '/' before relative path.
  const fetchUrlBase = artifactUrl(params.config, params.jobId, '').replace(/\/$/, '');
  return fetchModqnReplayBundleEnvelope({
    sourcePath: `user-trained:${params.jobId}`,
    sourceOwner: 'modqn-paper-reproduction',
    fetchImpl: params.fetchImpl,
    fetchUrlBase,
    // mode metadata is consumed by createModqnReplayEnvelopeFromContents
    // when MODQN_USER_TRAINED_MODE_KEY override is in play (D-S2).
  });
}
```

D-S2 must extend `createModqnReplayEnvelopeFromContents` to accept an
optional `modeKey` override and produce envelopes whose
`modeKey === 'modqn-user-trained'` when requested. The producer-fetch
path (S2 startup `useEffect`) keeps the default `modqn-replay-7beam`.

## 7. App.tsx Wire (PR-λ)

`handleLoadIntoScene` becomes:

```ts
const handleLoadIntoScene = useCallback(async (jobId: string) => {
  const config = { baseUrl: readTrainingServiceBaseUrl() };
  let result;
  try {
    result = await fetchUserTrainedBundleEnvelope({ config, jobId });
  } catch (err) {
    setUserTrainedLoadError(err instanceof Error ? err.message : String(err));
    return;
  }
  const liveShell = createModqnReplayPlaybackShellModel(result.envelope);
  const issue = getModqnReplayPlaybackModelValidationIssue(liveShell);
  if (issue !== null) {
    setUserTrainedLoadError(issue.message);
    return;
  }
  setModqnReplayEnvelope(result.envelope);
  setModqnReplayShellModel(liveShell);
  setModqnReplayDisplayState(createModqnReplayPlaybackDisplayState(liveShell));
  setSelectedUserTrainedJobId(jobId);
  setBundleProvenanceKind('user-trained');
  setUserTrainedLoadError(null);
}, []);
```

A `Revert to paper-faithful` button (always rendered when
`bundleProvenanceKind === 'user-trained'`) re-runs the startup fetch via
`fetchModqnReplayBundleEnvelope()` (no args = Phase 7C bundle) and flips
state back. This is the un-load path; users must be able to leave
user-trained mode without a page refresh.

## 8. Reward Curve Panel (PR-μ)

`RewardCurvePanel` lives in the MODQN-demo right sidebar, sibling of
`ModqnEvidenceTab`. It reads:

- `envelope.replaySlots[].rows[].producerTruth.scalarReward` — one
  number per row.
- `envelope.replaySlots[].rows[].producerTruth.rewardVector` — three
  components (`r1Throughput`, `r2Handover`, `r3LoadBalance`).
- (Optional) `envelope.replaySummary` if it carries per-episode summary
  stats. Phase D does NOT depend on this — if absent, the panel only
  shows the per-row series from the timeline.

The panel renders four small SVG line charts in a 2×2 grid:

- top-left: `scalarReward` over `slotIndex` (or row index).
- top-right: `r1Throughput`.
- bottom-left: `r2Handover`.
- bottom-right: `r3LoadBalance`.

Y axis: per-chart auto-scale. X axis: slot/row index. No legend (titles
are static text in the panel header).

The chart highlights the currently focused row (driven by the same
`slotOffset` the scene already exposes through `useModqnHandoverState`).

testids: `reward-curve-panel`, `reward-curve-chart-scalar`,
`reward-curve-chart-r1-throughput`, `reward-curve-chart-r2-handover`,
`reward-curve-chart-r3-load-balance`.

Phase D explicitly does NOT add Chart.js or any new charting dependency.
Hand-rolled SVG path is sufficient for 1000-row series.

## 9. Decision Viz Panel (PR-ν)

`DecisionVizPanel` reads the focused row's `policyDiagnostics`:

```
policyDiagnostics.objectiveWeights        # {r1Throughput, r2Handover, r3LoadBalance}
policyDiagnostics.selectedScalarizedQ
policyDiagnostics.runnerUpScalarizedQ
policyDiagnostics.scalarizedMarginToRunnerUp
policyDiagnostics.availableActionCount
policyDiagnostics.topCandidates[]         # {satId, localBeamIndex, scalarizedQ, objectiveQ}
policyDiagnostics.denseActionScores?      # full per-beam scalarized-Q vector
```

The panel renders:

- A header line: "selected sat-X-beam-Y · scalarizedQ = N.NNN · margin
  N.NNN · runners-up: K".
- A small bar chart of the top-K candidates sorted by scalarizedQ
  descending, each labeled by short beam id.
- If `denseActionScores` exists: a second bar chart over ALL beam
  positions (greyed for invalid actions per
  `actionScoreValidityMask`).

`denseActionScores` is optional in the producer's manifest
(`optionalPolicyDiagnostics`). When absent, only the top-K chart is
shown. The panel never fabricates dense scores.

Selected vs runner-up colors:
- Selected: amber for user-trained mode, green for paper-faithful mode.
- Runner-up: muted.
- Invalid (denseActionScores mask=false): grey, no value label.

testids: `decision-viz-panel`, `decision-viz-top-candidates`,
`decision-viz-dense-scores`, `decision-viz-objective-weights-readout`.

## 10. Per-Slice Acceptance

### 10.1 PR-ι (D-S1, fetch wrapper)

- `fetchUserTrainedBundleEnvelope` returns an envelope when the backend
  is up and the job's artifact directory contains the required surfaces.
- It throws a `ModqnRuntimeBundleFetchError` when any surface 4xx/5xx/empty.
- The function reuses `runtime-fetch.ts` Promise.all; it does NOT
  introduce a second fetch sequence.
- A new validator
  `scripts/validate-phase-d-user-trained-bundle-fetch.tsx` source-greps:
  - `userTrainedBundleFetch.ts` imports from `runtime-fetch.ts` (no
    duplicate fetch code path).
  - `artifactUrl` is used to build the URL base.
  - `MODQN_USER_TRAINED_*` mode constants are NOT touched here (they
    land in D-S2).
- `npm run lint` clean.
- All Phase B validators (197 assertions) still PASS regression.

### 10.2 PR-κ (D-S2, user-trained mode + relaxed shape)

- `MODQN_USER_TRAINED_MODE_KEY = 'modqn-user-trained'` exported.
- `ModqnReplayAdapterModeKey` includes the new key.
- `ModqnReplayEvidenceStatus` includes `'user-trained'`.
- `createModqnReplayEnvelopeFromContents` accepts an optional
  `modeKey` argument; default remains `modqn-replay-7beam`.
- Envelope `evidenceStatus` derives from `modeKey`:
  `modqn-user-trained` → `user-trained`, `modqn-replay-7beam` →
  `accepted-7beam-baseline`.
- `getModqnReplayPlaybackModelValidationIssue` switches on `modeKey`:
  - 7-beam: existing 1000-row / 10-slot / 918-event checks UNCHANGED.
  - user-trained: only `rowCount >= 1 && slotCount >= 1 &&
    slots.length === slotCount`. Event-count match against rowCount sum.
- Validator
  `scripts/validate-phase-d-user-trained-mode.tsx` asserts:
  - 7-beam validation issues still fire on rowCount=999 (regression).
  - user-trained validation issues do NOT fire on rowCount=5000,
    slotCount=50.
  - 7-beam path's `evidenceStatus` remains `accepted-7beam-baseline`.
- `npm run lint` clean.
- S3 omega validator still PASSes (no behavior change for paper-faithful
  path).

### 10.3 PR-λ (D-S3, App.tsx wire)

- Clicking `Load into scene` on an artifact picker entry or jobs panel
  done-card triggers `handleLoadIntoScene(jobId)`.
- The function fetches via D-S1, validates via D-S2, then replaces
  `modqnReplayEnvelope` + `modqnReplayShellModel` + `modqnReplayDisplayState`
  atomically.
- `bundleProvenanceKind` flips to `'user-trained'`.
- The scene re-renders with the new bundle's beam catalog, satellite
  positions, and timeline.
- `Revert to paper-faithful` button restores the startup Phase 7C state.
- On fetch error: state stays paper-faithful, an inline banner shows
  the error message. Existing scene continues to play.
- testids: `load-into-scene-error-banner`, `revert-to-paper-faithful`.
- Validator
  `scripts/validate-phase-d-app-wire.tsx` asserts the source-side
  contract:
  - `handleLoadIntoScene` calls `fetchUserTrainedBundleEnvelope` (grep
    the import + call).
  - `handleLoadIntoScene` calls `setModqnReplayEnvelope` AND
    `setModqnReplayShellModel` AND `setModqnReplayDisplayState`.
  - A `revert-to-paper-faithful` button exists and is conditional on
    `bundleProvenanceKind === 'user-trained'`.
  - `setBundleProvenanceKind('user-trained')` is gated on a successful
    envelope build (no chip flip on failure).
- `npm run lint` clean. Phase B validators still PASS regression.

### 10.4 PR-μ (D-S4, reward curve)

- Panel mounts in MODQN-demo right sidebar.
- Renders 4 SVG line charts (one per scalar component) when an envelope
  is loaded.
- Hidden in `sinr-experiment` app mode.
- testids: `reward-curve-panel`, plus per-chart testids §8.
- Validator `scripts/validate-phase-d-reward-curve.tsx` asserts:
  - Panel reads from `envelope.replaySlots[].rows[].producerTruth.scalarReward`
    and `.rewardVector`.
  - No new charting library imported.
  - `data-testid` group complete.
- `npm run lint` clean.

### 10.5 PR-ν (D-S5, decision viz)

- Panel mounts in MODQN-demo right sidebar (sibling of reward curve).
- Renders top-K candidates list + optional dense-score bar chart per §9.
- Hidden in `sinr-experiment` app mode.
- Hidden when focused row's `policyDiagnostics` is `undefined` (gracefully
  shows "policy diagnostics absent for this row").
- testids: per §9.
- Validator `scripts/validate-phase-d-decision-viz.tsx` asserts the
  source-side contract; no DOM race (per
  `feedback_validator_canvas_vs_react_attr`).
- `npm run lint` clean.

### 10.6 PR-ξ (D-S6, banner copy)

- `ClaimBoundaryBanner` reads `bundleProvenanceKind` (already passed in
  PR-θ).
- When `'user-trained'`: banner copy becomes "User-trained MODQN replay
  · paperFaithful: false · do not cite as PAP-2024 baseline evidence".
- When `'paper-faithful'`: banner copy unchanged.
- Validator `scripts/validate-phase-d-banner-copy.tsx` source-greps the
  two copy variants and the conditional.
- `npm run lint` clean.

### 10.7 PR-ο (D-S7, optional stretch)

- `JobsPanel` running-card stdoutTail regex `episode\s+(\d+)\s*/\s*(\d+)`
  parses the trainer's stdout.
- Progress bar advances from indeterminate to a percentage when at least
  one `episode N / M` line is present.
- Falls back to indeterminate on parse failure (no regression).
- testids: `jobs-panel-active-card-percent`.
- Validator `scripts/validate-phase-d-episode-progress.tsx`.
- `npm run lint` clean.

Cross-repo prerequisite for PR-ο: backend stdoutTail must include
`episode N / M` lines. If the trainer's stdout does not currently emit
this exact format, PR-ο is held until a one-line change in
`modqn-paper-reproduction/src/modqn_paper_reproduction/cli.py` adds the
emission. Phase D does NOT block on it; PR-ο is explicitly stretch.

## 11. Cross-Repo Dependencies

### 11.1 Required for Phase D v1

None. B0–B4 already shipped (commit `41a0155` in
modqn-paper-reproduction main, 2026-05-16). Backend `GET /artifacts/...`
serves the required files.

### 11.2 Required for the optional PR-ο

A separate PR in modqn-paper-reproduction:

- `src/modqn_paper_reproduction/cli.py` trainer subcommand emits a per
  episode `print(f"episode {i} / {episodes}")` line on stdout that
  reaches `stdoutTail` via the backend job runner.
- Stable format is part of the implicit contract; documenting it in the
  backend SDD is recommended.

Phase D does NOT block on this. PR-ο ships only after the format lands.

### 11.3 Bundle schema evolution

If the producer evolves `phase-03a-replay-bundle-v1` to add new manifest
fields, Phase D consumes them via the existing permissive `[key:
string]: unknown` open shape in `types.ts`. No SDD change required for
additive fields. Breaking changes (removing fields, renaming) require a
new bundle schema version and a separate consumer SDD revision.

## 12. State and Persistence

No new localStorage keys in Phase D. The `selectedUserTrainedJobId`
state from Phase B PR-θ already persists the user's last selection in
`SUBMITTED_JOB_IDS_KEY` (Phase B SDD §7). On reload, Phase D does NOT
auto-restore the user-trained scene — the user must re-click
`Load into scene` for that job. This matches the Phase B PR-θ explicit
opt-in posture for user-trained content.

If the user-trained scene was active on the previous session, the
artifact picker's selected-entry highlight is restored (existing
behavior), but the scene resumes in paper-faithful mode. A single
banner in the right sidebar tells the user "previously loaded
user-trained job <jobId> — click Load into scene to resume".

## 13. Out of Scope

Not in Phase D:

- Live MODQN policy inference (Phase 6W gate).
- Cross-bundle diff visualization (a second bundle loaded for comparison).
- Multi-user UE selection in the decision-viz panel (one focused user
  index per row is sufficient — matches the producer's per-row shape).
- 100-UE / N-satellite runtime override (Phase E).
- Free per-step seek in the reward curve (the existing slot timeline
  already drives `slotOffset`; reward curve highlights follow it).
- Reward function ablation toggles (the ω-handover S0–S4 already lets
  the user retune ω; the curve reflects the producer's reward, not a
  re-scalarized one). A future PR could add a re-scalarized overlay,
  but it is not Phase D.
- Training resumption / checkpoint editing.

## 14. Risks

- **`MODQN_EXPECTED_*` constants relaxation drift**: if D-S2's per-mode
  switch is mis-implemented, the 7-beam path's strict assertions could
  weaken silently. Mitigation: the D-S2 validator includes a regression
  case that asserts a 7-beam bundle with rowCount=999 still fails-closed.
- **Stack-trace pollution from fetch errors**: backend may be unreachable
  mid-load. The error banner must catch all error types (network,
  HTTP, parse, validation) into a single message field — no console
  noise. Mitigation: `ModqnRuntimeBundleFetchError` already has a
  message-shaped error path; D-S3 reuses it.
- **State desync**: if the user clicks `Load into scene` while the scene
  is mid-playback, the in-flight rAF may briefly render against a
  partially swapped envelope. Mitigation: pause playback before swap,
  then resume on the new envelope.
- **Bundle size**: a 5000-episode user-trained bundle's timeline may
  exceed 10 MB. Mitigation: `runtime-fetch.ts`'s Promise.all already
  handles arbitrary text size; the SVG reward curve plots at most
  rowCount points (memory-cheap). If perf testing later shows
  per-frame lag, a follow-up can switch to downsampled rendering.
- **Phase 6W gate confusion**: a future contributor may mistake this
  user-trained playback for live policy inference and try to wire
  `HandoverManager`'s policy adapter to the user-trained envelope.
  Mitigation: §2.3 hard ban + reading-order item #2.

## 15. Validation Plan (per Phase D slice)

Each slice's PR runs:

- `npm run lint`.
- The slice's focused validator script (above).
- ALL Phase B validators (the 197-assertion regression suite) plus the
  S3 omega replay-mode-wiring validator. Phase D must not regress any
  of these.
- Manual code audit: no `MainScene` fork, no `FOOTPRINT_RADIUS_WORLD`
  edit, no profile JSON edit, no producer-side edit.
- For PR-λ, PR-μ, PR-ν: browser smoke against a running backend with at
  least one completed user-trained job. Phase D explicitly tests:
  - Load into scene flips chip + scene visibly switches.
  - Revert to paper-faithful restores Phase 7C scene.
  - Reward curve renders 4 charts.
  - Decision viz shows top-K + dense scores when present.

The validator scripts MUST follow `feedback_validator_canvas_vs_react_attr`:
no race between canvas-side dataset attrs and React-rendered attrs.
Phase D validators are source-grep + fetch-mock based (no DOM race).

## 16. Assumptions To Verify Before PR-λ Lands

- The backend's `GET /artifacts/<jobId>/manifest.json` serves a JSON
  object whose top-level shape matches `phase-03a-replay-bundle-v1` (the
  producer's `export_replay_bundle` writes the same manifest shape under
  the backend's `artifacts/user-trained/<jobId>/` dir, per backend SDD
  §3.2). If the user-trained writer in the backend emits a different
  shape, D-S2's loader will fail-close — that is the correct failure
  mode, not a Phase D bug.
- The backend's `serviceClient.artifactUrl(config, jobId, filename)`
  returns a URL ending in `/artifacts/<jobId>/<filename>` exactly.
  D-S1's URL-base trimming relies on this.
- The user has the modqn-paper-reproduction venv set up and the backend
  service running (per Phase B README pointer). Phase D does NOT
  duplicate setup instructions.
- The producer's user-trained writer includes
  `evaluation/summary.json` (or omits it). Both branches are handled
  by `runtime-fetch.ts`'s optional surface fetch.

If any assumption is contradicted before implementation, update this
SDD rather than patching display behavior around it.

## 17. Phase Sequencing

Phase D follows Phase B (which is shipped to branches as of 2026-05-25,
pending user merge). Phase D PRs stack as:

```
main (post Phase B merge)
└─ paper-faithful-phase-d-mini-sdd       (this SDD, docs-only)
   └─ paper-faithful-pr-iota-bundle-fetch (D-S1)
      └─ paper-faithful-pr-kappa-user-trained-mode (D-S2)
         └─ paper-faithful-pr-lambda-app-wire (D-S3)
            └─ paper-faithful-pr-mu-reward-curve (D-S4)
               └─ paper-faithful-pr-nu-decision-viz (D-S5)
                  └─ paper-faithful-pr-xi-banner-copy (D-S6)
                     └─ paper-faithful-pr-omicron-episode-progress (D-S7 stretch)
```

After this SDD merges to main, each subsequent PR rebases off main as
its predecessor merges. The stack is short-lived; no long-running
feature branch.

Phase E (SINR-side N-sat / N-beam runtime overrides) follows Phase D.
Phase D itself does not assume the existence of Phase E; if Phase E
slips, the user-trained replay still works for whatever sat/beam shape
the backend produced under the active profile.
