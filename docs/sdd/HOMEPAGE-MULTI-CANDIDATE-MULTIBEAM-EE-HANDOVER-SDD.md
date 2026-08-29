# Homepage multi-candidate, multi-beam EE handover SDD

## Document state

- **Status:** accepted for staged implementation. The independent S0–S2 gate
  passed (`S0_S2_IMPLEMENTATION_GATE: PASS` on 2026-08-27), and the repaired
  EE-policy design passed its fresh-context synthesis review
  (`FABLE_MAX_IMPLEMENTATION_GATE: PASS` on 2026-08-29). Forecast-EE default
  activation and any unverified S3–S6 completion claim remain blocked.
- **Governance tiers:**
  1. **Owner implementation authorization:** GRANTED (2026-08-28) to construct
     and validate the multi-candidate multi-beam EE handover pipeline and UI
     controls under named experiment config `homepage-ee-handover-v1`.
  2. **Default activation gate:** BLOCKED. Forecast-EE selection cannot become
     the public default on `/` until full counterfactual runtime evidence,
     TypeScript/Python parity, candidate-qualified window proofs, and browser
     phase evidence are complete. Must **not** be marked PASS before all four
     evidence sets are verified.
  3. **Scientific acceptance:** PENDING empirical calibration and canonical paper
     parity verification.
  4. **Owner visual acceptance:** PENDING and required. Automation, screenshots,
     cross-model review, and Opus review are evidence only; none is visual
     acceptance.
- **Owner target retained:** additive Starlink Walker carrier, one solid data
  link, unified intra/inter procedure, and the bounded `3x2` candidate-beam
  presentation plus one serving beam.
- **Date:** 2026-08-27 (amended 2026-08-28; implementation-gate repair 2026-08-29)
- **Route:** `/` only
- **Runtime source:** Starlink Walker by default, in accordance with ADR-013
- **Decision record:** ADR-014
- **Visual acceptance target:** the existing `http://127.0.0.1:3000/` session
- **Review receipts:**
  `docs/reviews/HOMEPAGE-MULTI-CANDIDATE-OPUS-GATE-2026-08-27.md` and
  `docs/reviews/HOMEPAGE-MULTI-CANDIDATE-VISUAL-RECOVERY-OPUS-GATE-2026-08-28.md`,
  plus
  `docs/reviews/HOMEPAGE-MULTI-CANDIDATE-EE-POLICY-FABLE-GATE-2026-08-29.md`

## 0. 2026-08-28/29 amendments

### 0.1 Why the visual-recovery amendment is required

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
- handover focus, pulse/ripple, and source-target transition cue;
- the current stable user-controlled camera framing and orbit controls. A
  candidate/rank/phase change must not trigger automatic pan, zoom, refit, or
  orbit choreography;
- UE, satellite, beam, and event callouts required to understand the event; or
- readable completion receipt/toast.

Candidate presentation is layered onto that carrier:

| Phase | Required central-scene evidence |
|---|---|
| monitoring | Existing serving scene remains visually unchanged; non-eligible candidate clutter is absent, while every hard-eligible pair admitted to the bounded scene subset receives its required wireframe and excess pairs remain typed overflow. |
| evaluating | The serving link stays solid. At least two measured alternatives are visible when the same scientific frame contains them, and at least two hard-eligible pairs become corresponding visible wireframes whenever the frame contains two or more, using hollow endpoints and dotted/dashed guides rather than active-flow animation. |
| qualifying / TTT | Each displayed hard-eligible pair remains a visible wireframe even when the active trigger is not satisfied; each displayed `trigger-satisfied` pair keeps its own visible TTT cue while the existing serving and motion layers continue. The label identifies whether the objective is Forecast EE, SINR compatibility, or startup continuity. |
| selection-hold | The provisional leader is emphasized without hiding other hard-eligible or still-stable candidates or implying that it already serves data. |
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
the same-frame scene/rail join. No serving/event-layer retirement is authorized
by this SDD; that condition is a future replacement gate, not a current task.
If the candidate plan exists but produces zero
renderable pairs or zero event cues, the established serving/event carrier
remains visible. A hard-eligible pair is not allowed to be reduced to a
rail-only row: its accepted snapshot must contain a corresponding wireframe
scene object unless it is explicitly a typed overflow row outside the bounded
display subset.

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

The publisher combines the decision frame and presentation plan into one
accepted snapshot; the rail and scene consume that snapshot only.
Passing identity equality or no-overlap assertions alone does not establish
readability.

### 0.4 Recorded visual-recovery gate and remaining acceptance gate

The fresh-context Opus review recorded in
`docs/reviews/HOMEPAGE-MULTI-CANDIDATE-VISUAL-RECOVERY-OPUS-GATE-2026-08-28.md`
returned `VISUAL_RECOVERY_IMPLEMENTATION_GATE: PASS`. That PASS covers the
carrier-preserving visual-recovery architecture only; it did not itself
supersede the then-failed EE-policy implementation gate and does not authorize
Forecast-EE default activation. The later 2026-08-29 Fable receipt separately
accepts the repaired EE-policy design for implementation. The visual review
explicitly answered:

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
  keys, separate observed/hard-eligible/active-trigger/TTT-stable/displayed
  counts plus the active trigger objective, one solid data link, and
  synchronized rail/scene phase at the
  sampled frames;
- scene and rail consuming the same `AcceptedHandoverPresentationSnapshot`
  with identical identity, phase, role, metrics, `sourceFrameId`, and config
  hash, and measured `acceptedSnapshotSkewMs = 0`;
- a fixture with at least two hard-eligible candidates proving at least two
  corresponding rail rows and scene wireframes at one accepted snapshot;
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
   motion, and event layers using decision-frame-compatible inputs; retain the
   stable manual camera and keep candidate-triggered auto-fit disabled.
3. Layer the bounded candidate satellites, beam variants, guides, and progress
   cues onto the restored carrier.
4. Reflow and enlarge the decision rail without changing scientific authority.
5. Run the complete acceptance gate in section 0.4 before declaring S3–S6
   complete.

No implementation commit may claim visual completion before both recovery
gates pass. If parity cannot be reached within the rendering budget, stop and
report the measured limitation rather than replacing the original behavior.

### 0.6 2026-08-29 EE-policy implementation-gate repair (`homepage-ee-handover-v1`)

The owner-authorized target is unchanged, but the previous amendment's numeric
proposal language is withdrawn. The following rules are binding until a later
scientific and owner acceptance record supersedes them:

1. **Normal handover trigger and ranking:** normal operation uses forecast
   system-EE as the ranking and TTT trigger objective only after the activation
   gate passes:
   $$\hat{\eta}_H(\text{candidate}) \ge \hat{\eta}_H(\text{baseline})
   \times (1 + \epsilon_{\text{EE}})$$
   SINR remains a hard QoS floor and is not a normal-operation ranking metric.
2. **Unified single procedure:** intra-satellite beam switching and
   inter-satellite handover use the same
   `hard-eligible -> trigger-satisfied -> TTT-stable -> provisional leader
   -> selected/commit` lifecycle.
3. **Shared central scene and right-rail publication:** the central 3D scene
   (`MainScene`) and the right sidebar (`WalkerResultsRail` /
   `HandoverEvaluationPanel`) consume one accepted
   `AcceptedHandoverPresentationSnapshot`. They do not independently consume
   legacy scalar state or recompute candidate metrics.
4. **Presentation budget and grouping:** display at most **3 satellite groups**,
   at most **2 candidate beams per group**, and one serving beam: `3x2 + 1 = 7`
   maximum presentation cone volumes. All scientific candidates, timers, and
   ranks remain complete; additional candidates are typed `+N` overflow rows
   and can be pinned without changing the decision set.
5. **Interactive cross-highlighting and visual invariants:**
   - **Cross-highlight:** Hovering or pinning a candidate row in the right rail
     highlights the matching beam cone and footprint in the 3D scene, and vice versa.
   - **Satellite identity colour permanence:** Each satellite retains its
     assigned identity hue throughout the entire episode, leader change, selection
     hold, commit boundary, and receipt (顏色衛星恆定).
   - **Same-satellite beam tonal gradation:** Multiple beams on the same
     satellite use lightness/tonal variations of that satellite's hue (同星波束階調).
   - **Unique solid data link:** When `serving` exists,
     `activeDataLinkCount === 1`; a truthful detached/initial-attach snapshot has
     `activeDataLinkCount === 0`. Candidates are rendered with hollow endpoints
     and dashed measurement guides; at commit time, the old solid link ends and
     the new solid link begins atomically. The count is never greater than one,
     so no DAPS / dual active links may ever be depicted.
   - **No copying of serving instantaneous EE:** It is strictly forbidden to copy
     the serving link's instantaneous EE onto candidate pairs. Each candidate
     must compute counterfactual predicted bits and energy over horizon $H$.
6. **Named profile values and status:**
   - **Chosen horizon:** `H = 7 x 2.5 s = 17.5 s` is only a chosen horizon
     pending measurement. It is not a complete hopping frame or hopping period.
   - **Hopping semantics:** the default `7-cell` layout/index assignment does
     not rotate. Its `K < N` illuminated window may still advance per
     `hopSlotSec`; this temporal hopping is not layout rotation. A `19-cell`
     schedule has period 19, not 7. Neither fact makes the chosen horizon a full
     hopping frame.
   - **Horizon sample step:** `dt = 2.5 s` is a chosen sample step pending
     measurement; it is separate from forecast refresh cadence and execution
     budget.
   - **Throughput gate:** `Rmin` is a profile-configured threshold on the
     primary UE's per-UE predicted rate under the candidate counterfactual
     load. The owner profile may provisionally carry `1 Mbit/s`, but that is
     not a canonical paper value.
   - **Effective SINR gate:** use
     `max(profile SINR floor, derived gamma_req)` in one declared SINR domain.
     Any related input change forces affected rates, floors, gates, and EE
     evidence to be recomputed.
   - **EE threshold:** `epsilon_EE` is TBD until matched causal-control true
     canonical system-EE `relativeDelta` distributions over `7200 s` are
     complete for both intra-satellite and inter-satellite cases.
   - **Tie tolerance:** `tieToleranceRelative` is adjustable Walker policy configuration
     and is also TBD pending that calibration; there is no numeric default.
   - **Switch energy:** `E_switch` resolves to canonical `switchEnergyJ` and is
     included exactly once on the target beam in the first candidate forecast
     sample; the matched baseline has no switch indicator. `0 J` is only an
     explicitly labelled biased zero-switch-energy diagnostic and cannot
     support activation or savings claims.
   The calibration run first records the unthresholded valid `relativeDelta`
   distribution, numerical repeatability, intra/inter event opportunities,
   service-gate outcomes, and reversal rate. It does not tune for a desired
   number of animations. A later dated acceptance receipt must state the chosen
   threshold/tolerance, rationale, profile hash, and observed trade-off before
   either value becomes a default.
7. **Policy/config boundary:** the complete Walker decision surface includes
   `H`, `forecastSampleStepSec`, `forecastRefreshCadenceSec`, the
   `ForecastExecutionBudget` hash, `epsilon_EE`, `tieToleranceRelative`, minimum
   elevation, maximum steering, the schedule/hopping-plan hash, `Rmin`,
   `SINRmin`, `initialTttSec`, `requiredTttSec`, `selectionHoldSec`,
   `candidateAbsenceToleranceSec`, the derived `remainingServiceThresholdSec`,
   `contactPredictionStepSec`, `contactDropToleranceSec`,
   `contactPredictionWindowSec`, `guardSec`, `E_switch` (via
   canonical `switchEnergyJ`), `switchEventAccountingMode`, the
   `canonicalContractVersion` / `canonicalConfigHash`, the immutable Walker
   scenario-config hash, and the profile ID/version. These are Walker
   handover-policy controls, not canonical formula controls. Hash their stable serialized form as
   `policyConfigHash`; include it in cache keys, forecast provenance, and the
   accepted presentation snapshot. A hash change atomically clears candidate
   and forecast caches, invalidates the accepted snapshot, resets TTT,
   selection hold, guard, and episode state, and forbids reuse of old evidence.
   The currently committed serving assignment remains the new episode's
   starting truth when it is still present in the new source frame; the reset
   preserves its existing `servingOrigin` and does not relabel it as a fresh
   bootstrap, detach, attach, or handover. Only a source/geometry transaction
   that invalidates that serving pair may enter the separately labelled
   continuity/initial-attach path.
8. **Activation freeze:** until `EE_POLICY_ACTIVATION_GATE` passes,
   `SinrOffsetPolicy` remains active and `ForecastEePolicy` cannot rank, trigger
   TTT, select, or commit. Valid pre-activation candidate EE must be visibly
   labelled `validation experiment` and excluded from ranking. Incomplete
   evidence is `尚未計算`/`資料不足`, never zero. The existing compatibility
   numerics remain frozen: `selectionHoldSec = 1 s`, candidate absence
   tolerance `= 0`, TTT from `profile.handover.triggerTimeSec`, and guard from
   `profile.handover.pingPongGuardSec`; these are Walker handover/fallback
   values, not canonical formula constants.
9. **Acceptance boundary:** owner implementation authorization remains granted;
   default activation and scientific acceptance remain blocked/pending; owner
   visual acceptance is required. Automation and cross-model/Opus review are
   evidence only and cannot substitute for that human gate.

## 1. Outcome

The homepage will no longer introduce one already-selected “best candidate.”
It will show a truthful decision sequence:

1. measure several satellite-beam alternatives (`CandidateOpportunitySet`);
2. apply non-EE hard QoS/service gates, producing `hard-eligible` pairs
   (minimum elevation/steering, scheduled/illuminated slot, effective SINR
   floor, primary-UE candidate-load throughput, and remaining-service time);
3. evaluate the accepted active trigger and mark a hard-eligible pair
   `trigger-satisfied`. After Forecast-EE activation this requires a matched
   canonical forecast above the profile threshold; before activation it remains
   the explicitly labelled SINR or startup compatibility trigger, while any EE
   value is validation-only;
4. let each `trigger-satisfied` candidate independently accumulate TTT and
   become `TTT-stable`; a hard-eligible pair that does not satisfy the active
   trigger remains visible as a wireframe;
5. rank the complete stable set, mark the first pair `provisional leader`,
   and hold it long enough (`selectionHoldSec`) to prevent rapid oscillation;
6. commit exactly one target atomically; and
7. preserve the target's satellite and beam identity after the switch.

The complete candidate progression follows the unified pipeline:
$$\text{hard-eligible} \longrightarrow \text{trigger-satisfied}
\longrightarrow \text{TTT-stable} \longrightarrow \text{provisional leader}
\longrightarrow \text{selected/commit}$$

