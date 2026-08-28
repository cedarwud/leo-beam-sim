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
