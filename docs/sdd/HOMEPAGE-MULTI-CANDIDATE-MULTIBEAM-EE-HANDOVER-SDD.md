# Homepage multi-candidate, multi-beam EE handover SDD

## Document state

- **Status:** accepted for staged S0–S2 implementation; independent Opus design
  gate passed; **S3–S6 visual implementation is paused pending the 2026-08-28
  recovery-amendment gate below**; forecast-EE activation gate remains blocked
- **Date:** 2026-08-27
- **Route:** `/` only
- **Runtime source:** Starlink Walker by default, in accordance with ADR-013
- **Decision record:** ADR-014
- **Visual acceptance target:** the existing `http://127.0.0.1:3000/` session
- **Review receipts:**
  `docs/reviews/HOMEPAGE-MULTI-CANDIDATE-OPUS-GATE-2026-08-27.md` and
  `docs/reviews/HOMEPAGE-MULTI-CANDIDATE-VISUAL-RECOVERY-OPUS-GATE-2026-08-28.md`

## 0. 2026-08-28 visual-recovery amendment

### 0.1 Why this amendment is required

The 2026-08-27 independent review authorized only S0–S2. Later S3–S5 work
introduced candidate identity and presentation, but it also allowed the
presence of a `HandoverDecisionFrame` to suppress established homepage scene
layers. The resulting scene could satisfy identity, colour, and one-solid-link
assertions while losing the visible handover choreography that those new
layers were meant to extend.

This is a design and acceptance failure, not permission to revert the
multi-candidate domain model. The scientific candidate set, shared inter/intra
procedure, satellite-colour identity, and one-active-link rule remain in force.
The repair changes how the presentation is composed: the central scene is an
additive extension of the established handover carrier, not a replacement for
it.

For central-scene parity only, the visual reference is the homepage immediately
before broad candidate-authority suppression was introduced: the parent of
commit `16f46af` (`d66afbb`). This reference does not authorize a source-code
rollback and does not supersede later scientific or state contracts.

### 0.2 Non-negotiable additive scene contract

Activating multi-candidate authority must not, by itself, hide the established:

- current serving satellite, serving beam, footprint, and sole solid data link;
- orbit/motion guides that are enabled by the current presentation plan;
- handover focus, pulse/ripple, source-target transition cue, and camera
  choreography;
- UE, satellite, beam, and event callouts required to understand the event; or
- readable completion receipt/toast.

Candidate presentation is layered onto that carrier:

| Phase | Required central-scene evidence |
|---|---|
| monitoring | Existing serving scene remains visually unchanged; candidate clutter is absent. |
| evaluating | The serving link stays solid. At least two measured alternatives are visible when the same scientific frame contains them, using hollow endpoints and dotted/dashed guides rather than active-flow animation. |
| qualifying / TTT | Each displayed qualified satellite-beam pair keeps its own visible progress cue; the existing serving and motion layers continue. |
| selection-hold | The provisional leader is emphasized without hiding other still-qualified candidates or implying that it already serves data. |
| switching | The established inter/intra handover choreography plays. The old solid link ends at the same commit boundary at which the new solid link begins; no frame implies DAPS. |
| guard / receipt | The committed pair retains its episode identity colour, the normal serving animation continues, and the completion receipt remains long enough to read. |

A single broad boolean such as `multiCandidateAuthorityActive` must not be used
as a blanket negation around unrelated legacy layers. Compatibility adapters
may change those layers' input from legacy scalar fields to the immutable
decision frame, but a new adapter must reach visible parity before the old
render path is removed.

Visual ownership is phase- and layer-scoped. A decision frame proves that
candidate facts exist; it does not prove that a replacement scene object was
successfully rendered. An established layer may be retired only when its named
replacement has valid geometry, is visible in the current phase, and passes
the same-frame scene/rail join. If the candidate plan exists but produces zero
renderable pairs or zero event cues, the established serving/event carrier
remains visible.

Missing `placementByCellId`, satellite-world position, or beam geometry must
not be swallowed by a silent `return null`. The renderer publishes the exact
unmapped satellite-beam-source-frame keys as telemetry and fails the matching
browser fixture. A right-rail row cannot count as visually presented unless a
scene object with that same key is rendered, except for honestly labelled
overflow rows.

When visual density exceeds the measured budget, reduce the displayed
candidate subset, label honest overflow, or simplify candidate-only geometry.
Do not recover capacity by removing the serving/event carrier.

### 0.3 Right-rail readability contract

The right rail may be structurally redesigned, but density is not allowed to
make the decision unreadable. At desktop acceptance sizes:

- primary headings and the current phase use a computed font size of at least
  18 px;
- candidate identity, status, key EE/quality value, and TTT text use at least
  16 px;
- secondary provenance may use 14 px, but it must not carry information needed
  to understand why a target was selected;
- at least three candidate rows are readable without nested scrolling at
  1366 x 768, and four at 1920 x 1080;
- progressive disclosure, not font shrinking, resolves overflow; and
- no panel, tooltip, or receipt covers the primary UE, current footprint, or
  selected target during its relevant phase.

The rail and scene consume the same immutable frame and presentation plan.
Passing identity equality or no-overlap assertions alone does not establish
readability.

### 0.4 Required gates before further S3–S6 implementation

Implementation beyond documentation remains blocked until a fresh-context
independent reviewer returns `VISUAL_RECOVERY_IMPLEMENTATION_GATE: PASS` after
reviewing this amendment, ADR-014, the pre-authority carrier, and the current
render suppression sites. The review must explicitly answer:

1. Does the plan preserve the established carrier and add candidate evidence?
2. Can every phase be understood without treating a candidate as active data
   service?
