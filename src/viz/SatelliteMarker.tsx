import { useLayoutEffect, useMemo } from 'react';
import { useGLTF, Html, Text } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { operatorLabelForEventRole, tokenForEventRole } from '../constants/beamRoleTokens';
import type { EventRole } from '../scene/types';
import type { SimulatorConstellation } from '../simulator/types';
import {
  DEFAULT_SATELLITE_CONSTELLATION,
  SATELLITE_MODEL_CATALOG,
  satelliteModelForConstellation,
} from './satelliteModelCatalog';

interface SatelliteMarkerProps {
  position: THREE.Vector3;
  label: string;
  eventRole?: EventRole;
  satelliteTintColor?: string;
  scaleMultiplier?: number;
  /** Display-only base scale lift for a scene that needs slightly larger GLBs. */
  baseScaleMultiplier?: number;
  constellation?: SimulatorConstellation;
  /** Context models can remain readable without adding a label for every sat. */
  showLabel?: boolean;
  /** Display-only label lift for an explicitly shortlisted spacecraft. */
  labelFontSize?: number;
  /** Display-only vertical offset for the label above the GLB carrier. */
  labelOffsetY?: number;
  /** Display-only label foreground colour; defaults to the satellite hue. */
  labelColor?: string;
  /** Display-only label outline colour; defaults to a neutral black outline. */
  labelOutlineColor?: string;
  /** Display-only label outline width for a high-contrast scene label. */
  labelOutlineWidth?: number;
  /** Homepage-only normalized EE level for the satellite's displayed beam set. */
  eeProgress?: number | null;
  /** Mount the small EE bar only during an accepted homepage handover episode. */
  showEeProgress?: boolean;
  /** Keep a mounted GLB in the scene graph while a display layer filters it. */
  visible?: boolean;
}

const SATELLITE_BODY_TINT_BLEND = 0.46;

export function resolveSatelliteTintedColor(baseColor: string, tintColor: string): string {
  return `#${new THREE.Color(baseColor).lerp(new THREE.Color(tintColor), SATELLITE_BODY_TINT_BLEND).getHexString()}`;
}

interface SatelliteModelInstance {
  readonly scene: THREE.Object3D;
  readonly materials: readonly {
    readonly material: THREE.Material;
    readonly baseColor: THREE.Color;
  }[];
}

function materialColor(material: THREE.Material): THREE.Color | null {
  const candidate = material as THREE.Material & { color?: unknown };
  return candidate.color instanceof THREE.Color ? candidate.color : null;
}

/**
 * Clone the GLB once per loaded asset.  Tint changes are applied to the
 * already-mounted material instances below; rebuilding the entire skeleton
 * whenever a candidate colour changes causes a visible one-frame disappear /
 * reappear in the R3F scene.
 */
function cloneSatelliteModel(scene: THREE.Object3D): SatelliteModelInstance {
  const cloned = SkeletonUtils.clone(scene);
  const materials: { material: THREE.Material; baseColor: THREE.Color }[] = [];
  cloned.traverse((obj: THREE.Object3D) => {
    if (!(obj as THREE.Mesh).isMesh) return;
    const mesh = obj as THREE.Mesh;
    mesh.castShadow = true;
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const clonedMaterials = sourceMaterials.map(material => {
      const next = material.clone();
      const color = materialColor(next);
      if (color !== null) {
        materials.push({ material: next, baseColor: color.clone() });
      }
      return next;
    });
    mesh.material = Array.isArray(mesh.material) ? clonedMaterials : clonedMaterials[0]!;
  });
  return Object.freeze({
    scene: cloned,
    materials: Object.freeze(materials),
  });
}

function applySatelliteTint(instance: SatelliteModelInstance, tintColor?: string): void {
  const tint = tintColor === undefined ? null : new THREE.Color(tintColor);
  for (const entry of instance.materials) {
    const color = materialColor(entry.material);
    if (color === null) continue;
    color.copy(entry.baseColor);
    if (tint !== null) {
      color.lerp(tint, SATELLITE_BODY_TINT_BLEND);
    }
  }
}

export function SatelliteMarker({
  position,
  label,
  eventRole,
  satelliteTintColor,
  scaleMultiplier = 1,
  baseScaleMultiplier = 1,
  constellation = DEFAULT_SATELLITE_CONSTELLATION,
  showLabel = true,
  labelFontSize,
  labelOffsetY = 20,
  labelColor,
  labelOutlineColor = '#000000',
  labelOutlineWidth = 1.5,
  eeProgress = null,
  showEeProgress = false,
  visible = true,
}: SatelliteMarkerProps) {
  const model = satelliteModelForConstellation(constellation);
  const { scene } = useGLTF(model.path);
  const roleToken = tokenForEventRole(eventRole);
  const roleLabel = operatorLabelForEventRole(eventRole, true);
  // Event roles still control the marker's size/light envelope and operator
  // label, but colour belongs to the satellite identity.  Keeping the tint in
  // the foreground prevents the old serving-yellow / candidate-blue encoding
  // from overriding the stable hue assigned to this spacecraft.
  const accent = satelliteTintColor ?? '#aaccff';
  const markerLightColor = satelliteTintColor ?? accent;
  const scale = (eventRole ? roleToken.markerScale : 5) * baseScaleMultiplier * scaleMultiplier;

  const modelInstance = useMemo(() => cloneSatelliteModel(scene), [scene]);

  useLayoutEffect(() => {
    applySatelliteTint(modelInstance, satelliteTintColor);
  }, [modelInstance, satelliteTintColor]);

  return (
    <group position={position} visible={visible}>
      <group rotation={model.rotation} scale={model.scale * scale}>
        <primitive object={modelInstance.scene} position={model.centerOffset} />
      </group>
      {roleToken.markerLightIntensity > 0 && (
        <pointLight color={markerLightColor} intensity={roleToken.markerLightIntensity} distance={80} decay={2} />
      )}
      {scaleMultiplier > 1 && !eventRole && (
        <pointLight
          color={markerLightColor}
          intensity={8}
          distance={140}
          decay={2}
        />
      )}
      {showLabel && (
        <Text
          position={[0, labelOffsetY, 0]}
          fontSize={labelFontSize ?? (eventRole ? roleToken.markerFontSize : 12)}
          color={labelColor ?? accent}
          anchorX="center"
          anchorY="middle"
          outlineWidth={labelOutlineWidth}
          outlineColor={labelOutlineColor}
        >
          {roleLabel ? `${label} ${roleLabel}` : label}
        </Text>
      )}
      {showEeProgress && eeProgress !== null && Number.isFinite(eeProgress) && (
        <Html
          position={[0, labelOffsetY - 8, 0]}
          center
          zIndexRange={[70, 30]}
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          <div
            data-testid="satellite-ee-progress"
            role="progressbar"
            aria-label={`${label} EE level`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.max(0, Math.min(1, eeProgress)) * 100)}
            style={{
              width: 86,
              height: 6,
              padding: 1,
              boxSizing: 'border-box',
              border: `1px solid ${accent}`,
              borderRadius: 4,
              background: 'rgba(2, 9, 18, 0.86)',
              boxShadow: `0 0 7px ${accent}55`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'block',
                width: `${Math.max(0, Math.min(1, eeProgress)) * 100}%`,
                height: '100%',
                borderRadius: 2,
                background: accent,
              }}
            />
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload(SATELLITE_MODEL_CATALOG.starlink.path);
useGLTF.preload(SATELLITE_MODEL_CATALOG.oneweb.path);
