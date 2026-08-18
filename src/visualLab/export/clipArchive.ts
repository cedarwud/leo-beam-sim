import { zipSync } from 'fflate';
import type { BrowserDownloadAnchor, BrowserDownloadPrimitives } from './artifactWriter';
import type {
  CanvasWebmCaptureResult,
  CanvasWebmProvenanceIdentity,
} from './clipCapture';

/** The archive is an output projection of one already-captured WebM clip. */
export const VISUAL_LAB_CLIP_ARCHIVE_SCHEMA = 'visual-lab-clip-archive-v1' as const;
export const VISUAL_LAB_CLIP_WEBM_ENTRY_NAME = 'clip.webm' as const;
export const VISUAL_LAB_CLIP_MANIFEST_ENTRY_NAME = 'provenance.json' as const;

export type VisualLabClipArchiveSchema = typeof VISUAL_LAB_CLIP_ARCHIVE_SCHEMA;

export type VisualLabClipArchiveErrorCode =
  | 'INVALID_CAPTURE'
  | 'CAPTURE_NOT_COMPLETED'
  | 'EMPTY_CAPTURE'
  | 'INVALID_PROVENANCE'
  | 'UNAVAILABLE'
  | 'DOWNLOAD_FAILED';

export class VisualLabClipArchiveError extends Error {
  readonly code: VisualLabClipArchiveErrorCode;

  constructor(code: VisualLabClipArchiveErrorCode, message: string, cause: unknown = null) {
    super(message);
    this.name = 'VisualLabClipArchiveError';
    this.code = code;
    this.cause = cause;
  }

  readonly cause: unknown;
}

/** Re-export the shared browser download port under a clip-specific name. */
export type ClipArchiveBrowserPrimitives = BrowserDownloadPrimitives;
export type ClipArchiveDownloadAnchor = BrowserDownloadAnchor;

export interface VisualLabClipArchiveOptions {
  /** Base name for the downloaded ZIP; `.zip` is added automatically. */
  readonly filename?: string;
  /** Alias for integrations that call the base name `archiveFilename`. */
  readonly archiveFilename?: string;
  /** Alias for integrations that call the base name `name`. */
  readonly name?: string;
  /** Alias for integrations that use an explicit base name. */
  readonly baseName?: string;
  /** Stable story/clip identity retained in the provenance manifest. */
  readonly clipId?: string;
  readonly title?: string;
  readonly claimBoundary?: string;
  readonly sourceLocators?: readonly string[];
  readonly locale?: string;
  readonly theme?: string;
  readonly primitives?: ClipArchiveBrowserPrimitives;
  /** Alias accepted by callers that name the injected port `browser`. */
  readonly browser?: ClipArchiveBrowserPrimitives;
}

export interface VisualLabClipArchiveManifest {
  readonly schema: VisualLabClipArchiveSchema;
  readonly archiveFilename: string;
  readonly files: {
    readonly webm: typeof VISUAL_LAB_CLIP_WEBM_ENTRY_NAME;
    readonly provenance: typeof VISUAL_LAB_CLIP_MANIFEST_ENTRY_NAME;
  };
  readonly webm: {
    readonly filename: typeof VISUAL_LAB_CLIP_WEBM_ENTRY_NAME;
    readonly mimeType?: string;
    readonly bytes: number;
  };
  readonly capture: Readonly<Record<string, string | number | boolean>>;
  readonly provenance: Readonly<CanvasWebmProvenanceIdentity>;
  readonly clipId?: string;
  readonly title?: string;
  readonly claimBoundary?: string;
  readonly sourceLocators?: readonly string[];
  readonly locale?: string;
  readonly theme?: string;
}

