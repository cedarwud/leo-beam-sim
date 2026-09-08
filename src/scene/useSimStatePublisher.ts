import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { getFormulaFamilyLabel } from '../profiles';
import { resolveMaxTxPowerDbm, type Profile } from '../profiles/types';
import type {
  PanelComparisonState,
  PanelPrimaryState,
  LinkBudgetTerms,
  SignalSourceState,
  SignalTruthStatus,
  SimFrame,
  SimState,
  CanonicalEeErrorCode,
  CanonicalEeSnapshot,
  IntraHandoverPresentation,
  VisualFrequencyDiagnosticsState,
  VizFrame,
} from './types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import {
  extractBudgetTerms,
  isFiniteBeamSinr,
  isFinitePanelSinr,
  normalizePanelSignal,
  resolveLatchedBudget,
  resolveLatchedSinr,
  resolveLatchedTopo,
  resolveSignalStatus,
  resolveVisualFrequencyDiagnosticsEntry,
  shouldPublishUiState,
} from './panelState';
import {
  resolvePrimaryCellServingRecord,
  type UeCellServingRecord,
} from './sinrLiveCellModel';
import {
  resolveSinrLiveBeamBudget,
  resolveSinrLivePhysicalRoleBeamCount,
} from './sinrLiveBeamBudget';
import { resolveSinrLiveBeamCapacityPerSat } from './sinrLiveCellRuntime';
import { computePaperEnergyEfficiency } from '../utils/paperEnergyEfficiency';
import { useLatchedSignals } from './useLatchedSignals';
import { usePanelModeInference } from './usePanelModeInference';
import {
  BeamshiftCanonicalEeAccumulator,
  BeamshiftCanonicalEeInputError,
  computeBeamshiftCanonicalEe,
  type BeamshiftCanonicalEeInput,
  type BeamshiftCanonicalInstantaneousEe,
  type BeamshiftCanonicalEvaluationSnapshot,
} from '../teaching/beamshiftCanonicalEe';
import {
  CanonicalEeInputError,
} from '../teaching/canonicalEnergyEfficiency';
import type { CandidateLinkKey } from '../engine/handover/candidateDecisionContract';
import {
  buildAcceptedHandoverPresentationSession,
  createHandoverPresentationPolicyConfigHash,
  type AcceptedHandoverPresentationSession,
  type AcceptedHandoverPresentationSnapshot,
} from './acceptedHandoverPresentationSnapshot';
import {
  resolveHomepageRenderAuthority,
} from '../homepage/controller/homepageRenderAuthority';
import {
  adaptHomepageSourceFrame,
  isHomepageSourceFrameJoinCurrent,
} from '../homepage/controller/sourceFrameAdapter';
import type { HomepageBeamMetricsProjection } from '../homepage/controller/contracts';

// P1d: this hook now receives `frame: NormalizedSceneFrame` and forwards it
// to `usePanelModeInference`. The bulk of the SimState publication still
// reads `sim: SimFrame` because it surfaces deep live-engine details
// (LinkBudgetTerms, latched signals) that have no replay equivalent — the
// replay path will mount a parallel state publisher driven by producer
// diagnostics. TODO P2: collapse the two publishers behind the
// NormalizedSceneFrame seam once the replay SimState shape stabilises.

// The right rail is a teaching readout, not a frame-by-frame oscilloscope. Keep
// a slower cadence for the stable field, but publish the decision lifecycle
// often enough that the short candidate interval cannot disappear at an
// accelerated playback rate.
const UI_STABLE_UPDATE_INTERVAL_MS = 1000;
const UI_HANDOVER_UPDATE_INTERVAL_MS = 1000;
const UI_DECISION_UPDATE_INTERVAL_MS = 200;
const UI_DECISION_UPDATE_MIN_INTERVAL_MS = 50;
// A forward simTimeSec jump larger than any single normal-play per-frame advance
// (even at the 5x base speed a frame steps well under 1 s) indicates a SEEK reseat,
// not playback. Paired with the backward check below it identifies a cursor
// discontinuity that must be published immediately (see the gate).
const SEEK_FORWARD_JUMP_SEC = 5;

type PublishedServingPair = Readonly<{
  satelliteId: string;
  beamId: number;
}>;

/**
 * Candidate-mode values may be published only when the decision identity,
 * serving record, and measured LinkSample all name the same atomic pair.
 * Keeping this join in one predicate prevents one UI surface from relabelling
 * a stale sample while another correctly fails closed.
 */
function recordAndSampleJoinServingPair(
  record: Pick<UeCellServingRecord, 'servingSatId' | 'servingBeamId' | 'servingLinkSample'> | null | undefined,
  serving: PublishedServingPair | null,
): boolean {
  const sample = record?.servingLinkSample ?? null;
  return serving !== null
    && record?.servingSatId === serving.satelliteId
    && (record.servingBeamId ?? null) === serving.beamId
    && sample?.satId === serving.satelliteId
    && sample.beamId === serving.beamId;
}

function dbmToWatts(dbm: number): number {
  return 10 ** ((dbm - 30) / 10);
}

export interface CanonicalEeInputResolution {
  readonly input: BeamshiftCanonicalEeInput | null;
  readonly configIdentity: string;
  readonly errorCode: CanonicalEeErrorCode | null;
}

/**
 * Resolve the producer input from the effective profile and the untouched live
 * cell frame. The profile's explicit `channel.maxTxPowerDbm` is the only
 * governed rated-cap source currently carried by this lane. `resolveMaxTxPowerDbm`
 * supplies the actual live control value, but its fallback is never promoted to
 * a rated cap when the source field is absent.
 */
export function resolveCanonicalEeInput(
  frame: NonNullable<SimFrame['sinrLiveCells']>,
  profile: Profile,
): CanonicalEeInputResolution {
  const actualRfOutputDbm = resolveMaxTxPowerDbm(profile.channel);
  const ratedSourceDbm = profile.channel.maxTxPowerDbm;
  const configIdentity = [
    profile.id,
    profile.channel.bandwidthMHz,
    profile.beams.frequencyReuse,
    actualRfOutputDbm,
    ratedSourceDbm ?? 'missing',
  ].join('|');

  if (ratedSourceDbm === undefined) {
    return {
      input: null,
      configIdentity,
      errorCode: 'MISSING_RATED_MAX_RF_OUTPUT',
    };
  }

  const ratedMaxRfOutputW = dbmToWatts(resolveMaxTxPowerDbm(profile.channel));
  if (!Number.isFinite(ratedMaxRfOutputW) || ratedMaxRfOutputW <= 0) {
    return {
      input: null,
      configIdentity,
      errorCode: 'INVALID_RATED_MAX_RF_OUTPUT',
    };
  }

  return {
    input: {
      frame,
      bandwidthMHz: profile.channel.bandwidthMHz,
      frequencyReuse: profile.beams.frequencyReuse,
      rfOutputPowerDbm: actualRfOutputDbm,
      ratedMaxRfOutputW,
    },
    configIdentity,
    errorCode: null,
  };
}

function canonicalErrorCode(error: unknown): CanonicalEeErrorCode {
  if (error instanceof BeamshiftCanonicalEeInputError) return error.code;
  if (error instanceof CanonicalEeInputError) return error.code;
  return 'INVALID_CANONICAL_CONFIG';
}

function projectCanonicalEeSnapshot(
  instantaneous: BeamshiftCanonicalInstantaneousEe,
  evaluationSampleCount: number,
  eeEvalMbitPerJ: number | null,
  evaluation: BeamshiftCanonicalEvaluationSnapshot | null,
  evaluationWindowStartSec: number | null,
): CanonicalEeSnapshot {
  const actualRfOutputW = instantaneous.rfOutputPowerDbm === Number.NEGATIVE_INFINITY
    ? 0
    : dbmToWatts(instantaneous.rfOutputPowerDbm);
  const servingBeamIdentity = instantaneous.users.find(
    user => user.satId !== null && user.cellId !== null,
  );
  return {
    status: instantaneous.status,
    sumIdentity: instantaneous.sumIdentity,
    systemPowerW: instantaneous.systemPowerW,
    eeInstMbitPerJ: instantaneous.eeInstMbitPerJ,
    contributionSumMbitPerJ: instantaneous.contributionSumMbitPerJ,
    eeEvalMbitPerJ,
    evaluationSampleCount,
    frameSimTimeSec: instantaneous.frameSimTimeSec,
    actualRfOutputW: Number.isFinite(actualRfOutputW) ? actualRfOutputW : null,
    ratedRfOutputW: Number.isFinite(instantaneous.ratedMaxRfOutputW)
      ? instantaneous.ratedMaxRfOutputW
      : null,
    evaluationDataMbit: evaluationSampleCount > 0 ? evaluation?.totalDataMbit ?? null : null,
    evaluationEnergyJ: evaluationSampleCount > 0 ? evaluation?.totalEnergyJ ?? null : null,
    evaluationWindowStartSec,
    evaluationWindowEndSec: evaluationSampleCount > 0
      ? evaluation?.lastFrameSimTimeSec ?? instantaneous.frameSimTimeSec
      : null,
    servingBeamIdentity: servingBeamIdentity !== undefined
      && servingBeamIdentity.satId !== null
      && servingBeamIdentity.cellId !== null
      ? `${servingBeamIdentity.satId}#cell${servingBeamIdentity.cellId}`
      : null,
    perUserContributions: instantaneous.users.map(user => ({
      ueId: user.ueId,
      status: user.status,
      satId: user.satId,
      cellId: user.cellId,
      beamIdentity: user.satId !== null && user.cellId !== null
        ? `${user.satId}#cell${user.cellId}`
        : null,
      assignedBeamLoad: user.assignedBeamLoad,
      allocatedBandwidthMHz: user.allocatedBandwidthMHz,
      sinrDb: user.sinrDb,
      rateMbps: user.rateMbps,
      contributionMbitPerJ: user.contributionMbitPerJ,
    })),
    errorCode: null,
  };
}

