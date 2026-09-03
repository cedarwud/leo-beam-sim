import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Html, Line, OrbitControls, Stars, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

import {
  EarthSphere,
  GLOBAL_SCENE_PALETTES,
} from '../../prototype/visual-lab-g0/VisualLabGlobalScene';
import {
  SAMPLE_TLE,
  TLE_JOURNEY_STATIONS,
} from './tleJourneyStations';
import {
  TLE_FIELDS,
  TLE_LINE_LENGTH,
  deriveTleFacts,
  getTleColumnWalkSubtitle,
  tleChecksum,
  type TleFieldSpec,
} from './tleFields';
import {
  calculateNtpuObserver3D,
  calculateOrbitTrailPoints,
  calculateOrbitTrailEndpointSummary,
  calculateSatelliteOrbitalResult,
  calculateSatelliteState,
  getTeachingPass,
  TEME_POSITION_COMPONENT_DEFINITIONS,
  TLE_COORDINATE_CHAIN_DISCLOSURE,
  TLE_JOURNEY_PASS_SAMPLE_STEP_SEC,
} from './tleJourneyBeats';
import {
  TLE_JOURNEY_DURATION_SEC,
  TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT,
  TLE_JOURNEY_SGP4_CHECKPOINT_HOLD_SEC,
  TLE_JOURNEY_SGP4_SWEEP_DURATION_SEC,
  advanceTleJourneyCourseTime,
  courseTimeToTleJourneyBeat,
  tleJourneyBeatToCourseTime,
  tleJourneySgp4StagedSweepProgress,
} from './tleJourneyClock';
import {
  type TleJourneyHandoverFrame,
} from './tleJourneyHandover';
import { SixActsNav } from '../nav/SixActsNav';
import { isSixActsLightCaptureMode, sixActsHref } from '../nav/lightCapture';
import { SIX_ACTS_ACT3_HREF } from '../nav/sixActsRoutes';
import {
  TeachingAnimationTransport,
  type PlaybackSpeed,
} from '../transport';
import { SATELLITE_MODEL_CATALOG } from '../../viz/satelliteModelCatalog';
import './TleJourneyRoute.scss';

/* -- 3D Orbit Scene Component ---------------------------------------------- */

export const TLE_JOURNEY_SATELLITE_STAGE_SCALE = 0.18;

function ArchivedStarlinkModel({
  stageScale = TLE_JOURNEY_SATELLITE_STAGE_SCALE,
  lightCapture = false,
}: {
  readonly stageScale?: number;
  readonly lightCapture?: boolean;
}): ReactElement {
  const model = SATELLITE_MODEL_CATALOG.starlink;
  const { scene } = useGLTF(model.path);
  const cloned = useMemo(() => {
    const next = SkeletonUtils.clone(scene);
    next.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      const brightMaterials = materials.map(material => {
        const copy = material.clone();
        copy.transparent = false;
        copy.opacity = 1;
        copy.depthWrite = true;
        if (copy instanceof THREE.MeshStandardMaterial) {
          copy.emissive = lightCapture ? new THREE.Color('#000000') : copy.color.clone().multiplyScalar(0.28);
          copy.emissiveIntensity = lightCapture ? 0 : 1.05;
          copy.roughness = lightCapture ? Math.max(copy.roughness, 0.76) : Math.min(copy.roughness, 0.55);
        }
        return copy;
      });
      object.material = Array.isArray(object.material) ? brightMaterials : brightMaterials[0]!;
      object.castShadow = !lightCapture;
      object.receiveShadow = !lightCapture;
    });
    return next;
  }, [lightCapture, scene]);

  return (
    <group rotation={model.rotation} scale={model.scale * stageScale}>
      <primitive object={cloned} position={model.centerOffset} />
    </group>
  );
}

function SatelliteLoadMarker(): ReactElement {
  return (
    <mesh>
      <octahedronGeometry args={[0.1, 0]} />
      <meshBasicMaterial color="#ffd78a" wireframe />
    </mesh>
  );
}

/**
 * Names the three Cartesian values that SGP4 returns for a TEME position.
 * The tuple alone is too easy to mistake for latitude/longitude/altitude, so
 * keep the axis-to-meaning mapping beside the values in both play modes.
 */
function TemePositionDefinition({
  position,
  compact = false,
}: {
  readonly position: { readonly x: number; readonly y: number; readonly z: number };
  readonly compact?: boolean;
}): ReactElement {
  return (
    <div
      className={`tle-journey__teme-position-definition${compact ? ' is-compact' : ''}`}
      data-testid="tle-teme-position-definition"
      aria-label="SGP4 輸出的 TEME 三個位置分量定義"
    >
      <div className="teme-position-definition__heading">
        <strong>三個數字的定義</strong>
        <span>TEME 地心笛卡兒座標 · 單位 km · 非經緯度</span>
      </div>
      <div className="teme-position-definition__axes">
        {TEME_POSITION_COMPONENT_DEFINITIONS.map(definition => (
          <div
            key={definition.axis}
            className="teme-axis-definition"
            data-testid={`tle-teme-axis-${definition.axis}`}
          >
            <span
              className="teme-axis-definition__key"
              aria-label={definition.labelZhHant}
            >
              {definition.axis}
            </span>
            <code className="teme-axis-definition__value tle-journey__key-value">
              {position[definition.axis].toFixed(0)} km
            </code>
            <span className="teme-axis-definition__meaning">{definition.descriptionZhHant}</span>
          </div>
        ))}
      </div>
      <p>三個分量合在一起才是衛星相對地心的位置；不是經緯度。</p>
    </div>
  );
}

/**
 * A deliberately small SGP4 formula guide. It names the one relationship
 * learners need in the scene without pretending to show the full perturbation
 * expansion implemented inside SGP4.
 */
function Sgp4FormulaGuide({ compact = false }: { readonly compact?: boolean }): ReactElement {
  return (
    <aside
      className={`sgp4-formula-guide${compact ? ' is-compact' : ''}`}
      data-testid="tle-sgp4-formula-guide"
      aria-label="SGP4 簡化公式與輸入輸出關係"
    >
      <span className="sgp4-formula-guide__label">SGP4 輸入 → TEME 狀態向量</span>
      <code>
        (TLE, Δt) → SGP4 → (r<sub>TEME</sub>, v<sub>TEME</sub>)
      </code>
      <div className="sgp4-formula-guide__definitions">
        <span><strong>r</strong> 是位置向量；右側的 <strong>(x, y, z)</strong> 是它的三個分量。</span>
        <span><strong>v</strong> 是速度向量；右側以 <strong>|v|</strong> 顯示其速率。</span>
      </div>
    </aside>
  );
}

