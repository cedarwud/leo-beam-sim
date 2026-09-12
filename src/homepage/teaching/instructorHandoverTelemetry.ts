import type { HandoverSurfaceBinding } from '../../scene/handoverSurfaceBinding';
import type { InstructorHandoverTransportSnapshot } from './instructorHandoverTransport';

export type InstructorHandoverTelemetrySurface = 'root' | 'scene' | 'rail' | 'caption';

export interface InstructorHandoverTelemetryAttributes {
  readonly 'data-instructor-surface': InstructorHandoverTelemetrySurface;
  readonly 'data-instructor-scenario-binding': 'active' | 'none';
  readonly 'data-instructor-scenario-id': string;
  readonly 'data-instructor-scenario-version': string;
  readonly 'data-instructor-beam-count': string;
  readonly 'data-instructor-run-id': string;
  readonly 'data-instructor-entry-kind': string;
  readonly 'data-instructor-segment-index': string;
  readonly 'data-instructor-segment-kind': string;
  readonly 'data-instructor-transport-status': string;
  readonly 'data-instructor-paused': string;
  readonly 'data-instructor-speed': string;
  readonly 'data-instructor-source-time-sec': string;
  readonly 'data-instructor-segment-time-sec': string;
  readonly 'data-instructor-duration-sec': string;
  readonly 'data-instructor-window-start-sec': string;
  readonly 'data-instructor-window-end-sec': string;
  readonly 'data-instructor-complete': string;
  readonly 'data-instructor-story-id': string;
  readonly 'data-instructor-story-pair-key': string;
  readonly 'data-instructor-story-phase': string;
  readonly 'data-instructor-story-committed': string;
}

export function instructorHandoverTelemetryAttributes(
  surface: InstructorHandoverTelemetrySurface,
  transport: InstructorHandoverTransportSnapshot | null,
  binding: HandoverSurfaceBinding | null,
): InstructorHandoverTelemetryAttributes {
  if (transport === null) {
    return {
      'data-instructor-surface': surface,
      'data-instructor-scenario-binding': 'none',
      'data-instructor-scenario-id': '',
      'data-instructor-scenario-version': '',
      'data-instructor-beam-count': '',
      'data-instructor-run-id': '',
      'data-instructor-entry-kind': '',
      'data-instructor-segment-index': '',
      'data-instructor-segment-kind': '',
      'data-instructor-transport-status': '',
      'data-instructor-paused': '',
      'data-instructor-speed': '',
      'data-instructor-source-time-sec': '',
      'data-instructor-segment-time-sec': '',
      'data-instructor-duration-sec': '',
      'data-instructor-window-start-sec': '',
      'data-instructor-window-end-sec': '',
      'data-instructor-complete': '',
      'data-instructor-story-id': '',
      'data-instructor-story-pair-key': '',
      'data-instructor-story-phase': '',
      'data-instructor-story-committed': '',
    };
  }
  return {
    'data-instructor-surface': surface,
    'data-instructor-scenario-binding': 'active',
    'data-instructor-scenario-id': transport.scenarioId,
    'data-instructor-scenario-version': String(transport.scenarioVersion),
    'data-instructor-beam-count': String(transport.beamCount),
    'data-instructor-run-id': String(transport.runId),
    'data-instructor-entry-kind': transport.entryKind,
    'data-instructor-segment-index': String(transport.segment.index),
    'data-instructor-segment-kind': transport.segment.kind,
    'data-instructor-transport-status': transport.status,
    'data-instructor-paused': transport.paused ? 'true' : 'false',
    'data-instructor-speed': String(transport.speed),
    'data-instructor-source-time-sec': String(transport.sourceTimeSec),
    'data-instructor-segment-time-sec': String(transport.segmentTimeSec),
    'data-instructor-duration-sec': String(transport.windowDurationSec),
    'data-instructor-window-start-sec': String(transport.windowStartSec),
    'data-instructor-window-end-sec': String(transport.windowEndSec),
    'data-instructor-complete': transport.complete ? 'true' : 'false',
    'data-instructor-story-id': binding?.identity.storyId ?? '',
    'data-instructor-story-pair-key': binding?.identity.pairKey ?? '',
    'data-instructor-story-phase': binding?.identity.phase ?? '',
    'data-instructor-story-committed': binding === null
      ? ''
      : binding.identity.committed ? 'true' : 'false',
  };
}
