/**
 * loadShowcaseArtifact — schema-gate for `visual-showcase-v1` JSON.
 *
 * Rationale (SDD §4 D3, §9 P1 exit criteria (a)):
 *   - This is the only producer-side load path. It parses + validates +
 *     refuses on any schema-level gap that would let truth-reinvention sneak
 *     through downstream.
 *   - It does NOT call `coordToWorld`, does NOT touch
 *     `showcaseArtifactToScene` — those run later. This function is the
 *     "renderer never sees a broken artifact" gate.
 *
 * Validation steps (SDD §9 P1 exit criteria, §7 New modules):
 *   (a) `schemaVersion === 'visual-showcase-v1'`
 *   (b) `scenario.profile` is recognised (currently: 'modqn-multi-ue';
 *       'baseline-one-ue' accepted as v1.0 backward-compat)
 *   (c) `provenance.claimBoundary` present
 *   (d) every `timeline[].handoverState.kind` is a non-empty string (Q5: load
 *       blocks on absent kind — adapter MUST NOT fall back to ID-comparison
 *       classification)
 *   (e) `truthOwnership.sinr.channelMetricKind` present and in the contract's
 *       allowed values
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, `HandoverManager`,
 *     `computeLinkBudget`, `buildLinkContext`, `runtimeFrameStep`.
 *
 * TODO P1e: integrate with `ntn-sim-core`'s `npm run
 * validate:visual-showcase:artifact` either as a build-time check or via a
 * dev plugin (OQ-8).
 */

import {
  VISUAL_SHOWCASE_V1_CHANNEL_METRIC_KINDS,
  VISUAL_SHOWCASE_V1_PROFILE_VALUES,
  VISUAL_SHOWCASE_V1_SCHEMA_VERSION,
} from '../core/contracts/visual-showcase-v1';
import type {
  VisualShowcaseArtifact,
} from '../scene/visual-showcase-contract';

/** Error kinds the load gate may raise. */
export type ShowcaseLoadErrorKind =
  | 'schema-version'
  | 'profile-unsupported'
  | 'claim-boundary-missing'
  | 'handover-kind-absent'
  | 'channel-metric-kind-missing'
  | 'channel-metric-kind-unknown'
  | 'shape-invalid';

export class ShowcaseLoadError extends Error {
  readonly kind: ShowcaseLoadErrorKind;
  readonly details: Readonly<Record<string, unknown>>;
  constructor(
    kind: ShowcaseLoadErrorKind,
    message: string,
    details: Readonly<Record<string, unknown>> = {},
  ) {
    super(`[loadShowcaseArtifact:${kind}] ${message}`);
    this.name = 'ShowcaseLoadError';
    this.kind = kind;
    this.details = details;
  }
}

const SUPPORTED_PROFILES: ReadonlySet<string> = new Set(
  VISUAL_SHOWCASE_V1_PROFILE_VALUES,
);
const ALLOWED_CHANNEL_METRIC_KINDS: ReadonlySet<string> = new Set(
  VISUAL_SHOWCASE_V1_CHANNEL_METRIC_KINDS,
);

/**
 * Parse + schema-validate a `visual-showcase-v1` JSON blob.
 *
 * @param json  the raw JSON value (typically `JSON.parse(...)` output).
 * @returns the typed `VisualShowcaseArtifact`.
 * @throws {ShowcaseLoadError} on any validation failure.
 */
