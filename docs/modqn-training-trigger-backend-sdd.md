# MODQN Training-Trigger Backend Mini-SDD

**Date:** 2026-05-15
**Status:** DRAFT SDD — planning authority, not implementation evidence
**Target repo:** `/home/u24/papers/modqn-paper-reproduction` (backend service lives next to the producer); consumer wiring in `/home/u24/papers/project/leo-beam-sim`
**Scope anchor:** `PAP-2024-MORL-MULTIBEAM` baseline MODQN, with forward-compatibility for `angle-aware-ee-multicatfish` and `multi-catfish` training entry points.

## 0. Reading Order

Read before changing this SDD or starting implementation:

1. `docs/modqn-omega-handover-sdd.md` — companion consumer-side SDD. This
   SDD only covers the backend service and the consumer wiring needed by
   Slice S5 of the companion SDD.
2. `/home/u24/papers/modqn-paper-reproduction/AGENTS.md` — producer-side
   governance.
3. `/home/u24/papers/modqn-paper-reproduction/agent-skills/modqn-reproduction-governance/SKILL.md` — paper-faithful artifact governance.
4. `/home/u24/papers/modqn-paper-reproduction/src/modqn_paper_reproduction/cli.py` — current `train_main` entry point and CLI args.
5. `/home/u24/papers/modqn-paper-reproduction/src/modqn_paper_reproduction/bundle/schema.py` — bundle schema and the immutability rule.
6. `/home/u24/papers/ntn-showcase-stack/AGENTS.md` — cross-repo authority; the bundle schema and producer contract live in `modqn-paper-reproduction` and `ntn-showcase-stack`, not in `leo-beam-sim`.

## 1. Purpose

`leo-beam-sim` currently has no way to trigger a real MODQN training run.
The sidebar's "retrain" button is a fake `setInterval` that paints a fake
reward curve.

The consumer SDD (`docs/modqn-omega-handover-sdd.md`, Slice S5) proposes
a sidebar form that lets the user pick training hyperparameters, click
`Start training`, then close the browser. The training runs to completion
in the background; the produced artifact appears in a `Jobs` panel when
ready and can be loaded into the scene exactly like a paper-faithful
bundle.

This SDD defines the backend service that makes that possible.

The key design constraint: training is **not** done in the browser. It is
done by spawning the existing
`/home/u24/papers/modqn-paper-reproduction/src/modqn_paper_reproduction/cli.py:train_main`
in a detached subprocess on the host that has the Python environment,
GPU (if any), and write access to `artifacts/user-trained/`.

A second hard constraint: every artifact produced by this service is
**user-trained, not paper-faithful**, and must be labeled as such in the
bundle manifest and in any consumer UI that lists it.

## 2. Scope

### 2.1 Goals

- Provide an HTTP service co-located with `modqn-paper-reproduction` that
  exposes four endpoints: `POST /train`, `GET /jobs`, `GET /jobs/<id>`,
  `GET /artifacts/<id>/<filename>`.
- Spawn `modqn-train` (or the relevant `multi-catfish` / `ee-modqn`
  subcommand in future tracks) in a detached subprocess so the training
  outlives the HTTP request that triggered it.
- Persist job state to a SQLite file so the service can survive restarts
  without losing job history.
- Write every produced bundle to `artifacts/user-trained/<jobId>/` with
  a manifest carrying `userTrained: true, paperFaithful: false` and the
  exact hyperparameter overrides the user submitted.
- Provide an LRU cleanup policy (default: keep newest 20 jobs) to bound
  disk growth.
- Provide a single-job mutex so concurrent training requests queue
  rather than oversubscribe the host.
- Provide a hyperparameter allowlist that limits user-trained runs to a
  defined safe range, preventing runaway episode counts or invalid
  configs.
- Provide a consumer hook in `leo-beam-sim` that lists user-trained
  bundles in the artifact picker, clearly tagged.
