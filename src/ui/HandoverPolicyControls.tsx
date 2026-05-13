import type { CSSProperties } from 'react';
import { UI_CLASSES, UI_TOKENS } from '../constants/uiTokens';
import type { HandoverPolicyTuningState } from '../handoverPolicyTuning';

type NumericHandoverPolicyField = Exclude<keyof HandoverPolicyTuningState, 'policy'>;

interface HandoverPolicyControlConfig {
  field: NumericHandoverPolicyField;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  description: string;
  effect: string;
}

interface HandoverPolicyControlsProps {
  draft: HandoverPolicyTuningState;
  applied: HandoverPolicyTuningState;
  hasDraftChanges: boolean;
  hasOverrides: boolean;
  onDraftChange: (next: HandoverPolicyTuningState) => void;
  onApply: () => void;
  onReset: () => void;
}

const POLICY_CONTROL_CONFIGS: readonly HandoverPolicyControlConfig[] = [
  {
    field: 'offsetDb',
    label: 'Handover offset margin',
    unit: 'dB',
    min: 0,
    max: 10,
    step: 0.25,
    description: 'Candidate target must beat the current link by this margin before inter-satellite handover can progress.',
    effect: 'Lower is more aggressive; higher is stickier.',
  },
  {
    field: 'triggerTimeSec',
    label: 'Inter-HO trigger time',
    unit: 's',
    min: 0,
    max: 15,
    step: 0.25,
    description: 'Stable pending-target dwell before inter-satellite handover commits.',
    effect: 'Longer dwell reduces fast switching at the cost of slower response.',
  },
  {
    field: 'pingPongGuardSec',
    label: 'Ping-pong guard window',
    unit: 's',
    min: 0,
    max: 30,
    step: 0.5,
    description: 'Cooldown after inter-satellite handover to reduce immediate switching back.',
    effect: 'Longer guard windows make the manager less willing to reverse a recent handover.',
  },
  {
    field: 'sinrSmoothingSec',
    label: 'Decision SINR smoothing',
    unit: 's',
    min: 0,
    max: 5,
    step: 0.1,
    description: 'Decision-path smoothing for candidate link samples; 0 uses the raw per-frame value.',
    effect: 'More smoothing dampens momentary spikes before they affect the handover state machine.',
  },
  {
    field: 'intraSwitchTimeSec',
    label: 'Same-satellite beam dwell',
    unit: 's',
    min: 0,
    max: 5,
    step: 0.1,
    description: 'Dwell before switching beams on the same satellite.',
    effect: 'Shorter dwell tracks beam quality faster; longer dwell avoids frequent beam changes.',
  },
  {
    field: 'pendingTargetHoldSec',
    label: 'Pending target hold',
    unit: 's',
    min: 0,
    max: 10,
    step: 0.25,
    description: 'Grace window before replacing a still-qualified pending target.',
    effect: 'Higher values keep a pending target stable when another option briefly looks better.',
  },
  {
    field: 'sinrThresholdDb',
    label: 'Handover attach threshold',
    unit: 'dB',
    min: -20,
    max: 10,
    step: 0.5,
    description: 'Minimum attach and reattach eligibility level for the handover manager.',
    effect: 'This names the handover policy gate, not the DPC beam-power control field.',
  },
];

const sectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '12px',
  borderRadius: UI_TOKENS.radius.lg,
  background: 'linear-gradient(180deg, rgba(117, 74, 10, 0.22), rgba(24, 18, 8, 0.18))',
  border: '1px solid rgba(255, 210, 100, 0.2)',
};

