/**
 * ArtifactSatelliteCompass — FIX-5 Option C honest satellite-direction HUD.
 *
 * A 2D DOM (SVG) compass rose that surfaces WHERE the artifact-replay
 * satellites are, using only the truthful ground-plane azimuth the producer
 * `eci-km-no-earth-rotation-proxy` preserved. The proxy flattens every
 * satellite to the ground plane (Y=0) on a ~7151-unit ring (the real LEO
 * orbital radius), so `MainScene` draws them far off-frame laterally and the
 * user sees "no satellites". This HUD recovers the real bearing and points at
 * each satellite around the rim WITHOUT inventing the missing elevation.
 *
 * Render-truth boundary (docs/showcase-render-truth-fix-backlog.md FIX-5):
 *   - It is NOT a 3D viewport proof layer — it is a 2D DOM HUD (a governance
 *     "Shared Surface" that presents lane state). It mounts no R3F canvas and
 *     imports no three / scene / viz symbol, so it adds no viewport proof story
 *     and needs no lane-matrix change (it is still lane-OWNED: App.tsx mounts it
 *     only on `sceneLane === 'artifact-replay'`).
 *   - Display-only: it reads the already-projected `worldPos` and never alters
 *     SINR / handover / MODQN / reward / geometry truth.
 *   - HONEST: it renders ONLY the real azimuth + ring radius and labels itself
 *     "azimuth only … no elevation/Earth-rotation". It never synthesises the
 *     overhead Y dimension (that fabrication is exactly what Option B was
 *     rejected for, and what Option A's producer source-gap forbids).
 *   - It renders ONLY for the flattened ECI proxy frame
 *     (`deriveSatelliteAzimuths().isFlatEciProxy`). A standard `ecef-km`
 *     artifact (real overhead geometry the 3D scene already draws correctly), a
 *     mixed/unknown frame, or any frame carrying real elevation gets NO compass
 *     — the proxy "no elevation" caption would be a lie in the opposite
 *     direction (codex FIX-5 P2). This also suppresses the misleading compass on
 *     the FIX-1 synthetic fixture, which carries elevation while the caption
 *     would claim none.
 *
 * The azimuth math is a separate pure, unit-tested helper
 * (`deriveSatelliteAzimuths`).
 */

import type { ReactElement } from 'react';
import type { NormalizedSatellite } from '../scene/NormalizedSceneFrame';
import { deriveSatelliteAzimuths } from './artifactSatelliteAzimuths';

/**
 * The fixed honesty caption. Exported so `validate:frontend:scene-lane-governance`
 * can lock the exact wording — the HUD must keep stating that only azimuth is
 * real and elevation/Earth-rotation is absent, or it silently overclaims.
 */
export const SATELLITE_COMPASS_HONESTY_LABEL =
  'Satellites — orbital azimuth only (ECI proxy, no elevation/Earth-rotation)';

const CX = 60;
const CY = 54;
const RIM = 44;

/** Compass bearing (0=N/+Z, 90=E/+X, clockwise) → SVG rim coordinate. */
function rimPoint(azimuthDeg: number, radius: number): { x: number; y: number } {
  const rad = (azimuthDeg * Math.PI) / 180;
  return { x: CX + radius * Math.sin(rad), y: CY - radius * Math.cos(rad) };
}

const CARDINALS: ReadonlyArray<{ label: string; bearing: number }> = [
  { label: 'N', bearing: 0 },
  { label: 'E', bearing: 90 },
  { label: 'S', bearing: 180 },
  { label: 'W', bearing: 270 },
];

