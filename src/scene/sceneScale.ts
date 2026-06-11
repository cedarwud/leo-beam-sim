/**
 * S1 coordinate authority — sky-dome visual projection radii (world units).
 *
 * Live satellites are rendered by compressing their azimuth/elevation onto this
 * dome (`createWorldPosition`, trajectoryFrame.ts) so that ALL visible
 * satellites stay inside the viewport. A true-to-scale placement
 * (`nadirKm × worldUnitsPerKm`) would push most visible LEO satellites
 * thousands of world-units off-screen (a 13°-elevation satellite is ~1 600 km
 * horizontally from the observer while the UE patch spans ±100 km), so the dome
 * is a deliberate display compression — NOT a physics quantity and NOT the
 * km↔world scale used for the ground plane.
 *
 * `SKY_DOME_V_RADIUS` is also the divisor of the live satellite render scale
 * (`useBeamViz`: `satPosScaleFactor = visualSatelliteAltitude / SKY_DOME_V_RADIUS`)
 * — it rescales the dome's vertical extent up to the configured visual altitude.
 * Exporting it here retires the bare `/ 400` magic literal that previously hid
 * this coupling.
 */
export const SKY_DOME_H_RADIUS = 700;
export const SKY_DOME_V_RADIUS = 400;
