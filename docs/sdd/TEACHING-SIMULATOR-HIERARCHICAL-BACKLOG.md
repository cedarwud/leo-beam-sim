# Teaching simulator: hierarchical backlog and review gates

Status: **ACTIVE PLANNING BASELINE / PASS_WI-03 / CONTROLLER_VISUAL_REVIEW_PASS / WAITING_FOR_OWNER_VISUAL_ACCEPTANCE / downstream frozen**  
Date: 2026-08-24  
Scope: reconstruct the teaching-simulator brief, resolve product and truth boundaries, and define a dependency-ordered backlog. Recorded `PASS_WI-03` accepts only the WI-03 Golden Flow structure/truth contract for WI-04 authoring/review; it does not accept product pixels, the current compositor, or the WI-09 full scientific event lesson. Controller visual review of the WI-04 r2 candidate is complete, but owner visual acceptance is pending; all downstream items remain frozen. No science, formula, route, platform, credential, commit, or push authorization is granted.

Review provenance: **round-2 independent review returned `REVISE`; round-3
fresh-context Codex read-only review returned `PASS`; controller recorded
`PASS_WI-00` on 2026-08-23**. The requested Claude Opus max reviewer is recorded
as `OPERATIONAL_FAILURE` after two transport timeouts before inference (input/
output tokens 0); there is no Opus verdict and no silent substitution.

The WI-01 preflight report received an independent fresh-context read-only
`PASS`, and the controller recorded `PASS_WI-01` on 2026-08-24.

The WI-02 unified runtime and visual-acceptance harness received an independent
fresh-context reviewer `PASS`, and the controller recorded `PASS_WI-02` on
2026-08-24. This pass covers the unified runtime/compiler/renderer seam and
the generic fixture/browser acceptance harness only. The current `/simulator`
route remains `PRODUCT_REJECTED_QUARANTINED`; owner acceptance of product
compositor/lesson pixels is not recorded.

The WI-03 Golden Flow storyboard/truth contract received an independent
fresh-context reviewer `PASS`, and the controller recorded `PASS_WI-03` on
2026-08-24. This pass accepts the scene-defined observable event for each beat,
one guided prediction/action, counterfactual isolation, and the fail-closed
restore/source-handover contract. It unlocks WI-04 authoring/review only;
product pixels, compositor/video owner acceptance, and WI-09 full scientific
event acceptance remain unaccepted.

The first fresh Claude Opus max review of the WI-04 r1 candidate returned
`REVISE` with two blockers and three major findings. A second fresh Claude Opus
max review of r2 returned `PASS_WI04_VISUAL_CANDIDATE`; the controller then
inspected the complete r2 contact sheet, key full-resolution PNGs, key/timing
video frames, and browser-gate results, while the complete frame-by-frame
timeline analysis remained with that fresh Opus review, and recorded
`CONTROLLER_VISUAL_REVIEW_PASS / WAITING_FOR_OWNER_VISUAL_ACCEPTANCE`. The
owner has not personally accepted the finished video, so this review does not
unlock WI-05.

The repository contains dirty implementation WIP. Existing dirty WIP remains
preserved, frozen, and quarantined. A single active work-item writer may start only after
fresh writer/path preflight. A worker may not start a downstream item because a route,
test, model, screenshot, or earlier handoff says it is “done”. Every item below
stops at its own review token; only the controller may record `PASS` and unlock
the next item. Machine green is necessary and never sufficient.

## Normative execution/status ledger

This is the current ledger, not a historical claim. `CANDIDATE_EVIDENCE` means
an artifact exists for review; it is not a scientific, visual, route, or owner
PASS. `WIP_FROZEN` means dirty work is preserved but cannot advance. All later
core items are locked until the preceding controller token is recorded.

| WI | Current status | Evidence pointer | Unlock state |
|---|---|---|---|
| WI-00 | `PASS` | this document, round-3 fresh-context Codex read-only review result/provenance | completed; WI-01 review completed |
| WI-01 | `PASS` | `docs/reviews/TEACHING-SIMULATOR-WI-01-PREFLIGHT-2026-08-24.md`; expanded status hash `35bffd1641540f3af4e46612b35196be663e81b6891c7b228da63233476a67e0` | independent reviewer PASS; WI-02 unlocked |
| WI-02 | `PASS` | `docs/reviews/TEACHING-SIMULATOR-WI-02-HARNESS-2026-08-24.md`; independent fresh-context reviewer PASS | unified runtime/harness accepted; `/simulator` remains quarantined; product compositor/lesson pixels unaccepted; WI-03 unlocked |
| WI-03 | `PASS` | `docs/sdd/VISUAL-FIRST-GOLDEN-FLOW-STORYBOARD.md`; `docs/reviews/TEACHING-SIMULATOR-WI-03-TRUTH-CONTRACT-2026-08-24.md` | independent fresh-context reviewer PASS; controller `PASS_WI-03`; structure/truth contract accepted for WI-04 only; no product pixels or WI-09 full event acceptance |
| WI-04 | `CANDIDATE_EVIDENCE` | `docs/reviews/TEACHING-SIMULATOR-WI-04-COMPOSITOR-VIDEO-2026-08-24.md`; `output/playwright/golden-flow/` r2 artifacts and hashes | `CONTROLLER_VISUAL_REVIEW_PASS / WAITING_FOR_OWNER_VISUAL_ACCEPTANCE`; scientific event evidence incomplete; WI-05 remains `WIP_FROZEN` |
| WI-05 | `WIP_FROZEN` | dirty route WIP under `src/course/nav/**` and route tests | official-entry PASS not recorded |
| WI-06 | `CANDIDATE_EVIDENCE` | `docs/sdd/VISUAL-FIRST-GLOBAL-CONSTELLATION-STORYBOARD.md` and global output candidates | locked pending `PASS_WI-05`; owner acceptance not recorded |
| WI-07 | `NOT_STARTED` | no accepted raw→parse→SGP4 teaching bundle | locked |
| WI-08 | `NOT_STARTED` | no accepted full off-axis action/restore bundle | locked |
| WI-09 | `NOT_STARTED` | no accepted source-backed inter lesson bundle | locked |
| WI-10 | `NOT_STARTED` | no accepted multi-candidate source/ranking fixture | locked |
| WI-11 | `NOT_STARTED` | no accepted intra-handover fixture/lesson | locked |
| WI-13 | `NOT_STARTED` | no accepted current-power-path reconciliation/preregistration | locked |
| WI-14 | `NOT_STARTED` | no accepted EE visual lab | locked |
| WI-15 | `NOT_STARTED` | no accepted platform schema/dry-run bundle | locked |
| WI-16 | `NOT_STARTED` | no owner-verified live registration/auth/query-back evidence | locked; eventual requirement |
| WI-17 | `NOT_STARTED` | no final 12–15 min/full lesson package | locked |
| WI-18 | `NOT_STARTED` | no full-course acceptance bundle | locked |
| EXT-01 | `NOT_STARTED` | optional forced-continuity evidence does not exist as a core deliverable | never unlocks core work |

The evidence-ledger record required for every review is:

```text
WI: <ID>
prerequisite token: <exact prior PASS_WI-* token or NONE>
current status: <one allowed status>
artifacts: <exact paths, hashes, viewport/DPR, command/browser evidence>
reviewer: <independent read-only reviewer/runtime>
controller decision: <PASS / REVISE / BLOCKED_OWNER / REJECTED + rationale>
next token: <exact PASS_WI-* token, or NONE>
```

Recorded WI-00 evidence-ledger entry:

```text
WI: WI-00
prerequisite token: NONE
current status: PASS
artifacts: this document + round-3 review result/provenance; no unavailable external transcript path invented
reviewer: fresh-context Codex read-only
controller decision: PASS_WI-00 — requirements/backlog freeze is complete; implementation remained frozen at PASS_WI-00 and was superseded only for exact WI-02 harness scope by later PASS_WI-01
next token: PASS_WI-01
```

Recorded WI-01 evidence-ledger entry:

```text
WI: WI-01
prerequisite token: PASS_WI-00
current status: PASS
artifacts: docs/reviews/TEACHING-SIMULATOR-WI-01-PREFLIGHT-2026-08-24.md; expanded status hash 35bffd1641540f3af4e46612b35196be663e81b6891c7b228da63233476a67e0
reviewer: independent fresh-context Codex read-only
controller decision: PASS_WI-01 — preserve QUARANTINE/REJECT boundaries; unresolved formula-authority conflict remains BLOCKED_OWNER for WI-13
next token: PASS_WI-02
```

Recorded WI-02 evidence-ledger entry:

```text
WI: WI-02
prerequisite token: PASS_WI-01
current status: PASS
artifacts: docs/reviews/TEACHING-SIMULATOR-WI-02-HARNESS-2026-08-24.md; visual-contract-fixture.html; output/playwright/visual-contract/{valid.png,bad-overlap.png,bad-unmarked.png,bad-ancestor-hidden.png,bad-allowed-decoration-oversize.png,bad-allowed-decoration-shadow.png,contact-sheet.png,current-simulator-quarantine.png,machine-report.json,architecture-report.json}; 1920x1080 DPR1 plus responsive 320x720 DPR1; exact artifact hashes are recorded in the report; focused tests, TypeScript, 15-check architecture validator, and isolated browser validator are green
reviewer: independent fresh-context reviewer — PASS
controller decision: PASS_WI-02 — unified runtime/compiler/renderer seam and generic visual-acceptance harness accepted; `/simulator` remains PRODUCT_REJECTED_QUARANTINED and owner product compositor/lesson pixels remain unaccepted
next token: PASS_WI-03
```

Recorded WI-03 evidence-ledger entry:

```text
WI: WI-03
prerequisite token: PASS_WI-02
current status: PASS
artifacts: docs/sdd/VISUAL-FIRST-GOLDEN-FLOW-STORYBOARD.md; docs/reviews/TEACHING-SIMULATOR-WI-03-TRUTH-CONTRACT-2026-08-24.md; src/prototype/golden-flow/goldenFlowDirector.ts; src/prototype/golden-flow/goldenFlowDirector.test.ts; focused director test PASS; npx tsc --noEmit PASS
reviewer: independent fresh-context reviewer — PASS
controller decision: PASS_WI-03 — scene-defined observable event each beat, one guided prediction/action, counterfactual isolation, and fail-closed restore/source-handover contract accepted for WI-04 authoring/review; owner/compositor pixel acceptance remains WI-04 and full scientific source-backed event acceptance remains WI-09
next token: CONTROLLER_VISUAL_REVIEW_PASS / WAITING_FOR_OWNER_VISUAL_ACCEPTANCE
```

