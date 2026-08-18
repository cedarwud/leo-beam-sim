import type {
  CanonicalTleServingChangeEvidence,
} from '../../../simulator/canonicalTleHandover';
import type { HandoverEvent } from '../../../engine/handover/types';
import type { TleAnalysisRun } from '../../../simulator/tleAnalysisRun';
import type { ScientificExplanationArtifact } from '../../../explain/model/scientificExplanationArtifact';
import type {
  ScientificLinkIdentity,
  ServingChangeStoryEvidence,
} from '../../../explain/model/types';
import type { SinrLiveCellHandoverEvent } from '../../../scene/sinrLiveCellModel';

/**
 * Presentation-only contract for the visual lab.
 *
 * The seam in this module deliberately stops before a run/frame is materialised:
 * theme, locale, and experience can change how an accepted source is presented,
 * but cannot change evidence or simulator state.  Callers that need a different
 * run must cross the simulator/explain seam and provide a new evidence identity.
 */
export const VISUAL_LAB_PRESENTATION_CONTRACT_VERSION = 'visual-lab-presentation-v1' as const;
export const VISUAL_LAB_CAPTURE_MANIFEST_SCHEMA = 'visual-lab-capture-manifest-v1' as const;

export type VisualLabPresentationContractVersion = typeof VISUAL_LAB_PRESENTATION_CONTRACT_VERSION;
export type VisualLabTheme = 'dark' | 'light';
export type VisualLabLocale = 'zh-Hant' | 'en';
export type VisualLabExperience = 'explore' | 'guided' | 'figure';

export interface VisualLabPresentationState {
  readonly theme: VisualLabTheme;
  readonly locale: VisualLabLocale;
  readonly experience: VisualLabExperience;
}

export const DEFAULT_VISUAL_LAB_PRESENTATION_STATE: Readonly<VisualLabPresentationState> = Object.freeze({
  theme: 'dark',
  locale: 'zh-Hant',
  experience: 'explore',
});

export type VisualLabCameraPreset =
  | 'global-overview'
  | 'ntpu-focus'
  | 'handover-focus'
  | 'link-budget-focus';

export type VisualLabLayerPreset =
  | 'minimal'
  | 'handover'
  | 'energy-story'
  | 'full';

export interface VisualLabViewport {
  readonly width: number;
  readonly height: number;
  readonly devicePixelRatio: number;
}

/**
 * A figure profile is a reproducible presentation lock.  It contains no
 * simulator values; those remain in the evidence identity recorded beside it.
 */
export interface VisualLabFigureProfile {
  readonly profileId: string;
  readonly theme: VisualLabTheme;
  readonly locale: VisualLabLocale;
  readonly viewport: VisualLabViewport;
  readonly cameraPreset: VisualLabCameraPreset;
  readonly layerPreset: VisualLabLayerPreset;
}

export interface VisualLabEvidenceIdentityInput {
  /** Canonical analysis run identity; aliases are not accepted here. */
  readonly runId: string;
  readonly frameId: string;
  readonly instantUtc: string;
}

export interface VisualLabEvidenceIdentity extends VisualLabEvidenceIdentityInput {
  readonly contractVersion: VisualLabPresentationContractVersion;
  /** Digest intentionally excludes theme, locale, viewport, and layer choices. */
  readonly identityDigest: string;
}

export interface VisualLabFigureCaptureManifest {
  readonly schema: typeof VISUAL_LAB_CAPTURE_MANIFEST_SCHEMA;
  readonly profileId: string;
  readonly contractVersion: VisualLabPresentationContractVersion;
  readonly lockedPresentation: {
    readonly theme: VisualLabTheme;
    readonly locale: VisualLabLocale;
    readonly viewport: VisualLabViewport;
    readonly cameraPreset: VisualLabCameraPreset;
    readonly layerPreset: VisualLabLayerPreset;
  };
  readonly evidence: VisualLabEvidenceIdentity;
}

export interface CreateVisualLabFigureCaptureManifestInput {
  readonly profile: VisualLabFigureProfile;
  readonly evidence: VisualLabEvidenceIdentityInput;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return value;
}

function assertNonEmpty(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty text`);
  }
}

function assertFinitePositive(value: unknown, label: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a finite positive number`);
  }
}

function assertInstantUtc(value: unknown): asserts value is string {
  assertNonEmpty(value, 'instantUtc');
  if (!Number.isFinite(Date.parse(value))) throw new Error('instantUtc must be a parseable UTC instant');
}

function canonicalJson(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('identity cannot include non-finite numbers');
    return JSON.stringify(Object.is(value, -0) ? 0 : value);
  }
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => (
    `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  )).join(',')}}`;
}

function fnvHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function evidenceIdentityDigest(input: VisualLabEvidenceIdentityInput): string {
  // Keep this object intentionally narrow.  In particular, presentation
  // choices must not make the same accepted frame look like a new evidence run.
  return `visual-lab-evidence-v1:${fnvHash(canonicalJson({
    contractVersion: VISUAL_LAB_PRESENTATION_CONTRACT_VERSION,
    frameId: input.frameId,
    instantUtc: input.instantUtc,
    runId: input.runId,
  }))}`;
}

function validateViewport(viewport: VisualLabViewport): VisualLabViewport {
  assertFinitePositive(viewport.width, 'profile.viewport.width');
  assertFinitePositive(viewport.height, 'profile.viewport.height');
  assertFinitePositive(viewport.devicePixelRatio, 'profile.viewport.devicePixelRatio');
  return viewport;
}

function validateProfile(profile: VisualLabFigureProfile): VisualLabFigureProfile {
  assertNonEmpty(profile.profileId, 'profile.profileId');
  validateViewport(profile.viewport);
  return profile;
}

function validateEvidence(input: VisualLabEvidenceIdentityInput): VisualLabEvidenceIdentity {
  assertNonEmpty(input.runId, 'runId');
  assertNonEmpty(input.frameId, 'frameId');
  assertInstantUtc(input.instantUtc);
  return {
    ...input,
    contractVersion: VISUAL_LAB_PRESENTATION_CONTRACT_VERSION,
    identityDigest: evidenceIdentityDigest(input),
  };
}

export function createVisualLabFigureCaptureManifest(
  input: CreateVisualLabFigureCaptureManifestInput,
): VisualLabFigureCaptureManifest {
  const profile = validateProfile(input.profile);
  const evidence = validateEvidence(input.evidence);
  return deepFreeze({
    schema: VISUAL_LAB_CAPTURE_MANIFEST_SCHEMA,
    profileId: profile.profileId,
    contractVersion: VISUAL_LAB_PRESENTATION_CONTRACT_VERSION,
    lockedPresentation: {
      theme: profile.theme,
      locale: profile.locale,
      viewport: { ...profile.viewport },
      cameraPreset: profile.cameraPreset,
      layerPreset: profile.layerPreset,
    },
    evidence,
  });
}

export function createVisualLabPresentationState(
  input: VisualLabPresentationState = DEFAULT_VISUAL_LAB_PRESENTATION_STATE,
): VisualLabPresentationState {
  return deepFreeze({
    theme: input.theme,
    locale: input.locale,
    experience: input.experience,
  });
}

export type VisualLabReplayStoryKind = 'inter-handover' | 'intra-handover';

export type VisualLabReplayAvailability =
  | {
      readonly status: 'available';
      readonly reason: null;
      readonly sourceKind: 'accepted-canonical-real';
    }
  | {
      readonly status: 'unavailable';
      readonly reason: string;
      readonly reasonCode:
        | 'non-canonical-source'
        | 'wrong-event-kind'
        | 'invalid-identity'
        | 'missing-real-trace';
      readonly sourceKind: 'legacy' | 'unsupported' | 'invalid';
    };

type VisualLabReplayUnavailable = Extract<VisualLabReplayAvailability, { readonly status: 'unavailable' }>;

/**
 * Adapter seam reserved for the future accepted canonical intra-beam trace.
 * The current engine and SINR-live event shapes are intentionally not allowed
 * to satisfy this interface: they lack an accepted real beam-identity trace.
 */
export interface AcceptedCanonicalBeamIdentityTrace {
  readonly adapter: 'accepted-canonical-beam-identity-trace-v1';
  readonly sourceKind: 'real-tle-canonical';
  readonly traceId: string;
  readonly analysisRunId: string;
  readonly geometryRunId: string;
  /** Decision-anchor compatibility aliases retained for existing consumers. */
  readonly frameId: string;
  readonly instantUtc: string;
  readonly traceDigest: string;
  readonly beforeAnchorIndex: number;
  readonly decisionAnchorIndex: number;
  readonly afterAnchorIndex: number;
  readonly beforeFrameId: string;
  readonly decisionFrameId: string;
  readonly afterFrameId: string;
  readonly beforeInstantUtc: string;
  readonly decisionInstantUtc: string;
  readonly afterInstantUtc: string;
  readonly from: ScientificLinkIdentity;
  readonly to: ScientificLinkIdentity;
}

export type VisualLabInterHandoverEvidence =
  | CanonicalTleServingChangeEvidence
  | ServingChangeStoryEvidence
  | ScientificExplanationArtifact['stories']['servingChange'];

export type VisualLabIntraHandoverSource =
  | {
      readonly kind: 'accepted-canonical-beam-identity';
      readonly trace: AcceptedCanonicalBeamIdentityTrace;
    }
  | {
      readonly kind: 'legacy-engine-event';
      readonly event: HandoverEvent;
    }
  | {
      readonly kind: 'legacy-sinr-live-event';
      readonly event: SinrLiveCellHandoverEvent;
    }
  | {
      readonly kind: 'missing';
    };

