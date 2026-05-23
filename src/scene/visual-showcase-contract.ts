/**
 * visual-showcase-v1 contract type re-export.
 *
 * The frozen contract lives in `ntn-sim-core/src/core/contracts/visual-showcase-v1.ts`
 * (v1.1, frozen 2026-04-29). leo-beam-sim must consume those types verbatim;
 * we re-export them here so showcase / scene modules do not embed the absolute
 * path everywhere.
 *
 * `tsconfig.json` `moduleResolution: bundler` allows relative imports outside
 * `src/`; we use `import type` so this is purely a compile-time dependency
 * with no runtime cost. There is intentionally no value import — the contract
 * file ships runtime constants too, but we deliberately do not re-export them
 * here because the schema-gate code in `loadShowcaseArtifact` needs them via a
 * direct value import (see that file).
 *
 * No imports from `core/channel`, `core/beam`, `runtimeFrameStep`, or
 * `HandoverManager`.
 */

export type {
  VisualShowcaseArtifact,
  VisualShowcaseBeamEntity,
  VisualShowcaseBeamRole,
  VisualShowcaseBeamSample,
  VisualShowcaseChannelMetricKind,
  VisualShowcaseClaimBoundary,
  VisualShowcaseCoordinateFrameKind,
  VisualShowcaseDecisionFrame,
  VisualShowcaseDiagnostics,
  VisualShowcaseDisplayHints,
  VisualShowcaseEntities,
  VisualShowcaseEvent,
  VisualShowcaseEvidenceStatus,
  VisualShowcaseFieldProvenance,
  VisualShowcaseFrameMetrics,
  VisualShowcaseFrameSourceRefs,
  VisualShowcaseGeoPoint,
  VisualShowcaseHandoverPhaseSource,
  VisualShowcaseHandoverState,
  VisualShowcaseLinkSample,
  VisualShowcaseModqnDecision,
  VisualShowcaseProfile,
  VisualShowcaseProvenance,
  VisualShowcaseSatelliteEntity,
  VisualShowcaseSatelliteSample,
  VisualShowcaseScenario,
  VisualShowcaseSeries,
  VisualShowcaseSeriesBundle,
  VisualShowcaseTimebase,
  VisualShowcaseTimelineFrame,
  VisualShowcaseTruthOwner,
  VisualShowcaseTruthOwnership,
  VisualShowcaseTruthOwnershipField,
  VisualShowcaseTruthOwnershipRecord,
  VisualShowcaseUeEntity,
  VisualShowcaseUeSample,
} from '../../../../ntn-sim-core/src/core/contracts/visual-showcase-v1';
