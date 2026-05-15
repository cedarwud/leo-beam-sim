// MODQN ω-Handover S1 — sidebar evidence tab.
//
// Replaces the previous tab that read fake `effectiveOffsetDb` /
// `effectiveTriggerTimeSec` derivations from useModqnDemoStub.
//
// S1 ownership (SDD §9.2):
//   * Display bundle manifest fields: paperId, bundleSchemaVersion,
//     baselineSurface.totalBeamCount, baselineSurface.episodesCompleted.
//   * Display the active ω from the hook.
//   * The Live KPI strip's "Policy (effective)" section now reads the applied
//     profile's actual handover policy values; the fake derivations are gone.
import { useMemo } from 'react';
import { LiveKpiStrip } from './LiveKpiStrip';
import {
  useModqnHandoverState,
  type UseModqnHandoverState,
} from './useModqnHandoverState';
import type { SimState } from '../scene/types';

interface Props {
  readonly simState: SimState;
  readonly bandwidthMHz: number;
  // Applied handover policy from the live profile/tuning system. Replaces the
  // fake `effectiveOffsetDb / effectiveTriggerTimeSec` derivations the demo
  // stub used to expose.
  readonly appliedHandoverOffsetDb: number;
  readonly appliedHandoverTriggerTimeSec: number;
  readonly hookOverride?: UseModqnHandoverState;
}

function formatWeight(value: number): string {
  return value.toFixed(2);
}

export function ModqnEvidenceTab({
  simState,
  bandwidthMHz,
  appliedHandoverOffsetDb,
  appliedHandoverTriggerTimeSec,
  hookOverride,
}: Props) {
  const fallbackHook = useModqnHandoverState();
  const hook = hookOverride ?? fallbackHook;
  const { omegaActive, omegaSource, bundleSidebarSnapshot } = hook;

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

      <LiveKpiStrip
        simState={simState}
        effectiveOffsetDb={appliedHandoverOffsetDb}
        effectiveTriggerTimeSec={appliedHandoverTriggerTimeSec}
        bandwidthMHz={bandwidthMHz}
      />
    </section>
  );
}