export interface VisualLabClipArchive {
  readonly filename: string;
  readonly webmFilename: typeof VISUAL_LAB_CLIP_WEBM_ENTRY_NAME;
  readonly manifestFilename: typeof VISUAL_LAB_CLIP_MANIFEST_ENTRY_NAME;
  readonly manifest: VisualLabClipArchiveManifest;
  /** Immutable copy of the complete ZIP payload. */
  readonly zipBytes: Uint8Array;
  readonly archiveBytes: number;
  readonly webmBytes: number;
  readonly manifestBytes: number;
}

export type ClipArchiveWriteStatus = 'written' | 'unavailable' | 'rejected';

export interface ClipArchiveWriteResult {
  readonly status: ClipArchiveWriteStatus;
  readonly filename: string | null;
  /** ZIP byte length. Zero means no archive was produced. */
  readonly bytes: number;
  readonly archiveBytes: number;
  readonly webmBytes: number;
  readonly manifestBytes: number;
  readonly sizeBytes: number;
  readonly reason: string | null;
  readonly code: VisualLabClipArchiveErrorCode | null;
}

export interface ClipArchiveWriteRequest extends VisualLabClipArchiveOptions {
  readonly capture: CanvasWebmCaptureResult;
}

export interface VisualLabClipArchiveWriter {
  write(
    input: CanvasWebmCaptureResult | ClipArchiveWriteRequest,
    options?: VisualLabClipArchiveOptions,
  ): Promise<ClipArchiveWriteResult>;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function archiveError(
  code: VisualLabClipArchiveErrorCode,
  message: string,
  cause: unknown = null,
): VisualLabClipArchiveError {
  return new VisualLabClipArchiveError(code, message, cause);
}

function errorMessage(value: unknown, fallback: string): string {
  return value instanceof Error && value.message.trim().length > 0 ? value.message : fallback;
}

function nonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Convert a caller-facing filename to a conservative download base name.
 * Paths, control characters, extension confusion, and leading dot names are
 * removed before the name is used either as a download name or manifest data.
 */
export function sanitizeVisualLabClipFilename(value: unknown, fallback = 'visual-lab-clip'): string {
  const fallbackValue = typeof fallback === 'string' ? fallback : 'visual-lab-clip';
  const raw = typeof value === 'string' ? value.normalize('NFKC').trim() : '';
  let candidate = raw;
  while (/\.(?:zip|webm)$/i.test(candidate)) candidate = candidate.replace(/\.(?:zip|webm)$/i, '');
  candidate = candidate
    .replace(/[\\/]+/g, '-')
    .replace(/[\u0000-\u001f\u007f]+/g, '-')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.\-_]+|[.\-_]+$/g, '')
    .slice(0, 120)
    .replace(/[.\-_]+$/g, '');

  const fallbackCandidate = fallbackValue
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.\-_]+|[.\-_]+$/g, '')
    .slice(0, 120)
    .replace(/[.\-_]+$/g, '');
  const safe = candidate || fallbackCandidate || 'visual-lab-clip';
  // Avoid names that have special meaning on Windows when a ZIP is moved
  // between platforms. The prefix is deterministic and still human-readable.
  return /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe) ? `clip-${safe}` : safe;
}

function bytesFromCapture(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value.slice();
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (Array.isArray(value)) {
    if (!value.every(byte => Number.isInteger(byte) && byte >= 0 && byte <= 255)) {
      throw archiveError('INVALID_CAPTURE', 'capture bytes must contain integers in [0, 255]');
    }
    return Uint8Array.from(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  throw archiveError('INVALID_CAPTURE', 'capture bytes must be a Uint8Array or ArrayBuffer');
}

function copyProvenance(value: unknown): Readonly<CanvasWebmProvenanceIdentity> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw archiveError('INVALID_PROVENANCE', 'capture provenance must be an object');
  }
  const source = value as Record<string, unknown>;
  const required = ['analysisRunId', 'frame', 'story', 'runtime'] as const;
  for (const field of required) {
    if (!nonEmptyText(source[field])) {
      throw archiveError('INVALID_PROVENANCE', `capture provenance.${field} must be non-empty text`);
    }
  }

  const copy: Record<string, string> = {};
  try {
    for (const [key, fieldValue] of Object.entries(source)) {
      if (!nonEmptyText(fieldValue)) {
        throw archiveError('INVALID_PROVENANCE', `capture provenance.${key} must be non-empty text`);
      }
      Object.defineProperty(copy, key, {
        configurable: true,
        enumerable: true,
        value: fieldValue,
        writable: true,
      });
    }
  } catch (error) {
    if (error instanceof VisualLabClipArchiveError) throw error;
    throw archiveError('INVALID_PROVENANCE', 'capture provenance could not be copied', error);
  }
  return freeze(copy) as Readonly<CanvasWebmProvenanceIdentity>;
}