Inter-satellite handover and same-satellite beam switching use this exact same
visible and computational procedure. They differ only in whether the selected
target has the same satellite ID as the current serving link.

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
passes, the current `SinrOffsetPolicy` remains active. If valid candidate EE is
shown during this period it is explicitly a `validation experiment`, cannot
rank or trigger TTT, and incomplete evidence is shown as unavailable rather
than estimated by a substitute formula or rendered as zero.

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

There is also a startup authority seam that must not be mislabeled. The current
`SinrLiveCellModel` first lets the legacy per-cell `HandoverManager` attach a
best satellite immediately, then seeds `primaryServingAssignment` and creates
the multi-candidate decision engine with `initialServing !== null`. Thus a
normal homepage startup commonly does **not** exercise the decision engine's
`serving === null` initial-TTT path. This work preserves that startup behavior
only as an explicitly typed pre-existing/bootstrap serving origin. It must not
fabricate an `initial-attach` comparison or receipt, and after bootstrap the
legacy manager must not select later primary-UE handover targets.

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
| 服務條件成立 (`hard-eligible`) | A measured pair that passes all non-EE hard QoS/service gates. In the bounded scene subset it remains a visible wireframe even when EE evidence or the EE threshold is not satisfied; excess pairs remain inspectable overflow rows. |
| 能源效率條件成立 | The `trigger-satisfied` role only when the active objective is Forecast EE: a hard-eligible pair with valid same-horizon canonical system-EE evidence whose relative advantage passes the active profile threshold; this is not yet stable. |
| SINR 比較條件成立 / 首次連線條件成立 | The same policy-neutral `trigger-satisfied` role under the explicitly labelled compatibility/startup objective; it must not be presented as EE evidence. |
| 穩定時間成立 (`TTT-stable`) | A hard-eligible pair whose explicitly named active trigger has continuously remained satisfied for its independent required TTT. |
| provisional leader / 暫列第一 | The highest-ranked TTT-stable pair; selection hold is not complete and it does not yet carry data. |
| selected / 選定目標 | The one provisional leader that completed selection hold and is ready for the atomic commit boundary. |
| 切換完成 | The target has become the sole serving link |
| 服務連續性保護 | A separately labelled safety fallback, not an EE-optimal selection |

Avoid ambiguous labels such as “最佳候選” before ranking is complete. Avoid
using “候選數” without stating whether it means observed, hard-eligible,
active-trigger-satisfied, TTT-stable, or displayed candidates. The active
trigger label must follow `activeTriggerObjective`; `selected` and `committed`
are boundary events, not extra scientific candidates.

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

type ServingOrigin =
  | 'bootstrap-serving-seed'
  | 'initial-attach-commit'
  | 'handover-commit'
  | 'service-continuity-commit';
```

Satellite ID and beam ID are both required. All scene objects, rows, event
receipts, and tests use this pair as their join key.

### 5.2 Candidate facts

```ts
type EvidenceStatus = 'available' | 'unavailable' | 'stale' | 'invalid' | 'zero-activity';

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

type ActiveTriggerObjective =
  | 'initial-attach-compatibility'
  | 'sinr-offset'
  | 'forecast-ee'
  | 'service-continuity-compatibility';

interface CandidateGateResult {
  code: GateCode;
  category: 'hard-qos' | 'decision-trigger';
  result: 'pass' | 'fail' | 'unavailable';
  measured: number | null;
  threshold: number | null;
  unit: string | null;
  reason: string | null;
}

interface ActiveTriggerEvidence {
  objective: ActiveTriggerObjective;
  metric:
    | 'candidate-sinr-floor-db'
    | 'sinr-offset-delta-db'
    | 'forecast-ee-relative-delta';
  status: 'satisfied' | 'not-satisfied' | 'unavailable';
  measured: number | null;
  threshold: number | null;
  comparator: '>=';
  unit: 'dB' | 'ratio';
  supportingGateCodes: readonly GateCode[];
  sourceFrameId: string;
  policyConfigHash: string;
  reason: string | null;
}

interface EffectiveSinrFloor {
  profileFloor: number;
  derivedGammaReq: number;
  effectiveFloor: number;
  unit: string;
  source: string;
}

interface CandidateAssignmentDelta {
  primaryUeId: string;
  from: CandidateLinkKey | null;
  to: CandidateLinkKey;
  affectedUeIds: readonly string[];
  affectedBeamKeys: readonly CandidateLinkKey[];
}

interface ForecastWindowProvenance {
  epochUtcMs: number;
  startSimTimeMs: number;
  endSimTimeMs: number;
  frameIdsOrDigest: string;
  sampleDurationsDigest: string;
  baselineAssignmentKey: string | null;
  canonicalInputHash: string;
  assignmentStateHash: string;
  powerStateHash: string;
  scenarioStateHash: string;
  geometryModelHash: string;
  canonicalConfigHash: string;
  policyConfigHash: string;
  switchEventAccountingMode: 'target-once-at-horizon-start';
  switchBoundarySimTimeMs: number;
  switchTargetBeamIndex: number;
  switchIndicatorDigest: string;
}

interface ForecastEeEvidence {
  status: 'valid' | 'zero-activity' | 'unavailable' | 'stale' | 'invalid';
  horizonSec: number | null;
  deliveredBits: number | null;
  consumedJoules: number | null;
  eeBitPerJ: number | null;
  baselineDeliveredBits: number | null;
  baselineConsumedJoules: number | null;
  baselineEeBitPerJ: number | null;
  relativeDelta: number | null;
  action: CandidateAssignmentDelta | null;
  provenance: ForecastWindowProvenance | null;
  modelVersion: string | null;
  reason: string | null;
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
  effectiveSinrFloor: EffectiveSinrFloor;
  forecastEe: ForecastEeEvidence | null;
  gates: readonly CandidateGateResult[];
}
```

For every `valid` forecast, `relativeDelta` has one exact dimensionless
definition matching `canonicalForecastEeEvaluator.ts`:

$$
\mathrm{relativeDelta}
= \frac{\hat{\eta}_H(\mathrm{candidate})}
       {\hat{\eta}_H(\mathrm{baseline})} - 1.
$$

The baseline EE and candidate EE must both be finite, and the baseline must be
strictly positive. A zero/non-finite baseline cannot produce an infinite,
clamped, or absolute-difference shortcut; the comparison evidence is unavailable
or invalid and may not trigger, rank, advance TTT, select, or commit.

`sourceFrameId` is mandatory for **every** evidence status, including
`unavailable`, `stale`, `invalid`, and `zero-activity`. Those statuses set
`value = null` where appropriate and retain a typed `reason`, but they still
identify the candidate-opportunity frame in which the measurement was
requested. If no authoritative source frame exists, the producer must not
invent a candidate row. The current nullable implementation is a migration
gap: before an opportunity enters an accepted snapshot, its evidence must be
normalized to the opportunity's non-empty `sourceFrameId` and validated against
that same frame. A forecast may additionally retain its complete future-frame
sequence in `ForecastWindowProvenance`; that sequence does not replace the
candidate row's anchor-frame join key.

`CandidateOpportunity` contains no inter/intra classification. Event kind is a
decision result derived only after a target has been selected. Every metric
belongs to the same primary UE, source time, and geometry model. A cell-centre
SINR must not be published as that UE's candidate SINR.

`null` means “not computed or unavailable,” never zero. A gate distinguishes
`fail` from `unavailable`; unavailable or stale evidence never participates in
ranking. Rejection reasons are derived from failed gates and remain visible in
the right rail. `hardEligibility` is derived only from the non-EE `hard-qos`
results; a hard-eligible pair does not lose eligibility merely because its EE
forecast is below threshold or not yet available. The `ee-advantage` result is
a `decision-trigger` only when `activeTriggerObjective === 'forecast-ee'`: it
then determines the policy-neutral `trigger-satisfied` state and TTT, not basic
link eligibility. Before activation it remains validation evidence and cannot
overwrite the active compatibility trigger. Every hard-eligible pair therefore remains in the accepted
presentation snapshot: pairs in its bounded scene subset receive visible
wireframes, while excess pairs remain typed, inspectable overflow rows.
Scientific records contain no colour, opacity, row order, or animation state.

The only permitted zero-valued EE edge is an explicitly validated
`zero-activity` record with complete provenance (`0/0 -> 0`); it is not an
incomplete forecast and is never a Forecast-EE trigger or ranking result.

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

type CandidateDecisionRole =
  | 'observed'
  | 'hard-eligible'
  | 'trigger-satisfied'
  | 'ttt-stable'
  | 'provisional-leader'
  | 'selected'
  | 'committed'
  | 'rejected';

interface CandidateDecisionState {
  key: CandidateLinkKey;
  hardEligibility: 'eligible' | 'ineligible' | 'unavailable';
  triggerStatus: 'satisfied' | 'not-satisfied' | 'unavailable';
  activeTriggerEvidence: ActiveTriggerEvidence;
  tttAccumulatedSec: number;
  requiredTttSec: number;
  tttStable: boolean;
  role: CandidateDecisionRole;
  objectiveRank: number | null;
  stableRank: number | null;
  rejectionCodes: readonly GateCode[];
}

interface HandoverDecisionFrame {
  episodeId: string;
  primaryUeId: string;
  sourceFrameId: string;
  epochToken: string;
  simTimeMs: number;
  phase: HandoverPhase;
  serving: CandidateLinkKey | null;
  servingOrigin: ServingOrigin | null;
  opportunities: readonly CandidateOpportunity[];
  states: readonly CandidateDecisionState[];
  provisionalLeader: CandidateLinkKey | null;
  selectedTarget: CandidateLinkKey | null;
  selectedKind: HandoverKind | null;
  selectionHoldSec: number;
  selectionHoldRequiredSec: number;
  policyMode:
    | 'sinr-compatibility'
    | 'forecast-ee-validation'
    | 'forecast-ee-active'
    | 'service-continuity-protection';
  activeTriggerObjective: ActiveTriggerObjective;
  activeHardGateProfile:
    | 'initial-attach-compatibility'
    | 'sinr-compatibility'
    | 'forecast-ee-service'
    | 'service-continuity-compatibility';
  eeActivationStatus: 'blocked' | 'validation-only' | 'active';
  policyConfigHash: string;
  recentCommit: HandoverCommitReceipt | null;
}
```

The frame is immutable and is the scientific decision authority consumed by
the central publisher. It is not a direct scene/rail join: the publisher joins
it with exactly one bounded presentation plan into the accepted snapshot, and
that same accepted object is the only presentation join for the right rail,
central scene, timeline, and event receipt. Legacy scalar fields such as
`comparisonSatId` and `pendingTargetSatId` may remain temporarily, but must be
derived from this authority and must not independently select a target.
`recentCommit` is present only after the primary assignment/load/RF transaction
has succeeded and the target has been remeasured in the resulting state. An
engine-internal hold-complete commit intent is not a public receipt and cannot
change `serving`, start guard, or drive an animation by itself.
When `serving` is `null`, a committed target is an initial attach, not a
handover. Because no keep-serving baseline exists, relative EE advantage and
the normal EE trigger are unavailable. Initial attach uses the separately
labelled compatibility-safe path: elevation/steering/scheduled/SINR gates,
highest SINR, then stable `CandidateLinkKey`. Before the external atomic
transaction it retains the compatibility policy's configured
`initialTttSec` and `selectionHoldSec`; these are startup-stability intervals,
not EE-trigger TTT. It does not claim EE optimality or improvement, and
establishes the serving truth from which later normal EE handover comparisons
can begin. It must not reuse the immediate TTT/hold bypass that belongs only to
service-continuity protection after an already committed serving pair is lost.

The homepage's retained startup seed is not this unattached decision path. It
enters as `servingOrigin = 'bootstrap-serving-seed'`, carries no fabricated
handover receipt, and is described only as the pre-existing service baseline.
If a true engine-owned `serving === null` state is exercised, non-zero
compatibility `initialTttSec` and `selectionHoldSec` must be observed before an
`initial-attach-commit` receipt. Once the engine is seeded, later target
selection belongs only to the shared decision engine or the narrowly defined
service-continuity fallback.

The five normal Forecast-EE decision meanings are intentionally separate:
`hard-eligible` means all non-EE service gates pass; the policy-neutral
`trigger-satisfied` role means valid matched canonical forecast evidence also
passes the active EE threshold when `activeTriggerObjective` is `forecast-ee`;
`TTT-stable`
means that trigger has remained satisfied for the independent TTT;
`provisional-leader` is the globally first-ranked stable pair during selection
hold; and `selected`/`committed` identify the selection-ready pair and the
atomic commit boundary. A hard-eligible pair with no EE threshold pass remains
in `opportunities` and gets a wireframe scene object. It is not silently
promoted to stable or removed as overflow.

`role` is the highest-precedence presentation role, while the other state
fields retain all underlying facts. Precedence is `committed > selected >
provisional-leader > ttt-stable > trigger-satisfied > hard-eligible >
observed/rejected`. This
prevents a provisional leader from losing the facts that it is also hard-
eligible, trigger-satisfied, and stable, and prevents the UI from collapsing
all of those meanings back into one `qualified` label.

`trigger-satisfied` is deliberately policy-neutral in data. It is rendered as
`能源效率條件成立` only when `activeTriggerObjective === 'forecast-ee'`, as
`SINR 比較條件成立` in SINR compatibility mode, as `首次連線條件成立` during
initial attach, and as `服務連續性條件成立` in the safety fallback. A
`forecast-ee-validation` publication continues to use the active compatibility
trigger for decision state; its separately visible EE forecast cannot set
`triggerStatus`, advance TTT, rank, select, or commit.

`activeTriggerEvidence` makes that neutral status inspectable. Its `objective`
must equal the frame's `activeTriggerObjective`, its source/config identities
must equal the candidate and frame, and `status` must equal `triggerStatus`.
Forecast EE records `relativeDelta >= epsilon_EE`; SINR compatibility records
the candidate-minus-serving SINR offset against the profile offset; initial
attach and continuity record candidate SINR against the active compatibility
floor while their required geometry/scheduling gates remain named in
`supportingGateCodes`. Missing measured/threshold provenance yields
`unavailable`, never an unexplained boolean. Validation-only EE may appear in
the forecast field but never in this active-trigger record while SINR or startup
compatibility is authoritative.

`hardEligibility` is likewise evaluated against the explicitly named
`activeHardGateProfile`. Active Forecast-EE service uses the complete section
7.2 gate set. The pre-activation SINR and startup compatibility profiles retain
their existing elevation/steering/scheduled/SINR set; they must not claim that
unexecuted `Rmin` or remaining-service gates passed. Validation-only full-gate
results may be inspected separately but cannot overwrite the active
compatibility eligibility state.

The snapshot validator enforces this mapping; no consumer chooses it:

