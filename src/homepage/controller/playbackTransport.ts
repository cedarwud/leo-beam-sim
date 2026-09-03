import {
  resolveEffectivePlaybackSpeed,
  type EffectivePlaybackSpeedInput,
} from '../../usePlaybackControls';
import type {
  HomepagePlaybackCommand,
  HomepagePlaybackTransportState,
} from './contracts';

/**
 * The homepage transport owns user intent, not simulation truth.
 *
 * `selectedSpeed` is the value chosen in the timeline. `effectiveSpeed` is
 * derived from that value and the presentation-owner signals supplied by the
 * caller. Keeping the resolver injectable makes the seam testable while the
 * default remains the existing application policy.
 */
export interface HomepagePlaybackTransportSpeedContext {
  readonly directorSlowActive: boolean;
  readonly candidateComparisonSlowActive: boolean;
  readonly autoSlowApplied: boolean;
}

export type HomepagePlaybackSpeedResolver = (
  input: EffectivePlaybackSpeedInput,
) => number;

export interface HomepagePlaybackTransportSeed {
  readonly paused?: boolean;
  readonly selectedSpeed?: number;
}

/**
 * A transition carries a seek request separately because this boundary must
 * not own `simTimeSec` or decide how a source frame is rebuilt after seeking.
 */
export interface HomepagePlaybackTransportTransition {
  readonly state: HomepagePlaybackTransportState;
  readonly seekTargetSec: number | null;
}

const DEFAULT_SELECTED_SPEED = 1;
const DEFAULT_SPEED_CONTEXT: HomepagePlaybackTransportSpeedContext = {
  directorSlowActive: false,
  candidateComparisonSlowActive: false,
  autoSlowApplied: false,
};

function toResolverInput(
  selectedSpeed: number,
  context: HomepagePlaybackTransportSpeedContext,
): EffectivePlaybackSpeedInput {
  return {
    speed: selectedSpeed,
    directorSlowActive: context.directorSlowActive,
    candidateComparisonSlowActive: context.candidateComparisonSlowActive,
    autoSlowApplied: context.autoSlowApplied,
  };
}

export function deriveHomepagePlaybackTransportState(
  input: Pick<HomepagePlaybackTransportState, 'paused' | 'selectedSpeed'>,
  context: HomepagePlaybackTransportSpeedContext = DEFAULT_SPEED_CONTEXT,
  resolveSpeed: HomepagePlaybackSpeedResolver = resolveEffectivePlaybackSpeed,
): HomepagePlaybackTransportState {
  return Object.freeze({
    paused: input.paused,
    selectedSpeed: input.selectedSpeed,
    effectiveSpeed: resolveSpeed(toResolverInput(input.selectedSpeed, context)),
  });
}

export function createHomepagePlaybackTransportState(
  seed: HomepagePlaybackTransportSeed = {},
  context: HomepagePlaybackTransportSpeedContext = DEFAULT_SPEED_CONTEXT,
  resolveSpeed: HomepagePlaybackSpeedResolver = resolveEffectivePlaybackSpeed,
): HomepagePlaybackTransportState {
  return deriveHomepagePlaybackTransportState(
    {
      paused: seed.paused ?? false,
      selectedSpeed: seed.selectedSpeed ?? DEFAULT_SELECTED_SPEED,
    },
    context,
    resolveSpeed,
  );
}

/**
 * Apply one user transport command without advancing or seeking the runtime.
 * The integration owner forwards `seekTargetSec` to the canonical simulator
 * seek path and supplies the current presentation slow-mo signals on each
 * derivation/reduction.
 */
export function reduceHomepagePlaybackTransport(
  state: HomepagePlaybackTransportState,
  command: HomepagePlaybackCommand,
  context: HomepagePlaybackTransportSpeedContext = DEFAULT_SPEED_CONTEXT,
  resolveSpeed: HomepagePlaybackSpeedResolver = resolveEffectivePlaybackSpeed,
): HomepagePlaybackTransportTransition {
  let paused = state.paused;
  let selectedSpeed = state.selectedSpeed;
  let seekTargetSec: number | null = null;

  switch (command.type) {
    case 'play':
      paused = false;
      break;
    case 'pause':
      paused = true;
      break;
    case 'toggle':
      paused = !paused;
      break;
    case 'seek':
      // Seeking is an intent only. The simulator/source adapter owns time.
      seekTargetSec = command.targetSec;
      break;
    case 'set-speed':
      selectedSpeed = command.speed;
      break;
  }

  return Object.freeze({
    state: deriveHomepagePlaybackTransportState(
      { paused, selectedSpeed },
      context,
      resolveSpeed,
    ),
    seekTargetSec,
  });
}

