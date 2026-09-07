/**
 * Split out of MainScene.tsx so that modules extracted from SceneRenderContent can
 * use these without importing MainScene itself, which would create an import cycle
 * (MainScene imports the extracted hook; the hook would import MainScene back).
 * Behaviour is unchanged -- these are moved verbatim.
 */
import { colorForServingBeam } from '../constants/servingColour';

export const MULTI_CANDIDATE_TRANSITION_SOURCE_OPACITY_FACTOR = 0.62;
export const MULTI_CANDIDATE_TRANSITION_TARGET_OPACITY_FACTOR = 0.88;

export function resolveServingIdentityColor(
  satId: string | null | undefined,
  beamId: number | null | undefined,
  fallback: string,
): string {
  if (satId === null || satId === undefined || satId.length === 0) return fallback;
  if (beamId === null || beamId === undefined || !Number.isFinite(beamId)) return fallback;
  return colorForServingBeam(satId, beamId).markerColor;
}