- Make the service safe to expose on `localhost` for a single-operator
  demo. Network exposure (LAN, public Internet) is **out of scope** for
  this SDD and is a follow-up.

### 2.2 Non-Goals

- No browser-side training. PyTorch in WASM is out of scope.
- No claim that any user-trained bundle is paper-faithful. The bundle's
  `paperFaithful` flag is hard-coded false at write time.
- No producer-side CLI change beyond adding `--output-dir` and `--user-trained`
  flags if they don't already exist. The trainer's reward, env, and
  algorithm code is not modified.
- No real-time training progress streaming. The user closes the browser
  and re-opens it later. Slice can add SSE later if needed.
- No web-scale concurrency. Single-host, single-operator, one job at a
  time.
- No authentication beyond binding the HTTP service to `127.0.0.1` by
  default. Public exposure requires a separate auth design.
- No automatic re-training on schedule.
- No remote-host training cluster orchestration. If the host needs more
  GPU, that's a separate ops decision.
- No artifact promotion path from user-trained → paper-faithful. That
  remains a manual decision recorded in the producer governance docs.

## 3. Core Definitions

### 3.1 Training Job

A request to run a single MODQN training session with a specific
hyperparameter set. A job has:

- `jobId`: ULID, server-assigned.
- `status`: one of `queued`, `running`, `done`, `failed`, `cancelled`.
- `submittedAtMs`, `startedAtMs?`, `finishedAtMs?`.
- `hyperparams`: the validated subset of CLI overrides the user submitted.
- `trainerSubcommand`: which trainer was invoked (`baseline` /
  `ee-modqn` / `multi-catfish`). Defaults to `baseline`.
- `pid?`: the detached subprocess PID, set when `status` becomes
  `running`.
- `exitCode?`: process exit code when `done` or `failed`.
- `artifactPath?`: filesystem path inside
  `artifacts/user-trained/<jobId>/`, set when `done` and the bundle was
  successfully written.
- `errorMessage?`: short string when `status === 'failed'`.

### 3.2 User-Trained Bundle

A bundle written by the training service. It has the same
`phase-03a-replay-bundle-v1` schema as a producer-official bundle but
carries additional fields in its manifest:

```json
{
  "bundleSchemaVersion": "phase-03a-replay-bundle-v1",
  "paperId": "PAP-2024-MORL-MULTIBEAM",
  "userTrained": true,
  "paperFaithful": false,
  "userTrainingMetadata": {
    "jobId": "01HXY...",
    "submittedAtMs": 1747000000000,
    "trainerSubcommand": "baseline",
    "hyperparams": { ... },
    "serviceVersion": "modqn-training-service@0.1.0"
  }
}
```

The consumer parser must read these fields and tag the bundle visibly in
the UI. **Never** display a `userTrained: true` bundle without the tag.

### 3.3 Hyperparameter Allowlist

A server-side schema that defines exactly which CLI overrides are
acceptable from an HTTP caller, with min/max ranges. Out-of-range or
unrecognized fields are rejected with `400 Bad Request`. This prevents:

- 10-million-episode runs that lock up the host.
- Negative learning rates, zero batch sizes, NaN ω.
- Injection of arbitrary CLI flags by a malicious caller.

### 3.4 Job Mutex

A SQLite-backed advisory lock: only one job's status can be `running` at
a time. New `POST /train` requests enter `queued` and the background
runner picks them up FIFO when the current job finishes.

## 4. Rigor Boundaries

### 4.1 Frozen — must not be touched

1. `modqn-paper-reproduction` algorithms, env, reward, MODQN trainer
   code. The service only invokes the CLI; it does not patch the
   trainer.
2. Producer-official artifact directories. The service writes to
   `artifacts/user-trained/<jobId>/`. It must not write into
   `artifacts/baseline-modqn-pilot02-rerun-2026-05-15/`,
   `artifacts/phase-1c-regenerated-7beam-baseline-2026-05-11/`, or any
   other producer-official path.