function invalidCanonicalEeSnapshot(errorCode: CanonicalEeErrorCode): CanonicalEeSnapshot {
  return {
    status: 'invalid',
    sumIdentity: null,
    systemPowerW: null,
    eeInstMbitPerJ: null,
    contributionSumMbitPerJ: null,
    eeEvalMbitPerJ: null,
    evaluationSampleCount: 0,
    frameSimTimeSec: null,
    actualRfOutputW: null,
    ratedRfOutputW: null,
    evaluationDataMbit: null,
    evaluationEnergyJ: null,
    evaluationWindowStartSec: null,
    evaluationWindowEndSec: null,
    servingBeamIdentity: null,
    perUserContributions: null,
    errorCode,
  };
}

function pendingCanonicalEeSnapshot(errorCode: CanonicalEeErrorCode | null): CanonicalEeSnapshot {
  return {
    status: 'pending',
    sumIdentity: null,
    systemPowerW: null,
    eeInstMbitPerJ: null,
    contributionSumMbitPerJ: null,
    eeEvalMbitPerJ: null,
    evaluationSampleCount: 0,
    frameSimTimeSec: null,
    actualRfOutputW: null,
    ratedRfOutputW: null,
    evaluationDataMbit: null,
    evaluationEnergyJ: null,
    evaluationWindowStartSec: null,
    evaluationWindowEndSec: null,
    servingBeamIdentity: null,
    perUserContributions: null,
    errorCode,
  };
}

/**
 * Stateful canonical measurement window owned by the publisher. It makes the
 * baseline, timestamp, seek, configuration, and fail-closed rules executable
 * without putting the full producer frame into React state.
 */
export class CanonicalEePublisherSession {
  private readonly accumulator = new BeamshiftCanonicalEeAccumulator();
  private previousSimTimeSec: number | null = null;
  private baselineRequired = true;
  private configIdentity: string | null = null;
  private seekRequestKey: string | undefined;
  private seekRequestKeyInitialized = false;
  private evaluationWindowStartSec: number | null = null;
  private snapshot: CanonicalEeSnapshot = pendingCanonicalEeSnapshot(null);

  getSnapshot(): CanonicalEeSnapshot {
    return this.snapshot;
  }

  resetWindow(): void {
    this.accumulator.reset();
    this.previousSimTimeSec = null;
    this.baselineRequired = true;
    this.evaluationWindowStartSec = null;
    this.snapshot = pendingCanonicalEeSnapshot(null);
  }

  private resetAndReanchor(simTimeSec?: number): void {
    this.accumulator.reset();
    this.previousSimTimeSec = null;
    this.baselineRequired = true;
    this.evaluationWindowStartSec = null;
    if (simTimeSec !== undefined && Number.isFinite(simTimeSec) && simTimeSec >= 0) {
      this.accumulator.seek(simTimeSec);
    }
  }

  private recordInvalid(simTimeSec: number | undefined, error: unknown): CanonicalEeSnapshot {
    this.resetAndReanchor(simTimeSec);
    this.previousSimTimeSec = typeof simTimeSec === 'number' && Number.isFinite(simTimeSec)
      ? simTimeSec
      : null;
    this.snapshot = invalidCanonicalEeSnapshot(canonicalErrorCode(error));
    return this.snapshot;
  }

  advance(
    resolution: CanonicalEeInputResolution,
    seekRequestKey?: string,
  ): CanonicalEeSnapshot {
    const configChanged = this.configIdentity !== null
      && this.configIdentity !== resolution.configIdentity;
    const seekChanged = this.seekRequestKeyInitialized
      && this.seekRequestKey !== seekRequestKey;
    this.configIdentity = resolution.configIdentity;
    this.seekRequestKey = seekRequestKey;
    this.seekRequestKeyInitialized = true;

    if (configChanged || seekChanged) {
      this.resetAndReanchor();
    }

    if (resolution.input === null) {
      this.resetAndReanchor();
      this.snapshot = pendingCanonicalEeSnapshot(resolution.errorCode);
      return this.snapshot;
    }

    const input = resolution.input;
    const simTimeSec = input.frame.simTimeSec;
    if (this.baselineRequired || this.previousSimTimeSec === null) {
      try {
        const instantaneous = computeBeamshiftCanonicalEe(input);
        this.previousSimTimeSec = simTimeSec;
        this.baselineRequired = false;
        this.snapshot = projectCanonicalEeSnapshot(instantaneous, 0, null, null, null);
        return this.snapshot;
      } catch (error) {
        return this.recordInvalid(simTimeSec, error);
      }
    }

    const dt = simTimeSec - this.previousSimTimeSec;
    if (dt === 0) return this.snapshot;

    if (!Number.isFinite(dt) || dt < 0) {
      this.resetAndReanchor(simTimeSec);
      try {
        const instantaneous = computeBeamshiftCanonicalEe(input);
        this.previousSimTimeSec = simTimeSec;
        this.baselineRequired = false;
        this.snapshot = projectCanonicalEeSnapshot(instantaneous, 0, null, null, null);
        return this.snapshot;
      } catch (error) {
        return this.recordInvalid(simTimeSec, error);
      }
    }

    try {
      const previousFrameTimeSec = this.previousSimTimeSec;
      const appended = this.accumulator.append(input, dt);
      this.previousSimTimeSec = simTimeSec;
      if (this.evaluationWindowStartSec === null) {
        this.evaluationWindowStartSec = previousFrameTimeSec;
      }
      this.snapshot = projectCanonicalEeSnapshot(
        appended.instantaneous,
        appended.evaluation.sampleCount,
        appended.evaluation.sampleCount > 0 ? appended.evaluation.eeEvalMbitPerJ : null,
        appended.evaluation,
        this.evaluationWindowStartSec,
      );
      return this.snapshot;
    } catch (error) {
      return this.recordInvalid(simTimeSec, error);
    }
  }
}

/**
 * The published per-UE serving projection — the ONE place the live frame's
 * per-UE serving truth becomes the `SimState.perUePositions` display record.
 *
 * S-cells-4c: on the sinr-live lane the published per-UE serving truth is the
 * EARTH-FIXED CELL model (`sim.sinrLiveCells`) so the aggregate HUD + per-UE
 * diagnostics agree with the cones — a UE is "served" only when its cell is lit
 * and served (servingSatId !== null). S4-2 pun retirement: the cell id remains
 * the typed membership `servingCellId`; the multi-candidate lane additionally
 * publishes its explicit Walker beam-surrogate id, while legacy cell-only
 * frames retain `servingBeamId: null`. Off that lane (no cell truth) the steered
 * per-UE serving is published unchanged with a null `servingCellId`.
 *
 * Exported as a pure function (S4-3) so the serving-equivalence gate drives the
 * REAL projection — the behavioural publisher-shape assert that replaces the
 * retired QUAR-S4-SERVING text needle (an alias-laundered re-pun is invisible
 * to source sweeps; only executing this code catches it).
 */