3. Are inter- and intra-satellite events covered by the same phase contract?
4. Are density, typography, and overflow resolved without hiding central
   evidence?
5. Are automated invariants clearly separated from human visual acceptance?

After implementation, a separate `VISUAL_RECOVERY_ACCEPTANCE_GATE: PASS`
requires all of the following from port 3000:

- matched before/after evidence at monitoring, evaluating, qualifying/TTT,
  selection-hold, switching, and receipt;
- one continuous inter-satellite recording and one continuous same-satellite
  beam-switch recording, rather than isolated first-frame screenshots;
- browser telemetry proving the visible candidate count, exact satellite-beam
  keys, one solid data link, and synchronized rail/scene phase at the sampled
  frames;
- a red browser assertion when an event phase has zero candidate scene objects
  and zero established event cues, or when the rail reports one active link
  but the scene reports zero or more than one solid link;
- explicit failure telemetry for every displayed pair that lacks cell
  placement, satellite-world position, or beam geometry;
- computed-font and obstruction assertions at 1920 x 1080, 1440 x 900, and
  1366 x 768;
- pixel review confirming that serving geometry, candidate guides, UE, and
  event effects are visible against the scene; and
- owner visual acceptance. Cross-model review and automated tests are advisory
  evidence and cannot substitute for this final human gate.

### 0.5 Recovery implementation order

1. Freeze deterministic inter/intra phase fixtures and capture the
   pre-authority carrier reference.
2. Remove blanket render suppression and restore the established serving,
   motion, event, and camera layers using decision-frame-compatible inputs.
3. Layer the bounded candidate satellites, beam variants, guides, and progress
   cues onto the restored carrier.
4. Reflow and enlarge the decision rail without changing scientific authority.
5. Run the complete acceptance gate in section 0.4 before declaring S3–S6
   complete.

No implementation commit may claim visual completion before both recovery
gates pass. If parity cannot be reached within the rendering budget, stop and
report the measured limitation rather than replacing the original behavior.

## 1. Outcome

The homepage will no longer introduce one already-selected “best candidate.”
It will show a truthful decision sequence:

1. measure several satellite-beam alternatives;
2. distinguish observed links from qualified candidates;
3. let every qualified candidate independently satisfy the stability/TTT
   condition;
4. compare stable candidates using forecast energy efficiency (EE), subject to
   service-quality gates;
5. hold the provisional leader long enough to prevent rapid oscillation;
6. commit exactly one target; and
7. preserve the target's satellite and beam identity after the switch.

Inter-satellite handover and same-satellite beam switching use the same visible
and computational procedure. They differ only in whether the selected target
has the same satellite ID as the current serving link.

The upper portion of the right rail must be redesigned because the current
two-card `DuelCard` assumes exactly one serving link and one comparison link.
The entire right rail does **not** need to be discarded: the existing lower
SINR, Power, Throughput, and EE sections remain useful as progressive details
for the current or pinned satellite-beam pair.

## 2. Authority and claim boundary

This SDD follows these authorities:

1. `docs/decisions/ADR-013-walker-only-homepage-source.md`
2. `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
3. `docs/sdd/TLE-CANONICAL-EE-SIMULATOR-SDD.md`
4. `docs/handoff/TEACHING-CURRICULUM-RESET-HANDOFF-2026-08-24.md`

The homepage remains a Walker simulation. Changing the displayed date and
time changes the Walker epoch and the visible simulated scene; it does not
silently select archived TLE data. Dedicated TLE routes retain their own source
and provenance.

The UI may call a target a “beam” only when the runtime provides an actual
beam identity or when a typed adapter explicitly states that a Walker cell is
being used as the simulator's beam unit. The UI must not imply measured antenna
beam truth from a presentation-only cell index.

ADR-014 is the bounded follow-up decision required by ADR-005's unresolved
energy-policy section. It authorizes building and validating a forecast-EE
policy for this Walker homepage, but not turning it on before all calibration
values and canonical parity evidence are frozen. Until that activation gate
passes, the current SINR-offset policy remains active and candidate EE is shown
as unavailable rather than estimated by a substitute formula.

## 3. Current failure mode

The runtime already measures more than one alternative, but it loses that
information before presentation:

- `src/scene/sinrLiveCellModel.ts` measures a set and then reduces the primary
  comparison to the maximum-SINR satellite.
- `src/engine/handover/handover-manager.ts` receives link samples but keeps one
  `pendingTarget` and one timer.
- `src/scene/types.ts` and `src/scene/useSimStatePublisher.ts` publish scalar
  comparison and pending-target fields.
- `src/ui/signal-tuning/WalkerResultsRail.tsx` and `src/ui/InfoPanel.tsx` render
  one `DuelCard` comparison.
- `src/scene/MainScene.tsx` resolves candidate cones from one pending satellite.

Increasing the number of rendered satellites or adding rows to the existing
card would not solve the problem. The decision frame itself must retain the
candidate set and its evaluation state.

## 4. User-facing vocabulary

The interface uses terms that distinguish measurement, eligibility, stability,
and selection.

| Display term | Meaning |
|---|---|
| 當前服務連線 | The one satellite-beam pair currently carrying data |
| 觀測鏈路 | A measured alternative; it has not necessarily passed any gate |
| 合格候選 | A satellite-beam pair that passes all current hard gates |
| 穩定候選 | A qualified pair that has continuously passed the trigger condition for the required TTT |
| 暫列第一 | The currently highest-ranked stable candidate; selection hold is not complete |
| 選定目標 | The one target that has completed selection hold and is ready to switch |
| 切換完成 | The target has become the sole serving link |
| 服務連續性保護 | A separately labelled safety fallback, not an EE-optimal selection |

Avoid ambiguous labels such as “最佳候選” before ranking is complete. Avoid
using “候選數” without stating whether it means observed, qualified, stable,
or displayed candidates.

## 5. Core domain model

### 5.1 Atomic link identity

```ts
interface CandidateLinkKey {
  satelliteId: string;
  beamId: number;
}