Normative controls: `NO_AUTO_UNLOCK` and `NO_AUTO_ROUTE_ADVANCE`. Autoplay is
presentation behavior only. A worker, test, autoplay timer, or official route
must not unlock or advance a core item without the controller's exact PASS
token, except for a declared learner gesture inside the currently accepted
beat. A learner gesture advances a beat; it never advances the implementation
backlog or route migration.

There are two different orders:

* **Learner journey order:** Global constellation → TLE journey → Off-axis lab → Handover theatre → EE experiment → Platform record.
* **Implementation dependency order:** requirement/truth freeze → visual acceptance harness → golden-flow truth contract → 60–90 s visual pilot and owner pixel review → route integration → science-backed scenes and experiments → platform adapter → recording/deck → end-to-end review.

Forced-continuity comparison is `EXT-01 OPTIONAL_NOT_IN_FULL_COURSE`: it may
start only after the full core PASS and never unlocks EE, platform, recording,
or full-course work.

The first order is what a student experiences. The second is the only order in
which workers may implement. A later learner act may be storyboarded early, but
its UI cannot run ahead of the scientific and visual prerequisites in the second
order.

## 1. Authority and precedence

### 1.1 Product and teaching authority

The current user brief and every correction in the correction ledger below are
the product/UX authority. The user has explicitly rejected the existing
student-facing dashboard/compositor as a base. The product is a visual,
animation-led teaching simulator for learners with no satellite or
communications background; text is a transient aid to a visible event, not a
reading assignment.

### 1.2 Active simulator/scientific authority

For the active simulator, use the following precedence:

1. current accepted owner rulings/newer scientific authority where explicitly
   documented;
2. [`ADR-005`](../decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md),
   which establishes archived-TLE selection, SGP4 publication, one immutable
   frame, and the canonical EE boundary (not an energy-saving policy);
3. the active TLE/canonical EE SDD
   ([`TLE-CANONICAL-EE-SIMULATOR-SDD.md`](TLE-CANONICAL-EE-SIMULATOR-SDD.md));
4. the current handoff
   ([`LEO-SIM-CURRENT-HANDOFF-2026-08-11.md`](../handoff/LEO-SIM-CURRENT-HANDOFF-2026-08-11.md));
5. [`ADR-007`](../decisions/ADR-007-scientific-experience-and-figure-mode.md)
   for evidence/presentation separation and source-backed explanatory pairs;
6. [`ADR-009`](../decisions/ADR-009-unified-composable-energy-visualization-scene.md)
   for one composable scene, presentation presets, progressive disclosure, and
   the causal link between scene, formula, and result.

ADR-005 explicitly keeps policy-level energy saving and Phase-1 platform
mapping unresolved (ADR-005, lines 180–191). The external canonical EE
authority remains the authority for algebra, units, aggregation, zero behavior,
and power boundary; this document does not rewrite it. The accepted newer
scientific ruling recorded in
[`CONTROLLER-RULINGS-SIX-ACTS-2026-08-22.md`](../CONTROLLER-RULINGS-SIX-ACTS-2026-08-22.md)
overrides older six-act demo constants only where that ruling says so. Any
unresolved conflict is `BLOCKED_OWNER`, not a worker choice.

### 1.3 Evidence and presentation authority

ADR-007 and ADR-009 govern the evidence/presentation split. ADR-007 says that a
route cannot pass by showing one frozen calculation, a camera tour, or unrelated
panels that merely share a frame ID (ADR-007, lines 24–50). The visual-first
storyboards are candidates for this new compositor, not proof of overall course
completion:

* [`VISUAL-FIRST-GOLDEN-FLOW-STORYBOARD.md`](VISUAL-FIRST-GOLDEN-FLOW-STORYBOARD.md)
  is a 60–90 s target and explicitly rejects the six-act student compositor;
* [`VISUAL-FIRST-GLOBAL-CONSTELLATION-STORYBOARD.md`](VISUAL-FIRST-GLOBAL-CONSTELLATION-STORYBOARD.md)
  is a candidate geometry lesson with honest limits: it is not TLE parsing,
  handover, EE, or platform integration.

### 1.4 Donor/history boundary

`docs/six-acts-teaching-design-proposal.md`,
`docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md`, and
`docs/handoff/teaching-cinema-handoff-2026-08-22.md` are donor/history records.
They may supply model adapters, archived artifacts, truth-source names,
terminology, or reusable assets after a current gate approves them. They are
**not** current authorities for the compositor, persistent chrome, navigation
IA, page order, or student reading surface. In particular:

* retain model/provenance/director helpers only when they map to the current
  evidence boundary;
* supersede their persistent six-act nav, rails, course-outline cards,
  dashboard panels, and “all beats render, CSS hides it” composition;
* retain old route semantics only as quarantined history; never allow legacy
  required-SINR, requested-power, cap, or invented handover semantics to flow
  back into the active lesson;
* use `/prototype/scientific-explain-legacy-3d` for visual language only:
  spatial proportion, light, particles, and labels. Its old numerical meaning
  is not an authority.

### 1.5 Platform boundary

`/home/u24/papers/platform/intro.md` is two lines of course motivation: TLE
path/elevation experiments, dynamic connection/mobility management, and energy
optimization. It does not redefine equations or authorize a platform schema.
The platform field-extension document is a proposal: it suggests per-second
`CURRENT_SINR`, `BEST_CANDIDATE_SINR`, `SINR_GAIN`, event flags, and run-end
`LOW_SINR_RATIO` in addition to existing `NUM_HANDOVERS`; registrations and
type codes still require current owner verification. The operator kit confirms
that credentials stay in environment variables, A/B identity and energy-field
registration are owner decisions, a single active arm is the current limit,
JSON/CSV is the fallback, and HTTP 200 proves request acceptance only. See
`/home/u24/papers/platform/leo-sinr-platform-field-extension.md` and
`/home/u24/papers/platform/beamshift-course-operator-kit/README.md`.

## 2. Reconstructed original requirement ledger

Stable IDs are used throughout this document. “Original” means the earliest
full user brief; “correction” means a later explicit rejection or constraint.

| ID | Reconstructed requirement | Acceptance intent |
|---|---|---|
| RQ-01 | Build a teaching simulator, not a dashboard, to satisfy the course/platform introduction: bad-link energy-saving communication and high-mobility satellite management. | A novice can learn by watching and acting on a visible scenario. |
| RQ-02 | Eventually connect to the platform API and upload EE/energy-related data meaningfully for inspection and recording, not merely to use the platform. | An accepted run produces a justified, inspectable result bundle; API use is a secondary endpoint. |
| RQ-03 | Use the global constellation route to show Starlink/OneWeb differences in count and altitude directly. | Both clouds and height comparison are visible in one controlled frame with source labels. |
| RQ-04 | Give the global view an additional meaningful perspective rather than a hollow count comparison. | A third visual question, such as local visibility/horizon mask or service context, is explained without forcing an EE claim. |
| RQ-05 | Teach what “off-axis angle” means and distinguish it from elevation. | Two vertices/rays/arcs make the measurement origins unambiguous. |
| RQ-06 | Let the learner adjust camera and beam axis so the boresight visibly moves. | Camera presets and a beam-axis action hold satellite/UE/time fixed and visibly change only the teaching axis. |
| RQ-07 | Integrate power and EE formulas with scene consequences, not numbers merely increasing/decreasing. | A causal visual chain links geometry/angle → gain/link → rate/throughput → power/energy/EE. |
| RQ-08 | Present handover as an animation with signal, elevation, height, context, reason, criteria, conditions, and selected target. | Each item appears at the moment the scene makes it relevant; it does not cover the scene. |
| RQ-09 | Explain multiple candidates and why one is chosen when the source actually supplies ranking evidence. | Candidate identity and ranking factors are source-backed; otherwise the UI says unavailable. |
| RQ-10 | Teach both inter-satellite and intra-satellite handover. | The two mechanisms have distinct visual episodes and truth labels. |
| RQ-11 | Deliberately design page/scene order, purpose, transitions, and teaching content. | Every scene has an entry question, visible phenomenon, action/observation, and bridge. |
| RQ-12 | Provide many meaningful hands-on operations and animations; knobs/number changes alone are insufficient. | An action changes a visible state and leads to an interpretable student observation. |
| RQ-13 | Keep energy efficiency central, without forcing unrelated Starlink/OneWeb facts into energy claims. | Global/TLE geometry is honest context; EE is the later climax with declared mechanism and metrics. |
| RQ-14 | At the end, let students choose which data to upload and understand why, cadence, and whether periodic upload is meaningful. | Selection/rationale/cadence/schedule are visible; no API tutorial is required. |
| RQ-15 | Make a meaningful experiment flow that can run and periodically record data. | A run has an identity, declared samples, batching/cadence, local receipt, and platform boundary. |
| RQ-16 | Support smooth recording/narration and an experiment slide deck; plan exact screenshots and explanations. | Keyframes map to lessons and the recording cut has a reproducible manifest. |
| RQ-17 | Later accept real Starlink/OneWeb TLE data. | Import/download provenance and source selection are explicit and fail closed. |
| RQ-18 | Teach raw TLE → parse/checksum → SGP4 → coordinate/position/velocity/height → moving scene. | Each transformation is animated and inspectable, with raw fields and derived outputs. |
| RQ-19 | Use dynamic-slide/transient overlays and pause explanations rather than walls of text. | Overlay appears only during the relevant beat; formulas/provenance are on demand. |
| RQ-20 | Include a counterintuitive lower-power experiment: lower transmit power may lower instantaneous RF output but not necessarily improve total EE/service. | Students predict, sweep a declared control, observe energy/data/service/EE, then inspect the formula. |
| RQ-21 | Explain formulas moderately and accessibly for learners without satellite/communications background. | Plain-language captions and visual symbols precede concise formula reveal. |
| RQ-22 | Design the journey so the operator can record a coherent, meaningful lecture rather than a tour of sidebars. | One continuous narrative has stable camera, beats, holds, and capture frames. |