export interface VisualLabInterHandoverReplayInput {
  readonly storyId?: string;
  readonly evidence: VisualLabInterHandoverEvidence;
}

export interface VisualLabIntraHandoverReplayInput {
  readonly storyId?: string;
  readonly source: VisualLabIntraHandoverSource;
}

export interface VisualLabReplayStoryDescriptor {
  readonly storyId: string;
  readonly kind: VisualLabReplayStoryKind;
  readonly availability: VisualLabReplayAvailability;
  readonly source:
    | {
        readonly kind: 'inter-handover';
        readonly eventId: string | null;
        readonly fromSatelliteId: string | null;
        readonly toSatelliteId: string | null;
      }
    | {
        readonly kind: 'intra-handover';
      readonly traceId: string | null;
      readonly from: ScientificLinkIdentity | null;
      readonly to: ScientificLinkIdentity | null;
      /** Present only for accepted, three-anchor canonical evidence. */
      readonly trace?: AcceptedCanonicalBeamIdentityTrace | null;
      };
}

function interEvidenceFields(evidence: VisualLabInterHandoverEvidence): {
  readonly sourceEvent: 'inter-handover' | 'forced-continuity';
  readonly eventId: string;
  readonly fromSatelliteId: string;
  readonly toSatelliteId: string;
} {
  if ('sourceEventEvidence' in evidence) {
    return {
      sourceEvent: evidence.sourceEventEvidence.sourceEvent,
      eventId: evidence.sourceEventEvidence.eventId,
      fromSatelliteId: evidence.sourceEventEvidence.fromSatelliteId,
      toSatelliteId: evidence.sourceEventEvidence.toSatelliteId,
    };
  }
  if ('eventEvidence' in evidence) {
    return {
      sourceEvent: evidence.eventEvidence.sourceEvent,
      eventId: evidence.eventId,
      fromSatelliteId: evidence.fromSatelliteId,
      toSatelliteId: evidence.toSatelliteId,
    };
  }
  return {
    sourceEvent: evidence.sourceEvent,
    eventId: evidence.eventId,
    fromSatelliteId: evidence.fromSatelliteId,
    toSatelliteId: evidence.toSatelliteId,
  };
}

function unavailable(
  reason: string,
  reasonCode: VisualLabReplayUnavailable['reasonCode'],
  sourceKind: 'legacy' | 'unsupported' | 'invalid',
): VisualLabReplayAvailability {
  return { status: 'unavailable', reason, reasonCode, sourceKind };
}

export function createInterHandoverReplayDescriptor(
  input: VisualLabInterHandoverReplayInput,
): VisualLabReplayStoryDescriptor {
  const fields = interEvidenceFields(input.evidence);
  const storyId = input.storyId ?? fields.eventId;
  const source = {
    kind: 'inter-handover' as const,
    eventId: fields.eventId,
    fromSatelliteId: fields.fromSatelliteId,
    toSatelliteId: fields.toSatelliteId,
  };
  if (fields.sourceEvent !== 'inter-handover') {
    return deepFreeze({
      storyId,
      kind: 'inter-handover',
      source,
      availability: unavailable(
        'The accepted source event is forced-continuity, not an inter-handover story.',
        'wrong-event-kind',
        'unsupported',
      ),
    });
  }
  if (
    fields.fromSatelliteId.trim().length === 0
    || fields.toSatelliteId.trim().length === 0
    || fields.fromSatelliteId === fields.toSatelliteId
  ) {
    return deepFreeze({
      storyId,
      kind: 'inter-handover',
      source,
      availability: unavailable(
        'The canonical inter-handover source has invalid or unchanged satellite identity.',
        'invalid-identity',
        'invalid',
      ),
    });
  }
  return deepFreeze({
    storyId,
    kind: 'inter-handover',
    source,
    availability: {
      status: 'available' as const,
      reason: null,
      sourceKind: 'accepted-canonical-real' as const,
    },
  });
}

