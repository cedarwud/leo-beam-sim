import {
  createVisualLabFigureCaptureManifest,
  type VisualLabFigureProfile,
} from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';
import type {
  LabSnapshot,
  VisualLabSession,
} from '../session/visualLabSession';
import type {
  VisualLabCanonicalSnapshot,
} from '../../prototype/visual-lab-g0/visualLabCanonicalSnapshotAdapter';
import type {
  VisualLabCanonicalTimeline as RealVisualLabCanonicalTimeline,
  VisualLabCanonicalTimelinePoint,
} from '../../prototype/visual-lab-g0/visualLabCanonicalTimelineAdapter';
import { sha256 } from './hash';

/** The bundle is an export projection, never another scientific runtime. */
export const VISUAL_LAB_CAPTURE_BUNDLE_SCHEMA = 'visual-lab-capture-bundle-v1' as const;
export const VISUAL_LAB_FIGURE_SPEC_VERSION = 'scientific-figure-v1' as const;
export const VISUAL_LAB_FIGURE_DATA_SCHEMA = 'visual-lab-figure-data-v1' as const;
export const VISUAL_LAB_QUANTITATIVE_CSV_SCHEMA = 'visual-lab-quantitative-csv-v1' as const;

export type VisualLabCaptureBundleSchema = typeof VISUAL_LAB_CAPTURE_BUNDLE_SCHEMA;
export type VisualLabFigureSpecVersion = typeof VISUAL_LAB_FIGURE_SPEC_VERSION;

export type CaptureAssetRole = 'composed-png' | 'vector-overlay';
export type CaptureDataRole = 'figure-data-json' | 'quantitative-data-csv';
export type CaptureArtifactRole = 'manifest-json' | CaptureAssetRole | CaptureDataRole;

export interface CapturedAssetInput {
  /** Bytes produced by a real browser capture.  This builder never renders them. */
  readonly bytes: Uint8Array | ArrayBuffer | readonly number[] | string;
  readonly mediaType: 'image/png' | 'image/svg+xml';
  /** Optional source name; output paths remain deterministic when omitted. */
  readonly logicalPath?: string;
}

export interface VisualLabCaptureAssets {
  readonly png?: CapturedAssetInput;
  readonly svg?: CapturedAssetInput;
}

export interface CaptureBundleDescription {
  readonly caption?: string;
  readonly altText?: string;
  readonly longDescription?: string;
}

export interface CaptureBundleMetadata {
  readonly argumentId?: string;
  readonly storyUnitId?:
    | 'method-chain'
    | 'angle-response'
    | 'service-target-stress'
    | 'serving-change'
    | string;
  readonly fixtureId?: string;
  readonly readerQuestion?: string;
  readonly claimSentence?: string;
  readonly claimBoundary?: string;
  readonly panelOrder?: readonly string[];
  readonly equationLocators?: readonly string[];
  readonly sourceLocators?: readonly string[];
  readonly appRevision?: string;
  readonly appSourceDigest?: string;
  readonly primaryEvidenceRole?: 'method' | 'reference' | 'decision';
  readonly visualToleranceProfileId?: string;
}

export interface CaptureBundleBuildOptions extends CaptureBundleDescription, CaptureBundleMetadata {
  readonly figureProfile: VisualLabFigureProfile;
  readonly figureId?: string;
  readonly assets?: VisualLabCaptureAssets;
  /** Optional alias accepted by callers that already use `visualAssets`. */
  readonly visualAssets?: VisualLabCaptureAssets;
  /** Optional alias for callers that name the capture payload explicitly. */
  readonly capturedAssets?: VisualLabCaptureAssets;
  readonly capturedPng?: CapturedAssetInput;
  readonly capturedSvg?: CapturedAssetInput;
  /** Optional copy object accepted by callers that keep prose together. */
  readonly descriptions?: CaptureBundleDescription;
  readonly copy?: CaptureBundleDescription;
}

/** A digest-bearing, copied artifact. `bytes` is a frozen number array on purpose. */
export interface VisualLabCaptureArtifact {
  readonly role: CaptureArtifactRole;
  readonly logicalPath: string;
  readonly mediaType: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly bytes: readonly number[];
}

export interface VisualLabCaptureArtifactDescriptor {
  readonly role: Exclude<CaptureArtifactRole, 'manifest-json'>;
  readonly logicalPath: string;
  readonly mediaType: string;
  readonly sha256: string;
  readonly sizeBytes: number;
}

