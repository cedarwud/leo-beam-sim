/**
 * Pure Director focus-pose resolver (extracted from MainScene so it can be unit
 * tested + shared by both the live inline director and the artifact-replay
 * `useDirectorCameraFocus` hook without dragging the renderer in).
 *
 * Governance: this module only computes a PRESENTATION camera pose. leo-beam-sim
 * owns camera (frontend-render-governance.md). It fabricates no sim motion and no
 * data — when a real source/target satellite pair is supplied (D6) the framing
 * uses those satellites' REAL in-frame world positions; when none is available it
 * falls back to the legacy kind-based offset. Importing only `three` keeps it
 * loadable from validators/tests.
 */
import * as THREE from 'three';
import type { DirectorFocusKind } from './types';

export interface DirectorFocusFramingPose {
  /** World position of the handover SOURCE satellite, if resolvable in-frame. */
  readonly fromSatWorldPos?: readonly [number, number, number] | null;
  /** World position of the handover TARGET satellite, if resolvable in-frame. */
  readonly toSatWorldPos?: readonly [number, number, number] | null;
}

export interface DirectorFocusPose {
  readonly position: THREE.Vector3;
  readonly target: THREE.Vector3;
}

// Legacy kind-based pull-back offsets: intra-HO is a beam-level switch on one
// satellite; inter-HO is a satellite-to-satellite handover → pull up/back so the
// satellite context above the UE comes into frame.
//
// CQ1 (cinema quality): both kinds are pulled back WIDER than the original tight
// close-up. The earlier intra offset (up 220 / back 260) framed the UE so tightly
// the shot read as a frozen zoom; the continuous focus orbit (MainScene) also needs
// room so the camera can arc without the subject filling the frame. The inter
// offset stays at its already-wide context distance.
const INTER_OFFSET = { up: 430, back: 520 } as const;
const INTRA_OFFSET = { up: 320, back: 440 } as const;

// Inter-HO satellite-pair framing: how far to pull the camera back from the framed
// group, and the minimum back distance (scaled by alpha) so a tight pair still
// reads as a wide context shot. CQ1 widens both so the orbit keeps the whole
// sat-pair + UE in frame as it arcs.
const INTER_PAIR_FIT_FACTOR = 1.6;
const INTER_PAIR_MIN_BACK = 360;
const INTER_PAIR_UP_RATIO = 0.85;

function isFinitePoint(point?: readonly [number, number, number] | null): point is readonly [number, number, number] {
  return (
    point != null
    && point.length === 3
    && Number.isFinite(point[0])
    && Number.isFinite(point[1])
    && Number.isFinite(point[2])
  );
}

function collectSatPoints(framing?: DirectorFocusFramingPose | null): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  if (isFinitePoint(framing?.fromSatWorldPos)) {
    const p = framing!.fromSatWorldPos!;
    points.push(new THREE.Vector3(p[0], p[1], p[2]));
  }
  if (isFinitePoint(framing?.toSatWorldPos)) {
    const p = framing!.toSatWorldPos!;
    points.push(new THREE.Vector3(p[0], p[1], p[2]));
  }
  return points;
}

/**
 * Frame the UE together with the satellite(s) actually involved in the handover.
 * Target = centroid of {UE, ...sats}; camera pulls up + back from the centroid
 * proportional to the group's spread so both the ground-level UE and the high
 * satellites stay in frame.
 */
function frameUeWithSatellites(
  ue: THREE.Vector3,
  sats: readonly THREE.Vector3[],
  alpha: number,
): DirectorFocusPose {
  const points = [ue, ...sats];
  const centroid = new THREE.Vector3();
  for (const point of points) centroid.add(point);
  centroid.multiplyScalar(1 / points.length);

  let radius = 0;
  for (const point of points) radius = Math.max(radius, point.distanceTo(centroid));

  const back = Math.max(INTER_PAIR_MIN_BACK * alpha, radius * INTER_PAIR_FIT_FACTOR);
  const position = centroid.clone().add(new THREE.Vector3(0, back * INTER_PAIR_UP_RATIO, back));
  return { position, target: centroid };
}

export function resolveDirectorFocusPose(
  ueWorldPos: readonly [number, number, number],
  alpha: number,
  kind: DirectorFocusKind,
  framing?: DirectorFocusFramingPose | null,
): DirectorFocusPose {
  const ue = new THREE.Vector3(ueWorldPos[0], ueWorldPos[1], ueWorldPos[2]);

  // Inter-HO with a real source/target satellite pair → frame the specific pair.
  // Intra-HO (single-satellite beam switch) and the no-pair fallback keep the
  // legacy kind-based offset; framing is ignored for intra by design.
  if (kind === 'inter') {
    const sats = collectSatPoints(framing);
    if (sats.length > 0) {
      return frameUeWithSatellites(ue, sats, alpha);
    }
  }

  const offset = kind === 'inter'
    ? new THREE.Vector3(0, INTER_OFFSET.up * alpha, INTER_OFFSET.back * alpha)
    : new THREE.Vector3(0, INTRA_OFFSET.up * alpha, INTRA_OFFSET.back * alpha);
  return { position: ue.clone().add(offset), target: ue };
}
