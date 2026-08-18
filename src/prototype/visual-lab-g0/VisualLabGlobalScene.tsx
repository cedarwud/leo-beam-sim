import { Html, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useMemo, type ReactElement } from 'react';
import * as THREE from 'three';
import {
  VISUAL_LAB_EARTH_RADIUS,
  type VisualLabGlobalPoint,
  type VisualLabGlobalSatellite,
  type VisualLabGlobalSceneFrame,
} from './visualLabGlobalSceneAdapter';
import type { VisualLabGlobalConstellationArtifact } from '../../visualLab/globalConstellation';

export type VisualLabGlobalSceneStatus = 'idle' | 'loading' | 'ready' | 'error';
export type VisualLabGlobalSceneTheme = 'dark' | 'light';
export type VisualLabGlobalSceneLocale = 'zh-Hant' | 'en';

export interface VisualLabGlobalSceneProps {
  /** A closed DTO produced from one accepted SimulationAnalysisFrame. */
  readonly frame: VisualLabGlobalSceneFrame | null;
  /** Validated, precomputed archived-TLE first frame used while the full run is rebuilding. */
  readonly artifact?: VisualLabGlobalConstellationArtifact | null;
  readonly status: VisualLabGlobalSceneStatus;
  readonly error?: string | null;
  /** Optional explicit presentation inputs; the scene host is the fallback. */
  readonly theme?: VisualLabGlobalSceneTheme;
  readonly locale?: VisualLabGlobalSceneLocale;
}

export const VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE = 14;

export const VISUAL_LAB_GLOBAL_SCENE_COPY = Object.freeze({
  'zh-Hant': Object.freeze({
    serving: '服務衛星',
    candidate: '候選衛星',
    observer: 'NTPU 觀測點',
    provenance: (constellation: string, visibleCount: number) => `地球視角 · archived TLE · SGP4 · ${constellation} · NTPU 可見 ${visibleCount} 顆`,
    artifactSummary: (constellation: string, satelliteCount: number, visibleCount: number, altitudeKm: number) => `${constellation} · ${satelliteCount.toLocaleString()} 顆衛星 · NTPU 可見 ${visibleCount} 顆 · 中位高度 ${Math.round(altitudeKm).toLocaleString()} km`,
    unavailable: '封存 TLE / SGP4 無法使用',
    loading: '正在載入封存 TLE / SGP4 場景…',
    idle: '等待封存 TLE / SGP4 場景',
  }),
  en: Object.freeze({
    serving: 'Serving satellite',
    candidate: 'Candidate satellite',
    observer: 'NTPU observer',
    provenance: (constellation: string, visibleCount: number) => `Global view · archived TLE · SGP4 · ${constellation} · ${visibleCount} visible from NTPU`,
    artifactSummary: (constellation: string, satelliteCount: number, visibleCount: number, altitudeKm: number) => `${constellation} · ${satelliteCount.toLocaleString()} satellites · ${visibleCount} visible from NTPU · median altitude ${Math.round(altitudeKm).toLocaleString()} km`,
    unavailable: 'Archived TLE / SGP4 unavailable',
    loading: 'Loading archived TLE / SGP4 scene…',
    idle: 'Waiting for an archived TLE / SGP4 scene',
  }),
});

type GlobalScenePalette = Readonly<{
  earth: string;
  atmosphere: string;
  graticule: string;
  context: string;
  visibleContext: string;
  serving: string;
  candidate: string;
  ntpu: string;
  text: string;
  labelBackground: string;
}>;

const GLOBAL_SCENE_PALETTES: Readonly<Record<VisualLabGlobalSceneTheme, GlobalScenePalette>> = Object.freeze({
  dark: Object.freeze({
    earth: '#0d3346',
    atmosphere: '#59d4ee',
    graticule: '#74cfdf',
    context: '#2e4854',
    visibleContext: '#82c4ce',
    serving: '#ffd166',
    candidate: '#5aa9ff',
    ntpu: '#ff7d8f',
    text: '#e8f4f4',
    labelBackground: 'rgba(5,17,24,.9)',
  }),
  light: Object.freeze({
    earth: '#d8e4e1',
    atmosphere: '#4d9eae',
    graticule: '#477d89',
    context: '#6b7f85',
    visibleContext: '#226a76',
    serving: '#9a6500',
    candidate: '#2a74b9',
    ntpu: '#bd3156',
    text: '#17313a',
    labelBackground: 'rgba(253,248,239,.94)',
  }),
});

