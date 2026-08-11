import { tleFail } from './errors';
import { parseUtcInstant } from './time';
import {
  TLE_SOURCE_KIND,
  type ParsedTleEpoch,
  type TleArchiveEntry,
  type TleArchiveManifest,
  type TleArchiveManifestOptions,
  type TleSatelliteIdentity,
  type ValidatedTleLines,
} from './types';

const TLE_LINE_LENGTH = 69;
const EPOCH_PATTERN = /^(\d{2})(\d{3}\.\d{8})$/;
const INTEGER_PATTERN = /^\d+$/;

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function normalizeLine(line: unknown, label: string): string {
  if (typeof line !== 'string') tleFail('INVALID_TLE_LINE', `${label} must be a string`);
  const normalized = line.replace(/\r$/, '').trimEnd();
  if (normalized.length !== TLE_LINE_LENGTH) {
    tleFail('INVALID_TLE_LINE', `${label} must contain exactly ${TLE_LINE_LENGTH} columns`);
  }
  return normalized;
}

/** Compute the NORAD modulo-10 checksum from a complete 69-column TLE line. */
export function computeTleChecksum(line: string): number {
  const normalized = normalizeLine(line, 'TLE line');
  let sum = 0;
  for (let index = 0; index < TLE_LINE_LENGTH - 1; index += 1) {
    const character = normalized[index]!;
    if (character >= '0' && character <= '9') sum += Number(character);
    else if (character === '-') sum += 1;
  }
  return sum % 10;
}

export function validateTleChecksum(line: string, label = 'TLE line'): string {
  const normalized = normalizeLine(line, label);
  const checkCharacter = normalized[TLE_LINE_LENGTH - 1]!;
  if (!INTEGER_PATTERN.test(checkCharacter)) {
    tleFail('CHECKSUM_MISMATCH', `${label} checksum column is not a decimal digit`);
  }
  const expected = computeTleChecksum(normalized);
  const actual = Number(checkCharacter);
  if (expected !== actual) {
    tleFail('CHECKSUM_MISMATCH', `${label} checksum mismatch: expected ${expected}, found ${actual}`, {
      label,
      expected,
      actual,
    });
  }
  return normalized;
}

function parseCatalogNumber(line: string, label: string): string {
  const value = line.slice(2, 7);
  if (!/^\d{1,5}$/.test(value.trim())) {
    tleFail('INVALID_IDENTITY', `${label} has an invalid NORAD catalog number`);
  }
  return value;
}

/** Parse and validate the two-digit TLE epoch from line 1. */
export function parseTleEpoch(line1: string): ParsedTleEpoch {
  const normalized = validateTleChecksum(line1, 'TLE line 1');
  if (!normalized.startsWith('1 ')) tleFail('INVALID_TLE_LINE', 'TLE line 1 must start with "1 "');
  const epochField = normalized.slice(18, 32);
  const match = EPOCH_PATTERN.exec(epochField);
  if (!match) {
    tleFail('INVALID_EPOCH', `TLE line 1 epoch field is malformed: ${epochField}`);
  }
  const twoDigitYear = Number(match[1]);
  const year = twoDigitYear >= 57 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
  const dayOfYear = Number(match[2]);
  if (!Number.isFinite(dayOfYear) || dayOfYear < 1 || dayOfYear >= 367) {
    tleFail('INVALID_EPOCH', `TLE epoch day is outside [1, 367): ${dayOfYear}`);
  }
  const epochMs = Date.UTC(year, 0, 1) + Math.round((dayOfYear - 1) * 86_400_000);
  const epochDate = new Date(epochMs);
  if (!Number.isFinite(epochDate.getTime()) || epochDate.getUTCFullYear() !== year) {
    tleFail('INVALID_EPOCH', 'TLE epoch is outside the supported UTC date range');
  }
  return freeze({
    epochUtc: epochDate.toISOString(),
    epochMs,
    epochYear: year,
    dayOfYear,
  });
}

