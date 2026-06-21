/**
 * SINR-live cell-truth BEAM-INFO callouts (W5).
 *
 * Reimplements the "Beam Info" scene labels on the earth-fixed cell-cone lane. The
 * old `BeamCalloutContent` only ever mounted inside the retired steered
 * <SatelliteBeams>, so on the cell-cone lane the Beam Info toggle flipped a flag with
 * NO renderer behind it (broke c8d211d / b64cd9a). This is a DUMB renderer (mirrors
 * `SinrLiveCellFootprintRings`): one <Html> chip per rendered serving-cone item,
 * floated above the cone ({@link SINR_LIVE_CALLOUT_Y_LIFT}), in the cone's
 * serving-identity colour. It does
 * NOT fake a steered `BeamTarget` — it reads the cell-truth items + the per-cell
 * serving SINR directly, so it cannot drift from the cones / footprint hexes it
 * labels. Display-only (Rule#6): it surfaces the model's own serving identity + SINR,
 * no truth. Lane gating lives in MainScene (mounted under `showBeamCallouts`).
 */
import { useEffect, useLayoutEffect, type JSX } from 'react';
import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { formatSatelliteLabel } from '../utils/formatSatelliteLabel';
import { SINR_LIVE_CALLOUT_Y_LIFT } from '../constants/sinrLiveConeStyle';
import type { SinrLiveCellBeamConeRenderItem } from './SinrLiveCellBeamCones';

export interface SinrLiveCellBeamCalloutsProps {
  /** The SERVING cone items (one callout per rendered cone). Empty off the cell lane. */
  readonly items: readonly SinrLiveCellBeamConeRenderItem[];
  /** Per-cell serving SINR (dB) from the cell model — `null` for an unserved cell. */
  readonly servingSinrByCellId: ReadonlyMap<number, number | null>;
  /** The protagonist (hero) serving sat/cell — its chip is emphasised. */
  readonly primaryServingSatId: string | null;
  readonly primaryServingCellId: number | null;
  /** Optional canvas dataset key for the rendered-callout count (validator proof). */
  readonly telemetryCountDatasetKey?: string;
}

function formatCalloutSinr(sinrDb: number | null | undefined): string {
  return sinrDb !== null && sinrDb !== undefined && Number.isFinite(sinrDb)
    ? `${sinrDb.toFixed(1)} dB`
    : '— dB';
}

export function SinrLiveCellBeamCallouts(props: SinrLiveCellBeamCalloutsProps): JSX.Element | null {
  const gl = useThree(state => state.gl);
  const { items, servingSinrByCellId, primaryServingSatId, primaryServingCellId } = props;

  // MESH-less telemetry: <Html> portals out of the canvas, so a mesh traverse would
  // miss it — publish the item count directly so a validator can prove the labels mount.
  useLayoutEffect(() => {
    const key = props.telemetryCountDatasetKey;
    if (!key) return;
    gl.domElement.dataset[key] = String(items.length);
  });

  useEffect(() => () => {
    if (props.telemetryCountDatasetKey) delete gl.domElement.dataset[props.telemetryCountDatasetKey];
  }, [gl, props.telemetryCountDatasetKey]);

  if (items.length === 0) return null;

  return (
    <group name="sinr-live-cell-beam-callouts">
      {items.map(item => {
        const isPrimary =
          item.satId === primaryServingSatId && item.cellId === primaryServingCellId;
        const satLabel = formatSatelliteLabel(item.satId);
        const beamIdentity = `${item.satId}#cell${item.cellId}`;
        const sinrLabel = formatCalloutSinr(servingSinrByCellId.get(item.cellId));
        return (
          <Html
            key={item.renderKey ?? `${item.cellId}-${item.satId}`}
            position={[item.baseCenter.x, item.baseCenter.y + SINR_LIVE_CALLOUT_Y_LIFT, item.baseCenter.z]}
            center
            zIndexRange={[80, 20]}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            <div
              data-testid="beam-callout"
              data-satellite-label={satLabel}
              data-beam-identity={beamIdentity}
              data-beam-primary={isPrimary ? '1' : '0'}
              style={{
                minWidth: 64,
                padding: isPrimary ? '4px 7px' : '3px 5px',
                borderRadius: 5,
                border: `1px solid ${item.color}`,
                borderLeft: `4px solid ${item.color}`,
                background: 'rgba(2, 9, 18, 0.82)',
                boxShadow: isPrimary ? `0 0 10px ${item.color}66` : 'none',
                color: '#ffffff',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: isPrimary ? 12 : 10,
                lineHeight: 1.2,
                textAlign: 'center',
                whiteSpace: 'nowrap',
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.9)',
              }}
            >
              <div data-testid="beam-callout-satellite-chip" style={{ color: item.color, fontWeight: 800 }}>
                {satLabel}
              </div>
              <div style={{ opacity: 0.92 }}>Cell {item.cellId} · F{item.frequencyIndex}</div>
              <div style={{ fontWeight: isPrimary ? 700 : 600 }}>{sinrLabel}</div>
            </div>
          </Html>
        );
      })}
    </group>
  );
}
