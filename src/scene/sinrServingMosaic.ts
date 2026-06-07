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

/** Unserved marker colours — shared with the MODQN idle palette for coherence. */
export const SINR_SERVING_UNSERVED_COLOR = '#64748b';
export const SINR_SERVING_UNSERVED_EMISSIVE = '#334155';

const MOSAIC_SATURATION = 0.72;

export interface SinrServingMarkerColor {
  readonly markerColor: string;
  readonly markerEmissive: string;
}

export interface SinrServingMosaicUeInput {
  readonly servingSatId: string | null;
  readonly servingBeamId: number | null;
  readonly sinrDb: number | null;
}

export interface SinrServingBeamLoad {
  /** `${satId}:${beamId}` composite key. */
  readonly key: string;
  readonly satId: string;
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

/** FNV-1a string hash → [0, 1). Deterministic, display-order independent. */
function hashStringToUnit(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) % 1_000_000) / 1_000_000;
}

/** Pure HSL→hex (h,s,l in [0,1]); avoids a THREE dependency in the model. */
function hslToHex(h: number, s: number, l: number): string {
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number): string => {
    const k = (n + h * 12) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Stable, vivid marker colour for a serving (satId, beamId):
 * - the satellite identity drives the HUE FAMILY (stable string hash);
 * - the beam drives a small hue jitter + lightness step, so beams of the same
 *   satellite are a colour family (intra-HO = a shade shift) while a different
 *   satellite is a hue jump (inter-HO = a family change).
 */
export function mosaicColorForServingBeam(satId: string, beamId: number): SinrServingMarkerColor {
  const satHue = hashStringToUnit(satId);
  const beamMod = Math.abs(Math.trunc(beamId));
  const beamHueJitter = ((beamMod % 6) - 2.5) / 60; // ±~0.04 in hue space
  const hue = ((satHue + beamHueJitter) % 1 + 1) % 1;
  const lightness = 0.52 + (beamMod % 3) * 0.07; // 0.52 .. 0.66
  return {
    markerColor: hslToHex(hue, MOSAIC_SATURATION, lightness),
    markerEmissive: hslToHex(hue, MOSAIC_SATURATION, Math.max(0.28, lightness - 0.18)),
  };
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
    if (!isServed(ue.servingSatId, ue.servingBeamId)) continue;
    servedCount += 1;
    const satId = ue.servingSatId as string;
    const beamId = ue.servingBeamId as number;
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
      color: mosaicColorForServingBeam(value.satId, value.beamId).markerColor,
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
