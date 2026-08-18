import type { HomepageCanonicalEvaluation } from '../../ui/signal-tuning/useHomepageCanonicalAnalysis';
import type {
  CanonicalTleHandoverAnchorTrace,
  CanonicalTleHandoverEvent,
  CanonicalTleHandoverState,
} from '../../simulator/canonicalTleHandover';
import type { CanonicalLinkResult, SimulationAnalysisFrame } from '../../simulator/types';

/**
 * Canonical read model for the visual-lab surface.
 *
 * This module is intentionally a pure boundary adapter.  It does not select
 * a satellite, rerun a formula, derive a fallback candidate, or mutate the
 * accepted frame/evaluation.  The visual lab can therefore replace its mock
 * snapshot with this object without acquiring a second scientific state.
 */

export const VISUAL_LAB_CANONICAL_SNAPSHOT_SCHEMA = 'visual-lab-canonical-snapshot-v1' as const;

export type VisualLabCanonicalAvailability = 'available' | 'unavailable';

export interface VisualLabCanonicalLinkSnapshot {
  readonly availability: VisualLabCanonicalAvailability;
  /** Known only when the source frame exposes a real identity. */
  readonly satelliteId: string | null;
  readonly beamId: number | null;
  readonly userId: string | null;
  readonly sinrLinear: number | null;
  readonly sinrDb: number | null;
  readonly requestedPowerW: number | null;
  readonly actualPowerW: number | null;
  readonly beforeSatelliteCapPowerW?: number | null;
  readonly signalW?: number | null;
  readonly intraSatelliteInterferenceW?: number | null;
  readonly interSatelliteInterferenceW?: number | null;
  readonly interferenceW?: number | null;
  readonly noiseW?: number | null;
  readonly throughputBps: number | null;
  readonly instantaneousEeBitsPerJ: number | null;
  readonly offAxisAngleRad?: number | null;
  readonly transmitGainLinear?: number | null;
  readonly compositeGainLinear?: number | null;
  readonly distanceKm: number | null;
  readonly elevationDeg: number | null;
  readonly qosMet?: boolean | null;
  readonly powerLimited?: boolean | null;
  readonly reason: string | null;
}

export interface VisualLabCanonicalEvaluationSnapshot {
  readonly availability: VisualLabCanonicalAvailability;
  readonly source: 'homepage-canonical-evaluation' | 'unavailable';
  readonly deliveredBits: number | null;
  readonly consumedEnergyJ: number | null;
  readonly energyEfficiencyBitsPerJ: number | null;
  readonly durationSec: number | null;
}

export interface VisualLabCanonicalHandoverSnapshot {
  readonly availability: VisualLabCanonicalAvailability;
  readonly state: CanonicalTleHandoverState | null;
  readonly event: CanonicalTleHandoverEvent | null;
  readonly offsetDb: number | null;
  readonly tttSec: number | null;
  readonly progressSec: number | null;
  readonly ratio: number | null;
  readonly cumulativeCount: number | null;
  readonly reason: string | null;
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly deltaDb: number | null;
  readonly eventFromSatelliteId: string | null;
  readonly eventToSatelliteId: string | null;
}

export interface VisualLabCanonicalTimelineAnchor {
  readonly availability: VisualLabCanonicalAvailability;
  readonly instantUtc: string;
  readonly anchorIndex: number | null;
  readonly anchorCount: number | null;
  readonly elapsedSec: number | null;
  readonly durationSec: number | null;
  readonly stepSec: number | null;
  readonly servingSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly servingPassId: string | null;
  readonly candidatePassId: string | null;
}

export interface VisualLabCanonicalSourceIdentity {
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly instantUtc: string;
  readonly instantTaipei: string;
  readonly tleEpochUtc: string;
  readonly selectedSatelliteId: string | null;
  readonly constellation: SimulationAnalysisFrame['provenance']['constellation'];
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly selectedTlePath: string;
  readonly sourceKind: SimulationAnalysisFrame['provenance']['sourceKind'];
  readonly propagationModel: SimulationAnalysisFrame['provenance']['propagationModel'];
  readonly contractVersion: SimulationAnalysisFrame['contractVersion'];
}

