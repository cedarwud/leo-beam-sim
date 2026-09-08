import type { PaperEnergyEfficiencyConfig } from '../profiles/types';

/**
 * A compact distribution summary used by the panel to explain an aggregate
 * number without pretending that one UE or one beam represents the scene.
 */
export interface PaperEnergyEfficiencySummary {
  readonly count: number;
  readonly min: number;
  readonly p05: number;
  readonly median: number;
  readonly p95: number;
  readonly max: number;
  readonly mean: number;
}

/**
 * The paper-style live readout. `coverageWeightedBitsPerJoule` is the headline
 * value: it averages the served-link rate/power contribution over ALL live
 * UEs, assigning zero to an unserved UE, matching the paper headline's
 * coverage weighting. `perServedUeBitsPerJoule` is the same numerator
 * conditional on the live served population.
 */
export interface PaperEnergyEfficiency {
  readonly coverageWeightedBitsPerJoule: number;
  readonly perServedUeBitsPerJoule: number;
  readonly bandwidthMHz: number;
  readonly frequencyReuse: number;
  readonly allocatedBandwidthHz: number;
  readonly totalUeCount: number;
  readonly servedUeCount: number;
  readonly finiteSinrServedUeCount: number;
  readonly coverageFraction: number;
  readonly loadSummary: PaperEnergyEfficiencySummary;
  readonly throughputSummaryBps: PaperEnergyEfficiencySummary;
  readonly sinrDbSummary: PaperEnergyEfficiencySummary | null;
  readonly powerSummaryW: PaperEnergyEfficiencySummary;
  readonly perUeRawPowerSummaryW: PaperEnergyEfficiencySummary;
  readonly publishedReferenceMbitsPerJoule: number;
}

export interface PaperEnergyEfficiencyInput {
  /** The same live cell frame consumed by the cones and SimState publisher. */
  readonly frame: {
    readonly ues: readonly PaperEnergyEfficiencyUe[];
  };
  readonly bandwidthMHz: number;
  readonly frequencyReuse: number;
  readonly powerSurface: PaperEnergyEfficiencyConfig | null | undefined;
}

/** Minimal live-cell projection required by the pure calculation. */
export interface PaperEnergyEfficiencyUe {
  readonly servingSatId: string | null;
  readonly cellId: number | null;
  readonly sinrDb: number | null;
}

function summarize(values: readonly number[]): PaperEnergyEfficiencySummary | null {
  if (values.length === 0 || values.some(value => !Number.isFinite(value))) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (fraction: number): number => {
    const position = (sorted.length - 1) * fraction;
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    if (lower === upper) return sorted[lower]!;
    const weight = position - lower;
    return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * weight;
  };
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return {
    count: values.length,
    min: sorted[0]!,
    p05: percentile(0.05),
    median: percentile(0.5),
    p95: percentile(0.95),
    max: sorted[sorted.length - 1]!,
    mean,
  };
}

function validPowerSurface(
  surface: PaperEnergyEfficiencyConfig | null | undefined,
): surface is PaperEnergyEfficiencyConfig {
  return surface !== null
    && surface !== undefined
    && Number.isFinite(surface.beamPowerBaseW)
    && surface.beamPowerBaseW >= 0
    && Number.isFinite(surface.beamPowerLoadScaleW)
    && surface.beamPowerLoadScaleW >= 0
    && Number.isFinite(surface.beamPowerLoadExponent)
    && surface.beamPowerLoadExponent >= 0
    && Number.isFinite(surface.beamPowerMaxW)
    && surface.beamPowerMaxW > 0
    && Number.isFinite(surface.publishedReferenceMbitsPerJoule)
    && surface.publishedReferenceMbitsPerJoule > 0;
}

/** Equation (3.37a): raw load-dependent per-beam transmit power in watts. */
export function computePaperBeamPowerW(
  load: number,
  surface: PaperEnergyEfficiencyConfig,
): number | null {
  if (!Number.isFinite(load) || load < 1 || !validPowerSurface(surface)) return null;
  const unclipped = surface.beamPowerBaseW
    + surface.beamPowerLoadScaleW * load ** surface.beamPowerLoadExponent;
  const powerW = Math.min(unclipped, surface.beamPowerMaxW);
  return Number.isFinite(powerW) && powerW > 0 ? powerW : null;
}

function beamKey(ue: Pick<PaperEnergyEfficiencyUe, 'servingSatId' | 'cellId'>): string | null {
  if (ue.servingSatId === null || ue.cellId === null) return null;
  return `${ue.servingSatId}#cell${ue.cellId}`;
}