export function ArtifactSatelliteCompass(props: {
  satellites: readonly NormalizedSatellite[];
}): ReactElement | null {
  const { markers, hasElevationData, isFlatEciProxy } = deriveSatelliteAzimuths(props.satellites);
  // Render ONLY when the azimuth-only / no-elevation caption is actually true:
  // the flattened ECI proxy with no elevation. Any other frame (real ecef-km
  // overhead geometry, mixed, or elevation-bearing) gets no compass so the HUD
  // never overclaims a limitation the artifact does not have (codex FIX-5 P2).
  if (!isFlatEciProxy) return null;

  return (
    <div
      className="leo-artifact-satellite-compass"
      data-testid="artifact-satellite-compass"
      data-satellite-count={markers.length}
      data-has-elevation={hasElevationData ? 'true' : 'false'}
      data-frame-kind="eci-km-no-earth-rotation-proxy"
      aria-label="Satellite orbital azimuth context"
      style={{
        position: 'absolute',
        top: 14,
        right: 14,
        width: 176,
        padding: '10px 10px 8px',
        borderRadius: 12,
        background: 'rgba(10, 18, 30, 0.62)',
        border: '1px solid rgba(120, 170, 230, 0.28)',
        backdropFilter: 'blur(7px)',
        WebkitBackdropFilter: 'blur(7px)',
        boxShadow: '0 6px 22px rgba(0, 0, 0, 0.34)',
        color: '#dce8f7',
        // Pure context HUD — never intercept camera drag / director-exit clicks.
        pointerEvents: 'none',
        zIndex: 6,
        userSelect: 'none',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          opacity: 0.82,
          marginBottom: 4,
        }}
      >
        Satellite azimuth
      </div>
      <svg viewBox="0 0 120 120" width="100%" height="116" role="img" aria-hidden="true">
        {/* rim */}
        <circle cx={CX} cy={CY} r={RIM} fill="none" stroke="rgba(120,170,230,0.30)" strokeWidth={1} />
        <circle cx={CX} cy={CY} r={RIM * 0.5} fill="none" stroke="rgba(120,170,230,0.16)" strokeWidth={0.75} />
        {/* cardinal ticks + labels */}
        {CARDINALS.map(({ label, bearing }) => {
          const inner = rimPoint(bearing, RIM - 5);
          const outer = rimPoint(bearing, RIM);
          const text = rimPoint(bearing, RIM + 7);
          return (
            <g key={label}>
              <line
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(150,190,235,0.55)"
                strokeWidth={1}
              />
              <text
                x={text.x}
                y={text.y + 3}
                textAnchor="middle"
                fontSize={8}
                fill="rgba(170,200,235,0.78)"
              >
                {label}
              </text>
            </g>
          );
        })}
        {/* observer (ground) at centre */}
        <circle cx={CX} cy={CY} r={2.4} fill="#7fd4ff" />
        {/* satellite azimuth markers on the rim */}
        {markers.map((m, index) => {
          const dot = rimPoint(m.azimuthDeg, RIM);
          const spoke = rimPoint(m.azimuthDeg, RIM * 0.5);
          return (
            <g
              key={m.id}
              data-testid="artifact-satellite-azimuth-marker"
              data-sat-id={m.id}
              data-azimuth-deg={m.azimuthDeg.toFixed(1)}
            >
              <line
                x1={spoke.x}
                y1={spoke.y}
                x2={dot.x}
                y2={dot.y}
                stroke="rgba(255, 198, 120, 0.55)"
                strokeWidth={1}
              />
              <circle cx={dot.x} cy={dot.y} r={3.4} fill="#ffc678" stroke="#5a2d00" strokeWidth={0.6} />
              <text
                x={dot.x}
                y={dot.y - 5}
                textAnchor="middle"
                fontSize={7}
                fill="rgba(255, 214, 160, 0.92)"
              >
                {index}
              </text>
            </g>
          );
        })}
      </svg>
      <div
        data-testid="artifact-satellite-compass-honesty"
        style={{ fontSize: 9.5, lineHeight: 1.3, opacity: 0.82, marginTop: 2 }}
      >
        {SATELLITE_COMPASS_HONESTY_LABEL}
      </div>
    </div>
  );
}
