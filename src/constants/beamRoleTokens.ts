import { UI_TOKENS } from './uiTokens';

export type BeamCodeRole = 'serving' | 'secondary' | 'approach' | 'prepared' | 'post-ho';

export type BeamVisualRole =
  | 'serving'
  | 'pending'
  | 'approach'
  | 'recentSource'
  | 'otherActive'
  | 'inactive';

export interface BeamRoleToken {
  operatorLabel: string | null;
  markerLabel: string | null;
  color: string;
  lineWidth: number;
  linkLineWidth: number;
  coneOpacity: number;
  discOpacity: number;
  lineOpacity: number;
  endpointRadius: number;
  endpointOpacity: number;
  endpointFilled: boolean;
  dashed: boolean;
  calloutMinWidth: number;
  calloutGlowPx: number;
  markerScale: number;
  markerFontSize: number;
  markerLightIntensity: number;
}

export interface BeamVisualEncoding extends BeamRoleToken {
  visualRole: BeamVisualRole;
  color: string;
  slotStateLabel: 'SLOT OFF' | 'UNSCHEDULED' | null;
  isEventPrimary: boolean;
  isEmphasized: boolean;
}

export const BEAM_FREQUENCY_COLORS = [
  '#63d471',
  '#8ea2ff',
  '#ff6f73',
  '#6bc6a8',
  '#b991ff',
  '#d98564',
] as const;

export const BEAM_ROLE_TOKENS: Record<BeamVisualRole, BeamRoleToken> = {
  serving: {
    operatorLabel: 'SERVING',
    markerLabel: 'SERVING',
    color: UI_TOKENS.color.semantic.serving.accent,
    lineWidth: 4,
    linkLineWidth: 3.8,
    coneOpacity: 0.36,
    discOpacity: 0.23,
    lineOpacity: 1,
    endpointRadius: 5,
    endpointOpacity: 0.96,
    endpointFilled: true,
    dashed: false,
    calloutMinWidth: 88,
    calloutGlowPx: 20,
    markerScale: 7,
    markerFontSize: 12,
    markerLightIntensity: 1,
  },
  pending: {
    operatorLabel: 'PENDING',
    markerLabel: 'PENDING',
    color: UI_TOKENS.color.semantic.candidate.accent,
    lineWidth: 3.4,
    linkLineWidth: 2.8,
    coneOpacity: 0.3,
    discOpacity: 0.19,
    lineOpacity: 0.92,
    endpointRadius: 4.6,
    endpointOpacity: 0.9,
    endpointFilled: true,
    dashed: true,
    calloutMinWidth: 88,
    calloutGlowPx: 18,
    markerScale: 6.2,
    markerFontSize: 11,
    markerLightIntensity: 0.65,
  },
  approach: {
    operatorLabel: 'APPROACH',
    markerLabel: 'APPROACH',
    color: '#cf5cff',
    lineWidth: 2.5,
    linkLineWidth: 2.1,
    coneOpacity: 0.2,
    discOpacity: 0.13,
    lineOpacity: 0.76,
    endpointRadius: 4,
    endpointOpacity: 0.72,
    endpointFilled: false,
    dashed: true,
    calloutMinWidth: 92,
    calloutGlowPx: 14,
    markerScale: 5.8,
    markerFontSize: 10,
    markerLightIntensity: 0.45,
  },
  recentSource: {
    operatorLabel: 'SOURCE',
    markerLabel: 'HO SOURCE',
    color: '#83a8c7',
    lineWidth: 2.3,
    linkLineWidth: 2.2,
    coneOpacity: 0.17,
    discOpacity: 0.1,
    lineOpacity: 0.64,
    endpointRadius: 4.1,
    endpointOpacity: 0.62,
    endpointFilled: false,
    dashed: true,
    calloutMinWidth: 82,
    calloutGlowPx: 10,
    markerScale: 5.6,
    markerFontSize: 10,
    markerLightIntensity: 0.25,
  },
  otherActive: {
    operatorLabel: null,
    markerLabel: null,
    color: '#8ea2ff',
    lineWidth: 2,
    linkLineWidth: 1.8,
    coneOpacity: 0.12,
    discOpacity: 0.07,
    lineOpacity: 0.52,
    endpointRadius: 3.5,
    endpointOpacity: 0.72,
    endpointFilled: true,
    dashed: false,
    calloutMinWidth: 66,
    calloutGlowPx: 10,
    markerScale: 5,
    markerFontSize: 10,
    markerLightIntensity: 0,
  },
  inactive: {
    operatorLabel: null,
    markerLabel: null,
    color: '#64748b',
    lineWidth: 1.5,
    linkLineWidth: 1.5,
    coneOpacity: 0.055,
    discOpacity: 0.035,
    lineOpacity: 0.3,
    endpointRadius: 3.2,
    endpointOpacity: 0.34,
    endpointFilled: false,
    dashed: true,
    calloutMinWidth: 66,
    calloutGlowPx: 6,
    markerScale: 5,
    markerFontSize: 10,
    markerLightIntensity: 0,
  },
};