/**
 * Compute the Chapter 5-style EE surface from live cell truth.
 *
 * This deliberately does not consume display-only service-map counts:
 * that projection is an `overlay-demo` claim. The live per-beam load is
 * measured here from the serving `(satellite, earth-fixed cell)` assignments
 * already carried by `SinrLiveCellFrame.ues`.
 */
export function computePaperEnergyEfficiency(
  input: PaperEnergyEfficiencyInput,
): PaperEnergyEfficiency | null {
  const { frame, bandwidthMHz, frequencyReuse, powerSurface } = input;
  if (!validPowerSurface(powerSurface)) return null;
  if (!Number.isFinite(bandwidthMHz) || bandwidthMHz <= 0) return null;
  if (!Number.isFinite(frequencyReuse) || frequencyReuse <= 0) return null;

  const totalUeCount = frame.ues.length;
  if (totalUeCount === 0) return null;

  const servedUes = frame.ues.filter(ue => beamKey(ue) !== null);
  if (servedUes.length === 0) return null;

  const loadByBeam = new Map<string, number>();
  for (const ue of servedUes) {
    const key = beamKey(ue)!;
    loadByBeam.set(key, (loadByBeam.get(key) ?? 0) + 1);
  }

  const loadValues = [...loadByBeam.values()];
  const powerValues = loadValues
    .map(load => computePaperBeamPowerW(load, powerSurface))
    .filter((powerW): powerW is number => powerW !== null);
  const loadSummary = summarize(loadValues);
  const powerSummaryW = summarize(powerValues);
  if (loadSummary === null || powerSummaryW === null) return null;

  const allocatedBandwidthHz = (bandwidthMHz * 1e6) / frequencyReuse;
  const perUeBitsPerJoule: number[] = [];
  const throughputValuesBps: number[] = [];
  const perUeRawPowerValuesW: number[] = [];
  const sinrValuesDb: number[] = [];
  let finiteSinrServedUeCount = 0;

  for (const ue of servedUes) {
    const load = loadByBeam.get(beamKey(ue)!)!;
    const powerW = computePaperBeamPowerW(load, powerSurface);
    if (powerW === null) {
      perUeBitsPerJoule.push(0);
      throughputValuesBps.push(0);
      perUeRawPowerValuesW.push(0);
      continue;
    }
    perUeRawPowerValuesW.push(powerW / load);

    if (ue.sinrDb === null || !Number.isFinite(ue.sinrDb)) {
      // The cell model keeps served-by-assignment UEs in the population even
      // when its beam-gain floor supplies no decodable SINR. Their rate is 0.
      perUeBitsPerJoule.push(0);
      throughputValuesBps.push(0);
      continue;
    }

    const sinrLinear = 10 ** (ue.sinrDb / 10);
    const rateBitsPerSec = Number.isFinite(sinrLinear)
      ? allocatedBandwidthHz * Math.log2(1 + Math.max(sinrLinear, 0))
      : 0;
    throughputValuesBps.push(Number.isFinite(rateBitsPerSec) ? rateBitsPerSec : 0);
    const bitsPerJoule = rateBitsPerSec / powerW;
    if (!Number.isFinite(bitsPerJoule)) {
      perUeBitsPerJoule.push(0);
      continue;
    }
    perUeBitsPerJoule.push(bitsPerJoule);
    sinrValuesDb.push(ue.sinrDb);
    finiteSinrServedUeCount += 1;
  }

  const totalBitsPerJoule = perUeBitsPerJoule.reduce((sum, value) => sum + value, 0);
  const perServedUeBitsPerJoule = totalBitsPerJoule / servedUes.length;
  const coverageFraction = servedUes.length / totalUeCount;
  const coverageWeightedBitsPerJoule = totalBitsPerJoule / totalUeCount;
  const throughputSummaryBps = summarize(throughputValuesBps);
  const perUeRawPowerSummaryW = summarize(perUeRawPowerValuesW);
  const sinrDbSummary = summarize(sinrValuesDb);
  if (
    !Number.isFinite(perServedUeBitsPerJoule)
    || !Number.isFinite(coverageFraction)
    || !Number.isFinite(coverageWeightedBitsPerJoule)
    || throughputSummaryBps === null
    || perUeRawPowerSummaryW === null
  ) {
    return null;
  }

  return {
    coverageWeightedBitsPerJoule,
    perServedUeBitsPerJoule,
    bandwidthMHz,
    frequencyReuse,
    allocatedBandwidthHz,
    totalUeCount,
    servedUeCount: servedUes.length,
    finiteSinrServedUeCount,
    coverageFraction,
    loadSummary,
    throughputSummaryBps,
    sinrDbSummary,
    powerSummaryW,
    perUeRawPowerSummaryW,
    publishedReferenceMbitsPerJoule: powerSurface.publishedReferenceMbitsPerJoule,
  };
}
