import { Suspense } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BEAM_ROLE_TOKENS,
  frequencyReuseColor,
  resolveBeamPulseOpacity,
  resolveBeamVisualEncoding,
  satelliteTint,
  satelliteTintIndex,
  type BeamCodeRole,
} from '../constants/beamRoleTokens';
import type { BeamTarget } from '../scene/beamTargetTypes';
import { BeamCalloutContent, BeamPulseClock, SatelliteBeams } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import {
  SATELLITE_GLYPH_LIBRARY,
  glyphSymbolForKind,
  satelliteGlyph,
  type GlyphKind,
} from '../viz/glyphs';

type Vc2Role = 'serving' | 'pending' | 'approach' | 'recentSource';

interface Vc2BeamFixture {
  role: Vc2Role;
  satId: string;
  codeRole: BeamCodeRole;
  beamId: number;
  frequencyIndex: number;
  isServing: boolean;
  groundX: number;
  groundZ: number;
  satellitePosition: THREE.Vector3;
}

export interface Vc2BeamProbe {
  role: Vc2Role;
  satId: string;
  beamId: number;
  satelliteVisualIndex: number;
  satelliteTintColor: string;
  satelliteGlyph: GlyphKind;
  satelliteGlyphSymbol: string;
  roleColor: string;
  discFillColor: string;
  dashed: boolean;
  pulse: string;
  staticOpacity: number;
  pulseSamples: number[];
  reducedMotionSamples: number[];
}

export interface Vc2FixtureResult {
  canvasReady: boolean;
  beams: Vc2BeamProbe[];
  inlineGlyphText: string;
  fallbackGlyphText: string;
}

let root: Root | null = null;

const fixtures: Vc2BeamFixture[] = [
  {
    role: 'serving',
    satId: 'shell-pro-53-P0-S0',
    codeRole: 'serving',
    beamId: 3,
    frequencyIndex: 0,
    isServing: true,
    groundX: -135,
    groundZ: -8,
    satellitePosition: new THREE.Vector3(-135, 180, 120),
  },
  {
    role: 'pending',
    satId: 'shell-pro-53-P0-S1',
    codeRole: 'prepared',
    beamId: 5,
    frequencyIndex: 1,
    isServing: false,
    groundX: -45,
    groundZ: 14,
    satellitePosition: new THREE.Vector3(-45, 178, 125),
  },
  {
    role: 'approach',
    satId: 'shell-pro-53-P0-S2',
    codeRole: 'approach',
    beamId: 7,
    frequencyIndex: 2,
    isServing: false,
    groundX: 45,
    groundZ: -18,
    satellitePosition: new THREE.Vector3(45, 176, 124),
  },
  {
    role: 'recentSource',
    satId: 'shell-pro-53-P0-S3',
    codeRole: 'secondary',
    beamId: 9,
    frequencyIndex: 3,
    isServing: false,
    groundX: 135,
    groundZ: 18,
    satellitePosition: new THREE.Vector3(135, 174, 118),
  },
];

function createBeam(fixture: Vc2BeamFixture, displayOrder: number): BeamTarget {
  const satelliteVisualIndex = satelliteTintIndex(fixture.satId, displayOrder);
  return {
    beamId: fixture.beamId,
    groundX: fixture.groundX,
    groundZ: fixture.groundZ,
    isServing: fixture.isServing,
    isScheduledActive: true,
    isPrimary: true,
    showBeam: true,
    frequencyIndex: fixture.frequencyIndex,
    satelliteTintColor: satelliteTint(fixture.satId, displayOrder),
    satelliteGlyph: satelliteGlyph(satelliteVisualIndex),
    satelliteVisualIndex,
    role: fixture.codeRole,
    sinrDb: 18.4 - displayOrder,
  };
}

function probeForFixture(fixture: Vc2BeamFixture, displayOrder: number): Vc2BeamProbe {
  const beam = createBeam(fixture, displayOrder);
  const style = resolveBeamVisualEncoding({
    role: fixture.codeRole,
    isPrimary: true,
    isServing: fixture.isServing,
    isScheduledActive: true,
    frequencyColor: frequencyReuseColor(fixture.frequencyIndex),
  });
  const eventRoleSurface = style.visualRole !== 'otherActive' && style.visualRole !== 'inactive';
  const pulseTimes = [0, 0.35, 0.6, 1.05, 1.2, 1.8, 2.4];

  return {
    role: fixture.role,
    satId: fixture.satId,
    beamId: fixture.beamId,
    satelliteVisualIndex: beam.satelliteVisualIndex,
    satelliteTintColor: beam.satelliteTintColor,
    satelliteGlyph: beam.satelliteGlyph,
    satelliteGlyphSymbol: glyphSymbolForKind(beam.satelliteGlyph),
    roleColor: style.color,
    discFillColor: eventRoleSurface ? style.color : style.frequencySwatchColor,
    dashed: style.dashed,
    pulse: style.pulse,
    staticOpacity: style.coneOpacity,
    pulseSamples: pulseTimes.map(elapsedSec => resolveBeamPulseOpacity({
      baseOpacity: style.coneOpacity,
      pulse: style.pulse,
      elapsedSec,
      roleAgeSec: elapsedSec,
    })),
    reducedMotionSamples: pulseTimes.map(elapsedSec => resolveBeamPulseOpacity({
      baseOpacity: style.coneOpacity,
      pulse: style.pulse,
      elapsedSec,
      roleAgeSec: elapsedSec,
      reducedMotion: true,
    })),
  };
}

