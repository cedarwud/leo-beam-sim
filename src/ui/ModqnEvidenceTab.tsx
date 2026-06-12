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
import {
  createCurrentModqnReplayProofSourceGaps,
  type ModqnReplaySourceGap,
} from '../modqn/replay-source-gaps';
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
  readonly bundleProvenanceKind?: 'paper-faithful' | 'user-trained';
  readonly sourceGaps?: readonly ModqnReplaySourceGap[];
}

type BundleProvenanceKind = 'paper-faithful' | 'user-trained';
type EvidenceProvenanceStatus = BundleProvenanceKind | 'fallback' | 'unavailable';

interface EvidenceProvenanceCopy {
  readonly label: string;
  readonly detail: string;
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

function resolveEvidenceProvenanceStatus(
  snapshot: UseModqnHandoverState['bundleSidebarSnapshot'],
  bundleProvenanceKind: BundleProvenanceKind | undefined,
  fallbackStatus: string,
): EvidenceProvenanceStatus {
  if (snapshot === null) return 'unavailable';
  if (fallbackStatus === 'no top-K diagnostics') return 'unavailable';
  if (fallbackStatus.includes('fallback')) return 'fallback';
  return bundleProvenanceKind ?? 'unavailable';
}

function getEvidenceProvenanceCopy(status: EvidenceProvenanceStatus): EvidenceProvenanceCopy {
  if (status === 'paper-faithful') {
    return {
      label: 'paper-faithful replay context',
      detail: 'Bundle manifest and producer selected-serving trace are paper-faithful replay context. Top-K ω preview is legacy display only; dense-Q proof requires the full D5 per-action export and self-check.',
    };
  }
  if (status === 'user-trained') {
    return {
      label: 'user-trained replay evidence',
      detail: 'Bundle manifest and selected-serving trace are displayed from a user-trained replay bundle. Treat this as replay/evidence context, not PAP-2024 baseline proof, dense-Q proof, or live truth ownership.',
    };
  }
  if (status === 'fallback') {
    return {
      label: 'top-K fallback preview',
      detail: 'Dense-Q diagnostics are incomplete for this row, so the legacy preview falls back to the first producer top-K candidate. Producer payloads and live SINR truth remain unchanged.',
    };
  }
  return {
    label: 'provenance unavailable',
    detail: 'No bundle diagnostics are available for this row yet. This tab remains evidence-only until a replay bundle and its diagnostics are loaded.',
  };
}

function formatSourceGapField(field: ModqnReplaySourceGap['field']): string {
  if (field === 'beamHopping.activeSchedule') return 'Active beam schedule';
  if (field === 'beamHopping.nextSchedule') return 'Next beam preview';
  if (field === 'entities.ues.positionTrace') return 'UE trace';
  if (field === 'entities.satellites.trajectory') return 'Satellite trajectory';
  if (field === 'entities.beams.footprints') return 'Beam footprint';
  if (field === 'timeline.sourceRowIdentity') return 'Source row identity';
  if (field === 'timeline.focusUeSelection') return 'Focus UE selection';
  if (field === 'timeline.activeCellState') return 'Active cell state';
  if (field === 'timeline.allUeServingHistory') return 'All-UE serving';
  if (field === 'timeline.handoverPenaltyAttribution') return 'HO penalty attribution';
  if (field === 'timeline.frequencyReuseGroups') return 'Frequency reuse';
  if (field === 'metrics.angleAwareTerms') return 'Angle-aware terms';
  if (field === 'metrics.energyEfficiencyTerms') return 'Energy-efficiency terms';
  if (field === 'metrics.reward') return 'Reward trace';
  if (field === 'diagnostics.policy') return 'Policy diagnostics';
  if (field === 'diagnostics.denseQPolicy') return 'Dense-Q proof';
  if (field === 'traffic.queueRows') return 'Producer queue rows';
  if (field === 'comparison.alignedTimebase') return 'Comparison timebase';
  return 'Claim boundary';
}

interface DecisionTraceRow {
  readonly label: string;
  readonly value: string;
  readonly testId: string;
}

export interface DecisionTrace {
  readonly rows: readonly DecisionTraceRow[];
  readonly selectionChanged: 'yes' | 'no' | 'unavailable';
  readonly fallbackStatus: string;
}

// S-ADV-4: exported so the relocated Top-K decision preview
// (`ModqnTopKDecisionPreview`, mounted in the Advanced setup drawer) can build the
// same legacy top-K trace from the shared MODQN handover state. ModqnEvidenceTab
// still calls it for the provenance fallback status (a KEEP disclosure row).
export function buildDecisionTrace(
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
        label: 'Top-K ω preview',
        value: formatCandidateBeam(selectedCandidate),
        testId: 'modqn-evidence-rescalarized-selected',
      },
      {
        label: 'Top-K score',
        value: formatScore(selectedScore),
        testId: 'modqn-evidence-rescalarized-score',
      },
      {
        label: 'Top-K changed',
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
  bundleProvenanceKind,
  sourceGaps,
}: Props) {
  const fallbackHook = useModqnHandoverState();
  const hook = hookOverride ?? fallbackHook;
  const { omegaActive, omegaSource, bundleSidebarSnapshot } = hook;
  const modqnReplayActive = handoverMode === 'decision-overlay-on-live-sinr';
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
  const provenanceStatus = resolveEvidenceProvenanceStatus(
    bundleSidebarSnapshot,
    bundleProvenanceKind,
    decisionTrace.fallbackStatus,
  );
  const provenanceCopy = getEvidenceProvenanceCopy(provenanceStatus);
  const replaySourceGaps = useMemo(
    () => sourceGaps ?? createCurrentModqnReplayProofSourceGaps(),
    [sourceGaps],
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
      {bundleProvenanceKind === 'user-trained' ? (
        <span className="modqn-evidence__chip modqn-evidence__chip--user-trained" data-testid="modqn-evidence-user-trained-chip">user-trained</span>
      ) : null}
      <section
        className="leo-modqn-evidence-provenance-status"
        data-testid="modqn-evidence-provenance-status"
        data-provenance-status={provenanceStatus}
        aria-label="MODQN replay evidence provenance"
      >
        <div className="leo-modqn-objective-controls__title">Evidence provenance</div>
        <span
          className="modqn-evidence__chip"
          data-testid="modqn-evidence-provenance-chip"
        >
          {provenanceCopy.label}
        </span>
        <p data-testid="modqn-evidence-provenance-copy">
          {provenanceCopy.detail}
        </p>
      </section>
      <section
        className="leo-modqn-evidence-mode-status"
        data-testid="modqn-evidence-mode-status"
        data-handover-mode={handoverMode}
        data-active={modqnReplayActive ? 'true' : 'false'}
        aria-label="MODQN evidence mode status"
      >
        <div className="leo-modqn-objective-controls__title">
          {modqnReplayActive ? 'Decision-overlay evidence active' : 'Reference evidence only'}
        </div>
        <p>
          {modqnReplayActive
            ? 'Live SINR remains the reference surface while MODQN replay decisions are displayed through the decision-overlay path; this does not rewrite producer payloads or live truth ownership.'
            : `The center scene is using ${inactiveModeLabel}. Bundle manifest, producer baseline, and active ω are replay/evidence context only, not the live decision source.`}
        </p>
      </section>

      <section
        className="leo-modqn-evidence-source-gaps"
        data-testid="modqn-evidence-source-gap-list"
        data-source-gap-count={replaySourceGaps.length}
        aria-label="MODQN replay source gaps"
      >
        <div className="leo-modqn-objective-controls__title">Source gaps</div>
        {replaySourceGaps.map(gap => (
          <div
            key={`${gap.field}:${gap.surface}`}
            className="leo-modqn-evidence-source-gap"
            data-testid="modqn-evidence-source-gap-item"
            data-source-gap-field={gap.field}
            data-source-gap-policy={gap.policy}
            data-source-gap-claim-impact={gap.claimImpact}
          >
            <span className="leo-modqn-evidence-source-gap__label">{formatSourceGapField(gap.field)}</span>
            <span className="leo-modqn-evidence-source-gap__value">{gap.note}</span>
          </div>
        ))}
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

      {/* S-ADV-4: the legacy Top-K decision preview (the degenerate "empty top-K"
          on the baseline producer artifact) is relocated to the Advanced setup
          drawer as `ModqnTopKDecisionPreview`. The KEEP disclosure rows
          (provenance / mode / source gaps / active ω) + the manifest stay here on
          the default Evidence rail; only the noisy top-K preview moves. The
          `decisionTrace` is still computed above for the provenance fallback
          status. */}
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