function useGlobalScenePresentation(
  explicitTheme: VisualLabGlobalSceneTheme | undefined,
  explicitLocale: VisualLabGlobalSceneLocale | undefined,
): { readonly theme: VisualLabGlobalSceneTheme; readonly locale: VisualLabGlobalSceneLocale } {
  const gl = useThree((state) => state.gl);
  return useMemo(() => {
    const host = gl.domElement.closest<HTMLElement>('.vlab-app');
    const detectedTheme: VisualLabGlobalSceneTheme = host?.classList.contains('vlab-app--theme-light') ? 'light' : 'dark';
    const detectedLocale: VisualLabGlobalSceneLocale = host?.lang === 'en' ? 'en' : 'zh-Hant';
    return {
      theme: explicitTheme ?? detectedTheme,
      locale: explicitLocale ?? detectedLocale,
    };
  }, [explicitLocale, explicitTheme, gl]);
}

function constellationLabel(constellation: string): string {
  if (constellation.length === 0) return constellation;
  return `${constellation[0]!.toUpperCase()}${constellation.slice(1).toLowerCase()}`;
}

function point(value: VisualLabGlobalPoint): [number, number, number] {
  return [value[0], value[1], value[2]];
}

function EarthSphere({ palette }: { readonly palette: GlobalScenePalette }): ReactElement {
  return <group name="visual-lab-scientific-globe">
    <mesh>
      <sphereGeometry args={[VISUAL_LAB_EARTH_RADIUS, 48, 32]} />
      <meshStandardMaterial color={palette.earth} roughness={.82} metalness={.06} />
    </mesh>
    <mesh scale={1.035}>
      <sphereGeometry args={[VISUAL_LAB_EARTH_RADIUS, 32, 24]} />
      <meshBasicMaterial color={palette.atmosphere} transparent opacity={.09} side={THREE.BackSide} />
    </mesh>
    {/* Orientation only: these low-contrast rings are not a geographic map. */}
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[VISUAL_LAB_EARTH_RADIUS * 1.002, .008, 5, 96]} />
      <meshBasicMaterial color={palette.graticule} transparent opacity={.22} />
    </mesh>
    <mesh>
      <torusGeometry args={[VISUAL_LAB_EARTH_RADIUS * 1.003, .006, 5, 96]} />
      <meshBasicMaterial color={palette.graticule} transparent opacity={.16} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]} scale={[1, .5, 1]}>
      <torusGeometry args={[VISUAL_LAB_EARTH_RADIUS * 1.003, .005, 5, 96]} />
      <meshBasicMaterial color={palette.graticule} transparent opacity={.12} />
    </mesh>
  </group>;
}

function GlobalPointCloud({ frame, palette }: { readonly frame: VisualLabGlobalSceneFrame; readonly palette: GlobalScenePalette }): ReactElement {
  const geometry = useMemo(() => {
    const positions = new Float32Array(frame.satellites.length * 3);
    const colors = new Float32Array(frame.satellites.length * 3);
    const color = new THREE.Color();
    frame.satellites.forEach((satellite, index) => {
      const offset = index * 3;
      positions[offset] = satellite.positionWorld[0];
      positions[offset + 1] = satellite.positionWorld[1];
      positions[offset + 2] = satellite.positionWorld[2];
      if (satellite.role === 'serving') color.set(palette.serving);
      else if (satellite.role === 'candidate') color.set(palette.candidate);
      else if (satellite.visibleFromNtpu) color.set(palette.visibleContext);
      else color.set(palette.context);
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    });
    return { positions, colors };
  }, [frame, palette]);

  return <points name="real-tle-sgp4-constellation" frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
      <bufferAttribute attach="attributes-color" args={[geometry.colors, 3]} />
    </bufferGeometry>
    <pointsMaterial
      vertexColors
      size={.026}
      sizeAttenuation
      transparent
      opacity={.82}
      depthWrite={false}
    />
  </points>;
}

function GlobalArtifactPointCloud({ artifact, palette }: { readonly artifact: VisualLabGlobalConstellationArtifact; readonly palette: GlobalScenePalette }): ReactElement {
  const geometry = useMemo(() => {
    const positions = new Float32Array(artifact.positionsWorld);
    const colors = new Float32Array(artifact.positionsWorld.length);
    const context = new THREE.Color(palette.context);
    const visible = new THREE.Color(palette.visibleContext);
    artifact.visibility.forEach((isVisible, index) => {
      const color = isVisible === 1 ? visible : context;
      const offset = index * 3;
      colors[offset] = color.r;
      colors[offset + 1] = color.g;
      colors[offset + 2] = color.b;
    });
    return { positions, colors };
  }, [artifact, palette]);
  return <points name="real-tle-sgp4-global-artifact" frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
      <bufferAttribute attach="attributes-color" args={[geometry.colors, 3]} />
    </bufferGeometry>
    <pointsMaterial vertexColors size={.026} sizeAttenuation transparent opacity={.82} depthWrite={false} />
  </points>;
}

