export interface VisualLabBeamCellIdentity {
  readonly beamId: number;
  readonly cellIndex: number;
}

/** Beam IDs and substrate cell indices are separate namespaces. */
export function cellIndexForBeamId(
  targets: readonly VisualLabBeamCellIdentity[],
  beamId: number | null | undefined,
): number | null {
  if (beamId === null || beamId === undefined) return null;
  return targets.find(target => target.beamId === beamId)?.cellIndex ?? null;
}
