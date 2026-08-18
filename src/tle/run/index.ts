import { propagate, twoline2satrec } from 'satellite.js';

import { createTleFrameId } from '../propagation';
import { resolveTleSnapshotsFromValidatedManifest } from '../resolver';
import { parseUtcInstant } from '../time';
import { validateTleArchiveManifest } from '../validation';
import { deriveObserverLinkGeometry } from '../../simulator/observer';
import {
  TLE_PROPAGATION_MODEL,
  TLE_SOURCE_KIND,
  type TleArchiveEntry,
  type PropagatedSatelliteState,
  type ResolvedTleSnapshot,
  type TleArchiveManifest,
  type TlePropagationFrame,
  type TlePropagationFrameProvenance,
  type UtcInstantInput,
  type Vector3,
} from '../types';

/** The fixed two-hour playback contract for an archived-TLE run. */
export const TLE_RUN_DURATION_S = 7_200 as const;
/** The fixed playback anchor spacing for an archived-TLE run. */
export const TLE_RUN_STEP_S = 30 as const;
/** Number of inclusive anchors in the fixed run. */
export const TLE_RUN_ANCHOR_COUNT = TLE_RUN_DURATION_S / TLE_RUN_STEP_S + 1;

export const RUN_DURATION_S = TLE_RUN_DURATION_S;
export const RUN_STEP_S = TLE_RUN_STEP_S;
export const RUN_ANCHOR_COUNT = TLE_RUN_ANCHOR_COUNT;

type ReadonlyRecord = Readonly<Record<string, unknown>>;

/** The publication identity carried by simulator/archive selections. */
export interface TleRunPublication {
  readonly sha256?: string;
  readonly metadata?: {
    readonly sha256?: string;
  };
}

/**
 * Structural selection seam so this module does not depend on simulator UI
 * types.  The existing LoadedTleSnapshotSelection satisfies this interface.
 */
export interface TleRunSelection {
  readonly manifest: TleArchiveManifest;
  readonly snapshot: TleRunPublication;
  readonly catalog?: {
    readonly archiveId?: string;
  };
  readonly archiveId?: string;
  readonly publicationSha256?: string;
  readonly snapshotSha256?: string;
}

export type TleRunProgressStatus = 'running' | 'complete';

export interface TleRunProgress {
  readonly status: TleRunProgressStatus;
  readonly completedAnchors: number;
  readonly totalAnchors: typeof TLE_RUN_ANCHOR_COUNT;
  readonly anchorIndex: number;
  readonly anchorUtc: string | null;
  readonly fraction: number;
  /** Alias useful to progress bars that use a percentage. */
  readonly progress: number;
}

/** The propagation paths used by the run builder and its parity harness. */
export type TleRunPropagationMode = 'full-reference' | 'coarse-to-fine' | 'staged-coarse-to-fine';

/**
 * Optional performance path.  `full-reference` remains the explicit baseline;
 * `coarse-to-fine` first samples every resolved TLE at a sparse anchor grid,
 * retaining any satellite that could be formally visible after the declared
 * elevation safety margin or whose coarse result is uncertain.
 */
export interface TleRunCandidatePoolOptions {
  readonly mode?: TleRunPropagationMode;
  /** Coarse sample spacing in seconds; must be a multiple of the 30 s run step. */
  readonly coarseStepS?: number;
  /** Degrees below the formal 0° above-horizon gate to retain at coarse time. */
  readonly safetyMarginDeg?: number;
  /** Extra seconds sampled before/after the fixed run window. */
  readonly guardWindowS?: number;
  /**
   * Staged mode only: exact visibility-screen spacing. The authoritative
   * screen is intentionally fixed to the 30-second run axis.
   */
  readonly visibilityScreenStepS?: number;
}

export interface TleRunComputationMetrics {
  readonly mode: TleRunPropagationMode;
  readonly inputRecords: number;
  readonly coarseAnchorCount: number;
  readonly coarseSamples: number;
  readonly fineCandidateCount: number;
  readonly fineSamples: number;
  /** Exact visibility-screen samples in staged mode; zero otherwise. */
  readonly visibilityScreenSamples: number;
  /** Candidates retained by the exact authoritative visibility screen. */
  readonly visibilityScreenCandidateCount: number;
  readonly visibilityScreenStepS: number | null;
  /** Number of satellite records represented by peak scratch arrays. */
  readonly workingSatelliteCount: number;
  readonly totalSamples: number;
  readonly reductionRatio: number;
  readonly coarseStepS: number | null;
  readonly safetyMarginDeg: number | null;
  readonly guardWindowS: number | null;
  readonly wallTimeMs: number;
}

/**
 * Defaults for the opt-in candidate-pool experiment.  The public builder
 * still defaults to `full-reference` until a constellation parity gate proves
 * this exact setting safe for the active archived snapshots.
 */
export const TLE_RUN_COARSE_TO_FINE_DEFAULTS = Object.freeze({
  coarseStepS: 120,
  safetyMarginDeg: 30,
  guardWindowS: 120,
  formalVisibilityElevationDeg: 0,
});

/**
 * Measured staged candidate-pool setting for the current archived
 * Starlink/OneWeb snapshots. The exact 30-second screen is authoritative for
 * the fixed run axis; the sparse stage is only a provisional candidate gate.
 */
export const TLE_RUN_STAGED_CANDIDATE_POOL_OPTIONS = Object.freeze({
  mode: 'staged-coarse-to-fine',
  coarseStepS: 600,
  safetyMarginDeg: 10,
  guardWindowS: 600,
  visibilityScreenStepS: TLE_RUN_STEP_S,
} as const);

/**
 * Empirically parity-approved Worker setting for the current archived
 * Starlink/OneWeb snapshots. Direct callers still opt into the builder path
 * explicitly; the Worker uses this bounded staged setting after the parity
 * test.
 */
export const TLE_RUN_APPROVED_CANDIDATE_POOL_OPTIONS = TLE_RUN_STAGED_CANDIDATE_POOL_OPTIONS;

export interface TleRunBuildOptions {
  /** Explicitly fixed to 7,200 seconds when supplied. */
  readonly durationS?: number;
  /** Compatibility spelling for durationS. */
  readonly durationSec?: number;
  /** Compatibility spelling for durationS. */
  readonly duration?: number;
  /** Explicitly fixed to 30 seconds when supplied. */
  readonly stepS?: number;
  /** Compatibility spelling for stepS. */
  readonly stepSec?: number;
  /** Compatibility spelling for stepS. */
  readonly step?: number;
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: TleRunProgress) => void | Promise<void>;
  /** Return false when a newer request has superseded this build. */
  readonly isCurrent?: () => boolean;
  /** Return true when a newer request has superseded this build. */
  readonly isStale?: () => boolean;
  /** Alias for isStale retained for controller adapters. */
  readonly stale?: () => boolean;
  /** Yield after this many anchors. Lower values improve cancellation latency. */
  readonly yieldEveryAnchors?: number;
  /** Optional measured candidate-pool path; omitted means full reference. */
  readonly candidatePool?: TleRunCandidatePoolOptions;
}

export interface TleRunBuildInput extends TleRunBuildOptions {
  readonly selection: TleRunSelection;
  readonly t0Utc?: UtcInstantInput;
  readonly t0?: UtcInstantInput;
}

export type TleRunState = PropagatedSatelliteState & {
  readonly anchorIndex: number;
  readonly satelliteIndex: number;
};

export interface TleRunSatelliteMetadata {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly sourcePath: string;
  readonly sourceKind: typeof TLE_SOURCE_KIND;
  readonly tleEpochUtc: string;
  readonly catalogNumber: string;
}

/** Why a resolved satellite was removed from one complete geometry run. */
export type TleRunExclusionReason =
  | 'SGP4_INIT_FAILED'
  | 'SGP4_PROPAGATION_FAILED'
  | 'NONFINITE_POSITION'
  | 'NONFINITE_VELOCITY'
  | 'COARSE_FILTERED';

/** Frozen evidence for the first failure that removed one satellite. */
export interface TleRunSatelliteExclusion {
  readonly satelliteId: string;
  readonly satelliteName: string;
  readonly sourcePath: string;
  readonly sourceKind: typeof TLE_SOURCE_KIND;
  readonly tleEpochUtc: string;
  readonly firstFailingAnchorIndex: number;
  readonly firstFailingAnchorUtc: string;
  readonly reason: TleRunExclusionReason;
  readonly satrecError?: number;
  readonly message?: string;
}

/** Counts and per-satellite exclusions frozen into the accepted RunBundle. */
export interface TleRunExclusionProvenance {
  /** Unique satellite records admitted from the source publication. */
  readonly sourceCount: number;
  /** Resolved snapshot count before propagation exclusions. */
  readonly resolvedCount: number;
  /** Satellites retained in every anchor of this run. */
  readonly includedCount: number;
  readonly excludedCount: number;
  readonly exclusions: readonly TleRunSatelliteExclusion[];
}

export type TleRunSatelliteRef = number | string;

export interface TleRunBundle {
  readonly runId: string;
  /** Raw identity input used for deterministic runId construction. */
  readonly runIdentity: string;
  readonly archiveId: string;
  readonly publicationSha256: string;
  readonly t0Utc: string;
  readonly durationS: typeof TLE_RUN_DURATION_S;
  readonly stepS: typeof TLE_RUN_STEP_S;
  readonly anchorCount: typeof TLE_RUN_ANCHOR_COUNT;
  /** The normalized publication manifest frozen at request time. */
  readonly manifest: TleArchiveManifest;
  /** One resolved, frozen record per retained satellite, selected at t0. */
  readonly resolvedSnapshots: readonly ResolvedTleSnapshot[];
  readonly satellites: readonly TleRunSatelliteMetadata[];
  readonly satelliteCount: number;
  /** Source/resolution counts and deterministic per-satellite exclusions. */
  readonly exclusionProvenance: TleRunExclusionProvenance;
  /** Measured propagation work for this accepted run. */
  readonly computationMetrics: TleRunComputationMetrics;
  readonly getSatelliteIndex: (satelliteId: string) => number | undefined;
  readonly satelliteIndex: (satelliteId: string) => number | undefined;
  readonly getSatelliteMetadata: (satellite: TleRunSatelliteRef) => TleRunSatelliteMetadata;
  readonly getAnchorUtc: (anchorIndex: number) => string;
  readonly anchorUtc: (anchorIndex: number) => string;
  readonly getAnchorInstantUtc: (anchorIndex: number) => string;
  readonly readState: (anchorIndex: number, satellite: TleRunSatelliteRef) => TleRunState;
  readonly readStateByIndex: (anchorIndex: number, satelliteIndex: number) => TleRunState;
  readonly getState: (anchorIndex: number, satellite: TleRunSatelliteRef) => TleRunState;
  readonly stateAt: (anchorIndex: number, satellite: TleRunSatelliteRef) => TleRunState;
  /** Materialize an immutable standard TLE frame from stored ephemeris. */
  readonly materializeFrame: (anchor: number | UtcInstantInput) => TlePropagationFrame;
  readonly frameAt: (anchor: number | UtcInstantInput) => TlePropagationFrame;
}

