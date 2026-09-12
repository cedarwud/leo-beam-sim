import type { HandoverStoryFrameSource } from '../handoverStoryFrame';
import type {
  HandoverSurfaceBinding,
  HandoverSurfaceKind,
} from './contracts';

export interface HandoverSurfaceIdentityAttributes {
  readonly 'data-handover-surface': HandoverSurfaceKind;
  readonly 'data-handover-surface-binding': 'bound' | 'none';
  readonly 'data-handover-surface-active-source': HandoverStoryFrameSource;
  readonly 'data-handover-surface-story-source': string;
  readonly 'data-handover-surface-story-id': string;
  readonly 'data-handover-surface-story-pair-key': string;
  readonly 'data-handover-surface-story-kind': string;
  readonly 'data-handover-surface-story-phase': string;
  readonly 'data-handover-surface-story-committed': string;
  readonly 'data-handover-surface-story-producer': string;
  readonly 'data-handover-surface-story-claim-class': string;
  readonly 'data-handover-surface-story-decision-evidence': string;
  readonly 'data-handover-surface-story-disclosure': string;
  readonly 'data-handover-surface-story-decision-input-allowed': string;
  readonly 'data-handover-surface-story-snapshot-id': string;
  readonly 'data-handover-surface-story-episode-id': string;
  readonly 'data-handover-surface-story-source-frame-id': string;
  readonly 'data-handover-surface-story-clock-basis': string;
  readonly 'data-handover-surface-story-clock-current-sec': string;
  readonly 'data-handover-surface-story-clock-duration-sec': string;
  readonly 'data-handover-surface-story-identity': string;
}

export function handoverSurfaceIdentityAttributes(
  surface: HandoverSurfaceKind,
  binding: HandoverSurfaceBinding | null,
  activeSource: HandoverStoryFrameSource = binding?.source ?? 'none',
): HandoverSurfaceIdentityAttributes {
  const frame = binding?.frame ?? null;
  return {
    'data-handover-surface': surface,
    'data-handover-surface-binding': binding === null ? 'none' : 'bound',
    'data-handover-surface-active-source': activeSource,
    'data-handover-surface-story-source': binding?.source ?? '',
    'data-handover-surface-story-id': binding?.identity.storyId ?? '',
    'data-handover-surface-story-pair-key': binding?.identity.pairKey ?? '',
    'data-handover-surface-story-kind': binding?.identity.kind ?? '',
    'data-handover-surface-story-phase': binding?.identity.phase ?? '',
    'data-handover-surface-story-committed': binding === null
      ? ''
      : binding.identity.committed ? 'true' : 'false',
    'data-handover-surface-story-producer': binding?.identity.producer ?? '',
    'data-handover-surface-story-claim-class': binding?.identity.claimClass ?? '',
    'data-handover-surface-story-decision-evidence': binding?.identity.decisionEvidence ?? '',
    'data-handover-surface-story-disclosure': binding?.identity.disclosure ?? '',
    'data-handover-surface-story-decision-input-allowed': frame === null ? '' : 'false',
    'data-handover-surface-story-snapshot-id': binding?.identity.snapshotId ?? '',
    'data-handover-surface-story-episode-id': binding?.identity.episodeId ?? '',
    'data-handover-surface-story-source-frame-id': binding?.identity.sourceFrameId ?? '',
    'data-handover-surface-story-clock-basis': binding?.identity.clockBasis ?? '',
    'data-handover-surface-story-clock-current-sec': frame === null
      ? ''
      : String(frame.clock.currentSec),
    'data-handover-surface-story-clock-duration-sec': frame === null
      || frame.clock.durationSec === null
      ? ''
      : String(frame.clock.durationSec),
    'data-handover-surface-story-identity': binding?.identityKey ?? '',
  };
}