type HandoverKind =
  | 'initial-attach'
  | 'intra-satellite'
  | 'inter-satellite';
```

Satellite ID and beam ID are both required. All scene objects, rows, event
receipts, and tests use this pair as their join key.

### 5.2 Candidate facts

```ts
type EvidenceStatus = 'available' | 'unavailable' | 'stale';

interface MetricEvidence {
  status: EvidenceStatus;
  value: number | null;
  unit: string;
  sourceFrameId: string;
  reason: string | null;
}

type GateCode =
  | 'elevation'
  | 'steering'
  | 'scheduled-illumination'
  | 'sinr'
  | 'throughput'
  | 'remaining-service-time'
  | 'ee-advantage';

interface CandidateGateResult {
  code: GateCode;
  category: 'hard-qos' | 'decision-trigger';
  result: 'pass' | 'fail' | 'unavailable';
  measured: number | null;
  threshold: number | null;
  unit: string | null;
  reason: string | null;
}

interface CandidateAssignmentDelta {
  primaryUeId: string;
  from: CandidateLinkKey | null;
  to: CandidateLinkKey;
  affectedUeIds: readonly string[];
  affectedBeamKeys: readonly CandidateLinkKey[];
}

interface ForecastWindowProvenance {
  startSimTimeMs: number;
  endSimTimeMs: number;
  frameIdsOrDigest: string;
  sampleDurationsDigest: string;
  baselineAssignmentKey: string | null;
  canonicalInputHash: string;
  assignmentStateHash: string;
  powerStateHash: string;
  canonicalConfigHash: string;
}

interface ForecastEeEvidence {
  status: 'valid' | 'zero-activity' | 'unavailable' | 'stale' | 'invalid';
  horizonSec: number;
  deliveredBits: number | null;
  consumedJoules: number | null;
  eeBitPerJ: number | null;
  baselineEeBitPerJ: number | null;
  relativeDelta: number | null;
  action: CandidateAssignmentDelta;
  provenance: ForecastWindowProvenance;
  modelVersion: string;
}

interface CandidateOpportunity {
  key: CandidateLinkKey;
  primaryUeId: string;
  sourceFrameId: string;
  beamIdentitySource: 'physical-beam' | 'walker-cell-surrogate';
  geometryClass:
    | 'geometrically-reachable'
    | 'steering-valid'
    | 'scheduled-and-illuminated'
    | 'service-eligible';
  elevation: MetricEvidence;
  steering: MetricEvidence;
  range: MetricEvidence;
  sinr: MetricEvidence;
  predictedThroughput: MetricEvidence;
  remainingServiceTime: MetricEvidence;
  forecastEe: ForecastEeEvidence | null;
  gates: readonly CandidateGateResult[];
}
```

`CandidateOpportunity` contains no inter/intra classification. Event kind is a
decision result derived only after a target has been selected. Every metric
belongs to the same primary UE, source time, and geometry model. A cell-centre
SINR must not be published as that UE's candidate SINR.

`null` means “not computed or unavailable,” never zero. A gate distinguishes
`fail` from `unavailable`; unavailable or stale evidence never participates in
ranking. Rejection reasons are derived from failed gates and remain visible in
the right rail. `hardEligibility` is derived only from `hard-qos` results; the
EE-advantage result is a `decision-trigger` and controls TTT rather than basic
link eligibility. Scientific records contain no colour, opacity, row order, or
animation state.

When `beamIdentitySource` is `walker-cell-surrogate`, the UI uses a clearly
qualified Walker cell/beam-unit label and exposes that provenance. It does not
claim an identified physical antenna beam.

### 5.3 Decision frame

```ts
type HandoverPhase =
  | 'initial-attach'
  | 'monitoring'
  | 'evaluating'
  | 'qualifying'
  | 'selection-hold'
  | 'switching'
  | 'guard';

interface CandidateDecisionState {
  key: CandidateLinkKey;
  hardEligibility: 'eligible' | 'ineligible' | 'unavailable';
  triggerStatus: 'satisfied' | 'not-satisfied' | 'unavailable';
  qualificationSec: number;
  requiredTttSec: number;
  stable: boolean;
  rank: number | null;
  rejectionCodes: readonly GateCode[];
}

