import { parseUtcInstant } from '../../tle/time';
import { utcToAsiaTaipei } from '../../tle/timezone';
import {
  VISUAL_LAB_BOOKMARK_ARTIFACT_SCHEMA,
  VISUAL_LAB_BOOKMARK_GENERATOR_VERSION,
  type RankedVisualLabBookmarkCandidate,
  type VisualLabBookmark,
  type VisualLabBookmarkCandidate,
  type VisualLabBookmarkCatalogSummary,
  type VisualLabBookmarkConstellation,
  type VisualLabBookmarkDescriptors,
  type VisualLabBookmarkLocalizedCopy,
  type VisualLabBookmarkSelectionPolicy,
  type VisualLabBookmarkSelectionRole,
  type VisualLabBookmarkSource,
  type VisualLabBookmarksArtifact,
} from './types';

const BOOKMARK_CATALOG_URLS: Readonly<Record<VisualLabBookmarkConstellation, string>> = Object.freeze({
  oneweb: '/tle-archive/oneweb/catalog.json',
  starlink: '/tle-archive/starlink/catalog.json',
});

const DESCRIPTOR_DISTANCE_KEYS = [
  'visibleSatelliteCount',
  'selectedElevationDeg',
  'elevationSpreadDeg',
  'visibleAzimuthSpanDeg',
  'selectedRangeKm',
  'visibleRangeSpanKm',
] as const;

/** Scales keep count, angle, and range dimensions comparable without hiding any measurement. */
const DESCRIPTOR_DISTANCE_SCALES = Object.freeze({
  visibleSatelliteCount: 20,
  selectedElevationDeg: 90,
  elevationSpreadDeg: 90,
  visibleAzimuthSpanDeg: 180,
  selectedRangeKm: 3_000,
  visibleRangeSpanKm: 3_000,
});

const UNSUPPORTED_COPY_TERMS = [
  'mock',
  'synthetic',
  'performance',
  'throughput',
  'energy',
  'saving',
  '節能',
  '節省',
  '效能',
  '效率',
  '吞吐',
] as const;

const CLAIM_CEILING: VisualLabBookmarkLocalizedCopy = Object.freeze({
  'zh-Hant': '僅描述 archived-TLE／SGP4 在 NTPU 同一瞬間的幾何觀察；不表示即時遙測或服務品質。',
  en: 'Describes archived-TLE/SGP4 geometry at one NTPU instant; it is not live telemetry or a service-quality measurement.',
});

const SELECTION_POLICY: VisualLabBookmarkSelectionPolicy = Object.freeze({
  candidateInstantBasis: 'snapshot-max-epoch-utc',
  candidateSnapshotsPerConstellation: 18,
  selectedPerConstellation: 3,
  descriptorDistance: DESCRIPTOR_DISTANCE_KEYS,
  measurementObserverId: 'ntpu-wgs84-v1',
  measurementApi: 'createTlePropagationFrameWithSatelliteExclusions+deriveObserverLinkGeometry',
});

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function finite(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new VisualLabBookmarkValidationError(`${path} must be finite`, path);
  }
  return value;
}

function nonNegative(value: unknown, path: string): number {
  const parsed = finite(value, path);
  if (parsed < 0) throw new VisualLabBookmarkValidationError(`${path} must be non-negative`, path);
  return parsed;
}

function positive(value: unknown, path: string): number {
  const parsed = finite(value, path);
  if (parsed <= 0) throw new VisualLabBookmarkValidationError(`${path} must be positive`, path);
  return parsed;
}

function positiveInteger(value: unknown, path: string): number {
  const parsed = finite(value, path);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new VisualLabBookmarkValidationError(`${path} must be a positive integer`, path);
  }
  return parsed;
}

function nonNegativeInteger(value: unknown, path: string): number {
  const parsed = finite(value, path);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new VisualLabBookmarkValidationError(`${path} must be a non-negative integer`, path);
  }
  return parsed;
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new VisualLabBookmarkValidationError(`${path} must be a non-empty string`, path);
  }
  return value.trim();
}

