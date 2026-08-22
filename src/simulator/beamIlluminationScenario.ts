import {
  assertSupportedBeamLayoutCount,
  type SupportedBeamLayoutCount,
} from '../core/beam/completeHexPresets';

/** Scenario policy only; this is not a thesis algorithm or an operational schedule. */
export type SimulatorBeamIlluminationMode = 'fixed' | 'beam-hopping';

export const DEFAULT_SIMULATOR_BEAM_ILLUMINATION_MODE: SimulatorBeamIlluminationMode = 'fixed';

/**
 * Named project policy used by the Visual Lab Beam-Hopping experiment.
 *
 * Fixed illumination admits the complete selected layout. Beam Hopping admits
 * half of the layout (rounded up) and advances that window deterministically
 * at each accepted 30-second anchor. The explicit revision prevents this
 * teaching policy from being confused with an operator policy.
 */
export const VISUAL_LAB_BEAM_ILLUMINATION_POLICY_REVISION =
  'visual-lab-half-layout-round-robin-v1' as const;

export function assertSimulatorBeamIlluminationMode(
  value: unknown,
): SimulatorBeamIlluminationMode {
  if (value !== 'fixed' && value !== 'beam-hopping') {
    throw new RangeError(`beamIlluminationMode must be fixed or beam-hopping; got ${String(value)}`);
  }
  return value;
}

export function eligibleBeamCountForVisualLabScenario(
  beamCount: SupportedBeamLayoutCount,
  mode: SimulatorBeamIlluminationMode,
): number {
  const count = assertSupportedBeamLayoutCount(beamCount);
  assertSimulatorBeamIlluminationMode(mode);
  return mode === 'fixed' ? count : Math.ceil(count / 2);
}

export function eligibleBeamIdsForVisualLabScenario(
  beamCount: SupportedBeamLayoutCount,
  mode: SimulatorBeamIlluminationMode,
  slotIndex: number,
): readonly number[] {
  const count = assertSupportedBeamLayoutCount(beamCount);
  assertSimulatorBeamIlluminationMode(mode);
  if (!Number.isSafeInteger(slotIndex) || slotIndex < 0) {
    throw new RangeError('beam illumination slotIndex must be a non-negative integer');
  }
  const eligibleCount = eligibleBeamCountForVisualLabScenario(count, mode);
  if (mode === 'fixed') {
    return Object.freeze(Array.from({ length: count }, (_unused, beamId) => beamId));
  }
  const startIndex = ((slotIndex % count) * eligibleCount) % count;
  return Object.freeze(Array.from(
    { length: eligibleCount },
    (_unused, offset) => (startIndex + offset) % count,
  ));
}
