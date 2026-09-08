/**
 * VENDORED (verbatim) from ntn-sim-core/src/core/contracts/visual-showcase-v1.ts
 *   source repo:   /home/u24/papers/ntn-sim-core
 *   source commit: 0d038d20e6c163de8aa1f85a40592d5688c5d562 (2026-05-22)
 *   vendored:      2026-07-07 (P2 SN-3a — remove cross-repo import so hosted CI tsc passes)
 *
 * Do NOT edit below this header. ntn-sim-core owns this contract (CLAUDE.md §2);
 * changes must land there first and be re-vendored. Everything after this
 * comment block is byte-identical to the source file.
 */
/**
 * visual-showcase-v1 — Frozen visual artifact contract.
 *
 * @version v1.1 additive profile support
 * @frozen 2026-04-29 (visual-showcase-v1-contract-validation-follow-on.md)
 *
 * Consumer boundary:
 *   - future exporters may emit this shape from simulator / producer truth
 *   - future visual frontends may read it as a deterministic artifact
 *
 * Forbidden:
 *   This file must NOT import React, Three.js, @react-three, @/viz, or @/app.
 *   It is a contract surface only; it does not compute SINR, handover,
 *   policy actions, rewards, or display geometry.
 */

export const VISUAL_SHOWCASE_V1_SCHEMA_VERSION = 'visual-showcase-v1' as const;

export const VISUAL_SHOWCASE_V1_PROFILE_VALUES = [
  'baseline-one-ue',
] as const;

export const VISUAL_SHOWCASE_V1_DEFAULT_PROFILE = 'baseline-one-ue' as const;

export const VISUAL_SHOWCASE_V1_CHANNEL_METRIC_KINDS = [
  'snr-no-interference',
  'sinr-with-interference',
  'sinr-intra-beam-only',
] as const;

export const VISUAL_SHOWCASE_V1_COORDINATE_FRAME_KINDS = [
  'ecef-km',
  'eci-km-no-earth-rotation-proxy',
] as const;

export const VISUAL_SHOWCASE_V1_HANDOVER_PHASE_SOURCES = [
  'source',
  'visual-policy',
] as const;

export const VISUAL_SHOWCASE_V1_REQUIRED_SECTIONS = [
  'schemaVersion',
  'artifactId',
  'scenario',
  'provenance',
  'truthOwnership',
  'timebase',
  'entities',
  'timeline',
  'events',
  'series',
  'diagnostics',
  'displayHints',
] as const;

export const VISUAL_SHOWCASE_V1_REQUIRED_TRUTH_OWNERSHIP_FIELDS = [
  'sinr',
  'handover',
  'reward',
  'geometry',
  'provenance',
  'series',
  'display',
] as const;

export const VISUAL_SHOWCASE_V1_ALLOWED_BEAM_ROLES = [
  'serving',
  'prepared',
  'secondary',
  'post-ho',
  'context',
  'inactive',
] as const;

export const VISUAL_SHOWCASE_V1_REQUIRED_SERIES = [
  'sinrDb',
  'reward',
  'actionIndex',
  'servingSatellite',
  'handoverPhase',
] as const;

export const VISUAL_SHOWCASE_V1_EVIDENCE_STATUSES = [
  'baseline',
  'scoped',
  'blocked',
  'not-promoted',
  'validator-only',
] as const;

export const VISUAL_SHOWCASE_V1_REQUIRED_CLAIM_BOUNDARY_FIELDS = [
  'storyKind',
  'allowedClaims',
  'forbiddenClaims',
  'source',
] as const;

export const VISUAL_SHOWCASE_V1_REQUIRED_EVIDENCE_STATUS_FIELDS = [
  'status',
  'notes',
] as const;

