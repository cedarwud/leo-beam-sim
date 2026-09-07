import { unzipSync } from 'fflate';

import {
  buildVisualLabCaptureBundle,
  buildVisualLabCaptureZip,
  CaptureBundleError,
  createLocalDownloadArtifactWriter,
  createPhase1UploadAdapter,
  validateVisualLabCaptureBundle,
  type ArtifactWriter,
  type ArtifactWriteResult,
  type CapturedAssetInput,
  type CaptureBundleBuildOptions,
  type Phase1UploadFetcher,
  type Phase1UploadResult,
  type VisualLabCaptureArtifact,
  type VisualLabCaptureArtifactDescriptor,
  type VisualLabCaptureBundle,
  type VisualLabCaptureManifest,
} from '../../visualLab/export';
import { sha256 } from '../../visualLab/export/hash';
import type { LabSnapshot } from '../../visualLab/session';
import type { VisualLabFigureProfile } from './presentation/visualLabPresentationContract';

/** Explicit input for the figure archive boundary; no React session is accepted. */
export type FigureBundleBuildInput = Omit<
  CaptureBundleBuildOptions,
  'figureProfile' | 'assets' | 'visualAssets' | 'capturedAssets' | 'capturedPng' | 'capturedSvg'
> & {
  readonly snapshot: LabSnapshot;
  readonly figureProfile: VisualLabFigureProfile;
  readonly capturedPng: CapturedAssetInput;
};

export interface FigureBundleArchive {
  readonly bundle: VisualLabCaptureBundle;
  readonly zipBytes: Uint8Array;
  readonly blob: Blob;
}

export interface FigureBundleDownloadInput extends FigureBundleBuildInput {
  /** Injected for tests or alternate output targets; the default is local download. */
  readonly writer?: ArtifactWriter;
}

export interface FigureBundleDownloadResult extends FigureBundleArchive {
  readonly write: ArtifactWriteResult;
}

export interface FigureBundleUploadInput {
  readonly bundle: VisualLabCaptureBundle;
  readonly endpoint: string;
  readonly schemaId: string;
  readonly fetcher: Phase1UploadFetcher;
}

export type FigureBundleRaw = Blob | ArrayBuffer | Uint8Array | string;

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function blobFromBytes(bytes: Uint8Array, mediaType: string): Blob {
  const browser = globalThis as typeof globalThis & {
    Blob?: new (parts?: BlobPart[], options?: { readonly type?: string }) => Blob;
  };
  if (typeof browser.Blob !== 'function') {
    throw new CaptureBundleError('INVALID_BUNDLE', 'Blob is unavailable for figure bundle export');
  }
  const payload = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return new browser.Blob([payload], { type: mediaType });
}

/** Build the validated data bundle from one immutable accepted snapshot. */
export function buildVisualLabFigureBundle(input: FigureBundleBuildInput): VisualLabCaptureBundle {
  const { snapshot, capturedPng, ...options } = input;
  return buildVisualLabCaptureBundle(snapshot, {
    ...options,
    figureProfile: input.figureProfile,
    assets: { png: capturedPng },
  });
}

/** Serialize a validated figure bundle as the same ZIP consumed by downloads. */
export function serializeVisualLabFigureBundle(bundle: VisualLabCaptureBundle): Blob {
  validateVisualLabCaptureBundle(bundle);
  return blobFromBytes(buildVisualLabCaptureZip(bundle), 'application/zip');
}

export function buildVisualLabFigureBundleArchive(input: FigureBundleBuildInput): FigureBundleArchive {
  const bundle = buildVisualLabFigureBundle(input);
  const zipBytes = buildVisualLabCaptureZip(bundle);
  return Object.freeze({
    bundle,
    zipBytes: zipBytes.slice(),
    blob: blobFromBytes(zipBytes, 'application/zip'),
  });
}

/**
 * Build the figure archive and hand the validated bundle to an output port.
 * The component supplies data; it does not supply a session or closure state.
 */
