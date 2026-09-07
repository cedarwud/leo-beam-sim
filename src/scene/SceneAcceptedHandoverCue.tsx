import type { ComponentProps, JSX } from 'react';

import { DecisionHandoverCue } from '../viz/DecisionHandoverCue';

type DecisionHandoverCueProps = ComponentProps<typeof DecisionHandoverCue>;

export interface SceneAcceptedHandoverCueProps {
  readonly mounted: boolean;
  readonly transition: DecisionHandoverCueProps['transition'];
  readonly placementByCellId: DecisionHandoverCueProps['placementByCellId'];
  readonly progress01: DecisionHandoverCueProps['progress01'];
  readonly sourceColor: DecisionHandoverCueProps['sourceColor'];
  readonly targetColor: DecisionHandoverCueProps['targetColor'];
}

/** Renders the accepted source-to-target transition cue when its authority is drawable. */
export function SceneAcceptedHandoverCue({
  mounted,
  transition,
  placementByCellId,
  progress01,
  sourceColor,
  targetColor,
}: SceneAcceptedHandoverCueProps): JSX.Element | null {
  if (!mounted) return null;

  return (
    <DecisionHandoverCue
      transition={transition}
      placementByCellId={placementByCellId}
      progress01={progress01}
      sourceColor={sourceColor}
      targetColor={targetColor}
    />
  );
}
