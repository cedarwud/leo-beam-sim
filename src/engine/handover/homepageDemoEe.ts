/**
 * Homepage-only EE presentation contract.
 *
 * The canonical angle-aware value is still throughput / frame system power.
 * That denominator changes when the active RF beam set changes, which makes a
 * classroom handover demo jump even when the selected link itself is steady.
 * The homepage therefore uses a deliberately bounded, link-local teaching
 * value for its display and EE handover policy. The raw value remains on the
 * LinkSample for diagnostics and for every non-homepage lane.
 */

import {
  ANGLE_AWARE_FIXED_BASEBAND_POWER_W,
  ANGLE_AWARE_FIXED_RF_CHAIN_POWER_W,
} from '../signal/angle-aware-ee';

export const HOMEPAGE_DEMO_EE_CONFIG = Object.freeze({
  /** Keep the visible demo band away from an unreadable near-zero tail. */
  minimumBitsPerJoule: 80_000,
  /** Keep one unusually good frame from producing a 500+ Kbit/J spike. */
  maximumBitsPerJoule: 180_000,
  /** Seed a newly visible replacement above the default 135 Kbit/J floor. */
  initialBitsPerJoule: 170_000,
  /** Keep the active service visibly ahead of the replacement roster at attach. */
  initialServingBitsPerJoule: 176_000,
  /** Replacement beams start readable but below the active service. */
  initialReplacementBitsPerJoule: 145_000,
  /** Link-local EE reference used to map raw quality into the demo band. */
  referenceLinkEeBitsPerJoule: 600_000,
  /** Maximum visible movement per simulated second. */
  maximumRiseBitsPerJoulePerSec: 6_000,
  maximumFallBitsPerJoulePerSec: 5_000,
  /** Additional first-order damping for gradual orbital decline. */
  timeConstantSec: 8,
  /** A delayed source frame must not turn into a multi-second visual jump. */
  maximumAdvanceSec: 1,
  maximumContinuityGapSec: 30,
  /** Demo calibration: near-horizon elevation must cap the displayed EE. */
  minimumElevationDeg: 15,
  referenceElevationDeg: 70,
  elevationCurveExponent: 2.5,
});

export interface HomepageDemoEeState {
  readonly timeSec: number;
  readonly valueBitsPerJoule: number;
}

/**
 * Stable, deliberately small satellite contrast for the homepage roster.
 *
 * A candidate satellite can be outside the live probe budget while still
 * appearing in the teaching roster. This identity factor keeps its fallback
 * rows distinct without introducing random frame-to-frame noise or changing
 * any handover decision evidence.
 */