interface HandoverDecisionFrame {
  episodeId: string;
  sourceFrameId: string;
  simTimeMs: number;
  phase: HandoverPhase;
  serving: CandidateLinkKey | null;
  opportunities: readonly CandidateOpportunity[];
  states: readonly CandidateDecisionState[];
  provisionalLeader: CandidateLinkKey | null;
  selectedTarget: CandidateLinkKey | null;
  selectedKind: HandoverKind | null;
  selectionHoldSec: number;
  selectionHoldRequiredSec: number;
  mode: 'ee-optimization' | 'service-continuity-protection';
  recentCommit: HandoverCommitReceipt | null;
}
```

The frame is immutable and is the single join point for the decision engine,
right rail, central scene, timeline, and event receipt. Legacy scalar fields
such as `comparisonSatId` and `pendingTargetSatId` may remain temporarily, but
must be derived from this frame and must not independently select a target.
When `serving` is `null`, a committed target is an initial attach, not a
handover. Initial attach uses the candidate/gate evidence but does not claim an
EE improvement over a nonexistent serving baseline.

## 6. Deep module boundaries

### 6.1 `CandidateOpportunityProducer`

```ts
evaluate(frame, primaryUeId): CandidateOpportunitySet
```

Responsibilities:

- enumerate all geometrically reachable satellite-beam pairs, while retaining
  steering, hopping/scheduled, and service eligibility as separate states;
- calculate geometry and measured link values for the same primary UE position
  and one source frame;
- apply provenance-bearing hard-gate measurements;
- request/cache counterfactual EE forecasts at a bounded cadence; and
- return the full scientific set without presentation truncation.

It owns no TTT, selected target, colour, or UI ordering.

### 6.2 `HandoverDecisionEngine`

```ts
interface DecisionClockContext {
  simTimeMs: number;
  dtSec: number;
  sourceFrameId: string;
  epochToken: string;
  discontinuity: 'none' | 'seek' | 'loop-wrap' | 'epoch-change' | 'source-change';
}

step(opportunities, clock: DecisionClockContext): HandoverDecisionFrame
```

Responsibilities:

- retain an independent qualification clock for each pair;
- derive stable candidates;
- rank candidates using a policy adapter;
- maintain provisional-leader hold, commit, dwell, and guard state;
- derive intra/inter kind from the selected pair; and
- emit one authoritative commit receipt.

Absolute simulation time and the epoch token are mandatory. Seek, loop wrap,
date/time change, constellation change, and source change must follow explicit
timer rules: either rebase a continuous timeline with proof or reset candidate
TTT, selection hold, guard, and stale forecast state. Wall-clock animation time
must never advance decision timers.

Policy adapters keep the orchestration stable:

```ts
interface HandoverSelectionPolicy {
  evaluate(
    serving: CandidateOpportunity,
    alternatives: readonly CandidateOpportunity[],
    context: DecisionContext,
  ): PolicyEvaluation;
}
```

- `SinrOffsetPolicy` preserves a regression baseline during migration.
- `ForecastEePolicy` becomes the homepage normal-operation policy after its
  scientific tests and provenance checks pass.

Do not keep the current “inter branch first, then display-only intra branch”
ordering. Same-satellite and cross-satellite pairs enter one candidate set.

### 6.3 `buildCandidatePresentationPlan`

```ts
buildCandidatePresentationPlan(
  decision: HandoverDecisionFrame,
  budget: CandidateDisplayBudget,
): CandidatePresentationPlan
```

Responsibilities:

- group candidates by satellite;
- select the bounded scene subset without changing decision truth;
- allocate event-stable satellite hues and beam shades;
- derive line/fill/motion styles from decision roles;
- provide overflow counts and right-rail ordering; and
- provide stable scene/UI join keys.

This pure adapter is the only place where display caps or colour assignment may
be applied.

## 7. EE selection semantics

### 7.1 Normal-operation objective

For every candidate action `a = (satelliteId, beamId)`, calculate forecast
system energy efficiency over the same horizon `H`:

```text
                 sum_k sum_u R_u^(a)(t_k) * Δt
η_hat_H(a) = -----------------------------------------  [bit/J]
                 sum_k P_sys^(a)(t_k) * Δt
