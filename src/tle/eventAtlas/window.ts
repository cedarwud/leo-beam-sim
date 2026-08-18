import type { CanonicalTleServingChangeEvidence } from '../../simulator/canonicalTleHandover';
import { NTPU_TLE_OBSERVER, deriveObserverLinkGeometry } from '../../simulator/observer';
import type { TleAnalysisRun } from '../../simulator/tleAnalysisRun';
import type {
  CanonicalLinkResult,
  LoadedTleSnapshotSelection,
  SimulationAnalysisFrame,
  SimulatorConstellation,
} from '../../simulator/types';
import type { TleRunPropagationMode } from '../run';
import {
  TLE_EVENT_ATLAS_SCORING_VERSION,
  TLE_EVENT_ATLAS_WINDOW_SCHEMA_VERSION,
  type TleEventAtlasAcceptedWindowReceipt,
  type TleEventAtlasAnchorSample,
  type TleEventAtlasClipQuality,
  type TleEventAtlasEventVariant,
  type TleEventAtlasEvidenceClass,
  type TleEventAtlasLinkSample,
  type TleEventAtlasSourceReceipt,
  type TleEventAtlasTleIdentityReceipt,
} from './types';

export interface BuildTleEventAtlasWindowInput {
  readonly constellation: SimulatorConstellation;
  readonly selection: LoadedTleSnapshotSelection;
  readonly analysisRun: TleAnalysisRun;
  readonly source: TleEventAtlasSourceReceipt;
  readonly evidenceClass: TleEventAtlasEvidenceClass;
  readonly propagationMode: TleRunPropagationMode;
  readonly configDigest: string;
  readonly canonicalParameterDigest: string;
  readonly canonicalScenarioDigest: string;
}

function finiteOrNull(value: number | undefined): number | null {
  return value === undefined || !Number.isFinite(value) ? null : value;
}

function linearToDb(value: number | undefined): number | null {
  return value === undefined || !Number.isFinite(value) || value <= 0
    ? null
    : 10 * Math.log10(value);
}

function representativeServingLink(frame: SimulationAnalysisFrame): CanonicalLinkResult {
  const representativeUserIndex = frame.candidateLink?.userIndex ?? frame.links[0]?.userIndex;
  const link = frame.links.find(candidate => candidate.userIndex === representativeUserIndex)
    ?? frame.links[0];
  if (link === undefined) throw new Error(`canonical frame ${frame.frameId} has no serving link`);
  return link;
}

function servingSatellitePowerHeadroomW(frame: SimulationAnalysisFrame): number {
  const totalActualRfW = frame.power.pDlActualBW.reduce((sum, value) => sum + value, 0);
  return Math.max(0, frame.parameters.satellitePowerCapW - totalActualRfW);
}

function linkSample(
  frame: SimulationAnalysisFrame,
  link: CanonicalLinkResult,
  role: 'serving' | 'candidate',
): TleEventAtlasLinkSample {
  const userIndex = link.userIndex;
  const targetSinrDb = role === 'serving'
    ? linearToDb(frame.canonical.gammaReqB[link.beamId])
    : null;
  const intraSatelliteInterferenceW = role === 'serving'
    ? finiteOrNull(frame.throughput.intraSatelliteInterferenceUW[userIndex])
    : null;
  const interSatelliteInterferenceW = role === 'serving'
    ? finiteOrNull(frame.throughput.interSatelliteInterferenceUW[userIndex])
    : null;
  return Object.freeze({
    satelliteId: link.satelliteId,
    userId: link.userId,
    userIndex,
    beamId: link.beamId,
    elevationDeg: link.elevationDeg,
    rangeKm: link.distanceKm,
    offAxisAngleRad: link.offAxisAngleRad,
    requestedPowerW: link.requestedPowerW,
    beforeSatelliteCapPowerW: link.beforeSatelliteCapPowerW,
    actualPowerW: link.actualPowerW,
    beamPowerHeadroomW: Math.max(0, frame.parameters.beamPowerCapW - link.beforeSatelliteCapPowerW),
    satellitePowerHeadroomW: role === 'serving' ? servingSatellitePowerHeadroomW(frame) : null,
    signalW: link.signalW,
    intraSatelliteInterferenceW,
    interSatelliteInterferenceW,
    totalInterferenceW: link.interferenceW,
    noiseW: link.noiseW,
    sinrDb: link.sinrDb,
    targetSinrDb,
    linkMarginDb: targetSinrDb === null ? null : link.sinrDb - targetSinrDb,
    rateBps: link.rateBps,
    qosMet: link.qosMet,
    powerLimited: link.powerLimited,
  });
}

