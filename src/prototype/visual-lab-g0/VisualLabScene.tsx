import { Html, Line, OrbitControls, useGLTF } from '@react-three/drei';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Component, Suspense, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactElement, type ReactNode } from 'react';
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { SimulationAnalysisFrame } from '../../simulator/types';
import type { VisualLabGuidedReplayProgress } from '../../visualLab/guidedReplay';
import type { VisualLabStorySceneDirection } from '../../visualLab/story';
import { satelliteModelForConstellation } from '../../viz/satelliteModelCatalog';
import { substrateOpacityForDensity } from './visualLabScenePresentation';
import { resolveSinrLiveConeRoleStyle, type SinrLiveConeRole } from '../../constants/sinrLiveConeStyle';
import {
  adaptSimulationAnalysisFrameToVisualLabGlobalScene,
  type VisualLabGlobalSceneFrame,
  type VisualLabGlobalSourceIdentity,
} from './visualLabGlobalSceneAdapter';
import type {
  VisualLabLocalCell,
  VisualLabLocalBeamMetric,
  VisualLabLocalPoint,
  VisualLabLocalScenePlan,
} from './visualLabLocalSceneAdapter';
import {
  VisualLabGlobalScene,
  type VisualLabGlobalSceneStatus,
} from './VisualLabGlobalScene';
import { VisualLabBeamCone } from './VisualLabBeamCone';
import { VisualLabHexFootprint } from './VisualLabHexFootprint';
import { buildVisualLabHexField } from './visualLabHexField';
import { cellIndexForBeamId } from './visualLabBeamCellMapping';
import {
  canonicalHandoverPresentation,
  guidedHandoverPresentation,
} from './visualLabHandoverPresentation';
import type { VisualLabGlobalConstellationArtifact } from '../../visualLab/globalConstellation';
import {
  constrainVisualLabCameraPose,
  visualLabOrbitControlLimits,
} from './visualLabCameraConstraints';
import {
  DEFAULT_VISUAL_LAB_SATELLITE_DISPLAY_MODE,
  DEFAULT_VISUAL_LAB_UE_DISPLAY_MODE,
  type VisualLabSatelliteDisplayMode,
  type VisualLabUeDisplayMode,
} from './visualLabSceneLayers';

export type VisualLabView = 'earth' | 'sky' | 'service';
export type VisualLabDensity = 'clean' | 'context' | 'full';
export type VisualLabFocus = 'geometry' | 'handover' | 'energy' | 'none';
export type VisualLabConstellation = 'starlink' | 'oneweb';
export type VisualLabSceneAssetKey = `satellite-${VisualLabConstellation}` | 'ntpu-substrate';
export type VisualLabSceneAssetStatus = 'ready' | 'error';

export interface VisualLabStoryBeamFocus {
  readonly userIndex: number;
  readonly fromBeamId: number;
  readonly toBeamId: number;
  /** Realized serving beam at this exact accepted story anchor. */
  readonly currentBeamId: number;
  readonly phase: 'before' | 'decision' | 'after';
}

export interface VisualLabCausalCameraCue {
  readonly storyId: 'beamwidth' | 'power-cap';
  readonly phase: 'baseline' | 'intervention' | 'comparison';
  /** Changes whenever the presentation step changes. */
  readonly revision: string;
}

export interface VisualLabSceneProps {
  readonly view: VisualLabView;
  readonly density: VisualLabDensity;
  readonly focus: VisualLabFocus;
  /** Draft-only display ratio for the beam-width slider; accepted metrics stay unchanged until rebuild. */
  readonly beamWidthDraftScale?: number;
  readonly theme?: 'dark' | 'light';
  readonly locale?: 'zh-Hant' | 'en';
  readonly satelliteDisplayMode?: VisualLabSatelliteDisplayMode;
  readonly ueDisplayMode?: VisualLabUeDisplayMode;
  /** Presentation-only identity badges. Geometry and scientific state remain visible when false. */
  readonly showLabels?: boolean;
  readonly selectedUe?: { readonly x: number; readonly z: number } | null;
  readonly onUeMove?: (x: number, z: number) => void;
  /** Presentation focus from an accepted same-satellite beam-switch trace. */
  readonly storyBeamFocus?: VisualLabStoryBeamFocus | null;
  /** Source-backed event identity used only to direct the presentation camera. */
  readonly storyDirection?: VisualLabStorySceneDirection | null;
  /** Presentation-only guided replay emphasis; scientific handover state remains unchanged. */
  readonly guidedCandidateEngaged?: boolean;
  /** Wall-clock replay pacing; identities and values still come from the accepted story/frame. */
  readonly guidedReplayProgress?: VisualLabGuidedReplayProgress;
  /** Normalized guided-replay return beat used only to blend the directed camera home. */
  readonly storyReturnProgress?: number | null;
  /** One-variable experiment cue; it changes only presentation camera framing. */
  readonly causalCameraCue?: VisualLabCausalCameraCue | null;
  readonly storyDirectorEnabled?: boolean;
  /** Kept for the sky/service display models; Earth view uses the accepted frame. */
  readonly constellation?: VisualLabConstellation;
  /** Complete accepted archived-TLE/SGP4 frame for the global view. */
  readonly globalFrame?: SimulationAnalysisFrame | null;
  /** Preferred closed global render DTO from VisualLabSession. */
  readonly globalSceneFrame?: VisualLabGlobalSceneFrame | null;
  /** Validated precomputed global constellation used before the full run is ready. */
  readonly globalArtifact?: VisualLabGlobalConstellationArtifact | null;
  /** Closed NTPU render DTO from the same accepted canonical frame. */
  readonly localScene?: VisualLabLocalScenePlan | null;
  /** Requested/published run identity; distinct from the current timeline anchor. */
  readonly globalSourceIdentity?: VisualLabGlobalSourceIdentity;
  readonly globalStatus?: VisualLabGlobalSceneStatus;
  readonly globalError?: string | null;
  /** Keeps export from treating a loading/error fallback as a publication asset. */
  readonly onAssetStatusChange?: (asset: VisualLabSceneAssetKey, status: VisualLabSceneAssetStatus) => void;
}

type P = [number, number, number];
const C = { bg: '#07141d', earth: '#0d3346', cyan: '#59d4ee', violet: '#d4a6ff', yellow: '#ffd166', blue: '#5aa9ff', grey: '#91a5ad', coral: '#ff9f68', rose: '#f06f8e', teal: '#4bc8bb', white: '#e8f4f4' } as const;
const NTPU_MODEL_PATH = '/scenes/NTPU_large.geometry-locked.glb';
const NTPU_MODEL_NATIVE_WIDTH = 2140.236755;
const NTPU_MODEL_NATIVE_DEPTH = 1528.740601;
const NTPU_SUBSTRATE_WIDTH_WORLD = 9.1;
const NTPU_SUBSTRATE_DEPTH_WORLD = NTPU_SUBSTRATE_WIDTH_WORLD
  * NTPU_MODEL_NATIVE_DEPTH / NTPU_MODEL_NATIVE_WIDTH;
const SATELLITE_STAGE_SCALE = .38;
// Shared presentation ratios.  The canonical beamwidth still controls the
// relative scale; these values only keep the default footprint broad enough
// to read against one full hexagonal cell at the NTPU scale.
const SERVICE_PRIMARY_BEAM_RADIUS_RATIO = .82;
const SERVICE_CONTEXT_BEAM_RADIUS_RATIO = .58;
const CANDIDATE_PRIMARY_BEAM_RADIUS_RATIO = .78;
const CANDIDATE_CONTEXT_BEAM_RADIUS_RATIO = .55;
type SatelliteVariant = VisualLabConstellation;

const clamp = (n: number, limit = 3.9) => THREE.MathUtils.clamp(Number.isFinite(n) ? n : 0, -limit, limit);
const smoothUnit = (value: number): number => {
  const t = THREE.MathUtils.clamp(Number.isFinite(value) ? value : 0, 0, 1);
  return t * t * (3 - 2 * t);
};
const point = (value: VisualLabLocalPoint): P => [value[0], value[1], value[2]];