export function frequencyReuseColor(frequencyIndex: number): string {
  const index = ((Math.floor(frequencyIndex) % BEAM_FREQUENCY_COLORS.length) + BEAM_FREQUENCY_COLORS.length)
    % BEAM_FREQUENCY_COLORS.length;
  return BEAM_FREQUENCY_COLORS[index];
}

export function beamVisualRoleForEventRole(role?: BeamCodeRole): BeamVisualRole | null {
  switch (role) {
    case 'serving':
    case 'post-ho':
      return 'serving';
    case 'prepared':
      return 'pending';
    case 'approach':
      return 'approach';
    case 'secondary':
      return 'recentSource';
    default:
      return null;
  }
}

export function tokenForEventRole(role?: BeamCodeRole): BeamRoleToken {
  const visualRole = beamVisualRoleForEventRole(role);
  return visualRole ? BEAM_ROLE_TOKENS[visualRole] : BEAM_ROLE_TOKENS.otherActive;
}

export function operatorLabelForEventRole(role?: BeamCodeRole, marker = false): string | null {
  const token = tokenForEventRole(role);
  return marker ? token.markerLabel : token.operatorLabel;
}

export function resolveBeamVisualEncoding(input: {
  role?: BeamCodeRole;
  isPrimary: boolean;
  isServing: boolean;
  isScheduledActive: boolean;
  frequencyColor: string;
}): BeamVisualEncoding {
  const eventVisualRole = beamVisualRoleForEventRole(input.role);
  const isPrimaryEvent = Boolean(eventVisualRole && (input.isPrimary || input.isServing));
  const visualRole: BeamVisualRole = isPrimaryEvent
    ? eventVisualRole!
    : input.role === 'approach'
      ? 'approach'
      : input.isScheduledActive
        ? 'otherActive'
        : 'inactive';
  const base = BEAM_ROLE_TOKENS[visualRole];
  const eventHue = visualRole !== 'otherActive' && visualRole !== 'inactive';
  const color = eventHue ? base.color : input.isScheduledActive ? input.frequencyColor : BEAM_ROLE_TOKENS.inactive.color;
  const slotStateLabel = !input.isScheduledActive && isPrimaryEvent
    ? visualRole === 'serving' || visualRole === 'pending'
      ? 'SLOT OFF'
      : 'UNSCHEDULED'
    : null;

  if (!input.isScheduledActive) {
    return {
      ...base,
      visualRole,
      color,
      lineWidth: Math.max(1.5, base.lineWidth - 0.6),
      coneOpacity: Math.min(base.coneOpacity, isPrimaryEvent ? 0.18 : 0.08),
      discOpacity: Math.min(base.discOpacity, isPrimaryEvent ? 0.11 : 0.05),
      lineOpacity: Math.min(base.lineOpacity, isPrimaryEvent ? 0.68 : 0.34),
      endpointOpacity: Math.min(base.endpointOpacity, isPrimaryEvent ? 0.5 : 0.3),
      endpointFilled: false,
      dashed: true,
      slotStateLabel,
      isEventPrimary: isPrimaryEvent,
      isEmphasized: isPrimaryEvent,
    };
  }

  if (!isPrimaryEvent && input.role === 'approach') {
    return {
      ...base,
      visualRole,
      color,
      lineWidth: 1.9,
      coneOpacity: 0.1,
      discOpacity: 0.07,
      lineOpacity: 0.48,
      endpointRadius: 3.4,
      endpointOpacity: 0.54,
      slotStateLabel,
      isEventPrimary: false,
      isEmphasized: false,
    };
  }

  return {
    ...base,
    visualRole,
    color,
    slotStateLabel,
    isEventPrimary: isPrimaryEvent,
    isEmphasized: isPrimaryEvent || input.isPrimary,
  };
}
