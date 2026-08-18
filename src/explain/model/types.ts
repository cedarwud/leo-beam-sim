import type {
  CanonicalTleHandoverAnchorTrace,
  CanonicalTleServingChangeEvidence,
} from '../../simulator/canonicalTleHandover';
import type { TleAnalysisRun } from '../../simulator/tleAnalysisRun';
import type {
  CandidateComparisonRole,
  SimulationAnalysisFrame,
  SimulatorParameters,
} from '../../simulator/types';

export type CausalProbeId = 'angle-response-v1' | 'service-target-stress-v1';
export type ScientificFixtureId =
  | 'method-state-v1'
  | CausalProbeId
  | 'serving-change-v1';

export interface ScientificLinkIdentity {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly userIndex: number;
  readonly userId: string;
}

export type RepresentativeLinkSelection =
  | {
      readonly status: 'available';
      readonly selectorVersion: 'representative-link-v2';
      readonly satelliteId: string;
      readonly beamId: number;
      readonly userIndex: number;
      readonly userId: string;
      readonly thetaRad: number;
      readonly rateBps: number;
    }
  | {
      readonly status: 'unavailable';
      readonly selectorVersion: 'representative-link-v2';
      readonly reason: string;
    };

export type PairRepresentativeLinkSelection =
  | (Extract<RepresentativeLinkSelection, { readonly status: 'available' }> & {
      readonly probeThetaRad: number;
      readonly probeRateBps: number;
    })
  | Extract<RepresentativeLinkSelection, { readonly status: 'unavailable' }>;