function sha256(value: unknown, path: string): string {
  const parsed = text(value, path);
  if (!/^[0-9a-f]{64}$/.test(parsed)) {
    throw new VisualLabBookmarkValidationError(`${path} must be a lowercase SHA-256 digest`, path);
  }
  return parsed;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new VisualLabBookmarkValidationError(`${path} must be an object`, path);
  }
  return value as Record<string, unknown>;
}

function archiveDate(value: unknown, path: string): string {
  const parsed = text(value, path);
  if (!/^\d{8}$/.test(parsed)) {
    throw new VisualLabBookmarkValidationError(`${path} must use YYYYMMDD`, path);
  }
  const year = Number(parsed.slice(0, 4));
  const month = Number(parsed.slice(4, 6));
  const day = Number(parsed.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    throw new VisualLabBookmarkValidationError(`${path} is not a real calendar date`, path);
  }
  return parsed;
}

function constellation(value: unknown, path: string): VisualLabBookmarkConstellation {
  if (value !== 'oneweb' && value !== 'starlink') {
    throw new VisualLabBookmarkValidationError(`${path} must be oneweb or starlink`, path);
  }
  return value;
}

function localizedCopy(value: unknown, path: string): VisualLabBookmarkLocalizedCopy {
  const candidate = object(value, path);
  const zhHant = text(candidate['zh-Hant'], `${path}.zh-Hant`);
  const en = text(candidate.en, `${path}.en`);
  return Object.freeze({ 'zh-Hant': zhHant, en });
}

function ensureNeutralCopy(copy: VisualLabBookmarkLocalizedCopy, path: string): void {
  const searchable = `${copy['zh-Hant']} ${copy.en}`.toLowerCase();
  const forbidden = UNSUPPORTED_COPY_TERMS.find(term => searchable.includes(term.toLowerCase()));
  if (forbidden !== undefined) {
    throw new VisualLabBookmarkValidationError(
      `${path} contains an unsupported result or energy claim term: ${forbidden}`,
      path,
    );
  }
}

function parseSource(value: unknown, path: string, expectedConstellation: VisualLabBookmarkConstellation): VisualLabBookmarkSource {
  const candidate = object(value, path);
  const archiveDate = archiveDateValue(candidate.archiveDate, `${path}.archiveDate`);
  const expectedCatalogUrl = BOOKMARK_CATALOG_URLS[expectedConstellation];
  const expectedPath = `/tle-archive/${expectedConstellation}/${expectedConstellation}_${archiveDate}.tle`;
  const catalogUrl = text(candidate.catalogUrl, `${path}.catalogUrl`);
  if (catalogUrl !== expectedCatalogUrl) {
    throw new VisualLabBookmarkValidationError(`${path}.catalogUrl does not bind to the constellation`, path);
  }
  const sourcePath = text(candidate.path, `${path}.path`);
  if (sourcePath !== expectedPath) {
    throw new VisualLabBookmarkValidationError(`${path}.path does not bind to archiveDate and constellation`, path);
  }
  const sourceKind = candidate.sourceKind;
  if (sourceKind !== 'ARCHIVED_TLE') {
    throw new VisualLabBookmarkValidationError(`${path}.sourceKind must be ARCHIVED_TLE`, path);
  }
  if (candidate.propagationModel !== 'SGP4') {
    throw new VisualLabBookmarkValidationError(`${path}.propagationModel must be SGP4`, path);
  }
  const propagatedSatelliteCount = positiveInteger(candidate.propagatedSatelliteCount, `${path}.propagatedSatelliteCount`);
  const recordCount = positiveInteger(candidate.recordCount, `${path}.recordCount`);
  if (propagatedSatelliteCount > recordCount) {
    throw new VisualLabBookmarkValidationError(`${path}.propagatedSatelliteCount cannot exceed recordCount`, path);
  }
  const propagationExclusionCount = nonNegativeInteger(candidate.propagationExclusionCount, `${path}.propagationExclusionCount`);
  if (propagationExclusionCount > recordCount) {
    throw new VisualLabBookmarkValidationError(`${path}.propagationExclusionCount cannot exceed recordCount`, path);
  }
  return Object.freeze({
    catalogUrl,
    archiveId: text(candidate.archiveId, `${path}.archiveId`),
    archiveContentSha256: sha256(candidate.archiveContentSha256, `${path}.archiveContentSha256`),
    archiveDate,
    path: sourcePath,
    sha256: sha256(candidate.sha256, `${path}.sha256`),
    recordCount,
    maxPropagationAgeMs: positive(candidate.maxPropagationAgeMs, `${path}.maxPropagationAgeMs`),
    sourceKind: 'ARCHIVED_TLE',
    propagationModel: 'SGP4',
    measuredFrameId: text(candidate.measuredFrameId, `${path}.measuredFrameId`),
    propagatedSatelliteCount,
    propagationExclusionCount,
  });
}

