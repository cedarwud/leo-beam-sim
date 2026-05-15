import { ModqnObjectiveControls } from './ModqnObjectiveControls';
import type { ModqnDemoStub } from './useModqnDemoStub';

interface Props {
  readonly stub: ModqnDemoStub;
}

export function ModqnObjectiveTab({ stub }: Props) {
  return (
    <section
      className="leo-modqn-objective-tab"
      data-testid="modqn-objective-tab"
      style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
    >
      <ModqnObjectiveControls
        weights={stub.weightsActive}
        defaultWeights={stub.defaultWeights}
        onWeightsChange={stub.handleWeightsChange}
        onApply={stub.handleApplyWeights}
        onReset={stub.handleResetWeights}
        networkDraft={stub.networkDraft}
        networkActive={stub.networkActive}
        retrainStatus={stub.retrainStatus}
        onNetworkDraftChange={stub.handleNetworkDraftChange}
        onRetrain={stub.handleRetrain}
        onApplyLive={stub.handleApplyLiveNetwork}
      />
    </section>
  );
}
