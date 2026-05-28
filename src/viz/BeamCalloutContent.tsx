import {
  type BeamVisualEncoding,
} from '../constants/beamRoleTokens';
import type { ChannelMetricValue } from '../scene/ChannelMetricValue';
import type { VisualShowcaseChannelMetricKind } from '../scene/visual-showcase-contract';
import { channelMetricLabelForKind } from '../ui/info-panel/formatters';
import { formatBeamIdentityLabel } from '../utils/beamFrequency';
import { formatBeamIdentityByIndex, formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import type { GlyphKind } from '../contracts/glyphTypes';
import type { BeamTarget } from '../scene/beamTargetTypes';
import { glyphSymbolForKind } from './glyphs';

/**
 * @deprecated Prefer {@link formatBeamChannelMetric} which carries the
 * `ChannelMetricValue.kind` discriminator (SDD §3 Q6). The bare-number
 * variant is kept for the live-sim hot path where `VizFrame.satBeams` carries
 * `sinrDb: number` — kind is implicitly `'sinr-with-interference'` for live.
 *
 * P1d will retire this in favour of the kind-aware variant once the
 * VizFrame.satBeams shape carries `ChannelMetricValue`.
 */
export function formatBeamSinr(sinrDb?: number | null): string {
  if (sinrDb === null || sinrDb === undefined || !Number.isFinite(sinrDb)) return '-- dB';
  return `${sinrDb.toFixed(1)} dB`;
}

/**
 * Kind-aware variant: renders `"13.4 dB (SINR)"` or `"13.4 dB (SNR)"` etc.
 * based on the producer-declared metric kind. Use this for any callout
 * surfacing a `ChannelMetricValue` (replay path) or when wrapping a live
 * `sinrDb` with the explicit `'sinr-with-interference'` kind.
 */
export function formatBeamChannelMetric(value: ChannelMetricValue | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value.dB)) return '-- dB';
  return `${value.dB.toFixed(1)} dB (${channelMetricLabelForKind(value.kind)})`;
}

/**
 * Wraps a bare `sinrDb` with an explicit metric kind for the callout label.
 * Used by validators and the live-sim callout surface until those surfaces
 * migrate to {@link formatBeamChannelMetric}.
 */
export function formatBeamSinrWithKind(
  sinrDb: number | null | undefined,
  kind: VisualShowcaseChannelMetricKind | string | undefined,
): string {
  if (sinrDb === null || sinrDb === undefined || !Number.isFinite(sinrDb)) return '-- dB';
  return `${sinrDb.toFixed(1)} dB (${channelMetricLabelForKind(kind)})`;
}

export function BeamCalloutContent({
  satelliteId,
  satelliteGlyph,
  beam,
  style,
  color,
  sinrLabel,
  isEmphasized,
}: {
  satelliteId: string | null;
  satelliteGlyph?: GlyphKind;
  beam: Pick<BeamTarget, 'beamId' | 'frequencyIndex' | 'handoverRole' | 'visualColorSource'>;
  style: Pick<
    BeamVisualEncoding,
    'operatorLabel' | 'slotStateLabel' | 'calloutMinWidth' | 'calloutGlowPx' | 'frequencySwatchColor'
  >;
  color: string;
  sinrLabel: string;
  isEmphasized: boolean;
}) {
  const satelliteLabel = formatSatelliteLabel(satelliteId);
  const beamTokenLabel = beam.visualColorSource === 'satellite'
    ? `B${beam.beamId}`
    : formatBeamIdentityLabel(beam.frequencyIndex, beam.beamId);
  const beamIdentity = formatBeamIdentityByIndex({
    satId: satelliteId,
    beamId: beam.beamId,
    frequencyIndex: beam.frequencyIndex,
  });
  const identityLine = style.operatorLabel ? `${style.operatorLabel} · ${beamTokenLabel}` : beamTokenLabel;
  const [frequencyToken, beamNumberToken] = beamTokenLabel.split(' ');
  const showFrequencySwatch = Boolean(
    beam.visualColorSource !== 'satellite'
      && style.operatorLabel
      && frequencyToken
      && beamNumberToken,
  );
  const glyphSymbol = satelliteGlyph ? glyphSymbolForKind(satelliteGlyph) : null;

  return (
    <div
      data-testid="beam-callout"
      data-satellite-label={satelliteLabel}
      data-satellite-glyph={satelliteGlyph}
      data-beam-identity={beamIdentity}
      data-beam-token={beamTokenLabel}
      data-handover-role={beam.handoverRole ?? undefined}
      data-handover-color={beam.handoverRole ? color : undefined}
      style={{
        minWidth: style.calloutMinWidth,
        padding: isEmphasized ? '5px 7px' : '4px 6px',
        borderRadius: 4,
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        background: 'rgba(2, 9, 18, 0.82)',
        boxShadow: `0 0 ${style.calloutGlowPx}px ${color}66`,
        color: '#ffffff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: isEmphasized ? 12 : 11,
        lineHeight: 1.05,
        letterSpacing: 0,
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
        whiteSpace: 'nowrap',
      }}
    >
      <div
        data-testid="beam-callout-satellite-chip"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 2,
          padding: '2px 5px',
          borderRadius: 3,
          border: `1px solid ${color}`,
          background: `${color}1f`,
          color,
          fontWeight: 800,
        }}
      >
        {glyphSymbol && (
          <span
            data-testid="beam-callout-satellite-glyph"
            aria-hidden="true"
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontFeatureSettings: '"liga" 0',
              textRendering: 'geometricPrecision',
              lineHeight: 1,
            }}
          >
            {glyphSymbol}
          </span>
        )}
        <span>{satelliteLabel}</span>
      </div>
      <div
        data-testid="beam-callout-identity-line"
        style={{ color: style.operatorLabel ? '#ffffff' : color, fontWeight: isEmphasized ? 800 : 700 }}
      >
        {showFrequencySwatch ? (
          <>
            <span>{style.operatorLabel} · </span>
            <span
              data-testid="beam-callout-frequency-token"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
            >
              <span
                data-testid="beam-callout-frequency-swatch"
                data-frequency-swatch-color={style.frequencySwatchColor}
                aria-hidden="true"
                style={{
                  width: 8,
                  height: 8,
                  display: 'inline-block',
                  borderRadius: 2,
                  background: style.frequencySwatchColor,
                  boxShadow: `0 0 7px ${style.frequencySwatchColor}99`,
                  flex: '0 0 auto',
                }}
              />
              <span>{frequencyToken}</span>
            </span>
            <span> {beamNumberToken}</span>
          </>
        ) : identityLine}
      </div>
      {style.slotStateLabel && (
        <div style={{ color: '#dbeafe', fontSize: 10, fontWeight: 800 }}>{style.slotStateLabel}</div>
      )}
      <div style={{ fontWeight: isEmphasized ? 700 : 600 }}>{sinrLabel}</div>
    </div>
  );
}