function FixtureScene({ reducedMotion }: { reducedMotion: boolean }) {
  return (
    <>
      <Canvas
        data-testid="vc2-canvas"
        orthographic
        camera={{ position: [0, 240, 360], zoom: 1.25, near: 1, far: 1200 }}
        gl={{ alpha: false, antialias: false, preserveDrawingBuffer: true }}
        onCreated={({ camera, gl, scene }) => {
          gl.setClearColor('#020912', 1);
          scene.background = new THREE.Color('#020912');
          camera.lookAt(0, 0, 0);
          camera.updateProjectionMatrix();
        }}
      >
        <ambientLight intensity={0.8} />
        <BeamPulseClock reducedMotion={reducedMotion} />
        {fixtures.map((fixture, displayOrder) => (
          <SatelliteBeams
            key={fixture.satId}
            satelliteId={fixture.satId}
            satellitePosition={fixture.satellitePosition}
            beams={[createBeam(fixture, displayOrder)]}
            footprintRadius={42}
            reducedMotion={reducedMotion}
          />
        ))}
        <Suspense fallback={null}>
          {fixtures.map((fixture, displayOrder) => {
            const beam = createBeam(fixture, displayOrder);
            return (
              <SatelliteMarker
                key={`marker-${fixture.satId}`}
                position={new THREE.Vector3(fixture.groundX, 70, -126)}
                label={`S${displayOrder + 1}`}
                eventRole={fixture.codeRole}
                satelliteTintColor={beam.satelliteTintColor}
                constellation="starlink"
              />
            );
          })}
        </Suspense>
      </Canvas>
      <div
        data-testid="vc2-callout-probe"
        style={{
          position: 'absolute',
          left: 12,
          top: 12,
          display: 'flex',
          gap: 8,
          zIndex: 5,
        }}
      >
        {fixtures.map((fixture, displayOrder) => {
          const beam = createBeam(fixture, displayOrder);
          const style = resolveBeamVisualEncoding({
            role: fixture.codeRole,
            isPrimary: true,
            isServing: fixture.isServing,
            isScheduledActive: true,
            frequencyColor: frequencyReuseColor(fixture.frequencyIndex),
          });
          return (
            <BeamCalloutContent
              key={`callout-${fixture.satId}`}
              satelliteId={fixture.satId}
              satelliteGlyph={beam.satelliteGlyph}
              beam={beam}
              style={style}
              color={style.color}
              sinrLabel="18.4 dB"
              isEmphasized={style.isEmphasized}
            />
          );
        })}
      </div>
      <div
        data-testid="vc2-glyph-fallback-probe"
        style={{
          position: 'absolute',
          left: 12,
          bottom: 12,
          display: 'flex',
          gap: 10,
          fontFamily: '"MissingGlyphPrimary", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontFeatureSettings: '"liga" 0',
          textRendering: 'geometricPrecision',
          fontSize: 28,
          color: '#ffffff',
        }}
      >
        {SATELLITE_GLYPH_LIBRARY.map(entry => (
          <span key={entry.kind} data-glyph-kind={entry.kind}>{entry.symbol}</span>
        ))}
      </div>
    </>
  );
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function renderVc2NonTextChannelsFixture(input: {
  reducedMotion?: boolean;
} = {}): Promise<Vc2FixtureResult> {
  const reducedMotion = input.reducedMotion ?? false;
  root?.unmount();
  document.body.innerHTML = '<div id="vc2-root"></div>';
  document.body.style.margin = '0';
  document.body.style.background = '#020912';
  document.body.style.overflow = 'hidden';

  const host = document.getElementById('vc2-root');
  if (!host) throw new Error('vc2-root was not created');
  host.style.width = '1100px';
  host.style.height = '720px';
  host.style.position = 'relative';

  root = createRoot(host);
  flushSync(() => {
    root?.render(<FixtureScene reducedMotion={reducedMotion} />);
  });
  await nextPaint();

  return {
    canvasReady: Boolean(document.querySelector('canvas')),
    beams: fixtures.map((fixture, index) => probeForFixture(fixture, index)),
    inlineGlyphText: [...document.querySelectorAll('[data-testid="beam-callout-satellite-glyph"]')]
      .map(element => element.textContent ?? '')
      .join(''),
    fallbackGlyphText: document.querySelector('[data-testid="vc2-glyph-fallback-probe"]')?.textContent ?? '',
  };
}

export function getVc2RoleTokens() {
  return BEAM_ROLE_TOKENS;
}
