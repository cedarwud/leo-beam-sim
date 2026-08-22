import { useMemo, type ReactElement } from 'react';
import * as THREE from 'three';

import {
  SIX_ACTS_SHELL_BANDS,
  type SixActsShellId,
} from '../../course/sixActs/act1Shells';
import { SixActsSceneCard } from '../../course/nav/SixActsAnnotation';
import type { VisualLabGlobalConstellationArtifact } from '../../visualLab/globalConstellation';

/**
 * Act 1's own point cloud.
 *
 * It lives here rather than as another flag on `VisualLabGlobalScene` because
 * the teaching view needs shell colouring, filtering and (next) an NTPU cone,
 * none of which the shared comparison view wants. Keeping it in the route
 * avoids growing the shared render path — see the flag budget in
 * docs/frontend-change-contract.md rule 5.
 *
 * Display only: it recolours and hides points. Positions, the horizon mask and
 * the artifact itself are untouched.
 */

/** One colour per shell, plus the dimmed state for filtered-out points. */
export const ACT1_SHELL_COLOURS: Readonly<Record<SixActsShellId, string>> = Object.freeze({
  'mid-43': '#f2b134',
  'main-53': '#4ee1c1',
  'high-70': '#7aa5ff',
  polar: '#ff7ab8',
  other: '#8aa0aa',
});

/**
 * Filtered-out points stay VISIBLE, just quiet.
 *
 * The first value (#1d3138) was so dark that selecting the 53 deg shell read as
 * "the poles are empty" rather than "the poles are not in this shell" — the
 * globe looked broken, which is the opposite of the honesty this filter exists
 * for. The other shells must remain plainly there.
 */
export const ACT1_DIMMED_COLOUR = '#4a6b76';

export type Act1ShellFilter = SixActsShellId | 'all';

export interface Act1ConstellationSceneProps {
  readonly artifact: VisualLabGlobalConstellationArtifact;
  /**
   * Live frame positions and mask. When present they REPLACE the artifact's
   * single instant — the two share a display frame and a transform, so a point
   * does not jump when the timeline takes over.
   */
  readonly framePositions: Float32Array | null;
  readonly frameShells: readonly (SixActsShellId | null)[] | null;
  /** Shell per point, aligned to `artifact.satelliteIds`; null = unclassified. */
  readonly shells: readonly (SixActsShellId | null)[] | null;
  readonly filter: Act1ShellFilter;
  /** 1 = inside the classroom cone, aligned to `artifact.satelliteIds`. */
  readonly ntpuVisible: Uint8Array | null;
}

export function Act1ConstellationPointCloud({
  artifact,
  shells,
  filter,
  ntpuVisible,
  framePositions,
  frameShells,
}: Act1ConstellationSceneProps): ReactElement {
  const geometry = useMemo(() => {
    const live = framePositions !== null;
    const positions = live
      ? framePositions
      : new Float32Array(artifact.positionsWorld);
    const activeShells = live ? frameShells : shells;
    const pointCount = positions.length / 3;
    const colors = new Float32Array(positions.length);
    const cache = new Map<string, THREE.Color>();
    const colourFor = (hex: string): THREE.Color => {
      let colour = cache.get(hex);
      if (colour === undefined) {
        colour = new THREE.Color(hex);
        cache.set(hex, colour);
      }
      return colour;
    };

    for (let index = 0; index < pointCount; index += 1) {
      const shell = activeShells?.[index] ?? null;
      // Before the catalogue lands every point keeps one neutral colour, so the
      // globe is never blank and never claims a classification it does not have.
      const inFilter = filter === 'all' || (shell !== null && shell === filter);
      const inCone = ntpuVisible !== null && ntpuVisible[index] === 1;
      const hex = activeShells === null
        ? '#b9f5f7'
        : !inFilter
          ? ACT1_DIMMED_COLOUR
          : inCone
            // Inside the cone the point takes the cone's own colour, so "which
            // ones can NTPU actually see" reads at a glance without a legend.
            ? ACT1_NTPU_COLOUR
            : ACT1_SHELL_COLOURS[shell ?? 'other'];
      const colour = colourFor(hex);
      const offset = index * 3;
      colors[offset] = colour.r;
      colors[offset + 1] = colour.g;
      colors[offset + 2] = colour.b;
    }
    return { positions, colors };
  }, [artifact, shells, filter, ntpuVisible, framePositions, frameShells]);

  return (
    <points
      name="act1-shell-filtered-cloud"
      key={geometry.positions.length}
      frustumCulled={false}
    >
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[geometry.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[geometry.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        size={0.046}
        sizeAttenuation
        transparent
        opacity={0.95}
        depthWrite={false}
      />
    </points>
  );
}

export interface Act1ShellOption {
  readonly id: Act1ShellFilter;
  readonly labelZhHant: string;
  readonly colour: string | null;
}

/** Filter options in the order the lecture walks them: main shell first, "all" last. */
export const ACT1_SHELL_OPTIONS: readonly Act1ShellOption[] = Object.freeze([
  Object.freeze({ id: 'main-53' as const, labelZhHant: '53° 主力殼', colour: ACT1_SHELL_COLOURS['main-53'] }),
  Object.freeze({ id: 'mid-43' as const, labelZhHant: '43° 中緯殼', colour: ACT1_SHELL_COLOURS['mid-43'] }),
  Object.freeze({ id: 'high-70' as const, labelZhHant: '70° 高緯殼', colour: ACT1_SHELL_COLOURS['high-70'] }),
  Object.freeze({ id: 'polar' as const, labelZhHant: '極軌群', colour: ACT1_SHELL_COLOURS.polar }),
  Object.freeze({ id: 'all' as const, labelZhHant: '全部', colour: null }),
]);

export function act1ShellClaim(filter: Act1ShellFilter): string {
  if (filter === 'all') {
    return '全部顯示。剛才那句「兩極有洞」現在對不上了——極軌那群就在畫面裡。';
  }
  const band = SIX_ACTS_SHELL_BANDS.find(candidate => candidate.id === filter);
  return band?.claimZhHant ?? '';
}

/* -- NTPU marker ---------------------------------------------------------- */

/**
 * NTPU on the globe. A marker, not a cone.
 *
 * The first version drew the actual 10 deg visibility cone. It is geometrically
 * honest and visually useless: an 80 deg half-angle cone reaching a satellite
 * shell is WIDER THAN THE EARTH, so it covered the hemisphere and hid the very
 * point cloud the act is about. The information it carried — which satellites
 * NTPU can see — is already carried by colouring those satellites, and by the
 * count in the panel. So the mesh goes and the ground station stays.
 */
export const ACT1_NTPU_COLOUR = '#ffd78a';

export function Act1NtpuMarker({
  apexWorld,
}: {
  readonly apexWorld: readonly [number, number, number];
}): ReactElement {
  return (
    <mesh position={[...apexWorld]} name="act1-ntpu-marker">
      <sphereGeometry args={[0.035, 16, 12]} />
      <meshBasicMaterial color={ACT1_NTPU_COLOUR} />
    </mesh>
  );
}