export function buildPublishedPerUePositions(
  sim: Pick<SimFrame, 'sinrLiveCells' | 'perUePositions' | 'handoverDecisionFrame'>,
): SimState['perUePositions'] {
  const cellTruthUes = sim.sinrLiveCells?.ues;
  const publishesAuthoritativePair = sim.handoverDecisionFrame !== null
    && sim.handoverDecisionFrame !== undefined;
  const primaryUeId = sim.sinrLiveCells?.primaryUeId ?? cellTruthUes?.[0]?.ueId ?? null;
  const authoritativeServing = publishesAuthoritativePair
    ? sim.handoverDecisionFrame?.serving ?? null
    : null;
  return cellTruthUes !== undefined
    ? (cellTruthUes.length > 1
      ? cellTruthUes.map(ue => {
        const isPrimary = publishesAuthoritativePair && ue.ueId === primaryUeId;
        const servingSatId = isPrimary ? authoritativeServing?.satelliteId ?? null : ue.servingSatId;
        const servingBeamId = publishesAuthoritativePair
          ? isPrimary ? authoritativeServing?.beamId ?? null : ue.servingBeamId ?? null
          : null;
        const recordJoinsDecision = !isPrimary
          || recordAndSampleJoinServingPair(ue, authoritativeServing);
        return {
          id: ue.ueId,
          servingSatId,
          servingBeamId,
          servingCellId: servingSatId === null ? null : ue.cellId,
          sinrDb: recordJoinsDecision ? ue.sinrDb : null,
        };
      })
      : undefined)
    : (sim.perUePositions.length > 1
      ? sim.perUePositions.map(position => ({
        id: position.id,
        servingSatId: position.servingSatId,
        servingBeamId: position.servingBeamId,
        servingCellId: null,
        sinrDb: position.sinrDb,
      }))
      : undefined);
}

/**
 * The published PRIMARY serving block — the ONE source of the InfoPanel
 * "ACTIVE SERVING" card and its comparison duel.
 *
 * S5-2b: on the sinr-live CELL lane (`sim.sinrLiveCells` present) the panel
 * primary is re-pointed to the CELL-TRUTH primary UE — the SAME
 * `resolvePrimaryCellServingRecord` the cones and the connected-sat invariant
 * read — so the labelled serving sat matches the rendered cones (the steered
 * `sim.serving` could name a DIFFERENT sat than the cones beam, the shipped
 * ~4/1883 label-vs-cone divergence).
 *
 * The cell model exposes NO per-UE candidate / second-best SINR. The only
 * steered candidate is measured under the candidate-rich profile's 40°/40 dBi
 * steered antenna while the
 * cell serving SINR is the 50°/33.5 dBi cell antenna at true off-axis (~6-10 dB
 * lower for the SAME sat). A delta across those two physics would routinely
 * cross the ~3 dB hysteresis offset and paint a FALSE "candidate better → HO
 * imminent" — so the comparison column + delta are SUPPRESSED to null on this
 * lane (single-model honesty; the cell-truth handover STORY lives in the cinema
 * + SinrOffsetExplainer, the lane's dedicated HO surface).
 *
 * Serving elevation/range (W6 2026-06-20): looked up from the CELL serving sat's
 * OWN topocentric point — NOT the steered (satId,beamId)-keyed latch, which would
 * return stale steered values on a satId match — via the optional `resolveServingGeo`
 * lookup the caller threads from `topoBySatId` + `linkRangeKmBySatId` (the SAME source
 * the steered path uses). Display-only: it fills two card fields and changes no
 * SINR/serving truth (the `s0:geometry-trace` golden snapshots SimFrame/VizFrame, not
 * these SimState fields, so no golden moves). When no lookup is provided (the pure unit
 * gate) they stay null. Off the cell lane the function returns the steered block
 * VERBATIM (byte-identical passthrough) so artifact-replay lanes are untouched.
 * Exported pure (S4-3 pattern) so `validate:s5:infopanel-cone-coupling` drives the REAL
 * re-point.
 */
export interface PublishedPrimaryServing {
  servingSatId: string | null;
  servingBeamId: number | null;
  servingCellId: number | null;
  servingSinrDb: number | null;
  servingElevationDeg: number | null;
  servingRangeKm: number | null;
  panelPrimary: PanelPrimaryState;
  comparisonSatId: string | null;
  comparisonBeamId: number | null;
  comparisonSinrDb: number | null;
  comparisonElevationDeg: number | null;
  comparisonRangeKm: number | null;
  comparisonKind: SimState['comparisonKind'];
  panelComparison: PanelComparisonState;
  sinrDeltaDb: number | null;
}

type SuppressedComparison = Pick<
  PublishedPrimaryServing,
  | 'comparisonSatId'
  | 'comparisonBeamId'
  | 'comparisonSinrDb'
  | 'comparisonElevationDeg'
  | 'comparisonRangeKm'
  | 'comparisonKind'
  | 'panelComparison'
  | 'sinrDeltaDb'
>;

// Cross-model delta hazard (see buildPublishedPrimaryServing): the comparison
// duel is fully neutralised on the cell lane. The DuelDecisionColumn null-guards
// sinrDeltaDb so the centre column shows '—' (never a false HO-imminent bar).
const SUPPRESSED_COMPARISON: SuppressedComparison = {
  comparisonSatId: null,
  comparisonBeamId: null,
  comparisonSinrDb: null,
  comparisonElevationDeg: null,
  comparisonRangeKm: null,
  comparisonKind: null,
  panelComparison: {
    role: 'none',
    satId: null,
    beamId: null,
    sinrDb: null,
    elevationDeg: null,
    rangeKm: null,
    status: 'none',
  },
  sinrDeltaDb: null,
};

export function buildPublishedPrimaryServing(
  sim: Pick<SimFrame, 'sinrLiveCells' | 'perUePositions' | 'handoverDecisionFrame'>,
  steered: PublishedPrimaryServing,
  // W6: resolve the CELL serving sat's elevation/range (from topoBySatId +
  // linkRangeKmBySatId at the call site). Optional so the pure unit gate can omit it.
  resolveServingGeo?: (satId: string) => { elevationDeg: number | null; rangeKm: number | null },
): PublishedPrimaryServing {
  const cellFrame = sim.sinrLiveCells;
  if (cellFrame === undefined) return steered; // off-lane: byte-identical steered passthrough.

  const record = resolvePrimaryCellServingRecord(cellFrame, sim.perUePositions);
  const publishesAuthoritativePair = sim.handoverDecisionFrame !== null
    && sim.handoverDecisionFrame !== undefined;
  const authoritativeServing = publishesAuthoritativePair
    ? sim.handoverDecisionFrame?.serving ?? null
    : null;
  if (
    record === null
    || (publishesAuthoritativePair ? authoritativeServing === null : record.servingSatId === null)
  ) {
    // Cell lane, primary UE unserved: blank primary + suppressed comparison.
    return {
      servingSatId: null,
      servingBeamId: null,
      servingCellId: null,
      servingSinrDb: null,
      servingElevationDeg: null,
      servingRangeKm: null,
      panelPrimary: {
        role: 'none',
        satId: null,
        beamId: null,
        sinrDb: null,
        elevationDeg: null,
        rangeKm: null,
        status: 'none',
      },
      ...SUPPRESSED_COMPARISON,
    };
  }

  const servingSatId = publishesAuthoritativePair
    ? authoritativeServing!.satelliteId
    : record.servingSatId!;
  const servingBeamId = publishesAuthoritativePair
    ? authoritativeServing!.beamId
    : null;
  const recordJoinsDecision = !publishesAuthoritativePair
    || recordAndSampleJoinServingPair(record, authoritativeServing);
  const sinrDb = recordJoinsDecision ? record.sinrDb : null;
  // Cell truth is the CURRENT per-frame off-axis SINR (never a stale latch): it
  // is 'live' when decodable, 'latched' only when below the beam-gain floor
  // (served-by-assignment, empirically never in the 37-cell config).
  const status: SignalTruthStatus = isFinitePanelSinr(sinrDb) ? 'live' : 'latched';
  // W6: real elevation/range for the cell serving sat (display-only); null when the
  // caller provides no lookup (the pure unit gate) — never fabricated.
  const geo = resolveServingGeo?.(servingSatId) ?? { elevationDeg: null, rangeKm: null };
  const linkElevationDeg = recordJoinsDecision
    ? record.servingLinkSample?.angleAware?.elevationDeg ?? geo.elevationDeg
    : geo.elevationDeg;
  // W7: the comparison contender = this UE's serving-cell best NON-serving candidate
  // (carried on the record from the cell model), in the SAME cell-truth model as serving —
  // so the Δ is single-model (NOT the steered candidate, which would recreate the W1
  // γ-mismatch). The role upgrades BEST CANDIDATE → PENDING TARGET when the cell
  // HandoverManager is mid-trigger (pendingTargetSatId). REPLACES SUPPRESSED_COMPARISON on
  // the SERVED cell branch (the unserved branch stays suppressed). Display-only (Rule#6).
  const comparisonSatId = record.comparisonSatId ?? null;
  const comparisonSinrDb = record.comparisonSinrDb ?? null;
  const hasComparison = !publishesAuthoritativePair
    && comparisonSatId !== null
    && comparisonSinrDb !== null
    && Number.isFinite(comparisonSinrDb);
  const comparisonGeo = hasComparison && comparisonSatId !== null
    ? resolveServingGeo?.(comparisonSatId) ?? { elevationDeg: null, rangeKm: null }
    : { elevationDeg: null, rangeKm: null };
  const isPendingComparison = hasComparison && (record.pendingTargetSatId ?? null) !== null;
  const comparisonStatus: SignalTruthStatus = !hasComparison
    ? 'none'
    : isFinitePanelSinr(comparisonSinrDb) ? 'live' : 'latched';
  const comparisonRole: PanelComparisonState['role'] = !hasComparison
    ? 'none'
    : isPendingComparison ? 'pending' : 'candidate';
  const sinrDeltaDb = hasComparison && comparisonSinrDb !== null && isFinitePanelSinr(sinrDb)
    ? comparisonSinrDb - sinrDb
    : null;
  return {
    servingSatId,
    servingBeamId,
    servingCellId: record.cellId,
    servingSinrDb: sinrDb,
    servingElevationDeg: linkElevationDeg,
    servingRangeKm: geo.rangeKm,
    panelPrimary: {
      role: 'serving',
      satId: servingSatId,
      beamId: servingBeamId,
      sinrDb,
      elevationDeg: linkElevationDeg,
      rangeKm: geo.rangeKm,
      status,
    },
    comparisonSatId: hasComparison ? comparisonSatId : null,
    comparisonBeamId: null,
    comparisonSinrDb: hasComparison ? comparisonSinrDb : null,
    comparisonElevationDeg: comparisonGeo.elevationDeg,
    comparisonRangeKm: comparisonGeo.rangeKm,
    comparisonKind: !hasComparison ? null : isPendingComparison ? 'pending' : 'candidate',
    panelComparison: {
      role: comparisonRole,
      satId: hasComparison ? comparisonSatId : null,
      beamId: null,
      sinrDb: hasComparison ? comparisonSinrDb : null,
      elevationDeg: comparisonGeo.elevationDeg,
      rangeKm: comparisonGeo.rangeKm,
      status: comparisonStatus,
    },
    sinrDeltaDb,
  };
}