function concurrentVisibleSatelliteCount(run: TleAnalysisRun, anchorIndex: number): number {
  const instantUtc = run.geometryRun.getAnchorUtc(anchorIndex);
  let count = 0;
  for (let satelliteIndex = 0; satelliteIndex < run.geometryRun.satelliteCount; satelliteIndex += 1) {
    const state = run.geometryRun.readStateByIndex(anchorIndex, satelliteIndex);
    if (deriveObserverLinkGeometry(state.positionTemeKm, instantUtc, NTPU_TLE_OBSERVER).visible) count += 1;
  }
  return count;
}

function anchorSample(
  run: TleAnalysisRun,
  anchorIndex: number,
  role: TleEventAtlasAnchorSample['role'],
): TleEventAtlasAnchorSample {
  const frame = run.getFrame(anchorIndex);
  const trace = run.handoverTrace.anchors[anchorIndex];
  if (frame === null || trace === undefined) {
    throw new Error(`event clip cannot materialize canonical anchor ${anchorIndex}`);
  }
  const serving = representativeServingLink(frame);
  const candidate = frame.candidateLink;
  return Object.freeze({
    role,
    anchorIndex,
    instantUtc: frame.instantUtc,
    state: trace.state,
    event: trace.event,
    progressSec: trace.progressSec,
    cumulativeCount: trace.cumulativeCount,
    servingSatelliteId: trace.servingSatelliteId,
    candidateSatelliteId: trace.candidateSatelliteId,
    deltaSinrDb: trace.deltaDb,
    serving: linkSample(frame, serving, 'serving'),
    candidate: candidate === null ? null : linkSample(frame, candidate, 'candidate'),
    concurrentVisibleSatelliteCount: concurrentVisibleSatelliteCount(run, anchorIndex),
    systemPowerW: frame.power.systemPowerW,
    totalRateBps: frame.throughput.totalRateBps,
    instantaneousEeBitsPerJ: frame.ee.instantaneousBitsPerJ,
    evaluationEeBitsPerJ: frame.ee.evaluationBitsPerJ,
  });
}

function tleIdentityReceipt(
  run: TleAnalysisRun,
  satelliteId: string,
): TleEventAtlasTleIdentityReceipt {
  const snapshot = run.geometryRun.resolvedSnapshots.find(candidate => candidate.satelliteId === satelliteId);
  if (snapshot === undefined) throw new Error(`event satellite ${satelliteId} has no resolved TLE receipt`);
  return Object.freeze({
    satelliteId: snapshot.satelliteId,
    satelliteName: snapshot.satelliteName,
    epochUtc: snapshot.epochUtc,
    sourcePath: snapshot.sourcePath,
    line1: snapshot.line1,
    line2: snapshot.line2,
  });
}

function logicalEventKey(
  constellation: SimulatorConstellation,
  event: CanonicalTleServingChangeEvidence,
): string {
  return [
    constellation,
    event.sourceEvent,
    event.triggerInstantUtc,
    event.fromSatelliteId,
    event.toSatelliteId,
  ].join('|');
}

function eventVariantId(
  input: BuildTleEventAtlasWindowInput,
  event: CanonicalTleServingChangeEvidence,
): string {
  return [
    'tle-event-variant-v1',
    input.source.publicationSha256,
    input.analysisRun.geometryRun.t0Utc,
    event.sourceEvent,
    event.triggerInstantUtc,
    event.fromSatelliteId,
    event.toSatelliteId,
    event.eventId,
  ].map(value => encodeURIComponent(value)).join(':');
}

function clipAnchorIndices(
  run: TleAnalysisRun,
  event: CanonicalTleServingChangeEvidence,
): { readonly before: number; readonly decision: number; readonly after: number } {
  const firstQualificationAnchor = event.qualificationAnchors[0]?.anchorIndex;
  const before = Math.max(0, (firstQualificationAnchor ?? event.triggerAnchorIndex) - 1);
  return {
    before,
    decision: event.triggerAnchorIndex,
    after: Math.min(run.anchorCount - 1, event.triggerAnchorIndex + 2),
  };
}

