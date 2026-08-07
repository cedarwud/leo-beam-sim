import { useMemo } from 'react';
import { useGLTF, Text } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { operatorLabelForEventRole, tokenForEventRole } from '../constants/beamRoleTokens';
import type { EventRole } from '../scene/types';

interface SatelliteMarkerProps {
  position: THREE.Vector3;
  label: string;
  eventRole?: EventRole;
  satelliteTintColor?: string;
  scaleMultiplier?: number;
}

const SAT_MODEL_PATH = '/models/sat.glb';
const SATELLITE_BODY_TINT_BLEND = 0.46;

export function resolveSatelliteTintedColor(baseColor: string, tintColor: string): string {
  return `#${new THREE.Color(baseColor).lerp(new THREE.Color(tintColor), SATELLITE_BODY_TINT_BLEND).getHexString()}`;
}

function tintMaterial(material: THREE.Material, tintColor: string): THREE.Material {
  const cloned = material.clone();
  if ('color' in cloned && cloned.color instanceof THREE.Color) {
    cloned.color.set(resolveSatelliteTintedColor(`#${cloned.color.getHexString()}`, tintColor));
  }
  return cloned;
}

export function SatelliteMarker({
  position,
  label,
  eventRole,
  satelliteTintColor,
  scaleMultiplier = 1,
}: SatelliteMarkerProps) {
  const { scene } = useGLTF(SAT_MODEL_PATH);
  const roleToken = tokenForEventRole(eventRole);
  const roleLabel = operatorLabelForEventRole(eventRole, true);
  const accent = eventRole ? roleToken.color : satelliteTintColor ?? '#aaccff';
  const markerLightColor = satelliteTintColor ?? accent;
  const scale = (eventRole ? roleToken.markerScale : 5) * scaleMultiplier;

  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        if (satelliteTintColor) {
          mesh.material = Array.isArray(mesh.material)
            ? mesh.material.map(material => tintMaterial(material, satelliteTintColor))
            : tintMaterial(mesh.material, satelliteTintColor);
        }
      }
    });
    return c;
  }, [satelliteTintColor, scene]);

  return (
    <group position={position}>
      <primitive object={cloned} scale={scale} />
      {roleToken.markerLightIntensity > 0 && (
        <pointLight color={markerLightColor} intensity={roleToken.markerLightIntensity} distance={80} decay={2} />
      )}
      <Text
        position={[0, 20, 0]}
        fontSize={eventRole ? roleToken.markerFontSize : 12}
        color={accent}
        anchorX="center"
        anchorY="middle"
        outlineWidth={1}
        outlineColor="#000000"
      >
        {roleLabel ? `${label} ${roleLabel}` : label}
      </Text>
    </group>
  );
}

useGLTF.preload(SAT_MODEL_PATH);
