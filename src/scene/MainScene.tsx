import { memo, Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Html, OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import { loadProfile } from '../profiles';
import type { RuntimeConfig, SimState } from './types';
import { useSimulation } from './useSimulation';
import { useBeamViz } from './useBeamViz';
import { EarthFixedCells, generateHexGrid } from '../viz/EarthFixedCells';
import { HandoverLinks } from '../viz/HandoverLinks';
import { SatelliteBeams } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SinrOverlay } from '../viz/SinrOverlay';
import { GroundScene } from '../viz/GroundScene';
import { NTPUScene } from '../components/scene/NTPUScene';
import { UAV } from '../components/scene/UAV';
import { Starfield } from '../components/ui/Starfield';

interface SceneContentProps {
  profileId: string;
  speed: number;
  paused: boolean;
  runtime: RuntimeConfig;
  onSimUpdate: (state: SimState) => void;
}

interface LatchedSignalState {
  satId: string | null;
  beamId: number | null;
  sinrDb: number | null;
}

interface HandoverPanelSnapshot {
  phase: 'pending' | 'recent-ho';
  servingSatId: string;
  servingBeamId: number;
  servingSinrDb: number | null;
  comparisonSatId: string;
  comparisonBeamId: number;
  comparisonSinrDb: number | null;
}

const UI_STABLE_UPDATE_INTERVAL_MS = 700;
const UI_HANDOVER_UPDATE_INTERVAL_MS = 250;
const SHOW_BEAMS = true;

function hasUiStateChanged(previous: SimState | null, next: SimState): boolean {
  if (!previous) return true;
  return previous.servingSatId !== next.servingSatId
    || previous.servingBeamId !== next.servingBeamId
    || previous.pendingTargetSatId !== next.pendingTargetSatId
    || previous.pendingTargetBeamId !== next.pendingTargetBeamId
    || previous.comparisonSatId !== next.comparisonSatId
    || previous.comparisonBeamId !== next.comparisonBeamId
    || previous.comparisonKind !== next.comparisonKind
    || previous.recentHoSourceSatId !== next.recentHoSourceSatId
    || previous.recentHoTargetSatId !== next.recentHoTargetSatId
    || previous.hoCount !== next.hoCount
    || previous.handoverOffsetDb !== next.handoverOffsetDb
    || previous.handoverTriggerSec !== next.handoverTriggerSec;
}

function isFinitePanelSinr(sinrDb: number | null): sinrDb is number {
  return sinrDb !== null && Number.isFinite(sinrDb) && sinrDb > -100;
}

function resolveLatchedSinr(
  latched: LatchedSignalState,
  satId: string | null,
  beamId: number | null,
  nextSinrDb: number | null,
): number | null {
  if (!satId || beamId === null) {
    latched.satId = null;
    latched.beamId = null;
    latched.sinrDb = null;
    return null;
  }

  if (isFinitePanelSinr(nextSinrDb)) {
    latched.satId = satId;
    latched.beamId = beamId;
    latched.sinrDb = nextSinrDb;
    return nextSinrDb;
  }

  if (latched.satId === satId && latched.beamId === beamId) {
    return latched.sinrDb;
  }

  latched.satId = satId;
  latched.beamId = beamId;
  latched.sinrDb = null;
  return null;
}

function normalizePanelSignal(
  satId: string | null,
  beamId: number | null,
  sinrDb: number | null,
): { satId: string | null; beamId: number | null; sinrDb: number | null } {
  if (!satId || beamId === null) {
    return { satId: null, beamId: null, sinrDb: null };
  }
  return { satId, beamId, sinrDb };
}