export function validateTleLines(line1: string, line2: string): ValidatedTleLines {
  const normalizedLine1 = validateTleChecksum(line1, 'TLE line 1');
  const normalizedLine2 = validateTleChecksum(line2, 'TLE line 2');
  if (!normalizedLine1.startsWith('1 ')) tleFail('INVALID_TLE_LINE', 'TLE line 1 must start with "1 "');
  if (!normalizedLine2.startsWith('2 ')) tleFail('INVALID_TLE_LINE', 'TLE line 2 must start with "2 "');
  const catalogNumber1 = parseCatalogNumber(normalizedLine1, 'TLE line 1');
  const catalogNumber2 = parseCatalogNumber(normalizedLine2, 'TLE line 2');
  if (catalogNumber1 !== catalogNumber2) {
    tleFail('INVALID_IDENTITY', `TLE line catalog mismatch: ${catalogNumber1} versus ${catalogNumber2}`);
  }
  return freeze({
    line1: normalizedLine1,
    line2: normalizedLine2,
    identity: freeze({
      satelliteId: catalogNumber1,
      satelliteName: '',
      catalogNumber: catalogNumber1,
    }),
    epoch: parseTleEpoch(normalizedLine1),
  });
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    tleFail('INVALID_ENTRY', `${label} must be a non-empty string`);
  }
  return value.trim();
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    tleFail('INVALID_MANIFEST', `${label} must be a finite non-negative number`);
  }
  return value;
}

function validateEntry(raw: unknown, index: number): TleArchiveEntry {
  if (raw === null || typeof raw !== 'object') {
    tleFail('INVALID_ENTRY', `manifest entry ${index} must be an object`);
  }
  const candidate = raw as Partial<TleArchiveEntry>;
  const satelliteId = requiredText(candidate.satelliteId, `manifest entry ${index} satelliteId`);
  const satelliteName = requiredText(candidate.satelliteName, `manifest entry ${index} satelliteName`);
  const sourcePath = requiredText(candidate.sourcePath, `manifest entry ${index} sourcePath`);
  if (candidate.sourceKind !== TLE_SOURCE_KIND) {
    tleFail('INVALID_ENTRY', `manifest entry ${index} sourceKind must be ${TLE_SOURCE_KIND}`);
  }
  const lines = validateTleLines(candidate.line1 ?? '', candidate.line2 ?? '');
  const metadataEpoch = parseUtcInstant(candidate.epochUtc ?? '', `manifest entry ${index} epochUtc`);
  if (metadataEpoch.ms !== lines.epoch.epochMs) {
    tleFail('INVALID_EPOCH', `manifest entry ${index} epochUtc disagrees with TLE line 1 epoch`, {
      metadataEpochUtc: metadataEpoch.value,
      lineEpochUtc: lines.epoch.epochUtc,
    });
  }
  return freeze({
    satelliteId,
    satelliteName,
    epochUtc: lines.epoch.epochUtc,
    line1: lines.line1,
    line2: lines.line2,
    sourcePath,
    sourceKind: TLE_SOURCE_KIND,
  });
}