3. The `bundleSchemaVersion` constant. Service writes the existing
   schema; producer remains the only authority to bump it.
4. Paper claim boundaries in
   `modqn-paper-reproduction/agent-skills/modqn-reproduction-governance/SKILL.md`.
   The service never asserts paper-faithfulness; the bundle's manifest
   says so explicitly.

### 4.2 Tunable — controlled via allowlist

1. `episodes` (allowlist range: 100–5000; default 1000).
2. `learning_rate` (1e-5 to 1e-2; default 1e-3).
3. `discount_gamma` (0.8 to 0.99; default 0.9).
4. `hidden_dim` (32 to 256; default 100).
5. `batch_size` (16 to 256; default 128).
6. `objective_weights` (`(ω_t, ω_h, ω_l)`, each in [0, 1], sum > 0 not
   required by allowlist but recommended UI-side).
7. `seed_triplet` (three ints; default server-generated).
8. `trainer_subcommand` (`baseline` / `ee-modqn` /
   `multi-catfish`). Each subcommand has its own allowlist (ee-MODQN
   may add EE-specific knobs; multi-catfish adds catfish role weights).

### 4.3 Pure presentation

The HTTP service exposes machine-readable status and bundle metadata.
How the consumer displays job state, formats hyperparams, or styles the
artifact picker is presentation-only.

## 5. Architecture Overview

### 5.1 Service location

The HTTP service lives in
`/home/u24/papers/modqn-paper-reproduction/server/modqn_training_service/`.
Reason: it imports `modqn_paper_reproduction.cli` directly to invoke
`train_main`, so it must run in that repo's virtualenv.

The service is **not** part of `modqn-paper-reproduction`'s production
deliverables. It is a development / demo affordance. It must not be
imported by training code or analysis code in that repo.

### 5.2 Component diagram

```
┌───────────────────────────────────────────────────────────────────┐
│  leo-beam-sim (browser)                                           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ src/ui/modqn-training/                                       │  │
│  │ ├─ TrainingForm.tsx (hyperparams + ω)                       │  │
│  │ ├─ JobsPanel.tsx (poll GET /jobs every 10s)                 │  │
│  │ └─ ArtifactPicker.tsx (paper-faithful + user-trained tags)  │  │
│  └─────────────────────────────────────────────────────────────┘  │
│             │ POST /train, GET /jobs, GET /artifacts/<id>/bundle  │
│             ▼                                                      │
└─────────────────────────────┬─────────────────────────────────────┘
                              │ HTTP (localhost only by default)
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│  modqn-paper-reproduction/server/modqn_training_service           │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ FastAPI app (api.py)                                       │   │
│  │ ├─ POST /train: validate, insert queued, return jobId      │   │
│  │ ├─ GET /jobs: list                                         │   │
│  │ ├─ GET /jobs/<id>: detail                                  │   │
│  │ └─ GET /artifacts/<id>/<filename>: static serve            │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Worker loop (worker.py, run via uvicorn lifespan)          │   │
│  │ ├─ pick next queued                                        │   │
│  │ ├─ subprocess.Popen(["modqn-train", ...], start_new_       │   │
│  │ │   session=True, stdout=log, stderr=log)                  │   │
│  │ ├─ poll exit                                               │   │
│  │ ├─ on done: post-process artifact (manifest user-trained=  │   │
│  │ │   true), move to artifacts/user-trained/<jobId>/         │   │
│  │ └─ on failure: capture stderr tail into job row            │   │
│  └────────────────────────────────────────────────────────────┘   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Storage                                                    │   │
│  │ ├─ jobs.sqlite (job rows, FIFO ordering, mutex lock)       │   │
│  │ └─ artifacts/user-trained/<jobId>/                         │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
                              │ filesystem read
                              ▲
┌───────────────────────────────────────────────────────────────────┐
│  modqn_paper_reproduction.cli.train_main (unchanged)              │
└───────────────────────────────────────────────────────────────────┘
```