function archiveDateValue(value: unknown, path: string): string {
  return archiveDate(value, path);
}

function parseDescriptors(value: unknown, path: string): VisualLabBookmarkDescriptors {
  const candidate = object(value, path);
  const visibleSatelliteCount = nonNegativeInteger(candidate.visibleSatelliteCount, `${path}.visibleSatelliteCount`);
  const propagatedSatelliteCount = positiveInteger(candidate.propagatedSatelliteCount, `${path}.propagatedSatelliteCount`);
  if (visibleSatelliteCount > propagatedSatelliteCount) {
    throw new VisualLabBookmarkValidationError(`${path}.visibleSatelliteCount cannot exceed propagatedSatelliteCount`, path);
  }
  const selectedElevationDeg = nonNegative(candidate.selectedElevationDeg, `${path}.selectedElevationDeg`);
  if (selectedElevationDeg > 90) throw new VisualLabBookmarkValidationError(`${path}.selectedElevationDeg must be at most 90`, path);
  const selectedAzimuthDeg = nonNegative(candidate.selectedAzimuthDeg, `${path}.selectedAzimuthDeg`);
  if (selectedAzimuthDeg >= 360) throw new VisualLabBookmarkValidationError(`${path}.selectedAzimuthDeg must be below 360`, path);
  const elevationSpreadDeg = nonNegative(candidate.elevationSpreadDeg, `${path}.elevationSpreadDeg`);
  if (elevationSpreadDeg > 90) throw new VisualLabBookmarkValidationError(`${path}.elevationSpreadDeg must be at most 90`, path);
  const visibleAzimuthSpanDeg = nonNegative(candidate.visibleAzimuthSpanDeg, `${path}.visibleAzimuthSpanDeg`);
  if (visibleAzimuthSpanDeg > 360) throw new VisualLabBookmarkValidationError(`${path}.visibleAzimuthSpanDeg must be at most 360`, path);
  return Object.freeze({
    visibleSatelliteCount,
    propagatedSatelliteCount,
    selectedElevationDeg,
    selectedRangeKm: positive(candidate.selectedRangeKm, `${path}.selectedRangeKm`),
    selectedAzimuthDeg,
    elevationSpreadDeg,
    visibleAzimuthSpanDeg,
    visibleRangeSpanKm: nonNegative(candidate.visibleRangeSpanKm, `${path}.visibleRangeSpanKm`),
    selectedSatelliteId: text(candidate.selectedSatelliteId, `${path}.selectedSatelliteId`),
    comparisonSatelliteId: candidate.comparisonSatelliteId === null
      ? null
      : text(candidate.comparisonSatelliteId, `${path}.comparisonSatelliteId`),
  });
}