## 3. Correction ledger (non-negotiable)

| ID | Later correction | Gate implication |
|---|---|---|
| CR-01 | This is not a small tweak; the previous direction was structurally wrong. | Freeze current implementation; replan before feature stacking. |
| CR-02 | Reject the current student compositor as a base: sidebars, central overlays, and text-heavy pages obscure the scene. | New compositor starts from scene-first contract; old UI is donor only. |
| CR-03 | Scene/animation is primary; text appears during the animation as assistance, never as a wall to read. | Caption and overlay limits are machine asserted. |
| CR-04 | Legacy 3D is a visual reference only; old scientific semantics must not return. | Source scans and truth review forbid legacy required-SINR/power/cap meanings. |
| CR-05 | First write a storyboard and implement exactly one 60–90 s golden flow before expanding. | No downstream act starts until pilot is owner-accepted. |
| CR-06 | Automated gates and human/controller pixel/video review are both required. | DOM/source claims never constitute visual PASS. |
| CR-07 | Storyboard every beat with visual, ≤2 captions, camera, speed/slow motion, controls, hidden surfaces, and freeze-frame status. | Missing storyboard fields block implementation. |
| CR-08 | “Phenomenon first, formula second”; formulas belong in a pause-only inspector/drawer. | Formula panels are not mounted during playback. |
| CR-09 | Left/right/top/bottom chrome must auto-hide per beat; a manual hide toggle is not completion. | Director owns visibility; inactive surfaces unmount, not merely opacity-hide. |
| CR-10 | Candidate comparator, TTT ring, SINR trace, commit pulse, and receipt are mutually exclusive. | Exactly one primary cue, one at a time, in declared order. |
| CR-11 | The central scene must remain visible; controls and overlays cannot cover subjects. | Stage/safe-area/subject occlusion thresholds are hard gates. |
| CR-12 | Route entry must land on the accepted experience, not an old dashboard with hidden prototype code. | Official course links are browser-tested through the actual entry route. |
| CR-13 | Periodically jump out of context and compare the actual pixels/video to the original prompt. | Fresh-context direction audits are required after each phase. |
| CR-14 | Use controller-owned acceptance and one implementation writer; read-only reviewers may work in parallel. | No auto-PASS, no overlapping writers, no commit/push. |
| CR-15 | Existing model/director/provenance work may be retained, but composition must be rebuilt around beat→visible surfaces. | Keep model layer; discard persistent dashboard composition. |
| CR-16 | Platform/API comes last and should show selection/rationale/cadence, not teach API mechanics. | Platform adapter is a secondary notebook/export adapter. |

## 4. Scientific and truth ceilings

These ceilings are blockers, not suggestions:

| ID | Ceiling |
|---|---|
| TR-01 | Use one immutable frame identity for SINR, Power, Throughput, and EE. Presentation state may select/reveal; it may not recalculate scientific values. |
| TR-02 | TLE publication switching/propagation is not a handover decision and is not evidence of energy saving. |
| TR-03 | A beam-axis teaching counterfactual is separate from source-backed handover. Never caption it as causing the later event. |
| TR-04 | Do not invent interruption time, signalling cost, residual visibility, candidate ranking, policy, savings, platform persistence, or operational/live claims. |
| TR-05 | Do not restore legacy required-SINR, requested-power inversion, cap semantics, or a second power path merely to create a smoother teaching curve. |
| TR-06 | Source-backed handover facts must identify source, target, time/anchor, event type, and configured condition. Attach/stay/intra cannot pass an inter gate. |
| TR-07 | The canonical EE contract keeps numerator, denominator, units, power boundary, load handling, and ratio-of-sums explicit. `EE_eval` is accumulated delivered bits divided by accumulated consumed energy, not an arithmetic mean of instantaneous EE. |
| TR-08 | Platform type codes, registrations, A/B identity, sensor IDs, and query-back are owner/current-verification boundaries. Do not infer them from a proposal or historical upload. |
| TR-09 | HTTP 200 means request acceptance only; it does not prove persistence, query-back, registration, or A/B comparison. |
| TR-10 | Keep simulation sample cadence (for example, one synthetic sample per simulated second) distinct from wall-clock batching (for example, 30/60/300 s). Never label compressed replay timestamps as wall-clock telemetry. |
| TR-11 | Browser credentials are never embedded in source, bundles, screenshots, or client-side constants; use server-side/local bridge and environment variables. |
| TR-12 | Any source/artifact with invalid TLE columns/checksum fails closed; no generated orbit may silently replace missing data. |
| TR-13 | Scientific parameters that remain unresolved (including policy-level “saving” and platform Phase-1 mapping) are represented as unavailable/open, not tuned into existence. |

## 5. Product decisions (decisive)

1. **Learner journey:** Global constellation → TLE journey → Off-axis lab →
   Handover theatre → EE experiment → Platform record.
2. **Medium:** a self-playing, scene-first animation. A separate route exists
   only when the medium/camera/domain changes; persistent six-act navigation,
   rails, top controls, and full timeline are absent during playback.
3. **Surfaces:** the student/recording surface is clean and minimal. A hidden,
   pause-only teacher inspector contains formulas, provenance, raw data, and
   deeper rows. It never becomes a permanent dashboard.
4. **Controls:** only controls required for the current hands-on beat appear;
   engineering controls are unmounted outside that beat.
5. **Composition:** exactly one primary visual cue and no more than two rendered
   subtitle lines. Comparator, TTT, trace, commit, and receipt are mutually
   exclusive and unmounted when inactive.
6. **Energy:** the EE experiment is the climax. Global constellation and TLE
   facts are not forced into EE claims; they supply the geometry/data foundation.
7. **Platform:** a secondary experiment notebook/export adapter. It explains
   why selected fields/cadence matter and records receipts; it is not an API
   lesson, feedback dashboard, or proof of saving.

## 6. Hard visual gate contract

The canonical capture is 1920×1080, DPR 1. The following are hard thresholds
for every accepted playback beat:

* stage bounds occupy at least **85%** of the viewport;
* effective unoccluded stage area is at least **70%** after rectangle-union
  measurement of all opaque teaching surfaces;
* primary subject bounds remain inside safe area **x=16–84%, y=14–78%**;
* opaque overlays intersect no more than **5%** of the combined primary-subject
  region;
* no persistent left/right sidebar, top control bar, bottom timeline, nav,
  course-outline card, or engineering rail;
* exactly one primary cue is mounted/active and exactly one subtitle bar is
  mounted, with **≤2 rendered lines** (minimum 16 px at canonical viewport);
* inactive candidate/TTT/trace/commit/receipt components are unmounted, not
  merely transparent or hidden by CSS;
* every beat emits camera pose, target/focus, speed, visibility/chrome,
  primary-cue, subject-bounds, and truth-source telemetry;
* the browser bundle includes per-beat screenshots (about 12 for the golden
  pilot), a video, a manifest, and machine results as appropriate;
* accessibility and projector review include keyboard focus, reduced motion,
  readable contrast/size, responsive no-overflow behavior, and redundant
  non-color encoding. Color alone may never encode serving/candidate/event or
  state.

These checks measure pixels and mounted surfaces in a real browser. A DOM
snapshot, CSS rule, source assertion, or worker self-review cannot substitute
for the controller watching the video and screenshots.

## 7. Work item protocol

Each item has a stable ID and must contain the fields in the table below. The
same protocol applies to science-only items: an attractive scene cannot pass a
truth gate, and a scientific test cannot pass a visual gate.

**Worker classes:** `non-heavy-local` means implementation, audit, SDD, or
browser work in this checkout. `heavy-server` means a sweep/training/rollout
expected to exceed ~30 minutes and needing no GUI; route that work to the Ubuntu
server with the repo/artifacts synchronized first. No current item is
authorized to start as heavy work merely because a worker suggests it.

For every item, the worker must deliver the required artifacts, run the listed
machine checks, and stop at `WAITING_FOR_REVIEW_<ID>`. The independent reviewer
answers the question, and the controller records one status. Only
`PASS_<ID>` recorded by the controller unlocks the next item.

## 8. Dependency-ordered hierarchy

The hierarchy is intentionally strict. A child may not start until every
prerequisite has a controller-recorded `PASS`. `WIP_FROZEN` and
`CANDIDATE_EVIDENCE` are not unlocks.

The single mutable core chain is:

```text
WI-00 → WI-01 → WI-02 → WI-03 → WI-04 → WI-05 → WI-06 → WI-07 → WI-08
  → WI-09 → WI-10 → WI-11 → WI-13 → WI-14 → WI-15 → WI-16 → WI-17 → WI-18
```

Every arrow requires exactly the preceding `PASS_WI-*` token. Read-only review,
artifact inspection, and browser capture may run in parallel but never unlock a
second core implementation. `EXT-01` starts only after `PASS_WI-18` and has no
outgoing unlock.

### L0 — freeze, authority, and acceptance machinery

#### WI-00 REQUIREMENT-FREEZE

* **Outcome:** archive the original/correction/truth ledgers and settle the
  route/journey/dependency vocabulary in this document.
* **Current status:** `PASS`.
* **Evidence pointer:** this document’s recorded WI-00 round-3 fresh-context
  Codex read-only PASS review/controller provenance entry (§Normative
  execution/status ledger).
* **Prerequisites:** none.
* **In scope:** traceable requirements, authority precedence, status vocabulary,
  owner-only gates, WIP freeze. **Out of scope:** UI/model edits, route changes,
  science values, API calls.
* **Worker:** non-heavy-local (documentation/audit).
* **Artifacts:** this backlog, evidence ledger template, dirty-path inventory,
  owner decision register.
* **Machine acceptance:** every RQ/CR/TR ID maps to a later WI; links and stable
  IDs resolve; forbidden “PASS by claim” language absent.
* **Human/controller acceptance:** controller verifies this is faithful to the
  earliest brief and later corrections.
* **Independent reviewer question:** “Can any explicit original requirement or
  correction be implemented without a WI, prerequisite, and evidence gate?”
* **Stop:** `WAITING_FOR_REVIEW_WI-00`.
* **Unlock:** controller records `PASS_WI-00`; then WI-01.

#### WI-01 AUTHORITY-AND-WIP-PREFLIGHT

