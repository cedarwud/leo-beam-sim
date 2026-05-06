import React from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { frequencyReuseColor, resolveBeamVisualEncoding, satelliteTint, satelliteTintIndex, type BeamCodeRole } from '../constants/beamRoleTokens';
import { BeamCalloutContent, SatelliteBeams, type BeamTarget } from '../viz/SatelliteBeams';
import { satelliteGlyph } from '../viz/glyphs';

type Vc1cFixtureRole = 'serving' | 'pending' | 'approach' | 'recentSource' | 'otherActive';

interface Vc1cFixtureInput {
  role: Vc1cFixtureRole;
  beamId?: number;
  frequencyIndex?: number;
}

interface Vc1cFixtureEncoding {
  visualRole: string;
  roleSurfaceColor: string;
  discFillColor: string;
  discOpacity: number;
  frequencySwatchColor: string;
  operatorLabel: string | null;
}

interface Vc1cFixtureResult extends Vc1cFixtureEncoding {
  canvasReady: boolean;
}

let root: Root | null = null;

function roleToBeamProps(role: Vc1cFixtureRole): {
  codeRole?: BeamCodeRole;
  isServing: boolean;
  isPrimary: boolean;
} {
  switch (role) {
    case 'serving':
      return { codeRole: 'serving', isServing: true, isPrimary: true };
    case 'pending':
      return { codeRole: 'prepared', isServing: false, isPrimary: true };
    case 'approach':
      return { codeRole: 'approach', isServing: false, isPrimary: true };
    case 'recentSource':
      return { codeRole: 'secondary', isServing: false, isPrimary: true };
    case 'otherActive':
      return { isServing: false, isPrimary: false };
  }
}

function resolveFixtureEncoding(input: Required<Vc1cFixtureInput>): Vc1cFixtureEncoding {
  const roleProps = roleToBeamProps(input.role);
  const frequencyColor = frequencyReuseColor(input.frequencyIndex);
  const style = resolveBeamVisualEncoding({
    role: roleProps.codeRole,
    isPrimary: roleProps.isPrimary,
    isServing: roleProps.isServing,
    isScheduledActive: true,
    frequencyColor,
  });
  const eventRoleSurface = style.visualRole !== 'otherActive' && style.visualRole !== 'inactive';

  return {
    visualRole: style.visualRole,
    roleSurfaceColor: style.color,
    discFillColor: eventRoleSurface ? style.frequencySwatchColor : style.color,
    discOpacity: eventRoleSurface ? Math.min(style.discOpacity, 0.18) : style.discOpacity,
    frequencySwatchColor: style.frequencySwatchColor,
    operatorLabel: style.operatorLabel,
  };
}

function FixtureScene({ input }: { input: Required<Vc1cFixtureInput> }) {
  const roleProps = roleToBeamProps(input.role);
  const beam: BeamTarget = {
    beamId: input.beamId,
    groundX: 0,
    groundZ: 0,
    isServing: roleProps.isServing,
    isScheduledActive: true,
    isPrimary: roleProps.isPrimary,
    showBeam: true,
    frequencyIndex: input.frequencyIndex,
    satelliteTintColor: satelliteTint('shell-pro-53-P0-S3', 0),
    satelliteGlyph: satelliteGlyph(satelliteTintIndex('shell-pro-53-P0-S3', 0)),
    satelliteVisualIndex: satelliteTintIndex('shell-pro-53-P0-S3', 0),
    role: roleProps.codeRole,
    sinrDb: input.role === 'otherActive' ? 9.7 : 18.4,
  };

  return (
    <>
      <Canvas
        data-testid="vc1c-canvas"
        orthographic
        camera={{ position: [0, 220, 330], zoom: 1.42, near: 1, far: 1200 }}
        gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
        onCreated={({ camera, gl, scene }) => {
          gl.setClearColor('#020912', 1);
          scene.background = new THREE.Color('#020912');
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
        }}
      >
        <SatelliteBeams
          satelliteId="shell-pro-53-P0-S3"
          satellitePosition={new THREE.Vector3(0, 160, 110)}
          beams={[beam]}
          footprintRadius={72}
          reducedMotion={false}
        />
      </Canvas>
      <CalloutProbe input={input} />
    </>
  );
}

function CalloutProbe({ input }: { input: Required<Vc1cFixtureInput> }) {
  const roleProps = roleToBeamProps(input.role);
  const style = resolveBeamVisualEncoding({
    role: roleProps.codeRole,
    isPrimary: roleProps.isPrimary,
    isServing: roleProps.isServing,
    isScheduledActive: true,
    frequencyColor: frequencyReuseColor(input.frequencyIndex),
  });

  return (
    <div
      data-testid="vc1c-callout-probe"
      style={{
        position: 'absolute',
        left: 18,
        top: 18,
        zIndex: 5,
      }}
    >
      <BeamCalloutContent
        satelliteId="shell-pro-53-P0-S3"
        satelliteGlyph={satelliteGlyph(0)}
        beam={{ beamId: input.beamId, frequencyIndex: input.frequencyIndex }}
        style={style}
        color={style.color}
        sinrLabel={input.role === 'otherActive' ? '9.7 dB' : '18.4 dB'}
        isEmphasized={style.isEmphasized}
      />
    </div>
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderVc1cFrequencyDemotionFixture(
  fixtureInput: Vc1cFixtureInput,
): Promise<Vc1cFixtureResult> {
  const input: Required<Vc1cFixtureInput> = {
    role: fixtureInput.role,
    beamId: fixtureInput.beamId ?? 5,
    frequencyIndex: fixtureInput.frequencyIndex ?? 1,
  };

  root?.unmount();
  document.body.innerHTML = '<div id="vc1c-root"></div>';
  document.body.style.margin = '0';
  document.body.style.background = '#020912';
  document.body.style.overflow = 'hidden';

  const host = document.getElementById('vc1c-root');
  if (!host) throw new Error('vc1c-root was not created');
  host.style.width = '900px';
  host.style.height = '600px';
  host.style.position = 'relative';

  root = createRoot(host);
  flushSync(() => {
    root?.render(<FixtureScene input={input} />);
  });
  await nextPaint();

  return {
    ...resolveFixtureEncoding(input),
    canvasReady: Boolean(document.querySelector('canvas')),
  };
}
