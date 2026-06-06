import { UI_CLASSES } from '../constants/uiTokens';
import type { SceneLane } from '../app/sceneLane';
import type { BeamDensity, CameraPreset, CinematicMode } from '../scene/types';
import {
  MODQN_VISUAL_LAYER_PRESETS,
  type ModqnVisualLayerPreset,
} from '../scene/modqnVisualLayers';
import { UI_MODES, isUiMode, type UiMode } from './uiMode';
import type { RuntimeHandoverMode } from '../modqn/runtimeControls';

interface ProfileOption {
  id: string;
  label: string;
}

interface ControlBarProps {
  selectedProfileId: string;
  profileOptions: ProfileOption[];
  // Playback (play/pause, speed, scrub, seek) is owned solely by the bottom
  // TimelineBar — the ControlBar no longer duplicates it (consolidation C1).
  autoSlowEnabled: boolean;
  uiMode: UiMode;
  beamDensity: BeamDensity;
  beamCalloutsEnabled: boolean;
  cinematicMode: CinematicMode;
  /** Current handover mode — read for the MODQN decision-policy toggle's active state. */
  handoverMode?: RuntimeHandoverMode;
  onProfileChange: (profileId: string) => void;
  onUiModeChange: (mode: UiMode) => void;
  onBeamDensityChange: (density: BeamDensity) => void;
  onToggleBeamCallouts: () => void;
  onCameraPresetSelect: (preset: CameraPreset) => void;
  onCinematicModeChange: (mode: CinematicMode) => void;
  onToggleAutoSlow: () => void;

  // P2b Display-filter & focus UE controls
  sceneSource?: 'live-sim' | 'artifact-replay';
  sceneLane?: SceneLane;
  liveUeCount?: number;
  ueDisplayCount?: number;
  maxUeCount?: number;
  onUeDisplayCountChange?: (count: number) => void;
  elevatedUeId?: string | null;
  ueIds?: readonly string[];
  onElevatedUeIdChange?: (id: string) => void;
  modqnVisualLayerPreset?: ModqnVisualLayerPreset;
  onModqnVisualLayerPresetChange?: (preset: ModqnVisualLayerPreset) => void;
  /** Flip the MODQN decision policy (paper overlay <-> omega-heuristic) on the MODQN live lane. */
  onModqnDecisionPolicyChange?: (mode: RuntimeHandoverMode) => void;
}

const UI_MODE_LABELS: Record<UiMode, string> = {
  presentation: 'Presentation',
  tuning: 'Tuning',
  diagnostics: 'Diagnostics',
};

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

const MODQN_LAYER_PRESET_LABELS: Record<ModqnVisualLayerPreset, string> = {
  'baseline-faithful': 'Baseline',
  'service-allocation': 'Service',
  'explain-handover': 'Explain',
  debug: 'Debug',
};

