import type { VisualLabLocale } from '../../prototype/visual-lab-g0/presentation/visualLabPresentationContract';
import type { VisualLabStoryControllerState } from '../story';

/** Public-controller projections keep the rail off the runtime implementation seam. */
export type StoryRailStory = VisualLabStoryControllerState['stories'][number];
export type StoryRailStep = NonNullable<VisualLabStoryControllerState['activeStep']>;

/**
 * The rail is deliberately limited to three real accepted timeline beats for
 * both inter-satellite and same-satellite beam-switch stories.
 */
export const STORY_BEAT_PHASES = ['before', 'decision', 'after'] as const;

export type StoryBeatPhase = (typeof STORY_BEAT_PHASES)[number];

export type StoryRailMetric = 'sinr' | 'throughput' | 'power' | 'energy-efficiency';

export interface StoryRailSourceIdentities {
  readonly fromSatelliteId: string | null;
  readonly toSatelliteId: string | null;
}

export interface StoryRailPointMetrics {
  readonly sinrDb: number | null;
  readonly throughputBps: number | null;
  readonly powerW: number | null;
  readonly energyEfficiencyBitsPerJ: number | null;
}

const BEAT_LABELS: Readonly<Record<VisualLabLocale, Readonly<Record<StoryBeatPhase, string>>>> = {
  'zh-Hant': Object.freeze({ before: '之前', decision: '判定', after: '之後' }),
  en: Object.freeze({ before: 'Before', decision: 'Decision', after: 'After' }),
};

const ACTIVE_LABELS: Readonly<Record<VisualLabLocale, string>> = Object.freeze({
  'zh-Hant': '目前段落',
  en: 'Active beat',
});

const METRIC_SUFFIXES: Readonly<Record<StoryRailMetric, string>> = Object.freeze({
  sinr: 'dB',
  throughput: 'bit/s',
  power: 'W',
  'energy-efficiency': 'bit/J',
});

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number, locale: VisualLabLocale, fractionDigits: number): string {
  return new Intl.NumberFormat(locale === 'zh-Hant' ? 'zh-Hant' : 'en-US', {
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

function scaleValue(value: number): { readonly value: number; readonly suffix: string } {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return { value: value / 1_000_000_000, suffix: 'G' };
  if (magnitude >= 1_000_000) return { value: value / 1_000_000, suffix: 'M' };
  if (magnitude >= 1_000) return { value: value / 1_000, suffix: 'k' };
  return { value, suffix: '' };
}

/** Localized labels for the real before/decision/after beats. */
export function storyBeatLabel(phase: StoryBeatPhase, locale: VisualLabLocale): string {
  return BEAT_LABELS[locale][phase];
}

/** Localized label used on the one active beat marker. */
export function storyActiveBeatLabel(locale: VisualLabLocale): string {
  return ACTIVE_LABELS[locale];
}

/**
 * Read metrics from the accepted timeline point only.  A missing point stays
 * missing; the rail never fabricates a zero or derives a value from another
 * projection.
 */
export function storyPointMetrics(step: StoryRailStep | null): StoryRailPointMetrics {
  const point = step?.point;
  return {
    sinrDb: finiteOrNull(point?.servingSinrDb),
    throughputBps: finiteOrNull(point?.throughputBps),
    powerW: finiteOrNull(point?.powerW),
    energyEfficiencyBitsPerJ: finiteOrNull(point?.instantaneousEeBitsPerJ),
  };
}

/** Find a timeline beat without treating identity-only steps as scientific data. */
export function storyStepForBeat(
  story: StoryRailStory | null,
  phase: StoryBeatPhase,
): StoryRailStep | null {
  return story?.steps.find(step => step.phase === phase) ?? null;
}

/**
 * Preserve the accepted descriptor's source identity.  In particular, the
 * destination is not inferred from the active point's candidate satellite.
 */
export function storySourceIdentities(
  story: StoryRailStory | null,
): StoryRailSourceIdentities {
  const source = story?.descriptor.source;
  if (source?.kind !== 'inter-handover') {
    return { fromSatelliteId: null, toSatelliteId: null };
  }
  return {
    fromSatelliteId: source.fromSatelliteId,
    toSatelliteId: source.toSatelliteId,
  };
}

/**
 * Format a real value for the compact metric strip.  `null` becomes an em dash
 * so unavailable evidence cannot be mistaken for a measured zero.
 */
export function formatStoryMetric(
  value: number | null,
  metric: StoryRailMetric,
  locale: VisualLabLocale,
): string {
  const finite = finiteOrNull(value);
  if (finite === null) return '—';
  if (metric === 'sinr') return `${formatNumber(finite, locale, 1)} ${METRIC_SUFFIXES[metric]}`;
  if (metric === 'power') return `${formatNumber(finite, locale, 3)} ${METRIC_SUFFIXES[metric]}`;
  const scaled = scaleValue(finite);
  return `${formatNumber(scaled.value, locale, 2)} ${scaled.suffix}${METRIC_SUFFIXES[metric]}`;
}

export function formatStoryElapsedTime(value: number | null, locale: VisualLabLocale): string {
  const finite = finiteOrNull(value);
  if (finite === null) return '—';
  return locale === 'zh-Hant'
    ? `+${formatNumber(finite, locale, 0)} 秒`
    : `+${formatNumber(finite, locale, 0)} s`;
}
