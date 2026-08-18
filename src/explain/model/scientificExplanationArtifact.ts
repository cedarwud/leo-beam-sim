import type { Vector3 } from '../../tle/types';
import type { CanonicalTleServingChangeEvidence } from '../../simulator/canonicalTleHandover';
import {
  CANONICAL_TERM_KEYS,
  selectCanonicalTermValue,
} from './canonicalTermMap';
import type {
  CanonicalTermKey,
  CanonicalTermValue,
  CausalProbeCapChecks,
  CausalProbeEvidence,
  EeEvalAvailability,
  ExplanatoryEvidence,
  ProbeControl,
  ScientificFixtureManifest,
  ScientificLinkIdentity,
  ScientificStoryEvidence,
  SourceFixtureManifest,
} from './types';

export const SCIENTIFIC_EXPLANATION_ARTIFACT_SCHEMA = 'scientific-explanation-artifact-v1' as const;

export interface ScientificExplanationSceneSatellite {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly role: 'service' | 'candidate' | 'context';
  readonly positionTemeKm: Vector3;
  readonly velocityTemeKmPerSec: Vector3;
}

export interface ScientificExplanationArtifactPoint {
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  readonly frameId: string;
  readonly tleFrameId: string;
  readonly instantUtc: string;
  readonly anchorIndex: number;
  readonly identity: ScientificLinkIdentity;
  readonly selectedSatelliteId: string;
  readonly candidateSatelliteId: string | null;
  readonly terms: Readonly<Record<CanonicalTermKey, CanonicalTermValue>>;
  readonly scene: {
    readonly groundPositionTemeKm: Vector3;
    readonly selectedTrajectory: readonly {
      readonly instantUtc: string;
      readonly positionTemeKm: Vector3;
    }[];
    readonly satellites: readonly ScientificExplanationSceneSatellite[];
    readonly activeServiceBeamIds: readonly number[];
  };
}

export interface ScientificExplanationArtifactPair {
  readonly fixtureId: 'angle-response-v1' | 'service-target-stress-v1';
  readonly control: ProbeControl;
  readonly identity: ScientificLinkIdentity;
  readonly capChecks: CausalProbeCapChecks;
  readonly eeEval: EeEvalAvailability;
  readonly reference: ScientificExplanationArtifactPoint;
  readonly probe: ScientificExplanationArtifactPoint;
}