export type RunBundle = TleRunBundle;
export type ArchivedTleRunBundle = TleRunBundle;

export type TleRunErrorCode =
  | 'INVALID_CONFIG'
  | 'INVALID_SELECTION'
  | 'CANCELLED'
  | 'STALE'
  | 'PROPAGATION_FAILED';

/** Fail-closed errors produced while constructing a run. */
export class TleRunError extends Error {
  readonly code: TleRunErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(code: TleRunErrorCode, message: string, details?: Readonly<Record<string, unknown>>) {
    super(message);
    this.name = 'TleRunError';
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isTleRunError(error: unknown): error is TleRunError {
  return error instanceof TleRunError;
}

function fail(
  code: TleRunErrorCode,
  message: string,
  details?: Readonly<Record<string, unknown>>,
): never {
  throw new TleRunError(code, message, details);
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as ReadonlyRecord)) deepFreeze(child);
  return value;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail('INVALID_SELECTION', `${label} must be a non-empty string`);
  return value.trim();
}

function publicationSha256(selection: TleRunSelection): string {
  const direct = selection.snapshot.sha256;
  const nested = selection.snapshot.metadata?.sha256;
  const explicit = selection.publicationSha256 ?? selection.snapshotSha256;
  const candidates = [direct, nested, explicit].filter((value): value is string => value !== undefined);
  if (candidates.length === 0) fail('INVALID_SELECTION', 'selection.snapshot must provide a publication SHA-256');
  const normalized = requiredText(candidates[0], 'publication SHA-256');
  if (candidates.some((candidate) => candidate !== normalized)) {
    fail('INVALID_SELECTION', 'selection publication SHA-256 values disagree');
  }
  return normalized;
}

function archiveIdForSelection(selection: TleRunSelection, manifest: TleArchiveManifest): string {
  const candidates = [selection.catalog?.archiveId, selection.archiveId, manifest.archiveId]
    .filter((value): value is string => value !== undefined);
  if (candidates.length === 0) fail('INVALID_SELECTION', 'selection must provide archiveId');
  const archiveId = requiredText(candidates[0], 'archiveId');
  if (candidates.some((candidate) => candidate !== archiveId)) {
    fail('INVALID_SELECTION', 'selection archiveId values disagree');
  }
  return archiveId;
}