export const VISUAL_SHOWCASE_V1_CONTRACT = {
  schemaVersion: VISUAL_SHOWCASE_V1_SCHEMA_VERSION,
  durationRangeSec: { min: 60, max: 120 },
  requiredSections: VISUAL_SHOWCASE_V1_REQUIRED_SECTIONS,
  requiredTruthOwnershipFields: VISUAL_SHOWCASE_V1_REQUIRED_TRUTH_OWNERSHIP_FIELDS,
  requiredEntityGroups: ['satellites', 'ues', 'beams'] as const,
  requiredTimelineFrameFields: [
    'tSec',
    'sourceRefs',
    'satellites',
    'ues',
    'beams',
    'links',
    'handoverState',
    'metrics',
  ] as const,
  requiredSeries: VISUAL_SHOWCASE_V1_REQUIRED_SERIES,
  allowedBeamRoles: VISUAL_SHOWCASE_V1_ALLOWED_BEAM_ROLES,
  evidenceStatuses: VISUAL_SHOWCASE_V1_EVIDENCE_STATUSES,
  requiredClaimBoundaryFields: VISUAL_SHOWCASE_V1_REQUIRED_CLAIM_BOUNDARY_FIELDS,
  requiredEvidenceStatusFields: VISUAL_SHOWCASE_V1_REQUIRED_EVIDENCE_STATUS_FIELDS,
} as const;

export type VisualShowcaseRequiredSection =
  typeof VISUAL_SHOWCASE_V1_REQUIRED_SECTIONS[number];

export type VisualShowcaseTruthOwnershipField =
  typeof VISUAL_SHOWCASE_V1_REQUIRED_TRUTH_OWNERSHIP_FIELDS[number];

export type VisualShowcaseBeamRole =
  typeof VISUAL_SHOWCASE_V1_ALLOWED_BEAM_ROLES[number];

export type VisualShowcaseSeriesName =
  typeof VISUAL_SHOWCASE_V1_REQUIRED_SERIES[number];

export type VisualShowcaseEvidenceStatusValue =
  typeof VISUAL_SHOWCASE_V1_EVIDENCE_STATUSES[number];

export type VisualShowcaseProfile =
  typeof VISUAL_SHOWCASE_V1_PROFILE_VALUES[number];

export type VisualShowcaseChannelMetricKind =
  typeof VISUAL_SHOWCASE_V1_CHANNEL_METRIC_KINDS[number];

export type VisualShowcaseCoordinateFrameKind =
  typeof VISUAL_SHOWCASE_V1_COORDINATE_FRAME_KINDS[number];

export type VisualShowcaseHandoverPhaseSource =
  typeof VISUAL_SHOWCASE_V1_HANDOVER_PHASE_SOURCES[number];

export type VisualShowcaseTruthOwner =
  | 'ntn-sim-core'
  | 'external-producer'
  | 'leo-beam-sim'
  | 'synthetic-validator-fixture';

export interface VisualShowcaseScenario {
  id: string;
  /**
   * Optional for v1.0 compatibility. Validators treat omitted profile as
   * baseline-one-ue.
   */
  profile?: VisualShowcaseProfile;
  title: string;
  description: string;
  durationSec: number;
  defaultStartSec: number;
  defaultPlaybackSpeed: number;
  coordinateFrame: string;
  storyKind: string;
  truthMode: string;
}

export interface VisualShowcaseSourceRepo {
  repoId: 'ntn-sim-core' | string;
  path: string;
  commit: string;
}

export interface VisualShowcaseSourceArtifact {
  id: string;
  repoId: string;
  path: string;
  role: string;
  truthFields: VisualShowcaseTruthOwnershipField[];
}

export interface VisualShowcaseSourceSchema {
  id: string;
  version: string;
  role: string;
  path: string;
}

export interface VisualShowcaseValidationMetadata {
  validator: string;
  status: string;
  checkedAt: string;
  notes: string[];
}

export interface VisualShowcaseClaimBoundary {
  storyKind: string;
  allowedClaims: string[];
  forbiddenClaims: string[];
  source: string;
}

export interface VisualShowcaseEvidenceStatus {
  status: VisualShowcaseEvidenceStatusValue | string;
  notes: string[];
}

export interface VisualShowcaseAssumption {
  id: string;
  description: string;
}

export interface VisualShowcaseFieldProvenance {
  source: string;
  note: string;
  displayOnly?: boolean;
  policy?: string;
}