export interface ScientificExplanationArtifact {
  readonly schema: typeof SCIENTIFIC_EXPLANATION_ARTIFACT_SCHEMA;
  readonly manifestVersion: string;
  readonly artifactId: string;
  readonly source: SourceFixtureManifest;
  readonly stories: {
    readonly methodState: ScientificExplanationArtifactPoint;
    readonly angleResponse: ScientificExplanationArtifactPair & { readonly fixtureId: 'angle-response-v1' };
    readonly serviceTargetStress: ScientificExplanationArtifactPair & { readonly fixtureId: 'service-target-stress-v1' };
    readonly servingChange: {
      readonly fixtureId: 'serving-change-v1';
      readonly eventId: string;
      readonly eventKind: 'offset-ttt' | 'forced-continuity';
      readonly sourceEvent: 'inter-handover' | 'forced-continuity';
      readonly fromSatelliteId: string;
      readonly toSatelliteId: string;
      readonly reason: string;
      readonly eventEvidence: CanonicalTleServingChangeEvidence;
      readonly before: ScientificExplanationArtifactPoint;
      readonly decision: ScientificExplanationArtifactPoint;
      readonly after: ScientificExplanationArtifactPoint;
    };
  };
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function fnvHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function scientificFixtureManifestVersion(manifest: ScientificFixtureManifest): string {
  return `scientific-fixture-v1:${fnvHash(JSON.stringify(manifest))}`;
}

function termSnapshot(
  evidence: ExplanatoryEvidence,
  identity: ScientificLinkIdentity,
  excludedTerms: readonly CanonicalTermKey[] = [],
): Readonly<Record<CanonicalTermKey, CanonicalTermValue>> {
  const excluded = new Set(excludedTerms);
  return Object.freeze(Object.fromEntries(CANONICAL_TERM_KEYS.map(term => {
    const value = selectCanonicalTermValue(term, {
      run: evidence.run,
      frame: evidence.frame,
      identity,
    });
    return [term, excluded.has(term)
      ? {
          status: 'unavailable' as const,
          unit: value.unit,
          reason: 'excluded from frame-scoped controlled comparison',
        }
      : value];
  })) as Record<CanonicalTermKey, CanonicalTermValue>);
}

function pointSnapshot(
  evidence: ExplanatoryEvidence,
  identity: ScientificLinkIdentity = evidence.representativeLink,
  extraSatelliteIds: readonly string[] = [],
  excludedTerms: readonly CanonicalTermKey[] = [],
): ScientificExplanationArtifactPoint {
  const { frame } = evidence;
  const candidateSatelliteId = frame.tleState.candidateSatellite?.satelliteId ?? null;
  const contextIds = new Set(evidence.sceneComposition.contextSatelliteIds);
  const retainedSatelliteIds = new Set([
    frame.selectedSatelliteId,
    ...(candidateSatelliteId === null ? [] : [candidateSatelliteId]),
    ...contextIds,
    ...extraSatelliteIds,
  ]);
  const satellites = frame.tleState.propagationFrame.satellites
    .filter(satellite => retainedSatelliteIds.has(satellite.satelliteId))
    .map(satellite => ({
      satelliteId: satellite.satelliteId,
      satelliteName: satellite.satelliteName,
      role: satellite.satelliteId === frame.selectedSatelliteId
        ? 'service' as const
        : satellite.satelliteId === candidateSatelliteId
          ? 'candidate' as const
          : 'context' as const,
      positionTemeKm: satellite.positionTemeKm,
      velocityTemeKmPerSec: satellite.velocityTemeKmPerSec,
    }));
  return deepFreeze({
    analysisRunId: evidence.run.analysisRunId,
    geometryRunId: evidence.run.geometryRunId,
    frameId: frame.frameId,
    tleFrameId: frame.tleFrameId,
    instantUtc: frame.instantUtc,
    anchorIndex: evidence.anchorIndex,
    identity,
    selectedSatelliteId: frame.selectedSatelliteId,
    candidateSatelliteId,
    terms: termSnapshot(evidence, identity, excludedTerms),
    scene: {
      groundPositionTemeKm: frame.tleState.groundPositionTemeKm,
      selectedTrajectory: frame.tleState.trajectory.map(point => ({
        instantUtc: point.instantUtc,
        positionTemeKm: point.positionTemeKm,
      })),
      satellites,
      activeServiceBeamIds: evidence.sceneComposition.activeServiceBeamIds,
    },
  });
}

function pairSnapshot(pair: CausalProbeEvidence): ScientificExplanationArtifactPair {
  return deepFreeze({
    fixtureId: pair.fixtureId,
    control: pair.control,
    identity: pair.identity,
    capChecks: pair.capChecks,
    eeEval: pair.eeEval,
    reference: pointSnapshot(pair.reference, pair.identity, [], ['eeEval']),
    probe: pointSnapshot(pair.probe, pair.identity, [], ['eeEval']),
  });
}

export function buildScientificExplanationArtifact(
  evidence: ScientificStoryEvidence,
  manifest: ScientificFixtureManifest,
): ScientificExplanationArtifact {
  const servingChange = evidence.servingChange;
  const event = servingChange.sourceEventEvidence;
  const manifestVersion = scientificFixtureManifestVersion(manifest);
  return deepFreeze({
    schema: SCIENTIFIC_EXPLANATION_ARTIFACT_SCHEMA,
    manifestVersion,
    artifactId: `accepted-scientific-demo-v1:${manifestVersion}:${manifest.source.geometryRunId}`,
    source: manifest.source,
    stories: {
      methodState: pointSnapshot(evidence.methodState),
      angleResponse: pairSnapshot(evidence.angleResponse) as ScientificExplanationArtifact['stories']['angleResponse'],
      serviceTargetStress: pairSnapshot(evidence.serviceTargetStress) as ScientificExplanationArtifact['stories']['serviceTargetStress'],
      servingChange: {
        fixtureId: servingChange.fixtureId,
        eventId: event.eventId,
        eventKind: servingChange.eventKind,
        sourceEvent: servingChange.sourceEvent,
        fromSatelliteId: event.fromSatelliteId,
        toSatelliteId: event.toSatelliteId,
        reason: event.reason,
        eventEvidence: event,
        before: pointSnapshot(servingChange.before, servingChange.before.representativeLink, [event.fromSatelliteId, event.toSatelliteId]),
        decision: pointSnapshot(servingChange.decision, servingChange.decision.representativeLink, [event.fromSatelliteId, event.toSatelliteId]),
        after: pointSnapshot(servingChange.after, servingChange.after.representativeLink, [event.fromSatelliteId, event.toSatelliteId]),
      },
    },
  });
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}

function finiteOrNull(value: unknown, label: string): number | null {
  if (value === null) return null;
  return finite(value, label);
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be boolean`);
  return value;
}

function booleanOrNull(value: unknown, label: string): boolean | null {
  if (value === null) return null;
  return boolean(value, label);
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be non-empty text`);
  return value;
}

