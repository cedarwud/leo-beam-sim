import { useEffect, useLayoutEffect, useMemo, useRef, type JSX } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { beamKeyOf, type BeamLoadContentionModel } from '../scene/beamLoadContention';
import type { CellBeamConeRenderItem } from './CellBeamCones';
import {
  MAX_FOCUS_CONES,
  UPLOAD_PARTICLES_PER_CONE_HARD_CAP,
  normalizeUploadParticleProgress,
  resolveUploadParticleConeCount,
  resolveUploadParticleCountForLoad,
  resolveUploadParticleEnabledCount,
  resolveUploadParticleGlobalCount,
} from './beamLoadUploadParticles';

export interface BeamLoadUploadParticlesProps {
  readonly focusCones: readonly CellBeamConeRenderItem[];
  readonly beamLoadContention: BeamLoadContentionModel;
  readonly focusedUe?: {
    readonly id: string;
    readonly servingSatelliteId: string;
    readonly servingBeamId: string;
  } | null;
  readonly enabled?: boolean;
  readonly paused?: boolean;
  readonly reducedMotion?: boolean;
}

export interface UploadParticleConePlan {
  readonly slotIndex: number;
  readonly key: string;
  readonly start: THREE.Vector3;
  readonly end: THREE.Vector3;
  readonly color: string;
  readonly normalizedLoad: number;
  readonly count: number;
}

const UPLOAD_PARTICLE_RADIUS_WORLD = 3.8;
const UPLOAD_PARTICLE_MIN_SCALE = 0.68;
const UPLOAD_PARTICLE_SCALE_RANGE = 0.36;
const UPLOAD_PARTICLE_RENDER_ORDER = 36;