### 5.3 Subprocess detach contract

The worker invokes:

```python
proc = subprocess.Popen(
    [sys.executable, "-m", "modqn_paper_reproduction.cli", "train",
     "--config", config_path,
     "--episodes", str(hp.episodes),
     "--output-dir", str(artifact_dir / "run"),
     # subcommand-specific flags ...
    ],
    cwd=str(MODQN_REPO_ROOT),
    stdout=open(artifact_dir / "stdout.log", "wb"),
    stderr=open(artifact_dir / "stderr.log", "wb"),
    start_new_session=True,    # detaches from worker's process group
    close_fds=True,
)
job.pid = proc.pid
job.status = "running"
db.commit()
```

After `Popen`, the worker polls `proc.poll()` in a sleep loop (1 s
interval). If the worker process dies and is restarted, the next worker
re-attaches: it reads `job.pid` from `jobs.sqlite`, calls
`os.kill(pid, 0)` to test liveness, and resumes polling if the process
is still alive. If the process is gone but the artifact is present, the
job is marked `done`. If the artifact is missing, the job is marked
`failed` with `errorMessage = "worker restart, subprocess not found"`.

This ensures the **closing the browser does not cancel training**
property of the consumer SDD.

### 5.4 Post-processing pipeline

After the subprocess exits with code 0, the worker:

1. Locates the produced bundle JSON/JSONL files in
   `artifact_dir / "run"`.
2. Reads the manifest and patches in:
   - `userTrained: true`
   - `paperFaithful: false`
   - `userTrainingMetadata.{jobId, submittedAtMs, hyperparams,
     trainerSubcommand, serviceVersion}`
3. Writes the patched manifest back.
4. Validates the bundle by calling
   `modqn_paper_reproduction.bundle.validator.validate_bundle` on it. If
   validation fails, the job is marked `failed` (even though the
   training itself succeeded) and the bundle is moved to
   `artifact_dir / "rejected"`.
5. Updates the job row with `artifactPath`, `status = "done"`,
   `finishedAtMs`.

### 5.5 LRU cleanup

A simple policy: on every job transition to `done`, count
`status = "done"` rows ordered by `finishedAtMs` descending. If the
count exceeds 20, delete the artifact directories of the oldest jobs
and mark their rows `artifactPath = null, status = "expired"`. Failed
or cancelled jobs are not subject to LRU until they age past 30 days,
then are similarly expired.

The thresholds (20 / 30 days) are constants in `cleanup.py`. They can
be overridden by environment variable but must not be a runtime API
input.

## 6. Endpoint Specifications

### 6.1 `POST /train`

Body:

```json
{
  "trainerSubcommand": "baseline",
  "hyperparams": {
    "episodes": 1000,
    "learningRate": 1e-3,
    "discountGamma": 0.9,
    "hiddenDim": 100,
    "batchSize": 128,
    "objectiveWeights": {
      "throughput": 0.4,
      "handover": 0.3,
      "loadBalance": 0.3
    },
    "seedTriplet": [42, 1337, 7]
  }
}
```

Response 202:

```json
{
  "jobId": "01HXYABC...",
  "status": "queued",
  "estimatedStartAtMs": null
}
```

Errors:

- `400 Bad Request` if any field is out of allowlist.
- `409 Conflict` if the global job queue exceeds 10 pending jobs.
- `503 Service Unavailable` if the host's free disk falls below 1 GB.

### 6.2 `GET /jobs`

Query params: `?status=queued|running|done|failed|cancelled&limit=50`.

Response 200:

```json
{
  "jobs": [
    {
      "jobId": "01HXY...",
      "status": "done",
      "submittedAtMs": ...,
      "finishedAtMs": ...,
      "trainerSubcommand": "baseline",
      "hyperparamSummary": "episodes=1000, lr=1e-3, ω=(0.4,0.3,0.3)",
      "artifactPath": "user-trained/01HXY.../bundle"
    },
    ...
  ]
}
```