| Accepted runtime state | `activeTriggerObjective` | `activeHardGateProfile` | Decision rank/TTT authority |
|---|---|---|---|
| `sinr-compatibility`, serving exists | `sinr-offset` | `sinr-compatibility` | compatibility SINR policy |
| `sinr-compatibility`, serving is null | `initial-attach-compatibility` | `initial-attach-compatibility` | highest compatible SINR, initial TTT/hold |
| `forecast-ee-validation`, serving exists | `sinr-offset` | `sinr-compatibility` | compatibility SINR policy; validation EE excluded |
| `forecast-ee-validation`, serving is null | `initial-attach-compatibility` | `initial-attach-compatibility` | startup compatibility; validation EE excluded |
| `forecast-ee-active`, serving exists | `forecast-ee` | `forecast-ee-service` | matched Forecast-EE policy |
| `forecast-ee-active`, serving is null | `initial-attach-compatibility` | `initial-attach-compatibility` | startup compatibility; no EE-baseline claim |
| `service-continuity-protection` | `service-continuity-compatibility` | `service-continuity-compatibility` | same-frame safety selector only |

`eeActivationStatus` records the global gate (`blocked`, `validation-only`, or
`active`) and does not override this table. In particular, an active system may
temporarily enter service-continuity protection without calling that safety
choice EE-optimal. Outside that safety override, the mapping is exact:
`sinr-compatibility -> blocked`, `forecast-ee-validation -> validation-only`,
and `forecast-ee-active -> active`. Service-continuity protection preserves the
pre-fallback activation status so the system can resume the same authorized
mode after a successful safety transaction; it still publishes the compatibility
objective and hard-gate profile during the fallback itself. Any mismatch among policy mode, active objective, hard-gate
profile, serving presence, role, rank source, or TTT source invalidates the
decision frame before publication.

### 5.4 Accepted presentation snapshot

```ts
interface AcceptedHandoverPresentationCandidate {
  key: CandidateLinkKey;
  identity: {
    satelliteId: string;
    beamId: number;
    cellId: number | null;
    beamIdentitySource: 'physical-beam' | 'walker-cell-surrogate';
    displayKey: string;
    satelliteIdentityToken: string;
    beamToneToken: string;
    satellitePatternToken: string;
    colorMayRepeat: boolean;
    satelliteCssColor: string;
    satelliteThreeColor: string;
    beamCssColor: string;
    beamThreeColor: string;
    satelliteGlyph: string;
    beamGlyph: string;
    satellitePattern: HandoverVisualIdentityPattern;
    beamPattern: HandoverVisualIdentityPattern;
  };
  phase: HandoverPhase;
  role: CandidateDecisionRole;
  status: {
    hardEligibility: 'eligible' | 'ineligible' | 'unavailable';
    triggerStatus: 'satisfied' | 'not-satisfied' | 'unavailable';
    tttStable: boolean;
    isProvisionalLeader: boolean;
    isSelected: boolean;
    isCommitted: boolean;
  };
  metrics: {
    activeTriggerEvidence: ActiveTriggerEvidence;
    objectiveRank: number | null;
    stableRank: number | null;
    objectiveRankUnavailableReason: string | null;
    stableRankUnavailableReason: string | null;
    forecastEe: ForecastEeEvidence | null;
    relativeBaselineDelta: number | null;
    elevation: MetricEvidence;
    steering: MetricEvidence;
    range: MetricEvidence;
    sinr: MetricEvidence;
    predictedThroughput: MetricEvidence;
    remainingServiceTime: MetricEvidence;
    tttSec: number;
    requiredTttSec: number;
    gates: readonly CandidateGateResult[];
    failedGates: readonly CandidateGateResult[];
  };
  sourceFrameId: string;
  policyConfigHash: string;
  presentation: {
    joinKey: string;
    sceneJoinKey: string;
    railJoinKey: string;
    sceneSlot: number | null;
    sceneExclusionReason: null | 'typed-overflow' | 'presentation-capacity';
    coneStyle:
      | 'serving-carrier'
      | 'wireframe'
      | 'selected-outline'
      | 'hidden';
    footprintStyle:
      | 'serving-hex'
      | 'dotted-hex'
      | 'dashed-hex'
      | 'double-hex';
    dataLinkStyle: 'solid-data' | 'measurement-dashed' | 'none';
    isMeasurementOnly: boolean;
    isActiveDataLink: boolean;
  };
}

interface AcceptedHandoverPresentationSnapshot {
  snapshotId: string;
  episodeId: string;
  primaryUeId: string;
  sourceFrameId: string;
  epochToken: string;
  simTimeMs: number;
  phase: HandoverPhase;
  policyMode:
    | 'sinr-compatibility'
    | 'forecast-ee-validation'
    | 'forecast-ee-active'
    | 'service-continuity-protection';
  activeTriggerObjective: ActiveTriggerObjective;
  activeHardGateProfile:
    | 'initial-attach-compatibility'
    | 'sinr-compatibility'
    | 'forecast-ee-service'
    | 'service-continuity-compatibility';
  eeActivationStatus: 'blocked' | 'validation-only' | 'active';
  policyConfigHash: string;
  serving: AcceptedHandoverPresentationCandidate | null;
  servingOrigin: ServingOrigin | null;
  candidates: readonly AcceptedHandoverPresentationCandidate[];
  overflow: readonly AcceptedHandoverPresentationCandidate[];
  counts: {
    observed: number;
    hardEligible: number;
    triggerSatisfied: number;
    tttStable: number;
    displayed: number;
    overflow: number;
  };
  selection: {
    provisionalLeader: CandidateLinkKey | null;
    selectedTarget: CandidateLinkKey | null;
    selectedKind: HandoverKind | null;
    holdSec: number;
    holdRequiredSec: number;
  };
  activeDataLinkCount: 0 | 1;
  commit: HandoverCommitReceipt | null;
}

interface CandidateSceneRenderReceipt {
  snapshotId: string;
  sourceFrameId: string;
  renderedSceneJoinKeys: readonly string[];
  unmappedPairs: readonly {
    key: CandidateLinkKey;
    reason: 'missing-cell-placement' | 'missing-satellite-world' | 'invalid-beam-geometry';
  }[];
  solidDataLinkCount: 0 | 1;
  eventCueCount: number;
}
```

`decision.recentCommit` is an instantaneous engine-frame fact, whereas the
snapshot's `commit` is the latest authoritative receipt that still owns the
current serving pair. The publisher may retain that receipt only across the
same episode and epoch, only while simulation time moves forward, and only
while `commit.to` remains the current `serving` pair. A rewind, epoch change,
serving change, or missing match clears it. This shared retention lets the
scene and rail finish one readable transition from the same receipt;
consumer-local commit inference from wall-clock animation phase is forbidden.

`displayKey` is produced once by a shared pure formatter from the accepted
identity, for example `G42-22-02 / B2 / C2`; the scene and rail must not each
derive cell numbers or add one-based offsets independently. When no cell
identity exists, the formatter omits `/ C…` and preserves the explicit
`physical-beam` provenance. A Walker `cellId` used as the beam surrogate is
labelled as such in inspection details rather than being described as a
measured antenna beam.

`sceneSlot` and `sceneExclusionReason` are mutually exclusive. A bounded
candidate has a non-null slot and null reason; an overflow/capacity-blocked
candidate has a null slot and typed reason. Missing WebGL geometry is not
misreported as presentation overflow: it is recorded later by the matching
`CandidateSceneRenderReceipt`.

`snapshotId` is deterministic and unique for the accepted publication,
covering `episodeId`, `sourceFrameId`, `policyConfigHash`, decision revision,
and bounded-presentation revision. A pin swap on the same scientific frame
therefore receives a new snapshot ID without changing the decision revision;
random IDs or consumer-local counters are not permitted join keys.

The publisher accepts exactly one immutable snapshot after the decision frame
and presentation plan have been validated. `MainScene` and the right rail
receive that same snapshot instance/`snapshotId`; they do not join separate
queues, refresh metrics independently, or read legacy scalar throttle state.
The publisher enforces
`activeDataLinkCount === (serving === null ? 0 : 1)` and never publishes a
count greater than one. Thus initial attach is not represented by a fabricated
solid link, while every established-serving snapshot has exactly one.
It also enforces `(serving === null) === (servingOrigin === null)`: a bootstrap
seed has a non-null serving pair and `bootstrap-serving-seed` origin, while a
truthful detached/unattached state has neither.
For every displayed candidate, `identity`, `phase`, `role`, `metrics`,
`sourceFrameId`, and `policyConfigHash` must be byte-for-byte equal in the
scene overlay and its rail row. `sourceFrameId` is the scientific join key;
`snapshotId` is the publication join key. The allowed scene/rail snapshot skew
is exactly `0 ms` (`acceptedSnapshotSkewMs = 0`).

The count labelled from `counts.triggerSatisfied` uses the same
`activeTriggerObjective`: it is never labelled as an EE count while the active
decision objective is SINR or a compatibility path. The invariant is one
objective per accepted snapshot; a mixed-objective candidate list is invalid.
The `hardEligible` count is similarly scoped to `activeHardGateProfile`; the
rail names that profile in expandable provenance and never merges a
validation-only full-gate result into the active compatibility count.

Only continuous geometry may interpolate between adjacent accepted snapshots.
Identity, phase, role, metrics, source frame, config hash, counts, and gate
states may not be interpolated or invented. At the atomic commit callback, the
publisher immediately accepts a new snapshot: the old solid link ends and the
new solid link begins in that snapshot, with no UI-throttle delay.

The authority point is `useSimStatePublisher`: after it receives the live
`HandoverDecisionFrame` plus the route-scoped, revalidated inspection request,
it synchronously builds exactly one `CandidatePresentationPlan`, validates and
deep-freezes one snapshot, then inserts that **same object reference** as
`SimState.acceptedHandoverPresentation` through the App state publication; it
does not rebuild the snapshot inside the legacy scalar-throttled branch. On the
resulting App commit, App passes the one accepted object to both `MainScene` and
`InfoPanel` / `HandoverEvaluationPanel`. Both consumers therefore render the
same committed object (or both retain the prior accepted object before that App
commit); neither consumes a private synchronous hook return. Those consumers
must not call
`buildCandidatePresentationPlan`, lease separate identity allocations, or read
different frame queues. The accepted-snapshot path is separate from the
existing 1-second teaching/scalar throttle; source-frame, policy-hash, phase,
leader, selected, and commit changes publish at the authoritative decision
cadence, with commit and policy reset synchronous.

If the publisher is disabled, the route is not the live Walker lane, or the
current frame has no `HandoverDecisionFrame`, the synchronous return is a null
session and `SimState.acceptedHandoverPresentation` is null. Returning to an
archived-TLE/artifact lane or losing authority clears the last live snapshot;
scene and rail may not retain it as a visual fallback.

Hover and pin are a separate route-scoped interaction object, not mutable
fields on the scientific decision frame:

```ts
interface CandidateInspectionState {
  episodeId: string;
  basedOnSnapshotId: string;
  hoveredKey: CandidateLinkKey | null;
  pinnedKey: CandidateLinkKey | null;
}

interface AcceptedHandoverPresentationSession {
  snapshot: AcceptedHandoverPresentationSnapshot;
  interaction: CandidateInspectionState;
  renderReceipt: CandidateSceneRenderReceipt | null;
}
```

Hover changes shared emphasis only. Pinning an overflow row requests the
central publisher to accept a new bounded presentation snapshot for the same
decision/source frame; it never mutates decision evidence, timers, ranks, or
policy state. The request carries `basedOnSnapshotId`. If that snapshot is no
longer current, the publisher revalidates the pair against the latest accepted
decision frame and replans there; if the pair or episode is absent, it clears
the stale pin with an explicit reason rather than resurrecting old science.
The simulation clock is never frozen merely to preserve a pin. Scene and rail
receive the same session; neither derives its own pin swap.

Actual WebGL mapping is acknowledged separately because the central publisher
does not own `placementByCellId` or satellite world coordinates. `MainScene`
emits one `CandidateSceneRenderReceipt` after resolving the accepted snapshot.
The receipt is valid only when both `snapshotId` and `sourceFrameId` match; the
rail may use it to mark a scene mapping failure but may not rewrite candidate
metrics or roles. During this migration the established serving/event carrier
is unconditional: neither a plan nor a receipt may suppress it. The matching
actual receipt validates the additive candidate overlay and prevents any
optional replacement decoration from claiming ownership before it is truly
rendered. A non-overflow hard-
eligible row counts as visually presented only when its `sceneJoinKey` appears
in `renderedSceneJoinKeys`; missing or stale receipts fail the browser fixture and
keep the established event carrier visible.

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
- request/cache counterfactual EE forecasts at a bounded cadence only for
  hard-eligible pairs; budget exhaustion leaves EE unavailable but does not
  remove their wireframes; and
- return the full scientific set without presentation truncation.

It owns no TTT, selected target, colour, or UI ordering.

### 6.2 `HandoverDecisionEngine`

```ts
interface DecisionClockContext {
  simTimeMs: number;
  dtSec: number;
  sourceFrameId: string;
  epochToken: string;
  policyConfigHash: string;
  discontinuity:
    | 'none'
    | 'seek'
    | 'loop-wrap'
    | 'epoch-change'
    | 'source-change'
    | 'policy-config-change';
}

interface HandoverCommitIntent {
  episodeId: string;
  sourceFrameId: string;
  simTimeMs: number;
  from: CandidateLinkKey | null;
  to: CandidateLinkKey;
  kind: HandoverKind;
  policyConfigHash: string;
}

interface HandoverDecisionProposal {
  proposedFrame: HandoverDecisionFrame & { recentCommit: null };
  commitIntent: HandoverCommitIntent | null;
  checkpoint: HandoverDecisionCheckpoint;
}

step(opportunities, clock: DecisionClockContext): HandoverDecisionProposal
```

`HandoverDecisionCheckpoint` is the engine's validated data-only restore token;
it is never serialized into the UI. `HandoverDecisionProposal` contains the
proposed decision state, the exact pre-step checkpoint, and at most one private
commit intent. A small coordinator
applies that intent through `primaryServingTransaction.ts`, then returns the
public `HandoverDecisionFrame`: on success it synchronizes the engine to the
accepted assignment, recomputes the opportunity frame at `dt = 0`, starts guard,
and attaches one `recentCommit`; on ordinary failure it restores the checkpoint,
retains the old sole serving link, keeps the target selected for a deterministic
retry, and publishes no receipt. If a service-continuity attempt fails after
the old pair has already disappeared, it publishes a truthful detached state
instead of restoring the absent source. Raw intents never reach the publisher,
scene, rail, toast, or event cue.

`DecisionClockContext.dtSec` is the elapsed scientific decision-clock step. It
must not be silently reused as the forecast sample step: if the two happen to
have the same value, both roles and their provenance still remain explicit.