function GlobalArtifactSummary({ artifact, palette, copy }: { readonly artifact: VisualLabGlobalConstellationArtifact; readonly palette: GlobalScenePalette; readonly copy: (typeof VISUAL_LAB_GLOBAL_SCENE_COPY)[VisualLabGlobalSceneLocale] }): ReactElement {
  return <Html center position={[0, -2.96, 0]} className="vlab-global-provenance">
    <span
      data-testid="visual-lab-global-artifact-summary"
      data-global-artifact="true"
      data-global-artifact-constellation={artifact.constellation}
      data-global-artifact-satellite-count={artifact.satelliteCount}
      data-global-artifact-visible-count={artifact.ntpuVisibleSatelliteCount}
      data-global-artifact-median-altitude-km={artifact.medianAltitudeKm}
      style={{ color: palette.text, background: palette.labelBackground, borderRadius: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE, letterSpacing: '.03em', padding: '5px 8px' }}
    >{copy.artifactSummary(constellationLabel(artifact.constellation), artifact.satelliteCount, artifact.ntpuVisibleSatelliteCount, artifact.medianAltitudeKm)} · {artifact.instantUtc}</span>
  </Html>;
}

function markerColor(role: VisualLabGlobalSatellite['role'], palette: GlobalScenePalette): string {
  return role === 'serving' ? palette.serving : palette.candidate;
}

function SatelliteMarker({ satellite, palette, copy }: { readonly satellite: VisualLabGlobalSatellite; readonly palette: GlobalScenePalette; readonly copy: (typeof VISUAL_LAB_GLOBAL_SCENE_COPY)[VisualLabGlobalSceneLocale] }): ReactElement {
  const color = markerColor(satellite.role, palette);
  return <group position={point(satellite.positionWorld)} name={`${satellite.role}-satellite-${satellite.satelliteId}`}>
    <mesh>
      <sphereGeometry args={[satellite.role === 'serving' ? .065 : .055, 16, 12]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={.9} />
    </mesh>
    <Html center position={[0, .26, 0]} distanceFactor={7}>
      <span
        className={`vlab-global-marker vlab-global-marker--${satellite.role}`}
        style={{
          color,
          border: `1px solid ${color}`,
          background: palette.labelBackground,
          borderRadius: 3,
          display: 'inline-block',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE,
          letterSpacing: '.05em',
          lineHeight: 1.25,
          padding: '4px 6px',
          whiteSpace: 'nowrap',
        }}
      >{satellite.role === 'serving' ? copy.serving : copy.candidate} · {satellite.satelliteId}</span>
    </Html>
  </group>;
}

function ObserverMarker({ frame, palette, copy }: { readonly frame: VisualLabGlobalSceneFrame; readonly palette: GlobalScenePalette; readonly copy: (typeof VISUAL_LAB_GLOBAL_SCENE_COPY)[VisualLabGlobalSceneLocale] }): ReactElement {
  const position = point(frame.observer.positionWorld);
  const radial = new THREE.Vector3(...position).normalize();
  const quaternion = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), radial),
    [position[0], position[1], position[2]],
  );
  return <group position={position} quaternion={quaternion} name="ntpu-observer-marker">
    <mesh>
      <sphereGeometry args={[.05, 14, 10]} />
      <meshStandardMaterial color={palette.ntpu} emissive={palette.ntpu} emissiveIntensity={1.1} />
    </mesh>
    <mesh position={[0, .02, 0]}>
      <ringGeometry args={[.085, .105, 28]} />
      <meshBasicMaterial color={palette.ntpu} transparent opacity={.9} side={THREE.DoubleSide} />
    </mesh>
    <Html center position={[0, .24, 0]} distanceFactor={7}>
      <span
        className="vlab-global-marker vlab-global-marker--observer"
        style={{
          color: palette.ntpu,
          border: `1px solid ${palette.ntpu}`,
          background: palette.labelBackground,
          borderRadius: 3,
          display: 'inline-block',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE,
          letterSpacing: '.05em',
          lineHeight: 1.25,
          padding: '4px 6px',
          whiteSpace: 'nowrap',
        }}
      >{copy.observer}</span>
    </Html>
  </group>;
}