export interface CoordinateFrameDisclosure {
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

export interface SceneCompositionDisclosure {
  readonly serviceSatelliteId: string;
  readonly activeServiceBeamIds: readonly number[];
  readonly activeSatelliteOwnerIds: readonly [string];
  readonly activeSatelliteOwnerCount: 1;
  readonly activeBeamCount: 7;
  readonly multiSatelliteActiveBeamClaim: 'not-claimed';
  readonly candidateBeamMode: 'none' | 'counterfactual-display-only';
  readonly candidateComparison: CandidateComparisonRole;
  readonly contextSatelliteIds: readonly string[];
  readonly contextSelectionRuleId: 'same-frame-first-six-by-id-context-only-v1';
  readonly beamOwnershipSource: 'frame.scenario.beamSatelliteB';
  readonly contextBeamCount: 0;
  readonly footprintClaim: 'uncalibrated-scenario-substrate';
}

export interface ExplanatoryEvidence {
  readonly run: TleAnalysisRun;
  readonly anchorIndex: number;
  readonly frame: SimulationAnalysisFrame;
  readonly nextFrame: SimulationAnalysisFrame | null;
  readonly representativeLink: Extract<RepresentativeLinkSelection, { readonly status: 'available' }>;
  readonly handoverAnchor: CanonicalTleHandoverAnchorTrace | null;
  readonly coordinateFrames: CoordinateFrameDisclosure;
  readonly sceneComposition: SceneCompositionDisclosure;
}

export type CanonicalTermKey =
  | 'theta'
  | 'transmitGain'
  | 'receiveGain'
  | 'largeScaleGain'
  | 'ricianGain'
  | 'rawH'
  | 'hDiv'
  | 'minimumRate'
  | 'beamLoad'
  | 'beamBandwidth'
  | 'gammaReq'
  | 'laggedInterference'
  | 'pReqUser'
  | 'pReqBeam'
  | 'beamPowerCap'
  | 'satellitePowerCap'
  | 'preSatelliteCapPower'
  | 'actualBeamRf'
  | 'signal'
  | 'intraSatelliteInterference'
  | 'interSatelliteInterference'
  | 'interference'
  | 'noise'
  | 'sinr'
  | 'representativeRate'
  | 'totalRate'
  | 'paEfficiency'
  | 'paPower'
  | 'rfcPower'
  | 'basebandPower'
  | 'eventPower'
  | 'systemPower'
  | 'eeInst'
  | 'eeEval'
  | 'p0';

export interface CanonicalTermContext {
  readonly run: TleAnalysisRun;
  readonly frame: SimulationAnalysisFrame;
  readonly identity: ScientificLinkIdentity;
}

export type CanonicalTermValue =
  | { readonly status: 'available'; readonly unit: string; readonly value: number }
  | { readonly status: 'unavailable'; readonly unit: string; readonly reason: string };

export type SceneEntityKey = string;

export interface CanonicalTermDefinition {
  readonly key: CanonicalTermKey;
  readonly thesisSymbol: string;
  readonly label: string;
  readonly unit: string;
  readonly sourceSelector: (evidence: ExplanatoryEvidence) => CanonicalTermValue;
  readonly sceneTargets: (evidence: ExplanatoryEvidence) => readonly SceneEntityKey[];
  readonly dependencies: readonly CanonicalTermKey[];
  readonly dependents: readonly CanonicalTermKey[];
  readonly unavailableReason?: (evidence: ExplanatoryEvidence) => string | null;
}

export interface CanonicalCausalEdgeDefinition {
  readonly edgeId: string;
  readonly sourceTerm: CanonicalTermKey;
  readonly operationOrConstraint: string;
  readonly targetTerm: CanonicalTermKey;
  readonly sourceLocator: string;
  readonly referenceSelector: (pair: CausalProbeEvidence) => CanonicalTermValue;
  readonly probeSelector: (pair: CausalProbeEvidence) => CanonicalTermValue;
  readonly unit: string;
  readonly allowedRelationship:
    | 'increase'
    | 'decrease'
    | 'unchanged'
    | 'fixture-observed-no-universal-direction';
}

export interface CanonicalTermDelta {
  readonly term: CanonicalTermKey;
  readonly unit: string;
  readonly referenceValue: number;
  readonly probeValue: number;
  readonly signedDelta: number;
  readonly relativeDeltaRatio: number | null;
  readonly direction: 'increase' | 'decrease' | 'unchanged';
}

export interface ProbeControl {
  readonly parameterKey: keyof SimulatorParameters;
  readonly unit: string;
  readonly referenceValue: number;
  readonly probeValue: number;
}

export interface CausalProbeCapChecks {
  readonly capToleranceW: number | null;
  readonly allBeamCapsNonBinding: boolean | null;
  readonly satelliteCapNonBinding: boolean | null;
  readonly allSatelliteScalesOne: boolean | null;
  readonly allUsersNotPowerLimited: boolean | null;
  readonly allNonBinding: boolean;
}

export type EeEvalAvailability =
  | {
      readonly status: 'included';
      readonly referenceValue: number;
      readonly probeValue: number;
      readonly unit: 'bit/J';
    }
  | { readonly status: 'excluded'; readonly reason: string };

export interface CausalProbeEvidence {
  readonly fixtureId: CausalProbeId;
  readonly probeId: CausalProbeId;
  readonly control: ProbeControl;
  readonly identity: ScientificLinkIdentity;
  readonly reference: ExplanatoryEvidence;
  readonly probe: ExplanatoryEvidence;
  readonly capChecks: CausalProbeCapChecks;
  readonly eeEval: EeEvalAvailability;
}

export interface ServingChangeStoryPoint extends ExplanatoryEvidence {
  readonly quantitativeFrameRole:
    | 'before-completed-frame'
    | 'post-commit-trigger-frame'
    | 'after-completed-frame';
}

export interface ServingChangeStoryEvidence {
  readonly fixtureId: 'serving-change-v1';
  readonly eventKind: 'offset-ttt' | 'forced-continuity';
  readonly sourceEvent: 'inter-handover' | 'forced-continuity';
  readonly sourceEventEvidence: CanonicalTleServingChangeEvidence;
  readonly before: ServingChangeStoryPoint;
  readonly decision: ServingChangeStoryPoint;
  readonly after: ServingChangeStoryPoint;
}

export interface ScientificStoryEvidence {
  readonly methodState: ExplanatoryEvidence;
  readonly angleResponse: CausalProbeEvidence;
  readonly serviceTargetStress: CausalProbeEvidence;
  readonly servingChange: ServingChangeStoryEvidence;
}

export type ScientificStoryEvidenceResult =
  | { readonly status: 'available'; readonly evidence: ScientificStoryEvidence }
  | {
      readonly status: 'unavailable';
      readonly fixtureId: ScientificFixtureId;
      readonly reason: string;
      readonly recovery: string;
    };

export interface SourceFixtureManifest {
  readonly constellation: 'oneweb' | 'starlink';
  readonly archiveId: string;
  readonly archiveContentSha256: string;
  readonly archiveDate: string;
  readonly snapshotPath: string;
  readonly selectedTleSha256: string;
  readonly requestedInstantUtc: string;
  readonly sourceKind: 'ARCHIVED_TLE';
  readonly propagationModel: 'SGP4';
  readonly geometryRunId: string;
}

export interface MethodFixtureManifest {
  readonly fixtureId: 'method-state-v1';
  readonly anchorIndex: number;
  readonly analysisRunId: string;
  readonly frameId: string;
  readonly identity: ScientificLinkIdentity;
  readonly expectedTerms: Readonly<Partial<Record<CanonicalTermKey, number>>>;
  readonly expectedEvaluation: {
    readonly evaluationBitsPerJ: number;
    readonly deliveredBits: number;
    readonly consumedEnergyJ: number;
    readonly durationS: 7200;
    readonly sampleCount: 240;
    readonly aggregation: 'ratio-of-sums';
  };
}

export interface ProbeFixtureManifest {
  readonly fixtureId: CausalProbeId;
  readonly anchorIndex: number;
  readonly referenceAnalysisRunId: string;
  readonly probeAnalysisRunId: string;
  readonly referenceFrameId: string;
  readonly probeFrameId: string;
  readonly referenceParameterDigest: string;
  readonly probeParameterDigest: string;
  readonly identity: ScientificLinkIdentity;
  readonly control: ProbeControl;
  readonly capToleranceW: number | null;
  readonly eeEvalPolicy: 'exclude-frame-scoped' | 'include-only-if-full-sequence-equal';
  readonly expectedReferenceTerms: Readonly<Partial<Record<CanonicalTermKey, number>>>;
  readonly expectedProbeTerms: Readonly<Partial<Record<CanonicalTermKey, number>>>;
}

export interface ServingChangeFixtureManifest {
  readonly fixtureId: 'serving-change-v1';
  readonly analysisRunId: string;
  readonly traceDigest: string;
  readonly eventId: string;
  readonly sourceEvent: 'inter-handover' | 'forced-continuity';
  readonly beforeAnchorIndex: number;
  readonly decisionAnchorIndex: number;
  readonly afterAnchorIndex: number;
  readonly beforeFrameId: string;
  readonly decisionFrameId: string;
  readonly afterFrameId: string;
}

export interface ScientificFixtureManifest {
  readonly schemaVersion: 'scientific-fixture-manifest-v1';
  readonly status: 'ACCEPTED';
  readonly acceptedBy: string;
  readonly acceptedAtUtc: string;
  readonly source: SourceFixtureManifest;
  readonly referenceParameters: SimulatorParameters;
  readonly fixtures: {
    readonly method: MethodFixtureManifest;
    readonly angleResponse: ProbeFixtureManifest & { readonly fixtureId: 'angle-response-v1' };
    readonly serviceTargetStress: ProbeFixtureManifest & { readonly fixtureId: 'service-target-stress-v1' };
    readonly servingChange: ServingChangeFixtureManifest;
  };
  readonly negativeFixtureIds: readonly ['target-reset-no-event-v1', 'failed-rebuild-v1'];
  readonly secondarySource: {
    readonly fixtureId: 'constellation-switch-starlink-v1';
    readonly constellation: 'starlink';
    readonly archiveId: string;
    readonly archiveContentSha256: string;
    readonly archiveDate: string;
    readonly snapshotPath: string;
    readonly selectedTleSha256: string;
    readonly requestedInstantUtc: string;
    readonly selectedSatelliteId: string;
    readonly selectedTleEpochUtc: string;
    readonly tleFrameId: string;
    readonly singleFrameId: string;
    readonly geometryRunId: string;
    readonly analysisRunId: string;
    readonly satelliteCount: number;
    readonly passCount: number;
    readonly unavailableAnchorCount: 0;
    readonly claimBoundary: 'constellation-switch-only-not-performance-comparison';
  };
}

export interface ResolveScientificStoryEvidenceInput {
  readonly manifest: ScientificFixtureManifest;
  readonly referenceRun: TleAnalysisRun;
  readonly angleProbeRun: TleAnalysisRun | null;
  readonly serviceTargetProbeRun: TleAnalysisRun | null;
}
