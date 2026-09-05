import type { AppExperienceMode } from './appExperienceMode';
import type { SceneSourceMode } from './appPersistence';

export type SceneLane =
  | 'sinr-live'
  | 'modqn-live-cell-preview'
  | 'modqn-replay-proof'
  | 'artifact-replay';

export interface SceneLaneInput {
  readonly appMode: AppExperienceMode;
  readonly sceneSource: SceneSourceMode;
  readonly modqnReplayProofRequested?: boolean;
}

export function resolveSceneLane(input: SceneLaneInput): SceneLane {
  if (input.sceneSource === 'artifact-replay') return 'artifact-replay';
  if (input.appMode === 'modqn-demo' && input.modqnReplayProofRequested === true) {
    return 'modqn-replay-proof';
  }
  if (input.appMode === 'modqn-demo') return 'modqn-live-cell-preview';
  return 'sinr-live';
}

export function shouldRenderModqnReplayScene(lane: SceneLane): boolean {
  return lane === 'modqn-replay-proof';
}

/**
 * The multi-candidate decision authority is a homepage Walker feature. The
 * MODQN cell-preview lane may reuse earth-fixed cell geometry, but it must not
 * inherit homepage decision state or replace its existing policy authority.
 */
export function shouldEnableHomepageMultiCandidateAuthority(lane: SceneLane): boolean {
  return lane === 'sinr-live';
}

/**
 * Whether the legacy SINR-only HandoverManager must stop committing once a
 * link exists.
 *
 * The homepage's EE handover authority depends on this being true there: the
 * rail-timeline engine never sees an EE value, so a SINR-only handover from it
 * would fire above the EE floor and contradict the decision the homepage is
 * showing. It must stay false elsewhere, where that engine is still the
 * authority.
 *
 * This is a named function rather than an inline expression at the call site
 * because the invariant reached production as an unnamed positional argument
 * to `useSimulation`, and a repo-wide grep for it found exactly one file: no
 * test, no validator, no golden. Deleting the argument would have silently
 * handed primary handover back to the SINR engine on the homepage.
 */
export function shouldSuppressLegacyPrimaryHandover(
  lane: SceneLane,
  // Optional at the call site (MainScene's prop defaults to undefined), so the
  // undefined -> false narrowing happens here rather than relying on a default
  // parameter several layers away.
  homepageVisualIdentity: boolean | undefined,
): boolean {
  return homepageVisualIdentity === true && lane === 'sinr-live';
}
