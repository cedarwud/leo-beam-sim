import { useEffect, useRef, useState, type JSX, type MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import {
  applyEeIntensityShade,
  EE_INTENSITY_TEACHING_CONTEXT_SHADE_RANGE,
  EE_INTENSITY_TEACHING_SERVING_SHADE_RANGE,
  eeIntensityOpacity,
} from '../appearance/eeIntensityShade';
import { resolveHandoverCinemaEnvelope } from '../scene/handoverDisplayIsolation';
import {
  buildHandoverTeachingScript,
  resolveTeachingFrame,
  teachingScriptTotalSec,
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
 * EE strength → cone alpha, through the SAME shared curve
 * (`appearance/eeIntensityShade.ts`) the real (non-teaching) satellite/beam
 * colour pipeline uses, with this layer's own floor/ceiling. This is not the
 * "darker swatch" the fade was originally guarded against: `sinrLiveConeStyle`
 * picks a discrete literal per ROLE, which would desync from EE and could
 * change on a role flip mid-fade. `eeIntensityOpacity` is a continuous
 * function of the SAME ratio driving the colour shade below, so opacity and
 * colour move together and neither can jump independent of EE.
 * The floor keeps a collapsing link readable instead of erasing it mid-sentence.
 * Wider than the real scene's own 0.30..1.0 span for the same reason the
 * teaching-specific shade ranges below are wider than the real scene's: a
 * lecture is read by one viewer watching two cones, not skimmed inside a
 * dense live view, so the fade can afford to be more dramatic without
 * becoming noise.
 */
const CONE_ALPHA_FLOOR = 0.08;
const CONE_ALPHA_CEILING = 0.96;
/**
 * A candidate is quieter than the link in service until it actually acquires,
 * so the two cones are separable by role before the switch as well as after.
 */
const CANDIDATE_STANDBY_FACTOR = 0.55;
/**
 * The lecture compares two beams side by side, so its footprints have to stay
 * separable — at the configured cell radius two adjacent cells are tangent,
 * and the rendered ellipse is longer than the radius along the apex azimuth,
 * so a factor of 1 would bleed the two ends into one patch. 0.85 is the
 * widened value verified (empirically, via the authored inter story, at the
 * point both cones are simultaneously near-peak opacity) to still keep the
 * pair separable while reading closer to the real pipeline's own cones,
 * which do not carry this shrink. This is display-only: the truth cell
 * radius is unchanged and nothing downstream reads it.
 */
const TEACHING_FOOTPRINT_RADIUS_FACTOR = 0.85;

function eeConeAlpha(ratio01: number): number {
  return eeIntensityOpacity(ratio01, CONE_ALPHA_FLOOR, CONE_ALPHA_CEILING);
}

interface TeachingConeEeRange {
  readonly min: number;
  readonly max: number;
}

interface TeachingConeEeRanges {
  readonly source: TeachingConeEeRange;
  readonly target: TeachingConeEeRange;
}

/**
 * Each cone's own EE floor and ceiling, from what it ACTUALLY shows on
 * screen — the source's floor/ceiling span every value it ever renders
 * from first frame to retirement, and the target's span only the window
 * from `frame.phaseIndex >= 1` (when `targetIntroduced` first lets it
 * render at all — see `resolveSample`) onward. Colour and opacity then map
 * this cone's own min..max straight onto the curve's 0..1, so "just
 * appeared" always paints at the floor and "as strong as this cone ever
 * gets in this story" always paints at the ceiling, with everything
 * between moving proportionally. That is what makes the fade legible
 * regardless of where a beam's raw EE happens to sit: nothing here reads
 * `handoverTeachingScript.ts`'s fixed 90..180 scale, so a cone that is
 * only ever authored to span, say, 150..177 still uses the FULL visual
 * range rather than a sliver of it.
 *
 * Computed once per `kind` by sampling the pure, clock-free
 * `resolveTeachingFrame` across the whole script — display-only derived
 * data, not a second EE authority: the rail's own EE bars keep reading the
 * real `teachingEeRatio01` scale directly, so the two surfaces still agree
 * on where the actual number sits; only how the cone chooses to SHOW it is
 * rescaled.
 */
const TEACHING_CONE_EE_RANGE_SAMPLE_STEP_SEC = 0.5;
const teachingConeEeRangesByKind = new Map<TeachingHandoverKind, TeachingConeEeRanges>();

function resolveTeachingConeEeRanges(kind: TeachingHandoverKind): TeachingConeEeRanges {
  const cached = teachingConeEeRangesByKind.get(kind);
  if (cached !== undefined) return cached;

  const script = buildHandoverTeachingScript(kind);
  const totalSec = teachingScriptTotalSec(script);
  let sourceMin = Infinity;
  let sourceMax = -Infinity;
  let targetMin = Infinity;
  let targetMax = -Infinity;
  for (let t = 0; t <= totalSec; t += TEACHING_CONE_EE_RANGE_SAMPLE_STEP_SEC) {
    const frame = resolveTeachingFrame(script, t);
    sourceMin = Math.min(sourceMin, frame.serving.eeKbitPerJoule);
    sourceMax = Math.max(sourceMax, frame.serving.eeKbitPerJoule);
    if (frame.phaseIndex >= 1) {
      targetMin = Math.min(targetMin, frame.winner.eeKbitPerJoule);
      targetMax = Math.max(targetMax, frame.winner.eeKbitPerJoule);
    }
  }
  const resolved: TeachingConeEeRanges = {
    source: { min: sourceMin, max: sourceMax },
    target: { min: targetMin, max: targetMax },
  };
  teachingConeEeRangesByKind.set(kind, resolved);
  return resolved;
}

function localEeRatio01(kbitPerJoule: number, range: TeachingConeEeRange): number {
  if (range.max <= range.min) return 1;
  return Math.max(0, Math.min(1, (kbitPerJoule - range.min) / (range.max - range.min)));
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

/**
 * Once the lecture reaches `frame.committed` — the SAME moment the rail and
 * the EE readout already flip to showing the winner as serving (`committed =
 * phase 'settled', or phase 'switching' at least half elapsed` — see
 * `resolveTeachingFrame` in handoverTeachingScript.ts) — hold that reading
 * for a beat so the viewer can register "done", then retire the losing beam
 * to fully invisible. Gating on `committed` rather than waiting for the
 * lecture's own final second keeps the 3D scene in sync with the rest of the
 * story instead of leaving a beam lit for ~20 more seconds after every other
 * surface has already declared the switch complete.
 *
 * Timed against the SCRIPT's own clock (`frame.elapsedSec`), not wall-clock
 * time. An earlier version used `performance.now()`, which ran at a fixed
 * real-world pace no matter what the lecture clock was doing — at 1x this
 * happened to line up, but at any other speed preset, or while paused mid-
 * fade, or after a seek, the retirement raced ahead of or lagged behind the
 * story it was supposed to be retiring. Script time removes the mismatch by
 * construction.
 *
 * `COMMITTED_HOLD_SEC` + `COMMITTED_RETIRE_FADE_SEC` = 6s is not arbitrary:
 * `committed` first turns true at 50% into the 12s `switching` phase, i.e.
 * with exactly 6s of `switching` left to run. The fade completes exactly as
 * `switching` ends and `settled` begins, so the losing beam is gone exactly
 * when the story starts calling the new link "settled" — never mid-sentence.
 *
 * The instant `committed` first turns true (`resolveTeachingCommittedAtSec`
 * below) is computed directly from the script's own phase durations, not
 * inferred from playback by latching a ref the first time a frame is
 * observed with `committed === true`. An earlier version did the latter,
 * and it broke under a seek: jumping the timeline slider straight into
 * "committed" territory made the ref latch to the ARRIVAL instant instead
 * of the true commit instant, so `heldSec` below started near zero and the
 * losing beam never retired. Since `committed`'s crossing point is a fixed
 * property of the script (phase durations only, no per-run state), reading
 * it directly is both simpler and immune to the seek order — it gives the
 * same answer whether the viewer scrubbed there or played through.
 *
 * This is layered ON TOP of the EE-only fade below, not a replacement for
 * it: that fade must stay untouched BEFORE commit (see the comment on
 * `resolveSample`) because collapsing both cones toward zero around the
 * commit was already tried and made the beams disappear exactly when the
 * story said the switch was happening. This retirement only ever starts
 * counting once `committed` is already true, so it cannot reintroduce that
 * bug — the switch itself still reads purely from EE.
 */
const COMMITTED_HOLD_SEC = 2;
const COMMITTED_RETIRE_FADE_SEC = 4;

const teachingCommittedAtSecByKind = new Map<TeachingHandoverKind, number>();

function resolveTeachingCommittedAtSec(kind: TeachingHandoverKind): number {
  const cached = teachingCommittedAtSecByKind.get(kind);
  if (cached !== undefined) return cached;

  const script = buildHandoverTeachingScript(kind);
  let phaseStartSec = 0;
  let committedAtSec = 0;
  for (const phase of script.phases) {
    if (phase.id === 'switching') {
      committedAtSec = phaseStartSec + 0.5 * phase.durationSec;
      break;
    }
    phaseStartSec += phase.durationSec;
  }
  teachingCommittedAtSecByKind.set(kind, committedAtSec);
  return committedAtSec;
}

function retiredSourceFadeMultiplier(
  frame: TeachingFrame,
  kind: TeachingHandoverKind,
): number {
  if (!frame.committed) return 1;
  const heldSec = frame.elapsedSec - resolveTeachingCommittedAtSec(kind) - COMMITTED_HOLD_SEC;
  if (heldSec <= 0) return 1;
  return Math.max(0, 1 - heldSec / COMMITTED_RETIRE_FADE_SEC);
}

function resolveSample(
  frame: TeachingFrame | null,
  kind: TeachingHandoverKind,
): TeachingConeSample {
  if (frame === null) return IDLE_SAMPLE;
  // The same crossfade shape the rest of the product's handover stories use, so
  // the release/acquire beat does not read as a different mechanism here.
  // Strength is energy efficiency and nothing else. Multiplying by a
  // release/acquire envelope on top made the pair read backwards — the source
  // was forced dark before its efficiency had actually fallen — and it drove
  // both cones toward zero around the commit, which made the beams disappear
  // exactly when the story said the switch was happening. EE alone gives the
  // intended reading: the losing beam dims as its EE falls, the winning beam
  // brightens as its EE rises, and neither ever vanishes DURING the story.
  //
  // Colour now carries the same reading, not just alpha: both cones' hue is
  // the fixed per-role literal from `handoverTeachingScript.ts`
  // (`SERVING_COLOR`/`WINNER_COLOR`/...), and `applyEeIntensityShade` only
  // varies saturation/lightness on top of it, from the SAME EE ratio driving
  // opacity above — so a viewer sees one signal (EE), read twice (how solid,
  // how deep), never two competing colour cues. The source keeps the
  // "serving" shade range and the target the "context" range for the same
  // reason the real scene does: the source is still the beam actually in
  // service until it is retired, and the target is still a candidate until
  // committed.
  const targetIntroduced = frame.phaseIndex >= 1;
  const eeRanges = resolveTeachingConeEeRanges(kind);
  const sourceRatio01 = localEeRatio01(frame.serving.eeKbitPerJoule, eeRanges.source);
  const targetRatio01 = localEeRatio01(frame.winner.eeKbitPerJoule, eeRanges.target);
  return {
    sourceColor: applyEeIntensityShade(
      frame.serving.color,
      sourceRatio01,
      EE_INTENSITY_TEACHING_SERVING_SHADE_RANGE,
    ),
    targetColor: applyEeIntensityShade(
      frame.winner.color,
      targetRatio01,
      EE_INTENSITY_TEACHING_CONTEXT_SHADE_RANGE,
    ),
    sourceOpacity: eeConeAlpha(sourceRatio01)
      * retiredSourceFadeMultiplier(frame, kind),
    targetOpacity: targetIntroduced ? eeConeAlpha(targetRatio01) : 0,
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
    const frame = frameRef.current;
    const next = resolveSample(frame, story.kind);
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
  const sourceApex = props.satelliteWorldById.get(story.sourceSatelliteId);
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
  // A same-satellite switch re-points ONE beam onto the SAME cell, so drawing a
  // second cone there puts two identical shapes on top of each other and only
  // one is ever visible. Draw a single cone instead and carry the story in its
  // colour: it starts as the losing beam and becomes the winning beam, which is
  // what a re-point actually looks like from the ground.
  if (story.kind === 'intra') {
    const acquiring = sample.targetOpacity >= sample.sourceOpacity;
    items.push({
      cellId: story.sourceCellId,
      satId: story.sourceSatelliteId,
      frequencyIndex: 0,
      color: acquiring ? sample.targetColor : sample.sourceColor,
      serving: true,
      role: 'triggered',
      apex: new THREE.Vector3(sourceApex.x, sourceApex.y, sourceApex.z),
      baseCenter: new THREE.Vector3(sourcePlacement.worldX, 0, sourcePlacement.worldZ),
      baseRadiusWorld: sourcePlacement.radiusWorld * TEACHING_FOOTPRINT_RADIUS_FACTOR,
      opacity: Math.max(sample.sourceOpacity, sample.targetOpacity),
      renderKey: `${story.storyKey}-beam`,
    });
    return (
      <>
        <TeachingConeGeometryTelemetry items={items} />
        <SinrLiveCellBeamCones
          items={items}
          layer="triggered"
          colorAuthority="item-identity"
        />
      </>
    );
  }
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
