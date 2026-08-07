import type { ChannelMetricValue } from '../../scene/ChannelMetricValue';
import type { VisualShowcaseChannelMetricKind } from '../../scene/visual-showcase-contract';
import { MIN_VISIBLE_SINR_DB } from '../../constants/sinr';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { SimState } from '../../scene/types';
import { formatBeamIdentity, formatBeamIdentityByIndex } from '../../utils/formatSatelliteLabel';
import { cellFrequencyIndex } from '../../scene/sinrLiveCellModel';
import type { GlyphKind } from '../../contracts/glyphTypes';

/**
 * SDD §3 Q6 audit-list helper: source-driven label string for the legend /
 * callout. The string is the single truth-tagging point — every SINR-rendering
 * surface in the audit list should call this helper instead of hardcoding
 * `"SINR"`.
 *
 * - `'sinr-with-interference'` (live engine) → `"SINR"`.
 * - `'snr-no-interference'` (paper replay) → `"SNR"`.
 * - Anything else falls back to `"SINR/SNR"`.
 */
export function channelMetricLabelForKind(
  kind: VisualShowcaseChannelMetricKind | string | undefined,
): string {
  if (kind === 'sinr-with-interference') return 'SINR';
  if (kind === 'snr-no-interference') return 'SNR';
  return 'SINR/SNR';
}

/**
 * Verbose label used by legends / banners (e.g.
 * `"SINR (dB) — interference-aware (live)"` /
 * `"SNR (dB) — paper, no interference (replay proxy)"`). Matches SDD §3 Q6
 * rule 2. Defaults to the live form if `kind` is unknown so that screenshot /
 * export pipelines always emit a legible label.
 */
export function channelMetricVerboseLabelForKind(
  kind: VisualShowcaseChannelMetricKind | string | undefined,
): string {
  if (kind === 'snr-no-interference') {
    return 'SNR (dB) — paper, no interference (replay proxy)';
  }
  return 'SINR (dB) — interference-aware (live)';
}

export function sinrColor(sinrDb: number): string {
  if (sinrDb >= 20) return UI_TOKENS.color.signalQuality.great;
  if (sinrDb >= 10) return UI_TOKENS.color.signalQuality.good;
  if (sinrDb >= 5) return UI_TOKENS.color.signalQuality.warning;
  return UI_TOKENS.color.signalQuality.poor;
}

/**
 * Kind-aware color picker — same scale, but the underlying metric kind is
 * preserved so callers cannot accidentally feed an SNR value through a SINR-
 * named function. SDD §3 Q6 rule 3 ("distinct color scale + badge") — the
 * **scale function** is shared; the **label / badge** branches via
 * {@link channelMetricLabelForKind}.
 */
export function channelMetricColor(value: ChannelMetricValue): string {
  return sinrColor(value.dB);
}

/**
 * @deprecated Prefer {@link formatChannelMetric} which carries
 * `ChannelMetricValue.kind` and produces the correct label per SDD §3 Q6.
 * Kept for callers in the live-sim path; will be removed when those surfaces
 * migrate to `ChannelMetricValue`.
 */
export function formatSinr(sinrDb: number | null): string {
  if (sinrDb === null || !Number.isFinite(sinrDb) || sinrDb <= MIN_VISIBLE_SINR_DB) return '—';
  return `${sinrDb.toFixed(1)} dB`;
}

/**
 * Kind-aware variant: renders the dB value with a kind-tagged suffix. Returns
 * `'—'` for absent values. Use this in any surface that consumes a
 * `ChannelMetricValue`; the suffix tells the user which channel metric the
 * number represents.
 *
 * Example outputs:
 *   - live SINR 13.4   → `"13.4 dB (SINR)"`
 *   - replay SNR 13.4  → `"13.4 dB (SNR)"`
 */
export function formatChannelMetric(value: ChannelMetricValue | null): string {
  if (value === null || !Number.isFinite(value.dB) || value.dB <= MIN_VISIBLE_SINR_DB) {
    return '—';
  }
  return `${value.dB.toFixed(1)} dB (${channelMetricLabelForKind(value.kind)})`;
}

/**
 * Format only the numeric portion of a `ChannelMetricValue` — useful for
 * tightly-typed callouts that render the unit separately. The caller is
 * responsible for emitting the kind-aware label alongside.
 */
export function formatChannelMetricNumeric(
  value: ChannelMetricValue | null | undefined,
): string {
  if (value === null || value === undefined) return '—';
  if (!Number.isFinite(value.dB) || value.dB <= MIN_VISIBLE_SINR_DB) return '—';
  return `${value.dB.toFixed(1)} dB`;
}

export function formatElevation(elevationDeg: number | null): string {
  if (elevationDeg === null || !Number.isFinite(elevationDeg)) return '—';
  return `${elevationDeg.toFixed(1)}°`;
}

export function formatSlantRange(rangeKm: number | null): string {
  if (rangeKm === null || !Number.isFinite(rangeKm)) return '—';
  return `${rangeKm.toFixed(0)} km`;
}

