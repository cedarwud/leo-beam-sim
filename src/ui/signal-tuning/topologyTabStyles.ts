import type { CSSProperties } from 'react';
import { UI_TOKENS } from '../../constants/uiTokens';

export const topologySectionStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '14px 15px',
  borderRadius: UI_TOKENS.radius.lg,
  background: UI_TOKENS.color.surface.card,
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
  borderLeft: `4px solid ${UI_TOKENS.color.semantic.fixed}aa`,
};

export const topologyNoticeStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: '10px 12px',
  borderRadius: UI_TOKENS.radius.md,
  background: 'rgba(255, 214, 125, 0.10)',
  border: '1px solid rgba(255, 214, 125, 0.24)',
  color: 'rgba(255, 231, 180, 0.9)',
  fontSize: UI_TOKENS.type.size.body,
  lineHeight: 1.4,
};

export const topologySplitHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'start',
};

export const topologyHeaderStackStyle: CSSProperties = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
};

export const topologyTitleRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 8,
};

export const topologyTitleStyle: CSSProperties = {
  color: UI_TOKENS.color.text.controlLabel,
  fontSize: UI_TOKENS.type.size.bodyLg,
  fontWeight: UI_TOKENS.type.weight.heavy,
  lineHeight: 1.3,
};

export const topologyBadgeStyle: CSSProperties = {
  padding: '3px 7px',
  borderRadius: UI_TOKENS.radius.sm,
  background: 'rgba(132, 148, 163, 0.12)',
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
  color: UI_TOKENS.color.text.secondary,
  fontSize: UI_TOKENS.type.size.caption,
  fontWeight: UI_TOKENS.type.weight.heavy,
  textTransform: 'uppercase',
};

export const topologyValuePillStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: UI_TOKENS.radius.md,
  background: 'rgba(255, 255, 255, 0.055)',
  border: `1px solid ${UI_TOKENS.color.semantic.fixed}38`,
  color: UI_TOKENS.color.text.primary,
  fontSize: UI_TOKENS.type.size.bodyLg,
  fontWeight: UI_TOKENS.type.weight.heavy,
  whiteSpace: 'nowrap',
};

export const topologyRangeStackStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
};

export const topologyRangeInputStyle: CSSProperties = {
  width: '100%',
  accentColor: UI_TOKENS.color.semantic.fixed,
  cursor: 'pointer',
};

export const topologyChoiceInputStyle: CSSProperties = {
  width: 16,
  height: 16,
  margin: 0,
  accentColor: UI_TOKENS.color.semantic.fixed,
  cursor: 'pointer',
};

export const topologyRangeBoundsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  color: UI_TOKENS.color.text.secondary,
  fontSize: UI_TOKENS.type.size.body,
  lineHeight: 1.35,
};

export const topologyEffectiveValueStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  color: UI_TOKENS.color.text.secondary,
  fontSize: UI_TOKENS.type.size.body,
  lineHeight: 1.45,
};

export const topologyActionRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 8,
};

export const topologySecondaryButtonStyle: CSSProperties = {
  cursor: 'pointer',
  borderRadius: UI_TOKENS.radius.md,
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
  background: 'rgba(132, 148, 163, 0.08)',
  color: UI_TOKENS.color.text.secondary,
  padding: '8px 10px',
  fontSize: UI_TOKENS.type.size.body,
  fontWeight: UI_TOKENS.type.weight.strong,
};

export const topologyClearButtonStyle: CSSProperties = {
  ...topologySecondaryButtonStyle,
  background: 'rgba(255, 255, 255, 0.055)',
};

export const topologySrOnlyLegendStyle: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0,
};

export const topologyParamPanelStyle: CSSProperties = {
  display: 'grid',
  gap: 12,
  padding: '12px 13px',
  borderRadius: UI_TOKENS.radius.md,
  background: 'rgba(255, 255, 255, 0.045)',
  border: `1px solid ${UI_TOKENS.color.border.subtle}`,
};

export const topologyParamLabelStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  color: UI_TOKENS.color.text.controlLabel,
  fontSize: UI_TOKENS.type.size.body,
  fontWeight: UI_TOKENS.type.weight.strong,
  lineHeight: 1.35,
};

export function topologyRadioFieldsetStyle(columns: 2 | 3 | 4): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: 8,
    padding: 0,
    margin: 0,
    border: 0,
    minWidth: 0,
  };
}

export function topologyRadioLabelStyle(
  active: boolean,
  textTransform?: CSSProperties['textTransform'],
): CSSProperties {
  return {
    cursor: 'pointer',
    display: 'grid',
    gap: 5,
    justifyItems: 'center',
    padding: '10px 9px',
    borderRadius: UI_TOKENS.radius.md,
    border: `1px solid ${active ? `${UI_TOKENS.color.semantic.fixed}66` : UI_TOKENS.color.border.subtle}`,
    background: active ? 'rgba(255, 214, 125, 0.12)' : 'rgba(255, 255, 255, 0.045)',
    color: active ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
    fontSize: UI_TOKENS.type.size.body,
    fontWeight: UI_TOKENS.type.weight.strong,
    lineHeight: 1.25,
    textTransform,
  };
}

export function topologyTrailToggleStyle(enabled: boolean): CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 12px',
    borderRadius: UI_TOKENS.radius.md,
    background: enabled ? 'rgba(255, 214, 125, 0.10)' : 'rgba(255, 255, 255, 0.045)',
    border: `1px solid ${enabled ? `${UI_TOKENS.color.semantic.fixed}55` : UI_TOKENS.color.border.subtle}`,
    color: enabled ? UI_TOKENS.color.text.primary : UI_TOKENS.color.text.secondary,
    fontSize: UI_TOKENS.type.size.body,
    fontWeight: UI_TOKENS.type.weight.strong,
    lineHeight: 1.35,
    cursor: 'pointer',
  };
}