Responsibilities:

- retain an independent `tttAccumulatedSec` clock for each pair, advancing only
  while that pair is hard-eligible and its current `triggerStatus` is
  `satisfied`; the objective and public label come from
  `activeTriggerObjective`;
- derive stable candidates;
- rank candidates using a policy adapter;
- maintain provisional-leader hold, commit, and guard state;
- derive intra/inter kind from the selected pair; and
- emit at most one private commit intent; the assignment/load/RF coordinator
  emits the sole authoritative receipt only after a successful transaction.

Absolute simulation time and the epoch token are mandatory. Seek, loop wrap,
date/time change, constellation change, and source change must follow explicit
timer rules: either rebase a continuous timeline with proof or reset candidate
TTT, selection hold, guard, and stale forecast state. Wall-clock animation time
must never advance decision timers. A `policy-config-change` is always a hard
discontinuity: clear candidate/forecast caches, invalidate the accepted
snapshot, reset all candidate TTT clocks, selection hold, guard, and the
handover episode, then publish only under the new `policyConfigHash`.

Policy adapters keep the orchestration stable:

```ts
interface HandoverSelectionPolicy {
  evaluate(input: {
    serving: CandidateOpportunity | null;
    alternatives: readonly CandidateOpportunity[];
  }): PolicyEvaluation;
}
```

- `SinrOffsetPolicy` preserves a regression baseline during migration.
- `ForecastEePolicy` becomes the homepage normal-operation policy after its
  complete `EE_POLICY_ACTIVATION_GATE` passes; implementation or isolated unit
  tests alone do not activate it.

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
- select the bounded scene subset without changing decision truth, retaining
  hard-eligible wireframes before lower-priority observed-only decoration;
- allocate event-stable satellite hues and beam shades;
- derive line/fill/motion styles from decision roles;
- provide typed overflow rows and full-set right-rail ordering; and
- provide stable scene/UI join keys.

This pure adapter is the only place where display caps or colour assignment may
be applied.

## 7. EE selection semantics

### 7.1 Normal-operation objective and `homepage-ee-handover-v1`

For every candidate action `a = (satelliteId, beamId)`, calculate forecast
system energy efficiency over the common horizon `H`:

```text
                 sum_k sum_u R_u^(a)(t_k) * Δt
η_hat_H(a) = -----------------------------------------  [bit/J]
                 sum_k P_sys^(a)(t_k) * Δt
```

This is total predicted delivered bits divided by total predicted consumed
energy. It is a ratio of sums, not an average of instantaneous EE ratios.

#### Walker-to-canonical input builder

Future samples come from a pure forecast-frame provider, not by advancing or
rewinding the live `SinrLiveCellModel`:

```ts
interface WalkerForecastAnchor {
  sourceFrameId: string;
  epochToken: string;
  epochUtcMs: number;
  /** Absolute UTC milliseconds; equal to epochUtcMs + replay offset. */
  simTimeMs: number;
  immutableScenarioState: WalkerScenarioState;
  policyConfigHash: string;
}

buildWalkerForecastFrames(
  anchor: WalkerForecastAnchor,
  sampleStartTimesUtcMs: readonly number[],
): readonly WalkerForecastFrame[];
```

All `simTimeMs`, `sampleStartTimesUtcMs`, returned `absoluteUtcMs`, and the
canonical evaluator's existing `startSimTimeMs` use the same **absolute UTC
millisecond** axis. Replay-relative time is derived only as
`(absoluteUtcMs - epochUtcMs) / 1000`. `epochToken` is a stable identity/digest;
it never substitutes for numeric `epochUtcMs`. A provider receiving a time
before the anchor, a non-finite time, a time outside the declared forecast
window, or a mixed absolute/relative sequence fails closed. If a future API
accepts offsets instead, it must be named `sampleStartOffsetsMs` and explicitly
compute `absoluteUtcMs = epochUtcMs + offsetMs` before propagation.

`WalkerScenarioState` and `WalkerForecastFrame` in this target signature are
new data-only contracts, not claims that those names already exist. The frozen
anchor contains the constellation/orbit seed, profile and antenna settings,
UE substrate and positions, hopping/schedule configuration, current
assignments and loads, and every value required to reproduce the source frame.
Each returned frame carries its derived source-frame identity, absolute time,
satellite/UE geometry, schedule state, and the immutable scenario facts needed
by the canonical builder. Neither type imports React or Three.js.

The authoritative satellite source is the existing deterministic orbit seam:
generate the frozen orbital elements once with `generateWalkerConstellation`
from the anchor's profile shells, observer and epoch, then evaluate each
requested absolute instant with `propagateOrbitElement`. Its returned ECEF
position and geodetic latitude/longitude/altitude, together with
`createObserverContext` / `computeTopocentricPoint`, are scientific geometry.
`createTrajectoryCache` is only an existing runtime cache precedent: its
20-second, elevation-filtered samples and `interpolateVisibleSats` output must
not be treated as the 2.5-second forecast authority. In particular,
`VisibleSat.world`, Three.js coordinates, sky-dome projection and camera-space
positions are render projections and are forbidden as canonical inputs.

The frozen UE source is the accepted frame's full per-UE identity and
observer-relative ENU position, plus its deterministic distribution seed and
the exact motion-owner state needed to forecast from that frame. The anchor
records `protagonistUeId` and one `motionSource` per UE:

- `protagonist-waypoints` replays the full `profile.ueMobility` waypoint path
  against the anchor's replay-relative time;
- `secondary-integrator` starts from the accepted `UePosition` and a deep-frozen
  copy of its `UePerMobilityState`, including RNG, waypoint index/state, current
  position, origin, mode, and parameters; and
- `frozen-former-protagonist` retains the accepted frozen ENU drift offset and
  does not silently re-enter the secondary integrator.

The accepted focus/protagonist identity is fixed for one forecast window and is
part of the scenario hash; a focus change invalidates that forecast. The
provider must not regenerate a UE population with `generateUePositions`, restart
a mobility path, substitute a cell centre for the primary UE, or mutate the live
mobility state. `groundX`, `groundZ`, `ueWorldScale`, and other render fields are
not forecast inputs.

The live Walker lane currently uses a declared geometry-model bundle rather
than one uniform Earth model:

```ts
interface WalkerForecastGeometryModels {
  orbitTopocentric: 'wgs84-orbit-topocentric-v1';
  beamLink: 'spherical-6371-beam-link-v1';
  localEnuProjection: 'flat-111.32-local-projection-v1';
  geometryModelHash: string;
}
```

Orbit propagation, satellite ECEF, and topocentric observation use the existing
WGS84 helpers. The current beam/link pointing helpers retain their declared
spherical-6371 boundary, while observer-relative UE offsets retain the existing
flat-111.32 km/degree projection before a shared exported geodetic-to-ECEF
helper constructs the UE vector. The builder records all three model IDs and
their hash; it must not claim they are one model. Replacing them with a unified
model requires a separate parity migration rather than an unrecorded formula
change.

`CellModelSat` latitude/longitude/topocentric fields and the current `[0, 0, 0]`
snapshot ECEF placeholders are compatibility inputs, not sufficient forecast
geometry. The data-only target frame is explicit:

```ts
interface WalkerForecastSatState {
  satelliteId: string;
  shellId: string;
  orbitPoint: OrbitPoint;              // authoritative ECEF + lat/lon/alt
  topocentric: TopocentricPoint;
}

interface WalkerForecastUeState {
  ueId: string;
  eastKm: number;
  northKm: number;
  latDeg: number;
  lonDeg: number;
  ecefKm: readonly [number, number, number];
  motionSource:
    | 'protagonist-waypoints'
    | 'secondary-integrator'
    | 'frozen-former-protagonist';
  motionStateDigest: string;
}

type WalkerForecastBeamAxis =
  | {
      axisSource: 'earth-fixed-target';
      targetLatDeg: number;
      targetLonDeg: number;
      /** Unit direction from the satellite to the beam centre in ECEF axes. */
      axisEcefUnit: readonly [number, number, number];
    }
  | {
      axisSource: 'accepted-sampled-axis';
      /** Unit direction from the satellite to the beam centre in ECEF axes. */
      axisEcefUnit: readonly [number, number, number];
      axisSourceFrameId: string;
      axisSampleBucketId: string;
    };

interface WalkerForecastBeamState {
  key: CandidateLinkKey;
  cellId: number | null;
  axis: WalkerForecastBeamAxis;
  scheduled: boolean;
  active: boolean;
  load: number;
  satelliteIndex: number;
  reuseColorIndex: number;
}

interface WalkerForecastFrame {
  sourceFrameId: string;
  epochUtcMs: number;
  absoluteUtcMs: number;
  observer: ObserverContext;
  geometryModels: WalkerForecastGeometryModels;
  beamConfiguration: WalkerScenarioBeamConfiguration;
  beamHopping: WalkerScenarioBeamHoppingConfiguration;
  protagonistUeId: string;
  satellites: readonly WalkerForecastSatState[];
  ues: readonly WalkerForecastUeState[];
  beams: readonly WalkerForecastBeamState[];
  servingBeamIndexByUe: readonly number[];
  laggedInterferenceWByUe: readonly number[];
  canonicalPowerStateHash: string;
  scheduleStateHash: string;
  assignmentStateHash: string;
  scenarioStateHash: string;
}
```

Every beam axis is a finite, normalized direction from that sample's satellite
position toward the beam centre, expressed in ECEF axes. It is either recomputed
from a declared earth-fixed target or carried from an accepted sampled-axis
source with exact frame/bucket provenance. An earth-fixed-target record with a
missing target, a sampled-axis record with missing provenance, a non-unit or
non-finite direction, or absent ownership/reuse/load state invalidates the
frame; no fallback to a cell centre, render-world coordinate, or `[0, 0, 0]`
placeholder is permitted.

The current validation-only provider does not extrapolate one accepted ECEF
axis across a multi-sample horizon. `accepted-sampled-axis` is therefore
accepted only for a single-sample diagnostic until a complete per-sample
axis/bucket sequence is available; the 7-sample Forecast-EE path requires
earth-fixed targets or that future per-sample provenance. This fail-closed
restriction is not an activation claim.

Likewise, the validation-only provider currently accepts fixed illumination
only. It rejects `beamHopping.enabled = true` rather than carrying frozen anchor
loads through changing slots. Forecast-EE activation remains blocked until a
separate scheduling action defines dark-slot assignment/load semantics and the
matched recurrence is validated across the full hopping sequence.

The provider evaluates deterministic Walker positions, fixed illumination
state, UE positions, and immutable scenario/config state at the requested
times. It must not mutate live assignments, manager state, decision timers,
selection hold, guard, playback clock, or render state. Baseline and every
one-action candidate receive the same frozen frame sequence; a forecast cannot
feed its candidate assignment back into the next baseline sample. The anchor
hashes and complete sample-time sequence are retained for replay.

The Walker adapter is the only place where a Walker assignment becomes the
formal `CanonicalEeInput` consumed by `canonicalForecastEeEvaluator.ts`. Its
target contract follows the evaluator's existing full-sample seam rather than
inventing a second vector vocabulary:

```ts
interface WalkerCanonicalForecastSample {
  sourceFrameId: string;
  epochUtcMs: number;
  startSimTimeMs: number;
  durationSec: number;
  scenarioStateHash: string;
  geometryModelHash: string;
  canonicalConfigHash: string;
  assignmentStateHash: string;
  canonicalPowerStateHash: string;
  protagonistUeId: string;
  ueIdsByIndex: readonly string[];
  beamKeysByIndex: readonly CandidateLinkKey[];
  baselineInput: CanonicalEeInput;
  candidateInput: CanonicalEeInput;
  policyConfigHash: string;
}

buildWalkerCanonicalForecastSamples(
  walkerFrames: readonly WalkerForecastFrame[],
  action: CandidateAssignmentDelta,
  policy: WalkerHandoverPolicyConfig,
): readonly WalkerCanonicalForecastSample[]
```

For every sample, both full inputs include the serving beam and every beam in
the scientific candidate set. `beamKeysByIndex` preserves domain identity;
the canonical `frame.beamSatelliteB` uses a stable numeric satellite-index
mapping, and `frame.beamColorB` uses integer co-channel reuse classes. These
two canonical vectors are identical across the matched baseline/candidate
pair. Episode identity hues and beam shades are presentation-only and must
never populate `beamColorB`.

The adapter calculates the complete `U x B` `thetaRadUb`,
`propagationGainUb`, and `receiveGainUb` matrices from each future Walker
sample at the primary UE's actual position. Those physical matrices are shared
by the baseline and candidate for that same sample. The baseline keeps the
current `servingBeamU`; the candidate changes only the declared primary-UE
assignment plus the affected `beamActiveB`, `beamLoadB`, and switch-event
indicator entries. Unaffected UE assignments, geometry, ownership/reuse
vectors, canonical physical configuration, source-frame sequence, and sample
durations remain fixed. The canonical evaluator then recomputes requested and
actual RF power, intra/inter-satellite interference, rates, system power, and
system EE from each full input.

Each displayed pair is evaluated as an independent one-action counterfactual
against the same keep-serving baseline. Listing six candidates does not activate
six target beams or make them simultaneous interferers. The baseline includes
all target beam indices for shape/ownership/reuse provenance, with their actual
baseline active/load state. An intra-satellite action changes the primary-UE
assignment and affected loads on already represented beams. An inter-satellite
action activates its target beam/satellite only when required by the declared
assignment, incurs its canonical RF/RFC/BB/event energy, and contributes
inter-satellite interference; all other alternative target beams retain their
baseline state. The source beam deactivates only if its recomputed load becomes
zero. This one-at-a-time boundary is also why several dashed candidate guides
must not be interpreted as simultaneous service.

`switchEnergyJ` is taken from the canonical power configuration and added once
at the declared switch boundary for the candidate action. The profile's event
accounting mode is exactly `target-once-at-horizon-start`: the matched baseline
sets every `switchIndicatorByBeam` entry to `0` in every sample; the candidate
sets exactly the target beam's entry to `1` in the first forecast sample and
sets every other entry in every sample to `0`. Because the canonical producer
adds `switchEnergyJ * indicator / frameDurationS`, integration over that first
sample contributes exactly one `switchEnergyJ` event. The source beam is not
also indicated; doing so would double-count this per-switch event. The Walker
builder constructs the indicator sequence, but
`canonicalForecastEeEvaluator` is the final enforcement owner before evidence
can become `valid`: it rejects non-binary indicators, any baseline indicator, a
candidate indicator sum other than exactly one over the complete horizon, or a
first sample whose `startSimTimeMs` does not equal the declared forecast/switch
boundary. The accounting mode, boundary time, target beam index, and indicator
digest belong in forecast provenance and `policyConfigHash`.

