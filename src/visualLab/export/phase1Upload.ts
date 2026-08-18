import {
  serializeVisualLabCaptureBundleForUpload,
  validateVisualLabCaptureBundle,
  type VisualLabCaptureBundle,
} from './captureBundle';
import type { ArtifactWriter, ArtifactWriteRecord, ArtifactWriteResult } from './artifactWriter';

export type Phase1UploadStatus = 'uploaded' | 'unavailable' | 'rejected';

export interface Phase1UploadResponse {
  readonly ok: boolean;
  readonly status: number;
  json?(): Promise<unknown>;
  text?(): Promise<string>;
}

export interface Phase1UploadRequestInit {
  readonly method: 'POST';
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
}

export type Phase1UploadFetcher = (
  endpoint: string,
  init: Phase1UploadRequestInit,
) => Promise<Phase1UploadResponse>;

export interface Phase1UploadRegistration {
  /** A platform-owned schema identifier, not inferred from the bundle. */
  readonly schemaId: string;
  readonly endpoint: string;
  /** The caller must provide the network implementation explicitly. */
  readonly fetcher: Phase1UploadFetcher;
}

export interface Phase1UploadAdapterOptions {
  readonly registration?: Partial<Phase1UploadRegistration>;
  readonly schemaId?: string;
  readonly registeredSchemaId?: string;
  readonly endpoint?: string;
  readonly uploadEndpoint?: string;
  readonly fetcher?: Phase1UploadFetcher;
}

export interface Phase1UploadResult {
  readonly status: Phase1UploadStatus;
  readonly schemaId: string | null;
  readonly endpoint: string | null;
  readonly receipt: unknown | null;
  readonly reason: string | null;
}

/** A source-neutral adapter can be handed to a UI later without a session reference. */
export interface Phase1UploadAdapter extends ArtifactWriter {
  upload(bundle: VisualLabCaptureBundle): Promise<Phase1UploadResult>;
}

function freeze<T>(value: T): T {
  return Object.freeze(value);
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function validEndpoint(value: string | null): boolean {
  if (value === null) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function unavailable(reason: string, schemaId: string | null, endpoint: string | null): Phase1UploadResult {
  return freeze({ status: 'unavailable', schemaId, endpoint, receipt: null, reason });
}

function rejected(reason: string, schemaId: string | null, endpoint: string | null): Phase1UploadResult {
  return freeze({ status: 'rejected', schemaId, endpoint, receipt: null, reason });
}

function registrationFromOptions(options: Phase1UploadAdapterOptions): {
  readonly schemaId: string | null;
  readonly endpoint: string | null;
  readonly fetcher: Phase1UploadFetcher | null;
} {
  return {
    schemaId: nonEmpty(options.registration?.schemaId ?? options.registeredSchemaId ?? options.schemaId),
    endpoint: nonEmpty(options.registration?.endpoint ?? options.uploadEndpoint ?? options.endpoint),
    fetcher: options.registration?.fetcher ?? options.fetcher ?? null,
  };
}

function looksLikeReceipt(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return 'receipt' in record || 'receiptId' in record || 'id' in record || 'url' in record;
}

async function responseBody(response: Phase1UploadResponse): Promise<unknown | null> {
  if (typeof response.json === 'function') {
    try {
      return await response.json();
    } catch {
      // Some fetchers expose text only; a malformed JSON body still fails
      // closed below rather than becoming a made-up receipt.
    }
  }
  if (typeof response.text === 'function') {
    const body = await response.text();
    if (body.trim().length === 0) return null;
    try {
      return JSON.parse(body) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}

function receiptFromBody(body: unknown): unknown | null {
  if (!looksLikeReceipt(body)) return null;
  if (body !== null && typeof body === 'object' && !Array.isArray(body) && 'receipt' in body) {
    const receipt = (body as { readonly receipt?: unknown }).receipt;
    return receipt === null || receipt === undefined ? null : receipt;
  }
  return body;
}

function artifactRecords(bundle: VisualLabCaptureBundle): readonly ArtifactWriteRecord[] {
  return freeze(bundle.artifacts.map(item => freeze({
    logicalPath: item.logicalPath,
    mediaType: item.mediaType,
    sizeBytes: item.sizeBytes,
    sha256: item.sha256,
  })));
}

/**
 * Construct an optional Phase-1 adapter.  Missing registration is a normal
 * unavailable state; it never probes a default endpoint or global `fetch`.
 */
export function createPhase1UploadAdapter(options: Phase1UploadAdapterOptions = {}): Phase1UploadAdapter {
  const registration = registrationFromOptions(options);

  const upload = async (bundle: VisualLabCaptureBundle): Promise<Phase1UploadResult> => {
    const { schemaId, endpoint, fetcher } = registration;
    if (schemaId === null || endpoint === null || fetcher === null) {
      return unavailable(
        'Phase-1 upload is unavailable until a registered schema identifier, endpoint, and fetcher are supplied',
        schemaId,
        endpoint,
      );
    }
    if (!validEndpoint(endpoint)) return unavailable('Phase-1 upload endpoint is not a valid HTTP(S) URL', schemaId, endpoint);
    if (typeof fetcher !== 'function') return unavailable('Phase-1 upload fetcher is unavailable', schemaId, endpoint);

    try {
      validateVisualLabCaptureBundle(bundle);
    } catch (error) {
      return rejected(error instanceof Error ? error.message : String(error), schemaId, endpoint);
    }

    const body = serializeVisualLabCaptureBundleForUpload(bundle, schemaId);
    let response: Phase1UploadResponse;
    try {
      response = await fetcher(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json',
          'x-visual-lab-schema-id': schemaId,
        },
        body,
      });
    } catch (error) {
      return rejected(`Phase-1 upload network failure: ${error instanceof Error ? error.message : String(error)}`, schemaId, endpoint);
    }
    if (response === null || typeof response !== 'object') {
      return rejected('Phase-1 upload returned no response', schemaId, endpoint);
    }
    if (!response.ok) return rejected(`Phase-1 platform refused bundle (HTTP ${response.status})`, schemaId, endpoint);
    const bodyValue = await responseBody(response);
    const receipt = receiptFromBody(bodyValue);
    if (receipt === null) {
      return rejected('Phase-1 platform response contained no registered receipt', schemaId, endpoint);
    }
    return freeze({
      status: 'uploaded',
      schemaId,
      endpoint,
      receipt: deepFreeze(receipt),
      reason: null,
    });
  };

  return {
    upload,
    write: async bundle => {
      const result = await upload(bundle);
      return freeze({
        status: result.status === 'uploaded' ? 'written' : result.status,
        artifacts: result.status === 'uploaded' ? artifactRecords(bundle) : freeze([]),
        reason: result.reason,
      } satisfies ArtifactWriteResult);
    },
  };
}

export const createOptionalPhase1UploadAdapter = createPhase1UploadAdapter;
export const createPhase1UploadArtifactWriter = createPhase1UploadAdapter;
