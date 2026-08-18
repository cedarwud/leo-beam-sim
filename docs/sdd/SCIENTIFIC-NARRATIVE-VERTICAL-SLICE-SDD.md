# Scientific causal narrative and Figure Mode vertical-slice SDD

Status: **Strengthened design; fixture-freeze gate remains open; implementation
has not started**

Date: 2026-08-14

Authority:
`docs/decisions/ADR-007-scientific-experience-and-figure-mode.md`

Scientific/runtime authorities:

1. `docs/decisions/ADR-005-tle-and-canonical-ee-simulator-contract.md`
2. `/home/u24/papers/modqn-paper-reproduction/docs/ADR-003-canonical-ee-closure.md`
3. `docs/decisions/ADR-006-tle-canonical-handover-trace.md`, when a completed
   handover trace is presented

## 1. Objective

Build one isolated, source-backed explanatory experience that makes this
causal statement visible and testable:

> A TLE-derived satellite state evaluated against the fixed, uncalibrated
> UE/beam mapping produces an off-axis angle; that angle enters the raw channel
> gain through the transmit gain `G^T(theta)`; the canonical power closure then
> produces actual RF power, SINR, throughput, consumed power, and energy
> efficiency in one immutable frame.

Here, TLE owns the selected satellite geometry. The UE/cell side is the fixed,
uncalibrated seven-cell/100-UE mapping declared by ADR-005. The cutaway does not
claim a geodetically calibrated UE path or physical beam footprint.

The slice must demonstrate that the centre scene, formula term, parameter, and
result are views of the same evidence rather than adjacent widgets. It must
also preserve and compare accepted reference/probe states so a novice can see
what changed, which downstream values changed or remained stable, and why.

The required experience contains three source-backed stories:

1. an angle-response probe using the same geometry and link under two declared
   full-HPBW values of the runtime field `SimulatorParameters.theta3dbRad`,
   which represents the thesis symbol `theta_3dB`;
2. a service-target stress probe that changes only the declared per-user
   minimum transmission-rate target from 1 to 10 Mbit/s and keeps every RF-cap
   check non-binding; and
3. one real ADR-006 serving-satellite change with before/decision/after frames.

The first outputs are a direct-only interactive route plus three deterministic
thesis-style explanatory figure drafts. They are method and mechanism
artifacts, not calibrated empirical or Chapter 5 evidence. This is not a
homepage redesign, a video-production system, or an energy-saving experiment.

## 2. Scope

### 2.1 Included

- direct-only route `/explain`;
- accepted canonical runs and frames for one reference state, two controlled
  reference/probe pairs, and one trace-backed serving change;
- one pair-stable representative serving link chosen for each controlled
  fixture, plus the before/after serving identities of the handover fixture;
- orbital, service-area, link-geometry, and causal-accounting views;
- Explore, Guided, and Figure modes over the same evidence;
- scene/formula/value three-way highlighting and edge-wise delta propagation;
- two controlled canonical parameter probes with reference reset;
- one mandatory real serving-change story;
- authored Traditional-Chinese novice narration;
- deterministic script time, camera shots, overlays, prediction pauses, and
  reveal steps;
- quantitative scene-linked angle, gain, power/cap, throughput, and EE
  encodings with fixed comparison scales;
- separate method-chain, controlled-comparison, and serving-change-event figure
  drafts;
- source, transformation, presentation, accessibility, and capture records;
  and
- focused unit, integration, browser, and visual checks.

### 2.2 Excluded

- changing `/`, `/simulator`, their navigation, or their scientific logic;
- creating another SINR, Power, Throughput, or EE calculator;
- changing the canonical formulas or symbol meanings;
- changing TLE resolution, SGP4 propagation, pass planning, or handover policy;
- inventing beam footprints, missing interference, handover events, or KPIs;
- energy-policy baseline/candidate comparison; the controlled reference/probe
  model demonstrations remain in scope;
- Phase-1 platform mapping, upload, query-back, or dashboard claims;
- publisher-specific journal formatting;
- a general video editor, figure editor, or animation timeline; and
- new dependencies unless an implementation gap is demonstrated first.

## 3. Evidence and presentation state

### 3.1 Evidence state

The route consumes existing immutable objects. It does not copy their formulas
into a page model.

```ts
interface CoordinateFrameDisclosure {
  readonly orbitalFrame: 'TEME-to-Earth-fixed-to-NTPU-topocentric-ENU';
  readonly orbitalFields: readonly ['azimuthDeg', 'elevationDeg', 'rangeKm'];
  readonly localFrame: 'uncalibrated-seven-cell-link-plane';
  readonly localFields: readonly ['distanceKm', 'elevationDeg'];
  readonly derivedLinkGeometryFields: readonly ['thetaRad'];
  readonly azimuthTreatment: 'omitted-and-rendered-on-fixed-local-axis';
  readonly matchCut: {
    readonly preserves: readonly ['instantUtc', 'satelliteId', 'frameId'];
    readonly visualTransform: 'recenter-and-reorient';
    readonly geographicMetricContinuity: false;
  };
}

type CandidateComparisonRole = {
  readonly role: 'single-link-comparison';
  readonly activeBeamOwnership: false;
  readonly contributesToServingInterference: false;
} & (
  | {
      readonly status: 'available';
      readonly satelliteId: string;
      readonly beamId: number;
      readonly userIndex: number;
      readonly userId: string;
      readonly candidateIdentityMatch: true;
    }
  | {
      readonly status: 'unavailable';
      readonly satelliteId: string | null;
      readonly candidateIdentityMatch: null;
      readonly reason: string;
    }
);

interface SceneCompositionDisclosure {
  readonly serviceSatelliteId: string;
  readonly activeServiceBeamIds: readonly number[];
  readonly activeSatelliteOwnerIds: readonly [string];
  readonly activeSatelliteOwnerCount: 1;
  readonly activeBeamCount: 7;
  readonly multiSatelliteActiveBeamClaim: 'not-claimed';
  readonly candidateBeamMode: 'none' | 'counterfactual-display-only';
  readonly candidateComparison: CandidateComparisonRole;
  readonly contextSatelliteIds: readonly string[];
  readonly contextSelectionRuleId: string;
  readonly beamOwnershipSource: 'frame.scenario.beamSatelliteB';
  readonly contextBeamCount: 0;
  readonly footprintClaim: 'uncalibrated-scenario-substrate';
}

interface ExplanatoryEvidence {
  readonly run: TleAnalysisRun;
  readonly anchorIndex: number;
  readonly frame: SimulationAnalysisFrame;
  readonly nextFrame: SimulationAnalysisFrame | null;
  readonly representativeLink: {
    readonly satelliteId: string;
    readonly beamId: number;
    readonly userIndex: number;
    readonly userId: string;
  };
  readonly handoverAnchor: CanonicalTleHandoverAnchorTrace | null;
  readonly coordinateFrames: CoordinateFrameDisclosure;
  readonly sceneComposition: SceneCompositionDisclosure;
}

type CausalProbeId = 'angle-response-v1' | 'service-target-stress-v1';

interface AcceptedProbeState {
  readonly run: TleAnalysisRun;
  readonly frame: SimulationAnalysisFrame;
  readonly parameters: SimulatorParameters;
}

interface CanonicalTermDelta {
  readonly term: CanonicalTermKey;
  readonly unit: string;
  readonly referenceValue: number;
  readonly probeValue: number;
  readonly signedDelta: number;
  /** Dimensionless presentation-only `(probe-reference)/abs(reference)`. */
  readonly relativeDeltaRatio: number | null;
  readonly direction: 'increase' | 'decrease' | 'unchanged';
}

interface CausalProbeEvidence {
  readonly fixtureId: string;
  readonly probeId: CausalProbeId;
  readonly invariant: {
    readonly constellation: 'oneweb' | 'starlink';
    readonly archiveId: string;
    readonly selectedTleSha256: string;
    readonly geometryRunId: string;
    readonly anchorIndex: number;
    readonly instantUtc: string;
    readonly satelliteId: string;
    readonly beamId: number;
    readonly userIndex: number;
    readonly userId: string;
  };
  readonly control: {
    readonly parameterKey: keyof SimulatorParameters;
    readonly unit: string;
    readonly referenceValue: number;
    readonly probeValue: number;
  };
  readonly reference: AcceptedProbeState;
  readonly probe: AcceptedProbeState;
  readonly deltas: readonly CanonicalTermDelta[];
  readonly expectedObservations: readonly ExpectedTeachingObservation[];
}

interface CanonicalTleServingChangeEvidenceBase {
  readonly eventId: string;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly traceDigest: string;
  readonly sourceEvent: 'inter-handover' | 'forced-continuity';
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
  readonly targetSelection: {
    readonly selectionKind: 'pass-plan';
    readonly passId: string;
    readonly satelliteId: string;
    readonly sourceLocator: string;
  };
  readonly triggerAnchorIndex: number;
  readonly triggerInstantUtc: string;
  readonly preCommit: {
    readonly servingSatelliteId: string;
    readonly candidateSatelliteId: string;
    readonly servingVisible: boolean;
    readonly candidateVisible: boolean;
    readonly servingSinrDb: number | null;
    readonly candidateSinrDb: number | null;
    readonly deltaDb: number | null;
  };
  readonly postCommit: {
    readonly servingSatelliteId: string;
    readonly anchorIndex: number;
    readonly instantUtc: string;
  };
  readonly reason: string;
}

type CanonicalTleServingChangeEvidence =
  | (CanonicalTleServingChangeEvidenceBase & {
      readonly sourceEvent: 'inter-handover';
      readonly decision: {
        readonly offsetDb: number;
        readonly tttSec: number;
      };
      readonly qualificationAnchors: readonly {
        readonly anchorIndex: number;
        readonly instantUtc: string;
        readonly servingSatelliteId: string;
        readonly candidateSatelliteId: string;
        readonly deltaDb: number;
        readonly progressSec: number;
        readonly conditionMet: true;
      }[];
    })
  | (CanonicalTleServingChangeEvidenceBase & {
      readonly sourceEvent: 'forced-continuity';
      readonly qualificationAnchors: readonly [];
      readonly continuity: {
        readonly servingVisible: false;
        readonly targetVisible: true;
        readonly targetSatelliteId: string;
        readonly reasonCode: 'serving-lost-visibility';
        readonly reason: string;
      };
    });

type ServingChangeKind =
  | { readonly eventKind: 'offset-ttt'; readonly sourceEvent: 'inter-handover' }
  | { readonly eventKind: 'forced-continuity'; readonly sourceEvent: 'forced-continuity' };

interface ServingChangeStoryEvidenceBase {
  readonly fixtureId: string;
  readonly run: TleAnalysisRun;
  readonly before: ExplanatoryEvidence;
  readonly decision: ExplanatoryEvidence;
  readonly after: ExplanatoryEvidence;
}

type ServingChangeStoryEvidence =
  | (ServingChangeStoryEvidenceBase & {
      readonly eventKind: 'offset-ttt';
      readonly sourceEvent: 'inter-handover';
      readonly sourceEventEvidence: Extract<
        CanonicalTleServingChangeEvidence,
        { readonly sourceEvent: 'inter-handover' }
      >;
    })
  | (ServingChangeStoryEvidenceBase & {
      readonly eventKind: 'forced-continuity';
      readonly sourceEvent: 'forced-continuity';
      readonly sourceEventEvidence: Extract<
        CanonicalTleServingChangeEvidence,
        { readonly sourceEvent: 'forced-continuity' }
      >;
    });

interface ScientificStoryEvidence {
  readonly methodState: ExplanatoryEvidence;
  readonly angleResponse: CausalProbeEvidence;
  readonly serviceTargetStress: CausalProbeEvidence;
  readonly servingChange: ServingChangeStoryEvidence;
}
```

The exact TypeScript names may follow the current module vocabulary, but these
ownership rules are fixed:

- `run` owns source selection, TLE geometry, parameters, evaluation, and the
  optional handover trace for an arbitrary method/explore state; the frozen
  `ScientificStoryEvidence.servingChange` member is mandatory for this slice;
- `frame` owns all per-anchor scientific values;
- the representative link is an identity selection over `scenario.users`,
  `servingBeamU`, `thetaRadUb`, and the canonical rate arrays, not a new
  calculation and not an assumption that `frame.links` enumerates every UE;
- `nextFrame` is available only for already-completed visual interpolation;
- each reference/probe member is a separately accepted canonical result;
- a term delta is a unit-preserving presentation transform over those two
  values, not a replacement scientific calculation;
- the reference/probe invariant rejects publication when source time, geometry
  run, representative identity, or any undeclared parameter differs;
- the handover frames and event identity come from one completed immutable
  ADR-006 trace; and
- unavailable source values remain unavailable.

The event producer captures `preCommit` before serving-state mutation. Within
one immutable analysis run, the identifier is exactly:

```text
eventId = "tle-event-v1-" + stableHash(canonicalJson({
  analysisRunId, sourceEvent, triggerAnchorIndex,
  fromSatelliteId, toSatelliteId
}))
```

It is never derived from event-array position, a counter, wall-clock time, or
randomness. The fixture validates these identity equalities:

```text
fromSatelliteId === preCommit.servingSatelliteId
toSatelliteId === preCommit.candidateSatelliteId
toSatelliteId === postCommit.servingSatelliteId
```

For `inter-handover`,
the qualification bundle must be contiguous, name the same candidate at every
anchor, retain the same pre-commit serving identity, and satisfy the frozen
offset/TTT decision: every `deltaDb >= decision.offsetDb`, `progressSec` follows
the contiguous decision-axis spacing, the final `progressSec >= decision.tttSec`,
and the final anchor equals `triggerAnchorIndex`. For
`forced-continuity`, `continuity.targetSatelliteId` must also equal
`preCommit.candidateSatelliteId`. The `targetSelection.sourceLocator` must
resolve by `passId` to a real pass in `run.passPlan`, and
`targetSelection.satelliteId` must equal `toSatelliteId`. For that event,
the evidence must instead prove `servingVisible=false`, `targetVisible=true`,
the matching `preCommit.servingVisible=false` and
`preCommit.candidateVisible=true`, and the source-backed continuity reason. A display-only
`visible-geometry-fallback` target is permitted in Explore but cannot produce a
serving-change fixture or event figure.

The resolver validates that all selected identities belong to the same
accepted run and currently selected frame before publishing the evidence
object. `nextFrame` is the adjacent completed frame and is excluded from
quantitative labels and Figure Mode.

The controlled probes may have different `analysisRunId` values because model
parameters differ, but they must share `geometryRunId` and every invariant
above. Rebuilding a probe may also rebuild the handover trace; the fixture is
accepted only when the selected satellite, beam, and UE remain identical at
the comparison anchor. It never compares values from different serving links
while describing a single-parameter effect.

### 3.1.1 Fixture discovery and freeze gate

No probe value, event, or expected delta is presumed by this SDD. A read-only
fixture-discovery pass must produce and review a source-backed ledger before
implementation starts:

```ts
interface ScientificFixtureLedgerEntry {
  readonly fixtureId: string;
  readonly purpose: 'method' | CausalProbeId | 'handover';
  readonly sourceSelection: LoadedTleSnapshotSelection;
  readonly geometryRunId: string;
  readonly memberRunIds: readonly string[];
  readonly memberFrameIds: readonly string[];
  readonly anchorIndices: readonly number[];
  readonly parameterDigests: readonly string[];
  readonly declaredControl: CausalProbeEvidence['control'] | null;
  readonly capToleranceW: number | null;
  readonly invariantChecks: Readonly<Record<string, boolean>>;
  readonly observedTerms: readonly CanonicalTermDelta[];
  readonly handoverEventId: string | null;
  readonly handoverEventKind: 'offset-ttt' | 'forced-continuity' | null;
  readonly formatterResolutionChecks: Readonly<Record<string, boolean>>;
  readonly pixelSeparationChecks: Readonly<Record<string, boolean>>;
  readonly visualTransformChecks: Readonly<Record<string, boolean>>;
  readonly acceptedBy: string;
  readonly acceptedAtUtc: string;
}
```

Fixture discovery must use `TleAnalysisRun.withParameters`, which preserves
the source selection, geometry run, and pass plan but intentionally rebuilds
the parameter-dependent handover trace, anchor selection, canonical frames,
and run evaluation. Consequently:

- `analysisRunId` and `frameId` are expected to differ between pair members;
- geometry equality is established by `geometryRunId`, TLE identity, instant,
  TLE state, and scenario geometry rather than by run/frame ID;
- the selected serving satellite, beam, and UE must be asserted equal at the
  comparison anchor, not assumed;
- `EE_eval` may appear in the controlled-comparison argument only when the
  entire 241-anchor serving/candidate identity sequence also matches; otherwise
  it is explicitly excluded as a whole-run coupled response; and
- a fixture whose differences round to the same visible text at the declared
  formatter resolution is rejected rather than visually exaggerated.

For `angle-response-v1`, only `SimulatorParameters.theta3dbRad` changes. This
field is the full HPBW `theta_3dB`; the existing scenario adapter passes
`theta3dbRad / 2` to the canonical Bessel pattern as the one-sided half-power
angle. The fixture uses a non-zero `thetaRadUb[user][beam]`. It freezes the
actual observed values and assumes no universal direction because the Bessel
pattern and coupled interference need not be monotonic.

For `service-target-stress-v1`, only
`SimulatorParameters.minimumRateBps` changes. The reference member uses
ADR-003's primary `R_min = 1 Mbit/s` (`1_000_000` bit/s); the probe member uses
the separately permitted `R_min = 10 Mbit/s` (`10_000_000` bit/s) stress
diagnostic. No other control value may use this fixture ID. Geometry, load,
gain, RF caps, PA input parameters, and selected identity remain equal. For
every accepted comparison anchor, the fixture checks:

```text
for every b:
  pReqBW[b] < beamPowerCapW - capToleranceW
for every s:
  sum_{b: beamSatelliteB[b] = s} pDlBeforeSatelliteCapBW[b]
    < satellitePowerCapW - capToleranceW
satelliteScaleB.every(scale => scale === 1)
powerLimitedU.every(flag => flag === false)
```

The positive `capToleranceW` is recorded in the ledger. Thus the visible path begins at
`R_min -> gamma_req(U_b) -> p_req` rather than at a cap. Actual RF, realized
SINR/rate, total throughput, the power ledger, `P_sys`, and `EE_inst` are read
from the two accepted results; no universal direction is presumed. `EE_eval`
is absent unless the same cap gates and complete serving/candidate identity
sequence pass over every evaluation interval.

`beamPowerCapW` is intentionally excluded as a first-slice one-edge probe. In
the canonical authority it also derives the PA saturation reference `P_0`, so
changing it affects both the RF constraint and the PA-efficiency path. Explore
may still edit the field and the method-chain view must show both branches, but
neither may describe it as a pure clipping intervention or change the
scientific formula to simplify the explanation.

For the serving-change story, the ledger pins one completed non-initial serving
change and a valid after anchor. It records whether the immutable ADR-006 event
is offset-and-TTT or forced continuity. If no compatible event exists, the
implementation-start gate remains open; a candidate-only comparison cannot
close it.

The current `CanonicalTleHandoverAnchorTrace` is not yet sufficient to close
this gate: its event anchor stores the post-commit comparison, not the
pre-commit trigger sample, and it has no stable event ID or qualifying-anchor
bundle. Before fixture freeze, the runtime trace must expose the
`CanonicalTleServingChangeEvidence` record above without changing ADR-006's
decision policy. The decision panel reads that record; the committed frame is
used only for the after panel.

The current candidate summary is also insufficient for a same-link comparison:
its representative link is selected independently and does not expose a stable
`userIndex`/counterfactual role contract. Before fixture freeze, the canonical
result or canonical-owned selector must return the candidate result for the
already selected representative UE and beam, or return unavailable. A route
adapter may not repair this gap by recomputing the link formula locally.
The current candidate summary also carries a scenario-level EE value from its
independently built candidate scenario. The explanatory role may not relabel
that value as candidate-link EE or use it as aggregate system evidence; it is
unavailable in the candidate comparison until a canonical owner supplies the
declared quantity and scope.

### 3.1.2 Current-checkout feasibility observation, not a frozen fixture

A read-only diagnostic on 2026-08-14 used the existing canonical rebuild path
at the OneWeb state `2026-08-07T23:59:59Z`. At the inspected anchor, satellite
`49283`, beam `0`, UE `ue-15`, and off-axis angle `0.529 deg` remained identical
when only `minimumRateBps` changed from `1 Mbit/s` to `10 Mbit/s`:

| Canonical observation | 1 Mbit/s primary reference | 10 Mbit/s stress diagnostic |
|---|---:|---:|
| `gamma_req` | 0.06437 | 0.86607 |
| selected beam demand | 0.00826 W | 0.11120 W |
| total actual RF output | 0.0547 W | 0.7251 W |
| total throughput | 102.54 Mbit/s | 916.75 Mbit/s |
| `P_sys` | 6.603 W | 17.266 W |
| `EE_inst` | 15.53 Mbit/J | 53.09 Mbit/J |
| beam/satellite cap state | non-binding / scale 1 | non-binding / scale 1 |

This observation establishes feasibility of the proposed first-edge mechanism;
it does not close the fixture gate. The final ledger must still pin complete
TLE/source provenance, exact formatter and pixel floors, parameter digests,
all matched invariants, and the accepted output values. Whole-run `EE_eval`
remains excluded unless the complete serving/candidate identity sequence is
proved equal.

### 3.2 Presentation state

```ts
type ExperienceMode = 'explore' | 'guided' | 'figure';

interface ExplanationPresentationState {
  readonly mode: ExperienceMode;
  readonly scriptId: string;
  readonly beatId: string;
  readonly phaseId: string;
  readonly scriptTimeMs: number;
  readonly cameraShotId: string;
  readonly overlayKeys: readonly string[];
  readonly focusedTerm: CanonicalTermKey | null;
  readonly focusedEntity: SceneEntityKey | null;
  readonly transport: 'paused' | 'playing';
  readonly figureSpecId: string | null;
  readonly comparisonPhase: 'none' | 'reference' | 'prediction' | 'pending' | 'probe' | 'delta';
}
```

This state controls presentation only. A reducer produces it from explicit
commands so a test or capture driver can call `advanceTo(scriptTimeMs)` without
depending on wall-clock timers.

### 3.3 State-change rules

| User or script action | Evidence effect | Presentation effect |
|---|---|---|
| Scrub accepted time | Select an existing completed anchor | Move scene and linked labels |
| Focus a satellite, beam, UE, or term | None | Highlight all mapped views |
| Change camera or explanatory beat | None | Change shot, cutaway, and overlays |
| Start a frozen causal probe | Select its accepted reference member | Show the question and require a direction prediction |
| Reveal the probe member | Select its separately accepted canonical result | Use the same camera and fixed scales; show probe values |
| Reveal causal deltas | Read both accepted members | Trace every required causal edge and signed delta |
| Reset a probe | Re-select its accepted reference member | Restore reference values, scene encodings, and focus |
| Change an arbitrary canonical parameter in Explore | Build through the existing canonical rebuild path | Show pending; do not animate stale results |
| Complete parameter rebuild | Atomically publish the new result | Resolve the same identity mapping against the new frame |
| Rebuild failure | Keep the accepted evidence or explicit empty state according to the owning route contract | Show refusal and recovery; never present mixed states |
| Enter the serving-change story | Select its completed ADR-006 trace | Lock to before/decision/after trace anchors |
| Enter Figure Mode | Freeze one state, comparison pair, or serving-change triplet | Freeze shot, scales, labels, theme, and animation |

Guided mode must replay the two frozen parameter probes. It may load their
already accepted reference/probe results for deterministic teaching, but the
fixture-production gate must prove those results were produced through the same
canonical rebuild path. An arbitrary Explore edit remains pending until its
new accepted result is complete.

## 4. Runtime architecture

```text
accepted canonical runs and frames (offline generation lane)
  -> method-state resolver
  -> angle-response reference/probe resolver
  -> service-target stress reference/probe resolver
  -> ADR-006 before/decision/after resolver
                  |
                  v
        immutable ScientificStoryEvidence
                  |
                  v
      checked-in ScientificExplanationArtifact
                  |
       +----------+-----------+
       |          |           |
       v          v           v
  3D projection  term graph  values/deltas/plots
       |          |           |
       +----------+-----------+
                  |
        authored teaching-beat reducer
        Explore / Guided / Figure drivers
                  |
                  v
       deterministic three-figure exporter
```

No arrow above represents a page-specific scientific recomputation.

### 4.1 Proposed module boundaries

```text
src/explain/
  ScientificExplanationRoute.tsx
  model/
    explanatoryEvidence.ts
    causalProbeEvidence.ts
    servingChangeStoryEvidence.ts
    evidenceFixtureManifest.ts
    representativeLink.ts
    canonicalTermMap.ts
  director/
    explanatoryScript.ts
    teachingBeat.ts
    narrationTemplates.ts
    explanationReducer.ts
    scriptClock.ts
    cameraShotAdapter.ts
  scene/
    ExplanatoryScene.tsx
    LinkGeometryCutaway.tsx
    QuantitativeLinkMeters.tsx
    ComparisonWipe.tsx
    ScientificOverlayLayer.tsx
  figure/
    figureSpec.ts
    figureManifest.ts
    MethodChainPlate.tsx
    ControlledComparisonPlate.tsx
    ServingChangeEventPlate.tsx
```

These modules may import canonical types and pure selectors. They may not
import a page-specific formula implementation as a substitute for frame data.

The completed `TleAnalysisRun` is not a browser first-paint dependency. A
route-local **offline generator** calls the neutral pipeline
`loadTleSnapshotSelection` -> `buildTleRunBundle` -> `buildTleAnalysisRun` ->
`resolveScientificStoryEvidence`, validates the accepted fixture, and writes a
compact serializable artifact. The browser route reads that artifact and never
rebuilds the 7,200-second run during navigation or reload. The generator may
share neutral controller code, but it may not fork the TLE or EE producer. `/`
behavior is covered by route-regression tests.

### 4.2 Existing donors to reuse

- `src/simulator/tleAnalysisRun.ts`: immutable run, anchor selection,
  evaluation, handover trace, and `getFrameAtElapsedSec`;
- `src/simulator/types.ts`: `SimulationAnalysisFrame` and provenance;
- `src/scene/archivedTleSimFrameAdapter.ts`: current canonical-to-scene display
  adapter for TLE positions, cells, UE markers, and established scene
  primitives; it is not an angle/gain term source;
- `src/simulator/SimulatorOrbitScene.tsx`: orbital-context content, adapted so
  the explanatory route owns camera controls;
- `src/ui/TimelineBar.tsx` and `src/app/timelineRailAuthority.ts`: source-time
  transport and timeline claims;
- `src/useCameraControls.ts` and `src/scene/directorFocusPose.ts`: interactive
  camera donors only; Guided/Figure shots use explicit script-time poses rather
  than their wall-clock timestamps;
- `src/ui/CinematicSeekFadeOverlay.tsx`: cut masking;
- `src/scene/MainScene.tsx`, `src/scene/archivedTleSimFrameAdapter.ts`, and
  `src/viz/SinrLiveCellBeamCones.tsx`: the shared service-area rendering path;
  and
- existing Playwright/browser fixtures and capture infrastructure.

Existing Director and replay modules are presentation donors only. Their lane
names, old Walker source assumptions, and wall-clock timing do not become the
new route's evidence contract.

`LinkGeometryCutaway` and the canonical term map read
`SimulationAnalysisFrame` directly. `MainScene`, `SinrLiveCellBeamCones`, and
`archivedTleSimFrameAdapter` contribute rendering primitives only; their reduced
link fields cannot become gain, angle, or power authority.

### 4.3 New seams required

1. **Evidence-fixture resolver**: loads exact source-backed method,
   angle-response, service-target stress, and handover fixtures; validates all identity and
   one-parameter invariants before exposing them to the route.
2. **Causal-probe module**: retains both accepted canonical members, computes
   only declared unit-preserving deltas, and resets to the reference member.
3. **Teaching script**: immutable beat records with question, prediction,
   learner action, source evidence, expected observation, causal explanation,
   misconception guard, recovery, completion check, shot, overlays, duration,
   and claim ceiling.
4. **Deterministic clock**: `advanceTo()` and manual story/phase stepping with no
   dependency on real-time timer completion.
5. **Camera-shot adapter**: maps named shots to explicit script-time poses and
   disables conflicting local `OrbitControls` while Guided/Figure mode owns the
   camera. `SimulatorOrbitSceneContents` needs a controls-disabled option or a
   controls-free extraction.
6. **Canonical term and edge map**: one registry that binds each formula term
   and causal edge to frame selectors, units, scene identities, operations,
   permitted encodings, and comparison deltas.
7. **Quantitative scene-encoding adapter**: owns fixed pairwise scales and
   screen-space meters without changing physical world geometry.
8. **Figure capture adapter**: fixed route inputs, three argument-specific
   specs, readiness gates, manifests, data export, and post-capture validation.
   Existing browser capture is transport infrastructure only;
   SVG/data/manifest export is new work.
9. **Canonical diagnostic exposure**: expose the requested-power denominator
   `h^div` as a frozen read-only canonical result or exported canonical
   selector with parity tests. The explanation route may not reproduce
   `max(h, epsilon_h)` as a page-local scientific calculation.
10. **Candidate-link identity exposure**: expose `role`, `userIndex`, `userId`,
    `beamId`, and the serving-link identity for which a candidate result is a
    counterfactual, or provide an equivalent canonical-owned read-only selector.
    The explanatory route may not reuse the candidate's independently chosen
    max-requested-power representative as though it were the selected UE.
11. **Serving-change event evidence**: extend the immutable ADR-006 trace with
    a deterministic event ID, trigger anchor/time, pre-commit comparison,
    qualifying-anchor bundle, post-commit identity, and forced-continuity
    visibility evidence. This is diagnostic provenance over the existing state
    machine, not a policy or decision change.

