// MODQN ω-Handover S1 — sidebar evidence tab.
//
// Replaces the previous tab that read fake `effectiveOffsetDb` /
// `effectiveTriggerTimeSec` derivations from useModqnDemoStub.
//
// S1 ownership (SDD §9.2):
//   * Display bundle manifest fields: paperId, bundleSchemaVersion,
//     baselineSurface.totalBeamCount, baselineSurface.episodesCompleted.
//   * Display the active ω from the hook.
//   * Display an applied decision trace derived from producer top-K diagnostics
//     plus the consumer-side active ω. The trace is display evidence only; it
//     does not mutate producer selectedServing or bundle payloads.
import { useMemo } from 'react';
import {
  useModqnHandoverState,
  type RuntimeHandoverMode,
  type RuntimeOmegaState,
  type UseModqnHandoverState,
} from './useModqnHandoverState';
import {
  reScalarize,
  scoreModqnPolicyCandidate,
  type ReScalarizeResult,
} from '../modqn/replay-bundle/rescalarize';
import type {
  ModqnBeamReference,
  ModqnPolicyCandidate,
} from '../modqn/replay-bundle/types';
import type { SimState } from '../scene/types';

interface Props {
  // Live KPI rendering belongs in the Live status tab. This tab only reads the
  // current live serving identity to prove how the applied MODQN choice maps
  // onto the center scene.
  readonly simState: SimState;
  readonly bandwidthMHz: number;
  readonly appliedHandoverOffsetDb: number;
  readonly appliedHandoverTriggerTimeSec: number;
  readonly handoverMode?: RuntimeHandoverMode;
  readonly hookOverride?: UseModqnHandoverState;
}

function formatWeight(value: number): string {
  return value.toFixed(2);
}

function formatScore(value: number | null): string {
  return value === null || !Number.isFinite(value) ? '-' : value.toFixed(3);
}

function formatSlot(snapshot: UseModqnHandoverState['bundleSidebarSnapshot']): string {
  if (snapshot === null) return '-';
  const slot = snapshot.currentSlotIndex === null ? 'slot -' : `slot ${snapshot.currentSlotIndex}`;
  const time = snapshot.currentTimeSec === null ? null : `t=${snapshot.currentTimeSec.toFixed(1)}s`;
  return [slot, `offset ${snapshot.slotOffset}`, time].filter(Boolean).join(' / ');
}

function formatProducerBeam(ref: ModqnBeamReference | null): string {
  if (ref === null) return '-';
  return `${ref.satId} / local B${ref.localBeamIndex} / global #${ref.beamIndex}`;
}

function formatCandidateBeam(candidate: ModqnPolicyCandidate | null): string {
  if (candidate === null) return '-';
  return `${candidate.satId} / local B${candidate.localBeamIndex} / global #${candidate.beamIndex}`;
}

function formatLiveServing(simState: SimState): string {
  if (simState.servingSatId === null || simState.servingBeamId === null) return '-';
  return `${simState.servingSatId} / live B${simState.servingBeamId}`;
}

function findRescalarizedCandidate(
  topCandidates: readonly ModqnPolicyCandidate[] | undefined,
  result: ReScalarizeResult | null,
): ModqnPolicyCandidate | null {
  if (!topCandidates || result === null) return null;
  return topCandidates.find(candidate => (
    candidate.satId === result.satId
    && candidate.localBeamIndex === result.beamId
  )) ?? null;
}

function getSelectionChanged(
  producerSelected: ModqnBeamReference | null,
  result: ReScalarizeResult | null,
): 'yes' | 'no' | 'unavailable' {
  if (producerSelected === null || result === null) return 'unavailable';
  return producerSelected.satId === result.satId
    && producerSelected.localBeamIndex === result.beamId
    ? 'no'
    : 'yes';
}

function getFallbackStatus(result: ReScalarizeResult | null): string {
  if (result === null) return 'no top-K diagnostics';
  return result.wasFallback ? 'top-1 fallback' : 'within top-K';
}

interface DecisionTraceRow {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}

interface DecisionTrace {
  readonly rows: readonly DecisionTraceRow[];
  readonly selectionChanged: 'yes' | 'no' | 'unavailable';
  readonly fallbackStatus: string;
}

function buildDecisionTrace(
  snapshot: UseModqnHandoverState['bundleSidebarSnapshot'],
  omegaActive: RuntimeOmegaState,
  simState: SimState,
): DecisionTrace {
  const topCandidates = snapshot?.policyDiagnostics.topCandidates;
  const result = reScalarize(topCandidates, omegaActive);
  const selectedCandidate = findRescalarizedCandidate(topCandidates, result);
  const producerSelected = snapshot?.currentRowSelectedServing ?? null;
  const selectionChanged = getSelectionChanged(producerSelected, result);
  const fallbackStatus = getFallbackStatus(result);
  const selectedScore = selectedCandidate === null
    ? null
    : scoreModqnPolicyCandidate(selectedCandidate, omegaActive);

  return {
    selectionChanged,
    fallbackStatus,
    rows: [
      {
        label: 'Current slot',
        value: formatSlot(snapshot),
        testId: 'modqn-evidence-current-slot',
      },
      {
        label: 'Producer baseline',
        value: formatProducerBeam(producerSelected),
        testId: 'modqn-evidence-producer-selected',
      },
      {
        label: 'Applied ω pick',
        value: formatCandidateBeam(selectedCandidate),
        testId: 'modqn-evidence-rescalarized-selected',
      },
      {
        label: 'Applied score',
        value: formatScore(selectedScore),
        testId: 'modqn-evidence-rescalarized-score',
      },
      {
        label: 'Changed by ω',
        value: selectionChanged,
        testId: 'modqn-evidence-selection-changed',
      },
      {
        label: 'Fallback status',
        value: fallbackStatus,
        testId: 'modqn-evidence-fallback-status',
      },
      {
        label: 'Mapped live serving',
        value: formatLiveServing(simState),
        testId: 'modqn-evidence-mapped-live-serving',
      },
    ],
  };
}