function validateVector(value: unknown, label: string): void {
  const vector = record(value, label);
  finite(vector.x, `${label}.x`);
  finite(vector.y, `${label}.y`);
  finite(vector.z, `${label}.z`);
}

function validateTerms(value: unknown, label: string): void {
  const terms = record(value, label);
  for (const term of CANONICAL_TERM_KEYS) {
    const termValue = record(terms[term], `${label}.${term}`);
    const status = text(termValue.status, `${label}.${term}.status`);
    text(termValue.unit, `${label}.${term}.unit`);
    if (status === 'available') finite(termValue.value, `${label}.${term}.value`);
    else if (status === 'unavailable') text(termValue.reason, `${label}.${term}.reason`);
    else throw new Error(`${label}.${term}.status is invalid`);
  }
}

function validatePoint(value: unknown, label: string, expectedFrameId: string): ScientificExplanationArtifactPoint {
  const point = record(value, label);
  if (text(point.frameId, `${label}.frameId`) !== expectedFrameId) throw new Error(`${label} frame identity mismatch`);
  text(point.analysisRunId, `${label}.analysisRunId`);
  text(point.geometryRunId, `${label}.geometryRunId`);
  text(point.tleFrameId, `${label}.tleFrameId`);
  text(point.instantUtc, `${label}.instantUtc`);
  finite(point.anchorIndex, `${label}.anchorIndex`);
  text(point.selectedSatelliteId, `${label}.selectedSatelliteId`);
  if (point.candidateSatelliteId !== null) text(point.candidateSatelliteId, `${label}.candidateSatelliteId`);
  const identity = record(point.identity, `${label}.identity`);
  text(identity.satelliteId, `${label}.identity.satelliteId`);
  text(identity.userId, `${label}.identity.userId`);
  finite(identity.beamId, `${label}.identity.beamId`);
  finite(identity.userIndex, `${label}.identity.userIndex`);
  validateTerms(point.terms, `${label}.terms`);
  const scene = record(point.scene, `${label}.scene`);
  validateVector(scene.groundPositionTemeKm, `${label}.scene.groundPositionTemeKm`);
  if (!Array.isArray(scene.selectedTrajectory) || scene.selectedTrajectory.length === 0) {
    throw new Error(`${label}.scene.selectedTrajectory must be non-empty`);
  }
  for (const [index, trajectoryPoint] of scene.selectedTrajectory.entries()) {
    const item = record(trajectoryPoint, `${label}.scene.selectedTrajectory[${index}]`);
    text(item.instantUtc, `${label}.scene.selectedTrajectory[${index}].instantUtc`);
    validateVector(item.positionTemeKm, `${label}.scene.selectedTrajectory[${index}].positionTemeKm`);
  }
  if (!Array.isArray(scene.satellites) || scene.satellites.length === 0) {
    throw new Error(`${label}.scene.satellites must be non-empty`);
  }
  for (const [index, sceneSatellite] of scene.satellites.entries()) {
    const satellite = record(sceneSatellite, `${label}.scene.satellites[${index}]`);
    text(satellite.satelliteId, `${label}.scene.satellites[${index}].satelliteId`);
    text(satellite.satelliteName, `${label}.scene.satellites[${index}].satelliteName`);
    const role = text(satellite.role, `${label}.scene.satellites[${index}].role`);
    if (!['service', 'candidate', 'context'].includes(role)) throw new Error(`${label}.scene.satellites[${index}].role is invalid`);
    validateVector(satellite.positionTemeKm, `${label}.scene.satellites[${index}].positionTemeKm`);
    validateVector(satellite.velocityTemeKmPerSec, `${label}.scene.satellites[${index}].velocityTemeKmPerSec`);
  }
  if (!Array.isArray(scene.activeServiceBeamIds) || scene.activeServiceBeamIds.length !== 7) {
    throw new Error(`${label}.scene.activeServiceBeamIds must contain seven beam ids`);
  }
  scene.activeServiceBeamIds.forEach((beamId, index) => finite(beamId, `${label}.scene.activeServiceBeamIds[${index}]`));
  return value as ScientificExplanationArtifactPoint;
}

