import { UI_TOKENS } from './uiTokens';

export type BeamCodeRole = 'serving' | 'secondary' | 'approach' | 'prepared' | 'post-ho';

export type BeamVisualRole =
  | 'serving'
  | 'pending'
  | 'approach'
  | 'recentSource'
  | 'otherActive'
  | 'inactive';

export type BeamPulseKind = 'none' | 'breathe' | 'pulse' | 'fade';
export type HandoverBeamRole =
  | 'intraSource'
  | 'intraTargetNewServing'
  | 'interSource'
  | 'interTargetNewServing'
  | null;
export type IntraHandoverBeamRole = HandoverBeamRole;

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
  pulse: BeamPulseKind;
  calloutMinWidth: number;
  calloutGlowPx: number;
  markerScale: number;
  markerFontSize: number;
  markerLightIntensity: number;
}

export interface BeamVisualEncoding extends BeamRoleToken {
  visualRole: BeamVisualRole;
  color: string;
  frequencySwatchColor: string;
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

export const SATELLITE_TINT_PALETTE = [
  '#ffffff',
  '#f2d7a0',
  '#d9b6e8',
  '#c7d1d8',
] as const;

export const RECENT_HO_FADE_WINDOW_SEC = 5;

/*
 * HANDOVER EVENT COLOURS — the two event kinds must never read alike.
 *
 * INTER (satellite → satellite): serving YELLOW leaves, candidate BLUE arrives.
 * The target is a different satellite, so it wears the candidate colour, which is
 * what "a link to somewhere else" means everywhere else in this UI.
 *
 * INTRA (beam → beam on the SAME satellite): the target is NOT somewhere else, so
 * painting it candidate-blue told the same story as an inter-HO. It now takes an
 * ORANGE from the serving family (owner call 2026-08-06) — near enough to the
 * serving yellow to read as "still this satellite", far enough to be unmistakable
 * next to it. Source stays serving-yellow for both kinds.
 */
export const INTRA_HANDOVER_SOURCE_COLOR = UI_TOKENS.color.semantic.serving.accent;
export const INTRA_HANDOVER_TARGET_COLOR = '#fb923c';
export const INTER_HANDOVER_SOURCE_COLOR = UI_TOKENS.color.semantic.serving.accent;
export const INTER_HANDOVER_TARGET_COLOR = UI_TOKENS.color.semantic.candidate.accent;
// Inter-satellite handover accent (purple). Single source for the cell-arc +
// sky-ribbon inter-HO visuals (P5) — was hardcoded '#a855f7' in two components.
export const INTER_HANDOVER_COLOR = '#a855f7';
export const INTRA_HANDOVER_ARROW_COLOR = INTRA_HANDOVER_TARGET_COLOR;
// Kind-agnostic aliases. They resolve to the INTER pair, which is the unchanged
// serving-yellow → candidate-blue baseline; anything that knows it is drawing an
// intra-switch must reach for the INTRA_* pair instead.
export const HANDOVER_SOURCE_COLOR = INTER_HANDOVER_SOURCE_COLOR;
export const HANDOVER_TARGET_COLOR = INTER_HANDOVER_TARGET_COLOR;
export const HANDOVER_ARROW_COLOR = HANDOVER_TARGET_COLOR;

export interface IntraHandoverVisualTransition {
  progress: number;
  easedProgress: number;
  dimFactor: number;
  surfaceScale: number;
  lineScale: number;
  calloutScale: number;
  roleRingOpacity: number;
  yLift: number;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

export function resolveHandoverVisualTransition(input: {
  role: HandoverBeamRole;
  progress: number;
  reducedMotion?: boolean;
}): IntraHandoverVisualTransition {
  const progress = input.reducedMotion ? 1 : clamp01(input.progress);
  const easedProgress = input.reducedMotion ? 1 : smoothstep(progress);

  if (input.role === 'intraSource' || input.role === 'interSource') {
    const sourceFadeProgress = input.reducedMotion
      ? 1
      : smoothstep((progress - 0.12) / 0.88);
    const sourceStrength = 1 - sourceFadeProgress;
    return {
      progress,
      easedProgress,
      dimFactor: 0.5 + sourceStrength * 0.5,
      surfaceScale: 0.42 + sourceStrength * 0.58,
      lineScale: 0.52 + sourceStrength * 0.48,
      calloutScale: 0.62 + sourceStrength * 0.38,
      roleRingOpacity: 0.36 + sourceStrength * 0.42,
      yLift: 1.2,
    };
  }

  if (input.role === 'intraTargetNewServing' || input.role === 'interTargetNewServing') {
    const targetEasedProgress = input.reducedMotion
      ? 1
      : smoothstep(0.2 + progress * 0.8);
    return {
      progress,
      easedProgress: targetEasedProgress,
      dimFactor: 1,
      surfaceScale: 0.18 + targetEasedProgress * 1.17,
      lineScale: 0.24 + targetEasedProgress * 1.04,
      calloutScale: 0.48 + targetEasedProgress * 0.7,
      roleRingOpacity: 0.08 + targetEasedProgress * 0.92,
      yLift: 1.6 + targetEasedProgress * 7.4,
    };
  }

  return {
    progress,
    easedProgress,
    dimFactor: 1,
    surfaceScale: 1,
    lineScale: 1,
    calloutScale: 1,
    roleRingOpacity: 0,
    yLift: 0,
  };
}

export function resolveIntraHandoverVisualTransition(input: {
  role: IntraHandoverBeamRole;
  progress: number;
  reducedMotion?: boolean;
}): IntraHandoverVisualTransition {
  return resolveHandoverVisualTransition(input);
}

export const BEAM_PULSE_SPECS: Record<BeamPulseKind, {
  periodSec: number | null;
  amplitude: number;
}> = {
  none: { periodSec: null, amplitude: 0 },
  breathe: { periodSec: 2.4, amplitude: 0.06 },
  pulse: { periodSec: 1.4, amplitude: 0.05 },
  fade: { periodSec: RECENT_HO_FADE_WINDOW_SEC, amplitude: 0.10 },
};

export const BEAM_ROLE_TOKENS: Record<BeamVisualRole, BeamRoleToken> = {
  serving: {
    operatorLabel: 'SERVING',
    markerLabel: 'SERVING',
    color: UI_TOKENS.color.semantic.serving.accent,
    lineWidth: 5.2,
    linkLineWidth: 4.6,
    coneOpacity: 0.58,
    discOpacity: 0.42,
    lineOpacity: 1,
    endpointRadius: 5.6,
    endpointOpacity: 0.96,
    endpointFilled: true,
    dashed: false,
    pulse: 'none',
    calloutMinWidth: 88,
    calloutGlowPx: 20,
    markerScale: 7,
    markerFontSize: 14,
    markerLightIntensity: 1,
  },
  pending: {
    operatorLabel: 'PENDING',
    markerLabel: 'PENDING',
    color: UI_TOKENS.color.semantic.candidate.accent,
    lineWidth: 4.6,
    linkLineWidth: 3.9,
    coneOpacity: 0.38,
    discOpacity: 0.25,
    lineOpacity: 0.96,
    endpointRadius: 5.1,
    endpointOpacity: 0.9,
    endpointFilled: true,
    dashed: false,
    pulse: 'breathe',
    calloutMinWidth: 88,
    calloutGlowPx: 18,
    markerScale: 6.2,
    markerFontSize: 13,
    markerLightIntensity: 0.65,
  },
  approach: {
    operatorLabel: 'APPROACH',
    markerLabel: 'APPROACH',
    color: '#34d399',
    lineWidth: 3.1,
    linkLineWidth: 2.7,
    coneOpacity: 0.24,
    discOpacity: 0.16,
    lineOpacity: 0.8,
    endpointRadius: 4.4,
    endpointOpacity: 0.78,
    endpointFilled: false,
    dashed: false,
    pulse: 'pulse',
    calloutMinWidth: 92,
    calloutGlowPx: 14,
    markerScale: 5.8,
    markerFontSize: 12,
    markerLightIntensity: 0.45,
  },
  recentSource: {
    operatorLabel: 'SOURCE',
    markerLabel: 'HO SOURCE',
    color: '#fde68a',
    lineWidth: 2.8,
    linkLineWidth: 2.6,
    coneOpacity: 0.2,
    discOpacity: 0.13,
    lineOpacity: 0.68,
    endpointRadius: 4.5,
    endpointOpacity: 0.68,
    endpointFilled: false,
    dashed: false,
    pulse: 'fade',
    calloutMinWidth: 82,
    calloutGlowPx: 10,
    markerScale: 5.6,
    markerFontSize: 12,
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
    pulse: 'none',
    calloutMinWidth: 66,
    calloutGlowPx: 10,
    markerScale: 5,
    markerFontSize: 12,
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
    pulse: 'none',
    calloutMinWidth: 66,
    calloutGlowPx: 6,
    markerScale: 5,
    markerFontSize: 12,
    markerLightIntensity: 0,
  },
};

export function frequencyReuseColor(frequencyIndex: number): string {
  const index = ((Math.floor(frequencyIndex) % BEAM_FREQUENCY_COLORS.length) + BEAM_FREQUENCY_COLORS.length)
    % BEAM_FREQUENCY_COLORS.length;
  return BEAM_FREQUENCY_COLORS[index];
}

/**
 * FNV-1a hash of the satellite id → stable palette index. Same proven hash as
 * `sinrServingMosaic.hashStringToUnit`. Collisions into the 4-tint palette are
 * expected and acceptable (ambient/context sats may share a tint; event sats
 * use role colours, not this tint) — S2 fixes CHURN, not uniqueness.
 */
function hashSatIdToTintIndex(satId: string): number {
  let hash = 2166136261;
  for (let i = 0; i < satId.length; i += 1) {
    hash ^= satId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % SATELLITE_TINT_PALETTE.length;
}

/**
 * S2 (sat identity): the tint is a pure function of `satId`, NOT the per-frame
 * display order — a satellite keeps its colour across frames, so a recolour
 * means a real identity change rather than a display-set reshuffle (the audited
 * churn). `displayOrder` is retained for call-site compatibility but IGNORED;
 * `validate:s2:satellite-identity-stable` locks this invariance so the churning
 * input cannot be reintroduced.
 */
export function satelliteTintIndex(satId: string, _displayOrder?: number): number {
  return hashSatIdToTintIndex(satId);
}

export function satelliteTint(satId: string, _displayOrder?: number): string {
  return SATELLITE_TINT_PALETTE[satelliteTintIndex(satId)];
}

export function resolveBeamPulseOpacity(input: {
  baseOpacity: number;
  pulse: BeamPulseKind;
  elapsedSec: number;
  reducedMotion?: boolean;
  roleAgeSec?: number;
}): number {
  const base = input.baseOpacity;
  if (input.reducedMotion || input.pulse === 'none') return base;

  const spec = BEAM_PULSE_SPECS[input.pulse];
  if (input.pulse === 'fade') {
    const age = Math.max(0, input.roleAgeSec ?? input.elapsedSec);
    const progress = Math.min(age / RECENT_HO_FADE_WINDOW_SEC, 1);
    return Math.max(0, base + spec.amplitude * (1 - progress * 2));
  }

  if (!spec.periodSec || spec.amplitude <= 0) return base;
  const phase = (input.elapsedSec / spec.periodSec) * Math.PI * 2;
  return Math.max(0, base + Math.sin(phase) * spec.amplitude);
}

export function beamVisualRoleForEventRole(role?: BeamCodeRole): BeamVisualRole | null {
  switch (role) {
    case 'serving':
      return 'serving';
    case 'post-ho':
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
  const token = visualRole ? BEAM_ROLE_TOKENS[visualRole] : BEAM_ROLE_TOKENS.otherActive;
  if (role === 'post-ho') {
    return {
      ...token,
      operatorLabel: 'TARGET',
      markerLabel: 'HO TARGET',
    };
  }
  return token;
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
  identityColor?: string;
  preferIdentityColor?: boolean;
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
  const base = input.role === 'post-ho'
    ? tokenForEventRole(input.role)
    : BEAM_ROLE_TOKENS[visualRole];
  const eventHue = visualRole !== 'otherActive' && visualRole !== 'inactive';
  const identityColor = input.identityColor ?? input.frequencyColor;
  const useIdentityColor = input.preferIdentityColor === true && input.isScheduledActive;
  const color = useIdentityColor
    ? identityColor
    : eventHue
      ? base.color
      : input.isScheduledActive
        ? input.frequencyColor
        : BEAM_ROLE_TOKENS.inactive.color;
  const frequencySwatchColor = input.isScheduledActive
    ? (useIdentityColor ? identityColor : input.frequencyColor)
    : BEAM_ROLE_TOKENS.inactive.color;
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
      frequencySwatchColor,
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
      frequencySwatchColor,
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
    frequencySwatchColor,
    discOpacity: eventHue ? Math.min(base.discOpacity, 0.18) : base.discOpacity,
    slotStateLabel,
    isEventPrimary: isPrimaryEvent,
    isEmphasized: isPrimaryEvent || input.isPrimary,
  };
}