export interface VisualLabCanonicalSnapshot {
  readonly schemaVersion: typeof VISUAL_LAB_CANONICAL_SNAPSHOT_SCHEMA;
  readonly isMock: false;
  readonly source: VisualLabCanonicalSourceIdentity;
  readonly timeline: VisualLabCanonicalTimelineAnchor;
  readonly serving: VisualLabCanonicalLinkSnapshot;
  readonly candidate: VisualLabCanonicalLinkSnapshot;
  readonly deltaSinrDb: number | null;
  readonly throughput: {
    readonly servingRateBps: number | null;
    readonly candidateRateBps: number | null;
    readonly totalRateBps: number | null;
    readonly cumulativeDeliveredBits: number | null;
    readonly minimumRateBps?: number | null;
    readonly systemBandwidthHz?: number | null;
    readonly beamBandwidthHz?: number | null;
    readonly frequencyReuse?: number | null;
  };
  readonly power: {
    readonly servingActualPowerW: number | null;
    readonly candidateActualPowerW: number | null;
    readonly systemPowerW: number | null;
    readonly cumulativeConsumedEnergyJ: number | null;
    readonly servingRequestedPowerW?: number | null;
    readonly servingBeforeSatelliteCapPowerW?: number | null;
    readonly servingPaEfficiency?: number | null;
    readonly servingPaInputPowerW?: number | null;
    readonly servingRfcPowerW?: number | null;
    readonly servingBasebandPowerW?: number | null;
    readonly servingEventPowerW?: number | null;
    readonly servingTotalPowerW?: number | null;
    readonly activeBeamCount?: number | null;
    readonly activeSatelliteCount?: number | null;
  };
  readonly ee: {
    readonly instantaneousBitsPerJ: number | null;
    readonly cumulativeBitsPerJ: number | null;
  };
  readonly evaluation: VisualLabCanonicalEvaluationSnapshot;
  readonly handover: VisualLabCanonicalHandoverSnapshot;
}

