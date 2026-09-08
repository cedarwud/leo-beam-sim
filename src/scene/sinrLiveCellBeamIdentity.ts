/**
 * Stable identity and link-budget encoding for earth-fixed SINR-live cells.
 *
 * The public scene contract speaks in geographic cell ids. The link-budget
 * adapter uses a one-based beam id and reserves a disjoint range for the
 * deterministic same-cell physical variants used by the homepage story.
 */

const CELL_BEAM_ID_OFFSET = 1;

/** Reserved range for deterministic same-cell physical beam variants. */
export const INTRA_CELL_BEAM_ID_STRIDE = 420;
export const INTRA_CELL_BEAM_VARIANT_COUNT = 6;

/** Stable geographic frequency colour for a cell — §5.2. NOT a beamIndex. */
export function cellFrequencyIndex(cellId: number, frequencyReuse: number): number {
  const reuse = Number.isFinite(frequencyReuse) ? Math.max(1, Math.floor(frequencyReuse)) : 1;
  const id = Math.max(0, Math.floor(cellId));
  return id % reuse;
}

/** Internal link-budget beamId encoding. */
export function cellLinkBudgetBeamId(cellId: number): number {
  return Math.max(0, Math.floor(cellId)) + CELL_BEAM_ID_OFFSET;
}

/** Link-budget beam id for a deterministic physical beam variant in one cell. */
export function intraCellLinkBudgetBeamId(cellId: number, variantIndex = 1): number {
  const id = Math.max(0, Math.floor(cellId));
  if (id >= INTRA_CELL_BEAM_ID_STRIDE) {
    throw new RangeError(`cellId ${id} cannot be encoded as an intra-cell beam variant`);
  }
  if (!Number.isInteger(variantIndex) || variantIndex < 1 || variantIndex > INTRA_CELL_BEAM_VARIANT_COUNT) {
    throw new RangeError(`variantIndex ${variantIndex} must be in 1..${INTRA_CELL_BEAM_VARIANT_COUNT}`);
  }
  return cellLinkBudgetBeamId(id) + variantIndex * INTRA_CELL_BEAM_ID_STRIDE;
}

/** Decode the geographic cell and reserved same-cell variant from a link id. */
export function decodeCellLinkBudgetBeamId(beamId: number): {
  readonly cellId: number;
  readonly variantIndex: number;
} {
  const encoded = Math.max(0, Math.floor(beamId) - CELL_BEAM_ID_OFFSET);
  return {
    cellId: encoded % INTRA_CELL_BEAM_ID_STRIDE,
    variantIndex: Math.floor(encoded / INTRA_CELL_BEAM_ID_STRIDE),
  };
}

/** Resolve the configured reuse group for geographic and physical beam ids. */
export function beamFrequencyIndexForLink(beamId: number, frequencyReuse: number): number {
  const reuse = Number.isFinite(frequencyReuse) ? Math.max(1, Math.floor(frequencyReuse)) : 1;
  const decoded = decodeCellLinkBudgetBeamId(beamId);
  return decoded.variantIndex === 0
    ? cellFrequencyIndex(decoded.cellId, reuse)
    : (decoded.cellId + decoded.variantIndex) % reuse;
}

/** Recover a cellId from the internal link-budget beamId. */
export function cellIdFromLinkBudgetBeamId(beamId: number): number {
  return decodeCellLinkBudgetBeamId(beamId).cellId;
}

/** Beam identity = sat × cell (§5.2). */
export function cellBeamIdentity(satId: string, cellId: number): string {
  return `${satId}#cell${Math.max(0, Math.floor(cellId))}`;
}

/** Distinguish the selected physical beam while retaining its cell identity. */
export function cellBeamIdentityForLink(satId: string, beamId: number): string {
  const decoded = decodeCellLinkBudgetBeamId(beamId);
  return decoded.variantIndex === 0
    ? cellBeamIdentity(satId, decoded.cellId)
    : `${cellBeamIdentity(satId, decoded.cellId)}#variant${decoded.variantIndex}`;
}
