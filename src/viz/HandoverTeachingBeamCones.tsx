import { useEffect, useRef, useState, type JSX, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { resolveHandoverCinemaEnvelope } from '../scene/handoverDisplayIsolation';
import {
  teachingEeRatio01,
  type TeachingFrame,
  type TeachingHandoverKind,
} from '../homepage/teaching/handoverTeachingScript';
import {
  SinrLiveCellBeamCones,
  type SinrLiveCellBeamConeRenderItem,
  type SinrLiveCellPlacement,
} from './SinrLiveCellBeamCones';
import { SinrLiveCellFootprintRings } from './SinrLiveCellFootprintRings';

/**
 * The two cones a handover lecture draws.
 *
 * This is a SECOND, deliberately separate cone layer. The live pipeline is
 * fail-closed on purpose — it exists so the scene can never claim a handover
 * the model did not select — and a lecture is exactly an authored handover with
 * no measured evidence behind it. Reusing that pipeline would mean defeating
 * the guard that makes the rest of the product trustworthy, so the lecture gets
 * its own display-only layer instead. Nothing here is ever read back by the
 * simulation, the decision engine, or the event index.
 *
 * The clock is not duplicated either: the same `resolveTeachingFrame` output
 * that feeds the rail and the caption arrives through `frameRef`, so the three
 * surfaces cannot drift apart.
 */
export interface HandoverTeachingSceneStory {
  readonly kind: TeachingHandoverKind;
  readonly sourceSatelliteId: string;
  readonly sourceCellId: number;
  /** Inter only; intra re-points inside the source spacecraft. */
  readonly targetSatelliteId: string | null;
  /** Intra only; inter keeps the earth-fixed serving cell. */
  readonly targetCellId: number | null;
  /**
   * Live identity for the lecture's beam labels. Carried so the layer can be
   * remounted when the scene picks a different protagonist.
   */
  readonly storyKey: string;
}

export interface HandoverTeachingBeamConesProps {
  readonly story: HandoverTeachingSceneStory | null;
  /** The live lecture frame, by reference, so the scene tree never re-renders for it. */
  readonly frameRef: MutableRefObject<TeachingFrame | null>;
  readonly placementByCellId: ReadonlyMap<number, SinrLiveCellPlacement>;
  readonly satelliteWorldById: ReadonlyMap<string, { readonly x: number; readonly y: number; readonly z: number }>;
  readonly widthScale?: number;
  readonly ellipseTiltExaggeration?: number;
}

/**
 * EE strength → cone alpha. Hierarchy is alpha, never a darker swatch
 * (`sinrLiveConeStyle`), so a link losing efficiency fades without changing hue.
 * The floor keeps a collapsing link readable instead of erasing it mid-sentence.
 */
const CONE_ALPHA_FLOOR = 0.2;
const CONE_ALPHA_CEILING = 0.86;
/**
 * A candidate is quieter than the link in service until it actually acquires,
 * so the two cones are separable by role before the switch as well as after.
 */
const CANDIDATE_STANDBY_FACTOR = 0.55;
/**
 * The lecture compares two beams side by side, so its footprints have to be
 * separable. At the configured cell radius two adjacent cells are tangent, and
 * the rendered ellipse is longer than the radius along the apex azimuth, so the
 * two ends bleed into one patch. This is display-only: the truth cell radius is
 * unchanged and nothing downstream reads it.
 */
const TEACHING_FOOTPRINT_RADIUS_FACTOR = 0.55;

function eeConeAlpha(kbitPerJoule: number): number {
  return CONE_ALPHA_FLOOR
    + teachingEeRatio01(kbitPerJoule) * (CONE_ALPHA_CEILING - CONE_ALPHA_FLOOR);
}

interface TeachingConeSample {
  readonly sourceColor: string;
  readonly targetColor: string;
  readonly sourceOpacity: number;
  readonly targetOpacity: number;
}

const IDLE_SAMPLE: TeachingConeSample = {
  sourceColor: '#facc15',
  targetColor: '#5fe3ff',
  sourceOpacity: 0,
  targetOpacity: 0,
};

/** Below this the value is visually identical, so it is not worth a re-render. */
const SAMPLE_EPSILON = 0.004;

function resolveSample(frame: TeachingFrame | null, kind: TeachingHandoverKind): TeachingConeSample {
  if (frame === null) return IDLE_SAMPLE;
  // The same crossfade shape the rest of the product's handover stories use, so
  // the release/acquire beat does not read as a different mechanism here.
  const envelope = resolveHandoverCinemaEnvelope(kind, frame.switchProgress01, 1);
  // The target enters the story when the narration introduces it, not before.
  const targetIntroduced = frame.phaseIndex >= 1;
  return {
    sourceColor: frame.serving.color,
    targetColor: frame.winner.color,
    sourceOpacity: eeConeAlpha(frame.serving.eeKbitPerJoule) * envelope.fromOpacity,
    targetOpacity: targetIntroduced
      ? eeConeAlpha(frame.winner.eeKbitPerJoule)
        * Math.max(CANDIDATE_STANDBY_FACTOR, envelope.toOpacity)
      : 0,
  };
}

export function HandoverTeachingBeamCones(props: HandoverTeachingBeamConesProps): JSX.Element | null {
  const { story, frameRef } = props;
  const [sample, setSample] = useState<TeachingConeSample>(IDLE_SAMPLE);
  const sampleRef = useRef<TeachingConeSample>(IDLE_SAMPLE);

  // R3F's loop already runs every frame; pulling the lecture frame here keeps
  // the EE fade continuous without re-rendering the whole scene tree for it.
  useFrame(() => {
    if (story === null) return;
    const next = resolveSample(frameRef.current, story.kind);
    const previous = sampleRef.current;
    if (
      next.sourceColor === previous.sourceColor
      && next.targetColor === previous.targetColor
      && Math.abs(next.sourceOpacity - previous.sourceOpacity) < SAMPLE_EPSILON
      && Math.abs(next.targetOpacity - previous.targetOpacity) < SAMPLE_EPSILON
    ) return;
    sampleRef.current = next;
    setSample(next);
  });

  if (story === null) return null;
  const sourcePlacement = props.placementByCellId.get(story.sourceCellId);
  const targetPlacement = story.kind === 'intra' && story.targetCellId !== null
    ? props.placementByCellId.get(story.targetCellId)
    : sourcePlacement;
  // Intra draws both cones from one apex, so if that spacecraft happens to sit
  // outside the camera frustum the whole story is off screen — which is what
  // "no beams at all" looked like even with correct geometry. A same-satellite
  // lecture therefore uses a synthetic apex placed directly over its own two
  // cells at a steep angle: authored teaching geometry, guaranteed in frame,
  // and it cannot drift out of view as the constellation moves.
  const liveSourceApex = props.satelliteWorldById.get(story.sourceSatelliteId);
  const sourceApex = story.kind === 'intra'
    ? (() => {
      const target = story.targetCellId === null
        ? sourcePlacement
        : props.placementByCellId.get(story.targetCellId) ?? sourcePlacement;
      if (sourcePlacement === undefined || target === undefined) return liveSourceApex;
      const midX = (sourcePlacement.worldX + target.worldX) / 2;
      const midZ = (sourcePlacement.worldZ + target.worldZ) / 2;
      const spread = Math.hypot(
        sourcePlacement.worldX - target.worldX,
        sourcePlacement.worldZ - target.worldZ,
      );
      // Offset sideways by roughly the cell spread so the pair is seen as two
      // distinct cones rather than one directly overhead, and lift to about a
      // 60 degree look-down on the further of the two.
      return {
        x: midX + spread * 0.9,
        y: Math.max(420, spread * 3.2),
        z: midZ + spread * 0.9,
      };
    })()
    : liveSourceApex;
  const targetApex = story.kind === 'inter' && story.targetSatelliteId !== null
    ? props.satelliteWorldById.get(story.targetSatelliteId)
    : sourceApex;
  if (
    sourcePlacement === undefined
    || targetPlacement === undefined
    || sourceApex === undefined
    || targetApex === undefined
  ) return null;

  const items: SinrLiveCellBeamConeRenderItem[] = [];
  if (sample.sourceOpacity > 0) {
    items.push({
      cellId: story.sourceCellId,
      satId: story.sourceSatelliteId,
      frequencyIndex: 0,
      color: sample.sourceColor,
      serving: true,
      role: 'triggered',
      apex: new THREE.Vector3(sourceApex.x, sourceApex.y, sourceApex.z),
      baseCenter: new THREE.Vector3(sourcePlacement.worldX, 0, sourcePlacement.worldZ),
      baseRadiusWorld: sourcePlacement.radiusWorld * TEACHING_FOOTPRINT_RADIUS_FACTOR,
      opacity: sample.sourceOpacity,
      renderKey: `${story.storyKey}-from`,
    });
  }
  if (sample.targetOpacity > 0) {
    items.push({
      cellId: story.targetCellId ?? story.sourceCellId,
      satId: story.targetSatelliteId ?? story.sourceSatelliteId,
      frequencyIndex: 0,
      color: sample.targetColor,
      serving: true,
      role: 'triggered',
      apex: new THREE.Vector3(targetApex.x, targetApex.y, targetApex.z),
      baseCenter: new THREE.Vector3(targetPlacement.worldX, 0, targetPlacement.worldZ),
      baseRadiusWorld: targetPlacement.radiusWorld * TEACHING_FOOTPRINT_RADIUS_FACTOR,
      opacity: sample.targetOpacity,
      renderKey: `${story.storyKey}-to`,
    });
  }
  if (items.length === 0) return null;

  return (
    <>
      <TeachingConeGeometryTelemetry items={items} />
      {/* The lecture's field is otherwise empty ground, so the two beams need
          their own footprints: a cone seen from this camera leaves the frame
          long before its apex, and the hex is what makes each end read as one
          beam landing on one cell rather than as a wash over the terrain. */}
      <SinrLiveCellFootprintRings
        items={items}
        layer="triggered"
        colorAuthority="item-identity"
        widthScale={props.widthScale}
        telemetryCountDatasetKey="handoverTeachingFootprintRenderedCount"
      />
      <SinrLiveCellBeamCones
        items={items}
      layer="triggered"
      colorAuthority="item-identity"
      widthScale={props.widthScale}
      ellipseTiltExaggeration={props.ellipseTiltExaggeration}
        telemetryCountDatasetKey="handoverTeachingConeRenderedCount"
      />
    </>
  );
}

/**
 * Cone geometry read-back.
 *
 * A mounted-component count cannot tell a drawn cone from two shapes collapsed
 * onto the terrain, so publish the apex/base pair each cone is actually built
 * from. Display-only diagnostics, in the same dataset channel the cone mounts
 * already use for their render counts.
 */
function TeachingConeGeometryTelemetry(
  { items }: { readonly items: readonly SinrLiveCellBeamConeRenderItem[] },
): null {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    gl.domElement.dataset.handoverTeachingConeGeometry = items.map(item => {
      const dy = item.apex.y - item.baseCenter.y;
      const dxz = Math.hypot(item.apex.x - item.baseCenter.x, item.apex.z - item.baseCenter.z);
      return `${item.renderKey ?? item.satId}`
        + ` apex=(${item.apex.x.toFixed(1)},${item.apex.y.toFixed(1)},${item.apex.z.toFixed(1)})`
        + ` base=(${item.baseCenter.x.toFixed(1)},${item.baseCenter.y.toFixed(1)},${item.baseCenter.z.toFixed(1)})`
        + ` dy=${dy.toFixed(1)} dxz=${dxz.toFixed(1)}`
        + ` elevDeg=${((Math.atan2(dy, Math.max(dxz, 1e-9)) * 180) / Math.PI).toFixed(1)}`
        + ` r=${item.baseRadiusWorld.toFixed(2)}`;
    }).join(' | ');
    return () => { delete gl.domElement.dataset.handoverTeachingConeGeometry; };
  }, [gl, items]);
  return null;
}
