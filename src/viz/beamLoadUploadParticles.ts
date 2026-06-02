export const UPLOAD_PARTICLES_DEFAULT = 96;
export const UPLOAD_PARTICLES_PER_CONE_HARD_CAP = 128;
export const UPLOAD_PARTICLES_GLOBAL_CAP = 256;
export const MAX_FOCUS_CONES = 2;
export const UPLOAD_PARTICLES_MIN_FLOOR = 24;
export const UPLOAD_PARTICLE_CYCLE_SEC = 2.1;

export function resolveUploadParticleConeCount(focusConeCount: number): number {
  if (!Number.isFinite(focusConeCount) || focusConeCount <= 0) return 0;
  return Math.min(MAX_FOCUS_CONES, Math.floor(focusConeCount));
}

export function resolveUploadParticleCountForLoad(normalizedLoad: number): number {
  const loadFactor = 0.5 + clamp01(normalizedLoad);
  const requestedCount = Math.round(UPLOAD_PARTICLES_DEFAULT * loadFactor);
  return clampInteger(
    requestedCount,
    UPLOAD_PARTICLES_MIN_FLOOR,
    UPLOAD_PARTICLES_PER_CONE_HARD_CAP,
  );
}

export function resolveUploadParticleGlobalCount(perConeCounts: readonly number[]): number {
  const total = perConeCounts.reduce(
    (sum, count) => sum + Math.max(0, Math.floor(Number.isFinite(count) ? count : 0)),
    0,
  );
  const cappedTotal = Math.min(UPLOAD_PARTICLES_GLOBAL_CAP, total);
  assertUploadParticleGlobalInvariant(cappedTotal);
  return cappedTotal;
}

export function resolveUploadParticleEnabledCount(input: {
  readonly enabled?: boolean;
  readonly paused?: boolean;
  readonly reducedMotion?: boolean;
  readonly count: number;
}): number {
  if (input.enabled === false || input.paused || input.reducedMotion) return 0;
  return Math.max(0, Math.floor(Number.isFinite(input.count) ? input.count : 0));
}

export function normalizeUploadParticleProgress(elapsedSec: number, phaseOffset: number): number {
  const raw = elapsedSec / UPLOAD_PARTICLE_CYCLE_SEC + phaseOffset;
  return ((raw % 1) + 1) % 1;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function assertUploadParticleGlobalInvariant(total: number): void {
  if (total > UPLOAD_PARTICLES_GLOBAL_CAP) {
    throw new Error(`upload particle global cap exceeded: ${total}`);
  }
}
