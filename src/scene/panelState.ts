import { MIN_VISIBLE_SINR_DB } from '../constants/sinr';
import type { LinkSample } from '../engine/signal/types';
import type {
  LinkBudgetTerms,
  SignalSourceState,
  SignalTruthStatus,
  SimState,
  VisualFrequencyDiagnosticsEntry,
  VisualFrequencyDiagnosticsState,
} from './types';
import { handoverDecisionBoundaryKey } from './handoverDecisionPublication';

// ============================================================================
// Latched state types — refs held by useSimStatePublisher per signal-source.
// Resolvers live below; see "Panel signal helpers and latched resolvers".
// ============================================================================

export interface LatchedSignalState {
  satId: string | null;
  beamId: number | null;
  sinrDb: number | null;
}
export interface LatchedTopoState {
  satId: string | null;
  beamId: number | null;
  elevationDeg: number | null;
  rangeKm: number | null;
}

export interface LatchedBudgetState {
  satId: string | null;
  beamId: number | null;
  budget: LinkBudgetTerms | null;
}

// ============================================================================
// Change detection helpers — feed `hasUiStateChanged` to decide whether the
// React UI snapshot needs to publish. Tolerances avoid jitter from
// floating-point noise.
// ============================================================================

function hasNumericDelta(
  previous: number | null,
  next: number | null,
  tolerance = 0.4,
): boolean {
  if (previous === null || next === null) return previous !== next;
  if (!Number.isFinite(previous) || !Number.isFinite(next)) return previous !== next;
  return Math.abs(previous - next) > tolerance;
}

function hasBudgetChanged(
  previous: LinkBudgetTerms | null,
  next: LinkBudgetTerms | null,
): boolean {
  if (!previous || !next) return previous !== next;
  return hasNumericDelta(previous.signalDbm, next.signalDbm, 0.2)
    || hasNumericDelta(previous.intraInterferenceDbm, next.intraInterferenceDbm, 0.2)
    || hasNumericDelta(previous.interInterferenceDbm, next.interInterferenceDbm, 0.2)
    || hasNumericDelta(previous.noiseDbm, next.noiseDbm, 0.2)
    || hasNumericDelta(previous.denominatorDbm, next.denominatorDbm, 0.2)
    || hasNumericDelta(previous.txPowerDbm, next.txPowerDbm, 0.2)
    || hasNumericDelta(previous.pathLossDb, next.pathLossDb, 0.2)
    || hasNumericDelta(previous.beamGainDb, next.beamGainDb, 0.2)
    || hasNumericDelta(previous.steeringLossDb, next.steeringLossDb, 0.2)
    || hasNumericDelta(previous.receiverGainDbi, next.receiverGainDbi, 0.2);
}

function hasSignalSourceChanged(previous: SignalSourceState, next: SignalSourceState): boolean {
  return previous.satId !== next.satId
    || previous.beamId !== next.beamId
    || previous.status !== next.status
    || hasNumericDelta(previous.sinrDb, next.sinrDb)
    || hasNumericDelta(previous.elevationDeg, next.elevationDeg)
    || hasNumericDelta(previous.rangeKm, next.rangeKm);
}

function hasSignalSourceIdentityChanged(previous: SignalSourceState, next: SignalSourceState): boolean {
  return previous.satId !== next.satId
    || previous.beamId !== next.beamId
    || previous.status !== next.status;
}

// ============================================================================
// Visual frequency diagnostics — frequency-reuse / provenance lookup keyed by
// beam, plus change detection for the resolved entries.
// ============================================================================

export function resolveVisualFrequencyDiagnosticsEntry(
  visualFrequencyByBeamKey: Map<string, {
    frequencyIndex: number;
    frequencyIndexSource: VisualFrequencyDiagnosticsEntry['frequencyIndexSource'];
    runtimeFrequencyReuse?: number;
    coreLayoutFrequencyReuse?: number;
  }>,
  satId: string | null,
  beamId: number | null,
): VisualFrequencyDiagnosticsEntry {
  if (!satId || beamId === null) {
    return {
      satId,
      beamId,
      frequencyIndex: null,
      frequencyIndexSource: 'not-visible',
      runtimeFrequencyReuse: null,
      coreLayoutFrequencyReuse: null,
    };
  }

  const metadata = visualFrequencyByBeamKey.get(`${satId}:B${beamId}`);
  if (!metadata) {
    return {
      satId,
      beamId,
      frequencyIndex: null,
      frequencyIndexSource: 'not-visible',
      runtimeFrequencyReuse: null,
      coreLayoutFrequencyReuse: null,
    };
  }

  return {
    satId,
    beamId,
    frequencyIndex: metadata.frequencyIndex,
    frequencyIndexSource: metadata.frequencyIndexSource,
    runtimeFrequencyReuse: metadata.runtimeFrequencyReuse ?? null,
    coreLayoutFrequencyReuse: metadata.coreLayoutFrequencyReuse ?? null,
  };
}

