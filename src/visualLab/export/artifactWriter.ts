import { zipSync } from 'fflate';
import {
  artifactBytesForWrite,
  type VisualLabCaptureArtifact,
  type VisualLabCaptureBundle,
  validateVisualLabCaptureBundle,
} from './captureBundle';

export type ArtifactWriteStatus = 'written' | 'unavailable' | 'rejected';

export interface ArtifactWriteRecord {
  readonly logicalPath: string;
  readonly mediaType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
}

export interface ArtifactWriteResult {
  readonly status: ArtifactWriteStatus;
  readonly artifacts: readonly ArtifactWriteRecord[];
  readonly reason: string | null;
}

/** The only output port used by local download and future platform adapters. */
export interface ArtifactWriter {
  write(bundle: VisualLabCaptureBundle): Promise<ArtifactWriteResult>;
}

export interface BrowserDownloadAnchor {
  href: string;
  download: string;
  click(): void;
}

/**
 * Browser primitives are injected so local downloads are testable without a
 * DOM.  The adapter does not synthesize or alter a raster/vector asset.
 */
export interface BrowserDownloadPrimitives {
  createBlob(parts: BlobPart[], mediaType: string): Blob;
  createObjectUrl(blob: Blob): string;
  revokeObjectUrl(url: string): void;
  createDownloadAnchor(): BrowserDownloadAnchor;
  appendAnchor?(anchor: BrowserDownloadAnchor): void;
  removeAnchor?(anchor: BrowserDownloadAnchor): void;
}

export interface LocalDownloadArtifactWriterOptions {
  readonly primitives?: BrowserDownloadPrimitives;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function writeRecords(bundle: VisualLabCaptureBundle): readonly ArtifactWriteRecord[] {
  return freeze(bundle.artifacts.map(artifact => freeze({
    logicalPath: artifact.logicalPath,
    mediaType: artifact.mediaType,
    sizeBytes: artifact.sizeBytes,
    sha256: artifact.sha256,
  })));
}

function failure(status: Exclude<ArtifactWriteStatus, 'written'>, reason: string): ArtifactWriteResult {
  return freeze({ status, artifacts: freeze([]), reason });
}

function archiveFilename(figureId: string): string {
  const safeFigureId = figureId.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${safeFigureId || 'visual-lab-figure'}-bundle.zip`;
}

/** Keep the manifest paths intact while producing one browser-safe download. */
export function buildVisualLabCaptureZip(bundle: VisualLabCaptureBundle): Uint8Array {
  const entries: Record<string, Uint8Array> = {};
  for (const artifact of bundle.artifacts) {
    entries[artifact.logicalPath] = artifactBytesForWrite(artifact);
  }
  return zipSync(entries, { level: 6 });
}

function defaultBrowserPrimitives(): BrowserDownloadPrimitives {
  const browser = globalThis as typeof globalThis & {
    document?: {
      createElement(tagName: string): BrowserDownloadAnchor;
      body?: { appendChild(node: BrowserDownloadAnchor): void; removeChild(node: BrowserDownloadAnchor): void };
    };
    URL?: { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void };
  };
  if (
    typeof Blob === 'undefined'
    || browser.URL === undefined
    || typeof browser.URL.createObjectURL !== 'function'
    || typeof browser.URL.revokeObjectURL !== 'function'
    || browser.document === undefined
  ) {
    throw new Error('browser local-download primitives are unavailable');
  }
  return {
    createBlob: (parts, mediaType) => new Blob(parts, { type: mediaType }),
    createObjectUrl: blob => browser.URL!.createObjectURL(blob),
    revokeObjectUrl: url => browser.URL!.revokeObjectURL(url),
    createDownloadAnchor: () => browser.document!.createElement('a'),
    appendAnchor: anchor => browser.document!.body?.appendChild(anchor),
    removeAnchor: anchor => browser.document!.body?.removeChild(anchor),
  };
}

function validateArtifactForWrite(artifact: VisualLabCaptureArtifact): void {
  if (artifact.logicalPath.trim().length === 0) throw new Error('artifact logical path is empty');
  if (artifact.sizeBytes < 0 || artifact.bytes.length !== artifact.sizeBytes) {
    throw new Error(`artifact size mismatch: ${artifact.logicalPath}`);
  }
}

/**
 * Download one validated bundle as a single ZIP. Browsers otherwise tend to
 * block the second and later automatic downloads. A URL is revoked even when
 * a click primitive throws.
 */
export function createLocalDownloadArtifactWriter(
  options: LocalDownloadArtifactWriterOptions = {},
): ArtifactWriter {
  return {
    async write(bundle): Promise<ArtifactWriteResult> {
      try {
        validateVisualLabCaptureBundle(bundle);
        bundle.artifacts.forEach(validateArtifactForWrite);
      } catch (error) {
        return failure('rejected', error instanceof Error ? error.message : String(error));
      }

      let primitives: BrowserDownloadPrimitives;
      try {
        primitives = options.primitives ?? defaultBrowserPrimitives();
      } catch (error) {
        return failure('unavailable', error instanceof Error ? error.message : String(error));
      }

      try {
        const bytes = buildVisualLabCaptureZip(bundle);
        const blob = primitives.createBlob([bytes.slice().buffer as ArrayBuffer], 'application/zip');
        const objectUrl = primitives.createObjectUrl(blob);
        let anchor: BrowserDownloadAnchor | null = null;
        try {
          anchor = primitives.createDownloadAnchor();
          anchor.href = objectUrl;
          anchor.download = archiveFilename(bundle.figureId);
          primitives.appendAnchor?.(anchor);
          anchor.click();
        } finally {
          if (anchor !== null) primitives.removeAnchor?.(anchor);
          primitives.revokeObjectUrl(objectUrl);
        }
      } catch (error) {
        return failure('rejected', error instanceof Error ? error.message : String(error));
      }
      return freeze({ status: 'written', artifacts: writeRecords(bundle), reason: null });
    },
  };
}

export const createBrowserLocalDownloadArtifactWriter = createLocalDownloadArtifactWriter;
export const createLocalArtifactWriter = createLocalDownloadArtifactWriter;