export function BeamLoadUploadParticles({
  focusCones,
  beamLoadContention,
  focusedUe,
  enabled = true,
  paused = false,
  reducedMotion = false,
}: BeamLoadUploadParticlesProps): JSX.Element {
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color(), []);
  // Provenance audit FIX-7 follow-up (gap #2, codex P2): publish the ACTUAL summed
  // InstancedMesh instance count (post-populate `mesh.count`, not the model plan)
  // so the real-render gate proves the particle meshes actually carry instances.
  const gl = useThree(state => state.gl);
  const coneSlots = useMemo(
    () => Array.from({ length: MAX_FOCUS_CONES }, (_, slotIndex) => slotIndex),
    [],
  );
  const particleGeometry = useMemo(
    () => new THREE.SphereGeometry(UPLOAD_PARTICLE_RADIUS_WORLD, 8, 6),
    [],
  );
  const particleMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: '#ffffff',
      vertexColors: true,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
    }),
    [],
  );
  const meshArgs = useMemo<ConstructorParameters<typeof THREE.InstancedMesh>>(
    () => [particleGeometry, particleMaterial, UPLOAD_PARTICLES_PER_CONE_HARD_CAP],
    [particleGeometry, particleMaterial],
  );
  const plans = useMemo(
    () => resolveUploadParticleConePlans({
      focusCones,
      beamLoadContention,
      focusedUe,
      enabled,
      paused,
      reducedMotion,
    }),
    [beamLoadContention, enabled, focusCones, focusedUe, paused, reducedMotion],
  );

  // §8 leak guard: the pooled geometry/material are useMemo-owned and passed to
  // the instanced meshes via `args`, so R3F does not own/dispose them. Release
  // them on unmount (lane/preset switch away from explain-handover).
  useEffect(() => () => {
    particleGeometry.dispose();
    particleMaterial.dispose();
  }, [particleGeometry, particleMaterial]);

  useLayoutEffect(() => {
    for (let slotIndex = 0; slotIndex < MAX_FOCUS_CONES; slotIndex += 1) {
      const mesh = meshRefs.current[slotIndex];
      if (!mesh) continue;

      const plan = plans[slotIndex] ?? null;
      mesh.count = plan?.count ?? 0;
      mesh.visible = (plan?.count ?? 0) > 0;
      mesh.userData.uploadParticleCount = plan?.count ?? 0;
      mesh.userData.normalizedLoad = plan?.normalizedLoad ?? 0;
      mesh.userData.source = 'beam-load-contention';
      mesh.userData.channel = 'upload-particles';

      if (!plan || plan.count <= 0) continue;

      for (let particleIndex = 0; particleIndex < plan.count; particleIndex += 1) {
        writeUploadParticleMatrix({
          dummy,
          mesh,
          plan,
          particleIndex,
          elapsedSec: 0,
        });
        color.set(plan.color);
        mesh.setColorAt(particleIndex, color);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const renderedCount = meshRefs.current.reduce(
      (sum, mesh) => sum + (mesh && mesh.visible ? mesh.count : 0),
      0,
    );
    gl.domElement.dataset.uploadParticleRenderedCount = String(renderedCount);
  }, [color, dummy, gl, plans]);

  // The particles only mount in the explain-handover preset; clear the rendered
  // count on unmount so a stale non-zero value cannot survive a preset switch away.
  useEffect(() => () => {
    delete gl.domElement.dataset.uploadParticleRenderedCount;
  }, [gl]);

  useFrame(({ clock }) => {
    if (!enabled || paused || reducedMotion) return;

    const elapsedSec = clock.getElapsedTime();
    for (let slotIndex = 0; slotIndex < MAX_FOCUS_CONES; slotIndex += 1) {
      const plan = plans[slotIndex] ?? null;
      const mesh = meshRefs.current[slotIndex];
      if (!plan || !mesh || !mesh.visible || plan.count <= 0) continue;

      for (let particleIndex = 0; particleIndex < plan.count; particleIndex += 1) {
        writeUploadParticleMatrix({
          dummy,
          mesh,
          plan,
          particleIndex,
          elapsedSec,
        });
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group
      name="beam-load-upload-particles"
      userData={{
        source: 'beam-load-contention',
        channel: 'upload-particles',
        coneSlots: MAX_FOCUS_CONES,
      }}
    >
      {coneSlots.map(slotIndex => (
        <instancedMesh
          key={`beam-load-upload-particles-slot-${slotIndex}`}
          ref={node => {
            meshRefs.current[slotIndex] = node;
          }}
          args={meshArgs}
          visible={false}
          frustumCulled={false}
          renderOrder={UPLOAD_PARTICLE_RENDER_ORDER}
        />
      ))}
    </group>
  );
}

export function resolveUploadParticleConePlans(input: {
  readonly focusCones: readonly CellBeamConeRenderItem[];
  readonly beamLoadContention: BeamLoadContentionModel;
  readonly focusedUe?: BeamLoadUploadParticlesProps['focusedUe'];
  readonly enabled: boolean;
  readonly paused: boolean;
  readonly reducedMotion: boolean;
}): readonly UploadParticleConePlan[] {
  if (input.enabled === false || input.paused || input.reducedMotion) return [];

  const focusedLoad = input.focusedUe
    ? input.beamLoadContention.byUeId.get(input.focusedUe.id)
    : undefined;
  const fallbackFocusedBeamKey = input.focusedUe
    ? beamKeyOf(input.focusedUe.servingSatelliteId, input.focusedUe.servingBeamId)
    : null;
  const focusedBeamLoad = focusedLoad?.load
    ?? (fallbackFocusedBeamKey ? input.beamLoadContention.loadByBeamKey.get(fallbackFocusedBeamKey) : undefined)
    ?? 0;
  if (focusedBeamLoad <= 0) return [];

  // INV-3 (S5 adversarial review P2): the ONLY authoritative load datum is the
  // focused UE's own serving-beam load. Cone identity (cell-schedule beamIndex)
  // does not share an id space with loadByBeamKey (HandoverManager servingBeamId),
  // so a SECOND focus-satellite cone cannot be backed by its own real load. When
  // we have the focused UE's load, stream exactly ONE cone (its uplink) — never a
  // second cone painted with the focused beam's borrowed load (= invented
  // traffic). The multi-cone (<=2) path is reserved for the focusedLoad-absent
  // fallback, where each cone uses ITS OWN loadByBeamKey (resolveConeNormalizedLoad).
  const coneCount = focusedLoad !== undefined
    ? Math.min(1, resolveUploadParticleConeCount(input.focusCones.length))
    : resolveUploadParticleConeCount(input.focusCones.length);
  const selectedCones = input.focusCones.slice(0, coneCount);
  const requestedCounts = selectedCones.map(cone => (
    resolveUploadParticleCountForLoad(resolveConeNormalizedLoad({
      cone,
      beamLoadContention: input.beamLoadContention,
      focusedLoad,
    }))
  ));
  const totalCount = resolveUploadParticleGlobalCount(requestedCounts);
  let remainingCount = totalCount;

  return selectedCones.map((cone, slotIndex) => {
    const normalizedLoad = resolveConeNormalizedLoad({
      cone,
      beamLoadContention: input.beamLoadContention,
      focusedLoad,
    });
    const count = resolveUploadParticleEnabledCount({
      count: Math.min(requestedCounts[slotIndex] ?? 0, remainingCount),
      enabled: input.enabled,
      paused: input.paused,
      reducedMotion: input.reducedMotion,
    });
    remainingCount = Math.max(0, remainingCount - count);

    return {
      slotIndex,
      key: `${cone.assignment.cellId}:${cone.assignment.satId}:${cone.assignment.beamIndex}`,
      start: cone.baseCenter.clone(),
      end: cone.apex.clone(),
      color: cone.color,
      normalizedLoad,
      count,
    };
  });
}

function resolveConeNormalizedLoad(input: {
  readonly cone: CellBeamConeRenderItem;
  readonly beamLoadContention: BeamLoadContentionModel;
  readonly focusedLoad?: { readonly normalizedLoad: number } | undefined;
}): number {
  if (input.focusedLoad !== undefined) return clamp01(input.focusedLoad.normalizedLoad);

  const coneBeamKey = beamKeyOf(input.cone.assignment.satId, input.cone.assignment.beamIndex);
  const load = coneBeamKey ? input.beamLoadContention.loadByBeamKey.get(coneBeamKey) ?? 0 : 0;
  return clamp01(input.beamLoadContention.maxLoad > 0 ? load / input.beamLoadContention.maxLoad : 0);
}

function writeUploadParticleMatrix(input: {
  readonly dummy: THREE.Object3D;
  readonly mesh: THREE.InstancedMesh;
  readonly plan: UploadParticleConePlan;
  readonly particleIndex: number;
  readonly elapsedSec: number;
}): void {
  const phaseOffset = input.particleIndex / Math.max(1, input.plan.count);
  const progress = normalizeUploadParticleProgress(input.elapsedSec, phaseOffset);
  const scale = UPLOAD_PARTICLE_MIN_SCALE + Math.sin(progress * Math.PI) * UPLOAD_PARTICLE_SCALE_RANGE;
  input.dummy.position.copy(input.plan.start).lerp(input.plan.end, progress);
  input.dummy.rotation.set(0, 0, 0);
  input.dummy.scale.setScalar(scale);
  input.dummy.updateMatrix();
  input.mesh.setMatrixAt(input.particleIndex, input.dummy.matrix);
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