/**
 * r1 energy efficiency η, in bit/joule. Raw η runs to ~1e6 for a 100 MHz /
 * 100 W beam, so the unit prefix adapts rather than printing an unreadable
 * digit run. `Gb/J` / `Mb/J` / `kb/J` are bit-per-joule decades — NOT byte
 * units.
 */
export function formatR1EnergyEfficiency(bitsPerJoule: number | null): string {
  if (bitsPerJoule === null || !Number.isFinite(bitsPerJoule)) return '—';
  const magnitude = Math.abs(bitsPerJoule);
  if (magnitude >= 1e9) return `${(bitsPerJoule / 1e9).toFixed(2)} Gb/J`;
  if (magnitude >= 1e6) return `${(bitsPerJoule / 1e6).toFixed(2)} Mb/J`;
  if (magnitude >= 1e3) return `${(bitsPerJoule / 1e3).toFixed(2)} kb/J`;
  return `${bitsPerJoule.toFixed(2)} b/J`;
}

/** Format the paper comparison anchor / headline with an explicit bit unit. */
export function formatMbitsPerJoule(bitsPerJoule: number | null): string {
  if (bitsPerJoule === null || !Number.isFinite(bitsPerJoule)) return '—';
  return `${(bitsPerJoule / 1e6).toFixed(2)} Mbits/J`;
}

export function formatPercent(fraction: number | null): string {
  if (fraction === null || !Number.isFinite(fraction)) return '—';
  return `${(fraction * 100).toFixed(1)}%`;
}

export function formatDb(value: number): string {
  return `${value.toFixed(1)} dB`;
}

export function formatDbm(value: number): string {
  return `${value.toFixed(1)} dBm`;
}

export function formatDbi(value: number): string {
  return `${value.toFixed(1)} dBi`;
}

export function formatStatusLabel(status: SimState['panelPrimary']['status']): string {
  switch (status) {
    case 'live':
      return 'live';
    case 'latched':
      return 'latched';
    case 'recent-ho':
      return 'recent HO';
    case 'derived':
      return 'derived';
    case 'none':
      return 'none';
  }
}

export function formatPanelBeamIdentity(
  satId: string | null,
  beamId: number | null,
  frequencyReuse: number,
  emptyLabel: string,
): string {
  if (!satId || beamId === null) return emptyLabel;
  return formatBeamIdentity({ satId, beamId, frequencyReuse });
}

/**
 * S5-2b: the serving-identity string for the sinr-live CELL lane. The cell id is
 * 0-indexed (cellLayout assigns `cellId: index`, 0..N-1) and its frequency colour
 * is `cellFrequencyIndex(cellId, reuse) = cellId mod reuse` — the SAME index the
 * cone render uses (`IlluminatedCellBeam.frequencyIndex`, SinrLiveCellBeamCones).
 * `formatPanelBeamIdentity` must NOT be used here: it routes through
 * `getBeamFrequencyIndex` = `(beamId - 1) mod reuse`, the 1-INDEXED steered-beam
 * formula, which names a DIFFERENT frequency than the cone for every cell except
 * `cellId ≡ 0 (mod reuse)` (the panel would say "F1" over a cone glowing "F2").
 * Both the InfoPanel and `validate:s5:infopanel-cone-coupling` call THIS helper so
 * the label frequency always matches the rendered cone.
 */
export function formatCellServingIdentity(
  satId: string | null,
  cellId: number | null,
  frequencyReuse: number,
  emptyLabel: string,
): string {
  if (!satId || cellId === null) return emptyLabel;
  return formatBeamIdentityByIndex({
    satId,
    beamId: cellId,
    frequencyIndex: cellFrequencyIndex(cellId, frequencyReuse),
  });
}

export function glyphForSatId(
  satId: string | null,
  satelliteVisualIdentityById: SimState['satelliteVisualIdentityById'],
): GlyphKind | null {
  if (!satId) return null;
  return satelliteVisualIdentityById[satId]?.satelliteGlyph ?? null;
}

export function formatDeltaDb(deltaDb: number | null): string {
  if (deltaDb === null) return '—';
  return `${deltaDb >= 0 ? '+' : ''}${deltaDb.toFixed(1)} dB`;
}

export function resolveDuelStateLabel(input: {
  comparisonRole: SimState['panelComparison']['role'];
  triggerProgressSec: number;
}): { label: string; tone: 'serving' | 'candidate' | 'warning' | 'neutral' } {
  if (input.comparisonRole === 'pending' || input.triggerProgressSec > 0) {
    return { label: 'pending', tone: 'candidate' };
  }
  if (input.comparisonRole === 'ho-target') {
    return { label: 'recent HO', tone: 'warning' };
  }
  if (input.comparisonRole === 'candidate') {
    return { label: 'candidate', tone: 'candidate' };
  }
  return { label: 'idle', tone: 'neutral' };
}