function parseBookmark(value: unknown, index: number): VisualLabBookmark {
  const path = `bookmarks[${index}]`;
  const candidate = object(value, path);
  const selectedConstellation = constellation(candidate.constellation, `${path}.constellation`);
  const descriptors = parseDescriptors(candidate.descriptors, `${path}.descriptors`);
  const source = parseSource(candidate.source, `${path}.source`, selectedConstellation);
  if (source.propagatedSatelliteCount !== descriptors.propagatedSatelliteCount) {
    throw new VisualLabBookmarkValidationError(`${path} source and descriptor propagated counts disagree`, path);
  }
  if (
    descriptors.comparisonSatelliteId !== null
    && descriptors.comparisonSatelliteId === descriptors.selectedSatelliteId
  ) {
    throw new VisualLabBookmarkValidationError(`${path}.comparisonSatelliteId must differ from selectedSatelliteId`, path);
  }
  const instantUtc = parseUtcInstant(text(candidate.instantUtc, `${path}.instantUtc`), `${path}.instantUtc`).value;
  const instantTaipei = text(candidate.instantTaipei, `${path}.instantTaipei`);
  if (instantTaipei !== utcToAsiaTaipei(instantUtc)) {
    throw new VisualLabBookmarkValidationError(`${path}.instantTaipei disagrees with instantUtc`, path);
  }
  const selectionRank = positiveInteger(candidate.selectionRank, `${path}.selectionRank`);
  const selectionRole = candidate.selectionRole;
  if (selectionRole !== 'max-visible-count-seed' && selectionRole !== 'descriptor-contrast') {
    throw new VisualLabBookmarkValidationError(`${path}.selectionRole is not recognized`, path);
  }
  if ((selectionRank === 1) !== (selectionRole === 'max-visible-count-seed')) {
    throw new VisualLabBookmarkValidationError(`${path} rank and selectionRole disagree`, path);
  }
  const copyCandidate = object(candidate.copy, `${path}.copy`);
  const label = localizedCopy(copyCandidate.label, `${path}.copy.label`);
  const caption = localizedCopy(copyCandidate.caption, `${path}.copy.caption`);
  ensureNeutralCopy(label, `${path}.copy.label`);
  ensureNeutralCopy(caption, `${path}.copy.caption`);
  const id = text(candidate.id, `${path}.id`);
  if (!id.startsWith(`${selectedConstellation}-`)) {
    throw new VisualLabBookmarkValidationError(`${path}.id must bind to constellation`, path);
  }
  return Object.freeze({
    id,
    selectionRank,
    selectionRole: selectionRole as VisualLabBookmarkSelectionRole,
    constellation: selectedConstellation,
    instantUtc,
    instantTaipei,
    source,
    descriptors,
    copy: Object.freeze({ label, caption }),
  });
}

/** Error thrown when a bookmark artifact cannot be trusted at the source boundary. */
export class VisualLabBookmarkValidationError extends TypeError {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = 'VisualLabBookmarkValidationError';
    this.path = path;
  }
}