function validateControlledPairPolicy(value: unknown, label: string): void {
  const pair = record(value, label);
  const capChecks = record(pair.capChecks, `${label}.capChecks`);
  finiteOrNull(capChecks.capToleranceW, `${label}.capChecks.capToleranceW`);
  booleanOrNull(capChecks.allBeamCapsNonBinding, `${label}.capChecks.allBeamCapsNonBinding`);
  booleanOrNull(capChecks.satelliteCapNonBinding, `${label}.capChecks.satelliteCapNonBinding`);
  booleanOrNull(capChecks.allSatelliteScalesOne, `${label}.capChecks.allSatelliteScalesOne`);
  booleanOrNull(capChecks.allUsersNotPowerLimited, `${label}.capChecks.allUsersNotPowerLimited`);
  boolean(capChecks.allNonBinding, `${label}.capChecks.allNonBinding`);
  const eeEval = record(pair.eeEval, `${label}.eeEval`);
  if (eeEval.status !== 'excluded') throw new Error(`${label}.eeEval must be excluded`);
  text(eeEval.reason, `${label}.eeEval.reason`);
  for (const member of ['reference', 'probe'] as const) {
    const point = record(pair[member], `${label}.${member}`);
    const terms = record(point.terms, `${label}.${member}.terms`);
    const term = record(terms.eeEval, `${label}.${member}.terms.eeEval`);
    if (term.status !== 'unavailable') throw new Error(`${label}.${member}.terms.eeEval must be unavailable`);
    text(term.reason, `${label}.${member}.terms.eeEval.reason`);
  }
}