const SCENE_COPY = Object.freeze({
  'zh-Hant': Object.freeze({
    observer: 'NTPU 觀測點',
    unavailable: 'NTPU 場景目前不可用',
    building: '正在建立衛星軌道場景',
    servingSatellite: '服務衛星',
    candidateSatellite: '候選衛星',
    visibleSatellite: '可見衛星',
    observerView: 'NTPU 上空視角',
    representativeUe: '代表 UE',
    unavailableShort: '不可用',
    userCount: '個 UE',
    dataPowerPath: '資料流與功率路徑',
    systemPower: '系統功率',
    throughput: '總吞吐量',
    energyEfficiency: '瞬時 EE',
    offAxisAngle: '離軸角',
    visualGuide: '視覺引導',
    preparing3d: '正在準備 3D 場景',
    webglUnavailable: '瀏覽器無法啟用 3D 圖形；請重新整理頁面或啟用硬體加速。',
    sceneAria: '低軌衛星、波束與 UE 的互動式場景',
  }),
  en: Object.freeze({
    observer: 'NTPU observer',
    unavailable: 'The NTPU scene is unavailable',
    building: 'Building the satellite-orbit scene',
    servingSatellite: 'Serving satellite',
    candidateSatellite: 'Candidate satellite',
    visibleSatellite: 'Visible satellite',
    observerView: 'NTPU sky view',
    representativeUe: 'Representative UE',
    unavailableShort: 'unavailable',
    userCount: 'UEs',
    dataPowerPath: 'Data flow and power path',
    systemPower: 'System power',
    throughput: 'Total throughput',
    energyEfficiency: 'Instantaneous EE',
    offAxisAngle: 'Off-axis angle',
    visualGuide: 'visual guide',
    preparing3d: 'Preparing the 3D scene',
    webglUnavailable: '3D graphics are unavailable. Reload the page or enable hardware acceleration.',
    sceneAria: 'Interactive LEO satellite, beam, and UE scene',
  }),
});

type SceneCopy = (typeof SCENE_COPY)[keyof typeof SCENE_COPY];

function Label({ children, position, tone = 'context' }: { children: ReactNode; position: P; tone?: 'serving' | 'candidate' | 'context' | 'observer' | 'ue' }) {
  const color = C[tone === 'serving' ? 'yellow' : tone === 'candidate' ? 'blue' : tone === 'observer' ? 'rose' : tone === 'ue' ? 'coral' : 'grey'];
  return <Html center position={position} distanceFactor={5.5} className={`vlab-label vlab-label--${tone}`}><span style={{ color, border: `1px solid ${color}`, background: 'rgba(5,17,24,.86)', borderRadius: 3, display: 'inline-block', fontFamily: '"Noto Sans TC", "Microsoft JhengHei", system-ui, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '.02em', lineHeight: 1.2, padding: '3px 5px', whiteSpace: 'nowrap' }}>{children}</span></Html>;
}

function beamMetricText(value: number | null, unit: string): string {
  return value === null || !Number.isFinite(value) ? '—' : scaledValue(value, unit);
}

/**
 * Read-only per-beam callout.  The payload is projected from the accepted
 * canonical frame by `visualLabLocalSceneAdapter`; this component never
 * recalculates SINR, power, throughput, or EE.
 */
function BeamMetricLabel({
  position,
  metric,
  color,
  emphasized,
}: {
  readonly position: P;
  readonly metric: VisualLabLocalBeamMetric;
  readonly color: string;
  readonly emphasized: boolean;
}): ReactElement {
  return <Html
    center
    position={position}
    distanceFactor={5.1}
    zIndexRange={[70, 20]}
    style={{ pointerEvents: 'none', userSelect: 'none' }}
  >
    <div
      data-beam-metric-label
      data-beam-id={metric.beamId}
      data-beam-satellite-id={metric.satelliteId}
      data-beam-sinr-db={metric.sinrDb ?? undefined}
      data-beam-power-w={metric.actualPowerW ?? undefined}
      data-beam-rate-bps={metric.totalRateBps ?? undefined}
      data-beam-user-count={metric.userCount}
      data-beam-metric-source={metric.source}
      data-beam-metric-aggregation="mean-sinr-sum-rate"
      title="每個波束的 SINR 為該波束服務 UE 的平均值；功率與速率來自同一 accepted canonical frame。"
      style={{
        minWidth: emphasized ? 112 : 104,
        padding: emphasized ? '5px 7px' : '4px 6px',
        borderRadius: 5,
        border: `1px solid ${color}`,
        borderLeft: `4px solid ${color}`,
        background: 'rgba(2, 9, 18, 0.88)',
        boxShadow: emphasized ? `0 0 10px ${color}66` : 'none',
        color: '#f6fbff',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
        fontSize: emphasized ? 12 : 11,
        fontWeight: emphasized ? 700 : 600,
        lineHeight: 1.25,
        letterSpacing: 0,
        textAlign: 'center',
        textShadow: '0 1px 2px rgba(0, 0, 0, 0.95)',
        whiteSpace: 'nowrap',
      }}
    >
      <div style={{ color, fontWeight: 800, marginBottom: 2 }}>
        B{metric.beamId} · {metric.userCount} UE
      </div>
      <div>SINR̄ {beamMetricText(metric.sinrDb, 'dB')}</div>
      <div>P {beamMetricText(metric.actualPowerW, 'W')} · R {beamMetricText(metric.totalRateBps, 'bit/s')}</div>
    </div>
  </Html>;
}

interface AssetBoundaryProps {
  readonly fallback: ReactElement;
  readonly children: ReactElement;
  readonly onError?: () => void;
}

interface AssetBoundaryState {
  readonly failed: boolean;
}

/** Keeps the display scene usable when an optional GLB is unavailable. */
class AssetBoundary extends Component<AssetBoundaryProps, AssetBoundaryState> {
  state: AssetBoundaryState = { failed: false };

  static getDerivedStateFromError(): AssetBoundaryState {
    return { failed: true };
  }

  componentDidCatch(): void {
    this.props.onError?.();
  }

  render(): ReactElement {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function cloneDisplayAsset(source: THREE.Object3D, opacity = 1): THREE.Object3D {
  const cloned = SkeletonUtils.clone(source);
  cloned.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const patchMaterial = (material: THREE.Material): THREE.Material => {
      const next = material.clone();
      next.transparent = opacity < 0.99;
      next.opacity = opacity;
      next.depthWrite = opacity >= 0.99;
      return next;
    };
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map(patchMaterial)
      : patchMaterial(mesh.material);
  });
  return cloned;
}

function SatelliteModel({ opacity, variant, onReady }: { readonly opacity: number; readonly variant: SatelliteVariant; readonly onReady?: () => void }): ReactElement {
  const model = satelliteModelForConstellation(variant);
  const { scene } = useGLTF(model.path);
  const cloned = useMemo(() => cloneDisplayAsset(scene, opacity), [opacity, scene]);
  useEffect(() => { onReady?.(); }, [onReady]);
  return <group
    rotation={[model.rotation[0], model.rotation[1], model.rotation[2]]}
    scale={model.scale * SATELLITE_STAGE_SCALE}
  >
    <primitive object={cloned} position={[model.centerOffset[0], model.centerOffset[1], model.centerOffset[2]]} />
  </group>;
}

function SatelliteFallback({ color, opacity }: { readonly color: string; readonly opacity: number }): ReactElement {
  return <>
    <mesh><boxGeometry args={[.38, .22, .29]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.45} metalness={.55} roughness={.28} transparent opacity={opacity} /></mesh>
    <mesh position={[-.62, 0, 0]}><boxGeometry args={[.64, .026, .3]} /><meshStandardMaterial color="#163c4c" emissive={color} emissiveIntensity={.16} metalness={.7} roughness={.35} transparent opacity={opacity} /></mesh>
    <mesh position={[.62, 0, 0]}><boxGeometry args={[.64, .026, .3]} /><meshStandardMaterial color="#163c4c" emissive={color} emissiveIntensity={.16} metalness={.7} roughness={.35} transparent opacity={opacity} /></mesh>
    <mesh position={[0, -.17, 0]}><cylinderGeometry args={[.08, .13, .15, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={.55} transparent opacity={opacity} /></mesh>
  </>;
}

function Sat({ p, color, label, showLabel = true, tone = 'context', opacity = 1, scale = 1, variant = 'starlink', onAssetStatusChange }: { p: P; color: string; label: string; showLabel?: boolean; tone?: 'serving' | 'candidate' | 'context'; opacity?: number; scale?: number; variant?: SatelliteVariant; onAssetStatusChange?: VisualLabSceneProps['onAssetStatusChange'] }) {
  const assetKey = `satellite-${variant}` as const;
  return <group position={p} scale={scale}>
    <AssetBoundary fallback={<SatelliteFallback color={color} opacity={opacity} />} onError={() => onAssetStatusChange?.(assetKey, 'error')}>
      <Suspense fallback={<SatelliteFallback color={color} opacity={opacity} />}>
        <SatelliteModel opacity={opacity} variant={variant} onReady={() => onAssetStatusChange?.(assetKey, 'ready')} />
      </Suspense>
    </AssetBoundary>
    <mesh position={[0, -.2, 0]}><sphereGeometry args={[.06, 12, 8]} /><meshBasicMaterial color={color} transparent opacity={Math.min(1, opacity + .1)} /></mesh>
    {showLabel ? <Label position={[0, .4, 0]} tone={tone}>{label}</Label> : null}
  </group>;
}

function NtpUSubstrateModel({ opacity, onReady }: { readonly opacity: number; readonly onReady?: () => void }): ReactElement {
  const { scene } = useGLTF(NTPU_MODEL_PATH);
  const prepared = useMemo(() => {
    const cloned = cloneDisplayAsset(scene, opacity);
    const bounds = new THREE.Box3().setFromObject(cloned);
    const size = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    const horizontalExtent = Math.max(size.x, size.z, 1);
    const scale = NTPU_SUBSTRATE_WIDTH_WORLD / horizontalExtent;

    cloned.scale.setScalar(scale);
    cloned.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    return cloned;
  }, [opacity, scene]);
  useEffect(() => { onReady?.(); }, [onReady]);

  return <primitive object={prepared} />;
}

function NtpUSubstrateFallback(): ReactElement {
  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .065, 0]}>
    <planeGeometry args={[NTPU_SUBSTRATE_WIDTH_WORLD, NTPU_SUBSTRATE_DEPTH_WORLD]} />
    <meshBasicMaterial color={C.teal} transparent opacity={.06} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}

function Earth({ globalFrame, globalSceneFrame, globalArtifact, globalSourceIdentity, globalStatus, globalError, theme, locale }: {
  readonly globalFrame?: SimulationAnalysisFrame | null;
  readonly globalSceneFrame?: VisualLabGlobalSceneFrame | null;
  readonly globalArtifact?: VisualLabGlobalConstellationArtifact | null;
  readonly globalSourceIdentity?: VisualLabGlobalSourceIdentity;
  readonly globalStatus?: VisualLabGlobalSceneStatus;
  readonly globalError?: string | null;
  readonly theme: 'dark' | 'light';
  readonly locale: 'zh-Hant' | 'en';
}): ReactElement {
  const frame = globalFrame ?? null;
  const adaptedFrame = useMemo(
    () => globalSceneFrame !== undefined
      ? globalSceneFrame
      : frame === null ? null : adaptSimulationAnalysisFrameToVisualLabGlobalScene(frame, {
      sourceIdentity: globalSourceIdentity,
    }),
    [frame, globalSceneFrame, globalSourceIdentity],
  );
  return <VisualLabGlobalScene
    frame={adaptedFrame}
    artifact={globalArtifact}
    status={globalStatus ?? (adaptedFrame === null ? 'idle' : 'ready')}
    error={globalError}
    theme={theme}
    locale={locale}
  />;
}
function Observer({ copy, showLabel }: { readonly copy: SceneCopy; readonly showLabel: boolean }) {
  return <group><mesh position={[0, .22, 0]}><cylinderGeometry args={[.15, .22, .44, 16]} /><meshStandardMaterial color={C.rose} emissive={C.rose} emissiveIntensity={.45} /></mesh><mesh position={[0, .5, 0]}><sphereGeometry args={[.11, 16, 10]} /><meshStandardMaterial color={C.rose} emissive={C.rose} emissiveIntensity={.65} /></mesh><mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .04, 0]}><ringGeometry args={[.3, .33, 32]} /><meshBasicMaterial color={C.rose} transparent opacity={.78} side={THREE.DoubleSide} /></mesh>{showLabel ? <Label position={[0, .72, 0]} tone="observer">{copy.observer}</Label> : null}</group>;
}
function EmptyLocalState({ status, error, copy }: { readonly status?: VisualLabGlobalSceneStatus; readonly error?: string | null; readonly copy: SceneCopy }): ReactElement {
  const message = status === 'error'
    ? `${copy.unavailable}${error ? ` · ${error}` : ''}`
    : copy.building;
  return <Html center position={[0, 1.2, 0]}><span role={status === 'error' ? 'alert' : 'status'} style={{ color: status === 'error' ? C.coral : C.white, background: 'rgba(5,17,24,.9)', border: `1px solid ${status === 'error' ? C.coral : C.teal}`, borderRadius: 5, fontSize: 15, lineHeight: 1.45, padding: '9px 12px' }}>{message}</span></Html>;
}