export interface VisualLabCanonicalSnapshotAdapterInput {
  /** One immutable accepted frame; this adapter never alters it. */
  readonly frame: SimulationAnalysisFrame;
  /** Homepage session ratio-of-sums evaluation; null means unavailable. */
  readonly evaluation: HomepageCanonicalEvaluation | null;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function linkSnapshot(
  link: CanonicalLinkResult | null,
  identity: string | null,
  unavailableReason: string | null,
  diagnostics?: {
    readonly intraSatelliteInterferenceW?: number;
    readonly interSatelliteInterferenceW?: number;
    readonly transmitGainLinear?: number;
    readonly compositeGainLinear?: number;
  },
): VisualLabCanonicalLinkSnapshot {
  if (link === null) {
    return freeze({
      availability: 'unavailable',
      satelliteId: identity,
      beamId: null,
      userId: null,
      sinrLinear: null,
      sinrDb: null,
      requestedPowerW: null,
      actualPowerW: null,
      beforeSatelliteCapPowerW: null,
      signalW: null,
      intraSatelliteInterferenceW: null,
      interSatelliteInterferenceW: null,
      interferenceW: null,
      noiseW: null,
      throughputBps: null,
      instantaneousEeBitsPerJ: null,
      offAxisAngleRad: null,
      transmitGainLinear: null,
      compositeGainLinear: null,
      distanceKm: null,
      elevationDeg: null,
      qosMet: null,
      powerLimited: null,
      reason: unavailableReason,
    });
  }
  return freeze({
    availability: 'available',
    satelliteId: textOrNull(link.satelliteId),
    beamId: Number.isInteger(link.beamId) ? link.beamId : null,
    userId: textOrNull(link.userId),
    sinrLinear: finiteOrNull(link.sinrLinear),
    sinrDb: finiteOrNull(link.sinrDb),
    requestedPowerW: finiteOrNull(link.requestedPowerW),
    actualPowerW: finiteOrNull(link.actualPowerW),
    beforeSatelliteCapPowerW: finiteOrNull(link.beforeSatelliteCapPowerW),
    signalW: finiteOrNull(link.signalW),
    intraSatelliteInterferenceW: finiteOrNull(diagnostics?.intraSatelliteInterferenceW),
    interSatelliteInterferenceW: finiteOrNull(diagnostics?.interSatelliteInterferenceW),
    interferenceW: finiteOrNull(link.interferenceW),
    noiseW: finiteOrNull(link.noiseW),
    throughputBps: finiteOrNull(link.rateBps),
    instantaneousEeBitsPerJ: finiteOrNull(link.instantaneousEeBitsPerJ),
    offAxisAngleRad: finiteOrNull(link.offAxisAngleRad),
    transmitGainLinear: finiteOrNull(diagnostics?.transmitGainLinear),
    compositeGainLinear: finiteOrNull(diagnostics?.compositeGainLinear),
    distanceKm: finiteOrNull(link.distanceKm),
    elevationDeg: finiteOrNull(link.elevationDeg),
    qosMet: link.qosMet,
    powerLimited: link.powerLimited,
    reason: null,
  });
}

function vectorValue(values: readonly number[], index: number | undefined): number | null {
  if (index === undefined || !Number.isInteger(index)) return null;
  return finiteOrNull(values[index]);
}

function evaluationSnapshot(
  evaluation: HomepageCanonicalEvaluation | null,
): VisualLabCanonicalEvaluationSnapshot {
  if (evaluation === null) {
    return freeze({
      availability: 'unavailable',
      source: 'unavailable',
      deliveredBits: null,
      consumedEnergyJ: null,
      energyEfficiencyBitsPerJ: null,
      durationSec: null,
    });
  }
  return freeze({
    availability: 'available',
    source: 'homepage-canonical-evaluation',
    deliveredBits: finiteOrNull(evaluation.deliveredBits),
    consumedEnergyJ: finiteOrNull(evaluation.consumedEnergyJ),
    energyEfficiencyBitsPerJ: finiteOrNull(evaluation.energyEfficiencyBitsPerJ),
    durationSec: finiteOrNull(evaluation.durationSec),
  });
}

function handoverSnapshot(
  trace: CanonicalTleHandoverAnchorTrace | undefined,
): VisualLabCanonicalHandoverSnapshot {
  if (trace === undefined) {
    return freeze({
      availability: 'unavailable',
      state: null,
      event: null,
      offsetDb: null,
      tttSec: null,
      progressSec: null,
      ratio: null,
      cumulativeCount: null,
      reason: 'accepted canonical handover trace is unavailable at this frame',
      servingSatelliteId: null,
      candidateSatelliteId: null,
      deltaDb: null,
      eventFromSatelliteId: null,
      eventToSatelliteId: null,
    });
  }
  return freeze({
    availability: 'available',
    state: trace.state,
    event: trace.event,
    offsetDb: finiteOrNull(trace.offsetDb),
    tttSec: finiteOrNull(trace.tttSec),
    progressSec: finiteOrNull(trace.progressSec),
    ratio: finiteOrNull(trace.ratio),
    cumulativeCount: Number.isInteger(trace.cumulativeCount) ? trace.cumulativeCount : null,
    reason: textOrNull(trace.reason),
    servingSatelliteId: textOrNull(trace.servingSatelliteId),
    candidateSatelliteId: textOrNull(trace.candidateSatelliteId),
    deltaDb: finiteOrNull(trace.deltaDb),
    eventFromSatelliteId: textOrNull(trace.eventFromSatelliteId),
    eventToSatelliteId: textOrNull(trace.eventToSatelliteId),
  });
}

function timelineAnchor(
  frame: SimulationAnalysisFrame,
  trace: CanonicalTleHandoverAnchorTrace | undefined,
): VisualLabCanonicalTimelineAnchor {
  const runAnchor = frame.runAnchor ?? frame.tleState.runAnchor;
  const anchorIndex = trace?.anchorIndex ?? runAnchor?.anchorIndex ?? null;
  const anchorCount = trace === undefined
    ? runAnchor?.anchorCount ?? null
    : trace.anchorIndex >= 0 ? runAnchor?.anchorCount ?? null : null;
  return freeze({
    availability: anchorIndex !== null && anchorCount !== null ? 'available' : 'unavailable',
    instantUtc: frame.instantUtc,
    anchorIndex,
    anchorCount,
    elapsedSec: finiteOrNull(runAnchor?.elapsedSec ?? (trace === undefined ? null : null)),
    durationSec: finiteOrNull(runAnchor?.durationSec),
    stepSec: finiteOrNull(runAnchor?.stepSec),
    servingSatelliteId: textOrNull(trace?.servingSatelliteId ?? frame.selectedSatelliteId),
    candidateSatelliteId: textOrNull(trace?.candidateSatelliteId ?? frame.candidateComparison.satelliteId),
    servingPassId: textOrNull(runAnchor?.servingPassId),
    candidatePassId: textOrNull(runAnchor?.candidatePassId),
  });
}

/**
 * Map one accepted frame plus the accepted homepage evaluation to the visual
 * lab read model.  No formula is recomputed and no missing candidate is
 * replaced with zero, a duplicate serving identity, or a synthetic satellite.
 */
export function adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot(
  input: VisualLabCanonicalSnapshotAdapterInput,
): VisualLabCanonicalSnapshot {
  const { frame, evaluation } = input;
  const servingLink = frame.links[0] ?? null;
  const candidateLink = frame.candidateComparison.status === 'available'
    ? frame.candidateLink
    : null;
  const servingIdentity = textOrNull(servingLink?.satelliteId ?? frame.selectedSatelliteId);
  const candidateIdentity = candidateLink?.satelliteId
    ?? textOrNull(frame.candidateComparison.satelliteId)
    ?? textOrNull(frame.tleState.candidateSatellite?.satelliteId);
  const candidateReason = frame.candidateComparison.status === 'available'
    ? candidateLink === null ? 'candidate comparison is marked available but has no link result' : null
    : textOrNull(frame.candidateComparison.reason);
  const serving = linkSnapshot(
    servingLink,
    servingIdentity,
    servingLink === null ? 'accepted frame has no serving link result' : null,
    servingLink === null ? undefined : {
      intraSatelliteInterferenceW: frame.canonical.intraSatelliteInterferenceUW[servingLink.userIndex],
      interSatelliteInterferenceW: frame.canonical.interSatelliteInterferenceUW[servingLink.userIndex],
      transmitGainLinear: frame.canonical.transmitGainUb[servingLink.userIndex]?.[servingLink.beamId],
      compositeGainLinear: frame.canonical.compositeGainUb[servingLink.userIndex]?.[servingLink.beamId],
    },
  );
  const candidate = linkSnapshot(candidateLink, candidateIdentity, candidateReason);
  const evaluationView = evaluationSnapshot(evaluation);
  const trace = frame.handover;
  const cumulativeDeliveredBits = evaluationView.deliveredBits;
  const cumulativeConsumedEnergyJ = evaluationView.consumedEnergyJ;
  const cumulativeEe = evaluationView.energyEfficiencyBitsPerJ;
  const deltaSinrDb = serving.sinrDb !== null && candidate.sinrDb !== null
    ? candidate.sinrDb - serving.sinrDb
    : null;
  const servingBeamIndex = servingLink?.beamId;
  const activeBeamIndices = frame.inputs.frame.beamActiveB
    .map((active, index) => active ? index : -1)
    .filter(index => index >= 0);
  const activeSatelliteCount = new Set(
    activeBeamIndices.map(index => frame.inputs.frame.beamSatelliteB[index]),
  ).size;
  const frequencyReuse = finiteOrNull(frame.parameters.frequencyReuse);
  return freeze({
    schemaVersion: VISUAL_LAB_CANONICAL_SNAPSHOT_SCHEMA,
    isMock: false,
    source: freeze({
      frameId: frame.frameId,
      tleFrameId: frame.tleFrameId,
      instantUtc: frame.instantUtc,
      instantTaipei: frame.instantTaipei,
      tleEpochUtc: frame.tleEpochUtc,
      selectedSatelliteId: servingIdentity,
      constellation: frame.provenance.constellation,
      archiveId: frame.provenance.archiveId,
      archiveDate: frame.provenance.archiveDate,
      selectedTlePath: frame.provenance.selectedTlePath,
      sourceKind: frame.provenance.sourceKind,
      propagationModel: frame.provenance.propagationModel,
      contractVersion: frame.contractVersion,
    }),
    timeline: timelineAnchor(frame, trace),
    serving,
    candidate,
    deltaSinrDb,
    throughput: freeze({
      servingRateBps: serving.throughputBps,
      candidateRateBps: candidate.throughputBps,
      totalRateBps: finiteOrNull(frame.throughput.totalRateBps),
      cumulativeDeliveredBits,
      minimumRateBps: finiteOrNull(frame.parameters.minimumRateBps),
      systemBandwidthHz: finiteOrNull(frame.parameters.systemBandwidthHz),
      beamBandwidthHz: frequencyReuse === null || frequencyReuse <= 0
        ? null
        : finiteOrNull(frame.parameters.systemBandwidthHz / frequencyReuse),
      frequencyReuse,
    }),
    power: freeze({
      servingActualPowerW: serving.actualPowerW,
      candidateActualPowerW: candidate.actualPowerW,
      systemPowerW: finiteOrNull(frame.power.systemPowerW),
      cumulativeConsumedEnergyJ,
      servingRequestedPowerW: vectorValue(frame.power.pReqBW, servingBeamIndex),
      servingBeforeSatelliteCapPowerW: vectorValue(frame.power.pDlBeforeSatelliteCapBW, servingBeamIndex),
      servingPaEfficiency: vectorValue(frame.power.paEfficiencyB, servingBeamIndex),
      servingPaInputPowerW: vectorValue(frame.power.pPaBW, servingBeamIndex),
      servingRfcPowerW: vectorValue(frame.power.pRfcBW, servingBeamIndex),
      servingBasebandPowerW: vectorValue(frame.power.pBbBW, servingBeamIndex),
      servingEventPowerW: vectorValue(frame.power.pEventBW, servingBeamIndex),
      servingTotalPowerW: vectorValue(frame.power.pTotBW, servingBeamIndex),
      activeBeamCount: activeBeamIndices.length,
      activeSatelliteCount,
    }),
    ee: freeze({
      instantaneousBitsPerJ: finiteOrNull(frame.ee.instantaneousBitsPerJ),
      cumulativeBitsPerJ: cumulativeEe,
    }),
    evaluation: evaluationView,
    handover: handoverSnapshot(trace),
  });
}

/** Short alias for consumers that already know they are at the visual-lab seam. */
export const createVisualLabCanonicalSnapshot = adaptSimulationAnalysisFrameToVisualLabCanonicalSnapshot;
