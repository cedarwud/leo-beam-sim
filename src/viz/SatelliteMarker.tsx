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
}

const SAT_MODEL_PATH = '/models/sat.glb';

export function SatelliteMarker({ position, label, eventRole }: SatelliteMarkerProps) {
  const { scene } = useGLTF(SAT_MODEL_PATH);
  const roleToken = tokenForEventRole(eventRole);
  const roleLabel = operatorLabelForEventRole(eventRole, true);
  const accent = eventRole ? roleToken.color : '#aaccff';
  const scale = eventRole ? roleToken.markerScale : 5;

  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((obj: THREE.Object3D) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
      }
    });
    return c;
  }, [scene]);

  return (
    <group position={position}>
      <primitive object={cloned} scale={scale} />
      {roleToken.markerLightIntensity > 0 && (
        <pointLight color={accent} intensity={roleToken.markerLightIntensity} distance={80} decay={2} />
      )}
      <Text
        position={[0, 20, 0]}
        fontSize={eventRole ? roleToken.markerFontSize : 10}
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