/** Parse, validate, and deeply freeze a generated bookmark artifact. */
export function parseVisualLabBookmarksArtifact(raw: unknown): VisualLabBookmarksArtifact {
  const candidate = object(raw, 'artifact');
  if (candidate.schema !== VISUAL_LAB_BOOKMARK_ARTIFACT_SCHEMA) {
    throw new VisualLabBookmarkValidationError('unsupported Visual Lab bookmark artifact schema', 'artifact.schema');
  }
  if (candidate.generatorVersion !== VISUAL_LAB_BOOKMARK_GENERATOR_VERSION) {
    throw new VisualLabBookmarkValidationError('unsupported Visual Lab bookmark generator version', 'artifact.generatorVersion');
  }
  const generatedAtUtc = parseUtcInstant(text(candidate.generatedAtUtc, 'artifact.generatedAtUtc'), 'artifact.generatedAtUtc').value;
  if (candidate.timeZone !== 'Asia/Taipei') {
    throw new VisualLabBookmarkValidationError('artifact.timeZone must be Asia/Taipei', 'artifact.timeZone');
  }
  const rawCatalogs = candidate.sourceCatalogs;
  if (!Array.isArray(rawCatalogs) || rawCatalogs.length !== 2) {
    throw new VisualLabBookmarkValidationError('artifact.sourceCatalogs must contain one OneWeb and one Starlink summary', 'artifact.sourceCatalogs');
  }
  const sourceCatalogs: VisualLabBookmarkCatalogSummary[] = rawCatalogs.map((rawCatalog, index) => {
    const path = `sourceCatalogs[${index}]`;
    const item = object(rawCatalog, path);
    const itemConstellation = constellation(item.constellation, `${path}.constellation`);
    const catalogUrl = text(item.catalogUrl, `${path}.catalogUrl`);
    if (catalogUrl !== BOOKMARK_CATALOG_URLS[itemConstellation]) {
      throw new VisualLabBookmarkValidationError(`${path}.catalogUrl does not bind to constellation`, path);
    }
    return Object.freeze({
      constellation: itemConstellation,
      catalogUrl,
      archiveId: text(item.archiveId, `${path}.archiveId`),
      archiveContentSha256: sha256(item.archiveContentSha256, `${path}.archiveContentSha256`),
      snapshotCount: positiveInteger(item.snapshotCount, `${path}.snapshotCount`),
      firstArchiveDate: archiveDate(item.firstArchiveDate, `${path}.firstArchiveDate`),
      lastArchiveDate: archiveDate(item.lastArchiveDate, `${path}.lastArchiveDate`),
      maxPropagationAgeMs: positive(item.maxPropagationAgeMs, `${path}.maxPropagationAgeMs`),
    });
  });
  if (new Set(sourceCatalogs.map(item => item.constellation)).size !== 2) {
    throw new VisualLabBookmarkValidationError('artifact.sourceCatalogs must not repeat a constellation', 'artifact.sourceCatalogs');
  }
  const policyCandidate = object(candidate.selectionPolicy, 'artifact.selectionPolicy');
  if (policyCandidate.candidateInstantBasis !== 'snapshot-max-epoch-utc') {
    throw new VisualLabBookmarkValidationError('unsupported candidate instant basis', 'artifact.selectionPolicy.candidateInstantBasis');
  }
  if (policyCandidate.measurementObserverId !== 'ntpu-wgs84-v1') {
    throw new VisualLabBookmarkValidationError('bookmark measurements must use the NTPU observer', 'artifact.selectionPolicy.measurementObserverId');
  }
  if (policyCandidate.measurementApi !== 'createTlePropagationFrameWithSatelliteExclusions+deriveObserverLinkGeometry') {
    throw new VisualLabBookmarkValidationError('bookmark measurements must use the real SGP4 geometry APIs', 'artifact.selectionPolicy.measurementApi');
  }
  const policyDistance = policyCandidate.descriptorDistance;
  if (!Array.isArray(policyDistance) || policyDistance.length !== DESCRIPTOR_DISTANCE_KEYS.length || policyDistance.some((value, index) => value !== DESCRIPTOR_DISTANCE_KEYS[index])) {
    throw new VisualLabBookmarkValidationError('selection policy descriptor distance keys are not canonical', 'artifact.selectionPolicy.descriptorDistance');
  }
  const selectionPolicy: VisualLabBookmarkSelectionPolicy = Object.freeze({
    candidateInstantBasis: 'snapshot-max-epoch-utc',
    candidateSnapshotsPerConstellation: positiveInteger(policyCandidate.candidateSnapshotsPerConstellation, 'artifact.selectionPolicy.candidateSnapshotsPerConstellation'),
    selectedPerConstellation: positiveInteger(policyCandidate.selectedPerConstellation, 'artifact.selectionPolicy.selectedPerConstellation'),
    descriptorDistance: DESCRIPTOR_DISTANCE_KEYS,
    measurementObserverId: 'ntpu-wgs84-v1',
    measurementApi: 'createTlePropagationFrameWithSatelliteExclusions+deriveObserverLinkGeometry',
  });
  if (selectionPolicy.candidateSnapshotsPerConstellation < selectionPolicy.selectedPerConstellation) {
    throw new VisualLabBookmarkValidationError(
      'selection policy cannot select more moments than its measured candidate pool',
      'artifact.selectionPolicy',
    );
  }
  const claimCeiling = localizedCopy(candidate.claimCeiling, 'artifact.claimCeiling');
  const rawBookmarks = candidate.bookmarks;
  if (!Array.isArray(rawBookmarks) || rawBookmarks.length < 2) {
    throw new VisualLabBookmarkValidationError('artifact.bookmarks must contain at least two measured moments', 'artifact.bookmarks');
  }
  const bookmarks = rawBookmarks.map(parseBookmark);
  const ids = new Set<string>();
  const instants = new Set<string>();
  for (const bookmark of bookmarks) {
    if (ids.has(bookmark.id)) throw new VisualLabBookmarkValidationError(`duplicate bookmark id ${bookmark.id}`, 'artifact.bookmarks');
    ids.add(bookmark.id);
    const instantKey = `${bookmark.constellation}:${bookmark.instantUtc}`;
    if (instants.has(instantKey)) throw new VisualLabBookmarkValidationError(`duplicate bookmark instant ${instantKey}`, 'artifact.bookmarks');
    instants.add(instantKey);
    const summary = sourceCatalogs.find(item => item.constellation === bookmark.constellation);
    if (summary === undefined) throw new VisualLabBookmarkValidationError(`no catalog summary for ${bookmark.constellation}`, 'artifact.bookmarks');
    if (
      bookmark.source.archiveId !== summary.archiveId
      || bookmark.source.archiveContentSha256 !== summary.archiveContentSha256
      || bookmark.source.catalogUrl !== summary.catalogUrl
      || bookmark.source.maxPropagationAgeMs !== summary.maxPropagationAgeMs
    ) {
      throw new VisualLabBookmarkValidationError(`${bookmark.id} source provenance disagrees with catalog summary`, 'artifact.bookmarks');
    }
    if (bookmark.source.archiveDate < summary.firstArchiveDate || bookmark.source.archiveDate > summary.lastArchiveDate) {
      throw new VisualLabBookmarkValidationError(`${bookmark.id} source archiveDate is outside the catalog range`, 'artifact.bookmarks');
    }
  }
  for (const itemConstellation of ['oneweb', 'starlink'] as const) {
    const group = bookmarks
      .filter(bookmark => bookmark.constellation === itemConstellation)
      .sort((left, right) => left.selectionRank - right.selectionRank);
    if (group.length !== selectionPolicy.selectedPerConstellation) {
      throw new VisualLabBookmarkValidationError(`expected ${selectionPolicy.selectedPerConstellation} bookmarks for ${itemConstellation}`, 'artifact.bookmarks');
    }
    group.forEach((bookmark, index) => {
      if (bookmark.selectionRank !== index + 1) {
        throw new VisualLabBookmarkValidationError(`${itemConstellation} selection ranks must be contiguous`, 'artifact.bookmarks');
      }
    });
  }
  return deepFreeze({
    schema: VISUAL_LAB_BOOKMARK_ARTIFACT_SCHEMA,
    generatorVersion: VISUAL_LAB_BOOKMARK_GENERATOR_VERSION,
    generatedAtUtc,
    timeZone: 'Asia/Taipei',
    sourceCatalogs: Object.freeze(sourceCatalogs),
    selectionPolicy,
    claimCeiling,
    bookmarks: Object.freeze(bookmarks),
  });
}