function GlobalProvenance({ frame, palette, copy }: { readonly frame: VisualLabGlobalSceneFrame; readonly palette: GlobalScenePalette; readonly copy: (typeof VISUAL_LAB_GLOBAL_SCENE_COPY)[VisualLabGlobalSceneLocale] }): ReactElement {
  return <Html center position={[0, -2.96, 0]} className="vlab-global-provenance">
    <span
      data-testid="visual-lab-global-provenance"
      data-global-frame-id={frame.frameId}
      data-global-tle-frame-id={frame.tleFrameId}
      data-global-constellation={frame.constellation}
      data-global-current-instant-utc={frame.instantUtc}
      data-global-requested-constellation={frame.requestedConstellation}
      data-global-requested-instant-utc={frame.requestedInstantUtc}
      data-global-accepted-constellation={frame.acceptedConstellation}
      data-global-accepted-instant-utc={frame.acceptedInstantUtc}
      data-global-accepted-date={frame.acceptedInstantTaipei.slice(0, 10)}
      data-global-archive-date={frame.archiveDate}
      data-global-archive-id={frame.archiveId}
      data-global-selected-tle-epoch-utc={frame.selectedTleEpochUtc}
      data-global-source-kind={frame.sourceKind}
      data-global-propagation-model={frame.propagationModel}
      data-global-mock="false"
      style={{ color: palette.text, background: palette.labelBackground, borderRadius: 4, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE, letterSpacing: '.03em', padding: '5px 8px' }}
    >{copy.provenance(constellationLabel(frame.constellation), frame.ntpuVisibleSatelliteCount)}</span>
  </Html>;
}

function trajectoryPoints(frame: VisualLabGlobalSceneFrame, candidate = false): [number, number, number][] {
  const trajectory = candidate ? frame.candidateTrajectory : frame.selectedTrajectory;
  return trajectory.map((entry) => point(entry.positionWorld));
}

function EmptyGlobalState({ status, error, palette, copy }: Pick<VisualLabGlobalSceneProps, 'status' | 'error'> & { readonly palette: GlobalScenePalette; readonly copy: (typeof VISUAL_LAB_GLOBAL_SCENE_COPY)[VisualLabGlobalSceneLocale] }): ReactElement {
  const message = status === 'error'
    ? copy.unavailable
    : status === 'loading'
      ? copy.loading
      : copy.idle;
  return <Html center position={[0, 0, 0]}>
    <span
      role={status === 'error' ? 'alert' : 'status'}
      data-testid="visual-lab-global-state"
      data-global-state={status}
      style={{ color: status === 'error' ? '#ff9f68' : palette.text, background: palette.labelBackground, border: '1px solid rgba(126,201,211,.45)', borderRadius: 4, display: 'inline-block', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: VISUAL_LAB_GLOBAL_LABEL_FONT_SIZE, letterSpacing: '.03em', padding: '7px 9px', textAlign: 'center', whiteSpace: 'nowrap' }}
    >{message}{status === 'error' && error ? ` · ${error}` : ''}</span>
  </Html>;
}

/** Globe and real frame projections; no fallback/mock geometry is accepted. */
function GlobalAcceptedContent({ frame, palette, copy }: { readonly frame: VisualLabGlobalSceneFrame; readonly palette: GlobalScenePalette; readonly copy: (typeof VISUAL_LAB_GLOBAL_SCENE_COPY)[VisualLabGlobalSceneLocale] }): ReactElement {
  return <>
    <GlobalPointCloud frame={frame} palette={palette} />
    <Line points={trajectoryPoints(frame)} color={palette.serving} lineWidth={1.45} transparent opacity={.92} />
    {frame.candidateTrajectory.length > 0 ? <Line points={trajectoryPoints(frame, true)} color={palette.candidate} lineWidth={1.05} transparent opacity={.78} /> : null}
    <ObserverMarker frame={frame} palette={palette} copy={copy} />
    <SatelliteMarker satellite={frame.selected} palette={palette} copy={copy} />
    {frame.candidate === null ? null : <SatelliteMarker satellite={frame.candidate} palette={palette} copy={copy} />}
    <GlobalProvenance frame={frame} palette={palette} copy={copy} />
  </>;
}

export function VisualLabGlobalScene({ frame, artifact = null, status, error, theme, locale }: VisualLabGlobalSceneProps): ReactElement {
  const presentation = useGlobalScenePresentation(theme, locale);
  const palette = GLOBAL_SCENE_PALETTES[presentation.theme];
  const copy = VISUAL_LAB_GLOBAL_SCENE_COPY[presentation.locale];
  return <group name="visual-lab-global-scene">
    <EarthSphere palette={palette} />
    {frame === null && artifact === null ? <EmptyGlobalState status={status} error={error} palette={palette} copy={copy} /> : frame === null && artifact !== null ? <>
      <GlobalArtifactPointCloud artifact={artifact} palette={palette} />
      <GlobalArtifactSummary artifact={artifact} palette={palette} copy={copy} />
    </> : <GlobalAcceptedContent frame={frame!} palette={palette} copy={copy} />}
  </group>;
}