export function ModqnEvidenceTab({
  simState,
  handoverMode = 'sinr-offset',
  hookOverride,
}: Props) {
  const fallbackHook = useModqnHandoverState();
  const hook = hookOverride ?? fallbackHook;
  const { omegaActive, omegaSource, bundleSidebarSnapshot } = hook;
  const modqnReplayActive = handoverMode === 'modqn-replay';
  const inactiveModeLabel = handoverMode === 'omega-heuristic' ? 'ω heuristic' : 'SINR-offset';
  const decisionTrace = useMemo(
    () => buildDecisionTrace(bundleSidebarSnapshot, omegaActive, simState),
    [
      bundleSidebarSnapshot,
      omegaActive,
      simState.servingBeamId,
      simState.servingSatId,
    ],
  );

  const manifestRows = useMemo(() => {
    if (bundleSidebarSnapshot === null) {
      return [
        { label: 'Bundle', value: 'unavailable' as const, testId: 'modqn-evidence-bundle' },
      ];
    }
    const { paperId, bundleSchemaVersion, baselineSurface } = bundleSidebarSnapshot;
    return [
      {
        label: 'Paper ID',
        value: paperId,
        testId: 'modqn-evidence-paper-id',
      },
      {
        label: 'Bundle schema',
        value: bundleSchemaVersion,
        testId: 'modqn-evidence-bundle-schema-version',
      },
      {
        label: 'Total beams',
        value: String(baselineSurface.totalBeamCount),
        testId: 'modqn-evidence-total-beam-count',
      },
      {
        label: 'Episodes completed',
        value: String(baselineSurface.episodesCompleted),
        testId: 'modqn-evidence-episodes-completed',
      },
    ];
  }, [bundleSidebarSnapshot]);

  return (
    <section
      className="leo-modqn-evidence-tab"
      data-testid="modqn-evidence-tab"
      data-omega-source={omegaSource}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <section
        className="leo-modqn-evidence-mode-status"
        data-testid="modqn-evidence-mode-status"
        data-handover-mode={handoverMode}
        data-active={modqnReplayActive ? 'true' : 'false'}
        aria-label="MODQN evidence mode status"
      >
        <div className="leo-modqn-objective-controls__title">
          {modqnReplayActive ? 'Replay override active' : 'Reference evidence only'}
        </div>
        <p>
          {modqnReplayActive
            ? 'The center scene is using MODQN replay-selected beam decisions through the replay override path.'
            : `The center scene is using ${inactiveModeLabel}. Bundle manifest, producer baseline, and active ω are reference evidence, not the live decision source.`}
        </p>
      </section>

      <section
        className="leo-modqn-evidence-active-omega"
        data-testid="modqn-evidence-active-omega"
        aria-label="Active ω (applied)"
      >
        <div className="leo-modqn-objective-controls__title">Active ω</div>
        <div
          className="leo-modqn-evidence-active-omega__row"
          data-testid="modqn-evidence-active-omega-throughput"
        >
          <span>Throughput</span>
          <output>{formatWeight(omegaActive.throughput)}</output>
        </div>
        <div
          className="leo-modqn-evidence-active-omega__row"
          data-testid="modqn-evidence-active-omega-handover"
        >
          <span>Handover</span>
          <output>{formatWeight(omegaActive.handover)}</output>
        </div>
        <div
          className="leo-modqn-evidence-active-omega__row"
          data-testid="modqn-evidence-active-omega-loadbalance"
        >
          <span>Load balance</span>
          <output>{formatWeight(omegaActive.loadBalance)}</output>
        </div>
      </section>

      <section
        className="leo-modqn-evidence-decision-trace"
        data-testid="modqn-evidence-decision-trace"
        data-selection-changed={decisionTrace.selectionChanged}
        data-fallback-status={decisionTrace.fallbackStatus}
        aria-label="Applied MODQN decision trace"
      >
        <div className="leo-modqn-objective-controls__title">Applied decision trace</div>
        {decisionTrace.rows.map(row => (
          <div
            key={row.testId}
            className="leo-modqn-evidence-decision-trace__row"
            data-testid={row.testId}
          >
            <span className="leo-modqn-evidence-decision-trace__label">{row.label}</span>
            <span className="leo-modqn-evidence-decision-trace__value">{row.value}</span>
          </div>
        ))}
        <p className="leo-modqn-evidence-decision-trace__note">
          Derived for display from producer top-K diagnostics; producer selectedServing remains immutable.
        </p>
      </section>

      <section
        className="leo-modqn-evidence-manifest"
        data-testid="modqn-evidence-manifest"
        aria-label="MODQN bundle manifest"
      >
        <div className="leo-modqn-objective-controls__title">Bundle manifest</div>
        {manifestRows.map(row => (
          <div
            key={row.testId}
            className="leo-modqn-evidence-manifest__row"
            data-testid={row.testId}
          >
            <span className="leo-modqn-evidence-manifest__label">{row.label}</span>
            <span className="leo-modqn-evidence-manifest__value">{row.value}</span>
          </div>
        ))}
      </section>
    </section>
  );
}