export const validateVisualLabBookmarksArtifact = parseVisualLabBookmarksArtifact;

function descriptorDistance(left: VisualLabBookmarkDescriptors, right: VisualLabBookmarkDescriptors): number {
  let sum = 0;
  for (const key of DESCRIPTOR_DISTANCE_KEYS) {
    const scale = DESCRIPTOR_DISTANCE_SCALES[key];
    const difference = (left[key] - right[key]) / scale;
    sum += difference * difference;
  }
  return Math.sqrt(sum / DESCRIPTOR_DISTANCE_KEYS.length);
}

export function visualLabBookmarkDescriptorDistance(
  left: VisualLabBookmarkDescriptors,
  right: VisualLabBookmarkDescriptors,
): number {
  return descriptorDistance(left, right);
}

function compareCandidateSeed(left: VisualLabBookmarkCandidate, right: VisualLabBookmarkCandidate): number {
  return right.descriptors.visibleSatelliteCount - left.descriptors.visibleSatelliteCount
    || right.descriptors.selectedElevationDeg - left.descriptors.selectedElevationDeg
    || right.descriptors.elevationSpreadDeg - left.descriptors.elevationSpreadDeg
    || right.descriptors.visibleAzimuthSpanDeg - left.descriptors.visibleAzimuthSpanDeg
    || left.instantUtc.localeCompare(right.instantUtc)
    || left.source.path.localeCompare(right.source.path);
}

