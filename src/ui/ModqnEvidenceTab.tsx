import { LiveKpiStrip } from './LiveKpiStrip';
import type { ModqnDemoStub } from './useModqnDemoStub';
import type { SimState } from '../scene/types';

interface Props {
  readonly stub: ModqnDemoStub;
  readonly simState: SimState;
  readonly bandwidthMHz: number;
}

export function ModqnEvidenceTab({ stub, simState, bandwidthMHz }: Props) {
  return (
    <section
      className="leo-modqn-evidence-tab"
      data-testid="modqn-evidence-tab"
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <LiveKpiStrip
        simState={simState}
        effectiveOffsetDb={stub.effectiveOffsetDb}
        effectiveTriggerTimeSec={stub.effectiveTriggerTimeSec}
        bandwidthMHz={bandwidthMHz}
      />
    </section>
  );
}
