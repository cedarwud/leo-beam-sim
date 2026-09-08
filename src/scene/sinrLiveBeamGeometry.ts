/**
 * Shared display geometry for the legacy SINR-live beam.
 *
 * This module delegates entirely to the authoritative cone geometry contract
 * in `src/appearance/coneGeometryContract.ts`.
 */
export {
  computeSinrLiveBeamFootprintEllipse,
  type SinrLiveBeamWorldPoint,
  type SinrLiveBeamFootprintEllipse,
  MIN_RENDER_ELEVATION_DEG,
  MAX_RENDER_TILT_DEG,
} from '../appearance/coneGeometryContract';
