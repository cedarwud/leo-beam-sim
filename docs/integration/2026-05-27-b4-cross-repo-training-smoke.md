# B4 Cross-Repo Training Artifact Smoke

## Status

Passed on 2026-05-27.

## Scope

This smoke validates the Track-2 user-trained artifact path from
`modqn-paper-reproduction` into `leo-beam-sim`:

- producer service starts locally and accepts a small sensitivity sweep;
- job, batch, SSE, manifest, raw metadata, and replay bundle endpoints remain
  reachable;
- `leo-beam-sim` loads the artifact as a consumer/viz-only replay source;
- claim labels remain user-trained exploration evidence, not paper-faithful
  baseline evidence.

## Backend Contract Patch

The producer service needed two small live-demo contract additions:

- `GET /health` returns service reachability and
  `modqn-training-service@0.1.0`.
- CORS allows the Vite demo origins `http://127.0.0.1:5173` and
  `http://localhost:5173`.

These additions are in
`/home/u24/papers/modqn-paper-reproduction/src/modqn_training_service/api.py`.

## Smoke Inputs

Successful run:

- `jobId`: `01KSMRP0M9891SDHHVVRRDRP83`
- `batchId`: `01KSMRP0M99ZXSYC61S9A419BB`
- Track-2 arm: `a1`
- Episodes: `100`
- Seed triplet: `[42, 1337, 7]`
- Satellites: `4`
- Beams per satellite: `7`
- UE count: `10`
- UE area: `uniform-rectangle`, `200 km x 90 km`
- Beamwidth: `theta3dbDeg=2`
- Truth altitude: `780 km`

A previous 50-UE attempt was intentionally terminated to avoid turning the
integration smoke into a long CPU run. That aborted attempt was not a contract
failure.

## Endpoint Evidence

The successful run verified:

- `GET /health` -> `200`
- `GET /jobs` -> contained `01KSMRP0M9891SDHHVVRRDRP83`
- `GET /jobs/01KSMRP0M9891SDHHVVRRDRP83` -> `status=done`, `exitCode=0`
- `GET /jobs/01KSMRP0M9891SDHHVVRRDRP83/stream` -> emitted
  `heartbeat`, `progress`, and `done`
- `GET /batches/01KSMRP0M99ZXSYC61S9A419BB` -> `status=done`,
  `counts={done:1}`
- `GET /artifacts/01KSMRP0M9891SDHHVVRRDRP83/manifest.json` -> `200`
- `GET /artifacts/01KSMRP0M9891SDHHVVRRDRP83/raw-run/run_metadata.json`
  -> `200`
- `GET /artifacts/01KSMRP0M9891SDHHVVRRDRP83/replay-bundle/manifest.json`
  -> `200`
- `GET /artifacts/01KSMRP0M9891SDHHVVRRDRP83/replay-bundle/provenance-map.json`
  -> `200`
- `GET /artifacts/01KSMRP0M9891SDHHVVRRDRP83/replay-bundle/timeline/step-trace.jsonl`
  -> `200`

Replay bundle manifest evidence:

- `bundleSchemaVersion=phase-03a-replay-bundle-v1`
- `satelliteCount=4`
- `beamCountPerSatellite=7`
- `totalBeamCount=28`
- `rowCount=100`
- `slotCount=10`

## Consumer Load Evidence

Direct `leo-beam-sim` service-client load path:

- `fetchTrainingServiceManifest` succeeded.
- `fetchTrainingRunMetadata` succeeded.
- `fetchUserTrainedBundleEnvelope` succeeded.
- `createModqnReplayPlaybackShellModel` produced:
  - `modeKey=modqn-user-trained`
  - `evidenceStatus=user-trained`
  - `sourcePath=user-trained:01KSMRP0M9891SDHHVVRRDRP83`
  - `rowCount=100`
  - `slotCount=10`
  - `diagnosticsStatus=present-from-producer`
  - `validationIssue=null`

Scene profile mapping from producer truth produced:

- rendered satellite total: `4` (`planes=4`, `satsPerPlane=1`)
- beam count per satellite: `7`
- UE count: `10`
- beamwidth: `2 deg`
- altitude: `780 km`
- UE distribution: `uniform-rectangle`, `200 km x 90 km`
- UE distribution seed: `7`

Browser ArtifactPicker smoke passed at `http://127.0.0.1:5173/`:

- app mode: `modqn-demo`
- ArtifactPicker displayed `user-trained`, `exploration`, `paperFaithful false`
- selected row displayed `a1`, `4 sat`, `7 beam`, `10 UE`,
  `seed 42/1337/7`, and `replay yes`
- clicking `Load into scene` produced the `Revert to paper-faithful` control
- canvas was present with `data-handover-criterion=decision-overlay-on-live-sinr`
- backend artifact fetches returned `200`
- browser console errors: `0`
- page errors: `0`
- screenshot: `output/b4-artifact-picker-smoke.png`

## Claim Boundary

The loaded artifact remained:

- `artifactTag=user-trained`
- `claimMode=exploration`
- `paperFaithful=false`
- `effectivenessClaimAuthorized=false`

`leo-beam-sim` consumed producer truth for display mapping and did not promote
the artifact into paper-faithful baseline or evaluation-mode evidence.

## Checks

Producer-side:

- `.venv/bin/python -m pytest tests/server/test_endpoints.py`
  -> `21 passed`
- `.venv/bin/python -m pytest tests/test_route_alpha_hobs.py::test_g1_sha_matches_live tests/test_route_alpha_hobs.py::test_n2_sha_matches_live`
  -> `2 passed`
- `git diff --check -- src/modqn_training_service/api.py tests/server/test_endpoints.py`
  -> passed

Consumer-side:

- `npm run validate:phase-b:service-client`
- `npm run validate:phase-d:user-trained-bundle-fetch`
- `npm run validate:phase-d:app-wire`
- `git diff --check`

## Runtime Cleanup

The temporary producer backend and Vite dev server used for this smoke were
stopped after validation. No `leo-beam-sim` dev server is intentionally retained
by this smoke.