export interface VisualLabCaptureEvidenceIdentity {
  readonly runId: string | null;
  readonly frameId: string;
  readonly instantUtc: string;
  readonly identityDigest: string;
  readonly contractVersion: string;
  readonly tleFrameId: string;
  readonly analysisRunId: string | null;
  readonly geometryRunId: string | null;
  readonly instantTaipei: string;
  readonly tleEpochUtc: string;
  readonly constellation: string;
  readonly archiveId: string;
  readonly archiveDate: string;
  readonly selectedSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly selectedTlePath: string;
  readonly sourceKind: string;
  readonly propagationModel: string;
}

export interface VisualLabCaptureManifest {
  readonly schema: VisualLabCaptureBundleSchema;
  readonly figureSpecVersion: VisualLabFigureSpecVersion;
  readonly figureId: string;
  readonly argumentId: string;
  readonly storyUnitId: string;
  readonly fixtureId: string;
  readonly readerQuestion: string;
  readonly claimSentence: string;
  readonly claimBoundary: string;
  readonly panelOrder: readonly string[];
  readonly equationLocators: readonly string[];
  readonly sourceLocators: readonly string[];
  readonly appRevision: string;
  readonly appSourceDigest: string;
  readonly primaryEvidenceRole: 'method' | 'reference' | 'decision';
  readonly profileId: string;
  readonly theme: VisualLabFigureProfile['theme'];
  readonly locale: VisualLabFigureProfile['locale'];
  readonly presentation: {
    readonly theme: VisualLabFigureProfile['theme'];
    readonly locale: VisualLabFigureProfile['locale'];
    readonly profileId: string;
  };
  /** Alias retained for consumers that call the profile `figureProfile`. */
  readonly figureProfile: VisualLabFigureProfile;
  readonly profile: VisualLabFigureProfile;
  readonly contractVersion: string;
  readonly lockedPresentation: {
    readonly theme: VisualLabFigureProfile['theme'];
    readonly locale: VisualLabFigureProfile['locale'];
    readonly experience: LabSnapshot['presentation']['experience'];
    readonly viewport: VisualLabFigureProfile['viewport'];
    readonly cameraPreset: VisualLabFigureProfile['cameraPreset'];
    readonly layerPreset: VisualLabFigureProfile['layerPreset'];
  };
  readonly evidence: VisualLabCaptureEvidenceIdentity;
  readonly evidenceIdentity: VisualLabCaptureEvidenceIdentity;
  /** Short alias for integrations that call the accepted identity `identity`. */
  readonly identity: VisualLabCaptureEvidenceIdentity;
  readonly caption: string;
  readonly altText: string;
  readonly longDescription: string;
  readonly artifactFiles: readonly VisualLabCaptureArtifactDescriptor[];
  readonly visualToleranceProfileId: string;
}

export interface VisualLabFigureData {
  readonly schema: typeof VISUAL_LAB_FIGURE_DATA_SCHEMA;
  readonly evidence: VisualLabCaptureEvidenceIdentity;
  readonly presentation: {
    readonly theme: VisualLabFigureProfile['theme'];
    readonly locale: VisualLabFigureProfile['locale'];
    readonly experience: LabSnapshot['presentation']['experience'];
    readonly profileId: string;
  };
  readonly figureProfile: VisualLabFigureProfile;
  readonly canonical: VisualLabCanonicalSnapshot;
  readonly timeline: RealVisualLabCanonicalTimeline | null;
  readonly units: Readonly<Record<string, string>>;
}

export interface VisualLabCaptureBundle {
  readonly schema: VisualLabCaptureBundleSchema;
  readonly figureId: string;
  readonly manifest: VisualLabCaptureManifest;
  readonly supportingData: {
    readonly json: string;
    readonly csv: string;
  };
  /** Convenience aliases for callers that write the two data files directly. */
  readonly json: string;
  readonly csv: string;
  readonly artifacts: readonly VisualLabCaptureArtifact[];
}

export type CaptureBundleSource = LabSnapshot | VisualLabSession;

export type CaptureBundleErrorCode =
  | 'INVALID_INPUT'
  | 'NO_ACCEPTED_EVIDENCE'
  | 'UNAVAILABLE_EVIDENCE'
  | 'MOCK_EVIDENCE'
  | 'IDENTITY_MISMATCH'
  | 'PRESENTATION_MISMATCH'
  | 'INVALID_ASSET'
  | 'INVALID_BUNDLE';

export class CaptureBundleError extends Error {
  readonly code: CaptureBundleErrorCode;

  constructor(code: CaptureBundleErrorCode, message: string) {
    super(message);
    this.name = 'CaptureBundleError';
    this.code = code;
  }
}

const CSV_COLUMNS = Object.freeze([
  'row_kind',
  'anchor_index',
  'time_sec',
  'instant_utc',
  'frame_id',
  'analysis_run_id',
  'geometry_run_id',
  'serving_satellite_id',
  'candidate_satellite_id',
  'serving_sinr_db',
  'candidate_sinr_db',
  'throughput_bps',
  'power_w',
  'delivered_bits',
  'energy_j',
  'cumulative_ee_bits_per_j',
  'handover_count',
]);

