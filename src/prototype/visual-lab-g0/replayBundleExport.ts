import type {
  VisualLabCausalParameterChange,
} from '../../visualLab/causalReplay';
import {
  downloadVisualLabClipArchive,
  prepareVisualLabClipArchive,
  type ClipArchiveBrowserPrimitives,
  type ClipArchiveWriteResult,
  type VisualLabClipArchive,
} from '../../visualLab/export';
import type { ComparisonEvidence } from '../../visualLab/comparison';
import type {
  VisualLabReplayStoryDescriptor,
} from './presentation/visualLabPresentationContract';
import type {
  CanvasWebmCaptureResult,
  CanvasWebmProvenanceIdentity,
} from '../../visualLab/export/clipCapture';

export type VisualLabReplayRuntime = 'story' | 'guided' | 'causal';

export interface VisualLabReplayAcceptedIdentity {
  readonly analysisRunId: string;
  readonly frameId: string;
  readonly constellation: string;
  readonly selectedTlePath: string;
}

export interface VisualLabReplayComparisonInput {
  readonly baseline: Pick<ComparisonEvidence, 'interval' | 'frameId'> | null;
  readonly candidate: Pick<ComparisonEvidence, 'interval' | 'frameId'> | null;
  readonly parameterChange: VisualLabCausalParameterChange | null;
  readonly classification: string | null;
  readonly frameGate: string;
  readonly evaluationGate: string;
}

export interface VisualLabReplayGuidedInput {
  readonly baselineStoryRuntimeId: string | null;
  readonly candidateStoryRuntimeId: string | null;
  readonly annotationMode: string;
}

export interface VisualLabReplayProvenanceInput {
  readonly accepted: VisualLabReplayAcceptedIdentity;
  readonly storyId: string;
  readonly runtime: VisualLabReplayRuntime;
  readonly activeStoryId: string | null;
  readonly storySource: VisualLabReplayStoryDescriptor['source'] | null;
  readonly comparison: VisualLabReplayComparisonInput;
  readonly guided: VisualLabReplayGuidedInput | null;
}

export interface VisualLabReplayBundleInput {
  readonly capture: CanvasWebmCaptureResult;
  readonly clipId: string;
  readonly title: string;
  readonly locale: string;
  readonly theme: string;
  readonly claimBoundary: string;
  readonly sourceLocators: readonly string[];
}

export interface VisualLabReplayDownloadInput extends VisualLabReplayBundleInput {
  readonly primitives?: ClipArchiveBrowserPrimitives;
}

const RUNTIME_LABEL: Readonly<Record<VisualLabReplayRuntime, string>> = Object.freeze({
  story: 'visual-lab-story-runtime-v1',
  guided: 'visual-lab-guided-replay-v1',
  causal: 'visual-lab-causal-replay-v1',
});

const IDENTITY_SCOPE: Readonly<Record<VisualLabReplayRuntime, string>> = Object.freeze({
  story: 'accepted-story-anchors',
  guided: 'controlled-a-b-with-accepted-handover-sequence',
  causal: 'controlled-a-b-sequence',
});

function required(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`replay provenance.${label} must be non-empty text`);
  }
  return value;
}

function add(values: Record<string, string>, key: string, value: string | number | null | undefined): void {
  if (value === null || value === undefined) return;
  values[key] = required(String(value), key);
}

/**
 * Project replay metadata from explicit accepted/read-model inputs.  This is
 * the data-contract seam formerly hidden inside the React capture handler.
 */
