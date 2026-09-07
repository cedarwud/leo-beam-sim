import type { ComponentProps, JSX } from 'react';

import { HandoverToastOverlay } from '../viz/HandoverToastOverlay';

type HandoverToastProps = ComponentProps<typeof HandoverToastOverlay>;

export interface SceneHandoverToastLayerProps {
  readonly mounted: boolean;
  /** Existing toast renderer contract kept together as one screen-overlay model. */
  readonly toast: HandoverToastProps;
}

/** Mounts the handover toast only when the scene overlay policy permits it. */
export function SceneHandoverToastLayer({
  mounted,
  toast,
}: SceneHandoverToastLayerProps): JSX.Element | null {
  if (!mounted) return null;
  return <HandoverToastOverlay {...toast} />;
}