function manifestFromInput(
  input: TleArchiveManifest | readonly TleArchiveEntry[],
  options?: TleArchiveManifestOptions,
): { readonly entries: readonly TleArchiveEntry[]; readonly maxPropagationAgeMs: number; readonly archiveId?: string; readonly generatedAtUtc?: string } {
  if (Array.isArray(input)) {
    const max = options?.maxPropagationAgeMs ?? options?.maxAgeMs;
    if (max === undefined) {
      tleFail('INVALID_MANIFEST', 'an injected entry array requires an explicit maxPropagationAgeMs');
    }
    return {
      entries: input,
      maxPropagationAgeMs: finiteNonNegative(max, 'maxPropagationAgeMs'),
      archiveId: options?.archiveId,
      generatedAtUtc: options?.generatedAtUtc,
    };
  }
  if (input === null || typeof input !== 'object') {
    tleFail('INVALID_MANIFEST', 'TLE archive manifest must be an object');
  }
  const candidate = input as Partial<TleArchiveManifest>;
  const max = candidate.maxPropagationAgeMs ?? candidate.maxAgeMs ?? options?.maxPropagationAgeMs ?? options?.maxAgeMs;
  if (max === undefined) tleFail('INVALID_MANIFEST', 'manifest must declare maxPropagationAgeMs');
  const entries = candidate.entries;
  if (!Array.isArray(entries)) tleFail('INVALID_MANIFEST', 'manifest entries must be an array');
  const archiveId = candidate.archiveId ?? options?.archiveId;
  const generatedAtUtc = candidate.generatedAtUtc ?? options?.generatedAtUtc;
  return {
    entries,
    maxPropagationAgeMs: finiteNonNegative(max, 'maxPropagationAgeMs'),
    archiveId: archiveId === undefined ? undefined : requiredText(archiveId, 'archiveId'),
    generatedAtUtc,
  };
}

/**
 * Validate and normalize an injected archive manifest.  No directory or URL
 * discovery occurs here.  Identical duplicate records are collapsed; records
 * with the same satellite identity and epoch but different TLE content fail
 * closed because their selection would not be deterministic.
 */
export function validateTleArchiveManifest(
  input: TleArchiveManifest | readonly TleArchiveEntry[],
  options?: TleArchiveManifestOptions,
): TleArchiveManifest {
  const source = manifestFromInput(input, options);
  if (source.entries.length === 0) tleFail('INVALID_MANIFEST', 'TLE archive manifest must contain at least one entry');
  if (source.generatedAtUtc !== undefined) parseUtcInstant(source.generatedAtUtc, 'manifest generatedAtUtc');

  const normalized: TleArchiveEntry[] = [];
  const byIdentityEpoch = new Map<string, TleArchiveEntry>();
  const identityNames = new Map<string, string>();
  const identityCatalogs = new Map<string, string>();
  for (let index = 0; index < source.entries.length; index += 1) {
    const entry = validateEntry(source.entries[index], index);
    const existingName = identityNames.get(entry.satelliteId);
    if (existingName !== undefined && existingName !== entry.satelliteName) {
      tleFail('INVALID_IDENTITY', `satellite ${entry.satelliteId} has conflicting names in the archive`);
    }
    identityNames.set(entry.satelliteId, entry.satelliteName);
    const catalog = entry.line1.slice(2, 7);
    const existingCatalog = identityCatalogs.get(entry.satelliteId);
    if (existingCatalog !== undefined && existingCatalog !== catalog) {
      tleFail('INVALID_IDENTITY', `satellite ${entry.satelliteId} maps to conflicting NORAD catalog numbers`);
    }
    identityCatalogs.set(entry.satelliteId, catalog);
    const key = `${entry.satelliteId}\u0000${entry.epochUtc}`;
    const previous = byIdentityEpoch.get(key);
    if (previous !== undefined) {
      if (previous.line1 !== entry.line1 || previous.line2 !== entry.line2) {
        tleFail('CONFLICTING_EPOCH', `satellite ${entry.satelliteId} has conflicting TLE records at ${entry.epochUtc}`);
      }
      continue;
    }
    byIdentityEpoch.set(key, entry);
    normalized.push(entry);
  }
  normalized.sort((left, right) => left.satelliteId.localeCompare(right.satelliteId) || left.epochUtc.localeCompare(right.epochUtc) || left.sourcePath.localeCompare(right.sourcePath));
  return freeze({
    entries: freeze(normalized),
    maxPropagationAgeMs: source.maxPropagationAgeMs,
    ...(source.archiveId === undefined ? {} : { archiveId: source.archiveId }),
    ...(source.generatedAtUtc === undefined ? {} : { generatedAtUtc: parseUtcInstant(source.generatedAtUtc, 'manifest generatedAtUtc').value }),
  });
}

export { normalizeLine };