function deltaDynamicRangeDb(
  run: TleAnalysisRun,
  event: CanonicalTleServingChangeEvidence,
  beforeAnchorIndex: number,
): number | null {
  const values = [
    ...run.handoverTrace.anchors
    .slice(beforeAnchorIndex, event.triggerAnchorIndex)
    .filter(anchor => anchor.candidateSatelliteId === event.toSatelliteId)
    .map(anchor => anchor.deltaDb)
    .filter((value): value is number => value !== null && Number.isFinite(value)),
    ...event.qualificationAnchors.map(anchor => anchor.deltaDb),
  ];
  if (values.length === 0) return null;
  return Math.max(...values) - Math.min(...values);
}

function eventTimeMinimumElevationDeg(
  run: TleAnalysisRun,
  event: CanonicalTleServingChangeEvidence,
): number | null {
  const elevations = [event.fromSatelliteId, event.toSatelliteId].map(satelliteId => {
    const satelliteIndex = run.geometryRun.getSatelliteIndex(satelliteId);
    if (satelliteIndex === undefined) return null;
    const state = run.geometryRun.readStateByIndex(event.triggerAnchorIndex, satelliteIndex);
    return deriveObserverLinkGeometry(
      state.positionTemeKm,
      event.triggerInstantUtc,
      NTPU_TLE_OBSERVER,
    ).elevationDeg;
  });
  return elevations.some(value => value === null)
    ? null
    : Math.min(...elevations as number[]);
}

function candidateResidualVisibilitySec(
  run: TleAnalysisRun,
  event: CanonicalTleServingChangeEvidence,
): number | null {
  const pass = run.passPlan.passes.find(candidate => candidate.passId === event.targetSelection.passId);
  if (pass === undefined) return null;
  return Math.max(0, pass.losTimeSec - event.triggerAnchorIndex * run.stepS);
}

function clipQuality(
  run: TleAnalysisRun,
  event: CanonicalTleServingChangeEvidence,
  anchors: readonly TleEventAtlasAnchorSample[],
  beforeAnchorIndex: number,
  afterAnchorIndex: number,
): TleEventAtlasClipQuality {
  const decision = anchors.find(anchor => anchor.role === 'decision');
  const minimumEventElevationDeg = eventTimeMinimumElevationDeg(run, event);
  return Object.freeze({
    scoringVersion: TLE_EVENT_ATLAS_SCORING_VERSION,
    complete: beforeAnchorIndex < event.triggerAnchorIndex && afterAnchorIndex > event.triggerAnchorIndex,
    minimumEventElevationDeg,
    deltaSinrDynamicRangeDb: deltaDynamicRangeDb(run, event, beforeAnchorIndex),
    candidateResidualVisibilitySec: candidateResidualVisibilitySec(run, event),
    concurrentVisibleSatelliteCount: decision?.concurrentVisibleSatelliteCount ?? 0,
    eventTimeMinimumElevationAtLeast45Deg: (minimumEventElevationDeg ?? -Infinity) >= 45,
    eventTimeMinimumElevationAtLeast60Deg: (minimumEventElevationDeg ?? -Infinity) >= 60,
    eventTimeMinimumElevationAtLeast75Deg: (minimumEventElevationDeg ?? -Infinity) >= 75,
  });
}