function hasVisualFrequencyDiagnosticsEntryChanged(
  previous: VisualFrequencyDiagnosticsEntry | undefined,
  next: VisualFrequencyDiagnosticsEntry | undefined,
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.satId !== next.satId
    || previous.beamId !== next.beamId
    || previous.frequencyIndex !== next.frequencyIndex
    || previous.frequencyIndexSource !== next.frequencyIndexSource
    || previous.runtimeFrequencyReuse !== next.runtimeFrequencyReuse
    || previous.coreLayoutFrequencyReuse !== next.coreLayoutFrequencyReuse;
}

function hasVisualFrequencyDiagnosticsChanged(
  previous: VisualFrequencyDiagnosticsState | undefined,
  next: VisualFrequencyDiagnosticsState | undefined,
): boolean {
  if (!previous || !next) return previous !== next;
  return hasVisualFrequencyDiagnosticsEntryChanged(previous.primary, next.primary)
    || hasVisualFrequencyDiagnosticsEntryChanged(previous.comparison, next.comparison);
}

function hasIntraHandoverPresentationChanged(
  previous: SimState['intraHandoverPresentation'],
  next: SimState['intraHandoverPresentation'],
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.ueId !== next.ueId
    || previous.sourceSatId !== next.sourceSatId
    || previous.sourceCellId !== next.sourceCellId
    || previous.targetCellId !== next.targetCellId
    || hasNumericDelta(previous.servingSinrDb, next.servingSinrDb)
    || hasNumericDelta(previous.candidateSinrDb, next.candidateSinrDb)
    || hasNumericDelta(previous.deltaSinrDb, next.deltaSinrDb)
    || hasNumericDelta(previous.elevationDeg, next.elevationDeg)
    || hasNumericDelta(previous.rangeKm, next.rangeKm);
}

function hasPaperEnergyEfficiencySummaryChanged(
  previous: NonNullable<SimState['livePaperEnergyEfficiency']>['loadSummary'] | null,
  next: NonNullable<SimState['livePaperEnergyEfficiency']>['loadSummary'] | null,
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.count !== next.count
    || hasNumericDelta(previous.min, next.min, 0.1)
    || hasNumericDelta(previous.median, next.median, 0.1)
    || hasNumericDelta(previous.p95, next.p95, 0.1)
    || hasNumericDelta(previous.max, next.max, 0.1)
    || hasNumericDelta(previous.mean, next.mean, 0.1);
}

function hasPaperEnergyEfficiencyChanged(
  previous: SimState['livePaperEnergyEfficiency'],
  next: SimState['livePaperEnergyEfficiency'],
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.totalUeCount !== next.totalUeCount
    || previous.servedUeCount !== next.servedUeCount
    || previous.finiteSinrServedUeCount !== next.finiteSinrServedUeCount
    || previous.publishedReferenceMbitsPerJoule !== next.publishedReferenceMbitsPerJoule
    || hasNumericDelta(previous.coverageFraction, next.coverageFraction, 0.005)
    || hasNumericDelta(
      previous.coverageWeightedBitsPerJoule,
      next.coverageWeightedBitsPerJoule,
      1000,
    )
    || hasNumericDelta(previous.perServedUeBitsPerJoule, next.perServedUeBitsPerJoule, 1000)
    || hasPaperEnergyEfficiencySummaryChanged(previous.loadSummary, next.loadSummary)
    || hasPaperEnergyEfficiencySummaryChanged(
      previous.throughputSummaryBps,
      next.throughputSummaryBps,
    )
    || hasPaperEnergyEfficiencySummaryChanged(previous.powerSummaryW, next.powerSummaryW)
    || hasPaperEnergyEfficiencySummaryChanged(
      previous.perUeRawPowerSummaryW,
      next.perUeRawPowerSummaryW,
    )
    || hasPaperEnergyEfficiencySummaryChanged(
      previous.sinrDbSummary,
      next.sinrDbSummary,
    );
}

