/**
 * SINR-live cell-truth BEAM-INFO callouts (W5).
 *
 * Reimplements the "Beam Info" scene labels on the earth-fixed cell-cone lane. The
 * old `BeamCalloutContent` only ever mounted inside the retired steered
 * <SatelliteBeams>, so on the cell-cone lane the Beam Info toggle flipped a flag with
 * NO renderer behind it (broke c8d211d / b64cd9a). This is a DUMB renderer (mirrors
 * `SinrLiveCellFootprintRings`): one compact <Html> chip per measured serving-cone
 * item, floated above the cone ({@link SINR_LIVE_CALLOUT_Y_LIFT}), in the cone's
 * serving-identity colour. Geometric substrate entries without a UE/SINR sample
 * are deliberately omitted from this information layer. It does NOT fake a
 * steered `BeamTarget` — it reads the cell-truth items + the per-cell serving SINR
 * directly, so it cannot drift from the cones / footprint hexes it labels. On
 * the homepage, the value line reads the accepted live EE projection; other
 * lanes retain their existing SINR readout.
 * Display-only (Rule#6): it surfaces the model's own serving identity + metric,
 * no truth. Lane gating lives in MainScene (mounted under `showBeamCallouts`).
 */
import { useEffect, useLayoutEffect, type JSX } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { resolveHomepageSatelliteDisplayName } from '../homepage/controller/homepageSatelliteDisplayName';
import {
  homepageSatelliteColorForBeam,
} from '../homepage/controller/homepageSatelliteVisualIdentity';
import { SINR_LIVE_CALLOUT_Y_LIFT } from '../constants/sinrLiveConeStyle';
import { cellLinkBudgetBeamId } from '../scene/sinrLiveCellModel';
import { formatHomepageEe } from '../homepage/controller/homepageMetricFormatters';
import { formatEngineering } from '../ui/signal-tuning/formatters';
import { resolveHandoverSide } from '../appearance/handoverAppearanceModifiers';
import type { SinrLiveCellBeamConeRenderItem } from './SinrLiveCellBeamCones';
import type { AngleAwareFormulaFrame } from '../engine/signal/types';

export interface SinrLiveCellBeamCalloutsProps {
  /** Serving cone items; geometric display-only entries are filtered from callouts. */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  /** Per-cell serving SINR (dB) from the cell model — `null` for an unserved cell. */
  readonly servingSinrByCellId: ReadonlyMap<number, number | null>;
  /** The protagonist (hero) serving sat/cell — its chip is emphasised. */
  readonly primaryServingSatId: string | null;
  readonly primaryServingCellId: number | null;
  /** The exact selected-link snapshot also published by the Walker right rail. */
  readonly frameSnapshot?: Pick<AngleAwareFormulaFrame, 'timeSec' | 'satId' | 'beamId' | 'terms'> | null;
  /** Homepage-only live EE values, joined by the canonical sat/beam key. */
  readonly homepageBeamEeBitsPerJouleByKey?: ReadonlyMap<string, number | null> | null;
  /** Homepage-only normalized EE shade input, joined by the canonical sat/beam key. */
  readonly homepageBeamEeByKey?: ReadonlyMap<string, number | null> | null;
  /** Homepage-only accepted snapshot palette allocation. */
  readonly homepageIdentityPaletteIndexBySatelliteId?: ReadonlyMap<string, number | null> | null;
  /** Opt-in homepage identity renderer; omitted consumers retain item colours. */
  readonly homepageVisualIdentity?: boolean;
  /** Exact active-TLE display names; raw IDs remain beam join keys. */
  readonly satelliteNameById?: ReadonlyMap<string, string> | null;
  /** Optional canvas dataset key for the rendered-callout count (validator proof). */
  readonly telemetryCountDatasetKey?: string;
}

function formatCalloutSinr(sinrDb: number | null | undefined): string {
  return sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb)
    ? `${sinrDb.toFixed(1)} dB`
    : '— dB';
}