### 6.3 `GET /jobs/<id>`

Full detail for one job. Same shape as the list entries plus:

- `hyperparams`: full object.
- `errorMessage` if failed.
- `stdoutTail`, `stderrTail`: last 1 KB of each log, for debugging.

### 6.4 `GET /artifacts/<id>/<filename>`

Static-serves files from
`artifacts/user-trained/<jobId>/run/<filename>`. The consumer fetches
the bundle's `manifest.json`, `provenance-map.json`, `timeline/step-trace.jsonl`,
and `evaluation/summary.json` here. Path traversal protection: reject
filenames containing `..`, absolute paths, or paths that resolve outside
the artifact dir.

### 6.5 `POST /jobs/<id>/cancel` (optional, future)

Out of scope for the first cut.

## 7. Database Schema

`jobs.sqlite` (one file, no migrations on first cut):

```sql
CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN
    ('queued', 'running', 'done', 'failed', 'cancelled', 'expired')),
  submitted_at_ms INTEGER NOT NULL,
  started_at_ms INTEGER,
  finished_at_ms INTEGER,
  trainer_subcommand TEXT NOT NULL,
  hyperparams_json TEXT NOT NULL,
  pid INTEGER,
  exit_code INTEGER,
  artifact_path TEXT,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_submitted_at ON jobs(submitted_at_ms);
```

The "single running job" mutex is enforced by the worker selecting
`WHERE status = 'queued' ORDER BY submitted_at_ms LIMIT 1` and only
proceeding if `SELECT COUNT(*) WHERE status = 'running' = 0`.

## 8. Consumer-Side Wiring (Slice S5 of `modqn-omega-handover-sdd.md`)

### 8.1 New UI components