* **Outcome:** prove the active checkout, dirty WIP, writers, routes, donor
  boundaries, and scientific/platform authority map before any implementation.
* **Current status:** `PASS`.
* **Evidence pointer:** `docs/reviews/TEACHING-SIMULATOR-WI-01-PREFLIGHT-2026-08-24.md`;
  expanded status hash `35bffd1641540f3af4e46612b35196be663e81b6891c7b228da63233476a67e0`;
  independent fresh-context read-only PASS.
* **Prerequisites:** `PASS_WI-00`.
* **In scope:** read-only inventory of source/docs/artifacts/routes; classify
  old homepage and text-heavy TLE/Energy surfaces as `REJECTED`; classify
  existing Golden/Global evidence as candidate only. **Out of scope:** cleanup,
  reset, stash, commit, push, or code repair.
* **Worker:** non-heavy-local.
* **Artifacts:** preflight report, exact dirty-path list, current-state table.
* **Machine acceptance:** current route/source/evidence references are captured;
  no active overlapping implementation writer.
* **Human/controller acceptance:** controller confirms unrelated dirty WIP is
  preserved and all claims remain VERIFIED/PROBABLE/UNVERIFIED.
* **Independent reviewer question:** “Does this inventory distinguish static
  reachability, browser execution, pixels, and owner acceptance?”
* **Stop:** `PASS_WI-01` recorded 2026-08-24.
* **Unlock:** `PASS_WI-01` unlocks WI-02; downstream remains frozen.

#### WI-02 UNIFIED-RUNTIME-AND-VISUAL-ACCEPTANCE-HARNESS

* **Outcome:** establish ADR-009's one `VisualLabSession`, one accepted
  scientific runtime/frame, one private `ScenePlanCompiler`, one exhaustive
  renderer inside one R3F Canvas, and a generic browser gate that measures the
  hard visual contract rather than trusting class names or DOM presence.
* **Current status:** `PASS`.
* **Evidence pointer:** `docs/reviews/TEACHING-SIMULATOR-WI-02-HARNESS-2026-08-24.md`;
  independent fresh-context reviewer PASS; controller `PASS_WI-02` recorded
  2026-08-24. The report covers the unified runtime/compiler/renderer seam and
  generic fixture/browser harness only; it does not accept the product
  compositor or lesson pixels.
* **Prerequisites:** `PASS_WI-01`.
* **In scope:** 1920×1080 stage/occlusion/safe-area/subject bounds, true
  rectangle-union measurement with overlapping red fixtures, cue exclusivity,
  caption line boxes, unmounted inactive cues, camera/speed/visibility
  telemetry, screenshot/video/manifest plumbing, keyboard/reduced-motion/
  projector checks; one session/one frame/one ScenePlanCompiler/one renderer
  architecture; quarantine of legacy shell/imports and persistent nav/manual
  hide dependencies. **Out of scope:** changing any lesson compositor or
  scientific formula, or adding a parallel public layer framework.
* **Worker:** non-heavy-local.
* **Artifacts:** unified session/compiler contract, harness, overlapping-fixture
  contract, failure screenshots, machine report, legacy-import quarantine map.
* **Machine acceptance:** thresholds in §6 fail closed; overlapping opaque
  rectangles are unioned (not summed); a deliberately bad fixture demonstrates
  red results and a valid fixture demonstrates only measurement (not owner
  acceptance); no persistent legacy shell/nav/manual-hide dependency or public
  per-layer framework is reachable.
* **Human/controller acceptance:** controller reviewed the measured
  screenshot/contact sheet and confirmed that the harness gate corresponds to
  visible pixels, then recorded `PASS_WI-02`. This is harness acceptance only;
  `/simulator` remains `PRODUCT_REJECTED_QUARANTINED`, and owner product
  compositor/lesson pixel acceptance is still unrecorded.
* **Independent reviewer question:** “Could a full-screen overlay, persistent
  sidebar, or hidden-but-mounted cue falsely pass?”
* **Stop:** `PASS_WI-02` recorded 2026-08-24; WI-02 is closed.
* **Unlock:** `PASS_WI-02` unlocks only WI-03; all later items remain frozen.

### L1 — one truthful golden medium

#### WI-03 GOLDEN-FLOW-TRUTH-CONTRACT

* **Outcome:** freeze the 60–90 s pilot's evidence state, counterfactual
  namespace, source-backed replay, beat order, truth ceilings, and storyboard.
* **Current status:** `PASS` — controller `PASS_WI-03` recorded after an
  independent fresh-context reviewer `PASS`; accepted for WI-04
  authoring/review only.
* **Evidence pointer:** `docs/sdd/VISUAL-FIRST-GOLDEN-FLOW-STORYBOARD.md`;
  `docs/reviews/TEACHING-SIMULATOR-WI-03-TRUTH-CONTRACT-2026-08-24.md`.
* **Prerequisites:** `PASS_WI-02`; current scientific evidence inventory is a
  static constraint, not a PASS substitute.
* **In scope:** elevation/off-axis distinction, beam-axis teaching action,
  restore, one source-backed inter event, candidate/TTT/trace/commit/receipt
  order, camera/speed/slow-motion/hidden-surfaces/freeze fields, and for every
  Guided beat the visible question/phenomenon, a mandatory prediction prompt,
  recorded prediction/completion evidence, optional one-gesture prediction
  gesture, learner action, expected observation, concise causal explanation,
  misconception guard, unavailable/failure/recovery/reset/completion behavior.
  These are director fields, not text quizzes. **Out of scope:** intra
  handover, full ranking, EE policy, platform, TLE import UI, and authoring a
  second golden pilot.
* **Worker:** non-heavy-local (SDD/model read-only seam).
* **Artifacts:** approved storyboard, fixture ledger, director contract,
  forbidden-claim list, capture matrix for the pilot.
* **Machine acceptance:** every beat has all storyboard fields; every Guided
  beat has a mandatory prediction prompt and a recorded prediction/completion
  state (the gesture may be optional); truth source, IDs, and unavailable
  semantics are explicit; no counterfactual-to-handover causal join.
* **Human/controller acceptance:** the independent fresh-context reviewer
  returned `PASS`; the controller recorded **`PASS_WI-03`** because every beat
  has a scene-defined observable event, there is one guided prediction/action,
  the counterfactual is isolated, and restore/source-handover evidence is
  fail-closed. This accepts the structure/truth contract for WI-04 only. It
  does not accept product pixels, the compositor/video, or the WI-09 full
  scientific source-backed event lesson; owner/compositor pixel acceptance
  remains WI-04.
* **Independent reviewer question:** “If all captions and cards disappeared,
  would each beat still have an observable event and understandable question?”
* **Stop:** `PASS_WI-03` recorded 2026-08-24; WI-03 is closed.
* **Unlock:** `PASS_WI-03` unlocks WI-04 authoring/review only; WI-05 and all
  later items remain frozen.

#### WI-04 GOLDEN-FLOW-COMPOSITOR-VIDEO-OWNER

* **Outcome:** implement and capture the one 60–90 s visual-first pilot and
  obtain owner/controller pixel/video acceptance.
* **Current status:** `CANDIDATE_EVIDENCE`; governance state:
  **`CONTROLLER_VISUAL_REVIEW_PASS / WAITING_FOR_OWNER_VISUAL_ACCEPTANCE`**.
* **Evidence pointer:** `docs/reviews/TEACHING-SIMULATOR-WI-04-COMPOSITOR-VIDEO-2026-08-24.md`;
  `output/playwright/golden-flow/` r2 WebM, manifest, contact sheet, and 12
  hashed PNG frames; runtime scientific event evidence is incomplete.
* **Prerequisites:** `PASS_WI-03` (WI-03 structure/truth contract only).
* **In scope:** stage-first compositor; beat-driven unmounting; one meaningful
  pause action; camera presets/beam-axis action; transient captions/inspector;
  12-ish screenshots, manifest, and video. **Out of scope:** broad route
  migration, extra acts, platform, policy claims, decorative scoreboards.
* **Worker:** non-heavy-local; one implementation writer only.
* **Artifacts:** source, focused tests, 1920×1080 WebM, beat screenshots/contact
  sheet, telemetry manifest, known-gaps list.
* **Machine acceptance:** WI-02 gate is green for every beat; controls only
  appear in their beat; old chrome absent; video is reproducible. The r2
  candidate passed the director, TypeScript, main browser, course-segment
  retry, WebM, timing, and first-frame checks. These artifacts are still
  visual-only candidate evidence and cannot certify the complete handover
  science lesson. The later source-backed gate must provide the actual source
  event ID, trace digest, qualify/TTT/commit/after frame IDs,
  `action=inter-handover`, and a pre-mutation snapshot. The full restore
  equality must cover source frame/replay identity, serving and candidate IDs,
  handover-manager state, event count, platform sample/record count, and prove
  that no counterfactual sample was persisted.
* **Human/controller acceptance:** controller inspected the complete r2 contact
  sheet, key full-resolution PNGs, key/timing video frames, and browser-gate
  results; the second fresh Opus performed the complete frame-by-frame timeline
  analysis and the five r1 findings are fixed. Owner visual acceptance is still
  pending and cannot be inferred from tests or controller review.
* **Governance state:** `CONTROLLER_VISUAL_REVIEW_PASS / WAITING_FOR_OWNER_VISUAL_ACCEPTANCE`.
* **Independent reviewer question:** “Does any opaque surface cover the central
  subject, and does any caption carry more meaning than the scene?”
* **Stop:** `WAITING_FOR_OWNER_VISUAL_ACCEPTANCE_WI-04`.
* **Unlock:** owner visual acceptance must be recorded before the accepted
  pilot/course-spine route cutover can be considered; WI-05 remains
  `WIP_FROZEN`. This does not complete the course or certify handover science.
  No downstream act may expand a rejected pilot.

### L2 — official course spine and geometry/data foundations

#### WI-05 OFFICIAL-ROUTE-CUTOVER-ACT3-ACT4

* **Outcome:** the official course entry lands on the accepted golden
  experience; it never silently mounts the legacy dashboard.
* **Current status:** `WIP_FROZEN`.
* **Evidence pointer:** dirty route WIP under `src/course/nav/**` and route
  tests; no accepted official-entry first-load bundle.
* **Prerequisites:** controller visual review plus owner visual acceptance of
  WI-04; route source inventory from WI-01. The owner gate is still pending.