function clampProgress(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

export function formatCalloutEe(eeBitsPerJoule: number | null | undefined): string {
  const formatted = formatEngineering(eeBitsPerJoule, 'bit/J', 5);
  return formatted === '—' ? 'EE —' : `EE ${formatted}`;
}

export function formatHomepageCalloutEe(eeBitsPerJoule: number | null | undefined): string {
  const formatted = formatHomepageEe(eeBitsPerJoule);
  return formatted === '—' ? 'EE —' : `EE ${formatted}`;
}

export function SinrLiveCellBeamCallouts(props: SinrLiveCellBeamCalloutsProps): JSX.Element | null {
  const gl = useThree(state => state.gl);
  const {
    servingSinrByCellId,
    primaryServingSatId,
    primaryServingCellId,
    frameSnapshot = null,
    satelliteNameById = null,
    homepageVisualIdentity = false,
    homepageBeamEeByKey = null,
    homepageIdentityPaletteIndexBySatelliteId = null,
  } = props;
  // The beam fan contains a geometric substrate for beams that have no UE/SINR
  // sample. That substrate is useful for the cone renderer, but it is not an
  // information record. Do not turn it into a pile of "unmeasured" cards: Beam
  // Info is an inspection surface for measured links only.
  const measuredItems = props.items.filter(item => {
    if (item.displayOnly === true) return false;
    const isPrimary = item.satId === primaryServingSatId && item.cellId === primaryServingCellId;
    const beamId = item.beamId ?? cellLinkBudgetBeamId(item.cellId);
    const sinrDb = isPrimary && frameSnapshot !== null
      ? frameSnapshot.terms.gammaDb
      : servingSinrByCellId.get(item.cellId);
    // The homepage accepted snapshot is the metric authority for the event
    // pair.  A target beam can be drawable before the cell-truth SINR map has
    // a serving sample for that cell; keep that accepted EE row visible rather
    // than dropping the beam card and its progress bar for one render tick.
    const homepageEe = props.homepageBeamEeBitsPerJouleByKey?.get(
      `${item.satId}:${beamId}`,
    );
    return Number.isFinite(sinrDb)
      || (homepageVisualIdentity && Number.isFinite(homepageEe));
  });

  // MESH-less telemetry: <Html> portals out of the canvas, so a mesh traverse would
  // miss it — publish the item count directly so a validator can prove the labels mount.
  useLayoutEffect(() => {
    const key = props.telemetryCountDatasetKey;
    if (!key) return;
    gl.domElement.dataset[key] = String(measuredItems.length);
  });

  useEffect(() => () => {
    if (props.telemetryCountDatasetKey) delete gl.domElement.dataset[props.telemetryCountDatasetKey];
  }, [gl, props.telemetryCountDatasetKey]);

  if (measuredItems.length === 0) return null;

  return (
    <group name="sinr-live-cell-beam-callouts">
      {measuredItems.map(item => {
        const isPrimary =
          item.satId === primaryServingSatId && item.cellId === primaryServingCellId;
        const satLabel = resolveHomepageSatelliteDisplayName(item.satId, satelliteNameById);
        const beamId = item.beamId ?? cellLinkBudgetBeamId(item.cellId);
        const displayCellId = item.cellId + 1;
        const beamIdentity = `${item.satId}#B${beamId}`;
        // The primary chip is the central selected-link surface.  Use the same
        // angle-aware frame as the right rail so its displayed SINR and the
        // machine-readable values cannot drift to the cell-centre diagnostic.
        const sinrDb = isPrimary && frameSnapshot !== null
          ? frameSnapshot.terms.gammaDb
          : servingSinrByCellId.get(item.cellId);
        const eeBitsPerJoule = props.homepageBeamEeBitsPerJouleByKey?.get(
          `${item.satId}:${beamId}`,
        );
        const eeProgress = homepageVisualIdentity
          ? clampProgress(props.homepageBeamEeByKey?.get(`${item.satId}:${beamId}`))
          : null;
        const isPrimaryIdentity = isPrimary
          || item.role === 'candidatePrimary'
          || resolveHandoverSide(item) === 'target'
          || item.role === 'triggered';
        const renderColor = homepageVisualIdentity
          ? homepageSatelliteColorForBeam(item.satId, beamId, {
            identityPaletteIndex: homepageIdentityPaletteIndexBySatelliteId?.get(item.satId) ?? null,
            isServing: isPrimaryIdentity,
            eeNormalized: homepageBeamEeByKey?.get(`${item.satId}:${beamId}`),
          }).color
          : item.color;
        const displayEe = props.homepageBeamEeBitsPerJouleByKey !== undefined;
        const valueLabel = displayEe
          ? homepageVisualIdentity
            ? formatHomepageCalloutEe(eeBitsPerJoule)
            : formatCalloutEe(eeBitsPerJoule)
          : formatCalloutSinr(sinrDb);
        return (
          <Html
            key={item.renderKey ?? `${item.cellId}-${item.satId}-${beamId}`}
            position={[item.baseCenter.x, item.baseCenter.y + SINR_LIVE_CALLOUT_Y_LIFT, item.baseCenter.z]}
            center
            zIndexRange={[80, 20]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              data-testid="beam-callout"
              data-satellite-label={satLabel}
              data-beam-identity={beamIdentity}
              data-beam-id={beamId}
              data-cell-id={displayCellId}
              data-beam-display-only="0"
              data-beam-primary={isPrimary ? '1' : '0'}
              data-angle-aware-frame-time-sec={frameSnapshot?.timeSec.toFixed(3) ?? ''}
              data-angle-aware-frame-sat-id={frameSnapshot?.satId ?? ''}
              data-angle-aware-frame-beam-id={frameSnapshot?.beamId.toString() ?? ''}
              data-angle-aware-frame-sinr-db={isPrimary ? frameSnapshot?.terms.gammaDb.toFixed(6) ?? '' : ''}
              data-angle-aware-frame-throughput-bps={isPrimary ? frameSnapshot?.terms.throughputBps.toFixed(6) ?? '' : ''}
              data-angle-aware-frame-system-power-w={isPrimary ? frameSnapshot?.terms.systemPowerW.toFixed(6) ?? '' : ''}
              data-angle-aware-frame-ee-bits-per-joule={isPrimary ? frameSnapshot?.terms.energyEfficiencyBitsPerJoule.toFixed(6) ?? '' : ''}
              data-sinr-db={Number.isFinite(sinrDb ?? NaN) ? sinrDb?.toFixed(6) : ''}
              data-ee-bits-per-joule={Number.isFinite(eeBitsPerJoule ?? NaN) ? eeBitsPerJoule?.toFixed(6) : ''}
              data-display-metric={displayEe ? 'ee' : 'sinr'}
              style={{
                minWidth: 64,
                padding: isPrimary ? '4px 7px' : '3px 5px',
                borderRadius: 5,
                border: `1px solid ${renderColor}`,
                borderLeft: `4px solid ${renderColor}`,
                background: 'rgba(2, 9, 18, 0.82)',
                boxShadow: isPrimary ? `0 0 10px ${renderColor}66` : 'none',
                color: '#ffffff',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: isPrimary ? 12 : 10,
                fontWeight: 700,
                lineHeight: 1.2,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
              }}
            >
              <div
                data-testid="beam-callout-satellite-chip"
                style={{ color: renderColor, fontWeight: 800 }}
              >
                <span>{satLabel}</span>
              </div>
              <div style={{ opacity: 0.92, fontWeight: isPrimary ? 800 : 700 }}>B{beamId} · C{displayCellId} · F{item.frequencyIndex}</div>
              <div style={{ fontWeight: isPrimary ? 700 : 600 }}>{valueLabel}</div>
              {homepageVisualIdentity && displayEe && eeProgress !== null && (
                <div
                  data-testid="beam-ee-progress"
                  role="progressbar"
                  aria-label={`${satLabel} B${beamId} EE level`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(eeProgress * 100)}
                  aria-valuetext={formatHomepageCalloutEe(eeBitsPerJoule)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    marginTop: 4,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '1 1 auto',
                      minWidth: 42,
                      height: 5,
                      overflow: 'hidden',
                      borderRadius: 3,
                      background: 'rgba(255, 255, 255, 0.16)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        display: 'block',
                        width: `${eeProgress * 100}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: renderColor,
                      }}
                    />
                  </span>
                  <span aria-hidden="true" style={{ color: renderColor, fontSize: 9 }}>
                    {Math.round(eeProgress * 100)}%
                  </span>
                </div>
              )}
            </div>
          </Html>
        );
      })}
    </group>
  );
}
