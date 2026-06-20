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
  // HO-Slow feedback (the checkbox alone gave no signal that it slowed): the live
  // effective scene rate + whether the auto-slow is currently applied, plus a
  // dismiss to resume normal speed for the in-progress handover.
  readonly effectiveSpeed: number;
  readonly autoSlowActive: boolean;
  readonly autoSlowApplied: boolean;
  readonly onToggleBeamCallouts: () => void;
  readonly onToggleNonServingCones: () => void;
  readonly onCinematicModeChange: (mode: CinematicMode) => void;
  readonly onToggleAutoSlow: () => void;
  readonly onDismissAutoSlow: () => void;
}

export function SinrLiveQuickControls({
  beamCalloutsEnabled,
  showNonServingCones,
  cinematicMode,
  autoSlowEnabled,
  effectiveSpeed,
  autoSlowActive,
  autoSlowApplied,
  onToggleBeamCallouts,
  onToggleNonServingCones,
  onCinematicModeChange,
  onToggleAutoSlow,
  onDismissAutoSlow,
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

      {/* Spotlight RESTORED (user request). The spotlight EFFECT is a scene-level
          cinematic dim + fog + target point-lights resolved in `BaseSceneLayout`
          (cinematicSpotlightActive) — it is INDEPENDENT of the parked live cinematic
          CAMERA (LIVE_CINEMATIC_CAMERA_ENABLED, which only suppresses the director
          camera MOTION). So this toggle works on the live cell lane without un-parking
          the camera. cinematicMode 'spotlight' (not 'director') never arms the director FSM. */}
      <label className="leo-control-bar__toggle" title="Highlight serving beam path with cinematic spotlight (scene dim + fog)">
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

      {/* HO-Slow feedback: the checkbox alone never showed whether the slow was
          firing. This readout shows the live effective scene rate (drops 5x -> 1x
          while a handover is mid-trigger) and goes alert-coloured + offers a Resume
          when the auto-slow is actually applied. Display-only — it reflects
          playback.effectiveSpeed, it does not set it. */}
      <span
        className="leo-ho-slow-status"
        data-testid="ho-slow-status"
        data-auto-slow-applied={autoSlowApplied ? '1' : '0'}
        data-auto-slow-active={autoSlowActive ? '1' : '0'}
        title={autoSlowApplied
          ? 'A handover is in progress — the scene is auto-slowed. Resume to skip the slow-mo.'
          : 'Live scene playback rate (auto-slows during a handover while HO Slow is on).'}
      >
        Scene {effectiveSpeed.toFixed(1)}×{autoSlowApplied ? ' · HO Slow' : ''}
      </span>
      {autoSlowApplied && (
        <button
          type="button"
          className="leo-ho-slow-dismiss"
          data-testid="ho-slow-dismiss"
          onClick={onDismissAutoSlow}
          title="Resume normal speed for this handover"
        >
          Resume
        </button>
      )}
    </div>
  );
}