export interface VisualShowcaseProvenance {
  generatedAt: string;
  producer: {
    name: string;
    mode: string;
  };
  sourceRepos: VisualShowcaseSourceRepo[];
  ntnSimCoreCommit: string;
  sourceCommits: Record<string, string>;
  sourceArtifactIds: string[];
  sourceArtifacts: VisualShowcaseSourceArtifact[];
  sourceSchemas: VisualShowcaseSourceSchema[];
  validation: VisualShowcaseValidationMetadata;
  claimBoundary: VisualShowcaseClaimBoundary;
  evidenceStatus: VisualShowcaseEvidenceStatus;
  assumptions: VisualShowcaseAssumption[];
}

export interface VisualShowcaseTruthOwnershipRecord {
  owner: VisualShowcaseTruthOwner;
  sourceArtifacts: string[];
  sourcePaths: string[];
  note: string;
  channelMetricKind?: VisualShowcaseChannelMetricKind;
  channelMetricFormula?: string;
}

export type VisualShowcaseTruthOwnership = Record<
  VisualShowcaseTruthOwnershipField,
  VisualShowcaseTruthOwnershipRecord
>;

export interface VisualShowcaseTimebase {
  sampleHz: number;
  startEpochIso: string;
  timesSec: number[];
  timeMode: string;
  sourceTimeOffsetSec: number;
  sourceSlotIndexBySample: number[];
}

export interface VisualShowcaseSatelliteEntity {
  id: string;
  sourceId: string;
  label: string;
  shellId: string;
  roleHints: string[];
}

export interface VisualShowcaseUeEntity {
  id: string;
  sourceId: string;
  label: string;
  trajectoryKind: string;
}

export interface VisualShowcaseBeamEntity {
  id: string;
  sourceId: string;
  satelliteId: string;
  localBeamIndex: number;
  label: string;
  frequencyReuseGroup: string | null;
  frequencyReuseProvenance?: VisualShowcaseFieldProvenance;
  halfAngleDeg: number;
}

export interface VisualShowcaseEntities {
  satellites: VisualShowcaseSatelliteEntity[];
  ues: VisualShowcaseUeEntity[];
  beams: VisualShowcaseBeamEntity[];
}

export interface VisualShowcaseGeoPoint {
  latDeg: number;
  lonDeg: number;
  altKm?: number;
}

export interface VisualShowcaseFrameSourceRef {
  sourceArtifactId: string;
  sourcePath: string;
  sourceSlotIndex: number;
}

export interface VisualShowcaseFrameSourceRefs {
  sourceSlotIndex: number;
  sources: VisualShowcaseFrameSourceRef[];
}

export interface VisualShowcaseSatelliteSample {
  id: string;
  positionEcefKm: [number, number, number];
  coordinateFrameKind?: VisualShowcaseCoordinateFrameKind;
  positionProvenance?: VisualShowcaseFieldProvenance;
  geo: VisualShowcaseGeoPoint;
  visible: boolean;
  displayRole: string;
}

export interface VisualShowcaseUeSample {
  id: string;
  geo: VisualShowcaseGeoPoint;
  servingSatelliteId: string;
  servingBeamId: string;
  targetSatelliteId?: string | null;
  targetBeamId?: string | null;
  sinrDb: number;
  candidateSinrDbByBeamId?: Record<string, number>;
  decisionRef?: string;
}

export interface VisualShowcaseBeamSample {
  id: string;
  satelliteId: string;
  role: VisualShowcaseBeamRole;
  center: VisualShowcaseGeoPoint;
  footprintKm: number;
  gainDb?: number | null;
  gainProvenance?: VisualShowcaseFieldProvenance;
}

export interface VisualShowcaseLinkSample {
  id: string;
  sourceId: string;
  targetId: string;
  beamId: string;
  role: string;
  sinrDb: number;
  rsrpDbm?: number;
}

export interface VisualShowcaseHandoverState {
  kind?: string;
  phase: string;
  phaseSource?: VisualShowcaseHandoverPhaseSource;
  sourceHandoverOccurred?: boolean;
  handoverProvenance?: VisualShowcaseFieldProvenance;
  servingSatelliteId: string;
  servingBeamId: string;
  targetSatelliteId?: string | null;
  targetBeamId?: string | null;
}