const CSV_UNITS = Object.freeze([
  'unit',
  'index',
  's',
  'UTC',
  'identifier',
  'identifier',
  'identifier',
  'identifier',
  'identifier',
  'dB',
  'dB',
  'bit/s',
  'W',
  'bit',
  'J',
  'bit/J',
  'count',
]);

const DATA_UNITS: Readonly<Record<string, string>> = Object.freeze({
  anchorIndex: 'index',
  timeSec: 's',
  instantUtc: 'UTC',
  servingSinrDb: 'dB',
  candidateSinrDb: 'dB',
  throughputBps: 'bit/s',
  powerW: 'W',
  deliveredBits: 'bit',
  energyJ: 'J',
  cumulativeEeBitsPerJ: 'bit/J',
  handoverCount: 'count',
});

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

/** Stable JSON used for manifests and upload payloads. */
export function canonicalJson(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new CaptureBundleError('INVALID_INPUT', 'JSON cannot contain a non-finite number');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'undefined') return 'null';
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new CaptureBundleError('INVALID_INPUT', 'JSON cannot contain executable or bigint values');
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const object = value as Record<string, unknown>;
  const keys = Object.keys(object).filter(key => object[key] !== undefined).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
}

function text(value: unknown, label: string, fallback: string): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CaptureBundleError('INVALID_INPUT', `${label} must be non-empty text`);
  }
  return value;
}

function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CaptureBundleError('INVALID_INPUT', `${label} must be non-empty text`);
  }
  return value;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function requireUtc(value: unknown, label: string): string {
  const instant = nonEmpty(value, label);
  if (!Number.isFinite(Date.parse(instant))) {
    throw new CaptureBundleError('INVALID_INPUT', `${label} must be a parseable UTC instant`);
  }
  return instant;
}

function resolveSnapshot(source: CaptureBundleSource): LabSnapshot {
  if (source !== null && typeof source === 'object' && 'snapshot' in source && typeof source.snapshot === 'function') {
    return source.snapshot();
  }
  return source as LabSnapshot;
}

function bytesFromInput(input: CapturedAssetInput): Uint8Array {
  if (typeof input.bytes === 'string') return new TextEncoder().encode(input.bytes);
  if (input.bytes instanceof Uint8Array) return input.bytes.slice();
  if (input.bytes instanceof ArrayBuffer) return new Uint8Array(input.bytes.slice(0));
  if (Array.isArray(input.bytes)) {
    if (!input.bytes.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      throw new CaptureBundleError('INVALID_ASSET', 'asset byte arrays must contain integers in [0, 255]');
    }
    return Uint8Array.from(input.bytes);
  }
  throw new CaptureBundleError('INVALID_ASSET', 'capture assets must provide byte sequences');
}

function validateAsset(input: CapturedAssetInput, role: CaptureAssetRole): Uint8Array {
  if (input === null || typeof input !== 'object') {
    throw new CaptureBundleError('INVALID_ASSET', `${role} asset is missing`);
  }
  const expectedMediaType = role === 'composed-png' ? 'image/png' : 'image/svg+xml';
  if (input.mediaType !== expectedMediaType) {
    throw new CaptureBundleError('INVALID_ASSET', `${role} asset must use ${expectedMediaType}`);
  }
  const bytes = bytesFromInput(input);
  if (role === 'composed-png') {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < signature.length || !signature.every((value, index) => bytes[index] === value)) {
      throw new CaptureBundleError('INVALID_ASSET', 'composed-png asset does not have a valid PNG signature');
    }
  } else {
    const markup = new TextDecoder().decode(bytes);
    if (!/^\uFEFF?\s*<svg(?:\s|>)/i.test(markup)) {
      throw new CaptureBundleError('INVALID_ASSET', 'vector-overlay asset must start with an SVG root element');
    }
  }
  return bytes;
}

function identityDigest(identity: VisualLabCaptureEvidenceIdentity): string {
  return identity.identityDigest;
}