This is a named Walker-policy accounting convention, not a newly asserted paper
constant. It is never inferred from a UI animation, substituted with an
arbitrary energy value, or silently omitted from the consumed-energy
denominator. A zero value is valid only for the explicitly biased diagnostic
path described above; its indicator invariant still applies so zero energy
cannot hide a missing event witness.

Any exogenous canonical training-event vectors are copied identically from the
frozen schedule into the matched baseline and candidate. Under v1 they are not
silently turned on only for the candidate; `switchEnergyJ` is the sole
authorized action-specific event term. If the scientific authority later
requires handover-triggered training energy, implementation stops for a named
profile amendment defining its event boundary and exactly-once accounting
rather than overloading the switch indicator.

Baseline and candidate use the identical source-frame sequence, sample
durations, and horizon. Compute both system EEs as ratio-of-sums over that
same horizon, then derive relative baseline delta. It is forbidden to copy the
serving instantaneous EE, use a scalar label swap, or divide one candidate's
rate by another frame's power.

The evaluator must receive a complete builder output for every forecast sample,
including the `U x B` off-axis-angle, propagation-gain, and receive-gain
matrices; serving/candidate assignment; active-beam vector; per-beam load;
beam-to-satellite ownership; reuse-colour vector; lagged interference; and
canonical power configuration. The retained forecast evidence stores
hashes/digests and the assignment delta, while the replay fixture retains the
complete canonical inputs needed to reproduce the result.

The current cell-centre candidate probe and its `linkBudgetOptions(..., false)`
path are not valid forecast-EE evidence. Candidate geometry and link budget
must be recalculated at the primary UE's actual position, with the same
angle-aware and power-state model used by the canonical baseline. Candidate
power recurrence, load, interference, and affected-UE assignment changes must
be computed explicitly.

The baseline is “keep the current serving link” over the same horizon $H$. The
normal handover trigger condition is:

```text
hard-eligible
AND valid matched canonical system-EE evidence
AND η_hat_H(candidate) >= η_hat_H(baseline) * (1 + ε_EE)
AND the condition remains true for the candidate's independent TTT
```

The named experimental profile is **`homepage-ee-handover-v1`**, but its
unfrozen values must not be presented as canonical formula constants:

- **Chosen forecast horizon ($H$):** `7 x 2.5 s = 17.5 s`, pending measured
  horizon/hopping semantics. It is not a complete beam-hopping frame or period.
- **Default hopping plan:** the `7-cell` layout/index assignment does not
  rotate. Its `K < N` illuminated window may still advance per `hopSlotSec`;
  this temporal hopping is not layout rotation. A `19-cell` plan has a 19-cell
  period, not 7; this schedule fact is not evidence for the chosen horizon.
- **Horizon sample step:** `dt = 2.5 s` is the chosen sample step pending
  measurement. Forecast refresh cadence and cache/compute budget are separate
  controls defined in section 11.
- **Throughput gate:** `Rmin` is the primary UE's per-UE predicted rate under
  the candidate counterfactual load. `1 Mbit/s` may be provisioned by the
  owner profile, but it is not a canonical paper constant.
- **Effective SINR gate:** use `max(profile SINR floor, derived gamma_req)` in
  the same declared SINR domain. Changes to `Rmin`, load, bandwidth, or any
  `gamma_req` input require recomputation of rate, floor, gates, and EE.
- **EE threshold:** `epsilon_EE` is TBD until matched causal-control true
  canonical system-EE `relativeDelta` distributions over `7200 s` are
  complete for both intra-satellite and inter-satellite cases.
- **Tie tolerance:** `tieToleranceRelative` is a configurable Walker policy
  value and remains TBD pending the same calibration; no numeric default is
  authorized.
- **Switch energy:** `E_switch` resolves through canonical `switchEnergyJ` and
  is included exactly once on the target beam in the first candidate forecast
  sample under `target-once-at-horizon-start`; the matched baseline has no
  switch indicator. `0 J` may appear only as a visibly biased
  zero-switch-energy diagnostic; it cannot rank, activate the policy, or
  support a savings claim.

These are Walker handover-policy controls, not canonical formula controls. The
right rail may expose their current values and provenance, but must label them
as policy configuration. `ForecastEePolicy` remains disabled from default
public activation until the required counterfactual, parity, qualified-window,
browser, and owner-visual evidence is complete.

### 7.2 Hard eligibility and the separate EE trigger

EE is the optimization objective, not permission to hide an otherwise usable
link. `hard-eligible` is derived only from these non-EE QoS/service gates:

- **minimum elevation and steering/coverage geometry;**
- **scheduled/illuminated availability:** the current hopping plan must make
  the pair available, or an explicitly modelled scheduling action must carry a
  capacity proof;
- **effective SINR floor:** primary-UE SINR must satisfy
  `SINR >= max(profile SINR floor, derived gamma_req)`;
- **minimum throughput:** `Rmin` is the profile threshold on the primary UE's
  per-UE predicted rate under this candidate's counterfactual load; and
- **minimum remaining service time:**
  $$T_{\text{remaining,min}} = \text{TTT} + \text{selection hold}
  + \text{guard} + H$$

For `homepage-ee-handover-v1`, `remainingServiceThresholdSec` is exactly this
derived value; it is not a second independently adjustable threshold. Its four
inputs and derived result are retained in gate provenance and the policy hash.
A future extra service margin would require a separately named, sourced, and
accepted policy field plus an amended formula; it cannot be hidden inside this
threshold.

These gates produce `hard-eligible` even when candidate EE is missing, below
the threshold, or still being measured. Such a pair remains a typed rail row;
when admitted to the bounded scene subset it also remains a visible wireframe.
In Forecast-EE mode it may not advance TTT until its separate EE trigger is
satisfied.

When `activeTriggerObjective === 'forecast-ee'`, the policy-neutral
`trigger-satisfied` result requires a valid, same-horizon, matched
baseline/candidate canonical system-EE forecast and:

```text
hard-eligible
AND forecast status = valid
AND candidate relativeDelta >= epsilon_EE
```

`unavailable`, `stale`, `invalid`, or incomplete EE evidence makes the trigger
unavailable, not a zero-valued measurement. A valid forecast below the profile
threshold makes the trigger not satisfied. Neither case removes a
hard-eligible pair from the scientific set or its bounded-presentation
priority; a pair outside the scene cap remains typed overflow rather than
silently disappearing. Only time continuously spent in the accepted active
`trigger-satisfied` state advances that pair's independent TTT.

`Rmin` is never an aggregate, cell-centre, serving-load, or display value: it
is the primary UE's same-source-frame canonical
`candidateResult.throughput.rateUBps[primaryUeIndex]` after the declared
assignment and affected-load recomputation. It is not a horizon average and is
not copied from the serving projection; the full horizon remains the separate
EE forecast boundary. The candidate's same-frame effective SINR floor is
explicitly `max(profile floor, derived gamma_req)`, with both inputs in the same
domain.
`gamma_req` is derived from that profile `Rmin`, the canonical per-beam
bandwidth, and the candidate beam's counterfactual load using the same canonical
formula/domain as the candidate result. In the current canonical producer this
is the linear threshold

$$
\gamma_{\mathrm{req},b}
= 2^{R_{\min} U_b / B_b} - 1,
\qquad
\gamma_{\mathrm{effective},b}
= \max\!\left(10^{\mathrm{SINR}_{\min,\mathrm{dB}}/10},
\gamma_{\mathrm{req},b}\right).
$$

Here $U_b$ is the recomputed candidate beam load and $B_b$ is its canonical
bandwidth. Gate comparison occurs in the linear domain against canonical
`sinrU[primaryUeIndex]`; conversion back to dB is display-only. A missing,
zero, or shape-inconsistent candidate load does not produce an infinite or
zero shortcut—it invalidates the candidate evidence fail closed.
Changing `Rmin`, either floor, `gamma_req` inputs, bandwidth, assignment, or
load invalidates and recomputes the affected rate, effective floor, gate
results, forecast, and ranking evidence before the next accepted snapshot.

The physical steering eligibility threshold must not be replaced by a larger
presentation-only cone angle. Any current visual guard angle must be labelled
and kept outside the scientific gate.

The producer reports at least these distinct stages instead of one overloaded
candidate count: observed/geometrically reachable, hard-eligible,
trigger-satisfied (with active objective), TTT-stable, and displayed. The
geometry sub-stages (steering-valid and scheduled/illuminated) remain available
for gate details.
In this SDD no new beam-scheduling controller is authorized,
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

### 7.3 Independent TTT, provisional leader, and stable selection

Every hard-eligible pair is tracked independently. In normal Forecast-EE mode,
only a pair whose `activeTriggerObjective` is `forecast-ee` and whose
`triggerStatus` is `satisfied` accumulates TTT. If candidate A temporarily
becomes the provisional leader while candidate B remains hard-eligible and its
EE trigger remains satisfied, B's timer continues. A timer resets only when
that pair's hard eligibility or EE trigger fails, its evidence becomes stale or
unavailable, or it leaves the candidate set beyond the configured tolerance.
Hard-eligible pairs whose EE trigger is not satisfied remain visible as
wireframes but are not called stable.

Before Forecast-EE activation, the same timer machinery may advance only from
the explicitly accepted SINR/startup compatibility trigger. In that mode the
public label and `activeTriggerObjective` remain compatibility-specific, and a
validation-only EE value has no effect on trigger state or elapsed TTT.

The complete candidate progression follows the 5-stage, policy-neutral lifecycle:
$$\text{hard-eligible} \longrightarrow \text{trigger-satisfied}
\longrightarrow \text{TTT-stable} \longrightarrow \text{provisional leader}
\longrightarrow \text{selected/commit}$$

In `forecast-ee-active` mode, rank every hard-eligible candidate with valid
same-horizon EE evidence into the objective order, whether or not its TTT is
complete. Filter that same comparator to the TTT-stable set to produce the
decision's stable order:

1. **higher deterministic Forecast-EE bucket / forecast EE
   ($\hat{\eta}_H$);**
2. **within one exact configured tie bucket:** longer remaining service time;
3. **then higher predicted throughput ($R$);**
4. **then stable `CandidateLinkKey = (satelliteId, beamId)`** for deterministic
   replay.

Every rankable candidate in one frame shares the same positive baseline EE, so
the tie configuration is defined on its `relativeDelta`, not by a pairwise
approximately-equal comparator. With calibrated
`tieToleranceRelative = tau > 0`, compute the integer bucket

$$q_a = \left\lfloor
\frac{\mathrm{relativeDelta}_a}{\tau} + \frac{1}{2}
\right\rfloor$$

and compare `q_a` before the tie-break fields above. With `tau = 0`, compare the
finite `relativeDelta` values exactly before applying tie-breaks only on exact
equality. Pairwise tolerance comparisons are forbidden because they can be
non-transitive and make replay depend on input order. `tieToleranceRelative`
has no numeric default until matched 7200 s intra/inter `relativeDelta` and
numerical-repeatability calibration is complete; the dated profile receipt
freezes both its value and this explicit half-toward-positive-infinity
quantization semantics for TypeScript/Python parity.

Before activation, `objectiveRank` and `stableRank` are populated by the active
SINR/startup compatibility comparator and labelled `SINR #...`; a
validation-only EE value receives no decision rank and cannot reorder either
field. Service-continuity protection is an immediate safety selection rather
than a fabricated normal ranked episode.

The provisional leader is stable rank `#1` and must remain there continuously
for `selectionHoldSec` before commit. This prevents a rapidly oscillating rank
from appearing as an instantaneous handover. The selection hold is separate from each candidate's
TTT and must be rendered as an independent progress bar/stage. `selected` is
the hold-complete state; `committed` is published only at the atomic commit
boundary and is the sole new serving link.

The transaction boundary is authoritative over presentation. Until the final
assignment, recomputed load, and selected-link RF measurement all succeed, the
old serving pair remains the sole solid link and no completion cue/receipt is
published. A rejected or stale transaction cannot be converted into a visual
handover by the engine's private intent.

### 7.4 Service-continuity protection

The existing continuity fallback remains frozen at its current boundary. It is
entered only when the committed serving pair is absent from the current
same-frame candidate set; if the serving pair is still measured, normal TTT and
selection state remains authoritative. The fallback accepts only candidates
passing the existing compatibility gates: elevation, steering,
scheduled/illuminated availability, and the active profile SINR floor, with
finite same-frame evidence. It does not consult forecast EE, `Rmin`,
remaining-service forecasts, or presentation visibility.

The fallback preserves the existing numeric compatibility values from the
active Walker profile: the elevation, steering, and SINR thresholds come from
that profile, and scheduled illumination must carry the positive boolean
evidence `measured = 1`, `threshold = 1`, `unit = boolean`. These values are
not replaced by candidate-mode EE controls. The post-commit guard remains the
profile's existing guard interval and starts only after a successful
assignment/load/RF transaction.

The fallback chooses the highest-SINR safe pair, then the stable
`CandidateLinkKey` as its deterministic tie-break. It commits immediately only
after the external assignment/load/RF transaction succeeds, bypassing TTT and
selection hold because no active serving link remains. The receipt and rail
must say `service-continuity-protection` / “服務連續性保護”, identify the
profile gate values and source frame, and never claim EE optimality or savings.
The current profile SINR threshold and exact immediate-commit boundary are
preserved; no new rescue number may be inferred from animation timing. If no
compatibility-safe pair exists, publish a detached/initial-attach state rather
than fabricating a serving link.

## 8. Shared inter/intra procedure

Both event types use the exact same stages, the same state machine, and the same
right-rail panel:

$$\text{measure pairs} \longrightarrow \text{hard-eligible}
\longrightarrow \text{trigger-satisfied} \longrightarrow \text{TTT-stable}
\longrightarrow \text{provisional leader} \longrightarrow \text{selected/commit}$$

The snapshot's `activeTriggerObjective` supplies the stage's public meaning:
Forecast EE after activation, SINR compatibility before activation, startup
compatibility with no serving baseline, or the narrowly scoped service-
continuity condition. The common lifecycle name never turns those distinct
scientific meanings into EE claims.

Examples:

- `no serving link -> SAT-A / Beam 1` is an initial attach.
- `SAT-A / Beam 1 -> SAT-A / Beam 4` is an intra-satellite beam switch.
- `SAT-A / Beam 1 -> SAT-C / Beam 2` is an inter-satellite handover.

The event kind is derived strictly after selection:
```text
target.satelliteId == serving.satelliteId ? 'intra-satellite' : 'inter-satellite'
```

The panel may group rows under the same satellite, but it must not remove the
beam identity. A satellite with two useful beams contributes two distinct
candidate rows and two distinct timers. The display cap is at most 3 satellite
groups x 2 candidate beams plus 1 serving beam; the scientific set and all
timers/ranks remain complete beyond that presentation cap.

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