* **In scope:** Act 3/4 route mapping, launch links, direct-route/browser
  verification, migration labels. **Out of scope:** adding new lesson content,
  deleting history routes, changing scientific data.
* **Worker:** non-heavy-local, one implementation writer.
* **Artifacts:** route map, browser entry screenshots/video, route tests,
  redirect/compatibility note.
* **Machine acceptance:** actual `/course/six-acts` and its first-load/next
  links land on the accepted compositor; exact browser evidence proves no
  legacy query route, legacy shell, persistent SixActs nav/chrome, or
  manual-hide dependency is mounted. `/?teaching=1&preset=handover` may remain
  a quarantined history route but never appears as the student entry.
* **Human/controller acceptance:** controller opens the official route and sees
  the same scene-first pilot without manually hiding chrome.
* **Independent reviewer question:** “Does the route URL users are instructed
  to open show the accepted experience on first load?”
* **Stop:** `WAITING_FOR_REVIEW_WI-05`.
* **Unlock:** only `PASS_WI-05` unlocks WI-06. Read-only route review may run in
  parallel, but it never unlocks WI-06 or any other core implementation.

#### WI-06 GLOBAL-CONSTELLATION-ACCEPTANCE

* **Outcome:** accept the global scene as the first journey act: count/height
  contrast plus local visibility perspective.
* **Current status:** `CANDIDATE_EVIDENCE`.
* **Evidence pointer:** `docs/sdd/VISUAL-FIRST-GLOBAL-CONSTELLATION-STORYBOARD.md`
  and candidate global screenshots/video; overall owner acceptance is absent.
* **Prerequisites:** `PASS_WI-05`; candidate Global evidence; `PASS_WI-02`.
* **In scope:** Starlink/OneWeb count and altitude, third local-observation
  question, camera choreography, no forced EE claim, next-scene
  bridge. **Out of scope:** TLE parser lesson, RF link, handover, platform.
* **Worker:** non-heavy-local.
* **Artifacts:** source/artifact manifest, beat screenshots/video, browser report,
  bridge capture, honest-limits note.
* **Machine acceptance:** the manifest/digest is exact and immutable; the
  accepted Starlink/OneWeb artifact counts, median-height values, accepted
  snapshot/date, raw NTPU horizon provenance (`elevation >= 0°`: 475/39), and
  the separately derived Act 1 observation mask (`elevation >= 10°`: 177/18)
  match the storyboard manifest; the fixed-date, archived TLE/SGP4, non-live,
  display-only boundary is visible. Stage/caption/cue, responsive, keyboard,
  and no-forced-link/EE-claim checks are green.
* **Human/controller acceptance:** count/height/local visibility are immediately
  legible and do not feel like a hollow static infographic.
* **Independent reviewer question:** “Does the third perspective add a real
  spatial question without smuggling in link quality or EE?”
* **Stop:** `WAITING_FOR_REVIEW_WI-06`.
* **Unlock:** `PASS_WI-06` allows the TLE journey implementation; current Global
  screenshots remain `CANDIDATE_EVIDENCE` until this gate.

#### WI-07 TLE-VISUAL-JOURNEY

* **Outcome:** teach the complete path from real TLE input to moving SGP4 scene.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted raw→parse→SGP4 teaching bundle; existing
  runtime/archive artifacts are prerequisites, not lesson evidence.
* **Prerequisites:** `PASS_WI-06`; `PASS_WI-01`; ADR-005/TLE SDD evidence.
* **In scope:** content-addressed checked-in real Starlink and OneWeb archives;
  source selection/import with UTC instant, source, epoch, age, and provenance;
  one frozen publication; exactly 241 common anchors at 30 s across 7,200 s;
  full-run atomic replacement; raw two-line TLE and checksum/column validation;
  parsed fields; SGP4 propagation; the explicit frame chain
  **TEME → ECEF → NTPU/topocentric observer → elevation/height → display**;
  height/position/velocity/elevation; moving object and timeline; learner
  actions and pause explanations. **Out of scope:** generated-orbit fallback,
  inventing bad records, live telemetry claims, handover policy, platform
  upload.
* **Worker:** non-heavy-local; long archive regeneration is heavy-server only
  if it exceeds ~30 min and needs no GUI.
* **Artifacts:** transformation fixtures, animation beats, raw/parsed/SGP4
  screenshots, per-step TEME/ECEF/NTPU/topocentric/display frame IDs and units,
  visible per-step outputs (position, velocity, height, elevation), source
  digests, browser/video manifest, fallback unavailable states.
* **Machine acceptance:** deterministic content-addressed source publication,
  source/UTC/epoch/age/provenance identity, checksum/column fail-closed
  behavior, exactly 241 common 30 s anchors over 7,200 s, one frozen
  publication, atomic full-run replacement, and exact per-step
  TEME→ECEF→NTPU/topocentric→elevation/height→display frame IDs, units, and
  visible outputs. Coordinate/unit checks, moving scene matching the accepted
  SGP4 frame, and coverage for both Starlink and OneWeb are required. A hidden
  skipped frame or generated fallback cannot pass.
* **Human/controller acceptance:** a novice can narrate “what changed from raw
  text to motion” and point through each frame transformation without a
  paragraph; no date picker masquerades as the full lesson.
* **Independent reviewer question:** “Are raw fields, parsing, coordinate
  transformation, and SGP4 visibly distinct, or did a hidden helper skip the
  teaching steps?”
* **Stop:** `WAITING_FOR_REVIEW_WI-07`.
* **Unlock:** `PASS_WI-07` unlocks WI-08.

### L3 — angle and handover theatre

#### WI-08 FULL-OFF-AXIS-LAB

* **Outcome:** deliver the complete off-axis lesson with camera and beam-axis
  manipulation, visible consequence, and formula reveal after the phenomenon.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted full camera/beam-axis action and restore
  bundle.
* **Prerequisites:** `PASS_WI-07`; canonical angle evidence is a static
  constraint, not a PASS substitute.
* **In scope:** two-angle vertices, elevation fixed while teaching beam axis
  moves, side/top/oblique camera choices, freeze/restore, angle→gain/link
  consequence, pause inspector. **Out of scope:** joining action to handover,
  invented beam footprint/ranking, legacy power inversion.
* **Worker:** non-heavy-local.
* **Artifacts:** geometry frame contract, action log, before/after screenshots,
  camera telemetry, formula drawer capture, truth-boundary manifest.
* **Machine acceptance:** `elevationBefore≈elevationAfter`, off-axis changes,
  satellite/UE/time freeze, and full restore equality for source frame/replay
  identity, serving ID, candidate ID, handover-manager state, event count, and
  platform sample/record count; no counterfactual sample is persisted. Safe-area
  and mutual-exclusion gates are green.
* **Human/controller acceptance:** a novice points to the two angle vertices
  and explains why camera motion is not a scientific change.
* **Independent reviewer question:** “Could a learner mistake a camera orbit or
  elevation change for beam-axis/off-axis change?”
* **Stop:** `WAITING_FOR_REVIEW_WI-08`.
* **Unlock:** only `PASS_WI-08` unlocks WI-09.

#### WI-09 SOURCE-BACKED-INTER-HANDOVER

* **Outcome:** teach one genuine inter-satellite event as before → qualify →
  TTT → commit → after, using only accepted trace facts.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted source-backed inter lesson bundle; Golden
  artifacts remain visual-only candidates until WI-04 evidence is complete.
* **Prerequisites:** `PASS_WI-08`. The source-backed inter entry artifact is
  supplied to and validated by WI-09; it is not a hidden prerequisite or prior
  PASS token.
* **In scope:** validate a source-backed inter entry artifact, then teach
  serving decline, pending target, qualification threshold/offset,
  source TTT, commit pulse, source/target receipt, transient signal/elevation/
  height labels only when available. **Out of scope:** interruption/signalling
  cost, complete candidate ranking, energy saving, beam-axis causal claim.
* **Worker:** non-heavy-local.
* **Artifacts:** source trace fixture, 8–12 beat screenshots/video, event
  manifest, unavailable-field list, narrated slide frames.
* **Machine acceptance:** WI-09 validates the entry artifact's source/target,
  event type, anchor identity, trace digest, and increasing TTT trace. Missing,
  malformed, or non-inter input fails closed and sets WI-09 to `BLOCKED_OWNER`;
  no incomplete artifact can unlock WI-10. Mutual exclusion, no invented
  fields, and actual `inter-handover` semantics are required.
* **Human/controller acceptance:** reviewer can say why switching is allowed and
  why it waits; scene remains visible at every beat.
* **Independent reviewer question:** “Does the scene show a real source-backed
  decision, or merely a decorative timer and a guessed candidate?”
* **Stop:** `WAITING_FOR_REVIEW_WI-09`.
* **Unlock:** `PASS_WI-09` unlocks WI-10.

#### WI-10 EXPLAINABLE-MULTI-CANDIDATE-SNAPSHOT

* **Outcome:** if and only if source evidence exposes multiple candidates and
  ranking inputs, show an explainable snapshot and why the selected target wins.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted multi-candidate source/ranking fixture.
* **Prerequisites:** `PASS_WI-09`. The source-backed multi-candidate/ranking
  entry artifact is supplied to and validated by WI-10; it is not a hidden
  prerequisite or prior PASS token. If absent, record `BLOCKED_OWNER` and stop.
* **In scope:** candidate set, shared timestamp/frame, declared scoring factors,
  selected target, compact transient comparison. **Out of scope:** inferring
  distance/height/quality ranking from unprovided fields; permanent tables.
* **Worker:** non-heavy-local.
* **Artifacts:** ranking fixture/schema, candidate scene beat, source field map,
  unavailable fallback, screenshots/video.
* **Machine acceptance:** WI-10 validates the entry artifact and proves every
  displayed factor exists in source facts; malformed/missing multi-candidate or
  ranking evidence fails closed and sets WI-10 to `BLOCKED_OWNER`. The
  candidate cue is the sole primary cue; ordering and identity match the trace.
* **Human/controller acceptance:** a novice understands why this target was
  chosen without reading a table.
* **Independent reviewer question:** “Which visible ranking factor is invented,
  and what happens if the source does not provide it?”
