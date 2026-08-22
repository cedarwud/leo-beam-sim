/**
 * Act 6 upload session: login-once, batch with jitter, ledger, offline mock.
 *
 * Network access is an injected fetcher, so every test — and the classroom
 * fallback — runs with no socket. Credentials come from `SMARTFARM_*` and never
 * reach the ledger, the export, or a log line.
 *
 * See docs/sdd/SIX-ACTS-P0-VERTICAL-SLICE-SDD.md (M3).
 */

import {
  SIX_ACTS_PLATFORM_API_BASE,
  chunkSixActsPayload,
  type SixActsPlatformPayload,
} from './platformPayload';

export type SixActsUploadMode = 'live' | 'offline-mock';

/** The badge the drawer must show for the whole of an offline-mock session. */
export const SIX_ACTS_OFFLINE_MOCK_BADGE = 'OFFLINE MOCK' as const;

export const SIX_ACTS_BATCH_INTERVAL_CHOICES_SEC = Object.freeze([30, 60, 300] as const);
export const SIX_ACTS_MAX_JITTER_SEC = 10;

export interface SixActsPlatformCredentials {
  readonly email: string;
  readonly password: string;
  readonly macAddress: string;
}

export type SixActsUploadErrorCode =
  | 'MISSING_CREDENTIALS'
  | 'INVALID_BATCH_INTERVAL'
  | 'INVALID_JITTER'
  | 'LOGIN_FAILED'
  | 'NO_TOKEN';

export class SixActsUploadError extends Error {
  readonly code: SixActsUploadErrorCode;

  constructor(code: SixActsUploadErrorCode, message: string) {
    super(message);
    this.name = 'SixActsUploadError';
    this.code = code;
  }
}

/**
 * Reads credentials from an environment map.
 *
 * The values are returned, never printed: the error message names the missing
 * variable, not what any variable contained.
 */
export function readSixActsCredentialsFromEnv(
  env: Readonly<Record<string, string | undefined>>,
): SixActsPlatformCredentials {
  const missing = ['SMARTFARM_EMAIL', 'SMARTFARM_PASSWORD', 'SMARTFARM_MAC']
    .filter(name => (env[name] ?? '') === '');
  if (missing.length > 0) {
    throw new SixActsUploadError(
      'MISSING_CREDENTIALS',
      `set ${missing.join(', ')} before a live upload`,
    );
  }
  return Object.freeze({
    email: env.SMARTFARM_EMAIL as string,
    password: env.SMARTFARM_PASSWORD as string,
    macAddress: env.SMARTFARM_MAC as string,
  });
}

export interface SixActsHttpRequest {
  readonly method: 'GET' | 'POST';
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
}

export interface SixActsHttpResponse {
  readonly status: number;
  readonly body: unknown;
}

export type SixActsFetcher = (request: SixActsHttpRequest) => Promise<SixActsHttpResponse>;

export type SixActsLedgerKind = 'login' | 'upload' | 'read-back';
export type SixActsLedgerOutcome = 'ok' | 'failed' | 'buffered';

/** One line of the always-visible upload ledger. No credentials, ever. */
export interface SixActsLedgerEntry {
  readonly sequence: number;
  readonly kind: SixActsLedgerKind;
  readonly mode: SixActsUploadMode;
  readonly attemptedAtMs: number;
  readonly sampleCount: number;
  readonly httpStatus: number | null;
  readonly outcome: SixActsLedgerOutcome;
  readonly detail: string;
}

export interface SixActsUploadSessionOptions {
  readonly mode: SixActsUploadMode;
  readonly credentials: SixActsPlatformCredentials;
  readonly fetcher: SixActsFetcher;
  /** Injected so a session is deterministic under test. */
  readonly now: () => number;
  /** Injected so the jitter draw is deterministic under test. */
  readonly random: () => number;
  readonly apiBase?: string;
  readonly batchIntervalSec?: number;
  readonly maxSamplesPerBatch?: number;
}

export interface SixActsUploadAttemptResult {
  readonly outcome: SixActsLedgerOutcome;
  readonly httpStatus: number | null;
  readonly sampleCount: number;
  readonly bufferedSampleCount: number;
}