/** Point the default camera at the Earth before OrbitControls takes ownership. */
function OrbitCameraAim(): null {
  const camera = useThree(state => state.camera);

  useEffect(() => {
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function Orbit3DCanvas({
  offsetMin,
  lightCapture = false,
}: {
  readonly offsetMin: number;
  readonly lightCapture?: boolean;
}): ReactElement {
  const satState = useMemo(
    () => calculateSatelliteState(SAMPLE_TLE.line1, SAMPLE_TLE.line2, offsetMin),
    [offsetMin],
  );
  const observerState = useMemo(
    () => calculateNtpuObserver3D(),
    [],
  );
  const orbitTrail = useMemo(
    () => calculateOrbitTrailPoints(SAMPLE_TLE.line1, SAMPLE_TLE.line2, 96),
    [],
  );
  const orbitSummary = useMemo(
    () => calculateOrbitTrailEndpointSummary(SAMPLE_TLE.line1, SAMPLE_TLE.line2),
    [],
  );
  const orbitStart = orbitTrail[0];
  const orbitEnd = orbitTrail[orbitTrail.length - 1];

  const satPos: [number, number, number] = satState
    ? [satState.position3D[0], satState.position3D[1], satState.position3D[2]]
    : [0, 3, 0];
  // Keep a short highlighted segment in the rendered path that contains the
  // exact SGP4/ECEF position used by the GLB group.  The base trail is sampled
  // for performance; inserting the live point makes the correspondence
  // inspectable at every frame instead of relying on the viewer to infer it
  // from a nearby line segment.
  const orbitProgress = orbitSummary
    ? Math.max(0, Math.min(1, offsetMin / orbitSummary.orbitalPeriodMin))
    : 0;
  const orbitCursorIndex = orbitTrail.length > 1
    ? Math.min(orbitTrail.length - 2, Math.floor(orbitProgress * (orbitTrail.length - 1)))
    : 0;
  const orbitCursorSegment = satState && orbitTrail.length > 1
    ? [
      orbitTrail[orbitCursorIndex]!,
      satPos,
      orbitTrail[Math.min(orbitTrail.length - 1, orbitCursorIndex + 1)]!,
    ] as [number, number, number][]
    : null;
  const ntpuPos: [number, number, number] = [
    observerState.position3D[0],
    observerState.position3D[1],
    observerState.position3D[2],
  ];
  const isVisible = (satState?.elevationDeg ?? -90) >= 10;
  const colours = lightCapture
    ? { track: '#23746f', active: '#956000', station: '#ad264d', below: '#506e77', link: '#8d5c00', modelMarker: '#8d5c00' }
    : { track: '#76ead7', active: '#ffd78a', station: '#ff7d8f', below: '#7aa5ff', link: '#ffd166', modelMarker: '#ffd78a' };

  return (
    <div
      className="tle-journey__canvas-wrap"
      data-satellite-model-path={SATELLITE_MODEL_CATALOG.starlink.path}
      data-satellite-stage-scale={TLE_JOURNEY_SATELLITE_STAGE_SCALE}
      data-satellite-material="opaque-lit"
      data-orbit-start-utc={orbitSummary?.startInstantUtc}
      data-orbit-end-utc={orbitSummary?.endInstantUtc}
      data-orbit-ground-track-km={orbitSummary?.groundTrackDistanceKm.toFixed(1)}
      data-orbit-longitude-shift-deg={orbitSummary?.longitudeShiftDeg.toFixed(2)}
      data-orbit-endpoint-markers="foreground"
      data-orbit-endpoint-path="same-trail"
      data-orbit-motion-source="SGP4-ECEF-shared-position"
      data-orbit-current-offset-min={offsetMin.toFixed(3)}
      data-orbit-current-position={satPos.map(value => value.toFixed(6)).join(',')}
    >
      <Canvas
        camera={{ position: [-4.2, 3.2, -11.8], fov: 36 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={[lightCapture ? '#ffffff' : '#020912']} />
        <OrbitCameraAim />
        <ambientLight intensity={lightCapture ? 1 : 1.35} color={lightCapture ? '#ffffff' : '#e8fbff'} />
        <hemisphereLight args={lightCapture ? ['#ffffff', '#dce8e5', 0.62] : ['#dffaff', '#102b36', 1.1]} />
        <directionalLight position={[8, 12, 6]} intensity={lightCapture ? 1.2 : 2.2} color={lightCapture ? '#ffffff' : '#fff8e8'} />

        <EarthSphere palette={lightCapture ? GLOBAL_SCENE_PALETTES.light : GLOBAL_SCENE_PALETTES.dark} showAtmosphere={!lightCapture} />

        {/* One-period Earth-fixed ground track; Earth rotation separates its endpoints. */}
        <Line
          points={orbitTrail.map(p => [p[0], p[1], p[2]] as [number, number, number])}
          color={colours.track}
          lineWidth={1.5}
          opacity={0.68}
          transparent
          depthTest={false}
          renderOrder={12}
        />

        {/* Colour only the terminal samples so the eye can follow the exact
            line into each endpoint marker. */}
        {orbitTrail.length > 1 ? (
          <>
            <Line
              points={orbitTrail.slice(0, 10).map(p => [p[0], p[1], p[2]] as [number, number, number])}
              color={colours.active}
              lineWidth={3.2}
              opacity={0.95}
              transparent
              depthTest={false}
              renderOrder={16}
            />
            <Line
              points={orbitTrail.slice(-10).map(p => [p[0], p[1], p[2]] as [number, number, number])}
              color={colours.track}
              lineWidth={3.2}
              opacity={0.95}
              transparent
              depthTest={false}
              renderOrder={16}
            />
            {orbitCursorSegment ? (
              <Line
                points={orbitCursorSegment}
                color={colours.active}
                lineWidth={4.6}
                opacity={1}
                transparent
                depthTest={false}
                renderOrder={18}
              />
            ) : null}
          </>
        ) : null}

        {orbitStart ? (
          <>
            <mesh name="orbit-ground-track-start" position={orbitStart} renderOrder={20}>
              <sphereGeometry args={[0.09, 18, 14]} />
              <meshBasicMaterial color={colours.active} transparent opacity={0.72} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh name="orbit-ground-track-start-halo" position={orbitStart} renderOrder={19}>
              <sphereGeometry args={[0.18, 18, 14]} />
              <meshBasicMaterial color={colours.active} transparent opacity={0.22} depthTest={false} depthWrite={false} />
            </mesh>
            <Html center position={orbitStart} distanceFactor={7} zIndexRange={[50, 0]}>
              <span className="tle-journey__orbit-endpoint-label is-start" data-testid="tle-orbit-start-label">起點 · t₀</span>
            </Html>
          </>
        ) : null}
        {orbitEnd ? (
          <>
            <mesh name="orbit-ground-track-end" position={orbitEnd} renderOrder={20}>
              <sphereGeometry args={[0.09, 18, 14]} />
              <meshBasicMaterial color={colours.track} transparent opacity={0.72} depthTest={false} depthWrite={false} />
            </mesh>
            <mesh name="orbit-ground-track-end-halo" position={orbitEnd} renderOrder={19}>
              <sphereGeometry args={[0.18, 18, 14]} />
              <meshBasicMaterial color={colours.track} transparent opacity={0.22} depthTest={false} depthWrite={false} />
            </mesh>
            <Html center position={orbitEnd} distanceFactor={7} zIndexRange={[50, 0]}>
              <span className="tle-journey__orbit-endpoint-label is-end" data-testid="tle-orbit-end-label">終點 · t₀ + T</span>
            </Html>
          </>
        ) : null}

        {/* Archived Starlink GLB at the SGP4-derived position. */}
        {satState ? (
          <group position={satPos}>
            <Suspense fallback={<SatelliteLoadMarker />}>
              <ArchivedStarlinkModel lightCapture={lightCapture} />
            </Suspense>
            <mesh>
              <sphereGeometry args={[0.18, 16, 16]} />
              <meshBasicMaterial color={colours.modelMarker} transparent opacity={0.08} depthWrite={false} />
            </mesh>
            <mesh name="orbit-current-position-marker" renderOrder={24}>
              <sphereGeometry args={[0.075, 16, 12]} />
              <meshBasicMaterial color={colours.modelMarker} depthTest={false} depthWrite={false} />
            </mesh>
            {lightCapture ? null : <pointLight color="#fff0bd" intensity={2.6} distance={2.2} decay={2} />}
          </group>
        ) : null}

        {/* NTPU Ground Station Marker */}
        <group position={ntpuPos}>
          <mesh>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshBasicMaterial color={colours.station} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshBasicMaterial color={colours.station} transparent opacity={0.3} />
          </mesh>
        </group>

        {/* Line of Sight Link (Hex colors only to avoid Three.js rgba warnings) */}
        {satState ? (
          <Line
            points={[ntpuPos, satPos]}
            color={isVisible ? colours.link : colours.below}
            lineWidth={isVisible ? 2 : 1}
            dashed={!isVisible}
            dashSize={0.1}
            gapSize={0.08}
            transparent
            opacity={isVisible ? 0.9 : 0.25}
          />
        ) : null}

        <OrbitControls
          makeDefault
          target={[0, 0, 0]}
          enableDamping
          dampingFactor={0.08}
          minDistance={5}
          maxDistance={22}
          rotateSpeed={0.6}
        />
      </Canvas>

      {satState ? (
        <div className="tle-journey__canvas-hud" aria-hidden="true">
          <div className="tle-journey__hud-badge">
            <span className="tle-journey__hud-dot" />
            <strong className="tle-journey__key-value">{SAMPLE_TLE.name}</strong>
            <small>高度 <span className="tle-journey__key-value">{Math.round(satState.altitudeKm)} km</span> · 速率 <span className="tle-journey__key-value">{satState.speedKmPerSec.toFixed(2)} km/s</span></small>
          </div>
          <div className={`tle-journey__hud-link ${isVisible ? 'is-visible' : 'is-below'}`}>
              <span>NTPU 仰角：{satState.elevationDeg.toFixed(1)}° · {isVisible ? '符合 10° 幾何門檻' : '低於 10° 幾何門檻'}</span>
          </div>
        </div>
      ) : null}

      {orbitSummary ? (
        <div className="tle-journey__orbit-window-readout" data-testid="tle-orbit-window-readout">
          <div className="orbit-readout-head">
            <span>一圈後，地面位置為何不同？</span>
            <strong className="tle-journey__key-value">{orbitSummary.orbitalPeriodMin.toFixed(1)} min</strong>
          </div>
          <div className="orbit-readout-grid">
            <div>
              <span>ECEF 起點 km</span>
              <strong className="tle-journey__key-value">
                ({orbitSummary.startEcefKm.x.toFixed(1)}, {orbitSummary.startEcefKm.y.toFixed(1)}, {orbitSummary.startEcefKm.z.toFixed(1)})
              </strong>
            </div>
            <div>
              <span>ECEF 終點 km</span>
              <strong className="tle-journey__key-value">
                ({orbitSummary.endEcefKm.x.toFixed(1)}, {orbitSummary.endEcefKm.y.toFixed(1)}, {orbitSummary.endEcefKm.z.toFixed(1)})
              </strong>
            </div>
            <div>
              <span>地表弧長</span>
              <strong className="tle-journey__key-value">{orbitSummary.groundTrackDistanceKm.toFixed(1)} km</strong>
            </div>
            <div>
              <span>起點到終點的經度差</span>
              <strong className="tle-journey__key-value">向西 {Math.abs(orbitSummary.longitudeShiftDeg).toFixed(2)}°</strong>
            </div>
          </div>
          <p>這條線連接起點 t₀ 與終點 t₀ + T。T = 92.2 分鐘內，衛星在慣性空間繞行一圈，但 ECEF 是跟著地球轉的座標；地球自轉使終點地面投影向西 23.30°，所以不會落在起點。</p>
        </div>
      ) : null}

      {/* Accessible live text for screen readers */}
      <div className="sr-only" aria-live="off">
        {satState
          ? `${SAMPLE_TLE.name} 軌道高度 ${Math.round(satState.altitudeKm)} 公里，速率 ${satState.speedKmPerSec.toFixed(2)} 公里/秒，NTPU 仰角 ${satState.elevationDeg.toFixed(1)} 度。`
          : '衛星狀態推算中'}
      </div>
    </div>
  );
}

useGLTF.preload(SATELLITE_MODEL_CATALOG.starlink.path);

/* -- Beat 1: Raw Lines ----------------------------------------------------- */

function RawLinesStage(): ReactElement {
  return (
    <div className="tle-journey__beat tle-journey__beat--raw">
      <div className="tle-journey__raw-console">
        <div className="tle-journey__console-header">
          <div className="tle-journey__console-dots">
            <span className="dot dot-red" />
            <span className="dot dot-yellow" />
            <span className="dot dot-green" />
          </div>
          <span className="tle-journey__console-title">封存 TLE · {SAMPLE_TLE.name}</span>
          <span className="tle-journey__console-meta">每行 69 字元 · 包含空白</span>
        </div>

        <div className="tle-journey__console-body">
          <div className="tle-journey__scanline" aria-hidden="true" />
          <div className="tle-journey__code-line is-name">
            <span className="line-num">0</span>
            <code className="tle-journey__key-value">{SAMPLE_TLE.name}</code>
          </div>
          <div className="tle-journey__code-line is-line1">
            <span className="line-num">1</span>
            <code className="tle-journey__key-value">{SAMPLE_TLE.line1}</code>
          </div>
          <div className="tle-journey__code-line is-line2">
            <span className="line-num">2</span>
            <code className="tle-journey__key-value">{SAMPLE_TLE.line2}</code>
          </div>
        </div>

        <div className="tle-journey__console-footer">
          <div className="tle-journey__badge-row">
            <span className="tle-journey__tag is-source">SOURCE · 封存快照</span>
            <span className="tle-journey__tag is-meta">衛星編號 {SAMPLE_TLE.catalogId}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -- Beat 2: Field Decoding Scanner ---------------------------------------- */

const SCANNER_KEY_FIELDS: readonly string[] = [
  'l1-epoch',
  'l1-checksum',
  'l2-inclination',
  'l2-meanmotion',
  'l2-checksum',
];

function scannerFieldForProgress(progress: number): string {
  const safeProgress = Math.max(0, Math.min(1, progress));
  const fieldIndex = Math.min(
    SCANNER_KEY_FIELDS.length - 1,
    Math.floor(safeProgress * SCANNER_KEY_FIELDS.length),
  );
  return SCANNER_KEY_FIELDS[fieldIndex] ?? SCANNER_KEY_FIELDS[0]!;
}

function FieldScannerStage({
  activeKeyFieldId,
  onSelectKeyField,
  facts,
  isPlaying,
}: {
  readonly activeKeyFieldId: string;
  readonly onSelectKeyField: (id: string) => void;
  readonly facts: ReturnType<typeof deriveTleFacts>;
  readonly isPlaying: boolean;
}): ReactElement {
  const stepperRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const activeSpec = useMemo(
    () => TLE_FIELDS.find(f => f.id === activeKeyFieldId) ?? TLE_FIELDS.find(f => f.id === 'l2-meanmotion')!,
    [activeKeyFieldId],
  );

  const moveScannerField = useCallback((currentIndex: number, direction: -1 | 1 | 'first' | 'last') => {
    const nextIndex = direction === 'first'
      ? 0
      : direction === 'last'
        ? SCANNER_KEY_FIELDS.length - 1
        : (currentIndex + direction + SCANNER_KEY_FIELDS.length) % SCANNER_KEY_FIELDS.length;
    const nextFieldId = SCANNER_KEY_FIELDS[nextIndex];
    if (!nextFieldId) return;
    onSelectKeyField(nextFieldId);
    requestAnimationFrame(() => stepperRefs.current[nextIndex]?.focus());
  }, [onSelectKeyField]);

  const activeRawLine = activeSpec.line === 1 ? SAMPLE_TLE.line1 : SAMPLE_TLE.line2;
  const activeRawValue = activeRawLine.slice(activeSpec.startColumn - 1, activeSpec.endColumn);

  // Split line for visual highlighter scanner
  const beforeText = activeRawLine.slice(0, activeSpec.startColumn - 1);
  const highlightedText = activeRawValue;
  const afterText = activeRawLine.slice(activeSpec.endColumn);

  const compactMeaning = useMemo(() => {
    switch (activeSpec.id) {
      case 'l1-epoch':
        return `基準時刻 ${facts.epochUtc.slice(0, 10)} ${facts.epochUtc.slice(11, 19)} UTC（年日序 ${facts.epochDayOfYear.toFixed(2)}）`;
      case 'l1-checksum':
        return `行 1 模 10 檢核碼（${activeRawValue}）· 前 68 欄總和驗證通過`;
      case 'l2-inclination':
        return `軌道傾角 ${facts.inclinationDeg.toFixed(2)}° · 地面軌跡緯度上限約 ±${facts.inclinationDeg.toFixed(2)}°`;
      case 'l2-meanmotion':
        return `平均運動 ${facts.meanMotionRevPerDay.toFixed(4)} 圈/天 → 週期約 ${facts.orbitalPeriodMin.toFixed(1)} 分鐘`;
      case 'l2-checksum':
        return `行 2 模 10 檢核碼（${activeRawValue}）· 前 68 欄總和驗證通過`;
      default:
        return activeSpec.explainZhHant;
    }
  }, [activeSpec, activeRawValue, facts]);

  return (
    <div className={`tle-journey__beat tle-journey__beat--scanner ${isPlaying ? 'is-autoplay-mode' : ''}`}>
      <div className="tle-journey__scanner-console" id="tle-scanner-content">
        <div className="scanner-line-header">
          <span className="scanner-tag">第 {activeSpec.line} 行欄位掃描</span>
          <span className="scanner-col-range">第 {activeSpec.startColumn}–{activeSpec.endColumn} 欄</span>
        </div>

        <div className="scanner-line-display">
          <span className="scanner-prefix"><code>{beforeText}</code></span>
          <mark className="scanner-highlight" aria-label={`正在聚焦欄位：${activeSpec.labelZhHant}`}>
            <code className="tle-journey__key-value">{highlightedText}</code>
            <span className="scanner-focus-beacon" aria-hidden="true" />
          </mark>
          <span className="scanner-suffix"><code>{afterText}</code></span>
        </div>

        {isPlaying ? (
          <div className="scanner-compact-hud">
            <span className="compact-hud-badge">L{activeSpec.line} 欄 {activeSpec.startColumn}–{activeSpec.endColumn}</span>
            <strong className="compact-hud-name">{activeSpec.labelZhHant}</strong>
            <code className="compact-hud-val tle-journey__key-value">{activeRawValue}</code>
            <span className="compact-hud-meaning">{compactMeaning}</span>
          </div>
        ) : (
          <div className="scanner-stepper-row" role="tablist" aria-label="核心欄位切換">
            {SCANNER_KEY_FIELDS.map((fieldId, index) => {
              const field = TLE_FIELDS.find(f => f.id === fieldId);
              if (!field) return null;
              const active = field.id === activeKeyFieldId;
              return (
                <button
                  key={field.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls="tle-scanner-content"
                  tabIndex={active ? 0 : -1}
                  className={`scanner-step-pill ${active ? 'is-active' : ''}`}
                  ref={element => { stepperRefs.current[index] = element; }}
                  onClick={() => onSelectKeyField(field.id)}
                  onKeyDown={event => {
                    if (event.key === 'ArrowRight') {
                      event.stopPropagation();
                      event.preventDefault();
                      moveScannerField(index, 1);
                    } else if (event.key === 'ArrowLeft') {
                      event.stopPropagation();
                      event.preventDefault();
                      moveScannerField(index, -1);
                    } else if (event.key === 'Home') {
                      event.stopPropagation();
                      event.preventDefault();
                      moveScannerField(index, 'first');
                    } else if (event.key === 'End') {
                      event.stopPropagation();
                      event.preventDefault();
                      moveScannerField(index, 'last');
                    }
                  }}
                >
                  <span className="step-line">L{field.line}</span>
                  <span className="step-label">{field.labelZhHant}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="sr-only" aria-live="polite" aria-atomic="true">
        第 2 幕欄位掃描：{activeSpec.labelZhHant}，目前值 {activeRawValue}。
        {compactMeaning}
      </div>

      {!isPlaying ? (
        <div className="tle-journey__scanner-card">
          <div className="scanner-card-head">
            <div>
              <span className="card-kicker">已解讀物理量</span>
              <h3>{activeSpec.labelZhHant}</h3>
            </div>
            <div className="card-val-badge">
              <small>原始值</small>
              <code className="tle-journey__key-value">{activeRawValue}</code>
            </div>
          </div>

          <p className="scanner-card-explain">{activeSpec.explainZhHant}</p>

          {activeSpec.id === 'l2-meanmotion' ? (
            <div className="scanner-derivation-callout">
              <span className="derivation-label">軌道週期衍生運算：</span>
              <strong>1440 ÷ {facts.meanMotionRevPerDay.toFixed(4)} = {facts.orbitalPeriodMin.toFixed(1)} 分鐘/圈</strong>
              <small>（約 1 小時 32 分鐘繞行地球一圈）</small>
            </div>
          ) : null}

          {activeSpec.id === 'l2-inclination' ? (
            <div className="scanner-derivation-callout">
              <span className="derivation-label">軌道幾何特徵：</span>
              <strong>傾角 {facts.inclinationDeg.toFixed(2)}°</strong>
              <small>（地面軌跡緯度上限約 ±{facts.inclinationDeg.toFixed(2)}°，不跨越南北極）</small>
            </div>
          ) : null}

          {activeSpec.id.endsWith('checksum') ? (
            <div className="scanner-derivation-callout is-checksum">
              <span className="derivation-label">模 10 檢核防線：</span>
              <strong>前 68 欄位字元總和 mod 10 = {activeRawValue}（檢核通過）</strong>
              <small>（任一數字更動皆會導致檢核失敗並停止載入）</small>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* -- Beat 3: SGP4 Transformation Flow -------------------------------------- */

function Sgp4TransformationStage({
  offsetMin,
  onChangeOffset,
  facts,
  isPlaying,
  autoplayCheckpointIndex,
}: {
  readonly offsetMin: number;
  readonly onChangeOffset: (offset: number) => void;
  readonly facts: ReturnType<typeof deriveTleFacts>;
  readonly isPlaying: boolean;
  readonly autoplayCheckpointIndex: number;
}): ReactElement {
  const satState = useMemo(
    () => calculateSatelliteState(SAMPLE_TLE.line1, SAMPLE_TLE.line2, offsetMin),
    [offsetMin],
  );
  const timeCompressionFactor = Math.round(
    (facts.orbitalPeriodMin * 60) / TLE_JOURNEY_SGP4_SWEEP_DURATION_SEC,
  );

  return (
    <div className={`tle-journey__beat tle-journey__beat--sgp4 ${isPlaying ? 'is-autoplay-mode' : ''}`}>
      {isPlaying ? (
        <>
          <aside
            className="tle-journey__sgp4-time-lapse"
            data-testid="tle-sgp4-time-lapse"
            data-time-compression-factor={String(timeCompressionFactor)}
            data-checkpoint-index={String(autoplayCheckpointIndex)}
          >
            <strong>時間壓縮示範 · 約 {timeCompressionFactor}×</strong>
            <span>
            {facts.orbitalPeriodMin.toFixed(1)} 分鐘軌道濃縮為 {TLE_JOURNEY_SGP4_SWEEP_DURATION_SEC} 秒；
              {TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT} 個代表時刻各停留約 {TLE_JOURNEY_SGP4_CHECKPOINT_HOLD_SEC.toFixed(1)} 秒，非即時速度。
            </span>
            <em>時刻 {autoplayCheckpointIndex + 1}/{TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT}</em>
          </aside>
          <div className="tle-journey__engine-flow is-scene-space">
          {/* Left Input Tokens in Scene Space */}
          <div className="flow-open-cluster is-left">
            <div className="flow-token is-input">
              <span className="token-tag">INPUT · 軌道根數</span>
              <code className="token-code tle-journey__key-value">i={facts.inclinationDeg.toFixed(1)}°, n={facts.meanMotionRevPerDay.toFixed(2)} rev/day</code>
            </div>
            <div className="flow-token is-input is-offset">
              <span className="token-tag">推算時刻 Δt</span>
              <strong className="token-val tle-journey__key-value">+{offsetMin.toFixed(0)} min</strong>
            </div>
            <Sgp4FormulaGuide compact />
          </div>

          {/* Central SGP4 Transformation Reactor */}
          <div className="flow-transformer">
            <div className="transformer-core">
              <div className="pulse-ring" aria-hidden="true" />
              <strong className="core-title">SGP4</strong>
              <span className="core-desc">簡化廣義攝動模型</span>
              <small className="core-frame">產出 TEME 慣性座標</small>
            </div>
            <div className="flow-arrow" aria-hidden="true">
              <svg width="40" height="24" viewBox="0 0 40 24">
                <path d="M0,12 L32,12 M24,4 L32,12 L24,20" stroke="#76ead7" strokeWidth="2.5" fill="none" />
              </svg>
            </div>
          </div>

          {/* Right Output Tokens in Scene Space */}
          <div className="flow-open-cluster is-right">
            {satState ? (
              <>
                <div className="flow-token is-output">
                  <span className="token-tag is-gold">OUTPUT · TEME 空間位置</span>
                  <code className="token-code tle-journey__key-value">
                    ({satState.positionTemeKm.x.toFixed(0)}, {satState.positionTemeKm.y.toFixed(0)}, {satState.positionTemeKm.z.toFixed(0)}) km
                  </code>
                  <TemePositionDefinition position={satState.positionTemeKm} compact />
                </div>
                <div className="flow-token is-output is-telemetry">
                  <span className="token-tag is-gold">軌道幾何推算</span>
                  <strong className="token-val tle-journey__key-value">
                    高度 {Math.round(satState.altitudeKm)} km · 速率 {satState.speedKmPerSec.toFixed(2)} km/s
                  </strong>
                </div>
              </>
            ) : (
              <p className="flow-error">狀態推算中</p>
            )}
          </div>
          </div>
        </>
      ) : (
        <>
          <div className="tle-journey__engine-flow">
            {/* Concise Input Token */}
            <div className="flow-left-stack">
              <div className="flow-card flow-in">
              <div className="flow-card-head">
                <span className="card-tag">INPUT</span>
                <h3>輸入參數</h3>
              </div>
              <div className="flow-card-body">
                <div className="flow-param">
                  <span className="param-label">TLE 軌道根數</span>
                  <code>i={facts.inclinationDeg.toFixed(1)}°, n={facts.meanMotionRevPerDay.toFixed(2)} 圈/天</code>
                </div>
                <div className="flow-param">
                  <span className="param-label">
                    目標推算時刻：Δt = t − t<sub>epoch</sub>
                  </span>
                    <strong className="param-active tle-journey__key-value">+{offsetMin.toFixed(0)} 分鐘</strong>
                </div>
              </div>
              </div>
              <Sgp4FormulaGuide />
            </div>

            {/* Central SGP4 Transformation Reactor */}
            <div className="flow-transformer">
              <div className="transformer-core">
                <div className="pulse-ring" aria-hidden="true" />
                <strong className="core-title">SGP4</strong>
                <span className="core-desc">簡化廣義攝動模型</span>
                <small className="core-frame">產出 TEME 慣性座標</small>
              </div>
              <div className="flow-arrow" aria-hidden="true">
                <svg width="40" height="24" viewBox="0 0 40 24">
                  <path d="M0,12 L32,12 M24,4 L32,12 L24,20" stroke="#76ead7" strokeWidth="2.5" fill="none" />
                </svg>
              </div>
            </div>

            {/* Concise Output Token */}
            <div className="flow-card flow-out">
              <div className="flow-card-head">
                <span className="card-tag is-gold">OUTPUT</span>
                <h3>TEME 狀態向量（r、v）</h3>
              </div>
              <div className="flow-card-body">
                {satState ? (
                  <>
                    <div className="flow-output-row">
                      <span className="row-name">位置向量 r = (x, y, z) km</span>
                    <code className="row-val tle-journey__key-value">
                        ({satState.positionTemeKm.x.toFixed(0)}, {satState.positionTemeKm.y.toFixed(0)}, {satState.positionTemeKm.z.toFixed(0)})
                      </code>
                    </div>
                    <TemePositionDefinition position={satState.positionTemeKm} />
                    <div className="flow-output-grid">
                      <div>
                        <span className="row-name">軌道高度</span>
                        <strong className="tle-journey__key-value">{Math.round(satState.altitudeKm)} <small>km</small></strong>
                      </div>
                      <div>
                        <span className="row-name">速率 |v|</span>
                        <strong className="tle-journey__key-value">{satState.speedKmPerSec.toFixed(2)} <small>km/s</small></strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="flow-error">無法推算該時刻狀態向量</p>
                )}
              </div>
            </div>
            </div>

          <div className="tle-journey__engine-controls">
            <div className="time-slider-wrap">
              <div className="slider-label-row">
                <span>從 Epoch 推進時間：<strong>+{offsetMin.toFixed(0)} 分鐘</strong></span>
                <small>週期 {facts.orbitalPeriodMin.toFixed(0)} 分鐘</small>
              </div>
              <input
                type="range"
                min={0}
                max={Math.round(facts.orbitalPeriodMin)}
                step={1}
                value={offsetMin}
                aria-label="調整從 epoch 起算的分鐘數"
                onChange={e => onChangeOffset(Number(e.target.value))}
              />
            </div>
            <p className="engine-hint">
              自動播放以四個代表時刻呈現；暫停後可拖曳 Δt 逐分鐘核對。SGP4 是模型推算，非即時實測遙測。
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* -- Beat 5: Observer Pass & Sky Dome -------------------------------------- */

interface PassPlotPoint {
  readonly x: number;
  readonly y: number;
}

/** Catmull-Rom-to-cubic path that passes through every SGP4 sample. */
function smoothPassPath(points: readonly PassPlotPoint[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0]!.x.toFixed(1)},${points[0]!.y.toFixed(1)}`;

  let path = `M${points[0]!.x.toFixed(1)},${points[0]!.y.toFixed(1)}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[Math.max(0, index - 1)]!;
    const current = points[index]!;
    const next = points[index + 1]!;
    const following = points[Math.min(points.length - 1, index + 2)]!;
    const control1 = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const control2 = {
      x: next.x - (following.x - current.x) / 6,
      y: next.y - (following.y - current.y) / 6,
    };
    path += ` C${control1.x.toFixed(1)},${control1.y.toFixed(1)} ${control2.x.toFixed(1)},${control2.y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }
  return path;
}

function ObserverPassStage({
  cursorMs,
  onCursorChange,
  showFinalActions,
  onReplay,
}: {
  readonly cursorMs: number | null;
  readonly onCursorChange: (instantMs: number) => void;
  readonly showFinalActions: boolean;
  readonly onReplay: () => void;
  }): ReactElement {
  const pass = useMemo(() => getTeachingPass(), []);

  if (!pass) {
    return <div className="tle-journey__beat"><p>無可用的通過事件資料</p></div>;
  }

  const cursor = cursorMs ?? pass.peakMs;
  const currentSample = pass.samples.reduce(
    (best, sample) =>
      Math.abs(sample.instantMs - cursor) < Math.abs(best.instantMs - cursor) ? sample : best,
    pass.samples[0]!,
  );

  const width = 680;
  const height = 360;
  const plot = Object.freeze({ left: 72, right: 18, top: 24, bottom: 66 });
  const plotWidth = width - plot.left - plot.right;
  const plotHeight = height - plot.top - plot.bottom;
  const plotBottom = height - plot.bottom;
  const plotRight = width - plot.right;
  const maxElev = 90;
  const x = (t: number) => plot.left + ((t - pass.riseMs) / (pass.setMs - pass.riseMs)) * plotWidth;
  const y = (elev: number) => plot.top + (1 - elev / maxElev) * plotHeight;
  const xTicks = [0, 0.5, 1].map(ratio => Object.freeze({
    ratio,
    instantMs: pass.riseMs + ratio * (pass.setMs - pass.riseMs),
    elapsedMin: ratio * pass.durationSec / 60,
  }));
  const yTicks = [0, 10, 30, 60, 90] as const;

  const passPlotPoints = pass.samples.map(sample => ({
    x: x(sample.instantMs),
    y: y(sample.elevationDeg),
  }));
  const path = smoothPassPath(passPlotPoints);

  // Polar radar mapping for topocentric dome:
  // Center (110, 110), radius 90. Elevation 90 -> r=0, Elevation 0 -> r=90.
  const radarRadius = 88;
  const radarCenter = 110;
  const sampleAzRad = (currentSample.azimuthDeg - 90) * (Math.PI / 180);
  const sampleElevRatio = 1 - currentSample.elevationDeg / 90;
  const satRadarX = radarCenter + radarRadius * sampleElevRatio * Math.cos(sampleAzRad);
  const satRadarY = radarCenter + radarRadius * sampleElevRatio * Math.sin(sampleAzRad);

  return (
    <div
      className="tle-journey__beat tle-journey__beat--pass"
      data-pass-satellite-id={SAMPLE_TLE.catalogId}
      data-pass-source-path={SAMPLE_TLE.sourcePath}
      data-pass-propagation-model="SGP4"
      data-pass-observer="NTPU_WGS84"
      data-pass-minimum-elevation-deg={pass.minimumElevationDeg}
      data-pass-sample-step-sec={TLE_JOURNEY_PASS_SAMPLE_STEP_SEC}
      data-pass-duration-sec={pass.durationSec}
      data-pass-rise-utc={new Date(pass.riseMs).toISOString()}
      data-pass-set-utc={new Date(pass.setMs).toISOString()}
    >
      <div className="tle-journey__pass-duo">
        {/* Pass Elevation Mountain Curve */}
        <div className="pass-panel">
          <div className="pass-panel-head">
            <h3>NTPU 地面仰角歷程</h3>
            <span className="pass-duration">仰角 ≥ 10° · <strong className="tle-journey__key-value">{(pass.durationSec / 60).toFixed(1)} 分鐘</strong></span>
          </div>

          <p className="pass-model-note" data-testid="tle-pass-model-note">
            STARLINK-1008 · <span className="pass-model-date">2026-08-24 </span>封存 TLE · SGP4<span className="pass-model-detail">＋NTPU WGS84</span> · 每 5 秒取樣；6.2 分鐘僅指這一次模型通過。
          </p>

          <div className="pass-svg-wrap">
            <svg viewBox={`0 0 ${width} ${height}`} className="pass-svg" role="img" aria-label="仰角對時間通過曲線">
              <defs>
                <linearGradient id="passGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#76ead7" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#76ead7" stopOpacity="0.02" />
                </linearGradient>
              </defs>

              {/* Explicit axes and ticks: the 10 degree line is a threshold,
                  not a substitute for the Y axis. */}
              <line x1={plot.left} y1={plot.top} x2={plot.left} y2={plotBottom} className="pass-axis" />
              <line x1={plot.left} y1={plotBottom} x2={plotRight} y2={plotBottom} className="pass-axis" />
              {yTicks.map(value => (
                <g key={value}>
                  <line
                    x1={plot.left}
                    y1={y(value)}
                    x2={plotRight}
                    y2={y(value)}
                    className={`grid-line${value === 10 ? ' is-threshold' : ''}`}
                  />
                  <line x1={plot.left - 5} y1={y(value)} x2={plot.left} y2={y(value)} className="pass-axis-tick" />
                  <text x={plot.left - 10} y={y(value) + 5} textAnchor="end" className="pass-axis-tick-label">{value}°</text>
                </g>
              ))}
              {xTicks.map(tick => (
                <g key={tick.ratio}>
                  <line x1={x(tick.instantMs)} y1={plotBottom} x2={x(tick.instantMs)} y2={plotBottom + 5} className="pass-axis-tick" />
                  <text x={x(tick.instantMs)} y={plotBottom + 22} textAnchor="middle" className="pass-axis-tick-label">
                    +{tick.elapsedMin.toFixed(1)}
                  </text>
                </g>
              ))}
              <text x={plot.left + 8} y={y(10) - 7} className="grid-label is-threshold-label">10° 幾何仰角門檻</text>
              <text x={plotRight - 8} y={y(90) + 18} textAnchor="end" className="grid-label">90° 天頂（Zenith）</text>
              <text x={width / 2} y={height - 11} textAnchor="middle" className="pass-axis-label">
                X｜相對通過時間 Δt（分鐘；UTC 基準 {new Date(pass.riseMs).toISOString().slice(11, 19)}Z）
              </text>
              <text
                x="18"
                y={plot.top + plotHeight / 2}
                textAnchor="middle"
                className="pass-axis-label"
                transform={`rotate(-90 18 ${plot.top + plotHeight / 2})`}
              >
                Y｜地面仰角 α（°）
              </text>

              {/* Filled Area & Line */}
              <path d={`${path} L${plotRight},${plotBottom} L${plot.left},${plotBottom} Z`} fill="url(#passGradient)" />
              <path d={path} className="curve-line" data-testid="tle-pass-smooth-curve" data-interpolation="sample-through-cubic" />

              {/* Peak Marker */}
              <circle cx={x(pass.peakMs)} cy={y(pass.peakElevationDeg)} r="5.5" className="peak-dot" />

              {/* Active Cursor Line & Dot */}
              <line
                x1={x(currentSample.instantMs)}
                x2={x(currentSample.instantMs)}
                y1={plot.top}
                y2={plotBottom}
                className="cursor-line"
              />
              <circle
                cx={x(currentSample.instantMs)}
                cy={y(currentSample.elevationDeg)}
                r="6"
                className="cursor-dot"
              />
            </svg>
          </div>

          <input
            type="range"
            min={pass.riseMs}
            max={pass.setMs}
            step={15_000}
            value={cursor}
            aria-label="拖曳通過時刻"
            onChange={e => onCursorChange(Number(e.target.value))}
            className="pass-scrubber"
          />

          <div className="pass-timestamps">
            <span className="pass-rise-instant" aria-label={`升起 ${new Date(pass.riseMs).toISOString().slice(11, 19)}Z`}><span className="pass-time-label">升起 </span>{new Date(pass.riseMs).toISOString().slice(11, 19)}Z</span>
            <span className="is-peak">最高 <strong className="tle-journey__key-value">{pass.peakElevationDeg.toFixed(1)}°</strong><span className="pass-peak-instant">（{new Date(pass.peakMs).toISOString().slice(11, 19)}Z）</span></span>
            <span className="pass-set-instant" aria-label={`落下 ${new Date(pass.setMs).toISOString().slice(11, 19)}Z`}><span className="pass-time-label">落下 </span>{new Date(pass.setMs).toISOString().slice(11, 19)}Z</span>
          </div>
        </div>

        {/* Polar Sky Radar Dome */}
        <div className="pass-panel is-radar" data-testid="tle-pass-radar-panel">
          <div className="pass-panel-head">
            <h3>天空雷達視圖（Sky Dome）</h3>
            <span className="pass-status">
              {currentSample.elevationDeg >= 10 ? '● 幾何可見（非通訊判定）' : '○ 低於 10° 幾何門檻'}
            </span>
          </div>

          <div className="radar-view">
            <svg viewBox="0 0 220 220" className="radar-svg" role="img" aria-label="天空仰角方位角雷達圖">
              <circle cx={radarCenter} cy={radarCenter} r={radarRadius} className="radar-ring" />
              <circle cx={radarCenter} cy={radarCenter} r={radarRadius * (1 - 10 / 90)} className="radar-ring is-thresh" />
              <circle cx={radarCenter} cy={radarCenter} r={radarRadius * (1 - 45 / 90)} className="radar-ring is-inner" />
              <circle cx={radarCenter} cy={radarCenter} r="2.5" className="radar-zenith" />

              <line x1={radarCenter} y1={radarCenter - radarRadius} x2={radarCenter} y2={radarCenter + radarRadius} className="radar-axis" />
              <line x1={radarCenter - radarRadius} y1={radarCenter} x2={radarCenter + radarRadius} y2={radarCenter} className="radar-axis" />

              <text x={radarCenter} y="16" className="radar-label" textAnchor="middle">N</text>
              <text x="210" y={radarCenter + 4} className="radar-label" textAnchor="middle">E</text>
              <text x={radarCenter} y="216" className="radar-label" textAnchor="middle">S</text>
              <text x="10" y={radarCenter + 4} className="radar-label" textAnchor="middle">W</text>

              <circle cx={satRadarX} cy={satRadarY} r="7" className="radar-sat-dot" />
              <circle cx={satRadarX} cy={satRadarY} r="14" className="radar-sat-halo" />
            </svg>

            <div className="radar-telemetry">
              <div><dt>此刻仰角</dt><dd className="tle-journey__key-value">{currentSample.elevationDeg.toFixed(1)}°</dd></div>
              <div><dt>方位角</dt><dd className="tle-journey__key-value">{currentSample.azimuthDeg.toFixed(0)}°</dd></div>
              <div><dt>斜距</dt><dd className="tle-journey__key-value">{Math.round(currentSample.rangeKm).toLocaleString()} km</dd></div>
            </div>
          </div>
        </div>
      </div>
      {showFinalActions ? (
        <div className="tle-journey__pass-final-actions" data-testid="tle-journey-pass-finale">
          <button type="button" data-testid="tle-journey-replay" onClick={onReplay}>重新播放</button>
          <a href={SIX_ACTS_ACT3_HREF} data-testid="tle-journey-next">下一幕：離軸角</a>
        </div>
      ) : null}
    </div>
  );
}

/* -- Archived handover donor (not part of the Act 2 teaching sequence) ----- */

const TLE_HANDOVER_SCENE_WINDOW_SEC = 180;
const TLE_HANDOVER_SCENE_SAMPLE_STEP_SEC = 1;
const TLE_HANDOVER_SATELLITE_STAGE_SCALE = 0.5;

interface HandoverSkySample {
  readonly instantMs: number;
  readonly elevationDeg: number;
  readonly position: readonly [number, number, number];
}

function topocentricSkyPosition(
  azimuthDeg: number,
  elevationDeg: number,
): readonly [number, number, number] {
  const azimuthRad = THREE.MathUtils.degToRad(azimuthDeg);
  const elevationRad = THREE.MathUtils.degToRad(elevationDeg);
  const radius = 5.3;
  const horizontal = Math.cos(elevationRad) * radius;
  return Object.freeze([
    Math.sin(azimuthRad) * horizontal,
    0.18 + Math.sin(elevationRad) * radius,
    -Math.cos(azimuthRad) * horizontal,
  ] as const);
}

function buildHandoverSkyTrajectory(
  line1: string,
  line2: string,
  triggerInstantUtc: string,
): readonly HandoverSkySample[] {
  const triggerMs = Date.parse(triggerInstantUtc);
  const epochMs = Date.parse(deriveTleFacts(line1, line2).epochUtc);
  const startMs = triggerMs - TLE_HANDOVER_SCENE_WINDOW_SEC * 500;
  const sampleCount = TLE_HANDOVER_SCENE_WINDOW_SEC / TLE_HANDOVER_SCENE_SAMPLE_STEP_SEC + 1;
  const samples: HandoverSkySample[] = [];

  for (let index = 0; index < sampleCount; index += 1) {
    const instantMs = startMs + index * TLE_HANDOVER_SCENE_SAMPLE_STEP_SEC * 1_000;
    const state = calculateSatelliteState(line1, line2, (instantMs - epochMs) / 60_000);
    if (!state) continue;
    samples.push(Object.freeze({
      instantMs,
      elevationDeg: state.elevationDeg,
      position: topocentricSkyPosition(state.azimuthDeg, state.elevationDeg),
    }));
  }

  return Object.freeze(samples);
}

function interpolateHandoverSkySample(
  samples: readonly HandoverSkySample[],
  ratio: number,
): HandoverSkySample | null {
  if (samples.length === 0) return null;
  const scaled = Math.max(0, Math.min(1, ratio)) * (samples.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(samples.length - 1, lowerIndex + 1);
  const mix = scaled - lowerIndex;
  const lower = samples[lowerIndex]!;
  const upper = samples[upperIndex]!;
  return Object.freeze({
    instantMs: lower.instantMs + (upper.instantMs - lower.instantMs) * mix,
    elevationDeg: lower.elevationDeg + (upper.elevationDeg - lower.elevationDeg) * mix,
    position: Object.freeze([
      lower.position[0] + (upper.position[0] - lower.position[0]) * mix,
      lower.position[1] + (upper.position[1] - lower.position[1]) * mix,
      lower.position[2] + (upper.position[2] - lower.position[2]) * mix,
    ] as const),
  });
}

function HandoverPacketFlow({
  source,
  target,
  phase,
  colour,
}: {
  readonly source: readonly [number, number, number];
  readonly target: readonly [number, number, number];
  readonly phase: number;
  readonly colour: string;
}): ReactElement {
  const from = new THREE.Vector3(...source);
  const to = new THREE.Vector3(...target);
  return (
    <>
      {[0, 1 / 3, 2 / 3].map((offset, index) => {
        const progress = (phase + offset) % 1;
        const position = new THREE.Vector3().lerpVectors(from, to, progress);
        return (
          <mesh key={index} position={position}>
            <sphereGeometry args={[index === 0 ? 0.085 : 0.06, 14, 10]} />
            <meshBasicMaterial color={colour} />
          </mesh>
        );
      })}
    </>
  );
}

function HandoverGlbScene({ frame, lightCapture = false }: { readonly frame: TleJourneyHandoverFrame; readonly lightCapture?: boolean }): ReactElement {
  const { source } = frame;
  const fromTrajectory = useMemo(
    () => buildHandoverSkyTrajectory(source.fromTleLine1, source.fromTleLine2, source.triggerInstantUtc),
    [source],
  );
  const toTrajectory = useMemo(
    () => buildHandoverSkyTrajectory(source.toTleLine1, source.toTleLine2, source.triggerInstantUtc),
    [source],
  );
  const fromSample = interpolateHandoverSkySample(fromTrajectory, frame.ratio);
  const toSample = interpolateHandoverSkySample(toTrajectory, frame.ratio);
  const terminalPosition = Object.freeze([0, 0.16, 0] as const);
  const fromPosition = fromSample?.position ?? Object.freeze([-3.8, 2.4, 0] as const);
  const toPosition = toSample?.position ?? Object.freeze([3.8, 3.2, 0] as const);
  const servingFrom = frame.servingSatelliteId === source.fromSatelliteId;
  const servingPosition = servingFrom ? fromPosition : toPosition;
  const packetPhase = (frame.ratio * 12) % 1;
  const instantMs = fromSample?.instantMs ?? toSample?.instantMs ?? Date.parse(source.triggerInstantUtc);
  const colours = lightCapture
    ? { surface: '#f3f7f5', gridMajor: '#a5bbb7', gridMinor: '#d4e1de', serving: '#08766d', candidate: '#956000', released: '#63777d', terminal: '#ad264d', packet: '#314e57' }
    : { surface: '#0b302b', gridMajor: '#2d7366', gridMinor: '#17443b', serving: '#76ead7', candidate: '#ffd78a', released: '#627d82', terminal: '#ff7d8f', packet: '#ffffff' };

  return (
    <div
      className="tle-journey__handover-glb-stage"
      data-satellite-model-path={SATELLITE_MODEL_CATALOG.starlink.path}
      data-motion-source="ARCHIVED_TLE_SGP4_NTPU_TOPOCENTRIC"
      data-motion-window-sec={TLE_HANDOVER_SCENE_WINDOW_SEC}
      data-motion-instant-utc={new Date(instantMs).toISOString()}
      data-from-position={fromPosition.map(value => value.toFixed(4)).join(',')}
      data-to-position={toPosition.map(value => value.toFixed(4)).join(',')}
    >
      <Canvas
        camera={{ position: [0, 5.4, 13.2], fov: 38 }}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={[lightCapture ? '#ffffff' : '#03100f']} />
        {lightCapture ? null : <fog attach="fog" args={['#03100f', 18, 34]} />}
        <ambientLight intensity={lightCapture ? 1 : 1.5} color={lightCapture ? '#ffffff' : '#eefcff'} />
        <hemisphereLight args={lightCapture ? ['#ffffff', '#dce8e5', 0.62] : ['#f4ffff', '#0b302b', 1.2]} />
        <directionalLight position={[5, 10, 8]} intensity={lightCapture ? 1.2 : 3.4} color="#ffffff" />
        {lightCapture ? null : <directionalLight position={[-6, 5, 5]} intensity={1.5} color="#dffcff" />}
        {lightCapture ? null : <Stars radius={36} depth={12} count={420} factor={1.35} saturation={0.15} fade speed={0} />}

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow={!lightCapture}>
          <circleGeometry args={[7.6, 96]} />
          <meshStandardMaterial color={colours.surface} roughness={0.92} metalness={0.05} />
        </mesh>
        <gridHelper args={[14, 14, colours.gridMajor, colours.gridMinor]} position={[0, 0.012, 0]} />

        <group position={fromPosition}>
          <Suspense fallback={<SatelliteLoadMarker />}>
            <ArchivedStarlinkModel stageScale={TLE_HANDOVER_SATELLITE_STAGE_SCALE} lightCapture={lightCapture} />
          </Suspense>
          {lightCapture ? null : <pointLight color="#ffffff" intensity={1.6} distance={5} decay={2} />}
        </group>
        <group position={toPosition}>
          <Suspense fallback={<SatelliteLoadMarker />}>
            <ArchivedStarlinkModel stageScale={TLE_HANDOVER_SATELLITE_STAGE_SCALE} lightCapture={lightCapture} />
          </Suspense>
          {lightCapture ? null : <pointLight color="#ffffff" intensity={1.6} distance={5} decay={2} />}
        </group>

        <Line
          points={[fromPosition, terminalPosition]}
          color={servingFrom ? colours.serving : colours.released}
          lineWidth={servingFrom ? 4 : 1.6}
          dashed={!servingFrom}
          dashSize={0.13}
          gapSize={0.1}
          transparent
          opacity={servingFrom ? 0.96 : 0.42}
        />
        <Line
          points={[toPosition, terminalPosition]}
          color={servingFrom ? colours.candidate : colours.serving}
          lineWidth={servingFrom ? 2 : 4}
          dashed={servingFrom}
          dashSize={0.13}
          gapSize={0.1}
          transparent
          opacity={servingFrom ? 0.78 : 0.96}
        />
        <HandoverPacketFlow source={servingPosition} target={terminalPosition} phase={packetPhase} colour={colours.packet} />

        <group position={terminalPosition}>
          <mesh>
            <cylinderGeometry args={[0.22, 0.32, 0.18, 24]} />
            <meshStandardMaterial color={colours.terminal} emissive={lightCapture ? '#000000' : '#6c1b2b'} emissiveIntensity={lightCapture ? 0 : 0.45} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[0.42, 0.48, 40]} />
            <meshBasicMaterial color={colours.terminal} transparent opacity={0.82} side={THREE.DoubleSide} />
          </mesh>
        </group>

        <OrbitControls
          makeDefault
          target={[0, 2.1, 0]}
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          minDistance={9}
          maxDistance={18}
          maxPolarAngle={Math.PI / 2.04}
        />
      </Canvas>

      <div className="tle-journey__handover-world-labels" aria-hidden="true">
        <span
          className={`handover-scene-satellite is-from ${servingFrom ? 'is-serving' : 'is-released'}`}
          data-testid="tle-handover-scene-satellite-from"
          data-scene-satellite-id={source.fromSatelliteId}
        >
          <strong>{source.fromSatelliteId}</strong>
          <small>{servingFrom ? '服務中' : '離開可見範圍'} · α {fromSample?.elevationDeg.toFixed(1) ?? '—'}°</small>
        </span>
        <span
          className={`handover-scene-satellite is-to ${servingFrom ? 'is-candidate' : 'is-serving'}`}
          data-testid="tle-handover-scene-satellite-to"
          data-scene-satellite-id={source.toSatelliteId}
        >
          <strong>{source.toSatelliteId}</strong>
          <small>{servingFrom ? '候選' : '服務中'} · α {toSample?.elevationDeg.toFixed(1) ?? '—'}°</small>
        </span>
      </div>

      <div className="tle-journey__handover-scene-contract sr-only" aria-hidden="true">
        <span
          data-testid="tle-handover-scene-link-from"
          data-scene-link-state={servingFrom ? 'serving' : 'released'}
        />
        <span
          data-testid="tle-handover-scene-link-to"
          data-scene-link-state={servingFrom ? 'candidate' : 'serving'}
        />
        <span
          className="handover-scene-data-stream"
          data-testid="tle-handover-data-stream"
          data-scene-signal-source={frame.servingSatelliteId}
        >
          {[0, 1, 2].map(index => <i key={index} className="handover-scene-signal is-serving" />)}
        </span>
      </div>
    </div>
  );
}

export function HandoverReplayStage({
  frame,
  onReplay,
  lightCapture = false,
}: {
  readonly frame: TleJourneyHandoverFrame;
  readonly onReplay: () => void;
  readonly lightCapture?: boolean;
}): ReactElement {
  const { source } = frame;
  const sourceArchiveDate = (() => {
    const match = source.sourcePath.match(/_(\d{4})(\d{2})(\d{2})\.tle$/);
    return match === null ? '日期未標示' : `${match[1]}-${match[2]}-${match[3]}`;
  })();
  const stateLabel = frame.state === 'forced-continuity'
    ? '強制連續：可見性切換'
    : frame.state === 'pending'
      ? '監看可見性邊界'
      : '監看候選連線';
  const eventLabel = frame.event === 'forced-continuity'
    ? `強制連續：${source.fromSatelliteId} → ${source.toSatelliteId}`
    : '尚未發生可見性切換';
  const preEventProgress = Math.min(1, frame.ratio / 0.5);

  return (
    <div
      className={`tle-journey__beat tle-journey__beat--handover is-${frame.state}`}
      data-testid="tle-handover-replay"
      data-handover-state={frame.state}
      data-handover-event={frame.event}
      data-handover-from={source.fromSatelliteId}
      data-handover-to={source.toSatelliteId}
      data-visual-progress={frame.ratio.toFixed(3)}
    >
      <div className="tle-journey__handover-head">
        <div>
          <span className="tle-journey__handover-kicker">資料來源 · Starlink 封存 TLE</span>
          <h2>服務可見性切換的可觀測證據</h2>
        </div>
        <div className="tle-journey__handover-head-actions">
          <span className="tle-journey__handover-status" data-testid="tle-handover-state">{stateLabel}</span>
          {frame.state === 'forced-continuity' ? (
            <div className="tle-journey__handover-final-actions">
              <button type="button" data-testid="tle-journey-replay" onClick={onReplay}>重新播放</button>
              <a href={sixActsHref(SIX_ACTS_ACT3_HREF, lightCapture)} data-testid="tle-journey-next">下一幕：離軸角</a>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="tle-journey__handover-scene"
        data-testid="tle-handover-scene"
        data-scene-serving-id={frame.servingSatelliteId}
        data-scene-event={frame.event}
        data-scene-visual-progress={frame.ratio.toFixed(3)}
      >
        <HandoverGlbScene frame={frame} lightCapture={lightCapture} />
        {frame.state === 'forced-continuity' ? (
          <div className="handover-scene-commit-cue" data-testid="tle-handover-scene-commit-cue">
            原服務衛星離開可見範圍，服務連線改由候選衛星承接
          </div>
        ) : null}
        <p className="tle-journey__handover-scene-readout">
          目前服務連線：<strong data-testid="tle-handover-scene-serving-label">{frame.servingSatelliteId}</strong>
        </p>
      </div>

      <div className="tle-journey__handover-track" aria-label="服務可見性切換流程">
        <article className={`tle-journey__handover-node is-from ${frame.servingSatelliteId === source.fromSatelliteId ? 'is-serving' : 'is-released'}`}>
          <span className="tle-journey__handover-role">原服務衛星</span>
          <strong className="tle-journey__key-value" data-testid="tle-handover-from-id">{source.fromSatelliteId}</strong>
          <small>{source.fromSatelliteName}</small>
          <span className="tle-journey__handover-source" data-source-path={source.sourcePath}>
            Starlink · {sourceArchiveDate}
          </span>
        </article>

        <div className="tle-journey__handover-connector" aria-hidden="true">
          <span className="handover-connector-line" style={{ transform: `scaleX(${Math.max(0.04, frame.ratio)})` }} />
          <span className="handover-connector-arrow">›</span>
          <span className="handover-connector-label">{frame.state === 'forced-continuity' ? '強制切換' : '候選比較'}</span>
        </div>

        <article className={`tle-journey__handover-node is-to ${frame.servingSatelliteId === source.toSatelliteId ? 'is-serving' : 'is-candidate'}`}>
          <span className="tle-journey__handover-role">{frame.state === 'forced-continuity' ? '接替服務衛星' : '候選衛星'}</span>
          <strong className="tle-journey__key-value" data-testid="tle-handover-to-id">{source.toSatelliteId}</strong>
          <small>{source.toSatelliteName}</small>
          <span className="tle-journey__handover-source" data-source-path={source.sourcePath}>
            Starlink · {sourceArchiveDate}
          </span>
        </article>
      </div>

      <div className="tle-journey__handover-evidence">
        <div className="tle-journey__handover-progress">
            <span>{source.eventType === 'forced-continuity' ? '封存事件時間軸' : '條件持續'}</span>
            <strong className="tle-journey__key-value">
              {source.eventType === 'forced-continuity'
                ? (frame.event === 'forced-continuity' ? '已切換 · 新連線建立' : `接近可見性邊界 ${Math.round(preEventProgress * 100)}%`)
                : `${frame.progressSec.toFixed(0)} / ${source.tttSec} s`}
            </strong>
          <div className="handover-progress-track" aria-hidden="true">
            <span style={{ transform: `scaleX(${frame.ratio})` }} />
          </div>
        </div>
        <dl className="tle-journey__handover-policy">
          <div><dt>政策門檻</dt><dd className="tle-journey__key-value">{source.offsetDb.toFixed(0)} dB</dd></div>
          <div><dt>TTT</dt><dd className="tle-journey__key-value">{source.tttSec} s（未成立）</dd></div>
          <div><dt>事件時刻</dt><dd>{source.triggerInstantUtc.slice(11, 19)}Z</dd></div>
        </dl>
      </div>

      <p
        className={`tle-journey__handover-event ${frame.event === 'forced-continuity' ? 'is-committed' : ''}`}
        data-testid="tle-handover-event"
      >
        {eventLabel}
      </p>
      <p className="tle-journey__handover-note">
        本事件由原服務衛星離開 NTPU 可見範圍觸發；3 dB 差值與 30 秒 TTT 條件未成立。追蹤摘要 {source.traceDigest}
      </p>
    </div>
  );
}

/* -- Inspector Drawer ------------------------------------------------------ */

type InspectorTab = 'columns' | 'checksum' | 'coords' | 'provenance';

const INSPECTOR_TABS: readonly { readonly id: InspectorTab; readonly label: string }[] = Object.freeze([
  { id: 'columns', label: '69 欄位規範表' },
  { id: 'checksum', label: '模 10 檢核防線實驗室' },
  { id: 'coords', label: '座標與幾何轉換鏈' },
  { id: 'provenance', label: '科學權威與 Provenance' },
]);

function InspectorDrawer({
  isOpen,
  onClose,
  facts,
}: {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly facts: ReturnType<typeof deriveTleFacts>;
}): ReactElement | null {
  const [activeTab, setActiveTab] = useState<InspectorTab>('columns');
  const [editedLine2, setEditedLine2] = useState<string>(SAMPLE_TLE.line2);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const checksumResult = useMemo(() => tleChecksum(editedLine2), [editedLine2]);
  const isCorrupted = editedLine2 !== SAMPLE_TLE.line2;

  const orbitalTestResult = useMemo(
    () => calculateSatelliteOrbitalResult(SAMPLE_TLE.line1, editedLine2, 0),
    [editedLine2],
  );
  const orbitalFailureReason = 'reason' in orbitalTestResult ? orbitalTestResult.reason : null;

  // Keep keyboard focus inside the modal, and return it to the trigger when
  // the modal closes. Background inertness is applied by the route below.
  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const getFocusable = (): HTMLElement[] => {
      const root = contentRef.current;
      if (!root) return [];
      return Array.from(root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )).filter(element => !element.hasAttribute('hidden') && element.getClientRects().length > 0);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = getFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        contentRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const current = document.activeElement;
      if (event.shiftKey && current === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      const target = event.target;
      if (target instanceof Node && !contentRef.current?.contains(target)) {
        closeButtonRef.current?.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      const previous = restoreFocusRef.current;
      if (previous && document.contains(previous)) {
        requestAnimationFrame(() => {
          if (document.contains(previous)) previous.focus();
        });
      }
      restoreFocusRef.current = null;
    };
  }, [isOpen]);

  const moveTab = (currentIndex: number, direction: -1 | 1 | 'first' | 'last') => {
    const nextIndex = direction === 'first'
      ? 0
      : direction === 'last'
        ? INSPECTOR_TABS.length - 1
        : (currentIndex + direction + INSPECTOR_TABS.length) % INSPECTOR_TABS.length;
    const nextTab = INSPECTOR_TABS[nextIndex]!;
    setActiveTab(nextTab.id);
    requestAnimationFrame(() => tabRefs.current[nextIndex]?.focus());
  };

  if (!isOpen) return null;

  return (
    <div
      className="tle-journey__inspector-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="數據規格與幾何轉換鏈"
    >
      <div className="inspector-backdrop" onClick={onClose} />
      <div className="inspector-content" ref={contentRef} tabIndex={-1}>
        <div className="inspector-header">
          <div className="inspector-tabs" role="tablist">
            {INSPECTOR_TABS.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                tabIndex={activeTab === tab.id ? 0 : -1}
                className={activeTab === tab.id ? 'is-active' : ''}
                ref={element => { tabRefs.current[index] = element; }}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={event => {
                  if (event.key === 'ArrowRight') {
                    event.preventDefault();
                    moveTab(index, 1);
                  } else if (event.key === 'ArrowLeft') {
                    event.preventDefault();
                    moveTab(index, -1);
                  } else if (event.key === 'Home') {
                    event.preventDefault();
                    moveTab(index, 'first');
                  } else if (event.key === 'End') {
                    event.preventDefault();
                    moveTab(index, 'last');
                  }
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="inspector-close"
            onClick={onClose}
            aria-label="關閉檢查器 (Escape)"
            ref={closeButtonRef}
          >
            ✕
          </button>
        </div>

        <div className="inspector-body">
          {activeTab === 'columns' ? (
            <div className="inspector-table-wrap">
              <table className="inspector-table">
                <thead>
                  <tr>
                    <th>行</th>
                    <th>欄位</th>
                    <th>名稱</th>
                    <th>原始值</th>
                    <th>說明</th>
                  </tr>
                </thead>
                <tbody>
                  {TLE_FIELDS.map(f => {
                    const rawLine = f.line === 1 ? SAMPLE_TLE.line1 : SAMPLE_TLE.line2;
                    const rawVal = rawLine.slice(f.startColumn - 1, f.endColumn);
                    return (
                      <tr key={f.id} className={f.narrated ? 'is-narrated-row' : ''}>
                        <td>{f.line}</td>
                        <td>{f.startColumn}–{f.endColumn}</td>
                        <td><strong>{f.labelZhHant}</strong></td>
                        <td><code>{rawVal}</code></td>
                        <td>{f.explainZhHant}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === 'checksum' ? (
            <div className="tle-journey__checksum-panel">
              <div className="checksum-header">
                <strong>最後一欄：模 10 檢核碼（Checksum）防線實驗</strong>
                <span className={checksumResult.valid && orbitalTestResult.ok ? 'status-pill is-ok' : 'status-pill is-bad'}>
                  {checksumResult.valid && orbitalTestResult.ok ? '✔ 完整 TLE 驗證通過' : '✖ 驗證失敗（Fail Closed）'}
                </span>
              </div>
              <div className="checksum-interactive">
                <div className="checksum-input-wrap">
                  <label htmlFor="tle-line2-input">試著改動第 2 行其中一位數字：</label>
                  <input
                    id="tle-line2-input"
                    type="text"
                    value={editedLine2}
                    spellCheck={false}
                    onChange={e => setEditedLine2(e.target.value.slice(0, TLE_LINE_LENGTH))}
                  />
                </div>
                {isCorrupted ? (
                  <button
                    type="button"
                    className="checksum-reset-btn"
                    onClick={() => setEditedLine2(SAMPLE_TLE.line2)}
                  >
                    還原原始第 2 行
                  </button>
                ) : (
                  <button
                    type="button"
                    className="checksum-glitch-btn"
                    onClick={() => {
                      const corrupted = `${SAMPLE_TLE.line2.slice(0, 10)}9${SAMPLE_TLE.line2.slice(11)}`;
                      setEditedLine2(corrupted);
                    }}
                  >
                    模擬傳輸竄改 (改動一位數字)
                  </button>
                )}
              </div>
              <p className="checksum-feedback">
                {checksumResult.valid && orbitalTestResult.ok
                  ? `前 68 欄計算總和 mod 10 = ${checksumResult.expected}，與最後一欄 ${checksumResult.actual} 完全吻合；完整 TLE／軌道驗證也通過，SGP4 才允許載入傳播。`
                  : checksumResult.valid
                    ? `檢核碼 ${checksumResult.actual} 與計算值 ${checksumResult.expected} 吻合，但完整 TLE／軌道驗證未通過；資料保持 INVALID_TLE，SGP4 傳播阻斷（${orbitalFailureReason ?? '未提供失敗原因'}）。`
                    : `前 68 欄計算總和 mod 10 = ${checksumResult.expected}，但末尾標記為 ${checksumResult.actual}。資料損毀防線生效：資料保持 INVALID_TLE，SGP4 傳播全面阻斷（${orbitalFailureReason ?? '完整驗證未執行'}）。`}
              </p>
            </div>
          ) : null}

          {activeTab === 'coords' ? (
            <div className="inspector-coords">
              {TLE_COORDINATE_CHAIN_DISCLOSURE.map((stepDesc, idx) => (
                <div key={idx} className="coord-chain-step">
                  <span className="step-num">{idx + 1}</span>
                  <div>
                    <strong>{stepDesc}</strong>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {activeTab === 'provenance' ? (
            <div className="inspector-provenance">
              <div className="prov-item" data-source-path={SAMPLE_TLE.sourcePath}>
                <dt>資料來源 (Source)</dt>
                <dd className="tle-journey__key-value">{SAMPLE_TLE.constellation} · {`${SAMPLE_TLE.archiveDate.slice(0, 4)}-${SAMPLE_TLE.archiveDate.slice(4, 6)}-${SAMPLE_TLE.archiveDate.slice(6, 8)}`}</dd>
              </div>
              <div className="prov-item">
                <dt>內容驗證摘要 (Content Digest)</dt>
                <dd><code>{SAMPLE_TLE.contentDigest}</code></dd>
              </div>
              <div className="prov-item">
                <dt>衛星名稱 / NORAD 編號</dt>
                <dd>{SAMPLE_TLE.name} · NORAD ID {SAMPLE_TLE.catalogId}</dd>
              </div>
              <div className="prov-item">
                <dt>觀測時刻 (Epoch)</dt>
                <dd>{facts.epochUtc} (年: {facts.epochYear}, 年日序: {facts.epochDayOfYear.toFixed(4)})</dd>
              </div>
              <div className="prov-item">
                <dt>地面觀測站 (Observer)</dt>
                <dd>國立臺北大學 (NTPU) · 24.9442°N, 121.3714°E · 海拔 50 m</dd>
              </div>
              <div className="prov-item">
                <dt>科學保證 (Scientific Honesty)</dt>
                <dd>依據標準 SGP4 傳播模型與 WGS84 幾何轉換推算，明確界定為模型推算預測，非即時實測遙測。</dd>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* -- Main Route ------------------------------------------------------------ */

export function TleJourneyRoute(): ReactElement {
  const lightCapture = isSixActsLightCaptureMode();
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [courseTimeSec, setCourseTimeSec] = useState(0);
  const [manualOffsetMin, setManualOffsetMin] = useState<number | null>(null);
  const [manualCursorMs, setManualCursorMs] = useState<number | null>(null);
  const [manualFieldId, setManualFieldId] = useState<string | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  const facts = useMemo(() => deriveTleFacts(SAMPLE_TLE.line1, SAMPLE_TLE.line2), []);
  const pass = useMemo(() => getTeachingPass(), []);
  const clock = useMemo(() => courseTimeToTleJourneyBeat(courseTimeSec), [courseTimeSec]);
  const currentStationIndex = clock.stationIndex;
  const currentStation = TLE_JOURNEY_STATIONS[currentStationIndex] ?? TLE_JOURNEY_STATIONS[0]!;
  const derivedFieldId = scannerFieldForProgress(clock.beatProgress);
  const selectedFieldId = !isPlaying && manualFieldId !== null ? manualFieldId : derivedFieldId;
  const columnWalkSubtitle = useMemo(
    () => currentStation.id === 'column-walk'
      ? getTleColumnWalkSubtitle(selectedFieldId, SAMPLE_TLE.line1, SAMPLE_TLE.line2, facts)
      : null,
    [currentStation.id, facts, selectedFieldId],
  );
  const sgp4StagedProgress = currentStation.id === 'sgp4-contract'
    ? tleJourneySgp4StagedSweepProgress(clock.beatElapsedSec)
    : 0;
  const sgp4CheckpointIndex = Math.round(
    sgp4StagedProgress * (TLE_JOURNEY_SGP4_AUTOPLAY_CHECKPOINT_COUNT - 1),
  );
  const derivedOffsetProgress = currentStation.id === 'sgp4-contract'
    ? sgp4StagedProgress
    : clock.beatProgress;
  const derivedOffsetMin = derivedOffsetProgress * facts.orbitalPeriodMin;
  const clockOffsetMin = !isPlaying && manualOffsetMin !== null ? manualOffsetMin : derivedOffsetMin;
  const derivedCursorMs = pass
    ? pass.riseMs + clock.beatProgress * (pass.setMs - pass.riseMs)
    : null;
  const cursorMs = !isPlaying && manualCursorMs !== null ? manualCursorMs : derivedCursorMs;

  // Trigger button ref to restore focus after closing inspector
  const inspectorBtnRef = useRef<HTMLButtonElement>(null);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const lastNowRef = useRef<number | null>(null);

  // Check prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsPlaying(false);
    }
  }, []);

  // When playing, auto-close inspector
  useEffect(() => {
    if (isPlaying) {
      setInspectorOpen(false);
    }
  }, [isPlaying]);

  // A modal must remove the background from both pointer and keyboard
  // interaction.  The native inert attribute provides the keyboard contract;
  // the CSS fallback also prevents clicks in browsers without inert support.
  useEffect(() => {
    backgroundRef.current?.toggleAttribute('inert', inspectorOpen);
  }, [inspectorOpen]);

  const clearManualOverrides = useCallback(() => {
    setManualOffsetMin(null);
    setManualCursorMs(null);
    setManualFieldId(null);
  }, []);

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (courseTimeSec >= TLE_JOURNEY_DURATION_SEC) {
      setCourseTimeSec(0);
      clearManualOverrides();
    }
    setIsPlaying(true);
  }, [clearManualOverrides, courseTimeSec, isPlaying]);

  const handleReplay = useCallback(() => {
    setCourseTimeSec(0);
    clearManualOverrides();
    setIsPlaying(true);
  }, [clearManualOverrides]);

  const handleSeek = useCallback((timeSec: number) => {
    const target = Math.max(0, Math.min(TLE_JOURNEY_DURATION_SEC, timeSec));
    setCourseTimeSec(target);
    clearManualOverrides();
    setIsPlaying(false);
  }, [clearManualOverrides]);

  const handleStepBackward = useCallback((seconds = 5) => {
    handleSeek(courseTimeSec - seconds);
  }, [courseTimeSec, handleSeek]);

  const handleStepForward = useCallback((seconds = 5) => {
    handleSeek(courseTimeSec + seconds);
  }, [courseTimeSec, handleSeek]);

  const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
  }, []);

  // Step navigation helper. A station jump is an exact course-clock seek.
  const goToStation = useCallback((targetIndex: number) => {
    const clamped = Math.max(0, Math.min(TLE_JOURNEY_STATIONS.length - 1, targetIndex));
    setCourseTimeSec(tleJourneyBeatToCourseTime(clamped));
    clearManualOverrides();
    setIsPlaying(false);
  }, [clearManualOverrides]);

  // Every director animation reads this one clock. A requestAnimationFrame
  // loop keeps playback smooth while the model remains seek-deterministic.
  useEffect(() => {
    let raf = 0;
    const tick = (now: number) => {
      if (lastNowRef.current === null) lastNowRef.current = now;
      const elapsedSec = Math.min(0.1, Math.max(0, (now - lastNowRef.current) / 1000));
      lastNowRef.current = now;

      if (isPlaying) {
        setCourseTimeSec(previous => {
          const next = advanceTleJourneyCourseTime(previous, elapsedSec, playbackSpeed);
          if (next >= TLE_JOURNEY_DURATION_SEC) setIsPlaying(false);
          return next;
        });
      }

      raf = window.requestAnimationFrame(tick);
    };
    raf = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(raf);
      lastNowRef.current = null;
    };
  }, [isPlaying, playbackSpeed]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // InspectorDrawer owns Escape and Tab while open.  Do not let the
      // background transport or course shortcuts react to those events.
      if (inspectorOpen) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT' || target?.tagName === 'BUTTON') return;

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowRight' || e.code === 'PageDown') {
        e.preventDefault();
        goToStation(currentStationIndex + 1);
      } else if (e.code === 'ArrowLeft' || e.code === 'PageUp') {
        e.preventDefault();
        goToStation(currentStationIndex - 1);
      } else if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setIsPlaying(false);
        setInspectorOpen(p => !p);
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        goToStation(0);
        setIsPlaying(true);
      } else if (e.code === 'Escape') {
        setInspectorOpen(false);
        inspectorBtnRef.current?.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentStationIndex, goToStation, handlePlayPause, inspectorOpen]);

  return (
    <main
      className={`tle-journey ${isPlaying ? 'is-autoplay' : 'is-paused'}`}
      data-theme={lightCapture ? 'light-capture' : undefined}
      data-playing={isPlaying ? 'true' : 'false'}
      data-course-time={courseTimeSec.toFixed(1)}
      data-beat={currentStation.id}
      data-beat-order={String(currentStation.order)}
      data-beat-progress={clock.beatProgress.toFixed(3)}
      data-transport-playing={isPlaying ? 'true' : 'false'}
      data-transport-speed={String(playbackSpeed)}
      data-transport-time={courseTimeSec.toFixed(1)}
      data-transport-duration={TLE_JOURNEY_DURATION_SEC.toFixed(1)}
      data-sgp4-offset-min={currentStation.id === 'sgp4-contract' ? clockOffsetMin.toFixed(2) : undefined}
      data-sgp4-output-mode={currentStation.id === 'sgp4-contract' ? 'staged-time-lapse' : undefined}
      data-sgp4-checkpoint-index={currentStation.id === 'sgp4-contract' ? String(sgp4CheckpointIndex) : undefined}
      aria-labelledby="tle-journey-title"
      lang="zh-Hant"
    >
      <div className="tle-journey__nav-escape">
        <SixActsNav currentHref="/course/tle-journey" variant="stage" />
      </div>
      <div
        ref={backgroundRef}
        className="tle-journey__background"
        aria-hidden={inspectorOpen}
      >
      <h1 id="tle-journey-title" className="sr-only">從兩行 TLE 到三維空間軌跡</h1>

      {!isPlaying ? (
        <div className="tle-journey__pause-tools">
          <button
            ref={inspectorBtnRef}
            type="button"
            className={`tle-journey__btn is-inspector ${inspectorOpen ? 'is-active' : ''}`}
            onClick={() => setInspectorOpen(previous => !previous)}
            aria-expanded={inspectorOpen}
            aria-label="查看數據規格"
            title="查看完整 69 欄位與幾何轉換規格 (快捷鍵 I)"
          >
            <span className="inspector-icon" aria-hidden="true">🔍</span>
            <span className="inspector-label">數據規格</span>
          </button>
        </div>
      ) : null}

      {/* Main Theater Visual Stage */}
      <section className="tle-journey__theater">
        <div
          className="tle-journey__beat-container"
          data-station-id={currentStation.id}
        >
          {currentStation.id === 'raw-record' ? <RawLinesStage /> : null}

          {currentStation.id === 'column-walk' ? (
            <FieldScannerStage
              activeKeyFieldId={selectedFieldId}
              onSelectKeyField={fieldId => {
                setManualFieldId(fieldId);
                setIsPlaying(false);
              }}
              facts={facts}
              isPlaying={isPlaying}
            />
          ) : null}

          {currentStation.id === 'sgp4-contract' ? (
            <Sgp4TransformationStage
              offsetMin={clockOffsetMin}
              onChangeOffset={val => {
                setManualOffsetMin(val);
                setIsPlaying(false);
              }}
              facts={facts}
              isPlaying={isPlaying}
              autoplayCheckpointIndex={sgp4CheckpointIndex}
            />
          ) : null}

          {currentStation.id === 'satellite-orbit' ? (
            <div className="tle-journey__beat tle-journey__beat--orbit">
              <Orbit3DCanvas offsetMin={clockOffsetMin} lightCapture={lightCapture} />
            </div>
          ) : null}

          {currentStation.id === 'observer-pass' ? (
              <ObserverPassStage
              cursorMs={cursorMs}
              showFinalActions={clock.beatProgress >= 0.75}
              onReplay={handleReplay}
              onCursorChange={val => {
                setManualCursorMs(val);
                setIsPlaying(false);
              }}
            />
          ) : null}
        </div>

        {/* The source record and field walk reserve space for this teaching
            caption.  Beats 3–5 already carry their explanation in-scene; an
            extra lower-left overlay would cover those controls and labels. */}
        {currentStation.id === 'raw-record' || currentStation.id === 'column-walk' ? (
          <aside
            className="tle-journey__subtitle-bar"
            data-station-id={currentStation.id}
            data-field-id={columnWalkSubtitle?.fieldId}
            data-field-range={columnWalkSubtitle?.lineColumnZhHant}
            data-field-raw={columnWalkSubtitle?.rawValue}
          >
            <div className="subtitle-eyebrow">
              <span className="eyebrow-tag">{currentStation.beatLabel}</span>
              <strong className="eyebrow-title">{currentStation.titleZhHant}</strong>
            </div>
            <div className="subtitle-text">
              {columnWalkSubtitle ? (
                <>
                  <p className="column-walk-field-meta">
                    <strong>{columnWalkSubtitle.labelZhHant}</strong>
                    <span>{columnWalkSubtitle.lineColumnZhHant}</span>
                    <code className="tle-journey__key-value">原始值：{columnWalkSubtitle.rawValue}</code>
                  </p>
                  <p data-testid="tle-column-walk-key-point">{columnWalkSubtitle.keyPointZhHant}</p>
                </>
              ) : (
                <>
                  <p>{currentStation.subtitleZhHant[0]}</p>
                  <p>{currentStation.subtitleZhHant[1]}</p>
                </>
              )}
            </div>
          </aside>
        ) : null}

        <TeachingAnimationTransport
          currentTimeSec={courseTimeSec}
          durationSec={TLE_JOURNEY_DURATION_SEC}
          isPlaying={isPlaying}
          playbackSpeed={playbackSpeed}
          onPlayPause={handlePlayPause}
          onSeek={handleSeek}
          onStepBackward={handleStepBackward}
          onStepForward={handleStepForward}
          onSpeedChange={handleSpeedChange}
          stepSeconds={5}
          testId="tle-journey-transport"
        />
      </section>

      </div>

      {/* Slide-in Compact Inspector (Pause-Only or Clicked) */}
      <InspectorDrawer
        isOpen={inspectorOpen}
        onClose={() => {
          setInspectorOpen(false);
          requestAnimationFrame(() => inspectorBtnRef.current?.focus());
        }}
        facts={facts}
      />

    </main>
  );
}