- `src/ui/modqn-training/TrainingForm.tsx`: hyperparam fields, ω inputs,
  trainer-subcommand selector, `Start training` button. On submit:
  POST to backend, stash returned `jobId` in `localStorage` (so the
  user can see their submission history across sessions, even if the
  backend's LRU has expired the row).
- `src/ui/modqn-training/JobsPanel.tsx`: poll `GET /jobs` every 10 s.
  Show queued / running / done jobs. Done jobs have a `Load into scene`
  button.
- `src/ui/modqn-training/ArtifactPicker.tsx`: extends the existing
  bundle artifact selector with the user-trained list. Each user-trained
  entry shows:
  - Backend job id.
  - Submitted at (local time).
  - Hyperparam summary.
  - **Tag**: `user-trained` (warning-amber chip, non-removable).

### 8.2 New consumer types

```ts
// src/modqn/training-trigger/types.ts
export interface TrainingJob {
  readonly jobId: string;
  readonly status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled' | 'expired';
  readonly submittedAtMs: number;
  readonly finishedAtMs?: number;
  readonly trainerSubcommand: 'baseline' | 'ee-modqn' | 'multi-catfish';
  readonly hyperparamSummary: string;
  readonly artifactPath?: string;
}
```

### 8.3 Parser changes

`src/modqn/replay-bundle/loader.ts` adds a permissive read of the new
manifest fields:

```ts
const userTrained = source.userTrained === true;
const paperFaithful = source.paperFaithful !== false; // default true
const userTrainingMetadata = isRecord(source.userTrainingMetadata)
  ? source.userTrainingMetadata
  : undefined;
```

These three fields flow to `ModqnReplayBundleManifest` as optional
properties. Consumer UI reads them; no code path else cares about the
distinction.

### 8.4 Forbidden in consumer

- Consumer must never **claim** a user-trained bundle is paper-faithful.
  All UI that displays a user-trained bundle shows the tag.
- Consumer must never **post** to `POST /train` without going through
  the explicit `Start training` button (no auto-trigger, no URL flag).
- Consumer must never **strip** the `userTrained` tag when loading the
  bundle into the scene.

## 9. Slice Plan

| Slice | Track | Touches | Risk |
|---|---|---|---|
| **B0** | service skeleton | new `server/modqn_training_service/{api,db,worker,cleanup}.py`, FastAPI dep added to `pyproject.toml` | low — additive |
| **B1** | hyperparam allowlist + `POST /train` validation | `server/modqn_training_service/allowlist.py`, unit tests | low |
| **B2** | subprocess spawn + detach + post-process | `worker.py` core loop | medium — file IO + process management |
| **B3** | endpoints `GET /jobs`, `GET /jobs/<id>`, `GET /artifacts` | `api.py` finished | low |
| **B4** | LRU cleanup | `cleanup.py` | low |
| **B5** | consumer wiring (depends on S2 from `modqn-omega-handover-sdd.md`) | `leo-beam-sim/src/ui/modqn-training/*`, `loader.ts` permissive parse | medium — first time consumer talks to backend |
| **B6** | host-side ops doc + systemd / launchd script | `server/modqn_training_service/README.md`, `server/modqn_training_service/scripts/start-service.sh` | low |

### 9.1 Order

B0 → B1 → B2 → B3 → B4 (backend self-contained, can ship without
consumer changes) then B5 (consumer wiring) then B6 (ops doc).

## 10. Acceptance Criteria

### 10.1 B0 — Service skeleton

- `pip install -e ".[server]"` in `modqn-paper-reproduction` installs
  the new optional dependency set including FastAPI and uvicorn.
- `python -m modqn_training_service.api` starts the service on
  `127.0.0.1:8765` (configurable via env var).
- All endpoints return `501 Not Implemented` with a placeholder
  message. The service starts cleanly with no errors.

### 10.2 B1 — Allowlist

- A unit test submits each of the allowed fields at min, max, and
  default, and one out-of-range value per field. The first 3×N pass
  validation; the last N return `400 Bad Request`.
- Unknown fields in the request body return `400`.
- The allowlist code is centralized in `allowlist.py` and is the only
  source of truth.

### 10.3 B2 — Subprocess + post-process

- A submitted `baseline` job with `episodes=100` runs to completion on
  the host with PyTorch installed and a Python virtualenv active.
- The bundle is written to
  `artifacts/user-trained/<jobId>/run/` and its manifest contains
  `userTrained: true, paperFaithful: false, userTrainingMetadata.jobId`.
- Killing the worker process mid-training, then restarting it,
  re-attaches to the running subprocess and continues polling. The job
  completes successfully and is marked `done`.
- A subprocess that exits with a non-zero code is marked `failed`,
  with `stderrTail` populated.

### 10.4 B3 — Endpoints

- `GET /jobs` returns at least the test fixture jobs.
- `GET /jobs/<id>` returns full detail for a known job and 404 for an
  unknown job.
- `GET /artifacts/<id>/manifest.json` static-serves the user-trained
  manifest. Path traversal (`../foo`) returns 400.

### 10.5 B4 — LRU cleanup

- After 25 successful jobs, the oldest 5 are marked `expired` and
  their artifact directories are removed.
- Failed jobs are not LRU-expired until 30 days have passed.
- Cleanup never deletes a job in `queued` or `running`.

### 10.6 B5 — Consumer wiring

- Sidebar shows the training form.
- `Start training` submits to the backend and receives a `jobId`.
- Jobs panel shows the new job in `queued` state, transitions to
  `running` on next poll, then `done` when the subprocess finishes.
- Selecting the done job's `Load into scene` button fetches the
  user-trained bundle, runs the parser, and renders it.
- The artifact picker tags the user-trained entry with the
  warning-amber chip.
- Closing the browser, waiting until the job finishes, reopening:
  the user-trained bundle still appears in the picker.

### 10.7 B6 — Ops

- `README.md` documents:
  - How to install the service.
  - How to start it under systemd (Linux host).
  - How to back up `jobs.sqlite`.
  - How to verify the bundle output directory is correctly mounted.
  - The exact disk-quota assumption (1 GB free).

## 11. Rollback

- B0 reverts by removing the `server/modqn_training_service/` directory
  and the optional dependency set entry in `pyproject.toml`. No data
  loss; user-trained artifacts may be archived manually before deletion
  if any have been produced.
- B1–B4 revert by reverting the per-slice changes. The service
  continues running with reduced functionality (e.g. without LRU after
  reverting B4).
- B5 reverts on the consumer side by removing the new
  `src/ui/modqn-training/*` files and the manifest-permissive parser
  branches. The base bundle parser keeps working on user-trained
  bundles (the new fields are simply ignored).
- B6 reverts by removing the README and the start script.

The backend service is fully optional. If it is not running, the
consumer's training form shows a fetch error; everything else works.

## 12. Resolved Decisions

### 12.1 Service co-located with producer

The service must invoke `modqn-train` and patch its output manifest.
Both happen most cleanly in the producer's virtualenv, so the service
lives in `modqn-paper-reproduction/server/`. It does not live in
`leo-beam-sim`.

### 12.2 SQLite, not Redis / Postgres

Single-host, single-operator demo. SQLite covers the requirement and
needs no extra infra.

### 12.3 No streaming progress in v1

The consumer SDD's premise is "user closes the browser and comes back
later". A periodic `GET /jobs` poll covers that without WebSocket /
SSE complexity. If a future slice adds a live reward-curve view, that
slice can layer SSE on top without redesigning the service.

### 12.4 LRU keeps 20 done jobs

Bounded disk usage on a demo host. The constant is tunable but not via
the HTTP API.

### 12.5 No public-network exposure in scope

Default bind `127.0.0.1`. Public exposure requires an authentication
design that does not exist yet. This SDD will not handwave it.

### 12.6 No artifact promotion path

A user-trained bundle is never promoted to paper-faithful by this
service. If a researcher later decides a user-trained run is worth
preserving as a paper-faithful artifact, they perform that promotion
manually inside `modqn-paper-reproduction` and record it in the
producer governance docs.

### 12.7 Subprocess uses the existing CLI

The service does not import the trainer's internals. It calls
`python -m modqn_paper_reproduction.cli train` with CLI flags. This
keeps the service decoupled from trainer internals and lets future
trainer versions remain compatible.

### 12.8 Bundle schema version is not bumped

User-trained bundles use the existing
`phase-03a-replay-bundle-v1` schema. The new manifest fields are
additive (parser-permissive). If ee-MODQN or Multi-Catfish bumps
schema in producer, this service inherits the new schema by virtue of
running the bumped CLI; no service code change required.

## 13. Forward-Compatibility Notes

- ee-MODQN and Multi-Catfish ship as new `trainerSubcommand` values
  (`ee-modqn` / `multi-catfish`). The allowlist gets a per-subcommand
  branch with the subcommand's specific hyperparams (e.g.
  Catfish-role pressure schedule). No service architecture change.
- If the producer adds new CLI flags for an existing subcommand, the
  allowlist's per-subcommand branch updates. Existing client requests
  with the old fields still work (the new fields default).
- If the producer ships a new bundle schema (`phase-03a-replay-bundle-v2`),
  the consumer parser branch lands in `loader.ts`. This service writes
  whatever schema the trainer emits; the patched manifest fields go in
  the same place.

## 14. Immediate Next Implementation Tasks

Recommended order:

1. Land Slice S2 of `docs/modqn-omega-handover-sdd.md` first. The
   consumer needs the bundle-fetch path before the training form is
   meaningful.
2. B0 — Service skeleton, then B1 → B2 → B3 → B4.
3. B5 — Consumer wiring.
4. B6 — Ops doc.

B0–B4 can be developed in `modqn-paper-reproduction` without touching
`leo-beam-sim`. The two repos meet at B5.
