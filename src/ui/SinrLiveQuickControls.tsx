import { type ReactElement } from 'react';
import { UI_CLASSES } from '../constants/uiTokens';
import type { CinematicMode } from '../scene/types';

// The compact SINR-live quick-control row at the top of the left rail: four
// always-visible checkboxes for the cheap display toggles, laid out horizontally
// so they cost little vertical space. The heavier tuners (SINR formula / handover
// policy) live below in the scrollable rail; beam density + camera presets were
// retired. Testids/handlers are unchanged from the prior in-drawer mounts.
interface SinrLiveQuickControlsProps {
  readonly beamCalloutsEnabled: boolean;
  readonly showNonServingCones: boolean;
  readonly cinematicMode: CinematicMode;
  readonly autoSlowEnabled: boolean;
  readonly onToggleBeamCallouts: () => void;
  readonly onToggleNonServingCones: () => void;
  readonly onCinematicModeChange: (mode: CinematicMode) => void;
  readonly onToggleAutoSlow: () => void;
}

export function SinrLiveQuickControls({
  beamCalloutsEnabled,
  showNonServingCones,
  cinematicMode,
  autoSlowEnabled,
  onToggleBeamCallouts,
  onToggleNonServingCones,
  onCinematicModeChange,
  onToggleAutoSlow,
}: SinrLiveQuickControlsProps): ReactElement {
  return (
    <div
      className="leo-sinr-quick-controls"
      role="group"
      aria-label="Quick display controls"
      data-testid="sinr-live-quick-controls"
    >
      <label className="leo-control-bar__toggle" title="Show or hide beam information blocks in the scene">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Show beam information blocks"
          data-testid="beam-info-toggle"
          checked={beamCalloutsEnabled}
          onChange={onToggleBeamCallouts}
        />
        Beam Info
      </label>

      <label className="leo-control-bar__toggle" title="Also draw the dim non-serving (co-channel) beam cones behind the serving ones">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Show non-serving beam cones"
          data-testid="non-serving-cones-toggle"
          checked={showNonServingCones}
          onChange={onToggleNonServingCones}
        />
        Other beams
      </label>

      <label className="leo-control-bar__toggle" title="Highlight serving beam path with cinematic spotlight">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Spotlight mode: highlight serving beam path"
          checked={cinematicMode === 'spotlight'}
          onChange={event => onCinematicModeChange(event.target.checked ? 'spotlight' : 'off')}
        />
        Spotlight
      </label>

      <label className="leo-control-bar__toggle" title="Auto-slow simulation rate during handover events">
        <input
          className={UI_CLASSES.checkbox}
          type="checkbox"
          aria-label="Auto slow on handover"
          checked={autoSlowEnabled}
          onChange={onToggleAutoSlow}
        />
        HO Slow
      </label>
    </div>
  );
}
