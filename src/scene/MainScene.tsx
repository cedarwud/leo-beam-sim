import { Suspense, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { ACESFilmicToneMapping } from 'three';

import { loadProfile } from '../profiles';
import type { Profile } from '../profiles/types';
import {
  generateWalkerConstellation,
  propagateOrbitElement,
  createObserverContext,
  computeTopocentricPoint,
} from '../engine/orbit';
import type { TopocentricPoint } from '../engine/orbit';
import type { SatelliteSnapshot } from '../engine/signal/types';
import { computeLinkBudget } from '../engine/signal/link-budget';
import { HandoverManager } from '../engine/handover/handover-manager';

import { EarthFixedCells, generateHexGrid } from '../viz/EarthFixedCells';
import { SatelliteBeams } from '../viz/SatelliteBeams';
import type { BeamTarget } from '../viz/SatelliteBeams';
import { SatelliteMarker } from '../viz/SatelliteMarker';
import { SinrOverlay } from '../viz/SinrOverlay';
import { GroundScene } from '../viz/GroundScene';
import { NTPUScene } from '../components/scene/NTPUScene';
import { UAV } from '../components/scene/UAV';
import { Starfield } from '../components/ui/Starfield';

/**
 * Minimum elevation for satellite visibility.
 * 5° ensures satellites enter/exit well beyond scene edge (horiz=598, Y=52).
 * Link budget still uses all visible satellites; low-elevation ones have
 * high path loss and naturally contribute less.
 */
const MIN_ELEVATION_DEG = 5;     // Link budget threshold
const CACHE_ELEVATION_DEG = 1;   // Cache uses lower threshold so satellites exit beyond scene edge
const MAX_DISPLAY_SATS = 8;  // VISUAL-ONLY: max satellites shown (marker + label)
const MAX_BEAM_SATS = 3;     // VISUAL-ONLY: of those, how many show beam cones

/**
 * VISUAL-ONLY: Sky dome radius.
 * At 5° elevation: horiz = 600*cos(5°) = 598, Y = 600*sin(5°) = 52
 * Scene half-diagonal ~420, so satellites enter ~180 units beyond scene edge.
 */
/**
 * VISUAL-ONLY: Elliptical sky dome.
 * Horizontal radius controls where satellites enter/exit (must exceed scene edge ~420).
 * Vertical radius controls zenith height.
 * At el=1°: horiz = H_RADIUS * cos(1°) ≈ 700, Y = V_RADIUS * sin(1°) ≈ 7
 */
const SKY_DOME_H_RADIUS = 700; // VISUAL-ONLY: horizontal → entry/exit well beyond scene
const SKY_DOME_V_RADIUS = 400; // VISUAL-ONLY: vertical → zenith height

/**
 * Beam footprint geometry (derived from profile).
 * Half-power radius on ground ≈ altKm × tan(beamwidth3dB / 2).
 * Beam center spacing ≈ footprintRadius × √3 (hex close-pack).
 */
function computeBeamGeometry(profile: Profile) {
  const halfBeamRad = profile.antenna.beamwidth3dBRad / 2;
  const footprintRadiusKm = profile.orbit.altitudeKm * Math.tan(halfBeamRad);
  const spacingKm = footprintRadiusKm * Math.sqrt(3); // hex close-pack
  return { footprintRadiusKm, spacingKm };
}

/**
 * Generate hex-arranged beam centers (km offsets from satellite ground projection).
 * Returns ring-0 (center) + ring-1 (6 beams) + ring-2 (12 beams) = 19 beams.
 * Each satellite carries this pattern; it moves with the satellite.
 */
function generateBeamOffsetsKm(spacingKm: number, maxBeams: number): { beamId: number; dEastKm: number; dNorthKm: number }[] {
  const beams: { beamId: number; dEastKm: number; dNorthKm: number }[] = [];
  let id = 1;

  // Ring 0: center
  beams.push({ beamId: id++, dEastKm: 0, dNorthKm: 0 });

  // Ring 1: 6 beams
  if (beams.length < maxBeams) {
    for (let i = 0; i < 6 && beams.length < maxBeams; i++) {
      const angle = (i / 6) * Math.PI * 2;
      beams.push({
        beamId: id++,
        dEastKm: Math.cos(angle) * spacingKm,
        dNorthKm: Math.sin(angle) * spacingKm,
      });
    }
  }

  // Ring 2: 12 beams
  if (beams.length < maxBeams) {
    for (let i = 0; i < 12 && beams.length < maxBeams; i++) {
      const angle = (i / 12) * Math.PI * 2;
      beams.push({
        beamId: id++,
        dEastKm: Math.cos(angle) * spacingKm * 2,
        dNorthKm: Math.sin(angle) * spacingKm * 2,
      });
    }
  }

  return beams;
}

/** Convert km offset from observer to world coordinates. */
const KM_TO_WORLD = 350 / 32; // inverse of WORLD_TO_KM ≈ 10.94 world/km
const WORLD_TO_KM = 1 / KM_TO_WORLD;

export interface SimState {
  servingSatId: string | null;
  servingBeamId: number | null;
  sinrDb: number;
  hoCount: number;
  lastHoReason: string;
}

interface FrameSnapshot {
  satellites: { id: string; world: THREE.Vector3; topo: TopocentricPoint; latDeg: number; lonDeg: number }[];
  /** Per-sat beam targets in world coordinates */
  satBeams: Map<string, BeamTarget[]>;
  beamSatIds: Set<string>;
  sinrLabels: { position: THREE.Vector3; sinrDb: number; isServing: boolean }[];
  footprintRadiusWorld: number;
  servingSatId: string | null;
  servingBeamId: number | null;
}

interface SceneContentProps {
  profile: Profile;
  speed: number;
  paused: boolean;
  onSimUpdate: (state: SimState) => void;
}

function SceneContent({ profile, speed, paused, onSimUpdate }: SceneContentProps) {
  const epochMs = useMemo(() => Date.now(), []);

  const observer = useMemo(
    () => createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg),
    [profile],
  );

  const cells = useMemo(
    () => generateHexGrid({ rows: 4, cols: 5, cellRadius: 80, centerX: 0, centerZ: 0 }),
    [],
  );

  const cosObsLatStatic = Math.cos((observer.latDeg * Math.PI) / 180);
  const { footprintRadiusKm, spacingKm } = useMemo(() => computeBeamGeometry(profile), [profile]);

  /**
   * Pre-computed trajectory cache.
   * Propagate full 1584-sat Walker constellation over SIM_DURATION at 1-second steps.
   * For each timestep, store only satellites that pass elevation + serving radius filters.
   * Runtime: just index lookup + interpolation. Zero propagation per frame.
   */
  const SIM_DURATION_SEC = 3600; // 1 hour — captures multiple orbital plane passes
  const SIM_STEP_SEC = 10;      // 10-second steps → 360 steps
  interface CachedSatState {
    id: string;
    latDeg: number;
    lonDeg: number;
    ecefKm: [number, number, number];
    elevationDeg: number;
    azimuthDeg: number;
    rangeKm: number;
  }
  const trajectoryCache = useMemo(() => {
    console.time('[trajectory-cache] pre-compute');
    const elements = generateWalkerConstellation({ ...profile.orbit, epochUtcMs: epochMs });
    const obs = createObserverContext(profile.orbit.observerLatDeg, profile.orbit.observerLonDeg);
    const steps = Math.ceil(SIM_DURATION_SEC / SIM_STEP_SEC) + 1;
    const cache: CachedSatState[][] = new Array(steps);

    for (let step = 0; step < steps; step++) {
      const atUtcMs = epochMs + step * SIM_STEP_SEC * 1000;
      const visible: CachedSatState[] = [];

      for (const el of elements) {
        const orbitPt = propagateOrbitElement(el, atUtcMs);

        // Fast lat filter: at 550 km, max ground distance for el≥10° is ~20°
        const dLat = Math.abs(orbitPt.latDeg - obs.latDeg);
        if (dLat > 30) continue;

        // Elevation is the sole physical filter
        const topo = computeTopocentricPoint(obs, orbitPt.ecefKm);
        if (topo.elevationDeg < CACHE_ELEVATION_DEG) continue;

        visible.push({
          id: el.id,
          latDeg: orbitPt.latDeg,
          lonDeg: orbitPt.lonDeg,
          ecefKm: orbitPt.ecefKm,
          elevationDeg: topo.elevationDeg,
          azimuthDeg: topo.azimuthDeg,
          rangeKm: topo.rangeKm,
        });
      }
      cache[step] = visible;
    }
    console.timeEnd('[trajectory-cache] pre-compute');
    console.log(`[trajectory-cache] ${steps} steps, avg ${(cache.reduce((s, c) => s + c.length, 0) / steps).toFixed(1)} visible sats/step`);
    return cache;
  }, [profile, epochMs]);
  const beamOffsets = useMemo(
    () => generateBeamOffsetsKm(spacingKm, profile.beams.perSatellite),
    [spacingKm, profile.beams.perSatellite],
  );
  const footprintRadiusWorld = 56; // VISUAL-ONLY: matches original cellRadius * 0.7

  const hoManager = useMemo(() => new HandoverManager(profile.handover), [profile]);
  const simTimeRef = useRef(0);
  const renderAccRef = useRef(0);
  const snapRef = useRef<FrameSnapshot>({
    satellites: [],
    satBeams: new Map(),
    beamSatIds: new Set(),
    sinrLabels: [],
    footprintRadiusWorld,
    servingSatId: null,
    servingBeamId: null,
  });
  const [, setTick] = useState(0);

  useFrame((_, delta) => {
    if (paused) return;
    const dt = delta * speed;
    simTimeRef.current += dt;
    const atUtcMs = epochMs + simTimeRef.current * 1000;

    // 1. Look up pre-computed trajectory cache + interpolate between steps
    const simTimeSec = simTimeRef.current;
    const rawStep = simTimeSec / SIM_STEP_SEC;
    const maxStep = trajectoryCache.length - 1;
    const stepA = Math.min(Math.floor(rawStep), maxStep) % trajectoryCache.length;
    const stepB = Math.min(stepA + 1, maxStep) % trajectoryCache.length;
    const t = rawStep - Math.floor(rawStep); // 0..1 fractional between steps

    const cacheA = trajectoryCache[stepA];
    const cacheB = trajectoryCache[stepB];

    // Build a lookup for stepB by id for fast matching
    const cacheBMap = new Map<string, CachedSatState>();
    for (const s of cacheB) cacheBMap.set(s.id, s);

    const visibleSats: FrameSnapshot['satellites'] = cacheA.map(a => {
      const b = cacheBMap.get(a.id);
      // Interpolate az/el/range; if sat not in next step, use current values
      const elDeg = b ? a.elevationDeg + (b.elevationDeg - a.elevationDeg) * t : a.elevationDeg;
      // Azimuth wraparound: interpolate via shortest arc
      let azDeg = a.azimuthDeg;
      if (b) {
        let dAz = b.azimuthDeg - a.azimuthDeg;
        if (dAz > 180) dAz -= 360;
        if (dAz < -180) dAz += 360;
        azDeg = a.azimuthDeg + dAz * t;
      }
      const rngKm = b ? a.rangeKm + (b.rangeKm - a.rangeKm) * t : a.rangeKm;
      const lat = b ? a.latDeg + (b.latDeg - a.latDeg) * t : a.latDeg;
      const lon = b ? a.lonDeg + (b.lonDeg - a.lonDeg) * t : a.lonDeg;

      const elRad = (elDeg * Math.PI) / 180;
      const azRad = (azDeg * Math.PI) / 180;
      const horizDist = SKY_DOME_H_RADIUS * Math.cos(elRad);
      const world = new THREE.Vector3(
        horizDist * Math.sin(azRad),
        SKY_DOME_V_RADIUS * Math.sin(elRad),
        -horizDist * Math.cos(azRad),
      );
      return {
        id: a.id,
        world,
        topo: { eastKm: 0, northKm: 0, upKm: 0, rangeKm: rngKm, azimuthDeg: azDeg, elevationDeg: elDeg },
        latDeg: lat,
        lonDeg: lon,
      };
    });

    // 2. Build beam centers — satellite-attached hex pattern around nadir.
    //    Nadir position in observer-relative km uses geographic coordinates.
    const cosObsLat = Math.cos((observer.latDeg * Math.PI) / 180);
    // Link budget only uses satellites above MIN_ELEVATION_DEG
    const linkSats = visibleSats.filter(s => s.topo.elevationDeg >= MIN_ELEVATION_DEG);
    const snapshots: SatelliteSnapshot[] = linkSats.map(s => {
      // Satellite nadir in km offset from observer (ground plane)
      const nadirEastKm = (s.lonDeg - observer.lonDeg) * 111.32 * cosObsLat;
      const nadirNorthKm = (s.latDeg - observer.latDeg) * 111.32;
      return {
        id: s.id,
        ecefKm: [0, 0, 0] as [number, number, number],
        rangeKm: s.topo.rangeKm,
        elevationDeg: s.topo.elevationDeg,
        azimuthDeg: s.topo.azimuthDeg,
        beamCellsKm: beamOffsets.map(b => ({
          beamId: b.beamId,
          offsetEastKm: nadirEastKm + b.dEastKm,
          offsetNorthKm: nadirNorthKm + b.dNorthKm,
        })),
      };
    });

    // 3. Link budget
    const ue = { latDeg: observer.latDeg, lonDeg: observer.lonDeg, offsetEastKm: 0, offsetNorthKm: 0 };
    const linkSamples = computeLinkBudget(ue, snapshots, {
      channel: profile.channel,
      antenna: profile.antenna,
      beams: profile.beams,
      orbit: profile.orbit,
    });

    // 4. If serving satellite left visibility, reset
    if (hoManager.state.satId && !visibleSats.some(s => s.id === hoManager.state.satId)) {
      hoManager.state.satId = null;
      hoManager.state.beamId = null;
      hoManager.state.sinrDb = -Infinity;
      hoManager.state.triggerTimeSec = 0;
      hoManager.state.pendingTarget = null;
    }

    // 5. Handover
    const decision = hoManager.update(linkSamples, dt, atUtcMs);

    // 6. Determine beam-showing sats
    const bestSinrPerSat = new Map<string, number>();
    for (const s of linkSamples) {
      const prev = bestSinrPerSat.get(s.satId) ?? -Infinity;
      if (s.sinrDb > prev) bestSinrPerSat.set(s.satId, s.sinrDb);
    }
    const ranked = [...bestSinrPerSat.entries()].sort((a, b) => b[1] - a[1]);
    const beamSatIds = new Set<string>();
    if (hoManager.state.satId) beamSatIds.add(hoManager.state.satId);
    for (const [id] of ranked) {
      if (beamSatIds.size >= MAX_BEAM_SATS) break;
      beamSatIds.add(id);
    }

    // 7. Build per-sat beam targets in world coords (for viz)
    //    VISUAL: beam ground = satellite dome ground projection + beam pattern offset (visual scale)
    //    PHYSICS: link budget uses satellite-attached km offsets (step 2) — independent
    //    Visual scale: footprintRadiusWorld / footprintRadiusKm
    const vizScaleWorldPerKm = footprintRadiusWorld / footprintRadiusKm;
    const satBeams = new Map<string, BeamTarget[]>();
    for (const s of visibleSats) {
      if (!beamSatIds.has(s.id)) continue;

      // Show top N beams by SINR
      const satSamples = linkSamples
        .filter(l => l.satId === s.id)
        .sort((a, b) => b.sinrDb - a.sinrDb)
        .slice(0, profile.beams.maxActivePerSat);

      const targets: BeamTarget[] = satSamples.map(sample => {
        const bo = beamOffsets.find(b => b.beamId === sample.beamId);
        return {
          beamId: sample.beamId,
          groundX: s.world.x + (bo?.dEastKm ?? 0) * vizScaleWorldPerKm,
          groundZ: s.world.z - (bo?.dNorthKm ?? 0) * vizScaleWorldPerKm,
          isServing: sample.satId === hoManager.state.satId && sample.beamId === hoManager.state.beamId,
        };
      });
      satBeams.set(s.id, targets);
    }

    // 8. SINR labels
    const sinrLabels: FrameSnapshot['sinrLabels'] = [];
    for (const [satId, sinrDb] of bestSinrPerSat) {
      if (!beamSatIds.has(satId)) continue;
      const sat = visibleSats.find(s => s.id === satId);
      if (sat) {
        sinrLabels.push({
          position: sat.world,
          sinrDb,
          isServing: satId === hoManager.state.satId,
        });
      }
    }

    // Write snapshot — limit displayed satellites to top N by elevation
    // (serving sat always included; others ranked by elevation = signal relevance)
    const displaySats = [...visibleSats]
      .sort((a, b) => b.topo.elevationDeg - a.topo.elevationDeg);
    // Ensure serving sat is included
    const servingIdx = displaySats.findIndex(s => s.id === hoManager.state.satId);
    if (servingIdx > MAX_DISPLAY_SATS - 1 && servingIdx !== -1) {
      // Swap serving sat into display list
      [displaySats[MAX_DISPLAY_SATS - 1], displaySats[servingIdx]] =
        [displaySats[servingIdx], displaySats[MAX_DISPLAY_SATS - 1]];
    }
    const shownSats = displaySats.slice(0, MAX_DISPLAY_SATS);

    snapRef.current = {
      satellites: shownSats,
      satBeams,
      beamSatIds,
      sinrLabels,
      footprintRadiusWorld,
      servingSatId: hoManager.state.satId,
      servingBeamId: hoManager.state.beamId,
    };

    onSimUpdate({
      servingSatId: hoManager.state.satId,
      servingBeamId: hoManager.state.beamId,
      sinrDb: hoManager.state.sinrDb,
      hoCount: hoManager.eventLog.length,
      lastHoReason: decision.reason,
    });

    renderAccRef.current += delta;
    if (renderAccRef.current >= 0.25) {
      renderAccRef.current = 0;
      setTick(t => t + 1);
    }
  });

  const snap = snapRef.current;

  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 600, 750]} fov={60} near={0.1} far={10000} />
      <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.3} zoomSpeed={0.2} panSpeed={0.3} minDistance={50} maxDistance={3000} />

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

      {snap.satellites.map(s => (
        <SatelliteMarker
          key={s.id}
          position={s.world}
          label={s.id}
          isServing={s.id === snap.servingSatId}
        />
      ))}

      {snap.satellites
        .filter(s => snap.beamSatIds.has(s.id))
        .map(s => {
          const beams = snap.satBeams.get(s.id);
          if (!beams?.length) return null;
          return (
            <SatelliteBeams
              key={`beams-${s.id}`}
              satelliteId={s.id}
              satellitePosition={s.world}
              beams={beams}
              footprintRadius={snap.footprintRadiusWorld}
            />
          );
        })}

      <SinrOverlay beams={snap.sinrLabels} />
    </>
  );
}

export function MainScene({
  speed,
  paused,
  profileId,
  onSimUpdate,
}: {
  speed: number;
  paused: boolean;
  profileId: string;
  onSimUpdate: (state: SimState) => void;
}) {
  const profile = useMemo(() => loadProfile(profileId), [profileId]);

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
          <SceneContent profile={profile} speed={speed} paused={paused} onSimUpdate={onSimUpdate} />
        </Suspense>
      </Canvas>
    </div>
  );
}
