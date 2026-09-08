import type { JSX } from 'react';

/**
 * Compatibility shell for the retired training feed. The public component is
 * kept until the owning app surfaces are removed in the next wave.
 */
export interface TrainingTelemetryFeedProps {
  readonly enabled: boolean;
}

export function TrainingTelemetryFeed({ enabled }: TrainingTelemetryFeedProps): JSX.Element | null {
  void enabled;
  return null;
}
