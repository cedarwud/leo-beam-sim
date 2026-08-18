# Leo simulator current handoff: archived TLE and canonical EE

Status: **COMPLETE TWO-HOUR ARCHIVED-TLE RUN PUBLISHED ATOMICALLY / BROWSER VERIFIED**

Date: 2026-08-13

## 1. Active outcome

Complete two non-heavy workstreams in `/home/u24/demo/leo-beam-sim`:

1. OneWeb／Starlink and date/time selection over the available TLE archives,
   with one frozen publication and a complete two-hour TLE-derived SGP4 run;
   and
2. one canonical angle-aware EE state feeding SINR, EE, Power, and Throughput.

Do not implement an energy-saving policy or Phase-1 platform upload. Those
directions are explicitly unresolved.

## 1.1 Implemented checkpoint

Baseline implementation commit: `c9f8982` (`feat: add archived TLE canonical EE simulator`).
The homepage side-rail follow-up described below is currently an uncommitted
checkpoint in the shared dirty worktree; no commit or push was requested.

The formal simulator route is:

```text
/simulator
```

The `/` homepage retains the established three-column visual shell and central
main/campus scene. One lifted archived-TLE run feeds the centre and canonical side rails:
the left rail contains the OneWeb／Starlink and Asia/Taipei time selectors plus
every genuinely editable or fixed calculation parameter; the right rail shows
the same-frame serving/candidate comparison and all final
`SINR / Power / Throughput / EE` result groups in an independently collapsible
stack. Left input-tab changes do not alter right-rail expansion state, scroll
position, or result visibility. The homepage centre receives the same
last-accepted immutable frame and projects its selected satellite, same-frame
candidate, and bounded visible context set into the
existing campus sky-dome. Starlink is the default and
OneWeb remains selectable. Frame IDs remain internal on the homepage and
visible on `/simulator`.

The centre does not mount `useSimulation`, Walker propagation, the handover
manager, or the legacy cell schedule. It converts TEME to Earth-fixed at the
selected run anchor, derives look angles from the canonical NTPU observer, and
only then maps to the campus coordinates. Campus, UE, UAV, and the
selected/candidate seven-cell beam volumes are display substrate only. The
dedicated `/simulator` route remains the
Earth/orbit sphere renderer and full provenance workspace.

The homepage reuses readable GLB satellite models and the mature oblique
cell-cone／footprint renderer, but never their old Walker, hopping, or handover
producers. Every visible satellite position comes from a fully-published SGP4
anchor or cubic-Hermite interpolation of adjacent anchor position-and-velocity
vectors followed by NTPU look-angle reprojection. Context satellites have zero
beams; selected and a real same-instant candidate each render only the fixed
seven-cell comparison fan. The display substrate is a faint radius-two
honeycomb of 19 cells, with seven dispersed, pairwise non-adjacent active
cells at axial coordinates `(0,0)`, `(2,0)`, `(2,-2)`, `(0,-2)`, `(-2,0)`,
`(-2,2)`, and `(0,2)`. All 100 display UEs are assigned to an active cell and
move with that cell; no hopping is mounted. Continuous trajectory and
ground-to-satellite centre lines are intentionally absent.

The serving/candidate block shows SINR, elevation, and range, then compares
`p_req`, `P_DL_actual`, and `R_u`. When neither counterfactual link is capped,
target tracking may make both realized SINR values equal even though their
required powers differ; the visible explanation must remain with that table.

Neither rail exposes direct `P_t/maxTxPowerDbm`, editable `P_DL_actual`, or a
page-local teaching power/rate formula. The left rail must expose every
genuinely editable input used by the canonical frame; all derived values,
including `p_req`, `P_DL_actual`, SINR, throughput, and EE, remain read-only.
The homepage centre, side rails, and `/simulator` projections consume the same
accepted immutable frame within their respective route. `/simulator` renders
the Earth/orbit form; the homepage renders the campus sky-dome form.

The historical `/course/c120` surface is direct-route only. It has no entry
control on `/` or `/simulator`; retain it as recoverable history unless a later
owner decision authorizes removal of the route together with its tests,
materializer scripts, and bundled assets.

The obsolete homepage classroom experiment chain has been removed end to end:
no teaching ledger, 50/35 dBm matched-arm comparison, T1-T6 capture/export
state, right-side cards, hidden legacy energy tab, or generator runs in the
active application. Homepage evaluation EE is the run-local ratio of delivered
bits to consumed joules over 240 fixed 30-second intervals. This is a cleanup
of the superseded classroom path, not a second energy formula.

Implemented surfaces:

- `public/tle-archive/oneweb/`: 363 Git-LFS OneWeb snapshots plus a
  content-addressed catalog with per-file epoch bounds;
