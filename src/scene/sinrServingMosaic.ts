/**
 * SINR-serving mosaic (S2) — pure model.
 *
 * The `sinr-live` ambient layer that proves G3 ("every UE is served, not
 * decoration"): every UE marker is coloured by the beam that currently serves
 * it (by SINR), so the ~100 UE dots partition into a coloured cell mosaic. A
 * handover = a dot changes colour; load-balancing = a cluster migrates colour
 * together.
 *
 * Governance / honesty (frontend-render-governance.md §6/§8/§9, SDD §3.1):
 * - This is a DISTINCT SINR-serving visualisation, NOT the MODQN cell overlay
 *   (`deriveModqnServiceMap`). It is lane-owned to `sinr-live` and must never be
 *   mounted on a MODQN lane. Its colour is its own encoding; it carries the
 *   `sinr-serving` claim and never claims MODQN/producer truth.
 * - Display-only (Rule#6): it only assigns a marker colour derived from the
 *   already-computed serving (satId, beamId). It reads no SINR for the colour
 *   and alters no SINR, handover, decision, or geometry truth.
 * - The colour is a STABLE function of (satId, beamId) ONLY — never of
 *   display-order (`satelliteVisualIndex` churns frame-to-frame as the display
 *   set shifts). A stable colour means a dot recolours IFF its serving beam
 *   actually changed, so "handover = a dot changes colour" stays truthful.
 */

import { colorForServingBeam, colorForServingSatellite } from '../constants/servingColour';

/** Unserved marker colours — shared with the MODQN idle palette for coherence. */
export const SINR_SERVING_UNSERVED_COLOR = '#64748b';
export const SINR_SERVING_UNSERVED_EMISSIVE = '#334155';

export interface SinrServingMarkerColor {
  readonly markerColor: string;
  readonly markerEmissive: string;
}

export interface SinrServingMosaicUeInput {
  readonly servingSatId: string | null;
  /** Steered serving beam id; ALWAYS null on the sinr-live cell lane (S4-2). */
  readonly servingBeamId: number | null;
  /**
   * Earth-fixed serving cell id (sinr-live cell truth, S4-2 typed pun
   * replacement). When present (non-null) it is the per-sat serving unit the
   * mosaic keys/colours by; steered-lane records leave it null/absent.
   */
  readonly servingCellId?: number | null;
  readonly sinrDb: number | null;
}

/**
 * Display serving unit within the serving satellite: the typed earth-fixed
 * cell id on the cell lane, else the steered beam id. This is "cell drives
 * display" (explicit, typed), NOT the retired `servingBeamId := cellId` pun —
 * no field masquerades as another; the lane is discriminated by which typed
 * field is populated.
 */
function servingUnitId(ue: SinrServingMosaicUeInput): number | null {
  return ue.servingCellId ?? ue.servingBeamId;
}

export interface SinrServingBeamLoad {
  /** `${satId}:${beamId}` composite key (beamId = the serving unit id below). */
  readonly key: string;
  readonly satId: string;
  /** Serving unit id: the typed cell id on the cell lane, else the steered beam id. */
  readonly beamId: number;
  readonly count: number;
  readonly color: string;
}

export interface SinrServingMosaicAggregate {
  readonly servedCount: number;
  readonly totalCount: number;
  /** Distinct serving (satId,beamId) among served UEs — the non-mono proof. */
  readonly servingBeamCount: number;
  /** Per-serving-beam UE counts, busiest first. */
  readonly beamLoads: readonly SinrServingBeamLoad[];
  /** Mean SINR across served UEs that carry a finite SINR (null if none). */
  readonly avgServedSinrDb: number | null;
}

export const EMPTY_SINR_SERVING_MOSAIC_AGGREGATE: SinrServingMosaicAggregate = {
  servedCount: 0,
  totalCount: 0,
  servingBeamCount: 0,
  beamLoads: [],
  avgServedSinrDb: null,
};

/**
 * Stable, vivid marker colour for a serving (satId, beamId). Delegates to the ONE
 * serving-identity authority {@link colorForServingBeam} (SDD §3.2) so the UE
 * marker and the serving CONE for the same (satId, beamId) are the SAME colour —
 * the user matches a UE to its beam by colour (kills Bug E). Kept as a named
 * export here for the existing mosaic/serving-equivalence validators; the hash +
 * palette live in `constants/servingColour`.
 */
export function mosaicColorForServingBeam(satId: string, beamId: number): SinrServingMarkerColor {
  return colorForServingBeam(satId, beamId);
}

/**
 * Per-SATELLITE mosaic colour (semantic-beam-colour SDD §5, owner Option A). Delegates
 * to the ONE per-sat authority {@link colorForServingSatellite}, so the sinr-live ground
 * dots partition by SERVING SATELLITE (fewer colours than the per-(sat,cell) rainbow) and
 * the HUD beam-load aggregate keys per-(sat,cell) but COLOURS per-sat — one colour
 * authority across both surfaces. Named export for the mosaic/serving-equivalence
 * validators; the satId hash lives in `constants/servingColour`.
 */