function compareFarthestCandidate(
  left: { readonly candidate: VisualLabBookmarkCandidate; readonly score: number },
  right: { readonly candidate: VisualLabBookmarkCandidate; readonly score: number },
): number {
  return right.score - left.score
    || compareCandidateSeed(left.candidate, right.candidate);
}

/**
 * Select a small, descriptor-diverse set from measured archived-TLE moments.
 * The first point is the measured maximum-visible-count point; later points
 * maximize their nearest-neighbour descriptor distance.  A zero/near-zero
 * spread refuses to produce bookmarks instead of pretending that dates are
 * meaningful merely because they differ.
 */
export function rankVisualLabBookmarkCandidates(
  candidates: readonly VisualLabBookmarkCandidate[],
  selectedPerConstellation = 3,
): readonly RankedVisualLabBookmarkCandidate[] {
  if (!Number.isInteger(selectedPerConstellation) || selectedPerConstellation < 1) {
    throw new RangeError('selectedPerConstellation must be a positive integer');
  }
  const result: RankedVisualLabBookmarkCandidate[] = [];
  for (const itemConstellation of ['oneweb', 'starlink'] as const) {
    const group = candidates
      .filter(candidate => candidate.constellation === itemConstellation)
      .slice()
      .sort(compareCandidateSeed);
    if (group.length < selectedPerConstellation) {
      throw new Error(`cannot select ${selectedPerConstellation} ${itemConstellation} bookmarks from ${group.length} measured candidates`);
    }
    const selected: RankedVisualLabBookmarkCandidate[] = [{
      candidate: group[0]!,
      selectionRank: 1,
      selectionRole: 'max-visible-count-seed',
      diversityScore: 1,
    }];
    const remaining = group.slice(1);
    while (selected.length < selectedPerConstellation) {
      const scored = remaining
        .filter(candidate => !selected.some(entry => entry.candidate.instantUtc === candidate.instantUtc))
        .map(candidate => ({
          candidate,
          score: Math.min(...selected.map(entry => descriptorDistance(candidate.descriptors, entry.candidate.descriptors))),
        }))
        .sort(compareFarthestCandidate);
      const next = scored[0];
      if (next === undefined || !Number.isFinite(next.score) || next.score < 0.01) {
        throw new Error(`measured ${itemConstellation} candidates do not have enough descriptor contrast for truthful bookmarks`);
      }
      selected.push({
        candidate: next.candidate,
        selectionRank: selected.length + 1,
        selectionRole: 'descriptor-contrast',
        diversityScore: next.score,
      });
    }
    result.push(...selected);
  }
  return Object.freeze(result);
}

