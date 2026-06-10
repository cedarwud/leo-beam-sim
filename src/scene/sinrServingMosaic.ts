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

export const SINR_LIVE_SERVICE_QUEUE_SOURCE = 'live-service-demo' as const;

export type SinrServiceQueueSource = typeof SINR_LIVE_SERVICE_QUEUE_SOURCE;

export interface SinrServiceQueueUeInput extends SinrServingMosaicUeInput {
  readonly id: string;
}

export interface SinrServiceQueueAccount {
  readonly ueId: string;
  readonly source: SinrServiceQueueSource;
  readonly trafficArrivalBits: number;
  readonly queueBeforeBits: number;
  readonly servedBits: number;
  readonly queueAfterBits: number;
  readonly serviceRateBps: number;
  /** 0..1 display pressure for dense-safe per-UE glow/halo encoding. */
  readonly pressure: number;
  readonly servingKey: string | null;
}

export interface SinrServiceQueueAggregate {
  readonly source: SinrServiceQueueSource;
  readonly totalUeCount: number;
  readonly queueCapableUeCount: number;
  readonly avgQueueBits: number;
  readonly p95QueueBits: number;
  readonly maxQueueBits: number;
  readonly starvedUeCount: number;
  readonly totalArrivalBits: number;
  readonly totalServedBits: number;
  readonly pressureBucketCount: number;
  readonly pressureHistogram: readonly number[];
}

export interface SinrServiceQueueModel {
  readonly source: SinrServiceQueueSource;
  readonly accounts: readonly SinrServiceQueueAccount[];
  readonly byUeId: ReadonlyMap<string, SinrServiceQueueAccount>;
  readonly aggregate: SinrServiceQueueAggregate;
}

export type SinrServiceQueueFocusStoryKind = 'highest-pressure' | 'best-rescue';

export interface SinrServiceQueueFocusStory {
  readonly kind: SinrServiceQueueFocusStoryKind;
  readonly source: SinrServiceQueueSource;
  readonly ueId: string;
  readonly queueBeforeBits: number;
  readonly trafficArrivalBits: number;
  readonly servedBits: number;
  readonly queueAfterBits: number;
  readonly serviceRateBps: number;
  /** Positive means backlog dropped over this sample. */
  readonly queueDeltaBits: number;
  /** Positive means service exceeded new arrivals over this sample. */
  readonly serviceSurplusBits: number;
  readonly pressure: number;
  readonly servingKey: string | null;
}

export interface SinrServiceQueueFocusStories {
  readonly source: SinrServiceQueueSource;
  readonly highestPressure: SinrServiceQueueFocusStory | null;
  readonly bestRescue: SinrServiceQueueFocusStory | null;
}

export const EMPTY_SINR_SERVING_MOSAIC_AGGREGATE: SinrServingMosaicAggregate = {
  servedCount: 0,
  totalCount: 0,
  servingBeamCount: 0,
  beamLoads: [],
  avgServedSinrDb: null,
};

export const EMPTY_SINR_SERVICE_QUEUE_AGGREGATE: SinrServiceQueueAggregate = {
  source: SINR_LIVE_SERVICE_QUEUE_SOURCE,
  totalUeCount: 0,
  queueCapableUeCount: 0,
  avgQueueBits: 0,
  p95QueueBits: 0,
  maxQueueBits: 0,
  starvedUeCount: 0,
  totalArrivalBits: 0,
  totalServedBits: 0,
  pressureBucketCount: 0,
  pressureHistogram: [],
};

export const EMPTY_SINR_SERVICE_QUEUE_MODEL: SinrServiceQueueModel = {
  source: SINR_LIVE_SERVICE_QUEUE_SOURCE,
  accounts: [],
  byUeId: new Map(),
  aggregate: EMPTY_SINR_SERVICE_QUEUE_AGGREGATE,
};

