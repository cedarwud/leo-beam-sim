import {
  buildHandoverTeachingScript,
  type TeachingFrame,
  type TeachingHandoverKind,
} from '../homepage/teaching/handoverTeachingScript';
import type { HandoverStoryPhase } from './handoverStoryFrame';
import {
  resolveTeachingHandoverSurfaceStatus,
  type HandoverSurfaceBinding,
} from './handoverSurfaceBinding';

/** Display-only retirement timing retained from the existing teaching cones. */
const COMMITTED_HOLD_SEC = 2;
const COMMITTED_RETIRE_FADE_SEC = 4;
const CLOCK_EPSILON_SEC = 0.001;
const committedAtSecByKind = new Map<TeachingHandoverKind, number>();

export interface HandoverTeachingSurfaceProjection {
  /** Exact shell-owned normalized story binding. */
  readonly binding: HandoverSurfaceBinding;
  /** Exact authored frame used by rail, caption and scene paint values. */
  readonly frame: TeachingFrame;
  readonly kind: TeachingHandoverKind;
  readonly targetIntroduced: boolean;
  readonly sourceRetirementMultiplier: number;
}

function storyPhase(frame: TeachingFrame): HandoverStoryPhase {
  switch (frame.phase.id) {
    case 'serving': return 'serving';
    case 'candidate': return 'measuring';
    case 'countdown': return 'holding';
    case 'switching': return 'switching';
    case 'settled': return 'settled';
  }
}

function committedAtSec(kind: TeachingHandoverKind): number {
  const cached = committedAtSecByKind.get(kind);
  if (cached !== undefined) return cached;
  const script = buildHandoverTeachingScript(kind);
  let phaseStartSec = 0;
  let resolved = 0;
  for (const phase of script.phases) {
    if (phase.id === 'switching') {
      resolved = phaseStartSec + 0.5 * phase.durationSec;
      break;
    }
    phaseStartSec += phase.durationSec;
  }
  committedAtSecByKind.set(kind, resolved);
  return resolved;
}

function finiteEquals(left: number | null, right: number): boolean {
  return left !== null
    && Number.isFinite(left)
    && Math.abs(left - right) < CLOCK_EPSILON_SEC;
}

function linkMatches(
  endpoint: HandoverSurfaceBinding['frame']['from'],
  link: TeachingFrame['serving'],
): boolean {
  return endpoint.satelliteLabel === link.satelliteLabel
    && endpoint.beamLabel === link.beamLabel
    && endpoint.ee?.status === 'authored'
    && endpoint.ee.provenance === 'authored-teaching'
    && endpoint.ee.unit === 'Kbit/J'
    && finiteEquals(endpoint.ee.value, link.eeKbitPerJoule)
    && finiteEquals(endpoint.elevationDeg, link.elevationDeg);
}

function retirementMultiplier(
  binding: HandoverSurfaceBinding,
  kind: TeachingHandoverKind,
): number {
  if (!binding.frame.committed) return 1;
  const heldSec = binding.frame.clock.currentSec
    - committedAtSec(kind)
    - COMMITTED_HOLD_SEC;
  if (heldSec <= 0) return 1;
  return Math.max(0, 1 - heldSec / COMMITTED_RETIRE_FADE_SEC);
}

/**
 * Compose the one authored projection consumed by scene, rail and caption.
 * A mismatch fails closed; no renderer is permitted to repair or reinterpret
 * source/target, winner, phase or provenance locally.
 */
export function resolveHandoverTeachingSurfaceProjection(
  binding: HandoverSurfaceBinding | null,
  frame: TeachingFrame | null,
  kind: TeachingHandoverKind | null,
): HandoverTeachingSurfaceProjection | null {
  if (binding === null || frame === null || kind === null) return null;
  const phase = storyPhase(frame);
  const status = resolveTeachingHandoverSurfaceStatus(binding, {
    kind,
    phase,
    committed: frame.committed,
    currentSec: frame.elapsedSec,
    durationSec: frame.totalSec,
  });
  if (status !== 'matched') return null;
  if (!linkMatches(binding.frame.from, frame.serving)
    || !linkMatches(binding.frame.to, frame.winner)) return null;

  return Object.freeze({
    binding,
    frame,
    kind,
    targetIntroduced: binding.frame.phase !== 'serving',
    sourceRetirementMultiplier: retirementMultiplier(binding, kind),
  });
}