function hasSatelliteVisualIdentityChanged(
  previous: SimState['satelliteVisualIdentityById'],
  next: SimState['satelliteVisualIdentityById'],
): boolean {
  const previousKeys = Object.keys(previous).sort();
  const nextKeys = Object.keys(next).sort();
  if (previousKeys.join(',') !== nextKeys.join(',')) return true;

  return nextKeys.some(key => {
    const previousEntry = previous[key];
    const nextEntry = next[key];
    return previousEntry?.satelliteTintColor !== nextEntry?.satelliteTintColor
      || previousEntry?.satelliteGlyph !== nextEntry?.satelliteGlyph
      || previousEntry?.satelliteVisualIndex !== nextEntry?.satelliteVisualIndex;
  });
}

function hasAngleAwareFormulaChanged(
  previous: SimState['angleAwareFormulaFrame'],
  next: SimState['angleAwareFormulaFrame'],
): boolean {
  if (!previous || !next) return previous !== next;
  const previousTerms = previous.terms;
  const nextTerms = next.terms;
  return previous.ueId !== next.ueId
    || previous.satId !== next.satId
    || previous.beamId !== next.beamId
    || hasNumericDelta(previousTerms.thetaRad, nextTerms.thetaRad, 0.0005)
    || hasNumericDelta(previousTerms.powerW, nextTerms.powerW, 1e-6)
    || hasNumericDelta(previousTerms.desiredSignalW, nextTerms.desiredSignalW, 1e-12)
    || hasNumericDelta(previousTerms.interferenceW, nextTerms.interferenceW, 1e-12)
    || hasNumericDelta(previousTerms.noiseW, nextTerms.noiseW, 1e-15)
    || hasNumericDelta(previousTerms.gammaDb, nextTerms.gammaDb, 0.05)
    || hasNumericDelta(previousTerms.throughputBps, nextTerms.throughputBps, 1)
    || hasNumericDelta(previousTerms.systemPowerW, nextTerms.systemPowerW, 1e-6)
    || hasNumericDelta(
      previousTerms.energyEfficiencyBitsPerJoule,
      nextTerms.energyEfficiencyBitsPerJoule,
      1,
    );
}

function hasAngleAwareFormulaIdentityChanged(
  previous: SimState['angleAwareFormulaFrame'],
  next: SimState['angleAwareFormulaFrame'],
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.ueId !== next.ueId
    || previous.satId !== next.satId
    || previous.beamId !== next.beamId;
}

function hasIntraHandoverPresentationIdentityChanged(
  previous: SimState['intraHandoverPresentation'],
  next: SimState['intraHandoverPresentation'],
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.ueId !== next.ueId
    || previous.sourceSatId !== next.sourceSatId
    || previous.sourceCellId !== next.sourceCellId
    || previous.targetCellId !== next.targetCellId;
}

function hasIntraHandoverEventIdentityChanged(
  previous: SimState['intraHandoverEvent'],
  next: SimState['intraHandoverEvent'],
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.satId !== next.satId
    || previous.fromBeamId !== next.fromBeamId
    || previous.toBeamId !== next.toBeamId
    || previous.wallClockStartMs !== next.wallClockStartMs
    || previous.wallClockExpiresMs !== next.wallClockExpiresMs;
}

function hasHandoverEventIdentityChanged(
  previous: SimState['lastHoEvent'],
  next: SimState['lastHoEvent'],
): boolean {
  if (!previous || !next) return previous !== next;
  return previous.timeMs !== next.timeMs
    || previous.action !== next.action
    || previous.fromSatId !== next.fromSatId
    || previous.fromBeamId !== next.fromBeamId
    || previous.toSatId !== next.toSatId
    || previous.toBeamId !== next.toBeamId;
}

/**
 * Return only the discrete boundaries that must reach the right rail immediately.
 * Numeric SINR/power/EE changes are intentionally excluded: those values are
 * published by the shared UI cadence so the reader can follow the movement.
 */