/**
 * Publish the measured same-satellite alternate beam as a display-only
 * snapshot. The cell model deliberately keeps this out of its serving manager;
 * the snapshot is consumed only when the explicit intra teaching story is
 * armed, so it cannot create a hidden handover or alter canonical SINR truth.
 */
export function buildPublishedIntraHandoverPresentation(
  sim: Pick<SimFrame, 'sinrLiveCells' | 'perUePositions'>,
  resolveServingGeo?: (satId: string) => { elevationDeg: number | null; rangeKm: number | null },
): IntraHandoverPresentation | null {
  const record = sim.sinrLiveCells
    ? resolvePrimaryCellServingRecord(sim.sinrLiveCells, sim.perUePositions)
    : null;
  const servingSinrDb = record?.sinrDb ?? null;
  const candidateSinrDb = record?.intraCandidateSinrDb ?? null;
  const finiteServingSinrDb = Number.isFinite(servingSinrDb ?? NaN) ? servingSinrDb : null;
  const finiteCandidateSinrDb = Number.isFinite(candidateSinrDb ?? NaN) ? candidateSinrDb : null;
  const targetCellId = record?.intraCandidateCellId ?? null;
  const servingEe = record?.servingLinkSample?.angleAware?.energyEfficiencyBitsPerJoule ?? null;
  const candidateEe = record?.intraCandidateLinkSample?.angleAware?.energyEfficiencyBitsPerJoule ?? null;
  const hasServingEe = typeof servingEe === 'number' && Number.isFinite(servingEe) && servingEe >= 0;
  const hasCandidateEe = typeof candidateEe === 'number' && Number.isFinite(candidateEe) && candidateEe >= 0;
  if (
    record === null
    || record.ueId.length === 0
    || record.servingSatId === null
    || record.cellId === null
    || targetCellId === null
    || targetCellId === record.cellId
    || finiteServingSinrDb === null
    || finiteCandidateSinrDb === null
  ) return null;

  const geo = resolveServingGeo?.(record.servingSatId) ?? { elevationDeg: null, rangeKm: null };
  return {
    ueId: record.ueId,
    sourceSatId: record.servingSatId,
    sourceCellId: record.cellId,
    targetCellId,
    servingSinrDb: finiteServingSinrDb,
    candidateSinrDb: finiteCandidateSinrDb,
    deltaSinrDb: finiteCandidateSinrDb - finiteServingSinrDb,
    servingEnergyEfficiencyBitsPerJoule: hasServingEe ? servingEe : null,
    candidateEnergyEfficiencyBitsPerJoule: hasCandidateEe ? candidateEe : null,
    eeDecisionBasis: hasServingEe && hasCandidateEe
      ? 'instantaneous-ee-max'
      : 'sinr-compatibility-fallback',
    elevationDeg: geo.elevationDeg,
    rangeKm: geo.rangeKm,
  };
}

/**
 * Publish formula evidence from the same primary-UE cell-truth record as the
 * ACTIVE SERVING card.
 *
 * The steered lane keeps its existing source and latches byte-for-byte. Once
 * `sinrLiveCells` exists, however, the cell model is the only authority: its
 * `servingLinkSample` is the complete budget sample that produced the primary
 * UE's `sinrDb`. A missing sample is fail-closed so an old steered budget can
 * never masquerade as current cell-truth evidence.
 */
export interface PublishedFormulaEvidence {
  source: SignalSourceState;
  budget: LinkBudgetTerms | null;
}

export function buildPublishedFormulaEvidence(
  sim: Pick<SimFrame, 'sinrLiveCells' | 'perUePositions' | 'handoverDecisionFrame'>,
  steered: PublishedFormulaEvidence,
): PublishedFormulaEvidence {
  const cellFrame = sim.sinrLiveCells;
  if (cellFrame === undefined) return steered;

  const record = resolvePrimaryCellServingRecord(cellFrame, sim.perUePositions);
  const sample = record?.servingLinkSample ?? null;
  const publishesAuthoritativePair = sim.handoverDecisionFrame !== null
    && sim.handoverDecisionFrame !== undefined;
  const authoritativeServing = publishesAuthoritativePair
    ? sim.handoverDecisionFrame?.serving ?? null
    : null;
  const recordJoinsDecision = !publishesAuthoritativePair
    || recordAndSampleJoinServingPair(record, authoritativeServing);
  if (
    record === null
    || record === undefined
    || (publishesAuthoritativePair ? authoritativeServing === null : record.servingSatId === null)
    || record.cellId === null
    || sample === null
    || !recordJoinsDecision
  ) {
    return {
      source: {
        satId: null,
        beamId: null,
        sinrDb: null,
        elevationDeg: null,
        rangeKm: null,
        status: 'none',
      },
      budget: null,
    };
  }

  const sinrDb = record.sinrDb;
  const servingSatId = publishesAuthoritativePair
    ? authoritativeServing!.satelliteId
    : record.servingSatId;
  const servingBeamId = publishesAuthoritativePair ? authoritativeServing!.beamId : null;
  return {
    source: {
      // A beam id is published only when the top-level decision frame makes the
      // Walker cell surrogate an explicit, provenance-labelled handover key.
      // Legacy cell-only frames retain null and therefore preserve zero drift.
      satId: servingSatId,
      beamId: servingBeamId,
      sinrDb,
      elevationDeg: null,
      rangeKm: null,
      status: isFinitePanelSinr(sinrDb) ? 'live' : 'latched',
    },
    budget: extractBudgetTerms(sample),
  };
}

