import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { UI_TOKENS } from '../constants/uiTokens';
import type { HandoverEvent } from '../engine/handover/types';
import type { Profile } from '../profiles/types';
import type { IntraHandoverEvent, SimState } from '../scene/types';
import { formatBeamIdentity, formatHandoverReason, formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import { formatFrequencyLabel } from '../utils/beamFrequency';
import type { UiMode } from './uiMode';
import {
  ModqnHandoverModeContext,
  type RuntimeHandoverMode,
  type RuntimeOmegaState,
} from './useModqnHandoverState';

// TODO P2: DiagnosticsDrawer still reads `profile` for many handover-policy
// fields (`offsetDb`, `pingPongGuardSec`, `intraSwitchTimeSec`, …) that have
// no SceneGeometry equivalent. SceneGeometry covers shell-altitude /
// beamwidth / frequency-reuse-count, but the bulk of the diagnostics panel
// surfaces deep live-engine policy config not present in the artifact.
// Replay path will mount a parallel diagnostics panel against producer
// `truthOwnership` / `diagnostics`.

type DiagnosticsDrawerProps = SimState & {
  uiMode: UiMode;
  profile: Profile;
  /** S3: current handover mode — shows re-scalarization fallback row when 'decision-overlay-on-live-sinr'. */
  handoverMode?: RuntimeHandoverMode;
  /** S3: count of ticks where user ω preferred out-of-topK and system fell back. */
  rescalarizeFallbackCount?: number;
};

type VisualFrequencyDiagnosticEntry = NonNullable<SimState['visualFrequencyDiagnostics']>['primary'];

function formatDb(value: number): string {
  return `${value.toFixed(1)} dB`;
}

function formatDbm(value: number): string {
  return `${value.toFixed(1)} dBm`;
}

function formatPanelBeamIdentity(
  satId: string | null,
  beamId: number | null,
  frequencyReuse: number,
  emptyLabel: string,
): string {
  if (!satId || beamId === null) return emptyLabel;
  return formatBeamIdentity({ satId, beamId, frequencyReuse });
}

function formatVisualFrequencyIndex(entry: VisualFrequencyDiagnosticEntry | undefined): string {
  if (!entry || entry.frequencyIndex === null) return '—';
  return formatFrequencyLabel(entry.frequencyIndex);
}

function formatVisualFrequencySource(entry: VisualFrequencyDiagnosticEntry | undefined): string {
  return entry?.frequencyIndexSource ?? 'not-visible';
}

function formatFrequencyReuseValue(value: number | null | undefined, prefix: string): string {
  return value === null || value === undefined ? '—' : `${prefix}=${value}`;
}

function DebugRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="leo-debug-row">
      <div className="leo-debug-row__label">{label}</div>
      <div className="leo-debug-row__value">{value}</div>
    </div>
  );
}

function DrawerSection({
  testId,
  tone,
  title,
  children,
}: {
  testId: string;
  tone: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="leo-drawer-section" data-testid={testId}>
      <div className="leo-drawer-section__title" style={{ color: tone }}>
        {title}
      </div>
      {children}
    </section>
  );
}

type DsinrBucketKey = 'lt1' | '1to2' | '2to4' | '4to8' | 'ge8';

interface DsinrHistogram {
  counts: Record<DsinrBucketKey, number>;
  total: number;
  sum: number;
  lastDelta: number | null;
}

const EMPTY_DSINR_HISTOGRAM: DsinrHistogram = {
  counts: { lt1: 0, '1to2': 0, '2to4': 0, '4to8': 0, ge8: 0 },
  total: 0,
  sum: 0,
  lastDelta: null,
};

function bucketDelta(delta: number): DsinrBucketKey {
  if (delta < 1) return 'lt1';
  if (delta < 2) return '1to2';
  if (delta < 4) return '2to4';
  if (delta < 8) return '4to8';
  return 'ge8';
}

const T2_LATCH_WINDOW_MS = 6000;

interface ObservedWindowAggregate {
  sumMs: number;
  count: number;
  lastMs: number | null;
}