function stableHash(input: string): string {
  // FNV-1a is deterministic in browsers and sufficient as a compact run key;
  // publication SHA remains a first-class raw identity in runIdentity.
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function runIdentity(
  archiveId: string,
  publicationSha: string,
  t0Utc: string,
  exclusions: readonly TleRunSatelliteExclusion[],
): string {
  // Include the effective exclusion set, not only the source publication. A
  // future satellite.js/catalog change must never silently reuse a run key
  // whose compact ephemeris contains a different satellite set.
  const exclusionIdentity = JSON.stringify(exclusions.map((exclusion) => [
    exclusion.satelliteId,
    exclusion.firstFailingAnchorIndex,
    exclusion.firstFailingAnchorUtc,
    exclusion.reason,
    exclusion.satrecError ?? null,
  ]));
  return [archiveId, publicationSha, t0Utc, TLE_RUN_DURATION_S, TLE_RUN_STEP_S, exclusionIdentity].join('|');
}

function runId(identity: string, archiveId: string, publicationSha: string, t0Utc: string): string {
  // Keep the machine-readable components visible while including a compact
  // digest for logs and equality checks.
  return [
    'tle-run',
    encodeURIComponent(archiveId),
    encodeURIComponent(publicationSha),
    encodeURIComponent(t0Utc),
    TLE_RUN_DURATION_S,
    TLE_RUN_STEP_S,
    stableHash(identity),
  ].join(':');
}

function validateFixedConfig(options: TleRunBuildOptions): void {
  const durations = [options.durationS, options.durationSec, options.duration]
    .filter((value): value is number => value !== undefined);
  const steps = [options.stepS, options.stepSec, options.step]
    .filter((value): value is number => value !== undefined);
  if (durations.some((value) => value !== TLE_RUN_DURATION_S) || new Set(durations).size > 1) {
    fail('INVALID_CONFIG', `durationS must be exactly ${TLE_RUN_DURATION_S}`);
  }
  if (steps.some((value) => value !== TLE_RUN_STEP_S) || new Set(steps).size > 1) {
    fail('INVALID_CONFIG', `stepS must be exactly ${TLE_RUN_STEP_S}`);
  }
  const yieldEvery = options.yieldEveryAnchors;
  if (yieldEvery !== undefined && (!Number.isInteger(yieldEvery) || yieldEvery < 1)) {
    fail('INVALID_CONFIG', 'yieldEveryAnchors must be a positive integer');
  }
}

interface NormalizedCandidatePoolOptions {
  readonly mode: TleRunPropagationMode;
  readonly coarseStepS: number;
  readonly coarseStepAnchors: number;
  readonly safetyMarginDeg: number;
  readonly guardWindowS: number;
  readonly visibilityScreenStepS: number;
}

function normalizeCandidatePoolOptions(
  options: TleRunCandidatePoolOptions | undefined,
): NormalizedCandidatePoolOptions {
  const mode = options?.mode ?? 'full-reference';
  if (mode === 'full-reference') {
    return {
      mode,
      coarseStepS: 0,
      coarseStepAnchors: 0,
      safetyMarginDeg: 0,
      guardWindowS: 0,
      visibilityScreenStepS: 0,
    };
  }
  const coarseStepS = options?.coarseStepS ?? TLE_RUN_COARSE_TO_FINE_DEFAULTS.coarseStepS;
  const safetyMarginDeg = options?.safetyMarginDeg ?? TLE_RUN_COARSE_TO_FINE_DEFAULTS.safetyMarginDeg;
  const guardWindowS = options?.guardWindowS ?? TLE_RUN_COARSE_TO_FINE_DEFAULTS.guardWindowS;
  if (!Number.isInteger(coarseStepS) || coarseStepS < TLE_RUN_STEP_S || coarseStepS % TLE_RUN_STEP_S !== 0) {
    fail('INVALID_CONFIG', `candidatePool.coarseStepS must be an integer multiple of ${TLE_RUN_STEP_S} at or above ${TLE_RUN_STEP_S}`);
  }
  if (!Number.isFinite(safetyMarginDeg) || safetyMarginDeg <= 0 || safetyMarginDeg > 90) {
    fail('INVALID_CONFIG', 'candidatePool.safetyMarginDeg must be > 0 and <= 90 degrees');
  }
  if (!Number.isFinite(guardWindowS) || guardWindowS < 0 || guardWindowS > TLE_RUN_DURATION_S) {
    fail('INVALID_CONFIG', `candidatePool.guardWindowS must be in [0, ${TLE_RUN_DURATION_S}] seconds`);
  }
  const visibilityScreenStepS = options?.visibilityScreenStepS ?? TLE_RUN_STEP_S;
  if (mode === 'staged-coarse-to-fine' && visibilityScreenStepS !== TLE_RUN_STEP_S) {
    fail('INVALID_CONFIG', `staged candidatePool.visibilityScreenStepS must be exactly ${TLE_RUN_STEP_S} seconds`);
  }
  return {
    mode,
    coarseStepS,
    coarseStepAnchors: coarseStepS / TLE_RUN_STEP_S,
    safetyMarginDeg,
    guardWindowS,
    visibilityScreenStepS: mode === 'staged-coarse-to-fine' ? visibilityScreenStepS : 0,
  };
}

function coarseSampleOffsets(options: NormalizedCandidatePoolOptions): readonly number[] {
  if (options.mode === 'full-reference') return [];
  const offsets: number[] = [];
  const start = -options.guardWindowS;
  const end = TLE_RUN_DURATION_S + options.guardWindowS;
  for (let offset = start; offset <= end; offset += options.coarseStepS) offsets.push(offset);
  if (!offsets.includes(0)) offsets.push(0);
  if (!offsets.includes(TLE_RUN_DURATION_S)) offsets.push(TLE_RUN_DURATION_S);
  return [...new Set(offsets)].sort((left, right) => left - right);
}

function authoritativeVisibilitySampleOffsets(options: NormalizedCandidatePoolOptions): readonly number[] {
  if (options.mode !== 'staged-coarse-to-fine') return [];
  const offsets: number[] = [];
  for (let offset = 0; offset <= TLE_RUN_DURATION_S; offset += options.visibilityScreenStepS) {
    offsets.push(offset);
  }
  if (offsets[offsets.length - 1] !== TLE_RUN_DURATION_S) offsets.push(TLE_RUN_DURATION_S);
  return offsets;
}

function nearestRunAnchorIndex(offsetS: number): number {
  return Math.max(0, Math.min(
    TLE_RUN_ANCHOR_COUNT - 1,
    Math.round(offsetS / TLE_RUN_STEP_S),
  ));
}

function parseT0(input: UtcInstantInput | undefined): { readonly value: string; readonly ms: number } {
  if (input === undefined) fail('INVALID_CONFIG', 't0Utc (or t0) is required');
  try {
    return parseUtcInstant(input, 't0Utc');
  } catch (error) {
    if (error instanceof TleRunError) throw error;
    fail('INVALID_CONFIG', error instanceof Error ? error.message : String(error), {
      cause: error instanceof Error ? error.name : typeof error,
    });
  }
}

function throwIfInactive(options: TleRunBuildOptions): void {
  if (options.signal?.aborted) fail('CANCELLED', 'archived-TLE run was cancelled');
  if (options.isStale?.() === true || options.stale?.() === true) {
    fail('STALE', 'archived-TLE run was superseded by a newer request');
  }
  if (options.isCurrent?.() === false) {
    fail('STALE', 'archived-TLE run was superseded by a newer request');
  }
}

async function yieldToBrowser(): Promise<void> {
  const requestAnimationFrame = (globalThis as typeof globalThis & {
    requestAnimationFrame?: (callback: () => void) => number;
  }).requestAnimationFrame;
  if (typeof requestAnimationFrame === 'function') {
    await new Promise<void>((resolve) => requestAnimationFrame(resolve));
    return;
  }
  await new Promise<void>((resolve) => globalThis.setTimeout(resolve, 0));
}

function anchorUtcForIndex(t0Ms: number, anchorIndex: number): string {
  return new Date(t0Ms + anchorIndex * TLE_RUN_STEP_S * 1_000).toISOString();
}

function utcForOffset(t0Ms: number, offsetS: number): string {
  return new Date(t0Ms + offsetS * 1_000).toISOString();
}

function validateAnchorIndex(anchorIndex: number): void {
  if (!Number.isInteger(anchorIndex) || anchorIndex < 0 || anchorIndex >= TLE_RUN_ANCHOR_COUNT) {
    throw new RangeError(`anchor index must be an integer in [0, ${TLE_RUN_ANCHOR_COUNT - 1}]`);
  }
}

function stateIndex(anchorIndex: number, satelliteIndex: number, satelliteCount: number): number {
  return (anchorIndex * satelliteCount + satelliteIndex) * 3;
}

function freezeManifest(manifest: TleArchiveManifest): TleArchiveManifest {
  // validateTleArchiveManifest makes a detached normalized copy and freezes
  // every record, protecting the run from caller mutation after admission.
  return validateTleArchiveManifest(manifest);
}

function metadataForSnapshot(snapshot: ResolvedTleSnapshot): TleRunSatelliteMetadata {
  return freeze({
    satelliteId: snapshot.satelliteId,
    satelliteName: snapshot.satelliteName,
    sourcePath: snapshot.sourcePath,
    sourceKind: snapshot.sourceKind,
    tleEpochUtc: snapshot.epochUtc,
    catalogNumber: snapshot.line1.slice(2, 7).trim(),
  });
}

interface PropagationRecord {
  readonly snapshot: ResolvedTleSnapshot;
  satrec: ReturnType<typeof twoline2satrec> | null;
}

interface ExclusionDetails {
  readonly satrecError?: unknown;
  readonly message?: unknown;
}

function exclusionFor(
  snapshot: ResolvedTleSnapshot,
  anchorIndex: number,
  anchorUtc: string,
  reason: TleRunExclusionReason,
  details: ExclusionDetails = {},
): TleRunSatelliteExclusion {
  const satrecError = typeof details.satrecError === 'number' && Number.isFinite(details.satrecError)
    ? details.satrecError
    : undefined;
  const message = typeof details.message === 'string' && details.message.trim() !== ''
    ? details.message
    : undefined;
  return freeze({
    satelliteId: snapshot.satelliteId,
    satelliteName: snapshot.satelliteName,
    sourcePath: snapshot.sourcePath,
    sourceKind: snapshot.sourceKind,
    tleEpochUtc: snapshot.epochUtc,
    firstFailingAnchorIndex: anchorIndex,
    firstFailingAnchorUtc: anchorUtc,
    reason,
    ...(satrecError === undefined ? {} : { satrecError }),
    ...(message === undefined ? {} : { message }),
  });
}

function exclusionProvenance(
  sourceCount: number,
  resolvedCount: number,
  exclusions: readonly TleRunSatelliteExclusion[],
): TleRunExclusionProvenance {
  const frozenExclusions = freeze([...exclusions]);
  return freeze({
    sourceCount,
    resolvedCount,
    includedCount: sourceCount - frozenExclusions.length,
    excludedCount: frozenExclusions.length,
    exclusions: frozenExclusions,
  });
}

function finiteVectorOrNull(value: unknown): Vector3 | null {
  if (value === null || typeof value !== 'object') return null;
  const candidate = value as { readonly x?: unknown; readonly y?: unknown; readonly z?: unknown };
  if (![candidate.x, candidate.y, candidate.z].every((component) => (
    typeof component === 'number' && Number.isFinite(component)
  ))) return null;
  return freeze({
    x: candidate.x as number,
    y: candidate.y as number,
    z: candidate.z as number,
  });
}

function anchorIndexForInput(
  anchor: number | UtcInstantInput,
  t0Ms: number,
): number {
  if (typeof anchor === 'number') {
    validateAnchorIndex(anchor);
    return anchor;
  }
  const parsed = parseUtcInstant(anchor, 'run anchor');
  const offsetMs = parsed.ms - t0Ms;
  const index = offsetMs / (TLE_RUN_STEP_S * 1_000);
  if (!Number.isInteger(index)) throw new RangeError('run anchor must equal one of the 30-second UTC anchors');
  validateAnchorIndex(index);
  return index;
}

function progressValue(
  status: TleRunProgressStatus,
  completedAnchors: number,
  anchorIndex: number,
  anchorUtc: string | null,
): TleRunProgress {
  const fraction = completedAnchors / TLE_RUN_ANCHOR_COUNT;
  return freeze({
    status,
    completedAnchors,
    totalAnchors: TLE_RUN_ANCHOR_COUNT,
    anchorIndex,
    anchorUtc,
    fraction,
    progress: fraction,
  });
}

interface ParsedBuildArgs {
  readonly selection: TleRunSelection;
  readonly t0Utc: UtcInstantInput | undefined;
  readonly options: TleRunBuildOptions;
}

function parseBuildArgs(
  first: TleRunBuildInput | TleRunSelection,
  second?: UtcInstantInput | TleRunBuildOptions,
  third?: TleRunBuildOptions,
): ParsedBuildArgs {
  if ('selection' in first) {
    const input = first as TleRunBuildInput;
    const { selection: _selection, t0Utc: _t0Utc, t0: _t0, ...rest } = input;
    return {
      selection: input.selection,
      t0Utc: input.t0Utc ?? input.t0,
      options: rest,
    };
  }
  if (second !== undefined && typeof second === 'object' && !(second instanceof Date)) {
    return {
      selection: first,
      t0Utc: undefined,
      options: second as TleRunBuildOptions,
    };
  }
  return {
    selection: first,
    t0Utc: second as UtcInstantInput | undefined,
    options: third ?? {},
  };
}

/**
 * Build a complete immutable archived-TLE run.  The preferred call form is:
 *
 *   buildTleRunBundle({ selection, t0Utc, onProgress, signal })
 *
 * For controller convenience, `buildTleRunBundle(selection, t0Utc, options)`
 * and `buildTleRunBundle(selection, { t0Utc, ...options })` are also accepted.
 */
export async function buildTleRunBundle(input: TleRunBuildInput): Promise<TleRunBundle>;
export async function buildTleRunBundle(
  selection: TleRunSelection,
  t0Utc: UtcInstantInput,
  options?: TleRunBuildOptions,
): Promise<TleRunBundle>;
export async function buildTleRunBundle(
  selection: TleRunSelection,
  options: TleRunBuildOptions & { readonly t0Utc?: UtcInstantInput; readonly t0?: UtcInstantInput },
): Promise<TleRunBundle>;
export async function buildTleRunBundle(
  first: TleRunBuildInput | TleRunSelection,
  second?: UtcInstantInput | (TleRunBuildOptions & { readonly t0Utc?: UtcInstantInput; readonly t0?: UtcInstantInput }),
  third?: TleRunBuildOptions,
): Promise<TleRunBundle> {
  const startedAtMs = Date.now();
  const parsedArgs = parseBuildArgs(first, second, third);
  const options = parsedArgs.options;
  const t0Input = parsedArgs.t0Utc ?? (
    second !== undefined && typeof second === 'object' && !(second instanceof Date)
      ? (second as TleRunBuildOptions & { readonly t0Utc?: UtcInstantInput; readonly t0?: UtcInstantInput }).t0Utc
        ?? (second as TleRunBuildOptions & { readonly t0Utc?: UtcInstantInput; readonly t0?: UtcInstantInput }).t0
      : undefined
  );

  validateFixedConfig(options);
  const candidatePool = normalizeCandidatePoolOptions(options.candidatePool);
  throwIfInactive(options);
  const t0 = parseT0(t0Input);
  const selection = parsedArgs.selection;
  if (selection === null || typeof selection !== 'object') fail('INVALID_SELECTION', 'selection must be an object');
  if (selection.manifest === null || typeof selection.manifest !== 'object') fail('INVALID_SELECTION', 'selection.manifest is required');
  if (selection.snapshot === null || typeof selection.snapshot !== 'object') fail('INVALID_SELECTION', 'selection.snapshot is required');

  const manifest = freezeManifest(selection.manifest);
  const archiveId = archiveIdForSelection(selection, manifest);
  const publicationSha = publicationSha256(selection);
  const ids = [...new Set(manifest.entries.map((entry) => entry.satelliteId))].sort();
  if (ids.length === 0) fail('INVALID_SELECTION', 'selection.manifest must contain at least one satellite');
  const snapshots = resolveTleSnapshotsFromValidatedManifest(manifest, t0.value, ids);
  if (snapshots.length !== ids.length) {
    fail('INVALID_SELECTION', 'the run requires one resolved record for every catalog satellite');
  }
  const sortedSnapshots = [...snapshots].sort((left, right) => left.satelliteId.localeCompare(right.satelliteId));
  const resolvedCount = sortedSnapshots.length;
  const records: PropagationRecord[] = sortedSnapshots.map((snapshot) => ({ snapshot, satrec: null }));
  const exclusionsBySource = new Map<number, TleRunSatelliteExclusion>();
  const t0AnchorUtc = anchorUtcForIndex(t0.ms, 0);
  for (let sourceIndex = 0; sourceIndex < records.length; sourceIndex += 1) {
    throwIfInactive(options);
    const record = records[sourceIndex]!;
    try {
      const satrec = twoline2satrec(record.snapshot.line1, record.snapshot.line2);
      if (satrec.error !== 0) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          record.snapshot,
          0,
          t0AnchorUtc,
          'SGP4_INIT_FAILED',
          { satrecError: satrec.error },
        ));
      } else {
        record.satrec = satrec;
      }
    } catch (error) {
      exclusionsBySource.set(sourceIndex, exclusionFor(
        record.snapshot,
        0,
        t0AnchorUtc,
        'SGP4_INIT_FAILED',
        { message: error instanceof Error ? error.message : String(error) },
      ));
    }
  }

  // Allocate against the resolved source set while propagating. The final
  // compact buffers below are anchor-major and contain only satellites that
  // survived every one of the 241 common anchors. In staged mode the working
  // arrays are narrowed to provisional candidates after the sparse screen;
  // the exact 30-second visibility screen then becomes the published array.
  const sourceSatelliteCount = records.length;
  let sourcePositions!: Float64Array;
  let sourceVelocities!: Float64Array;
  let storageSatelliteCount = sourceSatelliteCount;
  const sourceStorageIndices = new Int32Array(sourceSatelliteCount);
  sourceStorageIndices.fill(-1);

  const satelliteIndices = new Map<string, number>();
  const coarseOffsets = coarseSampleOffsets(candidatePool);
  const coarseCandidateFlags = records.map(() => false);
  let coarseSamples = 0;
  let fineSamples = 0;

  if (options.onProgress !== undefined) {
    await options.onProgress(progressValue('running', 0, -1, null));
    throwIfInactive(options);
  }

  const yieldEvery = options.yieldEveryAnchors ?? 4;
  if (candidatePool.mode === 'coarse-to-fine' || candidatePool.mode === 'staged-coarse-to-fine') {
    const coarseThresholdDeg = TLE_RUN_COARSE_TO_FINE_DEFAULTS.formalVisibilityElevationDeg
      - candidatePool.safetyMarginDeg;
    for (let coarseIndex = 0; coarseIndex < coarseOffsets.length; coarseIndex += 1) {
      throwIfInactive(options);
      const offsetS = coarseOffsets[coarseIndex]!;
      const instantUtc = utcForOffset(t0.ms, offsetS);
      const instant = new Date(t0.ms + offsetS * 1_000);
      for (let sourceIndex = 0; sourceIndex < records.length; sourceIndex += 1) {
        throwIfInactive(options);
        const record = records[sourceIndex]!;
        if (record.satrec === null) continue;
        coarseSamples += 1;
        try {
          const propagated = propagate(record.satrec, instant);
          if (propagated === null || propagated === undefined || record.satrec.error !== 0) {
            // A coarse uncertainty is retained for the fine pass; only a
            // formal fine failure may exclude a satellite from the run.
            coarseCandidateFlags[sourceIndex] = true;
            continue;
          }
          const position = finiteVectorOrNull(propagated.position);
          if (position === null) {
            coarseCandidateFlags[sourceIndex] = true;
            continue;
          }
          const coarseGeometry = deriveObserverLinkGeometry(position, instantUtc);
          if (coarseGeometry.elevationDeg >= coarseThresholdDeg) {
            coarseCandidateFlags[sourceIndex] = true;
          }
        } catch {
          // Fail-open at the candidate stage. A malformed/uncertain coarse
          // sample must reach the exact 241-anchor path rather than become a
          // silent false negative.
          coarseCandidateFlags[sourceIndex] = true;
        }
      }
      throwIfInactive(options);
      if ((coarseIndex + 1) % yieldEvery === 0 && coarseIndex + 1 < coarseOffsets.length) {
        await yieldToBrowser();
        throwIfInactive(options);
      }
    }

    // Coarse propagation mutates satellite.js records. Reinitialize every
    // retained candidate before the formal ascending fine pass so the exact
    // SGP4 state is independent of the coarse probe history.
    for (let sourceIndex = 0; sourceIndex < records.length; sourceIndex += 1) {
      const record = records[sourceIndex]!;
      if (record.satrec === null) continue;
      if (!coarseCandidateFlags[sourceIndex]) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          record.snapshot,
          0,
          t0AnchorUtc,
          'COARSE_FILTERED',
          { message: `coarse visibility below ${coarseThresholdDeg} degrees across guard window` },
        ));
        record.satrec = null;
        continue;
      }
      try {
        const freshSatrec = twoline2satrec(record.snapshot.line1, record.snapshot.line2);
        if (freshSatrec.error !== 0) {
          exclusionsBySource.set(sourceIndex, exclusionFor(
            record.snapshot,
            0,
            t0AnchorUtc,
            'SGP4_INIT_FAILED',
            { satrecError: freshSatrec.error },
          ));
          record.satrec = null;
        } else {
          record.satrec = freshSatrec;
        }
      } catch (error) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          record.snapshot,
          0,
          t0AnchorUtc,
          'SGP4_INIT_FAILED',
          { message: error instanceof Error ? error.message : String(error) },
        ));
        record.satrec = null;
      }
    }
  }
  const fineCandidateCount = records.reduce((count, record) => count + (record.satrec === null ? 0 : 1), 0);
  if (candidatePool.mode === 'staged-coarse-to-fine') {
    storageSatelliteCount = fineCandidateCount;
    let storageIndex = 0;
    for (let sourceIndex = 0; sourceIndex < records.length; sourceIndex += 1) {
      if (records[sourceIndex]!.satrec !== null) sourceStorageIndices[sourceIndex] = storageIndex++;
    }
  } else {
    storageSatelliteCount = sourceSatelliteCount;
    for (let sourceIndex = 0; sourceIndex < sourceSatelliteCount; sourceIndex += 1) {
      sourceStorageIndices[sourceIndex] = sourceIndex;
    }
  }
  const sourceScalarCount = TLE_RUN_ANCHOR_COUNT * storageSatelliteCount * 3;
  sourcePositions = new Float64Array(sourceScalarCount);
  sourceVelocities = new Float64Array(sourceScalarCount);
  let visibilityScreenSamples = 0;
  let visibilityScreenCandidateCount = 0;
  const visibilityScreenFlags = records.map(() => false);
  const visibilityScreenOffsets = authoritativeVisibilitySampleOffsets(candidatePool);
  const shouldRunVisibilityScreen = candidatePool.mode === 'staged-coarse-to-fine';
  const fineAnchorOffsets = shouldRunVisibilityScreen ? visibilityScreenOffsets : Array.from(
    { length: TLE_RUN_ANCHOR_COUNT },
    (_value, anchorIndex) => anchorIndex * TLE_RUN_STEP_S,
  );
  const fineAnchorCount = fineAnchorOffsets.length;
  for (let anchorIndex = 0; anchorIndex < (shouldRunVisibilityScreen ? fineAnchorCount : TLE_RUN_ANCHOR_COUNT); anchorIndex += 1) {
    throwIfInactive(options);
    const offsetS = fineAnchorOffsets[anchorIndex]!;
    const instantUtc = utcForOffset(t0.ms, offsetS);
    const instant = new Date(t0.ms + offsetS * 1_000);
    for (let sourceIndex = 0; sourceIndex < records.length; sourceIndex += 1) {
      throwIfInactive(options);
      const record = records[sourceIndex]!;
      if (record.satrec === null) continue;
      const snapshot = record.snapshot;
      const satrec = record.satrec;
      fineSamples += 1;
      if (shouldRunVisibilityScreen) visibilityScreenSamples += 1;
      let propagated: ReturnType<typeof propagate>;
      try {
        propagated = propagate(satrec, instant);
      } catch (error) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          snapshot,
          anchorIndex,
          instantUtc,
          'SGP4_PROPAGATION_FAILED',
          { satrecError: satrec.error, message: error instanceof Error ? error.message : String(error) },
        ));
        record.satrec = null;
        continue;
      }
      if (propagated === null || propagated === undefined || satrec.error !== 0) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          snapshot,
          anchorIndex,
          instantUtc,
          'SGP4_PROPAGATION_FAILED',
          { satrecError: satrec.error },
        ));
        record.satrec = null;
        continue;
      }
      const position = finiteVectorOrNull(propagated.position);
      if (position === null) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          snapshot,
          anchorIndex,
          instantUtc,
          'NONFINITE_POSITION',
        ));
        record.satrec = null;
        continue;
      }
      const velocity = finiteVectorOrNull(propagated.velocity);
      if (velocity === null) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          snapshot,
          anchorIndex,
          instantUtc,
          'NONFINITE_VELOCITY',
        ));
        record.satrec = null;
        continue;
      }
      const storageIndex = sourceStorageIndices[sourceIndex];
      if (storageIndex < 0) continue;
      const offset = stateIndex(anchorIndex, storageIndex, storageSatelliteCount);
      sourcePositions[offset] = position.x;
      sourcePositions[offset + 1] = position.y;
      sourcePositions[offset + 2] = position.z;
      sourceVelocities[offset] = velocity.x;
      sourceVelocities[offset + 1] = velocity.y;
      sourceVelocities[offset + 2] = velocity.z;
      if (shouldRunVisibilityScreen) {
        try {
          const exactGeometry = deriveObserverLinkGeometry(position, instantUtc);
          if (exactGeometry.visible) visibilityScreenFlags[sourceIndex] = true;
        } catch {
          // An exact visibility-screen geometry uncertainty must not become a
          // false negative. Keep the provisional satellite; the later
          // analysis boundary remains authoritative for any real failure.
          visibilityScreenFlags[sourceIndex] = true;
        }
      }
    }
    const completedAnchors = anchorIndex + 1;
    if (options.onProgress !== undefined) {
      await options.onProgress(progressValue('running', completedAnchors, anchorIndex, instantUtc));
    }
    throwIfInactive(options);
    if (completedAnchors % yieldEvery === 0 && completedAnchors < (shouldRunVisibilityScreen ? fineAnchorCount : TLE_RUN_ANCHOR_COUNT)) {
      await yieldToBrowser();
      throwIfInactive(options);
    }
  }

  if (shouldRunVisibilityScreen) {
    for (let sourceIndex = 0; sourceIndex < records.length; sourceIndex += 1) {
      const record = records[sourceIndex]!;
      if (record.satrec === null) continue;
      if (!visibilityScreenFlags[sourceIndex]) {
        exclusionsBySource.set(sourceIndex, exclusionFor(
          record.snapshot,
          0,
          t0AnchorUtc,
          'COARSE_FILTERED',
          { message: 'excluded by the exact authoritative 30-second visibility screen' },
        ));
        record.satrec = null;
      } else {
        visibilityScreenCandidateCount += 1;
      }
    }
  }

  throwIfInactive(options);
  const excluded = freeze([...exclusionsBySource.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, exclusion]) => exclusion));
  const provenance = exclusionProvenance(sourceSatelliteCount, resolvedCount, excluded);
  const validSourceIndices = records
    .map((_record, sourceIndex) => sourceIndex)
    .filter((sourceIndex) => !exclusionsBySource.has(sourceIndex));
  if (validSourceIndices.length === 0) {
    fail('PROPAGATION_FAILED', 'no valid satellite remains after the complete SGP4 run', {
      sourceCount: provenance.sourceCount,
      resolvedCount: provenance.resolvedCount,
      excludedCount: provenance.excludedCount,
      exclusions: provenance.exclusions,
    });
  }

  const frozenSnapshots = freeze(validSourceIndices.map((sourceIndex) => (
    deepFreeze({ ...records[sourceIndex]!.snapshot })
  )));
  const satellites = freeze(frozenSnapshots.map(metadataForSnapshot));
  satellites.forEach((satellite, index) => satelliteIndices.set(satellite.satelliteId, index));

  // Compact anchor-major storage after the effective satellite set is known;
  // excluded records never remain as zero-filled slots in the published run.
  const compactScalarCount = TLE_RUN_ANCHOR_COUNT * validSourceIndices.length * 3;
  const positions = new Float64Array(compactScalarCount);
  const velocities = new Float64Array(compactScalarCount);
  for (let anchorIndex = 0; anchorIndex < TLE_RUN_ANCHOR_COUNT; anchorIndex += 1) {
    for (let satelliteIndex = 0; satelliteIndex < validSourceIndices.length; satelliteIndex += 1) {
      const sourceIndex = validSourceIndices[satelliteIndex]!;
      const sourceStorageIndex = sourceStorageIndices[sourceIndex];
      if (sourceStorageIndex < 0) fail('PROPAGATION_FAILED', `run storage index is missing for source satellite ${sourceIndex}`);
      const sourceOffset = stateIndex(anchorIndex, sourceStorageIndex, storageSatelliteCount);
      const compactOffset = stateIndex(anchorIndex, satelliteIndex, validSourceIndices.length);
      positions[compactOffset] = sourcePositions[sourceOffset]!;
      positions[compactOffset + 1] = sourcePositions[sourceOffset + 1]!;
      positions[compactOffset + 2] = sourcePositions[sourceOffset + 2]!;
      velocities[compactOffset] = sourceVelocities[sourceOffset]!;
      velocities[compactOffset + 1] = sourceVelocities[sourceOffset + 1]!;
      velocities[compactOffset + 2] = sourceVelocities[sourceOffset + 2]!;
    }
  }

  // A final whole-buffer finite check closes the publication gate even if a
  // future propagation path changes its per-state validation.
  for (let index = 0; index < positions.length; index += 1) {
    if (!Number.isFinite(positions[index]) || !Number.isFinite(velocities[index])) {
      fail('PROPAGATION_FAILED', `run ephemeris contains a non-finite value at scalar index ${index}`);
    }
  }

  const totalSamples = coarseSamples + fineSamples;
  const fullReferenceSamples = sourceSatelliteCount * TLE_RUN_ANCHOR_COUNT;
  const computationMetrics: TleRunComputationMetrics = freeze({
    mode: candidatePool.mode,
    inputRecords: sourceSatelliteCount,
    coarseAnchorCount: coarseOffsets.length,
    coarseSamples,
    fineCandidateCount,
    fineSamples,
    visibilityScreenSamples,
    visibilityScreenCandidateCount,
    visibilityScreenStepS: candidatePool.mode === 'staged-coarse-to-fine' ? candidatePool.visibilityScreenStepS : null,
    workingSatelliteCount: storageSatelliteCount,
    totalSamples,
    reductionRatio: fullReferenceSamples > 0 ? 1 - totalSamples / fullReferenceSamples : 0,
    coarseStepS: candidatePool.mode === 'full-reference' ? null : candidatePool.coarseStepS,
    safetyMarginDeg: candidatePool.mode === 'full-reference' ? null : candidatePool.safetyMarginDeg,
    guardWindowS: candidatePool.mode === 'full-reference' ? null : candidatePool.guardWindowS,
    wallTimeMs: Math.max(0, Date.now() - startedAtMs),
  });

  const identity = runIdentity(archiveId, publicationSha, t0.value, provenance.exclusions);
  const id = runId(identity, archiveId, publicationSha, t0.value);
  let bundle!: TleRunBundle;
  const getSatelliteIndex = (satelliteId: string): number | undefined => satelliteIndices.get(satelliteId);
  const getSatelliteMetadata = (satellite: TleRunSatelliteRef): TleRunSatelliteMetadata => {
    const satelliteIndex = typeof satellite === 'number' ? satellite : getSatelliteIndex(satellite);
    if (satelliteIndex === undefined || !Number.isInteger(satelliteIndex) || satelliteIndex < 0 || satelliteIndex >= satellites.length) {
      throw new RangeError(`unknown satellite ${String(satellite)}`);
    }
    return satellites[satelliteIndex]!;
  };
  const getAnchorUtc = (anchorIndex: number): string => {
    validateAnchorIndex(anchorIndex);
    return anchorUtcForIndex(t0.ms, anchorIndex);
  };
  const readStateByIndex = (anchorIndex: number, satelliteIndex: number): TleRunState => {
    validateAnchorIndex(anchorIndex);
    if (!Number.isInteger(satelliteIndex) || satelliteIndex < 0 || satelliteIndex >= satellites.length) {
      throw new RangeError(`satellite index must be an integer in [0, ${satellites.length - 1}]`);
    }
    const snapshot = frozenSnapshots[satelliteIndex]!;
    const metadata = satellites[satelliteIndex]!;
    const offset = stateIndex(anchorIndex, satelliteIndex, satellites.length);
    const positionTemeKm = freeze({ x: positions[offset]!, y: positions[offset + 1]!, z: positions[offset + 2]! });
    const velocityTemeKmPerSec = freeze({ x: velocities[offset]!, y: velocities[offset + 1]!, z: velocities[offset + 2]! });
    const provenance = freeze({ ...snapshot.provenance });
    return deepFreeze({
      anchorIndex,
      satelliteIndex,
      satelliteId: metadata.satelliteId,
      satelliteName: metadata.satelliteName,
      requestedInstantUtc: getAnchorUtc(anchorIndex),
      tleEpochUtc: metadata.tleEpochUtc,
      sourcePath: metadata.sourcePath,
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      positionTemeKm,
      velocityTemeKmPerSec,
      positionEciKm: positionTemeKm,
      velocityEciKmPerSec: velocityTemeKmPerSec,
      position: positionTemeKm,
      velocity: velocityTemeKmPerSec,
      provenance,
    });
  };
  const readState = (anchorIndex: number, satellite: TleRunSatelliteRef): TleRunState => {
    const satelliteIndex = typeof satellite === 'number' ? satellite : getSatelliteIndex(satellite);
    if (satelliteIndex === undefined) throw new RangeError(`unknown satellite ${String(satellite)}`);
    return readStateByIndex(anchorIndex, satelliteIndex);
  };
  const materializeFrame = (anchor: number | UtcInstantInput): TlePropagationFrame => {
    const anchorIndex = anchorIndexForInput(anchor, t0.ms);
    const anchorInstantUtc = getAnchorUtc(anchorIndex);
    const frameSatellites = freeze(satellites.map((_metadata, satelliteIndex) => readStateByIndex(anchorIndex, satelliteIndex)) as readonly PropagatedSatelliteState[]);
    const resolvedEpochsUtc: Record<string, string> = {};
    for (const snapshot of frozenSnapshots) resolvedEpochsUtc[snapshot.satelliteId] = snapshot.epochUtc;
    const provenance: TlePropagationFrameProvenance = freeze({
      ...(manifest.archiveId === undefined ? { archiveId } : { archiveId: manifest.archiveId }),
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      snapshots: freeze(frozenSnapshots.map((snapshot) => freeze({ ...snapshot.provenance }))),
    });
    return deepFreeze({
      frameId: createTleFrameId(anchorInstantUtc, frozenSnapshots),
      requestedInstantUtc: anchorInstantUtc,
      resolvedEpochsUtc: freeze(resolvedEpochsUtc),
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      satellites: frameSatellites,
      provenance,
    });
  };

  bundle = deepFreeze({
    runId: id,
    runIdentity: identity,
    archiveId,
    publicationSha256: publicationSha,
    t0Utc: t0.value,
    durationS: TLE_RUN_DURATION_S,
    stepS: TLE_RUN_STEP_S,
    anchorCount: TLE_RUN_ANCHOR_COUNT,
    manifest,
    resolvedSnapshots: frozenSnapshots,
    satellites,
    satelliteCount: satellites.length,
    exclusionProvenance: provenance,
    computationMetrics,
    getSatelliteIndex,
    satelliteIndex: getSatelliteIndex,
    getSatelliteMetadata,
    getAnchorUtc,
    anchorUtc: getAnchorUtc,
    getAnchorInstantUtc: getAnchorUtc,
    readState,
    readStateByIndex,
    getState: readState,
    stateAt: readState,
    materializeFrame,
    frameAt: materializeFrame,
  });

  throwIfInactive(options);
  if (options.onProgress !== undefined) {
    await options.onProgress(progressValue('complete', TLE_RUN_ANCHOR_COUNT, TLE_RUN_ANCHOR_COUNT - 1, getAnchorUtc(TLE_RUN_ANCHOR_COUNT - 1)));
    throwIfInactive(options);
  }
  return bundle;
}