export async function downloadVisualLabFigureBundle(
  input: FigureBundleDownloadInput,
): Promise<FigureBundleDownloadResult> {
  const { writer, ...buildInput } = input;
  const archive = buildVisualLabFigureBundleArchive(buildInput);
  const write = await (writer ?? createLocalDownloadArtifactWriter()).write(archive.bundle);
  return Object.freeze({ ...archive, write });
}

/** Phase-1 upload adapter with an explicit, testable transport dependency. */
export function uploadVisualLabFigureBundle(
  input: FigureBundleUploadInput,
): Promise<Phase1UploadResult> {
  return createPhase1UploadAdapter({
    registration: {
      endpoint: input.endpoint,
      schemaId: input.schemaId,
      fetcher: input.fetcher,
    },
  }).upload(input.bundle);
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function invalidBundle(message: string, cause?: unknown): CaptureBundleError {
  const suffix = cause instanceof Error && cause.message.length > 0 ? `: ${cause.message}` : '';
  return new CaptureBundleError('INVALID_BUNDLE', `${message}${suffix}`);
}

const FIGURE_ARTIFACT_ROLES = new Set([
  'figure-data-json',
  'quantitative-data-csv',
  'composed-png',
  'vector-overlay',
]);

function assertManifest(value: unknown): asserts value is VisualLabCaptureManifest {
  if (!record(value)) throw invalidBundle('figure bundle manifest is missing');
  if (value.schema !== 'visual-lab-capture-bundle-v1') {
    throw invalidBundle('figure bundle manifest has an unsupported schema');
  }
  if (typeof value.figureId !== 'string' || value.figureId.trim().length === 0) {
    throw invalidBundle('figure bundle manifest has no figureId');
  }
  if (!Array.isArray(value.artifactFiles)) {
    throw invalidBundle('figure bundle manifest has no artifact file descriptors');
  }
  const paths = new Set<string>();
  for (const descriptor of value.artifactFiles) {
    if (!record(descriptor)
      || typeof descriptor.role !== 'string'
      || !FIGURE_ARTIFACT_ROLES.has(descriptor.role)
      || descriptor.role === 'manifest-json'
      || typeof descriptor.logicalPath !== 'string'
      || descriptor.logicalPath.trim().length === 0
      || typeof descriptor.mediaType !== 'string'
      || typeof descriptor.sha256 !== 'string'
      || !/^[0-9a-f]{64}$/i.test(descriptor.sha256)
      || typeof descriptor.sizeBytes !== 'number'
      || !Number.isInteger(descriptor.sizeBytes)
      || descriptor.sizeBytes < 0
    ) throw invalidBundle('figure bundle manifest contains an invalid artifact descriptor');
    if (paths.has(descriptor.logicalPath)) {
      throw invalidBundle(`figure bundle manifest repeats ${descriptor.logicalPath}`);
    }
    paths.add(descriptor.logicalPath);
  }
}

function validatedParsedBundle(value: unknown): VisualLabCaptureBundle {
  if (!record(value) || value.schema !== 'visual-lab-capture-bundle-v1') {
    throw invalidBundle('unsupported or missing visual-lab capture bundle schema');
  }
  assertManifest(value.manifest);
  if (value.figureId !== value.manifest.figureId) {
    throw invalidBundle('figure bundle figureId does not match its manifest');
  }
  try {
    validateVisualLabCaptureBundle(value as unknown as VisualLabCaptureBundle);
  } catch (error) {
    if (error instanceof CaptureBundleError) throw error;
    throw invalidBundle('figure bundle validation failed', error);
  }
  return deepFreeze(value as unknown as VisualLabCaptureBundle);
}

function parseDirectJson(text: string): VisualLabCaptureBundle | null {
  if (!/^[\s]*[\[{]/.test(text)) return null;
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (error) {
    throw invalidBundle('figure bundle JSON is malformed', error);
  }
  return validatedParsedBundle(value);
}

function parseZip(bytes: Uint8Array): VisualLabCaptureBundle {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(bytes);
  } catch (error) {
    throw invalidBundle('figure bundle ZIP is malformed', error);
  }

  const paths = Object.keys(entries);
  const manifestPaths = paths.filter(path => path === 'manifest.json' || path.endsWith('/manifest.json'));
  if (manifestPaths.length !== 1) throw invalidBundle('figure bundle ZIP must contain exactly one manifest.json');
  const manifestPath = manifestPaths[0];
  if (manifestPath === undefined) throw invalidBundle('figure bundle manifest path is missing');

  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(new TextDecoder().decode(entries[manifestPath])) as unknown;
  } catch (error) {
    throw invalidBundle('figure bundle manifest JSON is malformed', error);
  }
  assertManifest(manifestValue);

  const expectedPaths = new Set([manifestPath, ...manifestValue.artifactFiles.map(item => item.logicalPath)]);
  if (paths.some(path => !expectedPaths.has(path)) || expectedPaths.size !== paths.length) {
    throw invalidBundle('figure bundle ZIP contains an unaccounted artifact');
  }

  const manifestArtifact: VisualLabCaptureArtifact = {
    role: 'manifest-json',
    logicalPath: manifestPath,
    mediaType: 'application/json',
    sha256: sha256(entries[manifestPath]),
    sizeBytes: entries[manifestPath].byteLength,
    bytes: Object.freeze(Array.from(entries[manifestPath])),
  };
  const dataArtifacts: VisualLabCaptureArtifact[] = [];
  let json: string | undefined;
  let csv: string | undefined;
  for (const descriptor of manifestValue.artifactFiles as readonly VisualLabCaptureArtifactDescriptor[]) {
    const artifactBytes = entries[descriptor.logicalPath];
    if (artifactBytes === undefined) throw invalidBundle(`figure bundle is missing ${descriptor.logicalPath}`);
    dataArtifacts.push({
      role: descriptor.role,
      logicalPath: descriptor.logicalPath,
      mediaType: descriptor.mediaType,
      sha256: descriptor.sha256,
      sizeBytes: descriptor.sizeBytes,
      bytes: Object.freeze(Array.from(artifactBytes)),
    });
    if (descriptor.role === 'figure-data-json') json = new TextDecoder().decode(artifactBytes);
    if (descriptor.role === 'quantitative-data-csv') csv = new TextDecoder().decode(artifactBytes);
  }
  if (json === undefined || csv === undefined) {
    throw invalidBundle('figure bundle is missing JSON or CSV data');
  }

  const bundle: VisualLabCaptureBundle = {
    schema: 'visual-lab-capture-bundle-v1',
    figureId: manifestValue.figureId,
    manifest: manifestValue,
    supportingData: { json, csv },
    json,
    csv,
    artifacts: Object.freeze([manifestArtifact, ...dataArtifacts].sort((left, right) => left.logicalPath.localeCompare(right.logicalPath))),
  };
  return validatedParsedBundle(bundle);
}

/** Parse either a ZIP Blob/byte sequence or a JSON-serialized bundle. */
export async function parseFigureBundle(raw: FigureBundleRaw): Promise<VisualLabCaptureBundle> {
  if (typeof raw === 'string') {
    const direct = parseDirectJson(raw);
    if (direct !== null) return direct;
    return parseZip(new TextEncoder().encode(raw));
  }
  if (raw instanceof ArrayBuffer) return parseZip(new Uint8Array(raw.slice(0)));
  if (raw instanceof Uint8Array) return parseZip(raw.slice());
  if (raw !== null && typeof raw === 'object' && typeof raw.arrayBuffer === 'function') {
    return parseZip(new Uint8Array(await raw.arrayBuffer()));
  }
  throw invalidBundle('figure bundle input must be a Blob, ArrayBuffer, Uint8Array, or string');
}