export function hasUiStateBoundaryChanged(previous: SimState | null, next: SimState): boolean {
  if (!previous) return true;
  return previous.profileId !== next.profileId
    || previous.formulaFamilyLabel !== next.formulaFamilyLabel
    || hasSatelliteVisualIdentityChanged(previous.satelliteVisualIdentityById, next.satelliteVisualIdentityById)
    || hasSignalSourceIdentityChanged(previous.physicalServing, next.physicalServing)
    || hasSignalSourceIdentityChanged(previous.panelPrimary, next.panelPrimary)
    || previous.panelPrimary.role !== next.panelPrimary.role
    || hasSignalSourceIdentityChanged(previous.panelComparison, next.panelComparison)
    || previous.panelComparison.role !== next.panelComparison.role
    || hasIntraHandoverPresentationIdentityChanged(
      previous.intraHandoverPresentation,
      next.intraHandoverPresentation,
    )
    || hasAngleAwareFormulaIdentityChanged(previous.angleAwareFormulaFrame, next.angleAwareFormulaFrame)
    || handoverDecisionBoundaryKey(previous.handoverDecisionFrame)
      !== handoverDecisionBoundaryKey(next.handoverDecisionFrame)
    || previous.acceptedHandoverPresentation?.snapshotId
      !== next.acceptedHandoverPresentation?.snapshotId
    || previous.visualFrequencyDiagnostics?.primary.satId !== next.visualFrequencyDiagnostics?.primary.satId
    || previous.visualFrequencyDiagnostics?.primary.beamId !== next.visualFrequencyDiagnostics?.primary.beamId
    || previous.visualFrequencyDiagnostics?.comparison.satId !== next.visualFrequencyDiagnostics?.comparison.satId
    || previous.visualFrequencyDiagnostics?.comparison.beamId !== next.visualFrequencyDiagnostics?.comparison.beamId
    || previous.servingSatId !== next.servingSatId
    || previous.servingBeamId !== next.servingBeamId
    || previous.servingCellId !== next.servingCellId
    || previous.pendingTargetSatId !== next.pendingTargetSatId
    || previous.pendingTargetBeamId !== next.pendingTargetBeamId
    || previous.comparisonSatId !== next.comparisonSatId
    || previous.comparisonBeamId !== next.comparisonBeamId
    || previous.comparisonKind !== next.comparisonKind
    || previous.recentHoSourceSatId !== next.recentHoSourceSatId
    || previous.recentHoTargetSatId !== next.recentHoTargetSatId
    || previous.recentHoSourceBeamId !== next.recentHoSourceBeamId
    || previous.recentHoTargetBeamId !== next.recentHoTargetBeamId
    || previous.hoCount !== next.hoCount
    || previous.intraHoCount !== next.intraHoCount
    || hasHandoverEventIdentityChanged(previous.lastHoEvent, next.lastHoEvent)
    || hasIntraHandoverEventIdentityChanged(previous.intraHandoverEvent, next.intraHandoverEvent)
    || (previous.physicalServingBudget === null) !== (next.physicalServingBudget === null)
    || (previous.servingBudget === null) !== (next.servingBudget === null)
    || previous.beamHopEnabled !== next.beamHopEnabled;
}

export interface UiStatePublishDecisionInput {
  readonly previous: SimState | null;
  readonly next: SimState;
  readonly nowMs: number;
  readonly lastUpdateAtMs: number;
  readonly intervalMs: number;
  readonly cursorReseat: boolean;
}

/** One shared cadence gate for all right-rail values. */
export function shouldPublishUiState(input: UiStatePublishDecisionInput): boolean {
  return input.previous === null
    || input.cursorReseat
    || hasUiStateBoundaryChanged(input.previous, input.next)
    || input.nowMs - input.lastUpdateAtMs >= input.intervalMs;
}