Explore uses the existing `archived-tle-run` timeline descriptor inside this
route. It does not enter a `sinr-live`, Walker, replay, or artifact lane.
Guided `scriptTimeMs` is a presentation clock and remains distinct from source
time.

### 4.4 Precomputed first-paint artifact contract

The accepted browser payload is
`public/explain/accepted-scientific-demo-v1.json` with schema
`scientific-explanation-artifact-v1`. It stores only serializable source
identity, canonical term values, representative identities, compact TLE scene
geometry, both controlled pairs, and the pinned serving-change triplet. It does
not serialize `TleAnalysisRun`, `TleRunBundle`, functions, or the full archive.

`npm run generate:explain:artifact` is the only normal rebuild path. The same
command with `-- --check` must reproduce the checked-in bytes exactly. Artifact
acceptance is fail-closed and binds at least the complete accepted fixture
manifest version, archive ID/content digest, snapshot path/digest, requested
UTC, geometry-run ID, analysis/frame identities, probe controls, and
serving-change event identity.

The browser preloads `/explain/accepted-scientific-demo-v1.json`, requests it
with `cache: force-cache`, validates it against the current accepted manifest,
and atomically publishes an available state. A missing, stale, malformed, or
identity-mismatched artifact produces an explicit refusal. It must not trigger
a browser-side catalog load, snapshot selection, SGP4 run build, canonical-run
build, stale-value display, or live fallback.

## 5. Explanatory script

The vertical slice uses script ID `angle-to-ee-causal-v2`. All three story
units below are mandatory.

### 5.1 Teaching-beat contract

```ts
type NarrationSourceValueKind =
  | 'number'
  | 'identity'
  | 'instant'
  | 'status'
  | 'reason';

type NarrationSegment =
  | { readonly kind: 'literal-zh-Hant'; readonly text: string }
  | {
      readonly kind: 'source-token';
      readonly tokenId: TeachingTokenId;
      readonly selector: TeachingSelectorId;
      readonly valueKind: NarrationSourceValueKind;
      readonly unit: string | null;
      readonly formatterId: TeachingFormatterId;
      readonly unavailablePolicy: 'block-with-reason';
    };

type NarrationTemplate = readonly NarrationSegment[];

type ExpectedTeachingObservation =
  | {
      readonly kind: 'numeric-edge';
      readonly id: TeachingObservationId;
      readonly sourceTerm: CanonicalTermKey;
      readonly operationOrConstraint: string;
      readonly targetTerm: CanonicalTermKey;
      readonly expectedRelationship:
        | 'increase'
        | 'decrease'
        | 'unchanged'
        | 'fixture-observed-no-universal-direction';
      readonly referenceValue: number;
      readonly probeValue: number;
      readonly unit: string;
      readonly minimumVisibleDelta: number;
    }
  | {
      readonly kind: 'identity';
      readonly id: TeachingObservationId;
      readonly field: string;
      readonly expectedReference: string;
      readonly expectedProbe: string;
      readonly relationship: 'same' | 'changed';
    }
  | {
      readonly kind: 'status';
      readonly id: TeachingObservationId;
      readonly field: string;
      readonly expected: string | boolean;
    }
  | {
      readonly kind: 'trace';
      readonly id: TeachingObservationId;
      readonly sourceEvent: 'inter-handover' | 'forced-continuity';
      readonly qualificationAnchors: readonly {
        readonly anchorIndex: number;
        readonly candidateSatelliteId: string | null;
        readonly deltaDb: number | null;
        readonly progressSec: number;
        readonly tttSec: number;
        readonly state: CanonicalTleHandoverState;
      }[];
      readonly eventAnchorIndex: number;
      readonly fromSatelliteId: string;
      readonly toSatelliteId: string;
    };

interface TeachingPhase {
  readonly id: TeachingPhaseId;
  readonly evidenceRefs: readonly TeachingSelectorId[];
  readonly cameraShotId: TeachingCameraShotId;
  readonly overlayKeys: readonly TeachingOverlayId[];
  readonly durationMs: number;
}

interface TeachingBeat {
  readonly id: TeachingStoryId;
  readonly storyUnit: 'angle-response' | 'service-target-stress' | 'serving-change';
  readonly question: NarrationTemplate;
  readonly prediction: {
    readonly prompt: NarrationTemplate;
    readonly requiredResponseKeys: readonly TeachingResponseKey[];
    readonly allowedChoices: readonly ('increase' | 'decrease' | 'unchanged' | 'not-inferable' | 'yes' | 'no')[];
    readonly commitBeforeReveal: true;
  };
  readonly action: NarrationTemplate;
  readonly expectedObservations: readonly ExpectedTeachingObservation[];
  readonly causalExplanation: NarrationTemplate;
  readonly misconceptionGuard: NarrationTemplate;
  readonly recovery: NarrationTemplate;
  readonly completion: {
    readonly predicateId: TeachingCompletionPredicateId;
    readonly requiredObservationIds: readonly TeachingObservationId[];
    readonly requiredResponseKeys: readonly TeachingResponseKey[];
    readonly forbiddenClaims: readonly string[];
    readonly requireReferenceReset: boolean;
  };
  readonly phases: readonly TeachingPhase[];
  readonly claimCeiling: string;
}
```

There are exactly three complete `TeachingBeat` records in the first slice,
one per story unit. The identifiers in the following tables are presentation
phases inside those records, not incomplete teaching beats. Every runtime
number, identity, instant, status, and reason is a typed source token. Literal
Traditional Chinese supplies only authored connective prose. A missing token
blocks the story with its source-backed reason; raw runtime literals and
invented examples are rejected.

The following closed registries are normative; implementation cannot add a raw
string selector, formatter, observation, response, predicate, or phase in a
fixture manifest:

```ts
type TeachingStoryId =
  | 'angle-response-teaching-v1'
  | 'service-target-stress-teaching-v1'
  | 'serving-change-teaching-v1';

type TeachingTokenId =
  | 'source.constellation' | 'source.instantUtc' | 'source.runId' | 'source.frameId'
  | 'identity.satelliteId' | 'identity.beamId' | 'identity.userId'
  | 'angle.thetaRad' | 'angle.thetaDeg' | 'angle.fullHpbwRad'
  | 'angle.transmitGain' | 'angle.rawH' | 'angle.hDiv'
  | 'power.userRequestW' | 'power.beamRequestW' | 'power.beamCapW'
  | 'power.satelliteCapW' | 'power.preSatelliteCapW' | 'power.actualW'
  | 'power.satelliteScale' | 'power.powerLimited' | 'power.systemW'
  | 'power.paEfficiency'
  | 'throughput.minimumRateBps' | 'throughput.gammaReqLinear'
  | 'throughput.qosMet' | 'link.sinrLinear' | 'link.rateBps'
  | 'system.totalRateBps'
  | 'ee.instantaneousBitsPerJ' | 'ee.evaluationBitsPerJ'
  | 'event.id' | 'event.sourceEvent' | 'event.fromSatelliteId'
  | 'event.toSatelliteId' | 'event.triggerInstantUtc' | 'event.reason';

type TeachingSelectorId =
  | 'fixture.source' | 'fixture.invariant' | 'fixture.reference'
  | 'fixture.probe' | 'fixture.delta' | 'fixture.eventEvidence';

type TeachingFormatterId =
  | 'identity' | 'utc' | 'radian' | 'degree' | 'linear-gain'
  | 'watt-si' | 'bit-per-second-si' | 'bit-per-joule-si'
  | 'status-zh-Hant' | 'event-label-zh-Hant' | 'reason-zh-Hant';

type TeachingObservationId =
  | 'angle.identity-fixed' | 'angle.only-full-hpbw-changed'
  | 'angle.first-edge' | 'angle.downstream-deltas'
  | 'target.identity-fixed' | 'target.only-minimum-rate-changed'
  | 'target.caps-nonbinding' | 'target.first-edge' | 'target.downstream-deltas'
  | 'event.kind-matches-source' | 'event.precommit-evidence'
  | 'event.identity-committed' | 'event.before-restored';

type TeachingResponseKey =
  | 'angle.first-term' | 'angle.gt' | 'angle.h' | 'angle.pReq'
  | 'angle.actualPower' | 'angle.sinr' | 'angle.rate' | 'angle.pSys' | 'angle.eeInst'
  | 'target.gammaReq' | 'target.pReq' | 'target.actualPower'
  | 'target.sinr' | 'target.rate' | 'target.totalRate'
  | 'target.pSys' | 'target.eeInst'
  | 'event.condition-met' | 'event.kind' | 'event.fromTo'
  | 'event.correction';

type TeachingCompletionPredicateId =
  | 'complete.angle-response-v1'
  | 'complete.service-target-stress-v1'
  | 'complete.serving-change-v1';

type TeachingPhaseId =
  | 'a1-orient' | 'a2-reveal-angle' | 'a3-reference' | 'a4-predict'
  | 'a5-probe' | 'a6-explain-reset'
  | 'b1-reference' | 'b2-predict' | 'b3-stress-reveal' | 'b4-explain-reset'
  | 'c1-before' | 'c2-decision' | 'c3-after' | 'c4-explain'
  | 'c5-correct-reset';

type TeachingCameraShotId =
  | 'orbit-source' | 'service-identity' | 'link-cutaway-fixed'
  | 'comparison-fixed' | 'service-target-fixed'
  | 'serving-change-before' | 'serving-change-decision'
  | 'serving-change-after';

type TeachingOverlayId =
  | 'source-key' | 'identity-key' | 'theta-wedge' | 'gain-meter'
  | 'causal-edge-strip' | 'service-target-strip' | 'power-boundary-strip' | 'sinr-rate-strip'
  | 'system-ledger' | 'prediction-panel' | 'signed-delta-panel'
  | 'event-trace-strip' | 'correction-panel' | 'claim-boundary';

interface TeachingBeatLedgerEntry {
  readonly storyId: TeachingStoryId;
  readonly tokenIds: readonly TeachingTokenId[];
  readonly selectorIds: readonly TeachingSelectorId[];
  readonly formatterIds: readonly TeachingFormatterId[];
  readonly observationIds: readonly TeachingObservationId[];
  readonly responseKeys: readonly TeachingResponseKey[];
  readonly completionPredicateId: TeachingCompletionPredicateId;
  readonly phaseIds: readonly TeachingPhaseId[];
  readonly cameraShotIds: readonly TeachingCameraShotId[];
  readonly overlayIds: readonly TeachingOverlayId[];
}
```

The three normative ledgers are:

| Story ID | Required observations | Required responses | Predicate | Phases |
|---|---|---|---|---|
| `angle-response-teaching-v1` | `angle.identity-fixed`, `angle.only-full-hpbw-changed`, `angle.first-edge`, `angle.downstream-deltas` | `angle.first-term`, `angle.gt`, `angle.h`, `angle.pReq`, `angle.actualPower`, `angle.sinr`, `angle.rate`, `angle.pSys`, `angle.eeInst` | `complete.angle-response-v1` | `a1` through `a6` IDs above |
| `service-target-stress-teaching-v1` | `target.identity-fixed`, `target.only-minimum-rate-changed`, `target.caps-nonbinding`, `target.first-edge`, `target.downstream-deltas` | `target.gammaReq`, `target.pReq`, `target.actualPower`, `target.sinr`, `target.rate`, `target.totalRate`, `target.pSys`, `target.eeInst` | `complete.service-target-stress-v1` | `b1` through `b4` IDs above |
| `serving-change-teaching-v1` | `event.kind-matches-source`, `event.precommit-evidence`, `event.identity-committed`, `event.before-restored` | `event.condition-met`, `event.kind`, `event.fromTo`, `event.correction` | `complete.serving-change-v1` | `c1` through `c5` IDs above |

The exact compiled-template registry is:

| Story ID | Source tokens | Selectors | Formatters | Shots / overlays |
|---|---|---|---|---|
| `angle-response-teaching-v1` | `source.constellation`, `source.instantUtc`, `source.runId`, `source.frameId`, all three `identity.*`, all six `angle.*`, `power.userRequestW`, `power.preSatelliteCapW`, `power.actualW`, `power.systemW`, `link.sinrLinear`, `link.rateBps`, `system.totalRateBps`, `ee.instantaneousBitsPerJ` | `fixture.source`, `fixture.invariant`, `fixture.reference`, `fixture.probe`, `fixture.delta` | `identity`, `utc`, `radian`, `degree`, `linear-gain`, `watt-si`, `bit-per-second-si`, `bit-per-joule-si` | `orbit-source`, `service-identity`, `link-cutaway-fixed`, `comparison-fixed`; `source-key`, `identity-key`, `theta-wedge`, `gain-meter`, `prediction-panel`, `causal-edge-strip`, `signed-delta-panel`, `system-ledger`, `claim-boundary` |
| `service-target-stress-teaching-v1` | `source.instantUtc`, `source.runId`, `source.frameId`, all three `identity.*`, `throughput.minimumRateBps`, `throughput.gammaReqLinear`, `throughput.qosMet`, `power.userRequestW`, `power.beamRequestW`, `power.beamCapW`, `power.satelliteCapW`, `power.preSatelliteCapW`, `power.actualW`, `power.satelliteScale`, `power.powerLimited`, `power.paEfficiency`, `power.systemW`, `link.sinrLinear`, `link.rateBps`, `system.totalRateBps`, `ee.instantaneousBitsPerJ` | `fixture.source`, `fixture.invariant`, `fixture.reference`, `fixture.probe`, `fixture.delta` | `identity`, `utc`, `linear-gain`, `watt-si`, `bit-per-second-si`, `bit-per-joule-si`, `status-zh-Hant` | `service-identity`, `service-target-fixed`, `comparison-fixed`; `source-key`, `identity-key`, `service-target-strip`, `power-boundary-strip`, `prediction-panel`, `sinr-rate-strip`, `signed-delta-panel`, `system-ledger`, `claim-boundary` |
| `serving-change-teaching-v1` | `source.instantUtc`, `source.runId`, `source.frameId`, `event.id`, `event.sourceEvent`, `event.fromSatelliteId`, `event.toSatelliteId`, `event.triggerInstantUtc`, `event.reason` | `fixture.source`, `fixture.eventEvidence` | `identity`, `utc`, `event-label-zh-Hant`, `reason-zh-Hant` | all three `serving-change-*` shots; `source-key`, `identity-key`, `prediction-panel`, `event-trace-strip`, `correction-panel`, `claim-boundary` |

The registry, narration segment arrays, phase objects, and predicate IDs ship as
versioned source records, not only prose in this document. A fixture is invalid
if a compiled template references an ID not declared in its row, if a required
ID is unused, or if a phase/response/predicate differs from its ledger. Unit
tests exhaustively cover the closed unions and the three concrete records.

### 5.2 Story unit A — angle response under fixed geometry

This story keeps TLE publication, geometry run, anchor, source time,
satellite, beam, UE, and off-axis angle fixed. Only the canonical
simulator input `theta3dbRad` differs. It stores the thesis full-HPBW symbol
`theta_3dB`; the scenario adapter supplies half of that value to the Bessel
gain function.

