# Phase B Training Pipeline Mini-SDD

Status: draft for Phase B (post Phase A merge).
Date: 2026-05-25
Owner: `leo-beam-sim` consumer-side training trigger UI.
Target repo: `/home/u24/papers/project/leo-beam-sim`.
Backend authority: `docs/modqn-training-trigger-backend-sdd.md` (this repo) and `modqn-paper-reproduction/src/modqn_training_service/`.

## 0. Reading Order

Read before changing this SDD or starting implementation:

1. `.agent-memory/project_paper_faithful_vision.md` — user vision Phase B
   bullet (S5a UI training form / S5b artifact picker / episode progress
   streaming / quick / full buttons).
2. `.agent-memory/project_training_backend_b0_b4.md` — backend B0-B4 status
   (shipped 2026-05-16 in modqn-paper-reproduction main `41a0155`).
3. `docs/modqn-training-trigger-backend-sdd.md` — authoritative backend
   contract. Phase B never duplicates §6 endpoint specs; it consumes them.
4. `docs/paper-faithful-mini-sdd.md` — Phase A mode-rail context. Phase B UI
   surfaces only inside the `modqn-demo` app mode.
5. `CLAUDE.md` — sibling-repo edit boundary. `modqn-paper-reproduction` is
   not editable from this repo. Any backend change is a separate cross-repo
   PR.

## 1. Purpose

Phase A landed the `modqn-demo` app-shell entry and the paper-faithful
4-sat profile. Phase B wires the consumer-side training trigger so that:

- The user opens the `modqn-demo` mode rail.
- A training form appears (hyperparameters + ω + episode count).
- One click starts a real MODQN training run in the modqn-paper-reproduction
  backend subprocess.
- A jobs panel polls progress.
- When done, the produced user-trained bundle appears in an artifact picker
  and can be loaded into the live scene.

Phase B is the leo-beam-sim consumer-side counterpart of the backend SDD's
B5 slice. It also adds the quick / full preset buttons and the polling
progress affordance not covered by the backend SDD.

## 2. Authority and Boundaries

### 2.1 Owned by Phase B

- New consumer UI: training form, jobs panel, artifact picker.
- localStorage state for the user's submitted jobIds across sessions.
- Permissive parser branch in the existing replay bundle loader for the
  user-trained manifest fields (`userTrained`, `paperFaithful`,
  `userTrainingMetadata`).
- Visible `user-trained` tag on any user-trained bundle that appears in
  the scene.
- Backend availability detection (the service is optional; the UI must
  degrade cleanly when it is not running).

### 2.2 Not owned by Phase B

- Backend service code. Backend changes go in modqn-paper-reproduction.
- Allowlist range expansion. If a Phase B slice needs an allowlist limit
  bumped (e.g. episodes 5000 -> 9000), that is a cross-repo prerequisite,
  not a Phase B leo-beam-sim slice.
- Bundle schema. The producer owns `phase-03a-replay-bundle-v1`. Phase B
  only reads the new optional manifest fields.
- Paper-faithfulness assertions. The bundle's manifest is the only place
  the `paperFaithful` flag is set; UI never asserts it on its own.
- Live training-step rendering (per-episode reward stream in the scene).
  Out of scope; periodic polling only in Phase B.
- A second scene tree or scene fork for training mode. Phase B re-uses the
  shared MainScene; training-replay scene mode is a Phase D concern.
- Backend-trigger UI surfaces outside the `modqn-demo` app mode.
  `sinr-experiment` mode does not expose any training UI.

### 2.3 Hard bans (PR-level, all Phase B slices)

- Do NOT edit `modqn-paper-reproduction`.
- Do NOT change `FOOTPRINT_RADIUS_WORLD`, `MainScene`, or any scene-tree
  file.
- Do NOT introduce a 100-UE live mobility generator.
- Do NOT load user-trained bundles into the scene without the visible
  user-trained tag (consumer SDD §8.4).
- Do NOT auto-`POST /train` on app load or URL flag (consumer SDD §8.4).
- Do NOT strip the `userTrained` flag at any point in the loader.
- Do NOT expose the training form in `sinr-experiment` app mode.

## 3. Current State

Relevant existing code:

- `src/ui/appMode.ts` — `AppExperienceMode = 'sinr-experiment' | 'modqn-demo'`.
- `src/ui/AppModeRail.tsx` — visible mode rail.
- `src/App.tsx:resolveProfileForAppMode` returns
  `modqn-4sat-7beam-paper-faithful` for the `modqn-demo` mode by default.
- `src/ui/ModqnObjectiveTab.tsx` — left sidebar tab in `modqn-demo` mode,
  hosts the ω sliders + Apply / Reset.
- `src/ui/HandoverPolicyControls.tsx` — handover-policy left tab shared
  by both modes.
- Backend at `modqn-paper-reproduction/src/modqn_training_service/`:
  - `POST /train` (202 + jobId).
  - `GET /jobs?status=...&limit=...`.
  - `GET /jobs/<id>` (detail + stdoutTail + stderrTail).
  - `GET /artifacts/<id>/<filename>` (static).
  - Default bind `127.0.0.1:8765`.
  - Allowlist: `episodes [100, 5000]`, `learning_rate [1e-5, 1e-2]`,
    `discount_gamma [0.8, 0.99]`, `hidden_dim [32, 256]`,
    `batch_size [16, 256]`, `objective_weights` each in `[0, 1]`,
    `seed_triplet` three ints, `trainer_subcommand ∈ {baseline,
    ee-modqn, multi-catfish}`.

## 4. Slice Plan

Phase B is sized at 5 slices. One slice per PR. Slice boundary follows the
backend SDD §9.1 ordering: backend is already done, so the consumer
ordering is bottom-up (parser first, then service-availability, then form,
then jobs panel, then artifact picker).

| Slice | Subject | Touches | Cross-repo dep? |
|---|---|---|---|
| PR-δ (B-S1) | permissive bundle manifest parse for the user-trained fields | `src/modqn/replay-bundle/loader.ts` (or equivalent), tiny test fixture | none |
| PR-ε (B-S2) | backend availability ping + service-status banner in MODQN-demo mode | new `src/modqn/training-trigger/serviceClient.ts`, banner inside the right sidebar live tab | none |
| PR-ζ (B-S3) | training form UI (hyperparams + ω + quick / full preset) | new `src/ui/modqn-training/TrainingForm.tsx` + register as `'training'` left-tab in MODQN mode only | none |
| PR-η (B-S4) | jobs panel poll + active-job summary | new `src/ui/modqn-training/JobsPanel.tsx`, lives below the training form or as a sub-tab | none |
| PR-θ (B-S5) | artifact picker with user-trained tag + load-into-scene path | new `src/ui/modqn-training/ArtifactPicker.tsx`, manifest tag rendered in `ModqnEvidenceTab` and `ClaimBoundaryBanner` | none |

Each slice is one PR. The quick / full preset semantics live inside PR-ζ.

### 4.1 Allowlist clamp policy

The backend allowlist caps `episodes` at 5000. The paper baseline (and the
PR-β profile default) is `9000`. PR-ζ resolves this with three rules:

1. The training form's `Quick` button submits `episodes=100`.
2. The training form's `Full` button submits `episodes=5000` and renders
   a tooltip explaining that this is the backend cap, not the paper's
   9000. The button label is `Full (5000 ep)` so users are not misled.
3. If the form's free numeric field is set above 5000, the form blocks
   submission client-side with a banner that links to the cross-repo
   prerequisite below.

The prerequisite for a true 9000-episode button:

- In `modqn-paper-reproduction`: bump `episodes` allowlist max from 5000
  to 9000 (and document the host-time impact). One-line change in
  `src/modqn_training_service/allowlist.py`. This is NOT a Phase B
  leo-beam-sim slice; it is a separate modqn-paper-reproduction PR. The
  Phase B mini-SDD records the dependency; it does not own the PR.
- Once the backend allowlist is bumped, leo-beam-sim's `Full` button can
  be relabeled to `Full (9000 ep)` in a 1-line follow-up here.

PR-ζ ships the 5000-cap version. The 9000-cap version is a P-after-Phase-B
follow-up.

## 5. UI Placement

The training form and jobs panel live inside the MODQN-demo app mode only.
Two placement options were considered:

A. Add a new `'training'` left-sidebar tab in MODQN-demo mode.
B. Add a bottom panel below the scene (matches the user vision wording
   "底下也可以設定一些訓練時可調整的參數").

Phase B picks option A. Reasons:

- Option B requires a new app-shell grid row plus another set of media
  query overrides (similar effort to Phase A PR-γ for the rail).
- Option A reuses the existing `SidebarTabShell` and the per-mode left-tab
  list (`MODQN_LEFT_SIDEBAR_TABS` in App.tsx). Adding `'training'` is a
  3-line change.
- Option A keeps the scene area unchanged (sticking to the Phase A
  contract of "one shared scene tree, no fork").
- If user feedback after Phase B says the side placement is wrong, a Phase
  C / D slice can lift the form into a bottom panel without touching the
  backend contract.

Phase B records option B as a known-deferred preference. SDD does not call
it a "rejected" idea.

The MODQN-mode left sidebar tab order in `App.tsx` becomes:

```
[ objective ] [ handover ] [ training ] [ jobs ]
```

Where `jobs` is added in PR-η. `sinr-experiment` mode's left sidebar
remains unchanged (`[ signal ] [ handover ]`).

## 6. Service Client Contract (PR-ε)

A small wrapper around the backend endpoints. Lives in
`src/modqn/training-trigger/serviceClient.ts`. Pure TypeScript, no React.

```ts
export interface ServiceClientConfig {
  readonly baseUrl: string;
  // 1500ms; backend localhost ping should be subsecond.
  readonly probeTimeoutMs?: number;
}

export interface ServiceAvailability {
  readonly reachable: boolean;
  readonly latencyMs: number | null;
  readonly version?: string;
  readonly error?: string;
}

export async function probeService(
  config: ServiceClientConfig,
): Promise<ServiceAvailability>;

export async function postTrain(
  config: ServiceClientConfig,
  request: TrainingRequest,
): Promise<{ jobId: string; status: 'queued'; estimatedStartAtMs: number | null }>;

export async function getJobs(
  config: ServiceClientConfig,
  filter?: { status?: JobStatus; limit?: number },
): Promise<{ jobs: TrainingJobSummary[] }>;

export async function getJobDetail(
  config: ServiceClientConfig,
  jobId: string,
): Promise<TrainingJobDetail>;

export function artifactUrl(
  config: ServiceClientConfig,
  jobId: string,
  filename: string,
): string;
```

`TrainingRequest`, `TrainingJobSummary`, `TrainingJobDetail`, `JobStatus`
live in `src/modqn/training-trigger/types.ts` and match the backend SDD
§6.x shapes verbatim.

Default `baseUrl`: `http://127.0.0.1:8765`. Configurable via a
`localStorage` key `leo-beam-sim.training-service.base-url.v1` if the user
runs the backend on a non-default port.

## 7. State and Persistence

Two new localStorage keys, both versioned `.v1`:

```ts
const TRAINING_SERVICE_BASE_URL_KEY =
  'leo-beam-sim.training-service.base-url.v1';
const SUBMITTED_JOB_IDS_KEY =
  'leo-beam-sim.training-submitted-job-ids.v1';
```

Behavior:

- `TRAINING_SERVICE_BASE_URL_KEY`: stores the user's overridden base URL.
  If absent, the default `http://127.0.0.1:8765` is used. Read on each
  service call (or cached behind a `useTrainingServiceConfig` hook).
- `SUBMITTED_JOB_IDS_KEY`: stores an array of `{ jobId, submittedAtMs,
  hyperparamSummary }` for jobs the user submitted from this browser.
  Cap at the newest 50 entries. The backend's LRU may delete older job
  rows; the consumer still shows the user's submission history (with the
  job marked `expired` or `unknown` if the backend no longer has it).

These keys are owned by Phase B. They do not collide with Phase A
(`leo-beam-sim.app-mode.v1`, `leo-beam-sim.profile-by-app-mode.v1`).

## 8. Progress UI (PR-η)

The backend does not stream per-episode progress in v1. The jobs panel
uses a periodic poll instead:

- Poll cadence: 3 s when at least one job is `queued` or `running`,
  otherwise 30 s (idle).
- Each poll calls `getJobs({ status: 'queued' })` and
  `getJobs({ status: 'running' })`. The combined response feeds a small
  card per active job.