export function hasUiStateChanged(previous: SimState | null, next: SimState): boolean {
  if (!previous) return true;
  return previous.profileId !== next.profileId
    || previous.formulaFamilyLabel !== next.formulaFamilyLabel
    || hasSatelliteVisualIdentityChanged(previous.satelliteVisualIdentityById, next.satelliteVisualIdentityById)
    || hasAngleAwareFormulaChanged(previous.angleAwareFormulaFrame, next.angleAwareFormulaFrame)
    || previous.handoverDecisionFrame !== next.handoverDecisionFrame
    || previous.acceptedHandoverPresentation !== next.acceptedHandoverPresentation
    || hasSignalSourceChanged(previous.physicalServing, next.physicalServing)
    || hasSignalSourceChanged(previous.panelPrimary, next.panelPrimary)
    || previous.panelPrimary.role !== next.panelPrimary.role
    || hasSignalSourceChanged(previous.panelComparison, next.panelComparison)
    || previous.panelComparison.role !== next.panelComparison.role
    || hasIntraHandoverPresentationChanged(
      previous.intraHandoverPresentation,
      next.intraHandoverPresentation,
    )
    || hasVisualFrequencyDiagnosticsChanged(
      previous.visualFrequencyDiagnostics,
      next.visualFrequencyDiagnostics,
    )
    || hasPaperEnergyEfficiencyChanged(
      previous.livePaperEnergyEfficiency,
      next.livePaperEnergyEfficiency,
    )
    || hasPaperEnergyEfficiencyChanged(
      previous.ch5DemoPaperEnergyEfficiency,
      next.ch5DemoPaperEnergyEfficiency,
    )
    || previous.servingSatId !== next.servingSatId
    || previous.servingBeamId !== next.servingBeamId
    || previous.servingCellId !== next.servingCellId
    || previous.pendingTargetSatId !== next.pendingTargetSatId
    || previous.pendingTargetBeamId !== next.pendingTargetBeamId
    || previous.comparisonSatId !== next.comparisonSatId
    || previous.comparisonBeamId !== next.comparisonBeamId
    || previous.comparisonKind !== next.comparisonKind
    || previous.recentHoSourceSatId !== next.recentHoSourceSatId
    || previous.recentHoTargetSatId !== next.recentHoTargetSatId
    || previous.hoCount !== next.hoCount
    || previous.intraHoCount !== next.intraHoCount
    || previous.handoverOffsetDb !== next.handoverOffsetDb
    || previous.handoverTriggerSec !== next.handoverTriggerSec
    || previous.intraHandoverEvent?.satId !== next.intraHandoverEvent?.satId
    || previous.intraHandoverEvent?.fromBeamId !== next.intraHandoverEvent?.fromBeamId
    || previous.intraHandoverEvent?.toBeamId !== next.intraHandoverEvent?.toBeamId
    || previous.intraHandoverEvent?.wallClockStartMs !== next.intraHandoverEvent?.wallClockStartMs
    || previous.intraHandoverEvent?.wallClockExpiresMs !== next.intraHandoverEvent?.wallClockExpiresMs
    || hasNumericDelta(previous.sinrDb, next.sinrDb)
    || hasNumericDelta(previous.pendingTargetSinrDb, next.pendingTargetSinrDb)
    || hasNumericDelta(previous.comparisonSinrDb, next.comparisonSinrDb)
    || hasNumericDelta(previous.sinrDeltaDb, next.sinrDeltaDb)
    || hasBudgetChanged(previous.physicalServingBudget, next.physicalServingBudget)
    || hasBudgetChanged(previous.servingBudget, next.servingBudget)
    || previous.beamHopEnabled !== next.beamHopEnabled
    || previous.beamHopSlotIndex !== next.beamHopSlotIndex
    || previous.beamHopSlotSec !== next.beamHopSlotSec
    || previous.servingBeamActiveThisSlot !== next.servingBeamActiveThisSlot
    || previous.servingSatActiveBeamIds.join(',') !== next.servingSatActiveBeamIds.join(',')
    || previous.pendingTargetActiveBeamIds.join(',') !== next.pendingTargetActiveBeamIds.join(',');
}

// ============================================================================
// Panel signal helpers and latched resolvers — predicates plus the mutators
// that read/write the latched refs declared in `useLatchedSignals`.
// ============================================================================

export function isFinitePanelSinr(sinrDb: number | null): sinrDb is number {
  return sinrDb !== null && Number.isFinite(sinrDb) && sinrDb > MIN_VISIBLE_SINR_DB;
}

export function isFiniteBeamSinr(sinrDb: number | null | undefined): sinrDb is number {
  return sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb);
}