export function buildVisualLabReplayProvenance(
  input: VisualLabReplayProvenanceInput,
): CanvasWebmProvenanceIdentity {
  const runtime = RUNTIME_LABEL[input.runtime];
  const identityScope = IDENTITY_SCOPE[input.runtime];
  if (runtime === undefined || identityScope === undefined) {
    throw new Error(`unsupported replay runtime: ${String(input.runtime)}`);
  }
  const values: Record<string, string> = {
    analysisRunId: required(input.accepted.analysisRunId, 'analysisRunId'),
    frame: required(input.accepted.frameId, 'frame'),
    story: required(input.storyId, 'story'),
    runtime,
    identityScope,
    constellation: required(input.accepted.constellation, 'constellation'),
    source: required(input.accepted.selectedTlePath, 'source'),
  };

  if ((input.runtime === 'story' || input.runtime === 'guided') && input.activeStoryId !== null) {
    add(values, 'runtimeStoryId', input.activeStoryId);
  }

  const source = input.storySource;
  if ((input.runtime === 'story' || input.runtime === 'guided') && source?.kind === 'inter-handover' && source.eventId !== null) {
    add(values, 'handoverKind', 'inter-handover');
    add(values, 'eventId', source.eventId);
    add(values, 'fromSatelliteId', source.fromSatelliteId ?? 'unavailable');
    add(values, 'toSatelliteId', source.toSatelliteId ?? 'unavailable');
  }
  if ((input.runtime === 'story' || input.runtime === 'guided') && source?.kind === 'intra-handover' && source.traceId !== null) {
    add(values, 'handoverKind', 'intra-handover');
    add(values, 'traceId', source.traceId);
    add(values, 'userId', source.from?.userId ?? 'unavailable');
    add(values, 'satelliteId', source.from?.satelliteId ?? 'unavailable');
    add(values, 'fromBeamId', String(source.from?.beamId ?? 'unavailable'));
    add(values, 'toBeamId', String(source.to?.beamId ?? 'unavailable'));
  }

  if ((input.runtime === 'story' || input.runtime === 'guided') && input.comparison.baseline?.interval.analysisRunId) {
    add(values, 'baselineAnalysisRunId', input.comparison.baseline.interval.analysisRunId);
    add(values, 'baselineFrameId', input.comparison.baseline.frameId);
  }
  if ((input.runtime === 'story' || input.runtime === 'guided') && input.comparison.candidate?.interval.analysisRunId) {
    add(values, 'candidateAnalysisRunId', input.comparison.candidate.interval.analysisRunId);
    add(values, 'candidateFrameId', input.comparison.candidate.frameId);
  }

  if ((input.runtime === 'causal' || input.runtime === 'guided') && input.comparison.parameterChange !== null) {
    const change = input.comparison.parameterChange;
    add(values, 'changedParameterKey', change.key);
    values.changedParameterBaseline = required(String(change.baseline), 'changedParameterBaseline');
    values.changedParameterCandidate = required(String(change.candidate), 'changedParameterCandidate');
    add(values, 'comparisonClassification', input.comparison.classification ?? 'unavailable');
    add(values, 'frameComparisonGate', input.comparison.frameGate);
    add(values, 'evaluationComparisonGate', input.comparison.evaluationGate);
  }

  if (input.runtime === 'guided') {
    if (input.guided === null) throw new Error('guided replay provenance requires guided state');
    add(values, 'baselineStoryRuntimeId', input.guided.baselineStoryRuntimeId ?? 'unavailable');
    add(values, 'candidateStoryRuntimeId', input.guided.candidateStoryRuntimeId ?? 'unavailable');
    add(values, 'annotationMode', input.guided.annotationMode);
  }

  return Object.freeze(values) as CanvasWebmProvenanceIdentity;
}

function archiveOptions(input: VisualLabReplayBundleInput): {
  readonly clipId: string;
  readonly title: string;
  readonly locale: string;
  readonly theme: string;
  readonly claimBoundary: string;
  readonly sourceLocators: readonly string[];
} {
  return {
    clipId: input.clipId,
    title: input.title,
    locale: input.locale,
    theme: input.theme,
    claimBoundary: input.claimBoundary,
    sourceLocators: input.sourceLocators,
  };
}

/** Pure replay ZIP/schema construction; no DOM, recorder, or React dependency. */
export function prepareVisualLabReplayBundle(input: VisualLabReplayBundleInput): VisualLabClipArchive {
  return prepareVisualLabClipArchive(input.capture, archiveOptions(input));
}

export async function serializeReplayBundle(input: VisualLabReplayBundleInput): Promise<Blob> {
  const archive = prepareVisualLabReplayBundle(input);
  const browser = globalThis as typeof globalThis & {
    Blob?: new (parts?: BlobPart[], options?: { readonly type?: string }) => Blob;
  };
  if (typeof browser.Blob !== 'function') throw new Error('Blob is unavailable for replay bundle export');
  const payload = archive.zipBytes.buffer.slice(
    archive.zipBytes.byteOffset,
    archive.zipBytes.byteOffset + archive.zipBytes.byteLength,
  ) as ArrayBuffer;
  return new browser.Blob([payload], { type: 'application/zip' });
}

export function downloadVisualLabReplayBundle(
  input: VisualLabReplayDownloadInput,
): Promise<ClipArchiveWriteResult> {
  return downloadVisualLabClipArchive(input.capture, {
    ...archiveOptions(input),
    ...(input.primitives === undefined ? {} : { primitives: input.primitives }),
  });
}
