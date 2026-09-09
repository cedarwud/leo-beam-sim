import type { ReactNode } from 'react';

/**
 * A compact, deliberately high-contrast source boundary for physical values.
 * Keep this visual treatment aligned with the established teaching badge so
 * provenance is legible without competing with the numbers it qualifies.
 */
export type ProvenanceBadgeSource =
  | 'authored-teaching'
  | 'authored-input-controls'
  | 'synthetic-walker'
  | 'synthetic-walker-conditional'
  | 'homepage-demo-ee-display-only'
  | 'homepage-ee-hierarchy-display-only'
  | 'archived-tle'
  | 'artifact-replay'
  | 'same-frame-computed'
  | 'active-assignment-angle-aware'
  | 'primary-ue-same-frame-angle-aware-display-only'
  | 'primary-ue-same-frame-angle-aware-beam-metric-display-only'
  | 'not-available';

export interface ProvenanceBadgeProps {
  readonly source: ProvenanceBadgeSource;
  readonly testId?: string;
  readonly children: ReactNode;
}

export function ProvenanceBadge({ source, testId, children }: ProvenanceBadgeProps) {
  return (
    <span
      data-testid={testId}
      data-provenance-source={source}
      style={{
        justifySelf: 'start',
        padding: '3px 8px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 800,
        color: '#ffd78a',
        background: 'rgba(255,190,69,.12)',
        border: '1px solid rgba(255,190,69,.45)',
      }}
    >
      {children}
    </span>
  );
}