function isFinitePanelMetric(value: number | null): value is number {
  return value !== null && Number.isFinite(value);
}

export function resolveLatchedSinr(
  latched: LatchedSignalState,
  satId: string | null,
  beamId: number | null,
  nextSinrDb: number | null,
): number | null {
  if (!satId || beamId === null) {
    latched.satId = null;
    latched.beamId = null;
    latched.sinrDb = null;
    return null;
  }

  if (isFinitePanelSinr(nextSinrDb)) {
    latched.satId = satId;
    latched.beamId = beamId;
    latched.sinrDb = nextSinrDb;
    return nextSinrDb;
  }

  if (latched.satId === satId && latched.beamId === beamId) {
    return latched.sinrDb;
  }

  latched.satId = satId;
  latched.beamId = beamId;
  latched.sinrDb = null;
  return null;
}

export function resolveLatchedTopo(
  latched: LatchedTopoState,
  satId: string | null,
  beamId: number | null,
  nextElevationDeg: number | null,
  nextRangeKm: number | null,
): { elevationDeg: number | null; rangeKm: number | null } {
  if (!satId || beamId === null) {
    latched.satId = null;
    latched.beamId = null;
    latched.elevationDeg = null;
    latched.rangeKm = null;
    return { elevationDeg: null, rangeKm: null };
  }

  if (isFinitePanelMetric(nextElevationDeg) && isFinitePanelMetric(nextRangeKm)) {
    latched.satId = satId;
    latched.beamId = beamId;
    latched.elevationDeg = nextElevationDeg;
    latched.rangeKm = nextRangeKm;
    return { elevationDeg: nextElevationDeg, rangeKm: nextRangeKm };
  }

  if (latched.satId === satId && latched.beamId === beamId) {
    return { elevationDeg: latched.elevationDeg, rangeKm: latched.rangeKm };
  }

  latched.satId = satId;
  latched.beamId = beamId;
  latched.elevationDeg = null;
  latched.rangeKm = null;
  return { elevationDeg: null, rangeKm: null };
}

export function resolveLatchedBudget(
  latched: LatchedBudgetState,
  satId: string | null,
  beamId: number | null,
  nextBudget: LinkBudgetTerms | null,
): LinkBudgetTerms | null {
  if (!satId || beamId === null) {
    latched.satId = null;
    latched.beamId = null;
    latched.budget = null;
    return null;
  }

  if (nextBudget) {
    latched.satId = satId;
    latched.beamId = beamId;
    latched.budget = { ...nextBudget };
    return nextBudget;
  }

  if (latched.satId === satId && latched.beamId === beamId) {
    return latched.budget;
  }

  latched.satId = satId;
  latched.beamId = beamId;
  latched.budget = null;
  return null;
}

export function normalizePanelSignal(
  satId: string | null,
  beamId: number | null,
  sinrDb: number | null,
): { satId: string | null; beamId: number | null; sinrDb: number | null } {
  if (!satId || beamId === null) {
    return { satId: null, beamId: null, sinrDb: null };
  }
  return { satId, beamId, sinrDb };
}

export function resolveSignalStatus(
  satId: string | null,
  beamId: number | null,
  rawSinrDb: number | null,
  displayedSinrDb: number | null,
): SignalTruthStatus {
  if (!satId || beamId === null) return 'none';
  if (isFinitePanelSinr(rawSinrDb)) return 'live';
  if (displayedSinrDb !== null && Number.isFinite(displayedSinrDb)) return 'latched';
  return 'latched';
}

// ============================================================================
// Budget term extraction — flattens engine LinkSample into the UI budget shape.
// ============================================================================

export function extractBudgetTerms(sample: LinkSample | null): LinkBudgetTerms | null {
  if (!sample) return null;
  return {
    signalDbm: sample.signalDbm,
    intraInterferenceDbm: sample.intraInterferenceDbm,
    interInterferenceDbm: sample.interInterferenceDbm,
    noiseDbm: sample.noiseDbm,
    denominatorDbm: sample.denominatorDbm,
    txPowerDbm: sample.txPowerDbm,
    pathLossDb: sample.pathLossDb,
    beamGainDb: sample.beamGainDb,
    steeringLossDb: sample.steeringLossDb,
    receiverGainDbi: sample.receiverGainDbi,
  };
}
