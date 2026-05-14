import { MIN_VISIBLE_SINR_DB } from '../../constants/sinr';
import { UI_TOKENS } from '../../constants/uiTokens';
import type { SimState } from '../../scene/types';
import { formatBeamIdentity } from '../../utils/formatSatelliteLabel';
import type { GlyphKind } from '../../viz/glyphs';

export function sinrColor(sinrDb: number): string {
  if (sinrDb >= 20) return UI_TOKENS.color.signalQuality.great;
  if (sinrDb >= 10) return UI_TOKENS.color.signalQuality.good;
  if (sinrDb >= 5) return UI_TOKENS.color.signalQuality.warning;
  return UI_TOKENS.color.signalQuality.poor;
}
export function formatSinr(sinrDb: number | null): string {
  if (sinrDb === null || !Number.isFinite(sinrDb) || sinrDb <= MIN_VISIBLE_SINR_DB) return '—';
  return `${sinrDb.toFixed(1)} dB`;
}

export function formatElevation(elevationDeg: number | null): string {
  if (elevationDeg === null || !Number.isFinite(elevationDeg)) return '—';
  return `${elevationDeg.toFixed(1)}°`;
}

export function formatSlantRange(rangeKm: number | null): string {
  if (rangeKm === null || !Number.isFinite(rangeKm)) return '—';
  return `${rangeKm.toFixed(0)} km`;
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