function Sky({ plan, density, focus, constellation, status, error, light, copy, showLabels, satelliteDisplayMode, onAssetStatusChange }: { readonly plan: VisualLabLocalScenePlan | null; readonly density: VisualLabDensity; readonly focus: VisualLabFocus; readonly constellation: SatelliteVariant; readonly status?: VisualLabGlobalSceneStatus; readonly error?: string | null; readonly light: boolean; readonly copy: SceneCopy; readonly showLabels: boolean; readonly satelliteDisplayMode: VisualLabSatelliteDisplayMode; readonly onAssetStatusChange?: VisualLabSceneProps['onAssetStatusChange'] }) {
  if (plan === null) return <EmptyLocalState status={status} error={error} copy={copy} />;
  const showContext = satelliteDisplayMode === 'multi' && density !== 'clean';
  const full = density === 'full';
  const servingTrack = plan.trajectory.serving.points.map(item => point(item.positionWorld));
  return <group data-local-frame-id={plan.frameId}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.08, 0]}><planeGeometry args={[8.6, 7.1]} /><meshStandardMaterial color={light ? '#e5dccd' : '#0b2632'} roughness={.94} /></mesh><gridHelper args={[8.4, 14, C.teal, light ? '#99aaa5' : '#123743']} position={[0, -.03, 0]} /><Observer copy={copy} showLabel={showLabels} />
    {servingTrack.length > 1 ? <Line points={servingTrack} color={C.yellow} lineWidth={2.2} transparent opacity={.88} /> : null}
    <Sat p={point(plan.serving.positionWorld)} color={C.yellow} label={`${copy.servingSatellite} · ${plan.serving.satelliteId}`} showLabel={showLabels} tone="serving" scale={1.02} variant={constellation} onAssetStatusChange={onAssetStatusChange} />
    {plan.candidate.availability === 'available' ? <Sat p={point(plan.candidate.positionWorld)} color={C.blue} label={`${copy.candidateSatellite} · ${plan.candidate.satelliteId}`} showLabel={showLabels} tone="candidate" opacity={focus === 'handover' ? 1 : .78} scale={.96} variant={constellation} onAssetStatusChange={onAssetStatusChange} /> : null}
    {showContext ? plan.context.satellites.slice(0, full ? 12 : 4).map(satellite => <Sat key={satellite.satelliteId} p={point(satellite.positionWorld)} color={C.grey} label={satellite.satelliteId} showLabel={false} tone="context" opacity={full ? .72 : .44} scale={.62} variant={constellation} onAssetStatusChange={onAssetStatusChange} />) : null}
    <Html center position={[0, -.51, 0]} className="vlab-caption"><span style={{ color: C.white, fontSize: 14, letterSpacing: '.04em' }}>{copy.observerView} · archived TLE / SGP4 · {plan.instantTaipei}</span></Html>
  </group>;
}

function Cell({ cell, radiusWorld, tone, label, reuseGroup, showReuse }: { readonly cell: VisualLabLocalCell; readonly radiusWorld: number; readonly tone: 'context' | 'active' | 'intra'; readonly label: boolean; readonly reuseGroup?: number; readonly showReuse?: boolean }) {
  const center = point(cell.positionWorld);
  const active = tone !== 'context';
  const color = tone === 'intra'
    ? resolveSinrLiveConeRoleStyle('pulse', {}, { kind: 'intra' }).color
    : tone === 'active' ? C.yellow : C.grey;
  const reuseColors = [C.teal, C.violet, C.coral, C.blue, C.rose, C.cyan, C.yellow] as const;
  const reuseColor = reuseColors[Math.abs(reuseGroup ?? 0) % reuseColors.length];
  return <group>
    <VisualLabHexFootprint
      x={center[0]}
      z={center[2]}
      radius={radiusWorld}
      outerColor={C.white}
      innerColor={color}
      fillOpacity={active ? .16 : .065}
      outerOpacity={active ? .96 : .68}
      innerOpacity={active ? .98 : .72}
      y={.064}
    />
    {showReuse ? <mesh position={[center[0], .071, center[2]]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radiusWorld * .11, radiusWorld * .17, 20]} />
      <meshBasicMaterial color={reuseColor} transparent opacity={.82} depthWrite={false} side={THREE.DoubleSide} />
    </mesh> : null}
    {label ? <Label position={[center[0], .13, center[2]]} tone={active ? 'serving' : 'context'}>Cell {cell.index + 1}</Label> : null}
  </group>;
}

