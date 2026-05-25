/**
 * ClaimBoundaryBanner — surfaces the producer's claim-boundary contract to
 * the user, with D8 forbidden-claim enforcement (SDD §4 D8, §9 P1 exit
 * criterion (d), §11 governance / claim boundary).
 *
 * Contract:
 *   - The banner renders ONLY text drawn from
 *     `claimBoundary.allowedClaims` (title) + safe artifact metadata
 *     (`provenance.producer.name`, `evidenceStatus.status`,
 *     `evidenceStatus.notes`).
 *   - If any rendered note text contains a phrase from
 *     `claimBoundary.forbiddenClaims`, the banner refuses to render and
 *     surfaces a "claim boundary violation; banner suppressed" notice
 *     instead. Per SDD §4 D8 closing rule, we operate in
 *     **"renderer rejects banner render but allows the rest of the frame"**
 *     mode — the producer's ntn-sim-core validator does not catch
 *     semantic content mismatches, so the renderer is the final gate.
 *   - If `allowedClaims` is empty or `storyKind` is unrecognised, the
 *     banner falls back to a neutral notice. It never invents claim text.
 *
 * No SINR/handover/geometry knowledge required — pure provenance read.
 *
 * The decision function `decideClaimBoundaryBanner` is exported separately
 * so the D8 unit test (`validate-modqn-visual-showcase-p1e-d8-forbidden-
 * claim.ts`) can exercise the gate without a React renderer.
 *
 * Integration point: this component consumes `NormalizedSceneFrame` and
 * can be placed next to `<InfoPanel>` in `App.tsx` once the host UI
 * decides on layout. The component itself is mount-safe (returns `null`
 * when no banner should render).
 */

import type { ReactElement } from 'react';
import type { NormalizedSceneFrame } from '../scene/NormalizedSceneFrame';

export type ClaimBoundaryBannerInput = Pick<
  NormalizedSceneFrame,
  'sceneSource' | 'claimBoundary' | 'evidenceStatus' | 'provenance'
>;

export type ClaimBoundaryBannerDecision =
  | {
      readonly kind: 'rendered';
      readonly title: string;
      readonly subtitle: string;
      readonly details: ReadonlyArray<string>;
      readonly storyKind: string;
      readonly evidenceStatus: string;
    }
  | {
      readonly kind: 'blocked';
      readonly reasons: ReadonlyArray<string>;
    }
  | {
      readonly kind: 'fallback';
      readonly storyKind: string;
      readonly reason: string;
    };

function isLiveStub(value: unknown): value is { kind: 'live-stub' } {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'live-stub'
  );
}

function getStrings(maybe: unknown): ReadonlyArray<string> {
  return Array.isArray(maybe) ? maybe.filter((s): s is string => typeof s === 'string') : [];
}

/**
 * Pure decision function: given the claim-boundary subset of a
 * `NormalizedSceneFrame`, decide what the banner should render. Returns a
 * tagged union — `rendered` (safe banner content), `blocked` (would have
 * violated D8 — banner suppressed), or `fallback` (no producer claim text
 * available — neutral notice).
 */
