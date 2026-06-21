# Handover Cinema + Multi-UE Service — SDD

**Status:** Draft (design authority for the showcase consolidation + handover-story
+ MODQN-integration-proof build). **Codex-reviewed 2026-06-06** (5 P1 + 4 P2 applied
— see §0).
**Date:** 2026-06-06
**Author:** Opus (architect) — implement per-slice with codex review.
**Related:** [frontend-render-governance.md](./frontend-render-governance.md),
[decisions/ADR-002-nav-surface-vs-lane-authority.md](./decisions/ADR-002-nav-surface-vs-lane-authority.md),
[modqn-training-scene-replay-sdd.md](./modqn-training-scene-replay-sdd.md),
[baseline-modqn-producer-data-defects-report-2026-06-06.md](./baseline-modqn-producer-data-defects-report-2026-06-06.md),
`.agent-memory/project_handover_cinema_data_ceiling_2026-06-06.md`

## 0. Codex review resolutions (2026-06-06)

- **[P1] ω-slider is a labeled COUNTERFACTUAL, not producer truth** (Rule#6). It never
  overwrites the artifact's recorded decision; it shows "what the policy WOULD pick at
  a different ω" from re-scalarized exported Q. §3.3, §9 reworded.
- **[P1] "exact for any ω" requires FULL DENSE per-objective Q + mask + invalid-action
  sentinel + tie order** — top-k is insufficient (a different ω can promote an action
  outside the original top-k). §3.3, §10 tightened.
- **[P1] One ambient default:** mosaic + aggregate only; links/glyphs/minimap are
  progressive disclosure AND focus-scoped during cinema. §3.1, §3.2.
- **[P1] S1 shrunk** to cinema wrapper + SINR explainer + one candidate-highlight path;
  ambient mosaic/links/glyphs are separate slices. §7.
- **[P2] SINR mosaic named a SINR-serving visualization** (not reused MODQN cell
  overlay) to respect the lane matrix. §3.1.
- **[P2] ω-slider downgraded from "primary integration proof"** — a front-end re-ranker
  proves exported Q is *usable/coherent*; integration proof needs provenance +
  checkpoint identity + dense Q/mask + producer-vs-baseline KPI. §3.3.
- **[P2] Synthetic KPI/numbers are illustrative-only**, visibly marked, excluded from
  every producer-proof validator. §8, §9.
- **[P2] Added validators** for dense coverage, mask fidelity, sentinel exclusion, tie
  determinism, synthetic badge on every proof surface, counterfactual copy. §8.

---

## 1. Goals (north stars)

Make THREE things directly visible, zero learning curve:

- **G1 — "Baseline MODQN is integrated and deciding"** + *why* a beam/sat was chosen,
  in terms tied to the algorithm's core (the multi-objective trade-off).
- **G2 — A clear intra/inter handover story:** auto-advance to the next handover,
  slow-motion, camera, the whole story (candidates → decision → winner) legible.
- **G3 — Multi-UE service is real, not decoration:** all 100 UEs are visibly served
  and distributed — never "1 UE performs, 99 are decoration."

**Principle:** fewer buttons, intuitive, zero learning. Rich detail appears
contextually and on demand; the default is low-density (governance Rule#10).

---

## 2. Current state (≈60–70% of the machinery already exists)

Four scene lanes (governance-owned, unchanged): `sinr-live`,
`modqn-live-cell-preview`, `modqn-replay-proof`, `artifact-replay`.

| Capability | Where | Status |
|---|---|---|
| Seek-next-HO + 0.25× slow-mo (CQ2) + orbiting camera (CQ1) + sat-pair framing + bounded auto-exit + restore + intra/inter | `DirectorControls.tsx`, `App.handleDirector*Focus`, camera FSM | ✅ sinr-live + modqn-live + artifact (ITEM #C) |
| Spotlight, HO-Slow | `ControlBar.tsx` | ✅ (separate checkboxes today) |
| Live handover event index / rail | live Walker index | ✅ |
| Live SINR engine + multi-sat + per-candidate SINR | `src/core/channel/*`, `generateWalkerConstellation` | ✅ real & non-degenerate on sinr-live |
| Per-UE service map (UE colored by serving cell) + per-cell UE-count badges | `deriveModqnServiceMap`, MainScene cell overlay | ✅ (modqn-live only) |
| Decision-metric tiles (reward/ω/scores/serving) | `AlgorithmDashboard` (C4) | ✅ (artifact sidebar) |
| Honesty badge for non-producer/synthetic source | FIX-1 `ArtifactSourceBadge`, `data-artifact-source` | ✅ |

New work is **additive**: an ambient layer (service mosaic + links + handover
glyphs + aggregate), the cinema wrapper + candidate-highlight + explainer, the proof
surfaces (counterfactual ω-slider / scoreboard / provenance), and the consolidation.

---

## 3. Architecture — three layered surfaces

Three layers stack on top of one **low-density default base**. They are sequenced so
they do not clutter: the base is minimal; deeper detail is opt-in or focus-scoped.

```
  [ PROOF ]    counterfactual ω-slider · KPI scoreboard · provenance glass-box  (on demand)
  [ STORY ]    handover cinema: micro/macro/meso shots + explainer              (on demand)
  [ AMBIENT ]  DEFAULT: service mosaic + aggregate.  OPT-IN: links · glyphs · minimap
```

### 3.1 AMBIENT layer — proves G3, keeps the scene alive

The default is **service mosaic + aggregate only** (low density, Rule#10). Links,
glyphs, and the minimap are progressive disclosure (opt-in), and during a cinema focus
they become **focus-scoped** (only the focused UE's link/glyph is bright; the rest mute).

- **Service mosaic (default on)** — every UE dot colored by its **serving beam** → 100
  dots partition into a colored cell mosaic = "every UE is assigned." A **handover = a
  dot changes color**; **load-balancing = a cluster migrates color together** (the
  G1+G3 money shot). **Lane naming (governance, [P2]):** on `modqn-live` this reuses the
  existing `deriveModqnServiceMap` cell overlay; on `sinr-live` it is a **distinct
  SINR-serving visualization** (UE→serving-beam by SINR), NOT the MODQN cell overlay —
  it must be named/validated as its own lane-owned layer so it does not violate "sinr-live
  keeps MODQN cell overlay off" (governance lane matrix).
- **Aggregate readout (default on)** — `served N/N`, per-beam load counts, avg
  SINR/throughput across all UEs. Always-true proof everyone is served.
- **Traffic queue proof (low-density default, rich on demand)** — every UE may
  carry a backlog/queue state: arrivals increase the queue; served bits drain
  it; unserved or under-served UEs accumulate pressure. This is the strongest
  "the other 99 UEs are not decoration" proof, but it is truth-bearing:
  - on `sinr-live`, the first acceptable source is a lane-owned deterministic
    traffic accountant labeled `live-service-demo`, or a validated/vendored
    traffic generator if the claim needs academic rigor;
  - on producer MODQN replay, queue/backlog, arrivals, served bits, and service
    rate must come from the producer trace. Missing queue truth is a source gap.
  Visual encoding stays dense-safe: per-UE halo radius/color for queue pressure,
  optional heatmap for area backlog, and side-panel distribution metrics
  (`avg`, `p95`, `max`, `starved UE count`, per-beam backlog bars). Do not draw
  100 text labels or per-UE React components.
- **Service links (opt-in, focus-scoped)** — a faint UE→serving-satellite line.
  Default off to keep density low; during a cinema focus only the focused link brightens
  so the other 99 stay served-but-muted, never decoration.
- **Handover glyphs (opt-in, focus-scoped)** — intra = a small beam-color flash on the
  UE; inter = an arc sweeping old-sat → new-sat. Surfaces handover *activity/rate*.

### 3.2 STORY layer — the handover cinema (deep-dive, on demand)

A single "▶ Handover Cinema" control with an `Off / Intra / Inter / All` filter.
On the next matching handover: lead-in seek → 0.25× slow-mo → orbiting camera → candidates
light up → explainer → winner highlight → bounded auto-exit → restore → auto-advance. The ambient **mosaic
+ aggregate stay visible**; links/glyphs become focus-scoped (focused UE only).

**Scale-adaptive shot types** (make intra/inter legible by framing):
- **micro (intra-HO)** — tight close-up on the UE + the two beams of one satellite.
- **macro (inter-HO)** — pull back to both satellites + the sweeping arc.
- **meso (group / cell)** — optional: a *group* event ("sat-A sets → its 28 UEs migrate
  to sat-B"), so multi-UE itself is the story.
- **queue-rescue** — focus the UE or cell with the highest queue pressure, then
  show the queue dropping after service or handover. This is a service-quality
  story, not just a handover story.

Reuses the existing Director seek/slow-mo/camera handlers; adds the candidate-highlight
scene layer + the explainer panel.

**2026-06-09 handover-effect resolution.** The user-facing goal is not another
mode. It is one cinema action that makes the next real handover visually
obvious:

- `Next HO` / `Next Intra` / `Next Inter` resolve the next matching event,
  seek to a lead-in, preserve source time, slow playback, and let the director
  camera frame the event.
- **Intra-HO visibility requires off-axis geometry.** The visual must show the
  previous and selected beams as two distinct fixed-cell/beam volumes around
  the UE. It must not use the legacy beam-on-UE render that recenters the beam
  on the focus UE and hides the handover.
- **Do not globally re-enable cell-cone clutter.** The prior all-cell cone
  render was rejected because it washed the viewport. The cinema uses a
  focus-scoped old/new beam pair plus optional muted context beams; ambient
  rendering stays low-density.
- **Inter-HO requires source event density.** If the current lane/profile or
  replay artifact has no inter-HO event, the inter control is disabled or shows
  a source gap. The renderer must not synthesize an inter-HO to balance the
  story.
- During focus, the explainer surface is lane-specific: SINR shows old/new
  SINR, delta, offset rule, off-axis, and old/new sat/cell/beam IDs; MODQN
  shows exported Q1/Q2/Q3, scalarized score, original weights, mask, and
  selected action for the same producer event sample.

**D4 complete (2026-06-09): SINR cell-truth S3a.** On `sinr-live`, the cinema
event index now comes from the same `stepRuntimeFrame + sinrLiveCells` source
used by the service mosaic. The rail, candidate highlight, SINR explainer,
focus-scoped old/new beam pair, and camera focus all carry the same source
owner (`sinr-live-cell-truth`), event ID, source time, UE ID, old/new cell IDs,
and off-axis telemetry. Legacy live-Walker events remain available for the
MODQN live-cell overlay demo path, but SINR cell-truth focus is no longer
claimed from the steered Walker forecast.

**2026-06-10 H5/I5 queue-focus completion.** **⚠️ RETIRED 2026-06-21 (`3ee4368`):
the `live-service-demo` queue focus stories were a synthetic display layer
(per-UE backlog from an FNV hash of the UE id — NOT producer truth) and were
removed: overlay panel `562e398`, then the model + gates `3ee4368`. The serving
mosaic + aggregate (served N/N, per-beam load, mean SINR) stay. The paragraph
below is the as-built record.** The `sinr-live` aggregate then
exposed two lane-owned `live-service-demo` service stories: highest queue
pressure and best queue rescue. They were panel-level focus/readout stories, not
new camera runtime, not producer queue proof, and not MODQN replay truth. The
model and browser gates required the source label, two focus rows, queue delta,
service surplus, and no per-UE queue labels.

### 3.3 PROOF layer — support the integration claim (on demand)

Honesty first ([P1]/[P2]): a front-end re-ranker proves the **exported policy values
are usable and coherent**, not by itself that the running simulator is the trained
network. The *integration* claim rests on the combination of **provenance (checkpoint
SHA/identity) + the real exported dense Q/mask + producer-vs-baseline KPI** — the
ω-slider is the interactive *illustration* of the policy's decision rule, not a
stand-alone proof.

- **Counterfactual ω-slider (interactive illustration of the paper's core).** Drag the
  objective weights → the view shows **what the policy WOULD pick at that ω**, recomputed
  as `argmax(w₁·Q1 + w₂·Q2 + w₃·Q3)` over the exported per-objective Q. This is faithful
  to MODQN's decision rule (3 independent per-objective Q-nets, scalarized only at
  decision time — `algorithms/modqn.py` docstring + lines 112/750-770/245-268; the
  `DQN_scalar` comparator must retrain per weight, MODQN does not — that contrast IS the
  contribution).
  - **It is a COUNTERFACTUAL, never producer truth (Rule#6).** leo NEVER overwrites the
    artifact's recorded decision. At the artifact's original ω the slider reproduces the
    recorded `selectedActionIndex` (a self-check); at any other ω it is labeled
    "counterfactual — what MODQN would choose at ω=…", visibly distinct from the recorded
    decision.
  - **Correctness requires FULL DENSE Q, not top-k ([P1]).** Reproducing the argmax for
    an arbitrary ω needs, per decision frame: the per-objective Q **for every action**
    (Q1[a],Q2[a],Q3[a]), the exact **action validity mask**, the **invalid-action
    sentinel** (−∞ / −1e9 excluded), and the producer's **tie-break order** (valid
    actions ranked by scalarized-Q then beam index). Top-k `objectiveQ` is insufficient —
    a different ω can promote an action outside the original top-k, silently missing the
    true argmax. Export contract in §10.
  - **Outcome metric:** dragging ω re-colors the mosaic as a counterfactual reassignment
    (labeled), making the multi-objective trade-off tangible — G1 illustration + G3 in
    one gesture. Synthetic-data version is illustrative-only (§9).
- **KPI scoreboard (outcome).** `MODQN: 82 HO / 14.2 Mbps / balanced` vs `greedy-SINR
  baseline: 140 / 14.0 / clustered` — "same throughput, half the handovers", the paper's
  claim. Needs the producer's MODQN-vs-baseline KPI export. **Synthetic numbers are
  illustrative-only and excluded from proof validators (§8/§9).**
- **Provenance glass-box (chain of custody).** Click a decision → trace to the trained
  checkpoint SHA → inference → this beam. Real commit hashes, real network. (Folds in
  the deferred pipeline-flowchart sub-task.) This is the strongest *integration* signal.

The per-objective Q-bars per candidate are the supporting detail inside the cinema
explainer.

**2026-06-09 integration-proof clarification.** Real MODQN handover cinema proof
is replay-synchronized, not live-controlled. For producer MODQN proof, the
cinema must be driven by one producer trace sample or an explicitly linked
event window from `docs/modqn-training-scene-replay-sdd.md`: same `timeSec` /
`slotIndex`, same old/new serving IDs, same satellite and UE positions, same
beam geometry, same handover event, same reward, and same dense-Q diagnostics.
The camera may add lead-in, easing, framing, and labels, but it must not choose
the handover time, reclassify intra/inter, or substitute live SINR/Walker state
for missing replay truth.

**2026-06-09 D6 consumer gate.** `leo-beam-sim` now exposes a MODQN replay
handover-cinema readiness stamp, not an active replay cinema, for current
artifacts. `buildModqnReplayHandoverCinemaGate` stays inside the replay-bundle
consumer layer and returns `ready` only when one focus row has a producer event
ID, renderable UE/satellite/beam fields, finite reward, masks, and dense-Q
proof. Otherwise the replay cue panel shows `source-gap` with stable field IDs.
The gate does not import the scene renderer, live Walker state, or live SINR
state.

---

## 4. Per-lane behavior + data strategy

Cinema + proof run on the live walker lanes (`sinr-live`, `modqn-live-cell-preview`)
and `artifact-replay`; inert on `modqn-replay-proof` (Rule#8). The explainer/claim is
**lane-truthful** (Rule#6/#7):

| Lane | Policy | Explainer "why" | Data |
|---|---|---|---|
| `sinr-live` | SINR-offset | "strongest SINR (X dB), beat serving by the offset" + per-candidate SINR | **REAL now** |
| `modqn-live-cell-preview` | MODQN overlay (overlay-demo) | per-objective Q bars + ω; ω-slider counterfactual — labeled `overlay-demo` | overlay-demo (honest label) |
| `artifact-replay` | producer MODQN replay | same MODQN explainer from exported dense per-objective Q | **synthetic-labeled → real** |
| `modqn-replay-proof` | — | inert | unchanged |

Data strategy:
- **SINR lane: real, now.** Multi-sat geometry, varied per-candidate SINR, real
  intra+inter handovers, real SINR-serving mosaic/links. Build + validate the whole
  ambient + cinema machinery here on REAL data — no synthetic, no producer dependency.
- **SINR cinema integration gap:** the ambient mosaic/aggregate can already read
  cell truth, but the seek/focus event index and candidate highlight must also
  be derived from the same cell-truth trajectory before the off-axis intra-HO
  cinema can be claimed. Until that lands, any steered-index focus is a
  profile-derived forecast, not the final cell-truth cinema.
- **MODQN lane: synthetic-labeled → real.** Until the producer ships a non-degenerate
  run + the dense per-objective-Q export (defects report + §10), the MODQN cinema /
  ω-slider run on a **clearly-labeled synthetic "showcase-shaped" artifact** (multi-sat,
  varied per-beam SINR, dense per-candidate Q1/Q2/Q3 + mask, real intra+inter HOs,
  spatially-distributed UEs). Swap the source when real data lands — no rework.
- **G3 depends on producer Defect 1.** "99 look like decoration" is literally the symptom
  of Defect 1 (env has no spatial per-beam assignment → all UEs collapse onto one beam →
  mono-color mosaic). On the SINR lane the mosaic is real today; on the MODQN lane it
  becomes self-evident once Defect 1 is fixed.
- **MODQN replay synchronization depends on producer trace completeness.** The real
  MODQN cinema must not ask the frontend to "control" intra/inter handovers. It replays
  producer event IDs at producer sample times. If the trace lacks old/new beam identity,
  satellite/UE geometry, dense Q, or event kind for that sample, the proof surface shows
  a source gap instead of inventing a synchronized event. D6 implements this as a
  fail-closed readiness gate; current artifacts remain blocked.
- **Traffic queue data strategy:** queue visuals are proof only when their source
  is explicit. `sinr-live` may use a deterministic traffic/service accountant as
  a live-service demo, but the claim label must say so. Producer MODQN proof
  requires per-UE queue inputs and outputs from the trace: arrival bits, queue
  before/after, served bits, service rate, and starvation/fairness metrics. The
  renderer must not infer backlog from dot color, serving identity, or camera
  focus.

---

## 5. Control consolidation map ("make them disappear")

The cinema becomes the primary interaction; scattered always-on controls fold away.

### 5.1 Fold INTO the cinema (vanish as separate controls)
| Control | Where | Fate |
|---|---|---|
| Spotlight | ControlBar (sinr-live) | automatic winning-beam highlight during a focus |
| HO Slow | ControlBar (sinr-live) | IS the cinema slow-motion |
| Director: Intra/Inter/Exit Focus | `DirectorControls` | the cinema play control + intra/inter filter + exit, plain-labeled |
| MODQN preset "Explain Handover" | Advanced setup (modqn-live) | the cinema candidate-highlight replaces it; preset stays hidden by default |

### 5.2 Move to **Advanced ⚙** (hidden by default; lane-gating preserved)
| Control | Where | Note |
|---|---|---|
| `Mode` (Presentation/Tuning/Diagnostics) | all | drives density/HUD defaults; raw selector → Advanced |
| density (few/normal/many) | sinr-live | default from Mode (Rule#10); manual override in Advanced |
| Beam Info | sinr-live | Advanced |
| camera presets (4) | sinr-live | cinema auto-frames; presets → Advanced |
| MODQN presets (Baseline/Service/Explain/Debug) | MODQN sub-lanes | Advanced |
| decision-policy toggle (Paper / Heuristic ω) | modqn-live only | Advanced. **`HeuristicNotPaperBanner` does NOT move — stays mandatory + non-dismissable when `omega-heuristic` is active.** Replay-proof and artifact lanes do not expose this live-policy selector. |
| left tabs: MODQN training / jobs / objective(ω editor) | modqn-live | "Setup" → Advanced |
| right tab: MODQN evidence | modqn-live | Advanced / contextual |

### 5.3 Keep (primary surface)
`LaneExperienceBar` as the two-tab SINR / MODQN top selector,
`ModqnViewToggle` as the in-MODQN Live / Proof / Artifact selector,
`TimelineBar`, Active UEs / Focus UE filter (artifact), the ambient
mosaic+aggregate + the cinema control + the explainer + the proof surfaces (on
demand).

### 5.4 Net
Default screen ≈ **3D scene with the service mosaic + aggregate + lane selector +
timeline + one "Handover Cinema" control.** Everything else on-demand or in Advanced ⚙.

---

## 6. Governance

- **SceneLane enum unchanged (4 lanes); no Rule#4 change.** Cinema/ambient/proof are
  lane-gated by the render plan; inert on `modqn-replay-proof`.
- **Every new viewport/HUD layer** (SINR-serving mosaic, service links, handover glyphs,
  candidate highlight, explainer, ω-slider, scoreboard, provenance, minimap) updates the
  lane matrix + a validator (Rule#9) before it ships, and carries the lane's claim
  (`sinr-offset` / `overlay-demo` / `producer` / `synthetic` / `counterfactual`) — never
  overclaims. The SINR-serving mosaic is explicitly NOT the MODQN cell overlay (§3.1).
- **Producer MODQN cinema is frame-locked replay.** In proof contexts, intra/inter
  handover kind comes from producer `handoverEvent.kind`. Frontend old/new sat-ID
  comparison may only validate consistency; a mismatch is a source-gap or validation
  failure, not a frontend override.
- **Cell-truth SINR cinema must be single-source.** In `sinr-live`, the event
  index, candidate highlight, explainer, and focus-scoped old/new beam pair
  must read the same `sinrLiveCells` trajectory. Do not mix a steered Walker
  event index with cell-truth cones and call the result synchronized.
- **Focus-scoped off-axis beams only.** The accepted path is a cinema-only
  old/new beam pair with restrained opacity and stable colors. Re-enabling
  every live cell cone as a default full-viewport layer is out of scope unless
  a later visual review reverses the 2026-06-08 render reset decision.
- **Beam presentation and physics calibration are deferred.** Beam color,
  beam-hopping display, beam width, and steering/scan-angle reach are high-risk
  because they affect apparent UE coverage, queue draining, and handover
  feasibility. Do not tune them as a quick visual fix during S2a/S3a. Use the
  current lane-owned geometry and labels first; if S3a cannot be synchronized
  without touching these parameters, stop and run the deferred audit slice
  before changing runtime behavior.
- **Queue proof is source-owned.** The queue halo/heatmap/sidebar may summarize
  queue state, but the renderer may not invent arrivals, backlog, served bits,
  or fairness values for a proof lane. Display-generated queue state must carry
  a `live-service-demo` or `synthetic` claim and stay out of producer-proof
  validators.
- **100-UE performance guardrail.** Queue halo/pulse uses instanced attributes
  or a mesh buffer updated at a bounded cadence (target 10-15 Hz for queue
  values), not 100 independent React state updates or per-UE materials.
- **SINR presentation controls stay sinr-live-owned** even inside Advanced.
- **Heuristic disclosure mandatory** — only the toggle relocates; the banner stays.
- **Display-only (Rule#6):** these surfaces change camera/speed/highlight/coloring + the
  explainer text, and re-scalarize exported per-objective Q **as a labeled
  counterfactual** — they NEVER alter the producer's recorded SINR, handover events,
  MODQN actions/decisions, rewards, geometry, or provenance.
- **Low-density default (Rule#10):** ambient default = mosaic + aggregate; links / glyphs
  / minimap are opt-in + focus-scoped.

---

## 7. Slice plan (S1 shrunk per codex [P1])

| Slice | Scope | Lane / data | Risk |
|---|---|---|---|
| **S1** | Cinema controller (arm / intra-inter filter / exit) wrapping the Director handlers + **one** candidate-highlight path + "why (SINR)" explainer panel | **sinr-live, REAL data** | low–med |
| **S2** | Ambient SINR-serving mosaic + aggregate (`served N/N`, per-beam load) on sinr-live. D3 complete: default 100-UE browser gate proves the mesh colouring and aggregate readout. | sinr-live, real | low |
| **S2a** | ~~Traffic queue service proof: per-UE queue accountant/source adapter, queue halo/heatmap encoding, and sidebar distribution metrics.~~ **RETIRED `3ee4368`** — the synthetic `live-service-demo` queue demo was removed (overlay panel `562e398`, scene glow layer + model `3ee4368`); the S2 serving mosaic + aggregate stay. Producer-backed queue proof remains a fresh requirement. | ~~sinr-live demo~~ → producer proof later | retired |
| **S3** | Service links + handover glyphs (intra-flash / inter-arc), focus-scoped; scale-adaptive shots (micro/macro) | sinr-live, real | med |
| **S3a** | Cell-truth handover cinema sync: derive the next-HO event index from the `sinrLiveCells` trajectory, drive candidate highlight from that event, and render only the focused old/new off-axis beam pair during cinema. **D4 complete:** source/event/off-axis telemetry is validator-locked; ambient all-cell cones remain parked. | sinr-live, real cell truth | done |
| **S4** | Explainer content abstraction (one panel: SINR reason vs MODQN per-objective Q) | both live lanes | low |
| **S5** | Synthetic "showcase-shaped" artifact (labeled) + per-objective Q-bar explainer | `artifact-replay` (synthetic) / modqn-live | med |
| **S6** | Counterfactual ω-slider (leo-side `w·Q` over dense exported Q) + KPI scoreboard, both labeled illustrative on synthetic | modqn-live / artifact | med |
| **S7** | Residual consolidation after D1/S5a: fold Spotlight/HO-Slow/Director/Explain into cinema; move remaining Mode/density/camera controls only after a scoped governance pass. MODQN presets/setup and live decision policy already live in Advanced. | all | med (validator churn) |
| **S8** | Polish: meso/group focus; minimap/heatmap; floating↔sidebar explainer; reduced-motion; auto-tour | all | low |
| **S9 deferred** | Beam presentation / beam-physics calibration audit: color language, hopping display, beam width, steering angle, service coverage, and destructive MODQN-mode buttons | all beam-rendering lanes, read-only first | high |
| **later** | Swap synthetic → real producer artifact + real ω-slider/scoreboard when the defects-report fixes land | artifact-replay | — |

Each slice: design → **codex review** → governance Rule#9 (matrix + validator) →
browser-verify (real SINR data S1–S4; producer-pinned + synthetic-labeled S5–S6) →
commit (push deferred). S1–S4 + S7 have **no producer dependency**; S5/S6's *real*
version does.

## 8. Validators

- S1: `validate:phase-c:handover-cinema:browser` — arm on sinr-live: slow-mo + camera
  move + one candidate highlight + SINR explainer; exit restores.
- S2/S3: assert SINR-serving mosaic colors (N served), aggregate `served N/N`, a handover
  recolors a dot, focus-scoped links/glyphs (only focused bright during cinema).
- S2a: queue/accounting validator proves `queueAfter = max(0, queueBefore +
  arrivals - servedBits)` per UE; unserved UEs accumulate; served UEs can drain;
  sidebar metrics match the same queue source; DOM/WebGL smoke proves queue
  halo uses instanced/buffer data and all proof labels disclose
  `live-service-demo`, `synthetic`, or `producer`.
- S3a: assert the cinema event source, candidate highlight, old/new beam pair,
  off-axis telemetry, and SINR explainer all resolve from the same
  `sinrLiveCells`-backed event. A regression gate prevents the old steered
  Walker index from feeding a cell-truth focus scene without an explicit
  `profile-derived-forecast` / `overlay-demo` label. D4 validators:
  `validate:phase-c:handover-cinema:model`,
  `validate:phase-c:handover-cinema:browser`,
  `validate:live-walker:handover-event-focus`, and
  `validate:frontend:scene-lane-governance`.
- S5: synthetic badge fires; per-objective Q bars per candidate; claim = `synthetic`/`overlay-demo`.
- S6 (ω-slider correctness, codex [P1]/[P2]): **full dense action coverage** (Q exported
  for every action, not top-k); **mask fidelity** (invalid actions excluded);
  **invalid-action sentinel** never argmax'd; **deterministic tie-break** (scalarized-Q
  then beam index) matches the producer; at the artifact's original ω the slider
  reproduces the recorded `selectedActionIndex` (self-check); at any other ω the copy
  reads "counterfactual"; **synthetic numbers excluded from producer-proof validators**;
  **synthetic badge present on every proof surface**.
- S7: `validate:frontend:scene-lane-governance` — Spotlight/HO-Slow/Director no longer
  separate mounts; Advanced lane-gated; heuristic banner mandatory; SINR controls not on
  other lanes; SINR-serving mosaic named distinct from MODQN cell overlay.
- S9 deferred: first validator is an audit/report gate, not a visual patch.
  It must enumerate every button/mode that changes beam colors, beam hopping
  display, beam width, steering angle, cone visibility, or service coverage;
  record its source of truth and lane; and capture before screenshots on
  `:3001` before any render change. Later implementation validators must prove
  no UI-only beam parameter change can alter proof claims or producer replay
  truth.
- No-regression: director-cinematic / compass / phase-3 / real-data gates.

## 9. Honesty / render-truth guardrails (non-negotiable)

1. The MODQN synthetic artifact is **always** loudly labeled (FIX-1 badge + warn) — an
   illustration of the intended visualization, never "MODQN proof." Synthetic KPI/scoreboard
   numbers are illustrative-only and **excluded from every producer-proof validator**.
2. The ω-slider is a **labeled counterfactual** — at non-original ω the copy says
   "counterfactual: what MODQN would choose at ω=…", visibly distinct from the recorded
   decision; leo never overwrites producer decision truth (Rule#6).
3. Explainer text is lane-truthful (SINR = signal strength; MODQN synthetic =
   "illustrative MODQN-style (synthetic)"; real producer = "producer MODQN").
4. Per-objective Q sourced ONLY from the producer's trained-network dense export — never
   the ntn-sim-core M1 heuristic adapter, never fabricated in leo. leo only re-scalarizes
   (`w·Q`) + re-ranks exported Q; it never invents Q values.
5. leo never computes/alters MODQN decisions; it displays + re-scalarizes exported Q as a
   labeled counterfactual (CLAUDE.md §1/§2, Rule#6).

## 10. Producer dependencies (for the real MODQN version — see the defects report)

- **Defect 1 (CRITICAL):** spatial per-beam assignment + per-beam antenna pattern → UEs
  distribute across beams (enables the real service mosaic + G3). HEAVY → server.
- **Defect 2:** interference + per-beam-differentiated SINR + link-budget audit. HEAVY.
- **Defect 3:** rebalance r1/r2/r3 reward scales (kill the 982× dominance) so the
  multi-objective trade-off — hence the ω-slider — actually moves decisions. HEAVY.
- **Defect 4:** denser constellation + spread UEs → real intra+inter handovers. HEAVY.
- **Export (LIGHT, no retrain) — stricter than top-k (codex [P1]):** emit, per decision
  frame, the **FULL DENSE per-objective Q over all actions (Q1[a],Q2[a],Q3[a]) + the
  exact action validity mask + the invalid-action sentinel + the producer tie-break
  order**. Top-k `objectiveQ` is insufficient for an arbitrary-ω argmax. Also export the
  **MODQN-vs-baseline KPI** for the scoreboard.
- **Scene trace export (REQUIRED for real synchronized cinema):** emit or derive a
  validated `modqn-training-scene-trace-v1` / `visual-showcase-v1` replay window whose
  handover event sample carries same-time satellite state, beam geometry, UE position,
  previous/selected serving, event kind, reward, dense Q, masks, model/checkpoint
  identity, and claim boundary. Without this, leo can prove training-pipeline
  integration but not scene-synchronized MODQN service/handover truth.

S1–S4 + S7 do NOT depend on the producer (real on the SINR lane). S5/S6's *real* version
+ the ω-slider/scoreboard's *real* version depend on the producer fixes; until then they
run on labeled synthetic data.

For SINR, the former producer-independent blocker S3a is complete: the event
index, camera focus, explainer, and old/new beam rendering now share the same
cell-truth source. Remaining MODQN replay cinema proof is still blocked by the
producer dense-Q / scene-trace completeness in §10.

## 11. Deferred Beam Presentation / Beam-Physics Calibration

This is deliberately last. Prior attempts to fix beam color, beam-hopping
presentation, beam width, and scan/steering angle by direct visual tuning made
the MODQN screen harder to understand. The next attempt must be audit-first.

### 11.1 Why it is high risk

- Beam width and steering angle affect how many UEs a satellite can appear to
  serve and how many UEs a beam appears to cover.
- Beam hopping affects whether a UE is truly served in a slot, whether queue
  can drain, and whether a handover target is even active.
- Color language affects whether users can distinguish serving beam, candidate
  beam, frequency reuse, old/new handover pair, queue pressure, and source-gap
  status.
- MODQN proof lanes must not inherit SINR/demo beam parameters as if they were
  producer truth.

### 11.2 Audit-first todo

Before changing any beam color, hopping visualization, beam width, or steering
angle:

1. Inventory every visible control or mode that changes beam rendering.
2. For each control, record lane, source owner, rendered layer, claim label,
   current data source, and whether it changes truth or only presentation.
3. Identify destructive or confusing MODQN-mode buttons and decide whether to
   fold them into Advanced, relabel them, or delete them.
4. Capture before screenshots and DOM/WebGL telemetry from the existing
   `:3001` server.
5. Propose one canonical color language and one canonical beam-hopping display
   contract before implementing visual changes.

### 11.3 Stop rules

- Do not widen beams, increase steering angle, or change beam-hopping cadence to
  make handovers, queue draining, or service coverage look better.
- Do not use beam color as a hidden data channel unless the same color meaning
  is documented in governance and validated for the lane.
- Do not globally re-enable previously rejected cell-cone render paths without
  a screenshot-backed visual review.
- Do not let MODQN replay proof consume live SINR beam geometry or hopping
  state unless the producer trace explicitly owns those fields.

S2a queue proof and S3a handover cinema may use the existing geometry and
source-owned labels. If they expose a true geometry inconsistency, S9 audit may
move earlier, but implementation still starts with audit, not parameter tuning.

**2026-06-10 D7 audit completion.** The audit-first gate now lives in
`docs/beam-presentation-calibration-audit.md` with a validator-backed inventory,
canonical color-language proposal, and beam-hopping display contract. Before
screenshots/telemetry are captured by
`APP_URL=http://localhost:3001 npm run capture:beam-presentation-audit` into
ignored `output/beam-presentation-audit/2026-06-10/`. No beam width, steering
angle, color token, hopping cadence, or parked ambient cell-cone render path was
changed in this audit slice.

## 12. Open questions

- Explainer default placement (floating during focus vs sidebar) — propose floating,
  setting in S8.
- Minimap/heatmap: unify with the service mosaic as one minimap with modes, vs separate.
- ADR-002 nav 4→3 is superseded by the 4→2 MODQN tab consolidation; the §5
  cinema consolidation remains the residual "fewer buttons" path after D1/S5a.