function validateServingChangeEvent(value: unknown, label: string): CanonicalTleServingChangeEvidence {
  const event = record(value, label);
  text(event.eventId, `${label}.eventId`);
  text(event.analysisRunId, `${label}.analysisRunId`);
  text(event.geometryRunId, `${label}.geometryRunId`);
  text(event.traceDigest, `${label}.traceDigest`);
  const sourceEvent = text(event.sourceEvent, `${label}.sourceEvent`);
  if (sourceEvent !== 'inter-handover' && sourceEvent !== 'forced-continuity') {
    throw new Error(`${label}.sourceEvent is invalid`);
  }
  text(event.fromSatelliteId, `${label}.fromSatelliteId`);
  text(event.toSatelliteId, `${label}.toSatelliteId`);
  const target = record(event.targetSelection, `${label}.targetSelection`);
  if (target.selectionKind !== 'pass-plan') throw new Error(`${label}.targetSelection.selectionKind is invalid`);
  text(target.passId, `${label}.targetSelection.passId`);
  text(target.satelliteId, `${label}.targetSelection.satelliteId`);
  text(target.sourceLocator, `${label}.targetSelection.sourceLocator`);
  finite(event.triggerAnchorIndex, `${label}.triggerAnchorIndex`);
  text(event.triggerInstantUtc, `${label}.triggerInstantUtc`);
  const preCommit = record(event.preCommit, `${label}.preCommit`);
  text(preCommit.servingSatelliteId, `${label}.preCommit.servingSatelliteId`);
  text(preCommit.candidateSatelliteId, `${label}.preCommit.candidateSatelliteId`);
  boolean(preCommit.servingVisible, `${label}.preCommit.servingVisible`);
  boolean(preCommit.candidateVisible, `${label}.preCommit.candidateVisible`);
  finiteOrNull(preCommit.servingSinrDb, `${label}.preCommit.servingSinrDb`);
  finiteOrNull(preCommit.candidateSinrDb, `${label}.preCommit.candidateSinrDb`);
  finiteOrNull(preCommit.deltaDb, `${label}.preCommit.deltaDb`);
  const postCommit = record(event.postCommit, `${label}.postCommit`);
  text(postCommit.servingSatelliteId, `${label}.postCommit.servingSatelliteId`);
  finite(postCommit.anchorIndex, `${label}.postCommit.anchorIndex`);
  text(postCommit.instantUtc, `${label}.postCommit.instantUtc`);
  text(event.reason, `${label}.reason`);
  if (!Array.isArray(event.qualificationAnchors)) throw new Error(`${label}.qualificationAnchors must be an array`);
  if (sourceEvent === 'forced-continuity') {
    if (event.qualificationAnchors.length !== 0) throw new Error(`${label}.qualificationAnchors must be empty`);
    const continuity = record(event.continuity, `${label}.continuity`);
    if (continuity.reasonCode !== 'serving-lost-visibility') throw new Error(`${label}.continuity.reasonCode is invalid`);
    boolean(continuity.servingVisible, `${label}.continuity.servingVisible`);
    boolean(continuity.targetVisible, `${label}.continuity.targetVisible`);
    text(continuity.targetSatelliteId, `${label}.continuity.targetSatelliteId`);
    text(continuity.reason, `${label}.continuity.reason`);
  } else {
    const decision = record(event.decision, `${label}.decision`);
    finite(decision.offsetDb, `${label}.decision.offsetDb`);
    finite(decision.tttSec, `${label}.decision.tttSec`);
    event.qualificationAnchors.forEach((item, index) => {
      const anchor = record(item, `${label}.qualificationAnchors[${index}]`);
      finite(anchor.anchorIndex, `${label}.qualificationAnchors[${index}].anchorIndex`);
      text(anchor.instantUtc, `${label}.qualificationAnchors[${index}].instantUtc`);
      text(anchor.servingSatelliteId, `${label}.qualificationAnchors[${index}].servingSatelliteId`);
      text(anchor.candidateSatelliteId, `${label}.qualificationAnchors[${index}].candidateSatelliteId`);
      finite(anchor.deltaDb, `${label}.qualificationAnchors[${index}].deltaDb`);
      finite(anchor.progressSec, `${label}.qualificationAnchors[${index}].progressSec`);
      if (anchor.conditionMet !== true) throw new Error(`${label}.qualificationAnchors[${index}].conditionMet must be true`);
    });
  }
  return value as CanonicalTleServingChangeEvidence;
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function parseScientificExplanationArtifact(
  value: unknown,
  manifest: ScientificFixtureManifest,
): ScientificExplanationArtifact {
  const artifact = record(value, 'scientific explanation artifact');
  if (artifact.schema !== SCIENTIFIC_EXPLANATION_ARTIFACT_SCHEMA) throw new Error('scientific explanation artifact schema mismatch');
  if (artifact.manifestVersion !== scientificFixtureManifestVersion(manifest)) throw new Error('scientific explanation artifact manifest identity mismatch');
  if (!sameJson(artifact.source, manifest.source)) throw new Error('scientific explanation artifact source identity mismatch');
  text(artifact.artifactId, 'scientific explanation artifact id');
  const stories = record(artifact.stories, 'scientific explanation artifact stories');
  validatePoint(stories.methodState, 'stories.methodState', manifest.fixtures.method.frameId);

  const angle = record(stories.angleResponse, 'stories.angleResponse');
  if (angle.fixtureId !== 'angle-response-v1' || !sameJson(angle.control, manifest.fixtures.angleResponse.control)) {
    throw new Error('angle-response artifact identity mismatch');
  }
  validatePoint(angle.reference, 'stories.angleResponse.reference', manifest.fixtures.angleResponse.referenceFrameId);
  validatePoint(angle.probe, 'stories.angleResponse.probe', manifest.fixtures.angleResponse.probeFrameId);
  validateControlledPairPolicy(angle, 'stories.angleResponse');

  const rate = record(stories.serviceTargetStress, 'stories.serviceTargetStress');
  if (rate.fixtureId !== 'service-target-stress-v1' || !sameJson(rate.control, manifest.fixtures.serviceTargetStress.control)) {
    throw new Error('service-target artifact identity mismatch');
  }
  validatePoint(rate.reference, 'stories.serviceTargetStress.reference', manifest.fixtures.serviceTargetStress.referenceFrameId);
  validatePoint(rate.probe, 'stories.serviceTargetStress.probe', manifest.fixtures.serviceTargetStress.probeFrameId);
  validateControlledPairPolicy(rate, 'stories.serviceTargetStress');

  const handover = record(stories.servingChange, 'stories.servingChange');
  if (handover.fixtureId !== 'serving-change-v1'
    || handover.eventId !== manifest.fixtures.servingChange.eventId
    || handover.sourceEvent !== manifest.fixtures.servingChange.sourceEvent) {
    throw new Error('serving-change artifact identity mismatch');
  }
  const eventEvidence = validateServingChangeEvent(handover.eventEvidence, 'stories.servingChange.eventEvidence');
  if (eventEvidence.eventId !== handover.eventId
    || eventEvidence.sourceEvent !== handover.sourceEvent
    || eventEvidence.fromSatelliteId !== handover.fromSatelliteId
    || eventEvidence.toSatelliteId !== handover.toSatelliteId
    || eventEvidence.reason !== handover.reason) {
    throw new Error('serving-change event evidence identity mismatch');
  }
  validatePoint(handover.before, 'stories.servingChange.before', manifest.fixtures.servingChange.beforeFrameId);
  validatePoint(handover.decision, 'stories.servingChange.decision', manifest.fixtures.servingChange.decisionFrameId);
  validatePoint(handover.after, 'stories.servingChange.after', manifest.fixtures.servingChange.afterFrameId);

  return deepFreeze(value as ScientificExplanationArtifact);
}