```

This is total predicted delivered bits divided by total predicted consumed
energy. It is a ratio of sums, not an average of instantaneous EE ratios.

The counterfactual must hold the source frame and unaffected assignments fixed,
substitute the candidate assignment, then recompute every affected term,
including load, interference, rate, and the canonical system-power components.
It must not copy the current serving link's EE or divide one candidate's rate
by another frame's power.

The evaluator must build a complete canonical input for every forecast sample,
including the `U x B` off-axis-angle, propagation-gain, and receive-gain
matrices; serving assignment; active-beam vector; per-beam load; beam-to-
satellite ownership; reuse-colour vector; lagged interference; and canonical
power configuration. The retained forecast evidence stores hashes/digests and
the assignment delta, while the replay fixture retains the complete canonical
inputs needed to reproduce the result.

The current cell-centre candidate probe and its `linkBudgetOptions(..., false)`
path are not valid forecast-EE evidence. Candidate geometry and link budget
must be recalculated at the primary UE's actual position, with the same
angle-aware and power-state model used by the canonical baseline. Candidate
power recurrence, load, interference, and affected-UE assignment changes must
be computed explicitly.

The baseline is “keep the current serving link” over the same horizon. The
normal trigger condition is:

```text
all hard QoS gates pass
AND η_hat_H(candidate) >= η_hat_H(baseline) * (1 + ε_EE)
AND the condition remains true for the candidate's TTT
```

`H` and `ε_EE` require named configuration and calibration evidence. This SDD
does not invent their final numeric values. The rail displays the horizon and
calculation source in the expanded detail view. `ForecastEePolicy` remains
disabled until those values, the safety order, and the TypeScript/Python parity
fixtures are accepted and recorded.

### 7.2 Hard gates

EE is the optimization objective, not permission to accept an unusable link.
At minimum, a candidate must pass:

- minimum elevation and steering/coverage geometry;
- scheduled/illuminated availability under the current beam-hopping plan, or an
  explicitly modelled scheduling action with capacity proof;
- minimum SINR;
- minimum predicted throughput or service-rate requirement;
- sufficient remaining service time for `TTT + selection hold + guard + H`;
- valid, same-frame EE evidence.

The physical steering eligibility threshold must not be replaced by a larger
presentation-only cone angle. Any current visual guard angle must be labelled
and kept outside the scientific gate.

The producer reports four distinct stages instead of one overloaded candidate
count: geometrically reachable, steering-valid, scheduled/illuminated, and
service-eligible. In this SDD no new beam-scheduling controller is authorized,
so a beam that is off-slot or removed by the hopping cap cannot become a target
merely because its geometry is visible.

`remainingServiceTime` is a Walker prediction, not a constant. Starting from
the candidate's current same-UE state, propagate the same Walker scenario over
a named future window at `contactPredictionStepSec`. The link remains usable
only while elevation, steering, scheduled illumination, and service-quality
gates continue to pass. The predicted end is the first failure lasting longer
than `contactDropToleranceSec`. The step, tolerance, thresholds, window bound,
epoch token, and model/config hash are part of provenance. Their final values
must be frozen before forecast-EE activation.

### 7.3 Independent TTT and stable selection

Every qualified pair accumulates TTT independently. If candidate A temporarily
becomes the provisional leader while candidate B remains qualified, B's timer
continues. A timer resets only when that pair fails its trigger condition or
leaves the candidate set beyond the configured tolerance.

After one or more candidates become stable, rank them deterministically:

1. higher forecast EE;
2. within the EE tolerance, longer remaining service time;
3. then higher predicted throughput;
4. then a stable satellite-beam key for deterministic replay.

The provisional leader must remain first for `selectionHoldSec` before commit.
This prevents a rapidly changing rank from appearing as an instantaneous
handover. The selection hold is separate from each candidate's TTT and must be
shown separately.

### 7.4 Service-continuity protection

If the serving link is forecast to violate the minimum service condition before
a normal EE decision can complete, the engine may enter
`service-continuity-protection`. It chooses only from hard-eligible candidates
using a documented safety order. The UI must state “服務連續性保護” and must not
show an “EE optimal” claim for that event.

This fallback is necessary because an EE-only trigger must not strand the UE
when the serving link is failing.

The deterministic safety order is: longer predicted uninterrupted service,
then higher predicted throughput, then higher SINR, then stable pair key. A
forecast failure uses a separately configured rescue hold. An actual loss of
the serving assignment may use the existing immediate continuity-rescue path,
but its receipt must state that TTT was bypassed because no active serving link
remained. The rescue threshold/hold values require profile provenance and
tests; they cannot be inferred from animation timing.

## 8. Shared inter/intra procedure

Both event types use the same stages and the same panel:

```text
measure pair -> check gates -> accumulate TTT -> rank stable set
             -> hold leader -> select pair -> atomically switch serving link
```

Examples:

- `no serving link -> SAT-A / Beam 1` is an initial attach.
- `SAT-A / Beam 1 -> SAT-A / Beam 4` is an intra-satellite beam switch.
- `SAT-A / Beam 1 -> SAT-C / Beam 2` is an inter-satellite handover.

The panel may group rows under the same satellite, but it must not remove the
beam identity. A satellite with three useful beams contributes three distinct
candidate rows and three distinct timers.

## 9. Right-rail information architecture

### 9.1 Structural decision

Replace only the upper Walker decision block. Preserve the four lower
calculation sections and make them follow either:

- the current serving pair by default; or
- the candidate row the user has pinned for inspection.

Pinning a row changes inspection only. It never changes ranking, target
selection, TTT, or simulation state.

The lower formula sections may switch to a candidate only when a typed
candidate-specific calculation projection exists for the same source frame and
pair. Otherwise they remain on the serving pair and state that scope, or show
`該候選尚無可驗證計算` in candidate inspection. They must never relabel the
serving SINR, power, throughput, or EE as candidate values.

### 9.2 Desktop layout

The current approximately 460 px right rail can support this hierarchy at
1920 × 1080:

```text
┌──────────────────────────────────────────────┐
│ 換手評估                    模擬時間 / 來源  │
│ 監測 ─ 資格檢核 ─ 穩定計時 ─ 選定 ─ 切換   │
├──────────────────────────────────────────────┤
│ 當前服務連線                                 │
│ ● SAT-A / B1   η̂_H 60.9 bit/J   SINR ...    │
├──────────────────────────────────────────────┤
│ 候選連線  6                                  │
│ SAT-A  同衛星                                │
│   ○ B3  η̂_H ...  +...%  TTT 1.8/3.5 s       │
│   ○ B5  不符合：預估服務時間                 │
│ SAT-B                                          │
│   ○ B2  暫列第一  η̂_H ...  TTT 已完成        │
│   ○ B4  合格候選    η̂_H ...  TTT ...         │
│ SAT-C                                          │
│   ○ B1  觀測鏈路：SINR 未達門檻               │
│                         顯示其餘 +N            │
├──────────────────────────────────────────────┤
│ 選定：SAT-B / B2  跨衛星換手                 │
│ 選定保持 0.8 / 1.5 s                          │
└──────────────────────────────────────────────┘
  [SINR] [Power] [Throughput] [EE]  collapsed
