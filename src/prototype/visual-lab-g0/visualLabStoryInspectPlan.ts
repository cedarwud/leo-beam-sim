import type { VisualLabFocus, VisualLabView } from './VisualLabScene';
import type { VisualLabInspectTarget } from './presentation/visualLabPresentationContract';
import type { VisualLabModuleKey } from './visualLabWorkspace';

export interface VisualLabStoryInspectPlan {
  readonly module: VisualLabModuleKey;
  readonly explicitView: VisualLabView | null;
  readonly focus: Exclude<VisualLabFocus, 'none'>;
}

/** Map a semantic story inspection target to the shell navigation plan. */
export function deriveVisualLabStoryInspectPlan(
  target: VisualLabInspectTarget,
): VisualLabStoryInspectPlan {
  switch (target) {
    case 'scene':
      return Object.freeze({ module: 'scene', explicitView: 'service', focus: 'geometry' });
    case 'handover':
      return Object.freeze({ module: 'scene', explicitView: 'service', focus: 'handover' });
    case 'power':
    case 'energy-efficiency':
      return Object.freeze({ module: 'power', explicitView: null, focus: 'energy' });
    case 'throughput':
      return Object.freeze({ module: 'sinr', explicitView: null, focus: 'handover' });
    case 'sinr':
    case 'figure':
      return Object.freeze({ module: 'sinr', explicitView: null, focus: 'geometry' });
    default: {
      const unreachable: never = target;
      throw new Error(`Unknown visual-lab story inspection target: ${unreachable}`);
    }
  }
}