function copyIdentity(snapshot: LabSnapshot): VisualLabCaptureEvidenceIdentity {
  const accepted = snapshot.accepted;
  if (accepted === null) throw new CaptureBundleError('NO_ACCEPTED_EVIDENCE', 'capture requires an accepted evidence frame');
  const sourceIdentity = accepted.identity;
  const runId = sourceIdentity.runId ?? sourceIdentity.analysisRunId ?? sourceIdentity.geometryRunId;
  if (runId === null) {
    throw new CaptureBundleError('UNAVAILABLE_EVIDENCE', 'capture requires a canonical run identity');
  }
  const frameId = nonEmpty(sourceIdentity.frameId, 'accepted.identity.frameId');
  const instantUtc = requireUtc(sourceIdentity.instantUtc, 'accepted.identity.instantUtc');
  const identityInput = { runId, frameId, instantUtc };
  const captureManifest = createVisualLabFigureCaptureManifest({
    profile: {
      profileId: 'identity-validation',
      theme: snapshot.presentation.theme,
      locale: snapshot.presentation.locale,
      viewport: { width: 1, height: 1, devicePixelRatio: 1 },
      cameraPreset: 'global-overview',
      layerPreset: 'minimal',
    },
    evidence: identityInput,
  });
  const identity = deepFreeze({
    ...sourceIdentity,
    frameId,
    runId: sourceIdentity.runId,
    analysisRunId: sourceIdentity.analysisRunId,
    geometryRunId: sourceIdentity.geometryRunId,
    instantUtc,
    identityDigest: captureManifest.evidence.identityDigest,
  });
  return identity as VisualLabCaptureEvidenceIdentity;
}

function assertEvidenceIdentity(snapshot: LabSnapshot, identity: VisualLabCaptureEvidenceIdentity): void {
  const accepted = snapshot.accepted;
  if (accepted === null) throw new CaptureBundleError('NO_ACCEPTED_EVIDENCE', 'capture requires an accepted evidence frame');
  const canonical = accepted.canonical;
  if (canonical.isMock !== false || (accepted.timeline !== null && accepted.timeline.isMock !== false)) {
    throw new CaptureBundleError('MOCK_EVIDENCE', 'capture accepts only real canonical evidence and timelines');
  }
  if (identity.sourceKind !== 'ARCHIVED_TLE' || identity.propagationModel !== 'SGP4') {
    throw new CaptureBundleError('UNAVAILABLE_EVIDENCE', 'capture requires an archived-TLE SGP4 evidence identity');
  }
  if (canonical.source.frameId !== identity.frameId || canonical.source.tleFrameId !== identity.tleFrameId) {
    throw new CaptureBundleError('IDENTITY_MISMATCH', 'canonical source identity does not match accepted frame identity');
  }
  if (canonical.source.instantUtc !== identity.instantUtc) {
    throw new CaptureBundleError('IDENTITY_MISMATCH', 'canonical source instant does not match accepted frame identity');
  }
  if (
    canonical.source.instantTaipei !== identity.instantTaipei
    || canonical.source.tleEpochUtc !== identity.tleEpochUtc
    || canonical.source.selectedSatelliteId !== identity.selectedSatelliteId
    || canonical.source.constellation !== identity.constellation
    || canonical.source.archiveId !== identity.archiveId
    || canonical.source.archiveDate !== identity.archiveDate
    || canonical.source.selectedTlePath !== identity.selectedTlePath
    || canonical.source.sourceKind !== identity.sourceKind
    || canonical.source.propagationModel !== identity.propagationModel
    || canonical.source.contractVersion !== identity.contractVersion
  ) {
    throw new CaptureBundleError('IDENTITY_MISMATCH', 'canonical source provenance does not match accepted identity');
  }
  const canonicalCandidateId = canonical.handover.candidateSatelliteId ?? canonical.candidate.satelliteId;
  if (canonicalCandidateId !== identity.candidateSatelliteId) {
    throw new CaptureBundleError('IDENTITY_MISMATCH', 'canonical candidate identity does not match accepted identity');
  }
  if (accepted.frameId !== identity.frameId || accepted.tleFrameId !== identity.tleFrameId) {
    throw new CaptureBundleError('IDENTITY_MISMATCH', 'accepted frame aliases do not match accepted identity');
  }
  if (accepted.runId !== identity.runId && accepted.analysisRunId !== identity.analysisRunId) {
    throw new CaptureBundleError('IDENTITY_MISMATCH', 'accepted run aliases do not match accepted identity');
  }
  if (accepted.timeline !== null) {
    const timeline = accepted.timeline;
    if (identity.analysisRunId !== null && timeline.analysisRunId !== identity.analysisRunId) {
      throw new CaptureBundleError('IDENTITY_MISMATCH', 'timeline analysisRunId does not match accepted identity');
    }
    if (identity.geometryRunId !== null && timeline.geometryRunId !== identity.geometryRunId) {
      throw new CaptureBundleError('IDENTITY_MISMATCH', 'timeline geometryRunId does not match accepted identity');
    }
  }
  if (identityDigest(identity).length === 0) {
    throw new CaptureBundleError('IDENTITY_MISMATCH', 'accepted evidence identity digest is empty');
  }
}