export function decideClaimBoundaryBanner(
  input: ClaimBoundaryBannerInput,
): ClaimBoundaryBannerDecision {
  const { claimBoundary, evidenceStatus, provenance } = input;

  const allowedClaims = getStrings(
    (claimBoundary as { allowedClaims?: unknown }).allowedClaims,
  );
  const forbiddenClaims = getStrings(
    (claimBoundary as { forbiddenClaims?: unknown }).forbiddenClaims,
  );
  const storyKind =
    typeof (claimBoundary as { storyKind?: unknown }).storyKind === 'string'
      ? ((claimBoundary as { storyKind: string }).storyKind)
      : 'unknown';

  if (allowedClaims.length === 0) {
    return {
      kind: 'fallback',
      storyKind,
      reason: 'claimBoundary.allowedClaims is empty — no producer-promoted text available',
    };
  }

  const title = allowedClaims[0];

  // D8 defence #1: title must be in allowedClaims and must NOT be in
  // forbiddenClaims. Overlap is a producer-side configuration error;
  // renderer treats it as a hard block.
  const reasons: string[] = [];
  if (!allowedClaims.includes(title)) {
    reasons.push('selected title is not in allowedClaims (invariant violation)');
  }
  if (forbiddenClaims.includes(title)) {
    reasons.push(`title "${title}" also appears in forbiddenClaims — producer contradiction`);
  }

  // Producer name + status are safe metadata, not "claims" in the §11 sense.
  const producerName = isLiveStub(provenance)
    ? 'leo-beam-sim live'
    : typeof (provenance as { producer?: { name?: unknown } }).producer?.name === 'string'
      ? ((provenance as { producer: { name: string } }).producer.name)
      : 'unknown producer';

  const status =
    typeof (evidenceStatus as { status?: unknown }).status === 'string'
      ? ((evidenceStatus as { status: string }).status)
      : 'unknown';

  const subtitle = `${producerName} — evidence: ${status}`;
  const notes = getStrings((evidenceStatus as { notes?: unknown }).notes);
  const details = notes.slice(0, 3);

  // D8 defence #2: notes are evidence-status text, not claimed-promotion
  // text. But if the producer accidentally wrote a forbidden phrase into a
  // note (a marketing leak), the renderer still suppresses.
  // Substring match is case-insensitive.
  const lcText = [title, subtitle, ...details].join(' | ').toLowerCase();
  for (const forbidden of forbiddenClaims) {
    if (forbidden.length === 0) continue;
    if (lcText.includes(forbidden.toLowerCase())) {
      reasons.push(`rendered text contains forbidden phrase: "${forbidden}"`);
    }
  }

  if (reasons.length > 0) {
    return { kind: 'blocked', reasons };
  }

  return {
    kind: 'rendered',
    title,
    subtitle,
    details,
    storyKind,
    evidenceStatus: status,
  };
}

export function ClaimBoundaryBanner(props: {
  frame: ClaimBoundaryBannerInput;
  bundleProvenanceKind?: 'paper-faithful' | 'user-trained';
}): ReactElement | null {
  const decision = decideClaimBoundaryBanner(props.frame);
  if (decision.kind === 'fallback') {
    return (
      <div
        className="claim-boundary-banner claim-boundary-banner--fallback"
        data-claim-boundary-state="fallback"
        data-story-kind={decision.storyKind}
      >
        Replay artifact ({decision.storyKind}) — no producer claim text available.
      </div>
    );
  }
  if (decision.kind === 'blocked') {
    // Intentionally NO render of the original title or notes — D8 contract.
    return (
      <div
        className="claim-boundary-banner claim-boundary-banner--blocked"
        data-claim-boundary-state="blocked"
        title={decision.reasons.join('; ')}
      >
        Claim boundary violation — banner suppressed.
      </div>
    );
  }
  return (
    <div
      className="claim-boundary-banner claim-boundary-banner--rendered"
      data-claim-boundary-state="rendered"
      data-story-kind={decision.storyKind}
      data-evidence-status={decision.evidenceStatus}
    >
      <strong className="claim-boundary-banner__title">{decision.title}</strong>
      {props.bundleProvenanceKind === 'user-trained' ? (
        <span className="claim-boundary-banner__chip claim-boundary-banner__chip--user-trained" data-testid="claim-boundary-banner-user-trained-chip">user-trained</span>
      ) : null}
      {props.bundleProvenanceKind === 'user-trained' ? (
        <span
          className="claim-boundary-banner__user-trained-disclaimer"
          data-testid="claim-boundary-banner-user-trained-disclaimer"
        >
          User-trained MODQN replay · paperFaithful: false · do not cite as PAP-2024 baseline evidence
        </span>
      ) : null}
      <span className="claim-boundary-banner__subtitle">{decision.subtitle}</span>
      {decision.details.length > 0 && (
        <ul className="claim-boundary-banner__notes">
          {decision.details.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