export function mosaicColorForServingSatellite(satId: string): SinrServingMarkerColor {
  return colorForServingSatellite(satId);
}

function isServed(satId: string | null, beamId: number | null): boolean {
  return satId !== null && satId !== '' && beamId !== null && Number.isFinite(beamId);
}

/**
 * Per-UE marker colours keyed by UE id, for the 3D mosaic. Input is the live
 * `NormalizedSceneFrame.ues` shape (string serving ids; `''`/`null` = unserved).
 */
export function buildSinrServingUeColorMap(
  ues: ReadonlyArray<{ id: string; servingSatelliteId: string; servingBeamId: string }>,
): Map<string, SinrServingMarkerColor> {
  const out = new Map<string, SinrServingMarkerColor>();
  for (const ue of ues) {
    const satId = ue.servingSatelliteId;
    const beamId = ue.servingBeamId === '' ? null : Number(ue.servingBeamId);
    if (!isServed(satId, beamId)) {
      out.set(ue.id, {
        markerColor: SINR_SERVING_UNSERVED_COLOR,
        markerEmissive: SINR_SERVING_UNSERVED_EMISSIVE,
      });
      continue;
    }
    out.set(ue.id, mosaicColorForServingBeam(satId, beamId as number));
  }
  return out;
}

/**
 * Per-UE marker colours from the EARTH-FIXED CELL TRUTH (`sim.sinrLiveCells.ues`,
 * S-cells-4c). On the sinr-live lane the serving truth is the cell model, NOT the
 * steered lattice — a UE is "connected" (coloured) ONLY when its cell is lit and
 * served (`servingSatId !== null` AND a non-null `cellId`); an unserved UE (its cell
 * idle this hopping slot, or no cell) stays grey. Colour keys on the SERVING SATELLITE
 * ALONE (semantic-beam-colour SDD §5, owner Option A): the dots partition by sat, so an
 * INTER handover (serving-sat change) repartitions a dot's colour while an INTRA handover
 * (same sat, cell→cell) leaves it unchanged — the intra story now rides the cone's
 * releasing-orange→acquired-green flash, not the dot shade. `cellId` is still read for the
 * served/unserved gate (an unlit cell = grey), just no longer for the hue.
 */
export interface SinrServingCellUe {
  readonly ueId: string;
  readonly servingSatId: string | null;
  readonly cellId: number | null;
}

export function buildSinrServingUeColorMapFromCells(
  ues: ReadonlyArray<SinrServingCellUe>,
): Map<string, SinrServingMarkerColor> {
  const out = new Map<string, SinrServingMarkerColor>();
  for (const ue of ues) {
    if (ue.servingSatId === null || ue.servingSatId === '' || ue.cellId === null) {
      out.set(ue.ueId, {
        markerColor: SINR_SERVING_UNSERVED_COLOR,
        markerEmissive: SINR_SERVING_UNSERVED_EMISSIVE,
      });
      continue;
    }
    out.set(ue.ueId, mosaicColorForServingSatellite(ue.servingSatId));
  }
  return out;
}

/**
 * Aggregate readout (served N/N, per-beam load, mean served SINR) over the
 * published per-UE serving samples (`SimState.perUePositions` shape). All
 * counting is over real serving truth; this model never invents a serving or a
 * SINR value.
 */
export function deriveSinrServingMosaicAggregate(
  ues: ReadonlyArray<SinrServingMosaicUeInput>,
): SinrServingMosaicAggregate {
  if (ues.length === 0) return EMPTY_SINR_SERVING_MOSAIC_AGGREGATE;

  const loadByKey = new Map<string, { satId: string; beamId: number; count: number }>();
  let servedCount = 0;
  let sinrSum = 0;
  let sinrCount = 0;

  for (const ue of ues) {
    const unitId = servingUnitId(ue);
    if (!isServed(ue.servingSatId, unitId)) continue;
    servedCount += 1;
    const satId = ue.servingSatId as string;
    const beamId = unitId as number;
    const key = `${satId}:${beamId}`;
    const entry = loadByKey.get(key) ?? { satId, beamId, count: 0 };
    entry.count += 1;
    loadByKey.set(key, entry);
    if (ue.sinrDb !== null && Number.isFinite(ue.sinrDb)) {
      sinrSum += ue.sinrDb;
      sinrCount += 1;
    }
  }

  const beamLoads: SinrServingBeamLoad[] = [...loadByKey.entries()]
    .map(([key, value]) => ({
      key,
      satId: value.satId,
      beamId: value.beamId,
      count: value.count,
      // Keys/counts stay per-(sat,cell); the COLOUR is per-SATELLITE (Option A), the
      // same authority the 3D mosaic dots now use — so the HUD aggregate and the map
      // agree on one colour scheme (cross-surface pin, validate:s4:pun-retired).
      color: mosaicColorForServingSatellite(value.satId).markerColor,
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  return {
    servedCount,
    totalCount: ues.length,
    servingBeamCount: loadByKey.size,
    beamLoads,
    avgServedSinrDb: sinrCount > 0 ? sinrSum / sinrCount : null,
  };
}
