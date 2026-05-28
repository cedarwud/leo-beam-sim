import { useCallback } from 'react';
import type { JSX } from 'react';
import type { AppExperienceMode } from '../../app/appExperienceMode';

export interface BeamHoppingDemoState {
  readonly enabled: boolean;
  readonly slotSec: number;
}

export const DEFAULT_BEAM_HOPPING_DEMO_STATE: BeamHoppingDemoState = {
  enabled: false,
  slotSec: 2.5,
};

export const BEAM_HOPPING_DEMO_SLOT_MIN = 1.0;
export const BEAM_HOPPING_DEMO_SLOT_MAX = 5.0;
export const BEAM_HOPPING_DEMO_SLOT_STEP = 0.5;

interface BeamHoppingToggleProps {
  readonly appMode: AppExperienceMode;
  readonly state: BeamHoppingDemoState;
  readonly onChange: (next: BeamHoppingDemoState) => void;
}

export function BeamHoppingToggle({
  appMode,
  state,
  onChange,
}: BeamHoppingToggleProps): JSX.Element | null {
  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...state, enabled: event.target.checked });
    },
    [onChange, state],
  );

  const handleSlotChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = Number.parseFloat(event.target.value);
      if (!Number.isFinite(parsed)) return;
      const clamped = Math.min(
        BEAM_HOPPING_DEMO_SLOT_MAX,
        Math.max(BEAM_HOPPING_DEMO_SLOT_MIN, parsed),
      );
      onChange({ ...state, slotSec: clamped });
    },
    [onChange, state],
  );

  if (appMode !== 'modqn-demo') return null;

  return (
    <section
      className="leo-beam-hopping-toggle"
      data-testid="beam-hopping-toggle"
      data-app-mode={appMode}
      data-beam-hopping-enabled={state.enabled ? '1' : '0'}
      data-beam-hopping-slot-sec={state.slotSec.toFixed(2)}
      aria-label="Beam hopping demo controls"
    >
      <header className="leo-beam-hopping-toggle__header">
        <h3>Beam hopping demo</h3>
        <span className="leo-beam-hopping-toggle__provenance">
          live-sim only · not paper baseline
        </span>
      </header>
      <label className="leo-beam-hopping-toggle__row">
        <input
          type="checkbox"
          data-testid="beam-hopping-toggle-enabled"
          checked={state.enabled}
          onChange={handleEnabledChange}
        />
        <span>Enable hopping animation</span>
      </label>
      <label className="leo-beam-hopping-toggle__row">
        <span>Slot duration ({state.slotSec.toFixed(1)}s)</span>
        <input
          type="range"
          data-testid="beam-hopping-toggle-slot-sec"
          min={BEAM_HOPPING_DEMO_SLOT_MIN}
          max={BEAM_HOPPING_DEMO_SLOT_MAX}
          step={BEAM_HOPPING_DEMO_SLOT_STEP}
          value={state.slotSec}
          disabled={!state.enabled}
          onChange={handleSlotChange}
        />
      </label>
      <p className="leo-beam-hopping-toggle__help">
        Replay artifacts ignore this toggle (producer truth: beamHopping
        disabled per modqn-training-truth-visualization-sdd §7.5).
      </p>
    </section>
  );
}

export function applyBeamHoppingDemoOverride<P extends {
  readonly beamHopping: {
    readonly enabled: boolean;
    readonly slotSec: number;
    readonly maxActiveBeamsPerSlot: number;
    readonly scheduler: string;
    readonly frameLengthSlots: number;
  };
}>(profile: P, override: BeamHoppingDemoState): P {
  if (!override.enabled) return profile;
  return {
    ...profile,
    beamHopping: {
      ...profile.beamHopping,
      enabled: true,
      slotSec: override.slotSec,
    },
  };
}