- For a running job, the card shows: jobId short prefix, started-at
  duration (`running for 4m 12s`), an indeterminate progress bar (no
  percentage), and a `Refresh detail` button that calls
  `getJobDetail(jobId)` for the stdoutTail.
- The card transitions to a `done` state when the job's status flips,
  and a `Load into scene` button replaces the progress bar.

If the producer later exposes per-episode markers in stdoutTail or adds a
new `GET /jobs/<id>/progress` endpoint, a follow-up consumer slice can
upgrade the indeterminate bar to a true percentage. Phase B does not
depend on that and does not add an SSE client.

If `probeService` returns `reachable: false`:

- The training form's `Start training` button is disabled with a tooltip
  pointing at the backend SDD's start instructions.
- The jobs panel shows a single banner: `Training backend unreachable —
  start it on the host with: python -m modqn_training_service.api`.
- No retry storm. The panel re-probes once when the user clicks
  `Retry connection`.

## 9. Artifact Picker and User-Trained Tag (PR-θ)

The picker lives in the MODQN-demo right sidebar, sharing space with the
existing `ModqnEvidenceTab`. It surfaces:

- Producer-official bundles (existing list).
- User-trained bundles (new list).
- A combined empty state if neither exists.

User-trained entries always show:

- Submitted at (locale-formatted).
- Hyperparam summary.
- `user-trained` chip — required by backend SDD §3.2 and §8.4. The chip
  is amber, never removable, and uses the exact label `user-trained`.

Selecting a user-trained entry triggers a fetch of the artifact's manifest
(`GET /artifacts/<id>/manifest.json`), then loads the bundle through the
existing `loadShowcaseArtifact` path. The renderer never inspects the
`paperFaithful` flag to derive scene truth; it only forwards it to the
banner so the existing `ClaimBoundaryBanner` shows a `user-trained` notice.

`ClaimBoundaryBanner` and `ModqnEvidenceTab` gain a single new prop each:
`bundleProvenanceKind: 'paper-faithful' | 'user-trained'`. When
`user-trained`, the banner renders an additional pill with the same amber
styling. No other render path changes.

## 10. Acceptance Per Slice

### 10.1 PR-δ (permissive parse)

- The bundle loader accepts a manifest with
  `userTrained: true, paperFaithful: false, userTrainingMetadata: {...}`.
- The loader continues to accept a manifest without these fields.
- The new fields land on the parsed bundle type as optional properties.
- `npm run lint` clean.
- A small fixture lives at `src/modqn/replay-bundle/fixtures/user-trained-stub.json`
  and is consumed by a `validate-phase-b-loader.tsx` script that asserts
  the three fields round-trip.

### 10.2 PR-ε (service ping)

- `probeService` returns `reachable: true` against a locally running
  backend within 1500 ms and `false` (with a string error) otherwise.
- The MODQN-demo right sidebar shows the `Training backend unreachable`
  banner when the backend is not running.
- No network call fires on the `sinr-experiment` mode.
- `npm run lint` clean.

### 10.3 PR-ζ (training form)

- A new `'training'` left tab appears only in the MODQN-demo mode.
- The form has fields for: `trainerSubcommand` (default `baseline`),
  `episodes` (default 1000, capped at 5000), `learningRate`,
  `discountGamma`, `hiddenDim`, `batchSize`, and the three ω weights
  (default 0.4 / 0.3 / 0.3).
- `Quick` and `Full (5000 ep)` buttons fill the form with the preset
  values and call `Start training` in one click.
- `Start training` calls `postTrain` and stores the returned jobId in
  `SUBMITTED_JOB_IDS_KEY`. On 400 / 409 / 503 it shows the backend's
  error verbatim in an inline alert.
- The form is disabled when the backend is unreachable.
- testids: `training-form`, `training-form-quick`, `training-form-full`,
  `training-form-submit`, `training-form-episodes-input`.
- `npm run lint` clean. S3 omega validator still passes.

### 10.4 PR-η (jobs panel)

- The panel polls at 3 s when active jobs exist and 30 s otherwise.
- Active jobs show running-for duration and an indeterminate progress bar.
- Done jobs show the `Load into scene` button.
- The panel renders the user's submission history from
  `SUBMITTED_JOB_IDS_KEY` for jobs the backend no longer knows about
  (marked `expired`).
