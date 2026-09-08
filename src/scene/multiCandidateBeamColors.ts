/**
 * The two multi-candidate identity indexes, built from one beam id per entry.
 *
 * Both loops previously looked up by the link-budget BEAM id while computing
 * their `fallback` from the earth-fixed CELL id. Because `beamId == cellId + 1`
 * on this lane, a lookup HIT and a lookup MISS returned adjacent rungs of the
 * same lightness ladder — one beam in two shades, depending only on whether the
 * accepted snapshot happened to hold it. The key and its fallback now read from
 * a single binding so they cannot describe different beams again; the id itself
 * comes from `coneItemBeamId`, the one derivation the cone painter uses.
 */
import { coneItemBeamId } from '../appearance/paintConeItems';
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
    // One id, used as the lookup key AND as the source of the miss-path colour.
    // The cell id still keys the OUTPUT index — that is an index, not a colour.
    const beamId = coneItemBeamId(instruction);
    const color = input.resolveBeamColor.length >= 4
      ? (input.resolveBeamColor as unknown as (s: string, b: number, f: string, sc?: boolean) => string)(
          instruction.satelliteId,
          beamId,
          '',
          instruction.isServing || instruction.isCandidate,
        )
      : input.resolveBeamColor(
          instruction.satelliteId,
          beamId,
          instruction.isServing || instruction.isCandidate,
        );
    bySatelliteCell.set(`${instruction.satelliteId}/${instruction.cellId}`, color);
    bySatelliteBeam.set(`${instruction.satelliteId}/${beamId}`, color);
  }

  if (input.authorityActive) {
    for (const link of input.authorityDisplayedLinks) {
      // `cellId` addresses the cell index only. Deriving the fallback from it
      // while keying on `link.beamId` is the drift this loop used to carry.
      const cellId = cellIdFromLinkBudgetBeamId(link.beamId);
      const color = input.resolveBeamColor.length >= 4
        ? (input.resolveBeamColor as unknown as (s: string, b: number, f: string, sc?: boolean) => string)(
            link.satelliteId,
            link.beamId,
            '',
            link.isServing || link.isCandidate,
          )
        : input.resolveBeamColor(
            link.satelliteId,
            link.beamId,
            link.isServing || link.isCandidate,
          );
      bySatelliteCell.set(`${link.satelliteId}/${cellId}`, color);
      bySatelliteBeam.set(`${link.satelliteId}/${link.beamId}`, color);
    }
  }

  return { bySatelliteCell, bySatelliteBeam };
}
