import { createHash } from 'node:crypto';

import {
  C120_CLAIM_BOUNDARY,
  C120_CLAIM_LEVELS,
  C120_CONTRACT_VERSION,
  C120_COURSE_ID,
  C120_UNITS,
  assertC120Replay,
  assertC120Scenario,
  type C120AuthoritativeReplay,
  type C120Scenario,
  type C120ScenarioIdentity,
  type C120TleAnchor,
} from '../contract';
import {
  c120SurfaceIdentity,
  makeC120Frame,
  makeC120Replay,
  type C120ReplayFrameSpec,
} from '../replay';
import {
  verifyC120ClassSnapshot,
  type C120ClassSnapshot,
} from './classSnapshot';
import {
  CELESTRAK_ONEWEB_TLE_URL,
  C120_CURRENT_TLE_SOURCE_KIND,
  C120_TLE_FORMAT,
  C120_TLE_OMM_EPOCH_TOLERANCE_MS,
  parseC120CurrentTle,
  type C120CurrentTleReceipt,
} from './currentTleSource';
import {
  C120RealDataError,
  type C120OrbitSourceReceipt,
} from './orbitSource';
import {
  projectC120OrbitScene,
  type C120NTPUVisualTrajectory,
  type C120OrbitSceneFrame,
} from './orbitSceneProjection';

/** A pre-class, opt-in scenario produced from one verified source snapshot. */
export interface C120MaterializedScenarioRequest {
  readonly snapshot: C120ClassSnapshot;
  readonly currentTle: C120CurrentTleReceipt;
  readonly donor: C120Scenario;
  /** Explicit path for the bundled 3LE bytes served to the classroom. */
  readonly downloadPath: string;
}

export const C120_MATERIALIZED_PROVIDER_KIND = 'canonical-adapter' as const;
export const C120_MATERIALIZED_SCENARIO_VERSION = 'c120-materialized-canonical-adapter-v2' as const;

const RECEIPT_KEYS = Object.freeze([
  'kind', 'format', 'catalogId', 'objectName', 'epochUtc', 'epochField', 'retrievedAt', 'url',
  'rawContent', 'rawContentSha256', 'responseBytes', 'line0', 'line1', 'line2', 'tle',
  'sourceProvenance', 'matchedOmm',
]);
const TLE_KEYS = Object.freeze(['line0', 'line1', 'line2']);
const PROVENANCE_KEYS = Object.freeze([
  'provider', 'endpoint', 'format', 'catalogId', 'objectName', 'retrievedAt', 'rawContentSha256',
]);
const MATCHED_OMM_KEYS = Object.freeze([
  'catalogId', 'objectName', 'sourceEpoch', 'rawContentSha256', 'epochDeltaMs',
]);

interface PlainRecord {
  readonly [key: string]: unknown;
}

function fail(message: string): never {
  throw new C120RealDataError('ARTIFACT_INVALID', `materialized scenario violation: ${message}`);
}

function record(value: unknown, label: string): PlainRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) {
    return fail(`${label} must be a plain object`);
  }
  return value as PlainRecord;
}

function exactKeys(value: PlainRecord, expected: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) return fail(`${label} has unknown or missing fields`);
}

function nonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') return fail(`${label} must be non-empty text`);
  return value;
}

function finiteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fail(`${label} must be finite numeric data`);
  return value;
}

function isSha256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function canonicalize(value: unknown, path = 'value', inArray = false): unknown {
  if (value === undefined) {
    if (inArray) return fail(`${path} must not be undefined`);
    return undefined;
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fail(`${path} must be finite`);
    return value;
  }
  if (Array.isArray(value)) return value.map((child, index) => canonicalize(child, `${path}[${index}]`, true));
  const candidate = record(value, path);
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(candidate).sort()) {
    const child = canonicalize(candidate[key], `${path}.${key}`);
    if (child !== undefined) output[key] = child;
  }
  return output;
}

function canonicalJson(value: unknown): string {
  const json = JSON.stringify(canonicalize(value));
  if (json === undefined) return fail('value cannot be serialized as JSON');
  return json;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function freezeDeep<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value;
  Object.freeze(value);
  if (Array.isArray(value)) value.forEach(child => freezeDeep(child));
  else Object.values(value as Record<string, unknown>).forEach(child => freezeDeep(child));
  return value;
}