export interface VisualShowcaseFrameMetrics {
  primarySinrDb: number;
  servingSinrDb: number;
  candidateSinrDbByBeamId?: Record<string, number>;
  servingSatelliteId: string;
  servingBeamId: string;
  throughputMbps: number;
  rewardScalar: number;
  rewardVector: Record<string, number>;
}

interface RetiredDecisionCompatibility {
  actionIndex: number;
  actionLabel: string;
  previousSatelliteId: string;
  previousBeamId: string;
  selectedSatelliteId: string;
  selectedBeamId: string;
  validActionCount: number;
  selectedActionScore: number;
  runnerUpActionScore: number | null;
  scoreMargin: number | null;
  decisionActionValidityMask?: boolean[];
  diagnosticsRef: string;
}

export type VisualShowcaseModqnDecision = RetiredDecisionCompatibility;

export interface VisualShowcaseTimelineFrame {
  tSec: number;
  sourceRefs: VisualShowcaseFrameSourceRefs;
  satellites: VisualShowcaseSatelliteSample[];
  ues: VisualShowcaseUeSample[];
  beams: VisualShowcaseBeamSample[];
  links: VisualShowcaseLinkSample[];
  handoverState: VisualShowcaseHandoverState;
  metrics: VisualShowcaseFrameMetrics;
  /** Compatibility field retained until the replay consumer is removed. */
  modqnDecision?: VisualShowcaseModqnDecision;
}

export interface VisualShowcaseEvent {
  id: string;
  type:
    | 'handover-prepared'
    | 'handover-dual-active'
    | 'handover-committed'
    | 'rl-action'
    | 'reward-change'
    | string;
  tSec: number;
  title: string;
  entityRefs: string[];
  truthRefs: string[];
}

export interface VisualShowcaseSeries<TValue = number | string> {
  source: string;
  timesSec: number[];
  values: TValue[];
}

export interface VisualShowcaseSeriesBundle {
  sinrDb: VisualShowcaseSeries<number>;
  reward: VisualShowcaseSeries<number>;
  actionIndex: VisualShowcaseSeries<number>;
  servingSatellite: VisualShowcaseSeries<string>;
  handoverPhase: VisualShowcaseSeries<string>;
  [key: string]: VisualShowcaseSeries<number | string>;
}

export interface VisualShowcaseDiagnostics {
  policyName: string;
  objectiveWeights: Record<string, number>;
  actionScoreKind: string;
  stateFeatures: string[];
  actionLabels: string[];
  actionScores: VisualShowcaseSeries<number[]>;
  selectedAction: VisualShowcaseSeries<number>;
  rewardComponents: Record<string, VisualShowcaseSeries<number>>;
  decisionFrames: VisualShowcaseDecisionFrame[];
}

export interface VisualShowcaseDecisionFrame {
  id: string;
  tSec: number;
  ueId?: string;
  sourceUserIndex?: number;
  actionScores: number[];
  selectedActionIndex: number;
  selectedActionScore: number;
  runnerUpActionScore: number | null;
  scoreMargin: number | null;
  decisionActionValidityMask?: boolean[];
}

export interface VisualShowcaseDisplayHints {
  cameraPath?: unknown;
  labelPriorities?: unknown;
  roleStyles?: unknown;
  panels?: unknown;
  [key: string]: unknown;
}

export interface VisualShowcaseArtifact {
  schemaVersion: typeof VISUAL_SHOWCASE_V1_SCHEMA_VERSION;
  artifactId: string;
  scenario: VisualShowcaseScenario;
  provenance: VisualShowcaseProvenance;
  truthOwnership: VisualShowcaseTruthOwnership;
  timebase: VisualShowcaseTimebase;
  entities: VisualShowcaseEntities;
  timeline: VisualShowcaseTimelineFrame[];
  events: VisualShowcaseEvent[];
  series: VisualShowcaseSeriesBundle;
  diagnostics: VisualShowcaseDiagnostics;
  displayHints: VisualShowcaseDisplayHints;
}
