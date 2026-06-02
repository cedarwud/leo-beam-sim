  Critical-Review Report: Master SDD — Dynamic Showcase, Algorithm Dashboard &
  Multi-Catfish Roadmap

  Scope: Academic Rigor · WebGL Performance · SVG Data-Binding · Roadmap Soundness ·
  Lane-Governance Collisions

  1. Executive Summary

  Verdict: APPROVED WITH REVISIONS — DO NOT START PHASE 1 OR PHASE 4 AS WRITTEN.

  The SDD has the right instincts but the wrong map. Its visual concept (dual-axis
  macro tint + micro flash-on-event), its fail-closed posture (§5.2), and its
  viewport-decoupling rule (§5.3) are well-oriented and align with shipped
  governance. The headline 100-UE visual is highly feasible — the instanced
  rendering substrate already exists.

  But the document was written as if leo-beam-sim were greenfield. It never
  references the four shipped truth-anchors that govern exactly the surfaces it
  touches: frontend-render-governance.md (lane matrix + Rule#9),
  modqnVisualLayers.ts (the four-preset taxonomy), usePlaybackControls.ts (the
  source-bound effectiveSpeed engine), and the scene-lane-governance validator. As a
  result it (a) misrepresents a stdout-scraped, episode-coarse SSE stream as a
  "real-time WebSocket Rewards/Pareto/Weights" feed the producer cannot emit, (b)
  specifies a flowchart animation bound to wall-clock React render intervals that
  §5.1 does not forbid as a mock, and (c) proposes five concrete lane collisions
  that would ship governance violations if implemented literally.

  None of this is shipped code — it is a planning-doc defect set, all fixable by a
  doc rewrite before implementation, mostly by reusing infrastructure the SDD didn't
  know existed. The bad news: the two most-blocked phases (Phase 1 telemetry, Phase
  4 multi-catfish) sit first and last on a strictly-serial Gantt, and both carry
  unacknowledged cross-repo producer dependencies governed by ntn-showcase-stack —
  not leo-beam-sim.

  2. Detailed Critique per Axis

  2.1 Academic Rigor — CONCERNS (1 strength, 4 major, 1 minor)

  - [MAJOR] "Real-time WebSocket Rewards/Pareto/Weights" is fiction. The producer
  emitter (modqn-paper-reproduction/.../progress_events.py:87-134) is regex-scraping
  of subprocess stdout, emitting only episode-coarse
  scalarReward/r1Mean/r2Mean/r3Mean/totalHandovers + a single final: line. No
  per-step loss, no Pareto front, no live weights. learning_rate/objective_weights
  are input hyperparams (config_writer.py:194), never emitted. Transport is SSE, not
  WebSocket (JobsPanel.tsx:266 EventSource). A "real-time Pareto/loss/weights"
  panel renders empty — or gets backfilled from the replay bundle, silently
  breaching §5.1. (§2 also misattributes the DRL engine to ntn-sim-core; it's
  modqn-paper-reproduction.)
  - [MAJOR] Cross-repo nature of live telemetry unacknowledged. Adding
  loss/Pareto/per-step channels means changing what the Python trainer prints —
  governed by ntn-showcase-stack, and contradicting the committed backend SDD (§2.2
  "no producer-side CLI change beyond --output-dir"; §12.3 "No streaming progress in
  v1"). Risk: an implementer fabricates the channels locally to hit the demo.
  - [MAJOR] Flowchart "data flowing in real-time" is a structurally-mocked animation
  §5.1 doesn't forbid. Binding stroke-dashoffset to "React render intervals to
  mimic" packet flow is fake motion — passes §5.1 while being a mock, the exact "NOT
  hardcoded animation" failure the user named. The repo's own governance already
  enforces the stronger rule (governance.md:211-212: "source gap instead of fake
  hopping animation").
  - [MAJOR] Live-vs-replay reward provenance conflated. RewardCurvePanel.tsx renders
  from a post-hoc ModqnReplayEnvelope; live SSE carries differently-named
  episode-coarse fields. SDD never separates the surfaces or forbids labeling the
  replay panel "live training."
  - [MINOR] §5.2 fail-closed covers disconnect but not a stale-but-connected stream.
  A hung trainer still emits 10s heartbeats (api.py:817-829 + worker.py:248); the
  frontend just never separates "age of last progress event" from "age of last
  heartbeat," so it can show frozen reward/episode as live. 2D-surface-only fix.
  - [STRENGTH] §5.1/§5.2/§5.3 rigor posture is correctly oriented — keep verbatim.
  Make the principles enforceable (motion, staleness, provenance), don't reverse
  them.

  2.2 WebGL Performance — FEASIBLE (2 strengths, 4 minor)

  - [STRENGTH] 100-UE already instanced correctly. SecondaryUeInstances
  (GroundScene.tsx:142-201) = one InstancedMesh + setColorAt, ~2 draw calls
  regardless of count. Macro layer feasible at 60 FPS. Caveat: per-UE glow radius
  can't vary on meshStandardMaterial (shared emissiveIntensity) — needs
  onBeforeCompile + instanced attribute or scale-fake.
  - [MINOR] A per-frame setState already re-renders the whole 100-UE tree.
  useSimulation.ts:465 setVersion(v=>v+1) per frame busts
  sceneFrame→modqnServiceMap→100-UE .map(). Congestion pulse + live curve compound
  it. Drive pulse via useFrame matrix/uniform mutation; keep per-slot projection as
  the only React prop; validator on GroundScene prop-identity stability.
  - [MINOR] "200 particles/cone" is the new emissive shader (§4.3), not the existing
  2-4 SpineParticles. One Points/InstancedMesh/cone, motion from a time uniform,
  scoped to the focused/Explain-Handover lane.
  - [MINOR] Phase-4 ExtrudeGeometry on ~201/238-shape SVGs → hundreds of draw calls
  + sync triangulation + first-frame shader stall on the planetarium frame. Extrude
  only the ~18-shape training-loop SVG; mergeGeometries (≤10 draw calls); warm
  shader pre-mount; skip <text>.
  - [MINOR] FPSCounter per-frame setState is an anti-precedent — but any "no
  setState in useFrame" lint MUST allowlist useSimulation.ts:465 (the deliberate
  engine frame-publish). New HUDs follow the SceneTelemetry ref pattern.
  - [MINOR] Director lerp must reuse existing speed/slow-mo hooks — useFrame
  mutating camera.position/controls.target directly, time-dilation through
  playback.effectiveSpeed, zero per-frame setState. Don't store interpolation t in
  React state.

  2.3 SVG Data-Binding — CONCERNS (1 strength, 1 major, 5 minor)

  The primitive (stroke-dashoffset path flow) is right; the driver (React render
  intervals) and implied resolution (per-step/ms) are wrong.

  - [MAJOR] No ms-level per-step source exists. Only coarse episode-level progress
  streams. Animating continuous ms packet flow while real signal updates once per
  episode fabricates data density → breaches §5.1. Fire edge pulses only on real SSE
  event boundaries; label the loop episode-paced.
  - [MINOR] React-render binding contradicts the repo's decoupling precedent — but
  §4.1 task 4 already prescribes "CSS and SVG line transitions," so only §1.2 prose
  needs editing. Correction: do NOT reuse the SceneTelemetry useFrame pattern —
  useFrame is R3F-bound; the 2D dashboard is a separate React-DOM lane. Use CSS
  animation or a single rAF writing style.strokeDashoffset on id-selected refs.
  - [MINOR] Decimate to display cadence + label honestly — coalesce to one frame per
  rAF; show true underlying count; dash period is a display constant, not a
  data-rate.
  - [MINOR] State-management: forbid per-step React re-render (refs+rAF). But
  Zustand is not a dep — reuse the established memoized React Context
  (runtimeContext.ts ModqnEnvelopeContext) for episode-level state; don't add a
  library.
  - [MINOR] The dynamic-binding layer is entirely net-new. research-visual-lab ships
  static figures only (semantic ids, zero data-*; animation C5 / telemetry C7
  unimplemented, sanitizer strips <animate>). Name a net-new svgFlowBinding module
  pinned to semantic ids.
  - [MINOR] Phase-1 60fps validation must measure the React-commit channel.
  JobsPanel.tsx:271 setStates on every SSE message incl. heartbeat — assert bounded
  re-renders under a synthetic 60Hz burst + sustained 3D frame timing via
  leo-fps-counter. (Heed validator-canvas-vs-react-attr: gate on the same DOM
  element's own attr.)
  - [STRENGTH] CSS stroke-dashoffset is main-thread-safe + well-matched for these
  6-11-edge SVGs. Corrections: it's main-thread paint (not compositor-only);
  precompute getTotalLength() once on mount.

  2.4 Roadmap Soundness — CONCERNS IN PHASE 1 & 4 (2 strengths, 2 major, 1 minor, 1
  nit)

  - [MAJOR] No phase carries a governance validator hook. Rule#9 mandates
  lane-matrix update + validator before ship; all four Validation lines are ad-hoc
  despite every prior slice family (phase-b/-c/-d/-h/-i) shipping a named gating
  validator. Regression from the project's own enforced process.
  - [MAJOR] Phase 2 DirectorMode must extend the shipped slow-mo display axis, not
  reinvent it. modqn-demo resolves to TWO lanes (sceneLane.ts:18-22);
  modqn-live-cell-preview is already live-walker-owned with active slow-mo focus;
  only modqn-replay-proof lacks a window. Real gaps: OrbitControls ownership
  arbitration on the shared surface, and reusing effectiveSpeed/CinematicMode rather
  than a parallel override that races ShowcaseReplayController (App.tsx:1258).
  Net-new = only the camera lerp/slerp engine.
  - [MINOR] SDD rediscovers shipped work — but "1-UE→100-UE" is raw intent not a
  deliverable (100-UE ships), and :131 does say "Connect the existing
  HandoverEventRail." Surviving point: reframe Phase 2 as a delta over CinematicMode
  + slow-mo focus.
  - [NIT] Estimates/serialization — Gantt does carry day durations (~30d). Surviving
  critique: not scoped as deltas; strict serialization forces unblocked viz to wait
  behind the cross-repo telemetry blocker (against your continuous-dev preference).
  Run viz in parallel with a Phase 0 producer negotiation.
  - [MINOR] Phase 4 multi-catfish dependency mis-anchored. Training path already
  exists upstream (allowlist.py:108-123 MultiCatfishV2Config; consumer maps arm
  a5→multi-catfish). Real blocker: no frozen multi-catfish replay bundle in
  artifacts/, and CLAUDE.md §3 requires ntn-sim-core validation first. (Backend
  SDD's "B0-B4 NOT started" header is stale.)
  - [STRENGTH] Guards §5.2/§5.3 are code-grounded — fail-closed badge maps to
  JobsPanel.tsx:312; decoupling aligns with SceneTelemetry.

  2.5 Governance Collisions (highest-value cluster)

  The SDD never references the lane governance, preset taxonomy, speed engine, or
  validator. Five collisions:

  - [MAJOR] Phase-4 extrusion vs Rule#1/#9 — §1.2 already says "secondary 3D
  viewport" (the right fix); §4.4 "alongside the planetarium" is loose. Genuine gap:
  no Lane Matrix row / validator extension.
  - [MAJOR] DirectorMode vs Rule#2/#6/#8 — auto-raising cones from play state alone
  violates Rule#2; standalone 0.05x is a second speed authority; slow-mo on
  modqn-replay-proof fabricates a source horizon. Fix: HANDOVER_FOCUS_SPEED through
  effectiveSpeed; gate cone-raise behind the explicit focus buttons; reuse
  HandoverEventRail.tsx:294 sourceOwner/horizonKind.
  - [MAJOR] Macro/micro layers ignore the preset taxonomy vs Rule#3/#4/#10 — §3.1
  keys cones on camera zoom, but the shipped path gates on the preset
  (MainScene.tsx:576). Map: macro tint→Baseline Faithful; all-serving cones→Service
  Allocation; focus cones+arcs→Explain Handover. DirectorMode selects the preset,
  not a zoom-driven raise.
  - [MAJOR] No declared target lane; mermaid wires SimState→BeamViz, bypassing the
  render plan (sceneLaneRenderPlan.ts:68-133). Declare modqn-live-cell-preview only;
  redraw as SimState → resolveSceneLane → resolveSceneLaneRenderPlan → {layers}.
  - [MAJOR] 2D dashboard is a new truth-bearing surface; §5.3 alone ≠ Rule#9. Lane
  Matrix + 1049-line validator cover only the four 3D lanes. Add a non-3D-surface
  governance section + an import-assertion (no three.js / no <Canvas> on truth
  lanes).
  - [STRENGTH] Dual-axis macro tint + flash-on-event is the correct
  default-low-density design (matches Baseline Faithful + Rule#10).
  - [MINOR] Phase ordering risk — §4.2 wires rail-click→Director Tour before
  reconciling with existing slowMotionFocus; land the effectiveSpeed/preset
  reconciliation first, reuse deriveHandoverRailSlowMotionFocus.

  3. Identified Risks & Mitigation Strategies

  #: R1
  Risk: Telemetry-truth gap — promises live Pareto/loss/weights the producer can't
    emit; easy path backfills from replay or synthesizes
  Sev: Major
  Mitigation: Rewrite §2/§4.1 to SSE + episode-coarse means; tag channels
  emitted-now
     / requires-producer-change / post-hoc-replay-only; invariant: replay envelope
    MUST NEVER back a "live" panel; extend phase-d:reward-curve validator for
    per-panel provenance
  ────────────────────────────────────────
  #: R2
  Risk: OrbitControls-vs-script-lerp collision — Director owning controls + parallel

    0.05x races effectiveSpeed→ShowcaseReplayController and can lock controls
  Sev: Major
  Mitigation: One speed authority (HANDOVER_FOCUS_SPEED lowers effectiveSpeed); tour

    as useFrame mutation; explicit camera-ownership handoff + guaranteed
    return-to-OrbitControls
  ────────────────────────────────────────
  #: R3
  Risk: WebGL leaks / shader-compile stall — Phase-4 extrude on 200+ shapes;
    mode-switch undisposed
  Sev: Minor (gated)
  Mitigation: Extrude ~18-shape SVG only; merge geometries; warm shader pre-mount;
    dispose on switch; named validator; own non-truth Canvas
  ────────────────────────────────────────
  #: R4
  Risk: Lane-governance regressions — camera, particles, 2nd viewport, 2D dashboard
    ship without matrix rows/validators
  Sev: Major
  Mitigation: Rule#9 per layer; gate cones on preset (never zoom/appMode+play);
    non-3D governance section; assert Director inert on proof/artifact lanes
  ────────────────────────────────────────
  #: R5
  Risk: Staleness — heartbeat-connected but progress-frozen shows as live
  Sev: Minor
  Mitigation: §5.2: heartbeats but no progress for N s → "Telemetry Stalled" grey,
    distinct from "Offline"; compute nowMs - tsMs(last progress); no producer change
  ────────────────────────────────────────
  #: R6
  Risk: Structurally-mocked motion — edges pulse on render clock while trainer idle
  Sev: Major
  Mitigation: Harden §5.1 to forbid fake motion + state; key each edge to an emitted

    event id; validator gates animation on non-null last-event id

  4. Actionable Enhancements (add to the SDD)

  Architecture/wiring: (1) redraw §2 mermaid so layers read the render plan, not
  SimState/appMode; fix ntn-sim-core→modqn-paper-reproduction + "WebSocket"→"SSE".
  (2) declare modqn-live-cell-preview as the only target lane. (3) map every visual
  layer to the four-preset taxonomy. (4) add a Phase 0 producer-telemetry-contract
  negotiation; run Phase 2/3 viz in parallel. (5) name a net-new svgFlowBinding
  module (rAF, not useFrame); don't block on lab C5/C7/C9/C13.

  Caps/invariants: (6) one speed authority = effectiveSpeed. (7) 200/cone + global
  cap, GPU-uniform-driven, Explain-Handover-scoped. (8) extrusion ≤10 draw calls,
  training-loop SVG only. (9) per-frame signals via useFrame/uniforms not React
  state; GroundScene prop-identity validator. (10) replay envelope never backs a
  "live" panel + vice-versa. (11) heartbeat-vs-progress staleness budget.

  Governance/validators (Rule#9, per phase): (12) one named gating validator per
  phase; (13) non-3D-surface governance section for the dashboard; (14) harden §5.1
  to "fake numbers, motion, and state"; (15) cosmetic: §5 is clause-numbered not
  §5.x, reconcile badge wording.

  5. Verdict

  APPROVED WITH REVISIONS — CONCERNS IN PHASE 1 AND PHASE 4; PHASE 2 BLOCKED ON
  GOVERNANCE RECONCILIATION.

  Platform is feasible and largely de-risked by shipped code. Core instincts sound.
  Not approvable as written: one telemetry-truth misrepresentation, one motion-mock
  loophole, one provenance conflation, five lane collisions, two phases first/last
  with unacknowledged cross-repo producer deps. All in an untracked planning doc —
  none shipped — all fixable by a rewrite that reuses existing infrastructure.

  9-intent coverage — solid/feasible: high-density 100-UE, integration-proof design,
  showcase buttons, queue/traffic, SVG dashboard surface, SVG-lab leverage. At
  risk: (1) Live Interactive Training (live loss/Pareto/weights don't exist at
  source — cross-repo); (2) Integration Proof (render-interval flowchart undercuts
  "not hardcoded animation"); (3) Director Mode (only viable as a delta over shipped
  slow-mo/effectiveSpeed/preset); (4) Multi-Catfish (training path exists upstream
  but no frozen validated bundle).

  Gate to lift: rewrite §1.2/§2/§4/§5 (telemetry truth, lane/preset/speed binding,
  per-phase validators, Phase 0, hardened §5.1). Then Phase 2+3 proceed in parallel;
  Phase 1 live-curve and Phase 4b gate on named producer milestones.

  ---
  One refuted finding dropped: a claim the Gantt lacked day estimates (it has them —
  downgraded to the nit above). Want me to apply the §1.2/§2/§4/§5 rewrites
  directly to the SDD, or draft the Phase 0 producer-telemetry-contract slice
  (heavy, cross-repo — ntn-showcase-stack-governed)?