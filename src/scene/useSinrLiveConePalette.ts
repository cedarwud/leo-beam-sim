import { useMemo } from 'react';
import { resolveServingConePalette } from '../appearance/servingConePalette';
import type { SinrLiveConePalette } from '../constants/sinrLiveConeStyle';
import type { BeamDisplaySpec } from './beamDisplaySpec';

/**
 * WHICH PALETTE the SINR-live cones and footprints paint with — the one semantic
 * palette every cone/footprint mount reads, and the serving-cone variant the
 * candidate-comparison overlay may substitute a hero colour into.
 *
 * Change "what colour/opacity a cone role gets" by changing the `beamDisplaySpec`
 * field this maps in; change "when the overlay may override the hero colour" in
 * `appearance/servingConePalette.ts`.
 *
 * Its whole input list is these three values: the spec, whether the central
 * overlay owns the serving identity, and the overlay's serving beam colour.
 */
export interface UseSinrLiveConePaletteParameters {
  readonly beamDisplaySpec: BeamDisplaySpec;
  readonly multiCandidateCentralOverlayActive: boolean;
  readonly multiCandidateServingBeamColor: string | null;
}

export interface UseSinrLiveConePaletteResult {
  readonly sinrLiveConePalette: SinrLiveConePalette;
  readonly activeServingConePalette: SinrLiveConePalette;
}

export function useSinrLiveConePalette({
  beamDisplaySpec,
  multiCandidateCentralOverlayActive,
  multiCandidateServingBeamColor,
}: UseSinrLiveConePaletteParameters): UseSinrLiveConePaletteResult {
  // The ONE appearance palette for every cone + footprint mount (2026-08-06 consolidation).
  // Built once from `beamDisplaySpec` and handed to all five cone mounts + both footprint
  // mounts, so a mount no longer carries its own colour/opacity precedence — it declares
  // its LAYER, each cone's ROLE is derived, and the role decides colour + opacity in the
  // single decision point `resolveSinrLiveConeRoleStyle`. Every value here is a spec field,
  // so the prompt-editable control surface is unchanged.
  const sinrLiveConePalette = useMemo(
    () => ({
      heroColor: beamDisplaySpec.heroConeColor,
      servingFanColor: beamDisplaySpec.servingFanConeColor,
      backgroundColor: beamDisplaySpec.backgroundConeColor,
      candidateColor: beamDisplaySpec.candidateConeColor,
      candidateFanColor: beamDisplaySpec.candidateFanConeColor,
      pulseIntraColor: beamDisplaySpec.pulseIntraColor,
      pulseInterColor: beamDisplaySpec.pulseInterColor,
      heroOpacity: beamDisplaySpec.heroConeOpacity,
      servingConeOpacity: beamDisplaySpec.servingConeOpacity,
      backgroundOpacity: beamDisplaySpec.backgroundConeOpacity,
      candidateOpacity: beamDisplaySpec.candidateConeOpacity,
      candidateFanOpacity: beamDisplaySpec.candidateFanConeOpacity,
      nonServingOpacity: beamDisplaySpec.nonServingConeOpacity,
    }),
    [
      beamDisplaySpec.heroConeColor,
      beamDisplaySpec.servingFanConeColor,
      beamDisplaySpec.backgroundConeColor,
      beamDisplaySpec.candidateConeColor,
      beamDisplaySpec.candidateFanConeColor,
      beamDisplaySpec.pulseIntraColor,
      beamDisplaySpec.pulseInterColor,
      beamDisplaySpec.heroConeOpacity,
      beamDisplaySpec.servingConeOpacity,
      beamDisplaySpec.backgroundConeOpacity,
      beamDisplaySpec.candidateConeOpacity,
      beamDisplaySpec.candidateFanConeOpacity,
      beamDisplaySpec.nonServingConeOpacity,
    ],
  );
  const activeServingConePalette = useMemo(
    () => resolveServingConePalette(
      sinrLiveConePalette,
      multiCandidateCentralOverlayActive,
      multiCandidateServingBeamColor,
    ),
    [multiCandidateCentralOverlayActive, multiCandidateServingBeamColor, sinrLiveConePalette],
  );
  return { sinrLiveConePalette, activeServingConePalette };
}