const EMPTY_OBSERVED_WINDOW_AGGREGATE: ObservedWindowAggregate = {
  sumMs: 0,
  count: 0,
  lastMs: null,
};

type PublishedIntraHandoverEvent = NonNullable<SimState['intraHandoverEvent']> & IntraHandoverEvent;

function readPublishedIntraStart(event: PublishedIntraHandoverEvent | null): number | null {
  return event !== null ? event.wallClockStartMs : null;
}

export function DiagnosticsDrawer({
  uiMode,
  profile,
  handoverMode = 'sinr-offset',
  rescalarizeFallbackCount = 0,
  ...simState
}: DiagnosticsDrawerProps) {
  const {
    panelPrimary,
    panelComparison,
    visualFrequencyDiagnostics,
    recentHoSourceSatId,
    recentHoTargetSatId,
    physicalServingBudget,
    hoCount,
    intraHoCount,
    lastHoEvent,
    lastHoReason,
    intraHandoverEvent,
    simTimeSec,
    beamHopEnabled,
    beamHopSlotIndex,
    beamHopSlotSec,
    servingBeamActiveThisSlot,
    servingSatActiveBeamIds,
    pendingTargetActiveBeamIds,
  } = simState;
  const wallClockStartMsRef = useRef<number>(typeof performance === 'undefined' ? Date.now() : performance.now());
  const [wallClockNowMs, setWallClockNowMs] = useState<number>(() => typeof performance === 'undefined' ? Date.now() : performance.now());
  useEffect(() => {
    const id = setInterval(() => {
      setWallClockNowMs(typeof performance === 'undefined' ? Date.now() : performance.now());
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const wallClockElapsedSec = Math.max(0, (wallClockNowMs - wallClockStartMsRef.current) / 1000);
  const simMinElapsed = simTimeSec / 60;
  const intraHoPerSimMin = simMinElapsed > 0 ? intraHoCount / simMinElapsed : 0;
  const interHoCount = Math.max(0, hoCount - intraHoCount);
  const interHoPerSimMin = simMinElapsed > 0 ? interHoCount / simMinElapsed : 0;
  const prevHoEventRef = useRef<HandoverEvent | null | undefined>(undefined);
  const [dsinrHistogram, setDsinrHistogram] = useState<DsinrHistogram>(() => ({
    counts: { ...EMPTY_DSINR_HISTOGRAM.counts },
    total: 0,
    sum: 0,
    lastDelta: null,
  }));
  useEffect(() => {
    const event = lastHoEvent;
    if (prevHoEventRef.current === undefined) {
      prevHoEventRef.current = event;
      return;
    }
    if (prevHoEventRef.current === event) return;
    prevHoEventRef.current = event;
    if (event === null) return;
    if (event.action !== 'intra-switch') return;
    const delta = event.deltaDb;
    if (delta === null || !Number.isFinite(delta)) return;
    const bucket = bucketDelta(delta);
    setDsinrHistogram(prev => ({
      counts: { ...prev.counts, [bucket]: prev.counts[bucket] + 1 },
      total: prev.total + 1,
      sum: prev.sum + delta,
      lastDelta: delta,
    }));
  }, [lastHoEvent]);
  const dsinrMean = dsinrHistogram.total > 0 ? dsinrHistogram.sum / dsinrHistogram.total : null;
  const observedMountTimeRef = useRef<number>(typeof performance === 'undefined' ? Date.now() : performance.now());
  const prevIntraLatchStartRef = useRef<number | null | undefined>(undefined);
  const [observedAggregate, setObservedAggregate] = useState<ObservedWindowAggregate>(() => ({ ...EMPTY_OBSERVED_WINDOW_AGGREGATE }));
  useEffect(() => {
    const curStart = readPublishedIntraStart(intraHandoverEvent ?? null);
    if (prevIntraLatchStartRef.current === undefined) {
      // Baseline-on-first-render: do not finalize the in-flight latch (we did
      // not observe its start).
      prevIntraLatchStartRef.current = curStart;
      return;
    }
    if (prevIntraLatchStartRef.current === curStart) return;
    const prevStart = prevIntraLatchStartRef.current;
    prevIntraLatchStartRef.current = curStart;
    if (prevStart === null) return;
    if (prevStart < observedMountTimeRef.current) return;
    const endMs = typeof performance === 'undefined' ? Date.now() : performance.now();
    const observedMs = Math.min(T2_LATCH_WINDOW_MS, Math.max(0, endMs - prevStart));
    setObservedAggregate(prev => ({
      sumMs: prev.sumMs + observedMs,
      count: prev.count + 1,
      lastMs: observedMs,
    }));
  }, [intraHandoverEvent]);
  const observedMeanMs = observedAggregate.count > 0 ? observedAggregate.sumMs / observedAggregate.count : null;
  const observedPendingFlag: '0' | '1' = intraHandoverEvent !== null ? '1' : '0';
  const expanded = uiMode === 'diagnostics';
  const frequencyReuse = profile.beams.frequencyReuse;
  const beamPowerControl = profile.channel.beamPowerControl;
  const showDpcStatus =
    expanded
    && profile.formulaFamily === 'hobs-tr38811'
    && beamPowerControl !== undefined;
  const recentHoSourceIdentity = panelPrimary.role === 'ho-source'
    ? formatPanelBeamIdentity(panelPrimary.satId, panelPrimary.beamId, frequencyReuse, '—')
    : recentHoSourceSatId
      ? formatSatelliteLabel(recentHoSourceSatId)
      : '—';
  const recentHoTargetIdentity = panelComparison.role === 'ho-target'
    ? formatPanelBeamIdentity(panelComparison.satId, panelComparison.beamId, frequencyReuse, '—')
    : recentHoTargetSatId
      ? formatSatelliteLabel(recentHoTargetSatId)
      : '—';
  const recentHoText = recentHoSourceSatId || recentHoTargetSatId
    ? `${recentHoSourceIdentity} → ${recentHoTargetIdentity}`
    : '—';
  const currentEffectiveServingPt = physicalServingBudget?.txPowerDbm;
  const primaryFrequencyDiagnostics = visualFrequencyDiagnostics?.primary;
  const comparisonFrequencyDiagnostics = visualFrequencyDiagnostics?.comparison;

  if (!expanded) {
    return (
      <section
        className="leo-diagnostics-drawer"
        data-testid="diagnostics-drawer"
        data-drawer-state="collapsed"
        aria-label="Diagnostics drawer"
      >
        <div data-testid="diagnostics-drawer-tab">Diagnostics</div>
      </section>
    );
  }

  return (
    <section
      className="leo-diagnostics-drawer"
      data-testid="diagnostics-drawer"
      data-drawer-state="expanded"
      data-intra-ho-per-sim-min={intraHoPerSimMin.toFixed(4)}
      data-inter-ho-per-sim-min={interHoPerSimMin.toFixed(4)}
      data-sim-wallclock-elapsed-sec={wallClockElapsedSec.toFixed(4)}
      data-sim-time-sec={simTimeSec.toFixed(4)}
      data-intra-ho-count={String(intraHoCount)}
      data-ho-count={String(hoCount)}
      data-intra-dsinr-total={String(dsinrHistogram.total)}
      data-intra-dsinr-count-lt1={String(dsinrHistogram.counts.lt1)}
      data-intra-dsinr-count-1to2={String(dsinrHistogram.counts['1to2'])}
      data-intra-dsinr-count-2to4={String(dsinrHistogram.counts['2to4'])}
      data-intra-dsinr-count-4to8={String(dsinrHistogram.counts['4to8'])}
      data-intra-dsinr-count-ge8={String(dsinrHistogram.counts.ge8)}
      data-intra-dsinr-mean={dsinrMean === null ? '' : dsinrMean.toFixed(4)}
      data-intra-dsinr-last={dsinrHistogram.lastDelta === null ? '' : dsinrHistogram.lastDelta.toFixed(4)}
      data-intra-observed-count={String(observedAggregate.count)}
      data-intra-observed-mean-ms={observedMeanMs === null ? '' : observedMeanMs.toFixed(4)}
      data-intra-observed-last-ms={observedAggregate.lastMs === null ? '' : observedAggregate.lastMs.toFixed(4)}
      data-intra-observed-pending={observedPendingFlag}
      aria-label="Diagnostics drawer"
    >
      <div className="leo-diagnostics-drawer__body">
        <div className="leo-diagnostics-drawer__header">
          <div className="leo-diagnostics-drawer__heading">Diagnostics</div>
          <div
            className="leo-diagnostics-drawer__sub-heading"
            style={{ color: UI_TOKENS.color.semantic.info }}
          >
            drawer
          </div>
        </div>

        <DrawerSection
          testId="diagnostics-drawer-beam-hopping"
          tone={beamHopEnabled ? UI_TOKENS.color.semantic.good : UI_TOKENS.color.semantic.inactive}
          title="BEAM HOPPING"
        >
          <div className="leo-drawer-section__rows">
            <DebugRow
              label="Enabled"
              value={beamHopEnabled ? 'ON' : 'OFF'}
            />
            <DebugRow
              label="Slot ID"
              value={beamHopEnabled && beamHopSlotIndex >= 0 ? String(beamHopSlotIndex) : '—'}
            />
            <DebugRow
              label="Slot Sec"
              value={beamHopEnabled ? `${beamHopSlotSec.toFixed(2)} s` : 'disabled'}
            />
            <DebugRow
              label="Physical Serving Beam Active"
              value={servingBeamActiveThisSlot === null ? '—' : servingBeamActiveThisSlot ? 'yes' : 'no'}
            />
          </div>
        </DrawerSection>

        <DrawerSection
          testId="handover-policy-readout"
          tone={UI_TOKENS.color.semantic.fixed}
          title="Handover policy (effective)"
        >
          <div className="leo-drawer-section__rows">
            <DebugRow label="policy" value={`${profile.handover.policy} (read-only)`} />
            <DebugRow label="Offset margin" value={formatDb(profile.handover.offsetDb)} />
            <DebugRow label="Trigger time" value={`${profile.handover.triggerTimeSec.toFixed(1)} s`} />
            <DebugRow label="Ping-pong guard" value={`${profile.handover.pingPongGuardSec.toFixed(1)} s`} />
            <DebugRow label="Decision smoothing" value={`${profile.handover.sinrSmoothingSec.toFixed(1)} s`} />
            <DebugRow label="Same-sat dwell" value={`${profile.handover.intraSwitchTimeSec.toFixed(1)} s`} />
            <DebugRow
              label="Intra-HO epoch limit"
              value={`${profile.handover.maxIntraSwitchesPerServingEpoch} ${
                profile.handover.maxIntraSwitchesPerServingEpoch === 1 ? 'switch' : 'switches'
              }`}
            />
            <DebugRow label="Pending hold" value={`${profile.handover.pendingTargetHoldSec.toFixed(1)} s`} />
            <DebugRow label="Handover attach threshold" value={formatDb(profile.handover.sinrThresholdDb)} />
          </div>
        </DrawerSection>

        {showDpcStatus && beamPowerControl && (
          <DrawerSection
            testId="dpc-status-block"
            tone={UI_TOKENS.color.semantic.tuning}
            title="DPC: research power policy"
          >
            <div className="leo-drawer-section__note">
              This is a TR 38.811-gated research power policy. Enabled only for HOBS + TR 38.811 research profile. Base P_t remains the Tuning control; DPC may override per-beam P_{'{n,m}'}(t).
            </div>
            <div className="leo-drawer-section__rows">
              <DebugRow label="Gate" value="HOBS + TR 38.811 research profile" />
              <DebugRow label="Update Period" value={`${beamPowerControl.updatePeriodSec.toFixed(2)} s`} />
              <DebugRow label="Step Size" value={formatDb(beamPowerControl.stepDb)} />
              <DebugRow label="Min Effective" value={formatDbm(beamPowerControl.minTxPowerDbm)} />
              <DebugRow label="Max / Clamp" value={`${formatDbm(profile.channel.maxTxPowerDbm)} base P_t clamp`} />
              <DebugRow label="SINR Threshold" value={formatDb(beamPowerControl.sinrThresholdDb)} />
              <DebugRow
                label="Serving P_t"
                value={currentEffectiveServingPt === undefined
                  ? 'missing from current LinkBudgetTerms'
                  : `${formatDbm(currentEffectiveServingPt)} physical-serving effective P_t`}
              />
            </div>
          </DrawerSection>
        )}

        <DrawerSection
          testId="diagnostics-drawer-debug-validation"
          tone={UI_TOKENS.color.text.faint}
          title="DEBUG / VALIDATION"
        >
          <div className="leo-drawer-section__rows">
            <DebugRow
              label="Serving IDs"
              value={servingSatActiveBeamIds.length ? servingSatActiveBeamIds.join(', ') : '—'}
            />
            <DebugRow
              label="Pending IDs"
              value={pendingTargetActiveBeamIds.length ? pendingTargetActiveBeamIds.join(', ') : '—'}
            />
            <DebugRow label="Recent HO" value={recentHoText} />
            <DebugRow label="HO Count" value={String(hoCount)} />
            <DebugRow label="Intra-switch" value={String(intraHoCount)} />
            <DebugRow label="Intra/sim-min" value={intraHoPerSimMin.toFixed(2)} />
            <DebugRow label="Inter/sim-min" value={interHoPerSimMin.toFixed(2)} />
            <DebugRow label="Wall-clock elapsed" value={`${wallClockElapsedSec.toFixed(1)} s`} />
            <DebugRow
              label="Intra ΔSINR"
              value={`${dsinrMean === null ? '—' : `${dsinrMean.toFixed(2)} dB`} mean | ${dsinrHistogram.lastDelta === null ? '—' : `${dsinrHistogram.lastDelta.toFixed(2)} dB`} last`}
            />
            <DebugRow
              label="ΔSINR bins"
              value={`<1:${dsinrHistogram.counts.lt1}|1-2:${dsinrHistogram.counts['1to2']}|2-4:${dsinrHistogram.counts['2to4']}|4-8:${dsinrHistogram.counts['4to8']}|≥8:${dsinrHistogram.counts.ge8} (n=${dsinrHistogram.total})`}
            />
            <DebugRow
              label="Visibility window"
              value={`${observedMeanMs === null ? '—' : `${observedMeanMs.toFixed(0)} ms`} mean | ${observedAggregate.lastMs === null ? '—' : `${observedAggregate.lastMs.toFixed(0)} ms`} last (n=${observedAggregate.count})`}
            />
            <DebugRow label="Last Reason" value={formatHandoverReason(lastHoReason, frequencyReuse) || '—'} />
          </div>
        </DrawerSection>

        {/* S3: Re-scalarization fallback row — only in decision-overlay-on-live-sinr mode (SDD §9.4 item 5 / §10). */}
        {handoverMode === 'decision-overlay-on-live-sinr' && (
          <DrawerSection
            testId="diagnostics-drawer-rescalarize-fallback"
            tone={UI_TOKENS.color.semantic.info}
            title="MODQN RE-SCALARIZATION"
          >
            <div className="leo-drawer-section__rows">
              <DebugRow label="Mode" value="decision-overlay-on-live-sinr" />
              <DebugRow
                label="Fallback ticks"
                value={String(rescalarizeFallbackCount)}
              />
              <div className="leo-drawer-section__note" style={{ fontSize: 11, opacity: 0.7 }}>
                Ticks where user ω preferred an out-of-top-K beam
                and the system defaulted to the recorded top-K winner.
              </div>
            </div>
          </DrawerSection>
        )}

        {/* S4: omega-heuristic disclosure row — only in omega-heuristic mode
            (SDD §9.5 acceptance criterion 7 / §10 row 6). Shows mode value,
            current ω, score formula in human-readable form, and a not-paper
            warning so the row is independently informative from the
            top-of-scene banner. */}
        {handoverMode === 'omega-heuristic' && (
          <HeuristicModeDiagnosticsSection />
        )}

        <DrawerSection
          testId="visual-frequency-diagnostics"
          tone={UI_TOKENS.color.semantic.info}
          title="VISUAL FREQUENCY SOURCE"
        >
          <div className="leo-drawer-section__rows">
            <DebugRow
              label="Primary F"
              value={formatVisualFrequencyIndex(primaryFrequencyDiagnostics)}
            />
            <DebugRow
              label="Primary Source"
              value={formatVisualFrequencySource(primaryFrequencyDiagnostics)}
            />
            <DebugRow
              label="Primary Runtime K"
              value={formatFrequencyReuseValue(primaryFrequencyDiagnostics?.runtimeFrequencyReuse, 'K')}
            />
            <DebugRow
              label="Primary Core FRF"
              value={formatFrequencyReuseValue(primaryFrequencyDiagnostics?.coreLayoutFrequencyReuse, 'FRF')}
            />
            <DebugRow
              label="Comparison F"
              value={formatVisualFrequencyIndex(comparisonFrequencyDiagnostics)}
            />
            <DebugRow
              label="Comparison Source"
              value={formatVisualFrequencySource(comparisonFrequencyDiagnostics)}
            />
            <DebugRow
              label="Comparison Runtime K"
              value={formatFrequencyReuseValue(comparisonFrequencyDiagnostics?.runtimeFrequencyReuse, 'K')}
            />
            <DebugRow
              label="Comparison Core FRF"
              value={formatFrequencyReuseValue(comparisonFrequencyDiagnostics?.coreLayoutFrequencyReuse, 'FRF')}
            />
          </div>
        </DrawerSection>
      </div>
    </section>
  );
}

function formatOmegaWeight(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(2);
}

function formatOmegaTuple(omega: RuntimeOmegaState | null): string {
  if (omega === null) return '(—, —, —)';
  return `(${formatOmegaWeight(omega.throughput)}, ${formatOmegaWeight(omega.handover)}, ${formatOmegaWeight(omega.loadBalance)})`;
}

// S4: diagnostics row for omega-heuristic mode (SDD §9.5 acceptance item 7).
// Displays the active ω, the score formula in human-readable form, and a
// not-paper warning. The row is gated by `handoverMode === 'omega-heuristic'`
// so it never appears when the user is in another mode. It pulls the live ω
// from `ModqnHandoverModeContext` so the tuple stays in sync with the
// sidebar's Apply button without coupling the drawer to the sidebar hook.
function HeuristicModeDiagnosticsSection() {
  const { omegaActive } = useContext(ModqnHandoverModeContext);
  const omega = omegaActive ?? null;
  return (
    <DrawerSection
      testId="diagnostics-drawer-omega-heuristic"
      tone={UI_TOKENS.color.semantic.warning.accent}
      title="ω HEURISTIC (NOT PAPER MODQN)"
    >
      <div className="leo-drawer-section__rows">
        <DebugRow label="Mode" value="omega-heuristic" />
        <DebugRow label="ω (t, h, l)" value={formatOmegaTuple(omega)} />
        <DebugRow
          label="Score formula"
          value="score(a) = ω_t · normSINR(a) − ω_h · isSwitch(a) − ω_l · normLoad(a)"
        />
        <div className="leo-drawer-section__note" style={{ fontSize: 11, opacity: 0.8 }}>
          NOT paper MODQN — closed-form heuristic score over live candidates.
          The selected beam still flows through HandoverManager for
          trigger-time and ping-pong-guard timing; only the argmax step is
          overridden. normLoad(a) is held at 0 this slice because LinkSample
          does not yet carry a per-beam load metric (documented in
          src/engine/handover/decision-override.ts).
        </div>
      </div>
    </DrawerSection>
  );
}