function parseUtc(value: unknown, label: string): number {
  nonEmptyString(value, label);
  if (!(value as string).endsWith('Z')) return fail(`${label} must end in Z`);
  const parsed = Date.parse(value as string);
  if (!Number.isFinite(parsed)) return fail(`${label} must be parseable UTC`);
  return parsed;
}

function validateDownloadPath(value: unknown): string {
  const path = nonEmptyString(value, 'downloadPath');
  if (!path.startsWith('/course/c120/') || path.includes('..') || /[\r\n]/.test(path)) {
    return fail('downloadPath must be a safe bundled /course/c120 path');
  }
  return path;
}

function validateReceipt(receipt: C120CurrentTleReceipt, source: C120OrbitSourceReceipt): void {
  const candidate = record(receipt, 'currentTle');
  exactKeys(candidate, RECEIPT_KEYS, 'currentTle');
  if (candidate.kind !== C120_CURRENT_TLE_SOURCE_KIND || candidate.format !== C120_TLE_FORMAT
    || candidate.catalogId !== 49100 || candidate.objectName !== 'ONEWEB-0314'
    || candidate.url !== CELESTRAK_ONEWEB_TLE_URL) {
    return fail('current TLE endpoint or identity mismatch');
  }
  const rawContent = nonEmptyString(candidate.rawContent, 'currentTle.rawContent');
  if (!isSha256(candidate.rawContentSha256)
    || sha256(rawContent) !== candidate.rawContentSha256) {
    return fail('current TLE content address mismatch');
  }
  const responseBytes = new TextEncoder().encode(rawContent).byteLength;
  if (candidate.responseBytes !== responseBytes || responseBytes <= 0) {
    return fail('current TLE response byte count mismatch');
  }
  parseUtc(candidate.retrievedAt, 'currentTle.retrievedAt');
  parseUtc(candidate.epochUtc, 'currentTle.epochUtc');
  const sourceEpochMs = parseUtc(source.sourceEpoch, 'snapshot artifact sourceEpoch');
  const rawContentSha256 = candidate.rawContentSha256;
  const parsed = (() => {
    try {
      return parseC120CurrentTle(rawContent, source);
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  })();
  if (candidate.line0 !== parsed.line0 || candidate.line1 !== parsed.line1 || candidate.line2 !== parsed.line2
    || candidate.epochField !== parsed.epochField || candidate.epochUtc !== parsed.epochUtc) {
    return fail('current TLE parsed fields do not match its receipt');
  }
  const tle = record(candidate.tle, 'currentTle.tle');
  exactKeys(tle, TLE_KEYS, 'currentTle.tle');
  if (tle.line0 !== parsed.line0 || tle.line1 !== parsed.line1 || tle.line2 !== parsed.line2) {
    return fail('current TLE nested lines do not match its receipt');
  }
  const provenance = record(candidate.sourceProvenance, 'currentTle.sourceProvenance');
  exactKeys(provenance, PROVENANCE_KEYS, 'currentTle.sourceProvenance');
  if (provenance.provider !== 'CelesTrak' || provenance.endpoint !== CELESTRAK_ONEWEB_TLE_URL
    || provenance.format !== C120_TLE_FORMAT || provenance.catalogId !== 49100
    || provenance.objectName !== 'ONEWEB-0314' || provenance.retrievedAt !== candidate.retrievedAt
    || provenance.rawContentSha256 !== rawContentSha256) {
    return fail('current TLE source provenance mismatch');
  }
  const matchedOmm = record(candidate.matchedOmm, 'currentTle.matchedOmm');
  exactKeys(matchedOmm, MATCHED_OMM_KEYS, 'currentTle.matchedOmm');
  const epochDeltaMs = Math.abs(parsed.epochMs - sourceEpochMs);
  if (epochDeltaMs > C120_TLE_OMM_EPOCH_TOLERANCE_MS) {
    return fail(`current TLE epoch is ${epochDeltaMs} ms from snapshot artifact sourceEpoch`);
  }
  if (matchedOmm.catalogId !== source.catalogId || matchedOmm.objectName !== source.objectName
    || matchedOmm.sourceEpoch !== source.sourceEpoch || matchedOmm.rawContentSha256 !== source.rawContentSha256
    || matchedOmm.epochDeltaMs !== epochDeltaMs) {
    return fail('current TLE to OMM receipt binding mismatch');
  }
}

function materializedIdentity(
  donor: C120Scenario,
  snapshot: C120ClassSnapshot,
  currentTle: C120CurrentTleReceipt,
  downloadPath: string,
): C120ScenarioIdentity {
  const address = sha256(canonicalJson({
    materializer: C120_MATERIALIZED_SCENARIO_VERSION,
    donor,
    snapshotId: snapshot.snapshotId,
    currentTle,
    downloadPath,
  }));
  return {
    courseId: C120_COURSE_ID,
    contractVersion: C120_CONTRACT_VERSION,
    providerKind: C120_MATERIALIZED_PROVIDER_KIND,
    providerId: `c120-canonical-adapter-${address}`,
    fixtureId: `c120-materialized-fixture-${address}`,
    fixtureVersion: `${C120_MATERIALIZED_SCENARIO_VERSION}-${address}`,
    scenarioId: donor.manifest.scenario.scenarioId,
    sourceMode: 'bundled',
    tleSourceId: `c120-current-tle-${currentTle.rawContentSha256}`,
    // The materialized replay clock is anchored at the model-derived peak.
    // Replay geometry advances through the same bounded SGP4 trace below.
    targetUtc: snapshot.artifact.orbit.pass.peak.utc,
    claimBoundary: C120_CLAIM_BOUNDARY,
    claimLevels: C120_CLAIM_LEVELS,
    units: C120_UNITS,
  };
}

function rebindReplay(
  replay: C120AuthoritativeReplay,
  donorIdentity: C120ScenarioIdentity,
  identity: C120ScenarioIdentity,
  surface: 'lab-a' | 'lab-b' | 'lab-c' | 'clinic',
  visualTrajectory: C120NTPUVisualTrajectory,
): C120AuthoritativeReplay {
  assertC120Replay(replay, donorIdentity, surface, `materializer.donor.${surface}`);
  const targetUtcMs = parseUtc(identity.targetUtc, 'identity.targetUtc');
  const specs: readonly C120ReplayFrameSpec[] = replay.frames.map((frame): C120ReplayFrameSpec => ({
    elapsedSec: frame.elapsedSec,
    actionLabel: frame.actionLabel,
    stateLabel: frame.stateLabel,
    qualityLabel: frame.qualityLabel,
    scene: sceneAtReplayTime(visualTrajectory, targetUtcMs + frame.elapsedSec * 1000, frame.scene.visible),
    evidence: frame.evidence,
  }));
  const rebuilt = makeC120Replay(
    identity,
    replay.replayId,
    replay.input,
    replay.mechanismLabel,
    replay.conditionLabel,
    specs,
    replay.cardLedger,
  );
  if (rebuilt.replayInputId !== replay.replayInputId) return fail(`${surface}.${replay.replayId} input identity changed`);
  return rebuilt;
}

function sceneFrameAtUtc(
  visualTrajectory: C120NTPUVisualTrajectory,
  targetUtcMs: number,
): C120OrbitSceneFrame {
  const first = visualTrajectory.points[0];
  const last = visualTrajectory.points[visualTrajectory.points.length - 1];
  if (first === undefined || last === undefined) return fail('visual trajectory is empty');
  const firstMs = parseUtc(first.utc, 'visualTrajectory.points[0].utc');
  const lastMs = parseUtc(last.utc, 'visualTrajectory.points[last].utc');
  if (!Number.isFinite(targetUtcMs) || targetUtcMs < firstMs || targetUtcMs > lastMs) {
    return fail('replay frame time falls outside the verified AOS-to-LOS trajectory');
  }
  let closest = first;
  let closestDeltaMs = Math.abs(firstMs - targetUtcMs);
  for (let index = 1; index < visualTrajectory.points.length; index += 1) {
    const candidate = visualTrajectory.points[index]!;
    const candidateDeltaMs = Math.abs(parseUtc(candidate.utc, `visualTrajectory.points[${index}].utc`) - targetUtcMs);
    if (candidateDeltaMs < closestDeltaMs) {
      closest = candidate;
      closestDeltaMs = candidateDeltaMs;
    }
  }
  return closest;
}

function sceneAtReplayTime(
  visualTrajectory: C120NTPUVisualTrajectory,
  targetUtcMs: number,
  donorVisible: boolean,
): C120ReplayFrameSpec['scene'] {
  const projected = sceneFrameAtUtc(visualTrajectory, targetUtcMs).scene;
  return {
    ...projected,
    // Geometry cannot make an authored fixed outage visible. The donor flag
    // remains a service-window mask; positions/look angles are model-derived.
    visible: projected.visible && donorVisible,
  };
}

function rebindTleAnchor(
  donor: C120Scenario,
  identity: C120ScenarioIdentity,
  snapshot: C120ClassSnapshot,
  currentTle: C120CurrentTleReceipt,
  downloadPath: string,
  visualTrajectory: C120NTPUVisualTrajectory,
): C120TleAnchor {
  const donorFrame = donor.tle.frame;
  const peak = snapshot.artifact.orbit.pass.peak;
  const peakFrame = sceneFrameAtUtc(visualTrajectory, parseUtc(peak.utc, 'artifact.orbit.pass.peak.utc'));
  if (peakFrame.azimuthDeg !== peak.azimuthDeg
    || peakFrame.elevationDeg !== peak.elevationDeg
    || peakFrame.rangeKm !== peak.rangeKm) {
    return fail('projected peak does not exactly match the verified orbit peak');
  }
  const scene = peakFrame.scene;
  const tleIdentity = c120SurfaceIdentity(identity, 'tle');
  const frameSpec: C120ReplayFrameSpec = {
    elapsedSec: donorFrame.elapsedSec,
    actionLabel: donorFrame.actionLabel,
    stateLabel: donorFrame.stateLabel,
    qualityLabel: donorFrame.qualityLabel,
    scene,
    evidence: donorFrame.evidence,
  };
  const frame = makeC120Frame(
    tleIdentity,
    donorFrame.identity.replayId,
    donorFrame.identity.replayInputId,
    donorFrame.frameIndex,
    frameSpec,
  );
  return {
    identity: tleIdentity,
    sourceLabel: `CelesTrak current 3LE · ${currentTle.objectName}`,
    sourceEpochUtc: currentTle.epochUtc,
    targetUtc: identity.targetUtc,
    observerLabel: donor.tle.observerLabel,
    producerLabel: `${snapshot.artifact.orbit.model} · highest sampled NTPU look-angle point`,
    downloadPath,
    recordSha256: currentTle.rawContentSha256,
    lines: [currentTle.line0, currentTle.line1, currentTle.line2],
    frame,
    lineage: [
      { order: 1, label: 'current CelesTrak 3LE record', value: currentTle.rawContentSha256, provenance: 'SOURCE' },
      { order: 2, label: 'target UTC', value: identity.targetUtc, provenance: 'COURSE-ASSUMPTION' },
      { order: 3, label: 'NTPU model-derived peak sample', value: peak.utc, provenance: 'MODEL-DERIVED' },
    ],
    tleDoesNotContain: ['power', 'traffic', 'handover', 'energy'],
  };
}

function rebindScenario(
  donor: C120Scenario,
  identity: C120ScenarioIdentity,
  snapshot: C120ClassSnapshot,
  currentTle: C120CurrentTleReceipt,
  downloadPath: string,
): C120Scenario {
  const donorIdentity = donor.manifest.scenario;
  const visualTrajectory = (() => {
    try {
      return projectC120OrbitScene(snapshot.artifact.orbit.pass.trajectory, {
        minimumElevationDeg: snapshot.artifact.orbit.search.minimumElevationDeg,
      });
    } catch (error) {
      return fail(error instanceof Error ? error.message : String(error));
    }
  })();
  const labAReplays = donor.labA.replays.map(replay => (
    rebindReplay(replay, donorIdentity, identity, 'lab-a', visualTrajectory)
  ));
  const referenceReplay = labAReplays.find(replay => replay.replayId === donor.labA.referenceReplay.replayId);
  if (referenceReplay === undefined) return fail('labA.referenceReplay is absent from rebuilt replays');
  return {
    manifest: {
      ...cloneJson(donor.manifest),
      providerKind: identity.providerKind,
      providerId: identity.providerId,
      scenario: identity,
    },
    missionContracts: cloneJson(donor.missionContracts),
    tle: rebindTleAnchor(donor, identity, snapshot, currentTle, downloadPath, visualTrajectory),
    labA: {
      candidates: cloneJson(donor.labA.candidates),
      referenceReplay,
      replays: labAReplays,
    },
    labB: {
      rules: cloneJson(donor.labB.rules),
      traceALabel: donor.labB.traceALabel,
      replays: donor.labB.replays.map(replay => (
        rebindReplay(replay, donorIdentity, identity, 'lab-b', visualTrajectory)
      )),
    },
    labC: {
      slotLabels: cloneJson(donor.labC.slotLabels),
      allowedActionsBySlot: cloneJson(donor.labC.allowedActionsBySlot),
      replays: donor.labC.replays.map(replay => (
        rebindReplay(replay, donorIdentity, identity, 'lab-c', visualTrajectory)
      )),
    },
    clinic: {
      featureCards: cloneJson(donor.clinic.featureCards),
      actions: cloneJson(donor.clinic.actions),
      honestModelScorePercent: donor.clinic.honestModelScorePercent,
      oracleModelScorePercent: donor.clinic.oracleModelScorePercent,
      replays: donor.clinic.replays.map(replay => (
        rebindReplay(replay, donorIdentity, identity, 'clinic', visualTrajectory)
      )),
    },
  };
}

/**
 * Bind one verified class snapshot and one verified current TLE to a donor
 * scenario. TLE and A/B/C/clinic visual positions/look angles come from one
 * bounded model-derived SGP4 trajectory. Teaching evidence and consequence
 * values remain donor-authored until the separate course replay producer is
 * explicitly integrated.
 */
export function materializeC120CanonicalScenario(
  request: C120MaterializedScenarioRequest,
): C120Scenario {
  const snapshot = request.snapshot;
  verifyC120ClassSnapshot(snapshot);
  const donor = request.donor;
  try {
    assertC120Scenario(donor, {
      kind: donor.manifest.scenario.providerKind,
      providerId: donor.manifest.scenario.providerId,
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  const downloadPath = validateDownloadPath(request.downloadPath);
  const artifact = snapshot.artifact;
  const source = artifact.source;
  if (snapshot.scenarioId !== donor.manifest.scenario.scenarioId
    || snapshot.scenarioBinding.scenarioId !== donor.manifest.scenario.scenarioId
    || artifact.scenarioId !== donor.manifest.scenario.scenarioId) {
    return fail('snapshot scenarioId must exactly match donor scenarioId');
  }
  if (canonicalJson(snapshot.scenarioBinding.units) !== canonicalJson(donor.manifest.scenario.units)
    || source.record.OBJECT_NAME !== source.objectName) {
    return fail('snapshot/donor units or source identity mismatch');
  }
  validateReceipt(request.currentTle, source);
  const currentTle = request.currentTle;
  if (currentTle.catalogId !== source.catalogId || currentTle.objectName !== source.objectName
    || currentTle.matchedOmm.rawContentSha256 !== source.rawContentSha256
    || currentTle.matchedOmm.sourceEpoch !== source.sourceEpoch
    || currentTle.matchedOmm.catalogId !== source.catalogId
    || currentTle.matchedOmm.objectName !== source.objectName) {
    return fail('current TLE does not bind to snapshot artifact source');
  }
  const identity = materializedIdentity(donor, snapshot, currentTle, downloadPath);
  const scenario = rebindScenario(donor, identity, snapshot, currentTle, downloadPath);
  try {
    assertC120Scenario(scenario, { kind: C120_MATERIALIZED_PROVIDER_KIND, providerId: identity.providerId });
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  return freezeDeep(cloneJson(scenario));
}

export const materializeC120Scenario = materializeC120CanonicalScenario;
export const createC120CanonicalScenario = materializeC120CanonicalScenario;
export const createC120MaterializedScenario = materializeC120CanonicalScenario;