| Phase | Question / action | Required observation | Formal narration template |
|---|---|---|---|
| `a1-orient` | Identify constellation, time, satellite, beam, UE, and fixed `theta` | Globe and local scene retain identical source identity | 「此處先固定一筆 TLE 衍生的 SGP4 狀態。鏡頭雖由地球軌道切換至局部鏈路，但衛星、時間、波束與代表性使用者皆未改變。」 |
| `a2-reveal-angle` | Locate boresight, UE ray, and predict which gain term receives `theta` | The accepted radian angle and converted degree label point to `G^T(theta)` | 「偏軸角是波束中心方向與衛星至使用者方向的夾角，不是仰角。此角度先進入發射波束增益，再與接收增益、大尺度增益及小尺度增益共同形成原始鏈路增益。」 |
| `a3-reference` | Read the reference beamwidth, gain, requested power, actual power, SINR, rate, `P_sys`, and EE | All reference values share one accepted analysis run/frame | 「目前顯示參考狀態。請先預測：當相同偏軸角套用不同的完整半功率波束寬時，哪些量會改變，哪些量可能因功率補償而保持接近。」 |
| `a4-predict` | Choose direction predictions before reveal | Predictions are stored as presentation state and do not alter evidence | 「預測先於答案顯示。此步不評定節能，只檢查是否理解公式中的因果順序。」 |
| `a5-probe` | Reveal the accepted full-HPBW `theta_3dB` probe | Same camera and fixed scales show `G^T`, raw `h`, requested/actual power, SINR/rate, `P_sys`, and EE values | 「幾何與偏軸角保持不變，唯一改變的是完整半功率波束寬；公式以其一半作為單側半功率角。增益與功率的實際變化以兩筆 canonical 結果為準；未變的 SINR 或速率亦是結果，而不是畫面失效。」 |
| `a6-explain-reset` | Traverse signed deltas, explain compensation or cap interaction, then reset | Every required edge has source, operation, target, units, two values, and delta | 「鏈路變差時，需求功率可能先提高；若仍未碰到功率上限，實際功率可補償部分通道差異。系統功率與能效的方向須依本案例數值判讀，不以單一口號預設。」 |

#### 5.2.1 Complete teaching record: `angle-response-teaching-v1`

- **Question:** With geometry, off-axis angle, satellite, beam, and UE held
  fixed, where does the changed full HPBW enter first, and which downstream
  directions cannot be inferred before the accepted result is revealed?
- **Prediction:** Before reveal, record the first affected term and one explicit
  `increase`, `decrease`, `unchanged`, or `not-inferable` choice for `G^T`, raw
  `h`, `p_req`, actual RF output, SINR, `R_u`, `P_sys`, and `EE_inst`.
  `not-inferable` is a concrete prediction, not an omitted answer.
- **Action:** Inspect the reference, submit all predictions, reveal the frozen
  probe, traverse the signed edge deltas, and reset to the exact reference.
- **Expected observations:** source/link identity and `theta` remain equal;
  `theta3dbRad` is the only changed input; the adapter's half-angle boundary is
  visible; every listed term shows both accepted values, unit, status, and
  observed relationship.
- **Causal explanation:** `theta3dbRad / 2` parameterizes the Bessel pattern;
  the fixed off-axis angle enters `G^T`, then composite `h`, requested power,
  capped actual power, current SINR/rate, the power ledger, and EE.
- **Misconception guard:** off-axis angle is not elevation; full HPBW is not
  the one-sided half-angle; neither a wider/narrower beam nor a changed
  off-axis response gives a universal actual-power or EE direction.
- **Recovery:** any identity mismatch, non-zero undeclared parameter diff,
  unresolved token, or sub-formatting delta returns to the fixture error with
  no probe reveal. Reset restores the exact reference digest.
- **Completion:** the viewer names the fixed and changed fields, identifies
  `G^T` as the first affected term, explains the fixture-observed downstream
  path including any unchanged term, makes no forbidden claim, and completes
  the verified reference reset.

### 5.3 Story unit B — service-target stress response

This story reuses one fixed geometry, load, and link identity and changes only
the canonical per-user minimum transmission-rate target `R_min`. The reference
uses the primary 1 Mbit/s value. The probe uses the separately permitted
10 Mbit/s stress diagnostic; no other value may use this fixture ID. Both RF
caps must remain non-binding in both members.
This story displays matched-frame `EE_inst`. It displays run-level `EE_eval`
only when the ledger proves the complete serving/candidate identity sequence
and cap gates over every evaluation interval; otherwise that term is absent,
not zero or inferred from the frame.

| Phase | Question / action | Required observation | Formal narration template |
|---|---|---|---|
| `b1-reference` | Identify `R_min`, beam load, per-beam bandwidth, and the resulting `gamma_req` in the primary reference | The service target is distinct from realized SINR and realized throughput | 「每位使用者最低傳輸速率目標會與波束負載及每波束頻寬共同形成需求 SINR。需求值是功率控制的輸入，不是已實現的 SINR 或實際吞吐量。」 |
| `b2-predict` | Predict `gamma_req`, requested/actual RF power, realized SINR/rate, total throughput, `P_sys`, and `EE_inst` under the 10 Mbit/s stress target | Every named term receives a committed prediction; `EE_inst` may be `not-inferable` with a reason | 「將最低傳輸速率目標由每位使用者 1 Mbit/s 提高至 10 Mbit/s 後，請先判斷需求 SINR、需求功率、實際射頻輸出、實現 SINR／速率、總吞吐量與系統功率如何變化；瞬時能效必須等待總吞吐量與系統功率共同計算。」 |
| `b3-stress-reveal` | Reveal the accepted 10 Mbit/s stress member | The target, `gamma_req`, power path, realized SINR/rate, total throughput, power ledger, and `EE_inst` update together while all cap checks remain non-binding | 「本壓力診斷只把最低傳輸速率目標由每位使用者 1 Mbit/s 改為 10 Mbit/s。畫面沿需求 SINR、需求與實際射頻功率、實現服務、系統功率及瞬時能效依序呈現這筆 fixture 的實際結果。」 |
| `b4-explain-reset` | Trace signed deltas, explain the observed response, and reset to the primary reference | The explanation names the first affected term, all non-binding cap checks, and the observed `EE_inst` numerator/denominator response without a savings claim | 「這是服務目標壓力測試，不是節能政策比較。瞬時能效方向由本案例的總吞吐量與模型邊界內系統功率共同決定，完成說明後回到每位使用者 1 Mbit/s 的主要參考狀態。」 |

#### 5.3.1 Complete teaching record: `service-target-stress-teaching-v1`

- **Question:** How does changing the per-user minimum transmission-rate target
  from 1 Mbit/s to the 10 Mbit/s stress diagnostic
  propagate through `gamma_req`, requested and actual RF power, realized
  service, `P_sys`, and `EE_inst` when geometry, load, caps, and identity are
  fixed?
- **Prediction:** Before reveal, classify `gamma_req`, `p_req`, actual RF
  output, realized SINR, total throughput, `P_sys`, and `EE_inst` as
  `increase`, `decrease`, `unchanged`, or `not-inferable`. The response must
  distinguish the target from the realized quantities.
- **Action:** Inspect the 1 Mbit/s primary reference, submit every prediction,
  reveal the frozen stress diagnostic, traverse the signed causal deltas, and
  reset to the exact primary reference.
- **Expected observations:** source geometry, load, gain, selected identity,
  `beamPowerCapW`, `satellitePowerCapW`, and every PA input parameter remain equal;
  only `minimumRateBps` changes. `gammaReqB` is the first affected canonical
  term. Every beam remains below the beam cap and every satellite scale remains
  one. The accepted requested/actual RF, service, power-ledger, `P_sys`, and
  `EE_inst` values are shown with their statuses. `qosMetU` is an observed
  status, not a restatement that the target was realized.
- **Causal explanation:** `R_min`, beam load, and per-beam bandwidth determine
  `gamma_req(U_b)`; that target enters requested power. With both caps
  non-binding in this fixture, actual RF follows the accepted demand and feeds
  current SINR/rate and the PA/RFC/BB/event ledger. `EE_inst` is then total
  throughput divided by `P_sys`.
- **Misconception guard:** `R_min` is not realized throughput; `gamma_req` is
  not realized SINR; a stress diagnostic is not the canonical primary scenario
  and is not an energy-saving policy. The observed `EE_inst` direction is not
  generalized beyond this matched fixture.
- **Recovery:** a binding beam or satellite cap, identity drift, load or
  geometry mismatch, unresolved token, additional parameter change, or a
  sub-formatting delta rejects the fixture. Reset restores the exact 1 Mbit/s
  reference digest.
- **Completion:** the viewer names the one changed input, identifies
  `gamma_req` as the first affected term, explains the accepted
  target-to-power-to-service-to-`EE_inst` path and all non-binding cap checks,
  makes no savings or standard-scenario claim, and completes the verified
  reset.

### 5.4 Story unit C — trace-backed serving change

The fixture pins one completed ADR-006 serving change. It is never optional.
The script uses exactly three canonical anchors:

- `before`: serving identity is still the old satellite;
- `decision`: the trace records the completed offset-and-TTT or
  forced-continuity decision; and
- `after`: the new serving identity is active and the result rail uses the
  matching frame.

The question and prediction branch on the frozen event kind. An
offset-and-TTT story asks whether one candidate has continuously met the
declared SINR offset. A forced-continuity story asks whether the serving
satellite has left visibility and whether the target is a visible satellite
with pass-plan provenance. The latter never presents TTT as its trigger.

| Phase | Question / action | Required observation | Formal narration template |
|---|---|---|---|
| `c1-before` | Identify serving/candidate roles and predict whether the frozen event condition is met | Old serving link, candidate comparison, visibility, decision state, and source time are visible | `offset-ttt`: 「此時候選衛星只是決策輸入，尚未成為服務衛星。請依安全偏移量與持續時間判斷是否已具備換手條件。」 `forced-continuity`: 「此時先檢查原服務衛星是否仍可見，以及候選衛星是否為真實可見的連續性目標；本事件不以安全偏移量與 TTT 觸發。」 |
| `c2-decision` | Step to the exact completed trace anchor | Event kind, target, offset/TTT evidence or forced-continuity reason, and cumulative count are shown | `offset-ttt`: 「候選鏈路連續符合安全偏移量並完成 TTT，狀態機在此 anchor 完成服務衛星切換。」 `forced-continuity`: 「原服務衛星已不再可見，系統依真實可見候選執行連續性切換；此事件不是門檻與 TTT 觸發。」 |
| `c3-after` | Compare before and after serving identity and results | Centre scene, formulas, and all result groups now reference the new serving frame | 「換手後的 SINR、吞吐量、功率與能效皆重新取自新服務鏈路的同一筆 canonical frame；換手次數只在已完成的服務身分變更時增加一次。」 |
| `c4-explain` | Explain why this is a completed serving change and why a candidate-only frame is not | Viewer identifies the trace event, decision mechanism, and downstream state change | 「畫面中的兩顆衛星並不自動構成服務身分變更。只有完成狀態機決策並改變服務身分，才是本模擬器所記錄的換手或連續性切換事件。」 |
| `c5-correct-reset` | Compare the recorded prediction with the event evidence, correct any mismatch, then return to `before` | Verbatim correction is stored when needed; the same event ID and exact before frame are restored | 「最後將原先預測與軌跡證據逐項核對。若事件類型或觸發條件判讀錯誤，先依畫面中的 from／to 身分與 trigger evidence 修正，再回到同一事件的 before anchor。」 |

#### 5.4.1 Complete teaching record: `serving-change-teaching-v1`

- **Question:** Which satellite serves before and after this event, and what
  exact trace condition commits the identity change?
- **Prediction:** For `inter-handover`, record yes/no for whether the same
  candidate has satisfied the offset through the required TTT and cite the
  visible qualifying anchors. For `forced-continuity`, record yes/no for
  whether the old serving satellite has lost visibility and the target is a
  visible satellite with pass-plan provenance.
- **Action:** Inspect pre-commit evidence, submit the event prediction, step to
  the trigger anchor, inspect the committed after frame, explicitly correct a
  wrong prediction, then reset to the exact before frame and event ID.
- **Expected observations:** the typed trace observation includes stable event
  ID, event kind, pre-commit from/to roles, trigger time, qualification anchors
  for `inter-handover` or visibility evidence for `forced-continuity`, pass-plan
  target provenance, post-commit identity, and cumulative count.
- **Causal explanation:** `inter-handover` commits only after the same candidate
  qualifies across the trace's decision anchors; forced continuity commits
  because the old serving satellite is no longer visible. Both are modeled
  serving changes, but they are different event mechanisms.
- **Misconception guard:** a candidate-only comparison, source switch, initial
  attachment, camera cut, or pass-plan hint is not this completed event; a
  downstream EE difference is an observation, not a handover-caused saving.
- **Recovery:** a missing event-evidence record, non-pass-plan target, missing
  stable after anchor, or event-kind mismatch blocks the story. It cannot
  substitute a visible-geometry fallback, the other event mechanism, or a
  synthetic trace.
- **Completion:** the viewer names from/to identities and exact event kind,
  explains its trigger evidence, distinguishes both event mechanisms from a
  candidate comparison, makes no energy claim, records any needed correction,
  and completes the verified before-state reset.

### 5.5 Story completion and recovery

A story cannot complete solely because its timer ended. Completion requires:

- all referenced evidence identities match;
- every expected value is visible and uses the declared unit;
- prediction, reveal, and explanation phases occur in order;
- the required camera shot and causal connectors are settled;
- the completion predicate passes; an available story cannot be skipped; and
- reset restores the exact reference identity and values.

An explicitly unavailable story may be acknowledged but is recorded as
unavailable, never complete. Reload, failed fixture validation, or a missing
serving-change event returns to a source-gap screen with the fixture ID and
recovery action. It never falls back to an unrelated or synthetic story.

## 6. Visual encoding contract

### 6.1 Canonical causal graph

The visual graph keeps the thesis dependencies explicit:

```text
h = G^T(theta) * G^R * G^LS * g
h^div = max(h, epsilon_h)
gamma_req(U_b) = f(R_min, U_b, B_beam)
p_req,u = gamma_req(U_b) * (lagged I + noise) / h^div
P_req,beam = max of served-user p_req,u
P_beam^DL = active * min(P_beam,max, P_req,beam)
tilde P_beam^DL = satellite scale * P_beam^DL
tilde P_beam^DL * raw h -> signal and current I_intra/I_inter
signal + current I_intra + current I_inter + noise -> SINR -> R_u -> throughput
P_0 = P_beam,max * 10^(BO/10)
tilde P_beam^DL and P_0 -> eta_PA -> P_PA
P_PA + RFC + BB + event -> P_sys
sum_u R_u(t) / P_sys(t) -> EE_inst(t)
(run accumulated delivered bits) / (run consumed energy) -> EE_eval
```