function optionalString(source: Record<string, unknown>, field: string): string | undefined {
  const value = source[field];
  if (value === undefined) return undefined;
  if (!nonEmptyText(value)) throw archiveError('INVALID_CAPTURE', `capture.${field} must be non-empty text`);
  return value;
}

function optionalNumber(source: Record<string, unknown>, field: string): number | undefined {
  const value = source[field];
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw archiveError('INVALID_CAPTURE', `capture.${field} must be a finite non-negative number`);
  }
  return value;
}

function captureManifest(
  capture: CanvasWebmCaptureResult,
  provenance: Readonly<CanvasWebmProvenanceIdentity>,
  filename: string,
  webmBytes: number,
  options: VisualLabClipArchiveOptions | string,
): VisualLabClipArchiveManifest {
  const source = capture as unknown as Record<string, unknown>;
  const mimeType = optionalString(source, 'mimeType');
  if (mimeType !== undefined && !/^video\/webm(?:;|$)/i.test(mimeType)) {
    throw archiveError('INVALID_CAPTURE', 'capture.mimeType must identify a WebM result');
  }

  const captureMetadata: Record<string, string | number | boolean> = {
    status: 'completed',
    cancelled: false,
    bytes: webmBytes,
  };
  if (mimeType !== undefined) captureMetadata.mimeType = mimeType;
  for (const field of ['durationMs', 'durationSec', 'duration', 'fps', 'frameCount', 'capturedDurationMs']) {
    const value = optionalNumber(source, field);
    if (value !== undefined) captureMetadata[field] = value;
  }

  const optionRecord = typeof options === 'string' ? {} : options;
  const archiveMetadata: {
    clipId?: string;
    title?: string;
    claimBoundary?: string;
    sourceLocators?: readonly string[];
    locale?: string;
    theme?: string;
  } = {};
  for (const field of ['clipId', 'title', 'claimBoundary', 'locale', 'theme'] as const) {
    const value = optionRecord[field];
    if (value !== undefined) {
      if (!nonEmptyText(value)) throw archiveError('INVALID_CAPTURE', `archive ${field} must be non-empty text`);
      archiveMetadata[field] = value;
    }
  }
  if (optionRecord.sourceLocators !== undefined) {
    if (
      !Array.isArray(optionRecord.sourceLocators)
      || !optionRecord.sourceLocators.every(locator => nonEmptyText(locator))
    ) {
      throw archiveError('INVALID_CAPTURE', 'archive sourceLocators must contain non-empty text');
    }
    archiveMetadata.sourceLocators = freeze([...optionRecord.sourceLocators]);
  }

  return freeze({
    schema: VISUAL_LAB_CLIP_ARCHIVE_SCHEMA,
    archiveFilename: filename,
    files: freeze({
      webm: VISUAL_LAB_CLIP_WEBM_ENTRY_NAME,
      provenance: VISUAL_LAB_CLIP_MANIFEST_ENTRY_NAME,
    }),
    webm: freeze({
      filename: VISUAL_LAB_CLIP_WEBM_ENTRY_NAME,
      ...(mimeType === undefined ? {} : { mimeType }),
      bytes: webmBytes,
    }),
    capture: freeze(captureMetadata),
    provenance,
    ...(archiveMetadata.clipId === undefined ? {} : { clipId: archiveMetadata.clipId }),
    ...(archiveMetadata.title === undefined ? {} : { title: archiveMetadata.title }),
    ...(archiveMetadata.claimBoundary === undefined ? {} : { claimBoundary: archiveMetadata.claimBoundary }),
    ...(archiveMetadata.sourceLocators === undefined ? {} : { sourceLocators: archiveMetadata.sourceLocators }),
    ...(archiveMetadata.locale === undefined ? {} : { locale: archiveMetadata.locale }),
    ...(archiveMetadata.theme === undefined ? {} : { theme: archiveMetadata.theme }),
  });
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw archiveError('INVALID_CAPTURE', 'manifest cannot contain a non-finite number');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value !== 'object') throw archiveError('INVALID_CAPTURE', 'manifest contains a non-serializable value');
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

