import { colorForServingBeam } from '../constants/servingColour';
import { cellIdFromLinkBudgetBeamId } from './sinrLiveCellModel';

export interface MultiCandidateBeamColorInstruction {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly cellId: number;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
}

export interface MultiCandidateBeamColorLink {
  readonly satelliteId: string;
  readonly beamId: number;
  readonly isServing: boolean;
  readonly isCandidate: boolean;
}

export interface MultiCandidateBeamColorsInput {
  readonly sceneInstructions: readonly MultiCandidateBeamColorInstruction[];
  readonly authorityDisplayedLinks: readonly MultiCandidateBeamColorLink[];
  readonly authorityActive: boolean;
  readonly resolveBeamColor: (
    satelliteId: string,
    beamId: number,
    fallback: string,
    isServingOrCandidate?: boolean,
  ) => string;
}

export interface MultiCandidateBeamColors {
  readonly bySatelliteCell: Map<string, string>;
  readonly bySatelliteBeam: Map<string, string>;
}

/** Resolve both beam identity indexes from the same ordered scene inputs. */
export function resolveMultiCandidateBeamColors(
  input: MultiCandidateBeamColorsInput,
): MultiCandidateBeamColors {
  const bySatelliteCell = new Map<string, string>();
  const bySatelliteBeam = new Map<string, string>();

  for (const instruction of input.sceneInstructions) {
    const color = input.resolveBeamColor(
      instruction.satelliteId,
      instruction.beamId,
      colorForServingBeam(instruction.satelliteId, instruction.cellId).markerColor,
      instruction.isServing || instruction.isCandidate,
    );
    bySatelliteCell.set(`${instruction.satelliteId}/${instruction.cellId}`, color);
    bySatelliteBeam.set(`${instruction.satelliteId}/${instruction.beamId}`, color);
  }

  if (input.authorityActive) {
    for (const link of input.authorityDisplayedLinks) {
      const cellId = cellIdFromLinkBudgetBeamId(link.beamId);
      const color = input.resolveBeamColor(
        link.satelliteId,
        link.beamId,
        colorForServingBeam(link.satelliteId, cellId).markerColor,
        link.isServing || link.isCandidate,
      );
      bySatelliteCell.set(`${link.satelliteId}/${cellId}`, color);
      bySatelliteBeam.set(`${link.satelliteId}/${link.beamId}`, color);
    }
  }

  return { bySatelliteCell, bySatelliteBeam };
}