The formula labels use the current thesis symbols. A UI alias is allowed only
when the map visibly names the thesis symbol and the code-field source.
`P_beam^DL` is post-beam-cap and pre-satellite-cap;
`tilde P_beam^DL` is the post-satellite-cap actual RF output. Raw `h` remains
the signal/interference/rate input. `h^div` is only the requested-power
division guard and is not a physical gain.

`P_beam,max` has two canonical outgoing edges: it constrains
`P_beam^DL` and, together with `BO`, derives the PA saturation reference `P_0`.
The term map, narration, and figures always show both edges when the cap is in
focus. The presentation may not split them into independent scientific inputs
or describe a cap edit as pure clipping.

The current seven-beam scenario displays `I_inter = 0` explicitly because all
active beams belong to the serving satellite. This is a derived scenario
result; it is neither omitted nor replaced with a candidate-link value.

The EE labels use the full-system definitions:

```text
EE_inst(t) = sum_u R_u(t) / P_sys(t)
EE_eval = (sum_i dt_i * sum_u R_u(t_i)) / (sum_i dt_i * P_sys(t_i))
```

`EE_eval` belongs to the accepted run and is not an anchor value or a mean of
instantaneous EE. Any existing route copy that describes it as a single-frame
quantity is not a donor for `/explain`; the new route reads
`run.evaluation` and its ratio-of-sums metadata only.

### 6.1.1 Runtime term ownership

The first slice uses these owners. An implementation may rename a selector only
with an explicit source map and parity test.

| Thesis term | Runtime owner | Unit/status |
|---|---|---|
| Full `theta_3dB` | `frame.parameters.theta3dbRad`; `frame.inputs.config.theta3dbRad` is its one-sided value after the adapter boundary | rad |
| Beam and satellite RF caps | `frame.parameters.beamPowerCapW`, `frame.parameters.satellitePowerCapW` | W |
| Off-axis `theta` | `frame.inputs.frame.thetaRadUb[user][beam]` and matching `frame.scenario.geometryUb` | rad; degree is display conversion |
| `G^T(theta)` | `frame.canonical.transmitGainUb[user][beam]` | linear |
| `G^R` | `frame.inputs.frame.receiveGainUb[user][beam]` and matching `scenario.channelTermsUb.receiveGainLinear` | linear |
| `G^LS` and `g` | `frame.scenario.channelTermsUb[user][beam].largeScaleGain` and `.ricianGain` | linear |
| raw composite `h` | `frame.canonical.compositeGainUb[user][beam]` | linear, finite/non-negative |
| `h^div` | new canonical-owned read-only diagnostic seam required by section 4.3 | linear; unavailable until exposed |
| `gamma_req` | `frame.canonical.gammaReqB[beam]` | linear target |
| `R_min`, `U_b`, `B_beam` | `frame.parameters.minimumRateBps`, `frame.inputs.frame.beamLoadB[beam]`, `frame.inputs.config.beamBandwidthHz` | bit/s, users, Hz |
| `p_req,u`, `P_req,beam` | `frame.power.pReqUW[user]`, `frame.power.pReqBW[beam]` | W |
| `P_beam^DL`, actual `tilde P_beam^DL` | `frame.power.pDlBeforeSatelliteCapBW[beam]`, `frame.power.pDlActualBW[beam]` | W |
| signal, `I_intra`, `I_inter`, noise | `frame.throughput.signalUW[user]`, `.intraSatelliteInterferenceUW[user]`, `.interSatelliteInterferenceUW[user]`, and `frame.inputs.config.noisePowerW` | W |
| realized SINR, `R_u`, total throughput | `frame.throughput.sinrU[user]`, `.rateUBps[user]`, `.totalRateBps` | linear, bit/s |
| PA/RFC/BB/event and `P_sys` | `frame.power.pPaBW`, `.pRfcBW`, `.pBbBW`, `.pEventBW`, `.systemPowerW` | W |
| `P_0` | canonical producer derivation from `frame.parameters.beamPowerCapW` and `frame.parameters.backoffDb`; formula and held inputs may be shown, but no numeric value is published until a canonical diagnostic exposes it | W; unavailable numeric value; no page-local recomputation |
| `eta_PA` | `frame.power.paEfficiencyB[beam]`, derived canonically from actual RF and the internal `P_0` | dimensionless |
| Cap/QoS status | `frame.power.satelliteScaleB`, `frame.throughput.powerLimitedU`, `frame.throughput.qosMetU` | scale/boolean; observed status only |
| `EE_inst` | `frame.ee.instantaneousBitsPerJ`, cross-checked with `frame.canonical.ee.systemEeBitsPerJ` | bit/J |
| `EE_eval` | `run.evaluation.evaluationBitsPerJ`, with its `sampleCount`, duration, delivered bits, consumed energy, and `aggregation='ratio-of-sums'` | bit/J, run-level only |

`frame.links[0]` is only an existing representative summary and does not own
the 100-UE arrays. Pair selection and every quantitative figure read the full
canonical arrays above, then record the chosen identity.

### 6.2 Encoding table

| Quantity or state | Spatial/dynamic encoding | Static/analytical encoding | Integrity rule |
|---|---|---|---|
| Off-axis angle `theta` | Main boresight and UE rays retain the accepted geometry; a separate screen-space inset may show `theta_display = m_theta * theta_raw` | Raw thesis value in radians, converted degree label, and visible `m_theta` disclosure | The inset never moves world rays; `m_theta` is fixed by the fixture and recorded in the manifest |
| Transmit gain `G^T(theta)` | Screen-space meter anchored to the selected link encodes the exact `G^T/G_0` value on a frozen non-zero display interval | Gain curve with raw `[0,1]` meaning, visible non-zero baseline, `G_0` reference, and both pair points | Raw/display domains and minimum pixel separation are explicit; no clipping may hide a raw value |
| Channel gain `h` | Selected path is highlighted without encoding magnitude | Dimensionless linear value and optional labelled dB/log-scale position | A transform and its range are recorded; `h^div` remains distinct |
| Requested vs actual RF power | A screen-space aperture ring shows actual RF/cap fraction; an outer requested marker may exceed the cap ring | Paired bars with zero baseline, watts, cap, and clipping marker | `p_req`, post-beam-cap `P^DL`, and actual `tilde P^DL` are distinct; the ring is not physical aperture size |
| Service target and `gamma_req` | A link-anchored target marker changes only in the service-target stress story | `R_min`, `U_b`, `B_beam`, and `gamma_req(U_b)` strip with primary/stress labels | `R_min` is not realized rate; `gamma_req` is not realized SINR; both RF caps remain visibly non-binding in the matched pair |
| Interference | Dashed, identity-labelled active interfering paths | `signal / I_intra / I_inter / noise` decomposition strip | Candidate is not interference unless active ownership says so; current `I_inter=0` remains visible |
| SINR | A role-labelled link halo identifies the affected path without encoding magnitude | Decomposition and value in dB/linear as named | Target `gamma_req` and realized SINR remain distinct |
| Throughput | A screen-space flow band anchored to the selected link uses width for representative `R_u`; animation indicates direction only | Representative rate and total-throughput bars with zero baseline and bit/s units | Reference/probe use one recorded width scale; representative and aggregate values remain distinct |
| Consumed power | A scene-anchored ledger shows PA/RFC/BB/event segments in watts | The same stacked ledger with zero baseline and `P_sys` total | `P_sys` is the declared model boundary, not wall-plug power |
| Instantaneous system EE | A scene-anchored ratio card keeps total throughput and `P_sys` visible on both sides of the division | `sum_u R_u(t) / P_sys(t)` in bits/J at the selected frame | It is not an unexplained glow, representative-link EE, or an energy-saving claim |
| Evaluation EE | None required in spatial view | run-level accumulated delivered bits divided by accumulated energy | Ratio-of-sums; never an anchor value or mean instantaneous EE |
| Handover trace | Serving/candidate roles, offset gate, TTT progress | Completed anchor trace strip | Only ADR-006 evidence; forced continuity is labelled separately |
| Missing, capped, zero, or invalid | Distinct shape/pattern and status label | Explicit text and data flag | Zero rate/zero power gives EE 0; positive rate/zero power, negative, or non-finite input refuses capture |

Color may reinforce serving/candidate/status roles, but line style, shape,
labels, or position must carry the same distinction. Static output cannot rely
on motion, hover, transparency alone, or a legend outside the crop.

World-space beam footprints, satellite sizes, distances, and cell geometry
never encode gain, power, rate, or EE. Quantitative meters are labelled
screen-space overlays spatially anchored to the relevant scene identity. Their
scales remain identical across each reference/probe pair and survive Figure
Mode. Decorative bloom, pulse, particles, and animation may reinforce focus but
never own magnitude.

Each quantitative overlay is governed by:

```ts
type QuantitativeTransformKind =
  | 'identity'
  | 'log10'
  | 'normalize'
  | 'clip'
  | 'ratio-to-g0'
  | 'ratio-to-cap'
  | 'angle-magnify'
  | 'nonzero-baseline-zoom';

interface QuantitativeSceneEncodingBase {
  readonly encodingId: string;
  readonly transformId: string;
  readonly sourceTerm: CanonicalTermKey;
  readonly unit: string;
  readonly transform: QuantitativeTransformKind;
  readonly transformParameters: Readonly<Record<string, string | number | boolean>>;
  readonly rangePx: readonly [number, number];
  readonly exactLabelFormat: string;
  readonly sceneAnchor: SceneEntityKey;
  readonly legendZhHant: string;
  readonly physicalGeometryClaim: false;
  readonly rawDomain: readonly [number, number];
  readonly displayDomain: readonly [number, number];
  readonly minimumVisibleSeparationPx: number;
  readonly disclosureTextZhHant: string;
}

type QuantitativeSceneEncodingSpec = QuantitativeSceneEncodingBase & (
  | {
      readonly evidenceShape: 'single';
      readonly value: number;
    }
  | {
      readonly evidenceShape: 'pair';
      readonly referenceValue: number;
      readonly probeValue: number;
    }
  | {
      readonly evidenceShape: 'triplet';
      readonly beforeValue: number;
      readonly decisionValue: number | null;
      readonly afterValue: number;
    }
);
```

Power and throughput domains include zero. Gain retains the raw `[0,1]`
meaning, but its screen-space meter may use a fixture-frozen non-zero display
domain that contains both accepted values and visibly marks the excluded zero
baseline. An angle inset may use `angle-magnify` only with `m_theta >= 1`, the
raw value beside the display value, and the disclosure 「角度視覺放大 ×N；未
改變世界座標、射線方向或 canonical 計算。」 Any pair-derived domain is
frozen in the fixture and recorded in the figure transform manifest; it cannot
rescale when toggling between reference and probe. The raw value remains the
only formula/data value. Figure Mode never uses interpolation as a quantitative
transform. Each spatial meter carries the visible legend 「畫面尺度；不代表
實體波束範圍、天線孔徑或流量管徑。」 inside the crop.
If `clip` is used for a display range, the visible mark retains an explicit
clipping indicator and exact raw label, while the unmodified raw value remains
in the data artifact. Clipping may not conceal an out-of-range result.

### 6.3 Representative-link selection

The default method-state representative link is deterministic and
source-backed:

1. consider only UEs served by an active beam in the selected frame;
2. prefer a finite, non-zero-rate link with the largest valid off-axis angle;
3. for the service-target stress fixture, prefer a pair-stable link whose
   `gamma_req`, requested/actual RF, throughput, `P_sys`, and EE deltas pass the
   declared formatter and pixel-separation floors while both caps remain
   non-binding;
4. break ties by beam ID then UE ID; and
5. return unavailable if no valid link exists.

The selection must be labelled as one representative link. Aggregate
throughput, power, and EE continue to use the full canonical scenario; the
representative UE is not presented as the entire 100-UE system.

For a controlled pair, selection is performed over the intersection of valid
identities in the reference and probe members. The selected satellite, beam,
UE, source anchor, and off-axis angle must be identical in both members. The
angle-response fixture prefers a non-zero off-axis angle whose accepted pair
produces at least one formatted, visible downstream difference. The
service-target stress fixture requires the same identity, changes only
`minimumRateBps`, and keeps the beam and satellite RF caps non-binding in both
members. It must expose the accepted path from `R_min` through `gamma_req`,
requested/actual RF power, realized service, `P_sys`, and EE.
If no identity satisfies the declared fixture purpose, fixture discovery fails;
the UI may not compare different links or magnify a sub-formatting difference
and call it causal evidence.

This is presentation selector `representative-link-v2`; it does not replace
the producer's existing max-requested-power link or change any canonical
result. The manifest records `userIndex`, string `userId`, beam ID, satellite
ID, selector version, pair-validity checks, and the exact fields used to
establish the visible difference.

### 6.4 Coordinate projection and scene-role contract

The orbital view and local seven-cell view are two projections of the same
accepted evidence, not one continuous metric coordinate system. The orbital
view uses TLE TEME propagation transformed to Earth-fixed and then NTPU
topocentric azimuth, elevation, and range. The canonical local link plane uses
`distanceKm` and `elevationDeg`, derives `thetaRad`, omits azimuth, and places
the link on a fixed local axis. Local `distanceKm` and the orbital adapter's
`rangeKm` are separately named source fields and are not joined by label alone.
The match cut therefore preserves source instant, satellite identity, and frame
identity while visibly disclosing recentering and reorientation. It does not
preserve geographic direction, world-space distance, or a calibrated beam
footprint.

Scene roles are also evidence-bound:

- the service satellite owns only the active beams named by
  `frame.scenario.beamSatelliteB`;
- the candidate satellite is a real same-frame single-link comparison, not an
  active service or interference source unless the canonical frame assigns
  that ownership;
- a candidate comparison must retain the selected representative `userId`,
  `userIndex`, and `beamId`, and its machine-readable identity join must be
  `true`; absent proof renders it unavailable rather than silently selecting a
  different UE; and
- context satellites are admitted from the same TLE frame by a deterministic,
  manifest-recorded culling rule. They carry no beams, interference, power, or
  EE claim.

This contract permits a source-backed multi-satellite context and a
multi-beam service scene without inventing simultaneous active-beam ownership
across satellites. Its current disclosure is exactly one active satellite
owner, seven active service beams, an optional counterfactual display-only
candidate fan, and zero context beams; `multiSatelliteActiveBeamClaim` remains
`not-claimed`. Every visible beam resolves to one satellite, beam ID, evidence
role, and source frame. The seven-cell substrate remains explicitly
uncalibrated.

## 7. Interaction contract

### 7.1 Three-way linking

The term registry contains, at minimum:

```ts
interface CanonicalTermDefinition {
  readonly key: CanonicalTermKey;
  readonly thesisSymbol: string;
  readonly label: string;
  readonly unit: string;
  readonly sourceSelector: (evidence: ExplanatoryEvidence) => TermValue;
  readonly sceneTargets: (evidence: ExplanatoryEvidence) => readonly SceneEntityKey[];
  readonly dependencies: readonly CanonicalTermKey[];
  readonly dependents: readonly CanonicalTermKey[];
  readonly unavailableReason?: (evidence: ExplanatoryEvidence) => string | null;
}

interface CanonicalCausalEdgeDefinition {
  readonly edgeId: string;
  readonly sourceTerm: CanonicalTermKey;
  readonly operationOrConstraint: string;
  readonly targetTerm: CanonicalTermKey;
  readonly sourceLocator: string;
  readonly referenceSelector: (pair: CausalProbeEvidence) => TermValue;
  readonly probeSelector: (pair: CausalProbeEvidence) => TermValue;
  readonly unit: string;
  readonly allowedRelationship:
    | 'increase'
    | 'decrease'
    | 'unchanged'
    | 'fixture-observed-no-universal-direction';
}
```

Hover may preview a link, but keyboard focus and click/tap must provide the same
mapping. Selecting a scene entity, formula term, or value card produces one
shared focus command. It does not duplicate selection logic in three
components.

In comparison mode, the same command focuses the reference value, probe value,
signed delta, operation or constraint, and their shared scene identity. An
edge is unavailable unless both accepted members and the declared source
locator resolve. The renderer cannot infer an edge from spatial proximity.

### 7.2 Time controls

- The rail operates only inside the completed two-hour run.
- Source anchors remain 30 seconds apart.
- Continuous scene interpolation is presentation-only.
- Formula and result labels state the canonical anchor they represent.
- Figure Mode snaps to a completed anchor and disables interpolation.
- An unavailable future anchor cannot be scrubbed or captured.

### 7.3 Explore mode

Explore starts paused at the accepted frame. It permits:

- orbit/service/link scale changes;
- source-time scrub within the accepted run;
- scene/formula/value focus;
- representative-link selection; and
- canonical parameter changes through the existing owning controls or an
  adapter that dispatches the same commands.

Explore must not introduce a second set of numeric controls with different
defaults or units.

The route-local parameter adapter calls `analysisRun.withParameters` (or its
`rebuild` alias) and preserves the current canonical defaults, units,
validation, and ownership. It does not import page-local state from `/` or
`/simulator`.

### 7.4 Guided mode

Guided mode:

- starts from a named script and accepted anchor;
- advances through discrete beats using the deterministic clock;
- permits pause, previous/next beat, restart, and exit;
- makes camera ownership visible and returns it cleanly on exit; and
- keeps source time, selected identities, formulas, and results synchronized.

For each controlled story, Guided first loads the accepted reference member,
records the viewer's prediction, and only then reveals the accepted probe
member from the frozen fixture. Pair production has already proved the
canonical rebuild/publication boundary and stored both accepted identities;
reveal does not launch another calculation. It cannot advance directly from
question to delta, and it cannot complete a story solely because its duration
elapsed.

The two frozen probes are replayed deterministically and visibly labelled as
accepted fixture states. Arbitrary parameter
edits remain Explore actions and are never inserted into the authored lesson.
At any point, `Reset reference` restores the exact reference parameter digest,
evidence identity, fixed scales, camera, and comparison phase.

### 7.5 Camera ownership and deterministic shots

```ts
type CameraOwner = 'explore-user' | 'guided-script' | 'figure-script';

interface CameraShotRecord {
  readonly shotId: string;
  readonly owner: CameraOwner;
  readonly position: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly projection: 'perspective' | 'orthographic';
  readonly fovDeg: number | null;
  readonly near: number;
  readonly far: number;
  readonly scriptTimeMs: number;
  readonly poseDigest: string;
}
```

Explore is user-owned and may use `OrbitControls`. Entering Guided or Figure
Mode snapshots the Explore pose, transfers ownership to the named script,
disables `OrbitControls` input and damping updates, and applies only explicit
`position`, `target`, projection, field-of-view, and clipping-plane values at
deterministic script time. Exiting restores the exact Explore snapshot and
control state. Figure capture records the shot and `poseDigest`; two captures
of the same fixture fail parity if that digest differs.

## 8. Figure Mode contract

### 8.1 Shared figure-argument contract

The slice emits three independent arguments with unique IDs. It does not put
three meanings behind one generic capture name.

```ts
interface FigureArgumentSpec {
  readonly argumentId:
    | 'angle-to-ee-method-chain-v1'
    | 'angle-to-ee-controlled-comparison-v1'
    | 'tle-serving-change-before-decision-after-v1';
  readonly readerQuestion: string;
  readonly claimSentenceTemplate: string;
  readonly claimBoundary: string;
  readonly panelOrder: readonly string[];
  readonly causalConnectors: readonly string[];
  readonly captionTemplate: string;
  readonly equationLocators: readonly string[];
  readonly sourceLocators: readonly string[];
  readonly dataRequirements: readonly string[];
  readonly requiredDisclosures: readonly (
    | 'coordinate-frame'
    | 'scene-role'
    | 'visual-transform'
    | 'uncalibrated-scenario-substrate'
  )[];
  readonly finalSizeAcceptance: readonly string[];
}
```

Each specification is frozen before composition. The composition uses
3D/raster content only where spatial geometry adds meaning. Formula, plot,
axis, ledger, and annotation layers use DOM/SVG. Every figure labels the
seven-cell/100-UE layout as an uncalibrated scenario substrate and `P_sys` as
the declared model boundary.

After fixture tokens are frozen and before 3D implementation, each argument
must pass a 160 x 100 mm DOM/SVG wireframe review using its real caption and
worst-case formatted labels. If the four primary method panels cannot remain
legible at the 7 pt floor, secondary ledger/source detail moves to a keyed
companion table; text may not be shrunk or stacked into a dense all-purpose
plate.

### 8.1.1 Method-chain plate

Figure ID: `angle-to-ee-method-chain-v1`

**Reader question:** How does one accepted TLE-derived frame progress from
source geometry and off-axis angle to gain, requested/actual RF power, SINR,
throughput, consumed power, and EE?

**Claim sentence:** For this accepted archived-TLE SGP4 frame, `theta` enters
the canonical angle-aware gain/channel and power closure, which produces the
displayed frame-level SINR, throughput, `P_sys`, and `EE_inst`, while
`EE_eval` remains a run-level ratio-of-sums.

Panel order is fixed:

1. compact source/service locator: constellation, UTC instant, satellite,
   beam, representative UE, run/frame, and scenario-boundary label;
2. orthographic link cutaway: boresight, UE ray, `theta`, `G^T(theta)`, raw
   `h`, and the requested-power-only `h^div` branch;
3. one left-to-right causal strip: requested/actual power, signal/interference/
   noise, realized SINR, representative rate, and total throughput;
4. compact system ledger and ratio: PA/RFC/BB/event, `P_sys`, `EE_inst`, and
   separately labelled run-level `EE_eval`, followed by the claim footer.

The actual RF output visibly forks into the current signal/interference path
and the power ledger. The caption substitutes only fixture values and states
that the output is a deterministic method artifact, not calibrated, measured,
or Chapter 5 evidence.

Required caption template, rendered through typed source tokens:

> 圖〈figureNumber〉　TLE 衍生幾何至角度感知能效的方法鏈。所選
> 〈constellation〉 archived-TLE 狀態於〈instantUtc〉經 SGP4 傳播後，
> 以〈satelliteId〉／波束〈beamId〉／〈userId〉呈現偏軸角如何進入
> `G^T(theta)` 與複合鏈路增益，再連至需求／實際射頻功率、實現
> SINR、吞吐量、`P_sys` 與 `EE_inst`；`EE_eval` 另為整段 run 的總和
> 比值。七 cell／100 UE 為未校準的情境基底，`P_sys` 為模型宣告的
> 功率邊界。本圖為決定性方法圖，不是實測、校準或第五章效能證據。

### 8.1.2 Controlled-comparison plate

Figure ID: `angle-to-ee-controlled-comparison-v1`

**Reader question:** What single declared input changed between reference and
probe, which canonical terms changed or remained invariant, and what does the
matched comparison establish?

**Claim sentence:** In this accepted matched pair, the declared parameter is
the only changed canonical input; the signed deltas are the effects observed
in this fixture for this geometry, anchor, and link identity.

Panel order is fixed:

1. matched-condition strip with shared source and identity fields;
2. reference panel;
3. probe panel with the same camera and fixed scales;
4. aligned signed-delta chain, including explicit `unchanged` states;
5. cap, QoS, zero/unavailable/invalid status strip;
6. equation/source locators and claim-boundary footer.

The changed input is either `theta3dbRad` for `angle-response-v1` or
`minimumRateBps` for `service-target-stress-v1`. The latter labels the
1 Mbit/s reference as the ADR-003 primary setting and the 10 Mbit/s member as a
stress diagnostic, and visibly proves that every beam/satellite cap check
remains non-binding.
Separate accepted analysis-run/frame IDs remain visible. Publication fails when
an undeclared parameter or any matched identity differs. The caption names all
invariants, the one changed field, the observed deltas, and the limit to a
mechanism probe; it cannot use saving, optimization, measured, calibrated,
generalized, or platform language.

Required caption template, rendered through typed source tokens:

> 圖〈figureNumber〉　受控〈probeLabel〉比較。參考狀態 A 與探測狀態 B
> 共用〈constellation〉、〈geometryRunId〉、〈instantUtc〉及相同的
> 〈satelliteId〉／波束〈beamId〉／〈userId〉；唯一改變的輸入為
> 〈controlSymbol〉，由〈referenceControlValue〉〈controlUnit〉改為
> 〈probeControlValue〉〈controlUnit〉。圖中列出本 fixture 的已接受
> 數值、狀態與帶單位差值；未改變的項目亦明示。本比較是模型機制
> 探測，不是能源政策、節能成效、實測或跨情境一般化證據。

### 8.1.3 Serving change before/decision/after plate

Figure ID: `tle-serving-change-before-decision-after-v1`

**Reader question:** Which satellite serves before the event, what exact
ADR-006 mechanism commits the change, and which satellite and canonical frame
values appear after it?

**Claim sentence:** The fixture selects exactly one of these templates:

- `inter-handover`: In this completed archived-TLE run, the same candidate
  satisfies the declared SINR offset through TTT and the immutable trace
  commits the displayed serving-identity change at the identified anchor.
- `forced-continuity`: In this completed archived-TLE run, the old serving
  satellite loses visibility and the immutable trace commits a visible,
  pass-plan-backed continuity target at the identified anchor without an
  offset-and-TTT claim.

Panel order is fixed:

1. run/policy strip with event kind and decision resolution;
2. before panel with serving/candidate roles and exact frame;
3. decision panel with from/to identities and either offset/TTT evidence or
   serving-visibility-loss evidence;
4. after panel with the committed serving identity and exact frame;
5. downstream before/after observations for rate, actual RF power, `P_sys`,
   and `EE_inst`, explicitly not labelled as handover effects;
6. trace/source locators and claim-boundary footer.

For offset-and-TTT, the trace strip includes the qualifying pending anchors.
For forced continuity, it includes `servingVisible=false` and the source-backed
reason. Initial attachment, candidate-only comparison, missing event, or a
missing stable after anchor fails closed. No connector may imply that the
handover caused an EE improvement or energy saving.

Required event-specific caption templates, rendered through typed source
tokens:

> `inter-handover`：圖〈figureNumber〉　有軌跡證據的 offset-and-TTT 服務
> 身分變更。〈fromSatelliteId〉於〈beforeInstantUtc〉提供服務；相同候選
> 〈toSatelliteId〉在所列 decision anchors 持續符合〈offsetDb〉dB 安全
> 偏移量並完成〈tttSec〉s TTT，事件於〈triggerInstantUtc〉提交；其後由
> 〈toSatelliteId〉服務。這是〈anchorStepSec〉秒 decision axis 上的模型
> 事件，不宣稱低於 anchor 間隔的計時精度、實測網路行為或節能結果。

> `forced-continuity`：圖〈figureNumber〉　有軌跡證據的強制連續性服務
> 身分變更。〈fromSatelliteId〉於〈triggerInstantUtc〉失去可見性，狀態機
> 選取具有通行計畫來源且可見的〈toSatelliteId〉並提交服務身分；本事件不以安全偏移量
> 或 TTT 觸發。這是模型事件，不是實測網路行為或節能結果。

### 8.1.4 Equation and source locator registry

Figure specs use stable locators rather than copying formulas into a second
authority:

- thesis equation (3.6): off-axis geometry;
- equation (3.7): Bessel transmit gain and full-HPBW/half-angle convention;
- equations (3.8), (3.9), and (3.9a): free-space/atmospheric loss,
  large-scale gain, and directional receive gain;
- equation (3.10): composite `h`;
- equations (3.11)--(3.14a): lagged interference, `gamma_req`, requested
  power, beam demand, beam cap, and satellite cap;
- equations (3.15)--(3.23): PA and system-power inputs, frequency reuse,
  current interference, realized SINR, representative rate, and total
  throughput;
- equations (3.25)--(3.26): `P_sys`, additive contributions, and
  instantaneous system EE;
- equation (3.31): run-level evaluation EE ratio-of-sums;
- ADR-003 sections 3.1--3.4: canonical domain, zero, and fail-closed behavior;
- ADR-005: archived-TLE/SGP4, fixed scenario, and one-frame authority;
- ADR-006 and `src/simulator/canonicalTleHandover.ts`: immutable serving-change
  trace, event names, offset/TTT, and forced continuity; and
- `SimulationAnalysisFrame`, canonical power/throughput/EE result objects, and
  the exact selectors recorded by the fixture ledger.

The locator record includes repository path, revision, file digest, and exact
section/equation identity. Changing a locator does not silently change a figure
claim; it invalidates the figure specification for review.

### 8.2 Capture profile

The first validated thesis-draft profile is:

```text
viewport: 1600 x 1000 CSS px
device scale factor: 2
composed output: 3200 x 2000 PNG
vector overlay: 1600 x 1000 SVG
target print size: 160 x 100 mm
effective PNG resolution at target size: 508 dpi
metadata: JSON manifest
underlying values: required JSON plus CSV for every quantitative layer
background and alpha: opaque white
SVG coordinate system: viewBox="0 0 1600 1000", no implicit crop
font mode: live text with family, version, and file digest recorded
minimum final-size text target: 7 pt
```

The SVG is the annotation/analytical overlay, not a claim that the WebGL scene
is vector. PDF packaging remains deferred until the thesis or publication
workflow chooses its final figure profile. Device scale factor is a raster
capture setting and is not itself a DPI claim. PNG and SVG share one origin,
viewport, camera-shot transform, and crop. A fixed registration-mark fixture
must prove their alignment before the marks are omitted from a final capture.

### 8.3 Manifest

Each capture records at least:

```ts
interface ScientificFigureManifest {
  readonly figureSpecVersion: 'scientific-figure-v1';
  readonly figureId: string;
  readonly argumentId: FigureArgumentSpec['argumentId'];
  readonly storyUnitId:
    | 'method-chain'
    | 'angle-response'
    | 'service-target-stress'
    | 'serving-change';
  readonly fixtureId: string;
  readonly readerQuestion: string;
  readonly claimSentence: string;
  readonly claimBoundary: string;
  readonly panelOrder: readonly string[];
  readonly equationLocators: readonly string[];
  readonly sourceLocators: readonly string[];
  readonly appRevision: string;
  readonly appSourceDigest: string;
  /** Primary member is `method`, `reference`, or `decision` by argument. */
  readonly primaryEvidenceRole: 'method' | 'reference' | 'decision';
  /** Alias of `analysisRunId` retained for the runtime vocabulary. */
  readonly runId: string;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly frameId: string;
  readonly anchorIndex: number;
  readonly instantUtc: string;
  readonly constellation: 'oneweb' | 'starlink';
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly selectedTleLogicalId: string;
  readonly selectedTlePath: string;
  readonly archiveContentSha256: string | null;
  readonly selectedTleSha256: string;
  readonly selectedTleEpochUtc: string;
  readonly propagationModel: 'SGP4';
  readonly analysisContractVersion: string;
  readonly scenario: string;
  readonly parameterDigest: string;
  readonly representativeSelectionRuleId: 'representative-link-v2';
  readonly representativeLink: {
    readonly satelliteId: string;
    readonly beamId: number;
    readonly userIndex: number;
    readonly userId: string;
  } | null;
  readonly coordinateFrames: CoordinateFrameDisclosure;
  readonly sceneComposition: SceneCompositionDisclosure;
  readonly evidenceMembers: readonly {
    readonly role: 'method' | 'reference' | 'probe' | 'before' | 'decision' | 'after';
    readonly analysisRunId: string;
    readonly geometryRunId: string;
    readonly frameId: string;
    readonly anchorIndex: number;
    readonly instantUtc: string;
    readonly parameterDigest: string;
    readonly satelliteId: string;
    readonly beamId: number | null;
    readonly userIndex: number | null;
    readonly userId: string | null;
  }[];
  readonly controlledChange: {
    readonly parameterKey: keyof SimulatorParameters;
    readonly thesisSymbol: string;
    readonly unit: string;
    readonly referenceValue: number;
    readonly probeValue: number;
  } | null;
  readonly fixtureInvariantChecks: Readonly<Record<string, boolean>>;
  readonly capToleranceW: number | null;
  readonly servingChangeEvent: (ServingChangeKind & {
    /** Exact alias of `sourceEventEvidence.eventId`. */
    readonly sourceEventId: string;
    readonly fromSatelliteId: string;
    readonly toSatelliteId: string;
    readonly traceDigest: string;
    readonly evidence: CanonicalTleServingChangeEvidence;
  }) | null;
  readonly scriptId: string;
  readonly beatId: string;
  readonly phaseId: string;
  readonly cameraShotId: string;
  readonly cameraShot: CameraShotRecord;
  readonly viewportCssPx: readonly [number, number];
  readonly deviceScaleFactor: number;
  readonly targetPrintMm: readonly [number, number];
  readonly effectiveDpi: number;
  readonly alphaPolicy: 'opaque';
  readonly paletteId: string;
  readonly fontRecords: readonly {
    readonly family: string;
    readonly version: string;
    readonly fileSha256: string;
    readonly mode: 'live-text';
  }[];
  readonly rendererVersion: string;
  readonly renderSpecDigest: string;
  readonly dataDigest: string;
  readonly sourceRecords: readonly {
    readonly repositoryPath: string;
    readonly revision: string;
    readonly filePath: string;
    readonly fileSha256: string;
    readonly sectionOrEquation: string;
  }[];
  readonly quantitativeFields: readonly {
    readonly markId: string;
    readonly evidenceRole: 'method' | 'reference' | 'probe' | 'before' | 'decision' | 'after';
    readonly analysisRunId: string;
    readonly frameId: string;
    readonly anchorIndex: number;
    readonly satelliteId: string;
    readonly beamId: number | null;
    readonly userIndex: number | null;
    readonly canonicalSelector: string;
    readonly value: number | null;
    readonly displayValue: number | null;
    readonly unit: string;
    readonly status: 'available' | 'zero' | 'capped' | 'unavailable' | 'invalid';
    readonly transformId: string;
    readonly transform: QuantitativeTransformKind;
    readonly transformParameters: Readonly<Record<string, string | number | boolean>>;
    readonly rawDomain: readonly [number, number] | null;
    readonly displayDomain: readonly [number, number] | null;
    readonly dataArtifactRole: 'figure-data-json' | 'quantitative-data-csv';
    readonly dataArtifactColumn: string;
  }[];
  readonly transforms: readonly {
    readonly transformId: string;
    readonly field: string;
    readonly kind: QuantitativeTransformKind;
    readonly parameters: Readonly<Record<string, string | number | boolean>>;
    readonly rawDomain: readonly [number, number];
    readonly displayDomain: readonly [number, number];
    readonly minimumVisibleSeparationPx: number;
    readonly disclosureTextZhHant: string;
  }[];
  readonly fieldStatus: readonly {
    readonly field: string;
    readonly status: 'available' | 'zero' | 'capped' | 'unavailable' | 'invalid';
    readonly reason: string | null;
  }[];
  readonly uncertaintyDeclaration: 'not-quantified-by-current-model';
  readonly caption: string;
  readonly altText: string;
  readonly longDescription: string;
  readonly artifactFiles: readonly {
    readonly role: 'composed-png' | 'vector-overlay' | 'figure-data-json' | 'quantitative-data-csv';
    readonly logicalPath: string;
    readonly mediaType: string;
    readonly sha256: string;
  }[];
  readonly visualToleranceProfileId: 'chromium-sw-v1';
}
```

The singular run/frame/source fields mirror the declared primary evidence
member for compatibility and simple filtering. They never stand in for the
other member of a pair or triplet; `evidenceMembers` remains the complete
argument record. A handover plate may set `representativeLink` to null when no
single UE is part of its argument.

The caption, alt text, and long description use the same scene disclosure to
state that one satellite owns the seven canonical service beams, the optional
candidate fan is counterfactual and display-only, context satellites own no
beams, and the seven-cell substrate is uncalibrated. They may not shorten this
to “multi-satellite active-beam scene.”

The manifest and underlying values are source records. The PNG/SVG are
presentation outputs. Any Figure Mode display transform, including log
scaling, normalization, or clipping, is recorded in `transforms`. Interactive
scene interpolation remains presentation-only state outside the figure
manifest. Every
quantitative layer has a data artifact. `artifactFiles` excludes the manifest
itself; a capture receipt records the manifest SHA-256 and the delivered file
list so the bundle has no self-hash cycle.

Every visible quantitative mark has exactly one `quantitativeFields` record,
and every record resolves to one JSON or CSV value. The validator rejects an
orphan mark, unused quantitative record, duplicate owner, missing `userIndex`
for a UE term, or a displayed transform/domain that differs from the manifest.

The reference visual-tolerance profile uses the repository-pinned Playwright
Chromium with software rendering, a per-pixel comparison threshold of `0.2`,
and `maxDiffPixelRatio <= 0.002`. It permits no mask over a quantitative mark,
label, provenance key, or registration anchor. The receipt records the browser,
OS, renderer, and any declared non-quantitative mask.

### 8.4 Capture readiness

The page exposes a capture-ready state only when:

- the accepted run and selected frame identities match;
- all fonts and required assets are loaded;
- the named representative link resolves;
- no parameter rebuild is pending;
- the requested beat is complete and paused;
- Figure Mode has disabled animation and geometry interpolation;
- the named Figure camera pose and `poseDigest` match the manifest;
- coordinate-frame, match-cut, scene-role, context-culling, and footprint
  disclosures resolve and are visible where their claim boundary requires;
- the scene/manifest agree on one active satellite owner, seven owned service
  beams, candidate fan mode, zero context beams, and the explicit
  `not-claimed` multi-satellite-active-beam status;
- an available candidate comparison has a proven same-representative identity
  join; otherwise it is unavailable;
- every required field is finite or explicitly unavailable;
- every quantitative mark has one source selector, evidence member, unit,
  status, raw/display value and domain, transform, disclosure, and data-artifact
  location;
- every mark's `transformId` resolves to exactly one manifest transform and no
  transform record is orphaned;
- the manifest, data payload, and visible labels agree;
- PNG/SVG registration anchors agree before final marks are removed; and
- every output artifact and the manifest pass content-hash verification.

Argument-specific readiness is additional:

- the method plate resolves one complete canonical state and every dependency
  edge shown in its reading order;
- the controlled-comparison plate passes every fixture invariant, proves
  exactly one changed parameter, has both accepted members, retains fixed
  scales, and exposes the reference, probe, and delta for every plotted term;
- every angle magnification or non-zero-baseline gain display records raw and
  display domains, the fixed factor/domain, minimum pixel separation, and a
  visible Traditional-Chinese disclosure;
- the comparison plate includes `EE_eval` only when the complete serving and
  candidate identity sequence matches across both runs;
- the handover plate resolves one immutable ADR-006 event, exact
  before/decision/after anchors, pre-mutation evidence, pass-plan target
  provenance, from/to identities, and a valid after state;
  and
- the generated caption contains no unresolved token and stays within the
  figure's frozen claim boundary.

The capture tool fails closed when any condition is false.

### 8.5 Accessibility and figure description

Each figure ships with:

- short alt text describing the main relationship;
- a long description that follows the causal chain in reading order;
- a data table for plotted quantities;
- role distinctions that survive grayscale;
- keyboard-readable labels in the interactive source view;
- at least 4.5:1 contrast for normal text and 3:1 for large text and essential
  graphical objects; and
- a capture receipt recording grayscale, contrast, and final-size inspection.

## 9. Scientific wording and claim limits

Allowed source claim:

> TLE-derived SGP4 geometry evaluated by the canonical angle-aware EE model.

Do not use `live`, `measured`, `calibrated`, `paper-faithful`, or `digital twin`
for the current adapter.

### 9.1 Traditional-Chinese narration contract

Guided narration, accessible long descriptions, and captions share one
source-token formatter. The visible prose is authored Traditional Chinese;
field labels, code names, or deltas are inserted only through typed tokens from
the accepted fixture. A missing token produces an explicit
`【資料不可用：原因】` state and blocks reveal/capture. It is never rendered as
blank text, placeholder zero, or a fabricated example.

Every story follows the same semantic order without forcing an identical UI
layout:

1. state the exact source and identities held fixed;
2. ask one answerable causal question;
3. record a prediction before revealing the probe or event;
4. name the single action or trace transition;
5. describe changed and unchanged observations with values and units;
6. explain the canonical dependency or constraint responsible;
7. correct the story-specific misconception; and
8. provide reset or source-gap recovery.

The narration does not recite field walls, describe development architecture,
or claim that camera movement is scientific evidence. Terms remain stable:
`theta_3dB` is the full half-power beamwidth, `gamma_req` is the required
target, actual RF output is post-cap, `P_sys` is the declared model boundary,
and a handover requires a completed trace event.

### 9.2 Additional hard limits

- The fixed seven-cell service area is an uncalibrated display and scenario
  substrate, not a TLE-derived physical footprint.
- Multiple TLE context satellites plus seven beams owned by one serving
  satellite are not evidence of simultaneous multi-satellite active-beam
  assignment.
- `r1_u` is a user's contribution to the common system EE objective, not that
  user's physical energy consumption.
- `P_sys` is the declared model boundary, not whole-satellite or facility
  power.
- A higher off-axis angle may reduce gain, but the resulting actual RF power
  depends on requested power and beam/satellite caps; avoid a universal
  monotonic power claim.
- `gamma_req` is a target derived from service/load terms. It is not the
  realized SINR.
- Requested power uses the canonical lagged-interference term; realized SINR
  uses the current coupled actual-power state.
- A same-instant candidate comparison is not a handover event.
- A source switch is not a handover and does not prove energy saving.
- A lower denominator or lower displayed power alone is not an energy-saving
  result.
- `EE_inst = 0` is valid when delivered rate is zero and `P_sys >= 0`;
  positive delivered rate with zero power is invalid and fails closed.
- Any negative or non-finite quantitative value refuses publication and
  capture rather than being formatted as zero.

## 10. Dependencies and rendering choices

The first slice uses the installed React, Three.js, React Three Fiber, Drei,
SVG/DOM, CSS, and Playwright stack.

Do not add D3, GSAP, Motion, Theatre.js, Remotion, Blender, or another figure
framework in the first slice. Reconsider a dependency only after a concrete
gap is reproduced:

- D3 modules may be justified for a contour, scale, or axis that cannot be
  kept clear and deterministic with the existing SVG utilities.
- A custom Three.js shader may be justified for an angle/gain field that
  materially improves spatial comprehension and has a non-shader fallback.
- A motion library may be justified only if the deterministic script clock and
  existing camera tween infrastructure cannot express a reviewed transition.
- Remotion or Blender belongs to a later exported-film workflow, not the
  interactive evidence source.

## 11. Verification plan

### 11.1 Pure model tests

- reject mismatched run/frame/anchor identities;
- choose one pair-stable representative link deterministically;
- reject a probe pair whose geometry/source identity differs, whose selected
  link differs, or whose parameter diff contains other than the one declared
  control;
- preserve units and direction when deriving presentation-only signed deltas;
- exclude controlled-pair `EE_eval` unless the full serving/candidate identity
  sequence is equal;
- map every visible formula term to one frame selector and declared unit;
- preserve unavailable, zero, capped, and invalid states;
- prove raw/display transforms never feed back into canonical data; angle
  magnification is fixed and disclosed; gain display domains have a positive
  lower bound; every pair passes formatter and pixel-separation floors; and
  every quantitative mark resolves exactly one `transformId`;
- resolve dependency/dependent focus without cycles or duplicate owners;
- reject a candidate comparison that changes the selected `userId`,
  `userIndex`, or `beamId` instead of returning unavailable;
- reject any visible beam or interference contribution without a canonical
  owner in the selected frame;
- prove the event ID is deterministic, `preCommit` precedes state mutation,
  offset-and-TTT qualification anchors are contiguous with one candidate, and
  forced continuity carries its separate visibility evidence;
- reject a Guided beat that lacks its question, prediction, action, expected
  observation, explanation, misconception guard, recovery, or completion
  check;
- prevent probe reveal before prediction and completion before explanation;
- prove reset restores the exact reference parameter digest and evidence; and
- prove Guided/Figure camera ownership disables interactive controls, uses
  deterministic script time, restores the Explore snapshot on exit, and
  freezes source anchor, pose digest, overlays, and animation in Figure Mode.

### 11.2 Scientific integration tests

- compare displayed term values with the exact `SimulationAnalysisFrame`;
- prove `withParameters` preserves TLE selection, geometry run, pass plan, and
  anchor time while rebuilding the analysis run, trace, frames, and evaluation;
- prove the simulator's full-HPBW `theta3dbRad` is divided by two exactly once
  at the canonical Bessel-pattern boundary;
- prove the angle-response pair retains non-zero off-axis geometry and exactly
  the same serving satellite, beam, and UE at its comparison anchor;