function manifestBytes(manifest: VisualLabClipArchiveManifest): Uint8Array {
  return new TextEncoder().encode(canonicalJson(manifest));
}

function archiveBaseName(
  provenance: Readonly<CanvasWebmProvenanceIdentity>,
  options: VisualLabClipArchiveOptions | string | undefined,
): string {
  if (typeof options === 'string') return sanitizeVisualLabClipFilename(options);
  const requested = options?.filename
    ?? options?.archiveFilename
    ?? options?.name
    ?? options?.baseName
    ?? options?.clipId;
  return sanitizeVisualLabClipFilename(requested ?? provenance.story);
}

function validatedCapture(capture: unknown): {
  readonly capture: CanvasWebmCaptureResult;
  readonly bytes: Uint8Array;
  readonly provenance: Readonly<CanvasWebmProvenanceIdentity>;
} {
  if (capture === null || typeof capture !== 'object' || Array.isArray(capture)) {
    throw archiveError('INVALID_CAPTURE', 'a captured WebM result is required');
  }
  const source = capture as Record<string, unknown>;
  if (source.status !== 'completed' || source.cancelled === true) {
    throw archiveError('CAPTURE_NOT_COMPLETED', 'only a completed WebM capture can be archived');
  }
  const bytes = bytesFromCapture(source.bytes);
  if (bytes.length === 0) throw archiveError('EMPTY_CAPTURE', 'completed WebM capture contains no bytes');
  const provenance = copyProvenance(source.provenance);
  return { capture: capture as CanvasWebmCaptureResult, bytes, provenance };
}

/** Prepare and validate one immutable two-entry ZIP payload. */
export function prepareVisualLabClipArchive(
  capture: CanvasWebmCaptureResult,
  options: VisualLabClipArchiveOptions | string = {},
): VisualLabClipArchive {
  const validated = validatedCapture(capture);
  const filename = `${archiveBaseName(validated.provenance, options)}.zip`;
  const manifest = captureManifest(validated.capture, validated.provenance, filename, validated.bytes.length, options);
  const manifestPayload = manifestBytes(manifest);
  const zipBytes = zipSync({
    [VISUAL_LAB_CLIP_WEBM_ENTRY_NAME]: validated.bytes,
    [VISUAL_LAB_CLIP_MANIFEST_ENTRY_NAME]: manifestPayload,
  }, { level: 6 });
  return freeze({
    filename,
    webmFilename: VISUAL_LAB_CLIP_WEBM_ENTRY_NAME,
    manifestFilename: VISUAL_LAB_CLIP_MANIFEST_ENTRY_NAME,
    manifest,
    zipBytes: zipBytes.slice(),
    archiveBytes: zipBytes.byteLength,
    webmBytes: validated.bytes.byteLength,
    manifestBytes: manifestPayload.byteLength,
  });
}

/** Pure ZIP builder, matching the existing figure bundle helper convention. */
export function buildVisualLabClipZip(
  capture: CanvasWebmCaptureResult,
  options: VisualLabClipArchiveOptions | string = {},
): Uint8Array {
  return prepareVisualLabClipArchive(capture, options).zipBytes.slice();
}