function SceneContent({
  profileId,
  speed,
  paused,
  runtime,
  onSimUpdate,
}: SceneContentProps) {
  const profile = useMemo(() => loadProfile(profileId), [profileId]);
  const sim = useSimulation(profile, runtime.replay, speed, paused);
  const viz = useBeamViz(sim, profile, runtime.presentationMode);
  const lastUiUpdateAtRef = useRef(0);
  const lastUiStateRef = useRef<SimState | null>(null);
  const latchedServingSinrRef = useRef<LatchedSignalState>({ satId: null, beamId: null, sinrDb: null });
  const latchedComparisonSinrRef = useRef<LatchedSignalState>({ satId: null, beamId: null, sinrDb: null });
  const handoverPanelRef = useRef<HandoverPanelSnapshot | null>(null);
  const cells = useMemo(
    () => generateHexGrid({ rows: 4, cols: 5, cellRadius: 80, centerX: 0, centerZ: 0 }),
    [],
  );

  useEffect(() => {
    const pendingTargetSinrDb = sim.pendingTargetSinrDb;
    const liveServingSinrDb = resolveLatchedSinr(
      latchedServingSinrRef.current,
      sim.serving.satId,
      sim.serving.beamId,
      sim.serving.sinrDb,
    );
    const candidateComparisonSample = [...sim.linkSamples]
      .filter(sample => sample.satId !== sim.serving.satId)
      .sort((a, b) => b.sinrDb - a.sinrDb)[0] ?? null;
    const idleComparisonSinrDb = resolveLatchedSinr(
      latchedComparisonSinrRef.current,
      candidateComparisonSample?.satId ?? null,
      candidateComparisonSample?.beamId ?? null,
      candidateComparisonSample?.sinrDb ?? null,
    );
    const previousHandoverPanel = handoverPanelRef.current;
    let panelServingSatId = sim.serving.satId;
    let panelServingBeamId = sim.serving.beamId;
    let panelServingSinrDb = liveServingSinrDb;
    let panelComparisonSatId = candidateComparisonSample?.satId ?? null;
    let panelComparisonBeamId = candidateComparisonSample?.beamId ?? null;
    let panelComparisonSinrDb = idleComparisonSinrDb;
    let panelComparisonKind: SimState['comparisonKind'] = candidateComparisonSample ? 'candidate' : null;

    if (
      sim.pendingTargetSatId !== null
      && sim.pendingTargetBeamId !== null
      && sim.serving.satId !== null
      && sim.serving.beamId !== null
    ) {
      const samePendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === sim.serving.satId
        && previousHandoverPanel.servingBeamId === sim.serving.beamId
        && previousHandoverPanel.comparisonSatId === sim.pendingTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.pendingTargetBeamId;
      const pendingServingSinrDb = isFinitePanelSinr(liveServingSinrDb)
        ? liveServingSinrDb
        : samePendingPair
          ? previousHandoverPanel.servingSinrDb
          : null;
      const pendingComparisonSinrDb = isFinitePanelSinr(pendingTargetSinrDb)
        ? pendingTargetSinrDb
        : samePendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : null;
      handoverPanelRef.current = {
        phase: 'pending',
        servingSatId: sim.serving.satId,
        servingBeamId: sim.serving.beamId,
        servingSinrDb: pendingServingSinrDb,
        comparisonSatId: sim.pendingTargetSatId,
        comparisonBeamId: sim.pendingTargetBeamId,
        comparisonSinrDb: pendingComparisonSinrDb,
      };
      panelServingSatId = handoverPanelRef.current.servingSatId;
      panelServingBeamId = handoverPanelRef.current.servingBeamId;
      panelServingSinrDb = handoverPanelRef.current.servingSinrDb;
      panelComparisonSatId = handoverPanelRef.current.comparisonSatId;
      panelComparisonBeamId = handoverPanelRef.current.comparisonBeamId;
      panelComparisonSinrDb = handoverPanelRef.current.comparisonSinrDb;
      panelComparisonKind = 'pending';
    } else if (
      sim.recentHoSourceSatId !== null
      && sim.recentHoSourceBeamId !== null
      && sim.recentHoTargetSatId !== null
      && sim.recentHoTargetBeamId !== null
    ) {
      const sameRecentPair =
        previousHandoverPanel?.phase === 'recent-ho'
        && previousHandoverPanel.servingSatId === sim.recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === sim.recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === sim.recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.recentHoTargetBeamId;
      const matchesPreviousPendingPair =
        previousHandoverPanel?.phase === 'pending'
        && previousHandoverPanel.servingSatId === sim.recentHoSourceSatId
        && previousHandoverPanel.servingBeamId === sim.recentHoSourceBeamId
        && previousHandoverPanel.comparisonSatId === sim.recentHoTargetSatId
        && previousHandoverPanel.comparisonBeamId === sim.recentHoTargetBeamId;
      const recentServingSinrDb = isFinitePanelSinr(sim.recentHoSourceSinrDb)
        ? sim.recentHoSourceSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.servingSinrDb
          : sameRecentPair
            ? previousHandoverPanel.servingSinrDb
            : null;
      const recentComparisonSinrDb = isFinitePanelSinr(sim.recentHoTargetSinrDb)
        ? sim.recentHoTargetSinrDb
        : matchesPreviousPendingPair
          ? previousHandoverPanel.comparisonSinrDb
          : sameRecentPair
            ? previousHandoverPanel.comparisonSinrDb
            : null;
      handoverPanelRef.current = {
        phase: 'recent-ho',
        servingSatId: sim.recentHoSourceSatId,
        servingBeamId: sim.recentHoSourceBeamId,
        servingSinrDb: recentServingSinrDb,
        comparisonSatId: sim.recentHoTargetSatId,
        comparisonBeamId: sim.recentHoTargetBeamId,
        comparisonSinrDb: recentComparisonSinrDb,
      };
      panelServingSatId = handoverPanelRef.current.servingSatId;
      panelServingBeamId = handoverPanelRef.current.servingBeamId;
      panelServingSinrDb = handoverPanelRef.current.servingSinrDb;
      panelComparisonSatId = handoverPanelRef.current.comparisonSatId;
      panelComparisonBeamId = handoverPanelRef.current.comparisonBeamId;
      panelComparisonSinrDb = handoverPanelRef.current.comparisonSinrDb;
      panelComparisonKind = 'recent-ho';
    } else {
      handoverPanelRef.current = null;
    }

    const normalizedServing = normalizePanelSignal(
      panelServingSatId,
      panelServingBeamId,
      panelServingSinrDb,
    );
    const normalizedComparison = normalizePanelSignal(
      panelComparisonSatId,
      panelComparisonBeamId,
      panelComparisonSinrDb,
    );
    const panelSinrDeltaDb =
      normalizedComparison.sinrDb !== null && normalizedServing.sinrDb !== null
        ? normalizedComparison.sinrDb - normalizedServing.sinrDb
        : null;

    const nextState: SimState = {
      servingSatId: normalizedServing.satId,
      servingBeamId: normalizedServing.beamId,
      pendingTargetSatId: sim.pendingTargetSatId,
      pendingTargetBeamId: sim.pendingTargetBeamId,
      pendingTargetSinrDb,
      comparisonSatId: normalizedComparison.satId,
      comparisonBeamId: normalizedComparison.beamId,
      comparisonSinrDb: normalizedComparison.sinrDb,
      comparisonKind: normalizedComparison.satId ? panelComparisonKind : null,
      sinrDeltaDb: panelSinrDeltaDb,
      recentHoSourceSatId: sim.recentHoSourceSatId,
      recentHoTargetSatId: sim.recentHoTargetSatId,
      sinrDb: normalizedServing.sinrDb ?? -Infinity,
      handoverOffsetDb: profile.handover.offsetDb,
      handoverTriggerProgressSec: sim.handoverTriggerProgressSec,
      handoverTriggerSec: profile.handover.triggerTimeSec,
      hoCount: sim.hoCount,
      lastHoReason: sim.lastHoReason,
    };
    const nowMs = performance.now();
    const handoverWindowActive =
      sim.pendingTargetSatId !== null
      || sim.recentHoSourceSatId !== null
      || sim.recentHoTargetSatId !== null;
    const uiIntervalMs = handoverWindowActive
      ? UI_HANDOVER_UPDATE_INTERVAL_MS
      : UI_STABLE_UPDATE_INTERVAL_MS;
    if (
      hasUiStateChanged(lastUiStateRef.current, nextState)
      || nowMs - lastUiUpdateAtRef.current >= uiIntervalMs
    ) {
      lastUiStateRef.current = nextState;
      lastUiUpdateAtRef.current = nowMs;
      onSimUpdate(nextState);
    }
  }, [onSimUpdate, sim]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 600, 750]} fov={60} near={0.1} far={10000} />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.3}
        zoomSpeed={0.2}
        panSpeed={0.3}
        minDistance={50}
        maxDistance={3000}
      />

      <hemisphereLight args={[0xffffff, 0x444444, 1.0]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        castShadow
        position={[0, 50, 0]}
        intensity={1.5}
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

      <Suspense fallback={null}>
        <NTPUScene />
      </Suspense>
      <Suspense fallback={null}>
        <UAV position={[0, 10, 0]} scale={10} />
      </Suspense>

      <GroundScene />
      <EarthFixedCells cells={cells} />
      <HandoverLinks satellites={viz.displaySats} eventRoles={viz.eventRoles} />

      {viz.displaySats.map(sat => (
        <SatelliteMarker
          key={sat.id}
          position={sat.world}
          label={sat.id}
          eventRole={viz.eventRoles.get(sat.id)}
        />
      ))}

      {SHOW_BEAMS && viz.displaySats
        .filter(sat => viz.beamSatIds.has(sat.id))
        .map(sat => {
          const beams = viz.satBeams.get(sat.id);
          if (!beams?.length) return null;

          return (
            <SatelliteBeams
              key={`beams-${sat.id}`}
              satelliteId={sat.id}
              satellitePosition={sat.world}
              beams={beams}
              footprintRadius={viz.footprintRadiusWorld}
            />
          );
        })}

      <SinrOverlay beams={viz.sinrLabels} />
    </>
  );
}

interface MainSceneProps {
  speed: number;
  paused: boolean;
  profileId: string;
  runtime: RuntimeConfig;
  onSimUpdate: (state: SimState) => void;
}

export const MainScene = memo(function MainScene({
  speed,
  paused,
  profileId,
  runtime,
  onSimUpdate,
}: MainSceneProps) {
  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)',
      overflow: 'hidden',
    }}>
      <Starfield starCount={180} />
      <Canvas
        shadows
        gl={{
          toneMapping: ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          alpha: true,
          powerPreference: 'high-performance',
          antialias: true,
        }}
      >
        <Suspense fallback={<Html center><div style={{ color: 'white', fontSize: 20 }}>Loading...</div></Html>}>
          <SceneContent
            profileId={profileId}
            speed={speed}
            paused={paused}
            runtime={runtime}
            onSimUpdate={onSimUpdate}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});

MainScene.displayName = 'MainScene';