function eventVariant(
  input: BuildTleEventAtlasWindowInput,
  event: CanonicalTleServingChangeEvidence,
): TleEventAtlasEventVariant {
  const indices = clipAnchorIndices(input.analysisRun, event);
  const anchors = Object.freeze([
    anchorSample(input.analysisRun, indices.before, 'before'),
    anchorSample(input.analysisRun, indices.decision, 'decision'),
    anchorSample(input.analysisRun, indices.after, 'after'),
  ]);
  const identityIds = event.fromSatelliteId === event.toSatelliteId
    ? [event.fromSatelliteId]
    : [event.fromSatelliteId, event.toSatelliteId];
  return Object.freeze({
    variantId: eventVariantId(input, event),
    logicalEventKey: logicalEventKey(input.constellation, event),
    sourceEventId: event.eventId,
    sourceEvent: event.sourceEvent,
    constellation: input.constellation,
    requestedT0Utc: input.analysisRun.geometryRun.t0Utc,
    triggerAnchorIndex: event.triggerAnchorIndex,
    triggerInstantUtc: event.triggerInstantUtc,
    fromSatelliteId: event.fromSatelliteId,
    toSatelliteId: event.toSatelliteId,
    traceDigest: event.traceDigest,
    geometryRunId: event.geometryRunId,
    analysisRunId: event.analysisRunId,
    passPolicyRevision: input.analysisRun.passPlan.policyRevision,
    handoverPolicy: Object.freeze({ ...input.analysisRun.handoverTrace.policy }),
    targetSelection: Object.freeze({
      passId: event.targetSelection.passId,
      satelliteId: event.targetSelection.satelliteId,
      sourceLocator: event.targetSelection.sourceLocator,
    }),
    preCommit: Object.freeze({ ...event.preCommit }),
    postCommit: Object.freeze({ ...event.postCommit }),
    qualificationAnchors: Object.freeze(event.qualificationAnchors.map(anchor => Object.freeze({
      anchorIndex: anchor.anchorIndex,
      instantUtc: anchor.instantUtc,
      deltaDb: anchor.deltaDb,
      progressSec: anchor.progressSec,
    }))),
    source: input.source,
    tleIdentities: Object.freeze(identityIds.map(satelliteId => tleIdentityReceipt(input.analysisRun, satelliteId))),
    beforeAnchorIndex: indices.before,
    decisionAnchorIndex: indices.decision,
    afterAnchorIndex: indices.after,
    anchors,
    quality: clipQuality(input.analysisRun, event, anchors, indices.before, indices.after),
  });
}

/**
 * Project one already accepted canonical run into a compact Event Atlas
 * receipt. This function never propagates a TLE or recomputes SINR/Power/EE.
 */
export function buildTleEventAtlasWindowReceipt(
  input: BuildTleEventAtlasWindowInput,
): TleEventAtlasAcceptedWindowReceipt {
  if (input.propagationMode === 'full-reference' && input.evidenceClass !== 'canonical-research') {
    throw new Error('full-reference Event Atlas windows must use canonical-research evidence class');
  }
  if (input.propagationMode !== 'full-reference' && input.evidenceClass === 'canonical-research') {
    throw new Error('candidate-pool Event Atlas windows cannot claim canonical-research evidence');
  }
  if (input.analysisRun.geometryRun.t0Utc === '' || input.analysisRun.anchorCount !== 241) {
    throw new Error('Event Atlas requires one accepted canonical 241-anchor TLE run');
  }
  const events = Object.freeze(input.analysisRun.handoverTrace.servingChangeEvents.map(event => (
    eventVariant(input, event)
  )));
  return Object.freeze({
    schema: TLE_EVENT_ATLAS_WINDOW_SCHEMA_VERSION,
    status: 'accepted',
    constellation: input.constellation,
    requestedT0Utc: input.analysisRun.geometryRun.t0Utc,
    evidenceClass: input.evidenceClass,
    propagationMode: input.propagationMode,
    configDigest: input.configDigest,
    source: input.source,
    geometryRunId: input.analysisRun.geometryRunId,
    analysisRunId: input.analysisRun.analysisRunId,
    traceDigest: input.analysisRun.handoverTrace.traceDigest,
    passPolicyRevision: input.analysisRun.passPlan.policyRevision,
    canonicalParameterDigest: input.canonicalParameterDigest,
    canonicalScenarioDigest: input.canonicalScenarioDigest,
    handoverPolicy: Object.freeze({ ...input.analysisRun.handoverTrace.policy }),
    computationMetrics: input.analysisRun.geometryRun.computationMetrics,
    passCount: input.analysisRun.passPlan.passes.length,
    extractedPassCount: input.analysisRun.passPlan.extractedPasses.length,
    visibleGeometryFallbackAnchorCount: input.analysisRun.anchorSelections.filter(anchor => (
      anchor.selectionKind === 'visible-geometry-fallback'
    )).length,
    evaluation: Object.freeze({
      evaluationBitsPerJ: input.analysisRun.evaluation.evaluationBitsPerJ,
      deliveredBits: input.analysisRun.evaluation.deliveredBits,
      consumedEnergyJ: input.analysisRun.evaluation.consumedEnergyJ,
      durationS: input.analysisRun.evaluation.durationS,
      sampleCount: input.analysisRun.evaluation.sampleCount,
    }),
    events,
  });
}
