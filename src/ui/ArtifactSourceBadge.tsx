/**
 * ArtifactSourceBadge — render-truth honesty surface (FIX-1).
 *
 * The dev server's Vite middleware serves the artifact-replay
 * `visual-showcase-v1.json` and stamps an `X-Showcase-Artifact-Source`
 * response header: `producer-pinned` when the real producer artifact is on
 * disk, `synthetic-fixture-fallback` when it falls back to the repo-local
 * validator fixture (`scripts/visualShowcaseValidatorFixture.ts`). `App.tsx`
 * reads that header into the `source` prop.
 *
 * This badge makes a NON-producer source unmissable so synthetic fixture data
 * can never be silently mistaken for a producer result — the exact failure the
 * 2026-06-03 render-truth audit caught. It renders nothing for the real
 * producer source (or before the header is known / the fetch failed closed).
 *
 * Display-only: it reads a transport header, never SINR / handover / reward /
 * geometry truth. See `docs/showcase-render-truth-fix-backlog.md`
 * FIX-1 and `docs/showcase-render-truth-audit-2026-06-03.md` (A2/A4).
 *
 * The decision function is exported separately so a unit/string validator can
 * exercise the gate without a React renderer.
 */

import type { ReactElement } from 'react';

export const PRODUCER_PINNED_SOURCE = 'producer-pinned';
export const SYNTHETIC_FIXTURE_SOURCE = 'synthetic-fixture-fallback';
/**
 * Sentinel for a COMPLETED artifact response that carried no
 * `X-Showcase-Artifact-Source` header (e.g. a static/preview server or a route
 * mock). It is deliberately distinct from `null` (loading / before fetch) so a
 * header-absent 200 still trips the visible honesty surface instead of looking
 * like the silent loading state.
 */
export const HEADER_ABSENT_SOURCE = 'header-absent';

export type ArtifactSourceBadgeDecision =
  | { readonly show: false }
  | {
      readonly show: true;
      readonly label: string;
      readonly detail: string;
    };

/**
 * Pure decision: given the `X-Showcase-Artifact-Source` header value, decide
 * whether (and what) the honesty badge should render. Silent for the real
 * producer source and for an unknown source (loading / failed-closed = null).
 */
export function decideArtifactSourceBadge(source: string | null): ArtifactSourceBadgeDecision {
  if (source === null || source === PRODUCER_PINNED_SOURCE) {
    return { show: false };
  }
  if (source === SYNTHETIC_FIXTURE_SOURCE) {
    return {
      show: true,
      label: 'Synthetic fixture — not producer data',
      detail:
        'The pinned producer visual-showcase-v1.json is absent; this scene, ' +
        'dashboard, and flowchart ride a repo-local synthetic fixture. Do not ' +
        'read it as a producer result. Regenerate the artifact (FIX-2).',
    };
  }
  if (source === HEADER_ABSENT_SOURCE) {
    return {
      show: true,
      label: 'Unknown artifact source — no source header',
      detail:
        'The artifact response carried no X-Showcase-Artifact-Source header, ' +
        'so its provenance is unverified. Treat all artifact-lane visuals as ' +
        'non-proof until the producer artifact is confirmed.',
    };
  }
  return {
    show: true,
    label: `Non-producer artifact source: ${source}`,
    detail:
      'The artifact-replay data source is not the pinned producer artifact. ' +
      'Treat all artifact-lane visuals as non-proof.',
  };
}

export function ArtifactSourceBadge(props: { source: string | null }): ReactElement | null {
  const decision = decideArtifactSourceBadge(props.source);
  if (!decision.show) return null;
  return (
    <div
      className="leo-artifact-source-badge"
      role="alert"
      data-testid="artifact-source-badge"
      data-artifact-source={props.source ?? ''}
      style={{
        background: '#5a2d00',
        color: '#ffe9c7',
        padding: '6px 16px',
        fontSize: 14.5,
        borderBottom: '1px solid #b25c00',
        display: 'flex',
        gap: 12,
        alignItems: 'baseline',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
        ⚠ {decision.label}
      </span>
      <span style={{ fontWeight: 400, opacity: 0.92 }}>{decision.detail}</span>
    </div>
  );
}