```

Numbers in this wireframe are layout examples, not prescribed runtime values.

Responsive behavior is part of this contract:

- at 1920 × 1080 and 1440 × 900, retain the side rail and an internally
  scrolling candidate list;
- at 1366 × 768, use a compact phase strip and three immediately visible rows,
  with explicit overflow;
- at 390 px width, present the evaluation board as a dismissible bottom sheet
  rather than shrinking the 3D canvas and rail side by side.

The candidate panel may scroll once; it must not create a second nested page
scrollbar. Opening details must not cover the UE, serving beam footprint, or
selected target in the central scene.

### 9.3 Row content and disclosure

Each candidate row shows only the information needed to understand its current
decision status:

- satellite and beam identity;
- status: observed, qualified, stable, provisional leader, selected, rejected;
- `預測 EE` (never unqualified `EE`), its common horizon, and relative change
  from the named keep-serving baseline;
- independent TTT progress; and
- the most important failed gate, if any.

On pin/expand, show:

- SINR, predicted throughput, elevation, steering angle, and remaining service
  time;
- EE numerator (predicted delivered bits), denominator (predicted energy),
  horizon, baseline, and model/source version;
- every gate with measured value and threshold; and
- a plain-language selection or rejection explanation.

Never render unavailable EE as `0 bit/J`. Show `尚未計算` or `資料不足`.
No candidate with unavailable, stale, invalid, or incomplete counterfactual
evidence may enter EE ranking. The panel always displays the `預測` qualifier;
it must not turn counterfactual improvement into an observed savings claim.

### 9.4 Event receipt

After commit, retain a compact wall-clock receipt long enough to read:

```text
跨衛星換手完成
SAT-A / B1 -> SAT-B / B2
選擇依據：預測能源效率提升，且所有服務條件成立
```

For an intra event, use `SAT-A / B1 -> SAT-A / B3` and label it
`同衛星波束切換完成`. For a safety event, replace the EE explanation with the
service-continuity reason.

## 10. Central 3D scene

### 10.1 Colour identifies satellite

Allocate a collision-resistant, colour-blind-conscious hue to each displayed
satellite for the handover episode. The mapping is stable by satellite ID and
does not depend on rank or role. It persists through commit and the receipt.

Beams from one satellite use controlled lightness variants of that hue. A beam
also keeps its shade for the episode. Identity is repeated with satellite/beam
labels and line patterns, so colour is never the sole cue.

The satellite GLB material remains realistic and does not flash or recolour
when its role changes. The satellite's label/ring, beam outlines, footprint,
and right-rail swatch carry the identity hue.

This is a route-scoped replacement of the older homepage role-colour channel
contract. The implementation must add named candidate-mode channels and update
the colour/dash validators; it must not inject satellite tint into shared
role-owned cone surfaces on unrelated routes. Beam variants are generated in a
perceptual colour space such as OKLCH at a constant hue, then verified against
the dark scene. They are not produced by naively darkening sRGB yellow/blue,
which previously shifted the perceived hue to brown/violet.

### 10.2 Role grammar without role colours

| Decision role | Beam/footprint treatment | Link treatment |
|---|---|---|
| Current serving | solid edge, restrained translucent fill | one solid data link |
| Observed | thin dotted footprint; cone hidden until pinned | no solid link |
| Qualified/TTT | wireframe cone and dashed footprint; timer arc | dashed measurement guide only when focused |
| Provisional leader | stronger outline and one directional pulse | dashed, explicitly labelled evaluation path |
| Selected target | double outline/chevron; low-alpha fill | dashed switch-preparation cue |
| Committed serving | same satellite hue and beam shade, now solid | becomes the sole solid data link |

Event kind has a separate non-colour encoding: an intra-satellite switch uses
a local beam-to-beam arc and the label `同衛星波束切換`; an inter-satellite event
uses a satellite-to-satellite transfer cue and the label `跨衛星換手`. Reduced-
motion mode preserves the labels, endpoint shapes, and line patterns without
requiring pulses.

Candidate paths must never look like simultaneous data service. The old solid
link remains active until commit. At the commit boundary it ends and the new
solid link begins. This is not DAPS and must not be animated as two active
connections.

The renderer enforces `activeDataLinkCount === 1`. Before commit, a candidate
uses a hollow measurement endpoint and has no UE-to-target data path, active
throughput flow, active-power animation, or serving label. Other beams on the
serving satellite follow the same context/measurement rule; sharing the
satellite identity does not make them serving beams. A commit receipt records
the exact frame in which the old active link ended and the new one began.

### 10.3 Scene density budget

The scientific engine evaluates every eligible pair. The default 3D display is
bounded independently:

- **new presentation budget:** `maxConeVolumes = 7`; this must be implemented
  and asserted because the current renderer has no equivalent global cap;
- **satellites:** current serving satellite plus at most two alternate
  satellites, for three simultaneously rendered satellite identities;
- **serving-satellite beams:** current serving beam plus at most two intra
  alternatives;
- **each alternate satellite:** at most two candidate beams;
- **mixed-event worst case:** one serving beam plus six candidate beams;
- **intra-focused case:** one serving beam plus at most three same-satellite
  alternatives.

The three-satellite limit matches the current renderer foundation; the global
seven-volume limit is a new presentation-only constraint, not a claim that the
current renderer already enforces seven total cones and not a change to the
canonical scenario's active-beam count. The primary right-rail board uses the same three
satellite groups and may list up to six candidate pairs. It must show `其餘 +N`
when the full scientific set is larger; an expanded inspector exposes the
remaining typed rows without adding all of them to the 3D scene. At 1080 px
height, four rows should remain visible without scrolling; additional rows use
an internal scroll/expand control. On shorter layouts, show three rows plus
honest overflow.

Pinning an overflow row may swap that pair into the bounded 3D subset. The
least-important unpinned candidate is removed from the scene, but no scientific
candidate is removed from the decision frame and existing identity colours are
not reassigned.

The display subset is selected in this order:

1. selected target;
2. provisional leader;
3. other stable candidates;
4. qualified candidates;
5. observed candidates needed to explain a rejection.

It is a presentation priority only. It does not change the decision ranking.

Before final tuning, run a two-hour Starlink Walker instrumentation sweep and
report p50, p95, and maximum counts separately for observed pairs, qualified
pairs, stable pairs, and displayed pairs. Historical single-condition probes
must not be presented as the new candidate-count distribution.

### 10.4 Interaction

- Hovering a rail row highlights the matching satellite-beam outline.
- Clicking pins that pair's details and candidate cone.
- Clicking empty scene space returns the lower metrics to current serving.
- A compact “回到目前連線” action clears the pin.
- Timeline play/pause and scene orbit remain independent of the selection
  policy. Inspection must not alter the decision.

## 11. Pacing and time semantics

Candidate evaluation must remain visible long enough to understand. On entry
to an evaluation episode, the existing presentation controller may reduce the
playback speed without changing simulation timestamps, decision thresholds, or
TTT duration. It must not insert fake scientific time.

At high playback speed, retain phase changes and the commit receipt in wall
clock time so they are readable. A leader change must update the panel and
scene from the same immutable decision frame.

## 12. Presentation identity allocator

The existing `colorForServingSatellite()` and `colorForServingBeam()` provide
a useful same-satellite colour-family donor, but a direct hash can collide when
several satellites are visible. Introduce a presentation allocator that:

- receives the episode's ordered presentation satellite IDs, including rows
  that may be opened or pinned later;
- assigns distinct palette slots for the episode;
- preserves assignments through commit and guard;
- never remaps existing satellites when an overflow row is pinned;
- derives beam shades deterministically within the satellite hue;
- meets dark-background contrast checks; and
- returns CSS and Three.js colour tokens from the same source.

Do not store the allocated hue in `CandidateOpportunity` or use colour to
resolve scientific identity.

The allocator is deterministic and collision-resolving, not a modulo-only
hash. For a new episode, order the serving satellite first and the remaining
presentation IDs lexicographically. Each ID starts at its stable hash's palette
slot and linearly probes to the first unused slot. The palette must cover the
maximum simultaneously listed satellite groups; if overflow exceeds the
palette, the additional identity requires a unique glyph/pattern and ID label
rather than silently reusing an indistinguishable colour. Existing assignments
remain reserved through guard and receipt.

Tests use fixed satellite-set fixtures to prove no collision within the normal
display budget, deterministic replay, no recolour on rank/commit/pin, at least
3:1 non-text contrast against the rail/scene backgrounds, and distinguishable
output under the project's supported colour-vision simulations. Beam shade
fixtures additionally prove that all shades remain recognizable as one hue and
that labels/patterns still distinguish them without colour.

## 13. Migration plan

### S0 — Contract fixtures

- Add typed candidate, decision, receipt, and presentation-plan contracts.
- Add fixtures with at least two satellites and several beams per satellite.
- Define a typed cell-to-beam provenance adapter if required.

### S1 — Opportunity producer and SINR parity

- Preserve all measured alternatives in `sinrLiveCellModel`.
- Add `CandidateOpportunityProducer` with current SINR policy data.
- Prove the compatibility-selected target matches the existing manager on a
  fixed regression fixture before changing visible behavior.

### S2 — Counterfactual EE

- Implement equal-horizon EE evidence using the canonical numerator,
  denominator, units, load, interference, and power path.
- Cache by source-frame bucket and candidate pair; do not run a full
  counterfactual at the render frame rate.
- Add missing-data and provenance gates.

### S3 — Unified decision engine

- Add independent candidate timers and stable-set ranking.
- Remove inter-first/intra-display-only orchestration.
- Add `SinrOffsetPolicy` and `ForecastEePolicy` adapters.
- Emit one commit receipt and compatibility scalar projections.

### S4 — Publisher and right rail

- Publish one immutable `HandoverDecisionFrame`.
- Replace the Walker upper `DuelCard` with
  `HandoverEvaluationPanel`/`CandidateSetPanel`.
- Keep lower formula sections and make pinning inspection-only.

### S5 — Scene presentation

- Generalize the single candidate cone resolver to consume the presentation
  plan.
- Add identity hue allocation and same-satellite beam shades.
- Add role line/fill grammar and one-solid-link enforcement.

### S6 — Browser, performance, and human acceptance

- Validate on the existing port 3000 only.
- Capture 1920 × 1080, 1440 × 900, 1366 × 768, and 390 px-wide evidence for
  inter and intra events.
- Run the two-hour candidate-count instrumentation sweep.
- Obtain human confirmation that the evaluation, leader hold, and atomic switch
  are understandable without reading every detail row.

## 14. File-level implementation map

Likely seams; final names may vary while preserving ownership:

| Concern | Current seam | Intended change |
|---|---|---|
| Candidate measurement | `src/scene/sinrLiveCellModel.ts` | stop scalar compression; emit opportunities |
| Stateful decision | `src/engine/handover/handover-manager.ts` | delegate to unified decision engine/policies |
| Runtime contracts | `src/engine/handover/types.ts`, `src/scene/types.ts` | add immutable candidate decision frame |
| Publishing | `src/scene/useSimStatePublisher.ts` | publish one frame; derive legacy scalars |
| Right rail | `WalkerResultsRail.tsx`, `InfoPanel.tsx`, `DuelCard.tsx` | replace Walker upper block; retain reusable DuelCard elsewhere |
| Scene | `src/scene/MainScene.tsx`, candidate cone helpers | render bounded multi-pair plan |
| Identity colour | `src/constants/servingColour.ts`, cone style modules | add episode allocator; remove homepage role-colour override |
| Visual contract | `docs/visual-clarity-proposal/visual-clarity-sdd/contracts.md`, role-token validators | add a homepage candidate-mode registry and route-scoped supersession |
| Render budget | `src/scene/beamVizModel.ts`, `src/scene/useBeamViz.ts` | enforce three satellite groups and seven total presentation cone volumes |
| Event indexing | Walker/cell handover event indexes | index evaluation start, selection, commit, and receipt from one frame |

Do not migrate the archived-TLE route as a side effect. Do not globally change
`DuelCard` for consumers that still have a truthful two-link comparison.

## 15. Validation and acceptance

### 15.1 Scientific truth

- Every displayed candidate row joins to a same-frame measured opportunity by
  primary UE, satellite, beam, source-frame, epoch, and model identity.
- Candidate geometry, SINR, throughput, remaining-service prediction, and EE
  use the primary UE's actual position, not a cell-centre substitute.
- Geometrically reachable, steering-valid, scheduled/illuminated, and
  service-eligible counts remain distinct.
- Candidate EE uses the canonical ratio-of-sums and exposes its numerator,
  denominator, horizon, units, and provenance.
- Missing EE is unavailable, never zero and never copied from the serving link.
- Canonical Python fixtures prove TypeScript parity, unequal-duration
  ratio-of-sums, zero-activity `0/0 -> 0`, and positive-throughput/zero-power
  fail-closed behavior before EE policy activation.
- Geometry, SINR, throughput, and remaining-service gates are independently
  testable.
- Presentation cone angles cannot qualify a scientific candidate.
- Walker and archived-TLE sources remain separated.

### 15.2 Decision behavior

- A fixture with at least two qualified satellites and two beams per satellite
  exposes all pairs before selection.
- Each qualified pair owns an independent TTT clock.
- A provisional-leader change does not reset another still-qualified timer.
- Initial attach is represented without a fabricated serving link.
- Candidate failure resets only that pair; candidate replacement, seek, loop
  wrap, epoch/date change, constellation change, and source change have explicit
  deterministic timer/forecast behavior.
- Off-slot or hopping-cap-excluded beams cannot become service targets unless
  an explicit scheduling action and capacity proof are introduced.
- Same-satellite and cross-satellite targets pass through the same phases.
- After its activation gate, EE is the normal ranking objective; before that
  gate the compatibility SINR policy remains active and no candidate EE claim
  appears. SINR remains a hard QoS gate in EE mode.
- Safety fallback events are distinctly labelled and reproducible.
- Exactly one target commits and guard/dwell rules prevent immediate reversal.

### 15.3 UI and scene consistency

- Every visible row and scene object uses the same satellite-beam key.
- One satellite retains one hue before and after commit; its beams retain their
  shades.
- Current service, qualification, leader, selected, and committed roles remain
  distinguishable without colour.
- At no frame do two solid links imply simultaneous service.
- Candidate endpoints remain hollow measurement markers, have no active
  UE-to-target data path, and do not animate active throughput or power.
- Other beams of the serving satellite remain context unless their exact pair
  is the sole serving link.
- Intra events show the source and target beam IDs explicitly.
- Overflow is reported as `+N`; hidden candidates are not silently discarded.
- Pinning/hovering affects presentation only.
- The upper panel does not cover the central scene and the lower formula
  sections remain reachable.
- A pinned candidate either receives same-frame candidate-specific lower
  formula projections or an unavailable notice; serving values are never
  relabelled as candidate values.
- 1920 × 1080, 1440 × 900, 1366 × 768, and 390 px-wide layouts have no label
  overlap, central-scene obstruction, or duplicate nested scrollbar.

### 15.4 Performance and cadence

- Full candidate EE is not recomputed at 60 fps.
- Candidate calculations are cached and evaluated at a documented simulation
  cadence; interpolation is presentation-only.
- The default scene stays within three satellites and seven beam volumes.
- An executable renderer assertion enforces both `maxBeamSatellites = 3` and
  the new presentation-only `maxConeVolumes = 7`.
- `prefers-reduced-motion` retains every decision distinction without pulses;
  FPS, HTML overlay count, and draw-call evidence are recorded for both event
  kinds.
- Browser acceptance records frame-rate evidence for both inter and intra
  episodes, not only a static first frame.

### 15.5 Required evidence

- unit tests for opportunity/gate/policy/TTT/tie-break behavior;
- integration tests proving one immutable frame feeds panel and scene;
- browser assertions for IDs, statuses, overflow, pin behavior, and one active
  link;
- pixel review at 1920 × 1080 and the supported shorter viewport;
- an inter-event recording and an intra-event recording; and
- owner visual acceptance. Passing automated tests alone is not visual
  acceptance.

ADR-013 regression is part of the gate: `/` remains Walker-only, requests no
TLE payload, keeps 24-hour time selection, recomputes Walker state for
date/time/constellation changes, and is tested against the existing port 3000
without opening another dev server.

## 16. Stop conditions

Stop implementation and raise the issue rather than filling gaps when:

- the canonical EE numerator or power denominator cannot be identified;
- the candidate forecast cannot recompute affected load/interference;
- a cell ID cannot be honestly mapped to a beam identity;
- the only available multi-candidate sequence is fabricated rather than
  produced by the Walker runtime;
- the candidate display requires more objects than the measured browser budget
  can sustain; or
- an existing shared-file writer cannot provide a safe handoff.

## 17. Definition of done

The redesign is complete only when a viewer can answer, from the synchronized
scene and right rail:

1. Which satellite-beam pairs were measured?
2. Which pairs qualified, and why did the others fail?
3. How long has each qualified pair satisfied the trigger?
4. Which stable pair leads on forecast EE, under what horizon and QoS gates?
5. Was the final choice intra-satellite or inter-satellite?
6. At what point did the sole serving link actually change?

If the interface merely shows several decorative beams around a target already
chosen by the engine, this SDD has not been implemented.
