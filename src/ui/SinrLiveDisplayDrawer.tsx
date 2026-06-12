// G1-CONTROLBAR-ADV + G1-LEFT-DEFAULT — the SINR-live opt-in "⚙ Advanced" drawer.
//
// North star: 少按鈕 / 直覺 / 零學習. The default SINR-live surface is the scene
// (mosaic + cones + live-handover pulse) + the shared Mode select + the read-only
// Active-UEs count in the top bar + the light orientation card in the left rail.
// Every power/display control lives here behind one ⚙ trigger, in collapsible
// sections:
//   - Display & camera (default-open): beam density, beam-info callouts, camera
//     presets, spotlight, auto-slow-on-HO — relocated off the top bar
//     (G1-CONTROLBAR-ADV).
//   - SINR formula / Handover policy (default-collapsed): the heavy tuners that
//     used to occupy the left rail (G1-LEFT-DEFAULT). App injects them as nodes so
//     this drawer does not prop-drill their large prop sets.
//
// These controls are RELOCATED, not gated or changed: testids + handlers are
// identical to the prior in-ControlBar / left-rail mounts. The drawer is non-modal
// (no scrim) so the scene + timeline stay interactive while controls are adjusted.
import { type ReactElement, type ReactNode } from 'react';
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
  /** G1-LEFT-DEFAULT: the relocated SINR-formula tuner (App injects the panel node). */
  readonly sinrFormulaSection?: ReactNode;
  /** G1-LEFT-DEFAULT: the relocated handover-policy tuner (App injects the panel node). */
  readonly handoverPolicySection?: ReactNode;
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
  sinrFormulaSection,
  handoverPolicySection,
}: SinrLiveDisplayDrawerProps): ReactElement {
  return (
    <AdvancedDrawerShell
      testIdPrefix="sinr-live-display"
      triggerLabel="⚙ Advanced"
      triggerHint="density · camera · spotlight · SINR formula · handover"
      dialogTitle="Advanced controls"
      dialogAriaLabel="SINR-live advanced display, camera and tuning controls"
      closeAriaLabel="Close advanced controls"
      modal={false}
    >
      <details className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-display" open>
        <summary className="leo-sinr-advanced-summary">Display &amp; camera</summary>
        <div className="leo-sinr-advanced-body leo-sidebar-content-stack">
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
        </div>
      </details>

      {sinrFormulaSection && (
        <details className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-formula">
          <summary className="leo-sinr-advanced-summary">SINR formula</summary>
          <div className="leo-sinr-advanced-body">{sinrFormulaSection}</div>
        </details>
      )}

      {handoverPolicySection && (
        <details className="leo-sinr-advanced-section" data-testid="sinr-live-advanced-handover">
          <summary className="leo-sinr-advanced-summary">Handover policy</summary>
          <div className="leo-sinr-advanced-body">{handoverPolicySection}</div>
        </details>
      )}
    </AdvancedDrawerShell>
  );
}
