import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { tokenForEventRole } from '../constants/beamRoleTokens';
import type { EventRole, VisibleSat } from '../scene/types';
import { formatBeamIdentityLabel } from '../utils/beamFrequency';
import type { BeamTarget } from './SatelliteBeams';

interface HandoverLinksProps {
  satellites: VisibleSat[];
  eventRoles: Map<string, EventRole>;
  satBeams: Map<string, BeamTarget[]>;
}

const UE_ANCHOR: [number, number, number] = [0, 6, 0];

function primaryBeamLabel(beams: BeamTarget[] | undefined): string | null {
  const beam = beams?.find(entry => entry.isServing) ?? beams?.find(entry => entry.isPrimary);
  return beam ? formatBeamIdentityLabel(beam.frequencyIndex, beam.beamId) : null;
}

export function HandoverLinks({ satellites, eventRoles, satBeams }: HandoverLinksProps) {
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
          const beamLabel = primaryBeamLabel(satBeams.get(satellite.id));
          const label = [style.operatorLabel, beamLabel].filter(Boolean).join(' ');
          const midpoint = new THREE.Vector3(...UE_ANCHOR).lerp(satellite.world, 0.42);

          return (
            <group key={`link-${satellite.id}`}>
              <Line
                points={[
                  UE_ANCHOR,
                  [satellite.world.x, satellite.world.y, satellite.world.z],
                ]}
                color={style.color}
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
                color={style.color}
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