* **Stop:** `WAITING_FOR_REVIEW_WI-10`.
* **Unlock:** only `PASS_WI-10` unlocks WI-11. `BLOCKED_OWNER` leaves WI-11 and
  the full course locked.

#### WI-11 INTRA-HANDOVER

* **Outcome:** teach an intra-satellite transfer distinctly from inter-satellite
  transfer, using accepted source semantics.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted same-satellite event/visual package.
* **Prerequisites:** `PASS_WI-10`. The intra trace entry artifact is supplied to
  and validated by WI-11; it is not a hidden prerequisite or prior PASS token.
  Multi-candidate and intra are original core requirements; no owner-approved
  unavailable shortcut can unlock or satisfy this item.
* **In scope:** same satellite, beam/ownership change, qualification and
  resulting visual transfer, comparison with inter event. **Out of scope:**
  claiming inter behavior, invented signalling/interruption, unsupported
  source fields.
* **Worker:** non-heavy-local.
* **Artifacts:** intra fixture, side-by-side or sequential animation, contrast
  keyframe, truth manifest, browser evidence.
* **Machine acceptance:** WI-11 validates the intra trace entry artifact;
  missing/malformed/non-intra input fails closed and sets WI-11 to
  `BLOCKED_OWNER`. Satellite identity remains fixed while beam identity changes;
  event type is `intra`/accepted equivalent; no inter labels leak. `BLOCKED_OWNER`
  leaves WI-13 and the full course locked.
* **Human/controller acceptance:** novice can answer “what stayed the same and
  what changed?” from the scene.
* **Independent reviewer question:** “Is this truly intra, or is it an inter
  event relabelled to satisfy the syllabus?”
* **Stop:** `WAITING_FOR_REVIEW_WI-11`.
* **Unlock:** only `PASS_WI-11` unlocks WI-13.

### L4 — energy experiment and scientific closure

#### WI-13 EE-EXPERIMENT-SCIENTIFIC-PREREGISTRATION

* **Outcome:** freeze the meaningful counterintuitive EE experiment before UI
  tuning.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted current-power-path reconciliation or EE
  preregistration bundle.
* **Prerequisites:** `PASS_WI-11`; canonical EE authority and current accepted
  scientific ruling are constraints, not PASS substitutes.
* **In scope:** first reconcile the course path against the newest authority:
  select exactly one Act 3/5 tuple, subject to the newest accepted scientific
  authority: **`ACT3_ACT5_CANONICAL_483_V39_R3_B500_K2` = height 483 km, 39
  beams, the Act 3/5 profile with reuse 3 and `B_sys=500 MHz`, and `kappa=2`**.
  The separate 780-km/7-beam mechanism fixture is not an Act 3/5 course
  tuple. Also reconcile `kappa=2` and its same-colour-neighbour/
  geometry-equivalence assumption, dynamic `N_act`, the authoritative `xi`/
  `p_sat` equation, and removal or
  disablement of `gammaReqB`/`pReqUW` for the course path. Then freeze a matched
  immutable replay; hypothesis/prediction; declared power control/sweep;
  controlled variables; total energy, delivered data, outage/low-SINR/service
  constraint, handover count where source-backed, and ratio-of-sums EE;
  mechanism vs policy claim separation. **Out of scope:** tuning hidden
  constants to make a sweet spot, invented savings policy, platform
  registration, or silently choosing between unresolved scientific authorities.
  The parity cases must encode exactly this authoritative efficiency equation:

  ```text
  p_sat = p_max * 10^(BO/10) = 1.65 W * 10^(5/10) = 5.218 W
  xi(p) = min{ xi_max, xi_max * sqrt(p / p_sat) }, xi_max = 0.35
  ```

  If the newest authority changes the tuple or equation, this item fails closed
  until the record and fixtures are revised; no mixing is permitted.
* **Worker:** non-heavy-local for fixture design; heavy-server only for a
  >30-min sweep without GUI, after server sync and environment confirmation.
* **Artifacts:** current-authority decision record, power-path diff and
  quarantine report, deterministic canonical Python/TypeScript parity cases
  with declared tolerances (including the exact `xi`/`p_sat` equation above),
  the single Act 3/5 tuple manifest, explicit rejection fixture for the
  780-km/7-beam mechanism tuple, preregistration, immutable source/geometry/
  replay/traffic identity, distinct arm intervention/result frame hashes,
  metric/unit ledger, power-path derivation, expected unavailable outcomes,
  fixture data.
* **Machine acceptance:** each arm shares immutable source, geometry, replay,
  and traffic identity but has a distinct declared intervention and distinct
  result frame/hash; no wording or assertion claims the arms share one result
  frame identity. Exactly one `(height, beam count, profile, kappa)` tuple is
  present for Act 3/5; any mixed 483-km/reuse-3/500-MHz course tuple and
  780-km/7-beam mechanism fixture fails closed. Python/TS parity cases pass
  within recorded tolerances for the exact `xi(p)`/`p_sat` equation;
  `N_act` is derived dynamically; `gammaReqB`/`pReqUW` cannot drive the course
  path; no
  arithmetic-mean EE; power/throughput/energy denominators agree with the
  canonical ratio-of-sums contract; controlled intervention is exactly
  declared.
* **Human/controller acceptance:** controller accepts the question as meaningful
  for beginners and not as a result engineered for a preferred graph.
* **Independent reviewer question:** “Would the conclusion remain honest if the
  curve had no optimum or contradicted the hypothesis?”
* **Stop:** `WAITING_FOR_REVIEW_WI-13`.
* **Unlock:** `PASS_WI-13` unlocks WI-14.

#### WI-14 EE-VISUAL-LAB

* **Outcome:** turn the preregistered experiment into a scene-led climax.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted EE visual lab; old text-heavy energy
  presentation is `REJECTED` as presentation, even where model donors remain.
* **Prerequisites:** `PASS_WI-13`.
* **In scope:** student predicts, sweeps declared control, watches link/service
  and energy change, compares matched arms, pauses to open formula/provenance
  drawer, sees run summary, and separately directed Act 5 EE beats/manifest.
  The pause-only teacher/experiment surface exposes the exact current 17-key
  canonical-control registry with progressive disclosure, source/unit/range/
  reset/effect metadata, and accepted-vs-pending Apply semantics. The bounded
  representative-UE draft/Apply probe is required as the bounded scenario
  intervention; if the newest authority forbids exposing it, WI-14 must stop
  for an explicit controller decision recording that UE movement is not exposed.
  Camera/focus/playback remain presentation state and never scientific inputs.
  **Out of scope:** live platform upload, hidden parameter adjustment, a field
  wall during playback, or an energy-saving policy claim beyond preregistration.
* **Worker:** non-heavy-local.
* **Artifacts:** experiment storyboard, interaction log, matched-arm screenshots
  and video, formula drawer frame, metrics manifest, narration notes, and a
  required causal-map artifact. The map must show each source operation → target
  term with units, reference/probe values, signed delta, `h^div` wherever the
  active authority requires that division guard, the same-UE serving/candidate
  identity, and the three quantitative encodings (gain, actual-power/cap, and
  throughput) with their fixed presentation transforms.
* **Machine acceptance:** one primary cue/≤2 captions, no persistent charts or
  rails, curve/scene terms share the correct distinct arm/result frame IDs,
  local data export reproducible, all 17 current canonical controls are
  discoverable only through progressive disclosure, and Apply keeps the prior
  accepted snapshot visible while pending then atomically replaces it or fails
  closed without presenting draft values as accepted. The causal-map checker
  verifies source operation/target identity, units, reference/probe values,
  signed deltas, required `h^div`, three-encoding metadata, and same-UE
  candidate identity; the bounded UE draft/Apply action must preserve the
  declared TLE/topology/ownership invariants and publish a new accepted frame
  only after Apply succeeds. Camera/presentation events cannot satisfy these
  scientific checks.
* **Human/controller acceptance:** student can explain why lower transmit power
  is not automatically lower total energy or higher EE, using observed terms.
* **Independent reviewer question:** “Is the scene teaching a causal result, or
  is a graph and a number doing all the work?”
* **Stop:** `WAITING_FOR_REVIEW_WI-14`.
* **Unlock:** `PASS_WI-14` unlocks WI-15.

### L5 — platform record, then classroom package

#### WI-15 PLATFORM-CONTRACT-AND-DRY-RUN

* **Outcome:** define and dry-run a meaningful result bundle and selection UI
  without touching live credentials or claiming platform persistence. This is a
  candidate milestone only; it cannot satisfy the eventual live-platform
  requirement.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no accepted platform schema/dry-run bundle; operator-kit
  registration and A/B questions remain open.
* **Prerequisites:** `PASS_WI-14`; platform docs/owner registration inventory
  are constraints, not PASS substitutes.
* **In scope:** field selection and rationale; scientific simulated-sample
  cadence; event vs run-end fields; run/scenario/strategy/UE identity; local
  JSON/CSV; receipt; optional 30/60/300 s wall-clock batching design as an
  adapter concern; one-arm/A-B limitation; HTTP acceptance vs query-back; and
  the explicit HTTP shape `{type, value, channel, timestampMs}` with units,
  MAC/sensor/channel mapping. Act 6 is a separately directed platform-record
  scene/beat/manifest, even if the same runtime route is retained.
  **Out of scope:** guessing type codes/registrations, embedding credentials,
  claiming platform persistence, live upload, API tutorial/dashboard.
* **Worker:** non-heavy-local.
* **Artifacts:** versioned payload schema, field rationale table, dry-run
  payloads, local receipt, fallback files, owner questions.
* **Machine acceptance:** selected fields map to source frame/units; every dry
  payload has exactly `type`, `value`, `channel`, and `timestampMs` (plus
  explicitly separated metadata); simulated timestamp domain and wall-clock
  batch cadence are distinct; MAC/sensor/channel mapping is explicit; dry-run
  never sends network credentials; no unregistered type is labelled accepted.
* **Human/controller acceptance:** controller sees why each chosen field helps
  inspect/record the experiment and why some fields are excluded.
* **Independent reviewer question:** “Does uploading this bundle preserve the
  experiment’s meaning, or is it a vanity platform export?”
* **Stop:** `WAITING_FOR_REVIEW_WI-15`.
* **Unlock:** only `PASS_WI-15` unlocks WI-16. Owner registration/auth/current
  type evidence is evaluated inside WI-16; it is not silently treated as a
  documentation prerequisite.