export function createVisualLabBookmarkId(constellationValue: VisualLabBookmarkConstellation, archiveDateValue: string, instantUtc: string): string {
  const instantToken = instantUtc.replace(/\D/g, '').slice(0, 17);
  return `${constellationValue}-${archiveDateValue}-${instantToken}`;
}

export function createNeutralVisualLabBookmarkCopy(
  candidate: VisualLabBookmarkCandidate,
): Readonly<{ label: VisualLabBookmarkLocalizedCopy; caption: VisualLabBookmarkLocalizedCopy }> {
  const descriptor = candidate.descriptors;
  const visible = descriptor.visibleSatelliteCount.toString();
  const elevation = descriptor.selectedElevationDeg.toFixed(1);
  const range = descriptor.selectedRangeKm.toFixed(0);
  const spread = descriptor.elevationSpreadDeg.toFixed(1);
  return Object.freeze({
    label: Object.freeze({
      'zh-Hant': `可見 ${visible} 顆・最高仰角 ${elevation}°`,
      en: `${visible} visible · peak elevation ${elevation}°`,
    }),
    caption: Object.freeze({
      'zh-Hant': `NTPU 同一瞬間的 archived-TLE／SGP4 幾何觀察；選定衛星仰角 ${elevation}°、斜距 ${range} km、仰角展寬 ${spread}°。`,
      en: `Archived-TLE/SGP4 geometry at one NTPU instant; selected elevation ${elevation}°, range ${range} km, elevation spread ${spread}°.`,
    }),
  });
}

export function candidateToVisualLabBookmark(
  ranked: RankedVisualLabBookmarkCandidate,
): VisualLabBookmark {
  const candidate = ranked.candidate;
  const id = createVisualLabBookmarkId(candidate.constellation, candidate.source.archiveDate, candidate.instantUtc);
  return deepFreeze({
    id,
    selectionRank: ranked.selectionRank,
    selectionRole: ranked.selectionRole,
    constellation: candidate.constellation,
    instantUtc: parseUtcInstant(candidate.instantUtc, `${id}.instantUtc`).value,
    instantTaipei: utcToAsiaTaipei(candidate.instantUtc),
    source: candidate.source,
    descriptors: candidate.descriptors,
    copy: createNeutralVisualLabBookmarkCopy(candidate),
  });
}

export function bookmarkToCandidate(bookmark: VisualLabBookmark): VisualLabBookmarkCandidate {
  return Object.freeze({
    constellation: bookmark.constellation,
    instantUtc: bookmark.instantUtc,
    source: bookmark.source,
    descriptors: bookmark.descriptors,
  });
}

export function createVisualLabBookmarksArtifact(input: {
  readonly generatedAtUtc: string;
  readonly sourceCatalogs: readonly VisualLabBookmarkCatalogSummary[];
  readonly bookmarks: readonly VisualLabBookmark[];
  readonly selectionPolicy?: VisualLabBookmarkSelectionPolicy;
}): VisualLabBookmarksArtifact {
  return parseVisualLabBookmarksArtifact({
    schema: VISUAL_LAB_BOOKMARK_ARTIFACT_SCHEMA,
    generatorVersion: VISUAL_LAB_BOOKMARK_GENERATOR_VERSION,
    generatedAtUtc: input.generatedAtUtc,
    timeZone: 'Asia/Taipei',
    sourceCatalogs: input.sourceCatalogs,
    selectionPolicy: input.selectionPolicy ?? SELECTION_POLICY,
    claimCeiling: CLAIM_CEILING,
    bookmarks: input.bookmarks,
  });
}

export { BOOKMARK_CATALOG_URLS, CLAIM_CEILING, DESCRIPTOR_DISTANCE_KEYS, SELECTION_POLICY };
