import { useEffect, useRef, type MutableRefObject } from 'react';
import { getFormulaFamilyLabel } from '../profiles';
import type { Profile } from '../profiles/types';
import type {
  PanelComparisonState,
  PanelPrimaryState,
  SignalSourceState,
  SignalTruthStatus,
  SimFrame,
  SimState,
  VisualFrequencyDiagnosticsState,
  VizFrame,
} from './types';
import type { NormalizedSceneFrame } from './NormalizedSceneFrame';
import {
  extractBudgetTerms,
  hasUiStateChanged,
  isFiniteBeamSinr,
  isFinitePanelSinr,
  normalizePanelSignal,
  resolveLatchedBudget,
  resolveLatchedSinr,
  resolveLatchedTopo,
  resolveSignalStatus,
  resolveVisualFrequencyDiagnosticsEntry,
} from './panelState';
import { resolvePrimaryCellServingRecord } from './sinrLiveCellModel';
import { useLatchedSignals } from './useLatchedSignals';
import { usePanelModeInference } from './usePanelModeInference';

// P1d: this hook now receives `frame: NormalizedSceneFrame` and forwards it
// to `usePanelModeInference`. The bulk of the SimState publication still
// reads `sim: SimFrame` because it surfaces deep live-engine details
// (LinkBudgetTerms, latched signals) that have no replay equivalent — the
// replay path will mount a parallel state publisher driven by producer
// diagnostics. TODO P2: collapse the two publishers behind the
// NormalizedSceneFrame seam once the replay SimState shape stabilises.

const UI_STABLE_UPDATE_INTERVAL_MS = 700;
const UI_HANDOVER_UPDATE_INTERVAL_MS = 250;

/**
 * The published per-UE serving projection — the ONE place the live frame's
 * per-UE serving truth becomes the `SimState.perUePositions` display record.
 *
 * S-cells-4c: on the sinr-live lane the published per-UE serving truth is the
 * EARTH-FIXED CELL model (`sim.sinrLiveCells`) so the aggregate HUD + per-UE
 * diagnostics agree with the cones — a UE is "served" only when its cell is lit
 * and served (servingSatId !== null). S4-2 pun retirement: the cell id is
 * published as the TYPED `servingCellId` and `servingBeamId` is null (there is
 * no steered beam under the cell model). Off that lane (no cell truth) the
 * steered per-UE serving is published unchanged with a null `servingCellId`.
 *
 * Exported as a pure function (S4-3) so the serving-equivalence gate drives the
 * REAL projection — the behavioural publisher-shape assert that replaces the
 * retired QUAR-S4-SERVING text needle (an alias-laundered re-pun is invisible
 * to source sweeps; only executing this code catches it).
 */
