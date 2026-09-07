import type {
  VisualLabFigureProfile,
  VisualLabLocale,
  VisualLabTheme,
} from './presentation/visualLabPresentationContract';

export type VisualLabFigureView = 'earth' | 'sky' | 'service';
export type VisualLabFigureDensity = 'clean' | 'context' | 'full';
export type VisualLabFigureFocus = 'geometry' | 'handover' | 'energy';
export type VisualLabFigureConstellation = 'starlink' | 'oneweb';

export interface VisualLabFigureMetricsInput {
  readonly sinrDb: number | null;
  readonly systemPowerW: number | null;
  readonly totalThroughputBps: number | null;
  readonly instantaneousEeBitsPerJ: number | null;
}

export interface VisualLabFigureExportModelInput {
  readonly locale: VisualLabLocale;
  readonly theme: VisualLabTheme;
  readonly view: VisualLabFigureView;
  readonly density: VisualLabFigureDensity;
  readonly focus: VisualLabFigureFocus;
  readonly title: string;
  readonly constellation: VisualLabFigureConstellation;
  readonly instantTaipei: string;
  readonly selectedSatelliteId: string | null;
  readonly candidateSatelliteId: string | null;
  readonly selectedTlePath: string;
  readonly metrics: VisualLabFigureMetricsInput | null;
  readonly offAxisAngleRad: number | null;
}

export interface VisualLabFigureExportModel {
  readonly width: 1600;
  readonly height: 900;
  readonly headerHeight: 112;
  readonly footerHeight: 116;
  readonly profileId: string;
  readonly title: string;
  readonly figureProfile: VisualLabFigureProfile;
  readonly sourceLine: string;
  readonly metricText: string;
  readonly footerText: string;
  readonly caption: string;
  readonly claimBoundary: string;
  readonly sourceLocators: readonly string[];
  readonly equationLocators: readonly string[];
}

function constellationLabel(constellation: VisualLabFigureConstellation): string {
  return constellation === 'starlink' ? 'Starlink' : 'OneWeb';
}

function metricText(
  locale: VisualLabLocale,
  metrics: VisualLabFigureMetricsInput | null,
): string {
  if (metrics === null) return '';
  const throughput = metrics.totalThroughputBps === null
    ? '—'
    : `${(metrics.totalThroughputBps / 1_000_000).toFixed(2)} Mbit/s`;
  const energyEfficiency = metrics.instantaneousEeBitsPerJ === null
    ? '—'
    : `${(metrics.instantaneousEeBitsPerJ / 1_000_000).toFixed(2)} Mbit/J`;
  return locale === 'zh-Hant'
    ? `SINR ${metrics.sinrDb?.toFixed(2) ?? '—'} dB   |   系統功率 ${metrics.systemPowerW?.toFixed(3) ?? '—'} W   |   總吞吐量 ${throughput}   |   瞬時 EE ${energyEfficiency}`
    : `SINR ${metrics.sinrDb?.toFixed(2) ?? '—'} dB   |   System power ${metrics.systemPowerW?.toFixed(3) ?? '—'} W   |   Total throughput ${throughput}   |   Instantaneous EE ${energyEfficiency}`;
}

/** Build figure text, profile, and provenance before the canvas adapter runs. */
export function buildVisualLabFigureExportModel(
  input: VisualLabFigureExportModelInput,
): VisualLabFigureExportModel {
  const constellation = constellationLabel(input.constellation);
  const profileId = `visual-lab-${input.view}-${input.theme}-${input.locale}`;
  const sourceLine = `${constellation} · ${input.instantTaipei.replace('T', ' ').slice(0, 19)} · TLE / SGP4`;
  const angleText = input.offAxisAngleRad === null
    ? ''
    : input.locale === 'zh-Hant'
      ? `離軸角 θ ${(input.offAxisAngleRad * 180 / Math.PI).toFixed(2)}°   ·   `
      : `Off-axis angle θ ${(input.offAxisAngleRad * 180 / Math.PI).toFixed(2)}°   ·   `;
  const footerText = `${angleText}${input.selectedSatelliteId ?? '—'} → ${input.candidateSatelliteId ?? '—'}   ·   archived TLE / SGP4`;
  const figureProfile: VisualLabFigureProfile = Object.freeze({
    profileId,
    theme: input.theme,
    locale: input.locale,
    viewport: { width: 1600, height: 900, devicePixelRatio: 1 },
    cameraPreset: input.view === 'earth'
      ? 'global-overview'
      : input.focus === 'handover' ? 'handover-focus' : 'ntpu-focus',
    layerPreset: input.density === 'full'
      ? 'full'
      : input.focus === 'energy' ? 'energy-story' : input.focus === 'handover' ? 'handover' : 'minimal',
  });
  return Object.freeze({
    width: 1600 as const,
    height: 900 as const,
    headerHeight: 112 as const,
    footerHeight: 116 as const,
    profileId,
    title: input.title,
    figureProfile,
    sourceLine,
    metricText: metricText(input.locale, input.metrics),
    footerText,
    caption: input.locale === 'zh-Hant'
      ? `${constellation} archived-TLE／SGP4 在 NTPU 多波束場景中的鏈路與能源狀態。`
      : `${constellation} archived-TLE/SGP4 link and energy state in the NTPU multi-beam scene.`,
    claimBoundary: input.locale === 'zh-Hant'
      ? '本圖為 archived-TLE／SGP4 與 canonical 模型投影，不是即時遙測或實測節能成效。'
      : 'This figure is an archived-TLE/SGP4 canonical model projection, not live telemetry or measured energy savings.',
    sourceLocators: [input.selectedTlePath],
    equationLocators: ['ADR-003 canonical EE closure'],
  });
}