function formatPolicyValue(value: number, unit: string): string {
  const digits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(digits)} ${unit}`;
}

function PolicyNumericControl({
  config,
  value,
  appliedValue,
  onChange,
}: {
  config: HandoverPolicyControlConfig;
  value: number;
  appliedValue: number;
  onChange: (value: number) => void;
}) {
  const hasDraftChange = value !== appliedValue;

  return (
    <article
      className="leo-policy-control-card"
      data-policy-field={config.field}
      data-draft-changed={hasDraftChange ? 'true' : 'false'}
    >
      <div className="leo-policy-control-heading">
        <div className="leo-policy-control-title-block">
          <div className="leo-policy-control-label">{config.label}</div>
          <div className="leo-policy-control-applied">
            Applied {formatPolicyValue(appliedValue, config.unit)}
          </div>
        </div>
        <output className="leo-policy-control-value">
          {formatPolicyValue(value, config.unit)}
        </output>
      </div>
      <input
        className={UI_CLASSES.range}
        type="range"
        aria-label={`${config.label} (${config.unit})`}
        min={config.min}
        max={config.max}
        step={config.step}
        value={value}
        onChange={event => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: UI_TOKENS.color.semantic.candidate.accent }}
      />
      <div className="leo-policy-control-range">
        <span>{formatPolicyValue(config.min, config.unit)}</span>
        <span>{formatPolicyValue(config.max, config.unit)}</span>
      </div>
      <details className="leo-policy-control-details">
        <summary>What this changes</summary>
        <p>{config.description}</p>
        <p>{config.effect}</p>
      </details>
      {hasDraftChange && (
        <div className="leo-policy-control-draft-note">
          Applied value remains {formatPolicyValue(appliedValue, config.unit)} until Apply policy changes.
        </div>
      )}
    </article>
  );
}

export function HandoverPolicyControls({
  draft,
  applied,
  hasDraftChanges,
  hasOverrides,
  onDraftChange,
  onApply,
  onReset,
}: HandoverPolicyControlsProps) {
  const updateNumber = (field: NumericHandoverPolicyField, value: number) => {
    onDraftChange({ ...draft, [field]: value });
  };

  return (
    <section
      className="leo-handover-policy-controls"
      data-testid="handover-policy-controls"
      aria-label="Handover Policy Research Controls"
      style={sectionStyle}
    >
      <div className="leo-policy-section-header">
        <div className="leo-policy-section-title-row">
          <div className="leo-policy-section-title">
            Handover Policy Research Controls
          </div>
          <div
            className="leo-policy-readonly-pill"
            data-testid="handover-policy-readonly"
          >
            policy: {applied.policy} - read-only
          </div>
        </div>
        <details className="leo-policy-control-details leo-policy-control-details--section">
          <summary>Scope and boundary</summary>
          <p>
            These staged policy values tune handover qualification and timers, not the HOBS SINR formula tabs.
          </p>
        </details>
      </div>

      <div className="leo-policy-control-list">
        {POLICY_CONTROL_CONFIGS.map(config => (
          <PolicyNumericControl
            key={config.field}
            config={config}
            value={draft[config.field]}
            appliedValue={applied[config.field]}
            onChange={value => updateNumber(config.field, value)}
          />
        ))}
      </div>

      <div className="leo-policy-action-row">
        <button
          className={UI_CLASSES.button}
          type="button"
          onClick={onApply}
          disabled={!hasDraftChanges}
          style={{
            cursor: hasDraftChanges ? 'pointer' : 'default',
            padding: '10px 12px',
            borderRadius: UI_TOKENS.radius.md,
            border: hasDraftChanges ? '1px solid rgba(255, 210, 100, 0.5)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: hasDraftChanges ? 'rgba(116, 78, 10, 0.72)' : UI_TOKENS.color.surface.cardFaint,
            color: hasDraftChanges ? '#fff2cf' : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.heavy,
          }}
        >
          Apply policy changes
        </button>
        <button
          className={UI_CLASSES.button}
          type="button"
          onClick={onReset}
          disabled={!hasOverrides}
          style={{
            cursor: hasOverrides ? 'pointer' : 'default',
            padding: '10px 12px',
            borderRadius: UI_TOKENS.radius.md,
            border: hasOverrides ? `1px solid ${UI_TOKENS.color.border.soft}` : `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: hasOverrides ? UI_TOKENS.color.surface.card : UI_TOKENS.color.surface.cardFaint,
            color: hasOverrides ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.faint,
            fontSize: UI_TOKENS.type.size.body,
            fontWeight: UI_TOKENS.type.weight.strong,
          }}
        >
          Reset to profile defaults
        </button>
        <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.muted }}>
          {hasDraftChanges ? 'Draft edits are staged.' : 'Draft matches the applied policy.'}
        </div>
      </div>
    </section>
  );
}