function assertPresentation(snapshot: LabSnapshot, profile: VisualLabFigureProfile): void {
  if (snapshot.presentation.theme !== profile.theme || snapshot.presentation.locale !== profile.locale) {
    throw new CaptureBundleError(
      'PRESENTATION_MISMATCH',
      'figure profile theme and locale must match the accepted presentation state',
    );
  }
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  const rendered = typeof value === 'number'
    ? (Number.isFinite(value) ? String(Object.is(value, -0) ? 0 : value) : '')
    : String(value);
  return /[",\n\r]/.test(rendered) ? `"${rendered.replace(/"/g, '""')}"` : rendered;
}

function currentRow(
  identity: VisualLabCaptureEvidenceIdentity,
  canonical: VisualLabCanonicalSnapshot,
): readonly unknown[] {
  return [
    'current',
    canonical.timeline.anchorIndex,
    canonical.timeline.elapsedSec,
    canonical.source.instantUtc,
    identity.frameId,
    identity.analysisRunId,
    identity.geometryRunId,
    canonical.serving.satelliteId,
    canonical.candidate.satelliteId,
    canonical.serving.sinrDb,
    canonical.candidate.sinrDb,
    canonical.throughput.totalRateBps,
    canonical.power.systemPowerW,
    canonical.throughput.cumulativeDeliveredBits,
    canonical.power.cumulativeConsumedEnergyJ,
    canonical.ee.cumulativeBitsPerJ,
    canonical.handover.cumulativeCount,
  ];
}

function timelineRow(
  identity: VisualLabCaptureEvidenceIdentity,
  point: VisualLabCanonicalTimelinePoint,
): readonly unknown[] {
  return [
    'timeline',
    point.anchorIndex,
    point.timeSec,
    point.instantUtc,
    identity.frameId,
    identity.analysisRunId,
    identity.geometryRunId,
    point.servingSatelliteId,
    point.candidateSatelliteId,
    point.servingSinrDb,
    point.candidateSinrDb,
    point.throughputBps,
    point.powerW,
    point.deliveredBits,
    point.energyJ,
    point.cumulativeEeBitsPerJ,
    point.handoverCount,
  ];
}

function quantitativeCsv(
  identity: VisualLabCaptureEvidenceIdentity,
  canonical: VisualLabCanonicalSnapshot,
  timeline: RealVisualLabCanonicalTimeline | null,
): string {
  const rows = timeline === null || timeline.points.length === 0
    ? [currentRow(identity, canonical)]
    : timeline.points.map(point => timelineRow(identity, point));
  return `${[CSV_COLUMNS, CSV_UNITS, ...rows].map(row => row.map(csvCell).join(',')).join('\n')}\n`;
}

function defaultDescription(
  locale: VisualLabFigureProfile['locale'],
  identity: VisualLabCaptureEvidenceIdentity,
  kind: 'caption' | 'altText' | 'longDescription',
): string {
  if (locale === 'zh-Hant') {
    if (kind === 'caption') return `圖〈${identity.frameId}〉：封存 TLE／SGP4 證據與 canonical 鏈路、功率、速率及能源投影。`;
    if (kind === 'altText') return `封存 TLE／SGP4 畫面，呈現服務鏈路與 canonical 能源結果。`;
    return `本圖固定 accepted frame ${identity.frameId}，來源為 ${identity.constellation} 的封存 TLE 與 SGP4。所有數值來自同一筆 canonical snapshot；候選鏈路若存在仍是比較投影，不代表同時服務或實測節能。`;
  }
  if (kind === 'caption') return `Figure ${identity.frameId}: archived-TLE/SGP4 evidence with canonical link, power, rate, and energy projections.`;
  if (kind === 'altText') return 'Archived-TLE/SGP4 figure showing the serving link and canonical energy results.';
  return `This figure freezes accepted frame ${identity.frameId} from the ${identity.constellation} archived TLE and SGP4 source. Quantities come from the same canonical snapshot; an available candidate remains a comparison projection and does not claim simultaneous service or measured energy savings.`;
}

function dataPayload(
  snapshot: LabSnapshot,
  identity: VisualLabCaptureEvidenceIdentity,
  profile: VisualLabFigureProfile,
): VisualLabFigureData {
  const accepted = snapshot.accepted;
  if (accepted === null) throw new CaptureBundleError('NO_ACCEPTED_EVIDENCE', 'capture requires an accepted evidence frame');
  return deepFreeze({
    schema: VISUAL_LAB_FIGURE_DATA_SCHEMA,
    evidence: identity,
    presentation: {
      theme: profile.theme,
      locale: profile.locale,
      experience: snapshot.presentation.experience,
      profileId: profile.profileId,
    },
    figureProfile: profile,
    canonical: accepted.canonical,
    timeline: accepted.timeline,
    units: DATA_UNITS,
  });
}

function artifact(
  role: CaptureArtifactRole,
  logicalPath: string,
  mediaType: string,
  bytes: Uint8Array,
): VisualLabCaptureArtifact {
  const copied = Object.freeze(Array.from(bytes));
  return Object.freeze({
    role,
    logicalPath,
    mediaType,
    sha256: sha256(bytes),
    sizeBytes: bytes.length,
    bytes: copied,
  });
}

function descriptor(value: VisualLabCaptureArtifact): VisualLabCaptureArtifactDescriptor | null {
  if (value.role === 'manifest-json') return null;
  return Object.freeze({
    role: value.role,
    logicalPath: value.logicalPath,
    mediaType: value.mediaType,
    sha256: value.sha256,
    sizeBytes: value.sizeBytes,
  });
}

function optionsFromInput(
  sourceOrInput: CaptureBundleSource | (CaptureBundleBuildOptions & { readonly source: CaptureBundleSource }),
  maybeOptions?: CaptureBundleBuildOptions,
): { readonly source: CaptureBundleSource; readonly options: CaptureBundleBuildOptions } {
  if (maybeOptions !== undefined) return { source: sourceOrInput as CaptureBundleSource, options: maybeOptions };
  if (
    sourceOrInput !== null
    && typeof sourceOrInput === 'object'
    && 'source' in sourceOrInput
    && 'figureProfile' in sourceOrInput
  ) {
    const input = sourceOrInput as CaptureBundleBuildOptions & { readonly source: CaptureBundleSource };
    return { source: input.source, options: input };
  }
  throw new CaptureBundleError('INVALID_INPUT', 'capture builder requires a source and figure profile');
}

/**
 * Build a deterministic, immutable capture bundle from one public snapshot.
 *
 * The overload accepting a `VisualLabSession` calls only `snapshot()`.  It
 * never dispatches, subscribes, accesses a producer, or recalculates a value.
 */
export function buildVisualLabCaptureBundle(
  source: CaptureBundleSource,
  options: CaptureBundleBuildOptions,
): VisualLabCaptureBundle;
export function buildVisualLabCaptureBundle(
  input: CaptureBundleBuildOptions & { readonly source: CaptureBundleSource },
): VisualLabCaptureBundle;
export function buildVisualLabCaptureBundle(
  sourceOrInput: CaptureBundleSource | (CaptureBundleBuildOptions & { readonly source: CaptureBundleSource }),
  maybeOptions?: CaptureBundleBuildOptions,
): VisualLabCaptureBundle {
  const { source, options } = optionsFromInput(sourceOrInput, maybeOptions);
  const snapshot = resolveSnapshot(source);
  if (snapshot === null || typeof snapshot !== 'object') {
    throw new CaptureBundleError('INVALID_INPUT', 'capture source did not return a LabSnapshot');
  }
  if (options.figureProfile === null || typeof options.figureProfile !== 'object') {
    throw new CaptureBundleError('INVALID_INPUT', 'figureProfile is required');
  }
  assertPresentation(snapshot, options.figureProfile);
  const identity = copyIdentity(snapshot);
  assertEvidenceIdentity(snapshot, identity);
  const accepted = snapshot.accepted;
  if (accepted === null) throw new CaptureBundleError('NO_ACCEPTED_EVIDENCE', 'capture requires an accepted evidence frame');
  const profile = deepFreeze({
    profileId: nonEmpty(options.figureProfile.profileId, 'figureProfile.profileId'),
    theme: options.figureProfile.theme,
    locale: options.figureProfile.locale,
    viewport: {
      width: options.figureProfile.viewport.width,
      height: options.figureProfile.viewport.height,
      devicePixelRatio: options.figureProfile.viewport.devicePixelRatio,
    },
    cameraPreset: options.figureProfile.cameraPreset,
    layerPreset: options.figureProfile.layerPreset,
  });
  const figureId = nonEmpty(options.figureId ?? profile.profileId, 'figureId');
  const descriptions = {
    caption: text(options.caption ?? options.descriptions?.caption ?? options.copy?.caption, 'caption', defaultDescription(profile.locale, identity, 'caption')),
    altText: text(options.altText ?? options.descriptions?.altText ?? options.copy?.altText, 'altText', defaultDescription(profile.locale, identity, 'altText')),
    longDescription: text(options.longDescription ?? options.descriptions?.longDescription ?? options.copy?.longDescription, 'longDescription', defaultDescription(profile.locale, identity, 'longDescription')),
  };
  const data = dataPayload(snapshot, identity, profile);
  const json = canonicalJson(data);
  const csv = quantitativeCsv(identity, accepted.canonical, accepted.timeline);
  const root = `figures/${figureId}`;
  const dataArtifact = artifact('figure-data-json', `${root}/figure-data.json`, 'application/json', new TextEncoder().encode(json));
  const csvArtifact = artifact('quantitative-data-csv', `${root}/quantitative-data.csv`, 'text/csv;charset=utf-8', new TextEncoder().encode(csv));
  const assets = options.assets
    ?? options.visualAssets
    ?? options.capturedAssets
    ?? (options.capturedPng === undefined && options.capturedSvg === undefined
      ? undefined
      : { png: options.capturedPng, svg: options.capturedSvg });
  const visualArtifacts: VisualLabCaptureArtifact[] = [];
  if (assets?.png !== undefined) {
    visualArtifacts.push(artifact('composed-png', assets.png.logicalPath ?? `${root}/figure.png`, 'image/png', validateAsset(assets.png, 'composed-png')));
  }
  if (assets?.svg !== undefined) {
    visualArtifacts.push(artifact('vector-overlay', assets.svg.logicalPath ?? `${root}/overlay.svg`, 'image/svg+xml', validateAsset(assets.svg, 'vector-overlay')));
  }
  const dataArtifacts = [dataArtifact, csvArtifact, ...visualArtifacts].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath));
  const captureManifest = createVisualLabFigureCaptureManifest({
    profile,
    evidence: {
      runId: identity.runId ?? identity.analysisRunId ?? identity.geometryRunId ?? '',
      frameId: identity.frameId,
      instantUtc: identity.instantUtc,
    },
  });
  const manifest: VisualLabCaptureManifest = deepFreeze({
    schema: VISUAL_LAB_CAPTURE_BUNDLE_SCHEMA,
    figureSpecVersion: VISUAL_LAB_FIGURE_SPEC_VERSION,
    figureId,
    argumentId: text(options.argumentId, 'argumentId', figureId),
    storyUnitId: text(options.storyUnitId, 'storyUnitId', 'method-chain'),
    fixtureId: text(options.fixtureId, 'fixtureId', figureId),
    readerQuestion: text(options.readerQuestion, 'readerQuestion', 'What source-accounted relationship does this figure make inspectable?'),
    claimSentence: text(options.claimSentence, 'claimSentence', 'The accepted archived-TLE/SGP4 frame is presented through the canonical visual-lab projections.'),
    claimBoundary: text(options.claimBoundary, 'claimBoundary', 'This is a model projection, not live telemetry, measured data, or an energy-saving claim.'),
    panelOrder: Object.freeze([...(options.panelOrder ?? [])]),
    equationLocators: Object.freeze([...(options.equationLocators ?? [])]),
    sourceLocators: Object.freeze([...(options.sourceLocators ?? [])]),
    appRevision: text(options.appRevision, 'appRevision', 'unrecorded'),
    appSourceDigest: text(options.appSourceDigest, 'appSourceDigest', 'unrecorded'),
    primaryEvidenceRole: options.primaryEvidenceRole ?? 'method',
    profileId: profile.profileId,
    theme: profile.theme,
    locale: profile.locale,
    presentation: {
      theme: profile.theme,
      locale: profile.locale,
      profileId: profile.profileId,
    },
    figureProfile: profile,
    profile,
    contractVersion: captureManifest.contractVersion,
    lockedPresentation: {
      theme: profile.theme,
      locale: profile.locale,
      experience: snapshot.presentation.experience,
      viewport: profile.viewport,
      cameraPreset: profile.cameraPreset,
      layerPreset: profile.layerPreset,
    },
    evidence: identity,
    evidenceIdentity: identity,
    identity,
    caption: descriptions.caption,
    altText: descriptions.altText,
    longDescription: descriptions.longDescription,
    artifactFiles: Object.freeze(dataArtifacts.map(descriptor).filter((value): value is VisualLabCaptureArtifactDescriptor => value !== null)),
    visualToleranceProfileId: text(options.visualToleranceProfileId, 'visualToleranceProfileId', 'chromium-sw-v1'),
  });
  const manifestJson = canonicalJson(manifest);
  const manifestArtifact = artifact('manifest-json', `${root}/manifest.json`, 'application/json', new TextEncoder().encode(manifestJson));
  const artifacts = Object.freeze([manifestArtifact, ...dataArtifacts].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath)));
  const bundle: VisualLabCaptureBundle = deepFreeze({
    schema: VISUAL_LAB_CAPTURE_BUNDLE_SCHEMA,
    figureId,
    manifest,
    supportingData: Object.freeze({ json, csv }),
    json,
    csv,
    artifacts,
  });
  validateVisualLabCaptureBundle(bundle);
  return bundle;
}

export const createVisualLabCaptureBundle = buildVisualLabCaptureBundle;
export const buildCaptureBundle = buildVisualLabCaptureBundle;

function artifactBytes(value: VisualLabCaptureArtifact): Uint8Array {
  return Uint8Array.from(value.bytes);
}

/** Validate hashes, data members, and injected image signatures before writing/uploading. */
export function validateVisualLabCaptureBundle(bundle: VisualLabCaptureBundle): void {
  if (bundle === null || typeof bundle !== 'object' || bundle.schema !== VISUAL_LAB_CAPTURE_BUNDLE_SCHEMA) {
    throw new CaptureBundleError('INVALID_BUNDLE', 'unsupported or missing visual-lab capture bundle schema');
  }
  if (!Array.isArray(bundle.artifacts) || bundle.artifacts.length < 3) {
    throw new CaptureBundleError('INVALID_BUNDLE', 'capture bundle must contain manifest, JSON, and CSV artifacts');
  }
  const paths = new Set<string>();
  for (const item of bundle.artifacts) {
    if (paths.has(item.logicalPath)) throw new CaptureBundleError('INVALID_BUNDLE', `duplicate artifact path: ${item.logicalPath}`);
    paths.add(item.logicalPath);
    const bytes = artifactBytes(item);
    if (item.sizeBytes !== bytes.length || sha256(bytes) !== item.sha256) {
      throw new CaptureBundleError('INVALID_BUNDLE', `artifact digest mismatch: ${item.logicalPath}`);
    }
    if (item.role === 'composed-png') validateAsset({ bytes, mediaType: 'image/png' }, 'composed-png');
    if (item.role === 'vector-overlay') validateAsset({ bytes, mediaType: 'image/svg+xml' }, 'vector-overlay');
  }
  const manifestPath = bundle.artifacts.find(item => item.role === 'manifest-json');
  const jsonPath = bundle.artifacts.find(item => item.role === 'figure-data-json');
  const csvPath = bundle.artifacts.find(item => item.role === 'quantitative-data-csv');
  if (manifestPath === undefined || jsonPath === undefined || csvPath === undefined) {
    throw new CaptureBundleError('INVALID_BUNDLE', 'capture bundle is missing a required data artifact');
  }
  const descriptors = new Map(bundle.manifest.artifactFiles.map(item => [item.logicalPath, item]));
  for (const item of bundle.artifacts) {
    if (item.role === 'manifest-json') continue;
    const expected = descriptors.get(item.logicalPath);
    if (expected === undefined || expected.sha256 !== item.sha256 || expected.sizeBytes !== item.sizeBytes) {
      throw new CaptureBundleError('INVALID_BUNDLE', `manifest does not account for ${item.logicalPath}`);
    }
  }
  if (descriptors.size !== bundle.artifacts.length - 1) {
    throw new CaptureBundleError('INVALID_BUNDLE', 'manifest contains an orphan artifact descriptor');
  }
}

export function artifactBytesForWrite(artifactValue: VisualLabCaptureArtifact): Uint8Array {
  return artifactBytes(artifactValue);
}

export function serializeVisualLabCaptureManifest(bundle: VisualLabCaptureBundle): string {
  validateVisualLabCaptureBundle(bundle);
  return canonicalJson(bundle.manifest);
}

export function serializeVisualLabFigureData(bundle: VisualLabCaptureBundle): string {
  validateVisualLabCaptureBundle(bundle);
  return bundle.supportingData.json;
}

export function serializeVisualLabQuantitativeCsv(bundle: VisualLabCaptureBundle): string {
  validateVisualLabCaptureBundle(bundle);
  return bundle.supportingData.csv;
}

/** Small base64 encoder for the upload adapter; it is browser and Node safe. */
export function bytesToBase64(bytes: readonly number[] | Uint8Array): string {
  const values = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < values.length; index += 3) {
    const first = values[index];
    const second = index + 1 < values.length ? values[index + 1] : 0;
    const third = index + 2 < values.length ? values[index + 2] : 0;
    const combined = (first << 16) | (second << 8) | third;
    result += alphabet[(combined >>> 18) & 63];
    result += alphabet[(combined >>> 12) & 63];
    result += index + 1 < values.length ? alphabet[(combined >>> 6) & 63] : '=';
    result += index + 2 < values.length ? alphabet[combined & 63] : '=';
  }
  return result;
}

export function serializeVisualLabCaptureBundleForUpload(bundle: VisualLabCaptureBundle, schemaId: string): string {
  validateVisualLabCaptureBundle(bundle);
  const registeredSchemaId = nonEmpty(schemaId, 'schemaId');
  return canonicalJson({
    schemaId: registeredSchemaId,
    bundleSchema: bundle.schema,
    figureId: bundle.figureId,
    manifest: bundle.manifest,
    artifacts: bundle.artifacts.map(item => ({
      role: item.role,
      logicalPath: item.logicalPath,
      mediaType: item.mediaType,
      sha256: item.sha256,
      sizeBytes: item.sizeBytes,
      bytesBase64: bytesToBase64(item.bytes),
    })),
  });
}
