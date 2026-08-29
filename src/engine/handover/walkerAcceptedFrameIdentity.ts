export interface WalkerAcceptedFrameIdentity {
  readonly sourceFrameId: string;
  readonly epochToken: string;
  readonly epochUtcMs: number;
  readonly replayOffsetMs: number;
  readonly absoluteUtcMs: number;
}

function safeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer`);
  }
  return value;
}

/**
 * Build the single scientific identity for one accepted Walker candidate frame.
 * Runtime replay seconds are quantized once to the nearest integer millisecond;
 * every downstream source-frame join and forecast anchor reuses this identity.
 */
export function createWalkerAcceptedFrameIdentity(
  epochUtcMsInput: number,
  replayOffsetSec: number,
): WalkerAcceptedFrameIdentity {
  const epochUtcMs = safeNonNegativeInteger(epochUtcMsInput, 'epochUtcMs');
  if (!Number.isFinite(replayOffsetSec) || replayOffsetSec < 0) {
    throw new RangeError('replayOffsetSec must be finite and non-negative');
  }
  const replayOffsetMs = safeNonNegativeInteger(
    Math.round(replayOffsetSec * 1_000),
    'replayOffsetMs',
  );
  const absoluteUtcMs = safeNonNegativeInteger(
    epochUtcMs + replayOffsetMs,
    'absoluteUtcMs',
  );
  const epochToken = `walker:${epochUtcMs}`;
  return Object.freeze({
    sourceFrameId: `${epochToken}:${absoluteUtcMs}`,
    epochToken,
    epochUtcMs,
    replayOffsetMs,
    absoluteUtcMs,
  });
}
