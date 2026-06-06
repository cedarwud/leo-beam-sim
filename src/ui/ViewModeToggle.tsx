import type { ViewMode } from '../app/appPersistence';

// Top-level view switch (orthogonal to the lane Experience switch): flip the main
// area between the full-height 3D scene and the full-area MODQN dashboard
// (flowchart / Plane-C tiles / live telemetry) that used to be squished into the
// bottom dock. The Dashboard option is disabled on lanes that carry no dashboard
// (sinr-live / modqn-replay-proof), so it never strands the user on an empty view.
export interface ViewModeToggleProps {
  readonly value: ViewMode;
  readonly dashboardAvailable: boolean;
  readonly onChange: (mode: ViewMode) => void;
}

const OPTIONS: ReadonlyArray<{ mode: ViewMode; label: string }> = [
  { mode: 'scene', label: '3D Scene' },
  { mode: 'dashboard', label: 'Dashboard' },
];

export function ViewModeToggle({ value, dashboardAvailable, onChange }: ViewModeToggleProps) {
  return (
    <div
      className="leo-view-mode-toggle"
      role="group"
      aria-label="Main view"
      data-testid="view-mode-toggle"
      data-view-mode={value}
    >
      <span className="leo-view-mode-toggle__title" aria-hidden="true">View</span>
      {OPTIONS.map(option => {
        const active = option.mode === value;
        const disabled = option.mode === 'dashboard' && !dashboardAvailable;
        return (
          <button
            key={option.mode}
            type="button"
            className="leo-view-mode-toggle__button"
            data-testid={`view-mode-${option.mode}`}
            data-active={active ? 'true' : 'false'}
            aria-pressed={active}
            disabled={disabled}
            title={
              disabled
                ? 'No dashboard for this lane — switch to MODQN Live or Artifact Showcase'
                : undefined
            }
            onClick={() => { if (!active && !disabled) onChange(option.mode); }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