/**
 * A classroom upload session.
 *
 * Two behaviours exist because a class is dozens of groups, not one:
 * the token is fetched once and reused, and every dispatch is offset by a
 * per-session jitter so thirty groups do not hit the API on the same second.
 */
export class SixActsUploadSession {
  readonly mode: SixActsUploadMode;
  readonly jitterSec: number;
  readonly batchIntervalSec: number;

  private readonly apiBase: string;
  private readonly credentials: SixActsPlatformCredentials;
  private readonly fetcher: SixActsFetcher;
  private readonly now: () => number;
  private readonly maxSamplesPerBatch: number;
  private readonly entries: SixActsLedgerEntry[] = [];
  private buffered: SixActsPlatformPayload['data'][number][] = [];
  private token: string | null = null;
  private sequence = 0;

  constructor(options: SixActsUploadSessionOptions) {
    const batchIntervalSec = options.batchIntervalSec ?? SIX_ACTS_BATCH_INTERVAL_CHOICES_SEC[0];
    if (!SIX_ACTS_BATCH_INTERVAL_CHOICES_SEC.includes(batchIntervalSec as 30 | 60 | 300)) {
      throw new SixActsUploadError(
        'INVALID_BATCH_INTERVAL',
        `batch interval must be one of ${SIX_ACTS_BATCH_INTERVAL_CHOICES_SEC.join('/')} s`,
      );
    }
    const draw = options.random();
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) {
      throw new SixActsUploadError('INVALID_JITTER', 'the jitter source must return [0, 1)');
    }

