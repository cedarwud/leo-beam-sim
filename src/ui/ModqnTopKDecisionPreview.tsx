// MODQN mode/sidebar consolidation S-ADV-4 — relocated Top-K decision preview.
//
// The legacy "Top-K decision preview" was rendered inline in the default Evidence
// rail (`ModqnEvidenceTab`, since retired). On the degenerate baseline producer
// artifact its rows are an empty/fail-closed "top-K" with no dense-Q proof, so it
// added noise to the default evidence story. S-ADV-4 relocated ONLY this preview
// into the opt-in Advanced setup drawer; the wall-of-text Evidence rail was later
// removed wholesale (the proof now lives on the DecisionViz card + live scene).
//
// It is a pure UI-mount move (Rule#6): it reads the SAME `buildDecisionTrace` over
// the shared MODQN handover state and renders the SAME section markup / testids; no
// producer payload, bundle, or live truth is mutated. It is display evidence only —
// "Legacy display preview from producer top-K diagnostics, not dense-Q proof."
import { useMemo, type ReactElement } from 'react';
import { useModqnHandoverState } from './useModqnHandoverState';
import { buildDecisionTrace } from './modqnDecisionTrace';
import type { SimState } from '../scene/types';

interface Props {
  readonly simState: SimState;
}

export function ModqnTopKDecisionPreview({ simState }: Props): ReactElement {
  const { omegaActive, bundleSidebarSnapshot } = useModqnHandoverState();
  const decisionTrace = useMemo(
    () => buildDecisionTrace(bundleSidebarSnapshot, omegaActive, simState),
    [
      bundleSidebarSnapshot,
      omegaActive,
      simState.servingBeamId,
      simState.servingSatId,
    ],
  );

  return (
    <section
      className="leo-modqn-evidence-decision-trace"
      data-testid="modqn-evidence-decision-trace"
      data-selection-changed={decisionTrace.selectionChanged}
      data-fallback-status={decisionTrace.fallbackStatus}
      aria-label="MODQN top-K decision preview"
    >
      <div className="leo-modqn-objective-controls__title">Top-K decision preview</div>
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
        Legacy display preview from producer top-K diagnostics, not dense-Q proof. Producer selectedServing remains immutable.
      </p>
    </section>
  );
}