The existing serving/current-frame `BeamshiftCanonicalEe` projection and the
candidate horizon-level canonical forecast have different boundaries. They are
not numerically subtracted or presented as the baseline/candidate comparison.
The upper board's EE delta always uses its own matched keep-serving
`baselineEeBitPerJ` and candidate `eeBitPerJ` from the same forecast evidence;
the lower serving EE remains explicitly current-frame context unless it is
replaced by a typed, boundary-matched projection.

The upper board is a projection of the accepted
`AcceptedHandoverPresentationSnapshot` only. Its header always separates these
counts: `observed`, `hard-eligible`, `trigger-satisfied`, `TTT-stable`, and
`displayed`. The trigger count is labelled from `activeTriggerObjective`, so it
is called an EE count only in active Forecast-EE mode. The scene overlay reads
the same snapshot and must expose the same
`snapshotId`, phase, count values, and candidate keys; a legacy scalar or
playback throttle cannot drive a rail update. These are counts of candidate
pairs; the current serving pair is reported in its own serving block and is not
silently folded into a candidate count.

The public Traditional-Chinese labels are `觀測`, `服務條件成立`, the
objective-specific trigger label (`能源效率條件成立`, `SINR 比較條件成立`, or
`首次連線條件成立`), `穩定時間成立`, and `畫面顯示`; internal enum names such
as `hard-eligible` or `TTT-stable` do not appear as unexplained UI jargon.

When Forecast EE is the active policy, the title is `預測能源效率換手評估`; it
must not retain `SINR 換手評估`. Before activation, the title is
`候選鏈路驗證` and the mode badge states `SINR 相容模式` or
`預測 EE 驗證實驗` as applicable. A pre-activation validation forecast remains
excluded from ranking/TTT/selection even though its value may be inspected.
The implementation/source name `Walker` is not shown as user-facing copy in
this board; source provenance may say `模擬星座` with the profile/version in
the expandable technical details.

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
│ 觀測 9 | 服務條件成立 6 | EE 條件成立 3      │
│ 穩定時間成立 2 | 畫面顯示 6                  │
│ 候選連線（顯示 6 / 全部 9）                  │
│ SAT-A  同衛星                                │
│   ○ B3  TTT 穩定  EE #4 / 穩定 #2  Δ ...     │
│      remaining ...  failed: —                │
│   ○ B5  資格未通過  EE — / 穩定 —             │
│      remaining ...  failed: service-time     │
│ SAT-B                                          │
│   ○ B2  暫列第一  EE #2 / 穩定 #1  Δ ...      │
│      TTT 已完成  remaining ...  failed: —    │
│   ○ B4  EE 條件成立  EE #1 / 穩定 —  Δ ...    │
│      TTT ...  remaining ...  failed: —       │
│ SAT-C                                          │
│   ○ B1  觀測鏈路  EE — / 穩定 —  尚未計算     │
│      TTT —  remaining ...  failed: SINR      │
│                         顯示其餘 +N            │
├──────────────────────────────────────────────┤
│ 選定：SAT-B / B2  跨衛星換手                 │
│ 選定保持 0.8 / 1.5 s                          │
└──────────────────────────────────────────────┘
  [SINR] [Power] [Throughput] [EE]  collapsed
```

Numbers in this wireframe are layout examples for active Forecast-EE mode, not
prescribed runtime values. In compatibility mode the same slots say `SINR #…`
and do not reuse a validation-only EE rank as the decision rank.

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

Every candidate row, including a typed overflow row, shows the same complete
decision summary:

- satellite and beam identity, with the exact `CandidateLinkKey`;
- status among observed, hard-eligible, active-trigger-satisfied, TTT-stable,
  provisional leader, selected, committed, or rejected, with the trigger
  objective named explicitly;
- **active-objective rank** among every hard-eligible pair with valid evidence
  for the accepted `activeTriggerObjective`, plus **stable rank** among the
  complete TTT-stable set used to choose the provisional leader. Forecast-EE
  mode labels the first value `EE #…`; compatibility mode labels it
  `SINR #…`. Validation-only EE is shown separately and is never substituted
  for the decision rank. Either rank is `—` with a reason when not rankable;
  neither is a display-subset rank. Thus an active Forecast-EE row may
  truthfully show `EE #1 / stable —` while its TTT is still incomplete,
  explaining why a lower EE-ranked but already stable pair is temporarily the
  provisional leader;
- `預測 EE` (never unqualified `EE`), its common horizon, and relative delta
  from the named keep-serving baseline, or `尚未計算`/`資料不足`;
- independent TTT progress and remaining service time; and
- failed gate code(s), or `—` when no gate has failed.

The scene overlay and row carry the same key, objective/stable ranks, status,
metrics, failed gates, `sourceFrameId`, and `policyConfigHash`. Hovering either object
cross-highlights the other; pinning either object selects the same pair for
inspection. Overflow rows remain typed with these fields even though their
candidate-only geometry is not in the bounded scene subset.

On pin/expand, show:

- SINR, predicted throughput, elevation, steering angle, and remaining service
  time;
- the primary UE identity, candidate-counterfactual load, profile SINR floor,
  derived `gamma_req`, and effective SINR floor;
- matched baseline and candidate EE numerators (predicted delivered bits),
  denominators (predicted energy), horizon, relative delta, and model/source
  version;
- `switchEnergyJ` provenance and the `policyConfigHash`/canonical input hashes;
- every gate with measured value and threshold; and
- a plain-language selection or rejection explanation.

Never render unavailable EE as `0 bit/J`. Show `尚未計算` or `資料不足`.
No candidate with unavailable, stale, invalid, or incomplete counterfactual
evidence may enter EE ranking. The panel always displays the `預測` qualifier;
it must not turn counterfactual improvement into an observed savings claim. If
valid candidate EE is exposed before the activation gate passes, the board must
also show `validation experiment` and exclude that value from ranking, TTT,
selection, and commit. A `0 J` switch-energy result is shown only with its
biased diagnostic label.

### 9.4 Event receipt

After commit, retain a compact wall-clock receipt long enough to read:

```text
跨衛星換手完成
SAT-A / B1 -> SAT-B / B2
選擇依據：預測能源效率提升，且所有服務條件成立
```

For an intra event, use `SAT-A / B1 -> SAT-A / B3` and label it
`同衛星波束切換完成`. For a safety event, replace the EE explanation with the
service-continuity reason. Before Forecast-EE activation, a normal compatibility
receipt states the SINR compatibility condition and must not claim predicted EE
improvement; a bootstrap serving seed produces no handover-completion receipt.

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

Serving and candidate spacecraft positions come from the same normalized
Walker scene frame and advance on the same simulation clock. A role or phase
must not freeze the serving satellite, make a candidate orbit locally around a
fixed point, or move either on a presentation-only trajectory. Smooth geometry
interpolation is allowed, but every displayed position remains bracketed by
the same authoritative source sequence used by the accepted snapshot.

Scene identity uses one shared formatter sourced from the accepted snapshot:
`SAT / B<beamId> / C<cellId>`. A compact satellite badge stays adjacent to its
GLB, while the beam/cell badge is anchored near the outer edge of that beam's
hexagonal footprint rather than over the UE or footprint centre. Serving,
provisional-leader, and selected badges have first priority; other displayed
candidate badges use a deterministic screen-space collision resolver with
leader lines. A lower-priority badge may collapse to its compact `B/C` token,
but it may not drift onto another beam, cover the UE, or disagree with the
matching right-rail row. The established `SinrLiveCellFootprintRings` hexagonal
cell geometry remains the serving footprint authority; candidate footprints
use the corresponding hex geometry and must not replace the ground cells with
large circular discs.

The camera receives one stable route-entry framing only. Candidate appearance,
rank changes, TTT progress, selection, and commit do not automatically pan,
zoom, refit, or orbit the camera. The user retains manual orbit/zoom controls,
and an explicit reset control may restore the route-entry view. Candidate
satellite GLBs and beam outlines must remain readable from that framing; size
or opacity tuning is presentation-only and cannot alter scientific geometry.

Data-transfer particles remain attached to the sole established serving path.
Candidate measurement guides never carry throughput particles. A bounded
hard-eligible candidate is identified by a sparse wireframe cone, hex
footprint, and dashed measurement guide; the guide is never promoted to a
solid data path before commit.

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
| Hard-eligible | visible wireframe cone and dashed footprint; no EE threshold required | dashed measurement guide, hollow endpoint, no solid link |
| Trigger-satisfied / TTT | visible wireframe cone, dashed footprint, independent timer arc; public wording follows the accepted trigger objective | dashed measurement guide only when focused |
| Provisional leader | stronger outline and one directional pulse | dashed, explicitly labelled evaluation path |
| Selected target | double outline/chevron; sparse wireframe, no filled service cone | dashed switch-preparation cue |
| Committed serving | same satellite hue and beam shade, now solid | becomes the sole solid data link |

Candidate clarity comes from a strong identity outline and footprint, not from
stacking pale translucent cone fills. Candidate outline/footprint pixels must
reach at least 3:1 contrast against the sampled scene background and may not be
reduced below `0.65` material opacity; candidate cone fill remains at or below
`0.12` so the UE and ground cell remain visible. Satellite GLB materials remain
opaque (`opacity = 1`) and are never faded to indicate candidate status. These
numeric presentation floors are browser/pixel acceptance targets, not changes
to beam geometry or RF power.

The hard-eligible row is mandatory even when the EE trigger is not satisfied
or its forecast is unavailable. If an accepted snapshot contains at least two
hard-eligible pairs, the browser assertion requires at least two corresponding
rail rows and at least two corresponding scene wireframe objects at that same
snapshot; the exact `(satelliteId, beamId, sourceFrameId)` keys must match.

Event kind has a separate non-colour encoding: an intra-satellite switch uses
a local beam-to-beam arc and the label `同衛星波束切換`; an inter-satellite event
uses a satellite-to-satellite transfer cue and the label `跨衛星換手`. Reduced-
motion mode preserves the labels, endpoint shapes, and line patterns without
requiring pulses.

Candidate paths must never look like simultaneous data service. The old solid
link remains active until commit. At the commit boundary it ends and the new
solid link begins. This is not DAPS and must not be animated as two active
connections.

For an inter-satellite event, the established filled transition carrier has
exactly one owner at every instant: source before a matching commit receipt,
target after that receipt. The candidate remains wireframe/dashed before
commit. Wall-clock phases such as `holding`, `releasing`, or `settled` may pace
the animation but may not declare takeover, change the filled owner, or produce
completion wording. Only a matching authoritative receipt can do so. An intra
beam switch may retain the established same-satellite cell cross-fade, but the
data-link count remains one.

The renderer enforces `activeDataLinkCount === 1` whenever a serving link
exists, `0` only for a truthful detached/initial-attach state, and never a value
greater than one. Before commit, a candidate uses a hollow measurement endpoint
and has no UE-to-target data path, active throughput flow, active-power
animation, or serving label. Other beams on the serving satellite follow the
same context/measurement rule; sharing the satellite identity does not make
them serving beams. A commit receipt records the exact frame in which the old
active link ended and the new one began.

### 10.3 Scene density budget

The scientific engine evaluates every observed pair and retains every
hard-eligible/trigger state. The default 3D display is bounded independently:

- **scene-global presentation budget:** `maxConeVolumes = 7`; the current
  candidate resolver already asserts its own local plan cap, but `MainScene`
  does not yet sum the established serving cone with every candidate/ambient
  cone layer. The accepted render receipt must enforce the global total;
- **satellites:** current serving satellite plus at most two alternate
  satellites, for three simultaneously rendered satellite identities;
- **serving-satellite beams:** current serving beam plus at most two intra
  alternatives;
- **each alternate satellite:** at most two candidate beams;
- **mixed-event worst case:** one serving beam plus six candidate beams;
- **intra-focused case:** one serving beam plus at most two same-satellite
  candidate alternatives.

The three-satellite limit matches the current renderer foundation; the
scene-global seven-volume limit closes the gap beyond the existing
candidate-component local assertion. It is a presentation-only constraint, not
a change to the
canonical scenario's active-beam count. The primary right-rail board displays
up to six candidate pairs in the bounded subset and exposes all remaining
typed rows through `其餘 +N`; overflow does not lose identity, objective/stable ranks,
metrics, TTT, remaining time, or failed-gate state. At 1080 px
height, four rows should remain visible without scrolling; additional rows use
an internal scroll/expand control. On shorter layouts, show three rows plus
honest overflow.

Pinning an overflow row may swap that pair into the bounded 3D subset only
after the serving carrier, selected target, and provisional leader retain their
mandatory slots. The least-important non-mandatory unpinned candidate is then
removed from the scene, but no scientific candidate is removed from the
decision frame and existing identity colours are not reassigned. If those
mandatory identities already consume the satellite/beam budget, the pin still
opens its rail inspection but remains honestly `sceneSlot = null` with a
`presentation-capacity` reason; it never evicts decision-critical evidence.

The display subset is selected in this order, with the serving carrier outside
the candidate ranking and always retained:

1. selected target;
2. provisional leader;
3. requested pinned pair, when a compatible slot remains;
4. other stable candidates;
5. hard-eligible candidates, including those without an active-trigger pass;
6. observed candidates needed to explain a rejection.

It is a presentation priority only. It does not change the decision ranking.

Before final tuning, run a two-hour Starlink Walker instrumentation sweep and
report p50, p95, and maximum counts separately for observed, hard-eligible,
active-trigger-satisfied, TTT-stable, and displayed pairs, recording the
trigger objective beside each distribution. Historical
single-condition probes must not be presented as the new candidate-count
distribution.

### 10.4 Interaction

- Hovering a rail row highlights the matching satellite-beam outline and
  footprint; hovering the scene object highlights the matching rail row.
- Scene pointer handlers belong to the candidate cone/footprint group, not only
  the HTML badge; badges may remain `pointer-events: none` for camera control.
- Clicking/pinning either side updates the one shared `CandidateInspectionState`;
  the central publisher then accepts any required bounded-plan swap once for
  both consumers. The request is based on the emitting `snapshotId` and is
  revalidated against the latest accepted frame if publication advances. A
  pinned overflow row may replace the lowest-priority non-mandatory unpinned
  candidate within the presentation cap without changing decision state. It
  cannot evict serving/selected/leader evidence; a capacity-blocked pin remains
  rail-only with an explicit reason.
- Clicking empty scene space returns the lower metrics to current serving.
- A compact “回到目前連線” action clears the pin.
- Timeline play/pause and scene orbit remain independent of the selection
  policy. Inspection must not alter the decision.

## 11. Pacing, cadence, and time semantics

The following controls are deliberately separate:

| Control | Owner | Meaning and status |
|---|---|---|
| `H` | canonical forecast window | Chosen `7 x 2.5 s = 17.5 s` horizon pending measurement; not a hopping frame/period. |
| `dt` / `forecastSampleStepSec` | canonical forecast input | Chosen `2.5 s` sample step pending measurement; it determines samples inside `H`. |
| `forecastRefreshCadenceSec` | opportunity producer | How often a same-source full forecast is requested or revalidated; separate from `dt`, value TBD. |
| `ForecastExecutionBudget` | forecast executor | Cache/compute limits such as max entries, max computations per refresh, and max concurrency; separate from `dt` and refresh cadence, values TBD. |
| `acceptedSnapshotCadence` | snapshot publisher | One publication per authoritative decision step that changes source frame, phase, role, metric evidence, counts, or config; immediate synchronous publication at commit. It is not render FPS. |

The default hopping semantics are also explicit: the `7-cell` layout/index
assignment does not rotate, while its `K < N` illuminated window may advance at
`hopSlotSec`. A `19-cell` schedule has period 19, not 7. Neither temporal slot
advance nor any cadence may relabel the chosen horizon as a complete hopping
frame.

Forecast cache keys include source-frame bucket/sequence, candidate key,
`H`, `forecastSampleStepSec`, canonical input/model hashes, and
`policyConfigHash`. When the execution budget is exhausted, forecast status is
`unavailable` with a reason; it is not zero and does not remove a hard-eligible
wireframe. A policy-hash change clears these caches atomically as specified in
section 0.6.

Candidate evaluation must remain visible long enough to understand. The
presentation controller may reduce playback speed, but it may not change
simulation timestamps, `dt`, forecast refresh cadence, policy thresholds, TTT,
selection hold, guard, or accepted-snapshot cadence. Wall-clock animation time
never advances scientific decision timers, and a legacy scalar playback
throttle never drives the rail.

At high playback speed, retain phase changes and the commit receipt in wall
clock time so they are readable. A phase, leader, metric, or commit change
updates the scene overlay and rail only through the same accepted snapshot.
Only continuous geometry may interpolate between accepted snapshots; semantic
fields remain exact and the allowed scene/rail skew remains `0 ms`.

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
rather than silently reusing an indistinguishable colour. The accepted identity
then carries `colorMayRepeat = true` plus a stable
`satellitePatternToken`; scene badges, rail swatches, and receipts use the same
pattern. Existing assignments remain reserved through guard and receipt.

Tests use fixed satellite-set fixtures to prove no collision within the normal
display budget, deterministic replay, no recolour on rank/commit/pin, at least
3:1 non-text contrast against the rail/scene backgrounds, and distinguishable
output under the project's supported colour-vision simulations. Beam shade
fixtures additionally prove that all shades remain recognizable as one hue and
that labels/patterns still distinguish them without colour.
Overflow fixtures additionally prove that a repeated hue sets
`colorMayRepeat`, receives a unique stable pattern/ID cue, and is not recoloured
when pinned into the bounded scene.

## 13. Migration plan

The capability labels below are not a mandate to delay the owner-visible
carrier repair until Forecast EE is calibrated. After the implementation gate
passes, delivery proceeds in three dependency-safe waves:

1. **Compatibility-visible wave:** finish the S0/S1 contracts and the
   compatibility portions of S3/S4/S5. Publish the shared snapshot, restore the
   established carrier, show several real satellite-beam candidates, and make
   the rail/scene join truthful under `SINR 相容模式`. Candidate EE remains
   unavailable; no placeholder EE is invented.
2. **Validation-only EE wave:** implement S2 behind
   `forecast-ee-validation`, expose matched candidate forecasts only with
   complete provenance, and keep them excluded from active ranking, TTT,
   selection, and commit. This work can proceed in parallel with browser polish
   once the shared contracts are frozen.
3. **Activation wave:** freeze calibration/profile evidence, pass the default
   activation gate, then switch the active objective and hard-gate profile to
   Forecast EE. S6 and owner visual acceptance still determine completion.

This sequencing makes the central scene an additive improvement immediately
without misrepresenting an unfinished EE evaluator as decision authority.

### S0 — Contract fixtures

- Add typed candidate, decision, receipt, and presentation-plan contracts.
- Add fixtures with at least two satellites and several beams per satellite.
- Define a typed cell-to-beam provenance adapter if required.

### S1 — Opportunity producer and SINR parity

- Preserve all measured alternatives in `sinrLiveCellModel`.
- Add `CandidateOpportunityProducer` with current SINR policy data.
- Prove the compatibility-selected target matches the existing manager on a
  fixed regression fixture before changing visible behavior.
- Type the one-time route-entry assignment as `bootstrap-serving-seed`; prove
  it emits no fabricated initial-attach receipt and cannot continue selecting
  primary-UE targets after the shared engine takes authority.

### S2 — Counterfactual EE

- Export and test shared geodetic-to-ECEF / local-ENU projection helpers with
  explicit model IDs; the forecast provider must not copy private conversion
  formulas or consume render-world positions.
- Implement the data-only Walker forecast frame with absolute UTC time,
  frozen per-UE motion ownership, satellite `OrbitPoint`/topocentric geometry,
  finite beam-axis provenance, and geometry/scenario hashes.
- Implement equal-horizon EE evidence using the canonical numerator,
  denominator, units, load, interference, and power path.
- Implement and fixture `buildWalkerCanonicalForecastSamples`: every matched
  sample exposes full `CanonicalEeInput` baseline/candidate values plus
  `ueIdsByIndex` and `beamKeysByIndex`; both inputs contain the complete
  serving/candidate ownership and integer reuse-colour vectors, share one
  horizon, and differ only by the declared assignment, affected active/load
  state, and switch-event indicators before canonical derived recomputation.
- Resolve `E_switch` from canonical `switchEnergyJ`; label `0 J` only as a
  biased diagnostic; validate zero baseline indicators and exactly one binary
  target indicator at the first candidate sample under the policy-hashed
  `target-once-at-horizon-start` convention. The builder constructs this
  witness; `canonicalForecastEeEvaluator` is the final rejection owner.
- Re-encode a zero/non-finite baseline EE as non-valid comparison evidence and
  require finite `relativeDelta` in every Forecast-EE rank/trigger admission;
  add an explicit fail-closed fixture so the current valid-with-null encoding
  cannot survive migration.
- Cache by source-frame bucket, candidate pair, horizon/sample step, model, and
  policy hash; keep refresh cadence and cache/compute budget separate from the
  horizon sample step and do not run a full counterfactual at render rate.
- Add missing-data and provenance gates.

### S3 — Unified decision engine

- Add independent candidate timers and stable-set ranking.
- Remove inter-first/intra-display-only orchestration.
- Exercise the true post-bootstrap `serving = null` path with non-zero initial
  compatibility TTT/hold, and keep it distinct from immediate
  service-continuity protection.
- Add `SinrOffsetPolicy` and `ForecastEePolicy` adapters.
- Keep hard-eligible, trigger-satisfied, TTT-stable, provisional-leader,
  and selected/commit states distinct; hard-eligible pairs remain renderable
  when EE evidence is incomplete or below threshold.
- Keep `ForecastEePolicy` frozen out of ranking/TTT/selection/commit until the
  activation gate passes.
- Emit one post-transaction commit receipt and compatibility scalar
  projections. Raw engine intent remains private; an ordinary transaction
  failure restores the old sole service, while a failed continuity attempt
  after source loss produces truthful detachment.

### S4 — Publisher and right rail

- Before changing an S4/S5 seam, make
  `validate-frontend-scene-lane-governance.ts` pass on the current baseline:
  repair its stale serving-footprint and active-toast needles plus the earlier
  unrelated timeline-descriptor abort, while preserving every other lane rule.
  Record the green baseline; do not delete or weaken these assertions.
- Make `useSimStatePublisher` synchronously build one immutable
  `AcceptedHandoverPresentationSnapshot`, then publish that same reference as
  `SimState.acceptedHandoverPresentation`; App passes that one committed object
  to scene and rail with `acceptedSnapshotSkewMs = 0`.
- When the publisher is disabled, the lane is not live Walker, or no decision
  frame exists, return a null session and publish
  `SimState.acceptedHandoverPresentation = null`; no consumer may retain or
  fabricate a stale snapshot from a prior live frame.
- Build the plan only at the publisher. Remove scene/rail calls to
  `useHomepageCandidatePresentationPlan`; retire consumer-specific identity
  leases/skew from `candidatePresentationIdentityStore` or move allocation
  ownership behind the publisher.
- Bypass the legacy one-second scalar/teaching throttle for accepted source,
  config, phase, role, metric, leader, selection, and commit publications.
- Replace the Walker upper `DuelCard` with
  `HandoverEvaluationPanel`/`CandidateSetPanel`.
- Expand the role grammar before browser fixtures: every bounded hard-eligible
  pair receives its wireframe even when its active trigger is not satisfied,
  and one publisher-owned `displayKey` formatter supplies identical `SAT / B /
  C` text to scene and rail.
- Keep lower formula sections and make pinning inspection-only. Show separate
  observed/hard-eligible/active-trigger/TTT-stable/displayed counts, name the
  trigger objective, and show complete objective-rank/stable-rank/EE/delta/TTT/
  remaining-time/failed-gate row fields.

### S5 — Scene presentation

- Generalize the single candidate cone resolver to consume the presentation
  plan.
- Add identity hue allocation and same-satellite beam shades.
- Add role line/fill grammar and one-solid-link enforcement.
- Restore the established Walker serving/event carrier and add the bounded
  `3x2 + 1` candidate presentation; do not suppress the carrier because a
  decision frame exists.
- Emit a snapshot-keyed scene render receipt for actual pair mapping, unmapped
  reasons, event-cue count, and global solid-link count; use it to fail unsafe
  additive mapping and to gate optional replacement decorations, never to hide
  the established serving/event carrier.
- Keep automatic candidate camera refit disabled, retain opaque satellite GLBs,
  and apply the shared collision-resolved `SAT / B / C` label formatter.

### S6 — Browser, performance, and human acceptance

- Validate on the existing port 3000 only.
- Capture 1920 × 1080, 1440 × 900, 1366 × 768, and 390 px-wide evidence for
  inter and intra events.
- Run the two-hour candidate-count instrumentation sweep.
- Obtain human confirmation that the evaluation, leader hold, and atomic switch
  are understandable without reading every detail row.
- Owner visual acceptance is the acceptance authority; automation,
  screenshots, cross-model review, and Opus review remain advisory evidence.

## 14. File-level implementation map

Likely seams; final names may vary while preserving ownership:

| Concern | Current seam | Intended change |
|---|---|---|
| Candidate measurement | `src/scene/sinrLiveCellModel.ts`, `src/engine/handover/candidateOpportunityProducer.ts` | populate primary-UE throughput/remaining-service evidence and attach canonical forecast evidence without truncating the scientific set |
| Pure Walker forecast frames | new `src/engine/handover/walkerForecastFrameProvider.ts` | derive immutable future Walker geometry/schedule frames from one anchor without advancing live runtime, timers, assignments, or playback state |
| Walker-to-canonical EE input | new `src/engine/handover/walkerCanonicalForecastBuilder.ts`, existing `canonicalForecastEeEvaluator.ts` | build full matched `CanonicalEeInput` samples with stable UE/beam index witnesses, policy hash, ownership/reuse vectors, and causal assignment/load/event deltas |
| Stateful decision | `src/engine/handover/handoverDecisionEngine.ts`, `handoverSelectionPolicy.ts` | keep hard eligibility, EE trigger, TTT stability, leader, selection hold, and atomic commit distinct; retain SINR compatibility until activation |
| Runtime contracts | `src/engine/handover/candidateDecisionContract.ts`, `candidatePresentationPlan.ts` | add policy provenance and the full role/count/rank fields; keep scientific candidates separate from the bounded projection |
| Publishing | new `src/scene/acceptedHandoverPresentationSnapshot.ts`, `src/scene/useSimStatePublisher.ts` | build and accept one snapshot once; publish that same instance to scene and rail, while legacy scalars remain compatibility projections only |
| Right rail | `src/ui/signal-tuning/WalkerResultsRail.tsx`, `src/ui/handover-evaluation/HandoverEvaluationPanel.tsx`, `CandidateSetPanel.tsx` | consume the accepted snapshot directly; replace only the Walker upper decision board and retain the lower calculation sections |
| Scene | `src/scene/MainScene.tsx`, `src/viz/MultiCandidateBeamScene.tsx` | keep `SinrLiveCellBeamCones`, `SinrLiveCellFootprintRings`, callouts, particles, and event cues as the established carrier; render candidate-only overlays from the accepted snapshot |
| Identity colour and labels | `src/constants/handoverVisualIdentity.ts`, candidate scene/rail components | share satellite hue, beam shade, and one `SAT / B / C` formatter; do not recolour satellite GLBs or encode rank by colour |
| Render budget | `src/engine/handover/candidatePresentationPlan.ts`, `src/viz/MultiCandidateBeamScene.tsx` | enforce three satellite groups, two candidate beams per group, one serving beam, and seven total presentation cone volumes without truncating scientific timers/ranks |
| Interaction join | `candidateInspectionSelection.ts`, scene/rail components | share hover/pin by snapshot identity and candidate key; interaction changes inspection/presentation only |
| Browser evidence | `scripts/validate-homepage-authority-browser.ts` and targeted fixtures | assert multi-hard-eligible scene/rail joins, zero semantic skew, one-or-zero solid-link invariant, fixed camera, label obstruction, and readable phase progression on port 3000 |

The runtime-contract migration is atomic at the validator boundary; old and new
meanings are not simultaneously authoritative:

| Current compatibility field | Target field(s) | Migration rule |
|---|---|---|
| `HandoverDecisionFrame.mode` | `policyMode`, `activeTriggerObjective`, `activeHardGateProfile`, `eeActivationStatus` | Populate and validate the exact section 5.3 mapping in one change; derive any temporary `mode` projection from those fields. |
| `CandidateDecisionState.rank` plus `stable` | `objectiveRank`, `stableRank`, `tttStable` | Remove the old invariant that a non-stable candidate cannot have a rank; objective rank may exist before TTT, while stable rank is null until TTT completes. |
| policy-adapter-only trigger boolean | `activeTriggerEvidence` plus `triggerStatus` | Publish measured value, threshold, unit, source/config identity, supporting gates, and reason for the active objective; validation-only EE never fills compatibility trigger evidence. |
| optional `epochToken` | mandatory non-empty `epochToken` | Reject publication without epoch identity; no empty/default token is synthesized. |
| serving pair with implicit provenance | `serving` plus `servingOrigin` | Enforce `(serving === null) === (servingOrigin === null)` and type bootstrap, initial attach, normal handover, and continuity commits separately. |