export function loadShowcaseArtifact(json: unknown): VisualShowcaseArtifact {
  if (typeof json !== 'object' || json === null) {
    throw new ShowcaseLoadError(
      'shape-invalid',
      'artifact root is not a non-null object',
      { typeof: typeof json },
    );
  }
  const root = json as Record<string, unknown>;

  // (a) schemaVersion
  if (root.schemaVersion !== VISUAL_SHOWCASE_V1_SCHEMA_VERSION) {
    throw new ShowcaseLoadError(
      'schema-version',
      `expected schemaVersion='${VISUAL_SHOWCASE_V1_SCHEMA_VERSION}', got '${String(root.schemaVersion)}'`,
      { actual: root.schemaVersion },
    );
  }

  // Shape guards before deeper checks.
  if (typeof root.scenario !== 'object' || root.scenario === null) {
    throw new ShowcaseLoadError('shape-invalid', 'scenario missing or not an object');
  }
  if (typeof root.provenance !== 'object' || root.provenance === null) {
    throw new ShowcaseLoadError('shape-invalid', 'provenance missing or not an object');
  }
  if (typeof root.truthOwnership !== 'object' || root.truthOwnership === null) {
    throw new ShowcaseLoadError('shape-invalid', 'truthOwnership missing or not an object');
  }
  if (!Array.isArray(root.timeline)) {
    throw new ShowcaseLoadError('shape-invalid', 'timeline missing or not an array');
  }
  if (typeof root.entities !== 'object' || root.entities === null) {
    throw new ShowcaseLoadError('shape-invalid', 'entities missing or not an object');
  }

  const scenario = root.scenario as Record<string, unknown>;
  const provenance = root.provenance as Record<string, unknown>;
  const truthOwnership = root.truthOwnership as Record<string, unknown>;
  const timeline = root.timeline as unknown[];

  // (b) scenario.profile recognised. v1.0 omitted profile → treat as baseline-one-ue.
  const profile = typeof scenario.profile === 'string' ? scenario.profile : 'baseline-one-ue';
  if (!SUPPORTED_PROFILES.has(profile)) {
    throw new ShowcaseLoadError(
      'profile-unsupported',
      `scenario.profile='${profile}' is not in the contract's supported profile list: ` +
        `${Array.from(SUPPORTED_PROFILES).join(', ')}`,
      { profile, supported: Array.from(SUPPORTED_PROFILES) },
    );
  }

  // (c) provenance.claimBoundary present
  if (typeof provenance.claimBoundary !== 'object' || provenance.claimBoundary === null) {
    throw new ShowcaseLoadError(
      'claim-boundary-missing',
      'provenance.claimBoundary missing — required for R5 forbidden-claim enforcement',
    );
  }

  // (e) truthOwnership.sinr.channelMetricKind present + allowed
  const sinrTruth = truthOwnership.sinr as Record<string, unknown> | undefined;
  if (!sinrTruth || typeof sinrTruth !== 'object') {
    throw new ShowcaseLoadError(
      'channel-metric-kind-missing',
      'truthOwnership.sinr block missing or not an object',
    );
  }
  const channelMetricKind = sinrTruth.channelMetricKind;
  if (typeof channelMetricKind !== 'string') {
    throw new ShowcaseLoadError(
      'channel-metric-kind-missing',
      'truthOwnership.sinr.channelMetricKind missing — required to drive SNR-vs-SINR legend',
    );
  }
  if (!ALLOWED_CHANNEL_METRIC_KINDS.has(channelMetricKind)) {
    throw new ShowcaseLoadError(
      'channel-metric-kind-unknown',
      `truthOwnership.sinr.channelMetricKind='${channelMetricKind}' is not in the contract's allowed values: ` +
        `${Array.from(ALLOWED_CHANNEL_METRIC_KINDS).join(', ')}`,
      { actual: channelMetricKind, allowed: Array.from(ALLOWED_CHANNEL_METRIC_KINDS) },
    );
  }

  // (d) every timeline[i].handoverState.kind present + non-empty (Q5 binding)
  for (let i = 0; i < timeline.length; i++) {
    const frame = timeline[i];
    if (typeof frame !== 'object' || frame === null) {
      throw new ShowcaseLoadError(
        'shape-invalid',
        `timeline[${i}] is not an object`,
        { frameIndex: i },
      );
    }
    const hs = (frame as { handoverState?: unknown }).handoverState;
    if (typeof hs !== 'object' || hs === null) {
      throw new ShowcaseLoadError(
        'handover-kind-absent',
        `timeline[${i}].handoverState missing — Q5 requires producer truth on every frame`,
        { frameIndex: i },
      );
    }
    const kind = (hs as { kind?: unknown }).kind;
    if (typeof kind !== 'string' || kind.length === 0) {
      throw new ShowcaseLoadError(
        'handover-kind-absent',
        `timeline[${i}].handoverState.kind missing or empty — Q5: adapter MUST NOT ` +
          `fall back to ID-comparison classification`,
        { frameIndex: i, kindActual: kind },
      );
    }
  }

  // All gates pass. Cast is safe — we have validated the load-bearing fields.
  // We intentionally do NOT fully validate every wire field: ntn-sim-core's
  // `validate:visual-showcase:artifact` is the authoritative validator (R3 / OQ-8).
  // This function is the renderer's last-line gate, not a re-implementation.
  return json as VisualShowcaseArtifact;
}