export const EMPTY_SINR_SERVICE_QUEUE_FOCUS_STORIES: SinrServiceQueueFocusStories = {
  source: SINR_LIVE_SERVICE_QUEUE_SOURCE,
  highestPressure: null,
  bestRescue: null,
};

const LIVE_SERVICE_DEMO_SAMPLE_SEC = 1;
const LIVE_SERVICE_DEMO_QUEUE_REFERENCE_BITS = 1_200_000;
const LIVE_SERVICE_DEMO_PRESSURE_HISTOGRAM_BUCKETS = 8;

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

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function percentileNearest(values: readonly number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(percentile * sorted.length) - 1),
  );
  return sorted[index];
}

function deriveDemoQueueAccount(ue: SinrServiceQueueUeInput): SinrServiceQueueAccount {
  const served = isServed(ue.servingSatId, ue.servingBeamId);
  const seed = hashStringToUnit(ue.id);
  const arrivalSeed = hashStringToUnit(`${ue.id}:arrival`);
  const sinrPressure = ue.sinrDb === null || !Number.isFinite(ue.sinrDb)
    ? 0.62
    : clamp01((12 - ue.sinrDb) / 24);
  const queueBeforeBits = Math.round(
    (0.12 + seed * 0.48 + sinrPressure * 0.32 + (served ? 0 : 0.22))
    * LIVE_SERVICE_DEMO_QUEUE_REFERENCE_BITS,
  );
  const trafficArrivalBits = Math.round(48_000 + arrivalSeed * 132_000);
  const serviceFactor = served
    ? clamp01(((ue.sinrDb ?? 0) + 5) / 28)
    : 0;
  const availableBits = queueBeforeBits + trafficArrivalBits;
  const servedBits = served
    ? Math.min(
      availableBits,
      Math.round(36_000 + serviceFactor * 260_000),
    )
    : 0;
  const queueAfterBits = Math.max(0, queueBeforeBits + trafficArrivalBits - servedBits);
  const pressure = clamp01(queueAfterBits / LIVE_SERVICE_DEMO_QUEUE_REFERENCE_BITS);
  const servingKey = served ? `${ue.servingSatId}:${ue.servingBeamId}` : null;

  return {
    ueId: ue.id,
    source: SINR_LIVE_SERVICE_QUEUE_SOURCE,
    trafficArrivalBits,
    queueBeforeBits,
    servedBits,
    queueAfterBits,
    serviceRateBps: Math.round(servedBits / LIVE_SERVICE_DEMO_SAMPLE_SEC),
    pressure,
    servingKey,
  };
}