export const createTleRunBundle = buildTleRunBundle;
export const buildArchivedTleRun = buildTleRunBundle;
export const createArchivedTleRun = buildTleRunBundle;
export const buildRunBundle = buildTleRunBundle;
export const createRunBundle = buildTleRunBundle;
export const buildArchivedTleRunBundle = buildTleRunBundle;

/**
 * Data-only geometry snapshot used by the module Worker boundary.
 *
 * The live RunBundle intentionally contains closures for random access.  It
 * must never be sent through structured clone.  This snapshot carries the
 * exact same source/run identity and an anchor-major pair of Float64 arrays;
 * the receiver can therefore hydrate the closures without running SGP4 a
 * second time.
 */
export const TLE_RUN_BUNDLE_SNAPSHOT_SCHEMA = 'tle-run-bundle-snapshot-v1' as const;

export interface TleRunBundleSnapshot {
  readonly schema: typeof TLE_RUN_BUNDLE_SNAPSHOT_SCHEMA;
  /** `geometryRunId` is deliberately an explicit alias for `runId`. */
  readonly geometryRunId: string;
  readonly runId: string;
  readonly runIdentity: string;
  readonly archiveId: string;
  readonly publicationSha256: string;
  readonly t0Utc: string;
  readonly durationS: typeof TLE_RUN_DURATION_S;
  readonly stepS: typeof TLE_RUN_STEP_S;
  readonly anchorCount: typeof TLE_RUN_ANCHOR_COUNT;
  readonly manifest: TleArchiveManifest;
  readonly resolvedSnapshots: readonly ResolvedTleSnapshot[];
  readonly satellites: readonly TleRunSatelliteMetadata[];
  readonly satelliteCount: number;
  readonly exclusionProvenance: TleRunExclusionProvenance;
  readonly computationMetrics: TleRunComputationMetrics;
  /** Anchor-major [anchor][satellite][x,y,z] TEME positions in kilometres. */
  readonly positionsTemeKm: Float64Array;
  /** Anchor-major [anchor][satellite][x,y,z] TEME velocities in km/s. */
  readonly velocitiesTemeKmPerSec: Float64Array;
  /** Short aliases retained for generic binary-run adapters. */
  readonly positions?: Float64Array;
  readonly velocities?: Float64Array;
}