export function ControlBar({
  autoSlowEnabled,
  uiMode,
  beamDensity,
  beamCalloutsEnabled,
  cinematicMode,
  handoverMode = 'sinr-offset',
  onUiModeChange,
  onBeamDensityChange,
  onToggleBeamCallouts,
  onCameraPresetSelect,
  onCinematicModeChange,
  onToggleAutoSlow,
  sceneSource = 'live-sim',
  sceneLane = sceneSource === 'artifact-replay' ? 'artifact-replay' : 'sinr-live',
  liveUeCount = 1,
  ueDisplayCount = 100,
  maxUeCount = 100,
  onUeDisplayCountChange,
  elevatedUeId = null,
  ueIds = [],
  onElevatedUeIdChange,
  modqnVisualLayerPreset = 'baseline-faithful',
  onModqnVisualLayerPresetChange,
  onModqnDecisionPolicyChange,
}: ControlBarProps) {
  const isArtifactReplay = sceneLane === 'artifact-replay' || sceneSource === 'artifact-replay';
  const showSinrLiveControls = sceneLane === 'sinr-live';
  const showModqnLayerControls = sceneLane === 'modqn-live-cell-preview';
  return (
    <div className="leo-control-bar">
      <label className="leo-control-bar__field-row">
        Mode:
        <select
          className={`${UI_CLASSES.select} leo-control-bar__mode-select`}
          aria-label="UI mode"
          value={uiMode}
          onChange={event => {
            const nextMode = event.target.value;
            if (isUiMode(nextMode)) onUiModeChange(nextMode);
          }}
        >
          {UI_MODES.map(mode => (
            <option key={mode} value={mode}>
              {UI_MODE_LABELS[mode]}
            </option>
          ))}
        </select>
      </label>

      {showSinrLiveControls && (
        <>
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
        </>
      )}

      {showModqnLayerControls && (
        <div
          className="leo-control-bar__modqn-layer-group"
          role="group"
          aria-label="MODQN visual layer preset"
          data-testid="modqn-layer-preset-control"
          data-modqn-layer-preset={modqnVisualLayerPreset}
        >
          <span className="leo-control-bar__group-label" aria-hidden="true">MODQN layers:</span>
          {MODQN_VISUAL_LAYER_PRESETS.map(preset => {
            const selected = modqnVisualLayerPreset === preset;
            return (
              <button
                key={preset}
                className={`${UI_CLASSES.button} leo-control-bar__modqn-layer-button`}
                type="button"
                aria-label={`Set MODQN visual layer preset to ${MODQN_LAYER_PRESET_LABELS[preset]}`}
                aria-pressed={selected}
                data-testid={`modqn-layer-preset-${preset}`}
                onClick={() => onModqnVisualLayerPresetChange?.(preset)}
              >
                {MODQN_LAYER_PRESET_LABELS[preset]}
              </button>
            );
          })}
        </div>
      )}

      {showModqnLayerControls && (
        <div
          className="leo-control-bar__modqn-layer-group"
          role="group"
          aria-label="MODQN decision policy"
          data-testid="modqn-decision-policy-control"
          data-modqn-decision-policy={handoverMode}
        >
          <span className="leo-control-bar__group-label" aria-hidden="true">Decision policy:</span>
          <button
            type="button"
            className={`${UI_CLASSES.button} leo-control-bar__modqn-layer-button`}
            aria-pressed={handoverMode === 'decision-overlay-on-live-sinr'}
            data-testid="modqn-decision-policy-overlay"
            title="Paper-faithful MODQN decision overlay on live SINR"
            onClick={() => onModqnDecisionPolicyChange?.('decision-overlay-on-live-sinr')}
          >
            Paper overlay
          </button>
          <button
            type="button"
            className={`${UI_CLASSES.button} leo-control-bar__modqn-layer-button`}
            aria-pressed={handoverMode === 'omega-heuristic'}
            data-testid="modqn-decision-policy-heuristic"
            title="Heuristic ω-scoring — NOT paper MODQN; selecting it shows a persistent disclosure banner"
            onClick={() => onModqnDecisionPolicyChange?.('omega-heuristic')}
          >
            Heuristic ω (NOT paper)
          </button>
        </div>
      )}

      {isArtifactReplay ? (
        <>
          <label className="leo-control-bar__field-row">
            Active UEs:
            <input
              className={`${UI_CLASSES.range} leo-control-bar__speed-range`}
              type="range"
              min={1}
              max={maxUeCount}
              value={ueDisplayCount}
              aria-label="Active UEs display filter"
              onChange={e => onUeDisplayCountChange?.(Number(e.target.value))}
            />
            <span>showing {ueDisplayCount} of {maxUeCount}</span>
          </label>
          <label className="leo-control-bar__field-row">
            Focus UE:
            <select
              className={UI_CLASSES.select + ' leo-control-bar__ue-select'}
              value={elevatedUeId ?? ''}
              onChange={e => onElevatedUeIdChange?.(e.target.value)}
            >
              {ueIds.map(id => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <span className="leo-control-bar__ue-filter-readonly">
          Active UEs: {Math.max(1, Math.trunc(liveUeCount))}
        </span>
      )}
    </div>
  );
}