/** Display substrate only: the accepted seven experiment cells sit on this 37-cell field. */
function BackgroundHexGrid({ radiusWorld, light, visible = true }: { readonly radiusWorld: number; readonly light: boolean; readonly visible?: boolean }): ReactElement | null {
  if (!visible) return null;
  const cells = useMemo(() => buildVisualLabHexField(radiusWorld, {
    widthWorld: NTPU_SUBSTRATE_WIDTH_WORLD,
    depthWorld: NTPU_SUBSTRATE_DEPTH_WORLD,
  }), [radiusWorld]);
  const outerColor = light ? '#f5f1e8' : '#bdc9cc';
  const innerColor = light ? '#879396' : '#71868c';
  return <group name="visual-lab-background-hex-grid">
    {cells.map(cell => <VisualLabHexFootprint
      key={cell.cellId}
      x={cell.x}
      z={cell.z}
      radius={radiusWorld}
      outerColor={outerColor}
      innerColor={innerColor}
      fillOpacity={light ? .015 : .025}
      outerOpacity={light ? .26 : .34}
      innerOpacity={light ? .22 : .3}
      y={.052}
    />)}
  </group>;
}

function UeDots({ plan }: { readonly plan: VisualLabLocalScenePlan }) {
  const visibleUsers = plan.substrate.users;
  const positions = useMemo(() => {
    const a = new Float32Array(visibleUsers.length * 3);
    visibleUsers.forEach((user, index) => {
      a[index * 3] = user.positionWorld[0];
      a[index * 3 + 1] = .19;
      a[index * 3 + 2] = user.positionWorld[2];
    });
    return a;
  }, [visibleUsers]);
  return <group name="visual-lab-multi-ue" renderOrder={5}>
    <points frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color={C.cyan} size={.105} sizeAttenuation transparent opacity={.9} depthTest={false} depthWrite={false} />
    </points>
    <points frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial color={C.white} size={.042} sizeAttenuation transparent opacity={.98} depthTest={false} depthWrite={false} />
    </points>
  </group>;
}

function boundedPoint(x: number, z: number, centerX: number, centerZ: number, radius: number): { readonly x: number; readonly z: number } {
  const dx = x - centerX;
  const dz = z - centerZ;
  const distance = Math.hypot(dx, dz);
  if (distance <= radius || distance === 0) return { x, z };
  const scale = radius / distance;
  return { x: centerX + dx * scale, z: centerZ + dz * scale };
}

function Ue({ accepted, selected, bounds, onMove, userId, copy, showLabel }: { readonly accepted: { readonly x: number; readonly z: number }; readonly selected?: { readonly x: number; readonly z: number } | null; readonly bounds: { readonly x: number; readonly z: number; readonly radius: number }; readonly onMove?: (x: number, z: number) => void; readonly userId: string; readonly copy: SceneCopy; readonly showLabel: boolean }) {
  const ring = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);
  const controls = useThree(s => s.controls) as { enabled: boolean } | null;
  const dragPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), -.11), []);
  const dragPoint = useMemo(() => new THREE.Vector3(), []);
  const displayed = selected ?? accepted;
  const bounded = boundedPoint(displayed.x, displayed.z, bounds.x, bounds.z, bounds.radius);
  const x = clamp(bounded.x);
  const z = clamp(bounded.z);
  const update = (event: ThreeEvent<PointerEvent>): void => {
    if (!onMove || !event.ray.intersectPlane(dragPlane, dragPoint)) return;
    event.stopPropagation();
    const next = boundedPoint(clamp(dragPoint.x), clamp(dragPoint.z), bounds.x, bounds.z, bounds.radius);
    onMove(next.x, next.z);
  };
  const finishDrag = (event: ThreeEvent<PointerEvent>): void => {
    if (!dragging.current) return;
    update(event);
    dragging.current = false;
    if (controls) controls.enabled = true;
    const target = event.nativeEvent.target as Element | null;
    if (target?.hasPointerCapture(event.pointerId)) target.releasePointerCapture(event.pointerId);
  };
  useFrame(({ clock }) => { if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 2.3) * .16); });
  return <group
    position={[x, .24, z]}
    onPointerDown={(event) => {
      if (!onMove) return;
      dragging.current = true;
      if (controls) controls.enabled = false;
      const target = event.nativeEvent.target as Element | null;
      target?.setPointerCapture(event.pointerId);
      update(event);
    }}
    onPointerMove={(event) => { if (dragging.current) update(event); }}
    onPointerUp={finishDrag}
    onPointerCancel={(event) => {
      dragging.current = false;
      if (controls) controls.enabled = true;
      event.stopPropagation();
    }}
  ><mesh><sphereGeometry args={[.13, 18, 14]} /><meshStandardMaterial color={C.coral} emissive={C.coral} emissiveIntensity={.72} /></mesh><mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.16, 0]}><torusGeometry args={[.23, .026, 6, 32]} /><meshBasicMaterial color={C.coral} transparent opacity={.86} /></mesh>{showLabel ? <Label position={[0, .38, 0]} tone="ue">{copy.representativeUe} · {userId}</Label> : null}</group>;
}
function OffAxisGeometry({ origin, beamTarget, user, angleRad, copy, showLabel }: { readonly origin: P; readonly beamTarget: P; readonly user: P; readonly angleRad: number; readonly copy: SceneCopy; readonly showLabel: boolean }) {
  const arc = useMemo(() => {
    const start = new THREE.Vector3(...beamTarget).sub(new THREE.Vector3(...origin)).normalize();
    const end = new THREE.Vector3(...user).sub(new THREE.Vector3(...origin)).normalize();
    const rotation = new THREE.Quaternion().setFromUnitVectors(start, end);
    const identity = new THREE.Quaternion();
    const center = new THREE.Vector3(...origin);
    const radius = .72;
    const points = Array.from({ length: 20 }, (_unused, index) => {
      const direction = start.clone().applyQuaternion(
        new THREE.Quaternion().slerpQuaternions(identity, rotation, index / 19),
      );
      const position = center.clone().add(direction.multiplyScalar(radius));
      return [position.x, position.y, position.z] as P;
    });
    const labelPoint = points[Math.floor(points.length / 2)] ?? origin;
    return { points, labelPoint };
  }, [beamTarget, origin, user]);
  const angleDeg = THREE.MathUtils.radToDeg(angleRad);
  return <>
    <Line points={[origin, beamTarget]} color={C.yellow} lineWidth={1.25} dashed dashSize={.1} gapSize={.08} transparent opacity={.55} />
    <Line points={[origin, user]} color={C.yellow} lineWidth={3} transparent opacity={.95} />
    <Line points={arc.points} color={C.white} lineWidth={2.5} transparent opacity={.92} />
    {showLabel ? <Label position={[arc.labelPoint[0] + .22, arc.labelPoint[1] + .12, arc.labelPoint[2]]} tone="serving">{copy.offAxisAngle} θ {angleDeg.toFixed(2)}°</Label> : null}
  </>;
}
/** Display-only marker for the accepted beam power cap. */
function PowerBoundary({ p, scale, opacity }: { readonly p: P; readonly scale: number; readonly opacity: number }) {
  const radius = .4 * scale;
  return <mesh position={[p[0], .084, p[2]]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[radius * .9, radius, 32]} />
    <meshBasicMaterial color={C.coral} transparent opacity={opacity} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}
/** Display-only halo projected from canonical interferenceW/noiseW. */
function InterferenceHalo({ p, intensity }: { readonly p: P; readonly intensity: number }) {
  if (intensity <= 0) return null;
  const scale = .9 + intensity * 1.2;
  return <mesh position={[p[0], .087, p[2]]} rotation={[-Math.PI / 2, 0, 0]}>
    <ringGeometry args={[.44 * scale, .47 * scale, 32]} />
    <meshBasicMaterial color={C.rose} transparent opacity={.08 + intensity * .2} depthWrite={false} side={THREE.DoubleSide} />
  </mesh>;
}
function SpaceStars(): ReactElement {
  const positions = useMemo(() => {
    const values = new Float32Array(240 * 3);
    for (let index = 0; index < 240; index += 1) {
      // Deterministic shell: stable between React renders and cheap to draw.
      const u = (index + .5) / 240;
      const theta = Math.acos(1 - 2 * u);
      const phi = (index * 2.399963229728653) % (Math.PI * 2);
      const radius = 22 + (index % 7) * .55;
      const offset = index * 3;
      values[offset] = radius * Math.sin(theta) * Math.cos(phi);
      values[offset + 1] = radius * Math.cos(theta) + 5;
      values[offset + 2] = radius * Math.sin(theta) * Math.sin(phi);
    }
    return values;
  }, []);
  return <points name="visual-lab-space-stars" renderOrder={-10}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]} />
    </bufferGeometry>
    <pointsMaterial color="#dff7ff" size={.045} sizeAttenuation transparent opacity={.72} depthWrite={false} fog={false} />
  </points>;
}

/** Display-only rays for the aggregate interference already present in the
 * accepted frame.  They deliberately carry no per-satellite power value. */
function InterferenceTrace({ from, to, intensity }: { readonly from: P; readonly to: P; readonly intensity: number }): ReactElement {
  return <Line
    points={[from, to]}
    color={C.rose}
    lineWidth={.8}
    dashed
    dashSize={.12}
    gapSize={.14}
    transparent
    opacity={.12 + intensity * .2}
  />;
}