function defaultBrowserPrimitives(): ClipArchiveBrowserPrimitives {
  const browser = globalThis as typeof globalThis & {
    Blob?: new (parts?: BlobPart[], options?: { readonly type?: string }) => Blob;
    URL?: {
      createObjectURL(blob: Blob): string;
      revokeObjectURL(url: string): void;
    };
    document?: {
      createElement(tagName: string): BrowserDownloadAnchor;
      body?: {
        appendChild(node: BrowserDownloadAnchor): void;
        removeChild(node: BrowserDownloadAnchor): void;
      };
    };
  };
  if (
    typeof browser.Blob !== 'function'
    || browser.URL === undefined
    || typeof browser.URL.createObjectURL !== 'function'
    || typeof browser.URL.revokeObjectURL !== 'function'
    || browser.document === undefined
  ) {
    throw archiveError('UNAVAILABLE', 'browser local clip-download primitives are unavailable');
  }
  return {
    createBlob: (parts, mediaType) => new browser.Blob!(parts, { type: mediaType }),
    createObjectUrl: blob => browser.URL!.createObjectURL(blob),
    revokeObjectUrl: url => browser.URL!.revokeObjectURL(url),
    createDownloadAnchor: () => browser.document!.createElement('a'),
    appendAnchor: anchor => browser.document!.body?.appendChild(anchor),
    removeAnchor: anchor => browser.document!.body?.removeChild(anchor),
  };
}

function validatePrimitives(primitives: ClipArchiveBrowserPrimitives): void {
  if (primitives === null || typeof primitives !== 'object') {
    throw archiveError('UNAVAILABLE', 'browser local clip-download primitives are unavailable');
  }
  for (const field of ['createBlob', 'createObjectUrl', 'revokeObjectUrl', 'createDownloadAnchor'] as const) {
    if (typeof primitives[field] !== 'function') {
      throw archiveError('UNAVAILABLE', `browser primitive ${field} is unavailable`);
    }
  }
}

function resultFailure(
  status: Exclude<ClipArchiveWriteStatus, 'written'>,
  error: unknown,
): ClipArchiveWriteResult {
  const normalized = error instanceof VisualLabClipArchiveError
    ? error
    : archiveError(status === 'unavailable' ? 'UNAVAILABLE' : 'DOWNLOAD_FAILED', errorMessage(error, 'clip archive write failed'), error);
  return freeze({
    status,
    filename: null,
    bytes: 0,
    archiveBytes: 0,
    webmBytes: 0,
    manifestBytes: 0,
    sizeBytes: 0,
    reason: normalized.message,
    code: normalized.code,
  });
}

function resultWritten(archive: VisualLabClipArchive): ClipArchiveWriteResult {
  return freeze({
    status: 'written',
    filename: archive.filename,
    bytes: archive.archiveBytes,
    archiveBytes: archive.archiveBytes,
    webmBytes: archive.webmBytes,
    manifestBytes: archive.manifestBytes,
    sizeBytes: archive.archiveBytes,
    reason: null,
    code: null,
  });
}

function splitRequest(
  input: CanvasWebmCaptureResult | ClipArchiveWriteRequest,
  options: VisualLabClipArchiveOptions | undefined,
): {
  readonly capture: CanvasWebmCaptureResult;
  readonly options: VisualLabClipArchiveOptions;
} {
  if (
    input !== null
    && typeof input === 'object'
    && 'capture' in input
    && input.capture !== null
    && typeof input.capture === 'object'
  ) {
    const request = input as ClipArchiveWriteRequest;
    return {
      capture: request.capture,
      options: {
        ...request,
        ...(options ?? {}),
      },
    };
  }
  return { capture: input as CanvasWebmCaptureResult, options: options ?? {} };
}