export type TleRunSnapshot = TleRunBundleSnapshot;

function snapshotFail(message: string, details?: Readonly<Record<string, unknown>>): never {
  throw new TleRunError('INVALID_SELECTION', message, details);
}

function snapshotText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') snapshotFail(`${label} must be a non-empty string`);
  return value.trim();
}

function snapshotNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) snapshotFail(`${label} must be finite`);
  return value;
}

function sameJson(left: unknown, right: unknown): boolean {
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function validateSnapshotSourceRecords(
  manifest: TleArchiveManifest,
  resolvedSnapshots: readonly ResolvedTleSnapshot[],
  satellites: readonly TleRunSatelliteMetadata[],
  t0Utc: string,
  excludedIds: ReadonlySet<string>,
): void {
  if (resolvedSnapshots.length !== satellites.length) {
    snapshotFail('snapshot resolvedSnapshots and satellites lengths disagree');
  }
  const manifestById = new Map<string, TleArchiveEntry[]>();
  for (const entry of manifest.entries) {
    const records = manifestById.get(entry.satelliteId) ?? [];
    records.push(entry);
    manifestById.set(entry.satelliteId, records);
  }
  const seen = new Set<string>();
  for (let index = 0; index < resolvedSnapshots.length; index += 1) {
    const resolved = resolvedSnapshots[index];
    const satellite = satellites[index];
    if (resolved === undefined || satellite === undefined) snapshotFail(`snapshot source record ${index} is missing`);
    const entries = manifestById.get(resolved.satelliteId);
    if (entries === undefined) snapshotFail(`snapshot resolved satellite ${resolved.satelliteId} is absent from manifest`);
    if (seen.has(resolved.satelliteId)) snapshotFail(`snapshot repeats resolved satellite ${resolved.satelliteId}`);
    seen.add(resolved.satelliteId);
    if (resolved.satelliteId !== satellite.satelliteId || resolved.satelliteName !== satellite.satelliteName) {
      snapshotFail(`snapshot satellite metadata disagrees at index ${index}`);
    }
    if (
      resolved.sourcePath !== satellite.sourcePath
      || resolved.sourceKind !== satellite.sourceKind
      || resolved.epochUtc !== satellite.tleEpochUtc
      || resolved.line1.slice(2, 7).trim() !== satellite.catalogNumber
    ) snapshotFail(`snapshot TLE identity disagrees at satellite ${resolved.satelliteId}`);
    if (
      resolved.sourceKind !== TLE_SOURCE_KIND
      || !entries.some(entry => (
        resolved.line1 === entry.line1
        && resolved.line2 === entry.line2
        && resolved.sourcePath === entry.sourcePath
        && resolved.epochUtc === entry.epochUtc
      ))
    ) snapshotFail(`snapshot resolved TLE content disagrees with manifest for ${resolved.satelliteId}`);
    if (resolved.requestedInstantUtc !== t0Utc) {
      snapshotFail(`snapshot resolved TLE request time disagrees for ${resolved.satelliteId}`);
    }
    if (!Number.isFinite(resolved.ageMs) || resolved.ageMs < 0 || !Number.isFinite(resolved.maxPropagationAgeMs)) {
      snapshotFail(`snapshot resolved TLE validity metadata is invalid for ${resolved.satelliteId}`);
    }
    if (resolved.provenance === null || typeof resolved.provenance !== 'object') {
      snapshotFail(`snapshot resolved TLE provenance is missing for ${resolved.satelliteId}`);
    }
    if (!sameJson(resolved.provenance, {
      satelliteId: resolved.satelliteId,
      satelliteName: resolved.satelliteName,
      sourcePath: resolved.sourcePath,
      sourceKind: resolved.sourceKind,
      epochUtc: resolved.epochUtc,
      line1: resolved.line1,
      line2: resolved.line2,
      ...(manifest.archiveId === undefined ? {} : { archiveId: manifest.archiveId }),
    })) {
      snapshotFail(`snapshot resolved TLE provenance disagrees for ${resolved.satelliteId}`);
    }
  }
  const expectedIds = [...manifestById.keys()].filter(id => !excludedIds.has(id)).sort();
  const actualIds = [...seen].sort();
  if (!sameJson(expectedIds, actualIds)) {
    snapshotFail('snapshot resolved satellite set does not match the manifest');
  }
}

function validateSnapshotExclusions(
  snapshot: Pick<TleRunBundleSnapshot, 'exclusionProvenance' | 'satelliteCount' | 'resolvedSnapshots' | 'manifest'>,
): void {
  const provenance = snapshot.exclusionProvenance;
  if (provenance === null || typeof provenance !== 'object') snapshotFail('snapshot exclusion provenance is missing');
  if (
    provenance.sourceCount !== new Set(snapshot.manifest.entries.map(entry => entry.satelliteId)).size
    || provenance.resolvedCount !== snapshot.satelliteCount + provenance.excludedCount
    || provenance.includedCount !== snapshot.satelliteCount
    || provenance.excludedCount !== provenance.exclusions.length
    || provenance.includedCount + provenance.excludedCount !== provenance.sourceCount
  ) snapshotFail('snapshot exclusion provenance counts disagree');
  const included = new Set(snapshot.resolvedSnapshots.map(item => item.satelliteId));
  const excluded = new Set<string>();
  for (const exclusion of provenance.exclusions) {
    if (excluded.has(exclusion.satelliteId)) snapshotFail(`snapshot repeats exclusion ${exclusion.satelliteId}`);
    if (included.has(exclusion.satelliteId)) snapshotFail(`snapshot excludes included satellite ${exclusion.satelliteId}`);
    const entry = snapshot.manifest.entries.find(item => (
      item.satelliteId === exclusion.satelliteId
      && item.satelliteName === exclusion.satelliteName
      && item.sourcePath === exclusion.sourcePath
      && item.epochUtc === exclusion.tleEpochUtc
    ));
    if (entry === undefined) {
      snapshotFail(`snapshot exclusion ${exclusion.satelliteId} is absent from the manifest`);
    }
    if (
      exclusion.satelliteName !== entry.satelliteName
      || exclusion.sourcePath !== entry.sourcePath
      || exclusion.sourceKind !== entry.sourceKind
      || exclusion.tleEpochUtc !== entry.epochUtc
    ) snapshotFail(`snapshot exclusion TLE identity disagrees for ${exclusion.satelliteId}`);
    if (!Number.isInteger(exclusion.firstFailingAnchorIndex) || exclusion.firstFailingAnchorIndex < 0 || exclusion.firstFailingAnchorIndex >= TLE_RUN_ANCHOR_COUNT) {
      snapshotFail(`snapshot exclusion anchor is invalid for ${exclusion.satelliteId}`);
    }
    snapshotText(exclusion.firstFailingAnchorUtc, `snapshot exclusion ${exclusion.satelliteId}.firstFailingAnchorUtc`);
    excluded.add(exclusion.satelliteId);
  }
}

function validateSnapshotArrays(
  positions: unknown,
  velocities: unknown,
  satelliteCount: number,
): { readonly positions: Float64Array; readonly velocities: Float64Array } {
  if (!(positions instanceof Float64Array) || !(velocities instanceof Float64Array)) {
    snapshotFail('snapshot ephemeris must use Float64Array typed arrays');
  }
  const scalarCount = TLE_RUN_ANCHOR_COUNT * satelliteCount * 3;
  if (positions.length !== scalarCount || velocities.length !== scalarCount) {
    snapshotFail(`snapshot ephemeris must contain exactly ${scalarCount} scalars per array`);
  }
  for (let index = 0; index < scalarCount; index += 1) {
    if (!Number.isFinite(positions[index]) || !Number.isFinite(velocities[index])) {
      snapshotFail(`snapshot ephemeris contains a non-finite scalar at ${index}`);
    }
  }
  return { positions, velocities };
}

function validateSnapshotComputationMetrics(
  metrics: TleRunComputationMetrics,
  resolvedCount: number,
  satelliteCount: number,
): void {
  if (metrics === null || typeof metrics !== 'object') snapshotFail('snapshot computation metrics are missing');
  if (
    metrics.mode !== 'full-reference'
    && metrics.mode !== 'coarse-to-fine'
    && metrics.mode !== 'staged-coarse-to-fine'
  ) snapshotFail('snapshot computation mode is invalid');
  const countValues = [
    metrics.inputRecords,
    metrics.coarseAnchorCount,
    metrics.coarseSamples,
    metrics.fineCandidateCount,
    metrics.fineSamples,
    metrics.visibilityScreenSamples,
    metrics.visibilityScreenCandidateCount,
    metrics.workingSatelliteCount,
    metrics.totalSamples,
  ];
  if (!countValues.every(value => typeof value === 'number' && Number.isInteger(value) && value >= 0)) {
    snapshotFail('snapshot computation counts must be non-negative integers');
  }
  if (
    typeof metrics.reductionRatio !== 'number'
    || !Number.isFinite(metrics.reductionRatio)
    || typeof metrics.wallTimeMs !== 'number'
    || !Number.isFinite(metrics.wallTimeMs)
    || metrics.wallTimeMs < 0
  ) snapshotFail('snapshot computation ratios/timing are invalid');
  if (metrics.inputRecords !== resolvedCount) {
    snapshotFail('snapshot computation inputRecords disagrees with resolvedCount');
  }
  if (metrics.fineCandidateCount > metrics.inputRecords || metrics.fineCandidateCount < satelliteCount) {
    snapshotFail('snapshot computation fineCandidateCount disagrees with source/included counts');
  }
  if (metrics.workingSatelliteCount > metrics.inputRecords || metrics.workingSatelliteCount < satelliteCount) {
    snapshotFail('snapshot computation workingSatelliteCount disagrees with source/included counts');
  }
  if (metrics.totalSamples !== metrics.coarseSamples + metrics.fineSamples) {
    snapshotFail('snapshot computation totalSamples disagrees with coarse/fine samples');
  }
  if (metrics.visibilityScreenSamples > metrics.fineSamples) {
    snapshotFail('snapshot computation visibility-screen samples exceed fine samples');
  }
  if (
    metrics.visibilityScreenCandidateCount > metrics.fineCandidateCount
    || (metrics.mode === 'staged-coarse-to-fine' && metrics.visibilityScreenCandidateCount < satelliteCount)
  ) snapshotFail('snapshot computation visibility-screen candidate count disagrees with source/included counts');
  if (metrics.coarseSamples > metrics.inputRecords * metrics.coarseAnchorCount) {
    snapshotFail('snapshot computation coarseSamples exceeds its candidate grid');
  }
  if (metrics.fineSamples > metrics.fineCandidateCount * TLE_RUN_ANCHOR_COUNT) {
    snapshotFail('snapshot computation fineSamples exceeds its candidate grid');
  }
  if (metrics.mode === 'full-reference') {
    if (
      metrics.coarseAnchorCount !== 0
      || metrics.coarseSamples !== 0
      || metrics.coarseStepS !== null
      || metrics.safetyMarginDeg !== null
      || metrics.guardWindowS !== null
      || metrics.visibilityScreenSamples !== 0
      || metrics.visibilityScreenCandidateCount !== 0
      || metrics.visibilityScreenStepS !== null
      || metrics.workingSatelliteCount !== metrics.inputRecords
    ) snapshotFail('full-reference computation metrics contain coarse-pool fields');
    return;
  }
  const coarseStepS = metrics.coarseStepS;
  const safetyMarginDeg = metrics.safetyMarginDeg;
  const guardWindowS = metrics.guardWindowS;
  if (metrics.mode === 'coarse-to-fine') {
    if (
      metrics.visibilityScreenSamples !== 0
      || metrics.visibilityScreenCandidateCount !== 0
      || metrics.visibilityScreenStepS !== null
      || metrics.workingSatelliteCount !== metrics.inputRecords
    ) snapshotFail('coarse-to-fine computation metrics contain staged-screen fields');
  } else if (
    metrics.visibilityScreenStepS !== TLE_RUN_STEP_S
    || metrics.visibilityScreenSamples !== metrics.fineSamples
    || metrics.visibilityScreenCandidateCount <= 0
    || metrics.workingSatelliteCount !== metrics.fineCandidateCount
  ) snapshotFail('staged coarse-to-fine computation metrics disagree with the exact visibility screen');
  if (
    typeof coarseStepS !== 'number'
    || !Number.isInteger(coarseStepS)
    || coarseStepS < TLE_RUN_STEP_S
    || coarseStepS % TLE_RUN_STEP_S !== 0
    || typeof safetyMarginDeg !== 'number'
    || !Number.isFinite(safetyMarginDeg)
    || safetyMarginDeg <= 0
    || safetyMarginDeg > 90
    || typeof guardWindowS !== 'number'
    || !Number.isFinite(guardWindowS)
    || guardWindowS < 0
    || guardWindowS > TLE_RUN_DURATION_S
    || metrics.coarseAnchorCount <= 0
  ) snapshotFail('coarse-to-fine computation metrics contain invalid pool settings');
}

function validateSnapshotIdentity(snapshot: TleRunBundleSnapshot): {
  readonly manifest: TleArchiveManifest;
  readonly t0Ms: number;
} {
  if (snapshot === null || typeof snapshot !== 'object') snapshotFail('TleRunBundle snapshot must be an object');
  if (snapshot.schema !== TLE_RUN_BUNDLE_SNAPSHOT_SCHEMA) snapshotFail('unsupported TleRunBundle snapshot schema');
  const runId = snapshotText(snapshot.runId, 'snapshot.runId');
  const geometryRunId = snapshotText(snapshot.geometryRunId, 'snapshot.geometryRunId');
  if (runId !== geometryRunId) snapshotFail('snapshot geometryRunId must equal runId');
  const runIdentityValue = snapshotText(snapshot.runIdentity, 'snapshot.runIdentity');
  const archiveId = snapshotText(snapshot.archiveId, 'snapshot.archiveId');
  const publicationSha = snapshotText(snapshot.publicationSha256, 'snapshot.publicationSha256');
  const t0 = parseUtcInstant(snapshot.t0Utc, 'snapshot.t0Utc');
  if (snapshot.durationS !== TLE_RUN_DURATION_S || snapshot.stepS !== TLE_RUN_STEP_S || snapshot.anchorCount !== TLE_RUN_ANCHOR_COUNT) {
    snapshotFail('snapshot fixed run contract disagrees with the canonical 7,200/30/241 contract');
  }
  if (!Number.isInteger(snapshot.satelliteCount) || snapshot.satelliteCount <= 0) snapshotFail('snapshot satelliteCount must be positive');
  if (!Array.isArray(snapshot.resolvedSnapshots) || !Array.isArray(snapshot.satellites)) {
    snapshotFail('snapshot resolvedSnapshots and satellites must be arrays');
  }
  if (
    snapshot.exclusionProvenance === null
    || typeof snapshot.exclusionProvenance !== 'object'
    || !Array.isArray(snapshot.exclusionProvenance.exclusions)
  ) snapshotFail('snapshot exclusion provenance must contain an exclusions array');
  const manifest = freezeManifest(snapshot.manifest);
  if (manifest.archiveId !== undefined && manifest.archiveId !== archiveId) {
    snapshotFail('snapshot archiveId disagrees with manifest archiveId');
  }
  const expectedIdentity = runIdentity(archiveId, publicationSha, t0.value, snapshot.exclusionProvenance.exclusions);
  if (expectedIdentity !== runIdentityValue) snapshotFail('snapshot runIdentity does not match its source/exclusion identity');
  if (runId !== runIdForIdentity(expectedIdentity, archiveId, publicationSha, t0.value)) {
    snapshotFail('snapshot runId does not match its source/exclusion identity');
  }
  validateSnapshotSourceRecords(
    manifest,
    snapshot.resolvedSnapshots,
    snapshot.satellites,
    t0.value,
    new Set(snapshot.exclusionProvenance.exclusions.map(item => item.satelliteId)),
  );
  if (snapshot.satelliteCount !== snapshot.satellites.length) snapshotFail('snapshot satelliteCount disagrees with metadata');
  validateSnapshotExclusions({
    ...snapshot,
    manifest,
  });
  validateSnapshotArrays(
    snapshot.positionsTemeKm ?? snapshot.positions,
    snapshot.velocitiesTemeKmPerSec ?? snapshot.velocities,
    snapshot.satelliteCount,
  );
  validateSnapshotComputationMetrics(
    snapshot.computationMetrics,
    snapshot.exclusionProvenance.resolvedCount,
    snapshot.satelliteCount,
  );
  return { manifest, t0Ms: t0.ms };
}

/**
 * Convert a live RunBundle into a transport-safe snapshot.  The arrays are
 * copied so transferring this snapshot cannot detach the accepted run that is
 * still held by a caller on the producing side.
 */
export function createTleRunBundleSnapshot(bundle: TleRunBundle): TleRunBundleSnapshot {
  if (bundle.durationS !== TLE_RUN_DURATION_S || bundle.stepS !== TLE_RUN_STEP_S || bundle.anchorCount !== TLE_RUN_ANCHOR_COUNT) {
    snapshotFail('cannot snapshot a non-canonical RunBundle');
  }
  if (!Number.isInteger(bundle.satelliteCount) || bundle.satelliteCount <= 0) snapshotFail('cannot snapshot an empty RunBundle');
  const scalarCount = TLE_RUN_ANCHOR_COUNT * bundle.satelliteCount * 3;
  const positionsTemeKm = new Float64Array(scalarCount);
  const velocitiesTemeKmPerSec = new Float64Array(scalarCount);
  for (let anchorIndex = 0; anchorIndex < TLE_RUN_ANCHOR_COUNT; anchorIndex += 1) {
    for (let satelliteIndex = 0; satelliteIndex < bundle.satelliteCount; satelliteIndex += 1) {
      const state = bundle.readStateByIndex(anchorIndex, satelliteIndex);
      const offset = stateIndex(anchorIndex, satelliteIndex, bundle.satelliteCount);
      positionsTemeKm[offset] = state.positionTemeKm.x;
      positionsTemeKm[offset + 1] = state.positionTemeKm.y;
      positionsTemeKm[offset + 2] = state.positionTemeKm.z;
      velocitiesTemeKmPerSec[offset] = state.velocityTemeKmPerSec.x;
      velocitiesTemeKmPerSec[offset + 1] = state.velocityTemeKmPerSec.y;
      velocitiesTemeKmPerSec[offset + 2] = state.velocityTemeKmPerSec.z;
    }
  }
  const snapshot: TleRunBundleSnapshot = {
    schema: TLE_RUN_BUNDLE_SNAPSHOT_SCHEMA,
    geometryRunId: bundle.runId,
    runId: bundle.runId,
    runIdentity: bundle.runIdentity,
    archiveId: bundle.archiveId,
    publicationSha256: bundle.publicationSha256,
    t0Utc: bundle.t0Utc,
    durationS: TLE_RUN_DURATION_S,
    stepS: TLE_RUN_STEP_S,
    anchorCount: TLE_RUN_ANCHOR_COUNT,
    manifest: bundle.manifest,
    resolvedSnapshots: bundle.resolvedSnapshots,
    satellites: bundle.satellites,
    satelliteCount: bundle.satelliteCount,
    exclusionProvenance: bundle.exclusionProvenance,
    computationMetrics: bundle.computationMetrics,
    positionsTemeKm,
    velocitiesTemeKmPerSec,
    positions: positionsTemeKm,
    velocities: velocitiesTemeKmPerSec,
  };
  // Typed arrays intentionally remain mutable views: Object.freeze on a typed
  // array with elements throws in current engines. They are not exposed by a
  // hydrated RunBundle and are transferred only after this detached copy.
  return freeze({
    ...snapshot,
    manifest: freezeManifest(snapshot.manifest),
    resolvedSnapshots: freeze(snapshot.resolvedSnapshots.map(item => deepFreeze({ ...item, provenance: deepFreeze({ ...item.provenance }) }))),
    satellites: freeze(snapshot.satellites.map(item => freeze({ ...item }))),
    exclusionProvenance: deepFreeze({
      ...snapshot.exclusionProvenance,
      exclusions: freeze(snapshot.exclusionProvenance.exclusions.map(item => freeze({ ...item }))),
    }),
  });
}

function runIdForIdentity(identity: string, archiveId: string, publicationSha: string, t0Utc: string): string {
  return [
    'tle-run',
    encodeURIComponent(archiveId),
    encodeURIComponent(publicationSha),
    encodeURIComponent(t0Utc),
    TLE_RUN_DURATION_S,
    TLE_RUN_STEP_S,
    stableHash(identity),
  ].join(':');
}

/** Hydrate a validated typed-array snapshot without resolving or propagating TLEs. */
export function hydrateTleRunBundle(snapshot: TleRunBundleSnapshot): TleRunBundle {
  const { manifest, t0Ms } = validateSnapshotIdentity(snapshot);
  const resolvedSnapshots = freeze(snapshot.resolvedSnapshots.map(item => deepFreeze({ ...item, provenance: deepFreeze({ ...item.provenance }) })));
  const satellites = freeze(snapshot.satellites.map(item => freeze({ ...item })));
  const exclusionProvenance = deepFreeze({
    ...snapshot.exclusionProvenance,
    exclusions: freeze(snapshot.exclusionProvenance.exclusions.map(item => freeze({ ...item }))),
  });
  const computationMetrics = freeze({ ...snapshot.computationMetrics });
  // Keep the transferred storage private to the hydrated object. A caller can
  // retain/mutate the transport envelope without changing the accepted run.
  const positions = (snapshot.positionsTemeKm ?? snapshot.positions)!.slice();
  const velocities = (snapshot.velocitiesTemeKmPerSec ?? snapshot.velocities)!.slice();
  const satelliteIndices = new Map<string, number>();
  satellites.forEach((satellite, index) => satelliteIndices.set(satellite.satelliteId, index));
  const getSatelliteIndex = (satelliteId: string): number | undefined => satelliteIndices.get(satelliteId);
  const getSatelliteMetadata = (satellite: TleRunSatelliteRef): TleRunSatelliteMetadata => {
    const satelliteIndex = typeof satellite === 'number' ? satellite : getSatelliteIndex(satellite);
    if (satelliteIndex === undefined || !Number.isInteger(satelliteIndex) || satelliteIndex < 0 || satelliteIndex >= satellites.length) {
      throw new RangeError(`unknown satellite ${String(satellite)}`);
    }
    return satellites[satelliteIndex]!;
  };
  const getAnchorUtc = (anchorIndex: number): string => {
    validateAnchorIndex(anchorIndex);
    return anchorUtcForIndex(t0Ms, anchorIndex);
  };
  const readStateByIndex = (anchorIndex: number, satelliteIndex: number): TleRunState => {
    validateAnchorIndex(anchorIndex);
    if (!Number.isInteger(satelliteIndex) || satelliteIndex < 0 || satelliteIndex >= satellites.length) {
      throw new RangeError(`satellite index must be an integer in [0, ${satellites.length - 1}]`);
    }
    const snapshotRecord = resolvedSnapshots[satelliteIndex]!;
    const metadata = satellites[satelliteIndex]!;
    const offset = stateIndex(anchorIndex, satelliteIndex, satellites.length);
    const positionTemeKm = freeze({ x: positions[offset]!, y: positions[offset + 1]!, z: positions[offset + 2]! });
    const velocityTemeKmPerSec = freeze({ x: velocities[offset]!, y: velocities[offset + 1]!, z: velocities[offset + 2]! });
    const provenance = freeze({ ...snapshotRecord.provenance });
    return deepFreeze({
      anchorIndex,
      satelliteIndex,
      satelliteId: metadata.satelliteId,
      satelliteName: metadata.satelliteName,
      requestedInstantUtc: getAnchorUtc(anchorIndex),
      tleEpochUtc: metadata.tleEpochUtc,
      sourcePath: metadata.sourcePath,
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      positionTemeKm,
      velocityTemeKmPerSec,
      positionEciKm: positionTemeKm,
      velocityEciKmPerSec: velocityTemeKmPerSec,
      position: positionTemeKm,
      velocity: velocityTemeKmPerSec,
      provenance,
    });
  };
  const readState = (anchorIndex: number, satellite: TleRunSatelliteRef): TleRunState => {
    const satelliteIndex = typeof satellite === 'number' ? satellite : getSatelliteIndex(satellite);
    if (satelliteIndex === undefined) throw new RangeError(`unknown satellite ${String(satellite)}`);
    return readStateByIndex(anchorIndex, satelliteIndex);
  };
  const materializeFrame = (anchor: number | UtcInstantInput): TlePropagationFrame => {
    const anchorIndex = anchorIndexForInput(anchor, t0Ms);
    const anchorInstantUtc = getAnchorUtc(anchorIndex);
    const frameSatellites = freeze(satellites.map((_metadata, satelliteIndex) => readStateByIndex(anchorIndex, satelliteIndex)) as readonly PropagatedSatelliteState[]);
    const resolvedEpochsUtc: Record<string, string> = {};
    for (const item of resolvedSnapshots) resolvedEpochsUtc[item.satelliteId] = item.epochUtc;
    const provenance: TlePropagationFrameProvenance = freeze({
      ...(manifest.archiveId === undefined ? { archiveId: snapshot.archiveId } : { archiveId: manifest.archiveId }),
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      snapshots: freeze(resolvedSnapshots.map(item => freeze({ ...item.provenance }))),
    });
    const frame = deepFreeze({
      frameId: createTleFrameId(anchorInstantUtc, resolvedSnapshots),
      requestedInstantUtc: anchorInstantUtc,
      resolvedEpochsUtc: freeze(resolvedEpochsUtc),
      sourceKind: TLE_SOURCE_KIND,
      propagationModel: TLE_PROPAGATION_MODEL,
      satellites: frameSatellites,
      provenance,
    });
    return frame;
  };
  return deepFreeze({
    runId: snapshot.runId,
    runIdentity: snapshot.runIdentity,
    archiveId: snapshot.archiveId,
    publicationSha256: snapshot.publicationSha256,
    t0Utc: snapshot.t0Utc,
    durationS: TLE_RUN_DURATION_S,
    stepS: TLE_RUN_STEP_S,
    anchorCount: TLE_RUN_ANCHOR_COUNT,
    manifest,
    resolvedSnapshots,
    satellites,
    satelliteCount: satellites.length,
    exclusionProvenance,
    computationMetrics,
    getSatelliteIndex,
    satelliteIndex: getSatelliteIndex,
    getSatelliteMetadata,
    getAnchorUtc,
    anchorUtc: getAnchorUtc,
    getAnchorInstantUtc: getAnchorUtc,
    readState,
    readStateByIndex,
    getState: readState,
    stateAt: readState,
    materializeFrame,
    frameAt: materializeFrame,
  });
}

export const snapshotTleRunBundle = createTleRunBundleSnapshot;
export const createTleRunSnapshot = createTleRunBundleSnapshot;
export const hydrateTleRunSnapshot = hydrateTleRunBundle;
export const restoreTleRunBundle = hydrateTleRunBundle;
