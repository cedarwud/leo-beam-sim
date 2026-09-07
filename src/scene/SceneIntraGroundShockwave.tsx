import type { ComponentProps, JSX } from 'react';

import { IntraGroundShockwave } from '../viz/IntraGroundShockwave';

type IntraGroundShockwaveProps = ComponentProps<typeof IntraGroundShockwave>;

export interface SceneIntraGroundShockwaveProps {
  readonly mounted: boolean;
  readonly vizFrame: IntraGroundShockwaveProps['vizFrame'];
  readonly runtime: IntraGroundShockwaveProps['runtime'];
  readonly identityColorBySatelliteId: IntraGroundShockwaveProps['identityColorBySatelliteId'];
  readonly identityColorBySatelliteBeamId: IntraGroundShockwaveProps['identityColorBySatelliteBeamId'];
}

/** Renders the short intra-handover ground shockwave without owning its event state. */
export function SceneIntraGroundShockwave({
  mounted,
  vizFrame,
  runtime,
  identityColorBySatelliteId,
  identityColorBySatelliteBeamId,
}: SceneIntraGroundShockwaveProps): JSX.Element | null {
  if (!mounted) return null;

  return (
    <IntraGroundShockwave
      vizFrame={vizFrame}
      runtime={runtime}
      identityColorBySatelliteId={identityColorBySatelliteId}
      identityColorBySatelliteBeamId={identityColorBySatelliteBeamId}
    />
  );
}
