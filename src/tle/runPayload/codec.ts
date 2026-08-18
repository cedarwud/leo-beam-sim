import {
  RUN_PAYLOAD_MESSAGE_TYPES,
  RUN_PAYLOAD_PROTOCOL_SCHEMA,
  type RunPayloadMessage,
  type RunPayloadPhase,
  type RunPayloadResponseMessage,
} from './types';

export class RunPayloadCodecError extends TypeError {
  constructor(message: string) {
    super(`invalid run-payload message: ${message}`);
    this.name = 'RunPayloadCodecError';
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new RunPayloadCodecError(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RunPayloadCodecError(`${label} must be non-empty`);
  }
  return value;
}

function finiteNonNegative(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RunPayloadCodecError(`${label} must be a finite non-negative number`);
  }
  return value;
}

function phase(value: unknown, label: string): RunPayloadPhase {
  const normalized = text(value, label) as RunPayloadPhase;
  const allowed: readonly RunPayloadPhase[] = [
    'snapshot-resolving',
    'coarse-indexing',
    'exact-confirming',
    'pass-indexing',
    'ntpu-canonical-building',
    'payload-packaging',
    'accepted',
    'cancelled',
    'failed',
  ];
  if (!allowed.includes(normalized)) throw new RunPayloadCodecError(`${label} is unsupported`);
  return normalized;
}

function assertJsonSafe(value: unknown, path = 'message'): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (Number.isFinite(value)) return;
    throw new RunPayloadCodecError(`${path} contains a non-finite number`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonSafe(item, `${path}[${index}]`));
    return;
  }
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new RunPayloadCodecError(`${path} contains a non-plain object`);
    }
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      assertJsonSafe(child, `${path}.${key}`);
    }
    return;
  }
  throw new RunPayloadCodecError(`${path} contains a non-serializable value`);
}

function validateIdentity(value: unknown, label: string): void {
  const input = record(value, label);
  text(input.runKey, `${label}.runKey`);
  text(input.passIndexKey, `${label}.passIndexKey`);
  text(input.geometryRunId, `${label}.geometryRunId`);
  text(input.analysisRunId, `${label}.analysisRunId`);
  text(input.sourceSnapshotDigest, `${label}.sourceSnapshotDigest`);
}

function validateMessage(value: unknown): RunPayloadMessage {
  const input = record(value, 'message');
  if (input.protocol !== RUN_PAYLOAD_PROTOCOL_SCHEMA) {
    throw new RunPayloadCodecError('protocol schema mismatch');
  }
  const requestId = text(input.requestId, 'requestId');
  const type = text(input.type, 'type');

  switch (type) {
    case RUN_PAYLOAD_MESSAGE_TYPES.request:
      record(input.request, 'request');
      return input as unknown as RunPayloadMessage;
    case RUN_PAYLOAD_MESSAGE_TYPES.progress: {
      const progressPhase = phase(input.phase, 'phase');
      if (progressPhase === 'accepted' || progressPhase === 'cancelled' || progressPhase === 'failed') {
        throw new RunPayloadCodecError('progress phase is terminal');
      }
      finiteNonNegative(input.completedUnits, 'completedUnits');
      finiteNonNegative(input.totalUnits, 'totalUnits');
      if (input.identity !== undefined) validateIdentity(input.identity, 'identity');
      return input as unknown as RunPayloadMessage;
    }
    case RUN_PAYLOAD_MESSAGE_TYPES.bootstrap:
      validateIdentity(input.identity, 'identity');
      record(input.payload, 'payload');
      return input as unknown as RunPayloadMessage;
    case RUN_PAYLOAD_MESSAGE_TYPES.accepted:
      validateIdentity(input.identity, 'identity');
      record(input.payload, 'payload');
      return input as unknown as RunPayloadMessage;
    case RUN_PAYLOAD_MESSAGE_TYPES.error:
      phase(input.phase, 'phase');
      text(input.code, 'code');
      text(input.message, 'message');
      if (typeof input.retryable !== 'boolean') {
        throw new RunPayloadCodecError('retryable must be boolean');
      }
      if (input.identity !== undefined) validateIdentity(input.identity, 'identity');
      return input as unknown as RunPayloadMessage;
    case RUN_PAYLOAD_MESSAGE_TYPES.cancel:
      if (input.reason !== undefined) text(input.reason, 'reason');
      return input as unknown as RunPayloadMessage;
    default:
      throw new RunPayloadCodecError(`unsupported message type ${type}`);
  }
}

/** Encode a message for JSON HTTP, test fixtures, or a string Worker port. */
export function encodeRunPayloadMessage(message: RunPayloadMessage): string {
  assertJsonSafe(message);
  const encoded = JSON.stringify(message);
  if (encoded === undefined) throw new RunPayloadCodecError('message could not be encoded');
  return encoded;
}

/** Decode either a JSON string or a structured-clone object. */
export function decodeRunPayloadMessage(input: string | unknown): RunPayloadMessage {
  let value: unknown = input;
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input) as unknown;
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'invalid JSON';
      throw new RunPayloadCodecError(detail);
    }
  }
  assertJsonSafe(value);
  return validateMessage(value);
}

/** JSON round-trip used at transport boundaries to catch accidental closures. */
export function roundTripRunPayloadMessage(message: RunPayloadMessage): RunPayloadMessage {
  return decodeRunPayloadMessage(encodeRunPayloadMessage(message));
}

export function isRunPayloadResponseMessage(
  message: RunPayloadMessage,
): message is RunPayloadResponseMessage {
  return message.type !== RUN_PAYLOAD_MESSAGE_TYPES.request
    && message.type !== RUN_PAYLOAD_MESSAGE_TYPES.cancel;
}
