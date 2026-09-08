/**
 * The active-serving palette policy for the candidate-comparison overlay.
 *
 * The overlay may replace only the hero identity colour. Every other palette
 * role remains the scene's semantic palette, and a missing serving instruction
 * falls back to that semantic hero colour.
 */
import type { SinrLiveConePalette } from '../constants/sinrLiveConeStyle';

export function resolveServingConePalette(
  basePalette: SinrLiveConePalette,
  centralOverlayActive: boolean,
  activeServingBeamColor: string | null,
): SinrLiveConePalette {
  if (!centralOverlayActive) return basePalette;
  return {
    ...basePalette,
    heroColor: activeServingBeamColor ?? basePalette.heroColor,
  };
}
