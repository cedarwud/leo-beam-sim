interface HyperparamChipProps {
  readonly label: string;
  readonly value: string;
}

export function HyperparamChip({
  label,
  value,
}: HyperparamChipProps) {
  return (
    <div className="leo-modqn-hyperparam-chip leo-modqn-hyperparam-chip--disabled">
      <div className="leo-modqn-hyperparam-chip__meta">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span
        className="leo-modqn-hyperparam-chip__hint"
        aria-label="Requires retrain"
        title="Requires retrain"
      >
        <span aria-hidden="true">🔒</span>
        Requires retrain
      </span>
      <span className="leo-modqn-hyperparam-chip__tier-indicator" aria-hidden="true">
        Tier 2 enables this surface.
      </span>
    </div>
  );
}