- prove the service-target stress pair changes only `minimumRateBps`, retains
  geometry, gain, load, PA input parameters, and the same selected link, and keeps
  every `pReqBW` below its beam cap by the recorded tolerance, aggregate
  pre-satellite-cap RF grouped by `beamSatelliteB` below the satellite cap,
  every per-beam satellite scale equal to one, and every `powerLimitedU` false;
- compare accepted `gamma_req`, requested/actual RF, realized SINR/rate, total
  throughput, PA efficiency, `P_sys`, and EE rather than assuming a downstream
  direction from the target alone;
- prove actual `P_DL` is shared by SINR, Power, Throughput, and EE views;
- prove aggregate throughput/power/EE remain full-scenario values while the
  selected UE is labelled representative;
- prove evaluation EE is the run's ratio-of-sums;
- exclude the service-target pair's `EE_eval` unless the same identity and cap
  gates pass over every evaluation interval;
- prove candidate power/SINR does not enter active interference without active
  ownership and that the candidate link uses the selected UE/beam identity or
  is unavailable;
- prove the scene disclosure has one active owner, seven active service beams,
  zero context beams, and a frame-owned identity for every rendered beam;
- prove orbital azimuth/elevation/range and local distance/elevation are not
  treated as one metric coordinate system; and
- prove the serving-change triplet uses one immutable ADR-006 event, exact
  pre-commit evidence, before/decision/after anchors, pass-plan target
  provenance, and committed from/to identities.

Existing canonical Python replay/conformance gates remain the formula-parity
authority. A passing browser test is not formula parity.

### 11.3 Browser and visual tests

- direct navigation to `/explain` works without a homepage button;
- `/` and `/simulator` remain behaviorally unchanged;
- Explore and Guided project exactly one accepted evidence member and one
  current frame at each visible state; a comparison retains both accepted
  members without mixing their fields, and Figure Mode freezes one member,
  pair, or serving-change triplet as declared by its argument;
- the globe-to-local match cut retains satellite identity and source time;
- the match cut visibly discloses recentering/reorientation and does not imply
  geographic or footprint continuity;
- service, candidate-comparison, and context roles remain distinct; context
  satellites carry no unowned beams or quantitative claims;
- scene, formula, and value focus are synchronized by keyboard and pointer;
- pending parameter rebuild never shows a mixed old/new state;
- each controlled story shows reference, prediction, pending/reveal, delta,
  explanation, and exact reset in order;
- reference/probe camera, crop, scale domains, and formatter precision remain
  identical;
- Guided/Figure shots cannot be perturbed by pointer input or damping, and
  leaving those modes restores the exact Explore camera pose;
- the mandatory serving-change story cannot be completed by a candidate-only frame,
  initial attachment, or a fabricated fallback;
- the before/decision/after panels agree with the immutable trace and current
  canonical frame at every step;
- figure labels fit at the target viewport with no clipping or overlap;
- static output remains understandable in grayscale and without hover;
- each of the three figures answers its frozen reader question at the declared
  160 x 100 mm final size;
- figure manifest, underlying data, and visible labels agree; and
- approved reference captures compare within a documented visual tolerance.

### 11.4 Required fixtures

The reviewed fixture ledger must pin:

1. one complete method-state frame with a finite representative link;
2. one `angle-response-v1` accepted pair with non-zero off-axis angle, the
   same source/geometry/link identity, only `theta3dbRad` changed, and at least
   one visible downstream observation;
3. one `service-target-stress-v1` accepted pair with only `minimumRateBps`
   changed from the ADR-003 primary `1_000_000` bit/s reference to the separately
   labelled `10_000_000` bit/s stress diagnostic, the same
   source/geometry/link identity, all-vector non-binding cap checks, no
   power-limited UE, and satellite scaling equal to one;
4. one completed non-initial ADR-006 serving change with a valid after anchor,
   explicitly pinned as offset-and-TTT or forced continuity;
5. one target-reset, no-event, or invalid-trace case that proves a candidate
   comparison cannot complete the serving-change story; and
6. one incomplete/failed rebuild that proves stale-state and capture refusal.

A secondary OneWeb or Starlink source fixture verifies constellation switching
without becoming a controlled cross-constellation performance comparison.
Both constellation labels remain supported; only one constellation is needed
inside a single matched causal pair.

Synthetic fixtures may test rendering mechanics only and must be visibly and
machine-readably labelled as synthetic. They cannot become thesis-figure
evidence.

### 11.5 Owner visual acceptance

The owner review is successful only if the final interactive route and all
three original-size figure bundles are visually accepted and the owner can
answer:

1. Which satellite, beam, UE, source time, and frame are being explained?
2. Where is the off-axis angle in the scene, and which gain term does it
   change?
3. Why can requested and actual RF power differ?
4. Which values form realized SINR and throughput?
5. Which power terms form `P_sys`, and how do throughput and `P_sys` form EE?
6. Which values describe one representative link and which describe the full
   seven-beam/100-UE scenario?
7. Is the current view an instantaneous frame, a run evaluation, or a completed
   serving-change event, and which event kind is it?
8. In the controlled pair, what one input changed, what stayed fixed, and which
   results changed or stayed unchanged?
9. At the serving-change decision, what event mechanism committed the from/to
   serving identity change?
10. Which satellite owns active service beams, which is only a candidate-link
    comparison, and which satellites are context only? How many active
    satellite owners exist, and is the candidate fan canonical or display-only?
11. What does the globe-to-local cut preserve, what does it reproject, and are
    the seven cells a calibrated physical footprint?

Machine checks do not replace this review.

### 11.6 Fresh-viewer acceptance: `FV-1`

At least one target viewer uses `/explain` in a fresh browser context. The
target viewer can read Traditional Chinese and basic ratios but has no assumed
satellite-communications, SINR/EE, canonical-runtime, or source-code knowledge;
the person did not implement the slice and has not read this SDD. The
facilitator may repeat the visible task but may not supply terminology, a
prediction, or a causal hint.

Every required prediction response key is answered before reveal and recorded
verbatim. A blank, generic “會改變”, or answer that omits the named term does
not count. `not-inferable` is valid only when attached to a named term and a
short reason. After reveal, the viewer gives a verbatim explanation in their
own words.

Pass requires all of the following:

1. identify the held source time, satellite, beam, UE, and the one changed
   input in each controlled pair;
2. explain `theta -> G^T(theta) -> h` and why actual power or EE direction is
   not guaranteed from angle alone;
3. distinguish requested user power, beam demand, post-beam-cap RF output, and
   post-satellite-cap actual RF output;
4. explain the observed SINR/rate, `P_sys`, and `EE_inst` path without calling
   lower power an energy-saving result;
5. distinguish the representative link from full-scenario aggregates and an
   instantaneous frame from a run evaluation;
6. identify the serving-change event kind and from/to identities, and
   distinguish it from a same-instant candidate comparison; and
7. use the visible recovery/reset path to correct any initially wrong
   prediction;
8. distinguish service, candidate-comparison, and context satellites and trace
   every visible beam to its canonical owner, while identifying the
   display-only candidate fan and the one-owner boundary; and
9. explain that the globe and local seven-cell view use disclosed different
   coordinate projections and that angle/gain visual transforms do not change
   canonical values or physical geometry.

Each story receives a binary score from its preregistered rubric:

| Story | Must mention for pass | Forbidden conclusion |
|---|---|---|
| Angle response | fixed geometry/`theta`, changed full HPBW, first affected `G^T`, observed path through `h`, and at least one downstream sign that required evidence | angle is elevation; half-angle is the full HPBW; universal actual-power or EE direction |
| Service-target stress | fixed source/geometry/load/link, 1 Mbit/s primary reference, separately labelled 10 Mbit/s stress target, changed `gamma_req`, and observed RF/service/`P_sys`/`EE_inst` path with all cap checks non-binding | target rate is realized rate; `gamma_req` is realized SINR; lower power proves saving; `P_sys` is whole-facility power |
| Serving change | from/to identity, exact `inter-handover` or `forced-continuity` event, its trigger evidence, and the committed after state | candidate comparison, source switch, initial attach, or camera cut is the event; forced continuity used offset/TTT |
| Scope | representative versus aggregate, `EE_inst` versus `EE_eval`, service/candidate/context roles, and disclosed globe-to-local reprojection | cutaway is a calibrated footprint; candidate or context is active/interfering without canonical ownership; a display transform is physical scale |

All rows must pass. An initially wrong prediction is allowed only when the
visible explanation/recovery causes an explicit correction before completion.

Calling `gamma_req` realized SINR, treating a candidate as interference without
active ownership, treating the scenario cutaway as a calibrated footprint,
assigning a beam to a context satellite, reading a magnified angle or zoomed
gain display as physical scale, calling the one-owner scene a simultaneous
multi-satellite active-beam assignment, relabeling forced continuity as
offset-and-TTT, or claiming energy saving is a critical failure. After a
critical failure, revise the experience and repeat `FV-1` with another fresh
viewer.

The acceptance record includes fixture IDs, app revision, predictions, final
explanations, facilitator prompts, completion states, unavailable reasons, and
critical failures. Machine checks, screenshots, and owner familiarity do not
substitute for this record.

### 11.7 Static-figure acceptance: `FVA-figure-v1`

An independent non-implementer inspects each composed PNG with its SVG overlay
at the declared 160 x 100 mm final size, without hover, animation, zoom, the
interactive route, or facilitator hints. For each figure, the reader answers
its frozen reader question, states the one-sentence claim, and identifies the
claim boundary.

Pass requires the method reader to recover the geometry-to-EE chain, the
comparison reader to identify the one changed input and matched invariants,
and the serving-change reader to identify before/decision/after identities and
the exact event mechanism. Every reader must also recover the disclosed
coordinate projection, service/candidate/context roles, and any visual
magnification or non-zero-baseline transform used in that figure. Any
physical-footprint, measurement, generalized performance, handover-caused EE,
or energy-saving inference is a critical failure. The record stores the exact
target-size render, artifact/manifest digests, verbatim answers, pass/fail per
figure, and critical failures.

`FV-1`, `FVA-figure-v1`, and explicit owner visual acceptance are separate
gates. Passing one does not imply the others.

## 12. Implementation sequence

Each checkpoint remains reviewable and does not modify the active homepage.

1. **S0 — authority and ownership preflight**
   - re-read ADR-005, ADR-006, this ADR/SDD, current handoff, and dirty status;
   - record base HEAD plus `git status --short --branch`,
     `git diff --name-only`, `git worktree list`, `tmux ls`, and the relevant
     process list without reset, stash, restore, or cleanup;
   - obtain controller ownership acknowledgement, assign one implementation
     writer, and freeze an exact path allowlist; and
   - recheck active writers immediately before the first write and stop when an
     active writer, unincorporated checkpoint, or dirty-path overlap exists.
2. **S0.5 — diagnostic evidence seams**
   - through one explicitly owned narrow producer change, expose canonical
     `h^div`, candidate-link identity/role, and the immutable serving-change
     evidence record with parity and policy-no-change tests;
   - do not mount a route, add presentation state, or alter any scientific
     formula, cap, or handover decision; and
   - record base HEAD, preflight receipt, touched paths, authority digest,
     focused test output, and reviewer acceptance before fixture search.
3. **S1 — read-only fixture discovery and freeze**
   - search accepted source runs for the method state, both controlled pairs,
     and one real trace-backed serving change;
   - prove every pair invariant and visible-delta condition;
   - review and freeze the ledger, exact parameter values, expected observed
     values, formatter resolutions, and serving-change triplet; and
   - stop before UI implementation if any mandatory fixture is absent.
4. **S2 — pure evidence model**
   - implement evidence resolver, representative-link selector, term map, and
     tests without rendering.
5. **S3 — direct route shell and precomputed first paint**
   - build and check the accepted serializable artifact offline;
   - mount `/explain` with cached artifact loading, explicit pending/refusal
     states, no browser-side TLE/run rebuild, and no navigation entry.
6. **S4 — method-chain scene**
   - reuse the orbital context, local service scene, cross-section, and linked
     formula/value overlay for `angle-to-ee-method-chain-v1`.
7. **S5 — controlled comparison**
   - add accepted reference/probe publication, fixed-scale quantitative marks,
     signed causal deltas, and exact reset for both probes.
8. **S6 — real serving-change story**
   - bind the pinned ADR-006 before/decision/after triplet and prevent all
     candidate-only or synthetic fallbacks.
9. **S7 — deterministic Guided mode**
   - add script reducer, deterministic clock, camera adapter, story/phase stepping,
     authored narration, prediction/reveal gates, and restoration tests.
10. **S8 — Figure Mode**
   - implement all three argument specs, capture readiness,
     PNG/SVG/data/manifest outputs, and accessibility descriptions.
11. **S9 — verification and acceptance**
   - run focused conformance, build, browser, visual, and artifact inspection;
   - inspect every delivered output at original size; and
   - pass `FV-1` and `FVA-figure-v1`, then obtain explicit owner visual
     acceptance before discussing homepage integration.

## 13. Stop conditions

Stop and report the source gap instead of expanding scope when:

- no valid representative link exists in the accepted frame;
- no angle-response or service-target stress pair satisfies exact
  one-parameter,
  same-identity, and visible-difference invariants;
- a controlled pair changes serving/link identity at its comparison anchor;
- a desired serving-change explanation lacks a completed ADR-006 trace event and
  valid after anchor;
- the selected event target is not pass-plan-backed, lacks a validated pass
  source locator, or fails the from/pre-commit/to identity equalities; it may
  not be downgraded to `visible-geometry-fallback`;
- a visual requires a physical footprint, channel field, or interference source
  that the canonical frame does not own;
- a parameter experiment cannot publish a complete rebuilt run;
- a proposed figure would imply calibration, measurement, policy benefit, or
  energy saving not established by current evidence;
- a figure cannot answer its frozen reader question at final size;
- a new writer overlaps current dirty WIP; or
- implementation would require changing homepage product decisions before the
  isolated route is accepted.

## 14. Completion boundary

The vertical slice is complete only when `/explain` can replay the source-backed
method chain, both frozen controlled probes, and one completed ADR-006 serving
change;
permit free inspection of the same accepted evidence; export all three
validated figure bundles; pass focused machine checks, `FV-1`, and
`FVA-figure-v1`; and receive explicit owner visual acceptance without changing
existing product routes or scientific calculations.

At this design snapshot, the aggregate `npm run test:simulator` gate is red at
the pre-existing `channelGainScale` ownership-count assertion, and
`npm run validate:s0:geometry-trace` is red because the checked-in trace differs
from the current generated output; the current snapshot reports 1610
differences. Focused `canonicalTleHandover`, `canonicalLinkResult`, and
`tleAnalysisRun` tests pass, but the first two are not yet included by the
aggregate script and no focused pass makes either aggregate gate green. S0
records the exact commands and outputs, then repairs each maintenance conflict
within its real owner scope before claiming a green baseline. It may not
rebaseline blindly, weaken scientific/runtime semantics, or omit a red gate
from the receipt.

Completion of this slice does not authorize energy-saving claims, Phase-1
platform integration, or homepage replacement. Those remain separate product
and scientific decisions.