/**
 * A candidate comparison is a real same-instant TLE link, but it is not yet
 * the serving beam.  Keep that distinction visible with a quiet dashed
 * monitor path instead of a full blue cone.  The cone is reserved for an
 * accepted handover envelope, so this cannot be mistaken for active service.
 */
function CandidateMonitorTrace({ from, to, emphasis = false }: { readonly from: P; readonly to: P; readonly emphasis?: boolean }): ReactElement {
  return <Line
    points={[from, to]}
    color={C.blue}
    lineWidth={emphasis ? 1.15 : .72}
    dashed
    dashSize={emphasis ? .16 : .11}
    gapSize={emphasis ? .12 : .16}
    transparent
    opacity={emphasis ? .55 : .28}
  />;
}
function Service({ plan, density, focus, selected, onUeMove, storyBeamFocus, storyDirection, guidedReplayProgress, constellation, status, error, light, copy, showLabels, satelliteDisplayMode, ueDisplayMode, beamWidthDraftScale = 1, onAssetStatusChange }: { readonly plan: VisualLabLocalScenePlan | null; readonly density: VisualLabDensity; readonly focus: VisualLabFocus; readonly selected?: { readonly x: number; readonly z: number } | null; readonly onUeMove?: (x: number, z: number) => void; readonly storyBeamFocus?: VisualLabStoryBeamFocus | null; readonly storyDirection?: VisualLabStorySceneDirection | null; readonly guidedReplayProgress?: VisualLabGuidedReplayProgress; readonly constellation: SatelliteVariant; readonly status?: VisualLabGlobalSceneStatus; readonly error?: string | null; readonly light: boolean; readonly copy: SceneCopy; readonly showLabels: boolean; readonly satelliteDisplayMode: VisualLabSatelliteDisplayMode; readonly ueDisplayMode: VisualLabUeDisplayMode; readonly beamWidthDraftScale?: number; readonly onAssetStatusChange?: VisualLabSceneProps['onAssetStatusChange'] }) {
  if (plan === null) return <EmptyLocalState status={status} error={error} copy={copy} />;
  const context = satelliteDisplayMode === 'multi';
  const full = density === 'full';
  const substrateOpacity = substrateOpacityForDensity(density);
  const representative = plan.representative;
  const representativeAvailable = representative.availability === 'available';
  const storyUser = storyBeamFocus === null || storyBeamFocus === undefined
    ? null
    : plan.substrate.users.find(user => user.index === storyBeamFocus.userIndex) ?? null;
  const focusedUser = storyUser ?? (representativeAvailable ? representative.user : null);
  const storyFocused = storyUser !== null;
  const acceptedUe = focusedUser === null
    ? null
    : { x: focusedUser.positionWorld[0], z: focusedUser.positionWorld[2] };
  const focusedUserId = focusedUser === null
    ? null
    : 'userId' in focusedUser ? focusedUser.userId : `ue-${focusedUser.index + 1}`;
  const focusedCell = focusedUser === null
    ? null
    : plan.substrate.cells.find(cell => cell.index === focusedUser.cellIndex) ?? null;
  const editableSelection = storyFocused ? null : selected;
  const ue: P | null = acceptedUe === null ? null : [editableSelection?.x ?? acceptedUe.x, .24, editableSelection?.z ?? acceptedUe.z];
  const acceptedUePoint: P | null = acceptedUe === null ? null : [acceptedUe.x, .24, acceptedUe.z];
  const cellRadiusWorld = plan.substrate.cellRadiusKm * plan.substrate.worldUnitsPerKm;
  const servingPosition = point(plan.serving.positionWorld);
  const candidatePosition = plan.candidate.availability === 'available'
    ? point(plan.candidate.positionWorld)
    : null;
  const storyCurrentBeamId = storyBeamFocus?.currentBeamId ?? null;
  const activeBeamTarget = storyCurrentBeamId !== null
    ? plan.activeBeamTargets.targets.find(target => target.beamId === storyCurrentBeamId) ?? null
    : focusedUser === null
      ? null
      : plan.activeBeamTargets.targets.find(target => target.cellIndex === focusedUser.cellIndex) ?? null;
  const activeCellIndex = activeBeamTarget?.cellIndex ?? focusedUser?.cellIndex ?? null;
  const intraTargetCellIndex = storyBeamFocus?.phase === 'decision' || storyBeamFocus?.phase === 'after'
    ? cellIndexForBeamId(plan.activeBeamTargets.targets, storyBeamFocus.toBeamId)
    : null;
  const candidateSelectedBeamId = plan.candidateBeamLayout.selectedBeamId;
  const candidateTargets = plan.candidateBeamLayout.targets;
  const demoInterHandover = storyDirection?.storyId.startsWith('demo:inter-handover') === true;
  const demoIntraHandover = storyDirection?.storyId.startsWith('demo:intra-handover') === true;
  const canonicalInterHandover = storyDirection === null || storyDirection === undefined
    ? canonicalHandoverPresentation(plan.handover, plan.interpolation.visualOffsetSec)
    : null;
  const intraTransitionFraction = demoIntraHandover === false || storyBeamFocus === null || storyBeamFocus === undefined
    ? 0
    : guidedReplayProgress?.stage === 'switch'
      ? smoothUnit(guidedReplayProgress.phaseFraction)
      : guidedReplayProgress?.stage === 'settle' || guidedReplayProgress?.stage === 'smooth-return'
        ? 1
        : 0;
  const guidedInterHandover = guidedHandoverPresentation(storyDirection, guidedReplayProgress);
  const canonicalVisualInterHandover = guidedInterHandover === null ? canonicalInterHandover : null;
  const directedHandover = guidedInterHandover ?? canonicalVisualInterHandover;
  const directedFrom = directedHandover === null
    ? null
    : plan.satellites.find(item => item.satelliteId === directedHandover.fromSatelliteId) ?? null;
  const directedTo = directedHandover === null
    ? null
    : plan.satellites.find(item => item.satelliteId === directedHandover.toSatelliteId) ?? null;
  // A candidate-rich accepted trace remains the preferred source.  The
  // `demo:*` story is an explicitly presentation-only fallback for teaching
  // when the current run has no candidate position; it gets a stable nearby
  // stage position and never mutates the canonical local scene plan.
  const demoTargetPosition: P | null = directedHandover !== null
    && storyDirection?.storyId.startsWith('demo:inter-handover')
    && directedTo === null
    ? [servingPosition[0] + 3.1, servingPosition[1] * .96, servingPosition[2] - 1.7]
    : null;
  const directedHandoverAvailable = directedHandover !== null
    && directedFrom !== null
    && (directedTo !== null || demoTargetPosition !== null);
  const sourcePosition = directedHandoverAvailable ? point(directedFrom.positionWorld) : servingPosition;
  const targetPosition = directedHandoverAvailable
    ? directedTo === null ? demoTargetPosition : point(directedTo.positionWorld)
    : candidatePosition;
  const sourceBeamOpacity = directedHandoverAvailable ? directedHandover.sourceBeamOpacity : 1;
  const targetCandidateOpacity = directedHandoverAvailable ? directedHandover.targetCandidateOpacity : 0;
  const targetServiceOpacity = directedHandoverAvailable ? directedHandover.targetServiceOpacity : 0;
  const canonicalTargetKeepsCandidateTone = directedHandover?.source === 'canonical-trace';
  const targetIsCandidateTone = demoInterHandover || canonicalTargetKeepsCandidateTone || targetServiceOpacity <= targetCandidateOpacity;
  const primaryTargetPoint: P | null = ue !== null
    ? [ue[0], .075, ue[2]]
    : activeBeamTarget === null ? null : [activeBeamTarget.targetPositionWorld[0], .075, activeBeamTarget.targetPositionWorld[2]];

  return <group>
    <AssetBoundary fallback={<NtpUSubstrateFallback />} onError={() => onAssetStatusChange?.('ntpu-substrate', 'error')}>
      <Suspense fallback={<NtpUSubstrateFallback />}>
        <group position={[0, 0, 0]} rotation={[0, 0, 0]}>
          <NtpUSubstrateModel opacity={substrateOpacity} onReady={() => onAssetStatusChange?.('ntpu-substrate', 'ready')} />
        </group>
      </Suspense>
    </AssetBoundary>
    <BackgroundHexGrid radiusWorld={cellRadiusWorld} light={light} visible={density !== 'clean'} />
    {plan.substrate.cells.map((cell, cellOrder) => <Cell
      key={cell.index}
      cell={cell}
      radiusWorld={cellRadiusWorld}
      tone={cell.index === intraTargetCellIndex ? 'intra' : cell.index === activeCellIndex ? 'active' : 'context'}
      label={false}
      reuseGroup={plan.render.reuse.groupByCell[cellOrder]}
      showReuse={density !== 'clean' && focus === 'handover' && plan.render.reuse.groups > 1}
    />)}
    {ueDisplayMode === 'multi' ? <UeDots plan={plan} /> : null}
    {acceptedUe !== null && focusedCell !== null && focusedUserId !== null ? <Ue accepted={acceptedUe} selected={editableSelection} bounds={{ x: focusedCell.positionWorld[0], z: focusedCell.positionWorld[2], radius: cellRadiusWorld * .96 }} onMove={storyFocused ? undefined : onUeMove} userId={focusedUserId} copy={copy} showLabel={showLabels} /> : null}
    {directedHandoverAvailable ? <>
      {sourceBeamOpacity > .04 ? <Sat p={sourcePosition} color={C.yellow} label={`${copy.servingSatellite} · ${directedHandover.fromSatelliteId}`} showLabel={showLabels && sourceBeamOpacity > .08} tone="serving" opacity={sourceBeamOpacity} scale={.96} variant={constellation} onAssetStatusChange={onAssetStatusChange} /> : null}
      <Sat p={targetPosition!} color={targetIsCandidateTone ? C.blue : C.yellow} label={`${targetIsCandidateTone ? copy.candidateSatellite : copy.servingSatellite} · ${directedHandover.toSatelliteId}`} showLabel={showLabels} tone={targetIsCandidateTone ? 'candidate' : 'serving'} opacity={.9} scale={.9} variant={constellation} onAssetStatusChange={onAssetStatusChange} />
    </> : <Sat p={servingPosition} color={C.yellow} label={`${copy.servingSatellite} · ${plan.serving.satelliteId}`} showLabel={showLabels} tone="serving" scale={.96} variant={constellation} onAssetStatusChange={onAssetStatusChange} />}
    {plan.activeBeamTargets.targets.map(target => {
      const targetPoint: P = [target.targetPositionWorld[0], .075, target.targetPositionWorld[2]];
      const active = activeBeamTarget !== null && target.beamId === activeBeamTarget.beamId;
      const intraTarget = (storyBeamFocus?.phase === 'decision' || storyBeamFocus?.phase === 'after')
        && target.cellIndex === intraTargetCellIndex;
      const role: SinrLiveConeRole = intraTarget ? 'pulse' : active ? 'hero' : 'servingFan';
      const style = resolveSinrLiveConeRoleStyle(role, {}, intraTarget
        ? { kind: 'intra', opacity: .92 }
        : active ? { opacity: .62 + .22 * plan.render.beam.intensity } : {});
      const sourceStyle = intraTarget
        ? resolveSinrLiveConeRoleStyle('hero', {}, { opacity: .62 + .22 * plan.render.beam.intensity })
        : style;
      const metricColor = intraTarget ? C.coral : active ? C.yellow : C.grey;
      const beamRadius = (
        active || intraTarget
          ? SERVICE_PRIMARY_BEAM_RADIUS_RATIO * plan.render.beam.coneWidthScale * beamWidthDraftScale
          : SERVICE_CONTEXT_BEAM_RADIUS_RATIO
      ) * (cellRadiusWorld / .8) * (intraTarget ? 1.18 : 1);
      return <group key={`${directedHandoverAvailable ? directedHandover.fromSatelliteId : plan.serving.satelliteId}:${target.beamId}`}>
        <VisualLabBeamCone from={sourcePosition} to={targetPoint} radius={beamRadius} role={intraTarget ? 'hero' : role} opacity={sourceStyle.opacity * sourceBeamOpacity * (intraTarget ? 1 - intraTransitionFraction : 1)} />
        {intraTarget && intraTransitionFraction > .001 ? <VisualLabBeamCone from={sourcePosition} to={targetPoint} radius={beamRadius * 1.12} role="pulse" kind="intra" opacity={style.opacity * intraTransitionFraction} /> : null}
        {active ? <PowerBoundary p={targetPoint} scale={plan.render.beam.capBoundaryScale} opacity={.18 + plan.render.beam.powerUtilization * .24} /> : null}
        {active ? <InterferenceHalo p={targetPoint} intensity={plan.render.interference.intensity} /> : null}
        {showLabels && target.metric !== null ? <BeamMetricLabel
          position={[targetPoint[0], targetPoint[1] + .34, targetPoint[2]]}
          metric={target.metric}
          color={metricColor}
          emphasized={target.beamId === activeBeamTarget?.beamId || intraTarget}
        /> : null}
      </group>;
    })}
    {directedHandoverAvailable && targetPosition !== null && primaryTargetPoint !== null && targetCandidateOpacity > .005 ? <VisualLabBeamCone
      from={targetPosition}
      to={primaryTargetPoint}
      radius={CANDIDATE_PRIMARY_BEAM_RADIUS_RATIO * (cellRadiusWorld / .8)}
      role="candidatePrimary"
      opacity={.9 * targetCandidateOpacity}
    /> : null}
    {directedHandoverAvailable && targetPosition !== null && targetServiceOpacity > .005 ? plan.activeBeamTargets.targets.map(target => {
      const targetPoint: P = [target.targetPositionWorld[0], .075, target.targetPositionWorld[2]];
      const active = activeBeamTarget !== null && target.beamId === activeBeamTarget.beamId;
      // The direct inter-handover story keeps the acquired target blue after
      // the switch; it must not relabel the new candidate back to yellow.
      const role: SinrLiveConeRole = active
        ? demoInterHandover || canonicalTargetKeepsCandidateTone ? 'candidatePrimary' : 'hero'
        : 'servingFan';
      const style = resolveSinrLiveConeRoleStyle(role, {}, active ? { opacity: .62 + .22 * plan.render.beam.intensity } : {});
      const beamRadius = (active
        ? SERVICE_PRIMARY_BEAM_RADIUS_RATIO * plan.render.beam.coneWidthScale * beamWidthDraftScale
        : SERVICE_CONTEXT_BEAM_RADIUS_RATIO) * (cellRadiusWorld / .8);
      return <VisualLabBeamCone key={`new-service-${directedHandover.toSatelliteId}:${target.beamId}`} from={targetPosition} to={targetPoint} radius={beamRadius} role={role} opacity={style.opacity * targetServiceOpacity} />;
    }) : null}
    {focus === 'geometry' && !storyFocused && selected == null && acceptedUePoint !== null && activeBeamTarget !== null ? <OffAxisGeometry
      origin={servingPosition}
      beamTarget={[activeBeamTarget.targetPositionWorld[0], .075, activeBeamTarget.targetPositionWorld[2]]}
      user={acceptedUePoint}
      angleRad={plan.render.beam.offAxisAngleRad}
      copy={copy}
      showLabel={showLabels}
    /> : null}
    {!directedHandoverAvailable && plan.candidate.availability === 'available' && candidatePosition !== null ? <>
      <Sat p={candidatePosition} color={C.blue} label={`${copy.candidateSatellite} · ${plan.candidate.satelliteId}`} showLabel={showLabels} tone="candidate" opacity={focus === 'handover' ? 1 : .78} scale={.88} variant={constellation} onAssetStatusChange={onAssetStatusChange} />
    </> : null}
    {context ? plan.context.satellites
      .filter(satellite => !directedHandoverAvailable || (satellite.satelliteId !== directedHandover.fromSatelliteId && satellite.satelliteId !== directedHandover.toSatelliteId))
      .slice(0, full ? 10 : 6)
      .map(satellite => <Sat key={`service-${satellite.satelliteId}`} p={point(satellite.positionWorld)} color={C.grey} label={satellite.satelliteId} showLabel={false} tone="context" opacity={.52} scale={.58} variant={constellation} onAssetStatusChange={onAssetStatusChange} />) : null}
    {context && primaryTargetPoint !== null && plan.render.interference.intensity > 0 ? plan.context.satellites
      .filter(satellite => !directedHandoverAvailable || (satellite.satelliteId !== directedHandover.fromSatelliteId && satellite.satelliteId !== directedHandover.toSatelliteId))
      .slice(0, full ? 10 : 6)
      .map(satellite => <InterferenceTrace
        key={`interference-${satellite.satelliteId}`}
        from={point(satellite.positionWorld)}
        to={primaryTargetPoint}
        intensity={plan.render.interference.intensity}
      />) : null}
  </group>;
}

