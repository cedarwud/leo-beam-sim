/**
 * ChannelMetricValue — branded wrapper around (kind, dB) for any SINR/SNR value
 * carried into the renderer.
 *
 * Rationale (SDD §3 Q6, §4 D4):
 *   The trigger artifact reports paper SNR (no interference) at
 *   `truthOwnership.sinr.channelMetricKind === 'snr-no-interference'`. The live
 *   engine reports interference-aware SINR. If the renderer treats a bare
 *   `number` as the same on both paths, it will silently mislabel SNR as SINR
 *   and violate R1/R2. The branded type forces every downstream surface
 *   (legend, callout, info panel, duel column, formula readout, exports) to
 *   accept a `ChannelMetricValue` whose `kind` drives the label.
 *
 * Brand mechanism (intentional):
 *   `& { readonly __brand: 'ChannelMetricValue' }` — a phantom unique property
 *   on the intersection type. TS structural typing alone would accept any
 *   `{ kind, dB }` shape; the brand ensures only values produced by the
 *   constructor `makeChannelMetricValue` are accepted, and a bare `number`
 *   never satisfies the type.
 *
 * Constraints:
 *   - No imports from `core/channel`, `core/beam`, runtime engine, or three.js.
 *   - No SINR/SNR computation — this module only labels and carries values.
 */

import type { VisualShowcaseChannelMetricKind } from './visual-showcase-contract';

/**
 * Branded numeric channel-metric value. Use {@link makeChannelMetricValue} to
 * construct. Bare `{ kind, dB }` literals do NOT satisfy the brand.
 */
export type ChannelMetricValue = {
  readonly kind: VisualShowcaseChannelMetricKind;
  readonly dB: number;
} & { readonly __brand: 'ChannelMetricValue' };

/**
 * Construct a branded ChannelMetricValue.
 *
 * @param kind  the producer-declared metric kind (or `'sinr-with-interference'`
 *              for live-sim).
 * @param dB    the value in decibels (NaN allowed for absent values).
 */
export function makeChannelMetricValue(
  kind: VisualShowcaseChannelMetricKind,
  dB: number,
): ChannelMetricValue {
  return { kind, dB } as ChannelMetricValue;
}

/**
 * Type guard — useful in tests / module-mock validation. Does NOT validate
 * the brand itself (brands are erased at runtime); only the shape.
 */
export function isChannelMetricValueShape(
  value: unknown,
): value is { kind: VisualShowcaseChannelMetricKind; dB: number } {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as { kind?: unknown; dB?: unknown };
  return typeof v.kind === 'string' && typeof v.dB === 'number';
}
