// G1-CONTROLBAR-ADV — SINR-live display & camera controls, relocated off the top
// bar into an opt-in Advanced drawer.
//
// North star: 少按鈕 / 直覺 / 零學習. The default SINR-live surface is the scene
// (mosaic + cones + live-handover pulse) plus the shared Mode select and the
// read-only Active-UEs count in the top bar. The power/display controls — beam
// density, beam-info callouts, camera presets, spotlight, and auto-slow-on-HO —
// move here behind a ⚙ trigger so they are reachable but not in the default path.
//
// These controls are RELOCATED, not gated or changed: the testids and handlers
// are identical to the prior in-ControlBar block. The drawer is mounted by
// App.tsx in the SINR-live left aside (`sceneLane === 'sinr-live'`), mirroring the
// MODQN AdvancedSetupDrawer mount. Lane-ownership is unchanged — these remain
// SINR-live-lane-owned, just no longer top-bar-resident.
import { type ReactElement } from 'react';
import { UI_CLASSES } from '../constants/uiTokens';
import type { BeamDensity, CameraPreset, CinematicMode } from '../scene/types';
import { AdvancedDrawerShell } from './AdvancedDrawerShell';

const DENSITY_OPTIONS: Array<{ label: string; density: BeamDensity }> = [
  { label: 'few', density: 'event-only' },
  { label: 'normal', density: 'event-plus-1' },
  { label: 'many', density: 'all' },
];

const CAMERA_PRESETS: Array<{ label: string; preset: CameraPreset }> = [
  { label: 'Zenith', preset: 'zenith' },
  { label: 'Oblique', preset: 'oblique' },
  { label: 'Chase', preset: 'chase' },
  { label: 'Paper-faithful close-up', preset: 'paper-faithful-closeup' },
];

interface SinrLiveDisplayDrawerProps {
  readonly beamDensity: BeamDensity;
  readonly beamCalloutsEnabled: boolean;
  readonly cinematicMode: CinematicMode;
  readonly autoSlowEnabled: boolean;
  readonly onBeamDensityChange: (density: BeamDensity) => void;
  readonly onToggleBeamCallouts: () => void;
  readonly onCameraPresetSelect: (preset: CameraPreset) => void;
  readonly onCinematicModeChange: (mode: CinematicMode) => void;
  readonly onToggleAutoSlow: () => void;
}

export function SinrLiveDisplayDrawer({
  beamDensity,
  beamCalloutsEnabled,
  cinematicMode,
  autoSlowEnabled,
  onBeamDensityChange,
  onToggleBeamCallouts,
  onCameraPresetSelect,
  onCinematicModeChange,
  onToggleAutoSlow,
}: SinrLiveDisplayDrawerProps): ReactElement {
  return (
    <AdvancedDrawerShell
      testIdPrefix="sinr-live-display"
      triggerLabel="⚙ Display & camera"
      triggerHint="density · beam info · camera · spotlight · HO slow"
      dialogTitle="Display & camera controls"
      dialogAriaLabel="SINR-live display and camera controls"
      closeAriaLabel="Close display and camera controls"
      modal={false}
    >
      <section className="leo-sinr-display-drawer-section">
        <span className="leo-sinr-display-drawer-label">Beam density</span>
        <div
          className="leo-control-bar__density-group"
          role="group"
          aria-label="Beam density"
          data-testid="beam-density-control"
        >
          {DENSITY_OPTIONS.map(option => {
            const selected = beamDensity === option.density;
            return (
              <button
                key={option.density}
                className={`${UI_CLASSES.button} leo-control-bar__density-button`}
                type="button"
                aria-label={`Set beam density to ${option.label}`}
                aria-pressed={selected}
                data-testid={`beam-density-${option.label}`}
                onClick={() => onBeamDensityChange(option.density)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="leo-sinr-display-drawer-section">
        <label
          className="leo-control-bar__toggle"
          title="Show or hide beam information blocks in the scene"
        >
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
      </section>

      <section className="leo-sinr-display-drawer-section">
        <span className="leo-sinr-display-drawer-label">Camera preset</span>
        <div
          className="leo-control-bar__camera-group"
          role="group"
          aria-label="Camera presets"
          data-testid="camera-preset-control"
        >
          {CAMERA_PRESETS.map(option => (
            <button
              key={option.preset}
              className={`${UI_CLASSES.button} leo-control-bar__camera-button`}
              type="button"
              aria-label={`Set camera preset to ${option.label}`}
              data-testid={`camera-preset-${option.preset}`}
              onClick={() => onCameraPresetSelect(option.preset)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </section>

      <section className="leo-sinr-display-drawer-section">
        <label
          className="leo-control-bar__toggle"
          title="Highlight serving beam path with cinematic spotlight"
        >
          <input
            className={UI_CLASSES.checkbox}
            type="checkbox"
            aria-label="Spotlight mode: highlight serving beam path"
            checked={cinematicMode === 'spotlight'}
            onChange={event => {
              onCinematicModeChange(event.target.checked ? 'spotlight' : 'off');
            }}
          />
          Spotlight
        </label>

        <label
          className="leo-control-bar__toggle"
          title="Auto-slow simulation rate during handover events"
        >
          <input
            className={UI_CLASSES.checkbox}
            type="checkbox"
            aria-label="Auto slow on handover"
            checked={autoSlowEnabled}
            onChange={onToggleAutoSlow}
          />
          HO Slow
        </label>
      </section>
    </AdvancedDrawerShell>
  );
}