function scaledValue(value: number, unit: string): string {
  const magnitude = Math.abs(value);
  if (magnitude >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)} G${unit}`;
  if (magnitude >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} M${unit}`;
  if (magnitude >= 1_000) return `${(value / 1_000).toFixed(2)} k${unit}`;
  if (magnitude > 0 && magnitude < .001) return `${(value * 1_000_000).toFixed(2)} µ${unit}`;
  if (magnitude > 0 && magnitude < 1) return `${(value * 1_000).toFixed(2)} m${unit}`;
  return `${value.toFixed(2)} ${unit}`;
}

interface VisualLabCameraPose {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

function defaultCameraPose(view: VisualLabView): VisualLabCameraPose {
  const position = view === 'earth'
    ? new THREE.Vector3(8.8, 5.8, 9.4)
    : view === 'sky'
      ? new THREE.Vector3(0, 10.2, 17.4)
      : new THREE.Vector3(0, 7.35, 11.65);
  return {
    position,
    target: new THREE.Vector3(0, view === 'earth' ? 0 : view === 'sky' ? 4.8 : 2.55, 0),
  };
}

function storySatellitePosition(
  plan: VisualLabLocalScenePlan,
  satelliteId: string,
): THREE.Vector3 | null {
  const satellite = plan.satellites.find(item => item.satelliteId === satelliteId);
  return satellite === undefined ? null : new THREE.Vector3(...satellite.positionWorld);
}

function storyCameraPose(
  direction: VisualLabStorySceneDirection,
  plan: VisualLabLocalScenePlan | null | undefined,
): VisualLabCameraPose | null {
  if (plan === null || plan === undefined) return null;
  const from = storySatellitePosition(plan, direction.fromSatelliteId);
  const to = storySatellitePosition(plan, direction.toSatelliteId);
  const user = direction.userIndex === null
    ? plan.representative.availability === 'available'
      ? new THREE.Vector3(...plan.representative.user.positionWorld)
      : null
    : (() => {
        const acceptedUser = plan.substrate.users.find(candidate => candidate.index === direction.userIndex);
        return acceptedUser === undefined ? null : new THREE.Vector3(...acceptedUser.positionWorld);
      })();
  const satelliteFocus = direction.beat === 'before' ? from : direction.beat === 'after' ? to : null;
  const points = [
    satelliteFocus,
    direction.beat === 'decision' ? from : null,
    direction.beat === 'decision' ? to : null,
    user,
  ].filter((value): value is THREE.Vector3 => value !== null);
  if (points.length === 0) return null;
  const target = points
    .reduce((sum, value) => sum.add(value), new THREE.Vector3())
    .multiplyScalar(1 / points.length);
  // Preserve a readable safe frame beside the left-side story cue card.
  target.x -= .48;
  const offset = direction.beat === 'decision'
    ? new THREE.Vector3(5.15, 4.15, 5.25)
    : direction.beat === 'before'
      ? new THREE.Vector3(6.8, 5.25, 7.1)
      : new THREE.Vector3(6.15, 4.8, 6.35);
  return { position: target.clone().add(offset), target };
}

function causalCameraPose(
  cue: VisualLabCausalCameraCue,
  plan: VisualLabLocalScenePlan | null | undefined,
): VisualLabCameraPose | null {
  if (plan === null || plan === undefined || plan.representative.availability !== 'available') return null;
  const representativeUser = plan.representative.user;
  if (representativeUser === null) return null;
  const user = new THREE.Vector3(...representativeUser.positionWorld);
  const serving = new THREE.Vector3(...plan.serving.positionWorld);
  const beamTarget = plan.activeBeamTargets.targets.find(target => (
    target.cellIndex === representativeUser.cellIndex
  ));
  const footprint = beamTarget === undefined
    ? user.clone()
    : new THREE.Vector3(...beamTarget.targetPositionWorld);
  const target = cue.storyId === 'beamwidth'
    ? serving.clone().lerp(user, .58)
    : footprint.clone().lerp(user, .55).setY(.55);
  target.x -= .5;
  const offset = cue.storyId === 'beamwidth'
    ? cue.phase === 'baseline'
      ? new THREE.Vector3(6.35, 4.85, 6.7)
      : cue.phase === 'intervention'
        ? new THREE.Vector3(4.75, 3.5, 5.0)
        : new THREE.Vector3(6.8, 5.2, 7.15)
    : cue.phase === 'baseline'
      ? new THREE.Vector3(6.4, 4.75, 6.65)
      : cue.phase === 'intervention'
        ? new THREE.Vector3(4.55, 3.15, 4.85)
        : new THREE.Vector3(6.55, 5.1, 6.9);
  return { position: target.clone().add(offset), target };
}

function StoryCameraDirector({
  view,
  plan,
  direction,
  causalCue,
  returnProgress,
  enabled,
  controlsRef,
}: {
  readonly view: VisualLabView;
  readonly plan?: VisualLabLocalScenePlan | null;
  readonly direction?: VisualLabStorySceneDirection | null;
  readonly causalCue?: VisualLabCausalCameraCue | null;
  readonly returnProgress?: number | null;
  readonly enabled: boolean;
  readonly controlsRef: MutableRefObject<OrbitControlsImpl | null>;
}): null {
  const camera = useThree((state) => state.camera);
  const desired = useRef<VisualLabCameraPose | null>(null);
  const previousStoryActive = useRef(false);
  const previousView = useRef<VisualLabView | null>(null);

  useEffect(() => {
    const storyActive = (direction !== null && direction !== undefined)
      || (causalCue !== null && causalCue !== undefined);
    const shouldRestoreDefault = !storyActive
      && (previousStoryActive.current || previousView.current !== view);
    let next = storyActive && enabled
      ? direction !== null && direction !== undefined
        ? storyCameraPose(direction, plan)
        : causalCue === null || causalCue === undefined
          ? null
          : causalCameraPose(causalCue, plan)
      : shouldRestoreDefault ? defaultCameraPose(view) : null;
    if (next !== null && direction !== null && direction !== undefined && returnProgress !== null && returnProgress !== undefined) {
      const t = Math.min(1, Math.max(0, returnProgress));
      const eased = t * t * (3 - 2 * t);
      const home = defaultCameraPose(view);
      next = {
        position: next.position.clone().lerp(home.position, eased),
        target: next.target.clone().lerp(home.target, eased),
      };
    }
    const controls = controlsRef.current;
    if (controls !== null) controls.enabled = !(storyActive && enabled);
    if (next !== null) {
      const constrainedNext: VisualLabCameraPose = {
        position: constrainVisualLabCameraPose(view, next.position, next.target),
        target: next.target.clone(),
      };
      const reduceMotion = typeof window !== 'undefined'
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        camera.position.copy(constrainedNext.position);
        if (controls !== null) {
          controls.target.copy(constrainedNext.target);
          controls.update();
        } else {
          camera.lookAt(constrainedNext.target);
        }
        desired.current = null;
      } else {
        desired.current = constrainedNext;
      }
    } else if (storyActive && !enabled) {
      desired.current = null;
    }
    previousStoryActive.current = storyActive;
    previousView.current = view;
  }, [camera, causalCue?.revision, controlsRef, direction?.revision, enabled, plan?.frameId, returnProgress, view]);