function compareByUeId(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function queueFocusStory(
  account: SinrServiceQueueAccount,
  kind: SinrServiceQueueFocusStoryKind,
): SinrServiceQueueFocusStory {
  return {
    kind,
    source: account.source,
    ueId: account.ueId,
    queueBeforeBits: account.queueBeforeBits,
    trafficArrivalBits: account.trafficArrivalBits,
    servedBits: account.servedBits,
    queueAfterBits: account.queueAfterBits,
    serviceRateBps: account.serviceRateBps,
    queueDeltaBits: account.queueBeforeBits - account.queueAfterBits,
    serviceSurplusBits: account.servedBits - account.trafficArrivalBits,
    pressure: account.pressure,
    servingKey: account.servingKey,
  };
}

export function deriveSinrLiveServiceQueueFocusStories(
  accounts: readonly SinrServiceQueueAccount[],
): SinrServiceQueueFocusStories {
  if (accounts.length === 0) return EMPTY_SINR_SERVICE_QUEUE_FOCUS_STORIES;

  const highestPressure = [...accounts].sort((a, b) => (
    b.pressure - a.pressure
    || b.queueAfterBits - a.queueAfterBits
    || compareByUeId(a.ueId, b.ueId)
  ))[0] ?? null;

  const rescueCandidates = accounts.filter(account => (
    account.queueAfterBits < account.queueBeforeBits
    && account.servedBits > account.trafficArrivalBits
  ));
  const rescuePool = rescueCandidates.length > 0 ? rescueCandidates : accounts;
  const bestRescue = [...rescuePool].sort((a, b) => {
    const aSurplus = a.servedBits - a.trafficArrivalBits;
    const bSurplus = b.servedBits - b.trafficArrivalBits;
    const aDelta = a.queueBeforeBits - a.queueAfterBits;
    const bDelta = b.queueBeforeBits - b.queueAfterBits;
    return bSurplus - aSurplus
      || bDelta - aDelta
      || b.servedBits - a.servedBits
      || compareByUeId(a.ueId, b.ueId);
  })[0] ?? null;

  return {
    source: SINR_LIVE_SERVICE_QUEUE_SOURCE,
    highestPressure: highestPressure === null
      ? null
      : queueFocusStory(highestPressure, 'highest-pressure'),
    bestRescue: bestRescue === null
      ? null
      : queueFocusStory(bestRescue, 'best-rescue'),
  };
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
 * served (`servingSatId !== null`); an unserved UE (its cell idle this hopping slot)
 * stays grey. Colour keys on (servingSatId, cellId) so a UE crossing into a new
 * cell of the same sat shifts shade (intra-HO) and a serving-sat change jumps hue
 * (inter-HO) — the mosaic's "handover = a dot changes colour" contract, now on the
 * cell truth instead of the steered serving.
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
    out.set(ue.ueId, mosaicColorForServingBeam(ue.servingSatId, ue.cellId));
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

/**
 * Display-owned SINR-live queue accountant (S2a). This is intentionally labeled
 * `live-service-demo`: it provides dense-safe backlog pressure for the live
 * 100-UE demo and validates queue conservation, but it is NOT producer replay
 * truth and must never be mounted as MODQN proof.
 */
export function deriveSinrLiveServiceQueueModel(
  ues: ReadonlyArray<SinrServiceQueueUeInput>,
): SinrServiceQueueModel {
  if (ues.length === 0) return EMPTY_SINR_SERVICE_QUEUE_MODEL;

  const accounts = ues.map(deriveDemoQueueAccount);
  const queueAfterValues = accounts.map(account => account.queueAfterBits);
  const totalQueueAfterBits = queueAfterValues.reduce((sum, value) => sum + value, 0);
  const totalArrivalBits = accounts.reduce((sum, account) => sum + account.trafficArrivalBits, 0);
  const totalServedBits = accounts.reduce((sum, account) => sum + account.servedBits, 0);
  const starvedUeCount = accounts.filter(
    account => account.queueAfterBits > account.queueBeforeBits
      && account.servedBits < account.trafficArrivalBits,
  ).length;
  const pressureBucketCount = new Set(
    accounts.map(account => Math.round(account.pressure * 10)),
  ).size;
  const pressureHistogram = Array.from(
    { length: LIVE_SERVICE_DEMO_PRESSURE_HISTOGRAM_BUCKETS },
    () => 0,
  );
  for (const account of accounts) {
    const bucketIndex = Math.min(
      pressureHistogram.length - 1,
      Math.floor(account.pressure * pressureHistogram.length),
    );
    pressureHistogram[bucketIndex] += 1;
  }

  return {
    source: SINR_LIVE_SERVICE_QUEUE_SOURCE,
    accounts,
    byUeId: new Map(accounts.map(account => [account.ueId, account])),
    aggregate: {
      source: SINR_LIVE_SERVICE_QUEUE_SOURCE,
      totalUeCount: ues.length,
      queueCapableUeCount: accounts.length,
      avgQueueBits: totalQueueAfterBits / accounts.length,
      p95QueueBits: percentileNearest(queueAfterValues, 0.95),
      maxQueueBits: Math.max(...queueAfterValues),
      starvedUeCount,
      totalArrivalBits,
      totalServedBits,
      pressureBucketCount,
      pressureHistogram,
    },
  };
}
