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
  gap: UI_TOKENS.space.panel,
  padding: '16px',
  borderRadius: UI_TOKENS.radius.lg,
  background: 'rgba(255, 176, 0, 0.055)',
  border: '1px solid rgba(255, 210, 100, 0.18)',
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
    <div
      data-policy-field={config.field}
      style={{
        display: 'grid',
        gap: 10,
        padding: '13px 14px',
        borderRadius: UI_TOKENS.radius.md,
        background: 'rgba(255,255,255,0.035)',
        border: hasDraftChange ? '1px solid rgba(255, 210, 100, 0.36)' : `1px solid ${UI_TOKENS.color.border.soft}`,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: UI_TOKENS.type.size.subheading,
            color: UI_TOKENS.color.text.controlLabel,
            lineHeight: 1.3,
            fontWeight: UI_TOKENS.type.weight.heavy,
          }}>
            {config.label}
          </div>
          <div style={{ marginTop: 5, fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.secondary, lineHeight: 1.45 }}>
            {config.description}
          </div>
        </div>
        <div style={{
          padding: '6px 9px',
          borderRadius: UI_TOKENS.radius.md,
          background: hasDraftChange ? 'rgba(255, 210, 100, 0.14)' : 'rgba(255,255,255,0.07)',
          border: hasDraftChange ? '1px solid rgba(255, 210, 100, 0.34)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
          color: UI_TOKENS.color.text.primary,
          fontSize: UI_TOKENS.type.size.bodyLg,
          fontWeight: UI_TOKENS.type.weight.heavy,
          whiteSpace: 'nowrap',
        }}>
          {formatPolicyValue(value, config.unit)}
        </div>
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
      <div style={{ fontSize: UI_TOKENS.type.size.body, color: '#f4ddb0', lineHeight: 1.45 }}>
        {config.effect}
      </div>
      {hasDraftChange && (
        <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.muted }}>
          Applied value remains {formatPolicyValue(appliedValue, config.unit)} until Apply policy changes.
        </div>
      )}
    </div>
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
      data-testid="handover-policy-controls"
      aria-label="Handover Policy Research Controls"
      style={sectionStyle}
    >
      <div style={{ display: 'grid', gap: 9 }}>
        <div style={{
          fontSize: UI_TOKENS.type.size.body,
          color: UI_TOKENS.color.semantic.candidate.title,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          fontWeight: UI_TOKENS.type.weight.heavy,
        }}>
          Handover Policy Research Controls
        </div>
        <div style={{ fontSize: UI_TOKENS.type.size.body, color: UI_TOKENS.color.text.secondary, lineHeight: 1.5 }}>
          These staged policy values tune handover qualification and timers, not the HOBS SINR formula tabs.
        </div>
        <div
          data-testid="handover-policy-readonly"
          style={{
            display: 'inline-flex',
            width: 'fit-content',
            padding: '5px 9px',
            borderRadius: UI_TOKENS.radius.pill,
            background: 'rgba(255, 210, 100, 0.1)',
            border: '1px solid rgba(255, 210, 100, 0.24)',
            color: UI_TOKENS.color.semantic.fixed,
            fontSize: UI_TOKENS.type.size.caption,
            fontWeight: UI_TOKENS.type.weight.heavy,
          }}
        >
          policy: {applied.policy} - read-only
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
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

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 9, alignItems: 'center' }}>
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
            background: hasDraftChanges ? 'rgba(116, 78, 10, 0.76)' : 'rgba(255,255,255,0.04)',
            color: hasDraftChanges ? '#fff4d0' : 'rgba(255,255,255,0.38)',
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
            border: hasOverrides ? '1px solid rgba(255,255,255,0.24)' : `1px solid ${UI_TOKENS.color.border.subtle}`,
            background: hasOverrides ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
            color: hasOverrides ? UI_TOKENS.color.text.primary : 'rgba(255,255,255,0.38)',
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