  useFrame((_state, delta) => {
    const next = desired.current;
    if (next === null) return;
    const alpha = 1 - Math.exp(-Math.min(delta, .05) * 5.2);
    camera.position.lerp(next.position, alpha);
    const controls = controlsRef.current;
    if (controls !== null) {
      controls.target.lerp(next.target, alpha);
      controls.update();
    } else {
      camera.lookAt(next.target);
    }
    if (
      camera.position.distanceToSquared(next.position) < .0004
      && (controls === null || controls.target.distanceToSquared(next.target) < .0004)
    ) {
      camera.position.copy(next.position);
      if (controls !== null) {
        controls.target.copy(next.target);
        controls.update();
      }
      desired.current = null;
    }
  });

  return null;
}

function Scene({ view, density, focus, beamWidthDraftScale = 1, selectedUe, onUeMove, storyBeamFocus, storyDirection, guidedCandidateEngaged, guidedReplayProgress, storyReturnProgress, causalCameraCue, storyDirectorEnabled = true, constellation, globalFrame, globalSceneFrame, globalArtifact, localScene, globalSourceIdentity, globalStatus, globalError, theme = 'dark', locale = 'zh-Hant', satelliteDisplayMode = DEFAULT_VISUAL_LAB_SATELLITE_DISPLAY_MODE, ueDisplayMode = DEFAULT_VISUAL_LAB_UE_DISPLAY_MODE, showLabels = true, onAssetStatusChange }: VisualLabSceneProps) {
  const satelliteVariant = constellation ?? 'starlink';
  const light = theme === 'light';
  const copy = SCENE_COPY[locale];
  const background = light ? '#eee7da' : C.bg;
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const orbitLimits = visualLabOrbitControlLimits(view);
  const cameraPose = defaultCameraPose(view);
  const directorActive = ((storyDirection !== null && storyDirection !== undefined)
    || (causalCameraCue !== null && causalCameraCue !== undefined)) && storyDirectorEnabled;
  return <><color attach="background" args={[background]} /><fog attach="fog" args={[background, 14, 32]} />{light ? null : <SpaceStars />}<ambientLight intensity={light ? .9 : .68} /><hemisphereLight args={[light ? '#fffaf0' : '#c8f3ff', light ? '#9f968a' : '#081820', light ? 1.05 : .72]} /><directionalLight position={[4, 8, 3]} intensity={light ? 2.5 : 2.1} color="#e5f8ff" /><pointLight position={[-4, 3, -4]} intensity={.8} distance={20} color={C.blue} /><OrbitControls ref={controlsRef} key={view} makeDefault enabled={!directorActive} enableDamping dampingFactor={.08} minDistance={5.2} maxDistance={20} minPolarAngle={orbitLimits.minPolarAngle} maxPolarAngle={orbitLimits.maxPolarAngle} target={[cameraPose.target.x, cameraPose.target.y, cameraPose.target.z]} /><StoryCameraDirector view={view} plan={localScene} direction={storyDirection} causalCue={causalCameraCue} returnProgress={storyReturnProgress} enabled={storyDirectorEnabled} controlsRef={controlsRef} />{view === 'earth' ? <Earth globalFrame={globalFrame} globalSceneFrame={globalSceneFrame} globalArtifact={globalArtifact} globalSourceIdentity={globalSourceIdentity} globalStatus={globalStatus} globalError={globalError} theme={theme} locale={locale} /> : null}{view === 'sky' ? <Sky plan={localScene ?? null} density={density} focus={focus} constellation={satelliteVariant} status={globalStatus} error={globalError} light={light} copy={copy} showLabels={showLabels} satelliteDisplayMode={satelliteDisplayMode} onAssetStatusChange={onAssetStatusChange} /> : null}{view === 'service' ? <Service plan={localScene ?? null} density={density} focus={focus} selected={selectedUe} onUeMove={onUeMove} storyBeamFocus={storyBeamFocus} storyDirection={storyDirection} guidedReplayProgress={guidedReplayProgress} constellation={satelliteVariant} status={globalStatus} error={globalError} light={light} copy={copy} showLabels={showLabels} satelliteDisplayMode={satelliteDisplayMode} ueDisplayMode={ueDisplayMode} beamWidthDraftScale={beamWidthDraftScale} onAssetStatusChange={onAssetStatusChange} /> : null}</>;
}

