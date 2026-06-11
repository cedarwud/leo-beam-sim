/**
 * S1 coordinate authority — the single source for the spherical-Earth surface
 * scale constant. Previously this `111.32` literal was redeclared in 6 modules
 * (runtimeFrameStep, runtimeUeFrame, sinrLiveCellModel, modqnReplaySceneVisuals,
 * showcaseArtifactToScene, cellLayout); each redeclaration was a separate place
 * the value could silently drift. They now all import this one constant.
 *
 * Mean km per degree of LATITUDE on a spherical Earth (Earth circumference /
 * 360°). Longitude scaling additionally multiplies by cos(latitude); that
 * cos factor is applied at each call site, not baked in here.
 *
 * Lives in `engine/orbit` (not `scene/`) so engine-side consumers
 * (`cellLayout`) can import it without crossing the engine→scene boundary.
 */
export const EARTH_KM_PER_DEG = 111.32;