- `public/tle-archive/starlink/`: 360 valid Git-LFS Starlink snapshots plus a
  catalog that records the one content-addressed invalid-source exclusion;
- `src/tle/**`: fail-closed archive validation, deterministic newest-prior
  resolution, Asia/Taipei conversion, full-catalog SGP4 RunBundle, and
  real-pass diversity planning;
- `src/analysis/canonicalEe/**`: frozen Family-B canonical EE producer and
  ratio-of-sums evaluation API;
- `src/simulator/**`: atomic complete-run composer, immutable shared analysis
  frames, run-local EE evaluation, TLE-derived 3D trajectory, and exactly four
  formal projections; and
- `src/main.tsx`: `/simulator` mounts the full formal workspace, while the bare
  product entry mounts the compact three-column shell whose centre and side
  rails consume the canonical producer.

The browser scenario is deliberately explicit: one NTPU reference geometry,
seven fixed active beams over the seven dispersed active axial cells listed
above, 100 UEs
with per-beam loads `[15, 15, 14, 14, 14, 14, 14]`, complete `U x B`
angle/channel matrices, and an explicitly uncalibrated local geometry mapping.
Physical noise is derived from editable `T_ant`, `NF`, `T_0`, `B_sys`, and
`K_FR`; `T_sys`, `B_beam`, and `sigma^2` are retained as read-only derived
terms. The adapter makes cap effects observable but is not a paper-scenario or
RF link-budget reproduction. The canonical EE algebra itself remains the
frozen contract.
The adapter makes cap effects observable but is not a paper-scenario or RF
link-budget reproduction. The canonical EE algebra itself remains the frozen
contract.

## 2. Required reading

In order:

1. `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
2. `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md`
3. `/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`
4. the active runtime and frozen conformance cases in
   `/home/u24/papers/modqn-paper-reproduction`
5. repository instructions, `README.md`, and affected source/tests

ADR-004 and the C-120 LoRaEnergySim documents are historical only.

## 3. Environment snapshot and ownership

At authority freeze:

- local `main` contains broad unrelated presentation/course WIP;
- the existing C-120 next-controller handoff is already modified and must not
  be overwritten;
- the server checkout is on
  `feat/c120-lora-course-package-v1-20260811`, with an active controller and
  broad dirty C-120/LoRa WIP; and
- the server branch is not the implementation base for this direction and
  must not be merged automatically.

Preserve all unrelated WIP. Stage only exact owned paths. Do not use
`git add .`, `git add -A`, `commit -a`, reset, stash, restore, clean, or force
push.

## 4. Implementation record

The verified TLE sources are `/home/u24/demo/tle_data/oneweb/tle` and
`/home/u24/demo/tle_data/starlink/tle`, spanning 2025-07-27 through 2026-08-08.
OneWeb contributes 363 valid snapshots. Starlink contributes 360 valid browser
snapshots from 361 source files; `starlink_20260528.tle` is excluded as a whole
because source line 15197 is 70 columns. Its exact SHA-256 and reason live in
the generated catalog. Treat the source repository as read-only; the browser
must consume generated manifests rather than filesystem discovery.

Legacy scene modules still contain custom Walker/Kepler propagation for
historical lanes, but the active `/` homepage TLE centre does not mount that
runtime. It consumes `SimulationAnalysisFrame.tleState` through
`homepageTleSceneAdapter.ts`. Historical C-90 selectors replay precomputed
bundles and are not an active implementation donor.

The historical live Walker power path writes the SINR `maxTxPowerDbm` control into the
profile, lets `src/engine/signal/link-budget.ts` calculate SINR, and only then
lets `src/teaching/beamshiftCanonicalEe.ts` calculate a partial power ledger.
It therefore omits the required `gamma_req -> p_req -> cap -> actual P_DL`
upstream closure. `src/course/c120/backend/canonicalRuntime.ts` is the closest
TypeScript science donor, but its course binding is historical. The active
neutral producer is already implemented under `src/analysis/canonicalEe/**`;
the historical live path must remain quarantined from the formal homepage.

Completed execution order:

1. inventoried the existing TLE and EE runtime paths;
2. froze shared types and conformance fixtures;
3. implemented and tested archive resolution and SGP4;
4. implemented and tested the canonical EE producer;
5. integrated both into one immutable `SimulationAnalysisFrame`;
6. exposed `P_beam_max` instead of an independent actual-power `P_t`;
7. mounted SINR, EE, Power, and Throughput projections; and
8. kept the established homepage campus/camera shell while wiring the
   canonical archived-TLE frame to both the centre and side rails;
9. produced a serving link and bounded same-instant candidate link atomically;
10. replaced the legacy right-side state with canonical serving/candidate and
    formula-term projections; and
11. added the full-catalog 241-anchor RunBundle and deterministic real-pass
    diversity planner;
12. added the immutable two-hour analysis-run composer and 240-interval EE
    evaluation;
13. replaced the homepage Walker timeline with a ready-only TLE timeline whose
    canonical anchors and step controls remain 30 seconds apart while its
    completed-run scrubber exposes one-second bounded visual interpolation, and
    removed irrelevant handover quick controls; and
14. separated draft constellation/time edits from an explicit Apply action;
    Apply clears the centre and results, locks the timeline, and republishes both
    surfaces only after the complete run validates; and
15. ran focused tests, production build, and fresh-browser validation.

## 5. Parallel ownership

Safe parallel work after inspection:

- TLE worker: new `src/tle/**` archive adapter/resolver/SGP4 modules and tests
  only; it must not modify `src/engine/orbit/**`;
- EE worker: new `src/analysis/canonicalEe/**` producer and conformance tests
  only;
- controller: shared types, application state, routing/tabs, migration of
  existing controls, browser validation, commits, and push.

Workers are not alone in the repository. They must not modify dirty course,
presentation, C-120, shared app, or another worker's paths.

## 6. Scientific invariants

- Actual `P_DL` is derived from required power and canonical caps.
- SINR and consumed PA power use the same actual `P_DL`.
- Throughput uses the same realized SINR.
- EE uses the same throughput numerator and full canonical power denominator.
- Evaluation EE is accumulated bits divided by accumulated joules.
- Legacy or teaching formulas do not feed formal pages.
- TLE selection is archived SGP4 evidence, not live telemetry.
- TLE switching is not handover and is not energy-saving evidence.
- Each accepted frame owns seven active beams and 100 UEs with the fixed load
  vector `[15, 15, 14, 14, 14, 14, 14]`, not one scalar reference-user load.
- `B_beam = B_sys / K_FR`, `T_sys = T_ant + T_0(10^(NF/10)-1)`, and
  `sigma^2 = k T_sys B_beam` are derived once and used by the canonical frame.
- Same-colour interference is exposed as `I_intra` and `I_inter`. The current
  seven active beams all belong to the serving satellite, so `I_inter = 0` is
  a derived scenario fact; the candidate is a separate counterfactual, not an
  active interfering satellite.
- The selected and candidate beam apexes and trajectories are TLE/SGP4-derived;
  the radius-two 19-cell ground grid and seven active local display coordinates
  are an uncalibrated fixed experiment substrate. The canonical local scenario
  uses the same active axial coordinates so the computation and display
  topologies remain aligned; these are not TLE-derived physical footprints.
- The candidate column is a same-time, same-parameter single-link
  comparison and the candidate input to the separately accepted ADR-006
  decision trace. The completed TLE run now owns the 3 dB offset, 30-second
  TTT, decision state, and cumulative count; frames without a completed trace
  still fail closed.

## 7. Verification evidence

Verified on 2026-08-13:

- `npm run test:active-simulator` passes archive integrity, TLE boundary,
  timezone, SGP4, Python-vector parity, cap, zero, ratio-of-sums, snapshot selection,
  and shared-frame tests;
- 2 x 651 all-satellite resolution and propagation measured about 10 ms after
  removing repeated manifest validation;
- `npm run build` passes;
- focused RunBundle, pass-planner, TLE analysis-run, 30-second timeline,
  observer, homepage ownership, and timeline-authority tests pass;
- the checked-in Starlink `20260808` publication produced 10,760 satellites at
  241 anchors in about 2.74 s using about 118.71 MiB of private typed arrays;
- complete Starlink pass planning and EE evaluation produced 3,597 real passes,
  17 selected service passes, 210 candidate-bearing anchors, two explicitly
  marked boundary geometry fallbacks, and zero unavailable anchors; the full
  local request completed in about 9.62 s;
- a fresh Chromium session at `/simulator` showed all four projections with
  zero console errors;
- changing `P_beam_max` from 2 W to 1 W changed the shared actual `P_DL` from
  2 W to 1 W and propagated into SINR, throughput, and EE;
- changing 2026-08-08 to 2026-03-01 changed the TLE frame, selected satellite,
  TLE epoch, trajectory, and analysis frame atomically;
- the homepage selected Starlink by default and switched atomically to OneWeb;
  the centre and right-side canonical results changed from the same accepted
  TLE frame while the established central main/campus scene remained intact;
- a second-level time change moved the selected satellite and updated centre
  and right-rail identities atomically;
- centre/right analysis frame ID, TLE frame ID, selected satellite, instant,
  and selected TEME position and velocity matched after every accepted switch;
- every accepted canonical frame contains seven active beams, 100 assigned
  UEs, the `[15, 15, 14, 14, 14, 14, 14]` load vector, and complete `U x B`
  angle/channel matrices;
- the default physical-noise derivation produced read-only `T_sys`, `B_beam`,
  and `sigma^2` from `T_ant`, `NF`, `T_0`, `B_sys`, and `K_FR`; changing an RF,
  noise, or reuse input changed the canonical frame/results while preserving
  the accepted TLE geometry;
- same-colour interference was reported as `I_intra` and `I_inter`, with the
  current single-satellite seven-beam scenario yielding derived `I_inter = 0`;
- a fresh homepage Chromium run captured an in-flight OneWeb-to-Starlink
  switch at 44/241 anchors: the previous OneWeb centre/right frame remained
  identical, the timeline was locked, and only the requested source changed;
  after completion the centre and right rail atomically shared the new Starlink
  frame and the timeline unlocked;
- while that run was incomplete, every transport control (play, speed, step,
  jump, and scrubber) was disabled and the programmatic selector failed closed;
- seeking the final 7,200-second anchor produced the identical centre/right
  frame, UTC instant, and selected satellite, with 24 same-instant context
  satellites, zero context beams, and no Earth sphere;
- the homepage serving/candidate card published the selected satellite and a
  same-frame above-horizon candidate from the canonical producer, while
  handover-only fields stayed non-numeric;
- the homepage retained its campus substrate and camera interaction without
  mounting the Walker/handover runtime;
- an unavailable pre-archive instant preserved the prior accepted frame and
  displayed the refusal; and
- a 390 px browser viewport had equal scroll/client width and no horizontal
  overflow.

The 2026-08-14 S0 maintenance pass closed both inherited aggregate red gates.
`npm run test:simulator` now passes after separating the formal editable-input
ownership map from three compatibility-only channel fields. The latest
thesis-form SINR UI remains authoritative: `channelGainScale`, scintillation,
and shadow are not restored as inert controls, while the four canonical EE
energy-consumption inputs remain editable.

`validate:s0:geometry-trace` was rebaselined only after the 1610 differences
were classified against committed `9d38a13`: 1440 display-satellite coordinate
changes came from the documented 1.5 display-altitude lift, 137 truth changes
came from deterministic per-satellite beam-schedule de-phasing, and 33 display
changes were downstream beam/label projections. Run-twice determinism,
perturbation detection, the coordinate-authority gate, and the full live-cell
model gate all pass. The prior fixture SHA-256 was
`53c51b7bed5669c5be1d35c5e389771dadbdf14a43da702365fbc5d33d2ec859`;
the audited replacement is
`b08c0dae11d8da72110d65af22d70b7d88ff3034fc54c504e29826c656090627`.

## 8. Remaining limits

- Evaluation EE is a run-local ratio-of-sums over 240 fixed intervals and is
  not a persisted experiment artifact.
- The normalized geometry/channel adapter is not a calibrated RF link budget
  and is not a claim of reproducing the thesis scenario.
- TLE/SGP4 owns geometry only. Carrier frequency, the formal atmospheric
  coefficient, and receive gain are independent left-rail experiment inputs;
  they rebuild the same canonical `H`/`G^R`/power/SINR/throughput/EE frame and
  start a new evaluation condition. The legacy `channelGainScale`,
  scintillation, and shadow fields remain serialization compatibility only;
  the formal thesis adapter ignores them and the UI exposes no controls for
  them.
- The physical-noise path is present, but remains an uncalibrated simulator
  sensitivity model: `T_ant`, `NF`, `T_0`, `B_sys`, and `K_FR` are editable;
  `T_sys`, `B_beam`, and `sigma^2` are derived. The canonical payload boundary
  does not claim measured receiver hardware.
- The current seven-beam frame has one active satellite owner, so
  inter-satellite interference is structurally zero. A true simultaneous
  multi-satellite active-beam assignment is not yet claimed; the candidate
  satellite remains a separate same-instant counterfactual.
- The radius-two 19-cell grid and its seven dispersed active cells are
  display-only experiment substrate, not TLE-derived physical footprints. All
  100 UEs move with their assigned active cell. Only the selected/candidate
  beam apex motion is TLE-derived; context satellites own zero beams and no
  hopping is mounted.
- The homepage campus projection is a compressed display mapping, not a
  calibrated physical-distance rendering. TEME provenance remains available,
  and the adapter performs the required Earth-fixed/topocentric conversion.
- The canonical payload-power boundary excludes bus, TT&C, thermal, and other
  whole-spacecraft terms.
- Energy-saving policy, baseline/candidate evidence, and Phase-1 platform
  integration remain unresolved and unimplemented.
- The repository-wide Phase 8B validator currently also pins older typography
  literals (`14/17/18/27`) while the checked-in token authority is
  `16/19/20/29`; treat that maintenance drift separately from simulator
  formula or runtime verification.
