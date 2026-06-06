import { HyperparamChip } from '../modqn-controls/HyperparamChip';
import { NetworkParamInput } from '../modqn-controls/NetworkParamInput';

// Showcase exposure (S5): the Tier-2 hyperparameter UI (HyperparamChip +
// NetworkParamInput) was fully built but never mounted. This preview section
// surfaces it inside the MODQN training tab so it can be inventoried, while
// staying HONEST about its status: Tier-2 editing is not wired to the trainer
// (changing a network hyperparameter requires a retrain), so the chips show the
// "requires retrain" lock and the inputs are disabled. No fabricated training
// effect — display-only preview of the built surface.
const noop = (): void => {};

export function Tier2PreviewSection() {
  return (
    <section
      className="leo-tier2-preview"
      aria-label="Tier-2 hyperparameters (preview)"
      data-testid="tier2-preview-section"
    >
      <header className="leo-tier2-preview__header">
        <strong>Tier-2 hyperparameters</strong>
        <span className="leo-tier2-preview__note">
          preview — requires retrain, not yet wired to the trainer
        </span>
      </header>
      <div className="leo-tier2-preview__chips">
        <HyperparamChip label="Learning rate" value="3e-4" />
        <HyperparamChip label="Discount γ" value="0.99" />
        <HyperparamChip label="Replay buffer" value="100k" />
      </div>
      <NetworkParamInput
        kind="log-slider"
        label="Learning rate (preview)"
        description="Tier-2 network hyperparameter — disabled until trainer wiring lands"
        testId="tier2-preview-learning-rate"
        disabled
        kindProps={{ value: 3e-4, min: 1e-6, max: 1e-1 }}
        onChange={noop}
      />
    </section>
  );
}