`candidateDecisionContract` validators, engine fixtures, publisher fixtures, and
`HandoverEvaluationPanel` labels move together. A transitional frame that
satisfies the old single-rank rule but omits the new authority/provenance fields
is invalid, not a compatibility fallback.

Do not migrate the archived-TLE route as a side effect. Do not globally change
`DuelCard` for consumers that still have a truthful two-link comparison.

## 15. Validation and acceptance

### 15.1 Scientific truth

- Every displayed candidate row and scene object joins to a same-frame measured
  opportunity by primary UE, satellite, beam, source-frame, epoch, model, and
  `policyConfigHash` identity.
- Candidate geometry, SINR, throughput, remaining-service prediction, and EE
  use the primary UE's actual position, not a cell-centre substitute.
- Forecast times are one absolute UTC-millisecond axis tied to numeric
  `epochUtcMs`; satellite propagation and all UE motion-owner paths replay
  deterministically without mutating live state.
- Forecast provenance names the WGS84 orbit/topocentric, spherical-6371
  beam/link, and flat-111.32 local-projection models and rejects missing or
  non-finite satellite ECEF, UE ECEF, beam axis, ownership, reuse, assignment,
  load, or schedule state.
- Observed, hard-eligible, active-trigger-satisfied, TTT-stable, and displayed
  counts remain distinct; geometry sub-stages remain inspectable.
- Candidate EE uses the canonical ratio-of-sums over the chosen `H = 7 x
  2.5 s = 17.5 s` horizon pending measurement, never calling it a full
  hopping frame or period, and exposes numerator, denominator, horizon, units,
  source-frame sequence, and provenance.
- Missing EE is unavailable, never zero and never copied from the serving link.
- `buildWalkerCanonicalForecastSamples` proves that baseline and candidate
  carry the same complete serving/candidate beam index, satellite ownership,
  integer reuse-colour, future-geometry, and physical-config vectors, share one
  horizon, and differ only in the declared primary-UE assignment, affected
  active/load state, and switch-event indicators before interference, rate,
  and system-power recomputation.
- `Rmin` is the primary UE's per-UE predicted rate under candidate load, and
  the effective SINR floor is `max(profile floor, derived gamma_req)`;
  changing related inputs forces recomputation.
- `E_switch` resolves to canonical `switchEnergyJ`; the matched baseline has no
  indicator and the candidate has exactly one binary target-beam indicator at
  the first sample. `0 J` is only a labelled biased diagnostic and never
  activation or savings evidence.
- The Walker sample builder constructs that switch-event witness, while
  `canonicalForecastEeEvaluator` remains the final authority that rejects a
  missing, duplicate, misplaced, or non-binary witness. Builder output alone is
  never treated as proof of the exactly-once invariant.
- A non-finite or non-positive baseline EE cannot produce valid/rankable
  comparison evidence. Every valid comparison has finite candidate EE and a
  finite `relativeDelta = candidateEE / baselineEE - 1`.
- Every cache, provenance record, and accepted snapshot carries the policy
  config hash; a policy change atomically clears cache and resets TTT,
  selection hold, guard, and episode state.
- Canonical Python fixtures prove TypeScript parity, unequal-duration
  ratio-of-sums, zero-activity `0/0 -> 0`, and positive-throughput/zero-power
  fail-closed behavior before EE policy activation.
- Geometry, SINR (`SINR >= SINRmin`), per-UE throughput (`Rmin`), and
  remaining-service (`TTT + selection hold + guard + H`) gates are independently
  testable with their profile values and provenance.
- Presentation cone angles cannot qualify a scientific candidate.
- Default hopping semantics use a non-rotating `7-cell` layout/index assignment
  whose `K < N` illuminated window may still advance per slot; a `19-cell`
  schedule has period 19, not 7. Horizon sample step, forecast refresh cadence,
  and cache/compute budget are separately recorded.
- Walker and archived-TLE sources remain separated.

### 15.2 Decision behavior

- A fixture with at least two hard-eligible satellites and two beams per
  satellite exposes all pairs before selection; if at least two are
  hard-eligible, at least two matching scene wireframes and rail rows are
  asserted in one accepted snapshot.
- Each hard-eligible pair owns an independent state; only its own continuous
  `trigger-satisfied` interval under the accepted `activeTriggerObjective`
  advances its TTT clock. Validation-only EE never advances compatibility TTT.
- Every candidate's `activeTriggerEvidence` exactly matches the frame's active
  objective, policy mode, status, `sourceFrameId`, and `policyConfigHash`, and
  exposes its measured value, threshold, comparator, unit, supporting gates,
  and typed reason. A validation-only Forecast-EE value cannot masquerade as
  compatibility-trigger evidence.
- A provisional-leader change does not reset another pair whose hard eligibility
  and EE trigger remain satisfied.
- A true engine-owned initial attach is represented without a fabricated
  serving link and is tested with non-zero compatibility `initialTttSec` plus
  non-zero `selectionHoldSec` before its commit receipt.
- The retained legacy route-entry seed is separately typed
  `bootstrap-serving-seed`, produces no fabricated initial-attach receipt, and
  cannot remain a later target-selection authority.
- Candidate failure resets only that pair; candidate replacement, seek, loop
  wrap, epoch/date change, constellation change, and source change have explicit
  deterministic timer/forecast behavior.
- A policy-config hash change is a hard discontinuity: caches are cleared and
  TTT, selection hold, guard, and episode state reset atomically.
- Off-slot or hopping-cap-excluded beams cannot become service targets unless
  an explicit scheduling action and capacity proof are introduced.
- Same-satellite and cross-satellite targets pass through the exact same 5-stage
  lifecycle:
  $$\text{hard-eligible} \longrightarrow \text{trigger-satisfied}
  \longrightarrow \text{TTT-stable} \longrightarrow \text{provisional leader}
  \longrightarrow \text{selected/commit}$$
- After its activation gate, EE is the normal ranking objective; before that
  gate the compatibility SINR policy remains active. Any valid pre-activation
  candidate EE display is labelled `validation experiment` and excluded from
  ranking/TTT; incomplete evidence is not shown as zero. SINR remains a hard
  QoS floor in EE mode.
- Safety fallback events are distinctly labelled and reproducible: only a
  missing serving pair may enter the existing same-frame compatibility path,
  which uses elevation/steering/scheduled/SINR gates, highest SINR, stable key,
  and immediate post-transaction commit; it does not use EE/Rmin/remaining-
  service forecasts.
- Exactly one target commits and the configured post-commit guard prevents
  immediate reversal.

### 15.3 UI and scene consistency

- Every visible row and scene object uses the same satellite-beam key.
- Shared contract: Central 3D scene (`MainScene`) and right rail
  (`WalkerResultsRail` / `HandoverEvaluationPanel`) consume the same immutable
  `AcceptedHandoverPresentationSnapshot`; identity, phase, role, metrics,
  `sourceFrameId`, and `policyConfigHash` have zero divergence and
  `acceptedSnapshotSkewMs = 0`.
- When the publisher is disabled, the route is not live Walker, or no decision
  frame exists, it returns a null session, publishes a null accepted snapshot,
  and clears any stale accepted snapshot before another lane can render it.
- The rail separately displays observed, hard-eligible,
  active-trigger-satisfied, TTT-stable, and displayed counts, and names the
  active trigger objective.
- Every row, including overflow, displays objective EE rank, stable-set rank,
  forecast EE, relative baseline delta, independent TTT, remaining service
  time, and failed gate(s), with explicit unavailable values rather than zero.
- One satellite retains one identity hue before, during, and after commit, as well
  as in the receipt (顏色衛星恆定); its beams retain their lightness shades (同星波束階調).
- Current service, hard-eligible, trigger-satisfied, TTT-stable, provisional
  leader, selected, and committed roles remain distinguishable without colour.
- At no frame do two solid links imply simultaneous service. The count is `1`
  with an established serving pair, `0` only for detached/initial attach, and
  never greater than one.
- Candidate endpoints remain hollow measurement markers, have no active
  UE-to-target data path, and do not animate active throughput or power.
- Every hard-eligible pair has a corresponding wireframe scene object and rail
  row in the accepted snapshot unless it is a typed overflow row; a fixture
  with two hard-eligible pairs asserts at least two corresponding objects.
- Other beams of the serving satellite remain context unless their exact pair
  is the sole serving link.
- Intra events show the source and target beam IDs explicitly.
- The owner presentation target remains at most 3 satellite groups x 2
  candidate beams plus 1 serving beam; overflow is typed and reported as `+N`,
  while all scientific timers/ranks remain complete.
- Pinning/hovering triggers bi-directional cross-highlight between rail rows
  and 3D scene cones/footprints, affecting presentation only.
- The established Walker serving/event carrier remains visible and additive
  candidate layers do not replace it merely because a decision frame exists.
- The upper panel does not cover the central scene and the lower formula
  sections remain reachable.
- A pinned candidate either receives same-frame candidate-specific lower
  formula projections or an unavailable notice; serving values are never
  relabelled as candidate values.
- 1920 × 1080, 1440 × 900, 1366 × 768, and 390 px-wide layouts have no label
  overlap, central-scene obstruction, or duplicate nested scrollbar.

### 15.4 Performance and cadence

- Full candidate EE is not recomputed at 60 fps.
- The horizon sample step (`dt` / `forecastSampleStepSec`), forecast refresh
  cadence, and cache/compute budget are three separate documented controls;
  `2.5 s` is only the chosen sample step pending measurement.
- Candidate calculations are cached by source-frame/candidate/horizon/sample-
  step/model/policy-hash identity. Budget exhaustion is unavailable evidence,
  not zero and not a reason to remove a hard-eligible pair from scientific
  truth or bounded-presentation priority; excess pairs remain typed overflow.
- Accepted snapshots publish at the decision cadence and immediately at commit;
  only continuous geometry interpolates, and the scene/rail skew is zero.
- The default scene stays within three satellites and seven beam volumes
  (max 3 satellite groups $\times$ 2 candidate beams each + 1 serving beam).
- An executable renderer assertion enforces both `maxBeamSatellites = 3` and
  the presentation cap `maxConeVolumes = 7`.
- `prefers-reduced-motion` retains every decision distinction without pulses;
  FPS, HTML overlay count, and draw-call evidence are recorded for both event
  kinds.
- Browser acceptance records frame-rate evidence for both inter and intra
  episodes, not only a static first frame.

### 15.5 Required evidence and gating tiers

Governance is partitioned across four strict levels:

1. **Owner implementation authorization:** GRANTED on 2026-08-28. Authorizes
   constructing the multi-candidate multi-beam pipeline and UI exposure under
   `homepage-ee-handover-v1`; it does not authorize default activation.
2. **Fable max implementation gate:** `FABLE_MAX_IMPLEMENTATION_GATE: PASS` on
   2026-08-29. The fresh-context synthesis review found no remaining design
   MUST and authorizes implementation of this repaired contract. The existing
   scene-lane governance validator must first be restored to a green baseline
   before any S4/S5 seam change lands. This gate is independent from the
   still-blocked default-activation gate.
3. **Default activation gate:** BLOCKED. The public default activation of
   `ForecastEePolicy` on `/` must **NOT** be marked PASS until all required
   validation criteria are fully satisfied:
   - **Full counterfactual runtime evidence:** Complete matched counterfactual
     delivered bits and consumed Joules over the chosen `H = 7 x 2.5 s = 17.5 s`
     horizon, pending measured horizon/hopping semantics, with recalculated
     angles, load, interference, system power, and canonical `switchEnergyJ`;
     never copy serving instantaneous EE.
   - **TypeScript / Python canonical parity:** Canonical parity test suite
     proving identical numerical outcomes between TypeScript runtime and Python
     canonical reference across standard, edge, and zero-activity scenarios.
   - **Candidate-qualified window proofs:** Deterministic verification that
     hard-eligible candidate links satisfy elevation, steering, scheduled slot,
     effective SINR `max(profile floor, derived gamma_req)`, primary-UE
     candidate-load throughput `Rmin`, and
     `T_remaining = TTT + selection hold + guard + H`.
   - **Browser phase evidence across port 3000:** Playwright / browser test evidence
     verifying complete phase progression (`monitoring` $\to$ `evaluating` $\to$
     `qualifying / TTT` $\to$ `selection-hold` $\to$ `switching` $\to$ `guard / receipt`),
     exactly one solid link throughout every established-serving phase (and
     zero only in a truthful detached/initial-attach snapshot), hover/pin
     cross-highlight, the hard-eligible `>=2` wireframe/row assertion, and
     synchronized accepted-snapshot state at 1920 × 1080 and shorter viewports.
   - **Policy reset and snapshot evidence:** the full policy control surface is
     hash-keyed; a change atomically clears cache and resets TTT, hold, guard,
     and episode state; scene/rail identity, phase, role, metrics, source frame,
     and config hash join with zero skew.
4. **Scientific and owner acceptance:** matched causal-control true 7200 s
   intra/inter canonical system-EE `relativeDelta` distributions must be
   complete before choosing `epsilon_EE` or `tieToleranceRelative`; owner visual
   acceptance of the Walker
   carrier, `3x2 + 1` presentation, readability, and one-solid-link behavior is
   required. Automation, screenshots, cross-model review, and Opus review are
   evidence only and cannot substitute for either acceptance authority.

ADR-013 regression is part of the gate: `/` remains Walker-only, requests no
TLE payload, keeps 24-hour time selection, recomputes Walker state for
date/time/constellation changes, and is tested against the existing port 3000
without opening another dev server.

## 16. Stop conditions

Stop implementation and raise the issue rather than filling gaps when:

- the canonical EE numerator or power denominator cannot be identified;
- a pure Walker forecast cannot reproduce satellite ECEF and per-UE future
  geometry from one frozen accepted-frame anchor without reading render-world
  coordinates or mutating live runtime state;
- absolute UTC forecast time cannot be joined unambiguously to numeric
  `epochUtcMs`, or a UE's motion owner/state cannot be frozen and replayed;
- the active Earth/ENU/beam geometry models cannot be named and hashed, or a
  required reusable coordinate helper is unavailable;
- the candidate forecast cannot recompute affected load/interference;
- any accepted metric evidence lacks a non-empty authoritative opportunity
  `sourceFrameId`;
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
2. Which pairs are hard-eligible, which satisfy the explicitly named active
   trigger (Forecast EE only after activation), and why did the others fail or
   remain unavailable?
3. How long has each trigger-satisfied pair accumulated toward TTT stability,
   and which objective supplied that trigger?
4. Which globally ranked stable pair is the provisional leader, under what
   horizon, profile, and QoS gates?
5. Which pair became selected, and was the final choice intra-satellite or
   inter-satellite?
6. At what exact accepted snapshot did the sole serving link actually change,
   with zero scene/rail skew?

If the interface merely shows several decorative beams around a target already
chosen by the engine, this SDD has not been implemented.