export function useSimStatePublisher({
  profile,
  sim,
  frame,
  viz,
  sourceEpochUtcMs,
  homepageControllerEnabled = false,
  playbackSpeed = 1,
  signalResetKey,
  handoverResetKey,
  measurementResetEpoch = 0,
  seekRequestKey,
  latchedBeamSinrByKeyRef,
  onSimUpdate,
  enabled = true,
  beamCountBySatellite = {},
  servingBeamCount,
  candidateBeamCount,
  candidateInspectionPinnedKey = null,
}: {
  profile: Profile;
  sim: SimFrame;
  frame: NormalizedSceneFrame;
  viz: VizFrame;
  /** Epoch identity supplied by the existing homepage live runtime. */
  sourceEpochUtcMs: number;
  /** Root `/` integration gate; other lanes retain their existing publisher. */
  homepageControllerEnabled?: boolean;
  /** Timeline speed is display-only; it lets the decision snapshot cadence
   * keep a candidate stage visible when playback is accelerated. */
  playbackSpeed?: number;
  signalResetKey?: string;
  handoverResetKey?: string;
  measurementResetEpoch?: number;
  seekRequestKey?: string;
  latchedBeamSinrByKeyRef: MutableRefObject<Map<string, number>>;
  onSimUpdate: (state: SimState) => void;
  enabled?: boolean;
  /** Presentation-only beam configuration shared with the legacy result rail. */
  beamCountBySatellite?: Readonly<Record<string, number>>;
  servingBeamCount?: number;
  candidateBeamCount?: number;
  candidateInspectionPinnedKey?: CandidateLinkKey | null;
}): AcceptedHandoverPresentationSession | null {
  const latched = useLatchedSignals({
    signalResetKey,
    handoverResetKey,
    beamSinrByKeyRef: latchedBeamSinrByKeyRef,
  });
  const inferPanelMode = usePanelModeInference({ signalResetKey, handoverResetKey });

  const lastUiUpdateAtRef = useRef(0);
  const lastUiStateRef = useRef<SimState | null>(null);
  const publishedProfileRef = useRef(profile);
  const profileChangeSourceFrameRef = useRef<SimFrame | null>(null);
  const canonicalEePublisherRef = useRef<CanonicalEePublisherSession | null>(null);
  if (canonicalEePublisherRef.current === null) {
    canonicalEePublisherRef.current = new CanonicalEePublisherSession();
  }
  // Previous effect-run sim cursor (updated every run below, NOT only when a frame
  // is published), to detect a SEEK / loop-wrap reseat — a discontinuous simTimeSec
  // jump vs the immediately preceding frame — and force that frame past the UI throttle.
  const prevSimTimeSecRef = useRef<number | null>(null);
  const previousAcceptedSnapshotRef = useRef<AcceptedHandoverPresentationSnapshot | null>(null);
  const previousHomepageBeamMetricsRef = useRef<HomepageBeamMetricsProjection | null>(null);
  const policyConfigHash = useMemo(
    () => createHandoverPresentationPolicyConfigHash(JSON.stringify(profile)),
    [profile],
  );
  // A topology/profile edit starts a new accepted-presentation epoch. The
  // publisher may render once with the old SimFrame before useSimulation emits
  // the recomputed frame, so do not hand a prior-policy snapshot to the strict
  // homepage adapter during that bridge render. The adapter must continue to
  // reject mismatched prior snapshots for direct callers; this is the runtime
  // boundary that deliberately drops the old presentation before delegation.
  const previousAcceptedSnapshotForCurrentPolicy =
    previousAcceptedSnapshotRef.current?.policyConfigHash === policyConfigHash
      ? previousAcceptedSnapshotRef.current
      : null;
  const homepageSourceFrame = useMemo(() => {
    if (!enabled || !homepageControllerEnabled) return null;
    if (!isHomepageSourceFrameJoinCurrent(sim, sourceEpochUtcMs)) return null;
    // The live cell model already stepped the canonical decision before this
    // publisher runs. The adapter carries that source identity forward; it
    // deliberately does not step another clock or decision engine here.
    return adaptHomepageSourceFrame({
      frame: sim,
      epochUtcMs: sourceEpochUtcMs,
      // The publisher is downstream of the live runtime and must not derive a
      // second clock. The canonical decision already carries its own source
      // time; this adapter field is metadata only for the snapshot seam.
      dtSec: 0,
    });
  }, [enabled, homepageControllerEnabled, sim, sourceEpochUtcMs]);
  // The accepted homepage snapshot and its same-frame EE projection are one
  // renderer-neutral authority. React retains the previous values around this
  // call, but it does not reconstruct either value itself.
  const homepageRenderAuthority = useMemo(
    () => homepageControllerEnabled
      ? resolveHomepageRenderAuthority({
        sourceFrame: enabled ? homepageSourceFrame : null,
        policyConfigHash,
        pinnedKey: candidateInspectionPinnedKey,
        previousSnapshot: previousAcceptedSnapshotForCurrentPolicy,
        previousMetrics: previousHomepageBeamMetricsRef.current,
        servingBeamCount,
        candidateBeamCount,
        profileBeamsPerSatellite: profile.beams.perSatellite,
        beamCountBySatellite,
        configuredBeamCount: resolveSinrLivePhysicalRoleBeamCount(
          servingBeamCount ?? profile.beams.perSatellite,
        ) ?? profile.beams.perSatellite,
      })
      : null,
    [
      candidateInspectionPinnedKey,
      beamCountBySatellite,
      candidateBeamCount,
      enabled,
      homepageControllerEnabled,
      homepageSourceFrame,
      policyConfigHash,
      previousAcceptedSnapshotForCurrentPolicy,
      profile.beams.perSatellite,
      servingBeamCount,
    ],
  );
  const acceptedHandoverPresentationSession = useMemo(() => {
    if (!enabled || sim.handoverDecisionFrame === null || sim.handoverDecisionFrame === undefined) {
      return null;
    }
    if (!homepageControllerEnabled) {
      const session = buildAcceptedHandoverPresentationSession({
        decision: sim.handoverDecisionFrame,
        policyConfigHash,
        pinnedKey: candidateInspectionPinnedKey,
        previousSnapshot: previousAcceptedSnapshotForCurrentPolicy,
      });
      if (session === null) return null;
      previousAcceptedSnapshotRef.current = session.snapshot;
      return session;
    }
    if (homepageSourceFrame === null || homepageSourceFrame.decision === null) {
      return null;
    }
    const session = homepageRenderAuthority?.session ?? null;
    if (session === null) return null;
    previousAcceptedSnapshotRef.current = session.snapshot;
    return session;
  }, [
    candidateInspectionPinnedKey,
    enabled,
    homepageControllerEnabled,
    homepageSourceFrame,
    previousAcceptedSnapshotForCurrentPolicy,
    policyConfigHash,
    profile.beams.perSatellite,
    sim.handoverDecisionFrame,
    homepageRenderAuthority,
  ]);
  // During one React render the runtime can expose the old SimFrame while the
  // decision model has already moved to the new identity. Keep the last
  // accepted homepage snapshot/metrics for that bridge; the strict adapter
  // above will resume publication as soon as the joins agree again.
  const acceptedHandoverPresentationSnapshotForRender = homepageControllerEnabled
    ? acceptedHandoverPresentationSession?.snapshot ?? previousAcceptedSnapshotForCurrentPolicy
    : acceptedHandoverPresentationSession?.snapshot ?? null;

  // In-place signal controls update `profile` without changing the structural
  // `signalResetKey`. While paused, useSimulation intentionally emits exactly
  // one recomputed frame; if that frame lands inside the one-second UI throttle
  // there is no later time frame to retry it. Reset the publication throttle on
  // every effective-profile change so the right rail cannot remain one control
  // edit behind the central selected-link callout.
  useEffect(() => {
    lastUiUpdateAtRef.current = 0;
    lastUiStateRef.current = null;
    previousHomepageBeamMetricsRef.current = null;
    if (publishedProfileRef.current !== profile) {
      publishedProfileRef.current = profile;
      // This effect runs before useSimulation publishes the one recomputed
      // paused frame. Remember the pre-edit object so the publication effect
      // below skips it and force-publishes the next object instead.
      profileChangeSourceFrameRef.current = sim;
    }
  }, [profile, signalResetKey, handoverResetKey, measurementResetEpoch, seekRequestKey]);

  useEffect(() => {
    canonicalEePublisherRef.current?.resetWindow();
  }, [measurementResetEpoch]);

  useEffect(() => {
    if (enabled) return;
    // A producer-backed replay lane does not publish canonical live samples.
    // Drop the live window so returning to the live lane starts at a baseline
    // instead of integrating across two unrelated scene sources.
    canonicalEePublisherRef.current?.resetWindow();
    prevSimTimeSecRef.current = null;
    lastUiUpdateAtRef.current = 0;
    const previous = lastUiStateRef.current;
    if (previous?.acceptedHandoverPresentation !== null
      && previous?.acceptedHandoverPresentation !== undefined) {
      const cleared = Object.freeze({
        ...previous,
        handoverDecisionFrame: null,
        acceptedHandoverPresentation: null,
      });
      lastUiStateRef.current = cleared;
      onSimUpdate(cleared);
    } else {
      lastUiStateRef.current = null;
    }
    previousAcceptedSnapshotRef.current = null;
    previousHomepageBeamMetricsRef.current = null;
  }, [enabled, onSimUpdate]);

  useEffect(() => {
    if (homepageControllerEnabled) return;
    previousHomepageBeamMetricsRef.current = null;
  }, [homepageControllerEnabled]);

  useEffect(() => {
    if (!enabled) return;

    const profileChangeSourceFrame = profileChangeSourceFrameRef.current;
    if (profileChangeSourceFrame === sim) {
      // The effective profile changed, but this is still the old frame returned
      // during that React render. Publishing it would restart the throttle just
      // before the recomputed paused frame arrives.
      return;
    }
    const profileFrameReseat = profileChangeSourceFrame !== null;
    if (profileFrameReseat) profileChangeSourceFrameRef.current = null;

    const topoBySatId = new Map(sim.satellites.map(sat => [sat.id, sat.topo]));
    const pendingTargetSinrDb = sim.pendingTargetSinrDb;
    const liveServingSinrDb = resolveLatchedSinr(
      latched.servingSinr.current,
      sim.serving.satId,
      sim.serving.beamId,
      sim.serving.sinrDb,
    );
    const physicalServingSignal = normalizePanelSignal(
      sim.serving.satId,
      sim.serving.beamId,
      liveServingSinrDb,
    );
    const physicalServingTopo = physicalServingSignal.satId
      ? topoBySatId.get(physicalServingSignal.satId)
      : undefined;
    const physicalServingRangeKm = physicalServingSignal.satId
      ? sim.linkRangeKmBySatId.get(physicalServingSignal.satId) ?? physicalServingTopo?.rangeKm ?? null
      : null;
    const normalizedPhysicalServingTopo = resolveLatchedTopo(
      latched.physicalServingTopo.current,
      physicalServingSignal.satId,
      physicalServingSignal.beamId,
      physicalServingTopo?.elevationDeg ?? null,
      physicalServingRangeKm,
    );
    const candidateComparisonSample = [...sim.linkSamples]
      .filter(sample => sample.satId !== sim.serving.satId)
      .sort((a, b) => b.sinrDb - a.sinrDb)[0] ?? null;
    const idleComparisonSinrDb = resolveLatchedSinr(
      latched.comparisonSinr.current,
      candidateComparisonSample?.satId ?? null,
      candidateComparisonSample?.beamId ?? null,
      candidateComparisonSample?.sinrDb ?? null,
    );

    const panelMode = inferPanelMode({
      frame,
      liveServingSinrDb,
      candidateComparisonSatId: candidateComparisonSample?.satId ?? null,
      candidateComparisonBeamId: candidateComparisonSample?.beamId ?? null,
      idleComparisonSinrDb,
    });

    const normalizedServing = normalizePanelSignal(
      panelMode.panelServingSatId,
      panelMode.panelServingBeamId,
      panelMode.panelServingSinrDb,
    );
    const normalizedComparison = normalizePanelSignal(
      panelMode.panelComparisonSatId,
      panelMode.panelComparisonBeamId,
      panelMode.panelComparisonSinrDb,
    );
    const servingTopo = normalizedServing.satId
      ? topoBySatId.get(normalizedServing.satId)
      : undefined;
    const comparisonTopo = normalizedComparison.satId
      ? topoBySatId.get(normalizedComparison.satId)
      : undefined;
    const servingRangeKm = normalizedServing.satId
      ? sim.linkRangeKmBySatId.get(normalizedServing.satId) ?? servingTopo?.rangeKm ?? null
      : null;
    const comparisonRangeKm = normalizedComparison.satId
      ? sim.linkRangeKmBySatId.get(normalizedComparison.satId) ?? comparisonTopo?.rangeKm ?? null
      : null;
    const normalizedServingTopo = resolveLatchedTopo(
      latched.servingTopo.current,
      normalizedServing.satId,
      normalizedServing.beamId,
      servingTopo?.elevationDeg ?? null,
      servingRangeKm,
    );
    const normalizedComparisonTopo = resolveLatchedTopo(
      latched.comparisonTopo.current,
      normalizedComparison.satId,
      normalizedComparison.beamId,
      comparisonTopo?.elevationDeg ?? null,
      comparisonRangeKm,
    );
    const visibleBeamKeys = new Set<string>();
    const pushVisibleBeamKey = (satId: string | null, beamId: number | null) => {
      if (!satId || beamId === null) return;
      visibleBeamKeys.add(`${satId}:${beamId}`);
    };

    for (const [satId, beamCells] of sim.beamCellsBySatId.entries()) {
      for (const beam of beamCells) {
        visibleBeamKeys.add(`${satId}:${beam.beamId}`);
      }
    }

    pushVisibleBeamKey(normalizedServing.satId, normalizedServing.beamId);
    pushVisibleBeamKey(normalizedComparison.satId, normalizedComparison.beamId);
    pushVisibleBeamKey(sim.pendingTargetSatId, sim.pendingTargetBeamId);
    pushVisibleBeamKey(sim.recentHoSourceSatId, sim.recentHoSourceBeamId);
    pushVisibleBeamKey(sim.recentHoTargetSatId, sim.recentHoTargetBeamId);

    const nextLatchedBeamSinrByKey = new Map<string, number>();
    for (const key of visibleBeamKeys) {
      const previousSinrDb = latchedBeamSinrByKeyRef.current.get(key);
      if (isFiniteBeamSinr(previousSinrDb)) {
        nextLatchedBeamSinrByKey.set(key, previousSinrDb);
      }
    }

    for (const sample of sim.linkSamples) {
      const key = `${sample.satId}:${sample.beamId}`;
      if (!visibleBeamKeys.has(key) || !isFiniteBeamSinr(sample.sinrDb)) continue;
      nextLatchedBeamSinrByKey.set(key, sample.sinrDb);
    }

    const syncLatchedBeamSinr = (
      satId: string | null,
      beamId: number | null,
      sinrDb: number | null,
    ) => {
      if (!satId || beamId === null || !isFiniteBeamSinr(sinrDb)) return;
      nextLatchedBeamSinrByKey.set(`${satId}:${beamId}`, sinrDb);
    };

    syncLatchedBeamSinr(normalizedServing.satId, normalizedServing.beamId, normalizedServing.sinrDb);
    syncLatchedBeamSinr(normalizedComparison.satId, normalizedComparison.beamId, normalizedComparison.sinrDb);
    latchedBeamSinrByKeyRef.current = nextLatchedBeamSinrByKey;

    const panelSinrDeltaDb =
      normalizedComparison.sinrDb !== null && normalizedServing.sinrDb !== null
        ? normalizedComparison.sinrDb - normalizedServing.sinrDb
        : null;
    const servingSatBeamHopState = physicalServingSignal.satId
      ? sim.beamHopStatesBySatId.get(physicalServingSignal.satId)
      : undefined;
    const pendingTargetBeamHopState = sim.pendingTargetSatId
      ? sim.beamHopStatesBySatId.get(sim.pendingTargetSatId)
      : undefined;
    const primaryCellRecord = sim.sinrLiveCells
      ? resolvePrimaryCellServingRecord(sim.sinrLiveCells, sim.perUePositions)
      : null;
    const displayServingSatId = primaryCellRecord?.servingSatId ?? null;
    const displayCandidateSatId = primaryCellRecord?.pendingTargetSatId
      ?? primaryCellRecord?.comparisonSatId
      ?? null;
    const displayServingRoleBeamCount = homepageControllerEnabled
      ? resolveSinrLivePhysicalRoleBeamCount(servingBeamCount)
      : servingBeamCount;
    const displayCandidateRoleBeamCount = homepageControllerEnabled
      ? resolveSinrLivePhysicalRoleBeamCount(candidateBeamCount)
      : candidateBeamCount;
    const displayBeamFallback = resolveSinrLiveBeamCapacityPerSat(profile);
    const displayServingBeamBudget = resolveSinrLiveBeamBudget({
      fallbackBeamCount: displayBeamFallback,
      satelliteId: displayServingSatId,
      roleBeamCount: displayServingRoleBeamCount,
      beamCountBySatellite,
    });
    const displayCandidateBeamBudget = resolveSinrLiveBeamBudget({
      fallbackBeamCount: displayBeamFallback,
      satelliteId: displayCandidateSatId,
      roleBeamCount: displayCandidateRoleBeamCount,
      beamCountBySatellite,
    });
    const beamDisplayServingActiveCount = sim.sinrLiveCells === undefined
      ? undefined
      : Math.min(
        displayServingBeamBudget,
        sim.sinrLiveCells.illuminatedBeams.filter(beam => (
          beam.satId === displayServingSatId && beam.serving
        )).length,
      );
    const beamDisplayCandidateActiveCount = sim.sinrLiveCells === undefined
      ? undefined
      : Math.min(
        displayCandidateBeamBudget,
        sim.sinrLiveCells.illuminatedBeams.filter(beam => (
          beam.satId === displayCandidateSatId
        )).length,
      );
    const servingBeamActiveThisSlot =
      physicalServingSignal.satId && physicalServingSignal.beamId !== null
        ? servingSatBeamHopState?.activeBeamIds.includes(physicalServingSignal.beamId) ?? false
        : null;
    const physicalServingSample = physicalServingSignal.satId && physicalServingSignal.beamId !== null
      ? sim.linkSamples.find(
        sample =>
          sample.satId === physicalServingSignal.satId
          && sample.beamId === physicalServingSignal.beamId,
      ) ?? null
      : null;
    const servingSample = normalizedServing.satId && normalizedServing.beamId !== null
      ? sim.linkSamples.find(
        sample =>
          sample.satId === normalizedServing.satId
          && sample.beamId === normalizedServing.beamId,
      ) ?? null
      : null;
    const physicalServingBudget = resolveLatchedBudget(
      latched.physicalServingBudget.current,
      physicalServingSignal.satId,
      physicalServingSignal.beamId,
      extractBudgetTerms(physicalServingSample),
    );
    const servingBudget = resolveLatchedBudget(
      latched.servingBudget.current,
      normalizedServing.satId,
      normalizedServing.beamId,
      extractBudgetTerms(servingSample),
    );
    const panelPrimaryRole: PanelPrimaryState['role'] = normalizedServing.satId
      ? panelMode.panelComparisonKind === 'recent-ho' ? 'ho-source' : 'serving'
      : 'none';
    const panelPrimaryStatus: SignalTruthStatus = panelPrimaryRole === 'ho-source'
      ? 'recent-ho'
      : resolveSignalStatus(
        normalizedServing.satId,
        normalizedServing.beamId,
        sim.serving.sinrDb,
        normalizedServing.sinrDb,
      );
    const panelComparisonRole: PanelComparisonState['role'] =
      normalizedComparison.satId === null
        ? 'none'
        : panelMode.panelComparisonKind === 'pending'
          ? 'pending'
          : panelMode.panelComparisonKind === 'recent-ho'
            ? 'ho-target'
            : 'candidate';
    const panelComparisonStatus: SignalTruthStatus =
      panelComparisonRole === 'none'
        ? 'none'
        : panelComparisonRole === 'ho-target'
          ? 'recent-ho'
          : panelComparisonRole === 'candidate'
            ? 'derived'
            : resolveSignalStatus(
              normalizedComparison.satId,
              normalizedComparison.beamId,
              pendingTargetSinrDb,
              normalizedComparison.sinrDb,
            );
    const physicalServing: SignalSourceState = {
      satId: physicalServingSignal.satId,
      beamId: physicalServingSignal.beamId,
      sinrDb: physicalServingSignal.sinrDb,
      elevationDeg: normalizedPhysicalServingTopo.elevationDeg,
      rangeKm: normalizedPhysicalServingTopo.rangeKm,
      status: resolveSignalStatus(
        physicalServingSignal.satId,
        physicalServingSignal.beamId,
        sim.serving.sinrDb,
        physicalServingSignal.sinrDb,
      ),
    };
    const publishedFormulaEvidence = buildPublishedFormulaEvidence(sim, {
      source: physicalServing,
      budget: physicalServingBudget,
    });
    const panelPrimary: PanelPrimaryState = {
      role: panelPrimaryRole,
      satId: normalizedServing.satId,
      beamId: normalizedServing.beamId,
      sinrDb: normalizedServing.sinrDb,
      elevationDeg: normalizedServingTopo.elevationDeg,
      rangeKm: normalizedServingTopo.rangeKm,
      status: panelPrimaryStatus,
    };
    const panelComparison: PanelComparisonState = {
      role: panelComparisonRole,
      satId: normalizedComparison.satId,
      beamId: normalizedComparison.beamId,
      sinrDb: normalizedComparison.sinrDb,
      elevationDeg: normalizedComparisonTopo.elevationDeg,
      rangeKm: normalizedComparisonTopo.rangeKm,
      status: panelComparisonStatus,
    };
    const satelliteVisualIdentityById = Object.fromEntries(
      viz.displaySats.flatMap(sat => {
        if (
          sat.satelliteTintColor === undefined
          || sat.satelliteGlyph === undefined
          || sat.satelliteVisualIndex === undefined
        ) {
          return [];
        }

        return [[sat.id, {
          satelliteTintColor: sat.satelliteTintColor,
          satelliteGlyph: sat.satelliteGlyph,
          satelliteVisualIndex: sat.satelliteVisualIndex,
        }]];
      }),
    );
    const visualFrequencyDiagnostics: VisualFrequencyDiagnosticsState = {
      primary: resolveVisualFrequencyDiagnosticsEntry(
        viz.visualFrequencyByBeamKey,
        normalizedServing.satId,
        normalizedServing.beamId,
      ),
      comparison: resolveVisualFrequencyDiagnosticsEntry(
        viz.visualFrequencyByBeamKey,
        normalizedComparison.satId,
        normalizedComparison.beamId,
      ),
    };
    // The per-UE serving projection lives in buildPublishedPerUePositions (the
    // pure exported function above) so the serving-equivalence gate executes
    // the same code path the UI publishes.
    const perUePositions = buildPublishedPerUePositions(sim);
    const livePaperEnergyEfficiency = sim.sinrLiveCells
      ? computePaperEnergyEfficiency({
        frame: sim.sinrLiveCells,
        bandwidthMHz: profile.channel.bandwidthMHz,
        frequencyReuse: profile.beams.frequencyReuse,
        powerSurface: profile.energyEfficiency?.paper,
      })
      : null;
    const ch5DemoPaperEnergyEfficiency = sim.sinrLiveCells && profile.energyEfficiency?.paper
      ? computePaperEnergyEfficiency({
        frame: sim.sinrLiveCells,
        bandwidthMHz: profile.energyEfficiency.paper.ch5DemoBandwidthMHz,
        frequencyReuse: profile.energyEfficiency.paper.ch5DemoFrequencyReuse,
        powerSurface: profile.energyEfficiency.paper,
      })
      : null;

    const canonicalEeInputResolution = sim.sinrLiveCells
      ? resolveCanonicalEeInput(sim.sinrLiveCells, profile)
      : null;
    const canonicalEe = canonicalEeInputResolution
      ? canonicalEePublisherRef.current!.advance(
        {
          ...canonicalEeInputResolution,
          // Geometry/handover reset keys identify the live canonical source
          // context even when B/K/P happen to remain numerically unchanged.
          configIdentity: [
            canonicalEeInputResolution.configIdentity,
            signalResetKey ?? '',
            handoverResetKey ?? '',
          ].join('|'),
        },
        seekRequestKey,
      )
      : (() => {
        canonicalEePublisherRef.current!.resetWindow();
        return canonicalEePublisherRef.current!.getSnapshot();
      })();

    // S5-2b: re-point the PUBLISHED primary serving (the InfoPanel "ACTIVE
    // SERVING" card) to the cell-truth primary UE on the sinr-live cell lane —
    // OVERRIDING the steered duel AFTER inferPanelMode so the pending/recent-ho
    // branches can never leak a cross-model delta. The formula evidence above
    // is re-pointed to the SAME cell-truth record; off the cell lane both
    // projections remain byte-identical steered passthroughs.
    const steeredPrimaryServing: PublishedPrimaryServing = {
      servingSatId: normalizedServing.satId,
      servingBeamId: normalizedServing.beamId,
      servingCellId: null,
      servingSinrDb: normalizedServing.sinrDb,
      servingElevationDeg: normalizedServingTopo.elevationDeg,
      servingRangeKm: normalizedServingTopo.rangeKm,
      panelPrimary,
      comparisonSatId: normalizedComparison.satId,
      comparisonBeamId: normalizedComparison.beamId,
      comparisonSinrDb: normalizedComparison.sinrDb,
      comparisonElevationDeg: normalizedComparisonTopo.elevationDeg,
      comparisonRangeKm: normalizedComparisonTopo.rangeKm,
      comparisonKind: normalizedComparison.satId ? panelMode.panelComparisonKind : null,
      panelComparison,
      sinrDeltaDb: panelSinrDeltaDb,
    };
    const publishedPrimaryServing = buildPublishedPrimaryServing(
      sim,
      steeredPrimaryServing,
      // W6: the cell serving sat's El/Range from the same topo + link-range source the
      // steered path uses (topoBySatId built above, sim.linkRangeKmBySatId).
      (satId) => {
        const topo = topoBySatId.get(satId);
        return {
          elevationDeg: topo?.elevationDeg ?? null,
          rangeKm: sim.linkRangeKmBySatId.get(satId) ?? topo?.rangeKm ?? null,
        };
      },
    );
    const publishedIntraHandoverPresentation = buildPublishedIntraHandoverPresentation(
      sim,
      (satId) => {
        const topo = topoBySatId.get(satId);
        return {
          elevationDeg: topo?.elevationDeg ?? null,
          rangeKm: sim.linkRangeKmBySatId.get(satId) ?? topo?.rangeKm ?? null,
        };
      },
    );

    const nextIntraHandoverEvent = sim.intraHandoverEvent !== null && sim.intraHandoverWallClockStartMs !== null && sim.intraHandoverWallClockExpiresMs !== null
      ? {
        ...sim.intraHandoverEvent,
        wallClockStartMs: sim.intraHandoverWallClockStartMs,
        wallClockExpiresMs: sim.intraHandoverWallClockExpiresMs,
      }
      : null;
    // The homepage live cell lane owns the visible candidate identity. The
    // legacy steered manager can compare a different satellite in parallel;
    // publishing that pending id made the right rail appear to switch targets
    // before the cell-truth TTT had actually started. Keep the steered value on
    // the other lanes, but expose only the cell lane's real pending target here.
    const publishedPendingTargetSatId = sim.sinrLiveCells
      ? primaryCellRecord?.pendingTargetSatId ?? null
      : sim.pendingTargetSatId;
    const publishedPendingTargetBeamId = sim.sinrLiveCells
      ? null
      : sim.pendingTargetBeamId;
    const publishedPendingTargetSinrDb = sim.sinrLiveCells
      ? primaryCellRecord?.pendingTargetSatId === null
        || primaryCellRecord?.pendingTargetSatId === undefined
        ? null
        : primaryCellRecord.comparisonSinrDb ?? null
      : pendingTargetSinrDb;
    const homepageBeamMetrics = homepageControllerEnabled
      ? homepageRenderAuthority?.beamMetrics ?? previousHomepageBeamMetricsRef.current
      : null;
    const nextState: SimState = {
      profileId: profile.id,
      formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
      satelliteVisualIdentityById,
      physicalServing: publishedFormulaEvidence.source,
      panelPrimary: publishedPrimaryServing.panelPrimary,
      panelComparison: publishedPrimaryServing.panelComparison,
      intraHandoverPresentation: publishedIntraHandoverPresentation,
      primaryUeId: sim.sinrLiveCells?.primaryUeId ?? null,
      visualFrequencyDiagnostics,
      perUePositions,
      livePaperEnergyEfficiency,
      ch5DemoPaperEnergyEfficiency,
      canonicalEe,
      homepageBeamMetrics,
      angleAwareFormulaFrame: sim.sinrLiveCells?.angleAwareFormulaFrame
        ?? sim.angleAwareFormulaFrame
        ?? null,
      handoverDecisionFrame: acceptedHandoverPresentationSnapshotForRender?.decision ?? null,
      acceptedHandoverPresentation: acceptedHandoverPresentationSnapshotForRender,
      servingSatId: publishedPrimaryServing.servingSatId,
      servingBeamId: publishedPrimaryServing.servingBeamId,
      servingCellId: publishedPrimaryServing.servingCellId,
      servingElevationDeg: publishedPrimaryServing.servingElevationDeg,
      servingRangeKm: publishedPrimaryServing.servingRangeKm,
      pendingTargetSatId: publishedPendingTargetSatId,
      pendingTargetBeamId: publishedPendingTargetBeamId,
      pendingTargetSinrDb: publishedPendingTargetSinrDb,
      comparisonSatId: publishedPrimaryServing.comparisonSatId,
      comparisonBeamId: publishedPrimaryServing.comparisonBeamId,
      comparisonElevationDeg: publishedPrimaryServing.comparisonElevationDeg,
      comparisonRangeKm: publishedPrimaryServing.comparisonRangeKm,
      comparisonSinrDb: publishedPrimaryServing.comparisonSinrDb,
      comparisonKind: publishedPrimaryServing.comparisonKind,
      intraHandoverEvent: nextIntraHandoverEvent,
      sinrDeltaDb: publishedPrimaryServing.sinrDeltaDb,
      recentHoSourceSatId: sim.recentHoSourceSatId,
      recentHoTargetSatId: sim.recentHoTargetSatId,
      recentHoSourceBeamId: sim.recentHoSourceBeamId,
      recentHoTargetBeamId: sim.recentHoTargetBeamId,
      recentHoDeltaDb: sim.recentHoDeltaDb,
      lastHoEvent: sim.lastHoEvent,
      simTimeSec: sim.simTimeSec,
      sinrDb: publishedPrimaryServing.servingSinrDb ?? -Infinity,
      physicalServingBudget: publishedFormulaEvidence.budget,
      // Keep the legacy second budget field aligned on the cell lane too. It is
      // not rendered directly, but leaving it steered would preserve a hidden
      // second formula authority for future consumers.
      servingBudget: sim.sinrLiveCells ? publishedFormulaEvidence.budget : servingBudget,
      handoverOffsetDb: profile.handover.offsetDb,
      // W7: on the cell lane show the CELL HandoverManager's trigger progress (so the
      // PENDING TARGET countdown matches the cell comparison) instead of the steered
      // manager's; off the cell lane keep the steered value.
      handoverTriggerProgressSec: sim.sinrLiveCells
        ? resolvePrimaryCellServingRecord(sim.sinrLiveCells, sim.perUePositions)?.triggerProgressSec ?? 0
        : sim.handoverTriggerProgressSec,
      handoverTriggerSec: profile.handover.triggerTimeSec,
      hoCount: sim.hoCount,
      intraHoCount: sim.intraHoCount,
      lastHoReason: sim.lastHoReason,
      beamHopEnabled: sim.beamHopEnabled,
      beamHopSlotIndex: sim.beamHopSlotIndex,
      beamHopSlotSec: sim.beamHopSlotSec,
      beamDisplayServingActiveCount,
      beamDisplayCandidateActiveCount,
      servingBeamActiveThisSlot,
      servingSatActiveBeamIds: servingSatBeamHopState?.activeBeamIds ?? [],
      pendingTargetActiveBeamIds: pendingTargetBeamHopState?.activeBeamIds ?? [],
    };
    const nowMs = performance.now();
    const decisionPhase = sim.handoverDecisionFrame?.phase;
    const decisionHandoverWindowActive = decisionPhase === 'evaluating'
      || decisionPhase === 'qualifying'
      || decisionPhase === 'selection-hold'
      || decisionPhase === 'switching';
    const handoverWindowActive =
      sim.pendingTargetSatId !== null
      || sim.recentHoSourceSatId !== null
      || sim.recentHoTargetSatId !== null
      || sim.intraHandoverEvent !== null
      || decisionHandoverWindowActive;
    const normalizedPlaybackSpeed = Number.isFinite(playbackSpeed) && playbackSpeed > 0
      ? playbackSpeed
      : 1;
    const decisionIntervalMs = Math.max(
      UI_DECISION_UPDATE_MIN_INTERVAL_MS,
      Math.min(UI_DECISION_UPDATE_INTERVAL_MS, UI_DECISION_UPDATE_INTERVAL_MS / normalizedPlaybackSpeed),
    );
    const uiIntervalMs = decisionHandoverWindowActive
      ? decisionIntervalMs
      : handoverWindowActive
      ? UI_HANDOVER_UPDATE_INTERVAL_MS
      : UI_STABLE_UPDATE_INTERVAL_MS;
    // A live SEEK (or loop-wrap) reseats the cursor discontinuously: backward by any
    // amount (normal playback is monotonic-forward) or forward beyond any per-frame
    // advance. That reseat frame carries the EXACT post-seek simTimeSec the Director
    // landing effect waits for, but within one serving epoch the boundary check is
    // false and the interval may not have elapsed, so the throttle would hide it —
    // stranding an armed intra-focus (small backward seek) at the bounded landing
    // band forever. Force-publish the reseat frame so the post-seek cursor always
    // reaches downstream. Display-only (Rule#6): this changes WHEN a real frame is
    // published, never WHAT it contains.
    const prevSimTimeSec = prevSimTimeSecRef.current;
    const cursorReseat = prevSimTimeSec !== null
      && (sim.simTimeSec < prevSimTimeSec - 1e-3
        || sim.simTimeSec > prevSimTimeSec + SEEK_FORWARD_JUMP_SEC);
    prevSimTimeSecRef.current = sim.simTimeSec;
    if (shouldPublishUiState({
      previous: lastUiStateRef.current,
      next: nextState,
      nowMs,
      lastUpdateAtMs: lastUiUpdateAtRef.current,
      intervalMs: uiIntervalMs,
      cursorReseat: cursorReseat || profileFrameReseat,
    })) {
      lastUiStateRef.current = nextState;
      lastUiUpdateAtRef.current = nowMs;
      onSimUpdate(nextState);
      // The smoothing baseline must be the last frame the UI actually received.
      // Updating this ref before the throttle let hidden source frames become
      // the next baseline, which made a visible row jump through several source
      // samples and then snap back on the next publish.
      if (nextState.homepageBeamMetrics !== null && nextState.homepageBeamMetrics !== undefined) {
        previousHomepageBeamMetricsRef.current = nextState.homepageBeamMetrics;
      }
    }
  }, [
    enabled,
    homepageControllerEnabled,
    homepageSourceFrame,
    handoverResetKey,
    measurementResetEpoch,
    playbackSpeed,
    onSimUpdate,
    profile,
    beamCountBySatellite,
    candidateBeamCount,
    acceptedHandoverPresentationSession,
    acceptedHandoverPresentationSnapshotForRender,
    servingBeamCount,
    seekRequestKey,
    signalResetKey,
    sim,
  ]);
  return acceptedHandoverPresentationSession;
}
