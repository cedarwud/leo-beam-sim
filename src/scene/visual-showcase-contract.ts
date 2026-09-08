/**
 * visual-showcase-v1 contract type re-export.
 *
 * The frozen contract (v1.1, frozen 2026-04-29, owned by ntn-sim-core) is
 * vendored verbatim at `src/core/contracts/visual-showcase-v1.ts` (P2 SN-3a;
 * see that file's vendor header for the source commit). leo-beam-sim must
 * consume those types verbatim; we re-export them here so showcase / scene
 * modules do not embed the contract path everywhere.
 *
 * We use `import type` so this is purely a compile-time dependency with no
 * runtime cost. There is intentionally no value import — the contract file
 * ships runtime constants too, but we deliberately do not re-export them
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
} from '../core/contracts/visual-showcase-v1';
