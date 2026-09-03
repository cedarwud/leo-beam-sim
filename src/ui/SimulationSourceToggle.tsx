import type { SimulationSourceMode } from '../app/simulationSourceMode';
import { isSimulationSourceMode } from '../app/simulationSourceMode';

export interface SimulationSourceOption {
  readonly mode: SimulationSourceMode;
  readonly label: string;
  readonly subtitle: string;
}

export const SIMULATION_SOURCE_OPTIONS: readonly SimulationSourceOption[] = [
  { mode: 'archived-tle', label: 'TLE', subtitle: 'archived TLE source' },
  { mode: 'walker', label: 'Walker', subtitle: 'Walker source' },
];

export interface SimulationSourceToggleProps {
  readonly value: SimulationSourceMode;
  readonly onChange: (mode: SimulationSourceMode) => void;
}

/**
 * Compact source chooser for the existing top row. It is intentionally a
 * controlled, presentational component: App owns the source state and its
 * persistence, while this component only exposes the two reversible choices.
 */
export function SimulationSourceToggle({ value, onChange }: SimulationSourceToggleProps) {
  const activeMode = isSimulationSourceMode(value) ? value : 'walker';

  return (
    <div
      className="leo-simulation-source-toggle leo-modqn-view-toggle"
      role="group"
      aria-label="Simulation source"
      data-testid="simulation-source-toggle"
    >
      <span className="leo-simulation-source-toggle__title leo-modqn-view-toggle__title">
        Source
      </span>
      <div className="leo-simulation-source-toggle__group leo-modqn-view-toggle__group">
        {SIMULATION_SOURCE_OPTIONS.map(option => {
          const active = option.mode === activeMode;
          return (
            <button
              key={option.mode}
              type="button"
              className="leo-simulation-source-toggle__button leo-modqn-view-toggle__button"
              data-testid={`simulation-source-toggle-${option.mode}`}
              data-source-mode={option.mode}
              data-active={active ? 'true' : 'false'}
              aria-pressed={active}
              onClick={() => { if (!active) onChange(option.mode); }}
            >
              <span className="leo-simulation-source-toggle__label leo-modqn-view-toggle__label">
                {option.label}
              </span>
              <small className="leo-simulation-source-toggle__subtitle leo-modqn-view-toggle__sub">
                {option.subtitle}
              </small>
            </button>
          );
        })}
      </div>
    </div>
  );
}