async function writeClipArchive(
  input: CanvasWebmCaptureResult | ClipArchiveWriteRequest,
  configuredOptions: VisualLabClipArchiveOptions,
  callOptions?: VisualLabClipArchiveOptions,
): Promise<ClipArchiveWriteResult> {
  const request = splitRequest(input, callOptions);
  const options = {
    ...configuredOptions,
    ...request.options,
    ...(callOptions ?? {}),
  };
  let archive: VisualLabClipArchive;
  try {
    archive = prepareVisualLabClipArchive(request.capture, options);
  } catch (error) {
    return resultFailure('rejected', error);
  }

  let primitives: ClipArchiveBrowserPrimitives;
  try {
    primitives = options.primitives ?? options.browser ?? defaultBrowserPrimitives();
    validatePrimitives(primitives);
  } catch (error) {
    return resultFailure('unavailable', error);
  }

  let objectUrl: string | null = null;
  let anchor: BrowserDownloadAnchor | null = null;
  let writeFailure: VisualLabClipArchiveError | null = null;
  try {
    const blob = primitives.createBlob([archive.zipBytes.slice().buffer as ArrayBuffer], 'application/zip');
    if (blob === null || blob === undefined) throw archiveError('DOWNLOAD_FAILED', 'clip archive Blob was not created');
    objectUrl = primitives.createObjectUrl(blob);
    if (!nonEmptyText(objectUrl)) throw archiveError('DOWNLOAD_FAILED', 'clip archive object URL was empty');
    anchor = primitives.createDownloadAnchor();
    if (anchor === null || typeof anchor !== 'object') throw archiveError('DOWNLOAD_FAILED', 'download anchor was not created');
    anchor.href = objectUrl;
    anchor.download = archive.filename;
    primitives.appendAnchor?.(anchor);
    anchor.click();
  } catch (error) {
    writeFailure = error instanceof VisualLabClipArchiveError
      ? error
      : archiveError('DOWNLOAD_FAILED', `clip archive download failed: ${errorMessage(error, 'unknown error')}`, error);
  } finally {
    // Cleanup is nested so a failing remove operation cannot prevent URL
    // revocation. A cleanup error is still reported as a failed write.
    if (anchor !== null) {
      try {
        primitives.removeAnchor?.(anchor);
      } catch (error) {
        writeFailure = writeFailure ?? archiveError(
          'DOWNLOAD_FAILED',
          `download anchor cleanup failed: ${errorMessage(error, 'unknown error')}`,
          error,
        );
      }
    }
    if (objectUrl !== null) {
      try {
        primitives.revokeObjectUrl(objectUrl);
      } catch (error) {
        writeFailure = writeFailure ?? archiveError(
          'DOWNLOAD_FAILED',
          `clip archive object URL cleanup failed: ${errorMessage(error, 'unknown error')}`,
          error,
        );
      }
    }
  }
  return writeFailure === null ? resultWritten(archive) : resultFailure('rejected', writeFailure);
}

/** Browser download adapter for one completed WebM capture. */
export function createLocalClipArchiveWriter(
  options: VisualLabClipArchiveOptions = {},
): VisualLabClipArchiveWriter {
  return {
    write: (input, callOptions) => writeClipArchive(input, options, callOptions),
  };
}

export async function downloadVisualLabClipArchive(
  input: CanvasWebmCaptureResult | ClipArchiveWriteRequest,
  options: VisualLabClipArchiveOptions = {},
): Promise<ClipArchiveWriteResult> {
  return createLocalClipArchiveWriter(options).write(input);
}

/** Common aliases keep the output adapter discoverable at integration sites. */
export const createBrowserLocalClipArchiveWriter = createLocalClipArchiveWriter;
export const createClipArchiveWriter = createLocalClipArchiveWriter;
export const createVisualLabClipArchiveWriter = createLocalClipArchiveWriter;
export const downloadVisualLabClip = downloadVisualLabClipArchive;
export const writeVisualLabClipArchive = downloadVisualLabClipArchive;
export const buildClipArchive = buildVisualLabClipZip;
export const buildVisualLabClipArchive = buildVisualLabClipZip;
