import React, { Suspense } from 'react';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { NTPUScene } from '../components/scene/NTPUScene';
import type { NTPUSceneConfig } from '../config/ntpu.config';
import {
  CINEMATIC_EVENT_LIGHT_DECAY,
  CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD,
  CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD,
  CINEMATIC_FOG_COLOR,
  CINEMATIC_FOG_DENSITY,
  resolveCinematicLightIntensity,
  type CinematicSpotlightTarget,
} from './cinematicEffects';
import type { CinematicMode } from './types';

export interface BaseSceneLayoutProps {
  sceneConfig: NTPUSceneConfig;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  /** Presentation-only mount gate; camera, controls, and lighting stay active. */
  campusVisible?: boolean;
  cinematicSpotlightActive?: boolean;
  effectiveCinematicMode?: CinematicMode;
  cinematicSpotlightTargets?: CinematicSpotlightTarget[];
  children?: React.ReactNode;
}

export function BaseSceneLayout({
  sceneConfig,
  controlsRef,
  campusVisible = true,
  cinematicSpotlightActive = false,
  effectiveCinematicMode = 'off',
  cinematicSpotlightTargets = [],
  children,
}: BaseSceneLayoutProps) {
  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={sceneConfig.camera.initialPosition}
        fov={sceneConfig.camera.fov}
        near={sceneConfig.camera.near}
        far={sceneConfig.camera.far}
      />
      <OrbitControls
        ref={controlsRef}
        enableDamping={false}
        rotateSpeed={0.3}
        zoomSpeed={0.45}
        panSpeed={0.3}
        minDistance={50}
        maxDistance={3000}
      />

      {cinematicSpotlightActive && (
        <fogExp2 attach="fog" args={[CINEMATIC_FOG_COLOR, CINEMATIC_FOG_DENSITY]} />
      )}
      <hemisphereLight args={[0xffffff, 0x444444, resolveCinematicLightIntensity(1.0, effectiveCinematicMode)]} />
      <ambientLight intensity={resolveCinematicLightIntensity(0.2, effectiveCinematicMode)} />
      <directionalLight
        castShadow
        position={[0, 50, 0]}
        intensity={resolveCinematicLightIntensity(1.5, effectiveCinematicMode)}
        shadow-mapSize-width={4096}
        shadow-mapSize-height={4096}
        shadow-camera-near={1}
        shadow-camera-far={1000}
        shadow-camera-top={500}
        shadow-camera-bottom={-500}
        shadow-camera-left={500}
        shadow-camera-right={-500}
        shadow-bias={-0.0004}
        shadow-radius={8}
      />
      {cinematicSpotlightTargets.map(target => (
        <pointLight
          key={target.id}
          color={target.color}
          intensity={target.intensity}
          distance={CINEMATIC_EVENT_LIGHT_DISTANCE_WORLD}
          decay={CINEMATIC_EVENT_LIGHT_DECAY}
          position={[target.groundX, CINEMATIC_EVENT_LIGHT_HEIGHT_WORLD, target.groundZ]}
        />
      ))}

      {campusVisible && (
        <Suspense fallback={null}>
          <NTPUScene config={sceneConfig} />
        </Suspense>
      )}

      {children}
    </>
  );
}