export function homepageDemoEeSatelliteFactor(satelliteId: string): number {
  let hash = 2166136261;
  for (const character of satelliteId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return 0.96 + ((hash >>> 0) % 9) * 0.01;
}

function finitePositive(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

/**
 * Convert raw link quality into a bounded teaching value without using the
 * frame-wide active-beam denominator. One beam's fixed overhead is used so
 * adding/removing a neighbouring beam cannot double this value.
 */
export function deriveHomepageDemoEeTarget(input: {
  readonly throughputBps: number;
  readonly beamSupplyPowerW: number;
  /** Same UE-to-satellite elevation used by the raw link budget. */
  readonly elevationDeg?: number;
}): number | null {
  if (!finitePositive(input.throughputBps) || !finitePositive(input.beamSupplyPowerW)) return null;
  const oneBeamPowerW = input.beamSupplyPowerW
    + ANGLE_AWARE_FIXED_RF_CHAIN_POWER_W
    + ANGLE_AWARE_FIXED_BASEBAND_POWER_W;
  const linkLocalEe = input.throughputBps / Math.max(oneBeamPowerW, 1e-30);
  const rawQuality01 = clamp(
    linkLocalEe / HOMEPAGE_DEMO_EE_CONFIG.referenceLinkEeBitsPerJoule,
    0,
    1,
  );
  // Keep the homepage proxy faithful to the same qualitative geometry chain
  // as the raw formula: a low-elevation link may have a transiently favourable
  // power/load denominator, but it must not display as healthier than its
  // elevation supports. Missing elevation remains compatible with older
  // direct callers and falls back to the link-local quality alone.
  const hasElevation = Number.isFinite(input.elevationDeg);
  const elevationQuality01 = hasElevation
    ? Math.pow(
      clamp(
        (input.elevationDeg! - HOMEPAGE_DEMO_EE_CONFIG.minimumElevationDeg)
          / (HOMEPAGE_DEMO_EE_CONFIG.referenceElevationDeg
            - HOMEPAGE_DEMO_EE_CONFIG.minimumElevationDeg),
        0,
        1,
      ),
      HOMEPAGE_DEMO_EE_CONFIG.elevationCurveExponent,
    )
    : rawQuality01;
  // For a shared homepage threshold, beam-local SINR must not be allowed to
  // create orders-of-magnitude gaps between beams that sit under the same
  // satellite/elevation. Let elevation set the common health envelope and
  // retain a small quality contribution for ranking within that envelope.
  // Compress the high end before the final band mapping. The raw link budget
  // is intentionally much wider than the homepage teaching scale; without
  // this compression several good same-satellite beams all hit 180 Kbit/J and
  // the deterministic tie-breaker keeps selecting the first beam.
  // This keeps low-elevation links below the threshold while preventing one
  // active-beam denominator or co-channel sample from collapsing a valid row
  // to ~0 Kbit/J beside a healthy serving row.
  const quality01 = hasElevation
    ? elevationQuality01 * (0.58 + 0.24 * rawQuality01)
    : rawQuality01;
  return HOMEPAGE_DEMO_EE_CONFIG.minimumBitsPerJoule
    + quality01 * (
      HOMEPAGE_DEMO_EE_CONFIG.maximumBitsPerJoule
      - HOMEPAGE_DEMO_EE_CONFIG.minimumBitsPerJoule
    );
}

/** Advance one link's demo EE while retaining a slow, readable trajectory. */
export function advanceHomepageDemoEe(
  previous: HomepageDemoEeState | undefined,
  targetBitsPerJoule: number,
  timeSec: number,
  initialBitsPerJoule: number = HOMEPAGE_DEMO_EE_CONFIG.initialBitsPerJoule,
): HomepageDemoEeState {
  if (!Number.isFinite(targetBitsPerJoule) || !Number.isFinite(timeSec)) {
    return previous ?? { timeSec: 0, valueBitsPerJoule: HOMEPAGE_DEMO_EE_CONFIG.minimumBitsPerJoule };
  }
  if (
    previous === undefined
    || !Number.isFinite(previous.timeSec)
    || !Number.isFinite(previous.valueBitsPerJoule)
    || timeSec < previous.timeSec - 1e-9
  ) {
    return {
      timeSec,
      valueBitsPerJoule: clamp(
        Math.max(targetBitsPerJoule, initialBitsPerJoule),
        HOMEPAGE_DEMO_EE_CONFIG.minimumBitsPerJoule,
        HOMEPAGE_DEMO_EE_CONFIG.maximumBitsPerJoule,
      ),
    };
  }
  if (Math.abs(timeSec - previous.timeSec) <= 1e-9) return previous;

  // Source publication can be throttled or resume after a delayed frame. Use
  // at most one simulated second for one visible update; retain the real
  // timestamp so the next frame cannot accumulate the skipped interval again.
  const deltaSec = Math.min(
    timeSec - previous.timeSec,
    HOMEPAGE_DEMO_EE_CONFIG.maximumAdvanceSec,
  );
  const alpha = 1 - Math.exp(-deltaSec / HOMEPAGE_DEMO_EE_CONFIG.timeConstantSec);
  const dampedTarget = previous.valueBitsPerJoule
    + (targetBitsPerJoule - previous.valueBitsPerJoule) * alpha;
  const maximumDelta = (
    targetBitsPerJoule >= previous.valueBitsPerJoule
      ? HOMEPAGE_DEMO_EE_CONFIG.maximumRiseBitsPerJoulePerSec
      : HOMEPAGE_DEMO_EE_CONFIG.maximumFallBitsPerJoulePerSec
  ) * deltaSec;
  const valueBitsPerJoule = previous.valueBitsPerJoule + clamp(
    dampedTarget - previous.valueBitsPerJoule,
    -maximumDelta,
    maximumDelta,
  );
  return { timeSec, valueBitsPerJoule };
}
