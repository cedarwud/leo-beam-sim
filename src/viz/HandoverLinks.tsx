import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { tokenForEventRole } from '../constants/beamRoleTokens';
import { colorForServingBeam } from '../constants/servingColour';
import type { BeamTarget } from '../scene/beamTargetTypes';
import type { EventRole, VisibleSat } from '../scene/types';
import { formatBeamIdentityByIndex } from '../utils/formatSatelliteLabel';

/**
 * P2 (SDD §9 + §7 "src/viz/HandoverLinks.tsx — currently uses a hardcoded
 * UE_ANCHOR = [0, 6, 0] drawing all links from a single origin; generalize
 * to per-UE anchors before P2 / P4").
 *
 * The hardcode is removed. The anchor is now derived from the active /
 * primary UE's world position (`primaryUeAnchor` prop). Caller (MainScene)
 * extracts it from `NormalizedSceneFrame.ues[0].worldPos`.
 *
 * Why anchor a single UE rather than per-(sat, ue) lines today:
 *   - `eventRoles` is still per-satellite (live engine: 1 UE; replay:
 *     primary-UE focus by SDD §10 OQ-6 default).
 *   - Drawing 100 × event-role lines per frame (one per UE) is unreadable
 *     and a perf hit; the display-filter feature (P2b) will let the user
 *     elevate one UE at a time, at which point the per-UE anchor moves
 *     to the elevated UE.
 *
 * For live N=1 the behaviour is byte-equivalent to pre-P2 because the
 * sole UE's `worldPos` is exactly `[ueGroundX, 0, ueGroundZ]` and the
 * anchor is offset to `[x, 6, z]` (same `y=6` as the old hardcode).
 */

interface HandoverLinksProps {
  satellites: VisibleSat[];
  eventRoles: Map<string, EventRole>;
  satBeams: Map<string, BeamTarget[]>;
  /**
   * World-space anchor for the link tail. Default `[0, 6, 0]` preserves
   * pre-P2 behaviour when MainScene calls without supplying the prop.
   * MainScene should pass the primary UE's `worldPos` (with a small Y
   * offset for visual clarity).
   */
  primaryUeAnchor?: readonly [number, number, number];
}

const LEGACY_DEFAULT_ANCHOR: readonly [number, number, number] = [0, 6, 0];
const ANCHOR_HEIGHT_OFFSET = 6;

function primaryBeamLabel(satId: string, beams: BeamTarget[] | undefined): string | null {
  const beam = beams?.find(entry => entry.isServing) ?? beams?.find(entry => entry.isPrimary);
  return beam ? formatBeamIdentityByIndex({ satId, beamId: beam.beamId, frequencyIndex: beam.frequencyIndex }) : null;
}

function markerColorForBeam(satId: string, beamId: number): string {
  return colorForServingBeam(satId, beamId).markerColor;
}

function identityColorForLink(
  satId: string,
  beams: BeamTarget[] | undefined,
  fallback: string,
): string {
  const beam = beams?.find(entry => entry.isServing)
    ?? beams?.find(entry => entry.isPrimary)
    ?? beams?.find(entry => entry.isScheduledActive)
    ?? beams?.[0];
  return beam === undefined
    ? fallback
    : markerColorForBeam(satId, beam.beamId);
}

function resolveAnchor(
  primaryUeAnchor: readonly [number, number, number] | undefined,
): readonly [number, number, number] {
  if (!primaryUeAnchor) return LEGACY_DEFAULT_ANCHOR;
  const [x, y, z] = primaryUeAnchor;
  return [x, y + ANCHOR_HEIGHT_OFFSET, z];
}

export function HandoverLinks({
  satellites,
  eventRoles,
  satBeams,
  primaryUeAnchor,
}: HandoverLinksProps) {
  const anchor = resolveAnchor(primaryUeAnchor);
  const anchorPoints: [number, number, number] = [anchor[0], anchor[1], anchor[2]];
  return (
    <group>
      {satellites
        .filter(satellite => {
          const role = eventRoles.get(satellite.id);
          return role !== undefined && tokenForEventRole(role).operatorLabel !== null;
        })
        .map(satellite => {
          const role = eventRoles.get(satellite.id);
          if (!role) return null;

          const style = tokenForEventRole(role);
          const satelliteBeams = satBeams.get(satellite.id);
          const beamLabel = primaryBeamLabel(satellite.id, satelliteBeams);
          // Keep the established link geometry, dash pattern, and role
          // opacity.  Only the paint source changes: a link inherits the
          // spacecraft/beam identity hue rather than saying "candidate" by
          // virtue of its event role.
          const identityColor = identityColorForLink(
            satellite.id,
            satelliteBeams,
            satellite.satelliteTintColor ?? '#aaccff',
          );
          const label = [style.operatorLabel, beamLabel].filter(Boolean).join(' · ');
          const midpoint = new THREE.Vector3(...anchor).lerp(satellite.world, 0.42);

          return (
            <group key={`link-${satellite.id}`}>
              <Line
                points={[
                  anchorPoints,
                  [satellite.world.x, satellite.world.y, satellite.world.z],
                ]}
                color={identityColor}
                lineWidth={style.linkLineWidth}
                transparent
                opacity={style.lineOpacity}
                dashed={style.dashed}
                dashSize={14}
                gapSize={8}
                depthWrite={false}
              />
              <Text
                position={[midpoint.x, midpoint.y + 8, midpoint.z]}
                fontSize={style.markerFontSize}
                color={identityColor}
                anchorX="center"
                anchorY="middle"
                outlineWidth={1.5}
                outlineColor="#000000"
              >
                {label}
              </Text>
            </group>
          );
        })}
    </group>
  );
}