function useVisualLabWebGlAvailability(): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    const probe = document.createElement('canvas');
    const context = probe.getContext('webgl2', { alpha: false })
      ?? probe.getContext('webgl', { alpha: false });
    if (context === null) {
      setAvailable(false);
      return undefined;
    }
    context.getExtension('WEBGL_lose_context')?.loseContext();
    // Release the capability probe before the real renderer requests its one
    // long-lived context.  This also prevents react-three-fiber from retrying
    // renderer creation on every parent render when WebGL is unavailable.
    const timer = window.setTimeout(() => setAvailable(true), 50);
    return () => window.clearTimeout(timer);
  }, []);
  return available;
}

/** One Canvas over closed global/local plans from the accepted VisualLabSession snapshot. */
export function VisualLabScene(props: VisualLabSceneProps) {
  const copy = SCENE_COPY[props.locale ?? 'zh-Hant'];
  const webglAvailable = useVisualLabWebGlAvailability();
  return <div
    className="vlab-scene"
    role="img"
    aria-label={copy.sceneAria}
    data-global-frame-id={props.globalSceneFrame?.frameId ?? props.globalFrame?.frameId ?? undefined}
    data-global-tle-frame-id={props.globalSceneFrame?.tleFrameId ?? props.globalFrame?.tleFrameId ?? undefined}
    data-global-constellation={props.globalSceneFrame?.constellation ?? props.globalFrame?.provenance.constellation ?? undefined}
    data-global-current-instant-utc={props.globalSceneFrame?.instantUtc ?? props.globalFrame?.instantUtc ?? undefined}
    data-global-requested-instant-utc={props.globalSceneFrame?.requestedInstantUtc ?? props.globalSourceIdentity?.requestedInstantUtc ?? props.globalFrame?.tleState.requestedInstantUtc ?? undefined}
    data-global-accepted-instant-utc={props.globalSceneFrame?.acceptedInstantUtc ?? props.globalSourceIdentity?.acceptedInstantUtc ?? props.globalFrame?.tleState.requestedInstantUtc ?? undefined}
    data-global-artifact-constellation={props.globalArtifact?.constellation ?? undefined}
    data-global-artifact-satellite-count={props.globalArtifact?.satelliteCount ?? undefined}
    data-global-artifact-visible-count={props.globalArtifact?.ntpuVisibleSatelliteCount ?? undefined}
    data-local-frame-id={props.localScene?.frameId ?? undefined}
    data-local-tle-frame-id={props.localScene?.tleFrameId ?? undefined}
    data-local-beam-width-scale={props.localScene?.render.beam.coneWidthScale ?? undefined}
    data-local-off-axis-angle-rad={props.localScene?.render.beam.offAxisAngleRad ?? undefined}
    data-local-beam-intensity={props.localScene?.render.beam.intensity ?? undefined}
    data-local-interference-intensity={props.localScene?.render.interference.intensity ?? undefined}
    data-local-reuse-groups={props.localScene?.render.reuse.groups ?? undefined}
    data-local-beam-layout-count={props.localScene?.substrate.cells.length ?? undefined}
    data-local-active-beam-count={props.localScene?.activeBeamTargets.targets.length ?? undefined}
    data-local-candidate-beam-layout-count={props.localScene?.candidateBeamLayout.layoutCount ?? undefined}
    data-local-candidate-active-beam-count={props.localScene?.candidateBeamLayout.targets.length ?? undefined}
    data-local-candidate-selected-beam-id={props.localScene?.candidateBeamLayout.selectedBeamId ?? undefined}
    data-local-beam-width-draft-scale={props.beamWidthDraftScale ?? 1}
    data-local-satellite-display-mode={props.satelliteDisplayMode ?? DEFAULT_VISUAL_LAB_SATELLITE_DISPLAY_MODE}
    data-local-ue-display-mode={props.ueDisplayMode ?? DEFAULT_VISUAL_LAB_UE_DISPLAY_MODE}
    data-local-system-power-w={props.localScene?.render.energy.systemPowerW ?? undefined}
    data-local-total-rate-bps={props.localScene?.render.energy.totalRateBps ?? undefined}
    data-local-instantaneous-ee-bits-per-j={props.localScene?.render.energy.instantaneousEeBitsPerJ ?? undefined}
    data-story-ue-index={props.storyBeamFocus?.userIndex ?? undefined}
    data-story-from-beam-id={props.storyBeamFocus?.fromBeamId ?? undefined}
    data-story-to-beam-id={props.storyBeamFocus?.toBeamId ?? undefined}
    data-story-current-beam-id={props.storyBeamFocus?.currentBeamId ?? undefined}
    data-story-beat={props.storyBeamFocus?.phase ?? undefined}
    data-story-camera-cue={props.storyDirection?.cameraCue ?? undefined}
    data-guided-candidate-engaged={props.guidedCandidateEngaged === undefined ? undefined : String(props.guidedCandidateEngaged)}
    data-story-return-progress={props.storyReturnProgress ?? undefined}
    data-guided-stage={props.guidedReplayProgress?.stage ?? undefined}
    data-guided-phase-fraction={props.guidedReplayProgress?.phaseFraction ?? undefined}
    data-handover-state={props.localScene?.handover.state ?? undefined}
    data-handover-event={props.localScene?.handover.event ?? undefined}
    data-causal-camera-cue={props.causalCameraCue === null || props.causalCameraCue === undefined ? undefined : `${props.causalCameraCue.storyId}:${props.causalCameraCue.phase}`}
    data-story-director-enabled={props.storyDirection === null || props.storyDirection === undefined ? undefined : String(props.storyDirectorEnabled !== false)}
    data-camera-director-enabled={props.storyDirection === null || props.storyDirection === undefined
      ? props.causalCameraCue === null || props.causalCameraCue === undefined ? undefined : String(props.storyDirectorEnabled !== false)
      : String(props.storyDirectorEnabled !== false)}
    data-webgl-available={webglAvailable === null ? 'checking' : String(webglAvailable)}
    data-scientific-mock="false"
  >{webglAvailable === true
    ? <Canvas className="vlab-canvas" camera={{ position: [0, 7.35, 11.65], fov: 46, near: .01, far: 45 }} dpr={[1, 1.7]} gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}><Scene {...props} /></Canvas>
    : <div className={`vlab-webgl-fallback${webglAvailable === false ? ' is-error' : ''}`} role={webglAvailable === false ? 'alert' : 'status'}>
      <span>{webglAvailable === false ? copy.webglUnavailable : copy.preparing3d}</span>
    </div>}
  </div>;
}

useGLTF.preload(NTPU_MODEL_PATH);
useGLTF.preload(satelliteModelForConstellation('starlink').path);
useGLTF.preload(satelliteModelForConstellation('oneweb').path);