- testids: `jobs-panel`, `jobs-panel-active-card`, `jobs-panel-done-card`,
  `jobs-panel-load-into-scene`.
- `npm run lint` clean.

### 10.5 PR-θ (artifact picker)

- The right sidebar shows a combined list with paper-faithful and
  user-trained entries.
- Selecting a user-trained entry renders the bundle in the scene with the
  amber `user-trained` chip visible on the picker entry, in the claim
  boundary banner, and in the MODQN evidence tab header.
- The chip text is exactly `user-trained` (case-sensitive).
- No path strips the user-trained flag through the scene render pipeline.
- testids: `artifact-picker`, `artifact-picker-entry`,
  `artifact-picker-user-trained-chip`.
- `npm run lint` clean.

## 11. Cross-Repo Dependencies

### 11.1 Required for Phase B v1

None. B0-B4 already shipped (commit `41a0155` in
modqn-paper-reproduction main, 2026-05-16). Phase B leo-beam-sim slices
are self-contained against the existing backend contract.

### 11.2 Required for the post-Phase-B `Full (9000 ep)` button

A separate PR in modqn-paper-reproduction:

- `src/modqn_training_service/allowlist.py`: bump `episodes` max from
  5000 to 9000.
- Document the wall-time impact in the backend SDD.

Once that lands, a 1-line leo-beam-sim follow-up flips the form's `Full`
preset and label.

### 11.3 Required for streaming progress

A separate PR in modqn-paper-reproduction:

- Either expose a parsed `episodes_done` field on `GET /jobs/<id>` (by
  tailing the trainer's stdout), or add a `GET /jobs/<id>/progress`
  SSE endpoint.

Phase B does NOT block on this; the indeterminate progress bar is the
agreed v1 behavior. A follow-up consumer slice consumes whichever shape
the backend exposes.

## 12. Out of Scope

Not in Phase B:

- A training-replay scene mode (Phase D).
- Reward curve panel (Phase D).
- Q-value / per-step decision overlay (Phase D).
- 100-UE runtime override (Phase E).
- Free satellite / beam-count runtime override (Phase E).
- Authentication on the backend HTTP service.
- Multi-host / GPU-cluster training.
- An auto-trainer that picks hyperparameters by itself.

## 13. Risks

- Backend availability is fragile (a local dev process). The Phase B UI
  must always render even when the backend is down, with a clear "backend
  unreachable" affordance.
- Browser polling at 3 s during active jobs is a small noise source. If
  the user runs many jobs in parallel the backend's `_MAX_PENDING_JOBS=10`
  cap is the safety valve, not the consumer.
- User-trained chip visibility is a paper-claim boundary requirement.
  Renderer or styling regressions that hide the chip must be treated as
  release blockers, not cosmetic issues.

## 14. Validation Plan (per Phase B slice)

Each slice's PR runs:

- `npm run lint`.
- The relevant focused validator script (e.g. `validate-phase-b-loader.tsx`
  for PR-δ, plus the existing S3 omega validator across all slices to
  prove the L1.5 contract still holds).
- Manual code audit: no `MainScene` fork, no `FOOTPRINT_RADIUS_WORLD`
  edit, no profile JSON edit, no docs / memory edit.
- Browser smoke for PR-ζ and PR-η (where progress polling requires
  observation against a running backend). PR-δ / PR-ε / PR-θ are
  source-grep verifiable.

## 15. Assumptions To Verify Before PR-ζ Lands

- The PR-β profile's `modqnNetworkParams.episodes=9000` value is not
  consumed by the training form's defaults (the form defaults come from
  the backend allowlist, not the profile). If a future slice wants the
  form to derive defaults from the active profile, it must explicitly
  clamp to the backend allowlist range.
- The default base URL `http://127.0.0.1:8765` matches the backend's
  default bind.
- The user has the modqn-paper-reproduction venv set up. The leo-beam-sim
  README adds a one-line pointer (`see modqn-paper-reproduction README
  for backend setup`). Phase B does not duplicate the setup instructions.

If any assumption is contradicted before implementation, update this SDD
rather than patching display behavior around it.