#### WI-16 PLATFORM-LIVE-ADAPTER-OWNER-GATE

* **Outcome:** upload the accepted result through a server-side/local bridge
  after owner registration and authentication are verified. This is an eventual
  original requirement and is mandatory for final product PASS, not optional.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no owner-verified live registration/auth/query-back
  evidence; local fallback is not platform persistence.
* **Prerequisites:** `PASS_WI-15`; current platform owner approvals for types,
  registrations, sensor/MAC/channel/A-B identity, credentials, and query-back
  are evaluated by this item, not treated as an unrecorded unlock token.
* **In scope:** live adapter, safe schedule, response/acceptance receipt, local
  audit record, fallback on network failure, pre-class verification, and exact
  `SMARTFARM_EMAIL`, `SMARTFARM_PASSWORD`, `SMARTFARM_MAC` server/local bridge
  boundary. Act 6 platform beats/manifests must show field choice, cadence,
  receipt status, and fallback. **Out of scope:** embedding secrets, asserting
  persistence from HTTP 200, automatic A/B separation not supplied by owner,
  API instruction as lesson content.
* **Worker:** non-heavy-local; no long training/sweep.
* **Artifacts:** redacted request/response log, payload hash, acceptance receipt,
  query-back evidence if owner supplies it, credential boundary report, fallback
  capture.
* **Machine acceptance:** no secrets in source/bundle/artifacts; registration and
  type checks fail closed; request acceptance and query-back are separate flags.
* **Human/controller acceptance:** controller/owner confirms live data appears
  with the intended identity and that claims are worded no stronger than the
  evidence.
* **Independent reviewer question:** “What exactly does the platform prove, and
  what remains unverified after the response?”
* **Stop:** `WAITING_FOR_REVIEW_WI-16`.
* **Unlock:** only `PASS_WI-16` unlocks WI-17. Without owner registration/auth/
  current-type/query-back evidence this item is `BLOCKED_OWNER`; local JSON/CSV
  or a mock receipt cannot unlock the final course.

#### WI-17 SLIDE-AND-RECORDING-PACKAGE

* **Outcome:** produce the lecture recording cut, narration route, and editable
  experiment slides from accepted keyframes.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no final recording/deck package; existing pilot
  captures remain WI-04 candidate evidence and are reused, not repeated.
* **Prerequisites:** `PASS_WI-16`. The linear chain means every learner scene,
  EE scene, dry-run, and owner-verified live adapter has passed first.
* **In scope:** screenshot/slide capture matrix below; a 12–15 min narrated
  recording cut; full lesson outline; editable deck/source; speaker-note timing;
  per-slide beat/frame/truth IDs; canonical/projector/mobile/reduced-motion
  captures; explicit platform receipt status; and a bounded ADR-007 Figure /
  capture contract. Reuse immutable WI-04's 60–90 s pilot; do not produce a
  second 60–90 s pilot. **Out of scope:** new science, new UI behavior, or a
  general-purpose figure application.
* **Worker:** non-heavy-local; presentation/deck worker may run read-only in
  parallel but cannot alter the sole implementation writer’s paths.
* **Artifacts:** editable slide deck/source, keyframe manifest, speaker notes
  with timing, 12–15 min cut, canonical/projector/mobile captures, fallback
  package, platform receipt/acceptance-vs-persistence status, and provenance.
  Figure evidence must cover at least the method chain, controlled EE
  comparison, and serving-change arguments using frozen state/pair/triplet,
  dimensions/units/missing-data declarations, render/data hashes, provenance
  manifest, alt text, and static-reader acceptance. Capture proof must also
  cover source operation → target, units, reference/probe values, signed delta,
  `h^div` wherever required, the three quantitative encodings, and the same-UE
  candidate identity from WI-14's causal map.
* **Machine acceptance:** every slide maps to a frozen frame/beat/truth ID and
  source; no slide depends on a paragraph absent from the visual; keyframe
  render/data hashes and dimensions/units are recorded; causal-map capture
  checks prove source operation/target, units, reference/probe, signed delta,
  required `h^div`, all three quantitative encodings, and same-UE candidate
  identity; missing/unavailable fields are visible; platform receipt status is
  not confused with persistence.
* **Human/controller acceptance:** controller watches the cut and verifies a
  smooth narration path with meaningful pauses and no sidebar tour.
* **Independent reviewer question:** “Could a presenter explain each slide by
  pointing at the scene, or must they read a separate essay?”
* **Stop:** `WAITING_FOR_REVIEW_WI-17`.
* **Unlock:** `PASS_WI-17` unlocks WI-18.

#### WI-18 FULL-END-TO-END-COURSE

* **Outcome:** integrate the six learner scenes into a coherent course while
  preserving every truth and visual gate.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no full-course acceptance bundle.
* **Prerequisites:** `PASS_WI-17`. This strict core chain requires real Global,
  TLE, off-axis, inter, multi-candidate, intra, EE, dry-run, live-platform,
  and recording gates; no owner-approved unavailable intra shortcut and no
  local fallback can replace a core PASS.
* **In scope:** journey bridges, timing, recovery, student/teacher surface
  split, complete record/export, route entry, accessibility/projector/mobile,
  fresh-context audits, recording rehearsal. **Out of scope:** unapproved
  policy claims, new features discovered during integration, forced platform
  success.
* **Worker:** non-heavy-local; one implementation writer; reviewers read-only.
* **Artifacts:** end-to-end browser/video bundle, all-beat screenshots, route
  manifest, science/provenance ledger, deck/recording links, known-limits
  register.
* **Machine acceptance:** all relevant gates green across fresh browser runs,
  no persistent chrome, correct route order, no truth violations, responsive /
  reduced-motion/accessibility checks, live platform owner evidence, exact 17-key
  pause-only control registry/progressive disclosure, accepted-vs-pending Apply
  semantics, and bounded UE intervention kept separate from camera/presentation
  state.
* **Human/controller acceptance:** controller watches the complete recording and
  accepts the product against the original prompt, not against an old SDD.
* **Independent reviewer question:** “After the complete journey, can a novice
  state what TLE became, why a handover occurred, and why lower power is not the
  same as EE saving?”
* **Stop:** `WAITING_FOR_REVIEW_WI-18`.
* **Unlock:** controller records final owner acceptance separately; this
  backlog ends before that decision.

#### EXT-01 OPTIONAL_NOT_IN_FULL_COURSE — FORCED-CONTINUITY-COMPARISON

* **Outcome:** optionally contrast source-backed handover with forced continuity
  only after the full core course is accepted; this extension never unlocks or
  substitutes for a core item.
* **Current status:** `NOT_STARTED`.
* **Evidence pointer:** no optional forced-continuity evidence.
* **Prerequisites:** `PASS_WI-18`; accepted forced-continuity trace and a
  separate controller decision that the extension is pedagogically useful.
* **In scope:** same source window, continuity versus switch observation,
  explicit evidence class. **Out of scope:** calling TLE switching a handover,
  claiming energy savings, tuning a trace to obtain a preferred result, or
  changing the full-course route.
* **Worker:** non-heavy-local.
* **Artifacts:** paired fixture, comparison storyboard, evidence ledger,
  optional screenshot/video, and known-limits note.
* **Machine acceptance:** pair identity and scientific fields are immutable; no
  event count, platform sample, or energy claim is generated from a
  presentation-only branch.
* **Human/controller acceptance:** controller confirms the comparison clarifies
  a mechanism without adding a dashboard or confusing continuity with measured
  handover policy.
* **Independent reviewer question:** “Could a student leave believing this
  optional comparison is a measured saving policy?”
* **Stop:** `WAITING_FOR_REVIEW_EXT-01`.
* **Unlock:** none; `NO_AUTO_UNLOCK` applies.

## 9. Meaningful EE experiment contract

The chosen experiment is deliberately counterintuitive and must be preregistered
before the visual lab is tuned:

1. Freeze one immutable replay, frame identity, source data, load, service
   constraint, and declared energy boundary.
2. Ask the student to predict whether reducing a declared transmit-power
   control necessarily improves total energy efficiency.
3. Sweep only that declared control or a declared matched arm. Do not adjust
   hidden constants, fixture geometry, interference coefficients, or thresholds
   to force a sweet spot.
4. Compare, visibly and numerically, total consumed energy, delivered data,
   outage/low-SINR/service constraint, handover events when source-backed, and
   EE as ratio-of-sums.
5. Show the phenomenon first: link/service and energy ledger move in the scene.
   During a pause, reveal the compact formula and provenance drawer.
6. State the conclusion at the correct level: a mechanism finding in this
   matched replay is not automatically a policy-level claim that a network
   saves energy.

This contract keeps the EE story meaningful without pretending that a
registration, a curve shape, or a lower RF number alone proves savings.

## 10. Platform result-bundle contract

The local bundle is the primary artifact; the remote platform is an adapter.
Fields are selected only after registration/current owner verification.

The transport record shape is explicit and versioned:

```json
{
  "type": "CURRENT_SINR",
  "value": 12.3,
  "channel": 0,
  "timestampMs": 1722945600000
}
```

`type`, `value`, `channel`, and `timestampMs` are not interchangeable metadata:
the field/type registration, unit, channel meaning, MAC/sensor mapping, and
timestamp domain must be recorded beside the payload. `timestampMs` must state
whether it is a simulated replay timestamp or wall-clock transport time;
30/60/300 s wall-clock batching is an adapter schedule and does not change the
scientific simulated sample cadence. The live bridge uses the exact
`SMARTFARM_EMAIL`, `SMARTFARM_PASSWORD`, and `SMARTFARM_MAC` environment
boundary documented by the operator kit; credentials never enter browser code,
bundles, screenshots, or the local result payload.

| Bundle class | Candidate fields | Cadence / boundary |
|---|---|---|
| Scientific samples | `CURRENT_SINR`, `BEST_CANDIDATE_SINR`, `SINR_GAIN`, serving/candidate IDs only when registered | one per simulated second or declared sample; timestamps retain simulated vs wall-clock domain |
| Event samples | `HANDOVER_EVENT`, source/target IDs only when registered | event occurrence, or explicit 0/1 per simulated second |
| Run-end summaries | `LOW_SINR_RATIO`, `NUM_HANDOVERS`, `TOTAL_ENERGY_J`, `DELIVERED_DATA_MBIT`, `RUN_EE_MBIT_PER_J` only when registered | once per run; denominator and threshold in manifest |
| Adapter batching | 30/60/300 s wall-clock batches, if later required | transport schedule only; never confused with simulation sample cadence |

