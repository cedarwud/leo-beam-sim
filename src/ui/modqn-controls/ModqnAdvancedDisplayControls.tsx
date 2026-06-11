import { UI_CLASSES } from '../../constants/uiTokens';
import type { RuntimeHandoverMode } from '../../modqn/runtimeControls';
import {
  MODQN_VISUAL_LAYER_PRESETS,
  type ModqnVisualLayerPreset,
} from '../../scene/modqnVisualLayers';

interface ModqnAdvancedDisplayControlsProps {
  readonly handoverMode: RuntimeHandoverMode;
  readonly modqnVisualLayerPreset: ModqnVisualLayerPreset;
  readonly showDecisionPolicyControls: boolean;
  readonly onModqnVisualLayerPresetChange: (preset: ModqnVisualLayerPreset) => void;
  readonly onModqnDecisionPolicyChange: (mode: RuntimeHandoverMode) => void;
}

const MODQN_LAYER_PRESET_LABELS: Record<ModqnVisualLayerPreset, string> = {
  minimal: 'Minimal',
  'baseline-faithful': 'Baseline',
  'service-allocation': 'Service',
  'explain-handover': 'Explain',
  debug: 'Debug',
};

export function ModqnAdvancedDisplayControls({
  handoverMode,
  modqnVisualLayerPreset,
  showDecisionPolicyControls,
  onModqnVisualLayerPresetChange,
  onModqnDecisionPolicyChange,
}: ModqnAdvancedDisplayControlsProps) {
  return (
    <section
      className="leo-modqn-advanced-controls"
      aria-label="MODQN display and policy controls"
      data-testid="modqn-advanced-display-controls"
    >
      <header className="leo-modqn-advanced-controls__header">
        <strong>{showDecisionPolicyControls ? 'Display and policy' : 'Display depth'}</strong>
        <p>
          {showDecisionPolicyControls
            ? 'Optional preview controls. They do not change producer replay truth.'
            : 'Optional display controls. Producer replay and artifact truth stay unchanged.'}
        </p>
      </header>

      <div
        className="leo-modqn-advanced-controls__group"
        role="group"
        aria-label="MODQN visual layer preset"
        data-testid="modqn-layer-preset-control"
        data-modqn-layer-preset={modqnVisualLayerPreset}
      >
        <span className="leo-modqn-advanced-controls__label">MODQN layers</span>
        <div className="leo-modqn-advanced-controls__buttons">
          {MODQN_VISUAL_LAYER_PRESETS.map(preset => {
            const selected = modqnVisualLayerPreset === preset;
            return (
              <button
                key={preset}
                className={`${UI_CLASSES.button} leo-modqn-advanced-controls__button`}
                type="button"
                aria-label={`Set MODQN visual layer preset to ${MODQN_LAYER_PRESET_LABELS[preset]}`}
                aria-pressed={selected}
                data-testid={`modqn-layer-preset-${preset}`}
                onClick={() => onModqnVisualLayerPresetChange(preset)}
              >
                {MODQN_LAYER_PRESET_LABELS[preset]}
              </button>
            );
          })}
        </div>
      </div>

      {showDecisionPolicyControls && (
        <div
          className="leo-modqn-advanced-controls__group"
          role="group"
          aria-label="MODQN decision policy"
          data-testid="modqn-decision-policy-control"
          data-modqn-decision-policy={handoverMode}
        >
          <span className="leo-modqn-advanced-controls__label">Decision policy</span>
          <div className="leo-modqn-advanced-controls__buttons">
            <button
              type="button"
              className={`${UI_CLASSES.button} leo-modqn-advanced-controls__button`}
              aria-pressed={handoverMode === 'decision-overlay-on-live-sinr'}
              data-testid="modqn-decision-policy-overlay"
              title="Paper-faithful MODQN decision overlay on live SINR"
              onClick={() => onModqnDecisionPolicyChange('decision-overlay-on-live-sinr')}
            >
              Paper overlay
            </button>
            <button
              type="button"
              className={`${UI_CLASSES.button} leo-modqn-advanced-controls__button`}
              aria-pressed={handoverMode === 'omega-heuristic'}
              data-testid="modqn-decision-policy-heuristic"
              title="Heuristic omega scoring - NOT paper MODQN; selecting it shows a persistent disclosure banner"
              onClick={() => onModqnDecisionPolicyChange('omega-heuristic')}
            >
              Heuristic omega
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
