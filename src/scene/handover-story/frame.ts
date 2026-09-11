import type {
  HandoverStoryEndpoint,
  HandoverStoryFrame,
  HandoverStoryGeometryStatus,
} from './contracts';
import { HANDOVER_STORY_FRAME_SCHEMA_VERSION } from './contracts';

export function clampStoryProgress(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

export function finiteStoryNumber(
  value: number | null | undefined,
): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function validStoryIndex(
  value: number | null | undefined,
): number | null {
  return Number.isInteger(value) && (value ?? -1) >= 0 ? value! : null;
}

export function storyBeamToken(
  value: string | number | null | undefined,
): string | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? String(value) : null;
  }
  return nonEmptyStoryToken(value) ? value : null;
}

export function storyGeometryStatus(
  drawable: boolean | undefined,
): HandoverStoryGeometryStatus {
  return drawable === undefined
    ? 'unchecked'
    : drawable ? 'drawable' : 'not-drawable';
}

export function nonEmptyStoryToken(
  value: string | null | undefined,
): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function endpointIdentityToken(endpoint: HandoverStoryEndpoint): string | null {
  return endpoint.beamId ?? endpoint.beamLabel;
}

function sameEndpointIdentity(
  left: HandoverStoryEndpoint,
  right: HandoverStoryEndpoint,
): boolean {
  return left.satelliteId === right.satelliteId
    && left.cellId === right.cellId
    && endpointIdentityToken(left) === endpointIdentityToken(right);
}

export function validateHandoverStoryFrame(frame: HandoverStoryFrame): void {
  if (frame.schemaVersion !== HANDOVER_STORY_FRAME_SCHEMA_VERSION) {
    throw new TypeError('handover story frame schema version is invalid');
  }
  if (!nonEmptyStoryToken(frame.storyId)) {
    throw new TypeError('handover story id must be non-empty');
  }
  if (!nonEmptyStoryToken(frame.from.satelliteId)
    || !nonEmptyStoryToken(frame.to.satelliteId)) {
    throw new TypeError('handover story endpoints require satellite identities');
  }
  if (frame.kind === 'inter' && frame.from.satelliteId === frame.to.satelliteId) {
    throw new TypeError('inter handover story requires different satellites');
  }
  if (frame.kind === 'intra' && frame.from.satelliteId !== frame.to.satelliteId) {
    throw new TypeError('intra handover story requires one satellite');
  }
  if (sameEndpointIdentity(frame.from, frame.to)) {
    throw new TypeError('handover story source and target identities must differ');
  }
  if (frame.progress01 !== null
    && (!Number.isFinite(frame.progress01)
      || frame.progress01 < 0
      || frame.progress01 > 1)) {
    throw new TypeError('handover story progress must be null or within 0..1');
  }
  if (!Number.isFinite(frame.clock.currentSec) || frame.clock.currentSec < 0) {
    throw new TypeError('handover story clock currentSec must be finite and non-negative');
  }
  if (frame.clock.durationSec !== null
    && (!Number.isFinite(frame.clock.durationSec) || frame.clock.durationSec <= 0)) {
    throw new TypeError('handover story clock durationSec must be null or positive');
  }
  if (frame.clock.sourceTimeSec !== null
    && (!Number.isFinite(frame.clock.sourceTimeSec) || frame.clock.sourceTimeSec < 0)) {
    throw new TypeError('handover story clock sourceTimeSec must be null or non-negative');
  }
  if (frame.provenance.decisionInputAllowed !== false) {
    throw new TypeError('handover story frames must never be decision inputs');
  }

  for (const endpoint of [frame.from, frame.to]) {
    for (const metric of [endpoint.ee, endpoint.sinr]) {
      if (metric === null) continue;
      if (!nonEmptyStoryToken(metric.unit)) {
        throw new TypeError('handover story metric unit must be non-empty');
      }
      if (metric.value !== null && !Number.isFinite(metric.value)) {
        throw new TypeError('handover story metric value must be null or finite');
      }
      if ((metric.status === 'available' || metric.status === 'authored')
        && metric.value === null) {
        throw new TypeError('available or authored handover metric requires a finite value');
      }
    }
  }

  if (frame.provenance.claimClass === 'authored-teaching') {
    if (frame.provenance.producer !== 'teaching'
      || frame.provenance.decisionEvidence !== 'none'
      || frame.provenance.snapshotId !== null
      || frame.provenance.sourceFrameId !== null) {
      throw new TypeError('authored teaching cannot claim accepted decision evidence');
    }
    for (const metric of [frame.from.ee, frame.to.ee]) {
      if (metric?.provenance !== 'authored-teaching' || metric.status !== 'authored') {
        throw new TypeError('teaching EE values must remain explicitly authored');
      }
    }
  }

  if (frame.provenance.claimClass === 'accepted-decision') {
    if ((frame.provenance.producer !== 'walker' && frame.provenance.producer !== 'tle')
      || frame.provenance.decisionEvidence !== 'accepted'
      || !nonEmptyStoryToken(frame.provenance.snapshotId)
      || !nonEmptyStoryToken(frame.provenance.episodeId)
      || !nonEmptyStoryToken(frame.provenance.sourceFrameId)) {
      throw new TypeError('accepted story provenance must retain accepted frame identity');
    }
  }

  if (frame.provenance.claimClass === 'recorded-replay') {
    if (frame.provenance.producer !== 'artifact-replay'
      || frame.provenance.decisionEvidence !== 'none'
      || frame.provenance.snapshotId !== null
      || frame.provenance.sourceFrameId !== null) {
      throw new TypeError('recorded replay cannot claim accepted decision evidence');
    }
  }
}

function freezeEndpoint(input: HandoverStoryEndpoint): HandoverStoryEndpoint {
  return Object.freeze({
    ...input,
    ee: input.ee === null ? null : Object.freeze({ ...input.ee }),
    sinr: input.sinr === null ? null : Object.freeze({ ...input.sinr }),
  });
}

export function freezeHandoverStoryFrame(
  frame: HandoverStoryFrame,
): HandoverStoryFrame {
  validateHandoverStoryFrame(frame);
  return Object.freeze({
    ...frame,
    from: freezeEndpoint(frame.from),
    to: freezeEndpoint(frame.to),
    provenance: Object.freeze({ ...frame.provenance }),
    clock: Object.freeze({ ...frame.clock }),
  });
}

/** Stable source/target identity for joins that must not depend on rank or phase. */
export function handoverStoryPairKey(frame: HandoverStoryFrame): string {
  const endpoint = (value: HandoverStoryEndpoint): string => [
    value.satelliteId,
    value.beamId ?? value.beamLabel ?? '-',
    value.cellId ?? '-',
  ].join('|');
  return `${frame.kind}:${endpoint(frame.from)}>${endpoint(frame.to)}`;
}