Every bundle carries `runId`, `ueId`, `strategyId`, and `scenarioId` (or an
explicit unavailable/owner-approved equivalent), source/frame identity, units,
sampling domain, and a local receipt. The current single-arm limitation and
unresolved A/B identity remain visible. HTTP acceptance and persistence/queryback
are separate statuses. Server-side/local bridge holds credentials; the browser
only requests a bounded upload operation or downloads the fallback.

Full live success requires owner evidence for current registration/type codes,
MAC/sensor/channel mapping, authentication, accepted payloads, and persistence
or query-back when claimed. A local JSON/CSV/mock/receipt is a classroom
fallback and candidate milestone only; it cannot be called platform persistence
or unlock WI-17/WI-18.

## 11. Slide and recording capture matrix

The matrix is a capture plan, not permission to implement all scenes before the
golden pilot passes.

| Keyframe family | What it teaches | Required visual evidence |
|---|---|---|
| Global count/height/local visibility | Starlink vs OneWeb quantity, altitude, and one-instant 10° local observation are different questions | switchable point clouds, separated height guides, NTPU mask/reveal, source/epoch cue, raw 0° provenance retained separately |
| TLE raw/parse/SGP4/moving object | A text record becomes a validated propagated state | raw two lines/checksum, parsed fields, coordinate/frame conversion, velocity/height, moving satellite |
| Two-angle vertices | Elevation and off-axis angle have different vertices | UE and satellite vertex markers, separate rays/arcs, camera hold |
| Beam-axis consequence | Boresight can move while elevation stays fixed | paused drag before/after, fixed geometry, changed off-axis/gain/link cue |
| Inter qualification/TTT/commit/receipt | A source-backed inter decision has stages and evidence | one transient comparator, TTT, discrete trace, commit pulse, compact receipt |
| Intra comparison | Same satellite vs changed satellite is a distinct handover type | same-satellite identity retained, beam change, explicit contrast frame |
| EE curve/scene | Lower transmit power and system EE/service are not identical | scene link/service, energy ledger, delivered data, ratio-of-sums, formula drawer |
| Platform plan/receipt | Select fields for inspection and preserve evidence limits | field/rationale/cadence view, local JSON/CSV, redacted acceptance receipt/queryback status |

The **60–90 s medium pilot** proves the visual language and one interaction. The
**12–15 min recording cut** is a narrated subset of the complete course with
holds and explanations. The **full lesson** includes all six learner scenes,
hands-on operations, fallback paths, and the final platform record; none of
these durations are interchangeable acceptance claims.

## 12. Current-state classification

Only these status values are allowed: `NOT_STARTED`, `WIP_FROZEN`,
`CANDIDATE_EVIDENCE`, `PASS`, `BLOCKED_OWNER`, `REJECTED`.

| Surface/evidence | Status | Reason |
|---|---|---|
| Old `/` homepage/dashboard compositor | `REJECTED` | Fixed rails/overlays and old classroom surface contradict scene-first correction; retain data donors only. |
| Old text-heavy TLE/Energy pages | `REJECTED` | Presentation fails the visual requirement; canonical model/data may remain as donors. |
| Current six-act student compositor | `REJECTED` | User explicitly rejected it as a base; CSS/manual hiding is not beat-driven composition. |
| Golden Flow visual pilot | `CANDIDATE_EVIDENCE` | Storyboard/implementation/video evidence exists, but controller owner pixel/video review has not recorded PASS. |
| Golden Flow official route cutover | `WIP_FROZEN` | Route/WIP changes exist but browser entry/evidence are not an accepted unlock. |
| Global constellation visual slice | `CANDIDATE_EVIDENCE` | Candidate screenshots/storyboard exist; overall journey/owner acceptance is not PASS. |
| TLE raw→parse→SGP4 teaching journey | `NOT_STARTED` | Runtime data path exists, but the requested dynamic teaching sequence is not accepted. |
| Canonical off-axis lesson | `NOT_STARTED` | Existing fragments do not prove full camera/beam-axis, freeze, and formula sequence. |
| Source-backed inter handover | `NOT_STARTED` | Existing handover/cinema fragments are not enough for accepted visual/truth gate. |
| Explainable multi-candidate ranking | `NOT_STARTED` | Current evidence does not authorize complete ranking factors. |
| Intra handover lesson | `NOT_STARTED` | No accepted same-satellite event/visual package. |
| EE scientific experiment | `NOT_STARTED` | Live power path/scientific preregistration and mechanism/policy boundary are not PASS. |
| Platform dry-run/live adapter | `NOT_STARTED` | Registration, A/B identity, credentials, and persistence/queryback remain owner boundaries. |
| Slides/recording package | `NOT_STARTED` | Candidate screenshots are not a narrated accepted package. |
| Full end-to-end course | `NOT_STARTED` | Downstream gates are not complete. |

Existing screenshots/video are evidence artifacts only. No item in this
backlog is credited `PASS` by the existence of a test, a source assertion, or
an old handoff sentence.

## 13. Governance and review ledger

* One implementation writer owns active source paths. Read-only reviewers may
  inspect/test in parallel but may not edit the writer’s paths.
* Before every worker starts, the controller checks active processes, dirty paths,
  branch/worktree, and exact scope. Never reset, stash, restore, commit, or push
  without an explicit owner instruction.
* Each item records prerequisites, worker, artifact paths, command output,
  browser viewport/DPR, reviewer question, owner decision, and status in an
  evidence ledger. A red pre-existing gate is recorded separately from a
  focused change gate.
* After each visual phase, a fresh-context reviewer compares the original brief
  and correction ledger with actual screenshots/video. The review must answer
  “what is on screen?” rather than “what does the DOM contain?”
* Controller-only gates: visual acceptance, scientific authority, platform
  registration/auth/A-B decisions, release scope, budget, commit, and push.
  Workers may recommend; they may not self-PASS.
* If an external model/provider is requested, record its actual runtime and
  review scope; do not silently substitute a different model. A reviewer does
  not become an implementation writer by editing the checkout.

## 14. Self-grill / adversarial risk review

Before each unlock, the controller must answer these questions with evidence:

1. Are the student’s actions changing a visible scientific/presentation state,
   or are they decorative knobs with no observable consequence?
2. If captions and cards are removed, does the animation still teach the
   phenomenon, or is text carrying the lesson?
3. Could a camera move be mistaken for a change in elevation, off-axis angle,
   orbit, or handover state?
4. Did the TLE lesson visibly show raw fields, checksum/parse, coordinate/frame
   transformation, SGP4, and position/velocity/height, or did a hidden helper
   skip the important steps?
5. Is every ranking factor source-backed, and is the unavailable path honest?
6. Was the EE result preregistered, matched, and ratio-of-sums, or was a hidden
   constant/fixture tuned to produce a sweet spot?
7. Does the narrative distinguish RF power, total system power, delivered data,
   service loss, and EE rather than treating a lower power number as saving?
8. Are timestamps and cadences explicitly simulated vs wall-clock, and are
   source/frame/run identities retained?
9. Are platform credentials, type codes, registrations, timestamps, A/B identity,
   acceptance, persistence, and queryback each bounded honestly?
10. Could the screenshots stand alone as teaching evidence, or would each require
    a paragraph to explain what the scene failed to show?
11. Does any route URL still land in a rejected legacy dashboard, even if a new
    prototype exists elsewhere?
12. Did a worker add a second renderer, a second scientific frame, or a permanent
    chrome surface because it was easier than directing the scene?

## 15. Compact traceability matrix

Every explicit requirement and correction has a downstream owner. A cell with
multiple WIs means the requirement is staged, not that any one of them is
complete.

| Source IDs | Work items |
|---|---|
| RQ-01, RQ-11, RQ-21, RQ-22 | WI-00, WI-03, WI-04, WI-18 |
| RQ-02, RQ-14, RQ-15 | WI-15, WI-16, WI-17, WI-18 |
| RQ-03, RQ-04, RQ-13 | WI-06, WI-18 |
| RQ-05, RQ-06, RQ-19 | WI-03, WI-04, WI-08, WI-17 |
| RQ-07, RQ-20 | WI-13, WI-14, WI-17, WI-18 |
| RQ-08, RQ-09, RQ-10 | WI-03, WI-09, WI-10, WI-11 |
| RQ-12 | WI-04, WI-07, WI-08, WI-09, WI-14 |
| RQ-16 | WI-04, WI-06, WI-07, WI-09, WI-14, WI-17 |
| RQ-17, RQ-18 | WI-06, WI-07 |
| CR-01, CR-02, CR-15 | WI-00, WI-01, WI-03, WI-04 |
| CR-03, CR-07, CR-08, CR-09, CR-10, CR-11 | WI-02, WI-03, WI-04, WI-06, WI-08, WI-14 |
| CR-04 | WI-01, WI-03, WI-08, WI-09, WI-13 |
| CR-05, CR-06, CR-13, CR-14 | WI-00–WI-18 core and EXT-01 governance gates |
| CR-12 | WI-05, WI-18 |
| CR-16 | WI-15, WI-16, WI-17 |
| TR-01, TR-05, TR-07 | WI-03, WI-08, WI-13, WI-14 |
| TR-02, TR-03, TR-04, TR-06 | WI-03, WI-07, WI-09, WI-10, WI-11, EXT-01 |
| TR-08, TR-09, TR-11 | WI-15, WI-16, WI-17 |
| TR-10 | WI-07, WI-15, WI-16 |
| TR-12, TR-13 | WI-01, WI-07, WI-09, WI-13, WI-15 |

## 16. Stop boundary

This document is an executable backlog and review contract, not a claim that the
course is complete. The earliest valid next action is **WI-04 Golden Flow
compositor/video owner review**. `PASS_WI-03` authorizes WI-04
authoring/review of the accepted structure/truth contract only; it does not
accept product pixels, the current compositor, the WI-09 full scientific event
lesson, or any formula, route, platform, commit, or push work. WI-05 and all
later items remain frozen.

WAITING_FOR_OWNER_VISUAL_ACCEPTANCE_WI-04