export function buildPublishedPerUePositions(
  sim: Pick<SimFrame, 'sinrLiveCells' | 'perUePositions'>,
): SimState['perUePositions'] {
  const cellTruthUes = sim.sinrLiveCells?.ues;
  return cellTruthUes !== undefined
    ? (cellTruthUes.length > 1
      ? cellTruthUes.map(ue => ({
        id: ue.ueId,
        servingSatId: ue.servingSatId,
        servingBeamId: null,
        servingCellId: ue.servingSatId === null ? null : ue.cellId,
        sinrDb: ue.sinrDb,
      }))
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
 * steered candidate is measured under the 12°/40 dBi steered antenna while the
 * cell serving SINR is the 50°/33.5 dBi cell antenna at true off-axis (~6-10 dB
 * lower for the SAME sat). A delta across those two physics would routinely
 * cross the ~3 dB hysteresis offset and paint a FALSE "candidate better → HO
 * imminent" — so the comparison column + delta are SUPPRESSED to null on this
 * lane (single-model honesty; the cell-truth handover STORY lives in the cinema
 * + SinrOffsetExplainer, the lane's dedicated HO surface).
 *
 * Serving elevation/range bypass the steered (satId,beamId)-keyed topo latch
 * (it would return stale steered values on a satId match) and publish null → the
 * card renders '—'; the cones/mosaic carry the geometry truth. Off the cell lane
 * the function returns the steered block VERBATIM (byte-identical passthrough) so
 * MODQN / artifact-replay lanes are untouched. Exported pure (S4-3 pattern) so
 * `validate:s5:infopanel-cone-coupling` drives the REAL re-point.
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
  sim: Pick<SimFrame, 'sinrLiveCells' | 'perUePositions'>,
  steered: PublishedPrimaryServing,
): PublishedPrimaryServing {
  const cellFrame = sim.sinrLiveCells;
  if (cellFrame === undefined) return steered; // off-lane: byte-identical steered passthrough.

  const record = resolvePrimaryCellServingRecord(cellFrame, sim.perUePositions);
  if (record === null || record.servingSatId === null) {
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

  const servingSatId = record.servingSatId;
  const sinrDb = record.sinrDb;
  // Cell truth is the CURRENT per-frame off-axis SINR (never a stale latch): it
  // is 'live' when decodable, 'latched' only when below the beam-gain floor
  // (served-by-assignment, empirically never in the 37-cell config).
  const status: SignalTruthStatus = isFinitePanelSinr(sinrDb) ? 'live' : 'latched';
  return {
    servingSatId,
    servingBeamId: null,
    servingCellId: record.cellId,
    servingSinrDb: sinrDb,
    servingElevationDeg: null,
    servingRangeKm: null,
    panelPrimary: {
      role: 'serving',
      satId: servingSatId,
      beamId: null,
      sinrDb,
      elevationDeg: null,
      rangeKm: null,
      status,
    },
    ...SUPPRESSED_COMPARISON,
  };
}

export function useSimStatePublisher({
  profile,
  sim,
  frame,
  viz,
  signalResetKey,
  handoverResetKey,
  latchedBeamSinrByKeyRef,
  onSimUpdate,
  enabled = true,
  modqnCellServiceReadout,
}: {
  profile: Profile;
  sim: SimFrame;
  frame: NormalizedSceneFrame;
  viz: VizFrame;
  signalResetKey?: string;
  handoverResetKey?: string;
  latchedBeamSinrByKeyRef: MutableRefObject<Map<string, number>>;
  onSimUpdate: (state: SimState) => void;
  enabled?: boolean;
  modqnCellServiceReadout?: SimState['modqnCellServiceReadout'];
}) {
  const latched = useLatchedSignals({
    signalResetKey,
    handoverResetKey,
    beamSinrByKeyRef: latchedBeamSinrByKeyRef,
  });
  const inferPanelMode = usePanelModeInference({ signalResetKey, handoverResetKey });

  const lastUiUpdateAtRef = useRef(0);
  const lastUiStateRef = useRef<SimState | null>(null);

  useEffect(() => {
    lastUiUpdateAtRef.current = 0;
    lastUiStateRef.current = null;
  }, [signalResetKey, handoverResetKey]);

  useEffect(() => {
    if (!enabled) return;

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

    // S5-2b: re-point the PUBLISHED primary serving (the InfoPanel "ACTIVE
    // SERVING" card) to the cell-truth primary UE on the sinr-live cell lane —
    // OVERRIDING the steered duel AFTER inferPanelMode so the pending/recent-ho
    // branches can never leak a cross-model delta. Off the cell lane this is a
    // byte-identical passthrough of the steered block assembled here. The
    // physicalServing / FormulaTermsReadout / budgets / latched-beam bookkeeping
    // above stay on their STEERED sources (intentional steered-physics
    // diagnostics; not the ACTIVE SERVING card).
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
    const publishedPrimaryServing = buildPublishedPrimaryServing(sim, steeredPrimaryServing);

    const nextIntraHandoverEvent = sim.intraHandoverEvent !== null && sim.intraHandoverWallClockStartMs !== null && sim.intraHandoverWallClockExpiresMs !== null
      ? {
        ...sim.intraHandoverEvent,
        wallClockStartMs: sim.intraHandoverWallClockStartMs,
        wallClockExpiresMs: sim.intraHandoverWallClockExpiresMs,
      }
      : null;

    const nextState: SimState = {
      profileId: profile.id,
      formulaFamilyLabel: getFormulaFamilyLabel(profile.formulaFamily),
      satelliteVisualIdentityById,
      physicalServing,
      panelPrimary: publishedPrimaryServing.panelPrimary,
      panelComparison: publishedPrimaryServing.panelComparison,
      visualFrequencyDiagnostics,
      perUePositions,
      modqnCellServiceReadout,
      servingSatId: publishedPrimaryServing.servingSatId,
      servingBeamId: publishedPrimaryServing.servingBeamId,
      servingCellId: publishedPrimaryServing.servingCellId,
      servingElevationDeg: publishedPrimaryServing.servingElevationDeg,
      servingRangeKm: publishedPrimaryServing.servingRangeKm,
      pendingTargetSatId: sim.pendingTargetSatId,
      pendingTargetBeamId: sim.pendingTargetBeamId,
      pendingTargetSinrDb,
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
      physicalServingBudget,
      servingBudget,
      handoverOffsetDb: profile.handover.offsetDb,
      handoverTriggerProgressSec: sim.handoverTriggerProgressSec,
      handoverTriggerSec: profile.handover.triggerTimeSec,
      hoCount: sim.hoCount,
      intraHoCount: sim.intraHoCount,
      lastHoReason: sim.lastHoReason,
      beamHopEnabled: sim.beamHopEnabled,
      beamHopSlotIndex: sim.beamHopSlotIndex,
      beamHopSlotSec: sim.beamHopSlotSec,
      servingBeamActiveThisSlot,
      servingSatActiveBeamIds: servingSatBeamHopState?.activeBeamIds ?? [],
      pendingTargetActiveBeamIds: pendingTargetBeamHopState?.activeBeamIds ?? [],
    };
    const nowMs = performance.now();
    const handoverWindowActive =
      sim.pendingTargetSatId !== null
      || sim.recentHoSourceSatId !== null
      || sim.recentHoTargetSatId !== null
      || sim.intraHandoverEvent !== null;
    const uiIntervalMs = handoverWindowActive
      ? UI_HANDOVER_UPDATE_INTERVAL_MS
      : UI_STABLE_UPDATE_INTERVAL_MS;
    if (
      hasUiStateChanged(lastUiStateRef.current, nextState)
      || nowMs - lastUiUpdateAtRef.current >= uiIntervalMs
    ) {
      lastUiStateRef.current = nextState;
      lastUiUpdateAtRef.current = nowMs;
      onSimUpdate(nextState);
    }
  }, [enabled, modqnCellServiceReadout, onSimUpdate, sim]);
}