    this.mode = options.mode;
    this.credentials = options.credentials;
    this.fetcher = options.fetcher;
    this.now = options.now;
    this.apiBase = (options.apiBase ?? SIX_ACTS_PLATFORM_API_BASE).replace(/\/+$/, '');
    this.batchIntervalSec = batchIntervalSec;
    this.maxSamplesPerBatch = options.maxSamplesPerBatch ?? 500;
    // Drawn once per session, not per batch: a stable offset keeps the class
    // spread for the whole lesson instead of re-colliding on every tick.
    this.jitterSec = draw * SIX_ACTS_MAX_JITTER_SEC;
  }

  /** The ledger, oldest first. Safe to render verbatim. */
  get ledger(): readonly SixActsLedgerEntry[] {
    return Object.freeze([...this.entries]);
  }

  /** Samples held locally after a failed dispatch, awaiting the next one. */
  get bufferedSampleCount(): number {
    return this.buffered.length;
  }

  /** Dispatch times for `batchCount` batches, each carrying the session jitter. */
  planDispatchTimes(firstBatchAtMs: number, batchCount: number): readonly number[] {
    const jitterMs = Math.round(this.jitterSec * 1000);
    return Object.freeze(Array.from({ length: batchCount }, (_unused, index) =>
      firstBatchAtMs + index * this.batchIntervalSec * 1000 + jitterMs));
  }

  private record(entry: Omit<SixActsLedgerEntry, 'sequence' | 'mode'>): void {
    this.sequence += 1;
    this.entries.push(Object.freeze({ ...entry, sequence: this.sequence, mode: this.mode }));
  }

  private async ensureToken(): Promise<string> {
    if (this.token !== null) return this.token;

    if (this.mode === 'offline-mock') {
      this.token = 'offline-mock-token';
      this.record({
        kind: 'login',
        attemptedAtMs: this.now(),
        sampleCount: 0,
        httpStatus: 200,
        outcome: 'ok',
        detail: `${SIX_ACTS_OFFLINE_MOCK_BADGE}：未連線，使用離線 mock token`,
      });
      return this.token;
    }

    const response = await this.fetcher({
      method: 'POST',
      url: `${this.apiBase}/account/login`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        email: this.credentials.email,
        password: this.credentials.password,
      }).toString(),
    });

    const token = typeof response.body === 'object' && response.body !== null
      ? (response.body as Record<string, unknown>).token
      : undefined;
    if (response.status !== 200) {
      this.record({
        kind: 'login',
        attemptedAtMs: this.now(),
        sampleCount: 0,
        httpStatus: response.status,
        outcome: 'failed',
        detail: '登入失敗',
      });
      throw new SixActsUploadError('LOGIN_FAILED', `login returned HTTP ${response.status}`);
    }
    if (typeof token !== 'string' || token === '') {
      this.record({
        kind: 'login',
        attemptedAtMs: this.now(),
        sampleCount: 0,
        httpStatus: response.status,
        outcome: 'failed',
        detail: '回應沒有 token',
      });
      throw new SixActsUploadError('NO_TOKEN', 'login response carried no token');
    }

    this.token = token;
    this.record({
      kind: 'login',
      attemptedAtMs: this.now(),
      sampleCount: 0,
      httpStatus: response.status,
      outcome: 'ok',
      detail: 'token 取得，本場沿用',
    });
    return token;
  }

  /**
   * Sends one payload, prepending anything a previous failure left buffered.
   *
   * A non-200 does not throw: the batch goes back into the buffer and the
   * ledger says so, because a dropped classroom sample is worse than a retry.
   */
  async uploadBatch(payload: SixActsPlatformPayload): Promise<SixActsUploadAttemptResult> {
    const pending = Object.freeze({
      data: Object.freeze([...this.buffered, ...payload.data]),
    });
    this.buffered = [];

    if (pending.data.length === 0) {
      return Object.freeze({
        outcome: 'ok' as const,
        httpStatus: null,
        sampleCount: 0,
        bufferedSampleCount: 0,
      });
    }

    const token = await this.ensureToken();

    if (this.mode === 'offline-mock') {
      this.record({
        kind: 'upload',
        attemptedAtMs: this.now(),
        sampleCount: pending.data.length,
        httpStatus: 200,
        outcome: 'ok',
        detail: `${SIX_ACTS_OFFLINE_MOCK_BADGE}：未送出，僅走完流程`,
      });
      return Object.freeze({
        outcome: 'ok' as const,
        httpStatus: 200,
        sampleCount: pending.data.length,
        bufferedSampleCount: 0,
      });
    }

    let lastStatus: number | null = null;
    for (const batch of chunkSixActsPayload(pending, this.maxSamplesPerBatch)) {
      const response = await this.fetcher({
        method: 'POST',
        url: `${this.apiBase}/iot_data/${this.credentials.macAddress}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(batch),
      });
      lastStatus = response.status;
      if (response.status !== 200) {
        this.buffered.push(...batch.data);
        this.record({
          kind: 'upload',
          attemptedAtMs: this.now(),
          sampleCount: batch.data.length,
          httpStatus: response.status,
          outcome: 'buffered',
          detail: '未送達，留在本機緩衝，下一批一起重送',
        });
        return Object.freeze({
          outcome: 'buffered' as const,
          httpStatus: response.status,
          sampleCount: batch.data.length,
          bufferedSampleCount: this.buffered.length,
        });
      }
      this.record({
        kind: 'upload',
        attemptedAtMs: this.now(),
        sampleCount: batch.data.length,
        httpStatus: response.status,
        outcome: 'ok',
        detail: '平台已接收（不等於已持久化）',
      });
    }

    return Object.freeze({
      outcome: 'ok' as const,
      httpStatus: lastStatus,
      sampleCount: pending.data.length,
      bufferedSampleCount: 0,
    });
  }
}

/** The documented read-back chain, as URLs. Walking it is the only evidence. */
export function buildSixActsReadBackUrls(options: {
  readonly apiBase?: string;
  readonly account: string;
  readonly areaId: string;
  readonly groupId: string;
  readonly sensorType: string;
  readonly sensorId: string;
  readonly fromMs: number;
  readonly toMs: number;
}): readonly string[] {
  const base = (options.apiBase ?? SIX_ACTS_PLATFORM_API_BASE).replace(/\/+$/, '');
  return Object.freeze([
    `${base}/area/${options.account}`,
    `${base}/sensorgroup_in_area/${options.areaId}`,
    `${base}/sensors_in_group/${options.groupId}`,
    `${base}/sensors_in_timeinterval/${options.sensorType}/${options.sensorId}/${options.fromMs}/${options.toMs}`,
  ]);
}
