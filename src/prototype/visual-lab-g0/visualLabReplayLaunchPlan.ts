import type { VisualLabClipLaunchTarget } from '../../visualLab/clipReplay/types';
import type { VisualLabGuidedReplayId } from '../../visualLab/guidedReplay/types';
import type { VisualLabView } from './VisualLabScene';
import type { VisualLabModuleKey } from './visualLabWorkspace';

interface GuidedVisualLabReplayLaunchPlan {
  readonly runtime: 'guided';
  readonly guidedReplayId: VisualLabGuidedReplayId;
  readonly module: VisualLabModuleKey;
  readonly view: VisualLabView;
  readonly focus: 'handover';
}

interface StoryVisualLabReplayLaunchPlan {
  readonly runtime: 'story';
  readonly module: 'scene';
  readonly view: VisualLabView;
  readonly focus: 'handover';
}

interface CausalVisualLabReplayLaunchPlan {
  readonly runtime: 'causal';
  readonly module: 'sinr' | 'power';
  readonly storyId: 'beamwidth' | 'power-cap';
}

export type VisualLabReplayLaunchPlan =
  | GuidedVisualLabReplayLaunchPlan
  | StoryVisualLabReplayLaunchPlan
  | CausalVisualLabReplayLaunchPlan;

/** Map a published replay target to shell presentation choices. */
export function deriveVisualLabReplayLaunchPlan(
  target: VisualLabClipLaunchTarget,
): VisualLabReplayLaunchPlan {
  if (target.runtime === 'guided') {
    if (target.clipId === 'inter-handover') {
      return Object.freeze({ runtime: 'guided', guidedReplayId: 'inter-handover', module: 'sinr', view: 'service', focus: 'handover' });
    }
    if (target.clipId === 'intra-beam-handover') {
      return Object.freeze({ runtime: 'guided', guidedReplayId: 'intra-beam-handover', module: 'power', view: 'service', focus: 'handover' });
    }
    throw new Error('Unknown guided replay target.');
  }

  if (target.runtime === 'story') {
    return Object.freeze({ runtime: 'story', module: 'scene', view: 'service', focus: 'handover' });
  }

  if (target.runtimeId === 'power-cap') {
    return Object.freeze({ runtime: 'causal', module: 'power', storyId: 'power-cap' });
  }
  if (target.runtimeId === 'beamwidth') {
    return Object.freeze({ runtime: 'causal', module: 'sinr', storyId: 'beamwidth' });
  }
  throw new Error('Unknown causal replay target.');
}