function validCanonicalIntraTrace(
  trace: AcceptedCanonicalBeamIdentityTrace,
): boolean {
  return trace.adapter === 'accepted-canonical-beam-identity-trace-v1'
    && trace.sourceKind === 'real-tle-canonical'
    && trace.traceId.trim().length > 0
    && trace.analysisRunId.trim().length > 0
    && trace.geometryRunId.trim().length > 0
    && trace.frameId.trim().length > 0
    && trace.traceDigest.trim().length > 0
    && Number.isInteger(trace.beforeAnchorIndex)
    && trace.beforeAnchorIndex >= 0
    && trace.decisionAnchorIndex === trace.beforeAnchorIndex + 1
    && trace.afterAnchorIndex === trace.decisionAnchorIndex + 1
    && trace.beforeFrameId.trim().length > 0
    && trace.decisionFrameId.trim().length > 0
    && trace.afterFrameId.trim().length > 0
    && trace.frameId === trace.decisionFrameId
    && trace.instantUtc === trace.decisionInstantUtc
    && Number.isFinite(Date.parse(trace.beforeInstantUtc))
    && Number.isFinite(Date.parse(trace.decisionInstantUtc))
    && Number.isFinite(Date.parse(trace.afterInstantUtc))
    && trace.from.satelliteId.trim().length > 0
    && trace.to.satelliteId.trim().length > 0
    && trace.from.satelliteId === trace.to.satelliteId
    && Number.isFinite(trace.from.beamId)
    && Number.isFinite(trace.to.beamId)
    && trace.from.beamId !== trace.to.beamId
    && trace.from.userId === trace.to.userId
    && trace.from.userIndex === trace.to.userIndex;
}

export function createIntraHandoverReplayDescriptor(
  input: VisualLabIntraHandoverReplayInput,
): VisualLabReplayStoryDescriptor {
  const source = input.source;
  if (source.kind === 'accepted-canonical-beam-identity') {
    const trace = source.trace;
    const storyId = input.storyId ?? trace.traceId;
    const descriptorSource = {
      kind: 'intra-handover' as const,
      traceId: trace.traceId,
      from: trace.from,
      to: trace.to,
      trace,
    };
    if (!validCanonicalIntraTrace(trace)) {
      return deepFreeze({
        storyId,
        kind: 'intra-handover',
        source: descriptorSource,
        availability: unavailable(
          'The accepted canonical beam-identity trace does not prove a same-satellite beam change.',
          'invalid-identity',
          'invalid',
        ),
      });
    }
    return deepFreeze({
      storyId,
      kind: 'intra-handover',
      source: descriptorSource,
      availability: {
        status: 'available' as const,
        reason: null,
        sourceKind: 'accepted-canonical-real' as const,
      },
    });
  }

  const legacyReason = source.kind === 'missing'
    ? 'No accepted canonical beam-identity trace was supplied for this intra-handover story.'
    : 'Legacy handover events are diagnostic only; they cannot establish an accepted canonical intra-handover story.';
  const reasonCode = source.kind === 'missing' ? 'missing-real-trace' as const : 'non-canonical-source' as const;
  return deepFreeze({
    storyId: input.storyId ?? `unavailable-intra-${source.kind}`,
    kind: 'intra-handover',
    source: {
      kind: 'intra-handover' as const,
      traceId: null,
      from: null,
      to: null,
    },
    availability: unavailable(
      legacyReason,
      reasonCode,
      source.kind === 'missing' ? 'unsupported' : 'legacy',
    ),
  });
}

export type VisualLabInspectTarget =
  | 'scene'
  | 'handover'
  | 'sinr'
  | 'power'
  | 'throughput'
  | 'energy-efficiency'
  | 'figure';

export type VisualLabSemanticCommand =
  | { readonly type: 'pause' }
  | { readonly type: 'next' }
  | { readonly type: 'previous' }
  | { readonly type: 'restart' }
  | { readonly type: 'inspect'; readonly target: VisualLabInspectTarget }
  | { readonly type: 'fork-to-explore' };

const SEMANTIC_COMMAND_TYPES = new Set<VisualLabSemanticCommand['type']>([
  'pause',
  'next',
  'previous',
  'restart',
  'inspect',
  'fork-to-explore',
]);

const INSPECT_TARGETS = new Set<VisualLabInspectTarget>([
  'scene',
  'handover',
  'sinr',
  'power',
  'throughput',
  'energy-efficiency',
  'figure',
]);

export function isVisualLabSemanticCommand(value: unknown): value is VisualLabSemanticCommand {
  if (value === null || typeof value !== 'object') return false;
  const command = value as Record<string, unknown>;
  if (typeof command.type !== 'string' || !SEMANTIC_COMMAND_TYPES.has(command.type as VisualLabSemanticCommand['type'])) {
    return false;
  }
  if (command.type === 'inspect') {
    return typeof command.target === 'string' && INSPECT_TARGETS.has(command.target as VisualLabInspectTarget);
  }
  return Object.keys(command).length === 1;
}

/**
 * The command interface is semantic by construction: no CSS selector, DOM
 * node, or computed result is accepted.  This guard is the runtime seam for
 * adapters that receive commands from keyboard, buttons, or a replay driver.
 */
export function assertVisualLabSemanticCommand(value: unknown): asserts value is VisualLabSemanticCommand {
  if (!isVisualLabSemanticCommand(value)) throw new Error('invalid visual-lab semantic command');
}

/** Type-only anchors documenting the source seams intentionally reused here. */
export type VisualLabCanonicalRunSource = TleAnalysisRun;
